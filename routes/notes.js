const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  res.json(await db.all('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC', [req.userId]));
});

// Batch upsert used by the app's offline sync. The WHERE clause stops one user
// overwriting another user's note that happens to share an id.
router.post('/sync', requireAuth, async (req, res) => {
  const { notes } = req.body;
  if (!Array.isArray(notes)) {
    return res.status(400).json({ error: 'notes must be an array' });
  }

  const sql = `INSERT INTO notes (id, user_id, title, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title, content = excluded.content, updated_at = excluded.updated_at
    WHERE notes.user_id = excluded.user_id`;

  await db.batch(notes.map(n => [sql, [n.id, req.userId, n.title, n.content || '', n.createdAt, n.updatedAt]]));
  res.json({ syncedIds: notes.map(n => n.id) });
});

module.exports = router;