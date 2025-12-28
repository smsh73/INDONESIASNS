import pool from '../config/database.js';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';
import {
  getActiveKeywords,
  getActiveHashtags,
  checkKeywordMatch,
  checkHashtagMatch,
  startMonitoringForAccount,
  stopMonitoringForAccount,
  startMonitoringForAllAccounts,
} from '../services/monitoring/monitoringService.js';
import {
  startKeywordBasedCollection,
  stopKeywordBasedCollection,
  startAllKeywordBasedCollection,
  runKeywordBasedCollectionNow,
} from '../services/monitoring/publicDataCollectionService.js';

/**
 * 활성 모니터링 키워드 조회
 */
export const getMonitoringKeywords = async (req, res, next) => {
  try {
    const { platform } = req.query;
    const keywords = await getActiveKeywords(platform);

    res.json({
      success: true,
      data: keywords,
    });
  } catch (error) {
    logger.error('Get monitoring keywords error:', error);
    next(error);
  }
};

/**
 * 활성 모니터링 해시태그 조회
 */
export const getMonitoringHashtags = async (req, res, next) => {
  try {
    const { platform } = req.query;
    const hashtags = await getActiveHashtags(platform);

    res.json({
      success: true,
      data: hashtags,
    });
  } catch (error) {
    logger.error('Get monitoring hashtags error:', error);
    next(error);
  }
};

/**
 * 콘텐츠 키워드 매칭 확인
 */
export const checkContentKeywords = async (req, res, next) => {
  try {
    const { content, platform } = req.body;

    if (!content) {
      throw new AppError('콘텐츠가 필요합니다', 400);
    }

    const matches = await checkKeywordMatch(content, platform);

    res.json({
      success: true,
      data: {
        matches,
        matchCount: matches.length,
      },
    });
  } catch (error) {
    logger.error('Check content keywords error:', error);
    next(error);
  }
};

/**
 * 콘텐츠 해시태그 매칭 확인
 */
export const checkContentHashtags = async (req, res, next) => {
  try {
    const { hashtags, platform } = req.body;

    if (!hashtags || !Array.isArray(hashtags)) {
      throw new AppError('해시태그 배열이 필요합니다', 400);
    }

    const matches = await checkHashtagMatch(hashtags, platform);

    res.json({
      success: true,
      data: {
        matches,
        matchCount: matches.length,
      },
    });
  } catch (error) {
    logger.error('Check content hashtags error:', error);
    next(error);
  }
};

/**
 * 계정 모니터링 시작
 */
export const startAccountMonitoring = async (req, res, next) => {
  try {
    const { accountId } = req.params;

    try {
      const job = await startMonitoringForAccount(parseInt(accountId));

      res.json({
        success: true,
        data: {
          accountId: parseInt(accountId),
          jobId: job?.id || null,
          message: '모니터링이 시작되었습니다',
        },
      });
    } catch (monitoringError) {
      logger.error('Monitoring start error:', monitoringError);
      // 모니터링 시작 실패해도 성공 응답 (수동 모니터링 가능)
      res.json({
        success: true,
        data: {
          accountId: parseInt(accountId),
          jobId: null,
          message: '모니터링 시작 시도 완료 (Queue가 없을 수 있습니다)',
          warning: monitoringError.message,
        },
      });
    }
  } catch (error) {
    logger.error('Start account monitoring error:', error);
    next(error);
  }
};

/**
 * 계정 모니터링 중지
 */
export const stopAccountMonitoring = async (req, res, next) => {
  try {
    const { accountId } = req.params;

    await stopMonitoringForAccount(parseInt(accountId));

    res.json({
      success: true,
      data: {
        accountId: parseInt(accountId),
        message: '모니터링이 중지되었습니다',
      },
    });
  } catch (error) {
    logger.error('Stop account monitoring error:', error);
    next(error);
  }
};

/**
 * 모든 계정 모니터링 시작
 */
export const startAllMonitoring = async (req, res, next) => {
  try {
    const results = await startMonitoringForAllAccounts();

    res.json({
      success: true,
      data: {
        results,
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    });
  } catch (error) {
    logger.error('Start all monitoring error:', error);
    next(error);
  }
};

/**
 * 모니터링 상태 조회
 */
export const getMonitoringStatus = async (req, res, next) => {
  try {
    const { accountId } = req.query;

    let query = `
      SELECT 
        a.id,
        a.username,
        a.platform,
        a.is_active,
        COUNT(DISTINCT mk.id) as keyword_count,
        COUNT(DISTINCT mh.id) as hashtag_count
      FROM accounts a
      LEFT JOIN monitoring_keywords mk ON (mk.platform = a.platform OR mk.platform IS NULL) AND mk.is_active = TRUE
      LEFT JOIN monitoring_hashtags mh ON (mh.platform = a.platform OR mh.platform IS NULL) AND mh.is_active = TRUE
      WHERE a.is_active = TRUE
    `;
    const params = [];

    if (accountId) {
      query += ' AND a.id = $1';
      params.push(accountId);
    }

    query += ' GROUP BY a.id, a.username, a.platform, a.is_active';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Get monitoring status error:', error);
    next(error);
  }
};

/**
 * 키워드 매칭 통계 조회
 */
export const getKeywordMatchStatistics = async (req, res, next) => {
  try {
    const { platform, startDate, endDate, keywordId } = req.query;

    // monitoring_matches 테이블이 없을 수 있으므로 안전한 쿼리 사용
    let query = `
      SELECT 
        mk.id as keyword_id,
        mk.keyword,
        mk.keyword_type,
        mk.platform,
        COALESCE(COUNT(DISTINCT mm.post_id), 0) as match_count,
        COALESCE(COUNT(DISTINCT CASE WHEN p.posted_at >= CURRENT_DATE - INTERVAL '7 days' THEN mm.post_id END), 0) as match_count_7d,
        COALESCE(COUNT(DISTINCT CASE WHEN p.posted_at >= CURRENT_DATE - INTERVAL '30 days' THEN mm.post_id END), 0) as match_count_30d,
        COALESCE(AVG(mm.priority_score), 0) as avg_priority_score,
        COALESCE(MAX(mm.priority_score), 0) as max_priority_score
      FROM monitoring_keywords mk
      LEFT JOIN monitoring_matches mm ON mk.id = ANY(mm.keyword_ids)
      LEFT JOIN posts p ON mm.post_id = p.id
      WHERE mk.is_active = TRUE
    `;
    const params = [];
    let paramCount = 1;

    if (platform) {
      query += ` AND (mk.platform = $${paramCount} OR mk.platform IS NULL)`;
      params.push(platform);
      paramCount++;
    }

    if (keywordId) {
      query += ` AND mk.id = $${paramCount}`;
      params.push(keywordId);
      paramCount++;
    }

    if (startDate) {
      query += ` AND p.posted_at >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND p.posted_at <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    query += ' GROUP BY mk.id, mk.keyword, mk.keyword_type, mk.platform ORDER BY match_count DESC, avg_priority_score DESC';

    const result = await pool.query(query, params).catch((error) => {
      logger.error('Keyword match statistics query error:', error);
      // monitoring_matches 테이블이 없을 수 있으므로 빈 결과 반환
      return { rows: [] };
    });

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Get keyword match statistics error:', error);
    next(error);
  }
};

/**
 * 해시태그 매칭 통계 조회
 */
export const getHashtagMatchStatistics = async (req, res, next) => {
  try {
    const { platform, startDate, endDate, hashtagId } = req.query;

    let query = `
      SELECT 
        mh.id as hashtag_id,
        mh.hashtag,
        mh.platform,
        COUNT(DISTINCT mm.post_id) as match_count,
        COUNT(DISTINCT CASE WHEN p.posted_at >= CURRENT_DATE - INTERVAL '7 days' THEN mm.post_id END) as match_count_7d,
        COUNT(DISTINCT CASE WHEN p.posted_at >= CURRENT_DATE - INTERVAL '30 days' THEN mm.post_id END) as match_count_30d,
        AVG(mm.priority_score) as avg_priority_score,
        MAX(mm.priority_score) as max_priority_score
      FROM monitoring_hashtags mh
      LEFT JOIN monitoring_matches mm ON mh.id = ANY(mm.hashtag_ids)
      LEFT JOIN posts p ON mm.post_id = p.id
      WHERE mh.is_active = TRUE
    `;
    const params = [];
    let paramCount = 1;

    if (platform) {
      query += ` AND (mh.platform = $${paramCount} OR mh.platform IS NULL)`;
      params.push(platform);
      paramCount++;
    }

    if (hashtagId) {
      query += ` AND mh.id = $${paramCount}`;
      params.push(hashtagId);
      paramCount++;
    }

    if (startDate) {
      query += ` AND p.posted_at >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND p.posted_at <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    query += ' GROUP BY mh.id, mh.hashtag, mh.platform ORDER BY match_count DESC, avg_priority_score DESC';

    const result = await pool.query(query, params).catch((error) => {
      logger.error('Hashtag match statistics query error:', error);
      // monitoring_matches 테이블이 없을 수 있으므로 빈 결과 반환
      return { rows: [] };
    });

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    logger.error('Get hashtag match statistics error:', error);
    next(error);
  }
};

/**
 * 키워드 기반 공개 데이터 수집 시작
 */
export const startKeywordBasedCollectionController = async (req, res, next) => {
  try {
    const { platform, intervalMinutes = 60 } = req.body;

    if (!platform) {
      throw new AppError('플랫폼이 필요합니다', 400);
    }

    const job = await startKeywordBasedCollection(platform, intervalMinutes);

    res.json({
      success: true,
      data: {
        platform,
        jobId: job?.id || null,
        message: '키워드 기반 공개 데이터 수집이 시작되었습니다',
      },
    });
  } catch (error) {
    logger.error('Start keyword-based collection error:', error);
    next(error);
  }
};

/**
 * 키워드 기반 공개 데이터 수집 중지
 */
export const stopKeywordBasedCollectionController = async (req, res, next) => {
  try {
    const { platform } = req.params;

    await stopKeywordBasedCollection(platform);

    res.json({
      success: true,
      data: {
        platform,
        message: '키워드 기반 공개 데이터 수집이 중지되었습니다',
      },
    });
  } catch (error) {
    logger.error('Stop keyword-based collection error:', error);
    next(error);
  }
};

/**
 * 모든 플랫폼 키워드 기반 수집 시작
 */
export const startAllKeywordBasedCollectionController = async (req, res, next) => {
  try {
    const { intervalMinutes = 60 } = req.body;

    const results = await startAllKeywordBasedCollection(intervalMinutes);

    res.json({
      success: true,
      data: {
        results,
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
    });
  } catch (error) {
    logger.error('Start all keyword-based collection error:', error);
    next(error);
  }
};

/**
 * 즉시 키워드 기반 수집 실행
 */
export const runKeywordBasedCollectionNowController = async (req, res, next) => {
  try {
    const { platform } = req.body;

    if (!platform) {
      throw new AppError('플랫폼이 필요합니다', 400);
    }

    const job = await runKeywordBasedCollectionNow(platform);

    res.json({
      success: true,
      data: {
        platform,
        jobId: job?.id || null,
        itemsCollected: job?.data?.itemsCollected || null,
        message: '키워드 기반 공개 데이터 수집이 즉시 실행되었습니다',
      },
    });
  } catch (error) {
    logger.error('Run keyword-based collection now error:', error);
    next(error);
  }
};
