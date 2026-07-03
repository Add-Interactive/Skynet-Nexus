#!/usr/bin/env node
// Grabs an avatar/image for each STEM creator directly from their source page
// (Open Graph `og:image` / `twitter:image`) and writes it into stem-creators.json
// under an `image` field. Sources that don't expose an image (JS-rendered pages
// like TikTok / X) are left without one so the UI can fall back to an initials
// avatar. Re-run any time to refresh: `node scripts/fetch-creator-images.js`.

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'public', 'assets', 'data', 'stem-creators.json');
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
  const creators = data.creators || [];
  let found = 0;
  for (const c of creators) {
    if (!c.url) { console.log('—  ', c.id, '(no url)'); continue; }
    const r = await fetchImage(c.url);
    if (r.ok && r.image) {
      c.image = r.image;
      found++;
      console.log('✓  ', c.id.padEnd(22), r.image.slice(0, 70));
    } else {
      delete c.image;
      console.log('·  ', c.id.padEnd(22), r.status ? 'no og:image (' + r.status + ')' : (r.error || 'none'));
    }
  }
  data.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n');
  console.log('\nDone. ' + found + '/' + creators.length + ' creators now have a source image.');
})();
