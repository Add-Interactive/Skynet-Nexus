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

const SKYNET_ROOT = 'C:\\Users\\bekin\\OneDrive\\Desktop\\Skynet';
const DATA_ROOT = path.join(SKYNET_ROOT, 'data');
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
  const validCats = ['stem', 'robotics', 'play', 'music', 'network'];
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
  const emojiByCat = { stem: '🧬', robotics: '🤖', play: '🎨', music: '🎧', network: '🛰️' };
  const colorByCat = { stem: '#00e5ff', robotics: '#a855f7', play: '#39ff14', music: '#ff2e63', network: '#00e5ff' };
  const partnerByCat = { stem: '#a855f7', robotics: '#ff2e63', play: '#00e5ff', music: '#ffb800', network: '#ff2e63' };

  const author = article.author || 'The Newsroom';
  const authorInit = article.authorInit || author.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const now = new Date();
  const publishedAt = article.publishedAt || new Date(article.date + 'T10:00:00-04:00').toISOString();

  const full = {
    id,
    slug,
    cat: article.cat,
    categoryLabel: article.categoryLabel || (({stem:'STEM Signal',robotics:'Robotics Signal',play:'Play & Design',music:'Music Signal',network:'Network News'})[article.cat] || article.cat),
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
    authorRole: article.authorRole || (({stem:'STEM Correspondent',robotics:'Robotics Correspondent',play:'Play & Design Correspondent',music:'Music Correspondent',network:'Newsroom'})[article.cat] || 'Correspondent'),
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
