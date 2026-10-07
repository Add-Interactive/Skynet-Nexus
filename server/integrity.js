// server/integrity.js
// NEXUS SHIELD — file integrity monitoring.
//
// Computes SHA-256 checksums of critical server/frontend files, stores a
// baseline in data/integrity-baseline.json (on the Railway volume, NOT the
// repo), and reports changed/missing files via admin API routes.
//
// The baseline is created automatically on first check. After a legitimate
// deploy, an admin re-baselines via POST /api/admin/security/integrity/rebaseline.
// Integrity violations are logged as security events (type: integrity_violation).

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DATA_DIR } = require('./storage');

// Files under repo ROOT to monitor (relative paths).
const MONITORED_FILES = [
  'server/index.js',
  'server/auth.js',
  'server/db.js',
  'server/admin-routes.js',
  'server/security.js',
  'server/integrity.js',
  'public/pages/admin.html',
  'public/assets/js/admin.js',
  'public/assets/js/app.js',
  'public/assets/js/admin-security-team.js'
];

const BASELINE_PATH = path.join(DATA_DIR, 'integrity-baseline.json');
// Repo root = parent of server/
const REPO_ROOT = path.join(__dirname, '..');

function sha256File(absPath) {
  const data = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function loadBaseline() {
  try {
    const raw = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    if (raw && typeof raw.files === 'object' && raw.files !== null) return raw;
  } catch (e) {}
  return null;
}

function saveBaseline(files) {
  const payload = {
    files,
    createdAt: new Date().toISOString(),
    host: process.env.RAILWAY_STATIC_URL || 'local'
  };
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2));
  return payload;
}

function computeCurrent() {
  const result = {};
  for (const rel of MONITORED_FILES) {
    const abs = path.join(REPO_ROOT, rel);
    try {
      result[rel] = sha256File(abs);
    } catch (e) {
      result[rel] = null; // missing / unreadable
    }
  }
  return result;
}

// Returns { ok, baselineCreated, files: [{path, status}], checkedAt }
function checkIntegrity() {
  let baseline = loadBaseline();
  let baselineCreated = false;
  const current = computeCurrent();
  if (!baseline) {
    baseline = saveBaseline(current);
    baselineCreated = true;
  }
  const files = MONITORED_FILES.map(rel => {
    const expected = baseline.files[rel];
    const actual = current[rel];
    let status;
    if (actual === null) status = 'missing';
    else if (expected === undefined) status = 'new';
    else if (actual !== expected) status = 'changed';
    else status = 'ok';
    return { path: rel, status };
  });
  const ok = files.every(f => f.status === 'ok');
  return { ok, baselineCreated, files, checkedAt: new Date().toISOString() };
}

function rebaseline() {
  const current = computeCurrent();
  const payload = saveBaseline(current);
  return { ok: true, files: MONITORED_FILES.length, createdAt: payload.createdAt };
}

// ---------------------------------------------------------------------------
// Admin API routes (mounted via security.registerSecurityRoutes — the admin
// router already applies requireAdminRole; rebaseline needs full admin).
// ---------------------------------------------------------------------------
function registerIntegrityRoutes(router, ctx) {
  const { requireFullAdmin, logAction } = ctx || {};
  const sec = require('./security');

  // GET /api/admin/security/integrity — checksum comparison vs baseline
  router.get('/security/integrity', (req, res) => {
    try {
      const report = checkIntegrity();
      // Log violations (but not on the very first auto-baseline).
      if (!report.ok && !report.baselineCreated) {
        const bad = report.files.filter(f => f.status !== 'ok');
        sec.logSecurityEvent('integrity_violation', req, {
          count: bad.length,
          files: bad.map(f => f.path + ':' + f.status).slice(0, 20)
        });
      }
      res.json(report);
    } catch (e) {
      res.status(500).json({ error: 'Integrity check failed.' });
    }
  });

  // POST /api/admin/security/integrity/rebaseline — new baseline after deploys
  const guard = requireFullAdmin || ((req, res, next) => next());
  router.post('/security/integrity/rebaseline', guard, (req, res) => {
    try {
      const result = rebaseline();
      sec.logSecurityEvent('integrity_rebaseline', req, { files: result.files });
      try { logAction(req.adminUser.id, 'security.integrity_rebaseline', 'system', 'baseline', {}); } catch (e) {}
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'Re-baseline failed.' });
    }
  });
}

module.exports = {
  MONITORED_FILES,
  checkIntegrity,
  rebaseline,
  registerIntegrityRoutes
};

