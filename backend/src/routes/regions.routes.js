import express from 'express';
import { getRegions, getRegionStats, getRegionComparison } from '../controllers/regions.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getRegions);
router.get('/:regionId/stats', getRegionStats);
router.get('/compare', getRegionComparison);

export default router;

