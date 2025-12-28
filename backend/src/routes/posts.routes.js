import express from 'express';
import { getPosts, getPostById, getPostsByAccount } from '../controllers/posts.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getPosts);
router.get('/:id', getPostById);
router.get('/account/:accountId', getPostsByAccount);

export default router;

