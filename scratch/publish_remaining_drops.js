const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const manifestPath = path.join(ROOT, 'data', 'manifest.json');
const articlesDir = path.join(ROOT, 'data', 'articles', '2026-07-07');

function publishRemaining() {
  console.log('Publishing missing Midday and all Evening articles to manifest...');
  if (!fs.existsSync(manifestPath)) {
    console.error('manifest.json not found!');
    return;
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const articles = manifest.articles || [];
  
  if (!fs.existsSync(articlesDir)) {
    console.error(`Articles directory not found: ${articlesDir}`);
    return;
  }
  
  const files = fs.readdirSync(articlesDir);
  let addedCount = 0;
  
  files.forEach(file => {
    if (!file.endsWith('.json')) return;
    const filePath = path.join(articlesDir, file);
    try {
      const art = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // We want to publish both the missing climate-midday AND all evening articles!
      const isTarget = art.id === '2026-07-07-climate-midday' || (art.id && art.id.endsWith('-evening'));
      
      if (isTarget) {
        // Check if already in manifest
        const exists = articles.some(a => a.id === art.id);
        if (!exists) {
          articles.unshift(art);
          addedCount++;
          console.log(`Publishing: ${art.id} - "${art.title}"`);
        }
      }
    } catch (e) {
      console.error(`Error reading ${file}:`, e.message);
    }
  });
  
  if (addedCount > 0) {
    // Sort: newest first
    articles.sort((a, b) => {
      const da = new Date(b.publishedAt || b.date) - new Date(a.publishedAt || a.date);
      if (da !== 0) return da;
      return (b.id || '').localeCompare(a.id || '');
    });
    
    manifest.articles = articles;
    manifest.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Successfully appended ${addedCount} articles to local manifest.`);
    
    // Commit and push
    console.log('Committing and pushing to GitHub...');
    try {
      execSync('git add .', { cwd: ROOT, stdio: 'inherit' });
      execSync('git commit -m "editorial: publish missing climate-midday and all evening articles directly to manifest"', { cwd: ROOT, stdio: 'inherit' });
      execSync('git push origin main', { cwd: ROOT, stdio: 'inherit' });
      console.log('Push complete! Railway will deploy and serve all drops live.');
    } catch (gitErr) {
      console.error('Git push failed:', gitErr.message);
    }
  } else {
    console.log('No new articles to publish.');
  }
}

publishRemaining();
