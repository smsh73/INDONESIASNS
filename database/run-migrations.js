const pg = require('./node_modules/pg') || require('pg');
const fs = require('fs');
const path = require('path');

const { Client } = pg;

// 비밀번호 읽기
const passwordPath = path.join(__dirname, '..', '.postgres-password.txt');
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

const connectionString = `postgresql://${POSTGRES_ADMIN_USER}:${postgresPassword}@${POSTGRES_FQDN}:5432/${POSTGRES_DB}?sslmode=require`;

const migrations = [
  '001_initial_schema.sql',
  '002_admin_schema.sql',
  '003_monitoring_matches.sql',
  '004_add_description_to_monitoring.sql',
  '005_allow_null_account_id.sql',
  '006_add_keyword_type.sql'
];

async function runMigrations() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('📊 데이터베이스 연결 중...');
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공\n');

    for (let i = 0; i < migrations.length; i++) {
      const migrationFile = migrations[i];
      const migrationPath = path.join(__dirname, 'migrations', migrationFile);
      
      console.log(`${i + 1}. ${migrationFile} 실행 중...`);
      
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        await client.query(sql);
        console.log(`✅ ${migrationFile} 완료\n`);
      } catch (error) {
        // 이미 존재하는 객체는 무시 (IF NOT EXISTS, IF EXISTS 등)
        if (error.message.includes('already exists') || 
            error.message.includes('does not exist') ||
            error.message.includes('duplicate')) {
          console.log(`⚠️  ${migrationFile} - 일부 객체가 이미 존재합니다 (건너뜀)\n`);
        } else {
          console.error(`❌ ${migrationFile} 실행 중 오류:`);
          console.error(error.message);
          throw error;
        }
      }
    }

    console.log('🎉 모든 마이그레이션이 완료되었습니다!');
  } catch (error) {
    console.error('❌ 마이그레이션 실행 중 오류:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
