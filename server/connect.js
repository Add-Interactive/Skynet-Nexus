// Connect features: PT messaging, announcements, bookmarks, creations, cheers, co-reading, weekly email.
let notifyFn = null;
try { notifyFn = require('./notifications').notify; } catch (e) { /* notifications optional */ }
// Registered after auth middleware in server/index.js.
function registerConnect(api, requireAuth, requireTeacher) {
  const { db } = require('./db');

  // ---------- 1. PARENT-TEACHER MESSAGING ----------
  // GET /api/pt/threads — my threads (as parent or teacher)
  api.get('/pt/threads', requireAuth, (req, res) => {
    try {
      const rows = db.prepare(`SELECT t.*, k.name as kid_name, u.display_name as teacher_name, p.display_name as parent_name,
          (SELECT body FROM chat_messages m JOIN chat_spaces s ON s.id = m.space_id
           WHERE s.type = 'pt' AND s.ref_id = t.id ORDER BY m.id DESC LIMIT 1) as last_msg,
          (SELECT created_at FROM chat_messages m JOIN chat_spaces s ON s.id = m.space_id
           WHERE s.type = 'pt' AND s.ref_id = t.id ORDER BY m.id DESC LIMIT 1) as last_at
        FROM pt_threads t
        LEFT JOIN kid_profiles k ON k.id = t.kid_id
        LEFT JOIN users u ON u.id = t.teacher_user_id
        LEFT JOIN users p ON p.id = t.parent_user_id
        WHERE t.parent_user_id = ? OR t.teacher_user_id = ?
        ORDER BY t.updated_at DESC`).all(req.user.id, req.user.id);
      res.json({ threads: rows });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  // POST /api/pt/threads {kid_id, teacher_user_id, subject}
  api.post('/pt/threads', requireAuth, (req, res) => {
    try {
      const { kid_id, teacher_user_id, subject } = req.body || {};
      // Verify: requester is the kid's parent OR the teacher
      const kid = db.prepare('SELECT user_id, name FROM kid_profiles WHERE id = ?').get(kid_id);
      if (!kid) return res.status(404).json({ error: 'kid not found' });
      const isParent = kid.user_id === req.user.id;
      const isTeacher = Number(teacher_user_id) === req.user.id;
      if (!isParent && !isTeacher) return res.status(403).json({ error: 'not authorized' });
      const parentId = isParent ? req.user.id : kid.user_id;
      const teacherId = isTeacher ? req.user.id : Number(teacher_user_id);
      // Teacher must actually be a teacher
      const t = db.prepare("SELECT id FROM users WHERE id = ? AND (role = 'teacher' OR role = 'admin')").get(teacherId);
      if (!t) return res.status(400).json({ error: 'not a teacher account' });
      let thread = db.prepare('SELECT * FROM pt_threads WHERE kid_id = ? AND teacher_user_id = ?').get(kid_id, teacherId);
      if (!thread) {
        const r = db.prepare(`INSERT INTO pt_threads (kid_id, parent_user_id, teacher_user_id, subject)
          VALUES (?,?,?,?)`).run(kid_id, parentId, teacherId, String(subject || 'About ' + kid.name).slice(0, 120));
        thread = db.prepare('SELECT * FROM pt_threads WHERE id = ?').get(r.lastInsertRowid);
        // Create private chat space
        db.prepare(`INSERT INTO chat_spaces (type, ref_id, name) VALUES ('pt', ?, ?)`)
          .run(thread.id, '💬 ' + kid.name + ' — parent & teacher');
        const sp = db.prepare("SELECT id FROM chat_spaces WHERE type = 'pt' AND ref_id = ?").get(thread.id);
        db.prepare('INSERT OR IGNORE INTO chat_members (space_id, user_id, role) VALUES (?,?,?)').run(sp.id, parentId, 'member');
        db.prepare('INSERT OR IGNORE INTO chat_members (space_id, user_id, role) VALUES (?,?,?)').run(sp.id, teacherId, 'member');
      }
      const sp = db.prepare("SELECT id FROM chat_spaces WHERE type = 'pt' AND ref_id = ?").get(thread.id);
      res.json({ thread, spaceId: sp ? sp.id : null });
    } catch (e) { res.status(500).json({ error: 'failed: ' + e.message }); }
  });
  // GET /api/pt/teachers — teachers of my kids' classrooms (for starting threads)
  api.get('/pt/teachers', requireAuth, (req, res) => {
    try {
      const rows = db.prepare(`SELECT DISTINCT u.id, u.display_name, k.id as kid_id, k.name as kid_name
        FROM classroom_students cm
        JOIN kid_profiles k ON k.id = cm.kid_id AND k.user_id = ?
        JOIN classrooms c ON c.id = cm.classroom_id
        JOIN users u ON u.id = c.user_id`).all(req.user.id);
      res.json({ teachers: rows });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // GET /api/kids/:id/classrooms — classrooms a kid is enrolled in
  api.get('/kids/:id/classrooms', requireAuth, (req, res) => {
    try {
      const k = db.prepare('SELECT id FROM kid_profiles WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!k) return res.status(403).json({ error: 'not your kid' });
      const rows = db.prepare(`SELECT c.id, c.name FROM classroom_students cm
        JOIN classrooms c ON c.id = cm.classroom_id WHERE cm.kid_id = ?`).all(req.params.id);
      res.json({ classrooms: rows });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // ---------- 6. CLASSROOM ANNOUNCEMENTS ----------
  api.get('/classrooms/:id/announcements', requireAuth, (req, res) => {
    try {
      // Must be teacher of class, or parent of enrolled kid
      const cls = db.prepare('SELECT user_id FROM classrooms WHERE id = ?').get(req.params.id);
      if (!cls) return res.status(404).json({ error: 'not found' });
      const okTeacher = cls.user_id === req.user.id;
      const okParent = db.prepare(`SELECT 1 FROM classroom_students cm JOIN kid_profiles k ON k.id = cm.kid_id
        WHERE cm.classroom_id = ? AND k.user_id = ?`).get(req.params.id, req.user.id);
      if (!okTeacher && !okParent) return res.status(403).json({ error: 'not enrolled' });
      const rows = db.prepare(`SELECT a.*, u.display_name as teacher_name FROM announcements a
        LEFT JOIN users u ON u.id = a.teacher_user_id
        WHERE a.classroom_id = ? ORDER BY a.pinned DESC, a.created_at DESC LIMIT 50`).all(req.params.id);
      res.json({ announcements: rows, canPost: okTeacher });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  api.post('/classrooms/:id/announcements', requireAuth, (req, res) => {
    try {
      const cls = db.prepare('SELECT user_id FROM classrooms WHERE id = ?').get(req.params.id);
      if (!cls || cls.user_id !== req.user.id) return res.status(403).json({ error: 'teachers only' });
      const { title, body, pinned } = req.body || {};
      if (!title || !body) return res.status(400).json({ error: 'title and body required' });
      const r = db.prepare(`INSERT INTO announcements (classroom_id, teacher_user_id, title, body, pinned)
        VALUES (?,?,?,?,?)`).run(req.params.id, req.user.id, String(title).slice(0, 120), String(body).slice(0, 2000), pinned ? 1 : 0);
      res.json({ ok: true, id: r.lastInsertRowid });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  api.delete('/announcements/:id', requireAuth, (req, res) => {
    try {
      const a = db.prepare('SELECT teacher_user_id FROM announcements WHERE id = ?').get(req.params.id);
      if (!a || a.teacher_user_id !== req.user.id) return res.status(403).json({ error: 'not yours' });
      db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // ---------- 7. BOOKMARKS / READING LISTS ----------
  api.get('/bookmarks', requireAuth, (req, res) => {
    try {
      const kidId = req.query.kid_id ? Number(req.query.kid_id) : null;
      let rows;
      if (kidId) {
        const k = db.prepare('SELECT id FROM kid_profiles WHERE id = ? AND user_id = ?').get(kidId, req.user.id);
        if (!k) return res.status(403).json({ error: 'not your kid' });
        rows = db.prepare('SELECT * FROM bookmarks WHERE kid_id = ? ORDER BY created_at DESC').all(kidId);
      } else {
        rows = db.prepare('SELECT * FROM bookmarks WHERE user_id = ? AND kid_id IS NULL ORDER BY created_at DESC').all(req.user.id);
      }
      res.json({ bookmarks: rows });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  api.post('/bookmarks', requireAuth, (req, res) => {
    try {
      const { article_slug, shelf, kid_id } = req.body || {};
      if (!article_slug) return res.status(400).json({ error: 'slug required' });
      let kidId = null;
      if (kid_id) {
        const k = db.prepare('SELECT id FROM kid_profiles WHERE id = ? AND user_id = ?').get(kid_id, req.user.id);
        if (!k) return res.status(403).json({ error: 'not your kid' });
        kidId = k.id;
      }
      db.prepare(`INSERT OR IGNORE INTO bookmarks (user_id, kid_id, article_slug, shelf)
        VALUES (?,?,?,?)`).run(req.user.id, kidId, String(article_slug).slice(0, 200), shelf === 'favorites' ? 'favorites' : 'want');
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  api.delete('/bookmarks/:slug', requireAuth, (req, res) => {
    try {
      const kidId = req.query.kid_id ? Number(req.query.kid_id) : null;
      if (kidId) db.prepare('DELETE FROM bookmarks WHERE kid_id = ? AND article_slug = ?').run(kidId, req.params.slug);
      else db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND kid_id IS NULL AND article_slug = ?').run(req.user.id, req.params.slug);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // ---------- 3. KID CREATIONS GALLERY ----------
  // POST /api/creations {kid_id, title, description, image_url} — kid submits, parent auto-approves own kid
  api.post('/creations', requireAuth, (req, res) => {
    try {
      const { kid_id, title, description, image_url } = req.body || {};
      const k = db.prepare('SELECT id, user_id FROM kid_profiles WHERE id = ?').get(kid_id);
      if (!k) return res.status(404).json({ error: 'kid not found' });
      const isParent = k.user_id === req.user.id;
      // Kid submitting for self: allow, status pending (parent approves)
      // Parent submitting for kid: auto-approved
      const status = isParent ? 'approved' : 'pending';
      if (!isParent && req.body.as_kid !== true) {
        // Verify the kid context — for now require parent or explicit kid self-submit flag
        return res.status(403).json({ error: 'parents approve creations' });
      }
      if (!title) return res.status(400).json({ error: 'title required' });
      const r = db.prepare(`INSERT INTO creations (kid_id, title, description, image_url, status)
        VALUES (?,?,?,?,?)`).run(kid_id, String(title).slice(0, 120), String(description || '').slice(0, 1000),
          String(image_url || '').slice(0, 500), status);
      res.json({ ok: true, id: r.lastInsertRowid, status });
    } catch (e) { res.status(500).json({ error: 'failed: ' + e.message }); }
  });
  // GET /api/creations/pending — my kids' pending (parent approval)
  api.get('/creations/pending', requireAuth, (req, res) => {
    try {
      const rows = db.prepare(`SELECT c.*, k.name as kid_name FROM creations c
        JOIN kid_profiles k ON k.id = c.kid_id
        WHERE k.user_id = ? AND c.status = 'pending' ORDER BY c.created_at DESC`).all(req.user.id);
      res.json({ pending: rows });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  // POST /api/creations/:id/approve — parent approves own kid's
  api.post('/creations/:id/approve', requireAuth, (req, res) => {
    try {
      const c = db.prepare(`SELECT c.*, k.user_id FROM creations c JOIN kid_profiles k ON k.id = c.kid_id WHERE c.id = ?`).get(req.params.id);
      if (!c || c.user_id !== req.user.id) return res.status(403).json({ error: 'not your kid' });
      db.prepare("UPDATE creations SET status = 'approved' WHERE id = ?").run(req.params.id);
      if (notifyFn) notifyFn(c.user_id, { kind: 'creation', title: '🎨 Creation approved!', body: 'Your creation is now in the gallery.', link: '/pages/creations.html' });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  api.post('/creations/:id/reject', requireAuth, (req, res) => {
    try {
      const c = db.prepare(`SELECT c.*, k.user_id FROM creations c JOIN kid_profiles k ON k.id = c.kid_id WHERE c.id = ?`).get(req.params.id);
      if (!c || c.user_id !== req.user.id) return res.status(403).json({ error: 'not your kid' });
      db.prepare("UPDATE creations SET status = 'rejected' WHERE id = ?").run(req.params.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  // GET /api/creations/gallery — public approved gallery
  api.get('/creations/gallery', (req, res) => {
    try {
      const rows = db.prepare(`SELECT c.id, c.title, c.description, c.image_url, c.likes, c.created_at,
          k.avatar_emoji, k.avatar_color
        FROM creations c JOIN kid_profiles k ON k.id = c.kid_id
        WHERE c.status = 'approved' ORDER BY c.created_at DESC LIMIT 60`).all();
      // COPPA-safe: no kid names in public gallery — frontend shows avatar + "a young reader"
      res.json({ gallery: rows });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  // POST /api/creations/:id/like
  api.post('/creations/:id/like', requireAuth, (req, res) => {
    try {
      const kidId = req.body && req.body.kid_id ? Number(req.body.kid_id) : null;
      if (kidId) {
        const k = db.prepare('SELECT id FROM kid_profiles WHERE id = ? AND user_id = ?').get(kidId, req.user.id);
        if (!k) return res.status(403).json({ error: 'not your kid' });
      }
      const r = db.prepare('INSERT OR IGNORE INTO creation_likes (creation_id, user_id, kid_id) VALUES (?,?,?)')
        .run(req.params.id, kidId ? null : req.user.id, kidId);
      if (r.changes) db.prepare('UPDATE creations SET likes = likes + 1 WHERE id = ?').run(req.params.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  // GET /api/kids/:id/creations — kid's own
  api.get('/kids/:id/creations', requireAuth, (req, res) => {
    try {
      const k = db.prepare('SELECT id FROM kid_profiles WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
      if (!k) return res.status(403).json({ error: 'not your kid' });
      const rows = db.prepare('SELECT * FROM creations WHERE kid_id = ? ORDER BY created_at DESC').all(req.params.id);
      res.json({ creations: rows });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // ---------- 4. GRANDPARENT VIEW + CHEERS ----------
  const CHEER_TEMPLATES = [
    '🌟 Amazing work, superstar!',
    '🚀 You are reaching for the stars!',
    '🧠 Brilliant thinking!',
    '💪 Keep it up, champ!',
    '🎨 So creative!',
    '📚 Proud of your reading streak!',
    '🏆 You earned that badge!',
    '❤️ Grandma/Grandpa is so proud of you!',
  ];
  api.get('/cheers/templates', (req, res) => res.json({ templates: CHEER_TEMPLATES }));
  // POST /api/cheers {to_kid_id, template}
  api.post('/cheers', requireAuth, (req, res) => {
    try {
      const { to_kid_id, template } = req.body || {};
      if (!CHEER_TEMPLATES.includes(template)) return res.status(400).json({ error: 'pick a template' });
      // Sender must share a family with the kid
      const fam = db.prepare(`SELECT 1 FROM family_members fm1 JOIN family_members fm2 ON fm1.family_id = fm2.family_id
        JOIN kid_profiles k ON k.user_id = fm2.user_id
        WHERE fm1.user_id = ? AND k.id = ?`).get(req.user.id, to_kid_id);
      // Also allow the kid's own parent
      const par = db.prepare('SELECT 1 FROM kid_profiles WHERE id = ? AND user_id = ?').get(to_kid_id, req.user.id);
      if (!fam && !par) return res.status(403).json({ error: 'not family' });
      db.prepare('INSERT INTO cheers (from_user_id, to_kid_id, template) VALUES (?,?,?)').run(req.user.id, to_kid_id, template);
      // Notify the kid's parent
      try {
        const kp = db.prepare('SELECT user_id FROM kid_profiles WHERE id = ?').get(to_kid_id);
        if (kp && notifyFn) notifyFn(kp.user_id, { kind: 'cheer', title: '🎉 Your kid got a cheer!', body: 'Someone sent encouragement.', link: '/pages/family.html' });
      } catch (e) {}
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed: ' + e.message }); }
  });
  // GET /api/family/feed — achievements + cheers across my family
  api.get('/family/feed', requireAuth, (req, res) => {
    try {
      // All kids in my families
      const kids = db.prepare(`SELECT DISTINCT k.id, k.name, k.avatar_emoji, k.avatar_color FROM kid_profiles k
        JOIN family_members fm ON fm.user_id = k.user_id
        WHERE fm.family_id IN (SELECT family_id FROM family_members WHERE user_id = ?)
        ORDER BY k.name`).all(req.user.id);
      const myKids = db.prepare('SELECT id FROM kid_profiles WHERE user_id = ?').all(req.user.id).map(k => k.id);
      kids.forEach(k => { if (!myKids.includes(k.id)) { k.name = String(k.name).split(' ')[0]; } });
      const kidIds = kids.map(k => k.id);
      let cheers = [], badges = [];
      if (kidIds.length) {
        const ph = kidIds.map(() => '?').join(',');
        cheers = db.prepare(`SELECT c.*, u.display_name as from_name, k.name as to_name FROM cheers c
          LEFT JOIN users u ON u.id = c.from_user_id LEFT JOIN kid_profiles k ON k.id = c.to_kid_id
          WHERE c.to_kid_id IN (${ph}) ORDER BY c.created_at DESC LIMIT 30`).all(...kidIds);
        try {
          badges = db.prepare(`SELECT b.*, k.name as kid_name FROM badges b
            JOIN kid_profiles k ON k.id = b.kid_id
            WHERE b.kid_id IN (${ph}) ORDER BY b.earned_at DESC LIMIT 30`).all(...kidIds);
        } catch (e) { /* badges table may differ */ }
      }
      res.json({ kids, cheers, badges });
    } catch (e) { res.status(500).json({ error: 'failed: ' + e.message }); }
  });
  // GET /api/kids/:id/cheers — cheers for one kid
  api.get('/kids/:id/cheers', requireAuth, (req, res) => {
    try {
      const rows = db.prepare(`SELECT c.*, u.display_name as from_name FROM cheers c
        LEFT JOIN users u ON u.id = c.from_user_id WHERE c.to_kid_id = ? ORDER BY c.created_at DESC LIMIT 20`)
        .all(req.params.id);
      res.json({ cheers: rows });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // ---------- 2. CO-READING ----------
  api.post('/coread/start', requireAuth, (req, res) => {
    try {
      const { kid_id, article_slug } = req.body || {};
      const k = db.prepare('SELECT id FROM kid_profiles WHERE id = ? AND user_id = ?').get(kid_id, req.user.id);
      if (!k) return res.status(403).json({ error: 'not your kid' });
      const r = db.prepare(`INSERT INTO coread_sessions (kid_id, parent_user_id, article_slug) VALUES (?,?,?)`)
        .run(kid_id, req.user.id, String(article_slug).slice(0, 200));
      res.json({ ok: true, sessionId: r.lastInsertRowid });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  api.post('/coread/:id/progress', requireAuth, (req, res) => {
    try {
      const s = db.prepare('SELECT * FROM coread_sessions WHERE id = ? AND parent_user_id = ?').get(req.params.id, req.user.id);
      if (!s) return res.status(403).json({ error: 'not yours' });
      const prog = Object.assign(JSON.parse(s.progress || '{}'), req.body.progress || {});
      db.prepare('UPDATE coread_sessions SET progress = ? WHERE id = ?').run(JSON.stringify(prog), s.id);
      if (req.body.completed) db.prepare("UPDATE coread_sessions SET completed = 1, completed_at = datetime('now') WHERE id = ?").run(s.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  api.get('/coread/history', requireAuth, (req, res) => {
    try {
      const rows = db.prepare(`SELECT s.*, k.name as kid_name FROM coread_sessions s
        JOIN kid_profiles k ON k.id = s.kid_id
        WHERE s.parent_user_id = ? ORDER BY s.started_at DESC LIMIT 30`).all(req.user.id);
      res.json({ sessions: rows });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // ---------- 5. WEEKLY EMAIL ----------
  function buildWeeklyEmail(userId) {
    const u = db.prepare('SELECT display_name, email FROM users WHERE id = ?').get(userId);
    const kids = db.prepare('SELECT * FROM kid_profiles WHERE user_id = ?').all(userId);
    let rows = '';
    for (const k of kids) {
      let xp = 0, streak = 0, quizzes = 0;
      try {
        const g = db.prepare('SELECT xp_total FROM gamification WHERE kid_id = ?').get(k.id);
        xp = g ? g.xp_total : 0;
      } catch (e) {}
      try {
        const s = db.prepare('SELECT streak_days FROM kid_streaks WHERE kid_id = ?').get(k.id);
        streak = s ? s.streak_days : 0;
      } catch (e) {}
      rows += `<tr><td style="padding:12px;border-bottom:1px solid #eee"><strong>${escHtml(k.name)}</strong></td>
        <td style="padding:12px;border-bottom:1px solid #eee">${xp} XP</td>
        <td style="padding:12px;border-bottom:1px solid #eee">${streak} day streak</td></tr>`;
    }
    return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h1 style="color:#0B1026">🚀 Your Skynet Nexus Weekly</h1>
      <p>Hi ${escHtml(u.display_name || 'there')}! Here's what your crew was up to this week:</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">${rows || '<tr><td>No kid activity yet.</td></tr>'}</table>
      <p>💡 <strong>Conversation starter:</strong> Ask your kids what surprised them most in the news this week.</p>
      <p style="color:#888;font-size:12px">You're getting this because weekly digest is on. Turn it off in your profile settings.</p>
    </body></html>`;
  }
  function escHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  // GET /api/email/weekly-preview — see it in browser
  api.get('/email/weekly-preview', requireAuth, (req, res) => {
    try { res.send(buildWeeklyEmail(req.user.id)); }
    catch (e) { res.status(500).send('failed'); }
  });
  // POST /api/email/weekly-send — admin/cron trigger
  api.post('/email/weekly-send', requireAuth, async (req, res) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'admin only' });
      const { sendMail, isConfigured } = require('./mailer');
      if (!isConfigured()) return res.status(400).json({ error: 'RESEND_API_KEY not set — connect Resend first' });
      // All users opted into the weekly digest (default on unless explicitly off).
      const users = db.prepare(`
        SELECT u.id, u.email, u.display_name FROM users u
        LEFT JOIN email_prefs p ON p.user_id = u.id
        WHERE (p.weekly_digest_on IS NULL OR p.weekly_digest_on = 1)
          AND u.email IS NOT NULL AND u.email != ''
      `).all();
      let sent = 0, failed = 0, skipped = 0;
      for (const u of users) {
        try {
          const html = buildWeeklyEmail(u.id);
          const r = await sendMail({
            to: u.email,
            subject: 'Your Skynet Nexus Weekly Digest',
            html,
            text: 'Your Skynet Nexus weekly digest is here! Open the full version in your browser.'
          });
          if (r.ok) sent++; else if (r.skipped) skipped++; else failed++;
        } catch (e) { failed++; }
        // Small delay to respect Resend rate limits.
        await new Promise(r => setTimeout(r, 300));
      }
      res.json({ ok: true, sent, failed, skipped, total: users.length });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  // GET/PUT /api/email/prefs
  api.get('/email/prefs', requireAuth, (req, res) => {
    try {
      const p = db.prepare('SELECT weekly_digest_on FROM email_prefs WHERE user_id = ?').get(req.user.id);
      res.json({ weekly_digest_on: p ? !!p.weekly_digest_on : true });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  api.put('/email/prefs', requireAuth, (req, res) => {
    try {
      db.prepare(`INSERT INTO email_prefs (user_id, weekly_digest_on) VALUES (?,?)
        ON CONFLICT(user_id) DO UPDATE SET weekly_digest_on = ?`)
        .run(req.user.id, req.body.weekly_digest_on ? 1 : 0, req.body.weekly_digest_on ? 1 : 0);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
}

module.exports = { registerConnect };
