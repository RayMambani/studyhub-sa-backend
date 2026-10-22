const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  res.json(await db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [req.userId]));
});

router.patch('/:id/read', requireAuth, async (req, res) => {
  await db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json({ read: true });
});

router.delete('/:id', requireAuth, async (req, res) => {
  await db.run('DELETE FROM notifications WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json({ deleted: true });
});

module.exports = router;