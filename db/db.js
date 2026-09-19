// db/db.js
// Lightweight SQLite database (file-based) using better-sqlite3.
// This satisfies "connect to a REST API you create that is connected to a
// database" — swap this file for a Postgres/MySQL client later without
// touching the route files, since they only call the functions exported here.

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'studyhub.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// ---------- Schema ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  student_number TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,          -- NULL for SSO-only accounts
  auth_provider TEXT NOT NULL DEFAULT 'password', -- 'password' | 'google'
  profile_image TEXT,
  language TEXT NOT NULL DEFAULT 'en', -- en | zu | ve
  fcm_token TEXT,
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

-- Notes created offline on-device (SQLite/Room) land here once synced.
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,          -- same UUID the client generated offline
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Academic Calendar events (tests, assignments, personal reminders).
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,     -- ISO date, e.g. 2026-08-14
  event_time TEXT,              -- e.g. 09:00, optional
  type TEXT NOT NULL DEFAULT 'personal', -- test | assignment | personal
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Real notification feed backing the Notifications screen.
-- Rows are inserted whenever something notification-worthy happens
-- (resource upload, group message, upcoming event), then read back per user.
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,        -- recipient
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general', -- resource | group | message | reminder
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
-- Comments left on a resource in the Resource Library.
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (resource_id) REFERENCES resources(id)
);
`);

// Lightweight migration: add columns to users/study_groups if not present yet
// (keeps existing databases working without needing a full migration tool).
const userColumns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
if (!userColumns.includes('privacy')) {
  db.exec("ALTER TABLE users ADD COLUMN privacy TEXT NOT NULL DEFAULT 'public'");
}
if (!userColumns.includes('last_login_date')) {
  db.exec("ALTER TABLE users ADD COLUMN last_login_date TEXT");
}
if (!userColumns.includes('login_streak')) {
  db.exec("ALTER TABLE users ADD COLUMN login_streak INTEGER NOT NULL DEFAULT 0");
}

const groupColumns = db.prepare("PRAGMA table_info(study_groups)").all().map(c => c.name);
if (!groupColumns.includes('seed_members')) {
  // A baseline member count so existing demo groups look like real,
  // established communities on top of whoever actually joins later.
  db.exec("ALTER TABLE study_groups ADD COLUMN seed_members INTEGER NOT NULL DEFAULT 0");
}

require('./seed')(db);

module.exports = db;
