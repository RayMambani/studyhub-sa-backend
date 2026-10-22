const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/:id/comments', requireAuth, async (req, res) => {
  res.json(await db.all('SELECT * FROM comments WHERE resource_id = ? ORDER BY created_at ASC', [req.params.id]));
});

router.post('/:id/comments', requireAuth, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'content is required' });
  }

  const user = await db.get('SELECT full_name FROM users WHERE id = ?', [req.userId]);
  const id = uuid();
  await db.run(
    'INSERT INTO comments (id, resource_id, author_name, content) VALUES (?, ?, ?, ?)',
    [id, req.params.id, user ? user.full_name : 'Student', content.trim()]
  );
  res.status(201).json({ id });
});

module.exports = router;