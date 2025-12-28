import pool from '../config/database.js';
import redisClient from '../config/redis.js';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';

export const getDashboardStats = async (req, res, next) => {
  try {
    const cacheKey = 'dashboard:stats';
    
    let cached = null;
    if (redisClient && redisClient.isOpen) {
      try {
        cached = await redisClient.get(cacheKey);
        if (cached) {
          return res.json({
            success: true,
            data: JSON.parse(cached),
            cached: true,
          });
        }
      } catch (error) {
        logger.error('Redis cache get error:', error);
      }
    }

    const [
      totalPosts,
      totalMentions,
      sentimentStats,
      riskStats,
      recentAlerts,
      platformStats,
      regionStats,
      hourlyStats,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM posts').catch(() => ({ rows: [{ count: '0' }] })),
      pool.query('SELECT COUNT(*) as count FROM mentions').catch(() => ({ rows: [{ count: '0' }] })),
      pool.query(`
        SELECT sa.sentiment_category, COUNT(*) as count 
        FROM sentiment_analysis sa
        WHERE sa.post_id IS NOT NULL
        GROUP BY sa.sentiment_category
      `).catch((error) => {
        logger.error('Sentiment stats query error:', error);
        return { rows: [] };
      }),
      pool.query(`
        SELECT rc.risk_category, COUNT(*) as count 
        FROM risk_classification rc
        WHERE rc.post_id IS NOT NULL
        GROUP BY rc.risk_category
      `).catch((error) => {
        logger.error('Risk stats query error:', error);
        return { rows: [] };
      }),
      pool.query(`
        SELECT * FROM alerts 
        WHERE resolved = FALSE
        ORDER BY created_at DESC 
        LIMIT 10
      `).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT platform, COUNT(*) as count
        FROM posts
        GROUP BY platform
        ORDER BY count DESC
      `).catch((error) => {
        logger.error('Platform stats query error:', error);
        return { rows: [] };
      }),
      pool.query(`
        SELECT l.province, COUNT(*) as count
        FROM posts p
        LEFT JOIN locations l ON p.location_id = l.id
        WHERE l.province IS NOT NULL
        GROUP BY l.province
        ORDER BY count DESC
        LIMIT 10
      `).catch((error) => {
        logger.error('Region stats query error:', error);
        return { rows: [] };
      }),
      pool.query(`
        SELECT EXTRACT(HOUR FROM posted_at) as hour, COUNT(*) as count
        FROM posts
        WHERE posted_at >= NOW() - INTERVAL '7 days'
          AND posted_at IS NOT NULL
        GROUP BY EXTRACT(HOUR FROM posted_at)
        ORDER BY hour
      `).catch((error) => {
        logger.error('Hourly stats query error:', error);
        return { rows: [] };
      }),
    ]);

    const stats = {
      totalPosts: parseInt(totalPosts.rows[0]?.count || 0),
      totalMentions: parseInt(totalMentions.rows[0]?.count || 0),
      sentimentDistribution: sentimentStats.rows.reduce((acc, row) => {
        acc[row.sentiment_category] = parseInt(row.count);
        return acc;
      }, {}),
      riskDistribution: riskStats.rows.reduce((acc, row) => {
        acc[row.risk_category] = parseInt(row.count);
        return acc;
      }, {}),
      recentAlerts: recentAlerts.rows,
      platformDistribution: platformStats.rows.map(row => ({
        platform: row.platform,
        count: parseInt(row.count),
      })),
      regionDistribution: regionStats.rows.map(row => ({
        province: row.province,
        count: parseInt(row.count),
      })),
      hourlyDistribution: hourlyStats.rows.map(row => ({
        hour: parseInt(row.hour),
        count: parseInt(row.count),
      })),
    };

    if (redisClient && redisClient.isOpen) {
      try {
        await redisClient.setEx(cacheKey, 300, JSON.stringify(stats));
      } catch (error) {
        logger.error('Redis cache set error:', error);
      }
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    next(error);
  }
};

export const getTrends = async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const cacheKey = `dashboard:trends:${days}`;

    let cached = null;
    if (redisClient && redisClient.isOpen) {
      try {
        cached = await redisClient.get(cacheKey);
      } catch (error) {
        logger.error('Redis cache get error:', error);
      }
    }
    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
    }

    const result = await pool.query(`
      SELECT 
        DATE(COALESCE(p.posted_at, p.created_at)) as date,
        COUNT(*) as count,
        COUNT(DISTINCT p.account_id) as accounts_count
      FROM posts p
      WHERE COALESCE(p.posted_at, p.created_at) >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(COALESCE(p.posted_at, p.created_at))
      ORDER BY date ASC
    `).catch((error) => {
      logger.error('Trends query error:', error);
      return { rows: [] };
    });

    const trends = result.rows;

    if (redisClient && redisClient.isOpen) {
      try {
        await redisClient.setEx(cacheKey, 300, JSON.stringify(trends));
      } catch (error) {
        logger.error('Redis cache set error:', error);
      }
    }

    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    logger.error('Trends error:', error);
    next(error);
  }
};

export const getSentimentDistribution = async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const cacheKey = `dashboard:sentiment:${days}`;

    let cached = null;
    if (redisClient && redisClient.isOpen) {
      try {
        cached = await redisClient.get(cacheKey);
      } catch (error) {
        logger.error('Redis cache get error:', error);
      }
    }
    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
    }

    const result = await pool.query(`
      SELECT 
        sentiment as sentiment_category,
        COUNT(*) as count,
        AVG(1.0) as avg_confidence
      FROM posts
      WHERE posted_at >= NOW() - INTERVAL '${parseInt(days)} days'
        OR (posted_at IS NULL AND created_at >= NOW() - INTERVAL '${parseInt(days)} days')
        AND sentiment IS NOT NULL
      GROUP BY sentiment
      ORDER BY count DESC
    `).catch((error) => {
      logger.error('Sentiment query error:', error);
      return { rows: [] };
    });

    const distribution = result.rows;

    if (redisClient && redisClient.isOpen) {
      try {
        await redisClient.setEx(cacheKey, 300, JSON.stringify(distribution));
      } catch (error) {
        logger.error('Redis cache set error:', error);
      }
    }

    res.json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    logger.error('Sentiment distribution error:', error);
    next(error);
  }
};

export const getPlatformStats = async (req, res, next) => {
  try {
    const { platform } = req.params;
    const { days = 7 } = req.query;
    const cacheKey = `dashboard:platform:${platform}:${days}`;

    let cached = null;
    if (redisClient && redisClient.isOpen) {
      try {
        cached = await redisClient.get(cacheKey);
      } catch (error) {
        logger.error('Redis cache get error:', error);
      }
    }
    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
    }

    const result = await pool.query(`
      SELECT 
        DATE(p.created_at) as date,
        COUNT(*) as post_count,
        COUNT(DISTINCT p.account_id) as account_count,
        SUM(p.like_count + p.comment_count + p.share_count) as total_engagement,
        COUNT(DISTINCT sa.id) FILTER (WHERE sa.sentiment_category = 'positive') as positive_count,
        COUNT(DISTINCT sa.id) FILTER (WHERE sa.sentiment_category = 'negative') as negative_count,
        COUNT(DISTINCT rc.id) FILTER (WHERE rc.risk_level IN ('high', 'critical')) as high_risk_count
      FROM posts p
      LEFT JOIN sentiment_analysis sa ON p.id = sa.post_id
      LEFT JOIN risk_classification rc ON p.id = rc.post_id
        WHERE p.platform = $1
        AND COALESCE(p.posted_at, p.created_at) >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(p.created_at)
      ORDER BY date ASC
    `, [platform]);

    const stats = result.rows;

    if (redisClient && redisClient.isOpen) {
      try {
        await redisClient.setEx(cacheKey, 300, JSON.stringify(stats));
      } catch (error) {
        logger.error('Redis cache set error:', error);
      }
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Platform stats error:', error);
    next(error);
  }
};

export const getRegionStats = async (req, res, next) => {
  try {
    const { region } = req.params;
    const { days = 7 } = req.query;
    const cacheKey = `dashboard:region:${region}:${days}`;

    let cached = null;
    if (redisClient && redisClient.isOpen) {
      try {
        cached = await redisClient.get(cacheKey);
      } catch (error) {
        logger.error('Redis cache get error:', error);
      }
    }
    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
    }

    const result = await pool.query(`
      SELECT 
        DATE(p.created_at) as date,
        COUNT(*) as post_count,
        COUNT(DISTINCT p.account_id) as account_count,
        sa.sentiment_category,
        COUNT(sa.id) as sentiment_count,
        rc.risk_category,
        rc.risk_level,
        COUNT(rc.id) as risk_count
      FROM posts p
      INNER JOIN locations l ON p.location_id = l.id
      LEFT JOIN sentiment_analysis sa ON p.id = sa.post_id
      LEFT JOIN risk_classification rc ON p.id = rc.post_id
        WHERE l.province = $1
        AND COALESCE(p.posted_at, p.created_at) >= NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(p.created_at), sa.sentiment_category, rc.risk_category, rc.risk_level
      ORDER BY date ASC
    `, [region]);

    const stats = result.rows;

    if (redisClient && redisClient.isOpen) {
      try {
        await redisClient.setEx(cacheKey, 300, JSON.stringify(stats));
      } catch (error) {
        logger.error('Redis cache set error:', error);
      }
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Region stats error:', error);
    next(error);
  }
};

export const getSentimentDetail = async (req, res, next) => {
  try {
    const { sentiment } = req.params;
    const { days = 7, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const cacheKey = `dashboard:sentiment:detail:${sentiment}:${days}:${page}:${limit}`;

    let cached = null;
    if (redisClient && redisClient.isOpen) {
      try {
        cached = await redisClient.get(cacheKey);
      } catch (error) {
        logger.error('Redis cache get error:', error);
      }
    }
    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
    }

    const [postsResult, statsResult] = await Promise.all([
      pool.query(`
        SELECT 
          p.*,
          sa.confidence_score,
          sa.analysis_details,
          a.username as account_username,
          a.platform
        FROM posts p
        INNER JOIN sentiment_analysis sa ON p.id = sa.post_id
        LEFT JOIN accounts a ON p.account_id = a.id
        WHERE sa.sentiment_category = $1
          AND p.created_at >= NOW() - INTERVAL '${days} days'
        ORDER BY p.created_at DESC
        LIMIT $2 OFFSET $3
      `, [sentiment, limit, offset]),
      pool.query(`
        SELECT 
          COUNT(*) as total,
          AVG(sa.confidence_score) as avg_confidence,
          COUNT(DISTINCT p.account_id) as unique_accounts,
          COUNT(DISTINCT p.platform) as platforms_count
        FROM posts p
        INNER JOIN sentiment_analysis sa ON p.id = sa.post_id
        WHERE sa.sentiment_category = $1
          AND p.created_at >= NOW() - INTERVAL '${days} days'
      `, [sentiment]),
    ]);

    const data = {
      posts: postsResult.rows,
      stats: statsResult.rows[0],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(statsResult.rows[0].total),
      },
    };

    await redisClient.setEx(cacheKey, 300, JSON.stringify(data));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Sentiment detail error:', error);
    next(error);
  }
};

export const getRiskDetail = async (req, res, next) => {
  try {
    const { risk } = req.params;
    const { days = 7, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const cacheKey = `dashboard:risk:detail:${risk}:${days}:${page}:${limit}`;

    let cached = null;
    if (redisClient && redisClient.isOpen) {
      try {
        cached = await redisClient.get(cacheKey);
      } catch (error) {
        logger.error('Redis cache get error:', error);
      }
    }
    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
    }

    const [postsResult, statsResult] = await Promise.all([
      pool.query(`
        SELECT 
          p.*,
          rc.risk_level,
          rc.confidence_score,
          rc.analysis_details,
          a.username as account_username,
          a.platform,
          l.province,
          l.city
        FROM posts p
        INNER JOIN risk_classification rc ON p.id = rc.post_id
        LEFT JOIN accounts a ON p.account_id = a.id
        LEFT JOIN locations l ON p.location_id = l.id
        WHERE rc.risk_category = $1
          AND p.created_at >= NOW() - INTERVAL '${days} days'
        ORDER BY rc.risk_level DESC, p.created_at DESC
        LIMIT $2 OFFSET $3
      `, [risk, limit, offset]),
      pool.query(`
        SELECT 
          COUNT(*) as total,
          AVG(rc.confidence_score) as avg_confidence,
          COUNT(DISTINCT CASE WHEN rc.risk_level = 'critical' THEN rc.id END) as critical_count,
          COUNT(DISTINCT CASE WHEN rc.risk_level = 'high' THEN rc.id END) as high_count,
          COUNT(DISTINCT p.account_id) as unique_accounts
        FROM posts p
        INNER JOIN risk_classification rc ON p.id = rc.post_id
        WHERE rc.risk_category = $1
          AND p.created_at >= NOW() - INTERVAL '${days} days'
      `, [risk]),
    ]);

    const data = {
      posts: postsResult.rows,
      stats: statsResult.rows[0],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(statsResult.rows[0].total),
      },
    };

    await redisClient.setEx(cacheKey, 300, JSON.stringify(data));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Risk detail error:', error);
    next(error);
  }
};

export const getHourlyStats = async (req, res, next) => {
  try {
    const { hour } = req.params;
    const { days = 7 } = req.query;
    const cacheKey = `dashboard:hour:${hour}:${days}`;

    let cached = null;
    if (redisClient && redisClient.isOpen) {
      try {
        cached = await redisClient.get(cacheKey);
      } catch (error) {
        logger.error('Redis cache get error:', error);
      }
    }
    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
    }

    const result = await pool.query(`
      SELECT 
        DATE(p.posted_at) as date,
        p.platform,
        COUNT(*) as post_count,
        COUNT(DISTINCT p.account_id) as account_count,
        SUM(p.like_count + p.comment_count + p.share_count) as total_engagement,
        COUNT(DISTINCT CASE WHEN sa.sentiment_category = 'positive' THEN p.id END) as positive_count,
        COUNT(DISTINCT CASE WHEN sa.sentiment_category = 'negative' THEN p.id END) as negative_count,
        COUNT(DISTINCT CASE WHEN rc.risk_level IN ('high', 'critical') THEN p.id END) as high_risk_count
      FROM posts p
      LEFT JOIN sentiment_analysis sa ON p.id = sa.post_id
      LEFT JOIN risk_classification rc ON p.id = rc.post_id
      WHERE EXTRACT(HOUR FROM p.posted_at) = $1
        AND p.posted_at >= NOW() - INTERVAL '${days} days'
        AND p.posted_at IS NOT NULL
      GROUP BY DATE(p.posted_at), p.platform
      ORDER BY date ASC, p.platform
    `, [hour]).catch((error) => {
      logger.error('Hourly stats query error:', error);
      return { rows: [] };
    });

    const stats = result.rows;

    if (redisClient && redisClient.isOpen) {
      try {
        await redisClient.setEx(cacheKey, 300, JSON.stringify(stats));
      } catch (error) {
        logger.error('Redis cache set error:', error);
      }
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Hourly stats error:', error);
    next(error);
  }
};
