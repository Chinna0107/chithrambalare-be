const express = require('express');
const router = express.Router();
const { pool, readDb, writeDb } = require('../config/db.js');
const { requireAdminPasscode } = require('../middlewares/auth.js');

// ==================== TAXONOMY ====================
router.get('/taxonomy', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT id, type, name, slug, description FROM taxonomy ORDER BY id ASC');
      return res.json(result.rows.map(r => ({
        id: r.id, type: r.type, name: r.name, slug: r.slug, description: r.description
      })));
    } catch (e) { console.error('PG taxonomy read failed:', e.message); }
  }
  const db = readDb();
  res.json(db.taxonomy || []);
});

router.post('/taxonomy', requireAdminPasscode, async (req, res) => {
  if (Array.isArray(req.body)) {
    // Bulk replace
    if (pool) {
      try {
        await pool.query('DELETE FROM taxonomy');
        for (const t of req.body) {
          await pool.query(
            'INSERT INTO taxonomy (type, name, slug, description) VALUES ($1, $2, $3, $4)',
            [t.type, t.name, t.slug, t.description]
          );
        }
        const result = await pool.query('SELECT id, type, name, slug, description FROM taxonomy ORDER BY id ASC');
        return res.json({ success: true, taxonomy: result.rows });
      } catch (e) { console.error('PG taxonomy write failed:', e.message); }
    }
    const db = readDb();
    db.taxonomy = req.body;
    writeDb(db);
    return res.json({ success: true });
  }
  // Single add
  const { type, name, slug, description } = req.body;
  if (pool) {
    try {
      const result = await pool.query(
        'INSERT INTO taxonomy (type, name, slug, description) VALUES ($1, $2, $3, $4) RETURNING *',
        [type, name, slug, description]
      );
      return res.json({ success: true, item: result.rows[0] });
    } catch (e) { console.error('PG taxonomy add failed:', e.message); }
  }
  const db = readDb();
  if (!db.taxonomy) db.taxonomy = [];
  db.taxonomy.push(req.body);
  writeDb(db);
  res.json({ success: true });
});

router.put('/taxonomy/:id', requireAdminPasscode, async (req, res) => {
  const { id } = req.params;
  const { type, name, slug, description } = req.body;
  if (pool) {
    try {
      const result = await pool.query(
        'UPDATE taxonomy SET type=$1, name=$2, slug=$3, description=$4 WHERE id=$5 RETURNING *',
        [type, name, slug, description, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      return res.json({ success: true, item: result.rows[0] });
    } catch (e) { console.error('PG taxonomy update failed:', e.message); }
  }
  const db = readDb();
  const idx = (db.taxonomy || []).findIndex(t => String(t.id) === String(id));
  if (idx >= 0) { db.taxonomy[idx] = { ...db.taxonomy[idx], ...req.body }; writeDb(db); }
  res.json({ success: true });
});

router.delete('/taxonomy/:id', requireAdminPasscode, async (req, res) => {
  const { id } = req.params;
  if (pool) {
    try {
      const result = await pool.query('DELETE FROM taxonomy WHERE id=$1', [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      return res.json({ success: true });
    } catch (e) { console.error('PG taxonomy delete failed:', e.message); }
  }
  const db = readDb();
  db.taxonomy = (db.taxonomy || []).filter(t => String(t.id) !== String(id));
  writeDb(db);
  res.json({ success: true });
});

// ==================== LANDING PAGE ====================
router.get('/landing-page', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT * FROM landing_page ORDER BY id DESC LIMIT 1');
      if (result.rows.length > 0) {
        const r = result.rows[0];
        return res.json({
          id: r.id, active: r.active, bannerUrl: r.banner_url, heading: r.heading,
          description: r.description, ctaText: r.cta_text, ctaUrl: r.cta_url,
          backgroundImage: r.background_image, videoBackground: r.video_background,
          countdownTarget: r.countdown_target, seoTitle: r.seo_title, metaDescription: r.meta_description
        });
      }
      return res.json({});
    } catch (e) { console.error('PG landing page read failed:', e.message); }
  }
  const db = readDb();
  res.json(db.landingPage || {});
});

router.post('/landing-page', requireAdminPasscode, async (req, res) => {
  const b = req.body;
  if (pool) {
    try {
      await pool.query('DELETE FROM landing_page');
      await pool.query(
        `INSERT INTO landing_page (active, banner_url, heading, description, cta_text, cta_url, background_image, video_background, countdown_target, seo_title, meta_description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [b.active, b.bannerUrl, b.heading, b.description, b.ctaText, b.ctaUrl,
         b.backgroundImage, b.videoBackground, b.countdownTarget, b.seoTitle, b.metaDescription]
      );
      return res.json({ success: true });
    } catch (e) { console.error('PG landing page write failed:', e.message); }
  }
  const db = readDb();
  db.landingPage = req.body;
  writeDb(db);
  res.json({ success: true });
});

// ==================== COMMENTS ====================
router.get('/comments', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT * FROM comments ORDER BY id DESC');
      return res.json(result.rows.map(r => ({
        id: r.id, entityType: r.entity_type, entityId: r.entity_id,
        userName: r.user_name, commentText: r.comment_text, status: r.status, date: r.date
      })));
    } catch (e) { console.error('PG comments read failed:', e.message); }
  }
  const db = readDb();
  res.json(db.comments || []);
});

router.post('/comments', requireAdminPasscode, async (req, res) => {
  if (Array.isArray(req.body)) {
    if (pool) {
      try {
        await pool.query('DELETE FROM comments');
        for (const c of req.body) {
          await pool.query(
            'INSERT INTO comments (entity_type, entity_id, user_name, comment_text, status, date) VALUES ($1, $2, $3, $4, $5, $6)',
            [c.entityType, c.entityId, c.userName, c.commentText, c.status || 'pending', c.date]
          );
        }
        return res.json({ success: true });
      } catch (e) { console.error('PG comments bulk write failed:', e.message); }
    }
    const db = readDb();
    db.comments = req.body;
    writeDb(db);
    return res.json({ success: true });
  }
  // Single comment
  const { entityType, entityId, userName, commentText, status, date } = req.body;
  if (pool) {
    try {
      await pool.query(
        'INSERT INTO comments (entity_type, entity_id, user_name, comment_text, status, date) VALUES ($1, $2, $3, $4, $5, $6)',
        [entityType, entityId, userName, commentText, status || 'pending', date || new Date().toISOString()]
      );
      return res.json({ success: true });
    } catch (e) { console.error('PG comment add failed:', e.message); }
  }
  const db = readDb();
  if (!db.comments) db.comments = [];
  db.comments.push(req.body);
  writeDb(db);
  res.json({ success: true });
});

router.put('/comments/:id', requireAdminPasscode, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (pool) {
    try {
      const result = await pool.query('UPDATE comments SET status=$1 WHERE id=$2 RETURNING *', [status, id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
      return res.json({ success: true });
    } catch (e) { console.error('PG comment update failed:', e.message); }
  }
  const db = readDb();
  const idx = (db.comments || []).findIndex(c => String(c.id) === String(id));
  if (idx >= 0) { db.comments[idx] = { ...db.comments[idx], ...req.body }; writeDb(db); }
  res.json({ success: true });
});

router.delete('/comments/:id', requireAdminPasscode, async (req, res) => {
  const { id } = req.params;
  if (pool) {
    try {
      await pool.query('DELETE FROM comments WHERE id=$1', [id]);
      return res.json({ success: true });
    } catch (e) { console.error('PG comment delete failed:', e.message); }
  }
  const db = readDb();
  db.comments = (db.comments || []).filter(c => String(c.id) !== String(id));
  writeDb(db);
  res.json({ success: true });
});

// ==================== MEDIA LIBRARY ====================
router.get('/media', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT * FROM media_library ORDER BY id DESC');
      return res.json(result.rows.map(r => ({
        id: r.id, fileName: r.file_name, fileUrl: r.file_url,
        fileType: r.file_type, size: r.size, date: r.date
      })));
    } catch (e) { console.error('PG media read failed:', e.message); }
  }
  const db = readDb();
  res.json(db.mediaLibrary || []);
});

router.post('/media', requireAdminPasscode, async (req, res) => {
  if (Array.isArray(req.body)) {
    if (pool) {
      try {
        await pool.query('DELETE FROM media_library');
        for (const m of req.body) {
          await pool.query(
            'INSERT INTO media_library (file_name, file_url, file_type, size, date) VALUES ($1, $2, $3, $4, $5)',
            [m.fileName, m.fileUrl, m.fileType, m.size, m.date]
          );
        }
        return res.json({ success: true });
      } catch (e) { console.error('PG media bulk write failed:', e.message); }
    }
    const db = readDb();
    db.mediaLibrary = req.body;
    writeDb(db);
    return res.json({ success: true });
  }
  const { fileName, fileUrl, fileType, size } = req.body;
  if (pool) {
    try {
      const result = await pool.query(
        'INSERT INTO media_library (file_name, file_url, file_type, size, date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [fileName, fileUrl, fileType, size, new Date().toISOString()]
      );
      return res.json({ success: true, item: result.rows[0] });
    } catch (e) { console.error('PG media add failed:', e.message); }
  }
  const db = readDb();
  if (!db.mediaLibrary) db.mediaLibrary = [];
  db.mediaLibrary.push({ ...req.body, date: new Date().toISOString() });
  writeDb(db);
  res.json({ success: true });
});

router.delete('/media/:id', requireAdminPasscode, async (req, res) => {
  const { id } = req.params;
  if (pool) {
    try {
      await pool.query('DELETE FROM media_library WHERE id=$1', [id]);
      return res.json({ success: true });
    } catch (e) { console.error('PG media delete failed:', e.message); }
  }
  const db = readDb();
  db.mediaLibrary = (db.mediaLibrary || []).filter(m => String(m.id) !== String(id));
  writeDb(db);
  res.json({ success: true });
});

// ==================== GLOBAL SETTINGS ====================
router.get('/settings/global', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT * FROM settings ORDER BY id DESC LIMIT 1');
      if (result.rows.length > 0) {
        const r = result.rows[0];
        return res.json({
          siteName: r.site_name, logoUrl: r.logo_url,
          maintenanceMode: r.maintenance_mode,
          socialLinks: typeof r.social_links === 'string' ? JSON.parse(r.social_links) : r.social_links
        });
      }
      return res.json({});
    } catch (e) { console.error('PG settings read failed:', e.message); }
  }
  const db = readDb();
  const { adminPassword, ...safeSettings } = (db.settings || {});
  res.json(safeSettings);
});

router.post('/settings/global', requireAdminPasscode, async (req, res) => {
  const { siteName, logoUrl, maintenanceMode, socialLinks } = req.body;
  if (pool) {
    try {
      await pool.query(
        `UPDATE settings SET site_name = COALESCE($1, site_name), logo_url = COALESCE($2, logo_url),
         maintenance_mode = COALESCE($3, maintenance_mode), social_links = COALESCE($4, social_links)
         WHERE id = (SELECT id FROM settings ORDER BY id DESC LIMIT 1)`,
        [siteName, logoUrl, maintenanceMode, socialLinks ? JSON.stringify(socialLinks) : null]
      );
      return res.json({ success: true });
    } catch (e) { console.error('PG settings update failed:', e.message); }
  }
  const db = readDb();
  db.settings = { ...db.settings, ...req.body };
  writeDb(db);
  res.json({ success: true });
});

// ==================== MONETIZATION ADS ====================
router.get('/monetization', async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query('SELECT * FROM monetization_ads ORDER BY id ASC');
      return res.json(result.rows.map(r => ({
        id: r.id, placement: r.placement, active: r.active,
        scriptCode: r.script_code, imageUrl: r.image_url, linkUrl: r.link_url
      })));
    } catch (e) { console.error('PG monetization read failed:', e.message); }
  }
  const db = readDb();
  res.json(db.monetizationAds || []);
});

router.post('/monetization', requireAdminPasscode, async (req, res) => {
  if (Array.isArray(req.body)) {
    if (pool) {
      try {
        await pool.query('DELETE FROM monetization_ads');
        for (const m of req.body) {
          await pool.query(
            'INSERT INTO monetization_ads (placement, active, script_code, image_url, link_url) VALUES ($1, $2, $3, $4, $5)',
            [m.placement, m.active, m.scriptCode, m.imageUrl, m.linkUrl]
          );
        }
        return res.json({ success: true });
      } catch (e) { console.error('PG monetization bulk write failed:', e.message); }
    }
    const db = readDb();
    db.monetizationAds = req.body;
    writeDb(db);
    return res.json({ success: true });
  }
  const { placement, active, scriptCode, imageUrl, linkUrl } = req.body;
  if (pool) {
    try {
      await pool.query(
        'INSERT INTO monetization_ads (placement, active, script_code, image_url, link_url) VALUES ($1, $2, $3, $4, $5)',
        [placement, active, scriptCode, imageUrl, linkUrl]
      );
      return res.json({ success: true });
    } catch (e) { console.error('PG monetization add failed:', e.message); }
  }
  const db = readDb();
  if (!db.monetizationAds) db.monetizationAds = [];
  db.monetizationAds.push(req.body);
  writeDb(db);
  res.json({ success: true });
});

module.exports = router;
