import { BaseCollector } from '../base/BaseCollector.js';
import logger from '../../config/logger.js';
import pool from '../../config/database.js';
import { savePost, saveMention } from '../../services/collection/collectionService.js';

export class WhatsAppCollector extends BaseCollector {
  constructor(config = {}) {
    super('whatsapp', config);
    this.businessAccountId = config.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    this.accessToken = config.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  }

  async collectPosts(accountId) {
    try {
      const account = await pool.query('SELECT * FROM accounts WHERE id = $1', [accountId]);
      if (account.rows.length === 0) {
        throw new Error('Account not found');
      }

      const accountData = account.rows[0];
      let itemsCollected = 0;

      if (this.businessAccountId && this.accessToken) {
        itemsCollected = await this.collectViaBusinessAPI(accountData);
      } else {
        logger.warn('WhatsApp Business API credentials not configured. Using limited collection method.');
        itemsCollected = await this.collectViaWebhook(accountData);
      }

      return itemsCollected;
    } catch (error) {
      logger.error('WhatsApp collection error:', error);
      return 0;
    }
  }

  async collectViaBusinessAPI(accountData) {
    let itemsCollected = 0;
    
    try {
      logger.info(`Collecting WhatsApp posts for account: ${accountData.username}`);
      
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${this.businessAccountId}/conversations`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      const data = response.data;
      
      if (data.data && data.data.length > 0) {
        for (const conversation of data.data.slice(0, 10)) {
          try {
            const messages = await this.fetchConversationMessages(conversation.id);
            
            for (const message of messages) {
              if (message.type === 'text' && message.text) {
                const postData = {
                  accountId: accountData.id,
                  platform: 'whatsapp',
                  postId: `whatsapp_${message.id}`,
                  content: message.text.body,
                  authorUsername: message.from || accountData.username,
                  url: null,
                  likeCount: 0,
                  commentCount: 0,
                  shareCount: 0,
                  viewCount: 0,
                  hashtags: this.extractHashtags(message.text.body),
                  mentions: this.extractMentions(message.text.body),
                  postedAt: new Date(message.timestamp * 1000),
                };

                await savePost(postData);
                itemsCollected++;
              }
            }
          } catch (error) {
            logger.error(`Error processing conversation ${conversation.id}:`, error);
          }
        }
      }

      logger.info(`Collected ${itemsCollected} WhatsApp posts`);
      return itemsCollected;
    } catch (error) {
      logger.error('WhatsApp Business API collection error:', error);
      throw error;
    }
  }

  async fetchConversationMessages(conversationId) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v18.0/${conversationId}/messages`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      const data = response.data;
      return data.data || [];
    } catch (error) {
      logger.error(`Error fetching messages for conversation ${conversationId}:`, error);
      return [];
    }
  }

  async collectViaWebhook(accountData) {
    logger.warn('WhatsApp webhook collection requires webhook setup. Returning 0 items.');
    return 0;
  }

  async collectMentions(postId) {
    try {
      logger.info(`Collecting WhatsApp mentions for post: ${postId}`);
      
      const post = await pool.query('SELECT * FROM posts WHERE id = $1', [postId]);
      if (post.rows.length === 0) {
        return 0;
      }

      let itemsCollected = 0;
      
      if (this.businessAccountId && this.accessToken) {
        const response = await axios.get(
          `https://graph.facebook.com/v18.0/${postId}/comments`,
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
            },
          }
        );

        const data = response.data;
          
          if (data.data && data.data.length > 0) {
            for (const comment of data.data) {
              try {
                const mentionData = {
                  postId,
                  mentionId: `whatsapp_comment_${comment.id}`,
                  authorUsername: comment.from?.name || 'Unknown',
                  content: comment.message || comment.text || '',
                  likeCount: comment.like_count || 0,
                  replyCount: 0,
                };

                await saveMention(mentionData);
                itemsCollected++;
              } catch (error) {
                logger.error(`Error saving mention ${comment.id}:`, error);
              }
            }
          }
        }
      }

      return itemsCollected;
    } catch (error) {
      logger.error('WhatsApp mention collection error:', error);
      return 0;
    }
  }

  async collectReactions(postId) {
    try {
      logger.info(`Collecting WhatsApp reactions for post: ${postId}`);
      
      if (this.businessAccountId && this.accessToken) {
        const response = await axios.get(
          `https://graph.facebook.com/v18.0/${postId}/reactions`,
          {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
            },
          }
        );

        const data = response.data;
          return data.data?.length || 0;
        }
      }

      return 0;
    } catch (error) {
      logger.error('WhatsApp reaction collection error:', error);
      return 0;
    }
  }

  extractHashtags(text) {
    if (!text) return [];
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map((m) => m.substring(1)) : [];
  }

  extractMentions(text) {
    if (!text) return [];
    const mentionRegex = /@(\w+)/g;
    const matches = text.match(mentionRegex);
    return matches ? matches.map((m) => m.substring(1)) : [];
  }
}

