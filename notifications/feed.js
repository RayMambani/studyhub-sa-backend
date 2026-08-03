// notifications/feed.js
// Writes rows into the `notifications` table so the Notifications screen has
// real data to show. Kept separate from push.js (which handles FCM device
// pushes) — this is the in-app "notification history" read model.
const { v4: uuid } = require('uuid');
const db = require('../db/db');

function notifyUser(userId, { title, body, type = 'general' }) {
  db.prepare(
    `INSERT INTO notifications (id, user_id, title, body, type) VALUES (?, ?, ?, ?, ?)`
  ).run(uuid(), userId, title, body, type);
}

function notifyUsers(userIds, payload) {
  userIds.forEach(id => notifyUser(id, payload));
}

function notifyAllExcept(excludeUserId, payload) {
  const users = db.prepare('SELECT id FROM users WHERE id != ?').all(excludeUserId || '');
  notifyUsers(users.map(u => u.id), payload);
}

module.exports = { notifyUser, notifyUsers, notifyAllExcept };
