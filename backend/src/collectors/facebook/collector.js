import axios from 'axios';
import puppeteer from 'puppeteer';
import { BaseCollector } from '../base/BaseCollector.js';
import { savePost, saveMention } from '../../services/collection/collectionService.js';
import logger from '../../config/logger.js';
import pool from '../../config/database.js';

export class FacebookCollector extends BaseCollector {
  constructor(config = {}) {
    super('facebook', config);
    this.accessToken = config.accessToken || process.env.FACEBOOK_ACCESS_TOKEN;
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
      logger.error('Facebook collection error:', error);
      if (this.useScraping) {
        itemsCollected = await this.collectViaScraping(accountId);
      }
    }

    return itemsCollected;
  }

  // 공개 데이터 수집 (계정 없이 키워드/해시태그 기반)
  async collectPublicData(keywords = [], hashtags = [], options = {}) {
    let itemsCollected = 0;

    try {
      logger.info(`Facebook public data collection: ${keywords.length} keywords, ${hashtags.length} hashtags`);
      
      // Facebook Graph API의 공개 검색 기능 사용
      if (this.accessToken) {
        const searchQueries = [...keywords, ...hashtags.map(h => `#${h.replace('#', '')}`)];
        
        for (const query of searchQueries.slice(0, 10)) { // 최대 10개 쿼리
          try {
            const response = await axios.get(
              'https://graph.facebook.com/v18.0/search',
              {
                params: {
                  q: query,
                  type: 'post',
                  access_token: this.accessToken,
                  fields: 'id,message,created_time,permalink_url,likes.summary(true),comments.summary(true),shares,from',
                  limit: 25,
                },
              }
            );

            for (const post of response.data.data || []) {
              try {
                await savePost({
                  accountId: null, // 계정 없이 저장
                  platform: 'facebook',
                  postId: post.id,
                  content: post.message || '',
                  authorUsername: post.from?.name || 'Unknown',
                  url: post.permalink_url,
                  likeCount: post.likes?.summary?.total_count || 0,
                  commentCount: post.comments?.summary?.total_count || 0,
                  shareCount: post.shares?.count || 0,
                  hashtags: this.parseHashtags(post.message || ''),
                  mentions: this.parseMentions(post.message || ''),
                  postedAt: post.created_time ? new Date(post.created_time) : new Date(),
                });
                itemsCollected++;
              } catch (error) {
                logger.error(`Error saving public Facebook post ${post.id}:`, error);
              }
            }
          } catch (error) {
            logger.error(`Facebook public search error for query "${query}":`, error.message);
            // API 에러는 계속 진행
          }
        }
      } else {
        // Access token이 없어도 스크래핑으로 시도
        logger.warn('Facebook access token not available. Attempting scraping for public data collection.');
        itemsCollected = await this.collectPublicDataViaScraping(keywords, hashtags);
      }
    } catch (error) {
      logger.error('Facebook public data collection error:', error);
      // 에러가 발생해도 스크래핑으로 시도
      try {
        itemsCollected = await this.collectPublicDataViaScraping(keywords, hashtags);
      } catch (scrapingError) {
        logger.error('Facebook scraping also failed:', scrapingError);
      }
    }

    logger.info(`Facebook public data collection completed: ${itemsCollected} items collected`);
    return itemsCollected;
  }

  // 스크래핑을 통한 공개 데이터 수집
  async collectPublicDataViaScraping(keywords = [], hashtags = [], options = {}) {
    let itemsCollected = 0;

    try {
      const searchQueries = [...hashtags.map(h => h.replace('#', '')), ...keywords];
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        for (const query of searchQueries.slice(0, 5)) {
          try {
            await page.goto(`https://www.facebook.com/hashtag/${encodeURIComponent(query)}/`, {
              waitUntil: 'networkidle2',
              timeout: 30000,
            });

            await page.waitForTimeout(3000);

            const posts = await page.evaluate(() => {
              const postElements = document.querySelectorAll('[data-pagelet="FeedUnit"]');
              const posts = [];

              postElements.slice(0, 10).forEach((element) => {
                const text = element.innerText;
                const link = element.querySelector('a[href*="/posts/"]');
                if (text && link) {
                  posts.push({
                    content: text.substring(0, 500),
                    url: link.href,
                  });
                }
              });

              return posts;
            });

            for (const post of posts) {
              try {
                const postId = post.url.split('/').pop() || `facebook_scraped_${Date.now()}_${Math.random()}`;
                await savePost({
                  accountId: null,
                  platform: 'facebook',
                  postId: postId,
                  content: post.content,
                  authorUsername: 'public',
                  url: post.url,
                  hashtags: this.parseHashtags(post.content),
                  mentions: this.parseMentions(post.content),
                  postedAt: new Date(),
                });
                itemsCollected++;
              } catch (error) {
                logger.error(`Error saving scraped Facebook post:`, error);
              }
            }
          } catch (error) {
            logger.error(`Facebook scraping error for query "${query}":`, error.message);
          }
        }
      } finally {
        await browser.close();
      }
    } catch (error) {
      logger.error('Facebook public data scraping error:', error);
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
        `https://graph.facebook.com/v18.0/${accountData.account_id}/posts`,
        {
          params: {
            access_token: this.accessToken,
            fields: 'id,message,created_time,permalink_url,likes.summary(true),comments.summary(true),shares',
          },
        }
      );

      for (const post of response.data.data || []) {
        try {
          await savePost({
            accountId,
            platform: 'facebook',
            postId: post.id,
            content: post.message || '',
            authorUsername: accountData.username,
            url: post.permalink_url,
            likeCount: post.likes?.summary?.total_count || 0,
            commentCount: post.comments?.summary?.total_count || 0,
            shareCount: post.shares?.count || 0,
            hashtags: this.parseHashtags(post.message || ''),
            mentions: this.parseMentions(post.message || ''),
            postedAt: post.created_time ? new Date(post.created_time) : new Date(),
          });
          itemsCollected++;
        } catch (error) {
          logger.error(`Error saving Facebook post ${post.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Facebook API error:', error);
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
      await page.goto(`https://www.facebook.com/${accountData.username}`, {
        waitUntil: 'networkidle2',
      });

      const posts = await page.evaluate(() => {
        const postElements = document.querySelectorAll('[data-pagelet="ProfileTimeline"] > div > div');
        const posts = [];

        postElements.forEach((element) => {
          const text = element.innerText;
          if (text && text.length > 0) {
            posts.push({
              content: text,
            });
          }
        });

        return posts.slice(0, 10);
      });

      for (const post of posts) {
        try {
          await savePost({
            accountId,
            platform: 'facebook',
            postId: `scraped_${Date.now()}_${Math.random()}`,
            content: post.content,
            authorUsername: accountData.username,
            hashtags: this.parseHashtags(post.content),
            mentions: this.parseMentions(post.content),
            postedAt: new Date(),
          });
          itemsCollected++;
        } catch (error) {
          logger.error(`Error saving scraped Facebook post:`, error);
        }
      }
    } catch (error) {
      logger.error('Facebook scraping error:', error);
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

      if (this.accessToken) {
        const response = await axios.get(
          `https://graph.facebook.com/v18.0/${postData.post_id}/comments`,
          {
            params: {
              access_token: this.accessToken,
              fields: 'id,message,created_time,from,like_count',
            },
          }
        );

        for (const comment of response.data.data || []) {
          try {
            await saveMention({
              postId,
              mentionId: comment.id,
              authorUsername: comment.from?.name || 'Unknown',
              content: comment.message,
              likeCount: comment.like_count || 0,
            });
            itemsCollected++;
          } catch (error) {
            logger.error(`Error saving Facebook comment ${comment.id}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Facebook mentions collection error:', error);
    }

    return itemsCollected;
  }

  async collectReactions(postId) {
    return 0;
  }
}

