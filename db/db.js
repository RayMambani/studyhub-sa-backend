const { createClient } = require('@libsql/client');

// Turso in production, a local file for tests and local dev.
const url = process.env.TURSO_DATABASE_URL || `file:${process.env.DB_PATH || './db/studyhub.sqlite'}`;
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  student_number TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'password',
  profile_image TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  fcm_token TEXT,
  privacy TEXT NOT NULL DEFAULT 'public',
  last_login_date TEXT,
  login_streak INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  module TEXT,
  file_url TEXT,
  file_type TEXT,
  uploader_id TEXT NOT NULL,
  upload_date TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (uploader_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS study_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  module TEXT,
  description TEXT,
  created_by TEXT NOT NULL,
  seed_members INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_time TEXT,
  type TEXT NOT NULL DEFAULT 'personal',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (resource_id) REFERENCES resources(id)
);
`;

const clean = (args = []) => args.map(a => (a === undefined ? null : a));

async function rawAll(sql, args) {
  const res = await client.execute({ sql, args: clean(args) });
  return res.rows.map(r => ({ ...r }));
}
async function rawGet(sql, args) { return (await rawAll(sql, args))[0]; }
async function rawBatch(stmts) {
  if (!stmts.length) return;
  await client.batch(stmts.map(([sql, args]) => ({ sql, args: clean(args) })), 'write');
}

const ready = (async () => {
  await client.executeMultiple(SCHEMA);
  try { await require('./seed')({ get: rawGet, batch: rawBatch }); }
  catch (err) { console.error('[db] seed skipped:', err.message); }
  console.log('[db] ready:', url.startsWith('file:') ? 'local file' : 'Turso');
})();
ready.catch(err => console.error('[db] init failed:', err));

module.exports = {
  ready,
  all: async (sql, args) => { await ready; return rawAll(sql, args); },
  get: async (sql, args) => { await ready; return rawGet(sql, args); },
  run: async (sql, args) => { await ready; const r = await client.execute({ sql, args: clean(args) }); return { changes: r.rowsAffected }; },
  batch: async (stmts) => { await ready; return rawBatch(stmts); },
  close: () => client.close(),
};