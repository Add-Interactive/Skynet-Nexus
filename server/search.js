// server/search.js
// Server-side article search. Searches the manifest (titles/summaries) first,
// then article bodies (bounded). Ranked: title matches > summary > body.
// Mounted as require('./search')(api) in server/index.js.

const path = require('path');
const fs = require('fs');
const { DATA_DIR } = require('./storage');

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'manifest.json'), 'utf8'));
  } catch (e) { return { articles: [] }; }
}

function norm(s) {
  return String(s || '').toLowerCase();
}

function score(entry, q) {
  const title = norm(entry.title);
  const summary = norm(entry.summary || entry.dek || '');
  let s = 0;
  if (title.includes(q)) s += 10;
  // word-boundary-ish bonus: all query words in title
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every(w => title.includes(w))) s += 5;
  if (summary.includes(q)) s += 4;
  const chan = norm(entry.channel || entry.cat || '');
  if (chan.includes(q)) s += 2;
  return s;
}

module.exports = function searchRoutes(api) {
  // GET /api/search?q=...&limit=20 — public.
  api.get('/search', (req, res) => {
    try {
      const q = norm(req.query.q || '').trim();
      if (q.length < 2) return res.json({ results: [], q: req.query.q || '' });
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const man = readManifest();
      const articles = man.articles || [];

      // Phase 1: manifest-level scoring (fast).
      let scored = [];
      for (const a of articles) {
        const s = score(a, q);
        if (s > 0) scored.push({ a, s });
      }
      scored.sort((x, y) => y.s - x.s);
      let top = scored.slice(0, limit);

      // Phase 2: if fewer than limit, scan bodies of remaining articles (bounded).
      if (top.length < limit) {
        const seen = new Set(top.map(t => String(t.a.id)));
        const need = limit - top.length;
        let scanned = 0;
        for (const a of articles) {
          if (scanned >= 120 || top.length >= limit) break; // bound I/O
          if (seen.has(String(a.id))) continue;
          scanned++;
          try {
            const rel = String(a.path || '').replace(/^data\//, '');
            if (!rel) continue;
            const aj = JSON.parse(fs.readFileSync(path.join(DATA_DIR, rel), 'utf8'));
            const bodyText = norm(String(aj.body || '').replace(/<[^>]+>/g, ' '));
            if (bodyText.includes(q)) {
              top.push({ a, s: 1 });
              if (top.length >= limit) break;
            }
          } catch (e) { /* skip unreadable */ }
        }
      }

      const results = top.slice(0, limit).map(({ a, s }) => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        summary: a.summary || a.dek || '',
        channel: a.channel || a.cat || '',
        date: a.date || a.publishedAt || '',
        image: a.heroImage || a.image || '',
        score: s,
      }));
      res.json({ q: req.query.q, count: results.length, results });
    } catch (e) {
      res.status(500).json({ error: 'search failed' });
    }
  });
};
