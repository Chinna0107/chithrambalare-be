const express = require('express');
const router = express.Router();
const { pool, readDb, writeDb } = require('../config/db.js');
const { requireAdminPasscode } = require('../middlewares/auth.js');

// Helper to sort by date
const sortBoxOffice = (items) => [...items].sort((a, b) => new Date(b.date) - new Date(a.date));

router.get('/', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT id, slug, movie_name, director, movie_cast, poster, day_collection, worldwide_gross, india_net, india_gross, overseas, verdict, trend, days, languages, percentage, date, daily_breakdown, budget, total_india_net, us_premieres, views FROM box_office ORDER BY date DESC');
      const boxOffice = result.rows.map(r => ({
        id: r.id, slug: r.slug, movieName: r.movie_name, director: r.director, cast: r.movie_cast, poster: r.poster, dayCollection: r.day_collection, worldwideGross: r.worldwide_gross, indiaNet: r.india_net, indiaGross: r.india_gross, overseas: r.overseas, verdict: r.verdict, trend: r.trend, days: r.days, languages: r.languages, percentage: r.percentage, date: r.date, dailyBreakdown: typeof r.daily_breakdown === 'string' ? JSON.parse(r.daily_breakdown) : r.daily_breakdown, budget: r.budget, totalIndiaNet: r.total_india_net, usPremieres: r.us_premieres, views: r.views || 0
      }));
      return res.json(boxOffice);
    } catch (e) { console.error('PG Box office query failed:', e.message); }
  }
  const db = readDb();
  return res.json(sortBoxOffice(db.boxOffice || []));
});

router.get('/:slug', async (req, res) => {
  const slug = req.params.slug;
  
  if (pool) {
    try {
      const result = await pool.query('UPDATE box_office SET views = COALESCE(views, 0) + 1 WHERE slug = $1 RETURNING id, slug, movie_name, director, movie_cast, poster, day_collection, worldwide_gross, india_net, india_gross, overseas, verdict, trend, days, languages, percentage, date, daily_breakdown, budget, total_india_net, us_premieres, views', [slug]);
      if (result.rows.length > 0) {
        const r = result.rows[0];
        return res.json({ id: r.id, slug: r.slug, movieName: r.movie_name, director: r.director, cast: r.movie_cast, poster: r.poster, dayCollection: r.day_collection, worldwideGross: r.worldwide_gross, indiaNet: r.india_net, indiaGross: r.india_gross, overseas: r.overseas, verdict: r.verdict, trend: r.trend, days: r.days, languages: r.languages, percentage: r.percentage, date: r.date, dailyBreakdown: typeof r.daily_breakdown === 'string' ? JSON.parse(r.daily_breakdown) : r.daily_breakdown, budget: r.budget, totalIndiaNet: r.total_india_net, usPremieres: r.us_premieres, views: r.views || 0 });
      }
    } catch (e) {
      console.error('PG Box office detail lookup failed:', e.message);
    }
  }
  const db = readDb();
  const index = (db.boxOffice || []).findIndex(b => b.slug === slug);
  if (index === -1) return res.status(404).json({ error: 'Box office entry not found' });
  db.boxOffice[index].views = (db.boxOffice[index].views || 0) + 1;
  writeDb(db);
  return res.json(db.boxOffice[index]);
});

// Admin: Bulk replace (wrapped in transaction)
router.post('/bulk', requireAdminPasscode, async (req, res) => {
  const list = req.body;
  if (!Array.isArray(list)) {
    return res.status(400).json({ error: 'Request body must be an array' });
  }
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM box_office');
      for (const b of list) {
        await client.query('INSERT INTO box_office (id, slug, movie_name, director, movie_cast, poster, day_collection, worldwide_gross, india_net, india_gross, overseas, verdict, trend, days, languages, percentage, date, daily_breakdown, budget, total_india_net, us_premieres) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)',
          [ String(b.id), b.slug, b.movieName, b.director, b.cast, b.poster, b.dayCollection, b.worldwideGross, b.indiaNet, b.indiaGross, b.overseas, b.verdict, b.trend, b.days, b.languages, b.percentage, b.date || new Date().toISOString(), JSON.stringify(b.dailyBreakdown || []), b.budget, b.totalIndiaNet, b.usPremieres ]);
      }
      await client.query('COMMIT');
      return res.json({ success: true });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('PG Box office bulk insert failed:', e.message);
      return res.status(500).json({ error: 'Failed to save box office data' });
    } finally {
      client.release();
    }
  }
  try {
    const db = readDb(); db.boxOffice = req.body; writeDb(db); res.json({ success: true, boxOffice: db.boxOffice });
  } catch (err) {
    console.error('Failed to save box office to JSON:', err.message);
    res.status(500).json({ error: 'Failed to save box office data' });
  }
});

// Admin: Add Single (with validation)
router.post('/', requireAdminPasscode, async (req, res) => {
  const b = req.body;
  if (!b.movieName || !b.slug) {
    return res.status(400).json({ error: 'Missing required fields: movieName, slug' });
  }
  const newId = b.id ? String(b.id) : Date.now().toString();
  if (pool) {
    try {
      await pool.query('INSERT INTO box_office (id, slug, movie_name, director, movie_cast, poster, day_collection, worldwide_gross, india_net, india_gross, overseas, verdict, trend, days, languages, percentage, date, daily_breakdown, budget, total_india_net, us_premieres) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)',
        [ newId, b.slug, b.movieName, b.director, b.cast, b.poster, b.dayCollection, b.worldwideGross, b.indiaNet, b.indiaGross, b.overseas, b.verdict, b.trend, b.days, b.languages, b.percentage, b.date || new Date().toISOString(), JSON.stringify(b.dailyBreakdown || []), b.budget, b.totalIndiaNet, b.usPremieres ]);
      return res.json({ success: true, id: newId });
    } catch (e) {
      console.error('PG Box office insert failed:', e.message);
      return res.status(500).json({ error: 'Failed to insert box office entry' });
    }
  }
  try {
    const db = readDb(); if (!db.boxOffice) db.boxOffice = []; db.boxOffice.push({ ...b, id: newId, date: b.date || new Date().toISOString() }); writeDb(db); res.json({ success: true, id: newId });
  } catch (err) {
    console.error('Failed to insert box office entry to JSON:', err.message);
    res.status(500).json({ error: 'Failed to insert box office entry' });
  }
});

// Admin: Edit Single (with rowCount check)
router.put('/:id', requireAdminPasscode, async (req, res) => {
  const id = req.params.id; const b = req.body;
  if (pool) {
    try {
      const result = await pool.query('UPDATE box_office SET slug=$1, movie_name=$2, director=$3, movie_cast=$4, poster=$5, day_collection=$6, worldwide_gross=$7, india_net=$8, india_gross=$9, overseas=$10, verdict=$11, trend=$12, days=$13, languages=$14, percentage=$15, date=$16, daily_breakdown=$17, budget=$18, total_india_net=$19, us_premieres=$20 WHERE id=$21',
        [ b.slug, b.movieName, b.director, b.cast, b.poster, b.dayCollection, b.worldwideGross, b.indiaNet, b.indiaGross, b.overseas, b.verdict, b.trend, b.days, b.languages, b.percentage, b.date || new Date().toISOString(), JSON.stringify(b.dailyBreakdown || []), b.budget, b.totalIndiaNet, b.usPremieres, id ]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Box office entry not found' });
      }
      return res.json({ success: true });
    } catch (e) {
      console.error('PG Box office update failed:', e.message);
      return res.status(500).json({ error: 'Failed to update box office entry' });
    }
  }
  try {
    const db = readDb(); const index = (db.boxOffice || []).findIndex(bo => String(bo.id) === id);
    if (index === -1) return res.status(404).json({ error: 'Box office entry not found' });
    db.boxOffice[index] = { ...db.boxOffice[index], ...b, id }; writeDb(db); res.json({ success: true });
  } catch (err) {
    console.error('Failed to update box office entry in JSON:', err.message);
    res.status(500).json({ error: 'Failed to update box office entry' });
  }
});

// Admin: Delete Single (with rowCount check)
router.delete('/:id', requireAdminPasscode, async (req, res) => {
  const id = req.params.id;
  if (pool) {
    try {
      const result = await pool.query('DELETE FROM box_office WHERE id=$1', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Box office entry not found' });
      }
      return res.json({ success: true });
    } catch (e) {
      console.error('PG Box office delete failed:', e.message);
      return res.status(500).json({ error: 'Failed to delete box office entry' });
    }
  }
  try {
    const db = readDb(); db.boxOffice = (db.boxOffice || []).filter(bo => String(bo.id) !== id); writeDb(db); res.json({ success: true });
  } catch (err) {
    console.error('Failed to delete box office entry from JSON:', err.message);
    res.status(500).json({ error: 'Failed to delete box office entry' });
  }
});

module.exports = router;
