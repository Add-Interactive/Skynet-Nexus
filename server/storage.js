// server/storage.js
// Central, host-agnostic storage path resolution.
//
// Problem this solves: container filesystems on Railway/Fly/etc are EPHEMERAL.
// Anything written under the app directory (the SQLite DB, runtime-published
// articles) is wiped on every deploy/restart. To keep users AND the article
// archive for real, we put both on a persistent volume when one is available.
//
// Railway sets RAILWAY_VOLUME_MOUNT_PATH (e.g. "/data") when a volume is
// attached to the service. We also honor an explicit PERSIST_DIR override for
// other hosts. When neither is set (local dev), we fall back to the repo paths
// so nothing changes for developers.

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

// The persistent volume root, if one is mounted.
const VOLUME = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.PERSIST_DIR || null;

// Articles/manifest that ship inside the image act as the first-boot seed.
const SEED_DATA_DIR = path.join(ROOT, 'data');

// Where the app actually reads/writes at runtime.
const DATA_DIR = process.env.DATA_DIR || (VOLUME ? path.join(VOLUME, 'data') : SEED_DATA_DIR);
const DB_PATH = process.env.DB_PATH || (VOLUME ? path.join(VOLUME, 'skynet.db') : path.join(__dirname, 'skynet.db'));

let _prepared = false;

// Create the storage locations and, on a fresh persistent volume, copy the
// bundled seed content (welcome article + manifest) into it once.
function ensureStorage() {
  if (_prepared) return { DATA_DIR, DB_PATH, VOLUME };
  _prepared = true;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Seed the persistent data dir from the image bundle on first boot only.
  if (DATA_DIR !== SEED_DATA_DIR && fs.existsSync(SEED_DATA_DIR)) {
    const manifestPath = path.join(DATA_DIR, 'manifest.json');
    const seedManifestPath = path.join(SEED_DATA_DIR, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      try {
        fs.cpSync(SEED_DATA_DIR, DATA_DIR, { recursive: true });
        console.log('[storage] Seeded persistent data dir from bundle -> ' + DATA_DIR);
      } catch (e) {
        console.warn('[storage] Seed copy failed:', e.message);
      }
    } else {
      // Synchronize new articles/files from the bundle (git commits) to persistent storage
      try {
        // Copy any articles in SEED_DATA_DIR/articles to DATA_DIR/articles
        const seedArtRoot = path.join(SEED_DATA_DIR, 'articles');
        const dataArtRoot = path.join(DATA_DIR, 'articles');
        if (fs.existsSync(seedArtRoot)) {
          fs.cpSync(seedArtRoot, dataArtRoot, { recursive: true, force: true });
          console.log('[storage] Synchronized articles from bundle to persistent volume');
        }
        
        // Merge manifest entries
        if (fs.existsSync(seedManifestPath) && fs.existsSync(manifestPath)) {
          const currentManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          const seedManifest = JSON.parse(fs.readFileSync(seedManifestPath, 'utf8'));
          
          let mergedCount = 0;
          (seedManifest.articles || []).forEach(seedArt => {
            const exists = currentManifest.articles.some(a => a.id === seedArt.id);
            if (!exists) {
              currentManifest.articles.unshift(seedArt);
              mergedCount++;
            }
          });
          
          if (mergedCount > 0) {
            // Sort: newest first (publishedAt desc, then id)
            currentManifest.articles.sort((a, b) => {
              const da = new Date(b.publishedAt || b.date) - new Date(a.publishedAt || a.date);
              if (da !== 0) return da;
              return (b.id || '').localeCompare(a.id || '');
            });
            currentManifest.lastUpdated = new Date().toISOString();
            fs.writeFileSync(manifestPath, JSON.stringify(currentManifest, null, 2));
            console.log(`[storage] Merged ${mergedCount} new article entries from bundle manifest`);
          }
        }
      } catch (e) {
        console.warn('[storage] Persistent volume merge failed:', e.message);
      }
    }
  }

  if (VOLUME) {
    console.log('[storage] Persistent volume active. DB=' + DB_PATH + ' DATA=' + DATA_DIR);
  } else {
    console.warn('[storage] No persistent volume detected. Users and the article archive are EPHEMERAL — attach a Railway volume and the app will store them there automatically.');
  }

  return { DATA_DIR, DB_PATH, VOLUME };
}

module.exports = { ROOT, SEED_DATA_DIR, DATA_DIR, DB_PATH, VOLUME, ensureStorage };
