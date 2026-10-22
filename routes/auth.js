const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db/db');
const { updateLoginStreak } = require('../util/stats');
const { isStrongPassword, PASSWORD_REQUIREMENTS_MESSAGE } = require('../util/password');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function issueToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
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

router.post('/register', async (req, res) => {
  const { fullName, studentNumber, password } = req.body;
  const email = req.body.email ? req.body.email.trim().toLowerCase() : req.body.email;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: 'fullName, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: PASSWORD_REQUIREMENTS_MESSAGE });
  }
  if (await db.get('SELECT id FROM users WHERE LOWER(email) = ?', [email])) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }
  if (studentNumber && await db.get('SELECT id FROM users WHERE student_number = ?', [studentNumber])) {
    return res.status(409).json({ error: 'This student number is already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = uuid();
  await db.run(
    "INSERT INTO users (id, full_name, student_number, email, password_hash, auth_provider) VALUES (?, ?, ?, ?, ?, 'password')",
    [id, fullName, studentNumber || null, email, passwordHash]
  );

  await updateLoginStreak(id);
  const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
  res.status(201).json({ token: issueToken(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { password } = req.body;
  const email = req.body.email ? req.body.email.trim().toLowerCase() : req.body.email;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await db.get('SELECT * FROM users WHERE LOWER(email) = ?', [email]);
  if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  await updateLoginStreak(user.id);
  res.json({ token: issueToken(user), user: publicUser(user) });
});

router.post('/google', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken is required' });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: [
        (process.env.GOOGLE_CLIENT_ID || '').trim(),
        '639761337599-3a1ecmcp3ghnddr0be8j667v150bsvh7.apps.googleusercontent.com',
        '639761337599-71j4ejkpgvf3psv5i8a7gbfbkctvnbnd.apps.googleusercontent.com',
      ].filter(Boolean),
    });
    payload = ticket.getPayload();
  } catch (err) {
    console.error('Google token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid Google ID token: ' + err.message });
  }

  const email = payload.email.trim().toLowerCase();
  const fullName = payload.name || email.split('@')[0];

  let user = await db.get('SELECT * FROM users WHERE LOWER(email) = ?', [email]);
  if (!user) {
    const id = uuid();
    await db.run(
      "INSERT INTO users (id, full_name, email, auth_provider, profile_image) VALUES (?, ?, ?, 'google', ?)",
      [id, fullName, email, payload.picture || null]
    );
    user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
  }

  await updateLoginStreak(user.id);
  res.json({ token: issueToken(user), user: publicUser(user) });
});

module.exports = router;