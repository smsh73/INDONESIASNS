import express from 'express';
import { 
  getWorkflows, 
  createWorkflow, 
  updateWorkflow, 
  deleteWorkflow,
  getWorkflowExecutions,
  executeWorkflow
} from '../controllers/workflows.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getWorkflows);
router.post('/', authorize('admin'), createWorkflow);
router.put('/:id', authorize('admin'), updateWorkflow);
router.delete('/:id', authorize('admin'), deleteWorkflow);
router.get('/:id/executions', getWorkflowExecutions);
router.post('/:id/execute', authorize('admin'), executeWorkflow);

export default router;

