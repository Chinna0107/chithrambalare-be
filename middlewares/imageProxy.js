const imageProxyMiddleware = (req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    const deepReplace = (obj) => {
      if (!obj) return obj;
      if (typeof obj === 'string') {
        if (obj.includes('picsum.photos')) {
          // Extract seed keyword and route through /api/imdb-image (tracktollywood-backed)
          const seed = obj.split('/seed/')[1]?.split('/')[0] || 'tollywood';
          const isFeatured = obj.includes('1200/600') || obj.includes('_feat');
          return `/api/imdb-image?q=${encodeURIComponent(seed)}&featured=${isFeatured ? '1' : '0'}`;
        }
        if (/^https?:\/\/tracktollywood\.com/i.test(obj)) {
          const b64 = Buffer.from(encodeURIComponent(obj)).toString('base64');
          return `/api/image-proxy?url=${encodeURIComponent(b64)}`;
        }
        return obj;
      }
      if (Array.isArray(obj)) {
        return obj.map(deepReplace);
      }
      if (typeof obj === 'object') {
        const newObj = {};
        for (const key in obj) {
          newObj[key] = deepReplace(obj[key]);
        }
        return newObj;
      }
      return obj;
    };

    const replacedBody = deepReplace(body);
    return originalJson.call(this, replacedBody);
  };
  next();
};

module.exports = {
  imageProxyMiddleware
};
