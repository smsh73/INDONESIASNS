import { AppError } from '../utils/errors.js';
import logger from '../config/logger.js';

const errorHandler = (err, req, res, next) => {
  // CORS 헤더를 에러 응답에도 포함 (항상 먼저 설정)
  const origin = req.headers.origin;
  const corsOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:3001', 'https://indonesia-sns-frontend.azurewebsites.net'];
  
  const isAllowed = origin && corsOrigins.some(allowedOrigin => {
    const normalizedAllowed = allowedOrigin.replace(/\/$/, '');
    return origin === allowedOrigin || origin === normalizedAllowed || origin.startsWith(normalizedAllowed);
  });
  
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  } else if (!origin) {
    // origin이 없는 경우에도 기본 CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  // 응답이 이미 전송되었는지 확인
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  logger.error('Unhandled error:', err);
  logger.error('Error stack:', err.stack);

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message }),
  });
};

export default errorHandler;

