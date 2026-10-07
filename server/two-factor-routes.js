// server/two-factor-routes.js
// TOTP 2FA endpoints for admin accounts.
//
// Design: 2FA is enforced at the admin API gate (requireAdminRole), not in the
// login route, so server/index.js needs no changes. After password login, an
// admin with totp_enabled gets 403 { needs2fa: true } on /api/admin/* until
// they POST a valid TOTP code to /api/admin/2fa/verify-login, which sets
// req.session.twofaVerified = true.
//
// Endpoints (all under /api/admin, all require admin role):
//   GET  /2fa/status        — { enabled, backupCodesRemaining }
//   POST /2fa/setup         — generate secret, store encrypted (not yet enabled)
//                            returns { qrDataUrl, manualKey }
//   POST /2fa/verify        — { token } → enables 2FA, returns { backupCodes[] } (plain, show once)
//   POST /2fa/disable       — { password } → disables 2FA
//   POST /2fa/verify-login  — { token } → verifies TOTP for this session
//   POST /2fa/regenerate-codes — new backup codes (requires password)

const tf = require('./two-factor');
const tfdb = require('./two-factor-db');

// Paths exempt from the 2FA gate (they're part of the 2FA flow itself).
const TWOFA_EXEMPT = new Set([
  '/2fa/status',
  '/2fa/setup',
  '/2fa/verify',
  '/2fa/disable',
  '/2fa/verify-login',
  '/2fa/regenerate-codes',
]);

function isExempt(path) {
  return TWOFA_EXEMPT.has(path);
}

// Middleware: after requireAdminRole, enforce 2FA for admins who enabled it.
// Sets req.twofaRequired = true when the gate blocks.
function twofaGate(req, res, next) {
  const user = req.adminUser;
  if (!user) return next(); // requireAdminRole handles this
  if (isExempt(req.path)) return next();
  try {
    if (tfdb.isTotpEnabled(user.id) && !req.session.twofaVerified) {
      return res.status(403).json({ needs2fa: true, error: 'Two-factor authentication required.' });
    }
  } catch (e) {
    console.error('[2fa] gate check failed:', e.message);
  }
  next();
}

function registerTwoFactorRoutes(router, { requireAdminRole, requireFullAdmin, logAction, verifyPassword, findUserByEmail }) {
  const tf2fa = require('./two-factor');
  const db2fa = require('./two-factor-db');

  // All 2FA endpoints require admin role (but NOT the 2FA gate itself).
  router.get('/2fa/status', requireAdminRole, (req, res) => {
    try {
      const enabled = db2fa.isTotpEnabled(req.adminUser.id);
      res.json({ ok: true, enabled, backupCodesRemaining: enabled ? db2fa.backupCodesRemaining(req.adminUser.id) : 0 });
    } catch (e) {
      res.status(500).json({ error: 'Failed to check 2FA status.' });
    }
  });

  // Step 1: generate a new secret (stored encrypted, not yet enabled).
  router.post('/2fa/setup', requireAdminRole, async (req, res) => {
    try {
      const userId = req.adminUser.id;
      if (db2fa.isTotpEnabled(userId)) {
        return res.status(400).json({ error: '2FA is already enabled. Disable it first to re-setup.' });
      }
      const secret = tf2fa.generateSecret();
      db2fa.setTotpSecret(userId, tf2fa.encryptSecret(secret));
      const otpauth = tf2fa.otpauthUrl(req.adminUser.email, secret);
      const qrDataUrl = await tf2fa.qrDataUrl(otpauth);
      logAction(userId, '2fa_setup_started', 'user', userId, {});
      res.json({ ok: true, qrDataUrl, manualKey: secret });
    } catch (e) {
      console.error('[2fa] setup failed:', e.message);
      res.status(500).json({ error: 'Failed to start 2FA setup.' });
    }
  });

  // Step 2: verify a TOTP code → enable 2FA, return backup codes (show once).
  router.post('/2fa/verify', requireAdminRole, (req, res) => {
    try {
      const userId = req.adminUser.id;
      const token = String(req.body.token || '');
      const encSecret = db2fa.getEncryptedSecret(userId);
      if (!encSecret) return res.status(400).json({ error: 'No 2FA setup in progress. Start setup first.' });
      let secret;
      try { secret = tf2fa.decryptSecret(encSecret); }
      catch { return res.status(400).json({ error: 'Setup expired. Start again.' }); }

      // Accept TOTP code OR (if already enabled, shouldn't happen here) — just TOTP.
      if (!tf2fa.verifyToken(secret, token)) {
        return res.status(401).json({ error: 'Invalid code. Try again.' });
      }
      const backupCodes = tf2fa.generateBackupCodes(10);
      const hashes = backupCodes.map(tf2fa.hashBackupCode);
      db2fa.enableTotp(userId, hashes);
      req.session.twofaVerified = true; // the verifying session is trusted
      logAction(userId, '2fa_enabled', 'user', userId, {});
      res.json({ ok: true, backupCodes }); // plain codes — frontend shows once
    } catch (e) {
      console.error('[2fa] verify failed:', e.message);
      res.status(500).json({ error: 'Failed to verify 2FA.' });
    }
  });

  // Disable 2FA (requires password confirmation).
  router.post('/2fa/disable', requireAdminRole, async (req, res) => {
    try {
      const userId = req.adminUser.id;
      const password = String(req.body.password || '');
      if (!password) return res.status(400).json({ error: 'Password required.' });
      const row = findUserByEmail(req.adminUser.email);
      if (!row || !(await verifyPassword(password, row.password_hash))) {
        return res.status(401).json({ error: 'Incorrect password.' });
      }
      db2fa.disableTotp(userId);
      req.session.twofaVerified = false;
      logAction(userId, '2fa_disabled', 'user', userId, {});
      res.json({ ok: true });
    } catch (e) {
      console.error('[2fa] disable failed:', e.message);
      res.status(500).json({ error: 'Failed to disable 2FA.' });
    }
  });

  // Verify TOTP for the current session (the login gate).
  // Accepts TOTP code or single-use backup code.
  router.post('/2fa/verify-login', requireAdminRole, (req, res) => {
    try {
      const userId = req.adminUser.id;
      const token = String(req.body.token || '').replace(/\s+/g, '');
      if (!db2fa.isTotpEnabled(userId)) {
        return res.status(400).json({ error: '2FA is not enabled for this account.' });
      }
      const encSecret = db2fa.getEncryptedSecret(userId);
      if (!encSecret) return res.status(500).json({ error: '2FA misconfigured. Contact support.' });
      let secret;
      try { secret = tf2fa.decryptSecret(encSecret); }
      catch { return res.status(500).json({ error: '2FA misconfigured. Contact support.' }); }

      // Try TOTP first, then backup codes.
      if (tf2fa.verifyToken(secret, token)) {
        req.session.twofaVerified = true;
        logAction(userId, '2fa_login_verified', 'user', userId, { method: 'totp' });
        return res.json({ ok: true });
      }
      // Backup code: format XXXX-XXXX
      if (/^[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}$/.test(token)) {
        const hash = tf2fa.hashBackupCode(token);
        if (db2fa.consumeBackupCode(userId, hash)) {
          req.session.twofaVerified = true;
          const remaining = db2fa.backupCodesRemaining(userId);
          logAction(userId, '2fa_login_verified', 'user', userId, { method: 'backup_code', remaining });
          return res.json({ ok: true, backupCode: true, remaining });
        }
      }
      logAction(userId, '2fa_login_failed', 'user', userId, {});
      return res.status(401).json({ error: 'Invalid code.' });
    } catch (e) {
      console.error('[2fa] verify-login failed:', e.message);
      res.status(500).json({ error: 'Verification failed.' });
    }
  });

  // Regenerate backup codes (requires password).
  router.post('/2fa/regenerate-codes', requireAdminRole, async (req, res) => {
    try {
      const userId = req.adminUser.id;
      if (!db2fa.isTotpEnabled(userId)) return res.status(400).json({ error: '2FA is not enabled.' });
      const password = String(req.body.password || '');
      const row = findUserByEmail(req.adminUser.email);
      if (!row || !(await verifyPassword(password, row.password_hash))) {
        return res.status(401).json({ error: 'Incorrect password.' });
      }
      const backupCodes = tf2fa.generateBackupCodes(10);
      db2fa.enableTotp(userId, backupCodes.map(tf2fa.hashBackupCode)); // re-save with new codes
      logAction(userId, '2fa_codes_regenerated', 'user', userId, {});
      res.json({ ok: true, backupCodes });
    } catch (e) {
      console.error('[2fa] regenerate failed:', e.message);
      res.status(500).json({ error: 'Failed to regenerate codes.' });
    }
  });
}

module.exports = { registerTwoFactorRoutes, twofaGate, isExempt };
