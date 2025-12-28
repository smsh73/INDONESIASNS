import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
};

if (process.env.AZURE_REDIS) {
  redisConfig.socket = {
    tls: true,
    rejectUnauthorized: false,
  };
  redisConfig.password = process.env.REDIS_PASSWORD;
}

const redisClient = createClient(redisConfig);

redisClient.on('error', (err) => {
  console.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
  console.log('Redis Client Connected');
});

const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    console.error('Redis connection error:', error);
  }
};

connectRedis();

export default redisClient;

