import pool from '../config/database.js';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';
import { getLocationStats } from '../services/location/locationMapper.js';

export const getMapDashboard = async (req, res, next) => {
  try {
    const { countryId, days = 7 } = req.query;
    
    let query = `
      SELECT 
        r.id,
        r.province,
        r.city,
        r.district,
        r.latitude,
        r.longitude,
        r.country_id,
        c.name as country_name,
        c.map_image_url as country_map_url,
        md.map_image_url,
        md.map_data,
        md.boundaries
      FROM regions r
      LEFT JOIN countries c ON r.country_id = c.id
      LEFT JOIN map_data md ON md.region_id = r.id AND md.map_type = 'province'
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;
    
    if (countryId) {
      query += ` AND r.country_id = $${paramCount}`;
      params.push(countryId);
      paramCount++;
    }
    
    query += ' ORDER BY r.province, r.city';
    
    const regions = await pool.query(query, params);
    
    const regionsWithStats = await Promise.all(
      regions.rows.map(async (region) => {
        try {
          const stats = await getLocationStats(region.id, days);
          return {
            ...region,
            stats,
          };
        } catch (error) {
          logger.error(`Error getting stats for region ${region.id}:`, error);
          return {
            ...region,
            stats: {
              post_count: 0,
              mention_count: 0,
              account_count: 0,
              positive_count: 0,
              negative_count: 0,
              high_risk_count: 0,
            },
          };
        }
      })
    );
    
    const countryData = countryId
      ? await pool.query('SELECT * FROM countries WHERE id = $1', [countryId])
      : { rows: [] };
    
    res.json({
      success: true,
      data: {
        country: countryData.rows[0] || null,
        regions: regionsWithStats,
      },
    });
  } catch (error) {
    logger.error('Get map dashboard error:', error);
    next(error);
  }
};

export const getRegionMapData = async (req, res, next) => {
  try {
    const { regionId } = req.params;
    const { days = 7 } = req.query;
    
    const region = await pool.query(
      `SELECT r.*, c.name as country_name, c.map_image_url as country_map_url
       FROM regions r
       LEFT JOIN countries c ON r.country_id = c.id
       WHERE r.id = $1`,
      [regionId]
    );
    
    if (region.rows.length === 0) {
      throw new AppError('지역을 찾을 수 없습니다', 404);
    }
    
    const mapData = await pool.query(
      'SELECT * FROM map_data WHERE region_id = $1 ORDER BY map_type',
      [regionId]
    );
    
    const stats = await getLocationStats(regionId, days);
    
    const locations = await pool.query(
      `SELECT 
        l.*,
        COUNT(DISTINCT p.id) as post_count,
        COUNT(DISTINCT m.id) as mention_count
      FROM locations l
      LEFT JOIN posts p ON p.location_id = l.id AND p.created_at >= NOW() - INTERVAL '${days} days'
      LEFT JOIN mentions m ON m.location_id = l.id AND m.created_at >= NOW() - INTERVAL '${days} days'
      WHERE l.region_id = $1
      GROUP BY l.id
      ORDER BY post_count DESC, mention_count DESC`,
      [regionId]
    );
    
    res.json({
      success: true,
      data: {
        region: region.rows[0],
        mapData: mapData.rows,
        stats,
        locations: locations.rows,
      },
    });
  } catch (error) {
    logger.error('Get region map data error:', error);
    next(error);
  }
};

