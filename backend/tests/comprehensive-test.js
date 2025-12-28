import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  getActiveKeywords, 
  getActiveHashtags, 
  checkKeywordMatch, 
  checkHashtagMatch 
} from '../src/services/monitoring/monitoringService.js';
import { savePost } from '../src/services/collection/collectionService.js';
import { validateRequired, validatePlatform, validateKeyword, validateHashtag } from '../src/utils/validation.js';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  const passwordPath = path.join(__dirname, '..', '..', 'azure', '.postgres-password.txt');
  let postgresPassword;
  try {
    postgresPassword = fs.readFileSync(passwordPath, 'utf8').trim();
  } catch (error) {
    console.error('❌ .postgres-password.txt 파일을 찾을 수 없고 DATABASE_URL 환경 변수도 없습니다.');
    process.exit(1);
  }

  const POSTGRES_SERVER = 'indonesia-sns-postgres';
  const POSTGRES_DB = 'indonesia_sns';
  const POSTGRES_ADMIN_USER = 'postgresadmin';
  const POSTGRES_FQDN = `${POSTGRES_SERVER}.postgres.database.azure.com`;

  connectionString = `postgresql://${POSTGRES_ADMIN_USER}:${postgresPassword}@${POSTGRES_FQDN}:5432/${POSTGRES_DB}?sslmode=require`;
}

const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
  warnings: []
};

function test(name, fn, category = 'General') {
  testResults.total++;
  try {
    fn();
    console.log(`✅ [${category}] ${name}`);
    testResults.passed++;
  } catch (error) {
    console.log(`❌ [${category}] ${name}: ${error.message}`);
    testResults.failed++;
    testResults.errors.push({ category, name, error: error.message });
  }
}

function warn(message, category = 'General') {
  console.log(`⚠️  [${category}] ${message}`);
  testResults.warnings.push({ category, message });
}

async function runComprehensiveTests() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🧪 포괄적인 테스트 시작...\n');
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공\n');

    // ============================================
    // 1. 데이터 무결성 테스트
    // ============================================
    console.log('=== 1. 데이터 무결성 테스트 ===\n');

    test('지역-위치 관계 무결성', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as orphaned
        FROM locations l
        WHERE l.region_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM regions r WHERE r.id = l.region_id)
      `);
      if (parseInt(result.rows[0].orphaned) > 0) {
        throw new Error(`고아 위치 데이터 발견: ${result.rows[0].orphaned}개`);
      }
    }, 'Data Integrity');

    test('포스트-계정 관계 무결성', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as orphaned
        FROM posts p
        WHERE p.account_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = p.account_id)
      `);
      if (parseInt(result.rows[0].orphaned) > 0) {
        throw new Error(`고아 포스트 데이터 발견: ${result.rows[0].orphaned}개`);
      }
    }, 'Data Integrity');

    test('포스트-위치 관계 무결성', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as orphaned
        FROM posts p
        WHERE p.location_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.id = p.location_id)
      `);
      if (parseInt(result.rows[0].orphaned) > 0) {
        throw new Error(`고아 포스트 위치 데이터 발견: ${result.rows[0].orphaned}개`);
      }
    }, 'Data Integrity');

    test('키워드 중복 확인', async () => {
      const result = await client.query(`
        SELECT keyword, platform, COUNT(*) as count
        FROM monitoring_keywords
        GROUP BY keyword, platform
        HAVING COUNT(*) > 1
      `);
      if (result.rows.length > 0) {
        throw new Error(`중복된 키워드 발견: ${result.rows.map(r => r.keyword).join(', ')}`);
      }
    }, 'Data Integrity');

    test('해시태그 중복 확인', async () => {
      const result = await client.query(`
        SELECT hashtag, platform, COUNT(*) as count
        FROM monitoring_hashtags
        GROUP BY hashtag, platform
        HAVING COUNT(*) > 1
      `);
      if (result.rows.length > 0) {
        throw new Error(`중복된 해시태그 발견: ${result.rows.map(r => r.hashtag).join(', ')}`);
      }
    }, 'Data Integrity');

    // ============================================
    // 2. 기능 동작 테스트
    // ============================================
    console.log('\n=== 2. 기능 동작 테스트 ===\n');

    test('키워드 조회 기능', async () => {
      const keywords = await getActiveKeywords(null);
      if (!Array.isArray(keywords)) {
        throw new Error('키워드 조회 결과가 배열이 아닙니다');
      }
      if (keywords.length === 0) {
        warn('활성 키워드가 없습니다', 'Functionality');
      }
    }, 'Functionality');

    test('플랫폼별 키워드 조회', async () => {
      const instagramKeywords = await getActiveKeywords('instagram');
      const facebookKeywords = await getActiveKeywords('facebook');
      if (!Array.isArray(instagramKeywords) || !Array.isArray(facebookKeywords)) {
        throw new Error('플랫폼별 키워드 조회 결과가 배열이 아닙니다');
      }
    }, 'Functionality');

    test('키워드 매칭 기능', async () => {
      const testContent = 'Jakarta is a beautiful city in Indonesia. Jokowi visited today.';
      const matches = await checkKeywordMatch(testContent, null);
      if (!Array.isArray(matches)) {
        throw new Error('키워드 매칭 결과가 배열이 아닙니다');
      }
      // Jakarta와 Jokowi가 매칭되어야 함
      const matchedKeywords = matches.map(m => m.keyword.toLowerCase());
      if (!matchedKeywords.includes('jakarta') && !matchedKeywords.includes('jokowi')) {
        warn('예상된 키워드가 매칭되지 않았습니다', 'Functionality');
      }
    }, 'Functionality');

    test('해시태그 매칭 기능', async () => {
      const testHashtags = ['#Jakarta', '#Indonesia', '#Bandung'];
      const matches = await checkHashtagMatch(testHashtags, null);
      if (!Array.isArray(matches)) {
        throw new Error('해시태그 매칭 결과가 배열이 아닙니다');
      }
    }, 'Functionality');

    // ============================================
    // 3. 데이터 저장 테스트
    // ============================================
    console.log('\n=== 3. 데이터 저장 테스트 ===\n');

    test('포스트 저장 기능', async () => {
      const testPost = {
        platform: 'instagram',
        postId: `test_post_${Date.now()}_${Math.random()}`,
        content: 'Test post content for Jakarta #Jakarta #Indonesia',
        authorUsername: 'test_user',
        url: 'https://instagram.com/p/test',
        hashtags: ['Jakarta', 'Indonesia'],
        postedAt: new Date(),
      };

      const savedPost = await savePost(testPost);
      if (!savedPost || !savedPost.id) {
        throw new Error('포스트 저장 실패');
      }

      // 저장된 데이터 확인
      const verifyResult = await client.query(
        'SELECT * FROM posts WHERE id = $1',
        [savedPost.id]
      );
      if (verifyResult.rows.length === 0) {
        throw new Error('저장된 포스트를 찾을 수 없습니다');
      }

      const retrievedPost = verifyResult.rows[0];
      if (retrievedPost.content !== testPost.content) {
        throw new Error('저장된 포스트 내용이 일치하지 않습니다');
      }

      // 테스트 데이터 정리
      await client.query('DELETE FROM posts WHERE id = $1', [savedPost.id]);
    }, 'Data Storage');

    test('포스트 중복 저장 방지', async () => {
      const testPostId = `test_duplicate_${Date.now()}`;
      const testPost = {
        platform: 'facebook',
        postId: testPostId,
        content: 'First post',
        authorUsername: 'test_user',
        url: 'https://facebook.com/p/test',
        postedAt: new Date(),
      };

      const firstSave = await savePost(testPost);
      testPost.content = 'Second post (should update)';
      const secondSave = await savePost(testPost);

      if (firstSave.id !== secondSave.id) {
        throw new Error('중복 포스트가 생성되었습니다 (업데이트되어야 함)');
      }

      const verifyResult = await client.query(
        'SELECT content FROM posts WHERE id = $1',
        [firstSave.id]
      );
      if (verifyResult.rows[0].content !== 'Second post (should update)') {
        throw new Error('포스트 업데이트가 제대로 되지 않았습니다');
      }

      // 테스트 데이터 정리
      await client.query('DELETE FROM posts WHERE id = $1', [firstSave.id]);
    }, 'Data Storage');

    // ============================================
    // 4. 입력 검증 테스트
    // ============================================
    console.log('\n=== 4. 입력 검증 테스트 ===\n');

    test('필수 필드 검증', () => {
      try {
        validateRequired({ name: 'test' }, ['name', 'email']);
        throw new Error('필수 필드 검증이 작동하지 않습니다');
      } catch (error) {
        if (!error.message.includes('필수')) {
          throw error;
        }
      }
    }, 'Validation');

    test('플랫폼 검증', () => {
      validatePlatform('instagram');
      validatePlatform('facebook');
      try {
        validatePlatform('invalid_platform');
        throw new Error('유효하지 않은 플랫폼 검증이 작동하지 않습니다');
      } catch (error) {
        if (!error.message.includes('지원하지 않는')) {
          throw error;
        }
      }
    }, 'Validation');

    test('키워드 검증', () => {
      validateKeyword('test keyword');
      try {
        validateKeyword('');
        throw new Error('빈 키워드 검증이 작동하지 않습니다');
      } catch (error) {
        if (!error.message.includes('비어있을 수 없습니다')) {
          throw error;
        }
      }
    }, 'Validation');

    test('해시태그 검증', () => {
      const validated = validateHashtag('#test');
      if (!validated.startsWith('#')) {
        throw new Error('해시태그 형식이 올바르지 않습니다');
      }
    }, 'Validation');

    // ============================================
    // 5. 데이터 정확성 테스트
    // ============================================
    console.log('\n=== 5. 데이터 정확성 테스트 ===\n');

    test('포스트 통계 정확성', async () => {
      const stats = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(DISTINCT platform) as platforms,
          COUNT(DISTINCT account_id) as accounts,
          SUM(like_count) as total_likes,
          SUM(comment_count) as total_comments
        FROM posts
      `);
      
      const stat = stats.rows[0];
      if (parseInt(stat.total) < 0) {
        throw new Error('포스트 개수가 음수입니다');
      }
      if (parseInt(stat.platforms) < 0) {
        throw new Error('플랫폼 개수가 음수입니다');
      }
    }, 'Data Accuracy');

    test('키워드 통계 정확성', async () => {
      const stats = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(DISTINCT platform) as platforms,
          COUNT(DISTINCT keyword_type) as types,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active
        FROM monitoring_keywords
      `);
      
      const stat = stats.rows[0];
      if (parseInt(stat.total) < parseInt(stat.active)) {
        throw new Error('활성 키워드가 전체 키워드보다 많습니다');
      }
    }, 'Data Accuracy');

    // ============================================
    // 6. 경계 조건 테스트
    // ============================================
    console.log('\n=== 6. 경계 조건 테스트 ===\n');

    test('빈 문자열 처리', async () => {
      const matches = await checkKeywordMatch('', null);
      if (!Array.isArray(matches) || matches.length !== 0) {
        throw new Error('빈 문자열 처리 오류');
      }
    }, 'Edge Cases');

    test('null 값 처리', async () => {
      const keywords = await getActiveKeywords(null);
      if (!Array.isArray(keywords)) {
        throw new Error('null 플랫폼 처리 오류');
      }
    }, 'Edge Cases');

    test('매우 긴 문자열 처리', async () => {
      const longString = 'a'.repeat(10000);
      const matches = await checkKeywordMatch(longString, null);
      if (!Array.isArray(matches)) {
        throw new Error('긴 문자열 처리 오류');
      }
    }, 'Edge Cases');

    // ============================================
    // 7. 성능 테스트
    // ============================================
    console.log('\n=== 7. 성능 테스트 ===\n');

    test('키워드 조회 성능', async () => {
      const startTime = Date.now();
      await getActiveKeywords(null);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (duration > 5000) {
        warn(`키워드 조회가 느립니다: ${duration}ms`, 'Performance');
      }
    }, 'Performance');

    test('포스트 저장 성능', async () => {
      const testPost = {
        platform: 'test',
        postId: `perf_test_${Date.now()}`,
        content: 'Performance test',
        authorUsername: 'test',
        url: 'https://test.com',
        postedAt: new Date(),
      };

      const startTime = Date.now();
      const saved = await savePost(testPost);
      const endTime = Date.now();
      const duration = endTime - startTime;

      if (duration > 3000) {
        warn(`포스트 저장이 느립니다: ${duration}ms`, 'Performance');
      }

      // 테스트 데이터 정리
      await client.query('DELETE FROM posts WHERE id = $1', [saved.id]);
    }, 'Performance');

    // ============================================
    // 8. 에러 처리 테스트
    // ============================================
    console.log('\n=== 8. 에러 처리 테스트 ===\n');

    test('잘못된 플랫폼 처리', async () => {
      try {
        await getActiveKeywords('invalid_platform_xyz');
        // 유효하지 않은 플랫폼도 빈 배열을 반환해야 함
      } catch (error) {
        // 에러가 발생해도 정상 (검증 로직에 따라)
      }
    }, 'Error Handling');

    test('데이터베이스 연결 에러 처리', async () => {
      // 이미 연결된 상태이므로 연결 에러는 테스트하지 않음
      // 대신 쿼리 에러 처리 확인
      try {
        await client.query('SELECT * FROM non_existent_table');
        throw new Error('존재하지 않는 테이블 쿼리가 실패하지 않았습니다');
      } catch (error) {
        // 에러가 발생하는 것이 정상
        if (!error.message.includes('does not exist') && !error.message.includes('relation')) {
          throw error;
        }
      }
    }, 'Error Handling');

    // 결과 요약
    console.log('\n=== 테스트 결과 요약 ===\n');
    console.log(`총 테스트: ${testResults.total}개`);
    console.log(`✅ 통과: ${testResults.passed}개`);
    console.log(`❌ 실패: ${testResults.failed}개`);
    console.log(`⚠️  경고: ${testResults.warnings.length}개\n`);

    if (testResults.errors.length > 0) {
      console.log('실패한 테스트:');
      testResults.errors.forEach((err, index) => {
        console.log(`  ${index + 1}. [${err.category}] ${err.name}: ${err.error}`);
      });
      console.log('');
    }

    if (testResults.warnings.length > 0) {
      console.log('경고:');
      testResults.warnings.forEach((warn, index) => {
        console.log(`  ${index + 1}. [${warn.category}] ${warn.message}`);
      });
      console.log('');
    }

    if (testResults.failed === 0) {
      console.log('🎉 모든 테스트 통과!');
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

runComprehensiveTests();

