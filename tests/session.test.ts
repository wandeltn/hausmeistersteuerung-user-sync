import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

// Simple integration tests for session store

describe('Postgres session store', () => {
  let pool: Pool;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required for tests');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // verify connection
    await pool.query('SELECT 1');
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('session table exists', async () => {
    const res = await pool.query(`SELECT to_regclass('public.session') as exists`);
    expect(res.rows[0].exists).toBeTruthy();
  });

  it('can create a session and it is persisted', async () => {
    const app = express();
    const PgStore = connectPgSimple(session as any);
    app.use(session({
      store: new PgStore({ pool }),
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 60_000 }
    }) as any);

    app.get('/set', (req, res) => {
      req.session.test = 'ok';
      req.session.save(() => res.json({ ok: true }));
    });

    const agent = request.agent(app);
    const r = await agent.get('/set');
    expect(r.status).toBe(200);

    // find session cookie and get sid value
    const cookie = r.headers['set-cookie']?.find((c: string) => c.startsWith('connect.sid'));
    expect(cookie).toBeDefined();

    // read sessions table to find at least one row
    const q = await pool.query(`SELECT sid, sess FROM public.session ORDER BY expire DESC LIMIT 1`);
    expect(q.rows.length).toBeGreaterThan(0);
    expect(q.rows[0].sess).toBeDefined();
  });
});
