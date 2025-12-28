import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 테스트 설정
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const TEST_USER = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Test1234!',
};

let connectionString = process.env.DATABASE_URL;
let authToken = null;

if (!connectionString) {
  const passwordPath = path.join(__dirname, '..', '..', 'azure', '.postgres-password.txt');
  let postgresPassword;
  try {
    postgresPassword = fs.readFileSync(passwordPath, 'utf8').trim();
  } catch (error) {
    console.error('❌ .postgres-password.txt 파일을 찾을 수 없습니다.');
    process.exit(1);
  }

  const POSTGRES_SERVER = 'indonesia-sns-postgres';
  const POSTGRES_DB = 'indonesia_sns';
  const POSTGRES_ADMIN_USER = 'postgresadmin';
  const POSTGRES_FQDN = `${POSTGRES_SERVER}.postgres.database.azure.com`;

  connectionString = `postgresql://${POSTGRES_ADMIN_USER}:${postgresPassword}@${POSTGRES_FQDN}:5432/${POSTGRES_DB}?sslmode=require`;
}

const results = {
  passed: 0,
  failed: 0,
  errors: [],
  warnings: [],
};

// 테스트 헬퍼 함수
function test(name, fn) {
  return async () => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      results.passed++;
      return true;
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      results.failed++;
      results.errors.push(`${name}: ${error.message}`);
      return false;
    }
  };
}

// API 호출 헬퍼
async function apiCall(method, endpoint, data = null, token = null) {
  const config = {
    method,
    url: `${API_BASE_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
    },
    validateStatus: () => true, // 모든 상태 코드 허용
  };

  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  if (data) {
    config.data = data;
  }

  const response = await axios(config);
  return response;
}

async function runAPITests() {
  console.log('🧪 API 엔드포인트 테스트 시작...\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공\n');

    // 1. 인증 테스트
    console.log('=== 1. 인증 API 테스트 ===\n');

    await test('1.1 로그인 API 존재 확인', async () => {
      const response = await apiCall('POST', '/api/auth/login', {
        username: 'test',
        password: 'test',
      });
      if (response.status === 404) {
        throw new Error('로그인 API가 존재하지 않습니다');
      }
    })();

    await test('1.2 잘못된 자격증명 처리', async () => {
      const response = await apiCall('POST', '/api/auth/login', {
        username: 'invalid',
        password: 'invalid',
      });
      if (response.status !== 401 && response.status !== 400) {
        throw new Error(`예상: 401 또는 400, 실제: ${response.status}`);
      }
    })();

    // 2. 수집 작업 API 테스트
    console.log('\n=== 2. 수집 작업 API 테스트 ===\n');

    await test('2.1 수집 작업 목록 조회 API', async () => {
      const response = await apiCall('GET', '/api/collection/jobs');
      if (response.status === 404) {
        throw new Error('수집 작업 목록 API가 존재하지 않습니다');
      }
      if (response.status === 200 && !response.data.success) {
        throw new Error('응답 형식이 올바르지 않습니다');
      }
    })();

    await test('2.2 잘못된 플랫폼으로 수집 작업 생성', async () => {
      const response = await apiCall('POST', '/api/collection/jobs', {
        platform: 'invalid_platform',
      });
      if (response.status === 200) {
        throw new Error('잘못된 플랫폼이 허용되었습니다');
      }
    })();

    await test('2.3 필수 필드 누락 시 에러 처리', async () => {
      const response = await apiCall('POST', '/api/collection/jobs', {});
      if (response.status === 200) {
        throw new Error('필수 필드 검증이 작동하지 않습니다');
      }
    })();

    // 3. 모니터링 API 테스트
    console.log('\n=== 3. 모니터링 API 테스트 ===\n');

    await test('3.1 키워드 목록 조회 API', async () => {
      const response = await apiCall('GET', '/api/monitoring/keywords');
      if (response.status === 404) {
        throw new Error('키워드 목록 API가 존재하지 않습니다');
      }
    })();

    await test('3.2 해시태그 목록 조회 API', async () => {
      const response = await apiCall('GET', '/api/monitoring/hashtags');
      if (response.status === 404) {
        throw new Error('해시태그 목록 API가 존재하지 않습니다');
      }
    })();

    await test('3.3 플랫폼 필터링 동작 확인', async () => {
      const response = await apiCall('GET', '/api/monitoring/keywords?platform=instagram');
      if (response.status === 200 && response.data.data) {
        // 플랫폼 필터링이 제대로 작동하는지 확인
        const allMatch = response.data.data.every(k => 
          !k.platform || k.platform === 'instagram'
        );
        if (!allMatch) {
          throw new Error('플랫폼 필터링이 제대로 작동하지 않습니다');
        }
      }
    })();

    // 4. 관리자 API 테스트
    console.log('\n=== 4. 관리자 API 테스트 ===\n');

    await test('4.1 키워드 생성 API - 필수 필드 검증', async () => {
      const response = await apiCall('POST', '/api/admin/keywords', {});
      if (response.status === 200) {
        throw new Error('필수 필드 검증이 작동하지 않습니다');
      }
    })();

    await test('4.2 키워드 생성 API - 잘못된 플랫폼', async () => {
      const response = await apiCall('POST', '/api/admin/keywords', {
        keyword: 'test',
        platform: 'invalid',
      });
      if (response.status === 200) {
        throw new Error('플랫폼 검증이 작동하지 않습니다');
      }
    })();

    await test('4.3 키워드 생성 API - 잘못된 우선순위', async () => {
      const response = await apiCall('POST', '/api/admin/keywords', {
        keyword: 'test',
        priority: 200, // 범위를 벗어남
      });
      if (response.status === 200) {
        throw new Error('우선순위 검증이 작동하지 않습니다');
      }
    })();

    await test('4.4 해시태그 생성 API - 잘못된 형식', async () => {
      const response = await apiCall('POST', '/api/admin/hashtags', {
        hashtag: '#test@invalid', // 특수문자 포함
      });
      if (response.status === 200) {
        throw new Error('해시태그 형식 검증이 작동하지 않습니다');
      }
    })();

    // 5. 대시보드 API 테스트
    console.log('\n=== 5. 대시보드 API 테스트 ===\n');

    await test('5.1 대시보드 통계 API', async () => {
      const response = await apiCall('GET', '/api/dashboard/stats');
      if (response.status === 404) {
        throw new Error('대시보드 통계 API가 존재하지 않습니다');
      }
      if (response.status === 200 && !response.data.success) {
        throw new Error('응답 형식이 올바르지 않습니다');
      }
    })();

    await test('5.2 트렌드 데이터 API', async () => {
      const response = await apiCall('GET', '/api/dashboard/trends?days=7');
      if (response.status === 404) {
        throw new Error('트렌드 API가 존재하지 않습니다');
      }
    })();

    await test('5.3 잘못된 날짜 파라미터 처리', async () => {
      const response = await apiCall('GET', '/api/dashboard/trends?days=invalid');
      // 에러가 발생하거나 기본값으로 처리되어야 함
      if (response.status === 500) {
        results.warnings.push('날짜 파라미터 검증이 필요합니다');
      }
    })();

    // 6. 페이지네이션 테스트
    console.log('\n=== 6. 페이지네이션 테스트 ===\n');

    await test('6.1 기본 페이지네이션', async () => {
      const response = await apiCall('GET', '/api/collection/jobs?page=1&limit=10');
      if (response.status === 200 && response.data.pagination) {
        if (!response.data.pagination.page || !response.data.pagination.limit) {
          throw new Error('페이지네이션 정보가 불완전합니다');
        }
      }
    })();

    await test('6.2 잘못된 페이지 번호 처리', async () => {
      const response = await apiCall('GET', '/api/collection/jobs?page=0&limit=10');
      if (response.status === 200) {
        results.warnings.push('페이지 번호 검증이 필요합니다');
      }
    })();

    await test('6.3 잘못된 페이지 크기 처리', async () => {
      const response = await apiCall('GET', '/api/collection/jobs?page=1&limit=10000');
      if (response.status === 200) {
        results.warnings.push('페이지 크기 제한이 필요합니다');
      }
    })();

    // 7. 데이터 검증 테스트
    console.log('\n=== 7. 데이터 검증 테스트 ===\n');

    await test('7.1 데이터베이스에 키워드 존재 확인', async () => {
      const result = await client.query('SELECT COUNT(*) as count FROM monitoring_keywords WHERE is_active = true');
      if (parseInt(result.rows[0].count) === 0) {
        throw new Error('활성 키워드가 없습니다');
      }
    })();

    await test('7.2 데이터베이스에 해시태그 존재 확인', async () => {
      const result = await client.query('SELECT COUNT(*) as count FROM monitoring_hashtags WHERE is_active = true');
      if (parseInt(result.rows[0].count) === 0) {
        throw new Error('활성 해시태그가 없습니다');
      }
    })();

    await test('7.3 데이터베이스에 계정 존재 확인', async () => {
      const result = await client.query('SELECT COUNT(*) as count FROM accounts WHERE is_active = true');
      if (parseInt(result.rows[0].count) === 0) {
        results.warnings.push('활성 계정이 없습니다 (공개 수집만 가능)');
      }
    })();

    await test('7.4 데이터베이스에 포스트 존재 확인', async () => {
      const result = await client.query('SELECT COUNT(*) as count FROM posts');
      if (parseInt(result.rows[0].count) === 0) {
        results.warnings.push('포스트 데이터가 없습니다');
      }
    })();

    // 8. SQL 인젝션 방지 테스트
    console.log('\n=== 8. 보안 테스트 ===\n');

    await test('8.1 SQL 인젝션 시도 - 키워드 검색', async () => {
      const sqlInjection = "'; DROP TABLE posts; --";
      const response = await apiCall('GET', `/api/monitoring/keywords?platform=${encodeURIComponent(sqlInjection)}`);
      // 에러가 발생하거나 안전하게 처리되어야 함
      if (response.status === 500) {
        results.warnings.push('SQL 인젝션 방지가 필요합니다');
      }
    })();

    // 9. CORS 테스트
    console.log('\n=== 9. CORS 테스트 ===\n');

    await test('9.1 CORS 헤더 확인', async () => {
      const response = await apiCall('OPTIONS', '/api/collection/jobs');
      if (!response.headers['access-control-allow-origin']) {
        results.warnings.push('CORS 헤더가 설정되지 않았습니다');
      }
    })();

    // 결과 요약
    console.log('\n=== 테스트 결과 요약 ===\n');
    console.log(`✅ 통과: ${results.passed}개`);
    console.log(`❌ 실패: ${results.failed}개`);
    console.log(`⚠️  경고: ${results.warnings.length}개`);
    console.log(`총 테스트: ${results.passed + results.failed}개\n`);

    if (results.errors.length > 0) {
      console.log('에러 목록:');
      results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      console.log('');
    }

    if (results.warnings.length > 0) {
      console.log('경고 목록:');
      results.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
      console.log('');
    }

    if (results.failed === 0) {
      console.log('🎉 모든 API 테스트 통과!');
      process.exit(0);
    } else {
      console.log('⚠️  일부 테스트 실패');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runAPITests();

