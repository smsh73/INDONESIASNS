import express from 'express';
import { analyzeTrend, getInfluentialUsers, getTrends } from '../controllers/trends.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getTrends);
router.post('/analyze', analyzeTrend);
router.get('/influential', getInfluentialUsers);

export default router;

