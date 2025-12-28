import express from 'express';
import {
  getMonitoringKeywords,
  getMonitoringHashtags,
  checkContentKeywords,
  checkContentHashtags,
  startAccountMonitoring,
  stopAccountMonitoring,
  startAllMonitoring,
  getMonitoringStatus,
  startKeywordBasedCollectionController,
  stopKeywordBasedCollectionController,
  startAllKeywordBasedCollectionController,
  runKeywordBasedCollectionNowController,
  getKeywordMatchStatistics,
  getHashtagMatchStatistics,
} from '../controllers/monitoring.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/keywords', getMonitoringKeywords);
router.get('/hashtags', getMonitoringHashtags);
router.post('/check-keywords', checkContentKeywords);
router.post('/check-hashtags', checkContentHashtags);
router.post('/accounts/:accountId/start', startAccountMonitoring);
router.post('/accounts/:accountId/stop', stopAccountMonitoring);
router.post('/accounts/start-all', startAllMonitoring);
router.get('/status', getMonitoringStatus);

// 키워드 기반 공개 데이터 수집
router.post('/keyword-based/start', startKeywordBasedCollectionController);
router.post('/keyword-based/stop/:platform', stopKeywordBasedCollectionController);
router.post('/keyword-based/start-all', startAllKeywordBasedCollectionController);
router.post('/keyword-based/run-now', runKeywordBasedCollectionNowController);

// 키워드/해시태그 매칭 통계
router.get('/statistics/keywords', getKeywordMatchStatistics);
router.get('/statistics/hashtags', getHashtagMatchStatistics);

export default router;

