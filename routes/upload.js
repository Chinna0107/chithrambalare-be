const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let trans = [];
    if (file.mimetype.startsWith('image/')) {
      trans.push({ quality: "auto", fetch_format: "auto" });
      if (req.query.watermark === 'true') {
        trans.push({ overlay: "watermark", gravity: "south_east", opacity: 50, width: 150 });
      }
    }
    return {
      folder: 'tolly-images',
      resource_type: 'auto',
      transformation: trans.length > 0 ? trans : undefined
    };
  },
});

const upload = multer({ storage: storage });

const { requireEmployeeOrAdmin } = require('../middlewares/auth.js');

router.post('/', requireEmployeeOrAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Upload Error:', err.message || err);
      return res.status(500).json({ error: err.message || 'Failed to upload image' });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image provided' });
      }
      res.status(200).json({
        message: 'Image uploaded successfully',
        url: req.file.path,
        public_id: req.file.filename,
      });
    } catch (error) {
      console.error('Upload Error:', error);
      res.status(500).json({ error: 'Failed to process upload' });
    }
  });
});

router.post('/multiple', requireEmployeeOrAdmin, (req, res) => {
  upload.array('images', 20)(req, res, (err) => {
    if (err) {
      console.error('Upload Multiple Error:', err.message || err);
      // It's likely a watermark missing error from Cloudinary or file size limit
      return res.status(500).json({ error: err.message || 'Failed to upload images' });
    }
    
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No images provided' });
      }
      const urls = req.files.map(file => ({
        url: file.path,
        public_id: file.filename
      }));
      res.status(200).json({
        message: 'Images uploaded successfully',
        files: urls,
      });
    } catch (error) {
      console.error('Upload Multiple Processing Error:', error);
      res.status(500).json({ error: 'Failed to process images' });
    }
  });
});

module.exports = router;
