const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const { pool, readDb, writeDb } = require('../config/db.js');
const { fetchTollywoodImageByKeyword, axiosConfig } = require('../utils/helpers.js');

const { requireEmployeeOrAdmin } = require('../middlewares/auth.js');

router.get('/warmup', (req, res) => {
  res.json({ status: 'warm', time: new Date() });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

router.get('/stats', async (req, res) => {
  const { type } = req.query;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();

  try {
    if (pool) {
      if (type === 'movie-news' || type === 'ott') {
        let countQuery = 'SELECT COUNT(*) FROM articles';
        let todayQuery = 'SELECT COUNT(*) FROM articles WHERE date >= $1';
        let params = [todayStr];
        
        if (type === 'ott') {
          countQuery += " WHERE category ILIKE '%ott%' OR tags::text ILIKE '%ott%'";
          todayQuery += " AND (category ILIKE '%ott%' OR tags::text ILIKE '%ott%')";
        }
        
        const [totalRes, todayRes] = await Promise.all([
          pool.query(countQuery),
          pool.query(todayQuery, params)
        ]);
        return res.json({ total: parseInt(totalRes.rows[0].count), today: parseInt(todayRes.rows[0].count) });
      } else if (type === 'reviews') {
        const [totalRes, todayRes] = await Promise.all([
          pool.query('SELECT COUNT(*) FROM reviews'),
          pool.query('SELECT COUNT(*) FROM reviews WHERE date >= $1', [todayStr])
        ]);
        return res.json({ total: parseInt(totalRes.rows[0].count), today: parseInt(todayRes.rows[0].count) });
      }
    }

    const db = readDb();
    let items = [];
    if (type === 'movie-news') items = db.articles || [];
    else if (type === 'ott') items = (db.articles || []).filter(a => a.category?.toLowerCase().includes('ott') || (a.tags || []).some(t => t.toLowerCase().includes('ott')));
    else if (type === 'reviews') items = db.reviews || [];

    const todayCount = items.filter(i => i.date && new Date(i.date) >= todayStart).length;
    return res.json({ total: items.length, today: todayCount });
  } catch (e) {
    console.error('Stats fetch failed:', e.message);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.post('/track-visit', async (req, res) => {
  const { visitorId, path: pagePath } = req.body;
  if (!visitorId) return res.status(400).json({ error: 'visitorId required' });
  
  if (pool) {
    try {
      await pool.query(
        'INSERT INTO visitor_logs (visitor_id, path) VALUES ($1, $2)',
        [visitorId, pagePath || '/']
      );
      return res.json({ success: true });
    } catch (e) {
      console.error('PG track-visit failed:', e.message);
      return res.status(500).json({ error: 'db error' });
    }
  }

  try {
    const db = readDb();
    if (!db.visitorLogs) db.visitorLogs = [];
    db.visitorLogs.push({ visitor_id: visitorId, path: pagePath || '/', created_at: new Date().toISOString() });
    writeDb(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'json db error' });
  }
});

router.get('/image-proxy', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  let imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).send('URL is required');
  }

  try { 
    const decoded = Buffer.from(imageUrl, 'base64').toString('utf8');
    imageUrl = decodeURIComponent(decoded);
    if (!/^https?:\/\//i.test(imageUrl)) {
      throw new Error("Invalid URL protocol");
    }
  } catch (e) {
    return res.status(400).json({ error: "Invalid image URL encoding" }); 
  }

  try {
    const response = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', 
        'Referer': 'https://tracktollywood.com/' 
      },
      timeout: 10000
    });

    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']); 
    }
    if (response.headers['cache-control']) {
      res.setHeader('Cache-Control', response.headers['cache-control']);
    } else {
      res.setHeader('Cache-Control', 'public, max-age=864000'); 
    }

    response.data.pipe(res);
  } catch (err) {
    console.error('Image proxy failed for:', imageUrl, err.message);
    res.status(500).send(`Failed to fetch image: ${err.message}\nStack: ${err.stack}`);
  }
});

router.get('/imdb-image', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400'); 

  const keyword = (req.query.q || 'tollywood').trim();

  try {
    const imgUrl = await fetchTollywoodImageByKeyword(keyword);
    if (imgUrl) {
      const imgResp = await axios.get(imgUrl, {
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://tracktollywood.com/'
        },
        timeout: 10000
      });
      res.setHeader('Content-Type', imgResp.headers['content-type'] || 'image/jpeg');
      return imgResp.data.pipe(res);
    }
  } catch (e) {
    console.warn('[movie-image] proxy stream failed:', e.message);
  }

  res.redirect(302, 'https://tracktollywood.com/wp-content/uploads/2026/06/Vishwambhara-release-tensions-696x522.webp');
});

router.get('/schedules', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT id, movie_name, release_date, remaining_days, language, status, banner, director, cast_list, genre, release_status, trailer_link, notes, slug FROM schedules ORDER BY release_date ASC');
      const schedules = result.rows.map(r => ({
        id: r.id,
        movieName: r.movie_name,
        releaseDate: r.release_date,
        remainingDays: r.remaining_days,
        language: r.language,
        status: r.status,
        banner: r.banner,
        director: r.director,
        castList: r.cast_list,
        genre: r.genre,
        releaseStatus: r.release_status,
        trailerLink: r.trailer_link,
        notes: r.notes,
        slug: r.slug
      }));
      return res.json(schedules);
    } catch (e) {
      console.error('PG Schedules read failed:', e.message);
    }
  }
  const db = readDb();
  res.json(db.upcomingSchedules || []);
});

router.get('/schedules/:slug', async (req, res) => {
  const { slug } = req.params;
  if (pool) {
    try {
      const result = await pool.query('SELECT id, movie_name, release_date, remaining_days, language, status, banner, director, cast_list, genre, release_status, trailer_link, notes, slug FROM schedules WHERE slug = $1 OR id::text = $1', [slug]);
      if (result.rows.length > 0) {
        const r = result.rows[0];
        return res.json({
          id: r.id, movieName: r.movie_name, releaseDate: r.release_date, remainingDays: r.remaining_days, language: r.language, status: r.status,
          banner: r.banner, director: r.director, castList: r.cast_list, genre: r.genre, releaseStatus: r.release_status,
          trailerLink: r.trailer_link, notes: r.notes, slug: r.slug
        });
      }
      return res.status(404).json({ error: 'Not found' });
    } catch (e) { console.error('PG Schedule read single failed:', e.message); }
  }
  const db = readDb();
  const item = (db.upcomingSchedules || []).find(n => n.slug === slug || String(n.id) === slug);
  if (!item) return res.status(404).json({ error: 'Not found' });
  return res.json(item);
});

router.post('/schedules', requireEmployeeOrAdmin, async (req, res) => {
  const list = req.body;
  if (pool) {
    try {
      await pool.query('DELETE FROM schedules');
      for (const s of list) {
        await pool.query(
          'INSERT INTO schedules (movie_name, release_date, remaining_days, language, status, banner, director, cast_list, genre, release_status, trailer_link, notes, slug, seo_title, meta_description, meta_keywords, canonical_url, og_title, og_description, og_image) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)',
          [s.movieName, s.releaseDate, s.remainingDays, s.language, s.status, s.banner, s.director, s.castList, s.genre, s.releaseStatus, s.trailerLink, s.notes, s.slug, s.seoTitle, s.metaDescription, s.metaKeywords, s.canonicalUrl, s.ogTitle, s.ogDescription, s.ogImage]
        );
      }
      const result = await pool.query('SELECT id, movie_name, release_date, remaining_days, language, status, banner, director, cast_list, genre, release_status, trailer_link, notes, slug FROM schedules ORDER BY release_date ASC');
      return res.json({
        success: true,
        upcomingSchedules: result.rows.map(r => ({
          id: r.id,
          movieName: r.movie_name,
          releaseDate: r.release_date,
          remainingDays: r.remaining_days,
          language: r.language,
          status: r.status,
          banner: r.banner,
          director: r.director,
          castList: r.cast_list,
          genre: r.genre,
          releaseStatus: r.release_status,
          trailerLink: r.trailer_link,
          slug: r.slug,
          seoTitle: r.seo_title,
          metaDescription: r.meta_description,
          metaKeywords: r.meta_keywords,
          canonicalUrl: r.canonical_url,
          ogTitle: r.og_title,
          ogDescription: r.og_description,
          ogImage: r.og_image
        }))
      });
    } catch (e) {
      console.error('PG Schedules write failed:', e.message);
    }
  }
  try {
    const db = readDb();
    db.upcomingSchedules = req.body;
    writeDb(db);
    res.json({ success: true, upcomingSchedules: db.upcomingSchedules });
  } catch (err) {
    console.error('Failed to update schedules:', err.message);
    res.status(500).json({ error: 'Failed to save schedules' });
  }
});

router.get('/north-america', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT id, slug, movie_name, hourly_gross, total_gross, premier_gross, screens, status, last_updated, poster, release_date, language, distributor, genre, budget, opening_day_preview, advance_bookings, premiere_collections, weekend_collections, weekly_collections, daily_breakdown, notes FROM north_america ORDER BY id ASC');
      const collections = result.rows.map(r => ({
        id: r.id,
        slug: r.slug,
        movieName: r.movie_name,
        hourlyGross: r.hourly_gross,
        totalGross: r.total_gross,
        premierGross: r.premier_gross,
        screens: r.screens,
        status: r.status,
        lastUpdated: r.last_updated,
        poster: r.poster,
        releaseDate: r.release_date,
        language: r.language,
        distributor: r.distributor,
        genre: r.genre,
        budget: r.budget,
        openingDayPreview: r.opening_day_preview,
        advanceBookings: r.advance_bookings,
        premiereCollections: r.premiere_collections,
        weekendCollections: r.weekend_collections,
        weeklyCollections: r.weekly_collections,
        dailyBreakdown: r.daily_breakdown,
        notes: r.notes
      }));
      return res.json(collections);
    } catch (e) {
      console.error('PG North America read failed:', e.message);
    }
  }
  const db = readDb();
  res.json(db.northAmericaCollections || []);
});

router.get('/north-america/:slug', async (req, res) => {
  const { slug } = req.params;
  if (pool) {
    try {
      const result = await pool.query('SELECT id, slug, movie_name, hourly_gross, total_gross, premier_gross, screens, status, last_updated, poster, release_date, language, distributor, genre, budget, opening_day_preview, advance_bookings, premiere_collections, weekend_collections, weekly_collections, daily_breakdown, notes FROM north_america WHERE slug = $1 OR id::text = $1', [slug]);
      if (result.rows.length > 0) {
        const r = result.rows[0];
        return res.json({
          id: r.id, slug: r.slug, movieName: r.movie_name, hourlyGross: r.hourly_gross, totalGross: r.total_gross,
          premierGross: r.premier_gross, screens: r.screens, status: r.status, lastUpdated: r.last_updated, poster: r.poster,
          releaseDate: r.release_date, language: r.language, distributor: r.distributor, genre: r.genre, budget: r.budget,
          openingDayPreview: r.opening_day_preview, advanceBookings: r.advance_bookings, premiereCollections: r.premiere_collections,
          weekendCollections: r.weekend_collections, weeklyCollections: r.weekly_collections, dailyBreakdown: r.daily_breakdown, notes: r.notes
        });
      }
      return res.status(404).json({ error: 'Not found' });
    } catch (e) { console.error('PG NA read single failed:', e.message); }
  }
  const db = readDb();
  const item = (db.northAmericaCollections || []).find(n => n.slug === slug || String(n.id) === slug);
  if (!item) return res.status(404).json({ error: 'Not found' });
  return res.json(item);
});

router.post('/north-america', requireEmployeeOrAdmin, async (req, res) => {
  const list = req.body;
  if (pool) {
    try {
      await pool.query('DELETE FROM north_america');
      for (const n of list) {
        await pool.query(
          'INSERT INTO north_america (slug, movie_name, hourly_gross, total_gross, premier_gross, screens, status, last_updated, poster, release_date, language, distributor, genre, budget, opening_day_preview, advance_bookings, premiere_collections, weekend_collections, weekly_collections, daily_breakdown, notes, seo_title, meta_description, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_card, robots) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)',
          [n.slug, n.movieName, n.hourlyGross, n.totalGross, n.premierGross, n.screens, n.status, n.lastUpdated, n.poster, n.releaseDate, n.language, n.distributor, n.genre, n.budget, n.openingDayPreview, n.advanceBookings, n.premiereCollections, n.weekendCollections, n.weeklyCollections, JSON.stringify(n.dailyBreakdown || []), n.notes, n.seoTitle, n.metaDescription, n.metaKeywords, n.canonicalUrl, n.ogTitle, n.ogDescription, n.ogImage, n.twitterCard, n.robots || 'index,follow']
        );
      }
      const result = await pool.query('SELECT id, slug, movie_name, hourly_gross, total_gross, premier_gross, screens, status, last_updated, poster, release_date, language, distributor, genre, budget, opening_day_preview, advance_bookings, premiere_collections, weekend_collections, weekly_collections, daily_breakdown, notes FROM north_america ORDER BY id ASC');
      return res.json({
        success: true,
        northAmericaCollections: result.rows.map(r => ({
          id: r.id,
          slug: r.slug,
          movieName: r.movie_name,
          hourlyGross: r.hourly_gross,
          totalGross: r.total_gross,
          premierGross: r.premier_gross,
          screens: r.screens,
          status: r.status,
          lastUpdated: r.last_updated,
          poster: r.poster,
          releaseDate: r.release_date,
          language: r.language,
          distributor: r.distributor,
          genre: r.genre,
          budget: r.budget,
          openingDayPreview: r.opening_day_preview,
          advanceBookings: r.advance_bookings,
          premiereCollections: r.premiere_collections,
          weekendCollections: r.weekend_collections,
          weeklyCollections: r.weekly_collections,
          dailyBreakdown: r.daily_breakdown,
          notes: r.notes,
          seoTitle: r.seo_title,
          metaDescription: r.meta_description,
          metaKeywords: r.meta_keywords,
          canonicalUrl: r.canonical_url,
          ogTitle: r.og_title,
          ogDescription: r.og_description,
          ogImage: r.og_image,
          twitterCard: r.twitter_card,
          robots: r.robots
        }))
      });
    } catch (e) {
      console.error('PG North America write failed:', e.message);
    }
  }
  try {
    const db = readDb();
    db.northAmericaCollections = req.body;
    writeDb(db);
    res.json({ success: true, northAmericaCollections: db.northAmericaCollections });
  } catch (err) {
    console.error('Failed to update north-america collections:', err.message);
    res.status(500).json({ error: 'Failed to save north-america collections' });
  }
});

router.get('/box-office-top5', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT rank, movie_name, gross, verdict, trend, opening_collection, weekend_collection, total_collection, territory, last_updated FROM box_office_top5 ORDER BY rank ASC');
      const top5 = result.rows.map(r => ({
        rank: r.rank,
        movieName: r.movie_name,
        gross: r.gross,
        verdict: r.verdict,
        trend: r.trend,
        openingCollection: r.opening_collection,
        weekendCollection: r.weekend_collection,
        totalCollection: r.total_collection,
        territory: r.territory,
        lastUpdated: r.last_updated
      }));
      return res.json(top5);
    } catch (e) {
      console.error('PG Box Office Top 5 read failed:', e.message);
    }
  }
  const db = readDb();
  res.json(db.boxOfficeTop5 || []);
});

router.post('/box-office-top5', requireEmployeeOrAdmin, async (req, res) => {
  const list = req.body;
  if (pool) {
    try {
      await pool.query('DELETE FROM box_office_top5');
      for (const b of list) {
        await pool.query(
          'INSERT INTO box_office_top5 (rank, movie_name, gross, verdict, trend, opening_collection, weekend_collection, total_collection, territory, last_updated, slug, seo_title, meta_description, meta_keywords, canonical_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)',
          [b.rank, b.movieName, b.gross, b.verdict, b.trend, b.openingCollection, b.weekendCollection, b.totalCollection, b.territory, b.lastUpdated, b.slug, b.seoTitle, b.metaDescription, b.metaKeywords, b.canonicalUrl]
        );
      }
      const result = await pool.query('SELECT rank, movie_name, gross, verdict, trend, opening_collection, weekend_collection, total_collection, territory, last_updated FROM box_office_top5 ORDER BY rank ASC');
      return res.json({
        success: true,
        boxOfficeTop5: result.rows.map(r => ({
          rank: r.rank,
          movieName: r.movie_name,
          gross: r.gross,
          verdict: r.verdict,
          trend: r.trend,
          openingCollection: r.opening_collection,
          weekendCollection: r.weekend_collection,
          totalCollection: r.total_collection,
          territory: r.territory,
          lastUpdated: r.last_updated,
          slug: r.slug,
          seoTitle: r.seo_title,
          metaDescription: r.meta_description,
          metaKeywords: r.meta_keywords,
          canonicalUrl: r.canonical_url
        }))
      });
    } catch (e) {
      console.error('PG Box Office Top 5 write failed:', e.message);
    }
  }
  try {
    const db = readDb();
    db.boxOfficeTop5 = req.body;
    writeDb(db);
    res.json({ success: true, boxOfficeTop5: db.boxOfficeTop5 });
  } catch (err) {
    console.error('Failed to update box-office top5:', err.message);
    res.status(500).json({ error: 'Failed to save box-office top5' });
  }
});

router.get('/galleries', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT id, title, cover_image, images, date FROM galleries ORDER BY id ASC');
      const galleries = result.rows.map(r => ({
        id: r.id,
        title: r.title,
        coverImage: r.cover_image,
        images: typeof r.images === 'string' ? JSON.parse(r.images) : r.images,
        date: r.date
      }));
      return res.json(galleries);
    } catch (e) {
      console.error('PG Galleries read failed:', e.message);
    }
  }
  const db = readDb();
  res.json(db.galleries || []);
});

router.post('/galleries', requireEmployeeOrAdmin, async (req, res) => {
  const list = req.body;
  if (pool) {
    try {
      await pool.query('DELETE FROM galleries');
      for (const g of list) {
        await pool.query(
          'INSERT INTO galleries (title, cover_image, images, date, slug, seo_title, meta_description, alt_text, canonical_url, og_image) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
          [g.title, g.coverImage, JSON.stringify(g.images || []), g.date || new Date().toISOString(), g.slug, g.seoTitle, g.metaDescription, g.altText, g.canonicalUrl, g.ogImage]
        );
      }
      const result = await pool.query('SELECT id, title, cover_image, images, date FROM galleries ORDER BY id ASC');
      return res.json({
        success: true,
        galleries: result.rows.map(r => ({
          id: r.id,
          title: r.title,
          coverImage: r.cover_image,
          images: typeof r.images === 'string' ? JSON.parse(r.images) : r.images,
          date: r.date,
          slug: r.slug,
          seoTitle: r.seo_title,
          metaDescription: r.meta_description,
          altText: r.alt_text,
          canonicalUrl: r.canonical_url,
          ogImage: r.og_image
        }))
      });
    } catch (e) {
      console.error('PG Galleries write failed:', e.message);
    }
  }
  try {
    const db = readDb();
    db.galleries = req.body;
    writeDb(db);
    res.json({ success: true, galleries: db.galleries });
  } catch (err) {
    console.error('Failed to update galleries:', err.message);
    res.status(500).json({ error: 'Failed to save galleries' });
  }
});

// Individual schedule CRUD
router.post('/schedules/single', requireEmployeeOrAdmin, async (req, res) => {
  const { movieName, releaseDate, remainingDays, language, status, banner, director, castList, genre, releaseStatus, trailerLink, notes, seoTitle, metaDescription, metaKeywords, slug, canonicalUrl, ogTitle, ogDescription, ogImage } = req.body;
  if (pool) {
    try {
      const result = await pool.query(
        `INSERT INTO schedules (movie_name, release_date, remaining_days, language, status, banner, director, cast_list, genre, release_status, trailer_link, notes, seo_title, meta_description, meta_keywords, slug, canonical_url, og_title, og_description, og_image)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
        [movieName, releaseDate, remainingDays, language, status, banner, director, castList, genre, releaseStatus || 'upcoming', trailerLink, notes, seoTitle, metaDescription, metaKeywords, slug, canonicalUrl, ogTitle, ogDescription, ogImage]
      );
      return res.json({ success: true, item: result.rows[0] });
    } catch (e) { console.error('PG schedule add failed:', e.message); return res.status(500).json({ error: 'Failed to add schedule' }); }
  }
  const db = readDb();
  if (!db.upcomingSchedules) db.upcomingSchedules = [];
  const newItem = { id: Date.now(), ...req.body };
  db.upcomingSchedules.push(newItem);
  writeDb(db);
  res.json({ success: true, item: newItem });
});

router.put('/schedules/:id', requireEmployeeOrAdmin, async (req, res) => {
  const { id } = req.params;
  const { movieName, releaseDate, remainingDays, language, status, banner, director, castList, genre, releaseStatus, trailerLink, notes, seoTitle, metaDescription, metaKeywords, slug, canonicalUrl, ogTitle, ogDescription, ogImage } = req.body;
  if (pool) {
    try {
      const result = await pool.query(
        `UPDATE schedules SET movie_name=$1, release_date=$2, remaining_days=$3, language=$4, status=$5, banner=$6, director=$7, cast_list=$8, genre=$9, release_status=$10, trailer_link=$11, notes=$12, seo_title=$13, meta_description=$14, meta_keywords=$15, slug=$16, canonical_url=$17, og_title=$18, og_description=$19, og_image=$20 WHERE id=$21 RETURNING *`,
        [movieName, releaseDate, remainingDays, language, status, banner, director, castList, genre, releaseStatus, trailerLink, notes, seoTitle, metaDescription, metaKeywords, slug, canonicalUrl, ogTitle, ogDescription, ogImage, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Schedule not found' });
      return res.json({ success: true });
    } catch (e) { console.error('PG schedule update failed:', e.message); return res.status(500).json({ error: 'Failed to update' }); }
  }
  const db = readDb();
  const idx = (db.upcomingSchedules || []).findIndex(s => String(s.id) === String(id));
  if (idx >= 0) { db.upcomingSchedules[idx] = { ...db.upcomingSchedules[idx], ...req.body }; writeDb(db); }
  res.json({ success: true });
});

router.delete('/schedules/:id', requireEmployeeOrAdmin, async (req, res) => {
  const { id } = req.params;
  if (pool) {
    try {
      await pool.query('DELETE FROM schedules WHERE id=$1', [id]);
      return res.json({ success: true });
    } catch (e) { console.error('PG schedule delete failed:', e.message); }
  }
  const db = readDb();
  db.upcomingSchedules = (db.upcomingSchedules || []).filter(s => String(s.id) !== String(id));
  writeDb(db);
  res.json({ success: true });
});

// Individual north-america CRUD
router.post('/north-america/single', requireEmployeeOrAdmin, async (req, res) => {
  const b = req.body;
  if (pool) {
    try {
      const result = await pool.query(
        `INSERT INTO north_america (movie_name, hourly_gross, total_gross, premier_gross, screens, status, last_updated, poster, release_date, language, distributor, genre, budget, opening_day_preview, advance_bookings, premiere_collections, weekend_collections, weekly_collections, daily_breakdown, notes, seo_title, meta_description, meta_keywords, canonical_url, slug, og_title, og_description, og_image, twitter_card, robots)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30) RETURNING *`,
        [b.movieName, b.hourlyGross, b.totalGross, b.premierGross, b.screens, b.status, b.lastUpdated, b.poster, b.releaseDate, b.language, b.distributor, b.genre, b.budget, b.openingDayPreview, b.advanceBookings, b.premiereCollections, b.weekendCollections, b.weeklyCollections, JSON.stringify(b.dailyBreakdown || []), b.notes, b.seoTitle, b.metaDescription, b.metaKeywords, b.canonicalUrl, b.slug, b.ogTitle, b.ogDescription, b.ogImage, b.twitterCard, b.robots || 'index,follow']
      );
      return res.json({ success: true, item: result.rows[0] });
    } catch (e) { console.error('PG NA add failed:', e.message); return res.status(500).json({ error: 'Failed to add' }); }
  }
  const db = readDb();
  if (!db.northAmericaCollections) db.northAmericaCollections = [];
  db.northAmericaCollections.push({ id: Date.now(), ...req.body });
  writeDb(db);
  res.json({ success: true });
});

router.put('/north-america/:id', requireEmployeeOrAdmin, async (req, res) => {
  const { id } = req.params;
  const b = req.body;
  if (pool) {
    try {
      const result = await pool.query(
        `UPDATE north_america SET movie_name=$1, hourly_gross=$2, total_gross=$3, premier_gross=$4, screens=$5, status=$6, last_updated=$7, poster=$8, release_date=$9, language=$10, distributor=$11, genre=$12, budget=$13, opening_day_preview=$14, advance_bookings=$15, premiere_collections=$16, weekend_collections=$17, weekly_collections=$18, daily_breakdown=$19, notes=$20, seo_title=$21, meta_description=$22, meta_keywords=$23, canonical_url=$24, slug=$25, og_title=$26, og_description=$27, og_image=$28, twitter_card=$29, robots=$30 WHERE id=$31`,
        [b.movieName, b.hourlyGross, b.totalGross, b.premierGross, b.screens, b.status, b.lastUpdated, b.poster, b.releaseDate, b.language, b.distributor, b.genre, b.budget, b.openingDayPreview, b.advanceBookings, b.premiereCollections, b.weekendCollections, b.weeklyCollections, JSON.stringify(b.dailyBreakdown || []), b.notes, b.seoTitle, b.metaDescription, b.metaKeywords, b.canonicalUrl, b.slug, b.ogTitle, b.ogDescription, b.ogImage, b.twitterCard, b.robots, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      return res.json({ success: true });
    } catch (e) { console.error('PG NA update failed:', e.message); return res.status(500).json({ error: 'Failed to update' }); }
  }
  const db = readDb();
  const idx = (db.northAmericaCollections || []).findIndex(n => String(n.id) === String(id));
  if (idx >= 0) { db.northAmericaCollections[idx] = { ...db.northAmericaCollections[idx], ...req.body }; writeDb(db); }
  res.json({ success: true });
});

router.delete('/north-america/:id', requireEmployeeOrAdmin, async (req, res) => {
  const { id } = req.params;
  if (pool) {
    try { await pool.query('DELETE FROM north_america WHERE id=$1', [id]); return res.json({ success: true }); }
    catch (e) { console.error('PG NA delete failed:', e.message); }
  }
  const db = readDb();
  db.northAmericaCollections = (db.northAmericaCollections || []).filter(n => String(n.id) !== String(id));
  writeDb(db);
  res.json({ success: true });
});

// Individual gallery CRUD
router.post('/galleries/single', requireEmployeeOrAdmin, async (req, res) => {
  const b = req.body;
  if (pool) {
    try {
      const result = await pool.query(
        `INSERT INTO galleries (title, cover_image, images, date, category, alt_text, caption, photographer_credit, featured_image, sort_order, seo_title, meta_description, slug, canonical_url, og_image)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
        [b.title, b.coverImage, JSON.stringify(b.images || []), b.date || new Date().toISOString(), b.category || 'stills', b.altText, b.caption, b.photographerCredit, b.featuredImage, b.sortOrder || 0, b.seoTitle, b.metaDescription, b.slug, b.canonicalUrl, b.ogImage]
      );
      return res.json({ success: true, item: result.rows[0] });
    } catch (e) { console.error('PG gallery add failed:', e.message); return res.status(500).json({ error: 'Failed to add gallery' }); }
  }
  const db = readDb();
  if (!db.galleries) db.galleries = [];
  db.galleries.push({ id: Date.now(), ...req.body });
  writeDb(db);
  res.json({ success: true });
});

router.put('/galleries/:id', requireEmployeeOrAdmin, async (req, res) => {
  const { id } = req.params;
  const b = req.body;
  if (pool) {
    try {
      const result = await pool.query(
        `UPDATE galleries SET title=$1, cover_image=$2, images=$3, date=$4, category=$5, alt_text=$6, caption=$7, photographer_credit=$8, featured_image=$9, sort_order=$10, seo_title=$11, meta_description=$12, slug=$13, canonical_url=$14, og_image=$15 WHERE id=$16`,
        [b.title, b.coverImage, JSON.stringify(b.images || []), b.date, b.category, b.altText, b.caption, b.photographerCredit, b.featuredImage, b.sortOrder, b.seoTitle, b.metaDescription, b.slug, b.canonicalUrl, b.ogImage, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      return res.json({ success: true });
    } catch (e) { console.error('PG gallery update failed:', e.message); return res.status(500).json({ error: 'Failed to update' }); }
  }
  const db = readDb();
  const idx = (db.galleries || []).findIndex(g => String(g.id) === String(id));
  if (idx >= 0) { db.galleries[idx] = { ...db.galleries[idx], ...req.body }; writeDb(db); }
  res.json({ success: true });
});

router.delete('/galleries/:id', requireEmployeeOrAdmin, async (req, res) => {
  const { id } = req.params;
  if (pool) {
    try { await pool.query('DELETE FROM galleries WHERE id=$1', [id]); return res.json({ success: true }); }
    catch (e) { console.error('PG gallery delete failed:', e.message); }
  }
  const db = readDb();
  db.galleries = (db.galleries || []).filter(g => String(g.id) !== String(id));
  writeDb(db);
  res.json({ success: true });
});

// Public comments endpoints
router.get('/comments/:entityType/:entityId', async (req, res) => {
  const { entityType, entityId } = req.params;
  if (pool) {
    try {
      const result = await pool.query(
        'SELECT id, user_name, comment_text, date FROM comments WHERE entity_type=$1 AND entity_id=$2 AND status=$3 ORDER BY date DESC',
        [entityType, entityId, 'approved']
      );
      return res.json(result.rows.map(r => ({
        id: r.id,
        name: r.user_name,
        text: r.comment_text,
        date: r.date
      })));
    } catch (e) {
      console.error('PG comments fetch failed:', e.message);
      return res.status(500).json({ error: 'Failed to fetch comments' });
    }
  }
  const db = readDb();
  const comments = (db.comments || [])
    .filter(c => c.entity_type === entityType && String(c.entity_id) === String(entityId) && c.status === 'approved')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(c => ({
      id: c.id,
      name: c.user_name,
      text: c.comment_text,
      date: c.date
    }));
  res.json(comments);
});

router.post('/comments', async (req, res) => {
  const { entityType, entityId, name, text } = req.body;
  if (!entityType || !entityId || !name || !text) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const dateStr = new Date().toISOString();
  
  if (pool) {
    try {
      const result = await pool.query(
        'INSERT INTO comments (entity_type, entity_id, user_name, comment_text, status, date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, user_name, comment_text, date',
        [entityType, entityId, name, text, 'approved', dateStr]
      );
      const r = result.rows[0];
      return res.json({ success: true, comment: { id: r.id, name: r.user_name, text: r.comment_text, date: r.date } });
    } catch (e) {
      console.error('PG comment insert failed:', e.message);
      return res.status(500).json({ error: 'Failed to submit comment' });
    }
  }
  
  const db = readDb();
  if (!db.comments) db.comments = [];
  const newComment = {
    id: Date.now(),
    entity_type: entityType,
    entity_id: entityId,
    user_name: name,
    comment_text: text,
    status: 'approved',
    date: dateStr
  };
  db.comments.push(newComment);
  writeDb(db);
  res.json({ success: true, comment: { id: newComment.id, name: newComment.user_name, text: newComment.comment_text, date: newComment.date } });
});

module.exports = router;

