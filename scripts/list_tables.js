require('dotenv').config();
const { Pool } = require('pg');

(async ()=>{
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No DATABASE_URL in environment');
    process.exit(1);
  }
  const pool = new Pool({ connectionString });
  try {
    const res = await pool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name");
    console.log('Tables in DB:');
    for (const row of res.rows) {
      console.log(`${row.table_schema}.${row.table_name}`);
    }
  } catch (e) {
    console.error('ERROR querying DB:', e.message || e);
  } finally {
    await pool.end();
  }
})();
