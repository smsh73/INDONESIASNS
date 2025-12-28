import pool from '../../src/config/database.js';

describe('Data Validation Consistency Tests', () => {
  let client;
  let testAccountId;
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
      "INSERT INTO countries (name, code, iso_code) VALUES ('Validation Test', 'VT', 'VLD') RETURNING id"
    );
    testCountryId = countryResult.rows[0].id;

    const accountResult = await client.query(
      `INSERT INTO accounts (username, platform, is_official) 
       VALUES ('validation_test', 'instagram', false) 
       RETURNING id`
    );
    testAccountId = accountResult.rows[0].id;
  });

  afterEach(async () => {
    await client.query('ROLLBACK');
  });

  describe('String Length Validation', () => {
    test('should enforce VARCHAR length limits', async () => {
      const longString = 'a'.repeat(300);
      
      await expect(
        client.query(
          `INSERT INTO users (username, email, password_hash) 
           VALUES ($1, 'test@test.com', 'hash')`,
          [longString]
        )
      ).rejects.toThrow();
    });
  });

  describe('Numeric Range Validation', () => {
    test('should enforce confidence_score range 0-1', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'range_test', 'Test') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      await expect(
        client.query(
          `INSERT INTO sentiment_analysis (post_id, sentiment_category, confidence_score) 
           VALUES ($1, 'positive', -0.1)`,
          [postId]
        )
      ).rejects.toThrow();

      await expect(
        client.query(
          `INSERT INTO sentiment_analysis (post_id, sentiment_category, confidence_score) 
           VALUES ($1, 'positive', 1.1)`,
          [postId]
        )
      ).rejects.toThrow();
    });
  });

  describe('Enum Value Validation', () => {
    test('should enforce valid sentiment categories', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'enum_test', 'Test') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      const validCategories = ['positive', 'negative', 'neutral', 'hot', 'angry', 'concerned'];
      
      for (const category of validCategories) {
        await client.query('DELETE FROM sentiment_analysis WHERE post_id = $1', [postId]);
        
        await expect(
          client.query(
            `INSERT INTO sentiment_analysis (post_id, sentiment_category, confidence_score) 
             VALUES ($1, $2, 0.8)`,
            [postId, category]
          )
        ).resolves.not.toThrow();
      }
    });

    test('should enforce valid risk levels', async () => {
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content) 
         VALUES ($1, 'instagram', 'risk_enum_test', 'Test') 
         RETURNING id`,
        [testAccountId]
      );
      const postId = postResult.rows[0].id;

      const validLevels = ['low', 'medium', 'high', 'critical'];
      
      for (const level of validLevels) {
        await client.query('DELETE FROM risk_classification WHERE post_id = $1', [postId]);
        
        await expect(
          client.query(
            `INSERT INTO risk_classification (post_id, risk_category, risk_level, confidence_score) 
             VALUES ($1, 'crime', $2, 0.7)`,
            [postId, level]
          )
        ).resolves.not.toThrow();
      }
    });
  });

  describe('Timestamp Validation', () => {
    test('should accept valid timestamps', async () => {
      const validDate = new Date('2024-01-01T00:00:00Z');
      
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content, posted_at) 
         VALUES ($1, 'instagram', 'timestamp_valid', 'Test', $2) 
         RETURNING posted_at`,
        [testAccountId, validDate]
      );
      
      expect(postResult.rows[0].posted_at).toBeInstanceOf(Date);
    });
  });

  describe('Array Validation', () => {
    test('should accept valid array types', async () => {
      const hashtags = ['tag1', 'tag2'];
      const mentions = ['@user1', '@user2'];
      
      const postResult = await client.query(
        `INSERT INTO posts (account_id, platform, post_id, content, hashtags, mentions) 
         VALUES ($1, 'instagram', 'array_valid', 'Test', $2, $3) 
         RETURNING hashtags, mentions`,
        [testAccountId, hashtags, mentions]
      );
      
      expect(Array.isArray(postResult.rows[0].hashtags)).toBe(true);
      expect(Array.isArray(postResult.rows[0].mentions)).toBe(true);
    });
  });

  describe('JSONB Validation', () => {
    test('should accept valid JSONB data', async () => {
      const metadata = { key: 'value', number: 123, nested: { data: 'test' } };
      
      const accountResult = await client.query(
        `INSERT INTO accounts (username, platform, metadata) 
         VALUES ('jsonb_valid', 'instagram', $1) 
         RETURNING metadata`,
        [JSON.stringify(metadata)]
      );
      
      const result = accountResult.rows[0].metadata;
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      expect(parsed.key).toBe('value');
      expect(parsed.number).toBe(123);
    });
  });
});

