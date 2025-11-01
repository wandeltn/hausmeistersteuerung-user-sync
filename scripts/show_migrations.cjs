require('dotenv').config();
const { Pool } = require('pg');

(async ()=>{
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query(`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`);
    console.log('drizzle.__drizzle_migrations rows:');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error('ERROR querying migrations table:', e.message || e);
  } finally {
    await pool.end();
  }
})();
