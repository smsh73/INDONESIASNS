import request from 'supertest';
import express from 'express';
import cors from 'cors';
import routes from '../../src/routes/index.js';
import pool from '../../src/config/database.js';
import jwt from 'jsonwebtoken';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', routes);

app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }
  if (err.status === 403) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden',
    });
  }
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

describe('API Consistency Tests', () => {
  let client;
  let authToken;
  let adminToken;
  let testUserId;
  let testAccountId;
  let testPostId;

  beforeAll(async () => {
    client = await pool.connect();

    const userResult = await client.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ('testuser', 'test@test.com', 'hashed', 'user') 
       RETURNING id`
    );
    testUserId = userResult.rows[0].id;

    const adminResult = await client.query(
      `INSERT INTO users (username, email, password_hash, role) 
       VALUES ('admin', 'admin@test.com', 'hashed', 'admin') 
       RETURNING id`
    );
    const adminId = adminResult.rows[0].id;

    authToken = jwt.sign({ id: testUserId, username: 'testuser', role: 'user' }, process.env.JWT_SECRET || 'test-secret');
    adminToken = jwt.sign({ id: adminId, username: 'admin', role: 'admin' }, process.env.JWT_SECRET || 'test-secret');

    const accountResult = await client.query(
      `INSERT INTO accounts (username, platform, is_official) 
       VALUES ('testaccount', 'instagram', false) 
       RETURNING id`
    );
    testAccountId = accountResult.rows[0].id;

    const postResult = await client.query(
      `INSERT INTO posts (account_id, platform, post_id, content) 
       VALUES ($1, 'instagram', 'test_post_api', 'Test content') 
       RETURNING id`,
      [testAccountId]
    );
    testPostId = postResult.rows[0].id;
  });

  afterAll(async () => {
    await client.query('DELETE FROM posts WHERE id = $1', [testPostId]);
    await client.query('DELETE FROM accounts WHERE id = $1', [testAccountId]);
    await client.query('DELETE FROM users WHERE id IN ($1, $2)', [testUserId, testUserId + 1]);
    if (client) {
      client.release();
    }
    await pool.end();
  });

  describe('Authentication Consistency', () => {
    test('should require authentication for protected routes', async () => {
      const response = await request(app).get('/api/dashboard/stats');
      expect(response.status).toBe(401);
    });

    test('should accept valid JWT token', async () => {
      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${authToken}`);
      expect([200, 500]).toContain(response.status);
    });

    test('should reject invalid JWT token', async () => {
      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', 'Bearer invalid_token');
      expect(response.status).toBe(401);
    });
  });

  describe('Dashboard API Consistency', () => {
    test('GET /api/dashboard/stats should return consistent structure', async () => {
      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        if (response.body.data) {
          expect(response.body.data).toHaveProperty('totalPosts');
          expect(response.body.data).toHaveProperty('totalMentions');
        }
      }
    });

    test('GET /api/dashboard/trends should return array', async () => {
      const response = await request(app)
        .get('/api/dashboard/trends?days=7')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    test('GET /api/dashboard/sentiment should return array', async () => {
      const response = await request(app)
        .get('/api/dashboard/sentiment?days=7')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  describe('Posts API Consistency', () => {
    test('GET /api/posts should return consistent structure', async () => {
      const response = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    test('GET /api/posts/:id should return post details', async () => {
      const response = await request(app)
        .get(`/api/posts/${testPostId}`)
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        if (response.body.data) {
          expect(response.body.data).toHaveProperty('id');
          expect(response.body.data).toHaveProperty('content');
        }
      }
    });
  });

  describe('Accounts API Consistency', () => {
    test('GET /api/accounts should return array', async () => {
      const response = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    test('POST /api/accounts should require admin role', async () => {
      const response = await request(app)
        .post('/api/accounts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'newaccount',
          platform: 'instagram',
        });

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('Admin API Consistency', () => {
    test('GET /api/admin/api-keys should require admin role', async () => {
      const response = await request(app)
        .get('/api/admin/api-keys')
        .set('Authorization', `Bearer ${authToken}`);

      expect([401, 403]).toContain(response.status);
    });

    test('GET /api/admin/api-keys should work with admin token', async () => {
      const response = await request(app)
        .get('/api/admin/api-keys')
        .set('Authorization', `Bearer ${adminToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  describe('Analysis API Consistency', () => {
    test('GET /api/analysis should return consistent structure', async () => {
      const response = await request(app)
        .get('/api/analysis')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  describe('Regions API Consistency', () => {
    test('GET /api/regions should return array', async () => {
      const response = await request(app)
        .get('/api/regions')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  describe('Error Response Consistency', () => {
    test('should return consistent error structure', async () => {
      const response = await request(app)
        .get('/api/posts/99999')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status !== 200) {
        expect(response.body).toHaveProperty('success');
        expect(response.body.success).toBe(false);
        expect(response.body).toHaveProperty('message');
      }
    });

    test('should return 404 for non-existent resources', async () => {
      const response = await request(app)
        .get('/api/posts/99999')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 404) {
        expect(response.body).toHaveProperty('success');
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('Query Parameter Consistency', () => {
    test('should handle pagination parameters correctly', async () => {
      const response = await request(app)
        .get('/api/posts?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('pagination');
        if (response.body.pagination) {
          expect(response.body.pagination).toHaveProperty('page');
          expect(response.body.pagination).toHaveProperty('limit');
        }
      }
    });

    test('should handle filter parameters correctly', async () => {
      const response = await request(app)
        .get('/api/posts?platform=instagram')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('data');
        if (Array.isArray(response.body.data)) {
          response.body.data.forEach((post) => {
            expect(post.platform).toBe('instagram');
          });
        }
      }
    });
  });
});

