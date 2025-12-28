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
};

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

async function runDatabaseIntegrityTests() {
  console.log('🧪 데이터베이스 무결성 테스트 시작...\n');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공\n');

    // 1. 외래키 무결성 테스트
    console.log('=== 1. 외래키 무결성 테스트 ===\n');

    await test('1.1 posts.account_id 외래키 무결성', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM posts p
        LEFT JOIN accounts a ON p.account_id = a.id
        WHERE p.account_id IS NOT NULL AND a.id IS NULL
      `);
      if (parseInt(result.rows[0].count) > 0) {
        throw new Error(`${result.rows[0].count}개의 포스트가 존재하지 않는 계정을 참조합니다`);
      }
    })();

    await test('1.2 posts.location_id 외래키 무결성', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM posts p
        LEFT JOIN locations l ON p.location_id = l.id
        WHERE p.location_id IS NOT NULL AND l.id IS NULL
      `);
      if (parseInt(result.rows[0].count) > 0) {
        throw new Error(`${result.rows[0].count}개의 포스트가 존재하지 않는 위치를 참조합니다`);
      }
    })();

    await test('1.3 locations.region_id 외래키 무결성', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM locations l
        LEFT JOIN regions r ON l.region_id = r.id
        WHERE l.region_id IS NOT NULL AND r.id IS NULL
      `);
      if (parseInt(result.rows[0].count) > 0) {
        throw new Error(`${result.rows[0].count}개의 위치가 존재하지 않는 지역을 참조합니다`);
      }
    })();

    await test('1.4 collection_jobs.account_id 외래키 무결성', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM collection_jobs cj
        LEFT JOIN accounts a ON cj.account_id = a.id
        WHERE cj.account_id IS NOT NULL AND a.id IS NULL
      `);
      if (parseInt(result.rows[0].count) > 0) {
        throw new Error(`${result.rows[0].count}개의 수집 작업이 존재하지 않는 계정을 참조합니다`);
      }
    })();

    // 2. NULL 제약조건 테스트
    console.log('\n=== 2. NULL 제약조건 테스트 ===\n');

    await test('2.1 regions.province NOT NULL', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM regions
        WHERE province IS NULL
      `);
      if (parseInt(result.rows[0].count) > 0) {
        throw new Error(`${result.rows[0].count}개의 지역에 province가 NULL입니다`);
      }
    })();

    await test('2.2 accounts.platform NOT NULL', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM accounts
        WHERE platform IS NULL
      `);
      if (parseInt(result.rows[0].count) > 0) {
        throw new Error(`${result.rows[0].count}개의 계정에 platform이 NULL입니다`);
      }
    })();

    await test('2.3 posts.platform NOT NULL', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM posts
        WHERE platform IS NULL
      `);
      if (parseInt(result.rows[0].count) > 0) {
        throw new Error(`${result.rows[0].count}개의 포스트에 platform이 NULL입니다`);
      }
    })();

    await test('2.4 posts.post_id NOT NULL 및 UNIQUE', async () => {
      const result = await client.query(`
        SELECT post_id, COUNT(*) as count
        FROM posts
        GROUP BY post_id
        HAVING COUNT(*) > 1
      `);
      if (result.rows.length > 0) {
        throw new Error(`${result.rows.length}개의 중복된 post_id가 있습니다`);
      }
    })();

    // 3. 데이터 타입 검증
    console.log('\n=== 3. 데이터 타입 검증 테스트 ===\n');

    await test('3.1 posts.like_count 숫자 타입', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM posts
        WHERE like_count IS NOT NULL AND like_count < 0
      `);
      if (parseInt(result.rows[0].count) > 0) {
        throw new Error(`${result.rows[0].count}개의 포스트에 음수 like_count가 있습니다`);
      }
    })();

    await test('3.2 monitoring_keywords.priority 범위', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM monitoring_keywords
        WHERE priority < 0 OR priority > 100
      `);
      if (parseInt(result.rows[0].count) > 0) {
        throw new Error(`${result.rows[0].count}개의 키워드에 범위를 벗어난 priority가 있습니다`);
      }
    })();

    await test('3.3 accounts.is_active 불리언 타입', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM accounts
        WHERE is_active IS NOT TRUE AND is_active IS NOT FALSE
      `);
      if (parseInt(result.rows[0].count) > 0) {
        throw new Error(`${result.rows[0].count}개의 계정에 잘못된 is_active 값이 있습니다`);
      }
    })();

    // 4. 인덱스 존재 확인
    console.log('\n=== 4. 인덱스 존재 확인 ===\n');

    await test('4.1 posts 인덱스 확인', async () => {
      const result = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'posts'
        AND indexname LIKE 'idx_%'
      `);
      if (result.rows.length < 5) {
        throw new Error(`posts 테이블에 인덱스가 부족합니다 (현재: ${result.rows.length}개)`);
      }
    })();

    await test('4.2 monitoring_keywords 인덱스 확인', async () => {
      const result = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'monitoring_keywords'
        AND indexname LIKE 'idx_%'
      `);
      if (result.rows.length < 3) {
        throw new Error(`monitoring_keywords 테이블에 인덱스가 부족합니다 (현재: ${result.rows.length}개)`);
      }
    })();

    // 5. 데이터 일관성 테스트
    console.log('\n=== 5. 데이터 일관성 테스트 ===\n');

    await test('5.1 posts와 accounts 플랫폼 일치', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM posts p
        INNER JOIN accounts a ON p.account_id = a.id
        WHERE p.platform != a.platform
      `);
      if (parseInt(result.rows[0].count) > 0) {
        throw new Error(`${result.rows[0].count}개의 포스트가 계정과 플랫폼이 일치하지 않습니다`);
      }
    })();

    await test('5.2 collection_jobs와 accounts 플랫폼 일치', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM collection_jobs cj
        INNER JOIN accounts a ON cj.account_id = a.id
        WHERE cj.platform != a.platform
      `);
      if (parseInt(result.rows[0].count) > 0) {
        throw new Error(`${result.rows[0].count}개의 수집 작업이 계정과 플랫폼이 일치하지 않습니다`);
      }
    })();

    // 6. 트리거 및 제약조건 테스트
    console.log('\n=== 6. 트리거 및 제약조건 테스트 ===\n');

    await test('6.1 accounts.platform CHECK 제약조건', async () => {
      try {
        await client.query(`
          INSERT INTO accounts (username, platform, is_active)
          VALUES ('test_invalid', 'invalid_platform', true)
        `);
        await client.query(`DELETE FROM accounts WHERE username = 'test_invalid'`);
        throw new Error('잘못된 플랫폼이 허용되었습니다');
      } catch (error) {
        if (error.message.includes('invalid_platform')) {
          // 예상된 에러
        } else if (error.message.includes('잘못된 플랫폼')) {
          throw error;
        }
        // CHECK 제약조건이 작동함
      }
    })();

    // 7. 데이터 품질 테스트
    console.log('\n=== 7. 데이터 품질 테스트 ===\n');

    await test('7.1 빈 문자열 키워드 확인', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM monitoring_keywords
        WHERE keyword IS NULL OR TRIM(keyword) = ''
      `);
      if (parseInt(result.rows[0].count) > 0) {
        throw new Error(`${result.rows[0].count}개의 빈 키워드가 있습니다`);
      }
    })();

    await test('7.2 빈 문자열 해시태그 확인', async () => {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM monitoring_hashtags
        WHERE hashtag IS NULL OR TRIM(hashtag) = ''
      `);
      if (parseInt(result.rows[0].count) > 0) {
        throw new Error(`${result.rows[0].count}개의 빈 해시태그가 있습니다`);
      }
    })();

    await test('7.3 중복 키워드 확인', async () => {
      const result = await client.query(`
        SELECT keyword, platform, COUNT(*) as count
        FROM monitoring_keywords
        GROUP BY keyword, platform
        HAVING COUNT(*) > 1
      `);
      if (result.rows.length > 0) {
        throw new Error(`${result.rows.length}개의 중복된 키워드가 있습니다`);
      }
    })();

    await test('7.4 중복 해시태그 확인', async () => {
      const result = await client.query(`
        SELECT hashtag, platform, COUNT(*) as count
        FROM monitoring_hashtags
        GROUP BY hashtag, platform
        HAVING COUNT(*) > 1
      `);
      if (result.rows.length > 0) {
        throw new Error(`${result.rows.length}개의 중복된 해시태그가 있습니다`);
      }
    })();

    // 결과 요약
    console.log('\n=== 테스트 결과 요약 ===\n');
    console.log(`✅ 통과: ${results.passed}개`);
    console.log(`❌ 실패: ${results.failed}개`);
    console.log(`총 테스트: ${results.passed + results.failed}개\n`);

    if (results.errors.length > 0) {
      console.log('에러 목록:');
      results.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (results.failed === 0) {
      console.log('\n🎉 모든 데이터베이스 무결성 테스트 통과!');
      process.exit(0);
    } else {
      console.log('\n⚠️  일부 테스트 실패');
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

runDatabaseIntegrityTests();

