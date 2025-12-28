import pool from '../../config/database.js';
import logger from '../../config/logger.js';
import { extractLocation } from './locationService.js';

export const mapPostLocation = async (postId, content, metadata = {}) => {
  try {
    const locationResult = await extractLocation(content, metadata);
    
    if (locationResult) {
      let locationId = locationResult.id;
      
      if (!locationId && locationResult.province) {
        const existingLocation = await pool.query(
          `SELECT id FROM locations 
           WHERE province = $1 
             AND (city = $2 OR city IS NULL)
             AND (district = $3 OR district IS NULL)
           LIMIT 1`,
          [locationResult.province, locationResult.city || null, locationResult.district || null]
        );
        
        if (existingLocation.rows.length > 0) {
          locationId = existingLocation.rows[0].id;
        } else {
          const newLocation = await pool.query(
            `INSERT INTO locations (province, city, district, latitude, longitude, address)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [
              locationResult.province,
              locationResult.city || null,
              locationResult.district || null,
              locationResult.latitude || null,
              locationResult.longitude || null,
              locationResult.address || null,
            ]
          );
          locationId = newLocation.rows[0].id;
        }
      }
      
      if (locationId) {
        const coordinates = locationResult.latitude && locationResult.longitude
          ? `(${locationResult.longitude}, ${locationResult.latitude})`
          : null;
        
        await pool.query(
          `UPDATE posts 
           SET location_id = $1,
               location_name = $2,
               location_coordinates = $3
           WHERE id = $4`,
          [
            locationId,
            locationResult.province + (locationResult.city ? `, ${locationResult.city}` : ''),
            coordinates,
            postId,
          ]
        );
        
        logger.info(`Post location mapped: ${postId} -> ${locationId}`);
        return locationId;
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Map post location error:', error);
    return null;
  }
};

export const mapMentionLocation = async (mentionId, content, postId = null) => {
  try {
    const locationResult = await extractLocation(content, {});
    
    if (locationResult) {
      let locationId = locationResult.id;
      
      if (!locationId && locationResult.province) {
        const existingLocation = await pool.query(
          `SELECT id FROM locations 
           WHERE province = $1 
             AND (city = $2 OR city IS NULL)
           LIMIT 1`,
          [locationResult.province, locationResult.city || null]
        );
        
        if (existingLocation.rows.length > 0) {
          locationId = existingLocation.rows[0].id;
        } else {
          const newLocation = await pool.query(
            `INSERT INTO locations (province, city, district, latitude, longitude)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [
              locationResult.province,
              locationResult.city || null,
              locationResult.district || null,
              locationResult.latitude || null,
              locationResult.longitude || null,
            ]
          );
          locationId = newLocation.rows[0].id;
        }
      }
      
      if (locationId) {
        const coordinates = locationResult.latitude && locationResult.longitude
          ? `(${locationResult.longitude}, ${locationResult.latitude})`
          : null;
        
        await pool.query(
          `UPDATE mentions 
           SET location_id = $1,
               location_name = $2,
               location_coordinates = $3
           WHERE id = $4`,
          [
            locationId,
            locationResult.province + (locationResult.city ? `, ${locationResult.city}` : ''),
            coordinates,
            mentionId,
          ]
        );
        
        logger.info(`Mention location mapped: ${mentionId} -> ${locationId}`);
        return locationId;
      }
    } else if (postId) {
      const postLocation = await pool.query(
        'SELECT location_id, location_name, location_coordinates FROM posts WHERE id = $1',
        [postId]
      );
      
      if (postLocation.rows.length > 0 && postLocation.rows[0].location_id) {
        await pool.query(
          `UPDATE mentions 
           SET location_id = $1,
               location_name = $2,
               location_coordinates = $3
           WHERE id = $4`,
          [
            postLocation.rows[0].location_id,
            postLocation.rows[0].location_name,
            postLocation.rows[0].location_coordinates,
            mentionId,
          ]
        );
        
        return postLocation.rows[0].location_id;
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Map mention location error:', error);
    return null;
  }
};

export const getLocationStats = async (regionId, days = 7) => {
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(DISTINCT p.id) as post_count,
        COUNT(DISTINCT m.id) as mention_count,
        COUNT(DISTINCT p.account_id) as account_count,
        COUNT(DISTINCT CASE WHEN sa.sentiment_category = 'positive' THEN sa.id END) as positive_count,
        COUNT(DISTINCT CASE WHEN sa.sentiment_category = 'negative' THEN sa.id END) as negative_count,
        COUNT(DISTINCT CASE WHEN rc.risk_level IN ('high', 'critical') THEN rc.id END) as high_risk_count
      FROM locations l
      LEFT JOIN posts p ON p.location_id = l.id
      LEFT JOIN mentions m ON m.location_id = l.id
      LEFT JOIN sentiment_analysis sa ON sa.post_id = p.id
      LEFT JOIN risk_classification rc ON rc.post_id = p.id
      WHERE l.region_id = $1
        AND (p.created_at >= NOW() - INTERVAL '${days} days' OR m.created_at >= NOW() - INTERVAL '${days} days')
      GROUP BY l.region_id`,
      [regionId]
    );
    
    return result.rows[0] || {
      post_count: 0,
      mention_count: 0,
      account_count: 0,
      positive_count: 0,
      negative_count: 0,
      high_risk_count: 0,
    };
  } catch (error) {
    logger.error('Get location stats error:', error);
    throw error;
  }
};

