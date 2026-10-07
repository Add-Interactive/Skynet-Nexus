// server/two-factor-db.js
// Database layer for TOTP 2FA. Separate module to avoid touching server/db.js
// (which exceeds the GitHub API file-size limit for direct edits).
//
// Adds three columns to users (idempotent ALTER TABLE on require):
//   totp_secret       TEXT  — AES-256-GCM encrypted TOTP secret
//   totp_enabled      INTEGER DEFAULT 0
//   totp_backup_codes TEXT  — JSON array of SHA-256 backup code hashes

const { db } = require('./db');

// Idempotent schema migration.
for (const [col, type] of [
  ['totp_secret', 'TEXT'],
  ['totp_enabled', 'INTEGER DEFAULT 0'],
  ['totp_backup_codes', 'TEXT'],
]) {
  try { db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`); }
  catch (e) { /* already exists */ }
}

const stmts = {
  setSecret: db.prepare(`UPDATE users SET totp_secret = ? WHERE id = ?`),
  setEnabled: db.prepare(`UPDATE users SET totp_enabled = ?, totp_backup_codes = ? WHERE id = ?`),
  clear: db.prepare(`UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_backup_codes = NULL WHERE id = ?`),
  getRow: db.prepare(`SELECT id, totp_secret, totp_enabled, totp_backup_codes FROM users WHERE id = ?`),
  setBackupCodes: db.prepare(`UPDATE users SET totp_backup_codes = ? WHERE id = ?`),
};

function getTotpRow(id) {
  return stmts.getRow.get(id) || null;
}

function isTotpEnabled(id) {
  const row = getTotpRow(id);
  return !!(row && row.totp_enabled);
}

function setTotpSecret(id, encryptedSecret) {
  stmts.setSecret.run(encryptedSecret, id);
}

function getEncryptedSecret(id) {
  const row = getTotpRow(id);
  return row ? row.totp_secret : null;
}

function enableTotp(id, backupCodeHashes) {
  stmts.setEnabled.run(1, JSON.stringify(backupCodeHashes), id);
}

function disableTotp(id) {
  stmts.clear.run(id);
}

function getBackupCodeHashes(id) {
  const row = getTotpRow(id);
  if (!row || !row.totp_backup_codes) return [];
  try { return JSON.parse(row.totp_backup_codes); } catch { return []; }
}

// Atomically consume a backup code (single-use). Returns true if valid.
function consumeBackupCode(id, hash) {
  const hashes = getBackupCodeHashes(id);
  const idx = hashes.indexOf(hash);
  if (idx === -1) return false;
  hashes.splice(idx, 1);
  stmts.setBackupCodes.run(JSON.stringify(hashes), id);
  return true;
}

function backupCodesRemaining(id) {
  return getBackupCodeHashes(id).length;
}

module.exports = {
  getTotpRow,
  isTotpEnabled,
  setTotpSecret,
  getEncryptedSecret,
  enableTotp,
  disableTotp,
  getBackupCodeHashes,
  consumeBackupCode,
  backupCodesRemaining,
};
