// server/security.js
// NEXUS SHIELD — security event logging, IP blocking, and threat detection.
//
// Logs security-relevant events to the security_events table, maintains a
// persistent IP blocklist (data/blocklist.json on the volume), and exposes
// admin API routes for the 🛡️ Security monitor in the admin console.
//
// Event types:
//   failed_login       bad credentials on /api/auth/login
//   admin_unauthorized non-admin hitting an admin/editor route (403)
//   rate_limit         429 rate-limit hit
//   blocked_ip         request from a blocklisted IP was denied
//   scan_detected      rapid 404s from one IP (probable path scanning)
//   ip_blocked         admin added an IP to the blocklist
//   ip_unblocked       admin removed an IP from the blocklist
//   integrity_violation monitored file changed/missing vs baseline
//   integrity_rebaseline admin saved a new integrity baseline

const path = require('path');
const fs = require('fs');
const { DATA_DIR } = require('./storage');
const integrity = require('./integrity');

// ---------------------------------------------------------------------------
// Client IP
// ---------------------------------------------------------------------------
function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  const ra = req.socket && req.socket.remoteAddress;
  return (ra || 'unknown').toString().trim();
}

// ---------------------------------------------------------------------------
// Persistent IP blocklist (data/blocklist.json on the volume)
// ---------------------------------------------------------------------------
const BLOCKLIST_PATH = path.join(DATA_DIR, 'blocklist.json');
let blocklistCache = null;
let blocklistMtime = 0;

function loadBlocklist() {
  try {
    const st = fs.statSync(BLOCKLIST_PATH);
    if (blocklistCache && st.mtimeMs === blocklistMtime) return blocklistCache;
    const raw = JSON.parse(fs.readFileSync(BLOCKLIST_PATH, 'utf8'));
    blocklistCache = Array.isArray(raw.ips) ? raw.ips : [];
    blocklistMtime = st.mtimeMs;
    return blocklistCache;
  } catch (e) {
    blocklistCache = [];
    return blocklistCache;
  }
}

function saveBlocklist(list) {
  const payload = { ips: list, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(BLOCKLIST_PATH), { recursive: true });
  fs.writeFileSync(BLOCKLIST_PATH, JSON.stringify(payload, null, 2));
  blocklistCache = list;
  try { blocklistMtime = fs.statSync(BLOCKLIST_PATH).mtimeMs; } catch (e) {}
}

function isIpBlocked(ip) {
  if (!ip || ip === 'unknown') return false;
  return loadBlocklist().some(entry => entry.ip === ip);
}

function blockIp(ip, reason, byUserId) {
  const list = loadBlocklist().filter(e => e.ip !== ip);
  list.push({
    ip,
    reason: String(reason || '').slice(0, 200),
    blockedAt: new Date().toISOString(),
    blockedBy: byUserId || null
  });
  saveBlocklist(list);
  return list;
}

function unblockIp(ip) {
  const list = loadBlocklist().filter(e => e.ip !== ip);
  saveBlocklist(list);
  return list;
}

function getBlocklist() {
  return loadBlocklist();
}

// ---------------------------------------------------------------------------
// Security event logging (never throws — must not break request handling)
// ---------------------------------------------------------------------------
function logSecurityEvent(eventType, req, details) {
  try {
    const db = require('./db');
    const ip = req ? getClientIp(req) : null;
    let userId = null;
    try { userId = (req && req.session && req.session.userId) || null; } catch (e) {}
    db.logSecurityEvent({
      eventType: String(eventType || 'unknown').slice(0, 64),
      ip: ip ? String(ip).slice(0, 64) : null,
      userId,
      details: details ? JSON.stringify(details).slice(0, 2000) : null
    });
    // Opportunistic prune: ~1% of events trigger a 30-day cleanup.
    if (Math.random() < 0.01) {
      try { db.pruneSecurityEvents(); } catch (e) {}
    }
  } catch (e) {
    console.warn('[security] event log failed:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Scan detection: rapid 404s on /api/* from a single IP
// ---------------------------------------------------------------------------
const SCAN_TRACKER = new Map(); // ip -> { count, resetAt, reported }
const SCAN_WINDOW_MS = 5 * 60 * 1000;
const SCAN_THRESHOLD = 12;

function trackApiNotFound(req) {
  const ip = getClientIp(req);
  if (!ip || ip === 'unknown') return;
  const now = Date.now();
  let entry = SCAN_TRACKER.get(ip);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + SCAN_WINDOW_MS, reported: false };
    SCAN_TRACKER.set(ip, entry);
  }
  entry.count++;
  if (entry.count >= SCAN_THRESHOLD && !entry.reported) {
    entry.reported = true;
    logSecurityEvent('scan_detected', req, {
      path: req.path,
      notFoundCount: entry.count,
      windowSec: SCAN_WINDOW_MS / 1000
    });
  }
}

// Periodic cleanup of the scan tracker.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of SCAN_TRACKER) if (v.resetAt < now) SCAN_TRACKER.delete(k);
}, 5 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// Express middleware: deny blocklisted IPs on /api/* (registered per-path so
// static assets are never affected).
// ---------------------------------------------------------------------------
function blockIpMiddleware(req, res, next) {
  const ip = getClientIp(req);
  if (isIpBlocked(ip)) {
    logSecurityEvent('blocked_ip', req, { path: req.path, method: req.method });
    return res.status(403).json({ error: 'Access denied.' });
  }
  next();
}

// ---------------------------------------------------------------------------
// Threat level from recent event volume (for the ops-center gauge)
// ---------------------------------------------------------------------------
function threatLevel(oneHourCounts) {
  const total = Object.values(oneHourCounts || {}).reduce((a, b) => a + (b || 0), 0);
  const blockedHits = oneHourCounts && oneHourCounts.blocked_ip ? oneHourCounts.blocked_ip : 0;
  if (total > 20 || blockedHits > 0) return 'ELEVATED';
  if (total >= 5) return 'GUARDED';
  return 'LOW';
}

// ---------------------------------------------------------------------------
// Admin API routes (mounted on the admin router — requireAdminRole already
// applied via router.use; block/unblock additionally require full admin).
// ---------------------------------------------------------------------------
function registerSecurityRoutes(router, ctx) {
  const { requireFullAdmin, logAction } = ctx || {};

  // GET /api/admin/security/events?limit=100&type=failed_login&offset=0
  router.get('/security/events', (req, res) => {
    try {
      const db = require('./db');
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
      const type = req.query.type ? String(req.query.type).slice(0, 64) : null;
      const events = db.listSecurityEvents({ type, limit, offset });
      res.json({ events });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load security events.' });
    }
  });

  // GET /api/admin/security/summary — 24h counts, 1h counts, top IPs, threat level
  router.get('/security/summary', (req, res) => {
    try {
      const db = require('./db');
      const summary = db.securitySummary();
      summary.threatLevel = threatLevel(summary.lastHour);
      summary.blockedCount = getBlocklist().length;
      res.json(summary);
    } catch (e) {
      res.status(500).json({ error: 'Failed to load security summary.' });
    }
  });

  // GET /api/admin/security/blocklist
  router.get('/security/blocklist', (req, res) => {
    res.json({ ips: getBlocklist() });
  });

  // POST /api/admin/security/block-ip { ip, reason }
  const guardBlock = requireFullAdmin || ((req, res, next) => next());
  router.post('/security/block-ip', guardBlock, (req, res) => {
    const ip = String((req.body || {}).ip || '').trim();
    const reason = String((req.body || {}).reason || '').trim();
    if (!ip || ip.length > 64) return res.status(400).json({ error: 'Valid IP required.' });
    // Never block loopback / self.
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
      return res.status(400).json({ error: 'Cannot block loopback.' });
    }
    const list = blockIp(ip, reason, req.adminUser && req.adminUser.id);
    logSecurityEvent('ip_blocked', req, { ip, reason });
    try { logAction(req.adminUser.id, 'security.block_ip', 'ip', ip, { reason }, getClientIp(req)); } catch (e) {}
    res.json({ ok: true, ips: list });
  });

  // POST /api/admin/security/unblock-ip { ip }
  router.post('/security/unblock-ip', guardBlock, (req, res) => {
    const ip = String((req.body || {}).ip || '').trim();
    if (!ip) return res.status(400).json({ error: 'IP required.' });
    const list = unblockIp(ip);
    logSecurityEvent('ip_unblocked', req, { ip });
    try { logAction(req.adminUser.id, 'security.unblock_ip', 'ip', ip, {}, getClientIp(req)); } catch (e) {}
    res.json({ ok: true, ips: list });
  });

  // File integrity monitoring routes (server/integrity.js)
  integrity.registerIntegrityRoutes(router, ctx);
}

module.exports = {
  getClientIp,
  logSecurityEvent,
  isIpBlocked,
  blockIp,
  unblockIp,
  getBlocklist,
  blockIpMiddleware,
  trackApiNotFound,
  threatLevel,
  registerSecurityRoutes
};
