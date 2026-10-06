// server/notifications.js
// Server-side in-app notifications (replaces localStorage-only unseen tracking).
// Table + helpers + routes. Mounted as require('./notifications')(api, { requireAuth })
// in server/index.js. Other modules call notify() via require('./notifications').notify.

const dbm = require('./db');

function getDb() {
  // db.js exports the raw better-sqlite3 instance as `db`.
  return dbm.db || dbm;
}

function ensureTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      kind       TEXT NOT NULL DEFAULT 'info',
      title      TEXT NOT NULL,
      body       TEXT NOT NULL DEFAULT '',
      link       TEXT NOT NULL DEFAULT '',
      read_at    TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
  `);
}
ensureTable();

// Create a notification for a user. Never throws (notifications are best-effort).
function notify(userId, { kind = 'info', title = '', body = '', link = '' }) {
  if (!userId || !title) return null;
  try {
    const db = getDb();
    const r = db.prepare(
      'INSERT INTO notifications (user_id, kind, title, body, link) VALUES (?,?,?,?,?)'
    ).run(Number(userId), String(kind).slice(0, 32), String(title).slice(0, 200),
      String(body).slice(0, 500), String(link).slice(0, 500));
    return r.lastInsertRowid;
  } catch (e) {
    return null;
  }
}

// Notify all parents whose kids are in a classroom.
function notifyClassroomParents(classroomId, notif) {
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT DISTINCT k.user_id FROM kid_profiles k
       JOIN classroom_students cs ON cs.kid_id = k.id
       WHERE cs.classroom_id = ?`
    ).all(Number(classroomId));
    rows.forEach(r => notify(r.user_id, notif));
  } catch (e) { /* best-effort */ }
}

function listForUser(userId, limit = 30) {
  const db = getDb();
  return db.prepare(
    'SELECT id, kind, title, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(Number(userId), Math.min(Number(limit) || 30, 100));
}

function unreadCount(userId) {
  const db = getDb();
  const r = db.prepare(
    'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL'
  ).get(Number(userId));
  return (r && r.c) || 0;
}

module.exports = function notificationRoutes(api, { requireAuth }) {
  // GET /api/notifications — my notifications (auth, own only).
  api.get('/notifications', requireAuth, (req, res) => {
    try {
      res.json({ notifications: listForUser(req.user.id), unread: unreadCount(req.user.id) });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // GET /api/notifications/unread-count — lightweight badge poll.
  api.get('/notifications/unread-count', requireAuth, (req, res) => {
    try {
      res.json({ unread: unreadCount(req.user.id) });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // POST /api/notifications/:id/read — mark one read (own only).
  api.post('/notifications/:id/read', requireAuth, (req, res) => {
    try {
      const db = getDb();
      const r = db.prepare(
        "UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ? AND read_at IS NULL"
      ).run(Number(req.params.id), req.user.id);
      res.json({ ok: true, updated: r.changes > 0 });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // POST /api/notifications/read-all — mark all read.
  api.post('/notifications/read-all', requireAuth, (req, res) => {
    try {
      const db = getDb();
      const r = db.prepare(
        "UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL"
      ).run(req.user.id);
      res.json({ ok: true, updated: r.changes });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
};

// Helpers for other modules.
module.exports.notify = notify;
module.exports.notifyClassroomParents = notifyClassroomParents;
module.exports.listForUser = listForUser;
module.exports.unreadCount = unreadCount;
