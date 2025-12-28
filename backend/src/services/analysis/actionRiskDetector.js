import { classifyRisk } from './riskClassifier.js';
import pool from '../../config/database.js';
import logger from '../../config/logger.js';

const ACTION_RISK_KEYWORDS = {
  id: [
    'demo', 'unjuk rasa', 'protes', 'mogok', 'aksi', 'pembakaran',
    'penjarahan', 'kerusuhan', 'bentrokan', 'konflik', 'kekerasan',
    'serangan', 'bom', 'teror', 'ancaman', 'bahaya', 'darurat'
  ],
  en: [
    'protest', 'demonstration', 'strike', 'riot', 'violence', 'attack',
    'bomb', 'terror', 'threat', 'danger', 'emergency', 'conflict'
  ],
};

export const detectActionRisk = async (postId, content, language = 'id') => {
  try {
    if (!content || content.trim().length === 0) {
      return null;
    }

    const keywords = ACTION_RISK_KEYWORDS[language] || ACTION_RISK_KEYWORDS.id;
    const contentLower = content.toLowerCase();
    
    const matchedKeywords = keywords.filter(keyword => 
      contentLower.includes(keyword.toLowerCase())
    );

    if (matchedKeywords.length === 0) {
      return {
        hasActionRisk: false,
        confidence: 0,
        matchedKeywords: [],
      };
    }

    const riskResult = await classifyRisk(postId, content, false, language);

    return {
      hasActionRisk: true,
      confidence: matchedKeywords.length / keywords.length,
      matchedKeywords,
      riskClassification: riskResult,
    };
  } catch (error) {
    logger.error('Action risk detection error:', error);
    throw error;
  }
};

export const analyzeEngagementForRisk = async (postId) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.like_count,
        p.comment_count,
        p.share_count,
        COUNT(m.id) as mention_count,
        COUNT(CASE WHEN rc.risk_level IN ('high', 'critical') THEN 1 END) as high_risk_mentions
      FROM posts p
      LEFT JOIN mentions m ON p.id = m.post_id
      LEFT JOIN risk_classification rc ON m.id = rc.mention_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [postId]);

    if (result.rows.length === 0) {
      return null;
    }

    const data = result.rows[0];
    const totalEngagement = 
      parseInt(data.like_count) + 
      parseInt(data.comment_count) + 
      parseInt(data.share_count) + 
      parseInt(data.mention_count);

    const riskRatio = totalEngagement > 0 
      ? parseInt(data.high_risk_mentions) / totalEngagement 
      : 0;

    return {
      totalEngagement,
      highRiskMentions: parseInt(data.high_risk_mentions),
      riskRatio,
      isHighEngagement: totalEngagement > 1000,
      isHighRiskEngagement: riskRatio > 0.1,
    };
  } catch (error) {
    logger.error('Engagement risk analysis error:', error);
    throw error;
  }
};

