import logger from '../config/logger.js';
import pool from '../config/database.js';
import redisClient from '../config/redis.js';

export const healthCheck = async () => {
  const checks = {
    database: false,
    redis: false,
    timestamp: new Date().toISOString(),
  };

  try {
    await pool.query('SELECT 1');
    checks.database = true;
  } catch (error) {
    logger.error('Database health check failed:', error);
  }

  if (redisClient) {
    try {
      await redisClient.ping();
      checks.redis = true;
    } catch (error) {
      logger.error('Redis health check failed:', error);
    }
  } else {
    checks.redis = null; // Redis가 설정되지 않음
  }

  return checks;
};

export const getSystemStats = async () => {
  try {
    const dbStats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM posts) as total_posts,
        (SELECT COUNT(*) FROM mentions) as total_mentions,
        (SELECT COUNT(*) FROM accounts) as total_accounts,
        (SELECT COUNT(*) FROM alerts WHERE resolved = FALSE) as active_alerts
    `);
    
    let redisInfo = null;
    if (redisClient) {
      try {
        redisInfo = await redisClient.info('memory');
      } catch (error) {
        logger.error('Redis info error:', error);
      }
    }

    return {
      database: dbStats.rows[0],
      redis: redisInfo ? parseRedisInfo(redisInfo) : null,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Get system stats error:', error);
    throw error;
  }
};

const parseRedisInfo = (info) => {
  const lines = info.split('\r\n');
  const data = {};

  for (const line of lines) {
    if (line.includes(':')) {
      const [key, value] = line.split(':');
      data[key] = value;
    }
  }

  return {
    usedMemory: data.used_memory_human,
    connectedClients: data.connected_clients,
  };
};

