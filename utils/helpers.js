const axios = require('axios');
const cheerio = require('cheerio');

const axiosConfig = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  timeout: 8000
};


// In-memory Cache
const cache = {};
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const getCachedData = (key) => {
  const cached = cache[key];
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION_MS)) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key, data) => {
  cache[key] = {
    data,
    timestamp: Date.now()
  };
};

const movieImageCache = {};
async function fetchTollywoodImageByKeyword(keyword) {
  const cacheKey = keyword.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
  if (movieImageCache[cacheKey]) return movieImageCache[cacheKey];

  const searchUrl = `https://tracktollywood.com/?s=${encodeURIComponent(keyword)}`;
  try {
    const resp = await axios.get(searchUrl, axiosConfig);
    const $ = cheerio.load(resp.data);
    let imgUrl = null;

    const selectors = ['[data-img-url]', 'img[data-lazy-src]', 'img[data-src]', 'img[src*="tracktollywood.com/wp-content"]'];
    for (const sel of selectors) {
      if (imgUrl) break;
      $(sel).each((_, el) => {
        if (imgUrl) return;
        const node = $(el);
        const src = node.attr('data-img-url') || node.attr('data-lazy-src') || node.attr('data-src') || node.attr('src') || '';
        if (src.includes('tracktollywood.com/wp-content') && !src.includes('logo') && !src.includes('avatar') && !src.includes('1x1') && !src.startsWith('data:')) {
          imgUrl = src.split('?')[0];
        }
      });
    }

    if (!imgUrl) {
      $('[style*="background-image"]').each((_, el) => {
        if (imgUrl) return;
        const style = $(el).attr('style') || '';
        const match = style.match(/url\s*\(\s*['"]?([^'"]+)['"]?\s*\)/i);
        if (match && match[1] && match[1].includes('tracktollywood.com')) imgUrl = match[1].split('?')[0];
      });
    }

    if (imgUrl) {
      movieImageCache[cacheKey] = imgUrl;
      return imgUrl;
    }
  } catch (e) {
    console.warn(`[movie-image] tracktollywood search failed for "${keyword}":`, e.message);
  }
  return null;
}

const cleanText = (text) => {
  if (!text) return '';
  return text.replace(/&#8217;/g, "'").replace(/&#8216;/g, "'").replace(/&#8211;/g, "–").replace(/&#8212;/g, "—")
    .replace(/&#8230;/g, "...").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
};

// Scraping functions removed as per admin-only data requirement.

module.exports = {
  axiosConfig,
  fetchTollywoodImageByKeyword,
  getCachedData,
  setCachedData,
  cleanText
};
