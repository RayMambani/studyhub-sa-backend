// routes/users.js
const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    id: user.id,
    fullName: user.full_name,
    studentNumber: user.student_number,
    email: user.email,
    profileImage: user.profile_image,
    language: user.language,
  });
});

// PATCH /api/users/settings
// Body: { language?: 'en'|'zu'|'ve', fcmToken?: string }
// Backs the Settings screen (language) and push notification registration.
router.patch('/settings', requireAuth, (req, res) => {
  const { language, fcmToken } = req.body;

  if (language && !['en', 'zu', 've'].includes(language)) {
    return res.status(400).json({ error: 'language must be one of: en, zu, ve' });
  }

  if (language) {
    db.prepare('UPDATE users SET language = ? WHERE id = ?').run(language, req.userId);
  }
  if (fcmToken) {
    db.prepare('UPDATE users SET fcm_token = ? WHERE id = ?').run(fcmToken, req.userId);
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json({ language: user.language });
});

module.exports = router;
