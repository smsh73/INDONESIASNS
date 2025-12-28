import express from 'express';
import { getAnalysis, getAnalysisByCategory, getAnalysisByRegion } from '../controllers/analysis.controller.js';
import { analyzePost, analyzeMention } from '../controllers/analysis.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getAnalysis);
router.get('/category/:category', getAnalysisByCategory);
router.get('/region/:regionId', getAnalysisByRegion);
router.post('/post/:postId', analyzePost);
router.post('/mention/:mentionId', analyzeMention);

export default router;
