import pool from '../../config/database.js';
import logger from '../../config/logger.js';
import Queue from 'bull';
import redisClient from '../../config/redis.js';
import { analyzePost } from '../analysis/analysisOrchestrator.js';
import { mapPostLocation } from '../location/locationMapper.js';
import { checkKeywordMatch, checkHashtagMatch } from '../monitoring/monitoringService.js';

let collectionQueue = null;

// Queue 초기화를 지연시킴 (서버 시작을 막지 않음)
const initCollectionQueue = async () => {
  if (!redisClient) {
    logger.info('Redis not available - collection queue will not be initialized');
    return;
  }
  
  try {
    collectionQueue = new Queue('collection', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
      },
    });
    logger.info('Collection queue initialized');
  } catch (error) {
    logger.error('Collection queue initialization error:', error);
    collectionQueue = null;
  }
};

// 비동기로 초기화 (서버 시작을 막지 않음) - 즉시 실행하지 않고 필요할 때만
setTimeout(() => {
  initCollectionQueue().catch(err => {
    logger.error('Failed to initialize collection queue:', err);
  });
}, 1000);

export const savePost = async (postData) => {
  try {
    const {
      accountId,
      platform,
      postId,
      content,
      authorUsername,
      url,
      mediaUrls = [],
      likeCount = 0,
      commentCount = 0,
      shareCount = 0,
      viewCount = 0,
      hashtags = [],
      mentions = [],
      locationId = null,
      postedAt,
    } = postData;

    // 필수 필드 검증
    if (!platform) {
      throw new Error('platform은 필수입니다');
    }
    if (!postId) {
      throw new Error('postId는 필수입니다');
    }
    if (content === undefined || content === null) {
      throw new Error('content는 필수입니다');
    }

    // 타입 검증
    if (!Array.isArray(mediaUrls)) {
      throw new Error('mediaUrls는 배열이어야 합니다');
    }
    if (!Array.isArray(hashtags)) {
      throw new Error('hashtags는 배열이어야 합니다');
    }
    if (!Array.isArray(mentions)) {
      throw new Error('mentions는 배열이어야 합니다');
    }

    // 숫자 필드 검증
    const numericFields = { likeCount, commentCount, shareCount, viewCount };
    for (const [field, value] of Object.entries(numericFields)) {
      if (value !== null && value !== undefined && (isNaN(value) || value < 0)) {
        throw new Error(`${field}는 0 이상의 숫자여야 합니다`);
      }
    }

    // accountId가 null일 수 있음 (공개 데이터 수집 시)
    const result = await pool.query(
      `INSERT INTO posts (
        account_id, platform, post_id, content, author_username, url,
        media_urls, like_count, comment_count, share_count, view_count,
        hashtags, mentions, location_id, posted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (post_id) DO UPDATE SET
        content = EXCLUDED.content,
        like_count = EXCLUDED.like_count,
        comment_count = EXCLUDED.comment_count,
        share_count = EXCLUDED.share_count,
        view_count = EXCLUDED.view_count,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        accountId || null, // null 허용
        platform,
        postId,
        content || '', // 빈 문자열로 기본값 설정
        authorUsername || null,
        url || null,
        mediaUrls || [],
        likeCount || 0,
        commentCount || 0,
        shareCount || 0,
        viewCount || 0,
        hashtags || [],
        mentions || [],
        locationId || null,
        postedAt || new Date(),
      ]
    );

    logger.info(`Post saved: ${postId} from ${platform}`);
    
    const savedPost = result.rows[0];
    
    // 모니터링 키워드/해시태그 확인
    try {
      const keywordMatches = await checkKeywordMatch(savedPost.content, savedPost.platform);
      const hashtagMatches = await checkHashtagMatch(savedPost.hashtags || [], savedPost.platform);
      
      if (keywordMatches.length > 0 || hashtagMatches.length > 0) {
        logger.info(`Post ${savedPost.id} matches monitoring criteria: ${keywordMatches.length} keywords, ${hashtagMatches.length} hashtags`);
        
        // 모니터링 매칭 정보 저장
        const matchType = keywordMatches.length > 0 && hashtagMatches.length > 0 ? 'both' :
                          keywordMatches.length > 0 ? 'keyword' : 'hashtag';
        const priorityScore = Math.max(
          ...keywordMatches.map(k => k.priority || 0),
          ...hashtagMatches.map(h => h.priority || 0),
          0
        );
        
        await pool.query(
          `INSERT INTO monitoring_matches (
            post_id, match_type, keyword_ids, hashtag_ids, priority_score
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            savedPost.id,
            matchType,
            keywordMatches.map(k => k.keywordId),
            hashtagMatches.map(h => h.hashtagId),
            priorityScore,
          ]
        );
      }
    } catch (error) {
      logger.error('Monitoring check error:', error);
      // 모니터링 확인 실패해도 포스트 저장은 계속 진행
    }
    
    mapPostLocation(savedPost.id, savedPost.content, {
      url: savedPost.url,
      hashtags: savedPost.hashtags,
      mentions: savedPost.mentions,
    }).catch((error) => {
      logger.error(`Location mapping failed for post ${savedPost.id}:`, error);
    });
    
    analyzePost(savedPost.id).catch((error) => {
      logger.error(`Auto-analysis failed for post ${savedPost.id}:`, error);
    });
    
    return savedPost;
  } catch (error) {
    logger.error('Save post error:', error);
    throw error;
  }
};

export const saveMention = async (mentionData) => {
  try {
    const {
      postId,
      mentionId,
      authorUsername,
      content,
      likeCount = 0,
      replyCount = 0,
      parentMentionId = null,
    } = mentionData;

    const result = await pool.query(
      `INSERT INTO mentions (
        post_id, mention_id, author_username, content,
        like_count, reply_count, parent_mention_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (mention_id) DO UPDATE SET
        content = EXCLUDED.content,
        like_count = EXCLUDED.like_count,
        reply_count = EXCLUDED.reply_count,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [postId, mentionId, authorUsername, content, likeCount, replyCount, parentMentionId]
    );

    const savedMention = result.rows[0];
    
    const { mapMentionLocation } = await import('../location/locationMapper.js');
    mapMentionLocation(savedMention.id, savedMention.content, postId).catch((error) => {
      logger.error(`Location mapping failed for mention ${savedMention.id}:`, error);
    });

    return savedMention;
  } catch (error) {
    logger.error('Save mention error:', error);
    throw error;
  }
};

export const addCollectionJob = async (jobData) => {
  try {
    if (!collectionQueue) {
      throw new Error('Collection queue is not initialized');
    }
    const job = await collectionQueue.add(jobData);
    logger.info(`Collection job added: ${job.id}`);
    return job;
  } catch (error) {
    logger.error('Add collection job error:', error);
    throw error;
  }
};

export const logCollectionJob = async (jobData) => {
  try {
    const {
      platform,
      accountId,
      jobType,
      status,
      itemsCollected = 0,
      errorMessage = null,
      startedAt,
      completedAt,
    } = jobData;

    await pool.query(
      `INSERT INTO collection_jobs (
        platform, account_id, job_type, status,
        items_collected, error_message, started_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [platform, accountId, jobType, status, itemsCollected, errorMessage, startedAt, completedAt]
    );
  } catch (error) {
    logger.error('Log collection job error:', error);
  }
};

export { collectionQueue };

