import express from 'express';
import {
  // API Keys
  getApiKeys,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  // Keywords
  getKeywords,
  createKeyword,
  updateKeyword,
  deleteKeyword,
  // Hashtags
  getHashtags,
  createHashtag,
  updateHashtag,
  deleteHashtag,
  // Countries
  getCountries,
  createCountry,
  updateCountry,
  deleteCountry,
  // Regions
  createRegion,
  updateRegion,
  deleteRegion,
  // Map Data
  getMapData,
  createMapData,
  updateMapData,
  deleteMapData,
} from '../controllers/admin.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

// API Keys
router.get('/api-keys', getApiKeys);
router.post('/api-keys', createApiKey);
router.put('/api-keys/:id', updateApiKey);
router.delete('/api-keys/:id', deleteApiKey);

// Keywords
router.get('/keywords', getKeywords);
router.post('/keywords', createKeyword);
router.put('/keywords/:id', updateKeyword);
router.delete('/keywords/:id', deleteKeyword);

// Hashtags
router.get('/hashtags', getHashtags);
router.post('/hashtags', createHashtag);
router.put('/hashtags/:id', updateHashtag);
router.delete('/hashtags/:id', deleteHashtag);

// Countries
router.get('/countries', getCountries);
router.post('/countries', createCountry);
router.put('/countries/:id', updateCountry);
router.delete('/countries/:id', deleteCountry);

// Regions
router.post('/regions', createRegion);
router.put('/regions/:id', updateRegion);
router.delete('/regions/:id', deleteRegion);

// Map Data
router.get('/map-data', getMapData);
router.post('/map-data', createMapData);
router.put('/map-data/:id', updateMapData);
router.delete('/map-data/:id', deleteMapData);

export default router;

