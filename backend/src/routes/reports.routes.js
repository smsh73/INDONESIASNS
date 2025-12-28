import express from 'express';
import { generateDailyReport, generateWeeklyReport } from '../controllers/reports.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/daily', generateDailyReport);
router.get('/weekly', generateWeeklyReport);

export default router;

