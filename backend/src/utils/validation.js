/**
 * 입력 검증 유틸리티
 */

import { AppError } from './errors.js';
import logger from '../config/logger.js';

/**
 * 필수 필드 검증
 */
export const validateRequired = (data, fields, fieldNames = {}) => {
  const missing = [];
  
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(fieldNames[field] || field);
    }
  }
  
  if (missing.length > 0) {
    throw new AppError(`필수 필드가 누락되었습니다: ${missing.join(', ')}`, 400);
  }
};

/**
 * 플랫폼 검증
 */
export const validatePlatform = (platform) => {
  const validPlatforms = ['instagram', 'facebook', 'linkedin', 'whatsapp', 'tiktok'];
  
  if (platform && !validPlatforms.includes(platform.toLowerCase())) {
    throw new AppError(`지원하지 않는 플랫폼입니다: ${platform}. 지원 플랫폼: ${validPlatforms.join(', ')}`, 400);
  }
  
  return platform?.toLowerCase();
};

/**
 * 키워드 타입 검증
 */
export const validateKeywordType = (keywordType) => {
  const validTypes = ['region', 'organization', 'person', 'product', 'event', 'other'];
  
  if (keywordType && !validTypes.includes(keywordType)) {
    throw new AppError(`지원하지 않는 키워드 타입입니다: ${keywordType}. 지원 타입: ${validTypes.join(', ')}`, 400);
  }
  
  return keywordType;
};

/**
 * 우선순위 검증 (0-100)
 */
export const validatePriority = (priority) => {
  const num = parseInt(priority);
  
  if (isNaN(num)) {
    throw new AppError('우선순위는 숫자여야 합니다', 400);
  }
  
  if (num < 0 || num > 100) {
    throw new AppError('우선순위는 0-100 사이의 값이어야 합니다', 400);
  }
  
  return num;
};

/**
 * 이메일 검증
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    throw new AppError('유효하지 않은 이메일 형식입니다', 400);
  }
  
  return email.toLowerCase();
};

/**
 * URL 검증
 */
export const validateURL = (url) => {
  try {
    new URL(url);
    return url;
  } catch (error) {
    throw new AppError('유효하지 않은 URL 형식입니다', 400);
  }
};

/**
 * 페이지네이션 파라미터 검증
 */
export const validatePagination = (page, limit, maxLimit = 100) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  
  if (pageNum < 1) {
    throw new AppError('페이지 번호는 1 이상이어야 합니다', 400);
  }
  
  if (limitNum < 1 || limitNum > maxLimit) {
    throw new AppError(`페이지 크기는 1-${maxLimit} 사이여야 합니다`, 400);
  }
  
  return { page: pageNum, limit: limitNum };
};

/**
 * 날짜 범위 검증
 */
export const validateDateRange = (startDate, endDate) => {
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime())) {
      throw new AppError('유효하지 않은 시작 날짜입니다', 400);
    }
    
    if (isNaN(end.getTime())) {
      throw new AppError('유효하지 않은 종료 날짜입니다', 400);
    }
    
    if (start > end) {
      throw new AppError('시작 날짜는 종료 날짜보다 이전이어야 합니다', 400);
    }
    
    // 최대 1년 범위 제한
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1년
    if (end - start > maxRange) {
      throw new AppError('날짜 범위는 최대 1년입니다', 400);
    }
  }
  
  return { startDate, endDate };
};

/**
 * ID 검증 (양수 정수)
 */
export const validateId = (id, fieldName = 'ID') => {
  const num = parseInt(id);
  
  if (isNaN(num) || num < 1) {
    throw new AppError(`유효하지 않은 ${fieldName}입니다`, 400);
  }
  
  return num;
};

/**
 * 배열 검증
 */
export const validateArray = (arr, minLength = 0, maxLength = null) => {
  if (!Array.isArray(arr)) {
    throw new AppError('배열 형식이 아닙니다', 400);
  }
  
  if (arr.length < minLength) {
    throw new AppError(`최소 ${minLength}개의 항목이 필요합니다`, 400);
  }
  
  if (maxLength !== null && arr.length > maxLength) {
    throw new AppError(`최대 ${maxLength}개의 항목만 허용됩니다`, 400);
  }
  
  return arr;
};

/**
 * JSON 검증
 */
export const validateJSON = (jsonString, fieldName = 'JSON') => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new AppError(`유효하지 않은 ${fieldName} 형식입니다`, 400);
  }
};

/**
 * 문자열 길이 검증
 */
export const validateStringLength = (str, minLength = 0, maxLength = null, fieldName = '문자열') => {
  if (typeof str !== 'string') {
    throw new AppError(`${fieldName}은 문자열이어야 합니다`, 400);
  }
  
  if (str.length < minLength) {
    throw new AppError(`${fieldName}은 최소 ${minLength}자 이상이어야 합니다`, 400);
  }
  
  if (maxLength !== null && str.length > maxLength) {
    throw new AppError(`${fieldName}은 최대 ${maxLength}자까지 허용됩니다`, 400);
  }
  
  return str;
};

/**
 * 해시태그 형식 검증
 */
export const validateHashtag = (hashtag) => {
  const cleaned = hashtag.replace(/^#/, ''); // # 제거
  
  if (!cleaned || cleaned.length === 0) {
    throw new AppError('해시태그는 비어있을 수 없습니다', 400);
  }
  
  if (cleaned.length > 100) {
    throw new AppError('해시태그는 최대 100자까지 허용됩니다', 400);
  }
  
  // 특수 문자 제한
  if (!/^[a-zA-Z0-9가-힣_]+$/.test(cleaned)) {
    throw new AppError('해시태그는 영문, 숫자, 한글, 언더스코어만 허용됩니다', 400);
  }
  
  return `#${cleaned}`;
};

/**
 * 키워드 검증
 */
export const validateKeyword = (keyword) => {
  if (!keyword || keyword.trim().length === 0) {
    throw new AppError('키워드는 비어있을 수 없습니다', 400);
  }
  
  if (keyword.length > 255) {
    throw new AppError('키워드는 최대 255자까지 허용됩니다', 400);
  }
  
  return keyword.trim();
};

