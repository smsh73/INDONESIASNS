import pool from '../../config/database.js';
import logger from '../../config/logger.js';

export const analyzeTrends = async (keyword, platform = null, regionId = null, days = 7) => {
  try {
    let query = `
      SELECT 
        DATE(p.created_at) as date,
        COUNT(*) as mention_count,
        AVG(sa.confidence_score) FILTER (WHERE sa.sentiment_category = 'positive') as positive_sentiment,
        AVG(sa.confidence_score) FILTER (WHERE sa.sentiment_category = 'negative') as negative_sentiment,
        AVG(rc.confidence_score) FILTER (WHERE rc.risk_level IN ('high', 'critical')) as risk_score
      FROM posts p
      LEFT JOIN sentiment_analysis sa ON p.id = sa.post_id
      LEFT JOIN risk_classification rc ON p.id = rc.post_id
      LEFT JOIN locations l ON p.location_id = l.id
      WHERE p.content ILIKE $1
        AND p.created_at >= NOW() - INTERVAL '${days} days'
    `;
    const params = [`%${keyword}%`];
    let paramCount = 2;

    if (platform) {
      query += ` AND p.platform = $${paramCount}`;
      params.push(platform);
      paramCount++;
    }

    if (regionId) {
      query += ` AND l.region_id = $${paramCount}`;
      params.push(regionId);
      paramCount++;
    }

    query += ` GROUP BY DATE(p.created_at) ORDER BY date ASC`;

    const result = await pool.query(query, params);

    const trendData = result.rows.map((row) => ({
      date: row.date,
      mentionCount: parseInt(row.mention_count),
      positiveSentiment: parseFloat(row.positive_sentiment) || 0,
      negativeSentiment: parseFloat(row.negative_sentiment) || 0,
      riskScore: parseFloat(row.risk_score) || 0,
    }));

    const trendDirection = calculateTrendDirection(trendData);

    await saveTrend(keyword, platform, regionId, trendData, trendDirection, days);

    return {
      keyword,
      platform,
      regionId,
      trendData,
      trendDirection,
      period: { days },
    };
  } catch (error) {
    logger.error('Analyze trends error:', error);
    throw error;
  }
};

const calculateTrendDirection = (trendData) => {
  if (trendData.length < 2) {
    return 'stable';
  }

  const firstHalf = trendData.slice(0, Math.floor(trendData.length / 2));
  const secondHalf = trendData.slice(Math.floor(trendData.length / 2));

  const firstAvg = firstHalf.reduce((sum, d) => sum + d.mentionCount, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + d.mentionCount, 0) / secondHalf.length;

  const change = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (change > 10) return 'up';
  if (change < -10) return 'down';
  return 'stable';
};

const saveTrend = async (keyword, platform, regionId, trendData, direction, days) => {
  try {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);
    const periodEnd = new Date();

    const totalMentions = trendData.reduce((sum, d) => sum + d.mentionCount, 0);
    const avgSentiment = trendData.reduce((sum, d) => sum + d.positiveSentiment - d.negativeSentiment, 0) / trendData.length;
    const avgRisk = trendData.reduce((sum, d) => sum + d.riskScore, 0) / trendData.length;

    await pool.query(
      `INSERT INTO trends (
        keyword, platform, region_id, mention_count,
        sentiment_score, risk_score, trend_direction,
        period_start, period_end
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT DO NOTHING`,
      [
        keyword,
        platform,
        regionId,
        totalMentions,
        avgSentiment,
        avgRisk,
        direction,
        periodStart,
        periodEnd,
      ]
    );
  } catch (error) {
    logger.error('Save trend error:', error);
  }
};

export const getInfluentialUsers = async (limit = 10) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.id,
        a.username,
        a.platform,
        COALESCE(a.follower_count, 0) as follower_count,
        COUNT(DISTINCT p.id) as post_count,
        COALESCE(SUM(COALESCE(p.like_count, 0) + COALESCE(p.comment_count, 0) + COALESCE(p.share_count, 0)), 0) as total_engagement,
        COUNT(DISTINCT CASE WHEN rc.risk_level IN ('high', 'critical') THEN rc.id END) as risk_mentions_count
      FROM accounts a
      INNER JOIN posts p ON a.id = p.account_id
      LEFT JOIN risk_classification rc ON p.id = rc.post_id
      WHERE p.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY a.id, a.username, a.platform, a.follower_count
      HAVING COUNT(DISTINCT p.id) > 0
      ORDER BY total_engagement DESC, risk_mentions_count DESC
      LIMIT $1
    `, [limit]);

    if (result.rows.length === 0) {
      return [];
    }

    const users = result.rows.map((row) => {
      const followerCount = parseInt(row.follower_count) || 0;
      const totalEngagement = parseInt(row.total_engagement) || 0;
      const riskMentionsCount = parseInt(row.risk_mentions_count) || 0;
      
      const engagementRate = followerCount > 0
        ? (totalEngagement / followerCount) * 100
        : 0;

      const influenceScore = calculateInfluenceScore(
        followerCount,
        totalEngagement,
        riskMentionsCount,
        engagementRate
      );

      return {
        id: row.id,
        username: row.username,
        platform: row.platform,
        follower_count: followerCount,
        post_count: parseInt(row.post_count) || 0,
        total_engagement: totalEngagement,
        risk_mentions_count: riskMentionsCount,
        engagement_rate: parseFloat(engagementRate.toFixed(2)),
        influence_score: parseFloat(influenceScore.toFixed(2)),
      };
    });

    // influential_users 테이블이 없을 수 있으므로 에러 무시
    try {
      for (const user of users) {
        await pool.query(
          `INSERT INTO influential_users (
            account_id, username, platform, follower_count,
            engagement_rate, influence_score, risk_mentions_count
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (account_id) DO UPDATE SET
            engagement_rate = EXCLUDED.engagement_rate,
            influence_score = EXCLUDED.influence_score,
            risk_mentions_count = EXCLUDED.risk_mentions_count,
            last_analyzed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP`,
          [
            user.id,
            user.username,
            user.platform,
            user.follower_count,
            user.engagement_rate / 100,
            user.influence_score / 100,
            user.risk_mentions_count,
          ]
        );
      }
    } catch (insertError) {
      // influential_users 테이블이 없어도 계속 진행
      logger.warn('Failed to insert influential users (table may not exist):', insertError.message);
    }

    return users;
  } catch (error) {
    logger.error('Get influential users error:', error);
    // 에러 발생 시 빈 배열 반환
    return [];
  }
};

const calculateInfluenceScore = (followers, engagement, riskMentions, engagementRate) => {
  const followerScore = Math.log10(followers + 1) * 10;
  const engagementScore = Math.log10(engagement + 1) * 5;
  const riskScore = riskMentions * 2;
  const engagementRateScore = engagementRate * 2;

  return (followerScore + engagementScore + riskScore + engagementRateScore) / 100;
};

