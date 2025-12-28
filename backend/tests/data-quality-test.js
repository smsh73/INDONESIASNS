import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  issues: []
};

function test(name, fn, category = 'Data Quality') {
  testResults.total++;
  return async () => {
    try {
      await fn();
      console.log(`✅ [${category}] ${name}`);
      testResults.passed++;
    } catch (error) {
      console.log(`❌ [${category}] ${name}: ${error.message}`);
      testResults.failed++;
      testResults.issues.push({ category, name, error: error.message });
    }
  };
}

async function runDataQualityTests() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 데이터 품질 검사 시작...\n');
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공\n');

    // ============================================
    // 1. 데이터 완전성 검사
    // ============================================
    console.log('=== 1. 데이터 완전성 검사 ===\n');

    await test('포스트 필수 필드 완전성', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as incomplete
        FROM posts
        WHERE platform IS NULL 
        OR post_id IS NULL 
        OR content IS NULL
      `);
      if (parseInt(result.rows[0].incomplete) > 0) {
        throw new Error(`불완전한 포스트 데이터: ${result.rows[0].incomplete}개`);
      }
    }, 'Completeness')();

    await test('키워드 필수 필드 완전성', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as incomplete
        FROM monitoring_keywords
        WHERE keyword IS NULL 
        OR keyword = ''
      `);
      if (parseInt(result.rows[0].incomplete) > 0) {
        throw new Error(`불완전한 키워드 데이터: ${result.rows[0].incomplete}개`);
      }
    }, 'Completeness')();

    await test('해시태그 필수 필드 완전성', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as incomplete
        FROM monitoring_hashtags
        WHERE hashtag IS NULL 
        OR hashtag = ''
      `);
      if (parseInt(result.rows[0].incomplete) > 0) {
        throw new Error(`불완전한 해시태그 데이터: ${result.rows[0].incomplete}개`);
      }
    }, 'Completeness')();

    // ============================================
    // 2. 데이터 일관성 검사
    // ============================================
    console.log('\n=== 2. 데이터 일관성 검사 ===\n');

    await test('포스트 플랫폼 일관성', async () => {
      const result = await client.query(`
        SELECT p.id, p.platform, a.platform as account_platform
        FROM posts p
        INNER JOIN accounts a ON p.account_id = a.id
        WHERE p.platform != a.platform
        LIMIT 10
      `);
      if (result.rows.length > 0) {
        throw new Error(`포스트와 계정의 플랫폼 불일치: ${result.rows.length}개`);
      }
    }, 'Consistency')();

    await test('포스트 날짜 일관성', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as invalid
        FROM posts
        WHERE posted_at > CURRENT_TIMESTAMP
        OR (posted_at IS NOT NULL AND posted_at < '2000-01-01'::timestamp)
      `);
      if (parseInt(result.rows[0].invalid) > 0) {
        throw new Error(`유효하지 않은 포스트 날짜: ${result.rows[0].invalid}개`);
      }
    }, 'Consistency')();

    await test('카운트 필드 일관성', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as invalid
        FROM posts
        WHERE like_count < 0 
        OR comment_count < 0 
        OR share_count < 0 
        OR view_count < 0
      `);
      if (parseInt(result.rows[0].invalid) > 0) {
        throw new Error(`음수 카운트 필드: ${result.rows[0].invalid}개`);
      }
    }, 'Consistency')();

    // ============================================
    // 3. 데이터 정확성 검사
    // ============================================
    console.log('\n=== 3. 데이터 정확성 검사 ===\n');

    await test('해시태그 형식 정확성', async () => {
      const result = await client.query(`
        SELECT id, hashtag
        FROM monitoring_hashtags
        WHERE hashtag NOT LIKE '#%'
        AND hashtag != ''
        LIMIT 10
      `);
      if (result.rows.length > 0) {
        const examples = result.rows.map(r => r.hashtag).join(', ');
        throw new Error(`해시태그 형식 오류 (예: ${examples})`);
      }
    }, 'Accuracy')();

    await test('키워드 타입 정확성', async () => {
      const result = await client.query(`
        SELECT id, keyword, keyword_type
        FROM monitoring_keywords
        WHERE keyword_type IS NOT NULL
        AND keyword_type NOT IN ('region', 'organization', 'person', 'product', 'event', 'other')
        LIMIT 10
      `);
      if (result.rows.length > 0) {
        throw new Error(`유효하지 않은 키워드 타입: ${result.rows.length}개`);
      }
    }, 'Accuracy')();

    await test('플랫폼 값 정확성', async () => {
      const result = await client.query(`
        SELECT DISTINCT platform
        FROM posts
        WHERE platform IS NOT NULL
        AND platform NOT IN ('instagram', 'facebook', 'linkedin', 'whatsapp', 'tiktok')
      `);
      if (result.rows.length > 0) {
        const invalid = result.rows.map(r => r.platform).join(', ');
        throw new Error(`유효하지 않은 플랫폼 값: ${invalid}`);
      }
    }, 'Accuracy')();

    // ============================================
    // 4. 데이터 중복 검사
    // ============================================
    console.log('\n=== 4. 데이터 중복 검사 ===\n');

    await test('포스트 ID 중복', async () => {
      const result = await client.query(`
        SELECT post_id, COUNT(*) as count
        FROM posts
        GROUP BY post_id
        HAVING COUNT(*) > 1
        LIMIT 10
      `);
      if (result.rows.length > 0) {
        throw new Error(`중복된 포스트 ID: ${result.rows.length}개`);
      }
    }, 'Duplication')();

    await test('키워드 중복 (플랫폼별)', async () => {
      const result = await client.query(`
        SELECT keyword, COALESCE(platform, 'NULL') as platform, COUNT(*) as count
        FROM monitoring_keywords
        GROUP BY keyword, platform
        HAVING COUNT(*) > 1
        LIMIT 10
      `);
      if (result.rows.length > 0) {
        throw new Error(`중복된 키워드: ${result.rows.length}개`);
      }
    }, 'Duplication')();

    // ============================================
    // 5. 데이터 관계 검사
    // ============================================
    console.log('\n=== 5. 데이터 관계 검사 ===\n');

    await test('포스트-계정 관계', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as orphaned
        FROM posts p
        WHERE p.account_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = p.account_id)
      `);
      if (parseInt(result.rows[0].orphaned) > 0) {
        throw new Error(`고아 포스트 (계정 없음): ${result.rows[0].orphaned}개`);
      }
    }, 'Relationships')();

    await test('포스트-위치 관계', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as orphaned
        FROM posts p
        WHERE p.location_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM locations l WHERE l.id = p.location_id)
      `);
      if (parseInt(result.rows[0].orphaned) > 0) {
        throw new Error(`고아 포스트 (위치 없음): ${result.rows[0].orphaned}개`);
      }
    }, 'Relationships')();

    await test('위치-지역 관계', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as orphaned
        FROM locations l
        WHERE l.region_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM regions r WHERE r.id = l.region_id)
      `);
      if (parseInt(result.rows[0].orphaned) > 0) {
        throw new Error(`고아 위치 (지역 없음): ${result.rows[0].orphaned}개`);
      }
    }, 'Relationships')();

    // ============================================
    // 6. 데이터 통계 검증
    // ============================================
    console.log('\n=== 6. 데이터 통계 검증 ===\n');

    await test('포스트 통계 일관성', async () => {
      const directCount = await client.query('SELECT COUNT(*) as count FROM posts');
      const platformSum = await client.query(`
        SELECT SUM(platform_count) as total
        FROM (
          SELECT platform, COUNT(*) as platform_count
          FROM posts
          GROUP BY platform
        ) sub
      `);
      
      const direct = parseInt(directCount.rows[0].count);
      const sum = parseInt(platformSum.rows[0].total || 0);
      
      if (direct !== sum) {
        throw new Error(`포스트 개수 불일치: 직접 조회=${direct}, 합계=${sum}`);
      }
    }, 'Statistics')();

    await test('활성 키워드 비율', async () => {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active
        FROM monitoring_keywords
      `);
      const total = parseInt(result.rows[0].total);
      const active = parseInt(result.rows[0].active);
      
      if (total > 0 && active === 0) {
        throw new Error('활성 키워드가 없습니다');
      }
    }, 'Statistics')();

    // 결과 요약
    console.log('\n=== 데이터 품질 검사 결과 ===\n');
    console.log(`총 검사: ${testResults.total}개`);
    console.log(`✅ 통과: ${testResults.passed}개`);
    console.log(`❌ 실패: ${testResults.failed}개\n`);

    if (testResults.issues.length > 0) {
      console.log('발견된 이슈:');
      testResults.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. [${issue.category}] ${issue.name}: ${issue.error}`);
      });
      console.log('');
    }

    if (testResults.failed === 0) {
      console.log('🎉 모든 데이터 품질 검사 통과!');
      process.exit(0);
    } else {
      console.log('⚠️  일부 데이터 품질 이슈 발견');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ 검사 중 오류:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runDataQualityTests();

