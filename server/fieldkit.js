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
    CREATE TABLE IF NOT EXISTS fieldkit_team_missions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      crew_type      TEXT NOT NULL CHECK (crew_type IN ('classroom','family')),
      crew_id        INTEGER NOT NULL,
      mission_key    TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','complete')),
      steps          TEXT NOT NULL,
      started_by_kid INTEGER REFERENCES kid_profiles(id),
      created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      completed_at   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fk_tm_crew ON fieldkit_team_missions(crew_type, crew_id, status);
  `);
  // Phase B: tag columns on shares (guarded — the Phase A table already exists in prod).
  try {
    const cols = db.prepare('PRAGMA table_info(fieldkit_shares)').all().map(c => c.name);
    if (!cols.includes('team_mission_id')) db.exec('ALTER TABLE fieldkit_shares ADD COLUMN team_mission_id INTEGER');
    if (!cols.includes('step_key')) db.exec('ALTER TABLE fieldkit_shares ADD COLUMN step_key TEXT');
  } catch (e) { /* columns will exist on fresh installs via future schema; tagging is best-effort */ }

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

  // ---------------- Phase B: team missions ----------------
  // relay: distinct steps, each completed by a DIFFERENT cadet.
  // census: one step every cadet can take; completes at CENSUS_GOAL cadets.
  const CENSUS_GOAL = 5;
  const TEAM_MISSIONS = {
    'sound-relay': { name: 'Sound Relay', guide: 'Cadence Liu', icon: '🔊', kind: 'relay', mode: 'sound',
      steps: [ { key: 'd1', label: 'Measure the sound at 1 m' }, { key: 'd3', label: 'Measure the same sound at 3 m' }, { key: 'd5', label: 'Measure the same sound at 5 m' } ],
      explain: 'Same sound, three distances. Did loudness fall a little — or a lot — as the crew backed up?' },
    'pendulum-crew': { name: 'Pendulum Crew', guide: 'Gus Delgado', icon: '📐', kind: 'relay', mode: 'motion',
      steps: [ { key: 'short', label: 'Swing SHORT — a small, quick swing' }, { key: 'medium', label: 'Swing MEDIUM' }, { key: 'long', label: 'Swing LONG and slow' } ],
      explain: 'Three swings, three cadets. Whose peak was biggest — and does a bigger swing mean a faster one?' },
    'north-relay': { name: 'North Relay Census', guide: 'Rowan Field', icon: '🧭', kind: 'census', mode: 'compass',
      steps: [ { key: 'north', label: 'Find true north and log your heading at the ★ moment' } ],
      explain: 'Every cadet found north. How wide is the crew spread — and does a figure-eight calibration shrink it?' }
  };
  function freshSteps(def) {
    return def.steps.map(s => def.kind === 'census'
      ? { key: s.key, label: s.label, participants: [] }
      : { key: s.key, label: s.label, kid_id: null, share_id: null, value: null });
  }
  function missionView(row) {
    const def = TEAM_MISSIONS[row.mission_key];
    let steps = [];
    try { steps = JSON.parse(row.steps); } catch (e) {}
    const nameOf = id => { const k = db.prepare('SELECT name FROM kid_profiles WHERE id = ?').get(id); return k ? k.name : 'A cadet'; };
    steps = steps.map(s => {
      if (def && def.kind === 'census') {
        const ps = (s.participants || []).map(pt => ({ ...pt, kid_name: nameOf(pt.kid_id) }));
        const vals = ps.map(pt => pt.value).filter(v => typeof v === 'number');
        return { ...s, participants: ps, count: ps.length, goal: CENSUS_GOAL,
          spread: vals.length > 1 ? Math.round(Math.max(...vals) - Math.min(...vals)) : null };
      }
      return { ...s, kid_name: s.kid_id ? nameOf(s.kid_id) : null };
    });
    return { id: row.id, mission_key: row.mission_key, name: def ? def.name : row.mission_key,
      guide: def ? def.guide : '', icon: def ? def.icon : '🎯', kind: def ? def.kind : 'relay',
      explain: def ? def.explain : '', status: row.status, steps,
      started_by_kid: row.started_by_kid, created_at: row.created_at, completed_at: row.completed_at };
  }
  // Called after a share is created: if it is tagged to a team mission,
  // derive the step completion from the share itself. Clients never
  // assert completion directly.
  function applyTeamStep(shareId, kid, crewType, crewId, mode, value, teamMissionId, stepKey) {
    if (!teamMissionId || !stepKey) return;
    const m = db.prepare('SELECT * FROM fieldkit_team_missions WHERE id = ? AND crew_type = ? AND crew_id = ? AND status = ?')
      .get(teamMissionId, crewType, crewId, 'active');
    if (!m) return;
    const def = TEAM_MISSIONS[m.mission_key];
    if (!def || def.mode !== mode) return;
    let steps; try { steps = JSON.parse(m.steps); } catch (e) { return; }
    const step = steps.find(s => s.key === stepKey);
    if (!step) return;
    if (def.kind === 'census') {
      step.participants = step.participants || [];
      if (step.participants.some(pt => pt.kid_id === kid.id)) return; // one reading per cadet
      step.participants.push({ kid_id: kid.id, share_id: shareId, value: value });
      const done = step.participants.length >= CENSUS_GOAL;
      db.prepare('UPDATE fieldkit_team_missions SET steps = ?, status = ?, completed_at = ? WHERE id = ?')
        .run(JSON.stringify(steps), done ? 'complete' : 'active', done ? new Date().toISOString() : null, m.id);
    } else {
      if (step.kid_id) return;                       // step already claimed
      if (steps.some(s => s.kid_id === kid.id)) return; // relay rule: one step per cadet
      step.kid_id = kid.id; step.share_id = shareId; step.value = value;
      const done = steps.every(s => s.kid_id);
      db.prepare('UPDATE fieldkit_team_missions SET steps = ?, status = ?, completed_at = ? WHERE id = ?')
        .run(JSON.stringify(steps), done ? 'complete' : 'active', done ? new Date().toISOString() : null, m.id);
    }
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
      const teamMissionId = Number.isInteger(Number(b.team_mission_id)) ? Number(b.team_mission_id) : null;
      const stepKey = typeof b.step_key === 'string' ? b.step_key.slice(0, 24) : null;
      const info = db.prepare(
        `INSERT INTO fieldkit_shares (kid_id, crew_type, crew_id, mode, result, value, unit, place_label, team_mission_id, step_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(kid.id, crewType, crewId, mode, result, value, MODES[mode].unit, place, teamMissionId, stepKey);
      applyTeamStep(info.lastInsertRowid, kid, crewType, crewId, mode, value, teamMissionId, stepKey);
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

  // POST /api/fieldkit/team-missions — start a team mission for a crew
  api.post('/fieldkit/team-missions', requireAuth, (req, res) => {
    try {
      const b = req.body || {};
      const kid = getKid(req, b.kid_id);
      if (!kid) return res.status(404).json({ error: 'kid not found' });
      if (!socialAllowed(kid.id)) return res.status(403).json({ error: 'sharing is turned off for this cadet' });
      const crewType = String(b.crew_type || ''), crewId = Number(b.crew_id);
      if (!crewAccess(req, kid, crewType, crewId)) return res.status(403).json({ error: 'not your crew' });
      const def = TEAM_MISSIONS[String(b.mission_key || '')];
      if (!def) return res.status(400).json({ error: 'unknown team mission' });
      const existing = db.prepare('SELECT * FROM fieldkit_team_missions WHERE crew_type = ? AND crew_id = ? AND mission_key = ? AND status = ?')
        .get(crewType, crewId, String(b.mission_key), 'active');
      if (existing) return res.json({ mission: missionView(existing), already: true });
      const info = db.prepare('INSERT INTO fieldkit_team_missions (crew_type, crew_id, mission_key, steps, started_by_kid) VALUES (?, ?, ?, ?, ?)')
        .run(crewType, crewId, String(b.mission_key), JSON.stringify(freshSteps(def)), kid.id);
      const row = db.prepare('SELECT * FROM fieldkit_team_missions WHERE id = ?').get(info.lastInsertRowid);
      res.status(201).json({ mission: missionView(row) });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // GET /api/fieldkit/team-missions?kid_id=&crew_type=&crew_id= — active + latest complete per mission
  api.get('/fieldkit/team-missions', requireAuth, (req, res) => {
    try {
      const kid = getKid(req, req.query.kid_id);
      const crewType = String(req.query.crew_type || ''), crewId = Number(req.query.crew_id);
      if (!crewAccess(req, kid, crewType, crewId)) return res.status(403).json({ error: 'not your crew' });
      const rows = db.prepare('SELECT * FROM fieldkit_team_missions WHERE crew_type = ? AND crew_id = ? ORDER BY id DESC LIMIT 12')
        .all(crewType, crewId);
      res.json({ missions: rows.map(missionView),
        catalog: Object.entries(TEAM_MISSIONS).map(([key, d]) => ({ key, name: d.name, guide: d.guide, icon: d.icon, kind: d.kind, mode: d.mode, explain: d.explain })) });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
}

module.exports = { registerFieldKit };
