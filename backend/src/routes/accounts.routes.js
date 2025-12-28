import express from 'express';
import { getAccounts, createAccount, updateAccount, deleteAccount } from '../controllers/accounts.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getAccounts);
router.post('/', authorize('admin'), createAccount);
router.put('/:id', authorize('admin'), updateAccount);
router.delete('/:id', authorize('admin'), deleteAccount);

export default router;

