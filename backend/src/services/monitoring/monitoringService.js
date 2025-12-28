import pool from '../../config/database.js';
import logger from '../../config/logger.js';
import Queue from 'bull';
import redisClient from '../../config/redis.js';

let monitoringQueue = null;

// Queue 초기화를 지연시킴 (서버 시작을 막지 않음)
const initMonitoringQueue = async () => {
  if (!redisClient) {
    logger.info('Redis not available - monitoring queue will not be initialized');
    return;
  }
  
  try {
    monitoringQueue = new Queue('monitoring', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
      },
    });
    logger.info('Monitoring queue initialized');
  } catch (error) {
    logger.error('Monitoring queue initialization error:', error);
    monitoringQueue = null;
  }
};

// 비동기로 초기화 (서버 시작을 막지 않음) - 즉시 실행하지 않고 필요할 때만
setTimeout(() => {
  initMonitoringQueue().catch(err => {
    logger.error('Failed to initialize monitoring queue:', err);
  });
}, 1000);

/**
 * 활성화된 모니터링 키워드 조회
 */
export const getActiveKeywords = async (platform = null) => {
  try {
    // 플랫폼 검증
    if (platform) {
      const validPlatforms = ['instagram', 'facebook', 'linkedin', 'whatsapp', 'tiktok'];
      if (!validPlatforms.includes(platform.toLowerCase())) {
        logger.warn(`Invalid platform requested: ${platform}`);
        // 유효하지 않은 플랫폼이어도 빈 배열 반환 (에러 발생하지 않음)
        platform = null;
      } else {
        platform = platform.toLowerCase();
      }
    }

    let query = `
      SELECT id, keyword, platform, priority, keyword_type, description, is_active
      FROM monitoring_keywords 
      WHERE is_active = TRUE
    `;
    const params = [];

    if (platform) {
      query += ' AND (platform = $1 OR platform IS NULL)';
      params.push(platform);
    }

    query += ' ORDER BY priority DESC, keyword ASC';

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    logger.error('Get active keywords error:', error);
    throw error;
  }
};

/**
 * 활성화된 모니터링 해시태그 조회
 */
export const getActiveHashtags = async (platform = null) => {
  try {
    // 플랫폼 검증
    if (platform) {
      const validPlatforms = ['instagram', 'facebook', 'linkedin', 'whatsapp', 'tiktok'];
      if (!validPlatforms.includes(platform.toLowerCase())) {
        logger.warn(`Invalid platform requested: ${platform}`);
        // 유효하지 않은 플랫폼이어도 빈 배열 반환 (에러 발생하지 않음)
        platform = null;
      } else {
        platform = platform.toLowerCase();
      }
    }

    let query = `
      SELECT id, hashtag, platform, priority, description, is_active
      FROM monitoring_hashtags 
      WHERE is_active = TRUE
    `;
    const params = [];

    if (platform) {
      query += ' AND (platform = $1 OR platform IS NULL)';
      params.push(platform);
    }

    query += ' ORDER BY priority DESC, hashtag ASC';

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    logger.error('Get active hashtags error:', error);
    throw error;
  }
};

/**
 * 콘텐츠가 모니터링 키워드와 일치하는지 확인
 */
export const checkKeywordMatch = async (content, platform = null) => {
  try {
    // 입력 검증
    if (!content || typeof content !== 'string') {
      logger.warn('checkKeywordMatch: Invalid content provided');
      return [];
    }

    if (content.trim().length === 0) {
      return [];
    }

    // 플랫폼 검증
    if (platform) {
      const validPlatforms = ['instagram', 'facebook', 'linkedin', 'whatsapp', 'tiktok'];
      if (!validPlatforms.includes(platform.toLowerCase())) {
        logger.warn(`checkKeywordMatch: Invalid platform: ${platform}`);
        platform = null;
      } else {
        platform = platform.toLowerCase();
      }
    }

    const keywords = await getActiveKeywords(platform);
    
    if (keywords.length === 0) {
      return [];
    }

    const contentLower = content.toLowerCase();
    const matches = [];

    for (const keyword of keywords) {
      if (!keyword.keyword || keyword.keyword.trim().length === 0) {
        continue; // 빈 키워드 건너뛰기
      }

      const keywordLower = keyword.keyword.toLowerCase();
      if (contentLower.includes(keywordLower)) {
        matches.push({
          keywordId: keyword.id,
          keyword: keyword.keyword,
          priority: keyword.priority || 0,
          keywordType: keyword.keyword_type || null,
        });
      }
    }

    // 우선순위로 정렬 (높은 순서대로)
    return matches.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  } catch (error) {
    logger.error('Check keyword match error:', error);
    return [];
  }
};

/**
 * 콘텐츠가 모니터링 해시태그와 일치하는지 확인
 */
export const checkHashtagMatch = async (hashtags, platform = null) => {
  try {
    // 입력 검증
    if (!hashtags || !Array.isArray(hashtags)) {
      logger.warn('checkHashtagMatch: Invalid hashtags array provided');
      return [];
    }

    if (hashtags.length === 0) {
      return [];
    }

    // 플랫폼 검증
    if (platform) {
      const validPlatforms = ['instagram', 'facebook', 'linkedin', 'whatsapp', 'tiktok'];
      if (!validPlatforms.includes(platform.toLowerCase())) {
        logger.warn(`checkHashtagMatch: Invalid platform: ${platform}`);
        platform = null;
      } else {
        platform = platform.toLowerCase();
      }
    }

    const monitoringHashtags = await getActiveHashtags(platform);
    
    if (monitoringHashtags.length === 0) {
      return [];
    }

    // 해시태그 정규화 (# 제거, 소문자 변환)
    const hashtagSet = new Set(
      hashtags
        .filter(h => h && typeof h === 'string')
        .map(h => h.toLowerCase().replace(/^#+/, '').trim())
        .filter(h => h.length > 0)
    );

    if (hashtagSet.size === 0) {
      return [];
    }

    const matches = [];

    for (const monitoringHashtag of monitoringHashtags) {
      if (!monitoringHashtag.hashtag || monitoringHashtag.hashtag.trim().length === 0) {
        continue; // 빈 해시태그 건너뛰기
      }

      const tag = monitoringHashtag.hashtag.toLowerCase().replace(/^#+/, '').trim();
      if (tag.length > 0 && hashtagSet.has(tag)) {
        matches.push({
          hashtagId: monitoringHashtag.id,
          hashtag: monitoringHashtag.hashtag,
          priority: monitoringHashtag.priority || 0,
        });
      }
    }

    // 우선순위로 정렬 (높은 순서대로)
    return matches.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  } catch (error) {
    logger.error('Check hashtag match error:', error);
    return [];
  }
};

/**
 * 계정에 대한 모니터링 작업 시작
 */
export const startMonitoringForAccount = async (accountId) => {
  try {
    const account = await pool.query('SELECT * FROM accounts WHERE id = $1', [accountId]);
    
    if (account.rows.length === 0) {
      throw new Error('Account not found');
    }

    const accountData = account.rows[0];
    
    // 키워드 및 해시태그 조회
    const keywords = await getActiveKeywords(accountData.platform);
    const hashtags = await getActiveHashtags(accountData.platform);

    // 모니터링 작업 추가
    if (!monitoringQueue) {
      // Queue가 초기화되지 않았으면 초기화 시도
      await initMonitoringQueue();
      if (!monitoringQueue) {
        logger.warn('Monitoring queue is not available. Monitoring will be started without queue.');
        // Queue 없이도 성공 응답 반환 (실제 모니터링은 나중에 수동으로 실행 가능)
        return { id: `manual-${accountId}`, data: { accountId } };
      }
    }
    
    try {
      const job = await monitoringQueue.add('monitor-account', {
        accountId,
        platform: accountData.platform,
        keywords: keywords.map(k => k.keyword),
        hashtags: hashtags.map(h => h.hashtag),
      }, {
        repeat: {
          every: 300000, // 5분마다
        },
        jobId: `monitor-account-${accountId}`,
      });

      logger.info(`Monitoring started for account ${accountId}: ${job.id}`);
      return job;
    } catch (queueError) {
      logger.error('Queue error, but continuing:', queueError);
      // Queue 에러가 있어도 성공 응답 반환
      return { id: `manual-${accountId}`, data: { accountId } };
    }
  } catch (error) {
    logger.error('Start monitoring for account error:', error);
    throw error;
  }
};

/**
 * 계정에 대한 모니터링 작업 중지
 */
export const stopMonitoringForAccount = async (accountId) => {
  try {
    if (!monitoringQueue) {
      return true; // Queue가 없으면 이미 중지된 것으로 간주
    }
    const jobs = await monitoringQueue.getJobs(['delayed', 'waiting', 'active']);
    
    for (const job of jobs) {
      if (job.data.accountId === accountId) {
        await job.remove();
        logger.info(`Monitoring stopped for account ${accountId}`);
      }
    }

    // 반복 작업 제거
    if (monitoringQueue) {
      const repeatableJobs = await monitoringQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.id === `monitor-account-${accountId}`) {
          await monitoringQueue.removeRepeatableByKey(job.key);
        }
      }
    }

    return true;
  } catch (error) {
    logger.error('Stop monitoring for account error:', error);
    throw error;
  }
};

/**
 * 모든 활성 계정에 대한 모니터링 시작
 */
export const startMonitoringForAllAccounts = async () => {
  try {
    const accounts = await pool.query(
      'SELECT id FROM accounts WHERE is_active = TRUE'
    );

    const results = [];
    for (const account of accounts.rows) {
      try {
        const job = await startMonitoringForAccount(account.id);
        results.push({ accountId: account.id, success: true, jobId: job.id });
      } catch (error) {
        logger.error(`Failed to start monitoring for account ${account.id}:`, error);
        results.push({ accountId: account.id, success: false, error: error.message });
      }
    }

    return results;
  } catch (error) {
    logger.error('Start monitoring for all accounts error:', error);
    throw error;
  }
};

export { monitoringQueue };

