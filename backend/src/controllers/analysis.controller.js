import pool from '../config/database.js';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';
import { analyzePost as analyzePostService, analyzeMention as analyzeMentionService } from '../services/analysis/analysisOrchestrator.js';

export const getAnalysis = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sentiment, risk, region } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        p.*,
        sa.sentiment_category,
        sa.confidence_score as sentiment_confidence,
        rc.risk_category,
        rc.risk_level,
        rc.confidence_score as risk_confidence,
        l.province,
        l.city,
        l.district
      FROM posts p
      LEFT JOIN sentiment_analysis sa ON p.id = sa.post_id
      LEFT JOIN risk_classification rc ON p.id = rc.post_id
      LEFT JOIN locations l ON p.location_id = l.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (sentiment) {
      query += ` AND sa.sentiment_category = $${paramCount}`;
      params.push(sentiment);
      paramCount++;
    }

    if (risk) {
      query += ` AND rc.risk_category = $${paramCount}`;
      params.push(risk);
      paramCount++;
    }

    if (region) {
      query += ` AND l.province = $${paramCount}`;
      params.push(region);
      paramCount++;
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    logger.error('Analysis error:', error);
    next(error);
  }
};

export const getAnalysisByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { type = 'sentiment' } = req.query;

    let query;
    if (type === 'sentiment') {
      query = `
        SELECT p.*, sa.*
        FROM posts p
        INNER JOIN sentiment_analysis sa ON p.id = sa.post_id
        WHERE sa.sentiment_category = $1
        ORDER BY p.created_at DESC
        LIMIT 100
      `;
    } else {
      query = `
        SELECT p.*, rc.*
        FROM posts p
        INNER JOIN risk_classification rc ON p.id = rc.post_id
        WHERE rc.risk_category = $1
        ORDER BY p.created_at DESC
        LIMIT 100
      `;
    }

    const result = await pool.query(query, [category]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Analysis by category error:', error);
    next(error);
  }
};

export const getAnalysisByRegion = async (req, res, next) => {
  try {
    const { regionId } = req.params;

    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_posts,
        COUNT(DISTINCT p.account_id) as unique_accounts,
        sa.sentiment_category,
        COUNT(sa.id) as sentiment_count,
        rc.risk_category,
        COUNT(rc.id) as risk_count
      FROM posts p
      LEFT JOIN locations l ON p.location_id = l.id
      LEFT JOIN sentiment_analysis sa ON p.id = sa.post_id
      LEFT JOIN risk_classification rc ON p.id = rc.post_id
      WHERE l.id = $1 OR l.province = $1 OR l.city = $1
      GROUP BY sa.sentiment_category, rc.risk_category
    `, [regionId]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Analysis by region error:', error);
    next(error);
  }
};

export const analyzePost = async (req, res, next) => {
  try {
    const { postId } = req.params;

    const result = await analyzePostService(postId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Analyze post error:', error);
    next(error);
  }
};

export const analyzeMention = async (req, res, next) => {
  try {
    const { mentionId } = req.params;

    const result = await analyzeMentionService(mentionId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Analyze mention error:', error);
    next(error);
  }
};

