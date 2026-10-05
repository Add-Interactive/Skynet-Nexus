// server/chat.js — Safe chat system (2026-10-05)
// Invite-only spaces, kid default-deny on public, moderation tools.

const BAD_WORDS = ['fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'cunt', 'nigger', 'faggot', 'whore', 'slut'];
function cleanText(s) {
  let t = String(s || '');
  for (const w of BAD_WORDS) { const re = new RegExp(w, 'gi'); t = t.replace(re, '*'.repeat(w.length)); }
  return t;
}
function getSpace(db, spaceId, userId) {
  return db.prepare(`SELECT cs.*, cm.role FROM chat_spaces cs LEFT JOIN chat_members cm
    ON cm.space_id = cs.id AND cm.user_id = ? WHERE cs.id = ?`).get(userId, spaceId);
}
function canAccessSpace(db, space, userId, kidId) {
  if (!space) return false;
  if (space.type === 'public') {
    if (kidId) {
      const s = db.prepare('SELECT public_chat_allowed FROM kid_settings WHERE kid_id = ?').get(kidId);
      return s && s.public_chat_allowed == 1;
    }
    return true;
  }
  if (kidId) {
    const m = db.prepare('SELECT 1 FROM chat_members WHERE space_id = ? AND kid_id = ?').get(space.id, kidId);
    return !!m;
  }
  return !!space.role;
}
function syncChatMembers(db, spaceType, refId) {
  try {
    const space = db.prepare('SELECT id FROM chat_spaces WHERE type = ? AND ref_id = ?').get(spaceType, refId);
    if (!space) return;
    if (spaceType === 'family') {
      const members = db.prepare('SELECT user_id FROM family_members WHERE family_id = ?').all(refId);
      const creator = db.prepare('SELECT created_by FROM families WHERE id = ?').get(refId);
      for (const m of members) {
        const role = creator && m.user_id === creator.created_by ? 'admin' : 'member';
        db.prepare('INSERT OR IGNORE INTO chat_members (space_id, user_id, role) VALUES (?,?,?)').run(space.id, m.user_id, role);
      }
    } else if (spaceType === 'classroom') {
      const cls = db.prepare('SELECT user_id FROM classrooms WHERE id = ?').get(refId);
      if (cls) db.prepare('INSERT OR IGNORE INTO chat_members (space_id, user_id, role) VALUES (?,?,?)').run(space.id, cls.user_id, 'admin');
      const kids = db.prepare('SELECT kid_id FROM classroom_students WHERE classroom_id = ?').all(refId);
      for (const k of kids) db.prepare('INSERT OR IGNORE INTO chat_members (space_id, kid_id, role) VALUES (?,?,?)').run(space.id, k.kid_id, 'member');
      for (const k of kids) {
        const p = db.prepare('SELECT user_id FROM kid_profiles WHERE id = ?').get(k.kid_id);
        if (p) db.prepare('INSERT OR IGNORE INTO chat_members (space_id, user_id, role) VALUES (?,?,?)').run(space.id, p.user_id, 'moderator');
      }
    }
  } catch (e) { console.warn('[chat] sync:', e.message); }
}

function registerChat(api, requireAuth, requireTeacher) {
  api.get('/chat/spaces', requireAuth, (req, res) => {
    try {
      const { db } = require('./db');
      const kidId = req.query.kid_id ? Number(req.query.kid_id) : null;
      if (kidId) {
        const k = db.prepare('SELECT id FROM kid_profiles WHERE id = ? AND user_id = ?').get(kidId, req.user.id);
        if (!k) return res.status(403).json({ error: 'not your kid' });
      }
      let spaces = db.prepare(`SELECT cs.*, cm.role FROM chat_spaces cs JOIN chat_members cm
        ON cm.space_id = cs.id WHERE (cm.user_id = ? ${kidId ? 'OR cm.kid_id = ?' : ''}) ORDER BY cs.type`)
        .all(...(kidId ? [req.user.id, kidId] : [req.user.id]));
      let showPublic = !kidId;
      if (kidId) {
        const s = db.prepare('SELECT public_chat_allowed FROM kid_settings WHERE kid_id = ?').get(kidId);
        showPublic = s && s.public_chat_allowed == 1;
      }
      if (showPublic) {
        const pub = db.prepare("SELECT * FROM chat_spaces WHERE type = 'public'").get();
        if (pub && !spaces.find(s => s.id === pub.id)) spaces.push(Object.assign({}, pub, { role: 'member' }));
      }
      for (const sp of spaces) {
        const last = db.prepare('SELECT body, created_at FROM chat_messages WHERE space_id = ? ORDER BY id DESC LIMIT 1').get(sp.id);
        sp.preview = last ? last.body.slice(0, 60) : '';
        sp.previewAt = last ? last.created_at : '';
      }
      res.json({ spaces });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  api.get('/chat/spaces/:id/messages', requireAuth, (req, res) => {
    try {
      const { db } = require('./db');
      const kidId = req.query.kid_id ? Number(req.query.kid_id) : null;
      const space = getSpace(db, req.params.id, req.user.id);
      if (!canAccessSpace(db, space, req.user.id, kidId)) return res.status(403).json({ error: 'no access' });
      const msgs = db.prepare(`SELECT m.*, u.display_name as user_name, k.name as kid_name
        FROM chat_messages m LEFT JOIN users u ON u.id = m.user_id LEFT JOIN kid_profiles k ON k.id = m.kid_id
        WHERE m.space_id = ? ORDER BY m.id DESC LIMIT 50`).all(space.id);
      res.json({ messages: msgs.reverse(), myRole: space.role || 'member' });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  api.post('/chat/spaces/:id/messages', requireAuth, (req, res) => {
    try {
      const { db } = require('./db');
      const kidId = req.body.kid_id ? Number(req.body.kid_id) : null;
      if (kidId) {
        const k = db.prepare('SELECT id FROM kid_profiles WHERE id = ? AND user_id = ?').get(kidId, req.user.id);
        if (!k) return res.status(403).json({ error: 'not your kid' });
      }
      const space = getSpace(db, req.params.id, req.user.id);
      if (!canAccessSpace(db, space, req.user.id, kidId)) return res.status(403).json({ error: 'no access' });
      // Quiet hours: kids can't send during quiet time
      if (kidId) {
        try {
          const { isQuietNow } = require('./plus');
          if (isQuietNow(db, kidId)) return res.status(403).json({ error: 'Quiet hours — chat is paused until morning. 🌙' });
        } catch (e) {}
      }
      const body = cleanText((req.body.body || '').trim()).slice(0, 500);
      if (!body) return res.status(400).json({ error: 'empty message' });
      const r = db.prepare('INSERT INTO chat_messages (space_id, user_id, kid_id, body) VALUES (?,?,?,?)')
        .run(space.id, kidId ? null : req.user.id, kidId || null, body);
      res.json({ ok: true, id: r.lastInsertRowid });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  api.delete('/chat/messages/:id', requireAuth, (req, res) => {
    try {
      const { db } = require('./db');
      const msg = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(req.params.id);
      if (!msg) return res.status(404).json({ error: 'not found' });
      const space = getSpace(db, msg.space_id, req.user.id);
      const isMod = space && (space.role === 'admin' || space.role === 'moderator');
      const isOwn = msg.user_id === req.user.id;
      if (!isMod && !isOwn) return res.status(403).json({ error: 'cannot delete' });
      db.prepare('DELETE FROM chat_messages WHERE id = ?').run(msg.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
  api.post('/chat/messages/:id/report', requireAuth, (req, res) => {
    try {
      const { db } = require('./db');
      db.prepare('INSERT INTO chat_reports (message_id, reporter_user_id, reason) VALUES (?,?,?)')
        .run(req.params.id, req.user.id, String(req.body.reason || 'inappropriate').slice(0, 100));
      db.prepare('UPDATE chat_messages SET flagged = 1 WHERE id = ?').run(req.params.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
}

module.exports = { registerChat, syncChatMembers };
