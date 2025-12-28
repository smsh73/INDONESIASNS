import redisClient from '../config/redis.js';
import logger from '../config/logger.js';

export const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    // Redis가 없으면 캐싱 건너뛰기
    if (!redisClient) {
      return next();
    }

    const key = `cache:${req.originalUrl}:${JSON.stringify(req.query)}`;

    try {
      const cached = await redisClient.get(key);
      if (cached) {
        return res.json({
          ...JSON.parse(cached),
          cached: true,
        });
      }

      const originalJson = res.json.bind(res);
      res.json = function (data) {
        if (redisClient) {
          redisClient.setEx(key, duration, JSON.stringify(data)).catch(err => {
            logger.error('Cache set error:', err);
          });
        }
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

