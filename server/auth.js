// server/auth.js
// Helpers around bcryptjs + express-session.

const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function isValidEmail(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  if (t.length > 254) return false;
  // Deliberately loose but sane. Real validation happens at delivery.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function isValidPassword(s) {
  return typeof s === 'string' && s.length >= 8 && s.length <= 200;
}

function isValidDisplayName(s) {
  if (typeof s !== 'string') return false;
  const t = s.trim();
  return t.length >= 2 && t.length <= 40;
}

function isValidHexColor(s, fallback) {
  if (typeof s === 'string' && HEX_COLOR.test(s)) return s;
  return fallback;
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  try { return await bcrypt.compare(plain, hash); }
  catch { return false; }
}

// Express middleware: require an authenticated session.
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  isValidEmail,
  isValidPassword,
  isValidDisplayName,
  isValidHexColor,
  requireAuth
};
