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
  createKid, listKids, findKid, updateKid, deleteKid,
  deleteUser,
  createPasswordReset, findPasswordReset, markPasswordResetUsed, purgeExpiredResets,
  addNewsletter, listNewsletter, countNewsletter,
  createSubmission, findStaffBySlug, setUserRole
} = require('./db');
const {
  hashPassword, verifyPassword,
  isValidEmail, isValidPassword, isValidDisplayName, isValidHexColor,
  requireAuth
} = require('./auth');
const SqliteSessionStore = require('./session-store');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const { DATA_DIR } = require('./storage');
const PORT = Number(process.env.PORT) || 4180;
const SESSION_SECRET = process.env.SESSION_SECRET || (() => {
  const generated = crypto.randomBytes(32).toString('hex');
  console.warn('[skynet] WARNING: SESSION_SECRET not set, generated ephemeral secret (all sessions invalidate on restart).');
  return generated;
})();

const IS_PROD = process.env.NODE_ENV === 'production';
const SITE_ORIGIN = process.env.SITE_ORIGIN || (IS_PROD
  ? 'https://skynet-nexus-production.up.railway.app'
  : `http://localhost:${Number(process.env.PORT) || 4180}`);

// --- Simple in-memory rate limiter (per-IP + route bucket) ---
const RATE_BUCKETS = new Map();
function rateLimit({ windowMs = 60_000, max = 20, key = 'default' } = {}) {
  return (req, res, next) => {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString().split(',')[0].trim();
    const now = Date.now();
    const bucketKey = key + ':' + ip;
    const entry = RATE_BUCKETS.get(bucketKey);
    if (!entry || entry.resetAt < now) {
      RATE_BUCKETS.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Slow down and try again in a bit.' });
    }
    next();
  };
}
// Cleanup buckets every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of RATE_BUCKETS) if (v.resetAt < now) RATE_BUCKETS.delete(k);
}, 10 * 60 * 1000).unref();

// Cleanup expired password resets every hour
setInterval(() => {
  try { purgeExpiredResets(); } catch (e) {}
}, 60 * 60 * 1000).unref();

// Admin key for /api/newsletter/export etc.
const ADMIN_KEY = process.env.ADMIN_KEY || null;
function requireAdmin(req, res, next) {
  const provided = req.query.key || req.headers['x-admin-key'];
  if (!ADMIN_KEY) return res.status(503).json({ error: 'Admin API disabled: ADMIN_KEY not configured.' });
  if (provided !== ADMIN_KEY) return res.status(401).json({ error: 'unauthorized' });
  next();
}

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
api.post('/auth/register', rateLimit({ windowMs: 15 * 60_000, max: 8, key: 'register' }), async (req, res) => {
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
api.post('/auth/login', rateLimit({ windowMs: 15 * 60_000, max: 20, key: 'login' }), async (req, res) => {
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
api.post('/auth/change-password', requireAuth, rateLimit({ windowMs: 15 * 60_000, max: 10, key: 'changepw' }), async (req, res) => {
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

// DELETE /api/auth/account — nukes the parent + all kid profiles (COPPA right-to-delete)
api.delete('/auth/account', requireAuth, rateLimit({ windowMs: 60_000, max: 4, key: 'delacct' }), async (req, res) => {
  const password = String((req.body && req.body.password) || '');
  const raw = findUserRawById(req.session.userId);
  if (!raw) return res.status(401).json({ error: 'unauthorized' });
  const ok = await verifyPassword(password, raw.password_hash);
  if (!ok) return res.status(401).json({ error: 'Password incorrect.' });
  const uid = req.session.userId;
  req.session.destroy(() => {
    res.clearCookie('skynet.sid');
    deleteUser(uid); // cascades kids + password_resets
    res.json({ ok: true, deleted: true });
  });
});

// POST /api/auth/password-reset — { email }
// Always returns 200 (never reveal which emails exist). Logs the token to server console
// until email delivery is wired.
api.post('/auth/password-reset', rateLimit({ windowMs: 15 * 60_000, max: 6, key: 'pwreset' }), (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (isValidEmail(email)) {
    const user = findUserByEmail(email);
    if (user) {
      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
      createPasswordReset({ userId: user.id, token, expiresAt });
      const link = `${SITE_ORIGIN}/pages/password-reset.html?token=${encodeURIComponent(token)}`;
      console.log(`[skynet] password reset requested for ${email} — link (deliver via email once SMTP wired): ${link}`);
    }
  }
  res.json({ ok: true, message: 'If that email exists, a reset link has been logged.' });
});

// POST /api/auth/password-reset/confirm — { token, newPassword }
api.post('/auth/password-reset/confirm', rateLimit({ windowMs: 15 * 60_000, max: 10, key: 'pwresetconfirm' }), async (req, res) => {
  const token = String((req.body && req.body.token) || '').trim();
  const newPassword = String((req.body && req.body.newPassword) || '');
  if (!token) return res.status(400).json({ error: 'Missing token.' });
  if (!isValidPassword(newPassword)) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const reset = findPasswordReset(token);
  if (!reset) return res.status(400).json({ error: 'Invalid or expired token.' });
  const hash = await hashPassword(newPassword);
  changePassword(reset.userId, hash);
  markPasswordResetUsed(token);
  res.json({ ok: true, message: 'Password updated. You can sign in with your new password.' });
});

// POST /api/newsletter — { email, kidCount? }
api.post('/newsletter', rateLimit({ windowMs: 60_000, max: 6, key: 'newsletter' }), (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const kidCount = Math.max(0, Math.min(20, Number((req.body && req.body.kidCount) || 0) | 0));
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  const { inserted } = addNewsletter({ email, source: 'site', kidCount });
  res.json({ ok: true, alreadySubscribed: !inserted });
});

// GET /api/newsletter/export?key=ADMIN — CSV export
api.get('/newsletter/export', requireAdmin, (req, res) => {
  const rows = listNewsletter();
  const csv = ['email,source,kid_count,created_at']
    .concat(rows.map(r => [r.email, r.source, r.kid_count, r.created_at].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')))
    .join('\n');
  res.type('text/csv').set('Content-Disposition', 'attachment; filename="newsletter.csv"').send(csv);
});

// GET /api/newsletter/stats?key=ADMIN — quick count
api.get('/newsletter/stats', requireAdmin, (req, res) => {
  res.json({ count: countNewsletter() });
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

// ---- Public story submission (readers send tips) ----
const { SUBMISSION_IDS: SUBMISSION_CHANNELS, CHANNELS: CHANNEL_LIST } = require('./channels');
const scheduler = require('./scheduler');

// GET /api/schedule — public cadence info for the submit page + homepage countdown.
api.get('/schedule', (req, res) => {
  res.json(scheduler.scheduleInfo());
});

// GET /api/channels — public channel registry (id/label/icon/color).
api.get('/channels', (req, res) => {
  res.json({ channels: CHANNEL_LIST });
});

// ---- RSS feed aggregation (curated, kid-safe, cached) ----
const rss = require('./rss');

// GET /api/rss/feeds[?channel=ai] — curated feed registry (source picker).
api.get('/rss/feeds', (req, res) => {
  const channel = req.query.channel ? String(req.query.channel).toLowerCase() : null;
  res.set('Cache-Control', 'public, max-age=300');
  res.json(rss.getRegistry(channel));
});

// GET /api/rss?channel=ai  OR  /api/rss?feeds=id1,id2 — aggregated items.
api.get('/rss', async (req, res) => {
  try {
    const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 40));
    res.set('Cache-Control', 'public, max-age=300');
    if (req.query.feeds) {
      const ids = String(req.query.feeds).split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
      const out = await rss.aggregateFeeds(ids, { limit });
      return res.json(out);
    }
    const channel = String(req.query.channel || '').toLowerCase();
    if (!channel) return res.status(400).json({ error: 'channel or feeds parameter required.' });
    const onlyDefault = req.query.all !== '1';
    const out = await rss.aggregateChannel(channel, { onlyDefault, limit });
    res.json(out);
  } catch (err) {
    console.error('[rss]', err);
    res.status(500).json({ error: 'Feed aggregation failed.' });
  }
});

api.post('/submissions', rateLimit({ windowMs: 60 * 60_000, max: 8, key: 'submissions' }), (req, res) => {
  try {
    const b = req.body || {};
    const channel = String(b.channel || '').trim().toLowerCase();
    const title = String(b.title || '').trim();
    const summary = String(b.summary || '').trim();
    const body = b.body ? String(b.body).trim() : null;
    const sourceUrl = b.sourceUrl ? String(b.sourceUrl).trim() : null;
    const submitterName = b.submitterName ? String(b.submitterName).trim().slice(0, 80) : null;
    const submitterEmail = b.submitterEmail ? String(b.submitterEmail).trim().slice(0, 200).toLowerCase() : null;

    if (!SUBMISSION_CHANNELS.has(channel)) return res.status(400).json({ error: 'channel must be one of the live Skynet Nexus channels.' });
    if (title.length < 6 || title.length > 200) return res.status(400).json({ error: 'title must be 6-200 chars.' });
    if (summary.length < 20 || summary.length > 800) return res.status(400).json({ error: 'summary must be 20-800 chars.' });
    if (body && body.length > 6000) return res.status(400).json({ error: 'body too long (max 6000).' });
    if (submitterEmail && submitterEmail.length && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
      return res.status(400).json({ error: 'invalid submitter email.' });
    }
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
      return res.status(400).json({ error: 'sourceUrl must start with http(s)://' });
    }

    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
    const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32) : null;

    const submission = createSubmission({
      submitterName, submitterEmail,
      submitterUserId: req.session && req.session.userId ? req.session.userId : null,
      channel, title, summary, body, sourceUrl, ipHash
    });
    res.status(201).json({ ok: true, submission: { id: submission.id, status: submission.status } });
  } catch (err) {
    console.error('[submissions]', err);
    res.status(500).json({ error: 'Submission failed. Please try again.' });
  }
});

app.use('/api', api);

// -------------- ADMIN ROUTER --------------
app.use('/api/admin', require('./admin-routes'));

// -------------- SEED ADMIN ACCOUNT (env-driven, one-time) --------------
// Ensures the primary admin account exists AND has role='admin'. Reads
// ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD from the environment (Railway vars or
// .env) and falls back to the project's default owner account so the portal is
// reachable on a fresh deploy. Idempotent: safe to run on every boot.
(async function seedAdminAccount() {
  const email = (process.env.ADMIN_SEED_EMAIL || 'ageofai2024@gmail.com').trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD || 'weed4200';
  const displayName = (process.env.ADMIN_SEED_DISPLAY_NAME || 'Age of AI').trim();
  if (!email || !password) return;
  try {
    const { hashPassword, verifyPassword } = require('./auth');
    let user = findUserByEmail(email);
    if (!user) {
      const hash = await hashPassword(password);
      const created = createUser({ email, displayName, passwordHash: hash, avatarColor: '#00e5ff' });
      setUserRole(created.id, 'admin');
      console.log(`[skynet] seeded admin account: ${email}`);
    } else {
      if (user.role !== 'admin') {
        setUserRole(user.id, 'admin');
        console.log(`[skynet] promoted existing account to admin: ${email}`);
      }
      // If this account has never been logged into, make sure the documented
      // seed password still works (repairs a stale seed without ever clobbering
      // a password the owner set themselves after signing in).
      if (!user.last_login_at) {
        const raw = findUserRawById(user.id);
        const ok = raw && await verifyPassword(password, raw.password_hash);
        if (!ok) {
          changePassword(user.id, await hashPassword(password));
          console.log(`[skynet] reset admin seed password for: ${email}`);
        }
      }
    }
  } catch (err) {
    console.warn('[skynet] admin seed failed:', err.message);
  }
})();

// favicon.ico — modern browsers already use <link rel="icon" ...> but older crawlers still hit /favicon.ico
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'assets', 'img', 'favicon-32.png'), {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' }
  });
});

// ------------- SEO + feed routes -------------
// robots.txt
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /pages/profile.html',
    'Disallow: /pages/login.html',
    'Disallow: /pages/register.html',
    'Disallow: /pages/password-reset.html',
    '',
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    '',
    '# Skynet Nexus News is a family-first publication.',
    '# We do not run tracking on children and do not sell any user data.'
  ].join('\n') + '\n');
});

function loadManifestSafe() {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'manifest.json'), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return { articles: [] };
  }
}

function loadArticleSafe(refPath) {
  try {
    const abs = path.join(DATA_DIR, String(refPath).replace(/^\/+/, '').replace(/^data\//, ''));
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) { return null; }
}

function xmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// sitemap.xml — static pages + every article
app.get('/sitemap.xml', (req, res) => {
  const manifest = loadManifestSafe();
  const urls = [
    { loc: SITE_ORIGIN + '/', changefreq: 'daily', priority: '1.0' },
    { loc: SITE_ORIGIN + '/pages/archive.html', changefreq: 'daily', priority: '0.8' },
    { loc: SITE_ORIGIN + '/pages/about.html', changefreq: 'monthly', priority: '0.6' },
    { loc: SITE_ORIGIN + '/pages/contact.html', changefreq: 'monthly', priority: '0.4' },
    { loc: SITE_ORIGIN + '/pages/privacy.html', changefreq: 'monthly', priority: '0.4' },
    { loc: SITE_ORIGIN + '/pages/stem.html', changefreq: 'daily', priority: '0.7' },
    { loc: SITE_ORIGIN + '/pages/robotics.html', changefreq: 'daily', priority: '0.7' },
    { loc: SITE_ORIGIN + '/pages/play.html', changefreq: 'daily', priority: '0.7' },
    { loc: SITE_ORIGIN + '/pages/music.html', changefreq: 'daily', priority: '0.7' },
    { loc: SITE_ORIGIN + '/pages/events.html', changefreq: 'weekly', priority: '0.6' },
    { loc: SITE_ORIGIN + '/pages/leaderboard.html', changefreq: 'weekly', priority: '0.5' },
  ];
  for (const a of (manifest.articles || [])) {
    urls.push({
      loc: SITE_ORIGIN + '/pages/article.html?id=' + encodeURIComponent(a.id),
      lastmod: (a.date || '').slice(0, 10) || undefined,
      changefreq: 'monthly',
      priority: '0.7'
    });
  }
  const body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => '  <url>\n' +
      '    <loc>' + xmlEscape(u.loc) + '</loc>\n' +
      (u.lastmod ? '    <lastmod>' + xmlEscape(u.lastmod) + '</lastmod>\n' : '') +
      (u.changefreq ? '    <changefreq>' + u.changefreq + '</changefreq>\n' : '') +
      (u.priority ? '    <priority>' + u.priority + '</priority>\n' : '') +
      '  </url>').join('\n') +
    '\n</urlset>\n';
  res.type('application/xml').send(body);
});

// rss.xml — the last 40 articles
app.get('/rss.xml', (req, res) => {
  const manifest = loadManifestSafe();
  const items = (manifest.articles || [])
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 40);
  const build = new Date().toUTCString();
  const body = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
    '<channel>\n' +
    '  <title>Skynet Nexus News</title>\n' +
    '  <link>' + xmlEscape(SITE_ORIGIN) + '</link>\n' +
    '  <description>Family-first daily news: STEM, robotics, play &amp; design, and music for readers ages 5–50.</description>\n' +
    '  <language>en-us</language>\n' +
    '  <lastBuildDate>' + xmlEscape(build) + '</lastBuildDate>\n' +
    '  <copyright>© 2026 Add Interactive Studio, in partnership with STEM Nexus</copyright>\n' +
    '  <managingEditor>editor@addinteractive.com (Skynet Nexus Newsroom / Add Interactive Studio)</managingEditor>\n' +
    '  <atom:link href="' + xmlEscape(SITE_ORIGIN + '/rss.xml') + '" rel="self" type="application/rss+xml"/>\n' +
    items.map(a => {
      const link = SITE_ORIGIN + '/pages/article.html?id=' + encodeURIComponent(a.id);
      const pub = a.date ? new Date(a.date).toUTCString() : build;
      const cat = a.cat ? '<category>' + xmlEscape(a.cat) + '</category>' : '';
      const authorTag = a.author ? '<author>noreply@skynet.local (' + xmlEscape(a.author) + ')</author>' : '';
      return '  <item>\n' +
        '    <title>' + xmlEscape(a.title || 'Untitled') + '</title>\n' +
        '    <link>' + xmlEscape(link) + '</link>\n' +
        '    <guid isPermaLink="true">' + xmlEscape(link) + '</guid>\n' +
        '    <pubDate>' + xmlEscape(pub) + '</pubDate>\n' +
        '    ' + cat + '\n' +
        '    ' + authorTag + '\n' +
        '    <description>' + xmlEscape(a.excerpt || '') + '</description>\n' +
        '  </item>';
    }).join('\n') +
    '\n</channel>\n</rss>\n';
  res.type('application/rss+xml').send(body);
});

// ------------- Static content -------------
// /data/... maps to data/... at repo root.
app.use('/data', express.static(DATA_DIR, {
  fallthrough: false,
  maxAge: IS_PROD ? '5m' : 0,
  etag: true
}));

// Everything else -> /public.
app.use(express.static(PUBLIC_DIR, {
  etag: true,
  extensions: ['html'],
  setHeaders(res, filePath) {
    // Code/markup must revalidate so deploys propagate immediately (ETag -> 304
    // when unchanged). Media can be cached for longer.
    if (/\.(html|js|css|json)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', IS_PROD ? 'public, max-age=86400' : 'no-cache');
    }
  }
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
  scheduler.start();
});
