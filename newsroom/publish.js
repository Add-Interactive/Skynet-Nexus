#!/usr/bin/env node
// Publish a Skynet Nexus News article.
// Usage:
//   node publish.js --file path/to/article.json
//   node publish.js --stdin < article.json
//
// The article JSON must contain: id/slug, cat, title, excerpt, body, author,
// date (YYYY-MM-DD). Everything else has sensible defaults.

const fs = require('fs');
const path = require('path');

// Repo root, derived from this file's location so it works on any host (Windows dev + Linux/Railway prod).
const SKYNET_ROOT = process.env.SKYNET_ROOT || path.resolve(__dirname, '..');
// Data dir can be overridden to a persistent volume (set by the server at publish time).
const DATA_ROOT = process.env.SKYNET_DATA_DIR || path.join(SKYNET_ROOT, 'data');
const ART_ROOT = path.join(DATA_ROOT, 'articles');
const MANIFEST = path.join(DATA_ROOT, 'manifest.json');

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function readArgs() {
  const args = { file: null, stdin: false };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--file') args.file = process.argv[++i];
    else if (a === '--stdin') args.stdin = true;
  }
  return args;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', c => buf += c);
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const args = readArgs();
  let raw;
  if (args.file) raw = fs.readFileSync(args.file, 'utf8');
  else if (args.stdin) raw = await readStdin();
  else { console.error('Usage: publish.js --file <path> | --stdin'); process.exit(1); }

  let article;
  try { article = JSON.parse(raw); }
  catch (e) { console.error('Invalid JSON:', e.message); process.exit(2); }

  // Validate & fill defaults
  const errors = [];
  if (!article.title) errors.push('title required');
  if (!article.cat) errors.push('cat required');
  if (!article.body) errors.push('body required (HTML string)');
  if (!article.date) errors.push('date required (YYYY-MM-DD)');
  if (!article.excerpt) errors.push('excerpt required');
  if (!article.kidTake) errors.push('kidTake required (2-3 sentences, ~age 8 reading level)');
  if (!article.familyDiscussion || !Array.isArray(article.familyDiscussion) || article.familyDiscussion.length < 2) {
    errors.push('familyDiscussion required (array of 2-3 question strings)');
  }
  const validCats = ['ai', 'space', 'robotics', 'biotech', 'quantum', 'climate', 'engineering', 'math', 'cyber', 'gaming', 'music', 'stem', 'play', 'network'];
  if (article.cat && !validCats.includes(article.cat)) errors.push('cat must be one of: ' + validCats.join(', '));
  // Kid-safe content guardrails: block flagged terms
  const flagged = ['killed', 'murder', 'suicide', 'terrorist', 'assault', 'rape', 'overdose', 'nazi', 'slavery', 'gun ', 'shooting', 'weapon', 'combat'];
  const bodyLower = String(article.body || '').toLowerCase();
  const titleLower = String(article.title || '').toLowerCase();
  const hits = flagged.filter(w => titleLower.includes(w) || bodyLower.includes(w));
  if (hits.length) errors.push('KID-SAFE VIOLATION: flagged terms in title/body: ' + hits.join(', '));
  if (errors.length) { console.error('Validation errors:\n  - ' + errors.join('\n  - ')); process.exit(3); }

  const slug = article.slug || slugify(article.title);
  const id = article.id || (article.date + '-' + slug);
  const emojiByCat = { ai:'🧠', space:'🚀', robotics:'🤖', biotech:'🧬', quantum:'⚛️', climate:'🌍', engineering:'🔧', math:'📐', cyber:'🔐', gaming:'🎮', music:'🎧', stem:'🧬', play:'🎨', network:'🛰️' };
  const colorByCat = { ai:'#00e5ff', space:'#7c5cff', robotics:'#a855f7', biotech:'#2dd4bf', quantum:'#22d3ee', climate:'#34d399', engineering:'#ffb800', math:'#f472b6', cyber:'#38bdf8', gaming:'#39ff14', music:'#ff2e63', stem:'#00e5ff', play:'#39ff14', network:'#00e5ff' };
  const partnerByCat = { ai:'#a855f7', space:'#00e5ff', robotics:'#ff2e63', biotech:'#00e5ff', quantum:'#7c5cff', climate:'#00e5ff', engineering:'#ff2e63', math:'#a855f7', cyber:'#a855f7', gaming:'#00e5ff', music:'#ffb800', stem:'#a855f7', play:'#00e5ff', network:'#ff2e63' };

  const author = article.author || 'The Newsroom';
  const authorInit = article.authorInit || author.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const now = new Date();
  const publishedAt = article.publishedAt || new Date(article.date + 'T10:00:00-04:00').toISOString();

  const full = {
    id,
    slug,
    cat: article.cat,
    categoryLabel: article.categoryLabel || (({ai:'AI & Machine Learning',space:'Space & Aerospace',robotics:'Robotics & Automation',biotech:'Biotech & Health',quantum:'Quantum & Computing',climate:'Climate & Energy',engineering:'Engineering & Making',math:'Math & Data Science',cyber:'Cybersecurity & Code',gaming:'Gaming Tournaments',music:'Music Festivals',stem:'STEM Signal',play:'Play & Design',network:'Network News'})[article.cat] || article.cat),
    title: article.title,
    subtitle: article.subtitle || '',
    excerpt: article.excerpt,
    body: article.body,
    kidTake: article.kidTake || '',
    familyDiscussion: article.familyDiscussion || [],
    glossary: article.glossary || [],
    ageBand: article.ageBand || '8+',
    author,
    authorInit,
    authorRole: article.authorRole || (({ai:'AI Correspondent',space:'Aerospace Correspondent',robotics:'Robotics Correspondent',biotech:'Biotech Correspondent',quantum:'Quantum Correspondent',climate:'Climate Correspondent',engineering:'Engineering Correspondent',math:'Data Science Correspondent',cyber:'Cybersecurity Correspondent',gaming:'Esports Correspondent',music:'Music Correspondent',stem:'STEM Correspondent',play:'Play & Design Correspondent',network:'Newsroom'})[article.cat] || 'Correspondent'),
    date: article.date,
    publishedAt,
    read: article.read || Math.max(2, Math.ceil((article.body.replace(/<[^>]+>/g, ' ').split(/\s+/).length) / 220)),
    views: article.views || 0,
    likes: article.likes || 0,
    comments: article.comments || 0,
    shares: article.shares || 0,
    tags: article.tags || [],
    color: article.color || colorByCat[article.cat] || '#00e5ff',
    gradient: article.gradient || ('linear-gradient(135deg, ' + (colorByCat[article.cat] || '#00e5ff') + ', ' + (partnerByCat[article.cat] || '#a855f7') + ')'),
    emoji: article.emoji || emojiByCat[article.cat] || '🛰️',
    featured: !!article.featured,
    pinned: !!article.pinned,
    live: !!article.live,
    sources: article.sources || []
  };

  // Write article file
  const dir = path.join(ART_ROOT, article.date);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, slug + '.json');
  const isUpdate = fs.existsSync(filePath);
  fs.writeFileSync(filePath, JSON.stringify(full, null, 2));

  // Update manifest
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const relPath = 'data/articles/' + article.date + '/' + slug + '.json';
  const entry = {
    id: full.id,
    slug: full.slug,
    path: relPath,
    cat: full.cat,
    title: full.title,
    excerpt: full.excerpt,
    heroImage: full.heroImage,
    kidTake: full.kidTake,
    ageBand: full.ageBand,
    author: full.author,
    authorInit: full.authorInit,
    date: full.date,
    publishedAt: full.publishedAt,
    read: full.read,
    views: full.views,
    likes: full.likes,
    comments: full.comments,
    shares: full.shares,
    tags: full.tags,
    color: full.color,
    gradient: full.gradient,
    emoji: full.emoji,
    featured: full.featured,
    pinned: full.pinned,
    live: full.live
  };

  // Replace existing entry or append
  const idx = manifest.articles.findIndex(a => a.id === full.id);
  if (idx >= 0) manifest.articles[idx] = entry;
  else manifest.articles.unshift(entry);

  // Sort: newest first (publishedAt desc, then id)
  manifest.articles.sort((a, b) => {
    const da = new Date(b.publishedAt || b.date) - new Date(a.publishedAt || a.date);
    if (da !== 0) return da;
    return (b.id || '').localeCompare(a.id || '');
  });

  manifest.lastUpdated = now.toISOString();
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  console.log((isUpdate ? 'UPDATED' : 'PUBLISHED') + ':', full.title);
  console.log('  cat:', full.cat, '· author:', full.author, '· date:', full.date);
  console.log('  file:', path.relative(SKYNET_ROOT, filePath));
  console.log('  manifest now has', manifest.articles.length, 'articles');
}

main().catch(e => { console.error('FATAL:', e); process.exit(99); });
