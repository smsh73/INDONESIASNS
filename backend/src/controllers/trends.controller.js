import { analyzeTrends, getInfluentialUsers as getInfluentialUsersService } from '../services/trends/trendService.js';
import pool from '../config/database.js';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';

export const analyzeTrend = async (req, res, next) => {
  try {
    const { keyword, platform, regionId, days = 7 } = req.body;

    if (!keyword) {
      throw new AppError('키워드가 필요합니다', 400);
    }

    const result = await analyzeTrends(keyword, platform, regionId, days);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Analyze trend error:', error);
    next(error);
  }
};

export const getInfluentialUsers = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const users = await getInfluentialUsersService(parseInt(limit));

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    logger.error('Get influential users error:', error);
    next(error);
  }
};

export const getTrends = async (req, res, next) => {
  try {
    const { keyword, platform, regionId, days = 7 } = req.query;

    const result = await pool.query(`
      SELECT *
      FROM trends
      WHERE 1=1
        ${keyword ? `AND keyword ILIKE '%${keyword}%'` : ''}
        ${platform ? `AND platform = '${platform}'` : ''}
        ${regionId ? `AND region_id = ${regionId}` : ''}
        AND period_start >= NOW() - INTERVAL '${days} days'
      ORDER BY mention_count DESC, created_at DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Get trends error:', error);
    next(error);
  }
};

