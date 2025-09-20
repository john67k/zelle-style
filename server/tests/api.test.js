const request = require('supertest');
const app = require('../app');

describe('API Health Check', () => {
  test('GET /health should return 200', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'OK');
    expect(response.body).toHaveProperty('timestamp');
  });
});

describe('Authentication Endpoints', () => {
  test('POST /api/auth/register should require all fields', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com'
        // Missing phone and password
      })
      .expect(400);
    
    expect(response.body).toHaveProperty('error');
  });

  test('POST /api/auth/login should require credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({})
      .expect(400);
    
    expect(response.body).toHaveProperty('error');
  });
});

describe('Transaction Endpoints', () => {
  test('POST /api/transactions/send should require authentication', async () => {
    const response = await request(app)
      .post('/api/transactions/send')
      .send({
        recipientEmail: 'recipient@example.com',
        amount: 50.00
      })
      .expect(401);
    
    expect(response.body).toHaveProperty('error', 'Access token required');
  });

  test('GET /api/transactions/history should require authentication', async () => {
    const response = await request(app)
      .get('/api/transactions/history')
      .expect(401);
    
    expect(response.body).toHaveProperty('error', 'Access token required');
  });
});

describe('Admin Endpoints', () => {
  test('GET /api/admin/emails/stats should require authentication', async () => {
    const response = await request(app)
      .get('/api/admin/emails/stats')
      .expect(401);
    
    expect(response.body).toHaveProperty('error', 'Access token required');
  });
});

describe('Rate Limiting', () => {
  test('should enforce rate limits on auth endpoints', async () => {
    // Make multiple requests quickly
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'password' })
      );
    }
    
    const responses = await Promise.all(promises);
    
    // At least one should be rate limited
    const rateLimitedResponses = responses.filter(res => res.status === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });
});