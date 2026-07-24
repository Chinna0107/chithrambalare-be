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
      let countQuery = 'SELECT COUNT(*) FROM articles';
      let query = 'SELECT id, slug, title, excerpt, content, thumbnail, featured_image, date, category, author, tags, views, seo_title, meta_description, focus_keyword, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_card, schema_markup, breadcrumb, robots FROM articles';
      const params = [];
      const conditions = [];
      
      if (category) {
        const cats = category.split(',').map(c => c.toLowerCase().trim()).filter(Boolean);
        if (cats.length === 1) {
          params.push(`%${cats[0]}%`);
          conditions.push(`(LOWER(category) LIKE $${params.length})`);
        } else {
          const catConditions = cats.map(c => {
            params.push(`%${c}%`);
            return `LOWER(category) LIKE $${params.length}`;
          });
          conditions.push(`(${catConditions.join(' OR ')})`);
        }
      } else {
        // Include all articles in default feed
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
      
      query += ` ORDER BY SUBSTRING(date FROM 1 FOR 10) DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);
      
      const result = await pool.query(query, [...params, limit, offset]);
      const posts = result.rows.map(r => ({
        id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt,
        content: r.content,
        thumbnail: r.thumbnail, featuredImage: r.featured_image, date: r.date,
        category: r.category, author: r.author, tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags, views: r.views || 0,
        seoTitle: r.seo_title, metaDescription: r.meta_description, focusKeyword: r.focus_keyword, metaKeywords: r.meta_keywords, canonicalUrl: r.canonical_url, ogTitle: r.og_title, ogDescription: r.og_description, ogImage: r.og_image, twitterCard: r.twitter_card, schemaMarkup: typeof r.schema_markup === 'string' ? JSON.parse(r.schema_markup) : r.schema_markup, breadcrumb: r.breadcrumb, robots: r.robots
      }));
      
      return res.json({ 
        data: posts, 
        total, 
        page, 
        totalPages: Math.ceil(total / limit) 
      });
    } catch (e) {
      console.error('PG Articles query failed, falling back to file:', e.message);
    }
  }
  
  const db = readDb();
  let posts = db.articles || [];
  if (category) {
    const cats = category.split(',').map(c => c.toLowerCase().trim()).filter(Boolean);
    posts = posts.filter(a => 
      a.category && cats.some(cat => a.category.toLowerCase().includes(cat))
    );
  } else {
    // Include all articles
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

router.get('/:slug', async (req, res) => {
  const slug = req.params.slug;

  if (pool) {
    try {
      const result = await pool.query('UPDATE articles SET views = COALESCE(views, 0) + 1 WHERE slug = $1 RETURNING id, slug, title, excerpt, content, thumbnail, featured_image, date, category, author, tags, views, seo_title, meta_description, focus_keyword, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_card, schema_markup, breadcrumb, robots', [slug]);
      if (result.rows.length > 0) {
        const r = result.rows[0];
        return res.json({
          id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt,
          content: r.content,
          thumbnail: r.thumbnail, featuredImage: r.featured_image, date: r.date,
          category: r.category, author: r.author, tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags, views: r.views || 0,
          seoTitle: r.seo_title, metaDescription: r.meta_description, focusKeyword: r.focus_keyword, metaKeywords: r.meta_keywords, canonicalUrl: r.canonical_url, ogTitle: r.og_title, ogDescription: r.og_description, ogImage: r.og_image, twitterCard: r.twitter_card, schemaMarkup: typeof r.schema_markup === 'string' ? JSON.parse(r.schema_markup) : r.schema_markup, breadcrumb: r.breadcrumb, robots: r.robots
        });
      }
    } catch (e) {
      console.error('PG Article detail lookup failed:', e.message);
    }
  }
  const db = readDb();
  const index = (db.articles || []).findIndex(a => a.slug === slug);
  if (index === -1) return res.status(404).json({ error: 'Article not found' });
  db.articles[index].views = (db.articles[index].views || 0) + 1;
  writeDb(db);
  return res.json(db.articles[index]);
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
      await client.query('DELETE FROM articles');
      for (const a of list) {
        await client.query(
          'INSERT INTO articles (id, slug, title, excerpt, content, thumbnail, featured_image, date, category, author, tags, seo_title, meta_description, focus_keyword, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_card, schema_markup, breadcrumb, robots) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)',
          [ String(a.id), a.slug, a.title, a.excerpt, JSON.stringify(a.content || ''), a.thumbnail, a.featuredImage, a.date || new Date().toISOString(), a.category, a.author, JSON.stringify(a.tags || []), a.seoTitle, a.metaDescription, a.focusKeyword, a.metaKeywords, a.canonicalUrl, a.ogTitle, a.ogDescription, a.ogImage, a.twitterCard, JSON.stringify(a.schemaMarkup || {}), a.breadcrumb, a.robots || 'index,follow' ]
        );
      }
      await client.query('COMMIT');
      return res.json({ success: true });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('PG Articles bulk insert failed:', e.message);
      return res.status(500).json({ error: 'Failed to save articles' });
    } finally {
      client.release();
    }
  }
  try {
    const db = readDb(); db.articles = req.body; writeDb(db); res.json({ success: true, articles: db.articles });
  } catch (err) {
    console.error('Failed to save articles to JSON:', err.message);
    res.status(500).json({ error: 'Failed to save articles' });
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
      await pool.query('INSERT INTO articles (id, slug, title, excerpt, content, thumbnail, featured_image, date, category, author, tags, seo_title, meta_description, focus_keyword, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_card, schema_markup, breadcrumb, robots) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)',
        [ newId, a.slug, a.title, a.excerpt, JSON.stringify(a.content || ''), a.thumbnail, a.featuredImage, a.date || new Date().toISOString(), a.category, a.author, JSON.stringify(a.tags || []), a.seoTitle, a.metaDescription, a.focusKeyword, a.metaKeywords, a.canonicalUrl, a.ogTitle, a.ogDescription, a.ogImage, a.twitterCard, JSON.stringify(a.schemaMarkup || {}), a.breadcrumb, a.robots || 'index,follow' ]);
      return res.json({ success: true, id: newId });
    } catch (e) {
      console.error('PG Article insert failed:', e.message);
      return res.status(500).json({ error: 'Failed to insert article' });
    }
  }
  try {
    const db = readDb(); if (!db.articles) db.articles = []; db.articles.push({ ...a, id: newId, date: a.date || new Date().toISOString() }); writeDb(db); res.json({ success: true, id: newId });
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
      const result = await pool.query('UPDATE articles SET slug=$1, title=$2, excerpt=$3, content=$4, thumbnail=$5, featured_image=$6, date=$7, category=$8, author=$9, tags=$10, seo_title=$11, meta_description=$12, focus_keyword=$13, meta_keywords=$14, canonical_url=$15, og_title=$16, og_description=$17, og_image=$18, twitter_card=$19, schema_markup=$20, breadcrumb=$21, robots=$22 WHERE id=$23',
        [ a.slug, a.title, a.excerpt, JSON.stringify(a.content || ''), a.thumbnail, a.featuredImage, a.date || new Date().toISOString(), a.category, a.author, JSON.stringify(a.tags || []), a.seoTitle, a.metaDescription, a.focusKeyword, a.metaKeywords, a.canonicalUrl, a.ogTitle, a.ogDescription, a.ogImage, a.twitterCard, JSON.stringify(a.schemaMarkup || {}), a.breadcrumb, a.robots || 'index,follow', id ]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Article not found' });
      }
      return res.json({ success: true });
    } catch (e) {
      console.error('PG Article update failed:', e.message);
      return res.status(500).json({ error: 'Failed to update article' });
    }
  }
  try {
    const db = readDb(); const index = (db.articles || []).findIndex(art => String(art.id) === id);
    if (index === -1) return res.status(404).json({ error: 'Article not found' });
    db.articles[index] = { ...db.articles[index], ...a, id }; writeDb(db); res.json({ success: true });
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
      const result = await pool.query('DELETE FROM articles WHERE id=$1', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Article not found' });
      }
      return res.json({ success: true });
    } catch (e) {
      console.error('PG Article delete failed:', e.message);
      return res.status(500).json({ error: 'Failed to delete article' });
    }
  }
  try {
    const db = readDb(); db.articles = (db.articles || []).filter(art => String(art.id) !== id); writeDb(db); res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete article from JSON:', err.message);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

module.exports = router;
