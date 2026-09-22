// routes/debug.js
// TEMPORARY — for demonstrating stored database content in the demo video.
// Delete this file and its line in server.js right after recording.
const express = require('express');
const db = require('../db/db');
const router = express.Router();

router.get('/database', (req, res) => {
  if (req.query.key !== 'studyhub2026demo') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const users = db.prepare('SELECT id, full_name, email, password_hash, language, privacy, login_streak FROM users').all();
  const resources = db.prepare('SELECT id, title, module, file_url FROM resources').all();
  const groups = db.prepare('SELECT id, name, module, seed_members FROM study_groups').all();

  res.json({ users, resources, groups });
});

module.exports = router;