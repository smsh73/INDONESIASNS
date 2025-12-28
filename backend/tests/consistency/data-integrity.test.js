import pool from '../../src/config/database.js';

describe('Data Integrity Tests', () => {
  let client;
  let testUserId;
  let testAccountId;
  let testPostId;
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
       VALUES ('Test Province', 'Test City', $1) 
       RETURNING id`,
      [testCountryId]
    );
    testRegionId = regionResult.rows[0].id;

    const userResult = await client.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ('testuser', 'test@test.com', 'hashed', 'user') 
       RETURNING id`
    );
    testUserId = userResult.rows[0].id;

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

  describe('Foreign Key Integrity', () => {
    test('should prevent inserting post with invalid account_id', async () => {
      await expect(
        client.query(
          `INSERT INTO posts (account_id, platform, post_id, content) 
           VALUES (99999, 'instagram', 'test_post_1', 'Test content')`
        )
      ).rejects.toThrow();
    });

    test('should prevent inserting mention with invalid post_id', async () => {
      await expect(
        client.query(
          `INSERT INTO mentions (post_id, mention_id, author_username, content) 
           VALUES (99999, 'test_mention_1', 'user', 'Test mention')`
        )
      ).rejects.toThrow();
    });

    test('should prevent inserting sentiment_analysis with invalid post_id', async () => {
      await expect(
        client.query(
          `INSERT INTO sentiment_analysis (post_id, sentiment_category, confidence_score) 
           VALUES (99999, 'positive', 0.8)`
        )
      ).rejects.toThrow();
    });

    test('should prevent inserting location with invalid region_id', async () => {
      await expect(
        client.query(
          `INSERT INTO locations (province, city, region_id) 
           VALUES ('Test', 'Test', 99999)`
        )
      ).rejects.toThrow();
    });

    test('should cascade delete posts when account is deleted', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'test_post_cascade', 'Test') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      await client.query('DELETE FROM accounts WHERE id = $1', [testAccountId]);

      const postCheck = await client.query('SELECT * FROM posts WHERE id = $1', [postId]);
      expect(postCheck.rows.length).toBe(0);
    });

    test('should set null on delete for mentions when post is deleted', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'test_post_setnull', 'Test') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      await client.query(
        `INSERT INTO mentions (post_id, mention_id, author_username, content) 
         VALUES ($1, 'test_mention_setnull', 'user', 'Test')`,
        [postId]
      );

      await client.query('DELETE FROM posts WHERE id = $1', [postId]);

      const mentionCheck = await client.query(
        'SELECT * FROM mentions WHERE mention_id = $1',
        ['test_mention_setnull']
      );
      expect(mentionCheck.rows.length).toBe(0);
    });
  });

  describe('Check Constraints', () => {
    test('should prevent invalid role in users table', async () => {
      await expect(
        client.query(
          `INSERT INTO users (username, email, password_hash, role) 
           VALUES ('invalid', 'invalid@test.com', 'hash', 'invalid_role')`
        )
      ).rejects.toThrow();
    });

    test('should prevent invalid platform in accounts table', async () => {
      await expect(
        client.query(
          `INSERT INTO accounts (username, platform) 
           VALUES ('test', 'invalid_platform')`
        )
      ).rejects.toThrow();
    });

    test('should prevent invalid sentiment_category', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'test_sentiment', 'Test') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      await expect(
        client.query(
          `INSERT INTO sentiment_analysis (post_id, sentiment_category, confidence_score) 
           VALUES ($1, 'invalid_sentiment', 0.8)`,
          [postId]
        )
      ).rejects.toThrow();
    });

    test('should prevent invalid risk_level', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'test_risk', 'Test') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      await expect(
        client.query(
          `INSERT INTO risk_classification (post_id, risk_category, risk_level, confidence_score) 
           VALUES ($1, 'crime', 'invalid_level', 0.8)`,
          [postId]
        )
      ).rejects.toThrow();
    });

    test('should prevent confidence_score outside 0-1 range', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'test_confidence', 'Test') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      await expect(
        client.query(
          `INSERT INTO sentiment_analysis (post_id, sentiment_category, confidence_score) 
           VALUES ($1, 'positive', 1.5)`,
          [postId]
        )
      ).rejects.toThrow();
    });
  });

  describe('Unique Constraints', () => {
    test('should prevent duplicate username', async () => {
      await expect(
        client.query(
          `INSERT INTO users (username, email, password_hash) 
           VALUES ('testuser', 'test2@test.com', 'hash')`
        )
      ).rejects.toThrow();
    });

    test('should prevent duplicate email', async () => {
      await expect(
        client.query(
          `INSERT INTO users (username, email, password_hash) 
           VALUES ('testuser2', 'test@test.com', 'hash')`
        )
      ).rejects.toThrow();
    });

    test('should prevent duplicate post_id', async () => {
      await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'duplicate_test', 'Test')`,
        [testAccountId]
      );

      await expect(
        client.query(
          `INSERT INTO posts (account_id, platform, post_id, content) 
           VALUES ($1, 'instagram', 'duplicate_test', 'Test2')`,
          [testAccountId]
        )
      ).rejects.toThrow();
    });
  });

  describe('Data Consistency', () => {
    test('should maintain referential integrity for posts and accounts', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'consistency_test', 'Test') 
         RETURNING id, account_id`,
        [testAccountId]
      );
      const post = postResult.rows[0];

      const accountCheck = await client.query('SELECT * FROM accounts WHERE id = $1', [post.account_id]);
      expect(accountCheck.rows.length).toBe(1);
      expect(accountCheck.rows[0].id).toBe(testAccountId);
    });

    test('should maintain referential integrity for sentiment_analysis and posts', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'sentiment_consistency', 'Test') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      await client.query(
        `INSERT INTO sentiment_analysis (post_id, sentiment_category, confidence_score) 
         VALUES ($1, 'positive', 0.8)`,
        [postId]
      );

      const sentimentCheck = await client.query(
        'SELECT * FROM sentiment_analysis WHERE post_id = $1',
        [postId]
      );
      expect(sentimentCheck.rows.length).toBe(1);
      expect(sentimentCheck.rows[0].post_id).toBe(postId);
    });

    test('should maintain referential integrity for locations and regions', async () => {
      const locationResult = await client.query(
        `INSERT INTO locations (province, city, region_id) 
         VALUES ('Test Location', 'Test City', $1) 
         RETURNING id, region_id`,
        [testRegionId]
      );
      const location = locationResult.rows[0];

      const regionCheck = await client.query('SELECT * FROM regions WHERE id = $1', [location.region_id]);
      expect(regionCheck.rows.length).toBe(1);
      expect(regionCheck.rows[0].id).toBe(testRegionId);
    });
  });

  describe('Cascade Deletes', () => {
    test('should cascade delete sentiment_analysis when post is deleted', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'cascade_sentiment', 'Test') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      await client.query(
        `INSERT INTO sentiment_analysis (post_id, sentiment_category, confidence_score) 
         VALUES ($1, 'positive', 0.8)`,
        [postId]
      );

      await client.query('DELETE FROM posts WHERE id = $1', [postId]);

      const sentimentCheck = await client.query('SELECT * FROM sentiment_analysis WHERE post_id = $1', [postId]);
      expect(sentimentCheck.rows.length).toBe(0);
    });

    test('should cascade delete risk_classification when post is deleted', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'cascade_risk', 'Test') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      await client.query(
        `INSERT INTO risk_classification (post_id, risk_category, risk_level, confidence_score) 
         VALUES ($1, 'crime', 'low', 0.7)`,
        [postId]
      );

      await client.query('DELETE FROM posts WHERE id = $1', [postId]);

      const riskCheck = await client.query('SELECT * FROM risk_classification WHERE post_id = $1', [postId]);
      expect(riskCheck.rows.length).toBe(0);
    });
  });
});

