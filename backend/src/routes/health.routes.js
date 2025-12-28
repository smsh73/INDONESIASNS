import express from 'express';
import { healthCheck, getSystemStats } from '../utils/monitoring.js';

const router = express.Router();

router.get('/health', async (req, res) => {
  const checks = await healthCheck();
  const status = checks.database && checks.redis ? 200 : 503;
  res.status(status).json(checks);
});

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getSystemStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

