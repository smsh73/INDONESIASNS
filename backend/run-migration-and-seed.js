import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DATABASE_URL 환경 변수 또는 비밀번호 파일에서 연결 정보 가져오기
let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // 비밀번호 읽기
  const passwordPath = path.join(__dirname, '..', 'azure', '.postgres-password.txt');
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

async function runMigrationAndSeed() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('📊 데이터베이스 연결 중...');
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공\n');

    // 1. 마이그레이션 007 실행
    console.log('1. 마이그레이션 007 실행 중 (created_by nullable 변경)...');
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '007_make_created_by_nullable.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    try {
      await client.query(migrationSQL);
      console.log('✅ 마이그레이션 007 완료\n');
    } catch (error) {
      if (error.message.includes('does not exist') || error.message.includes('already')) {
        console.log('⚠️  마이그레이션 007 - 일부 변경사항이 이미 적용되었습니다 (건너뜀)\n');
      } else {
        console.error('❌ 마이그레이션 007 실행 중 오류:', error.message);
        throw error;
      }
    }

    // 2. 샘플 데이터 생성
    console.log('2. 샘플 데이터 생성 중...');
    const seedPath = path.join(__dirname, '..', 'database', 'seeds', '002_sample_data.sql');
    const seedSQL = fs.readFileSync(seedPath, 'utf8');
    
    try {
      await client.query(seedSQL);
      console.log('✅ 샘플 데이터 생성 완료\n');
    } catch (error) {
      console.error('❌ 샘플 데이터 생성 중 오류:', error.message);
      // 일부 데이터가 이미 존재할 수 있으므로 계속 진행
      if (!error.message.includes('duplicate') && !error.message.includes('already exists')) {
        throw error;
      }
      console.log('⚠️  일부 데이터가 이미 존재합니다 (건너뜀)\n');
    }

    // 3. 데이터 확인
    console.log('3. 생성된 데이터 확인 중...');
    const regionsResult = await client.query('SELECT COUNT(*) FROM regions');
    const accountsResult = await client.query('SELECT COUNT(*) FROM accounts');
    const keywordsResult = await client.query('SELECT COUNT(*) FROM monitoring_keywords');
    const hashtagsResult = await client.query('SELECT COUNT(*) FROM monitoring_hashtags');
    const postsResult = await client.query('SELECT COUNT(*) FROM posts');
    const workflowsResult = await client.query('SELECT COUNT(*) FROM workflows');

    console.log('📊 생성된 데이터:');
    console.log(`   - 지역: ${regionsResult.rows[0].count} 개`);
    console.log(`   - SNS 계정: ${accountsResult.rows[0].count} 개`);
    console.log(`   - 키워드: ${keywordsResult.rows[0].count} 개`);
    console.log(`   - 해시태그: ${hashtagsResult.rows[0].count} 개`);
    console.log(`   - 포스트: ${postsResult.rows[0].count} 개`);
    console.log(`   - 워크플로우: ${workflowsResult.rows[0].count} 개`);

    console.log('\n🎉 모든 작업이 완료되었습니다!');
  } catch (error) {
    console.error('❌ 실행 중 오류:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrationAndSeed();

