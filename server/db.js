// server/db.js
// SQLite schema + queries. Uses Node's built-in node:sqlite (v22.5+).
// No native compile, no npm dependency, works everywhere Node 22+ runs.

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'skynet.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ---------- Schema ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    display_name  TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    avatar_color  TEXT    NOT NULL DEFAULT '#00e5ff',
    role          TEXT    NOT NULL DEFAULT 'parent',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS kid_profiles (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    name          TEXT    NOT NULL,
    birth_year    INTEGER NOT NULL,
    avatar_color  TEXT    NOT NULL DEFAULT '#39ff14',
    avatar_emoji  TEXT    DEFAULT '🚀',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_kid_profiles_user ON kid_profiles(user_id);

  CREATE TABLE IF NOT EXISTS sessions (
    sid        TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`);

// ---------- Prepared statements ----------
const stmts = {
  createUser: db.prepare(`
    INSERT INTO users (email, display_name, password_hash, avatar_color)
    VALUES (?, ?, ?, ?)
  `),
  findUserByEmail: db.prepare(`SELECT * FROM users WHERE lower(email) = lower(?)`),
  findUserById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  updateLastLogin: db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`),
  updateUser: db.prepare(`
    UPDATE users
       SET display_name  = COALESCE(?, display_name),
           avatar_color  = COALESCE(?, avatar_color)
     WHERE id = ?
  `),
  changePassword: db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`),

  createKid: db.prepare(`
    INSERT INTO kid_profiles (user_id, name, birth_year, avatar_color, avatar_emoji)
    VALUES (?, ?, ?, ?, ?)
  `),
  listKids: db.prepare(`SELECT * FROM kid_profiles WHERE user_id = ? ORDER BY id ASC`),
  findKid: db.prepare(`SELECT * FROM kid_profiles WHERE id = ? AND user_id = ?`),
  updateKid: db.prepare(`
    UPDATE kid_profiles
       SET name         = COALESCE(?, name),
           birth_year   = COALESCE(?, birth_year),
           avatar_color = COALESCE(?, avatar_color),
           avatar_emoji = COALESCE(?, avatar_emoji)
     WHERE id = ? AND user_id = ?
  `),
  deleteKid: db.prepare(`DELETE FROM kid_profiles WHERE id = ? AND user_id = ?`)
};

// ---------- Serializers ----------
function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    role: row.role,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at
  };
}

function toPublicKid(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    birthYear: row.birth_year,
    avatarColor: row.avatar_color,
    avatarEmoji: row.avatar_emoji,
    createdAt: row.created_at
  };
}

// ---------- Exports ----------
module.exports = {
  db,
  DB_PATH,

  createUser({ email, displayName, passwordHash, avatarColor }) {
    const info = stmts.createUser.run(email, displayName, passwordHash, avatarColor);
    return toPublicUser(stmts.findUserById.get(info.lastInsertRowid));
  },
  findUserByEmail(email) { return stmts.findUserByEmail.get(email); },
  findUserById(id) { return toPublicUser(stmts.findUserById.get(id)); },
  findUserRawById(id) { return stmts.findUserById.get(id); },
  updateLastLogin(id) { stmts.updateLastLogin.run(id); },
  updateUser({ id, displayName, avatarColor }) {
    stmts.updateUser.run(displayName ?? null, avatarColor ?? null, id);
    return toPublicUser(stmts.findUserById.get(id));
  },
  changePassword(id, hash) { stmts.changePassword.run(hash, id); },

  createKid({ userId, name, birthYear, avatarColor, avatarEmoji }) {
    const info = stmts.createKid.run(userId, name, birthYear, avatarColor, avatarEmoji);
    return toPublicKid(stmts.findKid.get(info.lastInsertRowid, userId));
  },
  listKids(userId) { return stmts.listKids.all(userId).map(toPublicKid); },
  findKid(id, userId) { return toPublicKid(stmts.findKid.get(id, userId)); },
  updateKid({ id, userId, name, birthYear, avatarColor, avatarEmoji }) {
    stmts.updateKid.run(name ?? null, birthYear ?? null, avatarColor ?? null, avatarEmoji ?? null, id, userId);
    return toPublicKid(stmts.findKid.get(id, userId));
  },
  deleteKid(id, userId) { return stmts.deleteKid.run(id, userId).changes > 0; }
};
