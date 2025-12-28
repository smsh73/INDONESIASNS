import axios from 'axios';
import puppeteer from 'puppeteer';
import { BaseCollector } from '../base/BaseCollector.js';
import { savePost, saveMention } from '../../services/collection/collectionService.js';
import logger from '../../config/logger.js';
import pool from '../../config/database.js';

export class TikTokCollector extends BaseCollector {
  constructor(config = {}) {
    super('tiktok', config);
    this.useScraping = true;
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
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    let itemsCollected = 0;

    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      await page.goto(`https://www.tiktok.com/@${accountData.username}`, {
        waitUntil: 'networkidle2',
      });

      await page.waitForTimeout(3000);

      const posts = await page.evaluate(() => {
        const postElements = document.querySelectorAll('[data-e2e="user-post-item"]');
        const posts = [];

        postElements.forEach((element) => {
          const link = element.querySelector('a');
          const video = element.querySelector('video');
          if (link) {
            posts.push({
              url: link.href,
              videoUrl: video?.src || '',
            });
          }
        });

        return posts.slice(0, 20);
      });

      for (const post of posts) {
        try {
          const postId = post.url.split('/').pop();
          await savePost({
            accountId,
            platform: 'tiktok',
            postId: postId || `scraped_${Date.now()}`,
            content: '',
            authorUsername: accountData.username,
            url: post.url,
            mediaUrls: [post.videoUrl].filter(Boolean),
            hashtags: [],
            mentions: [],
            postedAt: new Date(),
          });
          itemsCollected++;
        } catch (error) {
          logger.error(`Error saving scraped TikTok post:`, error);
        }
      }
    } catch (error) {
      logger.error('TikTok scraping error:', error);
      throw error;
    } finally {
      await browser.close();
    }

    return itemsCollected;
  }

  // 공개 데이터 수집 (계정 없이 키워드/해시태그 기반)
  async collectPublicData(keywords = [], hashtags = [], options = {}) {
    let itemsCollected = 0;

    try {
      // TikTok은 공개 검색이 제한적이므로 해시태그 기반 검색 사용
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
            await page.goto(`https://www.tiktok.com/tag/${encodeURIComponent(query)}`, {
              waitUntil: 'networkidle2',
              timeout: 30000,
            });

            await page.waitForTimeout(3000);

            const posts = await page.evaluate(() => {
              const postElements = document.querySelectorAll('[data-e2e="challenge-item"]');
              const posts = [];

              postElements.slice(0, 10).forEach((element) => {
                const link = element.querySelector('a');
                const video = element.querySelector('video');
                if (link) {
                  posts.push({
                    url: link.href,
                    videoUrl: video?.src || '',
                  });
                }
              });

              return posts;
            });

            for (const post of posts) {
              try {
                const postId = post.url.split('/').pop();
                await savePost({
                  accountId: null,
                  platform: 'tiktok',
                  postId: postId || `tiktok_${Date.now()}_${Math.random()}`,
                  content: '',
                  authorUsername: 'public',
                  url: post.url,
                  mediaUrls: [post.videoUrl].filter(Boolean),
                  hashtags: [query],
                  mentions: [],
                  postedAt: new Date(),
                });
                itemsCollected++;
              } catch (error) {
                logger.error(`Error saving public TikTok post:`, error);
              }
            }
          } catch (error) {
            logger.error(`TikTok public search error for query "${query}":`, error);
          }
        }
      } finally {
        await browser.close();
      }
    } catch (error) {
      logger.error('TikTok public data collection error:', error);
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
