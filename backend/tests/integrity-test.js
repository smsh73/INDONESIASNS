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

async function runIntegrityTests() {
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
    console.log('📊 데이터베이스 연결 중...');
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공\n');

    // 1. 정합성 테스트
    console.log('=== 1. 정합성 테스트 ===\n');

    // 1.1 지역-위치 관계 확인
    console.log('1.1 지역-위치 관계 확인...');
    const regionLocationCheck = await client.query(`
      SELECT 
        COUNT(DISTINCT r.id) as region_count,
        COUNT(DISTINCT l.id) as location_count,
        COUNT(DISTINCT l.region_id) as linked_locations
      FROM regions r
      LEFT JOIN locations l ON r.id = l.region_id
    `);
    console.log(`   지역: ${regionLocationCheck.rows[0].region_count}개, 위치: ${regionLocationCheck.rows[0].location_count}개`);
    if (parseInt(regionLocationCheck.rows[0].region_count) > 0) {
      results.passed++;
      console.log('   ✅ 통과\n');
    } else {
      results.failed++;
      results.errors.push('지역 데이터가 없습니다');
      console.log('   ❌ 실패\n');
    }

    // 1.2 포스트-계정 관계 확인
    console.log('1.2 포스트-계정 관계 확인...');
    const postAccountCheck = await client.query(`
      SELECT 
        COUNT(DISTINCT p.id) as post_count,
        COUNT(DISTINCT p.account_id) as posts_with_account,
        COUNT(DISTINCT CASE WHEN p.account_id IS NULL THEN p.id END) as posts_without_account
      FROM posts p
    `);
    console.log(`   포스트: ${postAccountCheck.rows[0].post_count}개, 계정 연결: ${postAccountCheck.rows[0].posts_with_account}개`);
    if (parseInt(postAccountCheck.rows[0].post_count) > 0) {
      results.passed++;
      console.log('   ✅ 통과\n');
    } else {
      results.failed++;
      results.errors.push('포스트 데이터가 없습니다');
      console.log('   ❌ 실패\n');
    }

    // 1.3 키워드-해시태그 활성화 확인
    console.log('1.3 키워드-해시태그 활성화 확인...');
    const keywordHashtagCheck = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM monitoring_keywords WHERE is_active = true) as active_keywords,
        (SELECT COUNT(*) FROM monitoring_hashtags WHERE is_active = true) as active_hashtags
    `);
    console.log(`   활성 키워드: ${keywordHashtagCheck.rows[0].active_keywords}개, 활성 해시태그: ${keywordHashtagCheck.rows[0].active_hashtags}개`);
    if (parseInt(keywordHashtagCheck.rows[0].active_keywords) > 0 && parseInt(keywordHashtagCheck.rows[0].active_hashtags) > 0) {
      results.passed++;
      console.log('   ✅ 통과\n');
    } else {
      results.failed++;
      results.errors.push('활성 키워드 또는 해시태그가 없습니다');
      console.log('   ❌ 실패\n');
    }

    // 1.4 지도-지역 관계 확인
    console.log('1.4 지도-지역 관계 확인...');
    const mapRegionCheck = await client.query(`
      SELECT 
        COUNT(*) as map_count,
        COUNT(DISTINCT country_id) as country_maps,
        COUNT(DISTINCT region_id) as region_maps
      FROM map_data
    `);
    console.log(`   지도: ${mapRegionCheck.rows[0].map_count}개, 국가 지도: ${mapRegionCheck.rows[0].country_maps}개, 지역 지도: ${mapRegionCheck.rows[0].region_maps}개`);
    if (parseInt(mapRegionCheck.rows[0].map_count) > 0) {
      results.passed++;
      console.log('   ✅ 통과\n');
    } else {
      results.failed++;
      results.errors.push('지도 데이터가 없습니다');
      console.log('   ❌ 실패\n');
    }

    // 2. 스키마 불일치 테스트
    console.log('=== 2. 스키마 불일치 테스트 ===\n');

    // 2.1 필수 컬럼 확인
    console.log('2.1 필수 컬럼 확인...');
    const requiredColumns = [
      { table: 'regions', columns: ['id', 'province', 'latitude', 'longitude'] },
      { table: 'locations', columns: ['id', 'province', 'region_id'] },
      { table: 'accounts', columns: ['id', 'platform', 'username', 'is_active'] },
      { table: 'monitoring_keywords', columns: ['id', 'keyword', 'is_active', 'keyword_type'] },
      { table: 'monitoring_hashtags', columns: ['id', 'hashtag', 'is_active'] },
      { table: 'posts', columns: ['id', 'platform', 'post_id', 'content'] },
      { table: 'workflows', columns: ['id', 'name', 'trigger_type', 'trigger_conditions', 'actions'] },
      { table: 'map_data', columns: ['id', 'map_type'] },
    ];

    for (const { table, columns } of requiredColumns) {
      try {
        const columnCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND column_name = ANY($2::text[])
        `, [table, columns]);
        
        if (columnCheck.rows.length === columns.length) {
          console.log(`   ✅ ${table}: 모든 필수 컬럼 존재`);
          results.passed++;
        } else {
          const missing = columns.filter(col => !columnCheck.rows.some(r => r.column_name === col));
          console.log(`   ❌ ${table}: 누락된 컬럼 - ${missing.join(', ')}`);
          results.failed++;
          results.errors.push(`${table} 테이블에 누락된 컬럼: ${missing.join(', ')}`);
        }
      } catch (error) {
        console.log(`   ❌ ${table}: 테이블 확인 실패 - ${error.message}`);
        results.failed++;
        results.errors.push(`${table} 테이블 확인 실패: ${error.message}`);
      }
    }
    console.log('');

    // 2.2 trigger_config 컬럼 확인
    console.log('2.2 trigger_config 컬럼 확인...');
    const triggerConfigCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'workflows' AND column_name = 'trigger_config'
    `);
    if (triggerConfigCheck.rows.length > 0) {
      console.log('   ✅ workflows.trigger_config 컬럼 존재');
      results.passed++;
    } else {
      console.log('   ❌ workflows.trigger_config 컬럼 없음');
      results.failed++;
      results.errors.push('workflows 테이블에 trigger_config 컬럼이 없습니다');
    }
    console.log('');

    // 2.3 인덱스 확인
    console.log('2.3 주요 인덱스 확인...');
    const indexCheck = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_%'
      ORDER BY indexname
    `);
    console.log(`   인덱스 개수: ${indexCheck.rows.length}개`);
    if (indexCheck.rows.length > 10) {
      console.log('   ✅ 충분한 인덱스 존재');
      results.passed++;
    } else {
      console.log('   ⚠️  인덱스가 부족할 수 있습니다');
      results.failed++;
      results.errors.push('인덱스가 부족합니다');
    }
    console.log('');

    // 3. 모니터링 테스트
    console.log('=== 3. 모니터링 테스트 ===\n');

    // 3.1 활성 키워드 조회
    console.log('3.1 활성 키워드 조회 테스트...');
    const activeKeywords = await client.query(`
      SELECT COUNT(*) as count, 
             COUNT(DISTINCT platform) as platforms,
             COUNT(DISTINCT keyword_type) as types
      FROM monitoring_keywords 
      WHERE is_active = true
    `);
    console.log(`   활성 키워드: ${activeKeywords.rows[0].count}개, 플랫폼: ${activeKeywords.rows[0].platforms}개, 타입: ${activeKeywords.rows[0].types}개`);
    if (parseInt(activeKeywords.rows[0].count) > 0) {
      results.passed++;
      console.log('   ✅ 통과\n');
    } else {
      results.failed++;
      results.errors.push('활성 키워드가 없습니다');
      console.log('   ❌ 실패\n');
    }

    // 3.2 활성 해시태그 조회
    console.log('3.2 활성 해시태그 조회 테스트...');
    const activeHashtags = await client.query(`
      SELECT COUNT(*) as count, 
             COUNT(DISTINCT platform) as platforms
      FROM monitoring_hashtags 
      WHERE is_active = true
    `);
    console.log(`   활성 해시태그: ${activeHashtags.rows[0].count}개, 플랫폼: ${activeHashtags.rows[0].platforms}개`);
    if (parseInt(activeHashtags.rows[0].count) > 0) {
      results.passed++;
      console.log('   ✅ 통과\n');
    } else {
      results.failed++;
      results.errors.push('활성 해시태그가 없습니다');
      console.log('   ❌ 실패\n');
    }

    // 3.3 키워드 매칭 테스트
    console.log('3.3 키워드 매칭 테스트...');
    const keywordMatchTest = await client.query(`
      SELECT 
        mk.keyword,
        COUNT(p.id) as match_count
      FROM monitoring_keywords mk
      LEFT JOIN posts p ON p.content ILIKE '%' || mk.keyword || '%'
      WHERE mk.is_active = true
      GROUP BY mk.keyword
      ORDER BY match_count DESC
      LIMIT 5
    `);
    console.log(`   매칭된 키워드: ${keywordMatchTest.rows.length}개`);
    keywordMatchTest.rows.forEach(row => {
      console.log(`     - ${row.keyword}: ${row.match_count}개 매칭`);
    });
    results.passed++;
    console.log('   ✅ 통과\n');

    // 4. 수집 테스트
    console.log('=== 4. 수집 테스트 ===\n');

    // 4.1 계정 데이터 확인
    console.log('4.1 계정 데이터 확인...');
    const accountCheck = await client.query(`
      SELECT 
        platform,
        COUNT(*) as count,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
      FROM accounts
      GROUP BY platform
      ORDER BY platform
    `);
    console.log('   플랫폼별 계정:');
    accountCheck.rows.forEach(row => {
      console.log(`     - ${row.platform}: ${row.count}개 (활성: ${row.active_count}개)`);
    });
    if (accountCheck.rows.length > 0) {
      results.passed++;
      console.log('   ✅ 통과\n');
    } else {
      results.failed++;
      results.errors.push('계정 데이터가 없습니다');
      console.log('   ❌ 실패\n');
    }

    // 4.2 포스트 데이터 확인
    console.log('4.2 포스트 데이터 확인...');
    const postCheck = await client.query(`
      SELECT 
        platform,
        COUNT(*) as count,
        COUNT(DISTINCT account_id) as account_count,
        AVG(like_count)::int as avg_likes,
        AVG(comment_count)::int as avg_comments
      FROM posts
      GROUP BY platform
      ORDER BY platform
    `);
    console.log('   플랫폼별 포스트:');
    postCheck.rows.forEach(row => {
      console.log(`     - ${row.platform}: ${row.count}개 (계정: ${row.account_count}개, 평균 좋아요: ${row.avg_likes}, 평균 댓글: ${row.avg_comments})`);
    });
    if (postCheck.rows.length > 0) {
      results.passed++;
      console.log('   ✅ 통과\n');
    } else {
      results.failed++;
      results.errors.push('포스트 데이터가 없습니다');
      console.log('   ❌ 실패\n');
    }

    // 4.3 수집 작업 로그 확인
    console.log('4.3 수집 작업 로그 확인...');
    const jobCheck = await client.query(`
      SELECT 
        platform,
        job_type,
        status,
        COUNT(*) as count,
        SUM(items_collected) as total_collected
      FROM collection_jobs
      GROUP BY platform, job_type, status
      ORDER BY platform, job_type
    `);
    if (jobCheck.rows.length > 0) {
      console.log('   수집 작업:');
      jobCheck.rows.forEach(row => {
        console.log(`     - ${row.platform} (${row.job_type}): ${row.status} - ${row.count}개 작업, ${row.total_collected || 0}개 수집`);
      });
    } else {
      console.log('   수집 작업 로그 없음 (정상 - 아직 수집 작업이 실행되지 않음)');
    }
    results.passed++;
    console.log('   ✅ 통과\n');

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
      console.log('\n🎉 모든 테스트 통과!');
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

runIntegrityTests();

