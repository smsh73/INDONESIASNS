import express from 'express';
import { 
  getCollectionJobs, 
  createCollectionJob,
  getCollectionJobById,
  updateCollectionJob
} from '../controllers/collection.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/jobs', getCollectionJobs);
router.post('/jobs', authorize('admin'), createCollectionJob);
router.get('/jobs/:id', getCollectionJobById);
router.put('/jobs/:id', authorize('admin'), updateCollectionJob);

export default router;

