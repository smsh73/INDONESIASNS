import express from 'express';
import { exportDashboardDetail, exportReport } from '../controllers/export.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/dashboard/:type/:value', exportDashboardDetail);
router.get('/report', exportReport);

export default router;

