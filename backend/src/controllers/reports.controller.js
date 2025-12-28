import { 
  generateDailyReport as generateDailyReportService, 
  generateWeeklyReport as generateWeeklyReportService 
} from '../services/reports/reportService.js';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';

export const generateDailyReport = async (req, res, next) => {
  try {
    const { date } = req.query;

    const report = await generateDailyReportService(date);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Generate daily report error:', error);
    next(error);
  }
};

export const generateWeeklyReport = async (req, res, next) => {
  try {
    const { weekStart } = req.query;

    const report = await generateWeeklyReportService(weekStart ? new Date(weekStart) : null);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('Generate weekly report error:', error);
    next(error);
  }
};

