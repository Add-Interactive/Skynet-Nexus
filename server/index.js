// server/index.js
// Skynet Nexus News — Express server.
// Serves the static site from /public, JSON manifest + articles from /data,
// and JSON API from /api/*. Node 22+ (uses node:sqlite via server/db.js).

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');

// --- Tiny .env loader (no external dep) ---
(function loadEnvFile() {
  try {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;
    const text = fs.readFileSync(envPath, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (err) {
    console.warn('[skynet] .env load skipped:', err.message);
  }
})();

const {
  createUser, findUserByEmail, findUserById, findUserRawById,
  updateLastLogin, updateUser, changePassword,
  createKid, listKids, findKid, updateKid, deleteKid
} = require('./db');
const {
  hashPassword, verifyPassword,
  isValidEmail, isValidPassword, isValidDisplayName, isValidHexColor,
  requireAuth
} = require('./auth');
const SqliteSessionStore = require('./session-store');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT) || 4180;
const SESSION_SECRET = process.env.SESSION_SECRET || (() => {
  const generated = crypto.randomBytes(32).toString('hex');
  console.warn('[skynet] WARNING: SESSION_SECRET not set, generated ephemeral secret (all sessions invalidate on restart).');
  return generated;
})();

const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Railway/reverse proxy: honor X-Forwarded-Proto for secure cookies.

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

app.use(session({
  store: new SqliteSessionStore(),
  name: 'skynet.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// ------------- API routes -------------
const api = express.Router();

// GET /api/auth/me — current user + kid profiles
api.get('/auth/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null, kids: [] });
  const user = findUserById(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.json({ user: null, kids: [] });
  }
  const kids = listKids(user.id);
  res.json({ user, kids });
});

// POST /api/auth/register — { email, password, displayName, avatarColor? }
api.post('/auth/register', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const displayName = String(req.body.displayName || '').trim();
    const avatarColor = isValidHexColor(req.body.avatarColor, '#00e5ff');

    if (!isValidEmail(email))       return res.status(400).json({ error: 'Enter a valid email.' });
    if (!isValidPassword(password)) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (!isValidDisplayName(displayName)) return res.status(400).json({ error: 'Display name must be 2–40 characters.' });

    if (findUserByEmail(email)) return res.status(409).json({ error: 'That email is already registered.' });

    const passwordHash = await hashPassword(password);
    const user = createUser({ email, displayName, passwordHash, avatarColor });
    updateLastLogin(user.id);

    req.session.regenerate(err => {
      if (err) return res.status(500).json({ error: 'Session error.' });
      req.session.userId = user.id;
      res.status(201).json({ user, kids: [] });
    });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// POST /api/auth/login — { email, password }
api.post('/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

    const row = findUserByEmail(email);
    if (!row) return res.status(401).json({ error: 'Invalid email or password.' });
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok)  return res.status(401).json({ error: 'Invalid email or password.' });

    updateLastLogin(row.id);
    const user = findUserById(row.id);
    const kids = listKids(row.id);

    req.session.regenerate(err => {
      if (err) return res.status(500).json({ error: 'Session error.' });
      req.session.userId = row.id;
      res.json({ user, kids });
    });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// POST /api/auth/logout
api.post('/auth/logout', (req, res) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed.' });
    res.clearCookie('skynet.sid');
    res.json({ ok: true });
  });
});

// PATCH /api/auth/profile — { displayName?, avatarColor? }
api.patch('/auth/profile', requireAuth, (req, res) => {
  const displayName = req.body.displayName != null ? String(req.body.displayName).trim() : null;
  const avatarColor = req.body.avatarColor != null ? isValidHexColor(req.body.avatarColor, null) : null;
  if (displayName != null && !isValidDisplayName(displayName)) {
    return res.status(400).json({ error: 'Display name must be 2–40 characters.' });
  }
  if (req.body.avatarColor && !avatarColor) {
    return res.status(400).json({ error: 'Avatar color must be a hex color like #00e5ff.' });
  }
  const user = updateUser({ id: req.session.userId, displayName, avatarColor });
  res.json({ user });
});

// POST /api/auth/change-password — { currentPassword, newPassword }
api.post('/auth/change-password', requireAuth, async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (!isValidPassword(newPassword)) return res.status(400).json({ error: 'New password must be at least 8 characters.' });

  const row = findUserRawById(req.session.userId);
  if (!row) return res.status(401).json({ error: 'unauthorized' });
  const ok = await verifyPassword(currentPassword, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password is wrong.' });

  const hash = await hashPassword(newPassword);
  changePassword(req.session.userId, hash);
  res.json({ ok: true });
});

// ---- Kid profiles ----
const CURRENT_YEAR = new Date().getFullYear();
function isValidBirthYear(y) { const n = Number(y); return Number.isInteger(n) && n >= CURRENT_YEAR - 25 && n <= CURRENT_YEAR; }

api.get('/kids', requireAuth, (req, res) => {
  res.json({ kids: listKids(req.session.userId) });
});

api.post('/kids', requireAuth, (req, res) => {
  const name = String(req.body.name || '').trim();
  const birthYear = Number(req.body.birthYear);
  const avatarColor = isValidHexColor(req.body.avatarColor, '#39ff14');
  const avatarEmoji = typeof req.body.avatarEmoji === 'string' && req.body.avatarEmoji.length <= 4
    ? req.body.avatarEmoji : '🚀';
  if (name.length < 1 || name.length > 40) return res.status(400).json({ error: "Kid's name must be 1–40 characters." });
  if (!isValidBirthYear(birthYear)) return res.status(400).json({ error: 'Birth year must be a realistic year for a kid.' });
  const kids = listKids(req.session.userId);
  if (kids.length >= 6) return res.status(400).json({ error: 'Up to 6 kid profiles per account.' });

  const kid = createKid({ userId: req.session.userId, name, birthYear, avatarColor, avatarEmoji });
  res.status(201).json({ kid });
});

api.patch('/kids/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid kid id.' });
  const found = findKid(id, req.session.userId);
  if (!found) return res.status(404).json({ error: 'Not found.' });

  const name = req.body.name != null ? String(req.body.name).trim() : null;
  const birthYear = req.body.birthYear != null ? Number(req.body.birthYear) : null;
  const avatarColor = req.body.avatarColor != null ? isValidHexColor(req.body.avatarColor, null) : null;
  const avatarEmoji = req.body.avatarEmoji != null ? String(req.body.avatarEmoji).slice(0, 4) : null;

  if (name != null && (name.length < 1 || name.length > 40)) return res.status(400).json({ error: "Kid's name must be 1–40 characters." });
  if (birthYear != null && !isValidBirthYear(birthYear)) return res.status(400).json({ error: 'Birth year must be realistic.' });
  if (req.body.avatarColor && !avatarColor) return res.status(400).json({ error: 'Avatar color must be hex like #39ff14.' });

  const kid = updateKid({ id, userId: req.session.userId, name, birthYear, avatarColor, avatarEmoji });
  res.json({ kid });
});

api.delete('/kids/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid kid id.' });
  const deleted = deleteKid(id, req.session.userId);
  if (!deleted) return res.status(404).json({ error: 'Not found.' });
  res.json({ ok: true });
});

// GET /api/manifest — passthrough (filesystem read; cached client-side).
api.get('/manifest', (req, res) => {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'manifest.json'), 'utf8');
    res.type('application/json').send(raw);
  } catch (err) {
    console.error('[manifest]', err);
    res.status(500).json({ error: 'Manifest unavailable.' });
  }
});

app.use('/api', api);

// ------------- Static content -------------
// /data/... maps to data/... at repo root.
app.use('/data', express.static(DATA_DIR, {
  fallthrough: false,
  maxAge: IS_PROD ? '5m' : 0,
  etag: true
}));

// Everything else -> /public.
app.use(express.static(PUBLIC_DIR, {
  maxAge: IS_PROD ? '1h' : 0,
  etag: true,
  extensions: ['html']
}));

// 404 fallback for unknown non-API paths -> homepage (SPA-ish soft fallback).
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('[error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Server error.' });
});

app.listen(PORT, () => {
  console.log(`[skynet] listening on http://localhost:${PORT}`);
  console.log(`[skynet] public:  ${PUBLIC_DIR}`);
  console.log(`[skynet] data:    ${DATA_DIR}`);
  console.log(`[skynet] session: ${IS_PROD ? 'secure' : 'insecure (dev)'} cookies`);
});
