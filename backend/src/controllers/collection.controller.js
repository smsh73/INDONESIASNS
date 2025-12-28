import pool from '../config/database.js';
import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';
import { InstagramCollector } from '../collectors/instagram/collector.js';
import { FacebookCollector } from '../collectors/facebook/collector.js';
import { LinkedInCollector } from '../collectors/linkedin/collector.js';
import { TikTokCollector } from '../collectors/tiktok/collector.js';
import { addCollectionJob } from '../services/collection/collectionService.js';
import { validateRequired, validatePlatform, validatePagination } from '../utils/validation.js';

export const getCollectionJobs = async (req, res, next) => {
  try {
    const { page, limit, platform, status } = req.query;
    
    // 페이지네이션 검증
    const { page: validatedPage, limit: validatedLimit } = validatePagination(page, limit);
    const offset = (validatedPage - 1) * validatedLimit;
    
    // 플랫폼 검증
    if (platform) {
      validatePlatform(platform);
    }

    let query = `
      SELECT cj.*, a.username, a.platform
      FROM collection_jobs cj
      LEFT JOIN accounts a ON cj.account_id = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (platform) {
      query += ` AND cj.platform = $${paramCount}`;
      params.push(platform);
      paramCount++;
    }

    if (status) {
      query += ` AND cj.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY cj.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(validatedLimit, offset);

    const result = await pool.query(query, params);

    const totalResult = await pool.query(
      'SELECT COUNT(*) as total FROM collection_jobs WHERE 1=1' + 
      (platform ? ` AND platform = '${platform}'` : '') +
      (status ? ` AND status = '${status}'` : '')
    );

          res.json({
            success: true,
            data: result.rows,
            pagination: {
              page: validatedPage,
              limit: validatedLimit,
              total: parseInt(totalResult.rows[0].total),
              totalPages: Math.ceil(parseInt(totalResult.rows[0].total) / validatedLimit),
            },
          });
  } catch (error) {
    logger.error('Get collection jobs error:', error);
    next(error);
  }
};

export const getCollectionJobById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT cj.*, a.username, a.platform FROM collection_jobs cj LEFT JOIN accounts a ON cj.account_id = a.id WHERE cj.id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('수집 작업을 찾을 수 없습니다', 404);
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Get collection job error:', error);
    next(error);
  }
};

export const createCollectionJob = async (req, res, next) => {
  try {
    const { accountId, jobType = 'posts', platform, keywords = [], hashtags = [] } = req.body;

    logger.info('Create collection job request:', { accountId, jobType, platform, keywordsCount: keywords?.length || 0, hashtagsCount: hashtags?.length || 0 });

    // 필수 필드 검증
    if (!accountId && !platform) {
      throw new AppError('계정 ID 또는 플랫폼이 필요합니다', 400);
    }

    // 플랫폼 검증
    if (platform) {
      validatePlatform(platform);
    }

    // jobType 검증
    const validJobTypes = ['posts', 'mentions', 'reactions', 'public'];
    if (jobType && !validJobTypes.includes(jobType)) {
      throw new AppError(`지원하지 않는 작업 타입입니다: ${jobType}. 지원 타입: ${validJobTypes.join(', ')}`, 400);
    }

    // 키워드/해시태그 배열 검증
    if (keywords && !Array.isArray(keywords)) {
      throw new AppError('키워드는 배열 형식이어야 합니다', 400);
    }
    if (hashtags && !Array.isArray(hashtags)) {
      throw new AppError('해시태그는 배열 형식이어야 합니다', 400);
    }

    // accountId가 없고 platform만 있는 경우, 키워드 기반 공개 수집으로 처리
    if (!accountId && platform) {
      try {
        // 활성 키워드와 해시태그 가져오기
        const { getActiveKeywords, getActiveHashtags } = await import('../services/monitoring/monitoringService.js');
        const activeKeywords = await getActiveKeywords(platform);
        const activeHashtags = await getActiveHashtags(platform);
        
        const keywordList = activeKeywords.map(k => k.keyword);
        const hashtagList = activeHashtags.map(h => h.hashtag);

        logger.info(`Public collection request for ${platform}: keywords=${keywordList.length}, hashtags=${hashtagList.length}`);

        // 키워드나 해시태그가 없어도 수집은 가능하도록 변경 (경고만 표시)
        if (keywordList.length === 0 && hashtagList.length === 0) {
          logger.warn(`No active keywords or hashtags found for platform: ${platform}. Collection will proceed with empty keywords.`);
        }

        // 키워드 기반 공개 수집 시작 (키워드가 없어도 실행)
        const { runKeywordBasedCollectionNow } = await import('../services/monitoring/publicDataCollectionService.js');
        const job = await runKeywordBasedCollectionNow(platform);
        
        // 수집 작업 로그 생성
        const collectionJob = await addCollectionJob({
          accountId: null,
          platform,
          jobType: 'public',
        });

        return res.status(201).json({
          success: true,
          data: collectionJob,
          message: keywordList.length > 0 || hashtagList.length > 0
            ? `키워드 기반 공개 데이터 수집이 시작되었습니다 (키워드: ${keywordList.length}개, 해시태그: ${hashtagList.length}개)`
            : `공개 데이터 수집이 시작되었습니다 (키워드/해시태그 없음)`,
        });
      } catch (publicCollectionError) {
        logger.error('Public collection start error:', publicCollectionError);
        logger.error('Error details:', {
          message: publicCollectionError.message,
          stack: publicCollectionError.stack,
          platform,
          accountId,
        });
        if (publicCollectionError instanceof AppError) {
          throw publicCollectionError;
        }
        throw new AppError('공개 데이터 수집 시작에 실패했습니다: ' + publicCollectionError.message, 500);
      }
    }

    let collector;
    const collectorConfig = {};

    switch (platform) {
      case 'instagram':
        collector = new InstagramCollector(collectorConfig);
        break;
      case 'facebook':
        collector = new FacebookCollector(collectorConfig);
        break;
      case 'linkedin':
        collector = new LinkedInCollector(collectorConfig);
        break;
      case 'tiktok':
        collector = new TikTokCollector(collectorConfig);
        break;
      default:
        throw new AppError('지원하지 않는 플랫폼입니다', 400);
    }

    const job = await addCollectionJob({
      accountId: accountId || null,
      platform,
      jobType: accountId ? jobType : 'public', // 계정 없으면 공개 데이터 수집
    });

    const options = accountId ? {} : { keywords, hashtags };
    collector.startCollection(accountId || null, accountId ? jobType : 'public', options).catch((error) => {
      logger.error('Collection job execution error:', error);
    });

    res.status(201).json({
      success: true,
      data: job,
      message: accountId ? '수집 작업이 시작되었습니다' : '공개 데이터 수집 작업이 시작되었습니다',
    });
  } catch (error) {
    logger.error('Create collection job error:', error);
    next(error);
  }
};

export const updateCollectionJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, errorMessage } = req.body;

    const result = await pool.query(
      `UPDATE collection_jobs 
       SET status = COALESCE($1, status),
           error_message = COALESCE($2, error_message),
           completed_at = CASE WHEN $1 = 'completed' OR $1 = 'failed' THEN NOW() ELSE completed_at END
       WHERE id = $3
       RETURNING *`,
      [status, errorMessage, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('수집 작업을 찾을 수 없습니다', 404);
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Update collection job error:', error);
    next(error);
  }
};

