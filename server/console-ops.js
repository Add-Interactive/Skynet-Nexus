// server/console-ops.js — One-click ops tasks for the admin Console tab.
// Provides system stats, data pruning, and key management endpoints.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DATA_DIR } = require('./storage');
const db = require('./db');

function registerConsoleOpsRoutes(router, ctx) {
  const { requireFullAdmin, logAction } = ctx;

  // GET /api/admin/system/stats — DB table counts + volume disk usage
  router.get('/system/stats', (req, res) => {
    try {
      const tables = [
        'users', 'kids', 'articles', 'security_events', 'attacker_profiles',
        'threat_reports', 'feedback', 'questions', 'quiz_results', 'push_subscriptions'
      ];
      const counts = {};
      for (const t of tables) {
        try {
          const row = db.db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get();
          counts[t] = row.c;
        } catch (e) { counts[t] = null; } // table may not exist
      }
      // Volume disk usage (du of DATA_DIR)
      let diskUsage = null;
      try {
        const { execSync } = require('child_process');
        const out = execSync(`du -sh "${DATA_DIR}" 2>/dev/null`, { timeout: 5000 }).toString().trim();
        diskUsage = out.split('\t')[0] || null;
      } catch (e) { /* du unavailable */ }
      res.json({ ok: true, tables: counts, diskUsage, dataDir: DATA_DIR });
    } catch (e) {
      res.status(500).json({ error: 'stats failed: ' + e.message });
    }
  });

  // POST /api/admin/system/prune — clean old data (with counts)
  router.post('/system/prune', requireFullAdmin, (req, res) => {
    try {
      const pruned = {};
      // Security events older than 30 days
      try {
        const before = db.db.prepare("SELECT COUNT(*) AS c FROM security_events WHERE created_at < datetime('now', '-30 days')").get().c;
        db.pruneSecurityEvents();
        pruned.security_events = before;
      } catch (e) { pruned.security_events = 'error: ' + e.message; }
      logAction(req.adminUser.id, 'console.prune', 'system', 'prune', pruned);
      res.json({ ok: true, pruned });
    } catch (e) {
      res.status(500).json({ error: 'prune failed: ' + e.message });
    }
  });

  // GET /api/admin/system/key-status — is the newsroom key configured?
  router.get('/system/key-status', (req, res) => {
    const key = process.env.NEWSROOM_API_KEY || '';
    res.json({ ok: true, configured: key.length > 0, keyPreview: key ? key.slice(0, 4) + '…' : null });
  });

  // POST /api/admin/system/generate-key — generate a new newsroom key (Jeff pastes to Railway env)
  router.post('/system/generate-key', requireFullAdmin, (req, res) => {
    const newKey = 'nxr_' + crypto.randomBytes(24).toString('hex');
    logAction(req.adminUser.id, 'console.generate-key', 'system', 'newsroom-key', {});
    res.json({ ok: true, newKey, note: 'Copy this to NEWSROOM_API_KEY in Railway env vars, then redeploy.' });
  });
}

module.exports = { registerConsoleOpsRoutes };
