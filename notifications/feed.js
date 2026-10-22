const { v4: uuid } = require('uuid');
const db = require('../db/db');

const INSERT = 'INSERT INTO notifications (id, user_id, title, body, type) VALUES (?, ?, ?, ?, ?)';

async function notifyUsers(userIds, { title, body, type = 'general' }) {
  if (!userIds.length) return;
  await db.batch(userIds.map(id => [INSERT, [uuid(), id, title, body, type]]));
}

async function notifyUser(userId, payload) { await notifyUsers([userId], payload); }

async function notifyAllExcept(excludeUserId, payload) {
  const users = await db.all('SELECT id FROM users WHERE id != ?', [excludeUserId || '']);
  await notifyUsers(users.map(u => u.id), payload);
}

module.exports = { notifyUser, notifyUsers, notifyAllExcept };