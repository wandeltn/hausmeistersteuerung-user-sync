import { test, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../server/routes';

test('GET /api/me returns null when unauthenticated', async () => {
  const app = express();
  app.use(express.json());
  const server = await registerRoutes(app);
  const res = await request(server).get('/api/me');
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('user');
  expect(res.body.user).toBeNull();
});
