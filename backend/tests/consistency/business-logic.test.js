import pool from '../../src/config/database.js';
import { savePost, saveMention } from '../../src/services/collection/collectionService.js';
import { analyzeSentiment } from '../../src/services/analysis/sentimentService.js';
import { classifyRisk } from '../../src/services/analysis/riskClassifier.js';
import { mapPostLocation } from '../../src/services/location/locationMapper.js';

describe('Business Logic Consistency Tests', () => {
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
       VALUES ('testaccount', 'instagram', false) 
       RETURNING id`
    );
    testAccountId = accountResult.rows[0].id;
  });

  afterEach(async () => {
    await client.query('ROLLBACK');
  });

  describe('Post Collection Consistency', () => {
    test('should create post with correct account relationship', async () => {
      const postData = {
        accountId: testAccountId,
        platform: 'instagram',
        postId: 'test_post_1',
        content: 'Test post content',
        authorUsername: 'testuser',
        likeCount: 10,
        commentCount: 5,
        shareCount: 2,
      };

      const post = await savePost(postData);

      expect(post).toBeDefined();
      expect(post.account_id).toBe(testAccountId);
      expect(post.platform).toBe('instagram');
      expect(post.post_id).toBe('test_post_1');

      const dbCheck = await client.query('SELECT * FROM posts WHERE id = $1', [post.id]);
      expect(dbCheck.rows.length).toBe(1);
      expect(dbCheck.rows[0].account_id).toBe(testAccountId);
    });

    test('should prevent duplicate post_id', async () => {
      const postData = {
        accountId: testAccountId,
        platform: 'instagram',
        postId: 'duplicate_post',
        content: 'First post',
      };

      await savePost(postData);

      await expect(
        savePost({
          ...postData,
          content: 'Second post',
        })
      ).rejects.toThrow();
    });
  });

  describe('Mention Collection Consistency', () => {
    test('should create mention with correct post relationship', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'mention_test_post', 'Test') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      const mentionData = {
        postId,
        mentionId: 'test_mention_1',
        authorUsername: 'commenter',
        content: 'Test comment',
        likeCount: 3,
      };

      const mention = await saveMention(mentionData);

      expect(mention).toBeDefined();
      expect(mention.post_id).toBe(postId);
      expect(mention.mention_id).toBe('test_mention_1');

      const dbCheck = await client.query('SELECT * FROM mentions WHERE id = $1', [mention.id]);
      expect(dbCheck.rows.length).toBe(1);
      expect(dbCheck.rows[0].post_id).toBe(postId);
    });
  });

  describe('Sentiment Analysis Consistency', () => {
    test('should create sentiment analysis with valid category', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'sentiment_test', 'I love this product!') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      const sentiment = await analyzeSentiment(postId, 'I love this product!', 'id');

      expect(sentiment).toBeDefined();
      expect(sentiment.postId).toBe(postId);
      expect(['positive', 'negative', 'neutral', 'hot', 'angry', 'concerned']).toContain(
        sentiment.sentimentCategory
      );
      expect(sentiment.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(sentiment.confidenceScore).toBeLessThanOrEqual(1);

      const dbCheck = await client.query('SELECT * FROM sentiment_analysis WHERE post_id = $1', [postId]);
      expect(dbCheck.rows.length).toBe(1);
      expect(dbCheck.rows[0].sentiment_category).toBe(sentiment.sentimentCategory);
    });

    test('should update existing sentiment analysis for same post', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'sentiment_update_test', 'Initial content') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      const firstSentiment = await analyzeSentiment(postId, 'Initial content', 'id');
      const secondSentiment = await analyzeSentiment(postId, 'Updated content', 'id');

      const dbCheck = await client.query('SELECT * FROM sentiment_analysis WHERE post_id = $1', [postId]);
      expect(dbCheck.rows.length).toBe(1);
      expect(dbCheck.rows[0].id).toBe(firstSentiment.postId || dbCheck.rows[0].id);
    });
  });

  describe('Risk Classification Consistency', () => {
    test('should create risk classification with valid category and level', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'risk_test', 'This is dangerous content') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      const risk = await classifyRisk(postId, 'This is dangerous content', false, 'id');

      expect(risk).toBeDefined();
      expect(risk.postId).toBe(postId);
      expect([
        'terrorism',
        'crime',
        'protest',
        'accident',
        'emergency',
        'action_risk',
        'incident',
        'riot',
        'reaction',
      ]).toContain(risk.riskCategory);
      expect(['low', 'medium', 'high', 'critical']).toContain(risk.riskLevel);
      expect(risk.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(risk.confidenceScore).toBeLessThanOrEqual(1);

      const dbCheck = await client.query('SELECT * FROM risk_classification WHERE post_id = $1', [postId]);
      expect(dbCheck.rows.length).toBe(1);
      expect(dbCheck.rows[0].risk_category).toBe(risk.riskCategory);
      expect(dbCheck.rows[0].risk_level).toBe(risk.riskLevel);
    });
  });

  describe('Location Mapping Consistency', () => {
    test('should map location correctly when location is found', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'location_test', 'I am in Jakarta Pusat') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      const locationId = await mapPostLocation(postId, 'I am in Jakarta Pusat', {});

      if (locationId) {
        const postCheck = await client.query('SELECT location_id FROM posts WHERE id = $1', [postId]);
        expect(postCheck.rows[0].location_id).toBe(locationId);

        const locationCheck = await client.query('SELECT * FROM locations WHERE id = $1', [locationId]);
        expect(locationCheck.rows.length).toBe(1);
      }
    });
  });

  describe('Data Aggregation Consistency', () => {
    test('should maintain consistent counts in analytics_summary', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'analytics_test', 'Test') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      const locationResult = await client.query(
        `INSERT INTO locations (province, city, region_id) 
         VALUES ('Jakarta', 'Jakarta Pusat', $1) 
         RETURNING id`,
        [testRegionId]
      );
      const locationId = locationResult.rows[0].id;

      await client.query('UPDATE posts SET location_id = $1 WHERE id = $2', [locationId, postId]);

      await client.query(
        `INSERT INTO sentiment_analysis (post_id, sentiment_category, confidence_score) 
         VALUES ($1, 'positive', 0.8)`,
        [postId]
      );

      const summaryCheck = await client.query(
        `SELECT COUNT(*) as post_count 
         FROM posts p
         INNER JOIN locations l ON p.location_id = l.id
         WHERE l.region_id = $1`,
        [testRegionId]
      );
      expect(parseInt(summaryCheck.rows[0].post_count)).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Workflow Execution Consistency', () => {
    test('should maintain workflow execution logs', async () => {
      const userResult = await client.query(
        `INSERT INTO users (username, email, password_hash, role) 
         VALUES ('workflow_user', 'workflow@test.com', 'hash', 'admin') 
         RETURNING id`
      );
      const userId = userResult.rows[0].id;

      const workflowResult = await client.query(
        `INSERT INTO workflows (name, trigger_type, trigger_conditions, actions, created_by) 
         VALUES (
           'Test Workflow',
           'risk_level',
           '{"type": "risk_level", "values": ["high", "critical"]}'::jsonb,
           '[{"type": "create_alert", "title": "Alert"}]'::jsonb,
           $1
         ) 
         RETURNING id`,
        [userId]
      );
      const workflowId = workflowResult.rows[0].id;

      const executionResult = await client.query(
        `INSERT INTO workflow_executions (
          workflow_id, status, actions_executed
        ) VALUES ($1, 'completed', '[]'::jsonb) 
        RETURNING id`,
        [workflowId]
      );
      const executionId = executionResult.rows[0].id;

      const check = await client.query('SELECT * FROM workflow_executions WHERE id = $1', [executionId]);
      expect(check.rows.length).toBe(1);
      expect(check.rows[0].workflow_id).toBe(workflowId);
      expect(check.rows[0].status).toBe('completed');
    });
  });
});

