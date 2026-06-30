const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { imageProxyMiddleware } = require('./middlewares/imageProxy.js');
const apiRoutes = require('./routes/index.js');
const { pool, initDb } = require('./config/db.js');

const app = express();
const PORT = process.env.PORT || 5001;

// Global Middlewares
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); 
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-passcode'); 
  if (req.method === 'OPTIONS') return res.sendStatus(204); 
  next();
});
app.use(express.json());

// Global JSON modifier middleware
app.use(imageProxyMiddleware);

// API Routes
app.use('/api', apiRoutes);

// Static assets for production (optional based on your setup)
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// Catch-all route
app.get('*all', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

// Database Initialization and Server Start
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Tolly Backend Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
