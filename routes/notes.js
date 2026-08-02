// routes/notes.js
// Supports the Offline Notes feature: the Android app stores notes locally in
// Room/SQLite while offline, then calls /sync in a batch once connectivity
// returns (see android SyncWorker.kt).
const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/notes — all notes for the logged-in user (used to pull down on a new device)
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY updated_at DESC').all(req.userId);
  res.json(rows);
});

// POST /api/notes/sync
// Body: { notes: [{ id, title, content, createdAt, updatedAt }, ...] }
// Upserts every locally-queued note in one round trip and reports back which
// ids were accepted, so the client can flip isSynced = true only on success.
router.post('/sync', requireAuth, (req, res) => {
  const { notes } = req.body;
  if (!Array.isArray(notes)) {
    return res.status(400).json({ error: 'notes must be an array' });
  }

  const upsert = db.prepare(`
    INSERT INTO notes (id, user_id, title, content, created_at, updated_at)
    VALUES (@id, @userId, @title, @content, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      updated_at = excluded.updated_at
  `);

  const syncedIds = [];
  const tx = db.transaction((items) => {
    for (const n of items) {
      upsert.run({
        id: n.id,
        userId: req.userId,
        title: n.title,
        content: n.content || '',
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      });
      syncedIds.push(n.id);
    }
  });
  tx(notes);

  res.json({ syncedIds });
});

module.exports = router;
