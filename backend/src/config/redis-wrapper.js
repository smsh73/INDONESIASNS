// Redis를 안전하게 import하는 래퍼
let redisClient = null;

try {
  const redisModule = await import('./redis.js');
  redisClient = redisModule.default;
  console.log('Redis 모듈 로드 성공');
} catch (error) {
  console.error('Redis 모듈 로드 실패:', error.message);
  console.log('Redis 없이 서버를 계속 실행합니다');
}

export default redisClient;

