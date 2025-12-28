import express from 'express';
import authRoutes from './auth.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import analysisRoutes from './analysis.routes.js';
import accountsRoutes from './accounts.routes.js';
import postsRoutes from './posts.routes.js';
import alertsRoutes from './alerts.routes.js';
import regionsRoutes from './regions.routes.js';
import locationRoutes from './location.routes.js';
import trendsRoutes from './trends.routes.js';
import reportsRoutes from './reports.routes.js';
import healthRoutes from './health.routes.js';
import workflowsRoutes from './workflows.routes.js';
import collectionRoutes from './collection.routes.js';
import adminRoutes from './admin.routes.js';
import mapRoutes from './map.routes.js';
import exportRoutes from './export.routes.js';
import monitoringRoutes from './monitoring.routes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/analysis', analysisRoutes);
router.use('/accounts', accountsRoutes);
router.use('/posts', postsRoutes);
router.use('/alerts', alertsRoutes);
router.use('/regions', regionsRoutes);
router.use('/location', locationRoutes);
router.use('/trends', trendsRoutes);
router.use('/reports', reportsRoutes);
router.use('/health', healthRoutes);
router.use('/workflows', workflowsRoutes);
router.use('/collection', collectionRoutes);
router.use('/admin', adminRoutes);
router.use('/map', mapRoutes);
router.use('/export', exportRoutes);
router.use('/monitoring', monitoringRoutes);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;

