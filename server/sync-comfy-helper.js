// server/sync-comfy-helper.js
const fs = require('fs');
const path = require('path');

const COMFY_PATH = 'C:\\Users\\bekin\\AppData\\Local\\Comfy-Desktop\\ComfyUI-Shared\\output\\skynet\\channels';
const REPO_CHANNELS_PATH = path.resolve(__dirname, '..', 'public', 'assets', 'img', 'channels');

// Helper to recursively copy directories while preserving structure
function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return 0;
  const stats = fs.statSync(src);
  
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    let copiedCount = 0;
    const files = fs.readdirSync(src);
    files.forEach(file => {
      copiedCount += copyRecursiveSync(path.join(src, file), path.join(dest, file));
    });
    return copiedCount;
  } else if (stats.isFile()) {
    if (!/\.(jpe?g|png|webp|gif|svg)$/i.test(src)) return 0;
    
    let shouldCopy = false;
    if (!fs.existsSync(dest)) {
      shouldCopy = true;
    } else {
      const srcStat = fs.statSync(src);
      const destStat = fs.statSync(dest);
      if (srcStat.size !== destStat.size) {
        shouldCopy = true;
      }
    }
    
    if (shouldCopy) {
      fs.copyFileSync(src, dest);
      return 1;
    }
  }
  return 0;
}

function syncComfyImages() {
  if (!fs.existsSync(COMFY_PATH)) {
    console.log('[sync-comfy] ComfyUI output directory not found locally, skipping sync.');
    return;
  }
  
  console.log('[sync-comfy] Synchronizing ComfyUI outputs to repository assets (recursive)...');
  const comfyDirs = fs.readdirSync(COMFY_PATH);
  
  let totalCopied = 0;
  
  comfyDirs.forEach(dirName => {
    const comfySubdir = path.join(COMFY_PATH, dirName);
    if (!fs.statSync(comfySubdir).isDirectory()) return;
    
    const channelName = dirName.toLowerCase();
    const repoSubdir = path.join(REPO_CHANNELS_PATH, channelName);
    
    totalCopied += copyRecursiveSync(comfySubdir, repoSubdir);
  });
  
  if (totalCopied > 0) {
    console.log(`[sync-comfy] Successfully synchronized ${totalCopied} images to repository.`);
  } else {
    console.log('[sync-comfy] All images are already up-to-date.');
  }
}

module.exports = { syncComfyImages, COMFY_PATH };
