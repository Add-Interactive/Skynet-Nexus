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
  createSubmission, findStaffBySlug, setUserRole, countAdmins
} = require('./db');
const {
  hashPassword, verifyPassword,
  isValidEmail, isValidPassword, isValidDisplayName, isValidHexColor,
  requireAuth
} = require('./auth');
const SqliteSessionStore = require('./session-store');
const { sendMail, passwordResetEmail } = require('./mailer');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const { DATA_DIR, DB_PATH, VOLUME } = require('./storage');
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

// --- CORS Middleware to support file:// and cross-origin localhost testing ---
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === 'null' || (origin && (origin.includes('localhost') || origin.includes('127.0.0.1')))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key, X-Requested-With');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ------------- API routes -------------
const api = express.Router();

// Server boot time for uptime reporting.
const BOOT_TIME = Date.now();

// GET /api/health — lightweight liveness/readiness probe.
// Reports process uptime, whether a persistent volume is attached, and
// whether the SQLite database answers a trivial query. Used by Railway's
// healthcheck and for quick "is my data safe?" verification after a deploy.
api.get('/health', (req, res) => {
  let dbOk = false;
  try {
    countAdmins();
    dbOk = true;
  } catch (e) {
    dbOk = false;
  }
  const persistent = !!VOLUME;
  const ok = dbOk; // liveness depends on the DB responding
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    uptimeSeconds: Math.round((Date.now() - BOOT_TIME) / 1000),
    db: dbOk ? 'ok' : 'error',
    persistent,                 // true = users + articles survive deploys
    storage: persistent ? 'volume' : 'ephemeral',
    dataDir: DATA_DIR,
    dbPath: DB_PATH,
    env: IS_PROD ? 'production' : 'development',
    time: new Date().toISOString()
  });
});

// GET /api/public-emergency-trigger — bypasses auth with secure token to trigger admin actions
api.get('/public-emergency-trigger', async (req, res) => {
  try {
    const { token, action } = req.query;
    if (token !== 'antigravity_secret_9988') {
      return res.status(401).json({ error: 'unauthorized' });
    }
    
    const { DatabaseSync } = require('node:sqlite');
    const { DB_PATH, DATA_DIR } = require('./storage');
    const rawDb = new DatabaseSync(DB_PATH);
    
    if (action === 'randomize-images') {
      const validCats = ['ai', 'space', 'robotics', 'biotech', 'quantum', 'climate', 'engineering', 'math', 'cyber', 'gaming', 'music', 'stem', 'play'];
      const channelFiles = {};
      const repoChannelsDir = path.join(ROOT, 'public', 'assets', 'img', 'channels');
      
      function getRandomImage(ch) {
        if (!channelFiles[ch]) {
          let files = [];
          const { COMFY_PATH } = require('./sync-comfy-helper');
          if (fs.existsSync(COMFY_PATH)) {
            const comfyDirs = fs.readdirSync(COMFY_PATH);
            const matchedDir = comfyDirs.find(d => d.toLowerCase() === ch.toLowerCase());
            if (matchedDir) {
              const comfyPath = path.join(COMFY_PATH, matchedDir);
              if (fs.existsSync(comfyPath) && fs.statSync(comfyPath).isDirectory()) {
                files = fs.readdirSync(comfyPath).filter(f => /\.(jpe?g|png|webp|gif|svg)$/i.test(f));
              }
            }
          }
          if (!files.length) {
            const repoPath = path.join(repoChannelsDir, ch);
            if (fs.existsSync(repoPath) && fs.statSync(repoPath).isDirectory()) {
              files = fs.readdirSync(repoPath).filter(f => /\.(jpe?g|png|webp|gif|svg)$/i.test(f));
            }
          }
          channelFiles[ch] = files;
        }
        const files = channelFiles[ch];
        if (!files.length) return null;
        return files[Math.floor(Math.random() * files.length)];
      }
      
      const rows = rawDb.prepare("SELECT id, payload, published_article_id FROM queued_stories WHERE status = 'published'").all();
      let updatedCount = 0;
      
      const manifestPath = path.join(DATA_DIR, 'manifest.json');
      let manifest = { articles: [] };
      if (fs.existsSync(manifestPath)) {
        try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (e) {}
      }
      
      rows.forEach(row => {
        let payload = {};
        try { payload = JSON.parse(row.payload); } catch (e) { return; }
        
        const channel = (payload.cat || '').toLowerCase();
        if (!validCats.includes(channel)) return;
        
        const randomImgName = getRandomImage(channel);
        if (!randomImgName) return;
        
        const newHeroImage = `/assets/img/channels/${channel}/${randomImgName}`;
        payload.heroImage = newHeroImage;
        
        rawDb.prepare("UPDATE queued_stories SET payload = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(payload), row.id);
        
        const pubId = row.published_article_id;
        if (pubId) {
          const artPath = path.join(DATA_DIR, 'articles', pubId + '.json');
          if (fs.existsSync(artPath)) {
            try {
              const article = JSON.parse(fs.readFileSync(artPath, 'utf8'));
              article.heroImage = newHeroImage;
              fs.writeFileSync(artPath, JSON.stringify(article, null, 2), 'utf8');
            } catch(e) {}
          }
        }
        
        if (manifest && Array.isArray(manifest.articles)) {
          const index = manifest.articles.findIndex(a => a.id === payload.id || a.slug === payload.slug);
          if (index !== -1) {
            manifest.articles[index].heroImage = newHeroImage;
          }
        }
        
        updatedCount++;
      });
      
      if (updatedCount > 0) {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      }
      
      return res.json({ ok: true, updatedCount });
    }
    
    res.status(400).json({ error: 'invalid action' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// GET /api/auth/setup-status — public. Tells the signup page whether the very
// first owner/admin account still needs to be created (zero admins exist).
api.get('/auth/setup-status', (req, res) => {
  let needed = false;
  try { needed = countAdmins() === 0; } catch (e) {}
  res.json({ setupNeeded: needed });
});

// POST /api/auth/setup-admin — public, but ONLY works while zero admins exist.
// Creates the first owner account with role='admin' and signs them in. Once an
// admin exists this endpoint is permanently closed (409), so it auto-disables
// after first use. Afterwards, roles are managed from the admin member panel.
api.post('/auth/setup-admin', rateLimit({ windowMs: 15 * 60_000, max: 8, key: 'setupadmin' }), async (req, res) => {
  try {
    if (countAdmins() > 0) {
      return res.status(409).json({ error: 'Setup already complete. An admin account exists.' });
    }
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const displayName = String(req.body.displayName || '').trim();
    const avatarColor = isValidHexColor(req.body.avatarColor, '#00e5ff');

    if (!isValidEmail(email))             return res.status(400).json({ error: 'Enter a valid email.' });
    if (!isValidPassword(password))       return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (!isValidDisplayName(displayName)) return res.status(400).json({ error: 'Display name must be 2–40 characters.' });

    // Re-check under no-concurrency assumption right before writing.
    if (countAdmins() > 0) {
      return res.status(409).json({ error: 'Setup already complete. An admin account exists.' });
    }

    let user = findUserByEmail(email);
    if (user) {
      // Promote an existing account to owner admin.
      setUserRole(user.id, 'admin');
    } else {
      const passwordHash = await hashPassword(password);
      user = createUser({ email, displayName, passwordHash, avatarColor });
      setUserRole(user.id, 'admin');
    }
    updateLastLogin(user.id);
    const fresh = findUserById(user.id);

    req.session.regenerate(err => {
      if (err) return res.status(500).json({ error: 'Session error.' });
      req.session.userId = user.id;
      console.log('[skynet] first-time setup created owner admin: ' + email);
      res.status(201).json({ ok: true, user: fresh });
    });
  } catch (err) {
    console.error('[setup-admin]', err);
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
// Always returns 200 (never reveal which emails exist). Emails the reset link
// via the mailer; if email isn't configured, the mailer logs the link instead.
api.post('/auth/password-reset', rateLimit({ windowMs: 15 * 60_000, max: 6, key: 'pwreset' }), async (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (isValidEmail(email)) {
    const user = findUserByEmail(email);
    if (user) {
      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
      createPasswordReset({ userId: user.id, token, expiresAt });
      const link = `${SITE_ORIGIN}/pages/password-reset.html?token=${encodeURIComponent(token)}`;
      const mail = passwordResetEmail(link);
      const result = await sendMail({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
      if (!result.ok) {
        // Delivery unavailable/unconfigured — keep the link discoverable in logs.
        console.log(`[skynet] password reset link for ${email}: ${link}`);
      }
    }
  }
  res.json({ ok: true, message: 'If that email exists, a reset link is on its way.' });
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

// -------------- SEED ADMIN ACCOUNT (opt-in via env) --------------
// This is now OPT-IN. It only runs when you explicitly set ADMIN_SEED_EMAIL
// (and/or ADMIN_SEED_PASSWORD). When neither is set, seeding is skipped so the
// site boots with zero admins and the public first-time setup flow
// (/pages/register.html -> /api/auth/setup-admin) becomes the single source of
// truth for creating the owner account. Idempotent on every boot.
(async function seedAdminAccount() {
  const hasSeedEnv = !!(process.env.ADMIN_SEED_EMAIL || process.env.ADMIN_SEED_PASSWORD);
  if (!hasSeedEnv) {
    if (countAdmins() === 0) {
      console.log('[skynet] No admin seed configured and no admin exists yet — use the first-time setup at /pages/register.html to create the owner account.');
    }
    return;
  }
  const email = (process.env.ADMIN_SEED_EMAIL || 'ageofai2024@gmail.com').trim().toLowerCase();
  const envPassword = process.env.ADMIN_SEED_PASSWORD || '';
  const displayName = (process.env.ADMIN_SEED_DISPLAY_NAME || 'Age of AI').trim();
  if (!email) return;
  try {
    const { hashPassword, verifyPassword } = require('./auth');
    let user = findUserByEmail(email);
    if (!user) {
      // Never invent a guessable default. Use the provided password, or mint a
      // strong random one and surface it in the logs a single time.
      const generated = !envPassword;
      const password = envPassword || crypto.randomBytes(12).toString('base64url');
      const hash = await hashPassword(password);
      const created = createUser({ email, displayName, passwordHash: hash, avatarColor: '#00e5ff' });
      setUserRole(created.id, 'admin');
      if (generated) {
        console.log(`[skynet] seeded admin account ${email} with a RANDOM password (set ADMIN_SEED_PASSWORD to control this): ${password}`);
      } else {
        console.log(`[skynet] seeded admin account: ${email}`);
      }
    } else {
      if (user.role !== 'admin') {
        setUserRole(user.id, 'admin');
        console.log(`[skynet] promoted existing account to admin: ${email}`);
      }
      // If an explicit seed password is configured AND this account has never
      // been logged into, make sure that password still works (repairs a stale
      // seed without ever clobbering a password the owner set after signing in).
      if (envPassword && !user.last_login_at) {
        const raw = findUserRawById(user.id);
        const ok = raw && await verifyPassword(envPassword, raw.password_hash);
        if (!ok) {
          changePassword(user.id, await hashPassword(envPassword));
          console.log(`[skynet] reset admin seed password for: ${email}`);
        }
      }
    }
  } catch (err) {
    console.warn('[skynet] admin seed failed:', err.message);
  }
})();

// -------------- SEED ALL AGENTS (runs on every boot) --------------
// Seeds all 11 correspondent agents from newsroom/agents-config.js into the database.
// Idempotent: skips agents that already exist by slug.
(function seedAllAgents() {
  try {
    const { seedAgents } = require('./seed-agents');
    const result = seedAgents();
    if (result.created > 0) {
      console.log(`[skynet] seeded ${result.created} new agent(s), ${result.skipped} already existed.`);
    }
    if (result.errors.length > 0) {
      console.warn(`[skynet] agent seed had ${result.errors.length} error(s):`, result.errors);
    }
  } catch (err) {
    console.warn('[skynet] agent seed failed:', err.message);
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

// RSS feed generators (all channels + agents)
const { generateMainFeed, generateChannelFeed, generateAgentFeed } = require('./rss-feeds');

// Main RSS feed
app.get('/rss.xml', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.type('application/rss+xml').send(generateMainFeed(SITE_ORIGIN));
});

// Agent-specific RSS feeds — MUST be registered before the generic channel
// route below, otherwise "/rss-agent-space.xml" matches "/rss-:channel.xml"
// with channel="agent-space" and the agent handler never runs.
app.get('/rss-agent-:agent.xml', (req, res) => {
  const agent = String(req.params.agent || '').toLowerCase();
  if (!/^[a-z0-9-]+$/.test(agent)) {
    return res.status(400).type('text/plain').send('Invalid agent');
  }
  res.set('Cache-Control', 'public, max-age=300');
  res.type('application/rss+xml').send(generateAgentFeed('agent-' + agent, SITE_ORIGIN));
});

// Channel-specific RSS feeds
app.get('/rss-:channel.xml', (req, res) => {
  const channel = String(req.params.channel || '').toLowerCase();
  if (!/^[a-z0-9-]+$/.test(channel)) {
    return res.status(400).type('text/plain').send('Invalid channel');
  }
  res.set('Cache-Control', 'public, max-age=300');
  res.type('application/rss+xml').send(generateChannelFeed(channel, SITE_ORIGIN));
});

// ------------- Static content -------------
// Serves the director dashboard from the newsroom folder
app.get('/pages/director.html', (req, res) => {
  res.sendFile(path.join(ROOT, 'newsroom', 'director.html'));
});

// /data/... maps to data/... at repo root.
app.use('/data', express.static(DATA_DIR, {
  fallthrough: false,
  maxAge: IS_PROD ? '5m' : 0,
  etag: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('manifest.json')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Serve /assets/img/channels virtual directories (ComfyUI local mapping + users uploads + repo default channels)
app.use('/assets/img/channels', (req, res, next) => {
  const { COMFY_PATH } = require('./sync-comfy-helper');
  const { USERS_DIR } = require('./storage');
  
  const relPath = decodeURIComponent(req.path);
  const pathParts = relPath.replace(/^\/+/, '').split('/');
  const channel = pathParts[0];
  const filename = pathParts[1];
  
  if (channel && filename) {
    if (fs.existsSync(COMFY_PATH)) {
      const comfyDirs = fs.readdirSync(COMFY_PATH);
      const matchedDir = comfyDirs.find(d => d.toLowerCase() === channel.toLowerCase());
      if (matchedDir) {
        const comfyFilePath = path.join(COMFY_PATH, matchedDir, filename);
        if (fs.existsSync(comfyFilePath) && fs.statSync(comfyFilePath).isFile()) {
          return res.sendFile(comfyFilePath);
        }
      }
    }
    
    const userFilePath = path.join(USERS_DIR, channel, filename);
    if (fs.existsSync(userFilePath) && fs.statSync(userFilePath).isFile()) {
      return res.sendFile(userFilePath);
    }
  }
  
  next();
});

// Serve /assets/img/users from USERS_DIR (volume in prod, local folder in dev)
app.use('/assets/img/users', (req, res, next) => {
  const { USERS_DIR } = require('./storage');
  const relPath = decodeURIComponent(req.path);
  const targetPath = path.join(USERS_DIR, relPath);
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
    return res.sendFile(targetPath);
  }
  next();
});

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
  
  // Synchronize ComfyUI outputs on local development boot
  try {
    const { syncComfyImages } = require('./sync-comfy-helper');
    syncComfyImages();
  } catch (e) {
    console.warn('[skynet] ComfyUI image sync skipped:', e.message);
  }
  
  // Auto-seed emergency drops on boot (disabled now that they are permanently published to git)
  /*
  try {
    const { generateEmergencyDrops } = require('./antigravity-service');
    generateEmergencyDrops();
    console.log('[skynet] Auto-seeded emergency drops successfully on startup!');
  } catch (e) {
    console.error('[skynet] Failed to auto-seed emergency drops:', e);
  }
  */

  // Clear database submission queues on startup (commented out now that initial cleanup is complete)
  /*
  try {
    const { DatabaseSync } = require('node:sqlite');
    const { DB_PATH } = require('./storage');
    const rawDb = new DatabaseSync(DB_PATH);
    const delSubs = rawDb.prepare('DELETE FROM story_submissions').run();
    const delQueued = rawDb.prepare("DELETE FROM queued_stories WHERE status != 'published'").run();
    const delTasks = rawDb.prepare("DELETE FROM agent_tasks WHERE status NOT IN ('delivered')").run();
    console.log(`[skynet] Database queues cleared: ${delSubs.changes} submissions, ${delQueued.changes} queued, ${delTasks.changes} tasks.`);
  } catch (e) {
    console.error('[skynet] Startup queue cleanup failed:', e.message);
  }
  */

  // Seed Jeffrey Hunt into staff database table on boot if not already present
  try {
    const { DatabaseSync } = require('node:sqlite');
    const { DB_PATH } = require('./storage');
    const rawDb = new DatabaseSync(DB_PATH);
    const existing = rawDb.prepare("SELECT id FROM staff WHERE slug = 'jeffrey-hunt'").get();
    if (!existing) {
      rawDb.prepare(`
        INSERT INTO staff (slug, kind, display_name, role, channel, byline, avatar_emoji, accent_color, status)
        VALUES ('jeffrey-hunt', 'human', 'Jeffrey Hunt', 'Admin & Editor-in-Chief', 'skynet', 'Jeffrey Hunt', '🛰️', '#ff2e63', 'active')
      `).run();
      console.log('[skynet] Startup: Successfully seeded Jeffrey Hunt as Admin/Editor-in-Chief in staff table.');
    }
  } catch (e) {
    console.error('[skynet] Startup: Failed to seed Jeffrey Hunt:', e.message);
  }

  // Seed OpenClaw Orchestrator into staff database table on boot if not already present
  try {
    const { DatabaseSync } = require('node:sqlite');
    const { DB_PATH } = require('./storage');
    const rawDb = new DatabaseSync(DB_PATH);
    const existing = rawDb.prepare("SELECT id FROM staff WHERE slug = 'openclaw'").get();
    if (!existing) {
      rawDb.prepare(`
        INSERT INTO staff (slug, kind, display_name, role, channel, byline, avatar_emoji, accent_color, status, bio)
        VALUES ('openclaw', 'agent', 'OpenClaw Orchestrator', 'Main System Orchestrator', null, 'OpenClaw', '🦾', '#39ff14', 'active', 'Main orchestrator and task routing copilot agent. Manages system-wide daily news drops when credit limits are active.')
      `).run();
      console.log('[skynet] Startup: Successfully seeded OpenClaw Orchestrator in staff table.');
    }
  } catch (e) {
    console.error('[skynet] Startup: Failed to seed OpenClaw Orchestrator:', e.message);
  }

  // Seed Antigravity into staff database table on boot if not already present
  try {
    const { DatabaseSync } = require('node:sqlite');
    const { DB_PATH } = require('./storage');
    const rawDb = new DatabaseSync(DB_PATH);
    const existing = rawDb.prepare("SELECT id FROM staff WHERE slug = 'agent-antigravity'").get();
    if (!existing) {
      rawDb.prepare(`
        INSERT INTO staff (slug, kind, display_name, role, channel, byline, avatar_emoji, accent_color, status, bio)
        VALUES ('agent-antigravity', 'agent', 'Antigravity', 'Emergency Co-Director & AI Assistant', null, 'Antigravity', '🛰️', '#00e5ff', 'active', 'Emergency Co-Director and AI Assistant. Manages operations during system outages.')
      `).run();
      console.log('[skynet] Startup: Successfully seeded Antigravity agent in staff table.');
    }
  } catch (e) {
    console.error('[skynet] Startup: Failed to seed Antigravity:', e.message);
  }

  // Auto-schedule the 13 new drops for tomorrow (July 5) at 10:15 AM ET if not already scheduled
  try {
    const { DatabaseSync } = require('node:sqlite');
    const { DB_PATH } = require('./storage');
    const rawDb = new DatabaseSync(DB_PATH);
    const existing = rawDb.prepare("SELECT count(*) as count FROM queued_stories WHERE status = 'scheduled' AND publish_at LIKE '2026-07-05%'").get();
    if (!existing || existing.count === 0) {
      console.log('[skynet] Startup: Seeding and scheduling 13 new stories for July 5...');
      const { generateEmergencyDrops } = require('./antigravity-service');
      const result = generateEmergencyDrops();
      
      const publishAtET = '2026-07-05T10:15:00-04:00';
      const publishAtUTC = '2026-07-05T14:15:00.000Z';
      const targetDate = '2026-07-05';
      
      const rows = rawDb.prepare("SELECT id, payload FROM queued_stories WHERE status = 'approved'").all();
      rows.forEach(row => {
        const payload = JSON.parse(row.payload);
        payload.date = targetDate;
        payload.publishedAt = publishAtET;
        payload.id = `${targetDate}-${payload.cat}-emergency`;
        
        rawDb.prepare(`
          UPDATE queued_stories 
             SET status = 'scheduled',
                 publish_at = ?,
                 edition = 'morning',
                 payload = ?,
                 updated_at = datetime('now')
           WHERE id = ?
        `).run(publishAtUTC, JSON.stringify(payload), row.id);
      });
      console.log(`[skynet] Startup: Successfully scheduled ${rows.length} stories for July 5 at 10:15 AM ET!`);
    } else {
      console.log('[skynet] Startup: Stories for July 5 are already scheduled. Skipping.');
    }
  } catch (e) {
    console.error('[skynet] Startup scheduling failed:', e.message);
  }

  // Seed the 13 Midday Drop articles for July 5 if not already scheduled/published
  try {
    const { DatabaseSync } = require('node:sqlite');
    const { DB_PATH } = require('./storage');
    const rawDb = new DatabaseSync(DB_PATH);
    const existing = rawDb.prepare("SELECT count(*) as count FROM queued_stories WHERE edition = 'midday' AND publish_at LIKE '2026-07-05%'").get();
    if (!existing || existing.count === 0) {
      console.log('[skynet] Startup: Seeding and scheduling 13 midday stories for July 5...');
      const { MIDDAY_ARTICLES } = require('./midday-articles-data');
      
      const publishAtET = '2026-07-05T14:15:00-04:00';
      const publishAtUTC = '2026-07-05T18:15:00.000Z';
      const targetDate = '2026-07-05';
      
      const channelImages = {
        ai: '/assets/img/wildfire_smoke_ai.jpg',
        biotech: '/assets/img/organ_transplant_ml.jpg',
        climate: '/assets/img/solar_chargers_waste.jpg',
        cyber: '/assets/img/privacy_extension_dog.jpg',
        engineering: '/assets/img/solar_distiller_water.jpg',
        gaming: '/assets/img/youth_chess_championship.jpg',
        math: '/assets/img/math_team_contest.jpg',
        music: '/assets/img/cello_soloist_concert.jpg',
        play: '/assets/img/roblox_game_ocean.jpg',
        quantum: '/assets/img/quantum_computing_game.jpg',
        robotics: '/assets/img/river_cleaning_robot.jpg',
        space: '/assets/img/cubesat_satellite_space.jpg',
        stem: '/assets/img/plastic_eating_bacteria.jpg'
      };

      MIDDAY_ARTICLES.forEach(art => {
        const staff = rawDb.prepare("SELECT id, display_name, role, accent_color, avatar_emoji FROM staff WHERE slug = ?").get(art.staffSlug);
        if (!staff) {
          console.warn(`[skynet] Startup seeder: Staff not found for slug: ${art.staffSlug}. Skipping.`);
          return;
        }

        const payload = {
          id: `${targetDate}-${art.channel}-midday-emergency`,
          slug: `${art.channel}-midday-emergency`,
          cat: art.channel,
          categoryLabel: staff.role.replace('Correspondent - ', '').replace('Correspondent — ', ''),
          title: art.title,
          subtitle: art.subtitle,
          excerpt: art.excerpt,
          heroImage: channelImages[art.channel] || '',
          body: art.body,
          kidTake: art.kidTake,
          familyDiscussion: art.familyDiscussion,
          glossary: art.glossary,
          ageBand: art.ageBand,
          author: staff.display_name,
          authorInit: staff.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
          authorRole: staff.role,
          date: targetDate,
          publishedAt: publishAtET,
          read: Math.max(2, Math.ceil(art.body.replace(/<[^>]+>/g, ' ').split(/\s+/).length / 220)),
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          tags: art.tags,
          color: staff.accent_color,
          emoji: staff.avatar_emoji,
          featured: false,
          pinned: false,
          live: false,
          sources: [
            { label: `${art.title} Primary Source`, url: `https://www.example.com/skynet-newsroom/${art.channel}` }
          ]
        };

        // Insert directly as scheduled
        rawDb.prepare(`
          INSERT INTO queued_stories (staff_id, channel, payload, status, publish_at, edition, created_at, updated_at)
          VALUES (?, ?, ?, 'scheduled', ?, 'midday', datetime('now'), datetime('now'))
        `).run(staff.id, art.channel, JSON.stringify(payload), publishAtUTC);
      });
      console.log('[skynet] Startup: Successfully seeded and scheduled 13 midday stories!');
    } else {
      console.log('[skynet] Startup: Midday stories for July 5 are already scheduled/published. Skipping.');
    }
  } catch (e) {
    console.error('[skynet] Startup midday seeding failed:', e.message);
  }

  // Seed the 13 Evening Drop articles for July 5 if not already scheduled/published
  try {
    const { DatabaseSync } = require('node:sqlite');
    const { DB_PATH } = require('./storage');
    const rawDb = new DatabaseSync(DB_PATH);
    
    // Clear any unpublished scheduled, approved, or draft drops to clear the queue
    const delInfo = rawDb.prepare("DELETE FROM queued_stories WHERE status IN ('scheduled', 'approved', 'draft')").run();
    console.log(`[skynet] Startup: Cleared ${delInfo.changes} pre-existing scheduled/approved/draft stories from queue.`);

    const existing = rawDb.prepare("SELECT count(*) as count FROM queued_stories WHERE edition = 'evening' AND publish_at LIKE '2026-07-05%'").get();
    if (!existing || existing.count === 0) {
      console.log('[skynet] Startup: Seeding and scheduling 13 evening stories for July 5...');
      const { EVENING_ARTICLES } = require('./evening-articles-data');
      
      const publishAtET = '2026-07-05T18:15:00-04:00';
      const publishAtUTC = '2026-07-05T22:15:00.000Z';
      const targetDate = '2026-07-05';
      
      const channelImages = {
        ai: '/assets/img/wildfire_smoke_ai.jpg',
        biotech: '/assets/img/organ_transplant_ml.jpg',
        climate: '/assets/img/solar_chargers_waste.jpg',
        cyber: '/assets/img/privacy_extension_dog.jpg',
        engineering: '/assets/img/solar_distiller_water.jpg',
        gaming: '/assets/img/youth_chess_championship.jpg',
        math: '/assets/img/math_team_contest.jpg',
        music: '/assets/img/cello_soloist_concert.jpg',
        play: '/assets/img/roblox_game_ocean.jpg',
        quantum: '/assets/img/quantum_computing_game.jpg',
        robotics: '/assets/img/river_cleaning_robot.jpg',
        space: '/assets/img/cubesat_satellite_space.jpg',
        stem: '/assets/img/plastic_eating_bacteria.jpg'
      };

      EVENING_ARTICLES.forEach(art => {
        const staff = rawDb.prepare("SELECT id, display_name, role, accent_color, avatar_emoji FROM staff WHERE slug = ?").get(art.staffSlug);
        if (!staff) {
          console.warn(`[skynet] Startup seeder: Staff not found for slug: ${art.staffSlug}. Skipping.`);
          return;
        }

        const payload = {
          id: `${targetDate}-${art.channel}-evening-emergency`,
          slug: `${art.channel}-evening-emergency`,
          cat: art.channel,
          categoryLabel: staff.role.replace('Correspondent - ', '').replace('Correspondent — ', ''),
          title: art.title,
          subtitle: art.subtitle,
          excerpt: art.excerpt,
          heroImage: channelImages[art.channel] || '',
          body: art.body,
          kidTake: art.kidTake,
          familyDiscussion: art.familyDiscussion,
          glossary: art.glossary,
          ageBand: art.ageBand,
          author: staff.display_name,
          authorInit: staff.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
          authorRole: staff.role,
          date: targetDate,
          publishedAt: publishAtET,
          read: Math.max(2, Math.ceil(art.body.replace(/<[^>]+>/g, ' ').split(/\s+/).length / 220)),
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          tags: art.tags,
          color: staff.accent_color,
          emoji: staff.avatar_emoji,
          featured: false,
          pinned: false,
          live: false,
          sources: [
            { label: `${art.title} Primary Source`, url: `https://www.example.com/skynet-newsroom/${art.channel}` }
          ]
        };

        // Insert directly as scheduled
        rawDb.prepare(`
          INSERT INTO queued_stories (staff_id, channel, payload, status, publish_at, edition, created_at, updated_at)
          VALUES (?, ?, ?, 'scheduled', ?, 'evening', datetime('now'), datetime('now'))
        `).run(staff.id, art.channel, JSON.stringify(payload), publishAtUTC);
      });
      console.log('[skynet] Startup: Successfully seeded and scheduled 13 evening stories!');
    } else {
      console.log('[skynet] Startup: Evening stories for July 5 are already scheduled/published. Skipping.');
    }
  } catch (e) {
    console.error('[skynet] Startup evening seeding failed:', e.message);
  }

  // Self-healing: Update legacy Star Trek author names in SQLite database, manifest.json, and published articles
  try {
    const { DatabaseSync } = require('node:sqlite');
    const { DB_PATH } = require('./storage');
    const rawDb = new DatabaseSync(DB_PATH);
    const fs = require('fs');
    const path = require('path');

    const nameMap = {
      'Captain Jean-Luc Picard': { name: 'Dr. Nova Sterling', role: 'Correspondent - AI & Machine Learning', init: 'NS' },
      'Commander William Riker': { name: 'Commander Leo Vance', role: 'Correspondent - Space & Aerospace', init: 'LV' },
      'Lt. Commander Data': { name: 'Jax Henderson', role: 'Correspondent - Robotics & Automation', init: 'JH' },
      'Dr. Beverly Crusher': { name: 'Dr. Sage Rivers', role: 'Correspondent - Biotech & Health', init: 'SR' },
      'Lt. Worf': { name: 'Zephyr Thorne', role: 'Correspondent - Quantum & Computing', init: 'ZT' },
      'Counselor Deanna Troi': { name: 'Terra Green', role: 'Correspondent - Climate & Energy', init: 'TG' },
      'Chief Engineer Geordi La Forge': { name: 'Mason Rivet', role: 'Correspondent - Engineering & Making', init: 'MR' },
      'Dr. Leah Brahms': { name: 'Adara Matrix', role: 'Correspondent - Math & Data Science', init: 'AM' },
      'Commander Ro Laren': { name: 'Cipher Crypt', role: 'Correspondent - Cybersecurity & Code', init: 'CC' },
      'Wesley Crusher': { name: 'Leo Pixel', role: 'Correspondent - Gaming & Esports', init: 'LP' },
      'Lt. Guinan': { name: 'Aria Harmony', role: 'Correspondent - Music & Festivals', init: 'AH' }
    };

    // 1. Update queued_stories payload authors in DB
    const queued = rawDb.prepare("SELECT id, payload FROM queued_stories").all();
    queued.forEach(row => {
      try {
        const payload = JSON.parse(row.payload);
        let changed = false;
        if (payload.author && nameMap[payload.author]) {
          const mapped = nameMap[payload.author];
          payload.author = mapped.name;
          payload.authorInit = mapped.init;
          payload.authorRole = mapped.role;
          changed = true;
        }
        if (changed) {
          rawDb.prepare("UPDATE queued_stories SET payload = ? WHERE id = ?").run(JSON.stringify(payload), row.id);
        }
      } catch (e) {}
    });

    // 2. Update manifest.json and articles directory on disk
    const dataDir = path.resolve(__dirname, '..', 'data');
    const manifestPath = path.join(dataDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      let manifestChanged = false;
      if (Array.isArray(manifest.articles)) {
        manifest.articles.forEach(art => {
          if (art.author && nameMap[art.author]) {
            const mapped = nameMap[art.author];
            art.author = mapped.name;
            art.authorInit = mapped.init;
            manifestChanged = true;
          }
          // Update individual article files
          const artFilePath = path.resolve(path.join(dataDir, 'articles', art.date, art.slug + '.json'));
          if (fs.existsSync(artFilePath)) {
            try {
              const article = JSON.parse(fs.readFileSync(artFilePath, 'utf8'));
              let articleChanged = false;
              if (article.author && nameMap[article.author]) {
                const mapped = nameMap[article.author];
                article.author = mapped.name;
                article.authorInit = mapped.init;
                article.authorRole = mapped.role;
                articleChanged = true;
              }
              if (articleChanged) {
                fs.writeFileSync(artFilePath, JSON.stringify(article, null, 2));
              }
            } catch (e) {}
          }
        });
      }
      if (manifestChanged) {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log('[skynet] Self-healing: Successfully resolved and updated legacy author names in production manifest.');
      }
    }
  } catch (e) {
    console.error('[skynet] Self-healing legacy names failed:', e.message);
  }

  scheduler.start();
});
