import express from 'express';
import { getAlerts, createAlert, updateAlert, deleteAlert } from '../controllers/alerts.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getAlerts);
router.post('/', createAlert);
router.put('/:id', updateAlert);
router.delete('/:id', deleteAlert);

export default router;

