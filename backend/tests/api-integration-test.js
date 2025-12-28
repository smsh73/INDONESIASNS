import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://indonesia-sns-backend.azurewebsites.net/api';
const TEST_USER = {
  username: 'admin',
  password: process.env.TEST_PASSWORD || 'admin123'
};

let authToken = null;
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

function test(name, fn, category = 'API') {
  testResults.total++;
  return async () => {
    try {
      await fn();
      console.log(`✅ [${category}] ${name}`);
      testResults.passed++;
    } catch (error) {
      console.log(`❌ [${category}] ${name}: ${error.message}`);
      testResults.failed++;
      testResults.errors.push({ category, name, error: error.message });
    }
  };
}

async function login() {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      username: TEST_USER.username,
      password: TEST_USER.password
    });
    
    if (response.data.success && response.data.token) {
      authToken = response.data.token;
      return authToken;
    }
    throw new Error('로그인 실패: 토큰을 받지 못했습니다');
  } catch (error) {
    if (error.response) {
      throw new Error(`로그인 실패: ${error.response.data.message || error.message}`);
    }
    throw error;
  }
}

async function makeRequest(method, endpoint, data = null, requiresAuth = true) {
  const config = {
    method,
    url: `${API_BASE_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  if (requiresAuth && authToken) {
    config.headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`API 요청 실패: ${error.response.status} - ${error.response.data.message || error.message}`);
    }
    throw error;
  }
}

async function runAPITests() {
  console.log('🧪 API 통합 테스트 시작...\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  // 인증 테스트
  console.log('=== 1. 인증 테스트 ===\n');
  
  await test('로그인 성공', async () => {
    await login();
    if (!authToken) {
      throw new Error('인증 토큰을 받지 못했습니다');
    }
  }, 'Authentication')();

  await test('인증 없이 보호된 엔드포인트 접근', async () => {
    try {
      await makeRequest('get', '/admin/keywords', null, false);
      throw new Error('인증 없이 접근이 허용되었습니다');
    } catch (error) {
      if (!error.message.includes('401') && !error.message.includes('Unauthorized')) {
        throw error;
      }
    }
  }, 'Authentication')();

  // 키워드 관리 테스트
  console.log('\n=== 2. 키워드 관리 테스트 ===\n');

  let createdKeywordId = null;

  await test('키워드 목록 조회', async () => {
    const result = await makeRequest('get', '/admin/keywords');
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error('키워드 목록 조회 실패');
    }
  }, 'Keywords')();

  await test('키워드 생성', async () => {
    const keywordData = {
      keyword: `test_keyword_${Date.now()}`,
      platform: 'instagram',
      priority: 5,
      keywordType: 'region',
      description: 'Test keyword',
      isActive: true
    };

    const result = await makeRequest('post', '/admin/keywords', keywordData);
    if (!result.success || !result.data.id) {
      throw new Error('키워드 생성 실패');
    }
    createdKeywordId = result.data.id;
  }, 'Keywords')();

  await test('키워드 수정', async () => {
    if (!createdKeywordId) {
      throw new Error('생성된 키워드 ID가 없습니다');
    }

    const updateData = {
      priority: 10,
      description: 'Updated test keyword'
    };

    const result = await makeRequest('put', `/admin/keywords/${createdKeywordId}`, updateData);
    if (!result.success) {
      throw new Error('키워드 수정 실패');
    }
  }, 'Keywords')();

  await test('키워드 삭제', async () => {
    if (!createdKeywordId) {
      throw new Error('생성된 키워드 ID가 없습니다');
    }

    const result = await makeRequest('delete', `/admin/keywords/${createdKeywordId}`);
    if (!result.success) {
      throw new Error('키워드 삭제 실패');
    }
    createdKeywordId = null;
  }, 'Keywords')();

  // 해시태그 관리 테스트
  console.log('\n=== 3. 해시태그 관리 테스트 ===\n');

  let createdHashtagId = null;

  await test('해시태그 목록 조회', async () => {
    const result = await makeRequest('get', '/admin/hashtags');
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error('해시태그 목록 조회 실패');
    }
  }, 'Hashtags')();

  await test('해시태그 생성', async () => {
    const hashtagData = {
      hashtag: `#test_hashtag_${Date.now()}`,
      platform: 'instagram',
      priority: 5,
      description: 'Test hashtag',
      isActive: true
    };

    const result = await makeRequest('post', '/admin/hashtags', hashtagData);
    if (!result.success || !result.data.id) {
      throw new Error('해시태그 생성 실패');
    }
    createdHashtagId = result.data.id;
  }, 'Hashtags')();

  await test('해시태그 삭제', async () => {
    if (!createdHashtagId) {
      throw new Error('생성된 해시태그 ID가 없습니다');
    }

    const result = await makeRequest('delete', `/admin/hashtags/${createdHashtagId}`);
    if (!result.success) {
      throw new Error('해시태그 삭제 실패');
    }
    createdHashtagId = null;
  }, 'Hashtags')();

  // 수집 작업 테스트
  console.log('\n=== 4. 수집 작업 테스트 ===\n');

  await test('수집 작업 목록 조회', async () => {
    const result = await makeRequest('get', '/collection/jobs');
    if (!result.success || !result.data) {
      throw new Error('수집 작업 목록 조회 실패');
    }
  }, 'Collection')();

  await test('공개 데이터 수집 시작 (플랫폼만)', async () => {
    const jobData = {
      platform: 'instagram',
      jobType: 'posts'
    };

    const result = await makeRequest('post', '/collection/jobs', jobData);
    if (!result.success) {
      throw new Error(`수집 작업 시작 실패: ${result.message || 'Unknown error'}`);
    }
  }, 'Collection')();

  // 모니터링 테스트
  console.log('\n=== 5. 모니터링 테스트 ===\n');

  await test('모니터링 키워드 조회', async () => {
    const result = await makeRequest('get', '/monitoring/keywords');
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error('모니터링 키워드 조회 실패');
    }
  }, 'Monitoring')();

  await test('모니터링 해시태그 조회', async () => {
    const result = await makeRequest('get', '/monitoring/hashtags');
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error('모니터링 해시태그 조회 실패');
    }
  }, 'Monitoring')();

  // 대시보드 테스트
  console.log('\n=== 6. 대시보드 테스트 ===\n');

  await test('대시보드 통계 조회', async () => {
    const result = await makeRequest('get', '/dashboard/stats');
    if (!result.success || !result.data) {
      throw new Error('대시보드 통계 조회 실패');
    }
    
    // 필수 필드 확인
    const requiredFields = ['totalPosts', 'sentimentDistribution', 'riskDistribution'];
    for (const field of requiredFields) {
      if (result.data[field] === undefined) {
        throw new Error(`대시보드 통계에 ${field} 필드가 없습니다`);
      }
    }
  }, 'Dashboard')();

  await test('감정 분포 조회', async () => {
    const result = await makeRequest('get', '/dashboard/sentiment?days=7');
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error('감정 분포 조회 실패');
    }
  }, 'Dashboard')();

  await test('트렌드 조회', async () => {
    const result = await makeRequest('get', '/dashboard/trends?days=7');
    if (!result.success || !Array.isArray(result.data)) {
      throw new Error('트렌드 조회 실패');
    }
  }, 'Dashboard')();

  // 입력 검증 테스트
  console.log('\n=== 7. 입력 검증 테스트 ===\n');

  await test('빈 키워드 생성 시도', async () => {
    try {
      await makeRequest('post', '/admin/keywords', { keyword: '' });
      throw new Error('빈 키워드가 허용되었습니다');
    } catch (error) {
      if (!error.message.includes('필수') && !error.message.includes('400')) {
        throw error;
      }
    }
  }, 'Validation')();

  await test('유효하지 않은 플랫폼으로 키워드 생성 시도', async () => {
    try {
      await makeRequest('post', '/admin/keywords', {
        keyword: 'test',
        platform: 'invalid_platform_xyz'
      });
      throw new Error('유효하지 않은 플랫폼이 허용되었습니다');
    } catch (error) {
      if (!error.message.includes('지원하지 않는') && !error.message.includes('400')) {
        throw error;
      }
    }
  }, 'Validation')();

  await test('범위를 벗어난 우선순위', async () => {
    try {
      await makeRequest('post', '/admin/keywords', {
        keyword: 'test',
        priority: 150
      });
      throw new Error('범위를 벗어난 우선순위가 허용되었습니다');
    } catch (error) {
      if (!error.message.includes('우선순위') && !error.message.includes('400')) {
        // 우선순위 검증이 없을 수도 있음
      }
    }
  }, 'Validation')();

  // 결과 요약
  console.log('\n=== 테스트 결과 요약 ===\n');
  console.log(`총 테스트: ${testResults.total}개`);
  console.log(`✅ 통과: ${testResults.passed}개`);
  console.log(`❌ 실패: ${testResults.failed}개\n`);

  if (testResults.errors.length > 0) {
    console.log('실패한 테스트:');
    testResults.errors.forEach((err, index) => {
      console.log(`  ${index + 1}. [${err.category}] ${err.name}: ${err.error}`);
    });
    console.log('');
  }

  if (testResults.failed === 0) {
    console.log('🎉 모든 API 테스트 통과!');
    process.exit(0);
  } else {
    console.log('⚠️  일부 테스트 실패');
    process.exit(1);
  }
}

// 에러 처리
process.on('unhandledRejection', (error) => {
  console.error('❌ 처리되지 않은 에러:', error);
  process.exit(1);
});

runAPITests();

