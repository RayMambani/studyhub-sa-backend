// routes/comments.js
// Mounted at /api/resources — adds GET/POST for a single resource's comments.
const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/resources/:id/comments
router.get('/:id/comments', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM comments WHERE resource_id = ? ORDER BY created_at ASC`
  ).all(req.params.id);
  res.json(rows);
});

// POST /api/resources/:id/comments   Body: { content }
// Uses the logged-in student's own name as the author.
router.post('/:id/comments', requireAuth, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'content is required' });
  }

  const user = db.prepare('SELECT full_name FROM users WHERE id = ?').get(req.userId);
  const id = uuid();
  db.prepare(
    `INSERT INTO comments (id, resource_id, author_name, content) VALUES (?, ?, ?, ?)`
  ).run(id, req.params.id, user ? user.full_name : 'Student', content.trim());

  res.status(201).json({ id });
});

module.exports = router;
