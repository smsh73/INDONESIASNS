import pool from '../config/database.js';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';

export const getAlerts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, severity, resolved } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM alerts WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (severity) {
      query += ` AND severity = $${paramCount}`;
      params.push(severity);
      paramCount++;
    }

    if (resolved !== undefined) {
      query += ` AND resolved = $${paramCount}`;
      params.push(resolved === 'true');
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
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
    logger.error('Get alerts error:', error);
    next(error);
  }
};

export const createAlert = async (req, res, next) => {
  try {
    const { title, message, severity = 'medium', postId, riskId } = req.body;

    if (!title || !message) {
      throw new AppError('제목과 메시지를 입력해주세요', 400);
    }

    const result = await pool.query(
      `INSERT INTO alerts (title, message, severity, post_id, risk_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, message, severity, postId || null, riskId || null]
    );

    logger.info(`Alert created: ${title}`);

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Create alert error:', error);
    next(error);
  }
};

export const updateAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolved, notes } = req.body;

    const result = await pool.query(
      `UPDATE alerts 
       SET resolved = COALESCE($1, resolved),
           notes = COALESCE($2, notes),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [resolved, notes, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('알림을 찾을 수 없습니다', 404);
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Update alert error:', error);
    next(error);
  }
};

export const deleteAlert = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM alerts WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      throw new AppError('알림을 찾을 수 없습니다', 404);
    }

    logger.info(`Alert deleted: ${id}`);

    res.json({
      success: true,
      message: '알림이 삭제되었습니다',
    });
  } catch (error) {
    logger.error('Delete alert error:', error);
    next(error);
  }
};

