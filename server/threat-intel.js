// server/threat-intel.js
// NEXUS SHIELD — Threat Intelligence Platform.
//
// Goes beyond basic event logging to full attacker profiling:
// per-IP behavior tracking, threat scoring, ISP/ASN identification,
// abuse report generation, pattern detection, and proactive auto-defense.
//
// Tables (created here via db.db — no db.js changes needed):
//   attacker_profiles  one row per suspicious IP
//   ip_geo_cache       cached IP -> ISP/geo lookups (30 days)
//   threat_reports     generated abuse reports
//   threat_score_history  threat score snapshots for trend analysis
//
// All functions are defensive: never throw into request handling.

const path = require('path');
const https = require('https');

let _db = null;
function db() {
  if (!_db) {
    const mod = require('./db');
    _db = mod.db || mod;
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Schema (idempotent — safe to run every boot)
// ---------------------------------------------------------------------------
let _schemaReady = false;
function ensureSchema() {
  if (_schemaReady) return;
  const d = db();
  d.exec(`
    CREATE TABLE IF NOT EXISTS attacker_profiles (
      ip               TEXT PRIMARY KEY,
      first_seen       TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen        TEXT NOT NULL DEFAULT (datetime('now')),
      total_events     INTEGER NOT NULL DEFAULT 0,
      threat_score     INTEGER NOT NULL DEFAULT 0,
      country          TEXT,
      city             TEXT,
      isp              TEXT,
      asn              TEXT,
      event_types      TEXT NOT NULL DEFAULT '{}',
      targeted_endpoints TEXT NOT NULL DEFAULT '{}',
      patterns         TEXT NOT NULL DEFAULT '[]',
      auto_blocked     INTEGER NOT NULL DEFAULT 0,
      block_count      INTEGER NOT NULL DEFAULT 0,
      block_expires_at TEXT,
      notes            TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_attacker_last_seen ON attacker_profiles(last_seen);
    CREATE INDEX IF NOT EXISTS idx_attacker_threat_score ON attacker_profiles(threat_score);

    CREATE TABLE IF NOT EXISTS ip_geo_cache (
      ip         TEXT PRIMARY KEY,
      country    TEXT,
      city       TEXT,
      isp        TEXT,
      asn        TEXT,
      org        TEXT,
      cached_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS threat_reports (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ip             TEXT NOT NULL,
      generated_at   TEXT NOT NULL DEFAULT (datetime('now')),
      generated_by   INTEGER,
      abuse_contact  TEXT,
      report_body    TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'draft'
    );
    CREATE INDEX IF NOT EXISTS idx_threat_reports_ip ON threat_reports(ip);

    CREATE TABLE IF NOT EXISTS threat_score_history (
      ip          TEXT NOT NULL,
      score       INTEGER NOT NULL,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_threat_score_hist ON threat_score_history(ip, recorded_at);
  `);
  _schemaReady = true;
}

// ---------------------------------------------------------------------------
// Attack pattern detection
// ---------------------------------------------------------------------------
const PATTERNS = [
  {
    id: 'sqli_probe',
    label: 'SQL Injection Probe',
    severity: 30,
    test: (s) => /(\bunion\b.+\bselect\b|\bdrop\b.+\btable\b|'\s*or\s*'1'\s*=\s*'1|"\s*or\s*"1"\s*=\s*"1|;\s*--|\bexec\b\s*\(|information_schema)/i.test(s)
  },
  {
    id: 'xss_probe',
    label: 'XSS Probe',
    severity: 25,
    test: (s) => /(<script|javascript\s*:|onerror\s*=|onload\s*=|<img[^>]+on\w+\s*=|<svg[^>]+on\w+\s*=)/i.test(s)
  },
  {
    id: 'traversal_probe',
    label: 'Path Traversal Probe',
    severity: 25,
    test: (s) => /(\.\.\/|%2e%2e|%252e|\/etc\/passwd|\/proc\/self|\\windows\\system32)/i.test(s)
  },
  {
    id: 'brute_force',
    label: 'Brute Force',
    severity: 20,
    test: null // detected by event frequency, not string matching
  },
  {
    id: 'scanner',
    label: 'Automated Scanner',
    severity: 15,
    test: (s, ua) => /(nikto|sqlmap|nmap|masscan|dirbuster|gobuster|acunetix|nessus|openvas|wpscan)/i.test(ua || '')
  }
];

function detectPatterns(searchText, userAgent) {
  const found = [];
  const text = String(searchText || '');
  for (const p of PATTERNS) {
    if (!p.test) continue; // frequency-based, handled separately
    try {
      if (p.test(text, userAgent)) found.push(p.id);
    } catch (e) {}
  }
  return found;
}

function patternLabel(id) {
  const p = PATTERNS.find(x => x.id === id);
  return p ? p.label : id;
}

function patternSeverity(id) {
  const p = PATTERNS.find(x => x.id === id);
  return p ? p.severity : 10;
}

// ---------------------------------------------------------------------------
// Threat scoring (0-100)
// ---------------------------------------------------------------------------
function calculateThreatScore(profile, eventTypes, patterns) {
  let score = 0;
  const total = profile.total_events || 0;

  // Volume: up to 30 points (logarithmic — 1 event = 5, 10 = 15, 100 = 25, 1000+ = 30)
  score += Math.min(30, 5 + Math.log10(Math.max(1, total)) * 10);

  // Pattern severity: up to 40 points
  for (const pid of patterns) {
    score += patternSeverity(pid);
  }
  score = Math.min(score, 70); // cap before persistence bonus

  // Persistence: up to 15 points (active across multiple days)
  try {
    const first = new Date(profile.first_seen).getTime();
    const last = new Date(profile.last_seen).getTime();
    const daysActive = Math.max(0, (last - first) / 86400000);
    score += Math.min(15, daysActive * 5);
  } catch (e) {}

  // Repeat offender: up to 15 points
  score += Math.min(15, (profile.block_count || 0) * 7);

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ---------------------------------------------------------------------------
// Attacker profile updates
// ---------------------------------------------------------------------------
function safeJsonParse(s, fallback) {
  try {
    const v = JSON.parse(s);
    return v == null ? fallback : v;
  } catch (e) { return fallback; }
}

function updateAttackerProfile(ip, eventType, details) {
  if (!ip || ip === 'unknown') return null;
  try {
    ensureSchema();
    const d = db();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    let row = d.prepare('SELECT * FROM attacker_profiles WHERE ip = ?').get(ip);

    // Extract searchable text for pattern detection
    const det = details || {};
    const searchText = [
      det.path, det.url, det.query, det.body,
      det.username, det.email, JSON.stringify(det)
    ].filter(Boolean).join(' ');
    const newPatterns = detectPatterns(searchText, det.userAgent);

    // Check brute force: 5+ failed logins in 10 min triggers the pattern
    if (eventType === 'failed_login') {
      const recent = d.prepare(
        `SELECT COUNT(*) AS n FROM security_events
          WHERE ip = ? AND event_type = 'failed_login'
            AND created_at >= datetime('now', '-10 minutes')`
      ).get(ip);
      if (recent && recent.n >= 5 && !newPatterns.includes('brute_force')) {
        newPatterns.push('brute_force');
      }
    }

    if (!row) {
      const eventTypes = {};
      eventTypes[eventType] = 1;
      const endpoints = {};
      if (det.path) endpoints[String(det.path).slice(0, 200)] = 1;
      d.prepare(
        `INSERT INTO attacker_profiles
           (ip, first_seen, last_seen, total_events, threat_score,
            event_types, targeted_endpoints, patterns)
         VALUES (?, ?, ?, 1, 10, ?, ?, ?)`
      ).run(ip, now, now,
        JSON.stringify(eventTypes),
        JSON.stringify(endpoints),
        JSON.stringify(newPatterns));
      row = d.prepare('SELECT * FROM attacker_profiles WHERE ip = ?').get(ip);
    } else {
      const eventTypes = safeJsonParse(row.event_types, {});
      eventTypes[eventType] = (eventTypes[eventType] || 0) + 1;

      const endpoints = safeJsonParse(row.targeted_endpoints, {});
      if (det.path) {
        const ep = String(det.path).slice(0, 200);
        endpoints[ep] = (endpoints[ep] || 0) + 1;
        // Cap stored endpoints at 50 to bound row size
        const keys = Object.keys(endpoints);
        if (keys.length > 50) {
          const sorted = keys.sort((a, b) => endpoints[b] - endpoints[a]).slice(0, 50);
          const trimmed = {};
          for (const k of sorted) trimmed[k] = endpoints[k];
          for (const k of Object.keys(trimmed)) endpoints[k] = trimmed[k];
          for (const k of keys) if (!trimmed[k]) delete endpoints[k];
        }
      }

      const existing = safeJsonParse(row.patterns, []);
      for (const p of newPatterns) if (!existing.includes(p)) existing.push(p);

      const updated = {
        total_events: (row.total_events || 0) + 1,
        event_types: eventTypes,
        targeted_endpoints: endpoints,
        patterns: existing
      };
      updated.threat_score = calculateThreatScore(
        { ...row, total_events: updated.total_events },
        eventTypes, existing
      );

      d.prepare(
        `UPDATE attacker_profiles
            SET last_seen = ?, total_events = ?, threat_score = ?,
                event_types = ?, targeted_endpoints = ?, patterns = ?
          WHERE ip = ?`
      ).run(now, updated.total_events, updated.threat_score,
        JSON.stringify(eventTypes), JSON.stringify(endpoints),
        JSON.stringify(existing), ip);

      // Snapshot score history (throttle: at most 1 per hour per IP)
      try {
        const lastSnap = d.prepare(
          `SELECT recorded_at FROM threat_score_history
            WHERE ip = ? ORDER BY recorded_at DESC LIMIT 1`
        ).get(ip);
        const snapOld = !lastSnap ||
          (Date.now() - new Date(lastSnap.recorded_at + 'Z').getTime() > 3600000);
        if (snapOld) {
          d.prepare('INSERT INTO threat_score_history (ip, score) VALUES (?, ?)')
            .run(ip, updated.threat_score);
        }
      } catch (e) {}

      row = d.prepare('SELECT * FROM attacker_profiles WHERE ip = ?').get(ip);
    }

    // Opportunistic prune: 90-day inactive profiles (~1% of updates)
    if (Math.random() < 0.01) {
      try {
        d.exec(`DELETE FROM attacker_profiles
                 WHERE last_seen < datetime('now', '-90 days')
                   AND auto_blocked = 0`);
        d.exec(`DELETE FROM threat_score_history
                 WHERE recorded_at < datetime('now', '-90 days')`);
      } catch (e) {}
    }

    // Check auto-block thresholds after every update
    checkAutoBlock(ip, row);

    return row;
  } catch (e) {
    console.warn('[threat-intel] profile update failed:', e.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Proactive auto-defense — progressive blocking
// ---------------------------------------------------------------------------
const AUTO_BLOCK_RULES = [
  { eventType: 'failed_login', count: 5, windowMin: 10, label: 'brute force (5 failed logins/10min)' },
  { eventType: 'scan_detected', count: 2, windowMin: 30, label: 'repeated scanning' }
];

function checkAutoBlock(ip, profile) {
  try {
    const d = db();
    profile = profile || d.prepare('SELECT * FROM attacker_profiles WHERE ip = ?').get(ip);
    if (!profile) return;

    // Skip loopback
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return;

    let triggered = null;

    // Rule-based triggers
    for (const rule of AUTO_BLOCK_RULES) {
      const cnt = d.prepare(
        `SELECT COUNT(*) AS n FROM security_events
          WHERE ip = ? AND event_type = ?
            AND created_at >= datetime('now', '-' || ? || ' minutes')`
      ).get(ip, rule.eventType, rule.windowMin);
      if (cnt && cnt.n >= rule.count) { triggered = rule.label; break; }
    }

    // Pattern-based triggers: 3+ SQLi/XSS/traversal probes
    if (!triggered) {
      const patterns = safeJsonParse(profile.patterns, []);
      const dangerous = patterns.filter(p =>
        ['sqli_probe', 'xss_probe', 'traversal_probe'].includes(p));
      if (dangerous.length >= 2 || profile.threat_score >= 70) {
        triggered = 'malicious probe patterns: ' + dangerous.map(patternLabel).join(', ');
      }
    }

    if (!triggered) return;

    // Check if already blocked (permanent or unexpired temp)
    const sec = require('./security');
    const now = new Date();
    if (profile.block_expires_at) {
      const exp = new Date(profile.block_expires_at + 'Z');
      if (exp > now && sec.isIpBlocked(ip)) return; // still blocked
    } else if (sec.isIpBlocked(ip)) {
      return; // permanently blocked already
    }

    // Progressive: 1st = 1hr, 2nd = 24hr, 3rd+ = permanent
    const blockCount = (profile.block_count || 0) + 1;
    let expiresAt = null;
    let durationLabel;
    if (blockCount === 1) {
      expiresAt = new Date(now.getTime() + 3600000).toISOString();
      durationLabel = '1 hour';
    } else if (blockCount === 2) {
      expiresAt = new Date(now.getTime() + 86400000).toISOString();
      durationLabel = '24 hours';
    } else {
      durationLabel = 'permanent';
    }

    sec.blockIp(ip, `AUTO-BLOCK (${durationLabel}): ${triggered}`, null);
    d.prepare(
      `UPDATE attacker_profiles
          SET auto_blocked = 1, block_count = ?, block_expires_at = ?,
              last_seen = datetime('now')
        WHERE ip = ?`
    ).run(blockCount, expiresAt ? expiresAt.slice(0, 19).replace('T', ' ') : null, ip);

    // Log as security event
    try {
      const dbMod = require('./db');
      dbMod.logSecurityEvent({
        eventType: 'auto_block',
        ip,
        userId: null,
        details: JSON.stringify({ reason: triggered, duration: durationLabel, blockCount })
      });
    } catch (e) {}

    console.log(`[threat-intel] AUTO-BLOCK ${ip} (${durationLabel}): ${triggered}`);
  } catch (e) {
    console.warn('[threat-intel] auto-block check failed:', e.message);
  }
}

// Periodic cleanup: unblock expired temp blocks
setInterval(() => {
  try {
    ensureSchema();
    const d = db();
    const expired = d.prepare(
      `SELECT ip FROM attacker_profiles
        WHERE auto_blocked = 1
          AND block_expires_at IS NOT NULL
          AND block_expires_at < datetime('now')`
    ).all();
    if (!expired.length) return;
    const sec = require('./security');
    for (const r of expired) {
      sec.unblockIp(r.ip);
      d.prepare('UPDATE attacker_profiles SET auto_blocked = 0 WHERE ip = ?').run(r.ip);
      console.log(`[threat-intel] auto-block expired, unblocked ${r.ip}`);
    }
  } catch (e) {}
}, 5 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// IP → ISP/geo lookup (cached, rate-limited, non-blocking)
// ---------------------------------------------------------------------------
const GEO_CACHE_DAYS = 30;
const _geoInflight = new Set();

function getCachedGeo(ip) {
  try {
    ensureSchema();
    const d = db();
    const row = d.prepare(
      `SELECT * FROM ip_geo_cache
        WHERE ip = ? AND cached_at >= datetime('now', '-${GEO_CACHE_DAYS} days')`
    ).get(ip);
    return row || null;
  } catch (e) { return null; }
}

function lookupIpInfo(ip, callback) {
  if (!ip || ip === 'unknown') { if (callback) callback(null); return; }
  // Skip private/loopback
  if (/^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|fc00:|fe80:)/i.test(ip)) {
    if (callback) callback(null);
    return;
  }
  const cached = getCachedGeo(ip);
  if (cached) { if (callback) callback(cached); return; }
  if (_geoInflight.has(ip)) return; // already fetching
  _geoInflight.add(ip);

  const req = https.get(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { timeout: 8000 }, (res) => {
    let body = '';
    res.on('data', c => { body += c; if (body.length > 8192) req.destroy(); });
    res.on('end', () => {
      _geoInflight.delete(ip);
      try {
        const j = JSON.parse(body);
        if (j.error) { if (callback) callback(null); return; }
        const info = {
          country: j.country_name || j.country || null,
          city: j.city || null,
          isp: j.org || null,
          asn: j.asn || null,
          org: j.org || null
        };
        try {
          ensureSchema();
          db().prepare(
            `INSERT OR REPLACE INTO ip_geo_cache (ip, country, city, isp, asn, org)
             VALUES (?, ?, ?, ?, ?, ?)`
          ).run(ip, info.country, info.city, info.isp, info.asn, info.org);
          // Also update the attacker profile
          db().prepare(
            `UPDATE attacker_profiles
              SET country = COALESCE(?, country),
                  city = COALESCE(?, city),
                  isp = COALESCE(?, isp),
                  asn = COALESCE(?, asn)
              WHERE ip = ?`
          ).run(info.country, info.city, info.isp, info.asn, ip);
        } catch (e) {}
        if (callback) callback({ ip, ...info });
      } catch (e) { if (callback) callback(null); }
    });
  });
  req.on('error', () => { _geoInflight.delete(ip); if (callback) callback(null); });
  req.on('timeout', () => { req.destroy(); _geoInflight.delete(ip); if (callback) callback(null); });
}

// ---------------------------------------------------------------------------
// Abuse report generation
// ---------------------------------------------------------------------------
function generateAbuseReport(ip, generatedBy) {
  ensureSchema();
  const d = db();
  const profile = d.prepare('SELECT * FROM attacker_profiles WHERE ip = ?').get(ip);
  if (!profile) return { error: 'No threat profile for this IP.' };

  const events = d.prepare(
    `SELECT event_type, details, created_at FROM security_events
      WHERE ip = ? ORDER BY id DESC LIMIT 50`
  ).all(ip);

  const geo = getCachedGeo(ip);
  const eventTypes = safeJsonParse(profile.event_types, {});
  const patterns = safeJsonParse(profile.patterns, []);
  const endpoints = safeJsonParse(profile.targeted_endpoints, {});

  const lines = [];
  lines.push('ABUSE REPORT — Malicious Activity from ' + ip);
  lines.push('Generated: ' + new Date().toISOString());
  lines.push('Reporter: Skynet Nexus (Add Interactive Studio) — NEXUS SHIELD Threat Intelligence');
  lines.push('');
  lines.push('SUMMARY');
  lines.push('  IP address: ' + ip);
  lines.push('  ISP/Org: ' + (profile.isp || (geo && geo.isp) || 'unknown'));
  lines.push('  ASN: ' + (profile.asn || (geo && geo.asn) || 'unknown'));
  lines.push('  Country: ' + (profile.country || (geo && geo.country) || 'unknown'));
  lines.push('  First seen: ' + profile.first_seen);
  lines.push('  Last seen: ' + profile.last_seen);
  lines.push('  Total malicious events: ' + profile.total_events);
  lines.push('  Threat score: ' + profile.threat_score + '/100');
  lines.push('  Detected patterns: ' + (patterns.map(patternLabel).join(', ') || 'none'));
  lines.push('');
  lines.push('EVENT BREAKDOWN');
  for (const [t, n] of Object.entries(eventTypes)) {
    lines.push(`  ${t}: ${n}`);
  }
  lines.push('');
  lines.push('TARGETED ENDPOINTS');
  const eps = Object.entries(endpoints).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [ep, n] of eps) lines.push(`  ${ep} (${n} hits)`);
  lines.push('');
  lines.push('RECENT ACTIVITY (newest first)');
  for (const e of events.slice(0, 20)) {
    let det = '';
    try {
      const dj = JSON.parse(e.details || '{}');
      det = dj.path ? ' ' + dj.path : '';
    } catch (x) {}
    lines.push(`  [${e.created_at}] ${e.event_type}${det}`);
  }
  lines.push('');
  lines.push('RECOMMENDED ACTION');
  lines.push('  Please investigate this IP for Terms of Service violations.');
  lines.push('  Suggested: warn the account holder, rate-limit, or suspend if activity continues.');
  lines.push('');
  lines.push('This report was generated automatically by NEXUS SHIELD threat');
  lines.push('intelligence protecting a children\'s educational platform (COPPA-compliant).');
  lines.push('Contact: abuse@skynetnexus.com');

  const body = lines.join('\n');

  // Abuse contact heuristic from ASN/org
  let abuseContact = null;
  const org = (profile.isp || (geo && geo.isp) || '').toLowerCase();
  if (org) {
    // Common pattern: abuse@<domain> — we can't reliably derive it, so leave
    // a placeholder the admin can fill in.
    abuseContact = 'abuse@' + org.split(/[\s,]+/)[0].replace(/[^a-z0-9.-]/g, '') + ' (verify)';
  }

  const info = d.prepare(
    `INSERT INTO threat_reports (ip, generated_by, abuse_contact, report_body, status)
     VALUES (?, ?, ?, ?, 'draft')`
  ).run(ip, generatedBy || null, abuseContact, body);

  return {
    id: info.lastInsertRowid,
    ip,
    abuseContact,
    body,
    status: 'draft',
    eventCount: events.length
  };
}

// ---------------------------------------------------------------------------
// Aggregate stats
// ---------------------------------------------------------------------------
function threatStats() {
  ensureSchema();
  const d = db();
  const stats = {};

  stats.totalAttackers = d.prepare('SELECT COUNT(*) AS n FROM attacker_profiles').get().n;
  stats.avgThreatScore = d.prepare('SELECT AVG(threat_score) AS a FROM attacker_profiles').get().a || 0;
  stats.autoBlocked = d.prepare('SELECT COUNT(*) AS n FROM attacker_profiles WHERE auto_blocked = 1').get().n;

  stats.byCountry = d.prepare(
    `SELECT COALESCE(country, 'Unknown') AS country, COUNT(*) AS n,
            SUM(total_events) AS events
       FROM attacker_profiles GROUP BY country ORDER BY n DESC LIMIT 15`
  ).all();

  // Attack types from event_types JSON — aggregate in JS
  const typeCounts = {};
  const profiles = d.prepare('SELECT event_types FROM attacker_profiles').all();
  for (const p of profiles) {
    const et = safeJsonParse(p.event_types, {});
    for (const [t, n] of Object.entries(et)) typeCounts[t] = (typeCounts[t] || 0) + n;
  }
  stats.byType = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([type, count]) => ({ type, count }));

  // 7-day trend
  stats.trend7d = d.prepare(
    `SELECT date(created_at) AS day, COUNT(*) AS n FROM security_events
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY day ORDER BY day`
  ).all();

  // Top targeted endpoints across all attackers
  const epCounts = {};
  const allEp = d.prepare('SELECT targeted_endpoints FROM attacker_profiles').all();
  for (const p of allEp) {
    const eps = safeJsonParse(p.targeted_endpoints, {});
    for (const [ep, n] of Object.entries(eps)) epCounts[ep] = (epCounts[ep] || 0) + n;
  }
  stats.topEndpoints = Object.entries(epCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([endpoint, count]) => ({ endpoint, count }));

  stats.reportsGenerated = d.prepare('SELECT COUNT(*) AS n FROM threat_reports').get().n;

  return stats;
}

// ---------------------------------------------------------------------------
// Hook: feed every security event into threat intel
// ---------------------------------------------------------------------------
function observeSecurityEvent(eventType, req, details) {
  try {
    const sec = require('./security');
    const ip = req ? sec.getClientIp(req) : null;
    if (!ip || ip === 'unknown') return;
    // Only profile suspicious event types (not benign admin actions)
    const TRACKED = new Set([
      'failed_login', 'admin_unauthorized', 'rate_limit',
      'blocked_ip', 'scan_detected', 'auto_block'
    ]);
    if (!TRACKED.has(eventType)) return;
    const det = details ? safeJsonParse(
      typeof details === 'string' ? details : JSON.stringify(details), {}
    ) : {};
    if (req) {
      det.path = det.path || req.path;
      try { det.userAgent = req.headers['user-agent']; } catch (e) {}
    }
    const profile = updateAttackerProfile(ip, eventType, det);
    // Lazy geo lookup (background, cached)
    if (profile && !profile.country) {
      lookupIpInfo(ip, () => {});
    }
  } catch (e) {}
}

// ---------------------------------------------------------------------------
// Admin API routes
// ---------------------------------------------------------------------------
function maskIp(ip) {
  if (!ip) return '—';
  const parts = String(ip).split('.');
  if (parts.length === 4) return parts[0] + '.' + parts[1] + '.xxx.xxx';
  // IPv6: show first hextet
  const v6 = String(ip).split(':');
  return v6[0] + ':xxxx::';
}

function registerThreatIntelRoutes(router, ctx) {
  const { requireFullAdmin, logAction } = ctx || {};
  const guardFull = requireFullAdmin || ((req, res, next) => next());

  // GET /api/admin/security/threats — paginated attacker profiles
  router.get('/security/threats', (req, res) => {
    try {
      ensureSchema();
      const d = db();
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
      const country = req.query.country ? String(req.query.country).slice(0, 64) : null;
      const minScore = Math.max(parseInt(req.query.minScore, 10) || 0, 0);

      let where = 'WHERE threat_score >= ?';
      const params = [minScore];
      if (country) { where += ' AND country = ?'; params.push(country); }

      const total = d.prepare(`SELECT COUNT(*) AS n FROM attacker_profiles ${where}`).get(...params).n;
      const rows = d.prepare(
        `SELECT ip, first_seen, last_seen, total_events, threat_score,
                country, city, isp, asn, patterns, auto_blocked, block_count
           FROM attacker_profiles ${where}
          ORDER BY threat_score DESC, total_events DESC
          LIMIT ? OFFSET ?`
      ).all(...params, limit, offset);

      res.json({
        total,
        threats: rows.map(r => ({
          ...r,
          ipMasked: maskIp(r.ip),
          patterns: safeJsonParse(r.patterns, []).map(patternLabel)
        }))
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load threat profiles.' });
    }
  });

  // GET /api/admin/security/threats/stats — aggregates
  router.get('/security/threats/stats', (req, res) => {
    try {
      res.json(threatStats());
    } catch (e) {
      res.status(500).json({ error: 'Failed to load threat stats.' });
    }
  });

  // GET /api/admin/security/threats/reports — list reports
  router.get('/security/threats/reports', (req, res) => {
    try {
      ensureSchema();
      const rows = db().prepare(
        `SELECT id, ip, generated_at, abuse_contact, status,
                length(report_body) AS body_len
           FROM threat_reports ORDER BY id DESC LIMIT 100`
      ).all();
      res.json({ reports: rows });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load reports.' });
    }
  });

  // GET /api/admin/security/threats/reports/:id — full report
  router.get('/security/threats/reports/:id', (req, res) => {
    try {
      ensureSchema();
      const row = db().prepare('SELECT * FROM threat_reports WHERE id = ?')
        .get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Report not found.' });
      res.json({ report: row });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load report.' });
    }
  });

  // POST /api/admin/security/threats/reports/:id/status { status }
  router.post('/security/threats/reports/:id/status', guardFull, (req, res) => {
    try {
      ensureSchema();
      const status = String((req.body || {}).status || '').slice(0, 16);
      if (!['draft', 'sent'].includes(status)) {
        return res.status(400).json({ error: 'Status must be draft or sent.' });
      }
      db().prepare('UPDATE threat_reports SET status = ? WHERE id = ?')
        .run(status, req.params.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update report.' });
    }
  });

  // NOTE: /security/threats/:ip must come AFTER /security/threats/reports
  // so Express matches the literal path first.

  // GET /api/admin/security/threats/:ip — full profile
  router.get('/security/threats/:ip', (req, res) => {
    try {
      ensureSchema();
      const d = db();
      const ip = String(req.params.ip || '').slice(0, 64);
      const profile = d.prepare('SELECT * FROM attacker_profiles WHERE ip = ?').get(ip);
      if (!profile) return res.status(404).json({ error: 'No profile for this IP.' });

      // Trigger background geo lookup if missing
      if (!profile.country) lookupIpInfo(ip, () => {});
      const geo = getCachedGeo(ip);

      const events = d.prepare(
        `SELECT event_type, details, created_at FROM security_events
          WHERE ip = ? ORDER BY id DESC LIMIT 100`
      ).all(ip);

      const scoreHistory = d.prepare(
        `SELECT score, recorded_at FROM threat_score_history
          WHERE ip = ? ORDER BY recorded_at LIMIT 100`
      ).all(ip);

      res.json({
        profile: {
          ...profile,
          ipMasked: maskIp(profile.ip),
          event_types: safeJsonParse(profile.event_types, {}),
          targeted_endpoints: safeJsonParse(profile.targeted_endpoints, {}),
          patterns: safeJsonParse(profile.patterns, [])
            .map(p => ({ id: p, label: patternLabel(p) }))
        },
        geo,
        events: events.map(e => {
          let det = {};
          try { det = JSON.parse(e.details || '{}'); } catch (x) {}
          return { event_type: e.event_type, created_at: e.created_at, path: det.path || null };
        }),
        scoreHistory
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load threat profile.' });
    }
  });

  // POST /api/admin/security/threats/:ip/report — generate abuse report
  router.post('/security/threats/:ip/report', guardFull, (req, res) => {
    try {
      const ip = String(req.params.ip || '').slice(0, 64);
      const byUser = req.adminUser && req.adminUser.id;
      const report = generateAbuseReport(ip, byUser);
      if (report.error) return res.status(404).json({ error: report.error });
      try { logAction(byUser, 'security.threat_report', 'ip', ip, { reportId: report.id }); } catch (e) {}
      res.json({ ok: true, report });
    } catch (e) {
      res.status(500).json({ error: 'Failed to generate report.' });
    }
  });

  // POST /api/admin/security/threats/:ip/lookup — force refresh geo/ISP
  router.post('/security/threats/:ip/lookup', (req, res) => {
    const ip = String(req.params.ip || '').slice(0, 64);
    lookupIpInfo(ip, (info) => {
      // Bust cache first for a forced refresh
      try {
        ensureSchema();
        db().prepare('DELETE FROM ip_geo_cache WHERE ip = ?').run(ip);
      } catch (e) {}
      lookupIpInfo(ip, (info2) => res.json({ ok: true, info: info2 }));
    });
  });
}

module.exports = {
  ensureSchema,
  updateAttackerProfile,
  calculateThreatScore,
  detectPatterns,
  patternLabel,
  observeSecurityEvent,
  lookupIpInfo,
  getCachedGeo,
  generateAbuseReport,
  threatStats,
  checkAutoBlock,
  maskIp,
  registerThreatIntelRoutes
};
