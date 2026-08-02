// notifications/push.js
// Sends real-time push notifications via Firebase Cloud Messaging.
// Requires a Firebase service account JSON — see README for setup.

const admin = require('firebase-admin');
const db = require('../db/db');

let initialized = false;

function ensureInit() {
  if (initialized) return;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  try {
    const serviceAccount = require(path.startsWith('.') ? `../${path}` : path);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
  } catch (err) {
    console.warn(
      '[push] Firebase service account not found — push notifications are disabled until',
      'FIREBASE_SERVICE_ACCOUNT_PATH is configured. See backend/README.md.'
    );
  }
}

async function sendPushToUser(userId, { title, body }) {
  ensureInit();
  if (!initialized) return;

  const user = db.prepare('SELECT fcm_token FROM users WHERE id = ?').get(userId);
  if (!user || !user.fcm_token) return;

  return admin.messaging().send({
    token: user.fcm_token,
    notification: { title, body },
  });
}

async function sendPushToAll({ title, body, excludeUserId }) {
  ensureInit();
  if (!initialized) return;

  const users = db.prepare(
    'SELECT fcm_token FROM users WHERE fcm_token IS NOT NULL AND id != ?'
  ).all(excludeUserId || '');

  const tokens = users.map(u => u.fcm_token).filter(Boolean);
  if (tokens.length === 0) return;

  return admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
  });
}

module.exports = { sendPushToUser, sendPushToAll };
