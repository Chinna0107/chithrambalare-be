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
        settings: {
          adminPassword: bcrypt.hashSync('rajesh5678', 10)
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
          active: true,
          title: "ChitramBhalare Exclusive: Mega Blockbuster Peddi Success Meet Live Stream at 6:00 PM!",
          imageUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80",
          linkUrl: "/movie-news/peddi-crosses-320-cr-worldwide-in-2-weeks-telugu-dominates",
          buttonText: "Watch Success Meet"
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
        image_url TEXT,
        link_url TEXT,
        button_text TEXT
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
    `);
    await pool.query('ALTER TABLE settings ADD COLUMN IF NOT EXISTS admin_password TEXT');
    await pool.query('ALTER TABLE settings DROP COLUMN IF EXISTS scraper_mode');
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
      const ad = defaultData.popupAd;
      await pool.query(
        'INSERT INTO popup_ad (active, title, image_url, link_url, button_text) VALUES ($1, $2, $3, $4, $5)',
        [ad.active, ad.title, ad.imageUrl, ad.linkUrl, ad.buttonText]
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
