import express from 'express';
import { 
  getDashboardStats, 
  getTrends, 
  getSentimentDistribution,
  getPlatformStats,
  getRegionStats,
  getSentimentDetail,
  getRiskDetail,
  getHourlyStats
} from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/stats', getDashboardStats);
router.get('/trends', getTrends);
router.get('/sentiment', getSentimentDistribution);
router.get('/platform/:platform', getPlatformStats);
router.get('/region/:region', getRegionStats);
router.get('/hour/:hour', getHourlyStats);
router.get('/sentiment/:sentiment/detail', getSentimentDetail);
router.get('/risk/:risk/detail', getRiskDetail);

export default router;

