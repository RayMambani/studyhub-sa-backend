// routes/events.js
const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { notifyUser } = require('../notifications/feed');

const router = express.Router();

// GET /api/events — the logged-in student's own calendar events, soonest first
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM events WHERE user_id = ? ORDER BY event_date ASC, event_time ASC`
  ).all(req.userId);
  res.json(rows);
});

// POST /api/events   Body: { title, eventDate, eventTime?, type? }
router.post('/', requireAuth, (req, res) => {
  const { title, eventDate, eventTime, type } = req.body;
  if (!title || !eventDate) {
    return res.status(400).json({ error: 'title and eventDate are required' });
  }

  const id = uuid();
  db.prepare(
    `INSERT INTO events (id, user_id, title, event_date, event_time, type)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, req.userId, title, eventDate, eventTime || null, type || 'personal');

  // Log a reminder-type notification immediately so the Notifications screen
  // has something real to show without waiting for the date to arrive.
  notifyUser(req.userId, {
    title: 'Event added to your calendar',
    body: `${title} — ${eventDate}${eventTime ? ' at ' + eventTime : ''}`,
    type: 'reminder',
  });

  res.status(201).json({ id });
});

// DELETE /api/events/:id
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare(`DELETE FROM events WHERE id = ? AND user_id = ?`).run(req.params.id, req.userId);
  res.json({ deleted: true });
});

module.exports = router;
