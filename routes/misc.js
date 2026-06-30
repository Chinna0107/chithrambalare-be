const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const { pool, readDb, writeDb } = require('../config/db.js');
const { fetchTollywoodImageByKeyword, axiosConfig } = require('../utils/helpers.js');

const { requireAdminPasscode } = require('../middlewares/auth.js');

router.get('/warmup', (req, res) => {
  res.json({ status: 'warm', time: new Date() });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
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
      const result = await pool.query('SELECT id, movie_name, release_date, language, status FROM schedules ORDER BY release_date ASC');
      const schedules = result.rows.map(r => ({
        id: r.id,
        movieName: r.movie_name,
        releaseDate: r.release_date,
        language: r.language,
        status: r.status
      }));
      return res.json(schedules);
    } catch (e) {
      console.error('PG Schedules read failed:', e.message);
    }
  }
  const db = readDb();
  res.json(db.upcomingSchedules || []);
});

router.post('/schedules', requireAdminPasscode, async (req, res) => {
  const list = req.body;
  if (pool) {
    try {
      await pool.query('DELETE FROM schedules');
      for (const s of list) {
        await pool.query(
          'INSERT INTO schedules (movie_name, release_date, language, status) VALUES ($1, $2, $3, $4)',
          [s.movieName, s.releaseDate, s.language, s.status]
        );
      }
      const result = await pool.query('SELECT id, movie_name, release_date, language, status FROM schedules ORDER BY release_date ASC');
      return res.json({
        success: true,
        upcomingSchedules: result.rows.map(r => ({
          id: r.id,
          movieName: r.movie_name,
          releaseDate: r.release_date,
          language: r.language,
          status: r.status
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
      const result = await pool.query('SELECT id, movie_name, hourly_gross, total_gross, premier_gross, screens, status, last_updated, poster FROM north_america ORDER BY id ASC');
      const collections = result.rows.map(r => ({
        id: r.id,
        movieName: r.movie_name,
        hourlyGross: r.hourly_gross,
        totalGross: r.total_gross,
        premierGross: r.premier_gross,
        screens: r.screens,
        status: r.status,
        lastUpdated: r.last_updated,
        poster: r.poster
      }));
      return res.json(collections);
    } catch (e) {
      console.error('PG North America read failed:', e.message);
    }
  }
  const db = readDb();
  res.json(db.northAmericaCollections || []);
});

router.post('/north-america', requireAdminPasscode, async (req, res) => {
  const list = req.body;
  if (pool) {
    try {
      await pool.query('DELETE FROM north_america');
      for (const n of list) {
        await pool.query(
          'INSERT INTO north_america (movie_name, hourly_gross, total_gross, premier_gross, screens, status, last_updated, poster) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [n.movieName, n.hourlyGross, n.totalGross, n.premierGross, n.screens, n.status, n.lastUpdated, n.poster]
        );
      }
      const result = await pool.query('SELECT id, movie_name, hourly_gross, total_gross, premier_gross, screens, status, last_updated, poster FROM north_america ORDER BY id ASC');
      return res.json({
        success: true,
        northAmericaCollections: result.rows.map(r => ({
          id: r.id,
          movieName: r.movie_name,
          hourlyGross: r.hourly_gross,
          totalGross: r.total_gross,
          premierGross: r.premier_gross,
          screens: r.screens,
          status: r.status,
          lastUpdated: r.last_updated,
          poster: r.poster
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
      const result = await pool.query('SELECT rank, movie_name, gross, verdict, trend FROM box_office_top5 ORDER BY rank ASC');
      const top5 = result.rows.map(r => ({
        rank: r.rank,
        movieName: r.movie_name,
        gross: r.gross,
        verdict: r.verdict,
        trend: r.trend
      }));
      return res.json(top5);
    } catch (e) {
      console.error('PG Box Office Top 5 read failed:', e.message);
    }
  }
  const db = readDb();
  res.json(db.boxOfficeTop5 || []);
});

router.post('/box-office-top5', requireAdminPasscode, async (req, res) => {
  const list = req.body;
  if (pool) {
    try {
      await pool.query('DELETE FROM box_office_top5');
      for (const b of list) {
        await pool.query(
          'INSERT INTO box_office_top5 (rank, movie_name, gross, verdict, trend) VALUES ($1, $2, $3, $4, $5)',
          [b.rank, b.movieName, b.gross, b.verdict, b.trend]
        );
      }
      const result = await pool.query('SELECT rank, movie_name, gross, verdict, trend FROM box_office_top5 ORDER BY rank ASC');
      return res.json({
        success: true,
        boxOfficeTop5: result.rows.map(r => ({
          rank: r.rank,
          movieName: r.movie_name,
          gross: r.gross,
          verdict: r.verdict,
          trend: r.trend
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

router.post('/galleries', requireAdminPasscode, async (req, res) => {
  const list = req.body;
  if (pool) {
    try {
      await pool.query('DELETE FROM galleries');
      for (const g of list) {
        await pool.query(
          'INSERT INTO galleries (title, cover_image, images, date) VALUES ($1, $2, $3, $4)',
          [g.title, g.coverImage, JSON.stringify(g.images || []), g.date || new Date().toISOString()]
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
          date: r.date
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

module.exports = router;
