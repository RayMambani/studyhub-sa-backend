const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { sendPushToUser } = require('../notifications/push');
const { notifyUsers } = require('../notifications/feed');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  res.json(await db.all(`
    SELECT g.*,
      (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) + g.seed_members AS member_count
    FROM study_groups g ORDER BY g.created_at DESC
  `));
});

router.post('/', requireAuth, async (req, res) => {
  const { name, module, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const id = uuid();
  await db.batch([
    ['INSERT INTO study_groups (id, name, module, description, created_by) VALUES (?, ?, ?, ?, ?)', [id, name, module || '', description || '', req.userId]],
    ['INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [id, req.userId]],
  ]);
  res.status(201).json({ id });
});

router.post('/:id/join', requireAuth, async (req, res) => {
  await db.run('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)', [req.params.id, req.userId]);

  const group = await db.get('SELECT name FROM study_groups WHERE id = ?', [req.params.id]);
  const others = await db.all('SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?', [req.params.id, req.userId]);
  if (group) {
    await notifyUsers(others.map(m => m.user_id), {
      title: 'Study group invitation update',
      body: `A new student joined ${group.name}`,
      type: 'group',
    });
  }
  res.json({ joined: true });
});

router.get('/:id/messages', requireAuth, async (req, res) => {
  res.json(await db.all(`
    SELECT m.*, u.full_name AS sender_name
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.group_id = ?
    ORDER BY m.sent_at ASC LIMIT 200
  `, [req.params.id]));
});

router.post('/:id/messages', requireAuth, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });

  const id = uuid();
  await db.run('INSERT INTO messages (id, group_id, sender_id, content) VALUES (?, ?, ?, ?)', [id, req.params.id, req.userId, content]);

  const members = await db.all('SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?', [req.params.id, req.userId]);
  members.forEach(m => {
    sendPushToUser(m.user_id, { title: 'New message', body: content.slice(0, 80) })
      .catch(err => console.error('Push send failed:', err.message));
  });
  await notifyUsers(members.map(m => m.user_id), { title: 'New message', body: content.slice(0, 80), type: 'message' });

  res.status(201).json({ id });
});

module.exports = router;