// Space Center daily TLE refresh — server side.
//
// Why this exists: Space Center used to ship two bundled TLE snapshots
// (public/assets/data/space-center/tle-snapshot-a/b.json, dated 2026-10-13).
// The page warned "satellite positions may be slightly stale" once those were
// older than 14 days, and the only fix was a manual snapshot rebuild + PR.
// This module rebuilds the SAME curated satellite set from CelesTrak once a
// day, automatically, after one merge + deploy — nobody has to do anything.
//
// How it works:
//  - On boot it seeds its cache from the newest of: the persisted cache on
//    the data volume (written after every successful refresh) and the
//    bundled snapshots. Persisting matters: the cache used to live only in
//    memory, so every deploy reset the globe to the bundled snapshot date
//    until the next successful fetch — the site kept "saying stale" after
//    each push even though the daily refresh itself worked.
//  - 30s after boot, then every 24h after a success (retrying 5m / 15m /
//    1h after failures), it fetches CelesTrak's public `active` TLE group
//    (no key) and replaces the two-line elements for the curated NORAD IDs
//    it already tracks. (There is no CelesTrak GP `debris` group — that URL
//    returns an HTTP 200 error string and zero TLEs; the ~130 curated
//    legacy debris/rocket-body objects it used to promise simply keep
//    their last-good lines, as designed below.) Names, NORAD IDs, and tags
//    are NEVER changed, and no new satellites are added — the globe keeps
//    exactly the set it had, with fresher orbits. Satellites missing from
//    the fresh group keep their last-good lines.
//  - A refresh is only published if at least 80% of the curated set matched
//    fresh TLEs with a recent epoch; otherwise the old cache stays live and
//    the refresh retries in an hour. The globe therefore never breaks or
//    goes blank because of a bad fetch — worst case it keeps serving
//    last-good data and the page honestly shows that data's date.
//  - GET /api/space-center/tle serves the current cache in the same shape as
//    the bundled snapshots: { updated, source, count, sats: [{n,l1,l2,id,tag}] }.
'use strict';

const fs = require('fs');
const path = require('path');

const SNAP_DIR = path.join(__dirname, '..', 'public', 'assets', 'data', 'space-center');
const SNAP_FILES = ['tle-snapshot-a.json', 'tle-snapshot-b.json'];
const CELESTRAK_GROUPS = [
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle',
];
const USER_AGENT = 'Skynet-Nexus-Space-Center/1.0 (daily TLE refresh)';
const FETCH_TIMEOUT_MS = 60000;
const BOOT_DELAY_MS = 30 * 1000;
const REFRESH_OK_MS = 24 * 60 * 60 * 1000;
const REFRESH_RETRY_LADDER_MS = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];
const MIN_MATCH_FRACTION = 0.8;
const MAX_EPOCH_AGE_DAYS = 45;

function loadBundled() {
  try {
    const sats = [];
    let updated = null;
    for (const f of SNAP_FILES) {
      const d = JSON.parse(fs.readFileSync(path.join(SNAP_DIR, f), 'utf8'));
      if (!updated && d.updated) updated = d.updated;
      for (const s of d.sats || []) sats.push(s);
    }
    return { updated, source: 'CelesTrak (free, no key)', count: sats.length, sats };
  } catch (e) {
    console.error('[space-tle] bundled snapshot load failed:', e.message);
    return { updated: null, source: 'CelesTrak (free, no key)', count: 0, sats: [] };
  }
}

// Persist the last-good cache on the data volume (same place the article
// archive lives) so a restart/deploy does NOT fall back to the bundled
// snapshot's date while waiting for the next successful fetch.
const { DATA_DIR } = require('./storage');
const PERSIST_PATH = path.join(DATA_DIR, 'space-tle-cache.json');

function loadPersisted() {
  try {
    const d = JSON.parse(fs.readFileSync(PERSIST_PATH, 'utf8'));
    if (!d || !Array.isArray(d.sats) || d.sats.length < 1000) return null;
    if (!d.sats.every((s) => s && s.l1 && s.l2 && s.id)) return null;
    return { updated: d.updated || null, source: 'CelesTrak (free, no key)', count: d.sats.length, sats: d.sats };
  } catch (e) {
    return null;
  }
}

function savePersisted() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PERSIST_PATH, JSON.stringify(cache));
  } catch (e) {
    console.error('[space-tle] cache persist failed:', e.message);
  }
}

function loadInitial() {
  const bundled = loadBundled();
  const persisted = loadPersisted();
  if (persisted && (!bundled.updated || (persisted.updated && persisted.updated > bundled.updated))) {
    console.log('[space-tle] boot cache: persisted volume cache, updated =', persisted.updated);
    return persisted;
  }
  console.log('[space-tle] boot cache: bundled snapshot, updated =', bundled.updated);
  return bundled;
}

let cache = loadInitial();

function tleEpochMs(l1) {
  // TLE line 1: columns 19-20 = epoch year, 21-32 = epoch day of year.
  const yy = parseInt(l1.slice(18, 20), 10);
  const day = parseFloat(l1.slice(20, 32));
  if (isNaN(yy) || isNaN(day)) return NaN;
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  return Date.UTC(year, 0, 1) + (day - 1) * 86400000;
}

function parseTle(text) {
  // Returns a Map of NORAD ID -> { l1, l2 } for entries with a recent epoch.
  // Input is 3-line TLE text: name line, then a line starting '1 ', then '2 '.
  const out = new Map();
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i + 1 < lines.length; i++) {
    const l1 = lines[i].trim();
    const l2 = lines[i + 1].trim();
    if (!l1.startsWith('1 ') || !l2.startsWith('2 ')) continue;
    const id = l1.slice(2, 7).trim();
    if (!id || out.has(id)) continue;
    const epoch = tleEpochMs(l1);
    if (isNaN(epoch) || Math.abs(Date.now() - epoch) > MAX_EPOCH_AGE_DAYS * 86400000) continue;
    out.set(id, { l1, l2 });
  }
  return out;
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function refresh() {
  try {
    const fresh = new Map();
    for (const url of CELESTRAK_GROUPS) {
      try {
        const text = await fetchText(url);
        const parsed = parseTle(text);
        if (!parsed.size) {
          console.error('[space-tle] group returned no TLE entries (dead URL or error page?):', url);
          continue;
        }
        for (const [id, lines] of parsed) {
          if (!fresh.has(id)) fresh.set(id, lines);
        }
        console.log('[space-tle] fetched', url, '->', fresh.size, 'unique IDs so far');
      } catch (e) {
        console.error('[space-tle] group fetch failed:', url, '-', e.message);
      }
    }
    const base = cache && cache.sats ? cache.sats : [];
    if (!base.length) {
      console.error('[space-tle] no curated set to refresh');
      return false;
    }
    let matched = 0;
    const sats = base.map((s) => {
      const f = fresh.get(String(s.id));
      if (!f) return s;
      matched++;
      return { n: s.n, l1: f.l1, l2: f.l2, id: s.id, tag: s.tag };
    });
    if (matched / base.length < MIN_MATCH_FRACTION) {
      console.error('[space-tle] refresh rejected: only', matched, 'of', base.length,
        'matched fresh TLEs; keeping last-good data');
      return false;
    }
    const today = new Date().toISOString().slice(0, 10);
    cache = { updated: today, source: 'CelesTrak (free, no key)', count: sats.length, sats };
    savePersisted();
    console.log('[space-tle] refreshed:', matched, 'of', base.length, 'sats; updated =', today);
    return true;
  } catch (e) {
    console.error('[space-tle] refresh failed:', e.message);
    return false;
  }
}

function registerSpaceTle(api) {
  api.get('/space-center/tle', (req, res) => {
    if (!cache || !cache.sats || !cache.sats.length) {
      return res.status(503).json({ error: 'TLE data unavailable' });
    }
    res.set('Cache-Control', 'no-store');
    res.json({ updated: cache.updated, source: cache.source, count: cache.sats.length, sats: cache.sats });
  });
  let failures = 0;
  const schedule = (ms) => {
    const timer = setTimeout(async () => {
      const ok = await refresh();
      if (ok) {
        failures = 0;
        schedule(REFRESH_OK_MS);
      } else {
        const delay = REFRESH_RETRY_LADDER_MS[Math.min(failures, REFRESH_RETRY_LADDER_MS.length - 1)];
        failures++;
        console.error('[space-tle] next retry in', Math.round(delay / 60000), 'min');
        schedule(delay);
      }
    }, ms);
    if (typeof timer.unref === 'function') timer.unref();
  };
  schedule(BOOT_DELAY_MS);
}

module.exports = { registerSpaceTle, _parseTle: parseTle, _tleEpochMs: tleEpochMs, _refresh: refresh, _cache: () => cache };
