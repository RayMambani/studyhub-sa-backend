// routes/groups.js
const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { sendPushToUser } = require('../notifications/push');

const router = express.Router();

// GET /api/groups
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT g.*, (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS member_count
    FROM study_groups g ORDER BY g.created_at DESC
  `).all();
  res.json(rows);
});

// POST /api/groups   Body: { name, module, description }
router.post('/', requireAuth, (req, res) => {
  const { name, module, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const id = uuid();
  db.prepare(
    `INSERT INTO study_groups (id, name, module, description, created_by) VALUES (?, ?, ?, ?, ?)`
  ).run(id, name, module || '', description || '', req.userId);
  db.prepare(`INSERT INTO group_members (group_id, user_id) VALUES (?, ?)`).run(id, req.userId);

  res.status(201).json({ id });
});

// POST /api/groups/:id/join
router.post('/:id/join', requireAuth, (req, res) => {
  db.prepare(
    `INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)`
  ).run(req.params.id, req.userId);
  res.json({ joined: true });
});

// GET /api/groups/:id/messages
router.get('/:id/messages', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM messages WHERE group_id = ? ORDER BY sent_at ASC LIMIT 200`
  ).all(req.params.id);
  res.json(rows);
});

// POST /api/groups/:id/messages   Body: { content }
router.post('/:id/messages', requireAuth, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });

  const id = uuid();
  db.prepare(
    `INSERT INTO messages (id, group_id, sender_id, content) VALUES (?, ?, ?, ?)`
  ).run(id, req.params.id, req.userId, content);

  // Notify other members in real time via FCM data message.
  const members = db.prepare(
    `SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?`
  ).all(req.params.id, req.userId);
  members.forEach(m => {
    sendPushToUser(m.user_id, {
      title: 'New message',
      body: content.slice(0, 80),
    }).catch(err => console.error('Push send failed:', err.message));
  });

  res.status(201).json({ id });
});

module.exports = router;
