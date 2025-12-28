import axios from 'axios';
import puppeteer from 'puppeteer';
import { BaseCollector } from '../base/BaseCollector.js';
import { savePost, saveMention } from '../../services/collection/collectionService.js';
import logger from '../../config/logger.js';
import pool from '../../config/database.js';

export class InstagramCollector extends BaseCollector {
  constructor(config = {}) {
    super('instagram', config);
    this.accessToken = config.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN;
    this.useScraping = config.useScraping !== false;
  }

  async collectPosts(accountId = null, options = {}) {
    let itemsCollected = 0;

    try {
      if (!accountId) {
        // 계정 없이 공개 데이터 수집
        return await this.collectPublicData([], [], options);
      }

      if (this.accessToken && !this.useScraping) {
        itemsCollected = await this.collectViaAPI(accountId);
      } else {
        itemsCollected = await this.collectViaScraping(accountId);
      }
    } catch (error) {
      logger.error('Instagram collection error:', error);
      if (this.useScraping && accountId) {
        itemsCollected = await this.collectViaScraping(accountId);
      }
    }

    return itemsCollected;
  }

  // 공개 데이터 수집 (계정 없이 키워드/해시태그 기반)
  async collectPublicData(keywords = [], hashtags = [], options = {}) {
    let itemsCollected = 0;

    try {
      // Instagram Graph API 해시태그 검색 사용
      if (this.accessToken) {
        const searchQueries = [...hashtags.map(h => h.replace('#', '')), ...keywords];
        
        for (const query of searchQueries.slice(0, 10)) {
          try {
            // Instagram Graph API 해시태그 검색
            const hashtagResponse = await axios.get(
              `https://graph.instagram.com/ig_hashtag_search`,
              {
                params: {
                  user_id: 'me',
                  q: query,
                  access_token: this.accessToken,
                },
              }
            );

            if (hashtagResponse.data.data && hashtagResponse.data.data.length > 0) {
              const hashtagId = hashtagResponse.data.data[0].id;
              
              const mediaResponse = await axios.get(
                `https://graph.instagram.com/${hashtagId}/top_media`,
                {
                  params: {
                    user_id: 'me',
                    fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count',
                    access_token: this.accessToken,
                    limit: 25,
                  },
                }
              );

              for (const media of mediaResponse.data.data || []) {
                try {
                  await savePost({
                    accountId: null,
                    platform: 'instagram',
                    postId: media.id,
                    content: media.caption || '',
                    authorUsername: 'public',
                    url: media.permalink,
                    mediaUrls: [media.media_url || media.thumbnail_url].filter(Boolean),
                    likeCount: media.like_count || 0,
                    commentCount: media.comments_count || 0,
                    hashtags: this.parseHashtags(media.caption || ''),
                    mentions: this.parseMentions(media.caption || ''),
                    postedAt: media.timestamp ? new Date(media.timestamp) : new Date(),
                  });
                  itemsCollected++;
                } catch (error) {
                  logger.error(`Error saving public Instagram post ${media.id}:`, error);
                }
              }
            }
          } catch (error) {
            logger.error(`Instagram public search error for query "${query}":`, error);
          }
        }
      } else {
        logger.warn('Instagram access token not available for public data collection');
      }
    } catch (error) {
      logger.error('Instagram public data collection error:', error);
    }

    return itemsCollected;
  }

  async collectViaAPI(accountId) {
    const account = await pool.query('SELECT * FROM accounts WHERE id = $1', [accountId]);
    if (account.rows.length === 0) {
      throw new Error('Account not found');
    }

    const accountData = account.rows[0];
    let itemsCollected = 0;

    try {
      const response = await axios.get(
        `https://graph.instagram.com/${accountData.account_id}/media`,
        {
          params: {
            access_token: this.accessToken,
            fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,like_count,comments_count',
          },
        }
      );

      for (const media of response.data.data) {
        try {
          await savePost({
            accountId,
            platform: 'instagram',
            postId: media.id,
            content: media.caption || '',
            authorUsername: accountData.username,
            url: media.permalink,
            mediaUrls: [media.media_url || media.thumbnail_url].filter(Boolean),
            likeCount: media.like_count || 0,
            commentCount: media.comments_count || 0,
            hashtags: this.parseHashtags(media.caption || ''),
            mentions: this.parseMentions(media.caption || ''),
            postedAt: media.timestamp ? new Date(media.timestamp) : new Date(),
          });
          itemsCollected++;
        } catch (error) {
          logger.error(`Error saving Instagram post ${media.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Instagram API error:', error);
      throw error;
    }

    return itemsCollected;
  }

  async collectViaScraping(accountId) {
    const account = await pool.query('SELECT * FROM accounts WHERE id = $1', [accountId]);
    if (account.rows.length === 0) {
      throw new Error('Account not found');
    }

    const accountData = account.rows[0];
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    let itemsCollected = 0;

    try {
      const page = await browser.newPage();
      await page.goto(`https://www.instagram.com/${accountData.username}/`, {
        waitUntil: 'networkidle2',
      });

      const posts = await page.evaluate(() => {
        const postElements = document.querySelectorAll('article > div > div > div > div');
        const posts = [];

        postElements.forEach((element) => {
          const link = element.querySelector('a');
          const img = element.querySelector('img');
          if (link && img) {
            posts.push({
              url: link.href,
              imageUrl: img.src,
            });
          }
        });

        return posts.slice(0, 12);
      });

      for (const post of posts) {
        try {
          const postId = post.url.split('/').filter(Boolean).pop();
          await savePost({
            accountId,
            platform: 'instagram',
            postId: postId || `scraped_${Date.now()}`,
            content: '',
            authorUsername: accountData.username,
            url: post.url,
            mediaUrls: [post.imageUrl],
            hashtags: [],
            mentions: [],
            postedAt: new Date(),
          });
          itemsCollected++;
        } catch (error) {
          logger.error(`Error saving scraped Instagram post:`, error);
        }
      }
    } catch (error) {
      logger.error('Instagram scraping error:', error);
      throw error;
    } finally {
      await browser.close();
    }

    return itemsCollected;
  }

  async collectMentions(postId) {
    let itemsCollected = 0;

    try {
      const post = await pool.query('SELECT * FROM posts WHERE id = $1', [postId]);
      if (post.rows.length === 0) {
        throw new Error('Post not found');
      }

      const postData = post.rows[0];

      if (this.accessToken && !this.useScraping) {
        const response = await axios.get(
          `https://graph.instagram.com/${postData.post_id}/comments`,
          {
            params: {
              access_token: this.accessToken,
              fields: 'id,text,username,timestamp,like_count',
            },
          }
        );

        for (const comment of response.data.data || []) {
          try {
            await saveMention({
              postId,
              mentionId: comment.id,
              authorUsername: comment.username,
              content: comment.text,
              likeCount: comment.like_count || 0,
            });
            itemsCollected++;
          } catch (error) {
            logger.error(`Error saving Instagram comment ${comment.id}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Instagram mentions collection error:', error);
    }

    return itemsCollected;
  }

  async collectReactions(postId) {
    return 0;
  }
}

