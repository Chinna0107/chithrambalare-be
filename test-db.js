require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query('SELECT * FROM popup_ad').then(res => { console.log(JSON.stringify(res.rows, null, 2)); process.exit(0); }).catch(err => { console.error(err); process.exit(1); });
