import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import routes from './routes/index.js';
import { errorHandler } from './utils/errors.js';
import errorHandlerMiddleware from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import logger from './config/logger.js';
// Redis는 선택사항 - 서버 시작을 막지 않음
// 동적 import는 나중에 처리
let redisImportPromise = null;
try {
  redisImportPromise = import('./config/redis.js');
  redisImportPromise.catch(err => {
    console.log('Redis 초기화 실패 - 서버는 계속 실행됩니다:', err.message);
  });
} catch (error) {
  console.log('Redis import 실패 - 서버는 계속 실행됩니다');
}

dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS 설정
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : [
      'http://localhost:3001',
      'https://indonesia-sns-frontend.azurewebsites.net',
    ];

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 8080;

// Azure App Service를 위한 trust proxy 설정
app.set('trust proxy', 1);

// CORS를 가장 먼저 설정 - 모든 요청에 대해
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // OPTIONS 요청 (preflight) 명시적 처리 - 가장 먼저
  if (req.method === 'OPTIONS') {
    // origin이 없거나 허용된 origin인지 확인
    const isAllowed = !origin || corsOrigins.some(allowedOrigin => {
      const normalizedAllowed = allowedOrigin.replace(/\/$/, '');
      return origin === allowedOrigin || origin === normalizedAllowed || origin.startsWith(normalizedAllowed);
    });
    
    if (isAllowed) {
      // CORS 헤더 명시적 설정
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
      res.setHeader('Access-Control-Max-Age', '86400');
      return res.status(204).end();
    } else {
      // 허용되지 않은 origin이어도 CORS 헤더는 반환 (브라우저가 에러를 명확히 표시)
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      return res.status(403).json({ error: 'Not allowed by CORS', origin });
    }
  }
  
  // 일반 요청에 CORS 헤더 추가
  if (origin) {
    const isAllowed = corsOrigins.some(allowedOrigin => {
      const normalizedAllowed = allowedOrigin.replace(/\/$/, '');
      return origin === allowedOrigin || origin === normalizedAllowed || origin.startsWith(normalizedAllowed);
    });
    
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  
  next();
});

// CORS 미들웨어 (이중 보호)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    
    const isAllowed = corsOrigins.some(allowedOrigin => {
      const normalizedAllowed = allowedOrigin.replace(/\/$/, '');
      return origin === allowedOrigin || origin === normalizedAllowed || origin.startsWith(normalizedAllowed);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, true); // 일단 허용 (위에서 처리)
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // CORS와 충돌 방지
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiter는 OPTIONS 요청을 제외 (CORS preflight가 차단되지 않도록)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  return apiLimiter(req, res, next);
});

app.use('/api', routes);

// 404 핸들러
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:3001', 'https://indonesia-sns-frontend.azurewebsites.net'];
  
  const isAllowed = origin && allowedOrigins.some(allowedOrigin => {
    const normalizedAllowed = allowedOrigin.replace(/\/$/, '');
    return origin === allowedOrigin || origin === normalizedAllowed || origin.startsWith(normalizedAllowed);
  });
  
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// 에러 핸들러 (두 개 모두 사용 - 더 구체적인 것부터)
app.use(errorHandlerMiddleware);
app.use(errorHandler);

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });

  socket.on('subscribe:dashboard', () => {
    socket.join('dashboard');
    logger.info(`Client ${socket.id} subscribed to dashboard`);
  });

  socket.on('subscribe:alerts', () => {
    socket.join('alerts');
    logger.info(`Client ${socket.id} subscribed to alerts`);
  });
});

export { io };

httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`CORS origins: ${corsOrigins.join(', ')}`);
});

export default app;
