const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const manifestPath = path.join(ROOT, 'data', 'manifest.json');
const articlesDir = path.join(ROOT, 'data', 'articles', '2026-07-07');

function publishEveningDrop() {
  console.log('Publishing July 7th Evening drop directly to manifest...');
  if (!fs.existsSync(manifestPath)) {
    console.error('No manifest.json found!');
    return;
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const articles = manifest.articles || [];
  
  if (!fs.existsSync(articlesDir)) {
    console.error(`Articles directory for July 7th not found at: ${articlesDir}`);
    return;
  }
  
  const files = fs.readdirSync(articlesDir);
  let addedCount = 0;
  
  files.forEach(file => {
    if (!file.endsWith('.json')) return;
    const filePath = path.join(articlesDir, file);
    try {
      const art = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (art.id && art.id.endsWith('-evening')) {
        // Check if already in manifest
        const exists = articles.some(a => a.id === art.id);
        if (!exists) {
          articles.unshift(art); // Add to beginning (published first)
          addedCount++;
          console.log(`Added to manifest: ${art.id} - "${art.title}"`);
        }
      }
    } catch (e) {
      console.error(`Failed to process ${file}:`, e.message);
    }
  });
  
  if (addedCount > 0) {
    // Sort manifest: newest first (by publishedAt / date)
    articles.sort((a, b) => {
      const da = new Date(b.publishedAt || b.date) - new Date(a.publishedAt || a.date);
      if (da !== 0) return da;
      return (b.id || '').localeCompare(a.id || '');
    });
    
    manifest.articles = articles;
    manifest.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Successfully published ${addedCount} evening articles locally!`);
    
    // Commit and push to deploy to Railway
    console.log('Committing and pushing updated manifest to GitHub...');
    try {
      execSync('git add data/manifest.json', { cwd: ROOT, stdio: 'inherit' });
      execSync('git commit -m "editorial: publish July 7 Evening drop directly to manifest"', { cwd: ROOT, stdio: 'inherit' });
      execSync('git push origin main', { cwd: ROOT, stdio: 'inherit' });
      console.log('Successfully pushed changes to GitHub! Railway will redeploy and publish the Evening drop.');
    } catch (gitErr) {
      console.error('Git push failed:', gitErr.message);
    }
  } else {
    console.log('No new evening articles to publish (all already in manifest).');
  }
}

publishEveningDrop();
