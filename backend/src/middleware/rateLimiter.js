import rateLimit from 'express-rate-limit';

// 커스텀 keyGenerator - Azure App Service의 프록시를 고려
const keyGenerator = (req) => {
  // X-Forwarded-For 헤더가 있으면 사용, 없으면 req.ip 사용
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
};

export const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyGenerator, // 커스텀 keyGenerator 사용
  skip: (req) => {
    // OPTIONS 요청은 rate limit에서 제외
    return req.method === 'OPTIONS';
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: '로그인 시도 횟수를 초과했습니다. 15분 후 다시 시도해주세요.',
  skipSuccessfulRequests: true,
  keyGenerator: keyGenerator, // 커스텀 keyGenerator 사용
  skip: (req) => {
    // OPTIONS 요청은 rate limit에서 제외
    return req.method === 'OPTIONS';
  },
});

