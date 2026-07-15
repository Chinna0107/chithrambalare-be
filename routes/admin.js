const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { pool, readDb, writeDb, initDb } = require('../config/db.js');
const { requireAdminPasscode, requireEmployeeOrAdmin } = require('../middlewares/auth.js');

const DB_PATH = path.join(__dirname, '..', 'server-db.json');

router.get('/verify', requireAdminPasscode, (req, res) => {
  res.json({ ok: true });
});

router.get('/db', requireEmployeeOrAdmin, async (req, res) => {
  if (pool) {
    try {
      const popupRes = await pool.query('SELECT * FROM popup_ad ORDER BY id DESC LIMIT 1');
      const schedulesRes = await pool.query('SELECT id, movie_name, release_date, remaining_days, language, status, banner, director, cast_list, genre, release_status, trailer_link, notes, slug, seo_title, meta_description, meta_keywords, canonical_url, og_title, og_description, og_image FROM schedules ORDER BY release_date ASC');
      const naRes = await pool.query('SELECT id, slug, movie_name, hourly_gross, total_gross, premier_gross, screens, status, last_updated, poster, release_date, language, distributor, genre, budget, opening_day_preview, advance_bookings, premiere_collections, weekend_collections, weekly_collections, daily_breakdown, notes, seo_title, meta_description, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_card, robots FROM north_america ORDER BY id ASC');
      const bo5Res = await pool.query('SELECT * FROM box_office_top5 ORDER BY rank ASC');
      const galleriesRes = await pool.query('SELECT * FROM galleries ORDER BY id ASC');
      const articlesRes = await pool.query('SELECT id, slug, title, excerpt, content, thumbnail, featured_image, date, category, author, tags, views, seo_title, meta_description, focus_keyword, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_card, schema_markup, breadcrumb, robots FROM articles ORDER BY date DESC');
      const reviewsRes = await pool.query('SELECT id, slug, movie_name, poster, rating, snippet, verdict, story, performances, technical_aspects, verdict_text, ott_platform, ott_release_date, date, director, producer, production_house, language, genre, release_date, runtime, trailer, status, views, seo_title, meta_description, meta_keywords, canonical_url, og_title, og_description, og_image, twitter_card, schema_markup, robots FROM reviews ORDER BY date DESC');
      const boRes = await pool.query('SELECT * FROM box_office ORDER BY date DESC');
      const taxonomyRes = await pool.query('SELECT id, type, name, slug, description FROM taxonomy ORDER BY id ASC');
      const landingPageRes = await pool.query('SELECT * FROM landing_page ORDER BY id DESC LIMIT 1');
      const monetizationAdsRes = await pool.query('SELECT id, placement, active, script_code, image_url, link_url FROM monetization_ads ORDER BY id ASC');
      const commentsRes = await pool.query('SELECT id, entity_type, entity_id, user_name, comment_text, status, date FROM comments ORDER BY date DESC');
      const mediaLibraryRes = await pool.query('SELECT id, file_name, file_url, file_type, size, date FROM media_library ORDER BY date DESC');
      const settingsRes = await pool.query('SELECT site_name, logo_url, maintenance_mode, social_links FROM settings ORDER BY id DESC LIMIT 1');
      const analyticsRes = await pool.query('SELECT bounce_rate, most_viewed_articles, most_viewed_reviews, top_performing_pages, recent_activity FROM analytics ORDER BY id DESC LIMIT 1');
      
      const totalVisRes = await pool.query('SELECT COUNT(DISTINCT visitor_id) FROM visitor_logs');
      const dailyVisRes = await pool.query("SELECT COUNT(DISTINCT visitor_id) FROM visitor_logs WHERE created_at >= NOW() - INTERVAL '1 day'");
      const weeklyVisRes = await pool.query("SELECT COUNT(DISTINCT visitor_id) FROM visitor_logs WHERE created_at >= NOW() - INTERVAL '7 days'");
      const monthlyVisRes = await pool.query("SELECT COUNT(DISTINCT visitor_id) FROM visitor_logs WHERE created_at >= NOW() - INTERVAL '30 days'");
      const pageViewsRes = await pool.query('SELECT COUNT(*) FROM visitor_logs');
      
      const db = {
        settings: settingsRes.rows[0] ? {
          siteName: settingsRes.rows[0].site_name,
          logoUrl: settingsRes.rows[0].logo_url,
          maintenanceMode: settingsRes.rows[0].maintenance_mode,
          socialLinks: typeof settingsRes.rows[0].social_links === 'string' ? JSON.parse(settingsRes.rows[0].social_links) : settingsRes.rows[0].social_links
        } : {},
        popupAd: popupRes.rows[0] ? {
          active: popupRes.rows[0].active,
          title: popupRes.rows[0].title,
          imageDesktop: popupRes.rows[0].image_desktop,
          imageMobile: popupRes.rows[0].image_mobile,
          redirectUrl: popupRes.rows[0].redirect_url,
          scheduleStart: popupRes.rows[0].schedule_start,
          scheduleEnd: popupRes.rows[0].schedule_end,
          closeTimer: popupRes.rows[0].close_timer,
          autoClose: popupRes.rows[0].auto_close,
          displayRule: popupRes.rows[0].display_rule,
          displayDelay: popupRes.rows[0].display_delay,
          carouselItems: typeof popupRes.rows[0].carousel_items === 'string' ? JSON.parse(popupRes.rows[0].carousel_items) : popupRes.rows[0].carousel_items,
          buttonText: popupRes.rows[0].button_text,
          imageUrl: popupRes.rows[0].image_url,
          description: popupRes.rows[0].description
        } : { active: false },
        upcomingSchedules: schedulesRes.rows.map(r => ({
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
          slug: r.slug,
          seoTitle: r.seo_title,
          metaDescription: r.meta_description,
          metaKeywords: r.meta_keywords,
          canonicalUrl: r.canonical_url,
          ogTitle: r.og_title,
          ogDescription: r.og_description,
          ogImage: r.og_image
        })),
        northAmericaCollections: naRes.rows.map(r => ({
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
        })),
        boxOfficeTop5: bo5Res.rows.map(r => ({
          rank: r.rank,
          movieName: r.movie_name,
          gross: r.gross,
          verdict: r.verdict,
          trend: r.trend,
          slug: r.slug,
          seoTitle: r.seo_title,
          metaDescription: r.meta_description,
          metaKeywords: r.meta_keywords,
          canonicalUrl: r.canonical_url,
          openingCollection: r.opening_collection,
          weekendCollection: r.weekend_collection,
          totalCollection: r.total_collection,
          territory: r.territory,
          lastUpdated: r.last_updated
        })),
        galleries: galleriesRes.rows.map(r => ({
          id: r.id,
          title: r.title,
          coverImage: r.cover_image,
          images: typeof r.images === 'string' ? JSON.parse(r.images) : r.images,
          date: r.date,
          category: r.category,
          slug: r.slug,
          seoTitle: r.seo_title,
          metaDescription: r.meta_description,
          metaKeywords: r.meta_keywords,
          canonicalUrl: r.canonical_url,
          ogImage: r.og_image
        })),
        articles: articlesRes.rows.map(r => ({
          id: r.id,
          slug: r.slug,
          title: r.title,
          excerpt: r.excerpt,
          content: r.content,
          thumbnail: r.thumbnail,
          featuredImage: r.featured_image,
          date: r.date,
          category: r.category,
          author: r.author,
          tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags,
          views: r.views || 0,
          seoTitle: r.seo_title,
          metaDescription: r.meta_description,
          focusKeyword: r.focus_keyword,
          metaKeywords: r.meta_keywords,
          canonicalUrl: r.canonical_url,
          ogTitle: r.og_title,
          ogDescription: r.og_description,
          ogImage: r.og_image,
          twitterCard: r.twitter_card,
          schemaMarkup: typeof r.schema_markup === 'string' ? JSON.parse(r.schema_markup) : r.schema_markup,
          breadcrumb: r.breadcrumb,
          robots: r.robots
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
          date: r.date,
          director: r.director,
          producer: r.producer,
          productionHouse: r.production_house,
          language: r.language,
          genre: r.genre,
          releaseDate: r.release_date,
          runtime: r.runtime,
          trailer: r.trailer,
          status: r.status,
          views: r.views || 0,
          seoTitle: r.seo_title,
          metaDescription: r.meta_description,
          metaKeywords: r.meta_keywords,
          canonicalUrl: r.canonical_url,
          ogTitle: r.og_title,
          ogDescription: r.og_description,
          ogImage: r.og_image,
          twitterCard: r.twitter_card,
          schemaMarkup: typeof r.schema_markup === 'string' ? JSON.parse(r.schema_markup) : r.schema_markup,
          robots: r.robots
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
          usPremieres: r.us_premieres,
          views: r.views || 0,
          releaseDate: r.release_date,
          genre: r.genre,
          distributor: r.distributor,
          openingDayPreview: r.opening_day_preview,
          advanceBookings: r.advance_bookings,
          premiereCollections: r.premiere_collections,
          weekendCollections: r.weekend_collections,
          weeklyCollections: r.weekly_collections,
          totalGross: r.total_gross,
          boStatus: r.bo_status,
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
        })),
        taxonomy: taxonomyRes.rows,
        landingPage: landingPageRes.rows[0] ? {
          active: landingPageRes.rows[0].active,
          bannerUrl: landingPageRes.rows[0].banner_url,
          heading: landingPageRes.rows[0].heading,
          description: landingPageRes.rows[0].description,
          ctaText: landingPageRes.rows[0].cta_text,
          ctaUrl: landingPageRes.rows[0].cta_url,
          backgroundImage: landingPageRes.rows[0].background_image,
          videoBackground: landingPageRes.rows[0].video_background,
          countdownTarget: landingPageRes.rows[0].countdown_target,
          seoTitle: landingPageRes.rows[0].seo_title,
          metaDescription: landingPageRes.rows[0].meta_description
        } : { active: false },
        monetizationAds: monetizationAdsRes.rows.map(r => ({
          id: r.id,
          placement: r.placement,
          active: r.active,
          scriptCode: r.script_code,
          imageUrl: r.image_url,
          linkUrl: r.link_url
        })),
        comments: commentsRes.rows.map(r => ({
          id: r.id,
          entityType: r.entity_type,
          entityId: r.entity_id,
          userName: r.user_name,
          commentText: r.comment_text,
          status: r.status,
          date: r.date
        })),
        mediaLibrary: mediaLibraryRes.rows.map(r => ({
          id: r.id,
          fileName: r.file_name,
          fileUrl: r.file_url,
          fileType: r.file_type,
          size: r.size,
          date: r.date
        })),
        analytics: analyticsRes.rows[0] ? {
          totalVisitors: totalVisRes.rows[0].count,
          dailyVisitors: dailyVisRes.rows[0].count,
          weeklyVisitors: weeklyVisRes.rows[0].count,
          monthlyVisitors: monthlyVisRes.rows[0].count,
          pageViews: pageViewsRes.rows[0].count,
          bounceRate: analyticsRes.rows[0].bounce_rate,
          mostViewedArticles: typeof analyticsRes.rows[0].most_viewed_articles === 'string' ? JSON.parse(analyticsRes.rows[0].most_viewed_articles) : analyticsRes.rows[0].most_viewed_articles,
          mostViewedReviews: typeof analyticsRes.rows[0].most_viewed_reviews === 'string' ? JSON.parse(analyticsRes.rows[0].most_viewed_reviews) : analyticsRes.rows[0].most_viewed_reviews,
          topPerformingPages: typeof analyticsRes.rows[0].top_performing_pages === 'string' ? JSON.parse(analyticsRes.rows[0].top_performing_pages) : analyticsRes.rows[0].top_performing_pages,
          recentActivity: typeof analyticsRes.rows[0].recent_activity === 'string' ? JSON.parse(analyticsRes.rows[0].recent_activity) : analyticsRes.rows[0].recent_activity
        } : {}
      };
      return res.json(db);
    } catch (e) {
      console.error('PG GET /api/admin/db failed:', e.message);
    }
  }
  
  const db = readDb();
  const logs = db.visitorLogs || [];
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  const uniqueTotal = new Set(logs.map(l => l.visitor_id)).size;
  const uniqueDaily = new Set(logs.filter(l => now - new Date(l.created_at).getTime() < oneDay).map(l => l.visitor_id)).size;
  const uniqueWeekly = new Set(logs.filter(l => now - new Date(l.created_at).getTime() < oneDay * 7).map(l => l.visitor_id)).size;
  const uniqueMonthly = new Set(logs.filter(l => now - new Date(l.created_at).getTime() < oneDay * 30).map(l => l.visitor_id)).size;
  
  if (!db.analytics) db.analytics = {};
  db.analytics.totalVisitors = uniqueTotal.toString();
  db.analytics.dailyVisitors = uniqueDaily.toString();
  db.analytics.weeklyVisitors = uniqueWeekly.toString();
  db.analytics.monthlyVisitors = uniqueMonthly.toString();
  db.analytics.pageViews = logs.length.toString();
  
  res.json(db);
});

router.post('/db/reset', requireAdminPasscode, async (req, res) => {
  if (pool) {
    try {
      console.log('Resetting PG Database tables...');
      await pool.query('DROP TABLE IF EXISTS settings, popup_ad, schedules, north_america, box_office_top5, articles, reviews, box_office, galleries, taxonomy, landing_page, monetization_ads, comments, media_library, analytics, visitor_logs CASCADE');
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
      const result = await pool.query('SELECT active, title, description, image_desktop, image_mobile, image_url, button_text, redirect_url, schedule_start, schedule_end, close_timer, auto_close, display_rule, display_delay, carousel_items FROM popup_ad ORDER BY id DESC LIMIT 1');
      if (result.rows.length > 0) {
        const ad = result.rows[0];
        return res.json({
          active: ad.active,
          title: ad.title,
          description: ad.description,
          imageDesktop: ad.image_desktop,
          imageMobile: ad.image_mobile,
          imageUrl: ad.image_url,
          buttonText: ad.button_text,
          redirectUrl: ad.redirect_url,
          scheduleStart: ad.schedule_start,
          scheduleEnd: ad.schedule_end,
          closeTimer: ad.close_timer,
          autoClose: ad.auto_close,
          displayRule: ad.display_rule,
          displayDelay: ad.display_delay,
          carouselItems: typeof ad.carousel_items === 'string' ? JSON.parse(ad.carousel_items) : (ad.carousel_items || [])
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
        'INSERT INTO popup_ad (active, title, description, image_desktop, image_mobile, image_url, button_text, redirect_url, schedule_start, schedule_end, close_timer, auto_close, display_rule, display_delay, carousel_items) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)',
        [ad.active, ad.title, ad.description, ad.imageDesktop, ad.imageMobile, ad.imageUrl, ad.buttonText, ad.redirectUrl, ad.scheduleStart || null, ad.scheduleEnd || null, ad.closeTimer || 0, ad.autoClose || false, ad.displayRule || 'every_visit', ad.displayDelay || 0, JSON.stringify(ad.carouselItems || [])]
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
