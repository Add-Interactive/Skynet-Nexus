const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const manifestPath = path.join(ROOT, 'data', 'manifest.json');

function fixClimateImage() {
  console.log('Fixing duplicate climate image...');
  if (!fs.existsSync(manifestPath)) {
    console.error('No manifest found!');
    return;
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const articles = manifest.articles || [];
  
  // Find "2026-07-05-climate-midday-emergency"
  const art = articles.find(a => a.id === '2026-07-05-climate-midday-emergency');
  if (art) {
    const oldImg = art.heroImage;
    // Set to a beautiful valid climate png
    const newImg = '/assets/img/channels/climate/1_00010_.png';
    art.heroImage = newImg;
    
    // Write manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Updated manifest for [${art.id}]: ${oldImg} -> ${newImg}`);
    
    // Update individual article file
    const artFilePath = path.join(ROOT, art.path);
    if (fs.existsSync(artFilePath)) {
      try {
        const artJson = JSON.parse(fs.readFileSync(artFilePath, 'utf8'));
        artJson.heroImage = newImg;
        fs.writeFileSync(artFilePath, JSON.stringify(artJson, null, 2));
        console.log(`Updated article JSON file: ${art.path}`);
      } catch (e) {
        console.error(`Failed to update article JSON file: ${e.message}`);
      }
    }
  } else {
    console.error('Target climate article not found in manifest!');
  }
}

fixClimateImage();
