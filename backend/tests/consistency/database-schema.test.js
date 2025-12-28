import pool from '../../src/config/database.js';

describe('Database Schema Consistency Tests', () => {
  let client;

  beforeAll(async () => {
    client = await pool.connect();
  });

  afterAll(async () => {
    if (client) {
      client.release();
    }
    await pool.end();
  });

  describe('Table Existence', () => {
    const requiredTables = [
      'users',
      'regions',
      'locations',
      'accounts',
      'posts',
      'mentions',
      'sentiment_analysis',
      'risk_classification',
      'alerts',
      'analytics_summary',
      'collection_jobs',
      'trends',
      'influential_users',
      'workflows',
      'workflow_executions',
      'api_keys',
      'monitoring_keywords',
      'monitoring_hashtags',
      'countries',
      'map_data',
    ];

    test.each(requiredTables)('should have table: %s', async (tableName) => {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [tableName]
      );
      expect(result.rows[0].exists).toBe(true);
    });
  });

  describe('Foreign Key Constraints', () => {
    test('posts.account_id should reference accounts.id', async () => {
      const result = await client.query(`
        SELECT 
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'posts'
          AND kcu.column_name = 'account_id'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].foreign_table_name).toBe('accounts');
      expect(result.rows[0].foreign_column_name).toBe('id');
    });

    test('mentions.post_id should reference posts.id', async () => {
      const result = await client.query(`
        SELECT 
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'mentions'
          AND kcu.column_name = 'post_id'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].foreign_table_name).toBe('posts');
    });

    test('sentiment_analysis.post_id should reference posts.id', async () => {
      const result = await client.query(`
        SELECT 
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'sentiment_analysis'
          AND kcu.column_name = 'post_id'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].foreign_table_name).toBe('posts');
    });

    test('risk_classification.post_id should reference posts.id', async () => {
      const result = await client.query(`
        SELECT 
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'risk_classification'
          AND kcu.column_name = 'post_id'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].foreign_table_name).toBe('posts');
    });

    test('locations.region_id should reference regions.id', async () => {
      const result = await client.query(`
        SELECT 
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'locations'
          AND kcu.column_name = 'region_id'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].foreign_table_name).toBe('regions');
    });

    test('regions.country_id should reference countries.id', async () => {
      const result = await client.query(`
        SELECT 
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'regions'
          AND kcu.column_name = 'country_id'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].foreign_table_name).toBe('countries');
    });
  });

  describe('Check Constraints', () => {
    test('users.role should have CHECK constraint', async () => {
      const result = await client.query(`
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%role%'
          AND constraint_schema = 'public'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });

    test('accounts.platform should have CHECK constraint', async () => {
      const result = await client.query(`
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%platform%'
          AND constraint_schema = 'public'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });

    test('sentiment_analysis.sentiment_category should have CHECK constraint', async () => {
      const result = await client.query(`
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%sentiment_category%'
          AND constraint_schema = 'public'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });

    test('risk_classification.risk_level should have CHECK constraint', async () => {
      const result = await client.query(`
        SELECT constraint_name, check_clause
        FROM information_schema.check_constraints
        WHERE constraint_name LIKE '%risk_level%'
          AND constraint_schema = 'public'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Indexes', () => {
    test('should have indexes on foreign keys', async () => {
      const result = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND (
            indexname LIKE 'idx_posts_account%' OR
            indexname LIKE 'idx_mentions_post%' OR
            indexname LIKE 'idx_sentiment_post%' OR
            indexname LIKE 'idx_risk_post%' OR
            indexname LIKE 'idx_locations_region%'
          )
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });

    test('should have indexes on frequently queried columns', async () => {
      const result = await client.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND (
            indexname LIKE 'idx_posts_platform%' OR
            indexname LIKE 'idx_posts_posted_at%' OR
            indexname LIKE 'idx_accounts_platform%' OR
            indexname LIKE 'idx_sentiment_category%' OR
            indexname LIKE 'idx_risk_category%'
          )
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Unique Constraints', () => {
    test('users.username should be unique', async () => {
      const result = await client.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'users'
          AND constraint_type = 'UNIQUE'
          AND constraint_name LIKE '%username%'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });

    test('users.email should be unique', async () => {
      const result = await client.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'users'
          AND constraint_type = 'UNIQUE'
          AND constraint_name LIKE '%email%'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });

    test('posts.post_id should be unique', async () => {
      const result = await client.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'posts'
          AND constraint_type = 'UNIQUE'
          AND constraint_name LIKE '%post_id%'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });

    test('countries.name should be unique', async () => {
      const result = await client.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'countries'
          AND constraint_type = 'UNIQUE'
          AND constraint_name LIKE '%name%'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Data Types', () => {
    test('posts.like_count should be INTEGER', async () => {
      const result = await client.query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'posts'
          AND column_name = 'like_count'
      `);
      expect(result.rows[0].data_type).toBe('integer');
    });

    test('sentiment_analysis.confidence_score should be DECIMAL', async () => {
      const result = await client.query(`
        SELECT data_type, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_name = 'sentiment_analysis'
          AND column_name = 'confidence_score'
      `);
      expect(result.rows[0].data_type).toBe('numeric');
      expect(result.rows[0].numeric_precision).toBe(5);
      expect(result.rows[0].numeric_scale).toBe(4);
    });

    test('users.id should be UUID', async () => {
      const result = await client.query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = 'id'
      `);
      expect(result.rows[0].data_type).toBe('uuid');
    });
  });
});

