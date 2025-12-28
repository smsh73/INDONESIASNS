import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/indonesia_sns_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-change-in-production';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379/1';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
