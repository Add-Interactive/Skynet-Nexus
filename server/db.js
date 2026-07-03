// server/db.js
// SQLite schema + queries. Uses Node's built-in node:sqlite (v22.5+).
// No native compile, no npm dependency, works everywhere Node 22+ runs.

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { DB_PATH, ensureStorage } = require('./storage');

// Prepare persistent storage (creates volume dirs + seeds data on first boot).
ensureStorage();

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

  CREATE TABLE IF NOT EXISTS password_resets (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL,
    used_at     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
  CREATE INDEX IF NOT EXISTS idx_password_resets_expires ON password_resets(expires_at);

  CREATE TABLE IF NOT EXISTS newsletter_signups (
    email       TEXT PRIMARY KEY,
    source      TEXT DEFAULT 'site',
    kid_count   INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ---------- ADMIN / NEWSROOM PRODUCTION SCHEMA ----------

  -- Editorial staff: correspondent AI agents + human editors visible in the admin portal.
  CREATE TABLE IF NOT EXISTS staff (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    slug          TEXT    NOT NULL UNIQUE,      -- 'stem','robotics','play','music','human:<user_id>'
    kind          TEXT    NOT NULL,             -- 'agent' | 'human'
    display_name  TEXT    NOT NULL,
    role          TEXT    NOT NULL,             -- 'Correspondent - STEM', 'Editor-in-Chief', etc
    channel       TEXT,                         -- 'stem'|'robotics'|'play'|'music'|null
    byline        TEXT,                         -- human byline used on published articles
    avatar_emoji  TEXT    DEFAULT '🛰️',
    accent_color  TEXT    DEFAULT '#00e5ff',
    status        TEXT    NOT NULL DEFAULT 'active',  -- active|paused|offline
    bio           TEXT,
    prompt_path   TEXT,                         -- newsroom/prompts/*.md when kind='agent'
    linked_user_id INTEGER,                     -- for kind='human'
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_staff_channel ON staff(channel);

  -- Reader-submitted story tips (public form -> admin review).
  CREATE TABLE IF NOT EXISTS story_submissions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    submitter_name  TEXT,
    submitter_email TEXT,
    submitter_user_id INTEGER,                  -- when submitted logged-in
    channel      TEXT    NOT NULL,              -- stem|robotics|play|music
    title        TEXT    NOT NULL,
    summary      TEXT    NOT NULL,
    body         TEXT,                          -- optional longer form
    source_url   TEXT,                          -- primary source (paper/news/repo)
    status       TEXT    NOT NULL DEFAULT 'pending',    -- pending|approved|rejected|assigned|published
    reviewed_by  INTEGER,                       -- users.id (admin who reviewed)
    reviewed_at  TEXT,
    review_notes TEXT,
    assigned_staff_id INTEGER,                  -- correspondent tasked to write this up
    resulting_story_id TEXT,                    -- article id when published
    ip_hash      TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (submitter_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_staff_id) REFERENCES staff(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_submissions_status ON story_submissions(status);
  CREATE INDEX IF NOT EXISTS idx_submissions_channel ON story_submissions(channel);

  -- Draft/queued stories: correspondent-written stories waiting for admin review before publish.
  CREATE TABLE IF NOT EXISTS queued_stories (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id     INTEGER NOT NULL,             -- who filed
    channel      TEXT    NOT NULL,
    payload      TEXT    NOT NULL,             -- full article JSON blob (post-guardrail)
    status       TEXT    NOT NULL DEFAULT 'draft', -- draft|approved|rejected|published
    submission_id INTEGER,                     -- if this story originated from a reader submission
    editor_notes TEXT,
    published_article_id TEXT,
    published_at TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (submission_id) REFERENCES story_submissions(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_queued_status ON queued_stories(status);

  -- Admin -> agent tasking. Admin can assign work to a correspondent from the portal.
  CREATE TABLE IF NOT EXISTS agent_tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id     INTEGER NOT NULL,             -- which correspondent
    created_by   INTEGER NOT NULL,             -- users.id (admin)
    title        TEXT    NOT NULL,
    instructions TEXT    NOT NULL,
    priority     TEXT    NOT NULL DEFAULT 'normal', -- low|normal|high|urgent
    status       TEXT    NOT NULL DEFAULT 'pending',-- pending|in_progress|delivered|cancelled
    submission_id INTEGER,                     -- optional link to source submission
    resulting_queued_story_id INTEGER,         -- optional link to draft that came out
    delivered_at TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (submission_id) REFERENCES story_submissions(id) ON DELETE SET NULL,
    FOREIGN KEY (resulting_queued_story_id) REFERENCES queued_stories(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_agent_tasks_staff ON agent_tasks(staff_id, status);

  -- Admin <-> agent conversation log (visible in the portal chat panel).
  CREATE TABLE IF NOT EXISTS agent_messages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id     INTEGER NOT NULL,
    author       TEXT    NOT NULL,             -- 'admin'|'agent'|'system'
    author_user_id INTEGER,                    -- users.id when author='admin'
    body         TEXT    NOT NULL,             -- markdown
    task_id      INTEGER,                      -- optional attach to task
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (task_id) REFERENCES agent_tasks(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_agent_messages_staff ON agent_messages(staff_id, id);

  -- Admin audit log (who did what, when).
  CREATE TABLE IF NOT EXISTS admin_actions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    action       TEXT    NOT NULL,             -- 'submission.approve','story.publish','staff.pause',...
    target_kind  TEXT,                         -- 'submission'|'story'|'staff'|...
    target_id    TEXT,                         -- string form for flexibility
    meta         TEXT,                         -- JSON blob
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_admin_actions_user ON admin_actions(user_id, id);
`);

// ---------- Idempotent additive migrations (safe to run every boot) ----------
function _hasColumn(table, col) {
  try {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all();
    return rows.some(r => r.name === col);
  } catch { return false; }
}
function _addColumnIfMissing(table, col, decl) {
  if (!_hasColumn(table, col)) {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`); }
    catch (e) { console.warn(`[db] add column ${table}.${col} skipped:`, e.message); }
  }
}
// users.role already exists in schema; make sure any old dbs get it too.
_addColumnIfMissing('users', 'role', "TEXT NOT NULL DEFAULT 'parent'");
// admin_notes lets an admin annotate any user account.
_addColumnIfMissing('users', 'admin_notes', 'TEXT');
// Cadence engine: queued stories can be scheduled for a timed edition release.
_addColumnIfMissing('queued_stories', 'publish_at', 'TEXT');
_addColumnIfMissing('queued_stories', 'edition', 'TEXT');


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
  deleteKid: db.prepare(`DELETE FROM kid_profiles WHERE id = ? AND user_id = ?`),
  deleteUser: db.prepare(`DELETE FROM users WHERE id = ?`),

  createPasswordReset: db.prepare(`INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)`),
  findPasswordReset: db.prepare(`SELECT * FROM password_resets WHERE token = ? AND used_at IS NULL`),
  markPasswordResetUsed: db.prepare(`UPDATE password_resets SET used_at = datetime('now') WHERE token = ?`),
  purgeExpiredResets: db.prepare(`DELETE FROM password_resets WHERE expires_at < ? OR used_at IS NOT NULL`),

  createNewsletter: db.prepare(`INSERT OR IGNORE INTO newsletter_signups (email, source, kid_count) VALUES (?, ?, ?)`),
  listNewsletter: db.prepare(`SELECT email, source, kid_count, created_at FROM newsletter_signups ORDER BY created_at DESC`),
  countNewsletter: db.prepare(`SELECT COUNT(*) AS n FROM newsletter_signups`),

  // ---------- Admin / newsroom ----------
  createStaff: db.prepare(`
    INSERT INTO staff (slug, kind, display_name, role, channel, byline, avatar_emoji, accent_color, status, bio, prompt_path, linked_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateStaff: db.prepare(`
    UPDATE staff SET
      display_name = COALESCE(?, display_name),
      role         = COALESCE(?, role),
      byline       = COALESCE(?, byline),
      avatar_emoji = COALESCE(?, avatar_emoji),
      accent_color = COALESCE(?, accent_color),
      status       = COALESCE(?, status),
      bio          = COALESCE(?, bio),
      prompt_path  = COALESCE(?, prompt_path),
      updated_at   = datetime('now')
    WHERE id = ?
  `),
  findStaffById: db.prepare(`SELECT * FROM staff WHERE id = ?`),
  findStaffBySlug: db.prepare(`SELECT * FROM staff WHERE slug = ?`),
  listStaff: db.prepare(`SELECT * FROM staff ORDER BY kind ASC, id ASC`),
  listStaffByChannel: db.prepare(`SELECT * FROM staff WHERE channel = ? ORDER BY id ASC`),

  createSubmission: db.prepare(`
    INSERT INTO story_submissions (submitter_name, submitter_email, submitter_user_id, channel, title, summary, body, source_url, ip_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  findSubmission: db.prepare(`SELECT * FROM story_submissions WHERE id = ?`),
  listSubmissions: db.prepare(`SELECT * FROM story_submissions ORDER BY id DESC LIMIT ? OFFSET ?`),
  listSubmissionsByStatus: db.prepare(`SELECT * FROM story_submissions WHERE status = ? ORDER BY id DESC LIMIT ? OFFSET ?`),
  countSubmissionsByStatus: db.prepare(`SELECT status, COUNT(*) AS n FROM story_submissions GROUP BY status`),
  updateSubmission: db.prepare(`
    UPDATE story_submissions SET
      status       = COALESCE(?, status),
      reviewed_by  = COALESCE(?, reviewed_by),
      reviewed_at  = COALESCE(?, reviewed_at),
      review_notes = COALESCE(?, review_notes),
      assigned_staff_id = COALESCE(?, assigned_staff_id),
      resulting_story_id = COALESCE(?, resulting_story_id)
    WHERE id = ?
  `),

  createQueuedStory: db.prepare(`
    INSERT INTO queued_stories (staff_id, channel, payload, status, submission_id)
    VALUES (?, ?, ?, ?, ?)
  `),
  updateQueuedStory: db.prepare(`
    UPDATE queued_stories SET
      status = COALESCE(?, status),
      editor_notes = COALESCE(?, editor_notes),
      payload = COALESCE(?, payload),
      published_article_id = COALESCE(?, published_article_id),
      published_at = COALESCE(?, published_at),
      updated_at = datetime('now')
    WHERE id = ?
  `),
  findQueuedStory: db.prepare(`SELECT * FROM queued_stories WHERE id = ?`),
  listQueuedStories: db.prepare(`SELECT * FROM queued_stories ORDER BY id DESC LIMIT ? OFFSET ?`),
  listQueuedByStatus: db.prepare(`SELECT * FROM queued_stories WHERE status = ? ORDER BY id DESC LIMIT ? OFFSET ?`),
  scheduleQueuedStory: db.prepare(`
    UPDATE queued_stories SET
      status = 'scheduled',
      publish_at = ?,
      edition = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `),
  listDueScheduled: db.prepare(`
    SELECT * FROM queued_stories
     WHERE status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= ?
     ORDER BY publish_at ASC LIMIT 20
  `),
  listScheduledUpcoming: db.prepare(`
    SELECT * FROM queued_stories
     WHERE status = 'scheduled'
     ORDER BY publish_at ASC LIMIT ? OFFSET ?
  `),

  createAgentTask: db.prepare(`
    INSERT INTO agent_tasks (staff_id, created_by, title, instructions, priority, status, submission_id)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `),
  updateAgentTask: db.prepare(`
    UPDATE agent_tasks SET
      status = COALESCE(?, status),
      resulting_queued_story_id = COALESCE(?, resulting_queued_story_id),
      delivered_at = COALESCE(?, delivered_at),
      updated_at = datetime('now')
    WHERE id = ?
  `),
  findAgentTask: db.prepare(`SELECT * FROM agent_tasks WHERE id = ?`),
  listAgentTasksByStaff: db.prepare(`SELECT * FROM agent_tasks WHERE staff_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`),
  listPendingAgentTasks: db.prepare(`SELECT * FROM agent_tasks WHERE status IN ('pending','in_progress') ORDER BY id DESC`),

  createAgentMessage: db.prepare(`
    INSERT INTO agent_messages (staff_id, author, author_user_id, body, task_id)
    VALUES (?, ?, ?, ?, ?)
  `),
  listAgentMessages: db.prepare(`SELECT * FROM agent_messages WHERE staff_id = ? ORDER BY id ASC LIMIT ? OFFSET ?`),

  createAdminAction: db.prepare(`
    INSERT INTO admin_actions (user_id, action, target_kind, target_id, meta)
    VALUES (?, ?, ?, ?, ?)
  `),
  listAdminActions: db.prepare(`SELECT a.*, u.email AS user_email, u.display_name AS user_display_name FROM admin_actions a JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT ? OFFSET ?`),

  updateUserRole: db.prepare(`UPDATE users SET role = ? WHERE id = ?`),
  listAllUsers: db.prepare(`SELECT id, email, display_name, avatar_color, role, created_at, last_login_at FROM users ORDER BY id ASC LIMIT ? OFFSET ?`),
  countUsers: db.prepare(`SELECT COUNT(*) AS n FROM users`),

  // Admin user management: search + kid counts + admin-only fields.
  listUsersSearch: db.prepare(`
    SELECT u.id, u.email, u.display_name, u.avatar_color, u.role, u.created_at, u.last_login_at, u.admin_notes,
           (SELECT COUNT(*) FROM kid_profiles k WHERE k.user_id = u.id) AS kid_count
      FROM users u
     WHERE lower(u.email) LIKE ? OR lower(u.display_name) LIKE ?
     ORDER BY u.id DESC
     LIMIT ? OFFSET ?`),
  countUsersSearch: db.prepare(`
    SELECT COUNT(*) AS n FROM users u
     WHERE lower(u.email) LIKE ? OR lower(u.display_name) LIKE ?`),
  countAdmins: db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin'`),
  setAdminNotes: db.prepare(`UPDATE users SET admin_notes = ? WHERE id = ?`)
};

function toPublicStaff(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    displayName: row.display_name,
    role: row.role,
    channel: row.channel,
    byline: row.byline,
    avatarEmoji: row.avatar_emoji,
    accentColor: row.accent_color,
    status: row.status,
    bio: row.bio,
    promptPath: row.prompt_path,
    linkedUserId: row.linked_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toPublicSubmission(row) {
  if (!row) return null;
  return {
    id: row.id,
    submitterName: row.submitter_name,
    submitterEmail: row.submitter_email,
    submitterUserId: row.submitter_user_id,
    channel: row.channel,
    title: row.title,
    summary: row.summary,
    body: row.body,
    sourceUrl: row.source_url,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
    assignedStaffId: row.assigned_staff_id,
    resultingStoryId: row.resulting_story_id,
    createdAt: row.created_at
  };
}

function toPublicQueuedStory(row) {
  if (!row) return null;
  let parsedPayload = null;
  try { parsedPayload = JSON.parse(row.payload); } catch { parsedPayload = { raw: row.payload }; }
  return {
    id: row.id,
    staffId: row.staff_id,
    channel: row.channel,
    payload: parsedPayload,
    status: row.status,
    submissionId: row.submission_id,
    editorNotes: row.editor_notes,
    publishedArticleId: row.published_article_id,
    publishedAt: row.published_at,
    scheduledAt: row.publish_at,
    edition: row.edition,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toPublicAgentTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    staffId: row.staff_id,
    createdBy: row.created_by,
    title: row.title,
    instructions: row.instructions,
    priority: row.priority,
    status: row.status,
    submissionId: row.submission_id,
    resultingQueuedStoryId: row.resulting_queued_story_id,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toPublicAgentMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    staffId: row.staff_id,
    author: row.author,
    authorUserId: row.author_user_id,
    body: row.body,
    taskId: row.task_id,
    createdAt: row.created_at
  };
}

function toPublicAdminAction(row) {
  if (!row) return null;
  let parsedMeta = null;
  if (row.meta) { try { parsedMeta = JSON.parse(row.meta); } catch { parsedMeta = null; } }
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    userDisplayName: row.user_display_name,
    action: row.action,
    targetKind: row.target_kind,
    targetId: row.target_id,
    meta: parsedMeta,
    createdAt: row.created_at
  };
}

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

// Admin-facing user shape: adds admin_notes + kid_count on top of the public user.
function toAdminUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    role: row.role,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    adminNotes: row.admin_notes || '',
    kidCount: row.kid_count != null ? row.kid_count : 0
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
  deleteKid(id, userId) { return stmts.deleteKid.run(id, userId).changes > 0; },

  deleteUser(id) { return stmts.deleteUser.run(id).changes > 0; },

  createPasswordReset({ userId, token, expiresAt }) {
    stmts.createPasswordReset.run(token, userId, expiresAt);
    return { token, userId, expiresAt };
  },
  findPasswordReset(token) {
    const row = stmts.findPasswordReset.get(token);
    if (!row) return null;
    if (row.expires_at < Date.now()) return null;
    return { token: row.token, userId: row.user_id, expiresAt: row.expires_at, usedAt: row.used_at };
  },
  markPasswordResetUsed(token) { stmts.markPasswordResetUsed.run(token); },
  purgeExpiredResets() { return stmts.purgeExpiredResets.run(Date.now()).changes; },

  addNewsletter({ email, source = 'site', kidCount = 0 }) {
    const info = stmts.createNewsletter.run(email.toLowerCase(), source, kidCount);
    return { inserted: info.changes > 0, email: email.toLowerCase() };
  },
  listNewsletter() { return stmts.listNewsletter.all(); },
  countNewsletter() { return stmts.countNewsletter.get().n; },

  // ---------- Admin / newsroom ----------
  createStaff(input) {
    const info = stmts.createStaff.run(
      input.slug, input.kind, input.displayName, input.role, input.channel ?? null,
      input.byline ?? null, input.avatarEmoji ?? '🛰️', input.accentColor ?? '#00e5ff',
      input.status ?? 'active', input.bio ?? null, input.promptPath ?? null, input.linkedUserId ?? null
    );
    return toPublicStaff(stmts.findStaffById.get(info.lastInsertRowid));
  },
  updateStaff({ id, displayName, role, byline, avatarEmoji, accentColor, status, bio, promptPath }) {
    stmts.updateStaff.run(
      displayName ?? null, role ?? null, byline ?? null, avatarEmoji ?? null,
      accentColor ?? null, status ?? null, bio ?? null, promptPath ?? null, id
    );
    return toPublicStaff(stmts.findStaffById.get(id));
  },
  findStaffById(id) { return toPublicStaff(stmts.findStaffById.get(id)); },
  findStaffBySlug(slug) { return toPublicStaff(stmts.findStaffBySlug.get(slug)); },
  listStaff() { return stmts.listStaff.all().map(toPublicStaff); },
  listStaffByChannel(channel) { return stmts.listStaffByChannel.all(channel).map(toPublicStaff); },

  createSubmission(input) {
    const info = stmts.createSubmission.run(
      input.submitterName ?? null, input.submitterEmail ?? null, input.submitterUserId ?? null,
      input.channel, input.title, input.summary, input.body ?? null,
      input.sourceUrl ?? null, input.ipHash ?? null
    );
    return toPublicSubmission(stmts.findSubmission.get(info.lastInsertRowid));
  },
  findSubmission(id) { return toPublicSubmission(stmts.findSubmission.get(id)); },
  listSubmissions({ status, limit = 50, offset = 0 } = {}) {
    const rows = status
      ? stmts.listSubmissionsByStatus.all(status, limit, offset)
      : stmts.listSubmissions.all(limit, offset);
    return rows.map(toPublicSubmission);
  },
  countSubmissionsByStatus() {
    const rows = stmts.countSubmissionsByStatus.all();
    const out = { pending: 0, approved: 0, rejected: 0, assigned: 0, published: 0 };
    for (const r of rows) out[r.status] = r.n;
    return out;
  },
  updateSubmission({ id, status, reviewedBy, reviewNotes, assignedStaffId, resultingStoryId, reviewedAt }) {
    stmts.updateSubmission.run(
      status ?? null, reviewedBy ?? null, reviewedAt ?? null,
      reviewNotes ?? null, assignedStaffId ?? null, resultingStoryId ?? null, id
    );
    return toPublicSubmission(stmts.findSubmission.get(id));
  },

  createQueuedStory({ staffId, channel, payload, status = 'draft', submissionId = null }) {
    const info = stmts.createQueuedStory.run(staffId, channel, JSON.stringify(payload), status, submissionId);
    return toPublicQueuedStory(stmts.findQueuedStory.get(info.lastInsertRowid));
  },
  updateQueuedStory({ id, status, editorNotes, payload, publishedArticleId, publishedAt }) {
    stmts.updateQueuedStory.run(
      status ?? null, editorNotes ?? null,
      payload != null ? JSON.stringify(payload) : null,
      publishedArticleId ?? null, publishedAt ?? null, id
    );
    return toPublicQueuedStory(stmts.findQueuedStory.get(id));
  },
  findQueuedStory(id) { return toPublicQueuedStory(stmts.findQueuedStory.get(id)); },
  listQueuedStories({ status, limit = 50, offset = 0 } = {}) {
    const rows = status
      ? stmts.listQueuedByStatus.all(status, limit, offset)
      : stmts.listQueuedStories.all(limit, offset);
    return rows.map(toPublicQueuedStory);
  },
  scheduleQueuedStory({ id, publishAt, edition = null }) {
    stmts.scheduleQueuedStory.run(publishAt, edition, id);
    return toPublicQueuedStory(stmts.findQueuedStory.get(id));
  },
  listDueScheduledStories(nowIso) {
    return stmts.listDueScheduled.all(nowIso).map(toPublicQueuedStory);
  },
  listScheduledStories({ limit = 50, offset = 0 } = {}) {
    return stmts.listScheduledUpcoming.all(limit, offset).map(toPublicQueuedStory);
  },

  createAgentTask({ staffId, createdBy, title, instructions, priority = 'normal', submissionId = null }) {
    const info = stmts.createAgentTask.run(staffId, createdBy, title, instructions, priority, submissionId);
    return toPublicAgentTask(stmts.findAgentTask.get(info.lastInsertRowid));
  },
  updateAgentTask({ id, status, resultingQueuedStoryId, deliveredAt }) {
    stmts.updateAgentTask.run(status ?? null, resultingQueuedStoryId ?? null, deliveredAt ?? null, id);
    return toPublicAgentTask(stmts.findAgentTask.get(id));
  },
  findAgentTask(id) { return toPublicAgentTask(stmts.findAgentTask.get(id)); },
  listAgentTasksByStaff(staffId, { limit = 50, offset = 0 } = {}) {
    return stmts.listAgentTasksByStaff.all(staffId, limit, offset).map(toPublicAgentTask);
  },
  listPendingAgentTasks() { return stmts.listPendingAgentTasks.all().map(toPublicAgentTask); },

  createAgentMessage({ staffId, author, authorUserId, body, taskId }) {
    const info = stmts.createAgentMessage.run(staffId, author, authorUserId ?? null, body, taskId ?? null);
    return toPublicAgentMessage({
      id: info.lastInsertRowid, staff_id: staffId, author, author_user_id: authorUserId ?? null,
      body, task_id: taskId ?? null, created_at: new Date().toISOString()
    });
  },
  listAgentMessages(staffId, { limit = 200, offset = 0 } = {}) {
    return stmts.listAgentMessages.all(staffId, limit, offset).map(toPublicAgentMessage);
  },

  createAdminAction({ userId, action, targetKind, targetId, meta }) {
    stmts.createAdminAction.run(
      userId, action, targetKind ?? null,
      targetId != null ? String(targetId) : null,
      meta ? JSON.stringify(meta) : null
    );
  },
  listAdminActions({ limit = 100, offset = 0 } = {}) {
    return stmts.listAdminActions.all(limit, offset).map(toPublicAdminAction);
  },

  setUserRole(userId, role) {
    stmts.updateUserRole.run(role, userId);
    return toPublicUser(stmts.findUserById.get(userId));
  },
  listAllUsers({ limit = 200, offset = 0 } = {}) {
    return stmts.listAllUsers.all(limit, offset).map(toPublicUser);
  },
  countUsers() { return stmts.countUsers.get().n; },

  // ---------- Admin user management ----------
  searchUsers({ q = '', limit = 100, offset = 0 } = {}) {
    const like = '%' + String(q).toLowerCase() + '%';
    return stmts.listUsersSearch.all(like, like, limit, offset).map(toAdminUser);
  },
  countUsersSearch(q = '') {
    const like = '%' + String(q).toLowerCase() + '%';
    return stmts.countUsersSearch.get(like, like).n;
  },
  countAdmins() { return stmts.countAdmins.get().n; },
  setAdminNotes(id, notes) {
    stmts.setAdminNotes.run(notes != null ? String(notes) : null, id);
    return toAdminUser(stmts.findUserById.get(id));
  },
  // Full admin view of a single user including their kid profiles.
  findUserForAdmin(id) {
    const row = stmts.findUserById.get(id);
    if (!row) return null;
    const user = toAdminUser(row);
    user.kids = stmts.listKids.all(id).map(toPublicKid);
    user.kidCount = user.kids.length;
    return user;
  }
};

// ---------- Bootstrap: seed core correspondent staff on first run ----------
const CORRESPONDENT_SEEDS = [
  { slug: 'stem', kind: 'agent', displayName: 'Priya Ramanathan', role: 'Correspondent — STEM', channel: 'stem', byline: 'Priya Ramanathan', avatarEmoji: '🧬', accentColor: '#00e5ff', bio: 'Covers young researchers, science fair winners, aerospace, and math prodigies.', promptPath: 'newsroom/prompts/stem.md' },
  { slug: 'robotics', kind: 'agent', displayName: 'Maya Ortiz', role: 'Correspondent — Robotics', channel: 'robotics', byline: 'Maya Ortiz', avatarEmoji: '🤖', accentColor: '#a855f7', bio: 'Covers FIRST (FRC/FTC/FLL), VEX, BEST, RoboCup Junior. Loves shop rat energy.', promptPath: 'newsroom/prompts/robotics.md' },
  { slug: 'play', kind: 'agent', displayName: 'Amara Okafor', role: 'Correspondent — Play & Design', channel: 'play', byline: 'Amara Okafor', avatarEmoji: '🎨', accentColor: '#39ff14', bio: 'Scratch, Minecraft EDU, Roblox creators, chess prodigies, scholastic esports.', promptPath: 'newsroom/prompts/play.md' },
  { slug: 'music', kind: 'agent', displayName: 'Riley Chen', role: 'Correspondent — Music', channel: 'music', byline: 'Riley Chen', avatarEmoji: '🎧', accentColor: '#ff2e63', bio: 'YoungArts, All-State, teen songwriters, teen composers, festival stages.', promptPath: 'newsroom/prompts/music.md' },
  { slug: 'director', kind: 'agent', displayName: 'Skye', role: 'News Office Director', channel: null, byline: 'Skye', avatarEmoji: '🛰️', accentColor: '#00e5ff', bio: 'Runs the newsroom. Reviews everything, ships the daily edition, moderates submissions.', promptPath: 'newsroom/director.md' }
];

for (const seed of CORRESPONDENT_SEEDS) {
  const existing = stmts.findStaffBySlug.get(seed.slug);
  if (!existing) {
    stmts.createStaff.run(
      seed.slug, seed.kind, seed.displayName, seed.role, seed.channel,
      seed.byline, seed.avatarEmoji, seed.accentColor, 'active',
      seed.bio, seed.promptPath, null
    );
  }
}
