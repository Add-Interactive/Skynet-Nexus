// Field Kit Crew Link — Phase A: crews, scan shares, crew feed.
// Mounted from server/connect.js (same pattern as the consent module).
//
// Design: ~/workspace design doc "Field Kit Crew Link" (2026-10-29, Jeff approved).
// Invariants enforced here:
//  - Crews are EXISTING groups only: a classroom (classroom_students) or a
//    family (family_members). No new social graph, no public surface.
//  - A share payload can only ever contain mode/result/value/unit/place_label.
//    There is deliberately no field for location, audio, or free text.
//  - The acting kid is always verified against the session account
//    (kid_profiles.id + user_id), the same pattern as the other kid endpoints.
//  - Place labels: pick-list, or a short custom label when the shared
//    profanity screen is available; otherwise pick-list only.
//  - A kid whose parent turned off comments/social in kid_settings
//    (comments_enabled = 0) cannot share and sees no crews.

function registerFieldKit(api, requireAuth, requireTeacher) {
  const { db } = require('./db');
  let containsProfanity = null;
  try { containsProfanity = require('./db').containsProfanity || null; } catch (e) { /* pick-list only */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS fieldkit_shares (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      kid_id        INTEGER NOT NULL REFERENCES kid_profiles(id) ON DELETE CASCADE,
      crew_type     TEXT NOT NULL CHECK (crew_type IN ('classroom','family')),
      crew_id       INTEGER NOT NULL,
      mode          TEXT NOT NULL,
      result        TEXT NOT NULL,
      value         REAL,
      unit          TEXT,
      place_label   TEXT,
      experiment_id INTEGER,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_fk_shares_crew ON fieldkit_shares(crew_type, crew_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_fk_shares_kid  ON fieldkit_shares(kid_id, id DESC);
  `);

  const MODES = {
    motion:  { min: 0,   max: 80,  unit: 'm/s²' },
    sound:   { min: -60, max: 0,   unit: 'dBrel' },
    compass: { min: 0,   max: 359, unit: 'deg' },
    astro:   { min: null, max: null, unit: null },
    mission: { min: null, max: null, unit: null }
  };
  const PLACE_LABELS = ['Classroom', 'Cafeteria', 'Gym', 'Library', 'Playground', 'Hallway',
    'Kitchen', 'Bedroom', 'Living room', 'Garden', 'Park', 'Schoolyard', 'Lab', 'Stage', 'Outside', 'Other'];

  function getKid(req, kidId) {
    const id = Number(kidId);
    if (!Number.isInteger(id)) return null;
    return db.prepare('SELECT * FROM kid_profiles WHERE id = ? AND user_id = ?').get(id, req.user.id) || null;
  }
  function socialAllowed(kidId) {
    const s = db.prepare('SELECT comments_enabled FROM kid_settings WHERE kid_id = ?').get(kidId);
    return !s || s.comments_enabled !== 0;
  }
  function kidCrews(kid) {
    const classes = db.prepare(
      `SELECT c.id, c.name, (SELECT COUNT(*) FROM classroom_students x WHERE x.classroom_id = c.id) AS members
         FROM classrooms c JOIN classroom_students cs ON cs.classroom_id = c.id
        WHERE cs.kid_id = ? ORDER BY c.name`).all(kid.id)
      .map(r => ({ type: 'classroom', id: r.id, name: r.name, memberCount: r.members }));
    const fams = db.prepare(
      `SELECT f.id, f.name FROM families f JOIN family_members fm ON fm.family_id = f.id
        WHERE fm.user_id = ? ORDER BY f.name`).all(kid.user_id)
      .map(r => ({
        type: 'family', id: r.id, name: r.name,
        memberCount: db.prepare(
          `SELECT COUNT(*) AS n FROM kid_profiles kp JOIN family_members fm2 ON fm2.user_id = kp.user_id
            WHERE fm2.family_id = ?`).get(r.id).n
      }));
    return classes.concat(fams);
  }
  // Access = the acting kid is in the crew, or the requester teaches the classroom.
  function crewAccess(req, kid, crewType, crewId) {
    if (crewType === 'classroom') {
      if (kid && db.prepare('SELECT 1 FROM classroom_students WHERE classroom_id = ? AND kid_id = ?').get(crewId, kid.id)) return true;
      const c = db.prepare('SELECT user_id FROM classrooms WHERE id = ?').get(crewId);
      return !!(c && c.user_id === req.user.id);
    }
    if (crewType === 'family') {
      return !!(kid && db.prepare('SELECT 1 FROM family_members WHERE family_id = ? AND user_id = ?').get(crewId, kid.user_id));
    }
    return false;
  }

  // Shares rate limit: 10/hour/kid (mirrors the comments rule). In-memory;
  // a restart simply resets the window.
  const shareTimes = new Map();
  function rateOk(kidId) {
    const now = Date.now(), hour = 3600 * 1000;
    const arr = (shareTimes.get(kidId) || []).filter(t => now - t < hour);
    if (arr.length >= 10) return false;
    arr.push(now); shareTimes.set(kidId, arr);
    return true;
  }

  // GET /api/fieldkit/crews?kid_id= — the kid's crews (empty when signed out / no kid / social off)
  api.get('/fieldkit/crews', requireAuth, (req, res) => {
    try {
      const kid = getKid(req, req.query.kid_id);
      if (!kid) return res.status(404).json({ error: 'kid not found' });
      if (!socialAllowed(kid.id)) return res.json({ crews: [], socialOff: true });
      res.json({ crews: kidCrews(kid) });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // POST /api/fieldkit/shares — share one logbook scan with one crew
  api.post('/fieldkit/shares', requireAuth, (req, res) => {
    try {
      const b = req.body || {};
      const kid = getKid(req, b.kid_id);
      if (!kid) return res.status(404).json({ error: 'kid not found' });
      if (!socialAllowed(kid.id)) return res.status(403).json({ error: 'sharing is turned off for this cadet' });
      const crewType = String(b.crew_type || ''), crewId = Number(b.crew_id);
      if (!crewAccess(req, kid, crewType, crewId)) return res.status(403).json({ error: 'not your crew' });
      const mode = String(b.mode || '');
      if (!MODES[mode]) return res.status(400).json({ error: 'unknown scanner mode' });
      const result = String(b.result || '').trim().slice(0, 120);
      if (!result) return res.status(400).json({ error: 'result is required' });
      let value = null;
      if (typeof b.value === 'number' && isFinite(b.value)) {
        const r = MODES[mode];
        if (r.min != null && (b.value < r.min || b.value > r.max)) {
          return res.status(400).json({ error: 'value out of range for this scanner' });
        }
        value = b.value;
      }
      let place = null;
      if (b.place_label != null && String(b.place_label).trim() !== '') {
        place = String(b.place_label).trim().slice(0, 24);
        const listed = PLACE_LABELS.includes(place);
        const screened = containsProfanity && !containsProfanity(place);
        if (!listed && !screened) return res.status(400).json({ error: 'place label not allowed' });
      }
      if (!rateOk(kid.id)) return res.status(429).json({ error: 'sharing limit reached — try again in a bit' });
      const info = db.prepare(
        `INSERT INTO fieldkit_shares (kid_id, crew_type, crew_id, mode, result, value, unit, place_label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(kid.id, crewType, crewId, mode, result, value, MODES[mode].unit, place);
      res.status(201).json({ share: { id: info.lastInsertRowid } });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // GET /api/fieldkit/shares?kid_id=&crew_type=&crew_id= — the crew feed (latest 50)
  api.get('/fieldkit/shares', requireAuth, (req, res) => {
    try {
      const kid = getKid(req, req.query.kid_id);
      const crewType = String(req.query.crew_type || ''), crewId = Number(req.query.crew_id);
      if (!crewAccess(req, kid, crewType, crewId)) return res.status(403).json({ error: 'not your crew' });
      const rows = db.prepare(
        `SELECT s.id, s.kid_id, s.mode, s.result, s.value, s.unit, s.place_label, s.created_at,
                k.name AS kid_name, k.avatar_emoji, k.avatar_color
           FROM fieldkit_shares s JOIN kid_profiles k ON k.id = s.kid_id
          WHERE s.crew_type = ? AND s.crew_id = ?
          ORDER BY s.id DESC LIMIT 50`).all(crewType, crewId);
      res.json({ shares: rows.map(r => ({ ...r, mine: kid ? r.kid_id === kid.id : false })) });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // DELETE /api/fieldkit/shares/:id — the kid's parent, or the classroom's teacher
  api.delete('/fieldkit/shares/:id', requireAuth, (req, res) => {
    try {
      const s = db.prepare('SELECT * FROM fieldkit_shares WHERE id = ?').get(Number(req.params.id));
      if (!s) return res.status(404).json({ error: 'not found' });
      const owner = db.prepare('SELECT user_id FROM kid_profiles WHERE id = ?').get(s.kid_id);
      let allowed = owner && owner.user_id === req.user.id;
      if (!allowed && s.crew_type === 'classroom') {
        const c = db.prepare('SELECT user_id FROM classrooms WHERE id = ?').get(s.crew_id);
        allowed = !!(c && c.user_id === req.user.id);
      }
      if (!allowed) return res.status(403).json({ error: 'not allowed' });
      db.prepare('DELETE FROM fieldkit_shares WHERE id = ?').run(s.id);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
}

module.exports = { registerFieldKit };
