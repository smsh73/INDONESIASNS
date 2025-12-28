import pool from '../../config/database.js';
import logger from '../../config/logger.js';

export const generateDailyReport = async (date = null) => {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const [
      totalPosts,
      totalMentions,
      sentimentStats,
      riskStats,
      topRegions,
      topPlatforms,
    ] = await Promise.all([
      pool.query(`
        SELECT COUNT(*) as count FROM posts
        WHERE DATE(created_at) = $1
      `, [targetDate]).catch(() => ({ rows: [{ count: '0' }] })),
      pool.query(`
        SELECT COUNT(*) as count FROM mentions
        WHERE DATE(created_at) = $1
      `, [targetDate]).catch(() => ({ rows: [{ count: '0' }] })),
      pool.query(`
        SELECT sa.sentiment_category, COUNT(*) as count
        FROM sentiment_analysis sa
        INNER JOIN posts p ON sa.post_id = p.id
        WHERE DATE(p.created_at) = $1
        GROUP BY sa.sentiment_category
      `, [targetDate]).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT rc.risk_category, rc.risk_level, COUNT(*) as count
        FROM risk_classification rc
        INNER JOIN posts p ON rc.post_id = p.id
        WHERE DATE(p.created_at) = $1
        GROUP BY rc.risk_category, rc.risk_level
      `, [targetDate]).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT r.province, COUNT(DISTINCT p.id) as post_count
        FROM posts p
        LEFT JOIN locations l ON p.location_id = l.id
        LEFT JOIN regions r ON l.region_id = r.id
        WHERE DATE(p.created_at) = $1
        GROUP BY r.province
        ORDER BY post_count DESC
        LIMIT 5
      `, [targetDate]).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT platform, COUNT(*) as count
        FROM posts
        WHERE DATE(created_at) = $1
        GROUP BY platform
        ORDER BY count DESC
      `, [targetDate]).catch(() => ({ rows: [] })),
    ]);

    const report = {
      date: targetDate,
      summary: {
        totalPosts: parseInt(totalPosts.rows[0]?.count || 0),
        totalMentions: parseInt(totalMentions.rows[0]?.count || 0),
      },
      sentiment: sentimentStats.rows.reduce((acc, row) => {
        acc[row.sentiment_category] = parseInt(row.count);
        return acc;
      }, {}),
      risk: riskStats.rows.reduce((acc, row) => {
        const key = `${row.risk_category}_${row.risk_level || 'unknown'}`;
        acc[key] = parseInt(row.count);
        return acc;
      }, {}),
      topRegions: topRegions.rows,
      topPlatforms: topPlatforms.rows,
    };

    logger.info(`Daily report generated for ${targetDate}`);
    return report;
  } catch (error) {
    logger.error('Generate daily report error:', error);
    throw error;
  }
};

export const generateWeeklyReport = async (weekStart = null) => {
  try {
    const startDate = weekStart || new Date();
    startDate.setDate(startDate.getDate() - startDate.getDay());
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const [
      totalPosts,
      sentimentTrends,
      riskTrends,
      topKeywords,
    ] = await Promise.all([
      pool.query(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM posts
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [startDate, endDate]).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT DATE(p.created_at) as date, sa.sentiment_category, COUNT(*) as count
        FROM sentiment_analysis sa
        INNER JOIN posts p ON sa.post_id = p.id
        WHERE p.created_at >= $1 AND p.created_at <= $2
        GROUP BY DATE(p.created_at), sa.sentiment_category
        ORDER BY date ASC
      `, [startDate, endDate]).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT DATE(p.created_at) as date, rc.risk_category, COUNT(*) as count
        FROM risk_classification rc
        INNER JOIN posts p ON rc.post_id = p.id
        WHERE p.created_at >= $1 AND p.created_at <= $2
        GROUP BY DATE(p.created_at), rc.risk_category
        ORDER BY date ASC
      `, [startDate, endDate]).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT unnest(hashtags) as keyword, COUNT(*) as count
        FROM posts
        WHERE created_at >= $1 AND created_at <= $2
          AND hashtags IS NOT NULL
          AND array_length(hashtags, 1) > 0
        GROUP BY keyword
        ORDER BY count DESC
        LIMIT 10
      `, [startDate, endDate]).catch(() => ({ rows: [] })),
    ]);

    const report = {
      period: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      trends: {
        posts: totalPosts.rows,
        sentiment: sentimentTrends.rows,
        risk: riskTrends.rows,
      },
      topKeywords: topKeywords.rows,
    };

    logger.info(`Weekly report generated for ${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`);
    return report;
  } catch (error) {
    logger.error('Generate weekly report error:', error);
    throw error;
  }
};

