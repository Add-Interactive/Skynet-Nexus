const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'server', 'skynet.db');
const DATA_DIR = path.join(ROOT, 'data');
const CHANNELS_DIR = path.join(ROOT, 'public', 'assets', 'img', 'channels');

function randomizeImages() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('Database file not found:', DB_PATH);
    return;
  }
  
  const db = new DatabaseSync(DB_PATH);
  const manifestPath = path.join(DATA_DIR, 'manifest.json');
  let manifest = { articles: [] };
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
      console.warn('Failed to parse manifest:', e.message);
    }
  }

  // Cache of files per channel folder to avoid reading directories repeatedly
  const channelFiles = {};
  const validCats = ['ai', 'space', 'robotics', 'biotech', 'quantum', 'climate', 'engineering', 'math', 'cyber', 'gaming', 'music', 'stem', 'play'];

  function getRandomImage(ch) {
    if (!channelFiles[ch]) {
      const dir = path.join(CHANNELS_DIR, ch);
      if (fs.existsSync(dir)) {
        channelFiles[ch] = fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp|gif|svg)$/i.test(f));
      } else {
        channelFiles[ch] = [];
      }
    }
    const files = channelFiles[ch];
    if (!files.length) return null;
    return files[Math.floor(Math.random() * files.length)];
  }

  const rows = db.prepare("SELECT id, payload, published_article_id FROM queued_stories WHERE status = 'published'").all();
  let updatedCount = 0;

  rows.forEach(row => {
    let payload = {};
    try {
      payload = JSON.parse(row.payload);
    } catch (e) {
      return;
    }

    const channel = (payload.cat || '').toLowerCase();
    // Only update channels other than skynet and network
    if (!validCats.includes(channel)) return;

    const randomImgName = getRandomImage(channel);
    if (!randomImgName) return;

    const newHeroImage = `/assets/img/channels/${channel}/${randomImgName}`;
    payload.heroImage = newHeroImage;

    // 1. Update SQLite row
    db.prepare("UPDATE queued_stories SET payload = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(payload), row.id);

    // 2. Update local article JSON file
    const pubId = row.published_article_id;
    if (pubId) {
      const artPath = path.join(DATA_DIR, 'articles', pubId + '.json');
      if (fs.existsSync(artPath)) {
        try {
          const article = JSON.parse(fs.readFileSync(artPath, 'utf8'));
          article.heroImage = newHeroImage;
          fs.writeFileSync(artPath, JSON.stringify(article, null, 2), 'utf8');
        } catch (e) {
          console.warn(`Failed to update article file ${artPath}:`, e.message);
        }
      }
    }

    // 3. Update manifest entry
    if (manifest && Array.isArray(manifest.articles)) {
      const index = manifest.articles.findIndex(a => a.id === payload.id || a.slug === payload.slug);
      if (index !== -1) {
        manifest.articles[index].heroImage = newHeroImage;
      }
    }

    updatedCount++;
    console.log(`Updated post #${row.id} [${channel}] to image: ${newHeroImage}`);
  });

  if (updatedCount > 0) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`Successfully updated ${updatedCount} articles locally.`);
  } else {
    console.log('No articles needed updates.');
  }
}

randomizeImages();
