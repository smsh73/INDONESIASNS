import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FacebookCollector } from '../src/collectors/facebook/collector.js';
import { InstagramCollector } from '../src/collectors/instagram/collector.js';
import { getActiveKeywords, getActiveHashtags } from '../src/services/monitoring/monitoringService.js';
import { runKeywordBasedCollectionNow } from '../src/services/monitoring/publicDataCollectionService.js';

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

async function runCollectionTests() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };

  try {
    console.log('📊 수집 테스트 시작...\n');
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공\n');

    // 1. 수집 전 데이터 확인
    console.log('=== 1. 수집 전 데이터 확인 ===\n');

    const beforeCheck = await client.query(`
      SELECT 
        platform,
        COUNT(*) as post_count
      FROM posts
      GROUP BY platform
      ORDER BY platform
    `);
    console.log('현재 포스트 수:');
    beforeCheck.rows.forEach(row => {
      console.log(`  - ${row.platform}: ${row.post_count}개`);
    });
    console.log('');

    // 2. 키워드/해시태그 확인
    console.log('=== 2. 수집 대상 키워드/해시태그 확인 ===\n');

    const keywords = await getActiveKeywords('instagram');
    const hashtags = await getActiveHashtags('instagram');

    console.log(`Instagram 키워드: ${keywords.length}개`);
    if (keywords.length > 0) {
      console.log(`  샘플: ${keywords.slice(0, 5).map(k => k.keyword).join(', ')}`);
    }

    console.log(`Instagram 해시태그: ${hashtags.length}개`);
    if (hashtags.length > 0) {
      console.log(`  샘플: ${hashtags.slice(0, 5).map(h => h.hashtag).join(', ')}`);
    }
    console.log('');

    if (keywords.length === 0 && hashtags.length === 0) {
      console.log('⚠️  Instagram 키워드/해시태그가 없어 수집 테스트를 건너뜁니다.');
      console.log('   (이것은 정상입니다 - 키워드/해시태그가 없으면 수집이 실행되지 않습니다)');
      results.passed++;
    } else {
      // 3. 수집기 초기화 테스트
      console.log('=== 3. 수집기 초기화 테스트 ===\n');

      console.log('3.1 Instagram 수집기 초기화...');
      try {
        const instagramCollector = new InstagramCollector({});
        console.log('   ✅ Instagram 수집기 초기화 성공');
        results.passed++;
      } catch (error) {
        console.log(`   ❌ 실패: ${error.message}`);
        results.failed++;
        results.errors.push(`Instagram 수집기 초기화 실패: ${error.message}`);
      }
      console.log('');

      console.log('3.2 Facebook 수집기 초기화...');
      try {
        const facebookCollector = new FacebookCollector({});
        console.log('   ✅ Facebook 수집기 초기화 성공');
        results.passed++;
      } catch (error) {
        console.log(`   ❌ 실패: ${error.message}`);
        results.failed++;
        results.errors.push(`Facebook 수집기 초기화 실패: ${error.message}`);
      }
      console.log('');

      // 4. 공개 데이터 수집 테스트 (실제 수집은 하지 않고 구조만 확인)
      console.log('=== 4. 공개 데이터 수집 구조 테스트 ===\n');

      console.log('4.1 collectPublicData 메서드 확인...');
      try {
        const instagramCollector = new InstagramCollector({});
        if (typeof instagramCollector.collectPublicData === 'function') {
          console.log('   ✅ collectPublicData 메서드 존재');
          results.passed++;
        } else {
          console.log('   ❌ collectPublicData 메서드 없음');
          results.failed++;
          results.errors.push('Instagram 수집기에 collectPublicData 메서드가 없습니다');
        }
      } catch (error) {
        console.log(`   ❌ 실패: ${error.message}`);
        results.failed++;
        results.errors.push(`메서드 확인 실패: ${error.message}`);
      }
      console.log('');

      // 5. 수집 작업 로그 테스트
      console.log('=== 5. 수집 작업 로그 테스트 ===\n');

      console.log('5.1 수집 작업 로그 테이블 확인...');
      const jobTableCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'collection_jobs'
        ORDER BY ordinal_position
      `);
      const requiredJobColumns = ['id', 'platform', 'account_id', 'job_type', 'status', 'items_collected'];
      const existingColumns = jobTableCheck.rows.map(r => r.column_name);
      const missingColumns = requiredJobColumns.filter(col => !existingColumns.includes(col));

      if (missingColumns.length === 0) {
        console.log('   ✅ 모든 필수 컬럼 존재');
        results.passed++;
      } else {
        console.log(`   ❌ 누락된 컬럼: ${missingColumns.join(', ')}`);
        results.failed++;
        results.errors.push(`수집 작업 로그 테이블에 누락된 컬럼: ${missingColumns.join(', ')}`);
      }
      console.log('');

      // 6. 계정 기반 수집 테스트 (실제 수집은 하지 않음)
      console.log('=== 6. 계정 기반 수집 구조 테스트 ===\n');

      console.log('6.1 계정 데이터 확인...');
      const accountsCheck = await client.query(`
        SELECT 
          platform,
          COUNT(*) as count,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
        FROM accounts
        GROUP BY platform
        ORDER BY platform
      `);
      console.log('   플랫폼별 계정:');
      accountsCheck.rows.forEach(row => {
        console.log(`     - ${row.platform}: ${row.count}개 (활성: ${row.active_count}개)`);
      });
      if (accountsCheck.rows.length > 0) {
        console.log('   ✅ 계정 데이터 존재');
        results.passed++;
      } else {
        console.log('   ⚠️  계정 데이터 없음 (공개 수집만 가능)');
        results.passed++; // 계정이 없어도 공개 수집은 가능
      }
      console.log('');
    }

    // 결과 요약
    console.log('=== 테스트 결과 요약 ===\n');
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
      console.log('\n🎉 모든 수집 테스트 통과!');
      console.log('\n💡 참고: 실제 데이터 수집은 API를 통해 실행하거나 수집 작업을 시작해야 합니다.');
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

runCollectionTests();

