require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("ALTER TABLE popup_ad ADD COLUMN IF NOT EXISTS description TEXT").then(() => { console.log('Updated'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
