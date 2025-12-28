import pool from '../config/database.js';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';

export const getRegions = async (req, res, next) => {
  try {
    const { level = 'province' } = req.query;

    let query;
    if (level === 'province') {
      query = 'SELECT DISTINCT province as name FROM regions ORDER BY province';
    } else if (level === 'city') {
      query = 'SELECT DISTINCT province, city as name FROM regions ORDER BY province, city';
    } else {
      query = 'SELECT * FROM regions ORDER BY province, city, district';
    }

    const result = await pool.query(query);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Get regions error:', error);
    next(error);
  }
};

export const getRegionStats = async (req, res, next) => {
  try {
    const { regionId } = req.params;
    // regionId가 숫자인지 문자열(지역명)인지 확인
    const isNumeric = /^\d+$/.test(regionId);
    
    let whereClause;
    let queryParams;
    
    if (isNumeric) {
      // 숫자 ID로 조회
      whereClause = 'WHERE r.id = $1';
      queryParams = [parseInt(regionId)];
    } else {
      // 지역명(province)으로 조회
      const decodedRegion = decodeURIComponent(regionId);
      whereClause = 'WHERE r.province = $1';
      queryParams = [decodedRegion];
    }

    const result = await pool.query(`
      SELECT 
        COUNT(DISTINCT p.id) as total_posts,
        COUNT(DISTINCT p.account_id) as unique_accounts,
        COUNT(DISTINCT sa.id) as sentiment_analyses,
        COUNT(DISTINCT rc.id) as risk_classifications,
        COALESCE(sa.sentiment_category, 'neutral') as sentiment_category,
        COUNT(sa.id) FILTER (WHERE sa.sentiment_category IS NOT NULL) as sentiment_count,
        COALESCE(rc.risk_category, 'low') as risk_category,
        COUNT(rc.id) FILTER (WHERE rc.risk_category IS NOT NULL) as risk_count
      FROM regions r
      LEFT JOIN locations l ON (r.province = l.province OR r.city = l.city OR r.district = l.district)
      LEFT JOIN posts p ON l.id = p.location_id
      LEFT JOIN sentiment_analysis sa ON p.id = sa.post_id
      LEFT JOIN risk_classification rc ON p.id = rc.post_id
      ${whereClause}
      GROUP BY sa.sentiment_category, rc.risk_category
    `, queryParams);

    // 데이터가 없으면 기본값 반환
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          total_posts: 0,
          unique_accounts: 0,
          sentiment_analyses: 0,
          risk_classifications: 0,
          sentiment_breakdown: [],
          risk_breakdown: []
        },
      });
    }

    // 결과 집계
    const stats = {
      total_posts: parseInt(result.rows[0].total_posts || 0),
      unique_accounts: parseInt(result.rows[0].unique_accounts || 0),
      sentiment_analyses: parseInt(result.rows[0].sentiment_analyses || 0),
      risk_classifications: parseInt(result.rows[0].risk_classifications || 0),
      sentiment_breakdown: result.rows
        .filter(row => row.sentiment_category && row.sentiment_category !== 'neutral')
        .map(row => ({
          category: row.sentiment_category,
          count: parseInt(row.sentiment_count || 0)
        })),
      risk_breakdown: result.rows
        .filter(row => row.risk_category && row.risk_category !== 'low')
        .map(row => ({
          category: row.risk_category,
          count: parseInt(row.risk_count || 0)
        }))
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Get region stats error:', error);
    next(error);
  }
};

export const getRegionComparison = async (req, res, next) => {
  try {
    const { regions } = req.query;

    if (!regions) {
      throw new AppError('비교할 지역을 선택해주세요', 400);
    }

    const regionIds = Array.isArray(regions) ? regions : regions.split(',');

    const result = await pool.query(`
      SELECT 
        r.province,
        r.city,
        COUNT(DISTINCT p.id) as total_posts,
        COUNT(DISTINCT sa.id) FILTER (WHERE sa.sentiment_category = 'positive') as positive_count,
        COUNT(DISTINCT sa.id) FILTER (WHERE sa.sentiment_category = 'negative') as negative_count,
        COUNT(DISTINCT rc.id) FILTER (WHERE rc.risk_level = 'high') as high_risk_count
      FROM regions r
      LEFT JOIN locations l ON (r.province = l.province OR r.city = l.city)
      LEFT JOIN posts p ON l.id = p.location_id
      LEFT JOIN sentiment_analysis sa ON p.id = sa.post_id
      LEFT JOIN risk_classification rc ON p.id = rc.post_id
      WHERE r.id = ANY($1::int[])
      GROUP BY r.id, r.province, r.city
      ORDER BY r.province, r.city
    `, [regionIds]);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Get region comparison error:', error);
    next(error);
  }
};

