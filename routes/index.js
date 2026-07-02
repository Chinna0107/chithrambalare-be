const express = require('express');
const router = express.Router();

const articlesRoutes = require('./articles.js');
const reviewsRoutes = require('./reviews.js');
const boxOfficeRoutes = require('./boxOffice.js');
const adminRoutes = require('./admin.js');
const adminModulesRoutes = require('./adminModules.js');
const miscRoutes = require('./misc.js');
const uploadRoutes = require('./upload.js');
const seoRoutes = require('./seo.js');

router.use('/articles', articlesRoutes);
router.use('/reviews', reviewsRoutes);
router.use('/box-office', boxOfficeRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/modules', adminModulesRoutes);
router.use('/upload', uploadRoutes);
router.use('/seo', seoRoutes);
// Mount admin routes at root so frontend can access: /api/verify, /api/db, /api/db/reset,
// /api/settings, /api/popup-ad without the /admin prefix
router.use('/', adminRoutes);
router.use('/', miscRoutes);

module.exports = router;
