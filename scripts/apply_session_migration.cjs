require('dotenv').config();
const { readFileSync } = require('fs');
const { Pool } = require('pg');

(async ()=>{
  const sql = readFileSync('./migrations/0001_create_sessions.sql', 'utf8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Applying session migration...');
    await pool.query(sql);
    console.log('Session migration applied successfully.');
  } catch (e) {
    console.error('ERROR applying migration:', e.message || e);
  } finally {
    await pool.end();
  }
})();
