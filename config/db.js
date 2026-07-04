const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'server-db.json');
const MOCK_DATA_PATH = path.join(__dirname, '..', 'mockData.json');

const hasDbUrl = !!process.env.DATABASE_URL;
const pool = hasDbUrl ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
}) : null;

const readDb = () => {
  if (!fs.existsSync(DB_PATH)) {
    try {
      const defaultData = JSON.parse(fs.readFileSync(MOCK_DATA_PATH, 'utf8'));
      const initialDb = {
        ...defaultData,
        taxonomy: [],
        landingPage: { active: false, bannerUrl: "", heading: "", description: "", ctaText: "", ctaUrl: "" },
        monetizationAds: [],
        comments: [],
        mediaLibrary: [],
        visitorLogs: [],
        analytics: {
          totalVisitors: '1.2M',
          dailyVisitors: '45.2K',
          weeklyVisitors: '312K',
          monthlyVisitors: '1.45M',
          pageViews: '3.89M',
          bounceRate: '42.5%',
          mostViewedArticles: [
            { title: "Pushpa 2 Trailer Breakdown", views: "12.5K Views" },
            { title: "Peddi Worldwide Collections", views: "9.2K Views" },
            { title: "Upcoming Sankranthi Releases", views: "8.1K Views" }
          ],
          mostViewedReviews: [
            { title: "Kalki 2898 AD Review", views: "45K Views" },
            { title: "Devara Part 1 Review", views: "32K Views" },
            { title: "Peddi Movie Review", views: "28K Views" }
          ],
          topPerformingPages: [
            { url: "/home", hits: "145K Hits" },
            { url: "/box-office", hits: "89K Hits" },
            { url: "/reviews", hits: "76K Hits" }
          ],
          recentActivity: [
            { user: "Admin", action: "updated Global Settings", time: "10 mins ago", color: "bg-green-500" },
            { user: "Editor", action: "published a new Article", time: "2 hours ago", color: "bg-blue-500" },
            { user: "System", action: "cleared cache", time: "5 hours ago", color: "bg-yellow-500" }
          ]
        },
        settings: {
          adminPassword: bcrypt.hashSync('rajesh5678', 10),
          siteName: "Tolly",
          logoUrl: "",
          maintenanceMode: false,
          socialLinks: {}
        },
        upcomingSchedules: [
          { id: 1, movieName: "Nagabandham", releaseDate: "2026-06-27", language: "Telugu", status: "Confirmed" },
          { id: 2, movieName: "Raghuvaran B.Tech", releaseDate: "2026-07-04", language: "Re-Release", status: "Confirmed" },
          { id: 3, movieName: "Vishwambhara", releaseDate: "2026-10-15", language: "Telugu", status: "TBA" },
          { id: 4, movieName: "Aadarsha Kutumbam", releaseDate: "2027-04-10", language: "Telugu", status: "TBA" }
        ],
        northAmericaCollections: [
          {
            id: 1,
            movieName: "Peddi",
            hourlyGross: "$185K",
            totalGross: "$3.45M",
            premierGross: "$1.12M",
            screens: "480",
            status: "Active",
            lastUpdated: "10 Mins ago",
            poster: "https://picsum.photos/seed/peddinash/150/220"
          },
          {
            id: 2,
            movieName: "Drishyam 3",
            hourlyGross: "$42K",
            totalGross: "$1.20M",
            premierGross: "$350K",
            screens: "120",
            status: "Slowing",
            lastUpdated: "1 Hour ago",
            poster: "https://picsum.photos/seed/drishyam3nash/150/220"
          },
          {
            id: 3,
            movieName: "Obsession",
            hourlyGross: "$12K",
            totalGross: "$890K",
            premierGross: "$220K",
            screens: "90",
            status: "Rentals",
            lastUpdated: "3 Hours ago",
            poster: "https://picsum.photos/seed/obsessnash/150/220"
          }
        ],
        popupAd: {
          active: false,
          title: "",
          imageDesktop: "",
          imageMobile: "",
          redirectUrl: "",
          scheduleStart: null,
          scheduleEnd: null,
          closeTimer: 0,
          autoClose: false,
          displayRule: "every_visit",
          displayDelay: 0
        },
        boxOfficeTop5: [
          { rank: 1, movieName: "Peddi", gross: "₹320 Cr", verdict: "Blockbuster", trend: "▲ Strong" },
          { rank: 2, movieName: "Drishyam 3", gross: "₹236 Cr", verdict: "Hit", trend: "▼ Slowing" },
          { rank: 3, movieName: "Obsession", gross: "₹84.9 Cr", verdict: "Hit", trend: "▼ Declining" },
          { rank: 4, movieName: "Hai Jawani Toh Ishq", gross: "₹55.2 Cr", verdict: "Average", trend: "▼ Low" },
          { rank: 5, movieName: "Maa Inti Bangaaram", gross: "TBA", verdict: "New", trend: "▲ Awaited" }
        ]
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2), 'utf8');
      return initialDb;
    } catch (err) {
      console.error('Failed to initialize DB file:', err.message);
      return {};
    }
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  if (db && db.settings && !db.settings.adminPassword) {
    db.settings.adminPassword = bcrypt.hashSync('rajesh5678', 10);
    writeDb(db);
  }
  return db;
};

const writeDb = (data) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
};

const initDb = async () => {
  if (!pool) {
    console.warn('PostgreSQL Pool is not initialized. Skipping schema setup.');
    return;
  }
  try {
    console.log('Running PostgreSQL Database migrations...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        admin_password TEXT
      );
      CREATE TABLE IF NOT EXISTS popup_ad (
        id SERIAL PRIMARY KEY,
        active BOOLEAN,
        title TEXT,
        image_desktop TEXT,
        image_mobile TEXT,
        redirect_url TEXT,
        schedule_start TIMESTAMP,
        schedule_end TIMESTAMP,
        close_timer INT,
        auto_close BOOLEAN,
        display_rule TEXT,
        display_delay INT
      );
      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        movie_name TEXT,
        release_date TEXT,
        language TEXT,
        status TEXT
      );
      CREATE TABLE IF NOT EXISTS north_america (
        id SERIAL PRIMARY KEY,
        movie_name TEXT,
        hourly_gross TEXT,
        total_gross TEXT,
        premier_gross TEXT,
        screens TEXT,
        status TEXT,
        last_updated TEXT,
        poster TEXT
      );
      CREATE TABLE IF NOT EXISTS box_office_top5 (
        id SERIAL PRIMARY KEY,
        rank INTEGER,
        movie_name TEXT,
        gross TEXT,
        verdict TEXT,
        trend TEXT
      );
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE,
        title TEXT,
        excerpt TEXT,
        content JSONB,
        thumbnail TEXT,
        featured_image TEXT,
        date TEXT,
        category TEXT,
        author TEXT,
        tags JSONB
      );
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE,
        movie_name TEXT,
        poster TEXT,
        rating TEXT,
        snippet TEXT,
        verdict TEXT,
        story TEXT,
        performances TEXT,
        technical_aspects TEXT,
        verdict_text TEXT,
        ott_platform TEXT,
        ott_release_date TEXT,
        date TEXT
      );
      CREATE TABLE IF NOT EXISTS box_office (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE,
        movie_name TEXT,
        director TEXT,
        movie_cast TEXT,
        poster TEXT,
        day_collection TEXT,
        worldwide_gross TEXT,
        india_net TEXT,
        india_gross TEXT,
        overseas TEXT,
        verdict TEXT,
        trend TEXT,
        days TEXT,
        languages TEXT,
        percentage INTEGER,
        date TEXT,
        daily_breakdown JSONB,
        budget TEXT,
        total_india_net TEXT,
        us_premieres TEXT
      );
      CREATE TABLE IF NOT EXISTS galleries (
        id SERIAL PRIMARY KEY,
        title TEXT,
        cover_image TEXT,
        images JSONB,
        date TEXT
      );
      CREATE TABLE IF NOT EXISTS taxonomy (
        id SERIAL PRIMARY KEY,
        type TEXT,
        name TEXT,
        slug TEXT UNIQUE,
        description TEXT
      );
      CREATE TABLE IF NOT EXISTS landing_page (
        id SERIAL PRIMARY KEY,
        active BOOLEAN,
        banner_url TEXT,
        heading TEXT,
        description TEXT,
        cta_text TEXT,
        cta_url TEXT
      );
      CREATE TABLE IF NOT EXISTS monetization_ads (
        id SERIAL PRIMARY KEY,
        placement TEXT,
        active BOOLEAN,
        script_code TEXT,
        image_url TEXT,
        link_url TEXT
      );
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        entity_type TEXT,
        entity_id TEXT,
        user_name TEXT,
        comment_text TEXT,
        status TEXT,
        date TEXT
      );
      CREATE TABLE IF NOT EXISTS media_library (
        id SERIAL PRIMARY KEY,
        file_name TEXT,
        file_url TEXT,
        file_type TEXT,
        size TEXT,
        date TEXT
      );
      CREATE TABLE IF NOT EXISTS analytics (
        id SERIAL PRIMARY KEY,
        total_visitors TEXT,
        daily_visitors TEXT,
        weekly_visitors TEXT,
        monthly_visitors TEXT,
        page_views TEXT,
        bounce_rate TEXT,
        most_viewed_articles JSONB,
        most_viewed_reviews JSONB,
        top_performing_pages JSONB,
        recent_activity JSONB
      );
      CREATE TABLE IF NOT EXISTS visitor_logs (
        id SERIAL PRIMARY KEY,
        visitor_id TEXT,
        path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query('ALTER TABLE settings ADD COLUMN IF NOT EXISTS admin_password TEXT');
    await pool.query('ALTER TABLE settings ADD COLUMN IF NOT EXISTS site_name TEXT');
    await pool.query('ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_url TEXT');
    await pool.query('ALTER TABLE settings ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN');
    await pool.query('ALTER TABLE settings ADD COLUMN IF NOT EXISTS social_links JSONB');
    await pool.query('ALTER TABLE settings DROP COLUMN IF EXISTS scraper_mode');

    // New tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password_hash TEXT,
        role TEXT DEFAULT 'author',
        display_name TEXT,
        avatar TEXT,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      );
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        action TEXT,
        entity_type TEXT,
        entity_id TEXT,
        details JSONB,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS seo_settings (
        id SERIAL PRIMARY KEY,
        sitemap_enabled BOOLEAN DEFAULT true,
        robots_txt TEXT,
        google_analytics_id TEXT,
        search_console_id TEXT,
        default_og_image TEXT,
        schema_type TEXT DEFAULT 'NewsArticle'
      );
    `);

    // Add new columns to existing tables for SEO and other features
    const alterQueries = [
      // articles
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published'",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS seo_title TEXT",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS meta_description TEXT",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS focus_keyword TEXT",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS meta_keywords TEXT",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS canonical_url TEXT",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS og_title TEXT",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS og_description TEXT",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS og_image TEXT",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS twitter_card TEXT",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS schema_markup JSONB",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS breadcrumb TEXT",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS robots TEXT DEFAULT 'index,follow'",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS revision_history JSONB DEFAULT '[]'",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS auto_saved_at TIMESTAMP",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false",
      "ALTER TABLE articles ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0",
      // reviews
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS genre TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS language TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS runtime TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS release_date TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS director TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS producer TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS production_house TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS cast_crew JSONB",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS pros JSONB",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS cons JSONB",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS music_review TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS final_verdict TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS trailer TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS screenshot_gallery JSONB",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published'",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS seo_title TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS meta_description TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS meta_keywords TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS canonical_url TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS og_title TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS og_description TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS og_image TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS twitter_card TEXT",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS schema_markup JSONB",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS robots TEXT DEFAULT 'index,follow'",
      "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0",
      // north_america
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS release_date TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS language TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS distributor TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS genre TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS budget TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS opening_day_preview TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS advance_bookings TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS premiere_collections TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS weekend_collections TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS weekly_collections TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS daily_breakdown JSONB DEFAULT '[]'",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS notes TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS seo_title TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS meta_description TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS meta_keywords TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS canonical_url TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS slug TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS og_title TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS og_description TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS og_image TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS twitter_card TEXT",
      "ALTER TABLE north_america ADD COLUMN IF NOT EXISTS robots TEXT DEFAULT 'index,follow'",
      // schedules
      "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS banner TEXT",
      "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS remaining_days TEXT",
      "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS director TEXT",
      "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS cast_list TEXT",
      "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS genre TEXT",
      "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS release_status TEXT DEFAULT 'upcoming'",
      "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS trailer_link TEXT",
      "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS notes TEXT",
      "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS seo_title TEXT",
      "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS meta_description TEXT",
      "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS meta_keywords TEXT",
      "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS slug TEXT",
      "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS canonical_url TEXT",
      "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS og_title TEXT",
      "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS og_description TEXT",
      "ALTER TABLE schedules ADD COLUMN IF NOT EXISTS og_image TEXT",
      // box_office_top5
      "ALTER TABLE box_office_top5 ADD COLUMN IF NOT EXISTS opening_collection TEXT",
      "ALTER TABLE box_office_top5 ADD COLUMN IF NOT EXISTS weekend_collection TEXT",
      "ALTER TABLE box_office_top5 ADD COLUMN IF NOT EXISTS total_collection TEXT",
      "ALTER TABLE box_office_top5 ADD COLUMN IF NOT EXISTS territory TEXT",
      "ALTER TABLE box_office_top5 ADD COLUMN IF NOT EXISTS last_updated TEXT",
      "ALTER TABLE box_office_top5 ADD COLUMN IF NOT EXISTS seo_title TEXT",
      "ALTER TABLE box_office_top5 ADD COLUMN IF NOT EXISTS meta_description TEXT",
      "ALTER TABLE box_office_top5 ADD COLUMN IF NOT EXISTS meta_keywords TEXT",
      "ALTER TABLE box_office_top5 ADD COLUMN IF NOT EXISTS canonical_url TEXT",
      "ALTER TABLE box_office_top5 ADD COLUMN IF NOT EXISTS slug TEXT",
      // galleries
      "ALTER TABLE galleries ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'stills'",
      "ALTER TABLE galleries ADD COLUMN IF NOT EXISTS alt_text TEXT",
      "ALTER TABLE galleries ADD COLUMN IF NOT EXISTS caption TEXT",
      "ALTER TABLE galleries ADD COLUMN IF NOT EXISTS photographer_credit TEXT",
      "ALTER TABLE galleries ADD COLUMN IF NOT EXISTS featured_image TEXT",
      "ALTER TABLE galleries ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0",
      "ALTER TABLE galleries ADD COLUMN IF NOT EXISTS seo_title TEXT",
      "ALTER TABLE galleries ADD COLUMN IF NOT EXISTS meta_description TEXT",
      "ALTER TABLE galleries ADD COLUMN IF NOT EXISTS slug TEXT",
      "ALTER TABLE galleries ADD COLUMN IF NOT EXISTS canonical_url TEXT",
      "ALTER TABLE galleries ADD COLUMN IF NOT EXISTS og_image TEXT",
      // box_office
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS release_date TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS genre TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS distributor TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS opening_day_preview TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS advance_bookings TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS premiere_collections TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS weekend_collections TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS weekly_collections TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS total_gross TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS bo_status TEXT DEFAULT 'running'",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS notes TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS seo_title TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS meta_description TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS meta_keywords TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS canonical_url TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS og_title TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS og_description TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS og_image TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS twitter_card TEXT",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS robots TEXT DEFAULT 'index,follow'",
      "ALTER TABLE box_office ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0",
      // landing_page
      "ALTER TABLE landing_page ADD COLUMN IF NOT EXISTS background_image TEXT",
      "ALTER TABLE landing_page ADD COLUMN IF NOT EXISTS video_background TEXT",
      "ALTER TABLE landing_page ADD COLUMN IF NOT EXISTS countdown_target TIMESTAMP",
      "ALTER TABLE landing_page ADD COLUMN IF NOT EXISTS seo_title TEXT",
      "ALTER TABLE landing_page ADD COLUMN IF NOT EXISTS meta_description TEXT",
      // popup_ad
      "ALTER TABLE popup_ad ADD COLUMN IF NOT EXISTS button_text TEXT",
      "ALTER TABLE popup_ad ADD COLUMN IF NOT EXISTS image_url TEXT",
      "ALTER TABLE popup_ad ADD COLUMN IF NOT EXISTS image_desktop TEXT",
      "ALTER TABLE popup_ad ADD COLUMN IF NOT EXISTS image_mobile TEXT",
      "ALTER TABLE popup_ad ADD COLUMN IF NOT EXISTS active BOOLEAN",
      "ALTER TABLE popup_ad ADD COLUMN IF NOT EXISTS title TEXT",
      "ALTER TABLE popup_ad ADD COLUMN IF NOT EXISTS redirect_url TEXT",
      "ALTER TABLE popup_ad ADD COLUMN IF NOT EXISTS schedule_start TIMESTAMP",
      "ALTER TABLE popup_ad ADD COLUMN IF NOT EXISTS schedule_end TIMESTAMP",
      "ALTER TABLE popup_ad ADD COLUMN IF NOT EXISTS close_timer INT",
      "ALTER TABLE popup_ad ADD COLUMN IF NOT EXISTS auto_close BOOLEAN",
      "ALTER TABLE popup_ad ADD COLUMN IF NOT EXISTS display_rule TEXT",
      "ALTER TABLE popup_ad ADD COLUMN IF NOT EXISTS display_delay INT"
    ];
    for (const q of alterQueries) {
      await pool.query(q);
    }
    console.log('PostgreSQL tables verified.');

    // Seeding Logic
    let defaultData = {};
    if (fs.existsSync(DB_PATH)) {
      try {
        defaultData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      } catch (e) {
        console.error('Error loading default data from server-db.json:', e.message);
      }
    }
    if ((!defaultData.articles || defaultData.articles.length === 0) && fs.existsSync(MOCK_DATA_PATH)) {
      try {
        defaultData = JSON.parse(fs.readFileSync(MOCK_DATA_PATH, 'utf8'));
      } catch (e) {
        console.error('Error loading default data from mockData.json:', e.message);
      }
    }

    // 1. Seed settings
    const settingsCheck = await pool.query('SELECT COUNT(*) FROM settings');
    if (parseInt(settingsCheck.rows[0].count) === 0) {
      const hash = bcrypt.hashSync('rajesh5678', 10);
      await pool.query('INSERT INTO settings (admin_password) VALUES ($1)', [hash]);
    } else {
      const checkPass = await pool.query('SELECT admin_password FROM settings ORDER BY id DESC LIMIT 1');
      if (checkPass.rows.length > 0 && !checkPass.rows[0].admin_password) {
        const hash = bcrypt.hashSync('rajesh5678', 10);
        await pool.query('UPDATE settings SET admin_password = $1', [hash]);
      }
    }

    // 2. Seed popup_ad
    const popupCheck = await pool.query('SELECT COUNT(*) FROM popup_ad');
    if (parseInt(popupCheck.rows[0].count) === 0 && defaultData.popupAd) {
      const p = defaultData.popupAd;
      await pool.query(
        'INSERT INTO popup_ad (active, title, image_desktop, image_mobile, redirect_url, close_timer, auto_close, display_rule, display_delay) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [p.active, p.title, p.imageDesktop, p.imageMobile, p.redirectUrl, p.closeTimer, p.autoClose, p.displayRule, p.displayDelay]
      );
    }

    // 3. Seed schedules
    const schedCheck = await pool.query('SELECT COUNT(*) FROM schedules');
    if (parseInt(schedCheck.rows[0].count) === 0 && defaultData.upcomingSchedules) {
      for (const s of defaultData.upcomingSchedules) {
        await pool.query(
          'INSERT INTO schedules (movie_name, release_date, language, status) VALUES ($1, $2, $3, $4)',
          [s.movieName, s.releaseDate, s.language, s.status]
        );
      }
    }

    // 4. Seed north_america
    const naCheck = await pool.query('SELECT COUNT(*) FROM north_america');
    if (parseInt(naCheck.rows[0].count) === 0 && defaultData.northAmericaCollections) {
      for (const n of defaultData.northAmericaCollections) {
        await pool.query(
          'INSERT INTO north_america (movie_name, hourly_gross, total_gross, premier_gross, screens, status, last_updated, poster) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [n.movieName, n.hourlyGross, n.totalGross, n.premierGross, n.screens, n.status, n.lastUpdated, n.poster]
        );
      }
    }

    // 5. Seed box_office_top5
    const bo5Check = await pool.query('SELECT COUNT(*) FROM box_office_top5');
    if (parseInt(bo5Check.rows[0].count) === 0 && defaultData.boxOfficeTop5) {
      for (const b of defaultData.boxOfficeTop5) {
        await pool.query(
          'INSERT INTO box_office_top5 (rank, movie_name, gross, verdict, trend) VALUES ($1, $2, $3, $4, $5)',
          [b.rank, b.movieName, b.gross, b.verdict, b.trend]
        );
      }
    }

    // 6. Seed articles
    const artCheck = await pool.query('SELECT COUNT(*) FROM articles');
    if (parseInt(artCheck.rows[0].count) === 0 && defaultData.articles) {
      for (const a of defaultData.articles) {
        await pool.query(
          'INSERT INTO articles (id, slug, title, excerpt, content, thumbnail, featured_image, date, category, author, tags) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT DO NOTHING',
          [
            String(a.id || a.slug),
            a.slug,
            a.title,
            a.excerpt,
            JSON.stringify(a.content),
            a.thumbnail,
            a.featuredImage,
            a.date,
            a.category,
            a.author,
            JSON.stringify(a.tags)
          ]
        );
      }
    }

    // 7. Seed reviews
    const revCheck = await pool.query('SELECT COUNT(*) FROM reviews');
    if (parseInt(revCheck.rows[0].count) === 0 && defaultData.reviews) {
      for (const r of defaultData.reviews) {
        await pool.query(
          'INSERT INTO reviews (id, slug, movie_name, poster, rating, snippet, verdict, story, performances, technical_aspects, verdict_text, ott_platform, ott_release_date, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT DO NOTHING',
          [
            String(r.id || r.slug),
            r.slug,
            r.movieName,
            r.poster,
            r.rating,
            r.snippet,
            r.verdict,
            r.story,
            r.performances,
            r.technicalAspects,
            r.verdictText,
            r.ottPlatform,
            r.ottReleaseDate,
            r.date
          ]
        );
      }
    }

    // 8. Seed box_office
    const boCheck = await pool.query('SELECT COUNT(*) FROM box_office');
    if (parseInt(boCheck.rows[0].count) === 0 && defaultData.boxOffice) {
      for (const b of defaultData.boxOffice) {
        await pool.query(
          'INSERT INTO box_office (id, slug, movie_name, director, movie_cast, poster, day_collection, worldwide_gross, india_net, india_gross, overseas, verdict, trend, days, languages, percentage, date, daily_breakdown, budget, total_india_net, us_premieres) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) ON CONFLICT DO NOTHING',
          [
            String(b.id || b.slug),
            b.slug,
            b.movieName,
            b.director,
            b.cast,
            b.poster,
            b.dayCollection,
            b.worldwideGross,
            b.indiaNet,
            b.indiaGross,
            b.overseas,
            b.verdict,
            b.trend,
            b.days,
            b.languages,
            b.percentage,
            b.date,
            JSON.stringify(b.dailyBreakdown),
            b.budget,
            b.totalIndiaNet,
            b.usPremieres
          ]
        );
      }
    }

    // 9. Seed galleries
    const galCheck = await pool.query('SELECT COUNT(*) FROM galleries');
    if (parseInt(galCheck.rows[0].count) === 0 && defaultData.galleries) {
      for (const g of defaultData.galleries) {
        await pool.query(
          'INSERT INTO galleries (title, cover_image, images, date) VALUES ($1, $2, $3, $4)',
          [g.title, g.coverImage || g.image, JSON.stringify(g.images || []), g.date || new Date().toISOString()]
        );
      }
    }
    // 10. Seed analytics
    const analyticsCheck = await pool.query('SELECT COUNT(*) FROM analytics');
    if (parseInt(analyticsCheck.rows[0].count) === 0 && defaultData.analytics) {
      const a = defaultData.analytics;
      await pool.query(
        'INSERT INTO analytics (total_visitors, daily_visitors, weekly_visitors, monthly_visitors, page_views, bounce_rate, most_viewed_articles, most_viewed_reviews, top_performing_pages, recent_activity) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [
          a.totalVisitors, a.dailyVisitors, a.weeklyVisitors, a.monthlyVisitors, a.pageViews, a.bounceRate,
          JSON.stringify(a.mostViewedArticles), JSON.stringify(a.mostViewedReviews), JSON.stringify(a.topPerformingPages), JSON.stringify(a.recentActivity)
        ]
      );
    }

    console.log('PostgreSQL database initialization & seeding successful.');
  } catch (err) {
    console.error('Failed to initialize database tables:', err.message);
  }
};

if (pool) {
  initDb();
} else {
  console.warn('DATABASE_URL environment variable is missing. SQL queries will fall back to local file JSON database.');
}

module.exports = {
  pool,
  readDb,
  writeDb,
  initDb
};
