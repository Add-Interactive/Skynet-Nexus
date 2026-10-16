// server/models-routes.js
// AR Satellite Lab — 3D model library backend.
// Mounted once from server/index.js: app.use(require('./models-routes'));
//
// Kid-facing model library. Metadata lives in data/models.json (volume-aware,
// seeded from the repo bundle on first boot — see server/storage.js). Model
// binaries: pending uploads in MODELS_DIR/pending (never publicly served),
// approved models in MODELS_DIR/live (served at /assets/models/live).
// Uploads are multipart via multer (memory) so the 3MB express.json cap never
// touches them. Server re-validates everything; client checks mean nothing.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { DATA_DIR, MODELS_DIR } = require('./storage');

const router = express.Router();

const GLB_MAX_BYTES = 25 * 1024 * 1024;
const GLB_MAGIC = [0x67, 0x6c, 0x54, 0x46]; // 'glTF'
const MODEL_CATEGORIES = ['satellite', 'telescope', 'community'];
const HANDLE_RE = /^[a-zA-Z0-9_]{3,20}$/;
const MODEL_ID_RE = /^[0-9a-f]{16}$/i;

// Tiny local rate limiter (mirrors the one in server/index.js): 3 uploads/hour per IP.
const UPLOAD_BUCKETS = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of UPLOAD_BUCKETS) if (v.resetAt < now) UPLOAD_BUCKETS.delete(k);
}, 10 * 60 * 1000).unref();
function uploadRateLimit(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').toString().split(',')[0].trim();
  const key = 'models-upload:' + ip;
  const now = Date.now();
  const entry = UPLOAD_BUCKETS.get(key);
  if (!entry || entry.resetAt < now) {
    UPLOAD_BUCKETS.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return next();
  }
  entry.count++;
  if (entry.count > 3) {
    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'too many uploads — try again later' });
  }
  next();
}

const modelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: GLB_MAX_BYTES, files: 1 }
});

function readModels() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'models.json'), 'utf8'));
    return Array.isArray(j.models) ? j.models : [];
  } catch (e) { return []; }
}
function writeModels(models) {
  fs.writeFileSync(path.join(DATA_DIR, 'models.json'), JSON.stringify({ models }, null, 2));
}

// Public: approved (live) models only. Strips internal fields.
router.get('/api/models', (req, res) => {
  const live = readModels()
    .filter(m => m.status === 'live')
    .map(m => ({
      id: m.id,
      name: m.name,
      category: m.category,
      satelliteId: m.satelliteId || null,
      creatorHandle: m.creatorHandle,
      fileUrl: m.fileUrl,
      modelUrl: m.fileUrl, // alias: the frontend viewer reads modelUrl
      createdAt: m.createdAt
    }));
  res.json({ models: live });
});

// Kid-facing upload: no auth, but rate-limited + strictly validated.
router.post('/api/models/upload', uploadRateLimit, (req, res) => {
  modelUpload.single('model')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'model file too large (max 25MB)' });
      return res.status(400).json({ error: 'upload failed: ' + (err.message || 'bad file') });
    }
    try {
      const b = req.body || {};
      const name = String(b.name || '').trim();
      if (!name || name.length > 80) return res.status(400).json({ error: 'name required (max 80 chars)' });
      const category = String(b.category || '').trim();
      if (!MODEL_CATEGORIES.includes(category)) return res.status(400).json({ error: 'invalid category' });
      const creatorHandle = String(b.creatorHandle || '').trim();
      if (!HANDLE_RE.test(creatorHandle)) return res.status(400).json({ error: 'invalid creator handle' });
      let satelliteId = null;
      if (b.satelliteId != null && String(b.satelliteId).trim() !== '') {
        satelliteId = String(b.satelliteId).trim();
        if (!/^[a-zA-Z0-9_-]{1,40}$/.test(satelliteId)) return res.status(400).json({ error: 'invalid satelliteId' });
      }
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'model file required (field "model")' });
      const origName = String(file.originalname || '').replace(/[^a-zA-Z0-9_.-]/g, '_');
      if (!/\.glb$/i.test(origName)) return res.status(400).json({ error: 'file must be a .glb' });
      if (file.size > GLB_MAX_BYTES) return res.status(413).json({ error: 'model file too large (max 25MB)' });
      const buf = file.buffer;
      if (!buf || buf.length < 12 || !GLB_MAGIC.every((v, i) => buf[i] === v)) {
        return res.status(400).json({ error: 'file is not a valid glTF binary (.glb)' });
      }
      const id = crypto.randomBytes(8).toString('hex');
      const pendingDir = path.join(MODELS_DIR, 'pending');
      fs.mkdirSync(pendingDir, { recursive: true });
      const filePath = path.join(pendingDir, id + '.glb');
      if (path.dirname(filePath) !== pendingDir) return res.status(400).json({ error: 'bad id' });
      fs.writeFileSync(filePath, buf);
      const models = readModels();
      models.push({
        id, name, category, satelliteId, creatorHandle,
        fileUrl: null, originalFilename: origName, sizeBytes: file.size,
        status: 'pending', createdAt: new Date().toISOString()
      });
      writeModels(models);
      console.log(`[models] upload pending: ${id} (${name}, ${category}) by @${creatorHandle}`);
      res.json({ ok: true, id, message: 'Model received — it will appear in the library once reviewed.' });
    } catch (e) {
      res.status(500).json({ error: 'upload failed: ' + e.message });
    }
  });
});

// Serve /assets/models/live from the volume's approved-model dir.
// Pending uploads are never mounted — they stay private until approved.
router.use('/assets/models/live', express.static(path.join(MODELS_DIR, 'live'), {
  maxAge: '365d',
  immutable: true,
  setHeaders: (res, filePath) => { if (/\.glb$/i.test(filePath)) res.set('Content-Type', 'model/gltf-binary'); }
}));

module.exports = router;
