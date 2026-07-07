// server/sync-comfy-helper.js
const fs = require('fs');
const path = require('path');

const COMFY_PATH = 'C:\\Users\\bekin\\AppData\\Local\\Comfy-Desktop\\ComfyUI-Shared\\output\\skynet\\channels';
const REPO_CHANNELS_PATH = path.resolve(__dirname, '..', 'public', 'assets', 'img', 'channels');

function syncComfyImages() {
  if (!fs.existsSync(COMFY_PATH)) {
    console.log('[sync-comfy] ComfyUI output directory not found locally, skipping sync.');
    return;
  }
  
  console.log('[sync-comfy] Synchronizing ComfyUI outputs to repository assets...');
  const comfyDirs = fs.readdirSync(COMFY_PATH);
  
  let copiedCount = 0;
  
  comfyDirs.forEach(dirName => {
    const comfySubdir = path.join(COMFY_PATH, dirName);
    if (!fs.statSync(comfySubdir).isDirectory()) return;
    
    // Normalize channel directory name to lowercase
    const channelName = dirName.toLowerCase();
    const repoSubdir = path.join(REPO_CHANNELS_PATH, channelName);
    
    fs.mkdirSync(repoSubdir, { recursive: true });
    
    const files = fs.readdirSync(comfySubdir);
    files.forEach(file => {
      if (!/\.(jpe?g|png|webp|gif|svg)$/i.test(file)) return;
      
      const comfyFile = path.join(comfySubdir, file);
      const repoFile = path.join(repoSubdir, file);
      
      let shouldCopy = false;
      if (!fs.existsSync(repoFile)) {
        shouldCopy = true;
      } else {
        const comfyStat = fs.statSync(comfyFile);
        const repoStat = fs.statSync(repoFile);
        if (comfyStat.size !== repoStat.size) {
          shouldCopy = true;
        }
      }
      
      if (shouldCopy) {
        fs.copyFileSync(comfyFile, repoFile);
        copiedCount++;
      }
    });
  });
  
  if (copiedCount > 0) {
    console.log(`[sync-comfy] Successfully synchronized ${copiedCount} images to repository.`);
  } else {
    console.log('[sync-comfy] All images are already up-to-date.');
  }
}

module.exports = { syncComfyImages, COMFY_PATH };
