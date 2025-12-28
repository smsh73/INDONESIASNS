/**
 * 요청 검증 미들웨어
 */

import { validateRequired, validatePlatform, validatePagination, validateId } from '../utils/validation.js';
import { AppError } from '../utils/errors.js';

/**
 * 요청 본문 검증 미들웨어 생성
 */
export const validateBody = (schema) => {
  return (req, res, next) => {
    try {
      for (const [field, rules] of Object.entries(schema)) {
        const value = req.body[field];

        // 필수 필드 검증
        if (rules.required && (value === undefined || value === null || value === '')) {
          throw new AppError(`${rules.label || field}은(는) 필수입니다`, 400);
        }

        // 타입 검증
        if (value !== undefined && value !== null && rules.type) {
          if (rules.type === 'array' && !Array.isArray(value)) {
            throw new AppError(`${rules.label || field}은(는) 배열이어야 합니다`, 400);
          }
          if (rules.type === 'string' && typeof value !== 'string') {
            throw new AppError(`${rules.label || field}은(는) 문자열이어야 합니다`, 400);
          }
          if (rules.type === 'number' && typeof value !== 'number' && isNaN(value)) {
            throw new AppError(`${rules.label || field}은(는) 숫자여야 합니다`, 400);
          }
          if (rules.type === 'boolean' && typeof value !== 'boolean') {
            throw new AppError(`${rules.label || field}은(는) 불리언이어야 합니다`, 400);
          }
        }

        // 커스텀 검증 함수
        if (value !== undefined && value !== null && rules.validate) {
          rules.validate(value);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * 쿼리 파라미터 검증 미들웨어 생성
 */
export const validateQuery = (schema) => {
  return (req, res, next) => {
    try {
      for (const [field, rules] of Object.entries(schema)) {
        const value = req.query[field];

        // 필수 필드 검증
        if (rules.required && (value === undefined || value === null || value === '')) {
          throw new AppError(`${rules.label || field} 쿼리 파라미터는 필수입니다`, 400);
        }

        // 타입 변환 및 검증
        if (value !== undefined && value !== null) {
          if (rules.type === 'number') {
            const num = parseInt(value);
            if (isNaN(num)) {
              throw new AppError(`${rules.label || field}은(는) 숫자여야 합니다`, 400);
            }
            req.query[field] = num;
          }
          if (rules.type === 'boolean') {
            req.query[field] = value === 'true' || value === true;
          }

          // 커스텀 검증 함수
          if (rules.validate) {
            rules.validate(req.query[field]);
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * 경로 파라미터 검증 미들웨어 생성
 */
export const validateParams = (schema) => {
  return (req, res, next) => {
    try {
      for (const [field, rules] of Object.entries(schema)) {
        const value = req.params[field];

        // 필수 필드 검증
        if (rules.required && (value === undefined || value === null || value === '')) {
          throw new AppError(`${rules.label || field} 경로 파라미터는 필수입니다`, 400);
        }

        // 타입 변환 및 검증
        if (value !== undefined && value !== null) {
          if (rules.type === 'number' || rules.type === 'id') {
            const num = parseInt(value);
            if (isNaN(num) || num < 1) {
              throw new AppError(`유효하지 않은 ${rules.label || field}입니다`, 400);
            }
            req.params[field] = num;
          }

          // 커스텀 검증 함수
          if (rules.validate) {
            rules.validate(req.params[field]);
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

