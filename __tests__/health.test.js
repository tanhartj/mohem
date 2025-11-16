import request from 'supertest';
import express from 'express';
import { getHealthStatus } from '../utils/healthChecks.js';

describe('Health Endpoint', () => {
  let app;
  
  beforeAll(() => {
    app = express();
    app.get('/healthz', async (req, res) => {
      const health = await getHealthStatus();
      const statusCode = health.status === 'ok' ? 200 : 503;
      res.status(statusCode).json(health);
    });
  });
  
  test('should respond to health check', async () => {
    const response = await request(app).get('/healthz');
    
    expect([200, 503]).toContain(response.status);
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('services');
  });
});
