import axios from 'axios';
import { BaseCollector } from '../base/BaseCollector.js';
import { savePost, saveMention } from '../../services/collection/collectionService.js';
import logger from '../../config/logger.js';
import pool from '../../config/database.js';

export class LinkedInCollector extends BaseCollector {
  constructor(config = {}) {
    super('linkedin', config);
    this.accessToken = config.accessToken || process.env.LINKEDIN_ACCESS_TOKEN;
  }

  async collectPosts(accountId = null, options = {}) {
    if (!accountId) {
      // 계정 없이 공개 데이터 수집
      return await this.collectPublicData([], [], options);
    }

    const account = await pool.query('SELECT * FROM accounts WHERE id = $1', [accountId]);
    if (account.rows.length === 0) {
      throw new Error('Account not found');
    }

    const accountData = account.rows[0];
    let itemsCollected = 0;

    try {
      if (!this.accessToken) {
        logger.warn('LinkedIn access token not configured');
        return 0;
      }

      const response = await axios.get(
        `https://api.linkedin.com/v2/ugcPosts`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          params: {
            q: 'authors',
            authors: `List(${accountData.account_id})`,
          },
        }
      );

      for (const post of response.data.elements || []) {
        try {
          await savePost({
            accountId,
            platform: 'linkedin',
            postId: post.id,
            content: post.specificContent?.shareContent?.shareCommentary?.text || '',
            authorUsername: accountData.username,
            hashtags: this.parseHashtags(post.specificContent?.shareContent?.shareCommentary?.text || ''),
            mentions: this.parseMentions(post.specificContent?.shareContent?.shareCommentary?.text || ''),
            postedAt: post.created?.time ? new Date(post.created.time) : new Date(),
          });
          itemsCollected++;
        } catch (error) {
          logger.error(`Error saving LinkedIn post ${post.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('LinkedIn collection error:', error);
      throw error;
    }

    return itemsCollected;
  }

  // 공개 데이터 수집 (계정 없이 키워드/해시태그 기반)
  async collectPublicData(keywords = [], hashtags = [], options = {}) {
    let itemsCollected = 0;

    try {
      if (!this.accessToken) {
        logger.warn('LinkedIn access token not available for public data collection');
        return 0;
      }

      // LinkedIn은 공개 검색이 제한적이므로 키워드 기반 검색 사용
      const searchQueries = [...keywords, ...hashtags.map(h => h.replace('#', ''))];
      
      for (const query of searchQueries.slice(0, 5)) {
        try {
          // LinkedIn 검색 API 사용 (제한적)
          const response = await axios.get(
            `https://api.linkedin.com/v2/search`,
            {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
              },
              params: {
                keywords: query,
                count: 10,
              },
            }
          );

          // LinkedIn 검색 결과는 제한적이므로 로깅만
          logger.info(`LinkedIn search completed for query: ${query}`);
        } catch (error) {
          logger.error(`LinkedIn public search error for query "${query}":`, error);
          // LinkedIn API는 공개 검색이 제한적이므로 에러는 무시
        }
      }
    } catch (error) {
      logger.error('LinkedIn public data collection error:', error);
    }

    return itemsCollected;
  }

  async collectMentions(postId) {
    return 0;
  }

  async collectReactions(postId) {
    return 0;
  }
}

