// server/plus.js — Moderation, consent, quiet hours, goals, digest, at-risk, matrix, certificates, leaderboard (2026-10-05)

function weekStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d.toISOString().slice(0, 10);
}

function registerPlus(api, requireAuth, requireTeacher) {

  // ---- 1. MODERATION QUEUE ----
  // GET /api/moderation/queue — flagged messages needing review
  api.get('/moderation/queue', requireAuth, (req, res) => {
    try {
      const { db } = require('./db');
      // Admins see all; teachers see their classrooms; parents see their family
      const roles = req.user.roles || [req.user.role];
      const isAdmin = roles.includes('admin');
      let reports;
      if (isAdmin) {
        reports = db.prepare(`SELECT r.*, m.body, m.space_id, cs.name as space_name, cs.type as space_type,
          u.display_name as reporter FROM chat_reports r JOIN chat_messages m ON m.id = r.message_id
          JOIN chat_spaces cs ON cs.id = m.space_id LEFT JOIN users u ON u.id = r.reporter_user_id
          WHERE r.status = 'open' ORDER BY r.created_at DESC LIMIT 100`).all();
      } else {
        // Spaces where user is admin/moderator
        const mySpaces = db.prepare(`SELECT space_id FROM chat_members WHERE user_id = ? AND role IN ('admin','moderator')`).all(req.user.id).map(r => r.space_id);
        if (!mySpaces.length) return res.json({ reports: [] });
        const ph = mySpaces.map(() => '?').join(',');
        reports = db.prepare(`SELECT r.*, m.body, m.space_id, cs.name as space_name, cs.type as space_type,
          u.display_name as reporter FROM chat_reports r JOIN chat_messages m ON m.id = r.message_id
          JOIN chat_spaces cs ON cs.id = m.space_id LEFT JOIN users u ON u.id = r.reporter_user_id
          WHERE r.status = 'open' AND m.space_id IN (${ph}) ORDER BY r.created_at DESC LIMIT 100`).all(...mySpaces);
      }
      res.json({ reports });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  // POST /api/moderation/reports/:id/resolve {action: 'dismiss'|'delete'}
  api.post('/moderation/reports/:id/resolve', requireAuth, (req, res) => {
    try {
      const { db } = require('./db');
      const rep = db.prepare('SELECT * FROM chat_reports WHERE id = ?').get(req.params.id);
      if (!rep) return res.status(404).json({ error: 'not found' });
      const action = req.body.action;
      if (action === 'delete') db.prepare('DELETE FROM chat_messages WHERE id = ?').run(rep.message_id);
      else db.prepare('UPDATE chat_messages SET flagged = 0 WHERE id = ?').run(rep.message_id);
      db.prepare("UPDATE chat_reports SET status = 'resolved' WHERE id = ?").run(rep.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // ---- 2. PARENTAL CONSENT ----
  // POST /api/consent/request — create consent record, send verification email
  api.post('/consent/request', requireAuth, (req, res) => {
    try {
      const { db } = require('./db');
      db.prepare("INSERT INTO parental_consents (user_id, method) VALUES (?, 'email_verify')").run(req.user.id);
      const id = db.prepare('SELECT last_insert_rowid() as id').get().id;
      // Email verification link (Resend when configured)
      try {
        const { sendMail } = require('./mailer');
        const link = `https://skynet-nexus-production.up.railway.app/pages/profile.html?consent=${id}`;
        sendMail({ to: req.user.email, subject: 'Verify your Skynet Nexus parent account',
          text: `Click to verify you are the parent: ${link}`,
          html: `<p>Click to verify your parent account:</p><p><a href="${link}">Verify</a></p>` });
      } catch (e) {}
      res.json({ ok: true, consentId: id });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  // POST /api/consent/verify {consentId}
  api.post('/consent/verify', requireAuth, (req, res) => {
    try {
      const { db } = require('./db');
      const c = db.prepare('SELECT * FROM parental_consents WHERE id = ? AND user_id = ?').get(req.body.consentId, req.user.id);
      if (!c) return res.status(404).json({ error: 'not found' });
      db.prepare("UPDATE parental_consents SET verified = 1, verified_at = datetime('now') WHERE id = ?").run(c.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  // GET /api/consent/status
  api.get('/consent/status', requireAuth, (req, res) => {
    try {
      const { db } = require('./db');
      const c = db.prepare('SELECT * FROM parental_consents WHERE user_id = ? AND verified = 1 ORDER BY verified_at DESC LIMIT 1').get(req.user.id);
      res.json({ verified: !!c, at: c ? c.verified_at : null });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // ---- 3. QUIET HOURS ----
  // Enforced in chat message POST — helper
  api.put('/kids/:id/quiet', requireAuth, (req, res) => {
    try {
      const { db } = require('./db');
      const kid = db.prepare('SELECT id FROM kid_profiles WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!kid) return res.status(404).json({ error: 'not found' });
      const b = req.body || {};
      db.prepare('UPDATE kid_settings SET quiet_enabled = ?, quiet_start = ?, quiet_end = ? WHERE kid_id = ?')
        .run(b.enabled ? 1 : 0, String(b.start || '20:00'), String(b.end || '07:00'), kid.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  api.get('/kids/:id/quiet', requireAuth, (req, res) => {
    try {
      const { db } = require('./db');
      const s = db.prepare('SELECT quiet_enabled, quiet_start, quiet_end FROM kid_settings WHERE kid_id = ?').get(req.params.id);
      res.json({ enabled: s && s.quiet_enabled == 1, start: (s && s.quiet_start) || '20:00', end: (s && s.quiet_end) || '07:00' });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // ---- 5. READING GOALS ----
  api.post('/kids/:id/goals', requireAuth, (req, res) => {
    try {
      const { db } = require('./db');
      const kid = db.prepare('SELECT id FROM kid_profiles WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!kid) return res.status(404).json({ error: 'not found' });
      const target = Math.min(20, Math.max(1, Number(req.body.stories_target) || 3));
      const ws = weekStart();
      db.prepare('INSERT OR REPLACE INTO reading_goals (kid_id, stories_target, week_start, created_by) VALUES (?,?,?,?)')
        .run(kid.id, target, ws, req.user.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed: ' + e.message }); }
  });
  api.get('/kids/:id/goals', requireAuth, (req, res) => {
    try {
      const { db } = require('./db');
      const ws = weekStart();
      const g = db.prepare('SELECT * FROM reading_goals WHERE kid_id = ? AND week_start = ?').get(req.params.id, ws);
      const read = db.prepare(`SELECT COUNT(*) as n FROM kid_xp_events WHERE kid_id = ?
        AND event_type = 'story' AND created_at >= ?`).get(req.params.id, ws).n;
      res.json({ target: g ? g.stories_target : 3, read, weekStart: ws, hasCustom: !!g });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // ---- 4. WEEKLY DIGEST (composer — Resend sends when configured) ----
  api.get('/digest/weekly', requireAuth, (req, res) => {
    try {
      const { db } = require('./db');
      const kids = db.prepare('SELECT * FROM kid_profiles WHERE user_id = ?').all(req.user.id);
      const ws = weekStart();
      const out = kids.map(k => {
        const xp = db.prepare(`SELECT COALESCE(SUM(xp),0) as t FROM kid_xp_events WHERE kid_id = ? AND created_at >= ?`).get(k.id, ws).t;
        const stories = db.prepare(`SELECT COUNT(*) as n FROM kid_xp_events WHERE kid_id = ? AND event_type='story' AND created_at >= ?`).get(k.id, ws).n;
        const quizzes = db.prepare(`SELECT AVG(CAST(score AS FLOAT)/total) as a, COUNT(*) as n FROM quiz_attempts WHERE kid_id = ? AND created_at >= ?`).get(k.id, ws);
        const badges = db.prepare(`SELECT COUNT(*) as n FROM kid_badges WHERE kid_id = ? AND earned_at >= ?`).all(k.id);
        return { name: k.name, xp, stories, quizAvg: quizzes.a ? Math.round(quizzes.a * 100) : null, quizCount: quizzes.n, newBadges: (badges[0] || {}).n || 0 };
      });
      res.json({ weekStart: ws, kids: out });
    } catch (e) { res.json({ weekStart: weekStart(), kids: [], note: 'digest unavailable' }); }
  });

  // ---- 6. AT-RISK STUDENTS ----
  api.get('/classrooms/:id/at-risk', requireAuth, requireTeacher, (req, res) => {
    try {
      const { db } = require('./db');
      const kids = db.prepare(`SELECT k.id, k.name, k.avatar_color FROM classroom_students cs
        JOIN kid_profiles k ON k.id = cs.kid_id WHERE cs.classroom_id = ?`).all(req.params.id);
      const week = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
      const out = kids.map(k => {
        const xp7 = db.prepare(`SELECT COALESCE(SUM(xp),0) as t FROM kid_xp_events WHERE kid_id = ? AND created_at >= ?`).get(k.id, week).t;
        const last = db.prepare(`SELECT MAX(created_at) as l FROM kid_xp_events WHERE kid_id = ?`).get(k.id).l;
        const streak = db.prepare(`SELECT streak FROM kid_streaks WHERE kid_id = ?`).get(k.id);
        const daysIdle = last ? Math.floor((Date.now() - new Date(last).getTime()) / 864e5) : 999;
        const risk = daysIdle >= 7 ? 'high' : daysIdle >= 3 ? 'medium' : xp7 === 0 ? 'medium' : 'low';
        return { id: k.id, name: k.name, avatarColor: k.avatar_color, xp7, daysIdle, streak: (streak || {}).streak || 0, risk };
      }).filter(k => k.risk !== 'low').sort((a, b) => b.daysIdle - a.daysIdle);
      res.json({ atRisk: out });
    } catch (e) { res.status(500).json({ error: 'failed: ' + e.message }); }
  });

  // ---- 7. ASSIGNMENT MATRIX ----
  api.get('/classrooms/:id/matrix', requireAuth, requireTeacher, (req, res) => {
    try {
      const { db } = require('./db');
      const kids = db.prepare(`SELECT k.id, k.name FROM classroom_students cs
        JOIN kid_profiles k ON k.id = cs.kid_id WHERE cs.classroom_id = ? ORDER BY k.name`).all(req.params.id);
      let assignments = [];
      try { assignments = db.prepare('SELECT id, title FROM assignments WHERE classroom_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.id); } catch (e) {}
      const matrix = kids.map(k => {
        const row = { kidId: k.id, name: k.name, cells: [] };
        for (const a of assignments) {
          let done = false;
          try { done = !!db.prepare('SELECT 1 FROM assignment_completions WHERE assignment_id = ? AND kid_id = ?').get(a.id, k.id); } catch (e) {}
          row.cells.push({ assignmentId: a.id, done });
        }
        return row;
      });
      res.json({ assignments: assignments.map(a => ({ id: a.id, title: a.title })), matrix });
    } catch (e) { res.status(500).json({ error: 'failed: ' + e.message }); }
  });

  // ---- 9. FAMILY LEADERBOARD ----
  api.get('/families/leaderboard', requireAuth, (req, res) => {
    try {
      const { db } = require('./db');
      const mem = db.prepare('SELECT family_id FROM family_members WHERE user_id = ?').get(req.user.id);
      if (!mem) return res.json({ board: [] });
      const ws = weekStart();
      const kids = db.prepare(`SELECT k.id, k.name, k.avatar_color, k.avatar_emoji FROM kid_profiles k
        WHERE k.user_id IN (SELECT user_id FROM family_members WHERE family_id = ?)`, ).all(mem.family_id);
      // Actually get kids of all family adults
      const allKids = db.prepare(`SELECT k.id, k.name, k.avatar_color, k.avatar_emoji, k.user_id FROM kid_profiles k
        WHERE k.user_id IN (SELECT user_id FROM family_members WHERE family_id = ?)`).all(mem.family_id);
      const board = allKids.map(k => {
        const xp = db.prepare(`SELECT COALESCE(SUM(xp),0) as t FROM kid_xp_events WHERE kid_id = ? AND created_at >= ?`).get(k.id, ws).t;
        const total = db.prepare(`SELECT COALESCE(SUM(xp),0) as t FROM kid_xp_events WHERE kid_id = ?`).get(k.id).t;
        return { id: k.id, name: k.name, avatarColor: k.avatar_color, avatarEmoji: k.avatar_emoji, weekXp: xp, totalXp: total };
      }).sort((a, b) => b.weekXp - a.weekXp);
      res.json({ board, weekStart: ws });
    } catch (e) { res.status(500).json({ error: 'failed: ' + e.message }); }
  });
}

function isQuietNow(db, kidId) {
  try {
    const s = db.prepare('SELECT quiet_enabled, quiet_start, quiet_end FROM kid_settings WHERE kid_id = ?').get(kidId);
    if (!s || !s.quiet_enabled) return false;
    const now = new Date();
    const cur = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const start = s.quiet_start || '20:00', end = s.quiet_end || '07:00';
    if (start < end) return cur >= start && cur < end;
    return cur >= start || cur < end; // overnight
  } catch (e) { return false; }
}

module.exports = { registerPlus, isQuietNow, weekStart };
