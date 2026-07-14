const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, readDb, writeDb } = require('../config/db.js');
const { requireAdminPasscode } = require('../middlewares/auth.js');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_tolly_key';

// Admin: Get all employees
router.get('/', requireAdminPasscode, async (req, res) => {
  if (pool) {
    try {
      const result = await pool.query("SELECT id, username, email, display_name, role, is_active FROM users WHERE role='employee'");
      return res.json(result.rows);
    } catch (e) {
      console.error('PG get employees failed:', e.message);
      return res.status(500).json({ error: 'Failed to fetch employees' });
    }
  }
  const db = readDb();
  const employees = (db.users || []).filter(u => u.role === 'employee').map(u => {
    const { password_hash, ...rest } = u;
    return rest;
  });
  res.json(employees);
});

// Admin: Create employee
router.post('/', requireAdminPasscode, async (req, res) => {
  const { username, password, email, displayName } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const hash = bcrypt.hashSync(password, 10);

  if (pool) {
    try {
      const result = await pool.query(
        "INSERT INTO users (username, password_hash, email, display_name, role) VALUES ($1, $2, $3, $4, 'employee') RETURNING id, username, email, display_name, role, is_active",
        [username, hash, email, displayName]
      );
      return res.json({ success: true, employee: result.rows[0] });
    } catch (e) {
      console.error('PG create employee failed:', e.message);
      return res.status(500).json({ error: 'Failed to create employee (username/email might already exist)' });
    }
  }

  const db = readDb();
  if (!db.users) db.users = [];
  
  if (db.users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const newEmp = {
    id: Date.now(),
    username,
    password_hash: hash,
    email,
    display_name: displayName,
    role: 'employee',
    is_active: true
  };
  db.users.push(newEmp);
  writeDb(db);
  
  const { password_hash, ...rest } = newEmp;
  res.json({ success: true, employee: rest });
});

// Admin: Delete employee
router.delete('/:id', requireAdminPasscode, async (req, res) => {
  const { id } = req.params;
  if (pool) {
    try {
      await pool.query("DELETE FROM users WHERE id=$1 AND role='employee'", [id]);
      return res.json({ success: true });
    } catch (e) {
      console.error('PG delete employee failed:', e.message);
      return res.status(500).json({ error: 'Failed to delete' });
    }
  }
  const db = readDb();
  db.users = (db.users || []).filter(u => !(String(u.id) === String(id) && u.role === 'employee'));
  writeDb(db);
  res.json({ success: true });
});

// Employee Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  let user = null;

  if (pool) {
    try {
      const result = await pool.query("SELECT * FROM users WHERE username=$1 AND role='employee' AND is_active=true", [username]);
      if (result.rows.length > 0) user = result.rows[0];
    } catch (e) {
      console.error('PG employee login failed:', e.message);
      return res.status(500).json({ error: 'Database error' });
    }
  } else {
    const db = readDb();
    user = (db.users || []).find(u => u.username === username && u.role === 'employee' && u.is_active);
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  
  res.json({ success: true, token, employee: { id: user.id, username: user.username, displayName: user.display_name } });
});

module.exports = router;
