import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const res = await client.query("select tablename from pg_catalog.pg_tables where schemaname='public' order by tablename");
  console.log('public tables:', res.rows.map(r => r.tablename));
} catch (err) {
  console.error('error listing tables:', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
