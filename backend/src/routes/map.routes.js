import express from 'express';
import { getMapDashboard, getRegionMapData } from '../controllers/map.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/dashboard', getMapDashboard);
router.get('/region/:regionId', getRegionMapData);

export default router;

