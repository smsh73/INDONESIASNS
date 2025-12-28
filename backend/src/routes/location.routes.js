import express from 'express';
import { getLocationStats, triggerAggregation } from '../controllers/location.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/stats', getLocationStats);
router.post('/aggregate', authorize('admin'), triggerAggregation);

export default router;

