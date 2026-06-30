const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { pool, readDb, writeDb, initDb } = require('../config/db.js');
const { requireAdminPasscode } = require('../middlewares/auth.js');

const DB_PATH = path.join(__dirname, '..', 'server-db.json');

router.get('/verify', requireAdminPasscode, (req, res) => {
  res.json({ ok: true });
});

router.get('/db', requireAdminPasscode, async (req, res) => {
  if (pool) {
    try {
      const popupRes = await pool.query('SELECT active, title, image_url, link_url, button_text FROM popup_ad ORDER BY id DESC LIMIT 1');
      const schedulesRes = await pool.query('SELECT id, movie_name, release_date, language, status FROM schedules ORDER BY release_date ASC');
      const naRes = await pool.query('SELECT id, movie_name, hourly_gross, total_gross, premier_gross, screens, status, last_updated, poster FROM north_america ORDER BY id ASC');
      const bo5Res = await pool.query('SELECT rank, movie_name, gross, verdict, trend FROM box_office_top5 ORDER BY rank ASC');
      const galleriesRes = await pool.query('SELECT id, title, cover_image, images, date FROM galleries ORDER BY id ASC');
      const articlesRes = await pool.query('SELECT id, slug, title, excerpt, content, thumbnail, featured_image, date, category, author, tags FROM articles ORDER BY date DESC');
      const reviewsRes = await pool.query('SELECT id, slug, movie_name, poster, rating, snippet, verdict, story, performances, technical_aspects, verdict_text, ott_platform, ott_release_date, date FROM reviews ORDER BY date DESC');
      const boRes = await pool.query('SELECT id, slug, movie_name, director, movie_cast, poster, day_collection, worldwide_gross, india_net, india_gross, overseas, verdict, trend, days, languages, percentage, date, daily_breakdown, budget, total_india_net, us_premieres FROM box_office ORDER BY date DESC');
      
      const db = {
        settings: {},
        popupAd: popupRes.rows[0] ? {
          active: popupRes.rows[0].active,
          title: popupRes.rows[0].title,
          imageUrl: popupRes.rows[0].image_url,
          linkUrl: popupRes.rows[0].link_url,
          buttonText: popupRes.rows[0].button_text
        } : { active: false },
        upcomingSchedules: schedulesRes.rows.map(r => ({
          id: r.id,
          movieName: r.movie_name,
          releaseDate: r.release_date,
          language: r.language,
          status: r.status
        })),
        northAmericaCollections: naRes.rows.map(r => ({
          id: r.id,
          movieName: r.movie_name,
          hourlyGross: r.hourly_gross,
          totalGross: r.total_gross,
          premierGross: r.premier_gross,
          screens: r.screens,
          status: r.status,
          lastUpdated: r.last_updated,
          poster: r.poster
        })),
        boxOfficeTop5: bo5Res.rows.map(r => ({
          rank: r.rank,
          movieName: r.movie_name,
          gross: r.gross,
          verdict: r.verdict,
          trend: r.trend
        })),
        galleries: galleriesRes.rows.map(r => ({
          id: r.id,
          title: r.title,
          coverImage: r.cover_image,
          images: typeof r.images === 'string' ? JSON.parse(r.images) : r.images,
          date: r.date
        })),
        articles: articlesRes.rows.map(r => ({
          id: r.id,
          slug: r.slug,
          title: r.title,
          excerpt: r.excerpt,
          content: typeof r.content === 'string' ? JSON.parse(r.content) : r.content,
          thumbnail: r.thumbnail,
          featuredImage: r.featured_image,
          date: r.date,
          category: r.category,
          author: r.author,
          tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags
        })),
        reviews: reviewsRes.rows.map(r => ({
          id: r.id,
          slug: r.slug,
          movieName: r.movie_name,
          poster: r.poster,
          rating: r.rating,
          snippet: r.snippet,
          verdict: r.verdict,
          story: r.story,
          performances: r.performances,
          technicalAspects: r.technical_aspects,
          verdictText: r.verdict_text,
          ottPlatform: r.ott_platform,
          ottReleaseDate: r.ott_release_date,
          date: r.date
        })),
        boxOffice: boRes.rows.map(r => ({
          id: r.id,
          slug: r.slug,
          movieName: r.movie_name,
          director: r.director,
          cast: r.movie_cast,
          poster: r.poster,
          dayCollection: r.day_collection,
          worldwideGross: r.worldwide_gross,
          indiaNet: r.india_net,
          indiaGross: r.india_gross,
          overseas: r.overseas,
          verdict: r.verdict,
          trend: r.trend,
          days: r.days,
          languages: r.languages,
          percentage: r.percentage,
          date: r.date,
          dailyBreakdown: typeof r.daily_breakdown === 'string' ? JSON.parse(r.daily_breakdown) : r.daily_breakdown,
          budget: r.budget,
          totalIndiaNet: r.total_india_net,
          usPremieres: r.us_premieres
        }))
      };
      return res.json(db);
    } catch (e) {
      console.error('PG GET /api/admin/db failed:', e.message);
    }
  }
  res.json(readDb());
});

router.post('/db/reset', requireAdminPasscode, async (req, res) => {
  if (pool) {
    try {
      console.log('Resetting PG Database tables...');
      await pool.query('DROP TABLE IF EXISTS settings, popup_ad, schedules, north_america, box_office_top5, articles, reviews, box_office, galleries CASCADE');
      await initDb();
      return res.json({ success: true });
    } catch (e) {
      console.error('PG DB reset failed:', e.message);
      return res.status(500).json({ error: 'Failed to reset PG database' });
    }
  }
  try {
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }
    const db = readDb();
    res.json(db);
  } catch (err) {
    console.error('Failed to reset DB:', err.message);
    res.status(500).json({ error: 'Failed to reset database' });
  }
});

router.get('/popup-ad', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT active, title, image_url, link_url, button_text FROM popup_ad ORDER BY id DESC LIMIT 1');
      if (result.rows.length > 0) {
        const ad = result.rows[0];
        return res.json({
          active: ad.active,
          title: ad.title,
          imageUrl: ad.image_url,
          linkUrl: ad.link_url,
          buttonText: ad.button_text
        });
      }
    } catch (e) {
      console.error('PG Popup ad read failed:', e.message);
    }
  }
  const db = readDb();
  res.json(db.popupAd || { active: false });
});

router.post('/popup-ad', requireAdminPasscode, async (req, res) => {
  const ad = req.body;
  if (pool) {
    try {
      await pool.query('DELETE FROM popup_ad');
      await pool.query(
        'INSERT INTO popup_ad (active, title, image_url, link_url, button_text) VALUES ($1, $2, $3, $4, $5)',
        [ad.active, ad.title, ad.imageUrl, ad.linkUrl, ad.buttonText]
      );
      return res.json({ success: true, popupAd: ad });
    } catch (e) {
      console.error('PG Popup ad write failed:', e.message);
    }
  }
  try {
    const db = readDb();
    db.popupAd = req.body;
    writeDb(db);
    res.json({ success: true, popupAd: db.popupAd });
  } catch (err) {
    console.error('Failed to update popup-ad:', err.message);
    res.status(500).json({ error: 'Failed to save popup-ad' });
  }
});

module.exports = router;
