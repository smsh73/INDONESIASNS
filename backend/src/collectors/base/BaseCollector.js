import logger from '../../config/logger.js';
import { savePost, saveMention, logCollectionJob } from '../../services/collection/collectionService.js';

export class BaseCollector {
  constructor(platform, config = {}) {
    this.platform = platform;
    this.config = config;
    this.isRunning = false;
  }

  async collectPosts(accountId = null, options = {}) {
    throw new Error('collectPosts must be implemented by subclass');
  }

  async collectMentions(postId, options = {}) {
    throw new Error('collectMentions must be implemented by subclass');
  }

  async collectReactions(postId, options = {}) {
    throw new Error('collectReactions must be implemented by subclass');
  }

  // 계정 없이 공개 데이터 수집 (키워드/해시태그 기반)
  async collectPublicData(keywords = [], hashtags = [], options = {}) {
    throw new Error('collectPublicData must be implemented by subclass');
  }

  async startCollection(accountId = null, jobType = 'posts', options = {}) {
    if (this.isRunning) {
      logger.warn(`Collection already running for ${this.platform}`);
      return;
    }

    this.isRunning = true;
    const startedAt = new Date();

    try {
      await logCollectionJob({
        platform: this.platform,
        accountId,
        jobType,
        status: 'running',
        startedAt,
      });

      let itemsCollected = 0;

      if (jobType === 'posts') {
        itemsCollected = await this.collectPosts(accountId, options);
      } else if (jobType === 'mentions') {
        itemsCollected = await this.collectMentions(accountId, options);
      } else if (jobType === 'reactions') {
        itemsCollected = await this.collectReactions(accountId, options);
      } else if (jobType === 'public') {
        // 공개 데이터 수집 (계정 없이)
        const keywords = options.keywords || [];
        const hashtags = options.hashtags || [];
        itemsCollected = await this.collectPublicData(keywords, hashtags, options);
      }

      await logCollectionJob({
        platform: this.platform,
        accountId,
        jobType,
        status: 'completed',
        itemsCollected,
        startedAt,
        completedAt: new Date(),
      });

      logger.info(`Collection completed for ${this.platform}: ${itemsCollected} items`);
    } catch (error) {
      logger.error(`Collection error for ${this.platform}:`, error);
      await logCollectionJob({
        platform: this.platform,
        accountId,
        jobType,
        status: 'failed',
        errorMessage: error.message,
        startedAt,
        completedAt: new Date(),
      });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  parseHashtags(content) {
    const hashtagRegex = /#[\w]+/g;
    return content.match(hashtagRegex) || [];
  }

  parseMentions(content) {
    const mentionRegex = /@[\w]+/g;
    return content.match(mentionRegex) || [];
  }
}

