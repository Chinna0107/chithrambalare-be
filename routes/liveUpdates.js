const express = require('express');
const router = express.Router();
const { pool, readDb, writeDb } = require('../config/db.js');
const { requireEmployeeOrAdmin } = require('../middlewares/auth.js');
const { getCachedData, setCachedData } = require('../utils/helpers.js');

// Helper to sort posts by date
const sortPosts = (posts) => [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));

router.get('/', async (req, res) => {
  const category = req.query.category;
  const search = req.query.search;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  if (pool) {
    try {
      let countQuery = 'SELECT COUNT(*) FROM live_updates';
      let query = 'SELECT id, slug, title, excerpt, content, thumbnail, featured_image, date, category, author, tags, views, seo_title, meta_description, focus_keyword, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_card, schema_markup, breadcrumb, robots, show_above_banner FROM live_updates';
      const params = [];
      const conditions = [];
      
      if (category) {
        params.push(`%${category.toLowerCase().trim()}%`);
        conditions.push(`(LOWER(category) LIKE $${params.length})`);
      } else {
        // Exclude Box Office live_updates from default feed
        conditions.push(`(LOWER(category) NOT LIKE '%box office%' OR category IS NULL)`);
      }
      
      if (search) {
        params.push(`%${search.toLowerCase().trim()}%`);
        conditions.push(`(LOWER(title) LIKE $${params.length} OR LOWER(excerpt) LIKE $${params.length})`);
      }
      
      if (conditions.length > 0) {
        const whereClause = ' WHERE ' + conditions.join(' AND ');
        countQuery += whereClause;
        query += whereClause;
      }
      
      query += ` ORDER BY date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);
      
      const result = await pool.query(query, [...params, limit, offset]);
      const posts = result.rows.map(r => ({
        id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt,
        content: r.content,
        thumbnail: r.thumbnail, featuredImage: r.featured_image, date: r.date,
        category: r.category, author: r.author, tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags, views: r.views || 0,
        seoTitle: r.seo_title, metaDescription: r.meta_description, focusKeyword: r.focus_keyword, metaKeywords: r.meta_keywords, canonicalUrl: r.canonical_url, ogTitle: r.og_title, ogDescription: r.og_description, ogImage: r.og_image, twitterCard: r.twitter_card, schemaMarkup: typeof r.schema_markup === 'string' ? JSON.parse(r.schema_markup) : r.schema_markup, breadcrumb: r.breadcrumb, robots: r.robots, showAboveBanner: r.show_above_banner
      }));
      
      return res.json({ 
        data: posts, 
        total, 
        page, 
        totalPages: Math.ceil(total / limit) 
      });
    } catch (e) {
      console.error('PG Live Updates query failed, falling back to file:', e.message);
    }
  }
  
  const db = readDb();
  let posts = db.liveUpdates || [];
  if (category) {
    const cat = category.toLowerCase().trim();
    posts = posts.filter(a => 
      (a.category && a.category.toLowerCase().includes(cat))
    );
  } else {
    // Exclude Box Office from local fallback default feed
    posts = posts.filter(a => !a.category || !a.category.toLowerCase().includes('box office'));
  }
  if (search) {
    const s = search.toLowerCase().trim();
    posts = posts.filter(p => p.title.toLowerCase().includes(s) || p.excerpt.toLowerCase().includes(s));
  }
  
  posts = sortPosts(posts);
  const total = posts.length;
  const paginatedPosts = posts.slice(offset, offset + limit);
  
  return res.json({ 
    data: paginatedPosts, 
    total, 
    page, 
    totalPages: Math.ceil(total / limit) 
  });
});

router.get('/active/banner', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query("SELECT * FROM live_updates WHERE show_above_banner = true AND status = 'published' ORDER BY date DESC LIMIT 1");
      if (result.rows.length > 0) {
        const r = result.rows[0];
        return res.json({
          id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt,
          content: r.content, thumbnail: r.thumbnail, date: r.date,
          category: r.category, author: r.author, showAboveBanner: r.show_above_banner
        });
      }
      return res.json(null);
    } catch (e) {
      console.error('PG Active Live Update lookup failed:', e.message);
    }
  }
  const db = readDb();
  let posts = db.liveUpdates || [];
  posts = sortPosts(posts).filter(p => p.showAboveBanner && p.status !== 'draft');
  return res.json(posts.length > 0 ? posts[0] : null);
});

router.get('/:slug', async (req, res) => {
  const slug = req.params.slug;

  if (pool) {
    try {
      const result = await pool.query('UPDATE live_updates SET views = COALESCE(views, 0) + 1 WHERE slug = $1 RETURNING id, slug, title, excerpt, content, thumbnail, featured_image, date, category, author, tags, views, seo_title, meta_description, focus_keyword, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_card, schema_markup, breadcrumb, robots, show_above_banner', [slug]);
      if (result.rows.length > 0) {
        const r = result.rows[0];
        return res.json({
          id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt,
          content: r.content,
          thumbnail: r.thumbnail, featuredImage: r.featured_image, date: r.date,
          category: r.category, author: r.author, tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags, views: r.views || 0,
          seoTitle: r.seo_title, metaDescription: r.meta_description, focusKeyword: r.focus_keyword, metaKeywords: r.meta_keywords, canonicalUrl: r.canonical_url, ogTitle: r.og_title, ogDescription: r.og_description, ogImage: r.og_image, twitterCard: r.twitter_card, schemaMarkup: typeof r.schema_markup === 'string' ? JSON.parse(r.schema_markup) : r.schema_markup, breadcrumb: r.breadcrumb, robots: r.robots, showAboveBanner: r.show_above_banner
        });
      }
    } catch (e) {
      console.error('PG Live Update detail lookup failed:', e.message);
    }
  }
  const db = readDb();
  const index = (db.liveUpdates || []).findIndex(a => a.slug === slug);
  if (index === -1) return res.status(404).json({ error: 'Live Update not found' });
  db.liveUpdates[index].views = (db.liveUpdates[index].views || 0) + 1;
  writeDb(db);
  return res.json(db.liveUpdates[index]);
});

// Admin: Bulk replace (wrapped in transaction)
router.post('/bulk', requireEmployeeOrAdmin, async (req, res) => {
  const list = req.body;
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: 'Request body must be an array' });
  }
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM live_updates');
      for (const a of list) {
        await client.query(
          'INSERT INTO live_updates (id, slug, title, excerpt, content, thumbnail, featured_image, date, category, author, tags, seo_title, meta_description, focus_keyword, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_card, schema_markup, breadcrumb, robots, show_above_banner) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)',
          [ String(a.id), a.slug, a.title, a.excerpt, JSON.stringify(a.content || ''), a.thumbnail, a.featuredImage, a.date || new Date().toISOString(), a.category, a.author, JSON.stringify(a.tags || []), a.seoTitle, a.metaDescription, a.focusKeyword, a.metaKeywords, a.canonicalUrl, a.ogTitle, a.ogDescription, a.ogImage, a.twitterCard, JSON.stringify(a.schemaMarkup || {}), a.breadcrumb, a.robots || 'index,follow', a.showAboveBanner === true || String(a.showAboveBanner).toLowerCase() === 'true' ]
        );
      }
      await client.query('COMMIT');
      return res.json({ success: true });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('PG Live Updates bulk insert failed:', e.message);
      return res.status(500).json({ error: 'Failed to save live_updates' });
    } finally {
      client.release();
    }
  }
  try {
    const db = readDb(); db.liveUpdates = req.body; writeDb(db); res.json({ success: true, live_updates: db.liveUpdates });
  } catch (err) {
    console.error('Failed to save live_updates to JSON:', err.message);
    res.status(500).json({ error: 'Failed to save live_updates' });
  }
});

// Admin: Add Single (with validation)
router.post('/', requireEmployeeOrAdmin, async (req, res) => {
  const a = req.body;
  if (!a.title || !a.slug) {
    return res.status(400).json({ error: 'Missing required fields: title, slug' });
  }
  const newId = a.id ? String(a.id) : Date.now().toString();
  if (pool) {
    try {
      await pool.query('INSERT INTO live_updates (id, slug, title, excerpt, content, thumbnail, featured_image, date, category, author, tags, seo_title, meta_description, focus_keyword, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_card, schema_markup, breadcrumb, robots, show_above_banner) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)',
        [ newId, a.slug, a.title, a.excerpt, JSON.stringify(a.content || ''), a.thumbnail, a.featuredImage, a.date || new Date().toISOString(), a.category, a.author, JSON.stringify(a.tags || []), a.seoTitle, a.metaDescription, a.focusKeyword, a.metaKeywords, a.canonicalUrl, a.ogTitle, a.ogDescription, a.ogImage, a.twitterCard, JSON.stringify(a.schemaMarkup || {}), a.breadcrumb, a.robots || 'index,follow', a.showAboveBanner === true || String(a.showAboveBanner).toLowerCase() === 'true' ]);
      return res.json({ success: true, id: newId });
    } catch (e) {
      console.error('PG Live Update insert failed:', e.message);
      return res.status(500).json({ error: 'Failed to insert article' });
    }
  }
  try {
    const db = readDb(); if (!db.liveUpdates) db.liveUpdates = []; db.liveUpdates.push({ ...a, id: newId, date: a.date || new Date().toISOString() }); writeDb(db); res.json({ success: true, id: newId });
  } catch (err) {
    console.error('Failed to insert article to JSON:', err.message);
    res.status(500).json({ error: 'Failed to insert article' });
  }
});

// Admin: Edit Single (with rowCount check)
router.put('/:id', requireEmployeeOrAdmin, async (req, res) => {
  const id = req.params.id; const a = req.body;
  if (pool) {
    try {
      const result = await pool.query('UPDATE live_updates SET slug=$1, title=$2, excerpt=$3, content=$4, thumbnail=$5, featured_image=$6, date=$7, category=$8, author=$9, tags=$10, seo_title=$11, meta_description=$12, focus_keyword=$13, meta_keywords=$14, canonical_url=$15, og_title=$16, og_description=$17, og_image=$18, twitter_card=$19, schema_markup=$20, breadcrumb=$21, robots=$22, show_above_banner=$23 WHERE id=$24',
        [ a.slug, a.title, a.excerpt, JSON.stringify(a.content || ''), a.thumbnail, a.featuredImage, a.date || new Date().toISOString(), a.category, a.author, JSON.stringify(a.tags || []), a.seoTitle, a.metaDescription, a.focusKeyword, a.metaKeywords, a.canonicalUrl, a.ogTitle, a.ogDescription, a.ogImage, a.twitterCard, JSON.stringify(a.schemaMarkup || {}), a.breadcrumb, a.robots || 'index,follow', a.showAboveBanner === true || String(a.showAboveBanner).toLowerCase() === 'true', id ]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Live Update not found' });
      }
      return res.json({ success: true });
    } catch (e) {
      console.error('PG Live Update update failed:', e.message);
      return res.status(500).json({ error: 'Failed to update article' });
    }
  }
  try {
    const db = readDb(); const index = (db.liveUpdates || []).findIndex(art => String(art.id) === id);
    if (index === -1) return res.status(404).json({ error: 'Live Update not found' });
    db.liveUpdates[index] = { ...db.liveUpdates[index], ...a, id }; writeDb(db); res.json({ success: true });
  } catch (err) {
    console.error('Failed to update article in JSON:', err.message);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

// Admin: Delete Single (with rowCount check)
router.delete('/:id', requireEmployeeOrAdmin, async (req, res) => {
  const id = req.params.id;
  if (pool) {
    try {
      const result = await pool.query('DELETE FROM live_updates WHERE id=$1', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Live Update not found' });
      }
      return res.json({ success: true });
    } catch (e) {
      console.error('PG Live Update delete failed:', e.message);
      return res.status(500).json({ error: 'Failed to delete article' });
    }
  }
  try {
    const db = readDb(); db.liveUpdates = (db.liveUpdates || []).filter(art => String(art.id) !== id); writeDb(db); res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete article from JSON:', err.message);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

module.exports = router;
