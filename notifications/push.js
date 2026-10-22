const admin = require('firebase-admin');
const db = require('../db/db');

let initialized = false;

function ensureInit() {
  if (initialized) return;
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  try {
    const serviceAccount = require(keyPath.startsWith('.') ? `../${keyPath}` : keyPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
  } catch (err) {
    console.warn('[push] Firebase service account not found - push notifications are disabled until FIREBASE_SERVICE_ACCOUNT_PATH is configured.');
  }
}

async function sendPushToUser(userId, { title, body }) {
  ensureInit();
  if (!initialized) return;
  const user = await db.get('SELECT fcm_token FROM users WHERE id = ?', [userId]);
  if (!user || !user.fcm_token) return;
  return admin.messaging().send({ token: user.fcm_token, notification: { title, body } });
}

async function sendPushToAll({ title, body, excludeUserId }) {
  ensureInit();
  if (!initialized) return;
  const users = await db.all('SELECT fcm_token FROM users WHERE fcm_token IS NOT NULL AND id != ?', [excludeUserId || '']);
  const tokens = users.map(u => u.fcm_token).filter(Boolean);
  if (!tokens.length) return;
  return admin.messaging().sendEachForMulticast({ tokens, notification: { title, body } });
}

module.exports = { sendPushToUser, sendPushToAll };