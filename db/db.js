// db/db.js
// Lightweight SQLite database (file-based) using better-sqlite3.
// This satisfies "connect to a REST API you create that is connected to a
// database" — swap this file for a Postgres/MySQL client later without
// touching the route files, since they only call the functions exported here.

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'studyhub.sqlite'));
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
`);

module.exports = db;
