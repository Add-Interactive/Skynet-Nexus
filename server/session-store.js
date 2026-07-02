// server/session-store.js
// Custom express-session store backed by node:sqlite via db.js.
// Zero external deps beyond express-session itself.

const session = require('express-session');
const { db } = require('./db');

const stmts = {
  get:    db.prepare(`SELECT data, expires_at FROM sessions WHERE sid = ?`),
  set:    db.prepare(`
    INSERT INTO sessions (sid, data, expires_at) VALUES (?, ?, ?)
    ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at
  `),
  destroy:db.prepare(`DELETE FROM sessions WHERE sid = ?`),
  clean:  db.prepare(`DELETE FROM sessions WHERE expires_at < ?`),
  touch:  db.prepare(`UPDATE sessions SET expires_at = ? WHERE sid = ?`)
};

const DAY_MS = 24 * 60 * 60 * 1000;

class SqliteSessionStore extends session.Store {
  constructor(opts = {}) {
    super();
    this.ttlMs = opts.ttlMs || 30 * DAY_MS;
    // Sweep expired sessions every hour.
    this._sweeper = setInterval(() => {
      try { stmts.clean.run(Date.now()); } catch { /* ignore */ }
    }, 60 * 60 * 1000);
    this._sweeper.unref?.();
  }

  get(sid, cb) {
    try {
      const row = stmts.get.get(sid);
      if (!row) return cb(null, null);
      if (row.expires_at < Date.now()) {
        stmts.destroy.run(sid);
        return cb(null, null);
      }
      return cb(null, JSON.parse(row.data));
    } catch (err) { cb(err); }
  }

  set(sid, sess, cb) {
    try {
      const expires = sess.cookie && sess.cookie.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + this.ttlMs;
      stmts.set.run(sid, JSON.stringify(sess), expires);
      cb && cb(null);
    } catch (err) { cb && cb(err); }
  }

  destroy(sid, cb) {
    try { stmts.destroy.run(sid); cb && cb(null); }
    catch (err) { cb && cb(err); }
  }

  touch(sid, sess, cb) {
    try {
      const expires = sess.cookie && sess.cookie.expires
        ? new Date(sess.cookie.expires).getTime()
        : Date.now() + this.ttlMs;
      stmts.touch.run(expires, sid);
      cb && cb(null);
    } catch (err) { cb && cb(err); }
  }
}

module.exports = SqliteSessionStore;
