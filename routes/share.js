const express = require('express');
const router = express.Router();
const { pool, readDb } = require('../config/db');

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

const generateHtml = (title, description, image, redirectUrl) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">
  <meta property="og:url" content="${redirectUrl}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">
  <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  <script>window.location.href = "${redirectUrl}";</script>
</head>
<body>
  <p>Redirecting to <a href="${redirectUrl}">article</a>...</p>
</body>
</html>
`;

router.get('/article/:slug', async (req, res) => {
  try {
    const article = await getItem('articles', req.params.slug);
    if (!article) return res.status(404).send('Not found');
    
    const title = article.seo_title || article.seoTitle || article.title || 'Article';
    const desc = article.meta_description || article.metaDescription || article.excerpt || '';
    const img = article.og_image || article.ogImage || article.featured_image || article.featuredImage || article.thumbnail || 'https://chitrambhalare.in/logo.png';
    const redirectUrl = `https://chitrambhalare.in/movie-news/${article.slug}`;

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
    
    const title = review.seo_title || review.seoTitle || `${review.movie_name || review.movieName} Review`;
    const desc = review.meta_description || review.metaDescription || review.snippet || review.verdict || '';
    const img = review.og_image || review.ogImage || review.poster || 'https://chitrambhalare.in/logo.png';
    const redirectUrl = `https://chitrambhalare.in/reviews/${review.slug}`;

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
    
    const title = item.seo_title || item.title || 'Telugu News';
    const desc = item.meta_description || item.excerpt || '';
    const img = item.og_image || item.thumbnail || 'https://chitrambhalare.in/logo.png';
    const redirectUrl = `https://chitrambhalare.in/telugu-news/${item.slug}`;

    res.send(generateHtml(title, desc, img, redirectUrl));
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
