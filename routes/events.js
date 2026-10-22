const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { notifyUser } = require('../notifications/feed');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  res.json(await db.all('SELECT * FROM events WHERE user_id = ? ORDER BY event_date ASC, event_time ASC', [req.userId]));
});

router.post('/', requireAuth, async (req, res) => {
  const { title, eventDate, eventTime, type } = req.body;
  if (!title || !eventDate) {
    return res.status(400).json({ error: 'title and eventDate are required' });
  }

  const id = uuid();
  await db.run(
    'INSERT INTO events (id, user_id, title, event_date, event_time, type) VALUES (?, ?, ?, ?, ?, ?)',
    [id, req.userId, title, eventDate, eventTime || null, type || 'personal']
  );

  await notifyUser(req.userId, {
    title: 'Event added to your calendar',
    body: `${title} — ${eventDate}${eventTime ? ' at ' + eventTime : ''}`,
    type: 'reminder',
  });

  res.status(201).json({ id });
});

router.delete('/:id', requireAuth, async (req, res) => {
  await db.run('DELETE FROM events WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json({ deleted: true });
});

module.exports = router;