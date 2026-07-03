#!/usr/bin/env node
// Grabs an image for each entry directly from its source page
// (Open Graph `og:image` / `twitter:image`) and writes it into the target JSON
// under an `image` field. Sources that don't expose an image (JS-rendered pages
// like TikTok / X) are left without one so the UI can fall back gracefully.
//
// Usage:
//   node scripts/fetch-creator-images.js                       # STEM creators
//   node scripts/fetch-creator-images.js summer-programs.json programs

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'assets', 'data');
const FILE = process.argv[2] || 'stem-creators.json';
const KEY = process.argv[3] || 'creators';
const DATA = path.isAbsolute(FILE) ? FILE : path.join(DATA_DIR, FILE);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36';

function extractImage(html) {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1].replace(/&amp;/g, '&');
  }
  return null;
}

async function fetchImage(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: ctrl.signal });
    if (!res.ok) return { ok: false, status: res.status };
    const html = await res.text();
    const img = extractImage(html);
    return { ok: !!img, status: res.status, image: img };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    clearTimeout(t);
  }
}

(async function main() {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const items = data[KEY] || [];
  let found = 0;
  for (const c of items) {
    if (!c.url) { console.log('—  ', c.id, '(no url)'); continue; }
    const r = await fetchImage(c.url);
    if (r.ok && r.image) {
      c.image = r.image;
      found++;
      console.log('✓  ', String(c.id).padEnd(22), r.image.slice(0, 70));
    } else {
      delete c.image;
      console.log('·  ', String(c.id).padEnd(22), r.status ? 'no og:image (' + r.status + ')' : (r.error || 'none'));
    }
  }
  data.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n');
  console.log('\nDone. ' + found + '/' + items.length + ' ' + KEY + ' now have a source image.');
})();
