import pool from '../../src/config/database.js';
import { savePost } from '../../src/services/collection/collectionService.js';
import { analyzePost } from '../../src/services/analysis/analysisOrchestrator.js';
import { mapPostLocation } from '../../src/services/location/locationMapper.js';

describe('Integration Consistency Tests', () => {
  let client;
  let testAccountId;
  let testRegionId;
  let testCountryId;

  beforeAll(async () => {
    client = await pool.connect();
  });

  afterAll(async () => {
    if (client) {
      client.release();
    }
    await pool.end();
  });

  beforeEach(async () => {
    await client.query('BEGIN');

    const countryResult = await client.query(
      "INSERT INTO countries (name, code, iso_code) VALUES ('Test Country', 'TC', 'TST') RETURNING id"
    );
    testCountryId = countryResult.rows[0].id;

    const regionResult = await client.query(
      `INSERT INTO regions (province, city, country_id) 
       VALUES ('Jakarta', 'Jakarta Pusat', $1) 
       RETURNING id`,
      [testCountryId]
    );
    testRegionId = regionResult.rows[0].id;

    const accountResult = await client.query(
      `INSERT INTO accounts (username, platform, is_official) 
       VALUES ('integration_test', 'instagram', false) 
       RETURNING id`
    );
    testAccountId = accountResult.rows[0].id;
  });

  afterEach(async () => {
    await client.query('ROLLBACK');
  });

  describe('End-to-End Data Flow', () => {
    test('should maintain data consistency through complete workflow', async () => {
      const postData = {
        accountId: testAccountId,
        platform: 'instagram',
        postId: 'integration_test_post',
        content: 'I am in Jakarta Pusat. This is great!',
        authorUsername: 'testuser',
        likeCount: 10,
        commentCount: 5,
      };

      const post = await savePost(postData);
      expect(post).toBeDefined();
      expect(post.id).toBeDefined();

      const locationId = await mapPostLocation(post.id, post.content, {});
      if (locationId) {
        const postCheck = await client.query('SELECT location_id FROM posts WHERE id = $1', [post.id]);
        expect(postCheck.rows[0].location_id).toBe(locationId);
      }

      const analysisResult = await analyzePost(post.id);
      expect(analysisResult).toBeDefined();
      expect(analysisResult.sentiment).toBeDefined();
      expect(analysisResult.risk).toBeDefined();

      const sentimentCheck = await client.query('SELECT * FROM sentiment_analysis WHERE post_id = $1', [post.id]);
      expect(sentimentCheck.rows.length).toBeGreaterThan(0);

      const riskCheck = await client.query('SELECT * FROM risk_classification WHERE post_id = $1', [post.id]);
      expect(riskCheck.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Data Relationship Consistency', () => {
    test('should maintain all relationships correctly', async () => {
      const postData = {
        accountId: testAccountId,
        platform: 'instagram',
        postId: 'relationship_test',
        content: 'Test content',
      };

      const post = await savePost(postData);

      const mentionResult = await client.query(
        `INSERT INTO mentions (post_id, mention_id, author_username, content) 
         VALUES ($1, 'relationship_mention', 'user', 'Comment') 
         RETURNING id`,
        [post.id]
      );
      const mentionId = mentionResult.rows[0].id;

      await client.query(
        `INSERT INTO sentiment_analysis (post_id, sentiment_category, confidence_score) 
         VALUES ($1, 'positive', 0.8)`,
        [post.id]
      );

      await client.query(
        `INSERT INTO risk_classification (post_id, risk_category, risk_level, confidence_score) 
         VALUES ($1, 'crime', 'low', 0.6)`,
        [post.id]
      );

      const fullPost = await client.query(
        `SELECT 
          p.*,
          a.username as account_username,
          sa.sentiment_category,
          rc.risk_category,
          COUNT(m.id) as mention_count
        FROM posts p
        LEFT JOIN accounts a ON p.account_id = a.id
        LEFT JOIN sentiment_analysis sa ON p.id = sa.post_id
        LEFT JOIN risk_classification rc ON p.id = rc.post_id
        LEFT JOIN mentions m ON p.id = m.post_id
        WHERE p.id = $1
        GROUP BY p.id, a.username, sa.sentiment_category, rc.risk_category`,
        [post.id]
      );

      expect(fullPost.rows.length).toBe(1);
      expect(fullPost.rows[0].account_username).toBe('integration_test');
      expect(fullPost.rows[0].sentiment_category).toBe('positive');
      expect(fullPost.rows[0].risk_category).toBe('crime');
      expect(parseInt(fullPost.rows[0].mention_count)).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Transaction Consistency', () => {
    test('should maintain consistency across multiple operations', async () => {
      const postData1 = {
        accountId: testAccountId,
        platform: 'instagram',
        postId: 'transaction_test_1',
        content: 'First post',
      };

      const postData2 = {
        accountId: testAccountId,
        platform: 'instagram',
        postId: 'transaction_test_2',
        content: 'Second post',
      };

      const post1 = await savePost(postData1);
      const post2 = await savePost(postData2);

      expect(post1.id).toBeDefined();
      expect(post2.id).toBeDefined();
      expect(post1.id).not.toBe(post2.id);

      const count = await client.query('SELECT COUNT(*) as count FROM posts WHERE account_id = $1', [testAccountId]);
      expect(parseInt(count.rows[0].count)).toBeGreaterThanOrEqual(2);
    });
  });
});

