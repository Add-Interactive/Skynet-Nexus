// server/two-factor.js
// TOTP two-factor authentication for admin accounts.
// Uses otplib for RFC 6238 TOTP, qrcode for QR provisioning.
//
// Security notes:
// - TOTP secrets are encrypted at rest (AES-256-GCM) with a key derived
//   from the session secret. An attacker with DB access alone cannot use them.
// - Backup codes are stored as SHA-256 hashes and single-use.
// - The pre-2FA temp token is a stateless HMAC-signed token (5 min TTL).

const crypto = require('crypto');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

// Allow a small clock-skew window (previous/current/next 30s step).
authenticator.options = { window: 1 };

function encryptionKey() {
  const base = process.env.SESSION_SECRET || process.env.NEWSROOM_API_KEY || 'skynet-nexus-dev-fallback';
  return crypto.createHash('sha256').update('totp-enc-v1:' + base).digest();
}

function signingKey() {
  const base = process.env.SESSION_SECRET || process.env.NEWSROOM_API_KEY || 'skynet-nexus-dev-fallback';
  return crypto.createHash('sha256').update('totp-sign-v1:' + base).digest();
}

// ---------- TOTP secret management ----------

function generateSecret() {
  return authenticator.generateSecret(); // base32, 160-bit
}

function encryptSecret(plain) {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

function decryptSecret(enc) {
  const key = encryptionKey();
  const buf = Buffer.from(enc, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

function verifyToken(plainSecret, token) {
  const t = String(token || '').replace(/\s+/g, '');
  if (!/^\d{6,8}$/.test(t)) return false;
  try {
    return authenticator.verify({ token: t, secret: plainSecret });
  } catch {
    return false;
  }
}

function otpauthUrl(email, secret) {
  return authenticator.keyuri(email, 'Skynet Nexus', secret);
}

async function qrDataUrl(otpauth) {
  return QRCode.toDataURL(otpauth, { width: 240, margin: 1 });
}

// ---------- Backup codes ----------

function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const a = crypto.randomBytes(3).toString('hex').toUpperCase();
    const b = crypto.randomBytes(3).toString('hex').toUpperCase();
    codes.push(`${a.slice(0, 4)}-${b.slice(0, 4)}`);
  }
  return codes;
}

function hashBackupCode(code) {
  return crypto.createHash('sha256').update('backup-v1:' + code.toUpperCase()).digest('hex');
}

// ---------- Pre-2FA temp token (stateless, 5 min) ----------

const TEMP_TOKEN_TTL_MS = 5 * 60 * 1000;

function issueTempToken(userId) {
  const exp = Date.now() + TEMP_TOKEN_TTL_MS;
  const payload = `${userId}.${exp}`;
  const sig = crypto.createHmac('sha256', signingKey()).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

function verifyTempToken(token) {
  try {
    const raw = Buffer.from(String(token || ''), 'base64url').toString('utf8');
    const [userId, exp, sig] = raw.split('.');
    if (!userId || !exp || !sig) return null;
    if (Date.now() > Number(exp)) return null;
    const expected = crypto.createHmac('sha256', signingKey()).update(`${userId}.${exp}`).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return Number(userId);
  } catch {
    return null;
  }
}

module.exports = {
  generateSecret,
  encryptSecret,
  decryptSecret,
  verifyToken,
  otpauthUrl,
  qrDataUrl,
  generateBackupCodes,
  hashBackupCode,
  issueTempToken,
  verifyTempToken,
  TEMP_TOKEN_TTL_MS,
};
