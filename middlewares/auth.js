const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, readDb } = require('../config/db.js');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_tolly_key';

const requireAdminPasscode = async (req, res, next) => {
  const code = req.headers['x-admin-passcode'];
  if (!code) {
    return res.status(401).json({ error: 'Unauthorized: Missing admin passcode' });
  }

  let hash = null;
  if (pool) {
    try {
      const result = await pool.query('SELECT admin_password FROM settings ORDER BY id DESC LIMIT 1');
      if (result.rows.length > 0) {
        hash = result.rows[0].admin_password;
      }
    } catch (e) {
      console.error('Failed to read admin password from PG:', e.message);
    }
  }

  if (!hash) {
    try {
      const db = readDb();
      hash = db.settings?.adminPassword;
    } catch (e) {
      console.error('Failed to read admin password from JSON:', e.message);
    }
  }

  if (!hash) {
    const fallbackPass = process.env.ADMIN_PASSCODE || 'rajesh5678';
    hash = bcrypt.hashSync(fallbackPass, 10);
  }

  try {
    const match = await bcrypt.compare(code, hash);
    if (match) {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized: Invalid admin passcode' });
    }
  } catch (err) {
    console.error('Bcrypt verification failed:', err.message);
    res.status(500).json({ error: 'Internal validation error' });
  }
};

const requireEmployeeOrAdmin = async (req, res, next) => {
  // First check if it's admin
  const code = req.headers['x-admin-passcode'];
  if (code) {
    // We can just call requireAdminPasscode's logic, but since it's middleware we just do it inline
    return requireAdminPasscode(req, res, next);
  }

  // Then check employee token
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized: No credentials provided' });
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Malformed token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

module.exports = {
  requireAdminPasscode,
  requireEmployeeOrAdmin
};
