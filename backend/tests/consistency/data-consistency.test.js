import pool from '../../src/config/database.js';

describe('Data Consistency Tests', () => {
  let client;
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

  describe('Referential Integrity Consistency', () => {
    test('should maintain consistent post-account relationship', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'consistency_post', 'Test') 
         RETURNING id, account_id`,
        [testAccountId]
      );
      const post = postResult.rows[0];

      const accountCheck = await client.query('SELECT id FROM accounts WHERE id = $1', [post.account_id]);
      expect(accountCheck.rows.length).toBe(1);
      expect(accountCheck.rows[0].id).toBe(testAccountId);
    });

    test('should maintain consistent mention-post relationship', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'mention_consistency', 'Test') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      const mentionResult = await client.query(
        `INSERT INTO mentions (post_id, mention_id, author_username, content) 
         VALUES ($1, 'consistency_mention', 'user', 'Test') 
         RETURNING id, post_id`,
        [postId]
      );
      const mention = mentionResult.rows[0];

      const postCheck = await client.query('SELECT id FROM posts WHERE id = $1', [mention.post_id]);
      expect(postCheck.rows.length).toBe(1);
      expect(postCheck.rows[0].id).toBe(postId);
    });

    test('should maintain consistent sentiment-post relationship', async () => {
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

      const sentimentCheck = await client.query('SELECT post_id FROM sentiment_analysis WHERE post_id = $1', [postId]);
      expect(sentimentCheck.rows.length).toBe(1);
      expect(sentimentCheck.rows[0].post_id).toBe(postId);

      const postCheck = await client.query('SELECT id FROM posts WHERE id = $1', [postId]);
      expect(postCheck.rows.length).toBe(1);
    });
  });

  describe('Data Type Consistency', () => {
    test('should store numeric values correctly', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content, like_count, comment_count) 
         VALUES ($1, 'instagram', 'numeric_test', 'Test', 100, 50) 
         RETURNING like_count, comment_count`,
        [testAccountId]
      );
      const post = postResult.rows[0];

      expect(typeof post.like_count).toBe('number');
      expect(typeof post.comment_count).toBe('number');
      expect(post.like_count).toBe(100);
      expect(post.comment_count).toBe(50);
    });

    test('should store decimal values correctly', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'decimal_test', 'Test') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      await client.query(
        `INSERT INTO sentiment_analysis (post_id, sentiment_category, confidence_score) 
         VALUES ($1, 'positive', 0.8765)`,
        [postId]
      );

      const result = await client.query('SELECT confidence_score FROM sentiment_analysis WHERE post_id = $1', [postId]);
      expect(typeof parseFloat(result.rows[0].confidence_score)).toBe('number');
      expect(parseFloat(result.rows[0].confidence_score)).toBeCloseTo(0.8765, 4);
    });

    test('should store timestamp values correctly', async () => {
      const now = new Date();
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content, created_at) 
         VALUES ($1, 'instagram', 'timestamp_test', 'Test', $2) 
         RETURNING created_at`,
        [testAccountId, now]
      );
      const post = postResult.rows[0];

      expect(post.created_at).toBeInstanceOf(Date);
      expect(post.created_at.getTime()).toBeCloseTo(now.getTime(), -1000);
    });
  });

  describe('Array Type Consistency', () => {
    test('should store array values correctly', async () => {
      const hashtags = ['hashtag1', 'hashtag2', 'hashtag3'];
      const mentions = ['@user1', '@user2'];

      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content, hashtags, mentions) 
         VALUES ($1, 'instagram', 'array_test', 'Test', $2, $3) 
         RETURNING hashtags, mentions`,
        [testAccountId, hashtags, mentions]
      );
      const post = postResult.rows[0];

      expect(Array.isArray(post.hashtags)).toBe(true);
      expect(Array.isArray(post.mentions)).toBe(true);
      expect(post.hashtags).toEqual(hashtags);
      expect(post.mentions).toEqual(mentions);
    });
  });

  describe('JSONB Type Consistency', () => {
    test('should store JSONB values correctly', async () => {
      const metadata = { verified: true, category: 'government', followers: 1000 };

      const accountResult = await client.query(
        `INSERT INTO accounts (username, platform, metadata) 
         VALUES ('jsonb_test', 'instagram', $1) 
         RETURNING metadata`,
        [JSON.stringify(metadata)]
      );
      const account = accountResult.rows[0];

      expect(account.metadata).toBeDefined();
      const parsed = typeof account.metadata === 'string' ? JSON.parse(account.metadata) : account.metadata;
      expect(parsed.verified).toBe(true);
      expect(parsed.category).toBe('government');
      expect(parsed.followers).toBe(1000);
    });
  });

  describe('Default Value Consistency', () => {
    test('should apply default values correctly', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'default_test', 'Test') 
         RETURNING like_count, comment_count, share_count, view_count`,
        [testAccountId]
      );
      const post = postResult.rows[0];

      expect(post.like_count).toBe(0);
      expect(post.comment_count).toBe(0);
      expect(post.share_count).toBe(0);
      expect(post.view_count).toBe(0);
    });

    test('should apply default role correctly', async () => {
      const userResult = await client.query(
        `INSERT INTO users (username, email, password_hash) 
         VALUES ('default_role_test', 'default@test.com', 'hash') 
         RETURNING role`
      );
      const user = userResult.rows[0];

      expect(user.role).toBe('user');
    });

    test('should apply default is_active correctly', async () => {
      const accountResult = await client.query(
        `INSERT INTO accounts (username, platform) 
         VALUES ('default_active_test', 'instagram') 
         RETURNING is_active`
      );
      const account = accountResult.rows[0];

      expect(account.is_active).toBe(true);
    });
  });

  describe('Constraint Validation Consistency', () => {
    test('should enforce NOT NULL constraints', async () => {
      await expect(
        client.query(
          `INSERT INTO posts (account_id, platform, post_id) 
           VALUES ($1, 'instagram', 'null_test')`,
          [testAccountId]
        )
      ).rejects.toThrow();
    });

    test('should enforce UNIQUE constraints', async () => {
      await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'unique_test', 'Test')`,
        [testAccountId]
      );

      await expect(
        client.query(
          `INSERT INTO posts (account_id, platform, post_id, content) 
           VALUES ($1, 'instagram', 'unique_test', 'Test2')`,
          [testAccountId]
        )
      ).rejects.toThrow();
    });
  });

  describe('Cascade Behavior Consistency', () => {
    test('should cascade delete posts when account is deleted', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'cascade_test', 'Test') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      await client.query('DELETE FROM accounts WHERE id = $1', [testAccountId]);

      const postCheck = await client.query('SELECT * FROM posts WHERE id = $1', [postId]);
      expect(postCheck.rows.length).toBe(0);
    });

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
  });

  describe('Index Usage Consistency', () => {
    test('should use indexes for foreign key lookups', async () => {
      const explainResult = await client.query(
        `EXPLAIN SELECT * FROM posts WHERE account_id = $1`,
        [testAccountId]
      );

      const explainText = explainResult.rows.map((r) => r['QUERY PLAN']).join(' ');
      expect(explainText.toLowerCase()).toContain('index');
    });

    test('should use indexes for platform queries', async () => {
      const explainResult = await client.query(
        `EXPLAIN SELECT * FROM posts WHERE platform = 'instagram'`
      );

      const explainText = explainResult.rows.map((r) => r['QUERY PLAN']).join(' ');
      expect(explainText.toLowerCase()).toContain('index');
    });
  });
});

