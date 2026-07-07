const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { COMFY_PATH } = require('../server/sync-comfy-helper');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'server', 'skynet.db');
const repoChannelsDir = path.join(ROOT, 'public', 'assets', 'img', 'channels');

function sanitizeDbAndFiles() {
  console.log('Starting full database and file image sanitization...');
  
  // 1. Get all available files recursively per channel
  const channelsList = ['ai', 'biotech', 'climate', 'cyber', 'engineering', 'gaming', 'math', 'music', 'play', 'quantum', 'robotics', 'space', 'stem', 'network', 'skynet'];
  const channelImages = {};
  
  function getImagesForChannel(ch) {
    const list = new Set();
    
    function walk(baseDir, currentSubdir = '') {
      const dirPath = path.join(baseDir, currentSubdir);
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return;
      fs.readdirSync(dirPath).forEach(item => {
        const rel = currentSubdir ? `${currentSubdir}/${item}` : item;
        const full = path.join(baseDir, rel);
        if (fs.statSync(full).isDirectory()) {
          walk(baseDir, rel);
        } else if (/\.(jpe?g|png|webp|gif|svg)$/i.test(item)) {
          list.add(rel.replace(/\\/g, '/'));
        }
      });
    }
    
    // 1. Check repo
    const repoPath = path.join(repoChannelsDir, ch);
    walk(repoPath);
    
    // 2. Check ComfyUI
    if (COMFY_PATH && fs.existsSync(COMFY_PATH)) {
      const comfyDirs = fs.readdirSync(COMFY_PATH);
      const matchedDir = comfyDirs.find(d => d.toLowerCase() === ch.toLowerCase());
      if (matchedDir) {
        walk(path.join(COMFY_PATH, matchedDir));
      }
    }
    
    return Array.from(list);
  }
  
  channelsList.forEach(ch => {
    channelImages[ch] = getImagesForChannel(ch);
    console.log(`Channel [${ch}]: ${channelImages[ch].length} valid images found.`);
  });
  
  // Helper to check if file exists
  function imageExists(ch, filename) {
    // 1. Check repo
    const p1 = path.join(repoChannelsDir, ch, filename);
    if (fs.existsSync(p1) && fs.statSync(p1).isFile()) return true;
    
    // 2. Check ComfyUI
    if (COMFY_PATH && fs.existsSync(COMFY_PATH)) {
      const comfyDirs = fs.readdirSync(COMFY_PATH);
      const matchedDir = comfyDirs.find(d => d.toLowerCase() === ch.toLowerCase());
      if (matchedDir) {
        const p2 = path.join(COMFY_PATH, matchedDir, filename);
        if (fs.existsSync(p2) && fs.statSync(p2).isFile()) return true;
      }
    }
    return false;
  }
  
  // 2. Update queued_stories in database
  if (fs.existsSync(DB_PATH)) {
    const rawDb = new DatabaseSync(DB_PATH);
    const queuedRows = rawDb.prepare("SELECT id, payload FROM queued_stories").all();
    let updatedQueued = 0;
    
    queuedRows.forEach(row => {
      try {
        const payload = JSON.parse(row.payload);
        if (payload.heroImage && payload.heroImage.startsWith('/assets/img/channels/')) {
          const parts = payload.heroImage.replace('/assets/img/channels/', '').split('/');
          const ch = parts[0];
          const filename = parts.slice(1).join('/');
          
          if (!imageExists(ch, filename)) {
            const list = channelImages[ch] || [];
            if (list.length > 0) {
              const rand = list[Math.floor(Math.random() * list.length)];
              const oldImg = payload.heroImage;
              payload.heroImage = `/assets/img/channels/${ch}/${rand}`;
              rawDb.prepare("UPDATE queued_stories SET payload = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(payload), row.id);
              console.log(`Updated queued story [${row.id}]: ${oldImg} -> ${payload.heroImage}`);
              updatedQueued++;
            }
          }
        }
      } catch (e) {
        console.error(`Error processing queued story ${row.id}:`, e.message);
      }
    });
    console.log(`Database queued stories update complete: updated ${updatedQueued} stories.`);
  } else {
    console.log('Skipped queued_stories database update (no DB file).');
  }
  
  // 3. Update manifest.json and individual article files
  const manifestPath = path.join(ROOT, 'data', 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      let updatedManifestCount = 0;
      
      if (Array.isArray(manifest.articles)) {
        manifest.articles.forEach(art => {
          if (art.heroImage && art.heroImage.startsWith('/assets/img/channels/')) {
            const parts = art.heroImage.replace('/assets/img/channels/', '').split('/');
            const ch = parts[0];
            const filename = parts.slice(1).join('/');
            
            if (!imageExists(ch, filename)) {
              const list = channelImages[ch] || [];
              if (list.length > 0) {
                const rand = list[Math.floor(Math.random() * list.length)];
                const oldImg = art.heroImage;
                const newImg = `/assets/img/channels/${ch}/${rand}`;
                
                art.heroImage = newImg;
                updatedManifestCount++;
                console.log(`Updated manifest article [${art.id}]: ${oldImg} -> ${newImg}`);
                
                // Also update individual JSON file
                const artFilePath = path.join(ROOT, art.path);
                if (fs.existsSync(artFilePath)) {
                  try {
                    const artJson = JSON.parse(fs.readFileSync(artFilePath, 'utf8'));
                    artJson.heroImage = newImg;
                    fs.writeFileSync(artFilePath, JSON.stringify(artJson, null, 2));
                    console.log(`  -> Successfully updated individual article file: ${art.path}`);
                  } catch (fileErr) {
                    console.error(`  -> Failed to update article file ${art.path}:`, fileErr.message);
                  }
                }
              }
            }
          }
        });
      }
      
      if (updatedManifestCount > 0) {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        console.log(`Successfully updated data/manifest.json for ${updatedManifestCount} articles.`);
      }
    } catch (e) {
      console.error('Failed to parse or update data/manifest.json:', e.message);
    }
  } else {
    console.log('Skipped manifest.json update (no file).');
  }
  
  console.log('Full image sanitization completed successfully!');
}

sanitizeDbAndFiles();
