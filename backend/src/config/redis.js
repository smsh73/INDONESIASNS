import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

let redisConfig = {};

// Redis 설정이 있는 경우에만 구성
if (process.env.REDIS_URL || process.env.AZURE_REDIS) {
  if (process.env.AZURE_REDIS && process.env.REDIS_URL) {
    try {
      // Azure Redis의 경우 URL에서 비밀번호를 제거하고 별도로 설정
      const redisUrl = new URL(process.env.REDIS_URL);
      redisConfig = {
        socket: {
          host: redisUrl.hostname,
          port: parseInt(redisUrl.port) || 6380,
          tls: true,
          rejectUnauthorized: false,
        },
        password: process.env.REDIS_PASSWORD || redisUrl.password,
      };
    } catch (error) {
      console.error('Redis URL 파싱 오류:', error);
      redisConfig = null;
    }
  } else if (process.env.REDIS_URL) {
    redisConfig = {
      url: process.env.REDIS_URL,
    };
  }
}

let redisClient = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 5000; // 5초

// Redis 설정이 있고 유효한 경우에만 클라이언트 생성
if (redisConfig && (process.env.REDIS_URL || process.env.AZURE_REDIS)) {
  try {
    // socket 설정이 있는 경우에만 reconnectStrategy 추가
    if (redisConfig.socket) {
      redisConfig.socket = {
        ...redisConfig.socket,
        reconnectStrategy: (retries) => {
          if (retries > MAX_RECONNECT_ATTEMPTS) {
            console.error('Redis 최대 재연결 시도 횟수 초과');
            return new Error('Redis 재연결 실패');
          }
          const delay = Math.min(retries * 1000, RECONNECT_DELAY);
          console.log(`Redis 재연결 시도 ${retries}/${MAX_RECONNECT_ATTEMPTS} (${delay}ms 후)`);
          return delay;
        },
        connectTimeout: 10000,
      };
    } else {
      // URL만 있는 경우 socket 설정 추가
      redisConfig.socket = {
        reconnectStrategy: (retries) => {
          if (retries > MAX_RECONNECT_ATTEMPTS) {
            console.error('Redis 최대 재연결 시도 횟수 초과');
            return new Error('Redis 재연결 실패');
          }
          const delay = Math.min(retries * 1000, RECONNECT_DELAY);
          console.log(`Redis 재연결 시도 ${retries}/${MAX_RECONNECT_ATTEMPTS} (${delay}ms 후)`);
          return delay;
        },
        connectTimeout: 10000,
      };
    }

    redisClient = createClient(redisConfig);

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err.message);
      reconnectAttempts++;
    });

    redisClient.on('connect', () => {
      console.log('Redis Client Connected');
      reconnectAttempts = 0; // 연결 성공 시 재시도 횟수 리셋
    });

    redisClient.on('ready', () => {
      console.log('Redis Client Ready');
    });

    redisClient.on('reconnecting', () => {
      console.log('Redis Client Reconnecting...');
    });

    redisClient.on('end', () => {
      console.log('Redis Client Connection Ended');
    });

    const connectRedis = async () => {
      try {
        if (redisClient && !redisClient.isOpen) {
          await redisClient.connect();
          console.log('Redis 연결 성공');
          reconnectAttempts = 0;
        }
      } catch (error) {
        console.error('Redis connection error:', error.message);
        console.log('Redis 연결 실패 - 서버는 계속 실행됩니다');
        // 연결 실패해도 서버는 계속 실행
      }
    };

    // 비동기로 연결 시도 (서버 시작을 막지 않음)
    connectRedis().catch(err => {
      console.error('Redis 초기 연결 실패:', err.message);
      console.log('Redis 없이 서버를 계속 실행합니다');
    });
  } catch (error) {
    console.error('Redis 클라이언트 생성 실패:', error.message);
    console.log('Redis 없이 서버를 계속 실행합니다');
    redisClient = null;
  }
} else {
  console.log('Redis 설정이 없습니다 - Redis 없이 서버를 실행합니다');
}

export default redisClient;
