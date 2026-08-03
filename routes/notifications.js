// routes/notifications.js
const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications — newest first
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`
  ).all(req.userId);
  res.json(rows);
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, (req, res) => {
  db.prepare(
    `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`
  ).run(req.params.id, req.userId);
  res.json({ read: true });
});

// DELETE /api/notifications/:id
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare(`DELETE FROM notifications WHERE id = ? AND user_id = ?`).run(req.params.id, req.userId);
  res.json({ deleted: true });
});

module.exports = router;
