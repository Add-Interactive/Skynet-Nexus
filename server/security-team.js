// server/security-team.js
// NEXUS SHIELD — Security Team backend: Sentinel, Hunter, Guardian.
//
// Three IT cop agents patrol the site hourly (dispatched by Gizmo) and POST
// their reports here. The admin panel's Security tab reads the reports and
// lets admins chat with each agent. Agents answer from their own live patrol
// data; anything they can't answer is escalated to a ticket for Gizmo.
//
// Wiring (no server/index.js edit needed):
//   - registerSecurityTeamRoutes(router, ctx) — called from
//     security.registerSecurityRoutes (admin router, session auth).
//   - registerPatrolRoutes(router) — key-guarded machine-to-machine routes,
//     registered in admin-routes.js BEFORE router.use(requireAdminRole).
// Auth for patrol routes reuses NEWSROOM_API_KEY via the x-newsroom-key
// header (same "Gizmo's agents" key as the newsroom pipeline).

const security = require('./security');
const threatIntel = require('./threat-intel');
const integrity = require('./integrity');

const AGENTS = {
  sentinel: {
    name: 'Sentinel', emoji: '🛰️', role: 'Site health',
    brief: 'Watches uptime, API responsiveness, SSL validity and response times. Patrols hourly at :00.'
  },
  hunter: {
    name: 'Hunter', emoji: '🎯', role: 'Threat tracker',
    brief: 'Tracks who is probing or attacking the site, AI swarm patterns and attacker profiles. Patrols hourly at :20.'
  },
  guardian: {
    name: 'Guardian', emoji: '🛡️', role: 'Defense check',
    brief: 'Verifies security headers, file integrity and auto-block defenses. Patrols hourly at :40.'
  }
};
const AGENT_IDS = Object.keys(AGENTS);

function db() { return require('./db').db; }

function ensureSchema() {
  const d = db();
  d.exec(`CREATE TABLE IF NOT EXISTS security_team_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ok',
    summary TEXT NOT NULL DEFAULT '',
    metrics_json TEXT NOT NULL DEFAULT '{}',
    findings_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  d.exec(`CREATE INDEX IF NOT EXISTS idx_team_reports_agent_time
          ON security_team_reports(agent, created_at DESC)`);
  d.exec(`CREATE TABLE IF NOT EXISTS security_alert_optins (
    user_id INTEGER PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  d.exec(`CREATE TABLE IF NOT EXISTS security_alert_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent TEXT NOT NULL,
    kind TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  d.exec(`CREATE TABLE IF NOT EXISTS security_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent TEXT NOT NULL DEFAULT 'team',
    question TEXT NOT NULL,
    asked_by INTEGER,
    status TEXT NOT NULL DEFAULT 'open',
    answer TEXT,
    answered_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
}

// ---------- patrol key guard (machine-to-machine) ----------
function checkPatrolKey(req, res, next) {
  const expected = process.env.NEWSROOM_API_KEY;
  if (!expected) return res.status(503).json({ error: 'patrol ingestion not configured' });
  const got = String(req.headers['x-newsroom-key'] || '');
  if (!got || got !== expected) return res.status(403).json({ error: 'forbidden' });
  next();
}

// ---------- tiny rate limiter for the chat endpoint ----------
const chatHits = new Map(); // ip -> [timestamps]
function chatRateLimit(req, res, next) {
  const ip = security.getClientIp(req) || 'unknown';
  const now = Date.now();
  const windowStart = now - 60_000;
  let hits = (chatHits.get(ip) || []).filter(t => t > windowStart);
  if (hits.length >= 20) {
    return res.status(429).json({ error: 'Slow down — the team can only type so fast.' });
  }
  hits.push(now);
  chatHits.set(ip, hits);
  next();
}

// ---------- report storage ----------
function storeReport({ agent, status, summary, metrics, findings }) {
  ensureSchema();
  const d = db();
  const info = d.prepare(
    `INSERT INTO security_team_reports (agent, status, summary, metrics_json, findings_json)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    agent,
    ['ok', 'warning', 'critical'].includes(status) ? status : 'ok',
    String(summary || '').slice(0, 2000),
    JSON.stringify(metrics || {}),
    JSON.stringify(Array.isArray(findings) ? findings.slice(0, 50) : [])
  );
  // Keep the table lean: 30 days of hourly reports per agent max.
  d.exec(`DELETE FROM security_team_reports
          WHERE created_at < datetime('now', '-30 days')`);
  return info.lastInsertRowid;
}

function latestReport(agent) {
  ensureSchema();
  const row = db().prepare(
    `SELECT * FROM security_team_reports WHERE agent = ? ORDER BY id DESC LIMIT 1`
  ).get(agent);
  if (!row) return null;
  return {
    id: row.id,
    agent: row.agent,
    status: row.status,
    summary: row.summary,
    metrics: safeJson(row.metrics_json),
    findings: safeJson(row.findings_json, []),
    created_at: row.created_at
  };
}

function reportHistory(agent, limit) {
  ensureSchema();
  const rows = db().prepare(
    `SELECT id, agent, status, summary, created_at FROM security_team_reports
     WHERE (? IS NULL OR agent = ?) ORDER BY id DESC LIMIT ?`
  ).all(agent || null, agent || null, Math.min(Math.max(limit || 24, 1), 200));
  return rows;
}

function safeJson(s, fallback) {
  try { return JSON.parse(s || ''); } catch (e) { return fallback === undefined ? {} : fallback; }
}

function minutesSince(iso) {
  const t = new Date(String(iso).replace(' ', 'T') + 'Z').getTime();
  if (isNaN(t)) return null;
  return Math.round((Date.now() - t) / 60000);
}

function teamStatus() {
  const agents = {};
  for (const id of AGENT_IDS) {
    const r = latestReport(id);
    const ageMin = r ? minutesSince(r.created_at) : null;
    agents[id] = {
      ...AGENTS[id],
      status: r ? r.status : 'unknown',
      summary: r ? r.summary : 'No patrol report yet.',
      lastPatrol: r ? r.created_at : null,
      lastPatrolMinAgo: ageMin,
      overdue: ageMin == null ? true : ageMin > 90,
      metrics: r ? r.metrics : {},
      findings: r ? r.findings : []
    };
  }
  return { agents, at: new Date().toISOString() };
}

// ---------- agent-feed: live data bundle for patrol agents + chat ----------
function agentFeed() {
  const feed = { at: new Date().toISOString() };
  try {
    const dbm = require('./db');
    const summary = dbm.securitySummary();
    summary.threatLevel = security.threatLevel(summary.lastHour);
    summary.blockedCount = security.getBlocklist().length;
    feed.summary = summary;
  } catch (e) { feed.summary = null; }
  try {
    threatIntel.ensureSchema();
    feed.threats = threatIntel.threatStats();
  } catch (e) { feed.threats = null; }
  try {
    feed.integrity = integrity.checkIntegrity();
  } catch (e) { feed.integrity = null; }
  return feed;
}

// ---------- chat brain (rule-based; answers from live patrol data) ----------
const INTENTS = {
  sentinel: ['up', 'down', 'uptime', 'slow', 'latency', 'response', 'ssl', 'cert', 'certificate', 'api', 'health', 'site', 'loading', 'speed', 'outage', 'reachable'],
  hunter: ['threat', 'attack', 'attacker', 'hack', 'probe', 'probing', 'scan', 'scanner', 'bot', 'country', 'countries', 'pattern', 'swarm', 'offender', 'suspicious', 'brute'],
  guardian: ['header', 'csp', 'hsts', 'integrity', 'checksum', 'tamper', 'blocklist', 'blocked', 'defense', 'defence', 'shield', 'protect', 'baseline', 'auto-block', 'autoblock', 'firewall']
};
const ESCALATE_RE = /escalat|human|gizmo|jeff|real person|help me|don.?t (understand|know)|can.?t |won.?t |not working|urgent/i;
const STATUS_RE = /status|report|how.?s it|how is|update|brief|last patrol|check-?in/i;
const HELP_RE = /^(help|what can you do|commands|who are you|hello|hi|hey)\b/i;

function detectAgent(text) {
  const t = ' ' + text.toLowerCase() + ' ';
  let best = null, bestScore = 0;
  for (const [agent, words] of Object.entries(INTENTS)) {
    let score = 0;
    for (const w of words) if (t.includes(w)) score++;
    if (score > bestScore) { bestScore = score; best = agent; }
  }
  return bestScore > 0 ? best : null;
}

function fmtAge(min) {
  if (min == null) return 'never';
  if (min < 1) return 'just now';
  if (min < 60) return min + 'm ago';
  return Math.floor(min / 60) + 'h ' + (min % 60) + 'm ago';
}

function sentinelReply(feed, report) {
  const m = (report && report.metrics) || {};
  const lines = ['🛰️ **Sentinel here.**'];
  if (report) {
    lines.push(report.summary);
    if (m.homepage_ms != null) lines.push(`Homepage: ${m.homepage_ms}ms · API: ${m.api_ms != null ? m.api_ms + 'ms' : '—'} · SSL: ${m.ssl_days_left != null ? m.ssl_days_left + ' days left' : '—'}`);
    lines.push(`Last sweep ${fmtAge(minutesSince(report.created_at))}.`);
  } else {
    lines.push('No patrol data yet — my first sweep lands on the hour.');
  }
  if (report && report.status === 'critical') lines.push('⚠️ I flagged something critical — check my findings or escalate.');
  return lines.join('\n');
}

function hunterReply(feed, report) {
  const lines = ['🎯 **Hunter here.**'];
  if (report && report.summary) lines.push(report.summary);
  const s = feed.summary;
  if (s) {
    const h24 = s.last24h || {};
    const failed = h24.failed_login || 0;
    const blocked = (h24.blocked_ip || 0) + (h24.scan_detected || 0);
    lines.push(`24h tally: ${failed} failed logins, ${blocked} blocked/scans, threat level ${s.threatLevel || 'LOW'}.`);
    if (s.topIps && s.topIps.length) {
      const top = s.topIps[0];
      lines.push(`Top offender: ${top.ip} (${top.count} events).`);
    }
  }
  const t = feed.threats;
  if (t && t.totalAttackers) {
    lines.push(`${t.totalAttackers} tracked attacker profiles, ${t.autoBlocked || 0} auto-blocked.`);
  }
  if (report && report.findings && report.findings.length) {
    lines.push('Latest findings: ' + report.findings.slice(0, 3).join(' · '));
  }
  if (lines.length === 1) lines.push('All quiet — no live threat data yet.');
  return lines.join('\n');
}

function guardianReply(feed, report) {
  const lines = ['🛡️ **Guardian here.**'];
  if (report && report.summary) lines.push(report.summary);
  const m = (report && report.metrics) || {};
  if (m.headers_ok != null) {
    lines.push(m.headers_ok
      ? 'Security headers verified: CSP, HSTS, X-Frame-Options all present.'
      : '⚠️ Missing security headers: ' + (m.headers_missing || []).join(', '));
  }
  const integ = feed.integrity;
  if (integ && integ.files) {
    const bad = integ.files.filter(f => f.status !== 'ok').length;
    lines.push(bad === 0
      ? `File integrity: ${integ.files.length}/${integ.files.length} verified against baseline.`
      : `⚠️ File integrity: ${bad} of ${integ.files.length} files changed — investigate.`);
  }
  if (feed.summary && feed.summary.blockedCount != null) {
    lines.push(`Blocklist: ${feed.summary.blockedCount} IPs denied. Auto-block armed.`);
  }
  if (lines.length === 1) lines.push('Defenses nominal — first patrol report lands at :40 past the hour.');
  return lines.join('\n');
}

function teamBrief(feed) {
  const st = teamStatus();
  const lines = ['🛡️ **Security Team briefing** — all three agents reporting:'];
  for (const id of AGENT_IDS) {
    const a = st.agents[id];
    lines.push(`${AGENTS[id].emoji} ${AGENTS[id].name}: ${a.summary} (${fmtAge(a.lastPatrolMinAgo)})`);
  }
  if (feed.summary && feed.summary.threatLevel) {
    lines.push(`Overall threat level: **${feed.summary.threatLevel}**.`);
  }
  return lines.join('\n');
}

function helpReply(agentId) {
  if (agentId === 'sentinel') return '🛰️ Ask me about site health: "is the site up?", "response times?", "ssl status?", or "latest report". Say "escalate" any time to loop in Gizmo.';
  if (agentId === 'hunter') return '🎯 Ask me about threats: "any attacks today?", "top offenders?", "threat level?", or "latest report". Say "escalate" any time to loop in Gizmo.';
  if (agentId === 'guardian') return '🛡️ Ask me about defenses: "headers ok?", "file integrity?", "blocklist?", or "latest report". Say "escalate" any time to loop in Gizmo.';
  return '🛡️ Talk to **Sentinel** (site health), **Hunter** (threats) or **Guardian** (defenses) — or ask me for a team briefing. Anything I can\'t answer gets escalated to Gizmo as a ticket.';
}

function createTicket({ agent, question, askedBy }) {
  ensureSchema();
  const info = db().prepare(
    `INSERT INTO security_tickets (agent, question, asked_by) VALUES (?, ?, ?)`
  ).run(agent, String(question).slice(0, 2000), askedBy || null);
  return info.lastInsertRowid;
}

function answerChat(agentParam, message, askedBy) {
  const text = String(message || '').trim().slice(0, 1000);
  if (!text) return { reply: 'Say something and the team will pick it up. Try "status" or "help".', agent: 'team' };
  const feed = agentFeed();

  if (HELP_RE.test(text)) {
    const a = AGENT_IDS.includes(agentParam) ? agentParam : 'team';
    return { reply: helpReply(a), agent: a };
  }

  let agent = AGENT_IDS.includes(agentParam) ? agentParam : detectAgent(text) || 'team';

  if (ESCALATE_RE.test(text)) {
    const id = createTicket({ agent: agent === 'team' ? 'team' : agent, question: text, askedBy });
    return {
      reply: `🚨 Escalated to Gizmo — ticket #${id}. I'll dig in and post the answer here. Nothing urgent gets lost.`,
      agent, escalated: true, ticket_id: id
    };
  }

  const report = agent === 'team' ? null : latestReport(agent);
  let reply;
  if (agent === 'sentinel') reply = sentinelReply(feed, report);
  else if (agent === 'hunter') reply = hunterReply(feed, report);
  else if (agent === 'guardian') reply = guardianReply(feed, report);
  else reply = STATUS_RE.test(text) || text.length < 24 ? teamBrief(feed) : null;

  if (!reply) {
    // No intent matched — escalate rather than guess.
    const id = createTicket({ agent: 'team', question: text, askedBy });
    return {
      reply: `That's outside my patrol data, so I've opened ticket #${id} for Gizmo — he'll answer here. Try "status", "threats", or "integrity" for instant answers.`,
      agent: 'team', escalated: true, ticket_id: id
    };
  }
  return { reply, agent };
}

// ---------- critical push alerts (opt-in, admins/editors only) ----------
function alertOptedIn(userId) {
  ensureSchema();
  return !!db().prepare(
    'SELECT 1 FROM security_alert_optins WHERE user_id = ?').get(userId);
}

function setAlertOptIn(userId, on) {
  ensureSchema();
  const d = db();
  if (on) d.prepare('INSERT OR IGNORE INTO security_alert_optins (user_id) VALUES (?)').run(userId);
  else d.prepare('DELETE FROM security_alert_optins WHERE user_id = ?').run(userId);
}

function alertSubscribers() {
  ensureSchema();
  const d = db();
  const dbm = require('./db');
  const optins = d.prepare('SELECT user_id FROM security_alert_optins').all()
    .map(r => r.user_id);
  if (!optins.length) return [];
  const okIds = new Set();
  for (const uid of optins) {
    try {
      const u = dbm.findUserById(uid);
      if (!u) continue;
      let roles = [];
      try { roles = dbm.getUserRoles(uid) || []; }
      catch (e) { roles = u.role ? [u.role] : []; }
      if (roles.includes('admin') || roles.includes('editor')) okIds.add(uid);
    } catch (e) {}
  }
  if (!okIds.size) return [];
  return d.prepare(
    'SELECT user_id, endpoint, p256dh, auth FROM push_subscriptions'
  ).all().filter(s => okIds.has(s.user_id));
}

async function sendCriticalAlert(agent, summary) {
  try {
    ensureSchema();
    const d = db();
    // Dedup: at most one critical push per agent per 30 minutes.
    const recent = d.prepare(
      `SELECT 1 FROM security_alert_log
        WHERE agent = ? AND kind = 'critical'
          AND sent_at > datetime('now', '-30 minutes')`).get(agent);
    if (recent) return { skipped: 'dedup' };
    const subs = alertSubscribers();
    if (!subs.length) return { skipped: 'no-subscribers' };
    const push = require('./push');
    const a = AGENTS[agent] || { name: agent };
    const res = await push.sendToSubscriptions(subs, {
      title: `\uD83D\uDEA8 SHIELD critical \u2014 ${a.name}`,
      body: String(summary).slice(0, 160),
      url: '/pages/admin.html',
      tag: 'shield-critical-' + agent,
    });
    d.prepare(`INSERT INTO security_alert_log (agent, kind)
               VALUES (?, 'critical')`).run(agent);
    console.log(`[team] critical alert (${agent}): sent=${res.sent} failed=${res.failed}`);
    return res;
  } catch (e) {
    console.warn('[team] critical alert failed:', e.message);
    return { error: e.message };
  }
}

async function sendResolvedAlert(agent, summary) {
  try {
    const subs = alertSubscribers();
    if (!subs.length) return { skipped: 'no-subscribers' };
    const push = require('./push');
    const a = AGENTS[agent] || { name: agent };
    const res = await push.sendToSubscriptions(subs, {
      title: `\u2705 SHIELD resolved \u2014 ${a.name}`,
      body: String(summary).slice(0, 160),
      url: '/pages/admin.html',
      tag: 'shield-resolved-' + agent,
    });
    db().prepare(`INSERT INTO security_alert_log (agent, kind)
                  VALUES (?, 'resolved')`).run(agent);
    console.log(`[team] resolved alert (${agent}): sent=${res.sent}`);
    return res;
  } catch (e) {
    console.warn('[team] resolved alert failed:', e.message);
    return { error: e.message };
  }
}

// ---------- route registration ----------
function registerSecurityTeamRoutes(router, ctx) {
  const { logAction } = ctx || {};

  // GET /api/admin/security/team/status — latest report per agent
  router.get('/security/team/status', (req, res) => {
    try { res.json(teamStatus()); }
    catch (e) { res.status(500).json({ error: 'Failed to load team status.' }); }
  });

  // GET /api/admin/security/team/reports?agent=sentinel&limit=24
  router.get('/security/team/reports', (req, res) => {
    try {
      const agent = AGENT_IDS.includes(req.query.agent) ? req.query.agent : null;
      res.json({ reports: reportHistory(agent, parseInt(req.query.limit, 10) || 24) });
    } catch (e) { res.status(500).json({ error: 'Failed to load reports.' }); }
  });

  // POST /api/admin/security/team/chat { agent, message }
  router.post('/security/team/chat', chatRateLimit, (req, res) => {
    try {
      const { agent, message } = req.body || {};
      const out = answerChat(agent, message, req.adminUser && req.adminUser.id);
      try { logAction(req.adminUser.id, 'security.team_chat', 'agent', out.agent, { escalated: !!out.escalated }, security.getClientIp(req)); } catch (e) {}
      res.json(out);
    } catch (e) { res.status(500).json({ error: 'The team is unreachable right now.' }); }
  });

  // GET /api/admin/security/team/tickets — open + recent tickets
  router.get('/security/team/tickets', (req, res) => {
    try {
      ensureSchema();
      const rows = db().prepare(
        `SELECT id, agent, question, asked_by, status, answer, answered_at, created_at
         FROM security_tickets ORDER BY
           CASE status WHEN 'open' THEN 0 ELSE 1 END, id DESC LIMIT 100`
      ).all();
      res.json({ tickets: rows });
    } catch (e) { res.status(500).json({ error: 'Failed to load tickets.' }); }
  });

  // POST /api/admin/security/team/tickets { agent, question } — manual escalation
  router.post('/security/team/tickets', (req, res) => {
    try {
      const { agent, question } = req.body || {};
      const a = AGENT_IDS.includes(agent) ? agent : 'team';
      const id = createTicket({ agent: a, question: String(question || ''), askedBy: req.adminUser && req.adminUser.id });
      try { logAction(req.adminUser.id, 'security.team_ticket', 'ticket', String(id), { agent: a }, security.getClientIp(req)); } catch (e) {}
      res.json({ ok: true, id });
    } catch (e) { res.status(500).json({ error: 'Failed to open ticket.' }); }
  });

  // GET /api/admin/security/team/alerts/status — push state for this admin
  router.get('/security/team/alerts/status', (req, res) => {
    try {
      const push = require('./push');
      const uid = req.adminUser && req.adminUser.id;
      const hasSub = uid ? !!db().prepare(
        'SELECT 1 FROM push_subscriptions WHERE user_id = ? LIMIT 1').get(uid) : false;
      res.json({
        pushEnabled: push.isEnabled(),
        hasSubscription: hasSub,
        optedIn: uid ? alertOptedIn(uid) : false
      });
    } catch (e) { res.status(500).json({ error: 'Failed to load alert status.' }); }
  });

  // POST /api/admin/security/team/alerts/opt-in | opt-out
  router.post('/security/team/alerts/opt-in', (req, res) => {
    try {
      const uid = req.adminUser && req.adminUser.id;
      if (!uid) return res.status(401).json({ error: 'unauthorized' });
      setAlertOptIn(uid, true);
      try { logAction(uid, 'security.team_alerts_optin', 'user', String(uid), {}, security.getClientIp(req)); } catch (e) {}
      res.json({ ok: true, optedIn: true });
    } catch (e) { res.status(500).json({ error: 'Failed to opt in.' }); }
  });
  router.post('/security/team/alerts/opt-out', (req, res) => {
    try {
      const uid = req.adminUser && req.adminUser.id;
      if (!uid) return res.status(401).json({ error: 'unauthorized' });
      setAlertOptIn(uid, false);
      try { logAction(uid, 'security.team_alerts_optout', 'user', String(uid), {}, security.getClientIp(req)); } catch (e) {}
      res.json({ ok: true, optedIn: false });
    } catch (e) { res.status(500).json({ error: 'Failed to opt out.' }); }
  });

  // POST /api/admin/security/team/tickets/:id/answer { answer } — admin or Gizmo answers
  router.post('/security/team/tickets/:id/answer', (req, res) => {
    try {
      ensureSchema();
      const id = parseInt(req.params.id, 10);
      const answer = String((req.body || {}).answer || '').trim().slice(0, 4000);
      if (!id || !answer) return res.status(400).json({ error: 'Ticket id and answer required.' });
      const info = db().prepare(
        `UPDATE security_tickets SET status = 'answered', answer = ?, answered_at = datetime('now')
         WHERE id = ? AND status = 'open'`
      ).run(answer, id);
      if (!info.changes) return res.status(404).json({ error: 'Ticket not found or already answered.' });
      try { logAction(req.adminUser.id, 'security.team_ticket_answer', 'ticket', String(id), {}, security.getClientIp(req)); } catch (e) {}
      res.json({ ok: true, id });
    } catch (e) { res.status(500).json({ error: 'Failed to answer ticket.' }); }
  });
}

// Key-guarded machine-to-machine routes. Registered BEFORE requireAdminRole.
function registerPatrolRoutes(router) {
  // POST /api/admin/security/team/patrol-report { agent, status, summary, metrics, findings }
  router.post('/security/team/patrol-report', checkPatrolKey, (req, res) => {
    try {
      const { agent, status, summary, metrics, findings } = req.body || {};
      if (!AGENT_IDS.includes(agent)) return res.status(400).json({ error: 'Unknown agent.' });
      const prev = latestReport(agent);
      const id = storeReport({ agent, status, summary, metrics, findings });
      if (status === 'critical') {
        try { security.logSecurityEvent('team_critical', req, { agent, summary: String(summary).slice(0, 200) }); } catch (e) {}
        // Fire-and-forget: never delay the patrol POST on push delivery.
        sendCriticalAlert(agent, summary).catch(() => {});
      } else if (status === 'ok' && prev && prev.status === 'critical') {
        sendResolvedAlert(agent, summary).catch(() => {});
      }
      res.json({ ok: true, id });
    } catch (e) { res.status(500).json({ error: 'Failed to store report.' }); }
  });

  // GET /api/admin/security/team/agent-feed — live bundle for patrol agents
  router.get('/security/team/agent-feed', checkPatrolKey, (req, res) => {
    try { res.json({ ok: true, feed: agentFeed() }); }
    catch (e) { res.status(500).json({ error: 'Failed to build agent feed.' }); }
  });

  // POST /api/admin/security/team/tickets/:id/answer — Gizmo's agent key can answer too
  router.post('/security/team/tickets/:id/answer', checkPatrolKey, (req, res) => {
    try {
      ensureSchema();
      const id = parseInt(req.params.id, 10);
      const answer = String((req.body || {}).answer || '').trim().slice(0, 4000);
      if (!id || !answer) return res.status(400).json({ error: 'Ticket id and answer required.' });
      const info = db().prepare(
        `UPDATE security_tickets SET status = 'answered', answer = ?, answered_at = datetime('now')
         WHERE id = ? AND status = 'open'`
      ).run(answer, id);
      if (!info.changes) return res.status(404).json({ error: 'Ticket not found or already answered.' });
      res.json({ ok: true, id });
    } catch (e) { res.status(500).json({ error: 'Failed to answer ticket.' }); }
  });
}

module.exports = {
  AGENTS,
  AGENT_IDS,
  ensureSchema,
  storeReport,
  latestReport,
  teamStatus,
  agentFeed,
  answerChat,
  createTicket,
  registerSecurityTeamRoutes,
  registerPatrolRoutes
};
