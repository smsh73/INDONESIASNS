import pool from '../../src/config/database.js';

describe('Performance and Consistency Tests', () => {
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

  describe('Query Performance', () => {
    test('should use indexes for foreign key lookups', async () => {
      const explainResult = await client.query(
        `EXPLAIN (ANALYZE, BUFFERS) 
         SELECT * FROM posts WHERE account_id = 1`
      );

      const plan = explainResult.rows.map((r) => r['QUERY PLAN']).join('\n');
      expect(plan.toLowerCase()).toContain('index');
    });

    test('should use indexes for platform queries', async () => {
      const explainResult = await client.query(
        `EXPLAIN (ANALYZE, BUFFERS) 
         SELECT * FROM posts WHERE platform = 'instagram'`
      );

      const plan = explainResult.rows.map((r) => r['QUERY PLAN']).join('\n');
      expect(plan.toLowerCase()).toContain('index');
    });

    test('should use indexes for date range queries', async () => {
      const explainResult = await client.query(
        `EXPLAIN (ANALYZE, BUFFERS) 
         SELECT * FROM posts 
         WHERE posted_at >= NOW() - INTERVAL '7 days'`
      );

      const plan = explainResult.rows.map((r) => r['QUERY PLAN']).join('\n');
      expect(plan.toLowerCase()).toContain('index');
    });
  });

  describe('Concurrent Access Consistency', () => {
    test('should handle concurrent inserts correctly', async () => {
      await client.query('BEGIN');

      const accountResult = await client.query(
        `INSERT INTO accounts (username, platform) 
         VALUES ('concurrent_test', 'instagram') 
         RETURNING id`
      );
      const accountId = accountResult.rows[0].id;

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          client.query(
            `INSERT INTO posts (account_id, platform, post_id, content) 
             VALUES ($1, 'instagram', $2, 'Test')`,
            [accountId, `concurrent_post_${i}`]
          )
        );
      }

      await Promise.all(promises);

      const count = await client.query(
        'SELECT COUNT(*) as count FROM posts WHERE account_id = $1',
        [accountId]
      );
      expect(parseInt(count.rows[0].count)).toBe(5);

      await client.query('ROLLBACK');
    });
  });

  describe('Transaction Isolation', () => {
    test('should maintain isolation between transactions', async () => {
      await client.query('BEGIN');

      const accountResult = await client.query(
        `INSERT INTO accounts (username, platform) 
         VALUES ('isolation_test', 'instagram') 
         RETURNING id`
      );
      const accountId = accountResult.rows[0].id;

      const client2 = await pool.connect();
      await client2.query('BEGIN');

      const count1 = await client.query(
        'SELECT COUNT(*) as count FROM accounts WHERE username = $1',
        ['isolation_test']
      );
      expect(parseInt(count1.rows[0].count)).toBe(1);

      const count2 = await client2.query(
        'SELECT COUNT(*) as count FROM accounts WHERE username = $1',
        ['isolation_test']
      );
      expect(parseInt(count2.rows[0].count)).toBe(0);

      await client.query('ROLLBACK');
      await client2.query('ROLLBACK');
      client2.release();
    });
  });

  describe('Data Consistency Under Load', () => {
    test('should maintain referential integrity under concurrent operations', async () => {
      const accountResult = await client.query(
        `INSERT INTO accounts (username, platform) 
         VALUES ('load_test', 'instagram') 
         RETURNING id`
      );
      const accountId = accountResult.rows[0].id;

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          client.query(
            `INSERT INTO posts (account_id, platform, post_id, content) 
             VALUES ($1, 'instagram', $2, 'Test')`,
            [accountId, `load_post_${i}_${Date.now()}`]
          )
        );
      }

      await Promise.all(promises);

      const count = await client.query(
        'SELECT COUNT(*) as count FROM posts WHERE account_id = $1',
        [accountId]
      );
      expect(parseInt(count.rows[0].count)).toBe(10);

      const accountCheck = await client.query('SELECT * FROM accounts WHERE id = $1', [accountId]);
      expect(accountCheck.rows.length).toBe(1);

      await client.query('DELETE FROM posts WHERE account_id = $1', [accountId]);
      await client.query('DELETE FROM accounts WHERE id = $1', [accountId]);
    });
  });
});

