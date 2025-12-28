import pool from '../config/database.js';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';

export const getPosts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, platform, accountId } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, a.username, a.platform, a.is_official
      FROM posts p
      LEFT JOIN accounts a ON p.account_id = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (platform) {
      query += ` AND a.platform = $${paramCount}`;
      params.push(platform);
      paramCount++;
    }

    if (accountId) {
      query += ` AND p.account_id = $${paramCount}`;
      params.push(accountId);
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
    logger.error('Get posts error:', error);
    next(error);
  }
};

export const getPostById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        p.*,
        a.username,
        a.platform,
        a.is_official,
        sa.sentiment_category,
        sa.confidence_score as sentiment_confidence,
        rc.risk_category,
        rc.risk_level,
        rc.confidence_score as risk_confidence,
        l.province,
        l.city,
        l.district
      FROM posts p
      LEFT JOIN accounts a ON p.account_id = a.id
      LEFT JOIN sentiment_analysis sa ON p.id = sa.post_id
      LEFT JOIN risk_classification rc ON p.id = rc.post_id
      LEFT JOIN locations l ON p.location_id = l.id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      throw new AppError('포스팅을 찾을 수 없습니다', 404);
    }

    const mentionsResult = await pool.query(
      'SELECT * FROM mentions WHERE post_id = $1 ORDER BY created_at DESC',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        mentions: mentionsResult.rows,
      },
    });
  } catch (error) {
    logger.error('Get post by id error:', error);
    next(error);
  }
};

export const getPostsByAccount = async (req, res, next) => {
  try {
    const { accountId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(`
      SELECT p.*
      FROM posts p
      WHERE p.account_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `, [accountId, limit, offset]);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    logger.error('Get posts by account error:', error);
    next(error);
  }
};

