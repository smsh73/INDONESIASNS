import pool from '../../config/database.js';
import logger from '../../config/logger.js';
import Queue from 'bull';
import redisClient from '../../config/redis.js';
import { FacebookCollector } from '../../collectors/facebook/collector.js';
import { InstagramCollector } from '../../collectors/instagram/collector.js';
import { getActiveKeywords, getActiveHashtags } from './monitoringService.js';

let publicCollectionQueue = null;

// Queue 초기화
const initPublicCollectionQueue = async () => {
  if (!redisClient) {
    logger.info('Redis not available - public collection queue will not be initialized');
    return;
  }
  
  try {
    publicCollectionQueue = new Queue('public-collection', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
      },
    });

    // 키워드 기반 공개 데이터 수집 작업 처리
    publicCollectionQueue.process('collect-by-keywords', async (job) => {
      const { platform, keywords, hashtags } = job.data;
      
      logger.info(`Starting public data collection for platform: ${platform}, keywords: ${keywords.length}, hashtags: ${hashtags.length}`);
      
      try {
        let collector;
        const collectorConfig = {};
        
        switch (platform) {
          case 'facebook':
            collector = new FacebookCollector(collectorConfig);
            break;
          case 'instagram':
            collector = new InstagramCollector(collectorConfig);
            break;
          case 'tiktok':
            const { TikTokCollector } = await import('../../collectors/tiktok/collector.js');
            collector = new TikTokCollector(collectorConfig);
            break;
          case 'linkedin':
            const { LinkedInCollector } = await import('../../collectors/linkedin/collector.js');
            collector = new LinkedInCollector(collectorConfig);
            break;
          default:
            throw new Error(`Platform ${platform} not supported for public data collection`);
        }
        
        const itemsCollected = await collector.collectPublicData(keywords || [], hashtags || [], {});
        
        logger.info(`Public data collection completed: ${itemsCollected} items collected`);
        
        return { itemsCollected, platform, keywords, hashtags };
      } catch (error) {
        logger.error(`Public data collection error for platform ${platform}:`, error);
        throw error; // Queue가 재시도할 수 있도록 에러 전파
      }
    });

    logger.info('Public collection queue initialized');
  } catch (error) {
    logger.error('Public collection queue initialization error:', error);
    publicCollectionQueue = null;
  }
};

// 비동기로 초기화
setTimeout(() => {
  initPublicCollectionQueue().catch(err => {
    logger.error('Failed to initialize public collection queue:', err);
  });
}, 2000);

/**
 * 키워드 기반 공개 데이터 수집 작업 시작
 */
export const startKeywordBasedCollection = async (platform, intervalMinutes = 60) => {
  try {
    // Queue가 없으면 초기화 시도
    if (!publicCollectionQueue) {
      await initPublicCollectionQueue();
      if (!publicCollectionQueue) {
        logger.warn('Public collection queue is not available. Collection will run without queue.');
        // Queue 없이도 수집은 가능하지만 스케줄링은 안 됨
        return { id: `manual-${platform}`, data: { platform } };
      }
    }

    // 활성 키워드 및 해시태그 조회
    const keywords = await getActiveKeywords(platform);
    const hashtags = await getActiveHashtags(platform);

    if (keywords.length === 0 && hashtags.length === 0) {
      logger.warn(`No active keywords or hashtags found for platform: ${platform}`);
      return null;
    }

    const keywordList = keywords.map(k => k.keyword);
    const hashtagList = hashtags.map(h => h.hashtag);

    try {
      // 반복 작업 추가
      const job = await publicCollectionQueue.add(
        'collect-by-keywords',
        {
          platform,
          keywords: keywordList,
          hashtags: hashtagList,
        },
        {
          repeat: {
            every: intervalMinutes * 60 * 1000, // 분을 밀리초로 변환
          },
          jobId: `public-collection-${platform}`,
        }
      );

      logger.info(`Keyword-based collection started for ${platform}: ${job.id}`);
      return job;
    } catch (queueError) {
      logger.error('Queue error, but continuing:', queueError);
      return { id: `manual-${platform}`, data: { platform } };
    }
  } catch (error) {
    logger.error('Start keyword-based collection error:', error);
    throw error;
  }
};

/**
 * 키워드 기반 공개 데이터 수집 작업 중지
 */
export const stopKeywordBasedCollection = async (platform) => {
  try {
    if (!publicCollectionQueue) {
      return true;
    }

    const repeatableJobs = await publicCollectionQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.id === `public-collection-${platform}`) {
        await publicCollectionQueue.removeRepeatableByKey(job.key);
        logger.info(`Keyword-based collection stopped for ${platform}`);
      }
    }

    return true;
  } catch (error) {
    logger.error('Stop keyword-based collection error:', error);
    throw error;
  }
};

/**
 * 모든 플랫폼에 대한 키워드 기반 수집 시작
 */
export const startAllKeywordBasedCollection = async (intervalMinutes = 60) => {
  try {
    const platforms = ['facebook', 'instagram', 'tiktok', 'linkedin'];
    const results = [];

    for (const platform of platforms) {
      try {
        const job = await startKeywordBasedCollection(platform, intervalMinutes);
        results.push({ platform, success: true, jobId: job?.id || null });
      } catch (error) {
        logger.error(`Failed to start keyword-based collection for ${platform}:`, error);
        results.push({ platform, success: false, error: error.message });
      }
    }

    return results;
  } catch (error) {
    logger.error('Start all keyword-based collection error:', error);
    throw error;
  }
};

/**
 * 즉시 키워드 기반 수집 실행 (일회성)
 */
export const runKeywordBasedCollectionNow = async (platform) => {
  try {
    // Queue가 없으면 직접 실행
    if (!publicCollectionQueue) {
      await initPublicCollectionQueue();
      if (!publicCollectionQueue) {
        logger.warn('Public collection queue is not available. Running collection directly.');
        // Queue 없이 직접 실행
        const keywords = await getActiveKeywords(platform);
        const hashtags = await getActiveHashtags(platform);
        const keywordList = keywords.map(k => k.keyword);
        const hashtagList = hashtags.map(h => h.hashtag);

        let collector;
        const collectorConfig = {};
        
        switch (platform) {
          case 'facebook':
            collector = new FacebookCollector(collectorConfig);
            break;
          case 'instagram':
            collector = new InstagramCollector(collectorConfig);
            break;
          case 'tiktok':
            const { TikTokCollector } = await import('../../collectors/tiktok/collector.js');
            collector = new TikTokCollector(collectorConfig);
            break;
          case 'linkedin':
            const { LinkedInCollector } = await import('../../collectors/linkedin/collector.js');
            collector = new LinkedInCollector(collectorConfig);
            break;
          default:
            throw new Error(`Platform ${platform} not supported for public data collection`);
        }

        const itemsCollected = await collector.collectPublicData(keywordList, hashtagList, {});
        logger.info(`Direct public data collection completed for ${platform}: ${itemsCollected} items`);
        return { id: `direct-${platform}-${Date.now()}`, data: { platform, itemsCollected } };
      }
    }

    const keywords = await getActiveKeywords(platform);
    const hashtags = await getActiveHashtags(platform);

    const keywordList = keywords.map(k => k.keyword);
    const hashtagList = hashtags.map(h => h.hashtag);

    try {
      const job = await publicCollectionQueue.add(
        'collect-by-keywords',
        {
          platform,
          keywords: keywordList,
          hashtags: hashtagList,
        },
        {
          jobId: `public-collection-now-${platform}-${Date.now()}`,
        }
      );

      logger.info(`Immediate keyword-based collection started for ${platform}: ${job.id}`);
      return job;
    } catch (queueError) {
      logger.error('Queue error, running directly:', queueError);
      // Queue 에러 시 직접 실행
      return await runKeywordBasedCollectionNow(platform);
    }
  } catch (error) {
    logger.error('Run keyword-based collection now error:', error);
    throw error;
  }
};

export { publicCollectionQueue };

