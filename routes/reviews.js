const express = require('express');
const router = express.Router();
const { pool, readDb, writeDb } = require('../config/db.js');
const { requireEmployeeOrAdmin } = require('../middlewares/auth.js');

// Helper to sort reviews by date
const sortReviews = (reviews) => [...reviews].sort((a, b) => new Date(b.date) - new Date(a.date));

router.get('/', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT id, slug, movie_name, poster, rating, snippet, verdict, story, performances, technical_aspects, verdict_text, ott_platform, ott_release_date, date, director, producer, production_house, language, genre, release_date, runtime, trailer, status, views, seo_title, meta_description, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_card, schema_markup, robots FROM reviews ORDER BY date DESC');
      const reviews = result.rows.map(r => ({
        id: r.id, slug: r.slug, movieName: r.movie_name, poster: r.poster, rating: r.rating, snippet: r.snippet, verdict: r.verdict, story: r.story, performances: r.performances, technicalAspects: r.technical_aspects, verdictText: r.verdict_text, ottPlatform: r.ott_platform, ottReleaseDate: r.ott_release_date, date: r.date,
        director: r.director, producer: r.producer, productionHouse: r.production_house, language: r.language, genre: r.genre, releaseDate: r.release_date, runtime: r.runtime, trailer: r.trailer, status: r.status, views: r.views || 0,
        seoTitle: r.seo_title, metaDescription: r.meta_description, metaKeywords: r.meta_keywords, canonicalUrl: r.canonical_url, ogTitle: r.og_title, ogDescription: r.og_description, ogImage: r.og_image, twitterCard: r.twitter_card, schemaMarkup: typeof r.schema_markup === 'string' ? JSON.parse(r.schema_markup) : r.schema_markup, robots: r.robots
      }));
      return res.json(reviews);
    } catch (e) { console.error('PG Reviews list query failed:', e.message); }
  }
  const db = readDb();
  return res.json(sortReviews(db.reviews || []));
});

router.get('/:slug', async (req, res) => {
  const slug = req.params.slug;

  if (pool) {
    try {
      const result = await pool.query('UPDATE reviews SET views = COALESCE(views, 0) + 1 WHERE slug = $1 RETURNING id, slug, movie_name, poster, rating, snippet, verdict, story, performances, technical_aspects, verdict_text, ott_platform, ott_release_date, date, director, producer, production_house, language, genre, release_date, runtime, trailer, status, views, seo_title, meta_description, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_card, schema_markup, robots', [slug]);
      if (result.rows.length > 0) {
        const r = result.rows[0];
        return res.json({ id: r.id, slug: r.slug, movieName: r.movie_name, poster: r.poster, rating: r.rating, snippet: r.snippet, verdict: r.verdict, story: r.story, performances: r.performances, technicalAspects: r.technical_aspects, verdictText: r.verdict_text, ottPlatform: r.ott_platform, ottReleaseDate: r.ott_release_date, date: r.date, director: r.director, producer: r.producer, productionHouse: r.production_house, language: r.language, genre: r.genre, releaseDate: r.release_date, runtime: r.runtime, trailer: r.trailer, status: r.status, views: r.views || 0,
          seoTitle: r.seo_title, metaDescription: r.meta_description, metaKeywords: r.meta_keywords, canonicalUrl: r.canonical_url, ogTitle: r.og_title, ogDescription: r.og_description, ogImage: r.og_image, twitterCard: r.twitter_card, schemaMarkup: typeof r.schema_markup === 'string' ? JSON.parse(r.schema_markup) : r.schema_markup, robots: r.robots });
      }
    } catch (e) {
      console.error('PG Review detail lookup failed:', e.message);
    }
  }
  const db = readDb();
  const index = (db.reviews || []).findIndex(r => r.slug === slug);
  if (index === -1) return res.status(404).json({ error: 'Review not found' });
  db.reviews[index].views = (db.reviews[index].views || 0) + 1;
  writeDb(db);
  return res.json(db.reviews[index]);
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
      await client.query('DELETE FROM reviews');
      for (const r of list) {
        await client.query('INSERT INTO reviews (id, slug, movie_name, poster, rating, snippet, verdict, story, performances, technical_aspects, verdict_text, ott_platform, ott_release_date, date, director, producer, production_house, language, genre, release_date, runtime, trailer, status, seo_title, meta_description, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_card, schema_markup, robots) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)',
          [ String(r.id), r.slug, r.movieName, r.poster, r.rating, r.snippet, r.verdict, r.story, r.performances, r.technicalAspects, r.verdictText, r.ottPlatform, r.ottReleaseDate, r.date || new Date().toISOString(), r.director, r.producer, r.productionHouse, r.language, r.genre, r.releaseDate, r.runtime, r.trailer, r.status || 'published', r.seoTitle, r.metaDescription, r.metaKeywords, r.canonicalUrl, r.ogTitle, r.ogDescription, r.ogImage, r.twitterCard, JSON.stringify(r.schemaMarkup || {}), r.robots || 'index,follow' ]);
      }
      await client.query('COMMIT');
      return res.json({ success: true });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('PG Reviews bulk insert failed:', e.message);
      return res.status(500).json({ error: 'Failed to save reviews' });
    } finally {
      client.release();
    }
  }
  try {
    const db = readDb(); db.reviews = req.body; writeDb(db); res.json({ success: true, reviews: db.reviews });
  } catch (err) {
    console.error('Failed to save reviews to JSON:', err.message);
    res.status(500).json({ error: 'Failed to save reviews' });
  }
});

// Admin: Add Single (with validation)
router.post('/', requireEmployeeOrAdmin, async (req, res) => {
  const r = req.body;
  if (!r.movieName || !r.slug) {
    return res.status(400).json({ error: 'Missing required fields: movieName, slug' });
  }
  const newId = r.id ? String(r.id) : Date.now().toString();
  if (pool) {
    try {
      await pool.query('INSERT INTO reviews (id, slug, movie_name, poster, rating, snippet, verdict, story, performances, technical_aspects, verdict_text, ott_platform, ott_release_date, date, director, producer, production_house, language, genre, release_date, runtime, trailer, status, seo_title, meta_description, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_card, schema_markup, robots) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)',
        [ newId, r.slug, r.movieName, r.poster, r.rating, r.snippet, r.verdict, r.story, r.performances, r.technicalAspects, r.verdictText, r.ottPlatform, r.ottReleaseDate, r.date || new Date().toISOString(), r.director, r.producer, r.productionHouse, r.language, r.genre, r.releaseDate, r.runtime, r.trailer, r.status || 'published', r.seoTitle, r.metaDescription, r.metaKeywords, r.canonicalUrl, r.ogTitle, r.ogDescription, r.ogImage, r.twitterCard, JSON.stringify(r.schemaMarkup || {}), r.robots || 'index,follow' ]);
      return res.json({ success: true, id: newId });
    } catch (e) {
      console.error('PG Review insert failed:', e.message);
      return res.status(500).json({ error: 'Failed to insert review' });
    }
  }
  try {
    const db = readDb(); if (!db.reviews) db.reviews = []; db.reviews.push({ ...r, id: newId, date: r.date || new Date().toISOString() }); writeDb(db); res.json({ success: true, id: newId });
  } catch (err) {
    console.error('Failed to insert review to JSON:', err.message);
    res.status(500).json({ error: 'Failed to insert review' });
  }
});

// Admin: Edit Single (with rowCount check)
router.put('/:id', requireEmployeeOrAdmin, async (req, res) => {
  const id = req.params.id; const r = req.body;
  if (pool) {
    try {
      const result = await pool.query('UPDATE reviews SET slug=$1, movie_name=$2, poster=$3, rating=$4, snippet=$5, verdict=$6, story=$7, performances=$8, technical_aspects=$9, verdict_text=$10, ott_platform=$11, ott_release_date=$12, date=$13, director=$14, producer=$15, production_house=$16, language=$17, genre=$18, release_date=$19, runtime=$20, trailer=$21, status=$22, seo_title=$23, meta_description=$24, meta_keywords=$25, canonical_url=$26, og_title=$27, og_description=$28, og_image=$29, twitter_card=$30, schema_markup=$31, robots=$32 WHERE id=$33',
        [ r.slug, r.movieName, r.poster, r.rating, r.snippet, r.verdict, r.story, r.performances, r.technicalAspects, r.verdictText, r.ottPlatform, r.ottReleaseDate, r.date || new Date().toISOString(), r.director, r.producer, r.productionHouse, r.language, r.genre, r.releaseDate, r.runtime, r.trailer, r.status || 'published', r.seoTitle, r.metaDescription, r.metaKeywords, r.canonicalUrl, r.ogTitle, r.ogDescription, r.ogImage, r.twitterCard, JSON.stringify(r.schemaMarkup || {}), r.robots || 'index,follow', id ]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Review not found' });
      }
      return res.json({ success: true });
    } catch (e) {
      console.error('PG Review update failed:', e.message);
      return res.status(500).json({ error: 'Failed to update review' });
    }
  }
  try {
    const db = readDb(); const index = (db.reviews || []).findIndex(rev => String(rev.id) === id);
    if (index === -1) return res.status(404).json({ error: 'Review not found' });
    db.reviews[index] = { ...db.reviews[index], ...r, id }; writeDb(db); res.json({ success: true });
  } catch (err) {
    console.error('Failed to update review in JSON:', err.message);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// Admin: Delete Single (with rowCount check)
router.delete('/:id', requireEmployeeOrAdmin, async (req, res) => {
  const id = req.params.id;
  if (pool) {
    try {
      const result = await pool.query('DELETE FROM reviews WHERE id=$1', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Review not found' });
      }
      return res.json({ success: true });
    } catch (e) {
      console.error('PG Review delete failed:', e.message);
      return res.status(500).json({ error: 'Failed to delete review' });
    }
  }
  try {
    const db = readDb(); db.reviews = (db.reviews || []).filter(rev => String(rev.id) !== id); writeDb(db); res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete review from JSON:', err.message);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

module.exports = router;
