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

`);

// Teacher public profile fields (added 2026-10-05).
// ALTER TABLE guards: SQLite has no IF NOT EXISTS for columns.
for (const [col, type] of [
  ['bio', 'TEXT'],
  ['degrees', 'TEXT'],
  ['awards', 'TEXT'],
  ['quote', 'TEXT'],
  ['profile_image', 'TEXT'],
  ['school', 'TEXT'],
  ['subjects', 'TEXT'],
  ['public_profile', 'INTEGER DEFAULT 0'],
]) {
  try { db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`); }
  catch (e) { /* already exists */ }
}

// Family linking + classroom invites (added 2026-10-05).
db.exec(`
  CREATE TABLE IF NOT EXISTS families (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    created_by  INTEGER NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS family_members (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id    INTEGER NOT NULL,
    user_id      INTEGER NOT NULL,
    relationship TEXT NOT NULL DEFAULT 'parent',
    invited_by   INTEGER,
    joined_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(family_id, user_id),
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS classroom_invites (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    classroom_id INTEGER NOT NULL,
    teacher_id   INTEGER NOT NULL,
    parent_email TEXT NOT NULL,
    invite_code  TEXT NOT NULL UNIQUE,
    status       TEXT NOT NULL DEFAULT 'pending',
    expires_at   TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
  );
`);

// Safety + engagement tables (added 2026-10-05).
db.exec(`
  CREATE TABLE IF NOT EXISTS parental_consents (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    method     TEXT NOT NULL DEFAULT 'email_verify',
    verified   INTEGER NOT NULL DEFAULT 0,
    verified_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS reading_goals (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    kid_id         INTEGER NOT NULL,
    stories_target INTEGER NOT NULL DEFAULT 3,
    week_start     TEXT NOT NULL,
    created_by     INTEGER NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (kid_id) REFERENCES kid_profiles(id) ON DELETE CASCADE
  );
`);
// quiet_hours columns on kid_settings
for (const [col, type] of [
  ['quiet_enabled', 'INTEGER DEFAULT 0'],
  ['quiet_start', 'TEXT DEFAULT \'20:00\''],
  ['quiet_end', 'TEXT DEFAULT \'07:00\''],
]) {
  try { db.exec(`ALTER TABLE kid_settings ADD COLUMN ${col} ${type}`); }
  catch (e) { /* already exists */ }
}

// Safe chat system (added 2026-10-05). Invite-only spaces, kid default-deny on public.
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_spaces (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL,  -- 'family', 'classroom', 'solo', 'public'
    ref_id     INTEGER,        -- family_id / classroom_id / user_id
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(type, ref_id)
  );
  CREATE TABLE IF NOT EXISTS chat_members (
    space_id   INTEGER NOT NULL,
    user_id    INTEGER,        -- adult member
    kid_id     INTEGER,        -- kid member
    role       TEXT NOT NULL DEFAULT 'member',  -- 'admin', 'moderator', 'member'
    joined_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (space_id, user_id, kid_id),
    FOREIGN KEY (space_id) REFERENCES chat_spaces(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS chat_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    space_id   INTEGER NOT NULL,
    user_id    INTEGER,        -- adult author
    kid_id     INTEGER,        -- kid author
    body       TEXT NOT NULL,
    flagged    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (space_id) REFERENCES chat_spaces(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS chat_reports (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    reporter_user_id INTEGER,
    reason     TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
  );
`);
// Ensure every family/classroom/user gets a chat space (run once at boot)
function ensureChatSpaces() {
  try {
    for (const f of db.prepare('SELECT id, name FROM families').all()) {
      db.prepare('INSERT OR IGNORE INTO chat_spaces (type, ref_id, name) VALUES (?,?,?)').run('family', f.id, f.name + ' 💬');
    }
    for (const c of db.prepare('SELECT id, name FROM classrooms').all()) {
      db.prepare('INSERT OR IGNORE INTO chat_spaces (type, ref_id, name) VALUES (?,?,?)').run('classroom', c.id, c.name + ' 🏫');
    }
    for (const u of db.prepare('SELECT id, display_name FROM users').all()) {
      db.prepare('INSERT OR IGNORE INTO chat_spaces (type, ref_id, name) VALUES (?,?,?)').run('solo', u.id, (u.display_name || 'You') + "'s notes");
    }
    db.prepare("INSERT OR IGNORE INTO chat_spaces (type, ref_id, name) VALUES ('public', 0, '🌍 Public Square')").run();
  } catch (e) { console.warn('[chat] ensureChatSpaces:', e.message); }
}

// Classroom settings (added 2026-10-05).
db.exec(`
  CREATE TABLE IF NOT EXISTS classroom_settings (
    classroom_id   INTEGER PRIMARY KEY,
    listen_enabled INTEGER NOT NULL DEFAULT 1,
    channels       TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
  );
`);

// public_chat_allowed for existing kid_settings rows (added 2026-10-05).
try { db.exec('ALTER TABLE kid_settings ADD COLUMN public_chat_allowed INTEGER DEFAULT 0'); }
catch (e) { /* already exists */ }

// Kid dashboard customization (added 2026-10-05).
for (const [col, type] of [
  ['banner_image', 'TEXT'],
  ['quote', 'TEXT'],
  ['interests', 'TEXT'],
]) {
  try { db.exec(`ALTER TABLE kid_profiles ADD COLUMN ${col} ${type}`); }
  catch (e) { /* already exists */ }
}

// Kid settings + accessibility (added 2026-10-05).
db.exec(`
  CREATE TABLE IF NOT EXISTS kid_settings (
    kid_id              INTEGER PRIMARY KEY,
    listen_enabled      INTEGER NOT NULL DEFAULT 1,
    channels            TEXT NOT NULL DEFAULT '[]',
    comments_enabled    INTEGER NOT NULL DEFAULT 1,
    -- Accessibility (parent-declared in kid profile)
    is_blind            INTEGER NOT NULL DEFAULT 0,
    low_vision          INTEGER NOT NULL DEFAULT 0,
    audio_guide         INTEGER NOT NULL DEFAULT 0,
    voice_commands      INTEGER NOT NULL DEFAULT 0,
    large_text          INTEGER NOT NULL DEFAULT 0,
    high_contrast       INTEGER NOT NULL DEFAULT 0,
    public_chat_allowed INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (kid_id) REFERENCES kid_profiles(id) ON DELETE CASCADE
  );
`);

db.exec(`
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
  -- Correspondent story sources (RSS feeds, sites, guided searches).
  -- Seeded from newsroom/sources/registry.json; adjustable per-agent in admin.
  CREATE TABLE IF NOT EXISTS agent_sources (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id      INTEGER NOT NULL,
    type          TEXT    NOT NULL,
    url           TEXT,
    query         TEXT,
    label         TEXT,
    notes         TEXT,
    priority      INTEGER NOT NULL DEFAULT 5,
    enabled       INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_agent_sources_staff ON agent_sources(staff_id, enabled, priority);

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

  -- Social drafts: per-platform video packages filed by the social producer
  -- agents (~30 min after each edition drop). Reviewed in the admin Social tab.
  -- v1: content only — posting stays manual, no platform API integration.
  CREATE TABLE IF NOT EXISTS social_drafts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    platform     TEXT    NOT NULL,             -- youtube_shorts|tiktok|instagram_reels
    story_id     TEXT,                         -- source article id
    story_title  TEXT,
    hook         TEXT    NOT NULL,             -- first-3-seconds hook
    script       TEXT    NOT NULL,             -- 30-60s spoken script
    caption      TEXT,
    hashtags     TEXT,                         -- JSON array
    art_pick     TEXT,                         -- Nexus Glow image path
    cta          TEXT,
    status       TEXT    NOT NULL DEFAULT 'draft', -- draft|approved|posted
    drop_key     TEXT,                         -- e.g. 2026-09-30-evening
    edition      TEXT,                         -- morning|midday|evening
    editor_notes TEXT,
    posted_at    TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_social_platform_status ON social_drafts(platform, status);
  CREATE INDEX IF NOT EXISTS idx_social_drop ON social_drafts(drop_key);
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
// Multi-role support (2026-10-05): users.roles is a JSON array, e.g. ["teacher","parent"].
// users.role stays as the primary/display role for backward compatibility.
_addColumnIfMissing('users', 'roles', 'TEXT');
try {
  db.exec(`UPDATE users SET roles = json_array(role) WHERE roles IS NULL`);
} catch (e) { console.warn('[db] backfill users.roles skipped:', e.message); }
// admin_notes lets an admin annotate any user account.
_addColumnIfMissing('users', 'admin_notes', 'TEXT');
// Cadence engine: queued stories can be scheduled for a timed edition release.
_addColumnIfMissing('queued_stories', 'publish_at', 'TEXT');
_addColumnIfMissing('queued_stories', 'edition', 'TEXT');
// Correspondents dashboard: kid-facing bio/fun-fact/portraits on staff.
_addColumnIfMissing('staff', 'kid_bio', 'TEXT');
_addColumnIfMissing('staff', 'fun_fact', 'TEXT');
_addColumnIfMissing('staff', 'portrait_human', 'TEXT');
_addColumnIfMissing('staff', 'portrait_animal', 'TEXT');
_addColumnIfMissing('staff', 'portrait_skynet', 'TEXT');
// Kids pick a correspondent portrait style: human|animal|skynet.
_addColumnIfMissing('kid_profiles', 'correspondent_style', "TEXT NOT NULL DEFAULT 'human'");
// Account-level default style (used when no kid profile is active).
_addColumnIfMissing('users', 'correspondent_style', "TEXT NOT NULL DEFAULT 'human'");
// Gamification v1 (Junior Correspondent Program): XP events + badges per kid.
db.exec(`
  CREATE TABLE IF NOT EXISTS kid_xp_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kid_id INTEGER NOT NULL REFERENCES kid_profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    article_id TEXT,
    article_cat TEXT,
    xp INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_xp_once ON kid_xp_events(kid_id, event_type, article_id);
  CREATE TABLE IF NOT EXISTS kid_badges (
    kid_id INTEGER NOT NULL REFERENCES kid_profiles(id) ON DELETE CASCADE,
    badge_key TEXT NOT NULL,
    earned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (kid_id, badge_key)
  );
`);
// Classroom system: teachers group student profiles into classes and run
// threaded article/topic discussions with them.
db.exec(`
  CREATE TABLE IF NOT EXISTS classrooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE IF NOT EXISTS classroom_students (
    classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    kid_id INTEGER NOT NULL REFERENCES kid_profiles(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (classroom_id, kid_id)
  );
  CREATE TABLE IF NOT EXISTS discussions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    article_id TEXT,
    article_cat TEXT,
    topic TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE IF NOT EXISTS discussion_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discussion_id INTEGER NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    author_kid_id INTEGER REFERENCES kid_profiles(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
`);
// Grown-up XP track (parents + teachers): co-reading and hosting discussions.
db.exec(`
  CREATE TABLE IF NOT EXISTS user_xp_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    ref_id TEXT,
    xp INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_user_xp_once ON user_xp_events(user_id, event_type, ref_id);
  CREATE TABLE IF NOT EXISTS user_badges (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_key TEXT NOT NULL,
    earned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (user_id, badge_key)
  );
`);

// Beta tester program: reader bug reports + feature ideas (private: submitter + admin only).
// Runs every boot; IF NOT EXISTS keeps it safe on the persistent Railway volume.
db.exec(`
  CREATE TABLE IF NOT EXISTS beta_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    page_url TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_beta_feedback_user ON beta_feedback(user_id);
  CREATE INDEX IF NOT EXISTS idx_beta_feedback_status ON beta_feedback(status);
`);
// Weekend Lab polls: Thursday-night vote on weekend activities (votes are private).
// Runs every boot; IF NOT EXISTS keeps it safe on the persistent Railway volume.
db.exec(`
  CREATE TABLE IF NOT EXISTS polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    opens_at TEXT NOT NULL,
    closes_at TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE IF NOT EXISTS poll_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🧪',
    article_id TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE IF NOT EXISTS poll_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (user_id, poll_id, option_id)
  );
  CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id);
  CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
  CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON poll_votes(option_id);
  CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON poll_votes(user_id);
`);
// Beta tester flag: everyone is a beta tester while the site is in beta.
// DEFAULT 1 backfills existing rows on ALTER; new signups get it automatically.
_addColumnIfMissing('users', 'is_beta_tester', "INTEGER NOT NULL DEFAULT 1");
// Founding Tester badge state: 'pending' until the official launch, then 'awarded'.
_addColumnIfMissing('users', 'founding_badge', "TEXT NOT NULL DEFAULT 'pending'");

db.exec(`
  -- Daily news quiz (feature: 5 questions from the day's editions)
  CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,             -- 'quiz:2026-10-02'
    quiz_date TEXT NOT NULL,          -- '2026-10-02'
    questions TEXT NOT NULL,          -- JSON [{q, choices[4], answer, article_id, channel}]
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    kid_id INTEGER NOT NULL REFERENCES kid_profiles(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    answers TEXT NOT NULL,            -- JSON [chosenIdx...]
    xp_awarded INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (quiz_id, kid_id)
  );
  -- Ask the Correspondent: moderated kid questions + answers
  CREATE TABLE IF NOT EXISTS correspondent_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kid_id INTEGER REFERENCES kid_profiles(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    question TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending|approved|rejected|answered
    answer TEXT,
    answered_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_questions_status ON correspondent_questions(status, channel);
  -- Web push subscriptions for edition drop alerts
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  -- Teacher assignments: articles assigned to classrooms + read tracking
  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    article_id TEXT NOT NULL,
    article_title TEXT NOT NULL,
    due_at TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE IF NOT EXISTS assignment_reads (
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    kid_id INTEGER NOT NULL REFERENCES kid_profiles(id) ON DELETE CASCADE,
    read_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (assignment_id, kid_id)
  );
`);


// ---------- Prepared statements ----------
const stmts = {
  createUser: db.prepare(`
    INSERT INTO users (email, display_name, password_hash, avatar_color, role)
    VALUES (?, ?, ?, ?, ?)
  `),
  findUserByEmail: db.prepare(`SELECT * FROM users WHERE lower(email) = lower(?)`),
  findUserById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  updateLastLogin: db.prepare(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`),
  updateUser: db.prepare(`
    UPDATE users
       SET display_name       = COALESCE(?, display_name),
           avatar_color       = COALESCE(?, avatar_color),
           correspondent_style = COALESCE(?, correspondent_style)
     WHERE id = ?
  `),
  changePassword: db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`),

  createKid: db.prepare(`
    INSERT INTO kid_profiles (user_id, name, birth_year, avatar_color, avatar_emoji, correspondent_style)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  listKids: db.prepare(`SELECT * FROM kid_profiles WHERE user_id = ? ORDER BY id ASC`),
  findKid: db.prepare(`SELECT * FROM kid_profiles WHERE id = ? AND user_id = ?`),
  // Gamification v1
  insertXp: db.prepare(`
    INSERT OR IGNORE INTO kid_xp_events (kid_id, event_type, article_id, article_cat, xp)
    VALUES (?, ?, ?, ?, ?)
  `),
  sumXp: db.prepare(`SELECT COALESCE(SUM(xp), 0) AS xp FROM kid_xp_events WHERE kid_id = ?`),
  storyCount: db.prepare(`SELECT COUNT(*) AS n FROM kid_xp_events WHERE kid_id = ? AND event_type = 'story'`),
  channelStoryCount: db.prepare(`SELECT COUNT(*) AS n FROM kid_xp_events WHERE kid_id = ? AND event_type = 'story' AND article_cat = ?`),
  articleSteps: db.prepare(`SELECT COUNT(DISTINCT event_type) AS n FROM kid_xp_events WHERE kid_id = ? AND article_id = ?`),
  kidArticleEvents: db.prepare(`SELECT event_type FROM kid_xp_events WHERE kid_id = ? AND article_id = ?`),
  storyDays: db.prepare(`SELECT DISTINCT date(created_at) AS d FROM kid_xp_events WHERE kid_id = ? AND event_type = 'story' ORDER BY d DESC`),
  kidBadges: db.prepare(`SELECT badge_key FROM kid_badges WHERE kid_id = ?`),
  insertBadge: db.prepare(`INSERT OR IGNORE INTO kid_badges (kid_id, badge_key) VALUES (?, ?)`),
  // Classrooms
  createClassroom: db.prepare(`INSERT INTO classrooms (user_id, name) VALUES (?, ?)`),
  listClassrooms: db.prepare(`SELECT * FROM classrooms WHERE user_id = ? ORDER BY created_at DESC`),
  findClassroom: db.prepare(`SELECT * FROM classrooms WHERE id = ? AND user_id = ?`),
  renameClassroom: db.prepare(`UPDATE classrooms SET name = ? WHERE id = ? AND user_id = ?`),
  deleteClassroom: db.prepare(`DELETE FROM classrooms WHERE id = ? AND user_id = ?`),
  addClassStudent: db.prepare(`INSERT OR IGNORE INTO classroom_students (classroom_id, kid_id) VALUES (?, ?)`),
  removeClassStudent: db.prepare(`DELETE FROM classroom_students WHERE classroom_id = ? AND kid_id = ?`),
  listClassStudents: db.prepare(`
    SELECT k.* FROM kid_profiles k
    JOIN classroom_students cs ON cs.kid_id = k.id
    WHERE cs.classroom_id = ? ORDER BY k.id ASC`),
  kidClassrooms: db.prepare(`
    SELECT c.* FROM classrooms c
    JOIN classroom_students cs ON cs.classroom_id = c.id
    WHERE cs.kid_id = ? ORDER BY c.created_at DESC`),
  studentInClassroom: db.prepare(`SELECT 1 FROM classroom_students WHERE classroom_id = ? AND kid_id = ?`),
  // Daily quiz
  upsertQuiz: db.prepare(`
    INSERT INTO quizzes (id, quiz_date, questions) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET quiz_date = excluded.quiz_date, questions = excluded.questions`),
  findQuizById: db.prepare(`SELECT * FROM quizzes WHERE id = ?`),
  latestQuiz: db.prepare(`SELECT * FROM quizzes ORDER BY quiz_date DESC LIMIT 1`),
  findQuizAttempt: db.prepare(`SELECT * FROM quiz_attempts WHERE quiz_id = ? AND kid_id = ?`),
  insertQuizAttempt: db.prepare(`
    INSERT INTO quiz_attempts (quiz_id, kid_id, score, total, answers, xp_awarded)
    VALUES (?, ?, ?, ?, ?, ?)`),
  quizClassBoard: db.prepare(`
    SELECT k.id AS kid_id, k.name, k.avatar_emoji, k.avatar_color,
           qa.score, qa.total, qa.xp_awarded, qa.created_at AS attempted_at
    FROM kid_profiles k
    JOIN classroom_students cs ON cs.kid_id = k.id
    LEFT JOIN quiz_attempts qa ON qa.kid_id = k.id AND qa.quiz_id = ?
    WHERE cs.classroom_id = ?
    ORDER BY qa.score DESC NULLS LAST, k.name ASC`),
  // Ask the Correspondent
  insertQuestion: db.prepare(`
    INSERT INTO correspondent_questions (kid_id, user_id, channel, question)
    VALUES (?, ?, ?, ?)`),
  countPendingQuestions: db.prepare(`
    SELECT COUNT(*) AS n FROM correspondent_questions
    WHERE kid_id = ? AND status IN ('pending','approved')`),
  listQuestionsByStatus: db.prepare(`
    SELECT q.*, k.name AS kid_name FROM correspondent_questions q
    LEFT JOIN kid_profiles k ON k.id = q.kid_id
    WHERE (? IS NULL OR q.status = ?) AND (? IS NULL OR q.channel = ?)
    ORDER BY q.created_at DESC LIMIT 200`),
  listAnsweredByChannel: db.prepare(`
    SELECT q.id, q.channel, q.question, q.answer, q.answered_at, q.created_at, q.kid_id, k.name AS kid_name
    FROM correspondent_questions q
    LEFT JOIN kid_profiles k ON k.id = q.kid_id
    WHERE q.channel = ? AND q.status = 'answered'
    ORDER BY q.answered_at DESC LIMIT 50`),
  pendingAnswerQuestions: db.prepare(`
    SELECT q.*, k.name AS kid_name FROM correspondent_questions q
    LEFT JOIN kid_profiles k ON k.id = q.kid_id
    WHERE q.status = 'approved' AND q.answer IS NULL
    ORDER BY q.created_at ASC LIMIT 50`),
  updateQuestionStatus: db.prepare(`UPDATE correspondent_questions SET status = ? WHERE id = ?`),
  answerQuestion: db.prepare(`
    UPDATE correspondent_questions SET answer = ?, answered_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), status = 'answered' WHERE id = ?`),
  // Web push
  upsertPushSub: db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`),
  deletePushSub: db.prepare(`DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`),
  deletePushSubByEndpoint: db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`),
  listPushSubs: db.prepare(`SELECT endpoint, p256dh, auth FROM push_subscriptions`),
  // Teacher assignments
  insertAssignment: db.prepare(`
    INSERT INTO assignments (teacher_user_id, classroom_id, article_id, article_title, due_at, note)
    VALUES (?, ?, ?, ?, ?, ?)`),
  findAssignment: db.prepare(`SELECT * FROM assignments WHERE id = ?`),
  deleteAssignment: db.prepare(`DELETE FROM assignments WHERE id = ?`),
  listAssignments: db.prepare(`SELECT * FROM assignments WHERE classroom_id = ? ORDER BY created_at DESC`),
  assignmentReads: db.prepare(`SELECT kid_id FROM assignment_reads WHERE assignment_id = ?`),
  assignmentsForKid: db.prepare(`
    SELECT a.id FROM assignments a
    JOIN classroom_students cs ON cs.classroom_id = a.classroom_id
    WHERE cs.kid_id = ? AND a.article_id = ?`),
  insertAssignmentRead: db.prepare(`
    INSERT OR IGNORE INTO assignment_reads (assignment_id, kid_id) VALUES (?, ?)`),
  // Discussions
  createDiscussion: db.prepare(`
    INSERT INTO discussions (classroom_id, user_id, title, article_id, article_cat, topic)
    VALUES (?, ?, ?, ?, ?, ?)`),
  listDiscussions: db.prepare(`SELECT * FROM discussions WHERE classroom_id = ? ORDER BY created_at DESC`),
  findDiscussion: db.prepare(`SELECT * FROM discussions WHERE id = ?`),
  deleteDiscussion: db.prepare(`DELETE FROM discussions WHERE id = ? AND user_id = ?`),
  createReply: db.prepare(`INSERT INTO discussion_replies (discussion_id, author_kid_id, body) VALUES (?, ?, ?)`),
  listReplies: db.prepare(`
    SELECT r.*, k.name AS kid_name, k.avatar_emoji AS kid_emoji, k.avatar_color AS kid_color
    FROM discussion_replies r LEFT JOIN kid_profiles k ON k.id = r.author_kid_id
    WHERE r.discussion_id = ? ORDER BY r.created_at ASC`),
  findReply: db.prepare(`SELECT * FROM discussion_replies WHERE id = ?`),
  deleteReply: db.prepare(`DELETE FROM discussion_replies WHERE id = ?`),
  countReplies: db.prepare(`SELECT COUNT(*) AS n FROM discussion_replies WHERE discussion_id = ?`),
  // Grown-up XP
  insertUserXp: db.prepare(`INSERT OR IGNORE INTO user_xp_events (user_id, event_type, ref_id, xp) VALUES (?, ?, ?, ?)`),
  sumUserXp: db.prepare(`SELECT COALESCE(SUM(xp), 0) AS xp FROM user_xp_events WHERE user_id = ?`),
  userBadges: db.prepare(`SELECT badge_key FROM user_badges WHERE user_id = ?`),
  insertUserBadge: db.prepare(`INSERT OR IGNORE INTO user_badges (user_id, badge_key) VALUES (?, ?)`),
  // Beta feedback
  createFeedback: db.prepare(`
    INSERT INTO beta_feedback (user_id, type, title, body, page_url)
    VALUES (?, ?, ?, ?, ?)`),
  listFeedbackByUser: db.prepare(`
    SELECT * FROM beta_feedback WHERE user_id = ? ORDER BY id DESC`),
  findFeedbackById: db.prepare(`SELECT * FROM beta_feedback WHERE id = ?`),
  listFeedbackAll: db.prepare(`
    SELECT f.*, u.display_name AS submitter_name, u.email AS submitter_email
    FROM beta_feedback f LEFT JOIN users u ON u.id = f.user_id
    ORDER BY f.id DESC LIMIT ? OFFSET ?`),
  listFeedbackFiltered: db.prepare(`
    SELECT f.*, u.display_name AS submitter_name, u.email AS submitter_email
    FROM beta_feedback f LEFT JOIN users u ON u.id = f.user_id
    WHERE (? IS NULL OR f.type = ?) AND (? IS NULL OR f.status = ?)
    ORDER BY f.id DESC LIMIT ? OFFSET ?`),
  countFeedbackFiltered: db.prepare(`
    SELECT COUNT(*) AS n FROM beta_feedback f
    WHERE (? IS NULL OR f.type = ?) AND (? IS NULL OR f.status = ?)`),
  countFeedbackNew: db.prepare(`SELECT COUNT(*) AS n FROM beta_feedback WHERE status = 'new'`),
  updateFeedbackStatus: db.prepare(`UPDATE beta_feedback SET status = ? WHERE id = ?`),
  // Weekend Lab polls
  createPoll: db.prepare(`INSERT INTO polls (title, opens_at, closes_at, status) VALUES (?, ?, ?, 'open')`),
  addPollOption: db.prepare(`INSERT INTO poll_options (poll_id, label, description, emoji, article_id) VALUES (?, ?, ?, ?, ?)`),
  findOpenPoll: db.prepare(`SELECT * FROM polls WHERE status = 'open' ORDER BY id DESC LIMIT 1`),
  findLatestClosedPoll: db.prepare(`SELECT * FROM polls WHERE status = 'closed' ORDER BY id DESC LIMIT 1`),
  findPollById: db.prepare(`SELECT * FROM polls WHERE id = ?`),
  listPollOptions: db.prepare(`SELECT * FROM poll_options WHERE poll_id = ? ORDER BY id ASC`),
  closePollStmt: db.prepare(`UPDATE polls SET status = 'closed' WHERE id = ?`),
  countVotesByOption: db.prepare(`SELECT option_id, COUNT(*) AS n FROM poll_votes WHERE poll_id = ? GROUP BY option_id`),
  countUserVotes: db.prepare(`SELECT COUNT(*) AS n FROM poll_votes WHERE poll_id = ? AND user_id = ?`),
  listUserVotedOptions: db.prepare(`SELECT option_id FROM poll_votes WHERE poll_id = ? AND user_id = ?`),
  deleteUserVotes: db.prepare(`DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ?`),
  insertVote: db.prepare(`INSERT OR IGNORE INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)`),
  optionBelongsToPoll: db.prepare(`SELECT id FROM poll_options WHERE id = ? AND poll_id = ?`),
  updateKid: db.prepare(`
    UPDATE kid_profiles
       SET name               = COALESCE(?, name),
           birth_year         = COALESCE(?, birth_year),
           avatar_color       = COALESCE(?, avatar_color),
           avatar_emoji       = COALESCE(?, avatar_emoji),
           correspondent_style = COALESCE(?, correspondent_style)
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
    INSERT INTO staff (slug, kind, display_name, role, channel, byline, avatar_emoji, accent_color, status, bio, prompt_path, linked_user_id, kid_bio, fun_fact, portrait_human, portrait_animal, portrait_skynet)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      kid_bio      = COALESCE(?, kid_bio),
      fun_fact     = COALESCE(?, fun_fact),
      portrait_human = COALESCE(?, portrait_human),
      portrait_animal = COALESCE(?, portrait_animal),
      portrait_skynet = COALESCE(?, portrait_skynet),
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
    INSERT INTO queued_stories (staff_id, channel, payload, status, submission_id, publish_at, edition)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  updateQueuedStory: db.prepare(`
    UPDATE queued_stories SET
      status = COALESCE(?, status),
      editor_notes = COALESCE(?, editor_notes),
      payload = COALESCE(?, payload),
      published_article_id = COALESCE(?, published_article_id),
      published_at = COALESCE(?, published_at),
      publish_at = CASE WHEN ? = '__clear__' THEN NULL ELSE COALESCE(?, publish_at) END,
      edition = COALESCE(?, edition),
      updated_at = datetime('now')
    WHERE id = ?
  `),
  findQueuedStory: db.prepare(`SELECT * FROM queued_stories WHERE id = ?`),
  listQueuedStories: db.prepare(`SELECT * FROM queued_stories ORDER BY id DESC LIMIT ? OFFSET ?`),
  listQueuedByStatus: db.prepare(`SELECT * FROM queued_stories WHERE status = ? ORDER BY id DESC LIMIT ? OFFSET ?`),
  deleteQueuedStory: db.prepare(`DELETE FROM queued_stories WHERE id = ?`),
  clearPublishedStories: db.prepare(`DELETE FROM queued_stories WHERE status = 'published'`),
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
  listDueDrafts: db.prepare(`
    SELECT * FROM queued_stories
     WHERE status IN ('draft', 'approved') AND publish_at IS NOT NULL AND publish_at <= ?
     ORDER BY publish_at ASC LIMIT 20
  `),
  listScheduledUpcoming: db.prepare(`
    SELECT * FROM queued_stories
     WHERE status = 'scheduled'
     ORDER BY publish_at ASC LIMIT ? OFFSET ?
  `),

  createSocialDraft: db.prepare(`
    INSERT INTO social_drafts (platform, story_id, story_title, hook, script, caption, hashtags, art_pick, cta, status, drop_key, edition)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateSocialDraft: db.prepare(`
    UPDATE social_drafts SET
      platform = COALESCE(?, platform),
      story_id = COALESCE(?, story_id),
      story_title = COALESCE(?, story_title),
      hook = COALESCE(?, hook),
      script = COALESCE(?, script),
      caption = COALESCE(?, caption),
      hashtags = COALESCE(?, hashtags),
      art_pick = COALESCE(?, art_pick),
      cta = COALESCE(?, cta),
      status = COALESCE(?, status),
      drop_key = COALESCE(?, drop_key),
      edition = COALESCE(?, edition),
      editor_notes = COALESCE(?, editor_notes),
      posted_at = COALESCE(?, posted_at),
      updated_at = datetime('now')
    WHERE id = ?
  `),
  findSocialDraft: db.prepare(`SELECT * FROM social_drafts WHERE id = ?`),
  listSocialDrafts: db.prepare(`SELECT * FROM social_drafts ORDER BY id DESC LIMIT ? OFFSET ?`),
  listSocialDraftsByPlatform: db.prepare(`SELECT * FROM social_drafts WHERE platform = ? ORDER BY id DESC LIMIT ? OFFSET ?`),
  listSocialDraftsByStatus: db.prepare(`SELECT * FROM social_drafts WHERE status = ? ORDER BY id DESC LIMIT ? OFFSET ?`),
  listSocialDraftsByPlatformStatus: db.prepare(`SELECT * FROM social_drafts WHERE platform = ? AND status = ? ORDER BY id DESC LIMIT ? OFFSET ?`),
  deleteSocialDraft: db.prepare(`DELETE FROM social_drafts WHERE id = ?`),
  countSocialDraftsByStatus: db.prepare(`SELECT status, COUNT(*) AS n FROM social_drafts GROUP BY status`),

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

  // ---------- Correspondent story sources ----------
  listSourcesByStaff: db.prepare(`SELECT * FROM agent_sources WHERE staff_id = ? ORDER BY priority ASC, id ASC`),
  listEnabledSourcesByStaff: db.prepare(`SELECT * FROM agent_sources WHERE staff_id = ? AND enabled = 1 ORDER BY priority ASC, id ASC`),
  findSource: db.prepare(`SELECT * FROM agent_sources WHERE id = ?`),
  insertSource: db.prepare(`INSERT INTO agent_sources (staff_id, type, url, query, label, notes, priority, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
  updateSource: db.prepare(`UPDATE agent_sources SET type = COALESCE(?, type), url = ?, query = ?, label = ?, notes = ?, priority = COALESCE(?, priority), enabled = COALESCE(?, enabled), updated_at = datetime('now') WHERE id = ?`),
  deleteSource: db.prepare(`DELETE FROM agent_sources WHERE id = ?`),
  countSourcesByStaff: db.prepare(`SELECT COUNT(*) AS n FROM agent_sources WHERE staff_id = ?`),

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
  countAdmins: db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' OR roles LIKE '%"admin"%'`),
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
    kidBio: row.kid_bio,
    funFact: row.fun_fact,
    portraits: {
      human: row.portrait_human,
      animal: row.portrait_animal,
      skynet: row.portrait_skynet
    },
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

function toPublicSocialDraft(row) {
  if (!row) return null;
  let hashtags = [];
  try { const p = JSON.parse(row.hashtags || '[]'); hashtags = Array.isArray(p) ? p : []; }
  catch { hashtags = []; }
  return {
    id: row.id,
    platform: row.platform,
    storyId: row.story_id,
    storyTitle: row.story_title,
    hook: row.hook,
    script: row.script,
    caption: row.caption,
    hashtags,
    artPick: row.art_pick,
    cta: row.cta,
    status: row.status,
    dropKey: row.drop_key,
    edition: row.edition,
    editorNotes: row.editor_notes,
    postedAt: row.posted_at,
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
// Parse a user's roles into an array. Prefers the roles JSON column,
// falls back to the legacy single role column.
function parseUserRoles(row) {
  if (!row) return [];
  try {
    if (row.roles) {
      const arr = JSON.parse(row.roles);
      if (Array.isArray(arr) && arr.length) return arr.filter(r => typeof r === 'string');
    }
  } catch (e) {}
  return row.role ? [row.role] : [];
}

function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    role: row.role,
    roles: parseUserRoles(row),
    correspondentStyle: row.correspondent_style || 'human',
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    isBetaTester: row.is_beta_tester == null ? true : row.is_beta_tester == 1,
    foundingBadge: row.founding_badge || 'pending',
    bio: row.bio || '',
    degrees: JSON.parse(row.degrees || '[]'),
    awards: JSON.parse(row.awards || '[]'),
    quote: row.quote || '',
    profile_image: row.profile_image || '',
    school: row.school || '',
    subjects: row.subjects || '',
    public_profile: row.public_profile == 1
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
    correspondentStyle: row.correspondent_style || 'human',
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
    roles: parseUserRoles(row),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    adminNotes: row.admin_notes || '',
    kidCount: row.kid_count != null ? row.kid_count : 0
  };
}

// ---------- Gamification v1: Junior Correspondent Program ----------
const GAM_LEVELS = [
  { xp: 0,    name: 'Rookie Reader',       emoji: '🌱' },
  { xp: 100,  name: 'Cub Reporter',        emoji: '📰' },
  { xp: 250,  name: 'Beat Reporter',       emoji: '🎤' },
  { xp: 500,  name: 'Correspondent',       emoji: '🛰️' },
  { xp: 1000, name: 'Senior Correspondent', emoji: '⭐' },
  { xp: 2000, name: 'Editor',              emoji: '✏️' },
  { xp: 4000, name: 'Editor-in-Chief',     emoji: '🏆' },
];
const GAM_XP = { story: 10, kidtake: 5, discuss: 15, glossary: 5, reply: 10, quiz: 25 };
// NOTE: 'quiz' XP is only awarded through POST /api/quiz/attempt with a
// score-scaled xpOverride (5 XP per correct answer, max 25). The generic
// /api/gamification/event endpoint rejects event_type 'quiz' so the value
// cannot be farmed directly.
const GAM_EVENT_TYPES = Object.keys(GAM_XP);
// Grown-up track: parents earn for co-reading, teachers for hosting discussions.
const GAM_USER_XP = { coread: 10, host_discussion: 20, feedback_reviewed: 10 };
const GAM_USER_BADGES = [
  { key: 'first-coread', name: 'Reading Buddy', emoji: '📖', desc: 'Co-read your first story together' },
  { key: 'ten-coreads', name: 'Story Guide', emoji: '📚', desc: 'Co-read 10 stories together' },
  { key: 'discussion-host', name: 'Discussion Leader', emoji: '💬', desc: 'Host your first class discussion' },
];
const GAM_CHANNEL_META = {
  ai:         { label: 'AI',          emoji: '🤖' },
  space:      { label: 'Space',       emoji: '🚀' },
  robotics:   { label: 'Robotics',    emoji: '🦾' },
  biotech:    { label: 'Biotech',     emoji: '🧬' },
  quantum:    { label: 'Quantum',     emoji: '⚛️' },
  climate:    { label: 'Climate',     emoji: '🌍' },
  engineering:{ label: 'Engineering', emoji: '⚙️' },
  math:       { label: 'Math',        emoji: '🔢' },
  cyber:      { label: 'Cyber',       emoji: '🛡️' },
  gaming:     { label: 'Gaming',      emoji: '🎮' },
  music:      { label: 'Music',       emoji: '🎵' },
  stem:       { label: 'STEM',        emoji: '🔬' },
  play:       { label: 'Play',        emoji: '🧸' },
};
function gamBadgeDefs() {
  const defs = [
    { key: 'first-story',       name: 'First Story',  emoji: '📖', desc: 'Finish your first story' },
    { key: 'ten-stories',       name: 'Bookworm',     emoji: '📚', desc: 'Finish 10 stories' },
    { key: 'twentyfive-stories',name: 'News Hound',   emoji: '🗞️', desc: 'Finish 25 stories' },
    { key: 'deep-diver',        name: 'Deep Diver',   emoji: '🤿', desc: 'Do all 4 steps on one story' },
    { key: 'streak-3',          name: 'On a Roll',    emoji: '🔥', desc: 'Read 3 days in a row' },
    { key: 'streak-7',          name: 'Week Warrior', emoji: '🔥', desc: 'Read 7 days in a row' },
    { key: 'streak-30',         name: 'Month Master', emoji: '🏆', desc: 'Read 30 days in a row' },
  ];
  for (const [ch, meta] of Object.entries(GAM_CHANNEL_META)) {
    defs.push({ key: 'explorer-' + ch, name: meta.label + ' Explorer', emoji: meta.emoji, desc: 'Finish 3 ' + meta.label + ' stories' });
  }
  return defs;
}
function gamLevelFor(xp) {
  let idx = 0;
  for (let i = 0; i < GAM_LEVELS.length; i++) if (xp >= GAM_LEVELS[i].xp) idx = i;
  const cur = GAM_LEVELS[idx];
  const next = GAM_LEVELS[idx + 1] || null;
  return {
    index: idx, name: cur.name, emoji: cur.emoji,
    xpForLevel: cur.xp, xpForNext: next ? next.xp : null,
    progress: next ? Math.min(1, (xp - cur.xp) / (next.xp - cur.xp)) : 1,
  };
}
function gamStreak(kidId) {
  const days = stmts.storyDays.all(kidId).map(r => r.d);
  if (!days.length) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const daySet = new Set(days);
  let cursor = daySet.has(today) ? today : null;
  if (!cursor) {
    // Allow yesterday: streak stays alive if the last read was yesterday.
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    if (!daySet.has(y)) return 0;
    cursor = y;
  }
  let streak = 0;
  while (daySet.has(cursor)) {
    streak++;
    cursor = new Date(new Date(cursor + 'T12:00:00Z').getTime() - 864e5).toISOString().slice(0, 10);
  }
  return streak;
}
function gamCheckBadges(kidId, ctx) {
  // ctx: { stories, streak, articleSteps, articleCat }
  const earned = new Set(stmts.kidBadges.all(kidId).map(r => r.badge_key));
  const newly = [];
  const grant = (key) => {
    if (earned.has(key)) return;
    const info = stmts.insertBadge.run(kidId, key);
    if (info.changes > 0) { earned.add(key); newly.push(key); }
  };
  if (ctx.stories >= 1) grant('first-story');
  if (ctx.stories >= 10) grant('ten-stories');
  if (ctx.stories >= 25) grant('twentyfive-stories');
  if (ctx.articleSteps >= 4) grant('deep-diver');
  if (ctx.streak >= 3) grant('streak-3');
  if (ctx.streak >= 7) grant('streak-7');
  if (ctx.streak >= 30) grant('streak-30');
  if (ctx.articleCat && GAM_CHANNEL_META[ctx.articleCat]) {
    const n = stmts.channelStoryCount.get(kidId, ctx.articleCat).n;
    if (n >= 3) grant('explorer-' + ctx.articleCat);
  }
  return newly;
}
function gamStatusFor(kidId, articleId) {
  const xp = stmts.sumXp.get(kidId).xp;
  const stories = stmts.storyCount.get(kidId).n;
  const streak = gamStreak(kidId);
  const level = gamLevelFor(xp);
  const badges = stmts.kidBadges.all(kidId).map(r => r.badge_key);
  const defs = gamBadgeDefs();
  const earned = articleId ? stmts.kidArticleEvents.all(kidId, String(articleId)).map(r => r.event_type) : [];
  return {
    xp, level, streak, stories,
    badges: defs.map(d => ({ ...d, earned: badges.includes(d.key) })),
    badgeCount: badges.length, badgeTotal: defs.length,
    earnedSteps: earned,
  };
}
// Grown-up track: award XP to the account owner (parent co-reading / teacher hosting).
function gamAwardUser({ userId, eventType, refId }) {
  if (!GAM_USER_XP[eventType]) return { error: 'Unknown event type.' };
  const ref = refId != null ? String(refId) : null;
  const before = stmts.sumUserXp.get(userId).xp;
  const beforeLevel = gamLevelFor(before).index;
  const info = stmts.insertUserXp.run(userId, eventType, ref, GAM_USER_XP[eventType]);
  const after = stmts.sumUserXp.get(userId).xp;
  const afterLevel = gamLevelFor(after).index;
  const newBadges = [];
  if (info.changes > 0) {
    const earned = new Set(stmts.userBadges.all(userId).map(r => r.badge_key));
    const grant = (key) => {
      if (earned.has(key)) return;
      const i2 = stmts.insertUserBadge.run(userId, key);
      if (i2.changes > 0) { earned.add(key); newBadges.push(GAM_USER_BADGES.find(b => b.key === key)); }
    };
    const coreads = db.prepare(`SELECT COUNT(*) AS n FROM user_xp_events WHERE user_id = ? AND event_type = 'coread'`).get(userId).n;
    if (eventType === 'coread' && coreads >= 1) grant('first-coread');
    if (eventType === 'coread' && coreads >= 10) grant('ten-coreads');
    if (eventType === 'host_discussion') grant('discussion-host');
  }
  return {
    alreadyEarned: info.changes === 0,
    xpEarned: info.changes > 0 ? GAM_USER_XP[eventType] : 0,
    totalXp: after,
    level: gamLevelFor(after),
    leveledUp: afterLevel > beforeLevel,
    newBadges,
  };
}
function gamUserStatus(userId) {
  const xp = stmts.sumUserXp.get(userId).xp;
  const badges = stmts.userBadges.all(userId).map(r => r.badge_key);
  return {
    xp, level: gamLevelFor(xp),
    badges: GAM_USER_BADGES.map(d => ({ ...d, earned: badges.includes(d.key) })),
    badgeCount: badges.length, badgeTotal: GAM_USER_BADGES.length,
  };
}

// ---------- Exports ----------
// Create chat spaces for existing families/classrooms/users
ensureChatSpaces();

module.exports = {
  db,
  DB_PATH,

  createUser({ email, displayName, passwordHash, avatarColor, role }) {
    const info = stmts.createUser.run(email, displayName, passwordHash, avatarColor, role || 'parent');
    return toPublicUser(stmts.findUserById.get(info.lastInsertRowid));
  },
  findUserByEmail(email) { return stmts.findUserByEmail.get(email); },
  findUserById(id) { return toPublicUser(stmts.findUserById.get(id)); },
  findUserRawById(id) { return stmts.findUserById.get(id); },
  updateLastLogin(id) { stmts.updateLastLogin.run(id); },
  updateUser({ id, displayName, avatarColor, correspondentStyle }) {
    stmts.updateUser.run(displayName ?? null, avatarColor ?? null, correspondentStyle ?? null, id);
    return toPublicUser(stmts.findUserById.get(id));
  },
  changePassword(id, hash) { stmts.changePassword.run(hash, id); },

  createKid({ userId, name, birthYear, avatarColor, avatarEmoji, correspondentStyle }) {
    const info = stmts.createKid.run(userId, name, birthYear, avatarColor, avatarEmoji, correspondentStyle ?? 'human');
    return toPublicKid(stmts.findKid.get(info.lastInsertRowid, userId));
  },
  listKids(userId) { return stmts.listKids.all(userId).map(toPublicKid); },
  findKid(id, userId) { return toPublicKid(stmts.findKid.get(id, userId)); },
  updateKid({ id, userId, name, birthYear, avatarColor, avatarEmoji, correspondentStyle }) {
    stmts.updateKid.run(name ?? null, birthYear ?? null, avatarColor ?? null, avatarEmoji ?? null, correspondentStyle ?? null, id, userId);
    return toPublicKid(stmts.findKid.get(id, userId));
  },

  deleteKid(id, userId) { return stmts.deleteKid.run(id, userId).changes > 0; },

  // ---------- Gamification v1 ----------
  gamLevels: GAM_LEVELS,
  gamXpValues: GAM_XP,
  gamBadgeDefs,
  gamLevelFor,
  gamAward({ kidId, userId, eventType, articleId, articleCat, xpOverride }) {
    if (!GAM_EVENT_TYPES.includes(eventType)) return { error: 'Unknown event type.' };
    const kid = stmts.findKid.get(kidId, userId);
    if (!kid) return { error: 'Kid profile not found.' };
    const artId = articleId != null ? String(articleId) : null;
    const cat = articleCat && GAM_CHANNEL_META[articleCat] ? articleCat : null;
    // xpOverride lets callers (e.g. the quiz grader) scale XP; clamped to the event's max.
    const xp = (typeof xpOverride === 'number' && xpOverride >= 0)
      ? Math.min(Math.floor(xpOverride), GAM_XP[eventType])
      : GAM_XP[eventType];
    const before = stmts.sumXp.get(kidId).xp;
    const beforeLevel = gamLevelFor(before).index;
    const info = stmts.insertXp.run(kidId, eventType, artId, cat, xp);
    const after = stmts.sumXp.get(kidId).xp;
    const afterLevel = gamLevelFor(after).index;
    let newBadges = [];
    let grownUp = null;
    if (info.changes > 0) {
      const stories = stmts.storyCount.get(kidId).n;
      const streak = gamStreak(kidId);
      const articleSteps = artId ? stmts.articleSteps.get(kidId, artId).n : 0;
      newBadges = gamCheckBadges(kidId, { stories, streak, articleSteps, articleCat: cat });
      // Parent co-read: the grown-up earns too when a kid completes "talk together".
      if (eventType === 'discuss' && artId) {
        grownUp = gamAwardUser({ userId, eventType: 'coread', refId: 'kid:' + kidId + ':article:' + artId });
      }
    }
    const defs = gamBadgeDefs();
    return {
      alreadyEarned: info.changes === 0,
      xpEarned: info.changes > 0 ? xp : 0,
      totalXp: after,
      level: gamLevelFor(after),
      leveledUp: afterLevel > beforeLevel,
      newBadges: newBadges.map(k => defs.find(d => d.key === k)),
      grownUp,
      status: gamStatusFor(kidId, artId),
    };
  },
  gamStatus({ kidId, userId, articleId }) {
    const kid = stmts.findKid.get(kidId, userId);
    if (!kid) return { error: 'Kid profile not found.' };
    return { status: gamStatusFor(kidId, articleId != null ? String(articleId) : null) };
  },
  gamAwardUser,
  gamUserStatus(userId) { return { status: gamUserStatus(userId) }; },
  // ---------- Beta feedback ----------
  submitFeedback({ userId, type, title, body, pageUrl }) {
    const t = type === 'idea' ? 'idea' : 'bug';
    const info = stmts.createFeedback.run(
      userId, t,
      String(title).trim().slice(0, 120),
      String(body).trim().slice(0, 4000),
      pageUrl ? String(pageUrl).slice(0, 500) : null
    );
    return stmts.findFeedbackById.get(info.lastInsertRowid);
  },
  getMyFeedback(userId) {
    return stmts.listFeedbackByUser.all(userId);
  },
  listFeedbackAdmin({ type = null, status = null, limit = 100, offset = 0 } = {}) {
    const t = (type === 'bug' || type === 'idea') ? type : null;
    const s = (status === 'new' || status === 'reviewed' || status === 'resolved') ? status : null;
    return {
      items: stmts.listFeedbackFiltered.all(t, t, s, s, limit, offset),
      total: stmts.countFeedbackFiltered.get(t, t, s, s).n,
      newCount: stmts.countFeedbackNew.get().n,
    };
  },
  setFeedbackStatus(id, status) {
    const s = (status === 'reviewed' || status === 'resolved') ? status : 'new';
    const fb = stmts.findFeedbackById.get(id);
    if (!fb) return null;
    const was = fb.status;
    stmts.updateFeedbackStatus.run(s, id);
    let xpAward = null;
    // +10 XP when an admin first marks it reviewed (deduped per feedback id).
    if (s === 'reviewed' && was !== 'reviewed') {
      xpAward = gamAwardUser({ userId: fb.user_id, eventType: 'feedback_reviewed', refId: 'feedback:' + id });
    }
    return { feedback: stmts.findFeedbackById.get(id), xpAward };
  },
  countNewFeedback() { return stmts.countFeedbackNew.get().n; },

  // ---------- Weekend Lab polls ----------
  createPollWithOptions({ title, opensAt, closesAt, options }) {
    const info = stmts.createPoll.run(
      String(title).trim().slice(0, 120),
      opensAt, closesAt
    );
    const pollId = info.lastInsertRowid;
    for (const o of options) {
      stmts.addPollOption.run(
        pollId,
        String(o.label || '').trim().slice(0, 80),
        String(o.description || '').trim().slice(0, 500),
        String(o.emoji || '🧪').slice(0, 8),
        o.articleId ? String(o.articleId).slice(0, 200) : null
      );
    }
    return stmts.findPollById.get(pollId);
  },
  getPollWithOptions(pollId) {
    const poll = stmts.findPollById.get(pollId);
    if (!poll) return null;
    const options = stmts.listPollOptions.all(pollId);
    const counts = {};
    for (const c of stmts.countVotesByOption.all(pollId)) counts[c.option_id] = c.n;
    return { poll, options: options.map(o => ({ ...o, votes: counts[o.id] || 0 })) };
  },
  getCurrentPoll(userId) {
    const poll = stmts.findOpenPoll.get();
    if (!poll) return null;
    const out = this.getPollWithOptions(poll.id);
    out.votedOptionIds = userId ? stmts.listUserVotedOptions.all(poll.id, userId).map(r => r.option_id) : [];
    return out;
  },
  getLatestClosedPoll() {
    const poll = stmts.findLatestClosedPoll.get();
    return poll ? this.getPollWithOptions(poll.id) : null;
  },
  votePoll({ pollId, userId, optionIds }) {
    const poll = stmts.findPollById.get(pollId);
    if (!poll || poll.status !== 'open') return { error: 'This poll is not open for voting.' };
    const valid = [];
    for (const oid of optionIds.slice(0, 3)) {
      const id = Number(oid);
      if (Number.isInteger(id) && stmts.optionBelongsToPoll.get(id, pollId)) valid.push(id);
    }
    if (!valid.length) return { error: 'Pick at least one option.' };
    stmts.deleteUserVotes.run(pollId, userId);
    for (const oid of valid) stmts.insertVote.run(pollId, oid, userId);
    return this.getPollWithOptions(pollId);
  },
  closePoll(pollId) {
    const poll = stmts.findPollById.get(pollId);
    if (!poll) return null;
    stmts.closePollStmt.run(pollId);
    return this.getPollWithOptions(pollId);
  },

  // ---------- Daily news quiz ----------
  saveQuiz(date, questions) {
    const id = 'quiz:' + date;
    stmts.upsertQuiz.run(id, date, JSON.stringify(questions));
    return { id, date, count: questions.length };
  },
  getQuizById(quizId) {
    const row = stmts.findQuizById.get(quizId);
    if (!row) return null;
    return { id: row.id, date: row.quiz_date, questions: JSON.parse(row.questions), createdAt: row.created_at };
  },
  latestQuiz() {
    const row = stmts.latestQuiz.get();
    if (!row) return null;
    return { id: row.id, date: row.quiz_date, questions: JSON.parse(row.questions), createdAt: row.created_at };
  },
  getQuizAttempt(quizId, kidId) {
    return stmts.findQuizAttempt.get(quizId, kidId) || null;
  },
  recordQuizAttempt({ quizId, kidId, userId, score, total, answers, xp }) {
    const kid = stmts.findKid.get(kidId, userId);
    if (!kid) return { error: 'Kid profile not found.' };
    if (stmts.findQuizAttempt.get(quizId, kidId)) return { error: 'Quiz already attempted.' };
    stmts.insertQuizAttempt.run(quizId, kidId, score, total, JSON.stringify(answers), xp);
    return { ok: true };
  },
  quizClassroomBoard({ classroomId, userId, quizId }) {
    const cls = stmts.findClassroom.get(classroomId, userId);
    if (!cls) return { error: 'Classroom not found.' };
    const rows = stmts.quizClassBoard.all(quizId, classroomId);
    return { classroom: { id: cls.id, name: cls.name }, board: rows };
  },

  // ---------- Ask the Correspondent ----------
  askQuestion({ userId, kidId, channel, question }) {
    const ch = String(channel || '').toLowerCase().trim();
    if (!Object.keys(GAM_CHANNEL_META).includes(ch)) return { error: 'Unknown channel.' };
    const kid = stmts.findKid.get(kidId, userId);
    if (!kid) return { error: 'Kid profile not found.' };
    const q = String(question || '').trim().slice(0, 500);
    if (q.length < 3) return { error: 'Question is too short.' };
    const open = stmts.countPendingQuestions.get(kidId).n;
    if (open >= 5) return { error: 'You already have 5 questions waiting. Please wait for answers first.' };
    const info = stmts.insertQuestion.run(kidId, userId, ch, q);
    return { ok: true, id: info.lastInsertRowid };
  },
  listQuestions({ status, channel }) {
    const s = status ? String(status) : null;
    const c = channel ? String(channel).toLowerCase() : null;
    if (s && !['pending', 'approved', 'rejected', 'answered'].includes(s)) return { error: 'Bad status.' };
    return { questions: stmts.listQuestionsByStatus.all(s, s, c, c) };
  },
  answeredQuestions(channel) {
    const ch = String(channel || '').toLowerCase().trim();
    if (!Object.keys(GAM_CHANNEL_META).includes(ch)) return { error: 'Unknown channel.' };
    const rows = stmts.listAnsweredByChannel.all(ch);
    // Public Q&A must never expose a child's name. Show their reader tier instead.
    const questions = rows.map(r => {
      let label = 'a young reader';
      try {
        if (r.kid_id) {
          const xp = stmts.sumXp.get(r.kid_id).xp || 0;
          const lvl = gamLevelFor(xp);
          label = `${lvl.emoji} ${lvl.name}`;
        }
      } catch {}
      const { kid_name, kid_id, ...rest } = r;
      return { ...rest, reader_label: label };
    });
    return { questions };
  },
  setQuestionStatus({ id, status }) {
    if (!['approved', 'rejected'].includes(status)) return { error: 'Bad status.' };
    const info = stmts.updateQuestionStatus.run(status, Number(id));
    if (!info.changes) return { error: 'Question not found.' };
    return { ok: true };
  },
  answerQuestion({ id, answer }) {
    const a = String(answer || '').trim().slice(0, 2000);
    if (a.length < 3) return { error: 'Answer is too short.' };
    const info = stmts.answerQuestion.run(a, Number(id));
    if (!info.changes) return { error: 'Question not found.' };
    return { ok: true };
  },
  pendingAnswerQuestions() {
    return { questions: stmts.pendingAnswerQuestions.all() };
  },

  // ---------- Web push ----------
  savePushSubscription({ userId, endpoint, p256dh, auth }) {
    stmts.upsertPushSub.run(userId, endpoint, p256dh, auth);
    return { ok: true };
  },
  removePushSubscription({ userId, endpoint }) {
    stmts.deletePushSub.run(userId, endpoint);
    return { ok: true };
  },
  removePushSubscriptionByEndpoint(endpoint) {
    stmts.deletePushSubByEndpoint.run(endpoint);
    return { ok: true };
  },
  listPushSubscriptions() {
    return stmts.listPushSubs.all();
  },

  // ---------- Teacher assignments ----------
  createAssignment({ teacherUserId, classroomId, articleId, articleTitle, dueAt, note }) {
    const cls = stmts.findClassroom.get(classroomId, teacherUserId);
    if (!cls) return { error: 'Classroom not found.' };
    const info = stmts.insertAssignment.run(
      teacherUserId, classroomId, String(articleId).slice(0, 80),
      String(articleTitle || 'Untitled').slice(0, 200),
      dueAt || null, note ? String(note).slice(0, 500) : null);
    return { ok: true, id: info.lastInsertRowid };
  },
  listAssignments({ teacherUserId, classroomId }) {
    const cls = stmts.findClassroom.get(classroomId, teacherUserId);
    if (!cls) return { error: 'Classroom not found.' };
    const rows = stmts.listAssignments.all(classroomId);
    const students = stmts.listClassStudents.all(classroomId);
    return {
      classroom: { id: cls.id, name: cls.name },
      assignments: rows.map(a => {
        const reads = stmts.assignmentReads.all(a.id).map(r => r.kid_id);
        return {
          id: a.id, article_id: a.article_id, article_title: a.article_title,
          due_at: a.due_at, note: a.note, created_at: a.created_at,
          studentCount: students.length, readCount: reads.length,
          reads: students.map(s => ({
            kid_id: s.id, name: s.name,
            avatar_emoji: s.avatar_emoji, avatar_color: s.avatar_color,
            read: reads.includes(s.id),
          })),
        };
      }),
    };
  },
  deleteAssignment({ teacherUserId, id }) {
    const a = stmts.findAssignment.get(Number(id));
    if (!a || a.teacher_user_id !== teacherUserId) return { error: 'Assignment not found.' };
    stmts.deleteAssignment.run(Number(id));
    return { ok: true };
  },
  trackAssignmentRead({ userId, kidId, articleId }) {
    const kid = stmts.findKid.get(kidId, userId);
    if (!kid) return { error: 'Kid profile not found.' };
    const assigns = stmts.assignmentsForKid.all(kidId, String(articleId));
    let marked = 0;
    for (const a of assigns) {
      const info = stmts.insertAssignmentRead.run(a.id, kidId);
      if (info.changes > 0) marked++;
    }
    return { ok: true, marked };
  },

  // ---------- Classrooms (teachers) ----------
  createClassroom({ userId, name }) {
    const info = stmts.createClassroom.run(userId, String(name || '').slice(0, 80) || 'My Classroom');
    return { id: info.lastInsertRowid, user_id: userId, name: String(name || '').slice(0, 80) || 'My Classroom' };
  },
  listClassrooms(userId) {
    return stmts.listClassrooms.all(userId).map(c => ({
      ...c,
      studentCount: stmts.listClassStudents.all(c.id).length,
      discussionCount: stmts.listDiscussions.all(c.id).length,
    }));
  },
  findClassroom({ id, userId }) { return stmts.findClassroom.get(id, userId) || null; },
  renameClassroom({ id, userId, name }) {
    stmts.renameClassroom.run(String(name || '').slice(0, 80), id, userId);
    return stmts.findClassroom.get(id, userId) || null;
  },
  deleteClassroom({ id, userId }) { return stmts.deleteClassroom.run(id, userId).changes > 0; },
  addClassStudent({ classroomId, userId, kidId }) {
    const cls = stmts.findClassroom.get(classroomId, userId);
    if (!cls) return { error: 'Classroom not found.' };
    const kid = stmts.findKid.get(kidId, userId);
    if (!kid) return { error: 'Student profile not found.' };
    stmts.addClassStudent.run(classroomId, kidId);
    return { ok: true };
  },
  removeClassStudent({ classroomId, userId, kidId }) {
    const cls = stmts.findClassroom.get(classroomId, userId);
    if (!cls) return { error: 'Classroom not found.' };
    stmts.removeClassStudent.run(classroomId, kidId);
    return { ok: true };
  },
  classroomStudents({ classroomId, userId }) {
    const cls = stmts.findClassroom.get(classroomId, userId);
    if (!cls) return { error: 'Classroom not found.' };
    return { students: stmts.listClassStudents.all(classroomId).map(toPublicKid) };
  },
  classroomProgress({ classroomId, userId }) {
    const cls = stmts.findClassroom.get(classroomId, userId);
    if (!cls) return { error: 'Classroom not found.' };
    const students = stmts.listClassStudents.all(classroomId).map(k => {
      const st = gamStatusFor(k.id, null);
      return { id: k.id, name: k.name, avatarEmoji: k.avatar_emoji, avatarColor: k.avatar_color,
               xp: st.xp, level: st.level, streak: st.streak, stories: st.stories, badgeCount: st.badgeCount };
    });
    return { classroom: cls, students };
  },

  // ---------- Discussions (teacher-led, classroom-style) ----------
  createDiscussion({ userId, classroomId, title, articleId, articleCat, topic }) {
    const cls = stmts.findClassroom.get(classroomId, userId);
    if (!cls) return { error: 'Classroom not found.' };
    const t = String(title || '').slice(0, 140) || 'Class discussion';
    const info = stmts.createDiscussion.run(
      classroomId, userId, t,
      articleId != null ? String(articleId) : null,
      articleCat && GAM_CHANNEL_META[articleCat] ? articleCat : null,
      topic != null ? String(topic).slice(0, 2000) : null);
    const grownUp = gamAwardUser({ userId, eventType: 'host_discussion', refId: 'discussion:' + info.lastInsertRowid });
    return { id: info.lastInsertRowid, grownUp };
  },
  listDiscussions({ userId, classroomId }) {
    const cls = stmts.findClassroom.get(classroomId, userId);
    if (!cls) return { error: 'Classroom not found.' };
    return { discussions: stmts.listDiscussions.all(classroomId).map(d => ({
      ...d, replyCount: stmts.countReplies.get(d.id).n })) };
  },
  discussionsForKid({ userId, kidId }) {
    const kid = stmts.findKid.get(kidId, userId);
    if (!kid) return { error: 'Student profile not found.' };
    const classes = stmts.kidClassrooms.all(kidId);
    const out = [];
    for (const c of classes) {
      for (const d of stmts.listDiscussions.all(c.id)) {
        out.push({ ...d, classroomName: c.name, replyCount: stmts.countReplies.get(d.id).n });
      }
    }
    out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return { discussions: out };
  },
  getDiscussion({ userId, kidId, discussionId }) {
    const d = stmts.findDiscussion.get(discussionId);
    if (!d) return { error: 'Discussion not found.' };
    const cls = stmts.findClassroom.get(d.classroom_id, userId);
    if (!cls) return { error: 'Discussion not found.' };
    if (kidId != null) {
      const inClass = stmts.studentInClassroom.get(d.classroom_id, kidId);
      if (!inClass) return { error: 'Discussion not found.' };
    }
    const replies = stmts.listReplies.all(discussionId).map(r => ({
      id: r.id, body: r.body, created_at: r.created_at,
      author: r.author_kid_id
        ? { type: 'student', name: r.kid_name, emoji: r.kid_emoji, color: r.kid_color }
        : { type: 'teacher' },
    }));
    return { discussion: d, classroom: cls, replies };
  },
  deleteDiscussion({ userId, discussionId }) {
    return stmts.deleteDiscussion.run(discussionId, userId).changes > 0;
  },
  createReply({ userId, kidId, discussionId, body }) {
    const d = stmts.findDiscussion.get(discussionId);
    if (!d) return { error: 'Discussion not found.' };
    const cls = stmts.findClassroom.get(d.classroom_id, userId);
    if (!cls) return { error: 'Discussion not found.' };
    const text = String(body || '').trim().slice(0, 2000);
    if (!text) return { error: 'Reply cannot be empty.' };
    let authorKidId = null;
    if (kidId != null) {
      const kid = stmts.findKid.get(kidId, userId);
      if (!kid) return { error: 'Student profile not found.' };
      const inClass = stmts.studentInClassroom.get(d.classroom_id, kidId);
      if (!inClass) return { error: 'Student is not in this classroom.' };
      authorKidId = kidId;
    }
    const info = stmts.createReply.run(discussionId, authorKidId, text);
    // Students earn XP for joining the discussion (once per discussion).
    let xp = null;
    if (authorKidId != null) {
      const r = stmts.insertXp.run(authorKidId, 'reply', 'discussion:' + discussionId, d.article_cat, GAM_XP.reply);
      if (r.changes > 0) xp = { xpEarned: GAM_XP.reply, totalXp: stmts.sumXp.get(authorKidId).xp, level: gamLevelFor(stmts.sumXp.get(authorKidId).xp) };
    }
    return { id: info.lastInsertRowid, xp };
  },
  deleteReply({ userId, replyId }) {
    const r = stmts.findReply.get(replyId);
    if (!r) return false;
    const d = stmts.findDiscussion.get(r.discussion_id);
    if (!d) return false;
    const cls = stmts.findClassroom.get(d.classroom_id, userId);
    if (!cls) return false;
    return stmts.deleteReply.run(replyId).changes > 0;
  },

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
      input.status ?? 'active', input.bio ?? null, input.promptPath ?? null, input.linkedUserId ?? null,
      input.kidBio ?? null, input.funFact ?? null,
      input.portraitHuman ?? null, input.portraitAnimal ?? null, input.portraitSkynet ?? null
    );
    return toPublicStaff(stmts.findStaffById.get(info.lastInsertRowid));
  },
  updateStaff({ id, displayName, role, byline, avatarEmoji, accentColor, status, bio, promptPath, kidBio, funFact, portraitHuman, portraitAnimal, portraitSkynet }) {
    stmts.updateStaff.run(
      displayName ?? null, role ?? null, byline ?? null, avatarEmoji ?? null,
      accentColor ?? null, status ?? null, bio ?? null, promptPath ?? null,
      kidBio ?? null, funFact ?? null,
      portraitHuman ?? null, portraitAnimal ?? null, portraitSkynet ?? null,
      id
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

  createQueuedStory({ staffId, channel, payload, status = 'draft', submissionId = null, publishAt = null, edition = null }) {
    const info = stmts.createQueuedStory.run(staffId, channel, JSON.stringify(payload), status, submissionId, publishAt, edition);
    return toPublicQueuedStory(stmts.findQueuedStory.get(info.lastInsertRowid));
  },
  // clearDrop=true removes the drop stamp (publish_at -> NULL) so a failed
  // story stops retrying and waits as an ordinary draft for the director.
  updateQueuedStory({ id, status, editorNotes, payload, publishedArticleId, publishedAt, clearDrop = false, edition }) {
    stmts.updateQueuedStory.run(
      status ?? null, editorNotes ?? null,
      payload != null ? JSON.stringify(payload) : null,
      publishedArticleId ?? null, publishedAt ?? null,
      clearDrop ? '__clear__' : null, null,
      edition ?? null, id
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
  deleteQueuedStory(id) {
    return stmts.deleteQueuedStory.run(id).changes;
  },
  clearPublishedStories() {
    return stmts.clearPublishedStories.run().changes;
  },
  scheduleQueuedStory({ id, publishAt, edition = null }) {
    stmts.scheduleQueuedStory.run(publishAt, edition, id);
    return toPublicQueuedStory(stmts.findQueuedStory.get(id));
  },

  createSocialDraft({ platform, storyId = null, storyTitle = null, hook, script, caption = null, hashtags = [], artPick = null, cta = null, status = 'draft', dropKey = null, edition = null }) {
    const info = stmts.createSocialDraft.run(
      platform, storyId, storyTitle, hook, script, caption,
      JSON.stringify(hashtags || []), artPick, cta, status, dropKey, edition
    );
    return toPublicSocialDraft(stmts.findSocialDraft.get(info.lastInsertRowid));
  },
  updateSocialDraft({ id, platform, storyId, storyTitle, hook, script, caption, hashtags, artPick, cta, status, dropKey, edition, editorNotes, postedAt }) {
    stmts.updateSocialDraft.run(
      platform ?? null, storyId ?? null, storyTitle ?? null, hook ?? null, script ?? null,
      caption ?? null, hashtags != null ? JSON.stringify(hashtags) : null,
      artPick ?? null, cta ?? null, status ?? null, dropKey ?? null, edition ?? null,
      editorNotes ?? null, postedAt ?? null, id
    );
    return toPublicSocialDraft(stmts.findSocialDraft.get(id));
  },
  findSocialDraft(id) { return toPublicSocialDraft(stmts.findSocialDraft.get(id)); },
  listSocialDrafts({ platform, status, limit = 50, offset = 0 } = {}) {
    let rows;
    if (platform && status) rows = stmts.listSocialDraftsByPlatformStatus.all(platform, status, limit, offset);
    else if (platform) rows = stmts.listSocialDraftsByPlatform.all(platform, limit, offset);
    else if (status) rows = stmts.listSocialDraftsByStatus.all(status, limit, offset);
    else rows = stmts.listSocialDrafts.all(limit, offset);
    return rows.map(toPublicSocialDraft);
  },
  deleteSocialDraft(id) {
    return stmts.deleteSocialDraft.run(id).changes;
  },
  countSocialDraftsByStatus() {
    const rows = stmts.countSocialDraftsByStatus.all();
    const out = { draft: 0, approved: 0, posted: 0 };
    for (const r of rows) out[r.status] = r.n;
    return out;
  },
  listDueScheduledStories(nowIso) {
    return stmts.listDueScheduled.all(nowIso).map(toPublicQueuedStory);
  },
  listDueDraftStories(nowIso) {
    return stmts.listDueDrafts.all(nowIso).map(toPublicQueuedStory);
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

  // ---------- Correspondent story sources ----------
  listSourcesByStaff(staffId) { return stmts.listSourcesByStaff.all(staffId); },
  listEnabledSourcesByStaff(staffId) { return stmts.listEnabledSourcesByStaff.all(staffId); },
  findSource(id) { return stmts.findSource.get(id); },
  createSource({ staffId, type, url, query, label, notes, priority, enabled }) {
    const info = stmts.insertSource.run(staffId, type, url || null, query || null, label || null, notes || null, priority != null ? priority : 5, enabled != null ? (enabled ? 1 : 0) : 1);
    return stmts.findSource.get(info.lastInsertRowid);
  },
  updateSource({ id, type, url, query, label, notes, priority, enabled }) {
    stmts.updateSource.run(type || null, url !== undefined ? url : null, query !== undefined ? query : null, label !== undefined ? label : null, notes !== undefined ? notes : null, priority !== undefined ? priority : null, enabled !== undefined ? (enabled ? 1 : 0) : null, id);
    return stmts.findSource.get(id);
  },
  deleteSource(id) { return stmts.deleteSource.run(id).changes; },
  countSourcesByStaff(staffId) { return stmts.countSourcesByStaff.get(staffId).n; },

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
    try { db.prepare(`UPDATE users SET roles = ? WHERE id = ?`).run(JSON.stringify([role]), userId); }
    catch (e) {}
    return toPublicUser(stmts.findUserById.get(userId));
  },
  setUserRoles(userId, roles) {
    const clean = [...new Set((roles || []).map(r => String(r).trim()).filter(r => r))];
    if (!clean.length) throw new Error('at least one role required');
    const primary = clean[0];
    stmts.updateUserRole.run(primary, userId);
    try { db.prepare(`UPDATE users SET roles = ? WHERE id = ?`).run(JSON.stringify(clean), userId); }
    catch (e) {}
    return toAdminUser(stmts.findUserById.get(userId));
  },
  getUserRoles(userId) {
    const row = stmts.findUserById.get(userId);
    return parseUserRoles(row);
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
      seed.bio, seed.promptPath, null,
      null, null, null, null, null
    );
  }
}
