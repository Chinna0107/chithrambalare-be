const express = require('express');
const router = express.Router();
const { pool, readDb, writeDb } = require('../config/db.js');
const { requireEmployeeOrAdmin } = require('../middlewares/auth.js');

router.get('/', async (req, res) => {
  if (pool) {
    try {
      // Check if table exists, since we haven't added it to initDb yet.
      // Alternatively, we just query it assuming it will be created.
      const result = await pool.query('SELECT * FROM telugu_news ORDER BY id DESC');
      return res.json(result.rows);
    } catch (e) {
      if (e.code === '42P01') { // undefined_table
        await pool.query(`
          CREATE TABLE telugu_news (
            id SERIAL PRIMARY KEY,
            title TEXT,
            content TEXT,
            source TEXT,
            author TEXT,
            date TEXT
          )
        `);
        return res.json([]);
      }
      console.error('PG get telugu news failed:', e.message);
      return res.status(500).json({ error: 'Failed to fetch telugu news' });
    }
  }
  const db = readDb();
  res.json(db.teluguNews || []);
});

router.post('/', requireEmployeeOrAdmin, async (req, res) => {
  const { title, content, source, author } = req.body;
  const dateStr = new Date().toISOString();
  
  if (pool) {
    try {
      await pool.query('CREATE TABLE IF NOT EXISTS telugu_news (id SERIAL PRIMARY KEY, title TEXT, content TEXT, source TEXT, author TEXT, date TEXT)');
      const result = await pool.query(
        'INSERT INTO telugu_news (title, content, source, author, date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [title, content, source, author, dateStr]
      );
      return res.json({ success: true, item: result.rows[0] });
    } catch (e) {
      console.error('PG create telugu news failed:', e.message);
      return res.status(500).json({ error: 'Failed to create telugu news' });
    }
  }

  const db = readDb();
  if (!db.teluguNews) db.teluguNews = [];
  const newItem = { id: Date.now(), title, content, source, author, date: dateStr };
  db.teluguNews.push(newItem);
  writeDb(db);
  res.json({ success: true, item: newItem });
});

router.put('/:id', requireEmployeeOrAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, content, source, author } = req.body;
  if (pool) {
    try {
      const result = await pool.query(
        'UPDATE telugu_news SET title=$1, content=$2, source=$3, author=$4 WHERE id=$5 RETURNING *',
        [title, content, source, author, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      return res.json({ success: true });
    } catch (e) {
      console.error('PG update telugu news failed:', e.message);
      return res.status(500).json({ error: 'Failed to update' });
    }
  }
  const db = readDb();
  const idx = (db.teluguNews || []).findIndex(n => String(n.id) === String(id));
  if (idx >= 0) {
    db.teluguNews[idx] = { ...db.teluguNews[idx], ...req.body };
    writeDb(db);
  }
  res.json({ success: true });
});

router.delete('/:id', requireEmployeeOrAdmin, async (req, res) => {
  const { id } = req.params;
  if (pool) {
    try {
      await pool.query('DELETE FROM telugu_news WHERE id=$1', [id]);
      return res.json({ success: true });
    } catch (e) {
      console.error('PG delete telugu news failed:', e.message);
      return res.status(500).json({ error: 'Failed to delete' });
    }
  }
  const db = readDb();
  db.teluguNews = (db.teluguNews || []).filter(n => String(n.id) !== String(id));
  writeDb(db);
  res.json({ success: true });
});

module.exports = router;
