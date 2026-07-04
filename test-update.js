require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query("UPDATE popup_ad SET carousel_items = '[{\"imageUrl\":\"test.jpg\",\"redirectUrl\":\"#\",\"timer\":3}]'").then(() => { console.log('Updated'); process.exit(0); });
