import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  getActiveKeywords, 
  getActiveHashtags, 
  checkKeywordMatch, 
  checkHashtagMatch,
  startMonitoringForAccount,
  stopMonitoringForAccount
} from '../src/services/monitoring/monitoringService.js';
import { savePost } from '../src/services/collection/collectionService.js';
import { runKeywordBasedCollectionNow } from '../src/services/monitoring/publicDataCollectionService.js';
import { FacebookCollector } from '../collectors/facebook/collector.js';
import { InstagramCollector } from '../collectors/instagram/collector.js';

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
  testData: {
    keywords: [],
    hashtags: [],
    posts: [],
    accounts: []
  }
};

function test(name, fn, category = 'Test') {
  testResults.total++;
  return async () => {
    try {
      await fn();
      console.log(`✅ [${category}] ${name}`);
      testResults.passed++;
    } catch (error) {
      console.log(`❌ [${category}] ${name}: ${error.message}`);
      testResults.failed++;
      testResults.errors.push({ category, name, error: error.message, stack: error.stack });
    }
  };
}

async function runFocusedTests() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 키워드 등록, 모니터링, 수집 기능 집중 테스트 시작...\n');
    await client.connect();
    console.log('✅ 데이터베이스 연결 성공\n');

    // ============================================
    // 1. 키워드 등록 기능 테스트
    // ============================================
    console.log('=== 1. 키워드 등록 기능 테스트 ===\n');

    await test('1.1 키워드 생성 - 기본', async () => {
      const keywordData = {
        keyword: `test_keyword_${Date.now()}`,
        platform: null,
        priority: 5,
        keyword_type: 'region',
        description: '테스트 키워드',
        is_active: true,
        created_by: null
      };

      const result = await client.query(`
        INSERT INTO monitoring_keywords (keyword, platform, priority, keyword_type, description, is_active, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        keywordData.keyword,
        keywordData.platform,
        keywordData.priority,
        keywordData.keyword_type,
        keywordData.description,
        keywordData.is_active,
        keywordData.created_by
      ]);

      if (result.rows.length === 0) {
        throw new Error('키워드 생성 실패');
      }

      const created = result.rows[0];
      if (created.keyword !== keywordData.keyword) {
        throw new Error('생성된 키워드 값이 일치하지 않습니다');
      }
      if (created.priority !== keywordData.priority) {
        throw new Error('생성된 우선순위 값이 일치하지 않습니다');
      }
      if (created.keyword_type !== keywordData.keyword_type) {
        throw new Error('생성된 키워드 타입이 일치하지 않습니다');
      }

      testResults.testData.keywords.push(created.id);
      console.log(`   생성된 키워드 ID: ${created.id}, 키워드: ${created.keyword}`);
    }, 'Keyword Registration')();

    await test('1.2 키워드 생성 - 플랫폼별', async () => {
      const platforms = ['instagram', 'facebook', 'tiktok'];
      
      for (const platform of platforms) {
        const keywordData = {
          keyword: `test_${platform}_${Date.now()}`,
          platform: platform,
          priority: 7,
          keyword_type: 'product',
          is_active: true
        };

        const result = await client.query(`
          INSERT INTO monitoring_keywords (keyword, platform, priority, keyword_type, is_active, created_by)
          VALUES ($1, $2, $3, $4, $5, NULL)
          RETURNING *
        `, [
          keywordData.keyword,
          keywordData.platform,
          keywordData.priority,
          keywordData.keyword_type,
          keywordData.is_active
        ]);

        if (result.rows[0].platform !== platform) {
          throw new Error(`${platform} 플랫폼 키워드 생성 실패`);
        }

        testResults.testData.keywords.push(result.rows[0].id);
      }
      console.log(`   플랫폼별 키워드 생성 완료: ${platforms.length}개`);
    }, 'Keyword Registration')();

    await test('1.3 키워드 생성 - 타입별', async () => {
      const types = ['region', 'organization', 'person', 'product', 'event', 'other'];
      
      for (const type of types) {
        const keywordData = {
          keyword: `test_${type}_${Date.now()}`,
          platform: null,
          priority: 6,
          keyword_type: type,
          is_active: true
        };

        const result = await client.query(`
          INSERT INTO monitoring_keywords (keyword, platform, priority, keyword_type, is_active, created_by)
          VALUES ($1, $2, $3, $4, $5, NULL)
          RETURNING *
        `, [
          keywordData.keyword,
          keywordData.platform,
          keywordData.priority,
          keywordData.keyword_type,
          keywordData.is_active
        ]);

        if (result.rows[0].keyword_type !== type) {
          throw new Error(`${type} 타입 키워드 생성 실패`);
        }

        testResults.testData.keywords.push(result.rows[0].id);
      }
      console.log(`   타입별 키워드 생성 완료: ${types.length}개`);
    }, 'Keyword Registration')();

    await test('1.4 키워드 중복 방지', async () => {
      const duplicateKeyword = `duplicate_test_${Date.now()}`;
      
      // 첫 번째 키워드 생성
      await client.query(`
        INSERT INTO monitoring_keywords (keyword, platform, priority, is_active, created_by)
        VALUES ($1, NULL, 5, true, NULL)
      `, [duplicateKeyword]);

      // 중복 키워드 생성 시도
      try {
        await client.query(`
          INSERT INTO monitoring_keywords (keyword, platform, priority, is_active, created_by)
          VALUES ($1, NULL, 5, true, NULL)
        `, [duplicateKeyword]);
        throw new Error('중복 키워드가 생성되었습니다');
      } catch (error) {
        if (error.code === '23505' || error.message.includes('unique')) {
          // 중복 에러가 발생하는 것이 정상
          console.log('   중복 방지 정상 동작');
        } else {
          throw error;
        }
      }

      // 정리
      await client.query('DELETE FROM monitoring_keywords WHERE keyword = $1', [duplicateKeyword]);
    }, 'Keyword Registration')();

    await test('1.5 키워드 수정', async () => {
      if (testResults.testData.keywords.length === 0) {
        throw new Error('수정할 키워드가 없습니다');
      }

      const keywordId = testResults.testData.keywords[0];
      const newPriority = 10;
      const newDescription = '수정된 설명';

      const result = await client.query(`
        UPDATE monitoring_keywords
        SET priority = $1, description = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [newPriority, newDescription, keywordId]);

      if (result.rows.length === 0) {
        throw new Error('키워드 수정 실패');
      }

      if (result.rows[0].priority !== newPriority) {
        throw new Error('우선순위 수정이 반영되지 않았습니다');
      }

      if (result.rows[0].description !== newDescription) {
        throw new Error('설명 수정이 반영되지 않았습니다');
      }

      console.log(`   키워드 ID ${keywordId} 수정 완료`);
    }, 'Keyword Registration')();

    await test('1.6 키워드 활성화/비활성화', async () => {
      if (testResults.testData.keywords.length === 0) {
        throw new Error('테스트할 키워드가 없습니다');
      }

      const keywordId = testResults.testData.keywords[0];

      // 비활성화
      await client.query(`
        UPDATE monitoring_keywords
        SET is_active = false
        WHERE id = $1
      `, [keywordId]);

      const inactiveResult = await client.query(`
        SELECT is_active FROM monitoring_keywords WHERE id = $1
      `, [keywordId]);

      if (inactiveResult.rows[0].is_active !== false) {
        throw new Error('키워드 비활성화 실패');
      }

      // 활성화
      await client.query(`
        UPDATE monitoring_keywords
        SET is_active = true
        WHERE id = $1
      `, [keywordId]);

      const activeResult = await client.query(`
        SELECT is_active FROM monitoring_keywords WHERE id = $1
      `, [keywordId]);

      if (activeResult.rows[0].is_active !== true) {
        throw new Error('키워드 활성화 실패');
      }

      console.log(`   키워드 ID ${keywordId} 활성화/비활성화 정상 동작`);
    }, 'Keyword Registration')();

    // ============================================
    // 2. 모니터링 기능 테스트
    // ============================================
    console.log('\n=== 2. 모니터링 기능 테스트 ===\n');

    await test('2.1 활성 키워드 조회', async () => {
      const keywords = await getActiveKeywords(null);
      
      if (!Array.isArray(keywords)) {
        throw new Error('키워드 조회 결과가 배열이 아닙니다');
      }

      // 모든 키워드가 활성화되어 있는지 확인
      const inactiveKeywords = keywords.filter(k => !k.is_active);
      if (inactiveKeywords.length > 0) {
        throw new Error(`비활성 키워드가 조회되었습니다: ${inactiveKeywords.length}개`);
      }

      console.log(`   활성 키워드: ${keywords.length}개`);
    }, 'Monitoring')();

    await test('2.2 플랫폼별 키워드 조회', async () => {
      const instagramKeywords = await getActiveKeywords('instagram');
      const facebookKeywords = await getActiveKeywords('facebook');
      
      if (!Array.isArray(instagramKeywords) || !Array.isArray(facebookKeywords)) {
        throw new Error('플랫폼별 키워드 조회 결과가 배열이 아닙니다');
      }

      // Instagram 키워드는 Instagram 플랫폼이거나 플랫폼이 null이어야 함
      const invalidInstagram = instagramKeywords.filter(k => 
        k.platform !== null && k.platform !== 'instagram'
      );
      if (invalidInstagram.length > 0) {
        throw new Error(`Instagram 조회에 다른 플랫폼 키워드 포함: ${invalidInstagram.length}개`);
      }

      console.log(`   Instagram 키워드: ${instagramKeywords.length}개, Facebook 키워드: ${facebookKeywords.length}개`);
    }, 'Monitoring')();

    await test('2.3 키워드 매칭 - 정확한 매칭', async () => {
      // 테스트용 키워드 생성
      const testKeyword = `exact_match_test_${Date.now()}`;
      await client.query(`
        INSERT INTO monitoring_keywords (keyword, platform, priority, is_active, created_by)
        VALUES ($1, NULL, 10, true, NULL)
      `, [testKeyword]);

      const testContent = `This is a test post about ${testKeyword} in Jakarta.`;
      const matches = await checkKeywordMatch(testContent, null);

      const found = matches.find(m => m.keyword.toLowerCase() === testKeyword.toLowerCase());
      if (!found) {
        throw new Error(`생성한 키워드 "${testKeyword}"가 매칭되지 않았습니다`);
      }

      if (found.priority !== 10) {
        throw new Error('키워드 우선순위가 일치하지 않습니다');
      }

      console.log(`   키워드 "${testKeyword}" 정확히 매칭됨`);

      // 정리
      await client.query('DELETE FROM monitoring_keywords WHERE keyword = $1', [testKeyword]);
    }, 'Monitoring')();

    await test('2.4 키워드 매칭 - 대소문자 무시', async () => {
      const testKeyword = `case_test_${Date.now()}`;
      await client.query(`
        INSERT INTO monitoring_keywords (keyword, platform, priority, is_active, created_by)
        VALUES ($1, NULL, 8, true, NULL)
      `, [testKeyword]);

      const testContents = [
        `Post about ${testKeyword}`,
        `Post about ${testKeyword.toUpperCase()}`,
        `Post about ${testKeyword.toLowerCase()}`,
        `Post about ${testKeyword.charAt(0).toUpperCase() + testKeyword.slice(1)}`
      ];

      for (const content of testContents) {
        const matches = await checkKeywordMatch(content, null);
        const found = matches.find(m => m.keyword.toLowerCase() === testKeyword.toLowerCase());
        if (!found) {
          throw new Error(`대소문자 변형 "${content}"에서 키워드가 매칭되지 않았습니다`);
        }
      }

      console.log(`   대소문자 무시 매칭 정상 동작`);

      // 정리
      await client.query('DELETE FROM monitoring_keywords WHERE keyword = $1', [testKeyword]);
    }, 'Monitoring')();

    await test('2.5 키워드 매칭 - 우선순위 정렬', async () => {
      const keywords = ['low_priority', 'high_priority', 'medium_priority'];
      const priorities = [1, 10, 5];

      for (let i = 0; i < keywords.length; i++) {
        await client.query(`
          INSERT INTO monitoring_keywords (keyword, platform, priority, is_active, created_by)
          VALUES ($1, NULL, $2, true, NULL)
        `, [`${keywords[i]}_${Date.now()}`, priorities[i]]);
      }

      const testContent = 'This post contains low_priority high_priority medium_priority keywords.';
      const matches = await checkKeywordMatch(testContent, null);

      // 우선순위가 높은 순서대로 정렬되어야 함
      for (let i = 1; i < matches.length; i++) {
        if (matches[i-1].priority < matches[i].priority) {
          throw new Error('키워드 매칭 결과가 우선순위 순으로 정렬되지 않았습니다');
        }
      }

      console.log(`   우선순위 정렬 정상 동작 (${matches.length}개 매칭)`);

      // 정리
      for (const keyword of keywords) {
        await client.query('DELETE FROM monitoring_keywords WHERE keyword LIKE $1', [`${keyword}%`]);
      }
    }, 'Monitoring')();

    await test('2.6 해시태그 매칭', async () => {
      const testHashtag = `test_hashtag_${Date.now()}`;
      await client.query(`
        INSERT INTO monitoring_hashtags (hashtag, platform, priority, is_active, created_by)
        VALUES ($1, NULL, 9, true, NULL)
      `, [`#${testHashtag}`]);

      const testHashtags = [`#${testHashtag}`, `#${testHashtag.toUpperCase()}`, `#OtherTag`];
      const matches = await checkHashtagMatch(testHashtags, null);

      const found = matches.find(m => m.hashtag.toLowerCase().includes(testHashtag.toLowerCase()));
      if (!found) {
        throw new Error(`생성한 해시태그 "#${testHashtag}"가 매칭되지 않았습니다`);
      }

      console.log(`   해시태그 "#${testHashtag}" 정확히 매칭됨`);

      // 정리
      await client.query('DELETE FROM monitoring_hashtags WHERE hashtag = $1', [`#${testHashtag}`]);
    }, 'Monitoring')();

    await test('2.7 모니터링 통계 조회', async () => {
      const result = await client.query(`
        SELECT 
          mk.id as keyword_id,
          mk.keyword,
          COUNT(DISTINCT p.id) as match_count
        FROM monitoring_keywords mk
        LEFT JOIN posts p ON p.content ILIKE '%' || mk.keyword || '%'
        WHERE mk.is_active = true
        GROUP BY mk.id, mk.keyword
        ORDER BY match_count DESC
        LIMIT 10
      `);

      if (!Array.isArray(result.rows)) {
        throw new Error('모니터링 통계 조회 결과가 배열이 아닙니다');
      }

      console.log(`   모니터링 통계 조회 완료: ${result.rows.length}개 키워드`);
      result.rows.slice(0, 3).forEach(row => {
        console.log(`     - ${row.keyword}: ${row.match_count}개 매칭`);
      });
    }, 'Monitoring')();

    // ============================================
    // 3. 수집 기능 테스트
    // ============================================
    console.log('\n=== 3. 수집 기능 테스트 ===\n');

    await test('3.1 포스트 저장 - 기본', async () => {
      const testPost = {
        platform: 'instagram',
        postId: `test_post_${Date.now()}_${Math.random()}`,
        content: 'Test post content for collection test #TestHashtag',
        authorUsername: 'test_collector',
        url: 'https://instagram.com/p/test',
        hashtags: ['TestHashtag'],
        likeCount: 100,
        commentCount: 10,
        shareCount: 5,
        postedAt: new Date()
      };

      const savedPost = await savePost(testPost);

      if (!savedPost || !savedPost.id) {
        throw new Error('포스트 저장 실패');
      }

      // 저장된 데이터 검증
      const verifyResult = await client.query(
        'SELECT * FROM posts WHERE id = $1',
        [savedPost.id]
      );

      if (verifyResult.rows.length === 0) {
        throw new Error('저장된 포스트를 찾을 수 없습니다');
      }

      const retrieved = verifyResult.rows[0];
      if (retrieved.content !== testPost.content) {
        throw new Error('저장된 포스트 내용이 일치하지 않습니다');
      }
      if (retrieved.like_count !== testPost.likeCount) {
        throw new Error('저장된 좋아요 수가 일치하지 않습니다');
      }
      if (retrieved.platform !== testPost.platform) {
        throw new Error('저장된 플랫폼이 일치하지 않습니다');
      }

      testResults.testData.posts.push(savedPost.id);
      console.log(`   포스트 저장 완료: ID ${savedPost.id}`);
    }, 'Collection')();

    await test('3.2 포스트 저장 - 중복 방지 (업데이트)', async () => {
      const testPostId = `duplicate_post_${Date.now()}`;
      const firstPost = {
        platform: 'facebook',
        postId: testPostId,
        content: 'First version',
        authorUsername: 'test_user',
        url: 'https://facebook.com/p/test',
        likeCount: 50,
        postedAt: new Date()
      };

      const firstSave = await savePost(firstPost);
      testResults.testData.posts.push(firstSave.id);

      // 동일한 postId로 다시 저장 (업데이트되어야 함)
      const secondPost = {
        ...firstPost,
        content: 'Updated version',
        likeCount: 100
      };

      const secondSave = await savePost(secondPost);

      if (firstSave.id !== secondSave.id) {
        throw new Error('중복 포스트가 생성되었습니다 (업데이트되어야 함)');
      }

      const verifyResult = await client.query(
        'SELECT content, like_count FROM posts WHERE id = $1',
        [firstSave.id]
      );

      if (verifyResult.rows[0].content !== 'Updated version') {
        throw new Error('포스트 내용이 업데이트되지 않았습니다');
      }

      if (verifyResult.rows[0].like_count !== 100) {
        throw new Error('포스트 좋아요 수가 업데이트되지 않았습니다');
      }

      console.log(`   포스트 중복 방지 및 업데이트 정상 동작: ID ${firstSave.id}`);
    }, 'Collection')();

    await test('3.3 포스트 저장 - 계정 없이 (공개 수집)', async () => {
      const publicPost = {
        platform: 'instagram',
        postId: `public_post_${Date.now()}_${Math.random()}`,
        content: 'Public post without account #PublicPost',
        authorUsername: 'public_user',
        url: 'https://instagram.com/p/public',
        accountId: null, // 계정 없이 저장
        hashtags: ['PublicPost'],
        postedAt: new Date()
      };

      const savedPost = await savePost(publicPost);

      if (!savedPost || !savedPost.id) {
        throw new Error('공개 포스트 저장 실패');
      }

      const verifyResult = await client.query(
        'SELECT account_id FROM posts WHERE id = $1',
        [savedPost.id]
      );

      if (verifyResult.rows[0].account_id !== null) {
        throw new Error('공개 포스트의 account_id가 null이 아닙니다');
      }

      testResults.testData.posts.push(savedPost.id);
      console.log(`   공개 포스트 저장 완료: ID ${savedPost.id} (account_id: null)`);
    }, 'Collection')();

    await test('3.4 수집기 초기화', async () => {
      const instagramCollector = new InstagramCollector({});
      const facebookCollector = new FacebookCollector({});

      if (!instagramCollector || !facebookCollector) {
        throw new Error('수집기 초기화 실패');
      }

      if (typeof instagramCollector.collectPublicData !== 'function') {
        throw new Error('Instagram 수집기에 collectPublicData 메서드가 없습니다');
      }

      if (typeof facebookCollector.collectPublicData !== 'function') {
        throw new Error('Facebook 수집기에 collectPublicData 메서드가 없습니다');
      }

      console.log(`   수집기 초기화 완료: Instagram, Facebook`);
    }, 'Collection')();

    await test('3.5 키워드 기반 공개 수집 구조 테스트', async () => {
      // 실제 수집은 하지 않고 구조만 확인
      const keywords = await getActiveKeywords('instagram');
      const hashtags = await getActiveHashtags('instagram');

      if (keywords.length === 0 && hashtags.length === 0) {
        console.log('   ⚠️  Instagram 키워드/해시태그가 없어 수집 테스트를 건너뜁니다');
        return;
      }

      const instagramCollector = new InstagramCollector({});
      
      // collectPublicData 메서드가 키워드와 해시태그를 받을 수 있는지 확인
      if (typeof instagramCollector.collectPublicData !== 'function') {
        throw new Error('collectPublicData 메서드가 없습니다');
      }

      console.log(`   키워드 기반 수집 구조 확인 완료: 키워드 ${keywords.length}개, 해시태그 ${hashtags.length}개`);
    }, 'Collection')();

    await test('3.6 수집 작업 로그 생성', async () => {
      const jobData = {
        accountId: null,
        platform: 'instagram',
        jobType: 'public'
      };

      const result = await client.query(`
        INSERT INTO collection_jobs (platform, account_id, job_type, status, items_collected)
        VALUES ($1, $2, $3, 'running', 0)
        RETURNING *
      `, [jobData.platform, jobData.accountId, jobData.jobType]);

      if (result.rows.length === 0) {
        throw new Error('수집 작업 로그 생성 실패');
      }

      const job = result.rows[0];
      if (job.platform !== jobData.platform) {
        throw new Error('수집 작업 로그의 플랫폼이 일치하지 않습니다');
      }
      if (job.job_type !== jobData.jobType) {
        throw new Error('수집 작업 로그의 작업 타입이 일치하지 않습니다');
      }

      console.log(`   수집 작업 로그 생성 완료: ID ${job.id}`);

      // 정리
      await client.query('DELETE FROM collection_jobs WHERE id = $1', [job.id]);
    }, 'Collection')();

    await test('3.7 수집된 포스트와 키워드 매칭', async () => {
      // 테스트용 키워드 생성
      const testKeyword = `collection_match_${Date.now()}`;
      await client.query(`
        INSERT INTO monitoring_keywords (keyword, platform, priority, is_active, created_by)
        VALUES ($1, 'instagram', 10, true, NULL)
      `, [testKeyword]);

      // 키워드를 포함한 포스트 저장
      const testPost = {
        platform: 'instagram',
        postId: `match_test_${Date.now()}_${Math.random()}`,
        content: `This post contains ${testKeyword} keyword for testing.`,
        authorUsername: 'test_user',
        url: 'https://instagram.com/p/match',
        postedAt: new Date()
      };

      const savedPost = await savePost(testPost);
      testResults.testData.posts.push(savedPost.id);

      // 키워드 매칭 확인
      const matches = await checkKeywordMatch(testPost.content, 'instagram');
      const found = matches.find(m => m.keyword.toLowerCase() === testKeyword.toLowerCase());

      if (!found) {
        throw new Error(`저장한 포스트에서 키워드 "${testKeyword}"가 매칭되지 않았습니다`);
      }

      console.log(`   수집된 포스트와 키워드 매칭 확인: 키워드 "${testKeyword}" 매칭됨`);

      // 정리
      await client.query('DELETE FROM monitoring_keywords WHERE keyword = $1', [testKeyword]);
    }, 'Collection')();

    // ============================================
    // 4. 통합 테스트
    // ============================================
    console.log('\n=== 4. 통합 테스트 ===\n');

    await test('4.1 키워드 등록 → 모니터링 → 수집 전체 플로우', async () => {
      const flowKeyword = `flow_test_${Date.now()}`;
      
      // 1. 키워드 등록
      const keywordResult = await client.query(`
        INSERT INTO monitoring_keywords (keyword, platform, priority, keyword_type, is_active, created_by)
        VALUES ($1, 'instagram', 10, 'event', true, NULL)
        RETURNING *
      `, [flowKeyword]);

      const keywordId = keywordResult.rows[0].id;
      testResults.testData.keywords.push(keywordId);

      // 2. 모니터링 확인
      const keywords = await getActiveKeywords('instagram');
      const foundKeyword = keywords.find(k => k.keyword === flowKeyword);
      if (!foundKeyword) {
        throw new Error('등록한 키워드가 모니터링 목록에 없습니다');
      }

      // 3. 포스트 수집 (시뮬레이션)
      const testPost = {
        platform: 'instagram',
        postId: `flow_post_${Date.now()}_${Math.random()}`,
        content: `Event announcement about ${flowKeyword} happening soon!`,
        authorUsername: 'event_organizer',
        url: 'https://instagram.com/p/flow',
        postedAt: new Date()
      };

      const savedPost = await savePost(testPost);
      testResults.testData.posts.push(savedPost.id);

      // 4. 키워드 매칭 확인
      const matches = await checkKeywordMatch(testPost.content, 'instagram');
      const matched = matches.find(m => m.keyword === flowKeyword);

      if (!matched) {
        throw new Error('수집된 포스트에서 등록한 키워드가 매칭되지 않았습니다');
      }

      console.log(`   전체 플로우 테스트 완료: 키워드 등록 → 모니터링 → 수집 → 매칭`);
    }, 'Integration')();

    await test('4.2 다중 키워드 매칭', async () => {
      const keywords = ['Jakarta', 'Bandung', 'Surabaya'];
      const testContent = `Traveling to Jakarta, Bandung, and Surabaya in Indonesia.`;

      const matches = await checkKeywordMatch(testContent, null);
      const matchedKeywords = matches.map(m => m.keyword);

      const foundCount = keywords.filter(k => 
        matchedKeywords.some(mk => mk.toLowerCase() === k.toLowerCase())
      ).length;

      if (foundCount === 0) {
        warn('테스트 키워드가 매칭되지 않았습니다 (데이터베이스에 없을 수 있음)', 'Integration');
      } else {
        console.log(`   다중 키워드 매칭: ${foundCount}/${keywords.length}개 키워드 매칭됨`);
      }
    }, 'Integration')();

    // 테스트 데이터 정리
    console.log('\n=== 테스트 데이터 정리 ===\n');
    
    if (testResults.testData.keywords.length > 0) {
      await client.query(`
        DELETE FROM monitoring_keywords 
        WHERE id = ANY($1::int[])
      `, [testResults.testData.keywords]);
      console.log(`   키워드 ${testResults.testData.keywords.length}개 삭제 완료`);
    }

    if (testResults.testData.posts.length > 0) {
      await client.query(`
        DELETE FROM posts 
        WHERE id = ANY($1::int[])
      `, [testResults.testData.posts]);
      console.log(`   포스트 ${testResults.testData.posts.length}개 삭제 완료`);
    }

    // 결과 요약
    console.log('\n=== 테스트 결과 요약 ===\n');
    console.log(`총 테스트: ${testResults.total}개`);
    console.log(`✅ 통과: ${testResults.passed}개`);
    console.log(`❌ 실패: ${testResults.failed}개\n`);

    if (testResults.errors.length > 0) {
      console.log('실패한 테스트:');
      testResults.errors.forEach((err, index) => {
        console.log(`  ${index + 1}. [${err.category}] ${err.name}`);
        console.log(`     에러: ${err.error}`);
      });
      console.log('');
    }

    if (testResults.failed === 0) {
      console.log('🎉 모든 테스트 통과!');
      console.log('\n✅ 키워드 등록 기능: 정상 동작');
      console.log('✅ 모니터링 기능: 정상 동작');
      console.log('✅ 수집 기능: 정상 동작');
      process.exit(0);
    } else {
      console.log('⚠️  일부 테스트 실패');
      console.log('\n❌ 발견된 문제:');
      testResults.errors.forEach((err, index) => {
        console.log(`  ${index + 1}. [${err.category}] ${err.name}: ${err.error}`);
      });
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

runFocusedTests();

