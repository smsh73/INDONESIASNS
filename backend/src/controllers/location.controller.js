import { getRegionStats, aggregateByRegion } from '../services/location/locationService.js';
import pool from '../config/database.js';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';

export const getLocationStats = async (req, res, next) => {
  try {
    const { regionId, days = 7 } = req.query;

    if (!regionId) {
      throw new AppError('지역 ID가 필요합니다', 400);
    }

    const stats = await getRegionStats(regionId, days);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Get location stats error:', error);
    next(error);
  }
};

export const triggerAggregation = async (req, res, next) => {
  try {
    const { date } = req.body;

    await aggregateByRegion(date);

    res.json({
      success: true,
      message: '집계가 완료되었습니다',
    });
  } catch (error) {
    logger.error('Trigger aggregation error:', error);
    next(error);
  }
};

