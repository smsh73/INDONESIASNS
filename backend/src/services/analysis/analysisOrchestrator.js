import { analyzeSentiment, analyzeMentionSentiment } from './sentimentService.js';
import { classifyRisk, classifyMentionRisk } from './riskClassifier.js';
import { extractLocation } from '../location/locationService.js';
import { detectActionRisk } from './actionRiskDetector.js';
import pool from '../../config/database.js';
import logger from '../../config/logger.js';

export const analyzePost = async (postId) => {
  try {
    const post = await pool.query('SELECT * FROM posts WHERE id = $1', [postId]);
    
    if (post.rows.length === 0) {
      throw new Error('Post not found');
    }

    const postData = post.rows[0];
    const account = await pool.query('SELECT * FROM accounts WHERE id = $1', [postData.account_id]);
    const isOfficial = account.rows.length > 0 ? account.rows[0].is_official : false;

    const [sentimentResult, riskResult, locationResult, actionRiskResult] = await Promise.allSettled([
      analyzeSentiment(postId, postData.content, 'id'),
      classifyRisk(postId, postData.content, isOfficial, 'id'),
      extractLocation(postData.content, {}),
      detectActionRisk(postId, postData.content, 'id'),
    ]);

    if (locationResult.status === 'fulfilled' && locationResult.value) {
      await pool.query('UPDATE posts SET location_id = $1 WHERE id = $2', [
        locationResult.value.id,
        postId,
      ]);
    }

    logger.info(`Post analysis completed: ${postId}`);

    return {
      sentiment: sentimentResult.status === 'fulfilled' ? sentimentResult.value : null,
      risk: riskResult.status === 'fulfilled' ? riskResult.value : null,
      location: locationResult.status === 'fulfilled' ? locationResult.value : null,
      actionRisk: actionRiskResult.status === 'fulfilled' ? actionRiskResult.value : null,
    };
  } catch (error) {
    logger.error('Analyze post error:', error);
    throw error;
  }
};

export const analyzeMention = async (mentionId) => {
  try {
    const mention = await pool.query('SELECT * FROM mentions WHERE id = $1', [mentionId]);
    
    if (mention.rows.length === 0) {
      throw new Error('Mention not found');
    }

    const mentionData = mention.rows[0];
    const post = await pool.query('SELECT * FROM posts WHERE id = $1', [mentionData.post_id]);
    const account = post.rows.length > 0 
      ? await pool.query('SELECT * FROM accounts WHERE id = $1', [post.rows[0].account_id])
      : { rows: [] };
    const isOfficial = account.rows.length > 0 ? account.rows[0].is_official : false;

    const [sentimentResult, riskResult] = await Promise.allSettled([
      analyzeMentionSentiment(mentionId, mentionData.content, 'id'),
      classifyMentionRisk(mentionId, mentionData.content, isOfficial, 'id'),
    ]);

    logger.info(`Mention analysis completed: ${mentionId}`);

    return {
      sentiment: sentimentResult.status === 'fulfilled' ? sentimentResult.value : null,
      risk: riskResult.status === 'fulfilled' ? riskResult.value : null,
    };
  } catch (error) {
    logger.error('Analyze mention error:', error);
    throw error;
  }
};

