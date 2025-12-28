import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getActiveKeywords, getActiveHashtags, checkKeywordMatch, checkHashtagMatch } from '../src/services/monitoring/monitoringService.js';

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

async function runMonitoringTests() {
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
    console.log('📊 모니터링 테스트 시작...\n');
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공\n');

    // 1. 키워드 조회 테스트
    console.log('=== 1. 키워드 조회 테스트 ===\n');

    console.log('1.1 전체 플랫폼 키워드 조회...');
    try {
      const allKeywords = await getActiveKeywords(null);
      console.log(`   ✅ 조회 성공: ${allKeywords.length}개 키워드`);
      if (allKeywords.length > 0) {
        console.log(`   샘플 키워드: ${allKeywords.slice(0, 3).map(k => k.keyword).join(', ')}`);
        results.passed++;
      } else {
        console.log('   ⚠️  키워드가 없습니다');
        results.failed++;
      }
    } catch (error) {
      console.log(`   ❌ 실패: ${error.message}`);
      results.failed++;
      results.errors.push(`키워드 조회 실패: ${error.message}`);
    }
    console.log('');

    console.log('1.2 Instagram 플랫폼 키워드 조회...');
    try {
      const instagramKeywords = await getActiveKeywords('instagram');
      console.log(`   ✅ 조회 성공: ${instagramKeywords.length}개 키워드`);
      results.passed++;
    } catch (error) {
      console.log(`   ❌ 실패: ${error.message}`);
      results.failed++;
      results.errors.push(`Instagram 키워드 조회 실패: ${error.message}`);
    }
    console.log('');

    console.log('1.3 Facebook 플랫폼 키워드 조회...');
    try {
      const facebookKeywords = await getActiveKeywords('facebook');
      console.log(`   ✅ 조회 성공: ${facebookKeywords.length}개 키워드`);
      results.passed++;
    } catch (error) {
      console.log(`   ❌ 실패: ${error.message}`);
      results.failed++;
      results.errors.push(`Facebook 키워드 조회 실패: ${error.message}`);
    }
    console.log('');

    // 2. 해시태그 조회 테스트
    console.log('=== 2. 해시태그 조회 테스트 ===\n');

    console.log('2.1 전체 플랫폼 해시태그 조회...');
    try {
      const allHashtags = await getActiveHashtags(null);
      console.log(`   ✅ 조회 성공: ${allHashtags.length}개 해시태그`);
      if (allHashtags.length > 0) {
        console.log(`   샘플 해시태그: ${allHashtags.slice(0, 3).map(h => h.hashtag).join(', ')}`);
        results.passed++;
      } else {
        console.log('   ⚠️  해시태그가 없습니다');
        results.failed++;
      }
    } catch (error) {
      console.log(`   ❌ 실패: ${error.message}`);
      results.failed++;
      results.errors.push(`해시태그 조회 실패: ${error.message}`);
    }
    console.log('');

    // 3. 키워드 매칭 테스트
    console.log('=== 3. 키워드 매칭 테스트 ===\n');

    const testContents = [
      'Jakarta is a beautiful city in Indonesia',
      'Jokowi visited Bandung today',
      'Kejaksaan announced new policy',
      'Pemilu 2024 is coming soon',
      'Gojek is a popular app in Indonesia'
    ];

    for (const content of testContents) {
      console.log(`3.${testContents.indexOf(content) + 1} 매칭 테스트: "${content.substring(0, 30)}..."`);
      try {
        const matches = await checkKeywordMatch(content, null);
        if (matches.length > 0) {
          console.log(`   ✅ 매칭 발견: ${matches.length}개 키워드`);
          matches.forEach(match => {
            console.log(`     - ${match.keyword} (우선순위: ${match.priority})`);
          });
          results.passed++;
        } else {
          console.log('   ⚠️  매칭 없음');
          results.passed++; // 매칭이 없어도 정상 동작
        }
      } catch (error) {
        console.log(`   ❌ 실패: ${error.message}`);
        results.failed++;
        results.errors.push(`키워드 매칭 실패: ${error.message}`);
      }
      console.log('');
    }

    // 4. 해시태그 매칭 테스트
    console.log('=== 4. 해시태그 매칭 테스트 ===\n');

    const testHashtagContents = [
      'Beautiful sunset in #Jakarta #Indonesia',
      'Visiting #Bandung today #BandungCity',
      'News about #Kejaksaan and #PolisiIndonesia',
      '#Jokowi announces new policy #Pemilu2024'
    ];

    for (const content of testHashtagContents) {
      console.log(`4.${testHashtagContents.indexOf(content) + 1} 해시태그 매칭 테스트: "${content.substring(0, 30)}..."`);
      try {
        const matches = await checkHashtagMatch(content, null);
        if (matches.length > 0) {
          console.log(`   ✅ 매칭 발견: ${matches.length}개 해시태그`);
          matches.forEach(match => {
            console.log(`     - ${match.hashtag} (우선순위: ${match.priority})`);
          });
          results.passed++;
        } else {
          console.log('   ⚠️  매칭 없음');
          results.passed++; // 매칭이 없어도 정상 동작
        }
      } catch (error) {
        console.log(`   ❌ 실패: ${error.message}`);
        results.failed++;
        results.errors.push(`해시태그 매칭 실패: ${error.message}`);
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
      console.log('\n🎉 모든 모니터링 테스트 통과!');
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

runMonitoringTests();

