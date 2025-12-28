import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Client } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function checkOrCreateAdmin() {
  try {
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공\n');

    // 기존 관리자 계정 확인
    const result = await client.query(
      'SELECT username, email, role FROM users WHERE role = $1',
      ['admin']
    );

    if (result.rows.length > 0) {
      console.log('📋 기존 관리자 계정:');
      result.rows.forEach(user => {
        console.log(`  - 사용자명: ${user.username}`);
        console.log(`  - 이메일: ${user.email}`);
        console.log(`  - 역할: ${user.role}\n`);
      });
    } else {
      console.log('⚠️  관리자 계정이 없습니다. 생성 중...\n');
      
      // 관리자 계정 생성 (비밀번호: admin123)
      const password = 'admin123';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const insertResult = await client.query(
        'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING username, email, role',
        ['admin', 'admin@kejaksaan.go.id', hashedPassword, 'admin']
      );

      const newAdmin = insertResult.rows[0];
      console.log('✅ 관리자 계정 생성 완료!\n');
      console.log('📋 관리자 계정 정보:');
      console.log(`  - 사용자명: ${newAdmin.username}`);
      console.log(`  - 이메일: ${newAdmin.email}`);
      console.log(`  - 역할: ${newAdmin.role}`);
      console.log(`  - 비밀번호: admin123\n`);
      console.log('⚠️  프로덕션 환경에서는 반드시 비밀번호를 변경하세요!');
    }
  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkOrCreateAdmin();

