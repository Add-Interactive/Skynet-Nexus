// server/checklist.js
// Beta-tester debug checklist progress tracking.
// Table + routes. Mounted as require('./checklist')(api, { requireAuth })
// in server/index.js. Checklist definition lives at public/data/debug-checklist.json
// so Jeff can edit items without code changes.

const dbm = require('./db');

function getDb() {
  return dbm.db || dbm;
}

function ensureTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS checklist_progress (
      user_id    INTEGER NOT NULL,
      section_id TEXT    NOT NULL,
      item_index INTEGER  NOT NULL,
      completed_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, section_id, item_index)
    );
    CREATE INDEX IF NOT EXISTS idx_checklist_user ON checklist_progress(user_id);
  `);
}
ensureTable();

function completedSet(userId) {
  const db = getDb();
  const rows = db.prepare(
    'SELECT section_id, item_index FROM checklist_progress WHERE user_id = ?'
  ).all(Number(userId));
  const set = {};
  rows.forEach(r => { set[r.section_id + ':' + r.item_index] = true; });
  return set;
}

function loadDefinition() {
  // Read from the repo copy; the route serving /data/ may come from the volume.
  const fs = require('fs');
  const path = require('path');
  const p = path.join(__dirname, '..', 'public', 'data', 'debug-checklist.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return { version: 'unknown', sections: [] }; }
}

module.exports = function checklistRoutes(api, { requireAuth }) {
  // GET /api/checklist — definition + my completed items (auth).
  api.get('/checklist', requireAuth, (req, res) => {
    try {
      const def = loadDefinition();
      res.json({
        version: def.version,
        sections: def.sections,
        completed: completedSet(req.user.id)
      });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // POST /api/checklist/complete { section_id, item_index } — mark done.
  api.post('/checklist/complete', requireAuth, (req, res) => {
    try {
      const sectionId = String((req.body && req.body.section_id) || '').slice(0, 16);
      const itemIndex = Number(req.body && req.body.item_index);
      if (!sectionId || !Number.isInteger(itemIndex) || itemIndex < 0) {
        return res.status(400).json({ error: 'section_id and item_index required' });
      }
      const db = getDb();
      db.prepare(
        "INSERT OR IGNORE INTO checklist_progress (user_id, section_id, item_index) VALUES (?,?,?)"
      ).run(req.user.id, sectionId, itemIndex);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // POST /api/checklist/uncomplete { section_id, item_index } — unmark.
  api.post('/checklist/uncomplete', requireAuth, (req, res) => {
    try {
      const sectionId = String((req.body && req.body.section_id) || '').slice(0, 16);
      const itemIndex = Number(req.body && req.body.item_index);
      if (!sectionId || !Number.isInteger(itemIndex) || itemIndex < 0) {
        return res.status(400).json({ error: 'section_id and item_index required' });
      }
      const db = getDb();
      const r = db.prepare(
        'DELETE FROM checklist_progress WHERE user_id = ? AND section_id = ? AND item_index = ?'
      ).run(req.user.id, sectionId, itemIndex);
      res.json({ ok: true, removed: r.changes > 0 });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });

  // GET /api/checklist/progress — totals + per-section (auth).
  api.get('/checklist/progress', requireAuth, (req, res) => {
    try {
      const def = loadDefinition();
      const done = completedSet(req.user.id);
      let total = 0, completed = 0;
      const bySection = def.sections.map(s => {
        let c = 0;
        s.items.forEach((_, i) => {
          total++;
          if (done[s.id + ':' + i]) { c++; completed++; }
        });
        return { section_id: s.id, title: s.title, total: s.items.length, completed: c };
      });
      const percent = total ? Math.round((completed / total) * 100) : 0;
      res.json({ total, completed, percent, by_section: bySection });
    } catch (e) { res.status(500).json({ error: 'failed' }); }
  });
};
