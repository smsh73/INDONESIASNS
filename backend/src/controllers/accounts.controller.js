import pool from '../config/database.js';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';

export const getAccounts = async (req, res, next) => {
  try {
    const { platform, isOfficial } = req.query;
    
    let query = 'SELECT * FROM accounts WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (platform) {
      query += ` AND platform = $${paramCount}`;
      params.push(platform);
      paramCount++;
    }

    if (isOfficial !== undefined) {
      query += ` AND is_official = $${paramCount}`;
      params.push(isOfficial === 'true');
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Get accounts error:', error);
    next(error);
  }
};

export const createAccount = async (req, res, next) => {
  try {
    const { username, platform, isOfficial = false, metadata } = req.body;

    if (!username || !platform) {
      throw new AppError('사용자명과 플랫폼을 입력해주세요', 400);
    }

    const result = await pool.query(
      `INSERT INTO accounts (username, platform, is_official, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [username, platform, isOfficial, metadata || {}]
    );

    logger.info(`Account created: ${username} on ${platform}`);

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Create account error:', error);
    next(error);
  }
};

export const updateAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { username, platform, isOfficial, metadata } = req.body;

    const result = await pool.query(
      `UPDATE accounts 
       SET username = COALESCE($1, username),
           platform = COALESCE($2, platform),
           is_official = COALESCE($3, is_official),
           metadata = COALESCE($4, metadata),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [username, platform, isOfficial, metadata, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('계정을 찾을 수 없습니다', 404);
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Update account error:', error);
    next(error);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM accounts WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      throw new AppError('계정을 찾을 수 없습니다', 404);
    }

    logger.info(`Account deleted: ${id}`);

    res.json({
      success: true,
      message: '계정이 삭제되었습니다',
    });
  } catch (error) {
    logger.error('Delete account error:', error);
    next(error);
  }
};

