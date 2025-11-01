#!/usr/bin/env node
import 'dotenv/config';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set in environment');
  process.exit(2);
}

console.log('Testing DB connection to:', connectionString.replace(/:\/\/.+?:.+?@/, '://<user>:<pass>@'));

const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });
client.connect()
  .then(() => client.query('SELECT version()'))
  .then(res => {
    console.log('Connected to DB, server version:', res.rows[0].version);
    return client.end();
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error('DB connection error:');
    console.error(err);
    client.end().finally(() => process.exit(1));
  });
