const express = require('express');
const router = express.Router();
const { pool, readDb, writeDb } = require('../config/db.js');
const { requireEmployeeOrAdmin } = require('../middlewares/auth.js');

const migrateTable = async () => {
  // Create base table if missing
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telugu_news (
      id SERIAL PRIMARY KEY,
      title TEXT,
      content TEXT,
      source TEXT,
      author TEXT,
      date TEXT
    )
  `);
  // Add new columns if they don't exist (safe on existing tables)
  const newCols = [
    "slug TEXT",
    "excerpt TEXT",
    "thumbnail TEXT",
    "category TEXT DEFAULT 'Telugu News'",
    "tags TEXT",
    "status TEXT DEFAULT 'published'",
    "seo_title TEXT",
    "meta_description TEXT",
    "focus_keyword TEXT",
    "meta_keywords TEXT",
    "canonical_url TEXT",
    "og_title TEXT",
    "og_description TEXT",
    "og_image TEXT",
    "twitter_card TEXT DEFAULT 'summary_large_image'",
    "robots TEXT DEFAULT 'index,follow'"
  ];
  for (const col of newCols) {
    await pool.query(`ALTER TABLE telugu_news ADD COLUMN IF NOT EXISTS ${col}`).catch(() => {});
  }
};

router.get('/', async (req, res) => {
  if (pool) {
    try {
      await migrateTable();
      const { slug, status, limit, offset } = req.query;
      let query = 'SELECT * FROM telugu_news';
      const params = [];
      const conditions = [];
      if (slug) { params.push(slug); conditions.push(`slug=$${params.length}`); }
      if (status) { params.push(status); conditions.push(`status=$${params.length}`); }
      if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
      query += ' ORDER BY id DESC';
      if (limit) { params.push(parseInt(limit)); query += ` LIMIT $${params.length}`; }
      if (offset) { params.push(parseInt(offset)); query += ` OFFSET $${params.length}`; }
      const result = await pool.query(query, params);
      return res.json(result.rows.map(r => ({
        ...r,
        tags: r.tags ? r.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        seoTitle: r.seo_title,
        metaDescription: r.meta_description,
        focusKeyword: r.focus_keyword,
        metaKeywords: r.meta_keywords,
        canonicalUrl: r.canonical_url,
        ogTitle: r.og_title,
        ogDescription: r.og_description,
        ogImage: r.og_image,
        twitterCard: r.twitter_card,
        featuredImage: r.thumbnail,
      })));
    } catch (e) {
      console.error('PG get telugu news failed:', e.message);
      return res.status(500).json({ error: 'Failed to fetch telugu news' });
    }
  }
  const db = readDb();
  res.json(db.teluguNews || []);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (pool) {
    try {
      await migrateTable();
      const isSlug = isNaN(parseInt(id));
      const col = isSlug ? 'slug' : 'id';
      const result = await pool.query(`SELECT * FROM telugu_news WHERE ${col}=$1 LIMIT 1`, [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      const r = result.rows[0];
      return res.json({
        ...r,
        tags: r.tags ? r.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        seoTitle: r.seo_title,
        metaDescription: r.meta_description,
        focusKeyword: r.focus_keyword,
        metaKeywords: r.meta_keywords,
        canonicalUrl: r.canonical_url,
        ogTitle: r.og_title,
        ogDescription: r.og_description,
        ogImage: r.og_image,
        twitterCard: r.twitter_card,
        featuredImage: r.thumbnail,
      });
    } catch (e) {
      console.error('PG get telugu news by id failed:', e.message);
      return res.status(500).json({ error: 'Failed to fetch' });
    }
  }
  const db = readDb();
  const item = (db.teluguNews || []).find(n => String(n.id) === String(id) || n.slug === id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.post('/', requireEmployeeOrAdmin, async (req, res) => {
  const b = req.body;
  const dateStr = b.date || new Date().toISOString();
  const tags = Array.isArray(b.tags) ? b.tags.join(',') : (b.tags || '');

  if (pool) {
    try {
      await migrateTable();
      const result = await pool.query(
        `INSERT INTO telugu_news 
          (slug, title, excerpt, content, thumbnail, source, author, category, tags, status, date,
           seo_title, meta_description, focus_keyword, meta_keywords, canonical_url,
           og_title, og_description, og_image, twitter_card, robots)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
         RETURNING *`,
        [b.slug, b.title, b.excerpt, b.content, b.thumbnail, b.source, b.author,
         b.category || 'Telugu News', tags, b.status || 'published', dateStr,
         b.seoTitle, b.metaDescription, b.focusKeyword, b.metaKeywords, b.canonicalUrl,
         b.ogTitle, b.ogDescription, b.ogImage, b.twitterCard || 'summary_large_image', b.robots || 'index,follow']
      );
      return res.json({ success: true, item: result.rows[0] });
    } catch (e) {
      console.error('PG create telugu news failed:', e.message);
      return res.status(500).json({ error: 'Failed to create telugu news' });
    }
  }

  const db = readDb();
  if (!db.teluguNews) db.teluguNews = [];
  const newItem = { id: Date.now(), ...b, date: dateStr };
  db.teluguNews.push(newItem);
  writeDb(db);
  res.json({ success: true, item: newItem });
});

router.put('/:id', requireEmployeeOrAdmin, async (req, res) => {
  const { id } = req.params;
  const b = req.body;
  const tags = Array.isArray(b.tags) ? b.tags.join(',') : (b.tags || '');

  if (pool) {
    try {
      const result = await pool.query(
        `UPDATE telugu_news SET
          slug=$1, title=$2, excerpt=$3, content=$4, thumbnail=$5, source=$6, author=$7,
          category=$8, tags=$9, status=$10, date=$11,
          seo_title=$12, meta_description=$13, focus_keyword=$14, meta_keywords=$15, canonical_url=$16,
          og_title=$17, og_description=$18, og_image=$19, twitter_card=$20, robots=$21
         WHERE id=$22 RETURNING *`,
        [b.slug, b.title, b.excerpt, b.content, b.thumbnail, b.source, b.author,
         b.category || 'Telugu News', tags, b.status || 'published', b.date,
         b.seoTitle, b.metaDescription, b.focusKeyword, b.metaKeywords, b.canonicalUrl,
         b.ogTitle, b.ogDescription, b.ogImage, b.twitterCard || 'summary_large_image', b.robots || 'index,follow',
         id]
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
    db.teluguNews[idx] = { ...db.teluguNews[idx], ...b };
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
