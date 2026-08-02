// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db/db');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function issueToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function publicUser(u) {
  return {
    id: u.id,
    fullName: u.full_name,
    studentNumber: u.student_number,
    email: u.email,
    authProvider: u.auth_provider,
    profileImage: u.profile_image,
    language: u.language,
  };
}

// POST /api/auth/register
// Body: { fullName, studentNumber, email, password }
router.post('/register', async (req, res) => {
  const { fullName, studentNumber, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'fullName, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  // Passwords are salted + hashed with bcrypt (never stored or transmitted in plain text).
  const passwordHash = await bcrypt.hash(password, 12);
  const id = uuid();

  db.prepare(
    `INSERT INTO users (id, full_name, student_number, email, password_hash, auth_provider)
     VALUES (?, ?, ?, ?, ?, 'password')`
  ).run(id, fullName, studentNumber || null, email, passwordHash);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const token = issueToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

// POST /api/auth/login
// Body: { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = issueToken(user);
  res.json({ token, user: publicUser(user) });
});

// POST /api/auth/google
// Body: { idToken }  -- ID token obtained on-device from Google Sign-In SDK
router.post('/google', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken is required' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const fullName = payload.name || email.split('@')[0];
    const picture = payload.picture;

    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      const id = uuid();
      db.prepare(
        `INSERT INTO users (id, full_name, email, auth_provider, profile_image)
         VALUES (?, ?, ?, 'google', ?)`
      ).run(id, fullName, email, picture || null);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    }

    const token = issueToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('Google token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid Google ID token' });
  }
});

module.exports = router;
