import OpenAI from 'openai';
import pool from '../../config/database.js';
import logger from '../../config/logger.js';

// 지연 초기화를 위한 OpenAI 클라이언트 getter
let openaiClient = null;
const getOpenAI = () => {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('OPENAI_API_KEY is not set. Location extraction will be disabled.');
      return null;
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
};

const INDONESIA_PROVINCES = [
  'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau',
  'Jambi', 'Sumatera Selatan', 'Bangka Belitung', 'Bengkulu', 'Lampung',
  'Jakarta', 'Jawa Barat', 'Jawa Tengah', 'Yogyakarta', 'Jawa Timur',
  'Banten', 'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
  'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
  'Sulawesi Utara', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Gorontalo', 'Sulawesi Barat',
  'Maluku', 'Maluku Utara', 'Papua Barat', 'Papua'
];

export const extractLocation = async (content, metadata = {}) => {
  try {
    let location = null;

    if (metadata.latitude && metadata.longitude) {
      location = await findOrCreateLocationByCoordinates(
        metadata.latitude,
        metadata.longitude,
        metadata.address
      );
    } else if (content) {
      location = await extractLocationFromText(content);
    }

    return location;
  } catch (error) {
    logger.error('Location extraction error:', error);
    return null;
  }
};

export const extractLocationFromText = async (content) => {
  try {
    const openai = getOpenAI();
    if (!openai) {
      logger.warn('OpenAI client not available. Location extraction from text disabled.');
      return null;
    }

    const prompt = `Extract location information from the following Indonesian social media post.
Return ONLY a JSON object with the following structure:
{
  "province": "province name or null",
  "city": "city name or null",
  "district": "district name or null",
  "confidence": 0.0-1.0
}

If no location can be determined, return: {"province": null, "city": null, "district": null, "confidence": 0.0}

Post content: "${content.substring(0, 500)}"`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a location extraction expert for Indonesian locations. Extract province, city, and district names from text. Use standard Indonesian administrative region names.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 150,
    });

    const result = JSON.parse(response.choices[0].message.content);

    if (!result.province || result.confidence < 0.3) {
      return null;
    }

    const location = await findOrCreateLocation(
      result.province,
      result.city,
      result.district
    );

    return location;
  } catch (error) {
    logger.error('Location extraction from text error:', error);
    return null;
  }
};

export const findOrCreateLocation = async (province, city = null, district = null) => {
  try {
    let query = 'SELECT * FROM locations WHERE province = $1';
    const params = [province];
    let paramCount = 2;

    if (city) {
      query += ` AND city = $${paramCount}`;
      params.push(city);
      paramCount++;
    } else {
      query += ' AND city IS NULL';
    }

    if (district) {
      query += ` AND district = $${paramCount}`;
      params.push(district);
      paramCount++;
    } else {
      query += ' AND district IS NULL';
    }

    let result = await pool.query(query, params);

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    const regionResult = await pool.query(
      'SELECT id FROM regions WHERE province = $1 AND (city = $2 OR city IS NULL) LIMIT 1',
      [province, city]
    );

    const regionId = regionResult.rows.length > 0 ? regionResult.rows[0].id : null;

    const insertResult = await pool.query(
      `INSERT INTO locations (province, city, district, region_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [province, city, district, regionId]
    );

    return insertResult.rows[0];
  } catch (error) {
    logger.error('Find or create location error:', error);
    throw error;
  }
};

export const findOrCreateLocationByCoordinates = async (latitude, longitude, address = null) => {
  try {
    const result = await pool.query(
      `SELECT * FROM locations 
       WHERE ABS(latitude - $1) < 0.01 AND ABS(longitude - $2) < 0.01
       LIMIT 1`,
      [latitude, longitude]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    const locationData = await reverseGeocode(latitude, longitude);

    if (!locationData) {
      return null;
    }

    const regionResult = await pool.query(
      'SELECT id FROM regions WHERE province = $1 AND (city = $2 OR city IS NULL) LIMIT 1',
      [locationData.province, locationData.city]
    );

    const regionId = regionResult.rows.length > 0 ? regionResult.rows[0].id : null;

    const insertResult = await pool.query(
      `INSERT INTO locations (province, city, district, latitude, longitude, address, region_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        locationData.province,
        locationData.city,
        locationData.district,
        latitude,
        longitude,
        address,
        regionId,
      ]
    );

    return insertResult.rows[0];
  } catch (error) {
    logger.error('Find or create location by coordinates error:', error);
    throw error;
  }
};

const reverseGeocode = async (latitude, longitude) => {
  try {
    const openai = getOpenAI();
    if (!openai) {
      logger.warn('OpenAI client not available. Reverse geocoding disabled.');
      return null;
    }

    const prompt = `Given the coordinates ${latitude}, ${longitude} in Indonesia, determine the administrative region.
Return ONLY a JSON object:
{
  "province": "province name",
  "city": "city name or null",
  "district": "district name or null"
}`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a geocoding expert for Indonesian locations. Convert coordinates to administrative regions.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 100,
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    logger.error('Reverse geocode error:', error);
    return null;
  }
};

export const getRegionStats = async (regionId, days = 7) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(DISTINCT p.id) as total_posts,
        COUNT(DISTINCT p.account_id) as unique_accounts,
        sa.sentiment_category,
        COUNT(sa.id) as sentiment_count,
        rc.risk_category,
        rc.risk_level,
        COUNT(rc.id) as risk_count
      FROM posts p
      INNER JOIN locations l ON p.location_id = l.id
      INNER JOIN regions r ON l.region_id = r.id
      LEFT JOIN sentiment_analysis sa ON p.id = sa.post_id
      LEFT JOIN risk_classification rc ON p.id = rc.post_id
      WHERE r.id = $1
        AND p.created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY sa.sentiment_category, rc.risk_category, rc.risk_level
      ORDER BY total_posts DESC
    `, [regionId]);

    return result.rows;
  } catch (error) {
    logger.error('Get region stats error:', error);
    throw error;
  }
};

export const aggregateByRegion = async (date = null) => {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];

    await pool.query(`
      INSERT INTO analytics_summary (
        date, region_id, platform, account_type, sentiment_category, risk_category, risk_level,
        post_count, mention_count, total_engagement, avg_confidence
      )
      SELECT 
        $1::date,
        l.region_id,
        p.platform,
        CASE WHEN a.is_official THEN 'official' ELSE 'public' END,
        sa.sentiment_category,
        rc.risk_category,
        rc.risk_level,
        COUNT(DISTINCT p.id),
        COUNT(DISTINCT m.id),
        SUM(p.like_count + p.comment_count + p.share_count),
        AVG(COALESCE(sa.confidence_score, rc.confidence_score, 0))
      FROM posts p
      LEFT JOIN accounts a ON p.account_id = a.id
      LEFT JOIN locations l ON p.location_id = l.id
      LEFT JOIN sentiment_analysis sa ON p.id = sa.post_id
      LEFT JOIN risk_classification rc ON p.id = rc.post_id
      LEFT JOIN mentions m ON p.id = m.post_id
      WHERE DATE(p.created_at) = $1::date
        AND l.region_id IS NOT NULL
      GROUP BY l.region_id, p.platform, a.is_official, sa.sentiment_category, rc.risk_category, rc.risk_level
      ON CONFLICT (date, region_id, platform, account_type, sentiment_category, risk_category, risk_level)
      DO UPDATE SET
        post_count = EXCLUDED.post_count,
        mention_count = EXCLUDED.mention_count,
        total_engagement = EXCLUDED.total_engagement,
        avg_confidence = EXCLUDED.avg_confidence,
        updated_at = CURRENT_TIMESTAMP
    `, [targetDate]);

    logger.info(`Region aggregation completed for ${targetDate}`);
  } catch (error) {
    logger.error('Aggregate by region error:', error);
    throw error;
  }
};

