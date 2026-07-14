const express = require('express');
const router = express.Router();
const { pool, readDb, writeDb } = require('../config/db.js');
const { requireAdminPasscode } = require('../middlewares/auth.js');

// SEO Settings
router.get('/settings', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT * FROM seo_settings ORDER BY id DESC LIMIT 1');
      if (result.rows.length > 0) {
        const r = result.rows[0];
        return res.json({
          sitemapEnabled: r.sitemap_enabled, robotsTxt: r.robots_txt,
          googleAnalyticsId: r.google_analytics_id, searchConsoleId: r.search_console_id,
          defaultOgImage: r.default_og_image, schemaType: r.schema_type
        });
      }
      return res.json({ sitemapEnabled: true, schemaType: 'NewsArticle' });
    } catch (e) { console.error('PG seo settings read failed:', e.message); }
  }
  const db = readDb();
  res.json(db.seoSettings || { sitemapEnabled: true, schemaType: 'NewsArticle' });
});

router.post('/settings', requireAdminPasscode, async (req, res) => {
  const b = req.body;
  if (pool) {
    try {
      const check = await pool.query('SELECT COUNT(*) FROM seo_settings');
      if (parseInt(check.rows[0].count) === 0) {
        await pool.query(
          'INSERT INTO seo_settings (sitemap_enabled, robots_txt, google_analytics_id, search_console_id, default_og_image, schema_type) VALUES ($1,$2,$3,$4,$5,$6)',
          [b.sitemapEnabled, b.robotsTxt, b.googleAnalyticsId, b.searchConsoleId, b.defaultOgImage, b.schemaType]
        );
      } else {
        await pool.query(
          `UPDATE seo_settings SET sitemap_enabled=COALESCE($1, sitemap_enabled), robots_txt=COALESCE($2, robots_txt), google_analytics_id=COALESCE($3, google_analytics_id), search_console_id=COALESCE($4, search_console_id), default_og_image=COALESCE($5, default_og_image), schema_type=COALESCE($6, schema_type)
           WHERE id = (SELECT id FROM seo_settings ORDER BY id DESC LIMIT 1)`,
          [b.sitemapEnabled, b.robotsTxt, b.googleAnalyticsId, b.searchConsoleId, b.defaultOgImage, b.schemaType]
        );
      }
      return res.json({ success: true });
    } catch (e) { console.error('PG seo settings write failed:', e.message); }
  }
  const db = readDb();
  db.seoSettings = { ...(db.seoSettings || {}), ...req.body };
  writeDb(db);
  res.json({ success: true });
});

// SEO Health Check
router.get('/health', async (req, res) => {
  const health = { total: 0, withSeo: 0, missingSeo: 0, issues: [] };
  if (pool) {
    try {
      const articles = await pool.query('SELECT id, title, seo_title, meta_description, slug FROM articles');
      const reviews = await pool.query('SELECT id, movie_name, seo_title, meta_description, slug FROM reviews');
      const allContent = [
        ...articles.rows.map(r => ({ type: 'article', id: r.id, title: r.title, seoTitle: r.seo_title, metaDesc: r.meta_description, slug: r.slug })),
        ...reviews.rows.map(r => ({ type: 'review', id: r.id, title: r.movie_name, seoTitle: r.seo_title, metaDesc: r.meta_description, slug: r.slug }))
      ];
      health.total = allContent.length;
      for (const item of allContent) {
        const issues = [];
        if (!item.seoTitle) issues.push('Missing SEO title');
        if (!item.metaDesc) issues.push('Missing meta description');
        if (!item.slug) issues.push('Missing slug');
        if (issues.length === 0) { health.withSeo++; }
        else { health.missingSeo++; health.issues.push({ ...item, issues }); }
      }
      health.score = health.total > 0 ? Math.round((health.withSeo / health.total) * 100) : 100;
      return res.json(health);
    } catch (e) { console.error('PG seo health failed:', e.message); }
  }
  res.json({ total: 0, withSeo: 0, missingSeo: 0, score: 100, issues: [] });
});

// Dynamic Sitemap
router.get('/sitemap.xml', async (req, res) => {
  const baseUrl = 'https://chitrambhalare.in';
  let urls = [
    { loc: baseUrl, priority: '1.0', changefreq: 'daily' },
    { loc: `${baseUrl}/movie-news`, priority: '0.9', changefreq: 'daily' },
    { loc: `${baseUrl}/reviews`, priority: '0.9', changefreq: 'weekly' },
    { loc: `${baseUrl}/box-office`, priority: '0.8', changefreq: 'daily' },
    { loc: `${baseUrl}/galleries`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${baseUrl}/about`, priority: '0.5', changefreq: 'monthly' },
  ];
  if (pool) {
    try {
      const articles = await pool.query("SELECT slug, date FROM articles WHERE status='published' ORDER BY date DESC");
      const reviews = await pool.query("SELECT slug, date FROM reviews ORDER BY date DESC");
      const boxOffice = await pool.query('SELECT slug FROM box_office');
      articles.rows.forEach(r => { if (r.slug) urls.push({ loc: `${baseUrl}/movie-news/${r.slug}`, priority: '0.8', changefreq: 'weekly', lastmod: r.date }); });
      reviews.rows.forEach(r => { if (r.slug) urls.push({ loc: `${baseUrl}/reviews/${r.slug}`, priority: '0.8', changefreq: 'monthly', lastmod: r.date }); });
      boxOffice.rows.forEach(r => { if (r.slug) urls.push({ loc: `${baseUrl}/box-office/${r.slug}`, priority: '0.7', changefreq: 'daily' }); });
    } catch (e) { console.error('PG sitemap gen failed:', e.message); }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;
  res.setHeader('Content-Type', 'application/xml');
  res.send(xml);
});

module.exports = router;
