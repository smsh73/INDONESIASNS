import pool from '../config/database.js';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';
import crypto from 'crypto';
import { 
  validateRequired, 
  validatePlatform, 
  validateKeywordType, 
  validatePriority,
  validateKeyword,
  validateHashtag,
  validateStringLength,
  validatePagination
} from '../utils/validation.js';

// API Keys 관리
export const getApiKeys = async (req, res, next) => {
  try {
    const { service } = req.query;
    
    let query = 'SELECT id, name, service, is_active, created_at, updated_at, last_used_at FROM api_keys WHERE 1=1';
    const params = [];
    
    if (service) {
      query += ' AND service = $1';
      params.push(service);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Get API keys error:', error);
    next(error);
  }
};

export const createApiKey = async (req, res, next) => {
  try {
    const { name, service, apiKey } = req.body;
    
    if (!name || !service || !apiKey) {
      throw new AppError('필수 필드가 누락되었습니다', 400);
    }
    
    const encryptedKey = encryptApiKey(apiKey);
    
    const result = await pool.query(
      `INSERT INTO api_keys (name, service, api_key, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, service, is_active, created_at`,
      [name, service, encryptedKey, req.user.id]
    );
    
    logger.info(`API key created: ${name} for ${service} by ${req.user.username}`);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Create API key error:', error);
    next(error);
  }
};

export const updateApiKey = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, apiKey, isActive } = req.body;
    
    let query = 'UPDATE api_keys SET';
    const params = [];
    let paramCount = 1;
    
    if (name) {
      query += ` name = $${paramCount}`;
      params.push(name);
      paramCount++;
    }
    
    if (apiKey) {
      const encryptedKey = encryptApiKey(apiKey);
      query += `${paramCount > 1 ? ',' : ''} api_key = $${paramCount}`;
      params.push(encryptedKey);
      paramCount++;
    }
    
    if (isActive !== undefined) {
      query += `${paramCount > 1 ? ',' : ''} is_active = $${paramCount}`;
      params.push(isActive);
      paramCount++;
    }
    
    query += `, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING id, name, service, is_active, created_at`;
    params.push(id);
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      throw new AppError('API 키를 찾을 수 없습니다', 404);
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Update API key error:', error);
    next(error);
  }
};

export const deleteApiKey = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM api_keys WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      throw new AppError('API 키를 찾을 수 없습니다', 404);
    }
    
    logger.info(`API key deleted: ${id}`);
    
    res.json({
      success: true,
      message: 'API 키가 삭제되었습니다',
    });
  } catch (error) {
    logger.error('Delete API key error:', error);
    next(error);
  }
};

// 모니터링 키워드 관리
export const getKeywords = async (req, res, next) => {
  try {
    const { platform, isActive, page, limit } = req.query;
    
    // 페이지네이션 검증
    const { page: validatedPage, limit: validatedLimit } = validatePagination(page, limit);
    const offset = (validatedPage - 1) * validatedLimit;
    
    let query = 'SELECT * FROM monitoring_keywords WHERE 1=1';
    const params = [];
    let paramCount = 1;
    
    if (platform) {
      validatePlatform(platform);
      query += ` AND platform = $${paramCount}`;
      params.push(platform);
      paramCount++;
    }
    
    if (isActive !== undefined) {
      const isActiveBool = isActive === 'true' || isActive === true;
      query += ` AND is_active = $${paramCount}`;
      params.push(isActiveBool);
      paramCount++;
    }
    
    // 총 개수 조회
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    
    query += ' ORDER BY priority DESC, created_at DESC';
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(validatedLimit, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total,
        totalPages: Math.ceil(total / validatedLimit),
      },
    });
  } catch (error) {
    logger.error('Get keywords error:', error);
    next(error);
  }
};

export const createKeyword = async (req, res, next) => {
  try {
    const { keyword, platform, priority = 0, description, keywordType, isActive = true } = req.body;
    
    if (!keyword) {
      throw new AppError('키워드를 입력해주세요', 400);
    }
    
    // created_by는 nullable이므로 null 허용
    // req.user가 없거나 id가 없으면 null로 설정
    const userId = (req.user && req.user.id) ? req.user.id : null;
    
    // SQL 쿼리에서 created_by가 null인 경우 명시적으로 처리
    let query;
    let params;
    
    if (userId) {
      query = `INSERT INTO monitoring_keywords (keyword, platform, priority, description, keyword_type, is_active, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING *`;
      params = [keyword, platform || null, priority || 0, description || null, keywordType || null, isActive !== false, userId];
    } else {
      query = `INSERT INTO monitoring_keywords (keyword, platform, priority, description, keyword_type, is_active, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, NULL)
               RETURNING *`;
      params = [keyword, platform || null, priority || 0, description || null, keywordType || null, isActive !== false];
    }
    
    const result = await pool.query(query, params);
    
    logger.info(`Keyword created: ${keyword} by ${req.user?.username || 'system'}`);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Create keyword error:', error);
    logger.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      body: req.body,
      user: req.user ? { id: req.user.id, username: req.user.username } : null,
    });
    
    // 데이터베이스 제약 조건 에러 처리
    if (error.code === '23505') { // unique_violation
      throw new AppError('이미 존재하는 키워드입니다', 409);
    } else if (error.code === '23503') { // foreign_key_violation
      throw new AppError('유효하지 않은 사용자 ID입니다', 400);
    }
    
    next(error);
  }
};

export const updateKeyword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { keyword, platform, priority, description, keywordType, isActive } = req.body;
    
    const result = await pool.query(
      `UPDATE monitoring_keywords 
       SET keyword = COALESCE($1, keyword),
           platform = COALESCE($2, platform),
           priority = COALESCE($3, priority),
           description = COALESCE($4, description),
           keyword_type = COALESCE($5, keyword_type),
           is_active = COALESCE($6, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [keyword, platform, priority, description, keywordType, isActive, id]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('키워드를 찾을 수 없습니다', 404);
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Update keyword error:', error);
    next(error);
  }
};

export const deleteKeyword = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM monitoring_keywords WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      throw new AppError('키워드를 찾을 수 없습니다', 404);
    }
    
    res.json({
      success: true,
      message: '키워드가 삭제되었습니다',
    });
  } catch (error) {
    logger.error('Delete keyword error:', error);
    next(error);
  }
};

// 모니터링 해시태그 관리
export const getHashtags = async (req, res, next) => {
  try {
    const { platform, isActive } = req.query;
    
    let query = 'SELECT * FROM monitoring_hashtags WHERE 1=1';
    const params = [];
    let paramCount = 1;
    
    if (platform) {
      query += ` AND platform = $${paramCount}`;
      params.push(platform);
      paramCount++;
    }
    
    if (isActive !== undefined) {
      query += ` AND is_active = $${paramCount}`;
      params.push(isActive === 'true');
      paramCount++;
    }
    
    query += ' ORDER BY priority DESC, created_at DESC';
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Get hashtags error:', error);
    next(error);
  }
};

export const createHashtag = async (req, res, next) => {
  try {
    const { hashtag, platform, priority = 0, description, isActive = true } = req.body;
    
    // 필수 필드 검증
    validateRequired({ hashtag }, ['hashtag'], { hashtag: '해시태그' });
    
    // 해시태그 검증
    const validatedHashtag = validateHashtag(hashtag);
    
    // 플랫폼 검증
    const validatedPlatform = platform ? validatePlatform(platform) : null;
    
    // 우선순위 검증
    const validatedPriority = validatePriority(priority);
    
    // 설명 길이 검증
    if (description) {
      validateStringLength(description, 0, 1000, '설명');
    }
    
    const userId = req.user?.id || null;
    
    const result = await pool.query(
      `INSERT INTO monitoring_hashtags (hashtag, platform, priority, description, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [validatedHashtag, validatedPlatform, validatedPriority, description || null, isActive, userId]
    );
    
    logger.info(`Hashtag created: ${hashtag} by ${req.user?.username || 'system'}`);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Create hashtag error:', error);
    next(error);
  }
};

export const updateHashtag = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hashtag, platform, priority, description, isActive } = req.body;
    
    const result = await pool.query(
      `UPDATE monitoring_hashtags 
       SET hashtag = COALESCE($1, hashtag),
           platform = COALESCE($2, platform),
           priority = COALESCE($3, priority),
           description = COALESCE($4, description),
           is_active = COALESCE($5, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [hashtag, platform, priority, description, isActive, id]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('해시태그를 찾을 수 없습니다', 404);
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Update hashtag error:', error);
    next(error);
  }
};

export const deleteHashtag = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM monitoring_hashtags WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      throw new AppError('해시태그를 찾을 수 없습니다', 404);
    }
    
    res.json({
      success: true,
      message: '해시태그가 삭제되었습니다',
    });
  } catch (error) {
    logger.error('Delete hashtag error:', error);
    next(error);
  }
};

// 국가 관리
export const getCountries = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM countries ORDER BY name');
    
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Get countries error:', error);
    next(error);
  }
};

export const createCountry = async (req, res, next) => {
  try {
    const { name, code, isoCode, latitude, longitude, mapImageUrl, mapData } = req.body;
    
    if (!name) {
      throw new AppError('국가명을 입력해주세요', 400);
    }
    
    const result = await pool.query(
      `INSERT INTO countries (name, code, iso_code, latitude, longitude, map_image_url, map_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, code || null, isoCode || null, latitude || null, longitude || null, mapImageUrl || null, mapData ? JSON.stringify(mapData) : null]
    );
    
    logger.info(`Country created: ${name}`);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Create country error:', error);
    next(error);
  }
};

export const updateCountry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, isoCode, latitude, longitude, mapImageUrl, mapData, isActive } = req.body;
    
    const result = await pool.query(
      `UPDATE countries 
       SET name = COALESCE($1, name),
           code = COALESCE($2, code),
           iso_code = COALESCE($3, iso_code),
           latitude = COALESCE($4, latitude),
           longitude = COALESCE($5, longitude),
           map_image_url = COALESCE($6, map_image_url),
           map_data = COALESCE($7, map_data),
           is_active = COALESCE($8, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [name, code, isoCode, latitude, longitude, mapImageUrl, mapData ? JSON.stringify(mapData) : null, isActive, id]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('국가를 찾을 수 없습니다', 404);
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Update country error:', error);
    next(error);
  }
};

export const deleteCountry = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM countries WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      throw new AppError('국가를 찾을 수 없습니다', 404);
    }
    
    res.json({
      success: true,
      message: '국가가 삭제되었습니다',
    });
  } catch (error) {
    logger.error('Delete country error:', error);
    next(error);
  }
};

// 지역 관리 (기존 regions 컨트롤러 확장)
export const createRegion = async (req, res, next) => {
  try {
    const { province, city, district, latitude, longitude, countryId } = req.body;
    
    if (!province) {
      throw new AppError('지역명을 입력해주세요', 400);
    }
    
    const result = await pool.query(
      `INSERT INTO regions (province, city, district, latitude, longitude, country_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [province, city || null, district || null, latitude || null, longitude || null, countryId || null]
    );
    
    logger.info(`Region created: ${province}`);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Create region error:', error);
    next(error);
  }
};

export const updateRegion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { province, city, district, latitude, longitude, countryId } = req.body;
    
    const result = await pool.query(
      `UPDATE regions 
       SET province = COALESCE($1, province),
           city = COALESCE($2, city),
           district = COALESCE($3, district),
           latitude = COALESCE($4, latitude),
           longitude = COALESCE($5, longitude),
           country_id = COALESCE($6, country_id)
       WHERE id = $7
       RETURNING *`,
      [province, city, district, latitude, longitude, countryId, id]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('지역을 찾을 수 없습니다', 404);
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Update region error:', error);
    next(error);
  }
};

export const deleteRegion = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM regions WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      throw new AppError('지역을 찾을 수 없습니다', 404);
    }
    
    res.json({
      success: true,
      message: '지역이 삭제되었습니다',
    });
  } catch (error) {
    logger.error('Delete region error:', error);
    next(error);
  }
};

// 지도 데이터 관리
export const getMapData = async (req, res, next) => {
  try {
    const { countryId, regionId, mapType } = req.query;
    
    let query = 'SELECT * FROM map_data WHERE 1=1';
    const params = [];
    let paramCount = 1;
    
    if (countryId) {
      query += ` AND country_id = $${paramCount}`;
      params.push(countryId);
      paramCount++;
    }
    
    if (regionId) {
      query += ` AND region_id = $${paramCount}`;
      params.push(regionId);
      paramCount++;
    }
    
    if (mapType) {
      query += ` AND map_type = $${paramCount}`;
      params.push(mapType);
      paramCount++;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Get map data error:', error);
    next(error);
  }
};

export const createMapData = async (req, res, next) => {
  try {
    const { countryId, regionId, mapType, mapImageUrl, mapData, boundaries } = req.body;
    
    if (!mapType) {
      throw new AppError('지도 타입을 입력해주세요', 400);
    }
    
    const result = await pool.query(
      `INSERT INTO map_data (country_id, region_id, map_type, map_image_url, map_data, boundaries)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        countryId || null,
        regionId || null,
        mapType,
        mapImageUrl || null,
        mapData ? JSON.stringify(mapData) : null,
        boundaries ? JSON.stringify(boundaries) : null,
      ]
    );
    
    logger.info(`Map data created: ${mapType}`);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Create map data error:', error);
    next(error);
  }
};

export const updateMapData = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { mapImageUrl, mapData, boundaries } = req.body;
    
    const result = await pool.query(
      `UPDATE map_data 
       SET map_image_url = COALESCE($1, map_image_url),
           map_data = COALESCE($2, map_data),
           boundaries = COALESCE($3, boundaries),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [
        mapImageUrl,
        mapData ? JSON.stringify(mapData) : null,
        boundaries ? JSON.stringify(boundaries) : null,
        id,
      ]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('지도 데이터를 찾을 수 없습니다', 404);
    }
    
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Update map data error:', error);
    next(error);
  }
};

export const deleteMapData = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM map_data WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      throw new AppError('지도 데이터를 찾을 수 없습니다', 404);
    }
    
    res.json({
      success: true,
      message: '지도 데이터가 삭제되었습니다',
    });
  } catch (error) {
    logger.error('Delete map data error:', error);
    next(error);
  }
};

// API Key 암호화/복호화 함수
const encryptApiKey = (key) => {
  const algorithm = 'aes-256-cbc';
  const secretKey = process.env.ENCRYPTION_KEY || 'default-secret-key-change-in-production';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey.substring(0, 32)), iv);
  
  let encrypted = cipher.update(key, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
};

const decryptApiKey = (encryptedKey) => {
  const algorithm = 'aes-256-cbc';
  const secretKey = process.env.ENCRYPTION_KEY || 'default-secret-key-change-in-production';
  const parts = encryptedKey.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey.substring(0, 32)), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

