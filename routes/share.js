const express = require('express');
const router = express.Router();
const { pool, readDb } = require('../config/db');

// A real hosted fallback image (served from Cloudinary so it's always accessible)
const FALLBACK_IMAGE = 'https://res.cloudinary.com/dmsx7md7p/image/upload/v1783962254/tolly-images/pqwr03cpfgci6vwsin3q.jpg';

// Helper: return first non-empty string value from a list of candidates, with a custom fallback
const firstVal = (fallback, ...args) => args.find(v => v && String(v).trim() !== '') || fallback;

// Helper to fetch from DB
const getItem = async (table, slug) => {
  if (pool) {
    const res = await pool.query(`SELECT * FROM ${table} WHERE slug = $1`, [slug]);
    return res.rows[0];
  } else {
    const db = readDb();
    const items = db[table] || [];
    return items.find(i => i.slug === slug);
  }
};

const generateHtml = (title, description, image, redirectUrl) => {
  const safeTitle = String(title || '').replace(/"/g, '&quot;');
  const safeDesc = String(description || '').replace(/"/g, '&quot;');
  const safeImg = String(image || FALLBACK_IMAGE).replace(/"/g, '&quot;');
  const safeUrl = String(redirectUrl || '').replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${safeTitle}</title>
  <meta property="og:site_name" content="ChitramBhalare">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${safeImg}">
  <meta property="og:image:secure_url" content="${safeImg}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:url" content="${safeUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${safeImg}">
  <meta name="description" content="${safeDesc}">
  <link rel="canonical" href="${safeUrl}">
  <meta http-equiv="refresh" content="0;url=${safeUrl}">
  <script>window.location.replace("${safeUrl}");</script>
</head>
<body>
  <p>Redirecting… <a href="${safeUrl}">Click here if not redirected</a></p>
</body>
</html>`;
};

router.get('/article/:slug', async (req, res) => {
  try {
    const article = await getItem('articles', req.params.slug);
    if (!article) return res.status(404).send('Not found');

    // Handle both PG snake_case and JSON camelCase property names
    const title = firstVal('ChitramBhalare Article', article.seo_title, article.seoTitle, article.title);
    const desc = firstVal('Read the latest Tollywood news on ChitramBhalare', article.meta_description, article.metaDescription, article.excerpt);
    const img = firstVal(FALLBACK_IMAGE, article.og_image, article.ogImage, article.featured_image, article.featuredImage, article.thumbnail);
    const redirectUrl = `https://chitrambhalare.in/movie-news/${article.slug}`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateHtml(title, desc, img, redirectUrl));
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

router.get('/review/:slug', async (req, res) => {
  try {
    const review = await getItem('reviews', req.params.slug);
    if (!review) return res.status(404).send('Not found');

    const movieName = review.movie_name || review.movieName;
    const title = firstVal('Movie Review', review.seo_title, review.seoTitle, movieName && `${movieName} Review`, review.title);
    const desc = firstVal('Read the full review on ChitramBhalare', review.meta_description, review.metaDescription, review.verdict, review.snippet);
    const img = firstVal(FALLBACK_IMAGE, review.og_image, review.ogImage, review.poster, review.thumbnail);
    const redirectUrl = `https://chitrambhalare.in/reviews/${review.slug}`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateHtml(title, desc, img, redirectUrl));
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

router.get('/telugu-news/:slug', async (req, res) => {
  try {
    const item = await getItem('telugu_news', req.params.slug);
    if (!item) return res.status(404).send('Not found');

    const title = firstVal('Telugu News', item.seo_title, item.seoTitle, item.title);
    const desc = firstVal('Read Telugu News on ChitramBhalare', item.meta_description, item.metaDescription, item.excerpt);
    const img = firstVal(FALLBACK_IMAGE, item.og_image, item.ogImage, item.thumbnail);
    const redirectUrl = `https://chitrambhalare.in/telugu-news/${item.slug}`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateHtml(title, desc, img, redirectUrl));
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
