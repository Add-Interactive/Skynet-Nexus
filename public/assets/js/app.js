
// ============================================================
//   SKYNET NEWSROOM - Manifest/Article Loader
//   Loads data/manifest.json + each article JSON from disk.
//   Normalizes to the shape the render code expects.
// ============================================================
let _manifestPromise = null;
let _articleCache = new Map();
let _manifestLoaded = false;
let _manifest = null;

function _resolveDataUrl(baseUrl, relPath) {
  const b = baseUrl || '';
  return (b + relPath).replace(/([^:])\/{2,}/g, '$1/');
}

function _normalizeArticleBody(body) {
  // Accept either a preformatted HTML string OR an array of legacy blocks.
  if (typeof body === 'string') return body;
  if (!Array.isArray(body)) return '';
  return body.map(block => {
    if (typeof block === 'string') return '<p>' + block + '</p>';
    if (block.type === 'h2') return '<h2>' + block.text + '</h2>';
    if (block.type === 'h3') return '<h3>' + block.text + '</h3>';
    if (block.type === 'blockquote') return '<blockquote>' + block.text + (block.cite ? '<footer>\u2014 ' + block.cite + '</footer>' : '') + '</blockquote>';
    if (block.type === 'list') return '<ul>' + (block.items || []).map(li => '<li>' + li + '</li>').join('') + '</ul>';
    return '';
  }).join('');
}

function _normalizeArticle(a) {
  // Ensure both new-shape and legacy-shape fields exist so the renderer works with either.
  a.authorInitials = a.authorInitials || a.authorInit || (a.author || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  a.authorInit = a.authorInit || a.authorInitials;
  a.readTime = a.readTime || a.read || 5;
  a.read = a.read || a.readTime;
  a.shares = a.shares || 0;
  a.likes = a.likes || 0;
  a.comments = a.comments || 0;
  a.views = a.views || 0;
  a.tags = a.tags || [];
  return a;
}

function loadManifest(baseUrl) {
  if (_manifestPromise) return _manifestPromise;
  const url = _resolveDataUrl(baseUrl, 'data/manifest.json');
  _manifestPromise = fetch(url, { cache: 'no-store' })
    .then(r => {
      if (!r.ok) throw new Error('manifest ' + r.status);
      return r.json();
    })
    .then(m => {
      _manifest = m;
      _manifestLoaded = true;
      // Seed ARTICLES with manifest entries (metadata only) so feeds render fast.
      ARTICLES = (m.articles || []).map(_normalizeArticle);
      return m;
    })
    .catch(err => {
      console.warn('[Skynet] manifest load failed:', err);
      _manifestLoaded = true;
      _manifest = { articles: [] };
      ARTICLES = [];
      return _manifest;
    });
  return _manifestPromise;
}

function loadArticleFull(idOrSlug, baseUrl) {
  const key = String(idOrSlug);
  if (_articleCache.has(key)) return Promise.resolve(_articleCache.get(key));
  // Find manifest entry
  const entry = (_manifest && _manifest.articles || []).find(a =>
    String(a.id) === key ||
    String(a.slug) === key ||
    String(a.legacyId) === key
  );
  if (!entry) return Promise.resolve(null);
  if (entry.body) { _articleCache.set(key, entry); return Promise.resolve(entry); }
  const url = _resolveDataUrl(baseUrl, entry.path);
  return fetch(url, { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(full => {
      if (!full) return null;
      // Merge manifest metadata into full record so nothing is lost
      const merged = Object.assign({}, entry, full);
      merged.body = _normalizeArticleBody(merged.body);
      _normalizeArticle(merged);
      _articleCache.set(key, merged);
      // Also replace the entry in ARTICLES with the enriched version
      const i = ARTICLES.findIndex(x => String(x.id) === String(merged.id));
      if (i >= 0) ARTICLES[i] = merged;
      return merged;
    });
}

/* =========================================================
   SKYNET NEXUS NEWS â€” Article Data (shared)
   Youth-focused STEM / Robotics / Play / Music
   ========================================================= */

// ---------- CHANNEL REGISTRY ----------
// Mirror of server/channels.js. The 11 live channels + legacy aliases so any
// pre-existing article category still resolves to a label/color/icon.
const CHANNELS = [
  { id: 'skynet',      label: 'Skynet',                short: 'Skynet',      icon: '\ud83d\udef0\ufe0f', color: '#00e5ff', color2: '#a855f7' },
  { id: 'network',     label: 'Network',               short: 'Network',     icon: '\ud83d\udef0\ufe0f', color: '#00e5ff', color2: '#a855f7' },
  { id: 'ai',          label: 'AI & Machine Learning', short: 'AI',          icon: '\ud83e\udde0', color: '#00e5ff', color2: '#7c3aed' },
  { id: 'space',       label: 'Space & Aerospace',     short: 'Space',       icon: '\ud83d\ude80', color: '#7c5cff', color2: '#00e5ff' },
  { id: 'robotics',    label: 'Robotics & Automation', short: 'Robotics',    icon: '\ud83e\udd16', color: '#a855f7', color2: '#ff2e63' },
  { id: 'biotech',     label: 'Biotech & Health',      short: 'Biotech',     icon: '\ud83e\uddec', color: '#2dd4bf', color2: '#00e5ff' },
  { id: 'quantum',     label: 'Quantum & Computing',   short: 'Quantum',     icon: '\u269b\ufe0f', color: '#22d3ee', color2: '#7c5cff' },
  { id: 'climate',     label: 'Climate & Energy',      short: 'Climate',     icon: '\ud83c\udf0d', color: '#34d399', color2: '#00e5ff' },
  { id: 'engineering', label: 'Engineering & Making',  short: 'Engineering', icon: '\ud83d\udd27', color: '#ffb800', color2: '#ff2e63' },
  { id: 'math',        label: 'Math & Data Science',   short: 'Math',        icon: '\ud83d\udcd0', color: '#f472b6', color2: '#a855f7' },
  { id: 'cyber',       label: 'Cybersecurity & Code',  short: 'Cyber',       icon: '\ud83d\udd10', color: '#38bdf8', color2: '#a855f7' },
  { id: 'gaming',      label: 'Gaming Tournaments',    short: 'Gaming',      icon: '\ud83c\udfae', color: '#39ff14', color2: '#00e5ff' },
  { id: 'music',       label: 'Music Festivals',       short: 'Music',       icon: '\ud83c\udfa7', color: '#ff2e63', color2: '#ffb800' }
];
const LEGACY_CHANNELS = {
  stem:    { id: 'stem',    label: 'STEM',          short: 'STEM',    icon: '\ud83e\uddec', color: '#00e5ff', color2: '#7c3aed' },
  play:    { id: 'play',    label: 'Play & Design', short: 'Play',    icon: '\ud83c\udfa8', color: '#39ff14', color2: '#00e5ff' }
};
const CHANNEL_MAP = {};
CHANNELS.forEach(c => { CHANNEL_MAP[c.id] = c; });
function getChannel(id) { return CHANNEL_MAP[id] || LEGACY_CHANNELS[id] || null; }

// Utility: color-coded SVG placeholder for post thumbnails
function makeThumb(cat, id) {
  const ch = getChannel(cat);
  const [c1, c2] = ch ? [ch.color, ch.color2] : ['#00e5ff', '#7c3aed'];
  const shortLabel = ch ? ch.short : String(cat || '');
  // Hash id to a stable number (id may be a string like '2026-07-01-slug' or a number)
  const idStr = String(id || 'x');
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) hash = ((hash << 5) - hash + idStr.charCodeAt(i)) | 0;
  const seed = Math.abs(hash) % 360;
  const uid = 'i' + Math.abs(hash).toString(36).slice(0, 8);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 360'>
    <defs>
      <linearGradient id='g${uid}' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='${c1}'/>
        <stop offset='100%' stop-color='${c2}'/>
      </linearGradient>
      <pattern id='p${uid}' width='40' height='40' patternUnits='userSpaceOnUse' patternTransform='rotate(${seed})'>
        <rect width='40' height='40' fill='transparent'/>
        <circle cx='20' cy='20' r='1.2' fill='rgba(255,255,255,0.25)'/>
        <path d='M0 0 L40 40' stroke='rgba(255,255,255,0.06)' stroke-width='1'/>
      </pattern>
    </defs>
    <rect width='640' height='360' fill='url(#g${uid})'/>
    <rect width='640' height='360' fill='url(#p${uid})'/>
    <g fill='rgba(255,255,255,0.85)' font-family='Inter,system-ui,sans-serif' font-weight='800'>
      <text x='40' y='320' font-size='42' letter-spacing='-1'>${(shortLabel || '').toUpperCase()}</text>
      <text x='40' y='345' font-size='14' opacity='0.7' letter-spacing='4'>SKYNET NEXUS</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// -------- MAIN ARTICLE DATASET --------
let ARTICLES = [];

// Data continues in articles-2.js

/* Extended article dataset + trending + leaderboard + polls */

// Note: legacy ARTICLES.push(...) block removed - articles now load from data/manifest.json
// -------- TRENDING TOPICS (derived from real published article tags) --------
let TRENDING = [];

// -------- LEADERBOARD (populated from real reader activity once available) --------
const LEADERBOARD = [];

// -------- FEATURED EVENT (for countdown) --------
// No fabricated events in production. Populate this from a real, verified event
// (title/sub/target date/url) to light up the countdown card; until then the
// card is hidden automatically by renderCountdown().
const EVENT = null;

// -------- POLL --------
const POLL = {
  question: 'Which channel are you most excited about this week?',
  options: [
    { label: '\ud83e\uddec STEM \u2014 young scientists' },
    { label: '\ud83e\udd16 Robotics \u2014 FIRST & VEX' },
    { label: '\ud83c\udfa8 Play & Design \u2014 kid creators' },
    { label: '\ud83c\udfa7 Music \u2014 teen musicians' }
  ]
};

// -------- LIVE STATS (recomputed from the live manifest in renderStats) --------
const STATS = {
  storiesToday: 0,
  totalStories: 0,
  channels: CHANNELS.length,
  contributors: 0
};

// -------- TICKER (falls back to these if no articles are live yet) --------
const TICKER_FALLBACK = [
  { label: 'LIVE', text: 'Skynet Nexus News is live in beta \u2014 a new family-first edition every day' },
  { label: 'FAMILY', text: 'Every article includes a Kid Take and Family Discussion questions' },
  { label: 'TIP', text: 'Spotted a young maker, scientist, or musician? Send us a story tip from the Contact page' }
];

/* =========================================================
   SKYNET NEXUS NEWS â€” App Runtime part 1 (icons + utils + feed)
   ========================================================= */

// ---------- Icon Library (inline SVG) ----------
const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2s4 5 4 9-4 6-4 6-4-2-4-6c0-2 2-4 2-4s0-2-1-3c3 0 3-2 3-2z"/></svg>',
  stem:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1l2.1-2.1M17 7l2.1-2.1"/></svg>',
  robot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M9 4h6M9 14h.01M15 14h.01M9 18h6"/></svg>',
  gamepad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12a4 4 0 014 4v4a4 4 0 01-4 4h-1l-2-3H9l-2 3H6a4 4 0 01-4-4v-4a4 4 0 014-4z"/><path d="M8 12v3M6.5 13.5h3M15 13h.01M18 15h.01"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 004 0"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>',
  thumbsUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
  thumbsDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm10-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"/></svg>',
  comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5L8.6 10.5"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"/></svg>',
  bookmarks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a2 2 0 012-2h10a2 2 0 012 2v3M8 3v18l4-3 4 3V8a2 2 0 012-2h2v15a2 2 0 01-2 2H4"/></svg>',
  events: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M6 3h12v4a6 6 0 01-12 0zM6 5H3a3 3 0 003 3M18 5h3a3 3 0 01-3 3"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1A4 4 0 0116 11"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>',
  twitter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 5.9a8.5 8.5 0 01-2.4.7 4.2 4.2 0 001.8-2.3 8.4 8.4 0 01-2.7 1 4.2 4.2 0 00-7.3 3.8A11.9 11.9 0 013 4.7a4.2 4.2 0 001.3 5.6 4 4 0 01-1.9-.5v.1a4.2 4.2 0 003.4 4.1 4 4 0 01-1.9.1 4.2 4.2 0 004 2.9A8.5 8.5 0 012 18.6a12 12 0 006.5 1.9c7.7 0 12-6.4 12-12v-.5A8.7 8.7 0 0022 5.9z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.4a4 4 0 11-8 0 4 4 0 018 0zM17.5 6.5h.01"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 6.4a2.8 2.8 0 00-1.9-2C18.9 4 12 4 12 4s-6.9 0-8.6.4A2.8 2.8 0 001.5 6.4 29 29 0 001 12a29 29 0 00.5 5.6 2.8 2.8 0 001.9 2C5.1 20 12 20 12 20s6.9 0 8.6-.4a2.8 2.8 0 001.9-2A29 29 0 0023 12a29 29 0 00-.5-5.6zM9.8 15.3V8.7L15.6 12z"/></svg>',
  discord: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.3 5.3a17 17 0 00-4.2-1.3 12 12 0 00-.5 1 15.6 15.6 0 00-4.9 0 11 11 0 00-.6-1 17 17 0 00-4.2 1.3 17.3 17.3 0 00-3 11.6 17 17 0 005.2 2.6 12.4 12.4 0 001.1-1.8 11.3 11.3 0 01-1.6-.8l.3-.3a12.3 12.3 0 0010.5 0l.4.3a10.5 10.5 0 01-1.7.8 14 14 0 001.2 1.8 17 17 0 005.2-2.6 17.2 17.2 0 00-3-11.6zM8.5 14.3a2 2 0 110-4.1 2 2 0 010 4.1zm7 0a2 2 0 110-4.1 2 2 0 010 4.1z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 8.7a7 7 0 01-4.1-1.3v6.9a5.5 5.5 0 11-5.5-5.5v3a2.5 2.5 0 102.5 2.5V2h3a4 4 0 004 4v2.7z"/></svg>'
};

// ---------- Utility ----------
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function categoryLabel(cat) {
  const ch = getChannel(cat);
  return ch ? ch.short : cat;
}
function friendlyDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffH = Math.floor((now - d) / 3600000);
  if (diffH < 1) return 'just now';
  if (diffH < 24) return diffH + 'h ago';
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return diffD + 'd ago';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function formatCount(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

// ---------- LocalStorage helpers ----------
const LS = {
  get(k, fallback) { try { const v = localStorage.getItem('skeynet_' + k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem('skeynet_' + k, JSON.stringify(v)); } catch {} }
};

// ---------- Notification System for Unseen Articles ----------
function ensureNotificationBell() {
  const actions = document.querySelector('.top-actions');
  if (!actions) return;
  if (document.getElementById('notif-toggle')) return; // already exists
  
  const btn = document.createElement('button');
  btn.className = 'icon-btn';
  btn.id = 'notif-toggle';
  btn.setAttribute('aria-label', 'Notifications');
  btn.style.position = 'relative';
  btn.style.marginRight = '8px';
  btn.innerHTML = `<span id="ic-bell">${ICONS.bell}</span>
  <span class="notif-badge" id="notif-badge" style="display:none; position:absolute; top:-2px; right:-2px; background:#ff2e63; color:#fff; font-size:9px; font-weight:800; border-radius:50%; min-width:14px; height:14px; display:grid; place-items:center; box-shadow:0 0 6px #ff2e63; line-height:1;"></span>`;
  
  // Insert before the theme-toggle or user slot
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) actions.insertBefore(btn, themeToggle);
  else actions.appendChild(btn);

  // Inject CSS styles for dropdown and notifications
  if (!document.getElementById('notif-styles')) {
    const style = document.createElement('style');
    style.id = 'notif-styles';
    style.textContent = `
      .notif-dropdown {
        position: absolute;
        top: 60px;
        right: 20px;
        width: 320px;
        background: var(--bg-card, #121824);
        border: 1px solid var(--border, #222e45);
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5), var(--glow-cyan);
        z-index: 1000;
        display: none;
        max-height: 400px;
        overflow-y: auto;
      }
      .notif-dropdown.show {
        display: block;
      }
      .notif-header {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border, #222e45);
        font-weight: 700;
        font-size: 0.9rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: var(--text, #fff);
      }
      .notif-clear {
        font-size: 0.75rem;
        color: var(--accent, #00e5ff);
        background: none;
        border: none;
        cursor: pointer;
      }
      .notif-clear:hover {
        text-decoration: underline;
      }
      .notif-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .notif-item {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border, #222e45);
        cursor: pointer;
        transition: background 0.2s;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .notif-item:hover {
        background: rgba(0, 229, 255, 0.05);
      }
      .notif-item-title {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--text, #fff);
        line-height: 1.3;
      }
      .notif-item-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.75rem;
        color: var(--text-mute, #7c8898);
      }
      .notif-item-tag {
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        color: #0a0e17;
      }
      .notif-empty {
        padding: 24px 16px;
        text-align: center;
        color: var(--text-mute, #7c8898);
        font-size: 0.85rem;
      }
    `;
    document.head.appendChild(style);
  }

  // Create the dropdown menu container
  let dropdown = document.getElementById('notif-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'notif-dropdown';
    dropdown.className = 'notif-dropdown';
    document.body.appendChild(dropdown);
  }

  // Bind toggle click
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
    renderNotificationsList();
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.remove('show');
    }
  });
}

function updateNotifications() {
  const seen = LS.get('seen_articles', []);
  const unseen = ARTICLES.filter(a => a.id && !seen.includes(a.id));
  
  // 1. Update the bell icon badge
  const badge = document.getElementById('notif-badge');
  if (badge) {
    if (unseen.length > 0) {
      badge.style.display = 'grid';
      badge.textContent = unseen.length;
    } else {
      badge.style.display = 'none';
    }
  }
  
  // 2. Update the sidebar channels list indicator
  document.querySelectorAll('.sidebar .nav-link').forEach(link => {
    let url;
    try {
      url = new URL(link.href, location.href);
    } catch (err) {
      return;
    }
    const cId = url.searchParams.get('c');
    if (cId) {
      const hasUnseen = ARTICLES.some(art => art.cat === cId && !seen.includes(art.id));
      let dot = link.querySelector('.notif-dot-small');
      if (hasUnseen) {
        if (!dot) {
          dot = document.createElement('span');
          dot.className = 'notif-dot-small';
          dot.style.cssText = 'background:#ff2e63;width:6px;height:6px;border-radius:50%;display:inline-block;margin-left:auto;box-shadow:0 0 4px #ff2e63;';
          link.appendChild(dot);
        }
      } else {
        if (dot) dot.remove();
      }
    }
  });
}

function renderNotificationsList() {
  const dropdown = document.getElementById('notif-dropdown');
  if (!dropdown) return;
  const seen = LS.get('seen_articles', []);
  const unseen = ARTICLES.filter(a => a.id && !seen.includes(a.id));
  
  let html = `<div class="notif-header">
    <span>Unread Stories</span>
    ${unseen.length > 0 ? '<button class="notif-clear" id="btn-clear-notifs">Mark all read</button>' : ''}
  </div>`;
  
  if (unseen.length === 0) {
    html += `<div class="notif-empty">🎉 All caught up! No unread stories.</div>`;
  } else {
    html += '<ul class="notif-list">';
    unseen.forEach(a => {
      const ch = getChannel(a.cat) || { label: a.cat, color: '#00e5ff' };
      html += `
        <li class="notif-item" data-id="${a.id}">
          <div class="notif-item-title">${a.title}</div>
          <div class="notif-item-meta">
            <span class="notif-item-tag" style="background:${ch.color}">${ch.short || ch.label}</span>
            <span>${friendlyDate(a.date)}</span>
          </div>
        </li>
      `;
    });
    html += '</ul>';
  }
  
  dropdown.innerHTML = html;

  // Bind clear button
  const clearBtn = dropdown.querySelector('#btn-clear-notifs');
  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const allIds = ARTICLES.map(a => a.id).filter(Boolean);
      LS.set('seen_articles', allIds);
      updateNotifications();
      renderNotificationsList();
    });
  }

  // Bind item clicks to navigation
  dropdown.querySelectorAll('.notif-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const seen = LS.get('seen_articles', []);
      if (!seen.includes(id)) {
        seen.push(id);
        LS.set('seen_articles', seen);
      }
      dropdown.classList.remove('show');
      updateNotifications();
      
      const base = location.pathname.includes('/pages/') ? '../' : './';
      location.href = base + 'pages/article.html?id=' + id;
    });
  });
}

// ---------- Theme ----------
function initTheme() {
  const saved = LS.get('theme', 'dark');
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.innerHTML = saved === 'light' ? ICONS.moon : ICONS.sun;
    btn.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const nxt = cur === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', nxt);
      LS.set('theme', nxt);
      btn.innerHTML = nxt === 'light' ? ICONS.moon : ICONS.sun;
    });
  }
  ensureNotificationBell();
  updateNotifications();
}

// ---------- Toast ----------
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.innerHTML = ICONS.info + '<span>' + msg + '</span>';
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(t._to);
  t._to = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- Post Card ----------
function renderPost(a, featured, base) {
  base = base || '';
  const thumbsUp = LS.get('thumbs_up_' + a.id, false);
  const thumbsDown = LS.get('thumbs_down_' + a.id, false);
  const saved = LS.get('save_' + a.id, false);
  const thumbsUpDisplay = formatCount(a.likes + (thumbsUp ? 1 : 0));
  const thumbsDownDisplay = formatCount((a.dislikes || 0) + (thumbsDown ? 1 : 0));
  return (
    '<article class="post-card ' + (featured ? 'featured' : '') + '" data-id="' + a.id + '" data-cat="' + a.cat + '" data-href="' + base + 'pages/article.html?id=' + a.id + '">' +
      '<div class="post-media-wrap">' +
        '<img class="post-media" src="' + (a.heroImage || makeThumb(a.cat, a.id)) + '" alt="' + a.title.replace(/"/g, '&quot;') + '"/>' +
        '<span class="post-cat-tag" data-cat="' + a.cat + '">' + categoryLabel(a.cat) + '</span>' +
        (a.ageBand ? '<span class="post-age-chip" data-age="' + a.ageBand + '">' + a.ageBand + '</span>' : '') +
        (a.live ? '<span class="post-live">Live</span>' : '') +
      '</div>' +
      '<div class="post-body">' +
        '<h3 class="post-title">' + a.title + '</h3>' +
        '<p class="post-excerpt">' + a.excerpt + '</p>' +
        '<div class="post-meta">' +
          '<div class="post-author"><span class="author-avatar">' + a.authorInitials + '</span><span>' + a.author + '</span></div>' +
          '<span class="dot">•</span><span>' + friendlyDate(a.date) + '</span>' +
          '<span class="dot">•</span><span>' + a.readTime + ' min</span>' +
          '<div class="post-actions">' +
            '<button class="like-btn ' + (thumbsUp ? 'liked' : '') + '" data-id="' + a.id + '" title="Thumbs Up">' + ICONS.thumbsUp + '<span>' + thumbsUpDisplay + '</span></button>' +
            '<button class="dislike-btn ' + (thumbsDown ? 'disliked' : '') + '" data-id="' + a.id + '" title="Thumbs Down">' + ICONS.thumbsDown + '<span>' + thumbsDownDisplay + '</span></button>' +
            '<button class="save-btn ' + (saved ? 'liked' : '') + '" data-id="' + a.id + '" title="Save">' + ICONS.bookmark + '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</article>'
  );
}

/* =========================================================
   SKYNET NEXUS NEWS â€” App Runtime part 2
   (feed filtering, widgets, article page, contact form)
   ========================================================= */

// ---------- Feed state ----------
let currentFilter = 'all';
let currentSort = 'latest';
let searchQuery = '';
let feedBase = '';
let _feedRssToken = 0;

// Shared helpers for rendering curated RSS "live headline" cards.
function rssEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function rssTimeAgo(iso) {
  if (!iso) return '';
  const t = Date.parse(iso); if (isNaN(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 3600) return Math.round(s / 60) + 'm ago';
  if (s < 86400) return Math.round(s / 3600) + 'h ago';
  const d = Math.round(s / 86400); return d + (d === 1 ? ' day ago' : ' days ago');
}
function rssCardHtml(it, ch) {
  const img = it.image ? '<div class="rss-thumb" style="background-image:url(' + rssEsc(it.image) + ')"></div>' : '';
  const chan = ch ? '<span class="rss-chan" style="--cc:' + (ch.color || '#00e5ff') + '">' + rssEsc(ch.icon) + ' ' + rssEsc(ch.short || ch.label) + '</span>' : '';
  return '<a class="rss-card" href="' + rssEsc(it.link) + '" target="_blank" rel="noopener">' + img +
    '<div class="rss-body"><div class="rss-top">' + chan + '<span class="rss-src">' + rssEsc(it.source) + '</span></div>' +
    '<h3 class="rss-title">' + rssEsc(it.title) + '</h3>' +
    (it.summary ? '<p class="rss-sum">' + rssEsc(it.summary) + '</p>' : '') +
    '<div class="rss-meta"><span>' + rssEsc(it.site) + '</span>' + (it.publishedAt ? '<span>' + rssTimeAgo(it.publishedAt) + '</span>' : '') + '</div></div></a>';
}

function getFilteredArticles() {
  let list = [...ARTICLES];
  if (currentFilter !== 'all') list = list.filter(a => a.cat === currentFilter);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.excerpt.toLowerCase().includes(q) ||
      a.author.toLowerCase().includes(q) ||
      (a.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  const sortFn = (a, b) => {
    if (currentSort === 'trending')       return (b.likes + b.shares) - (a.likes + a.shares);
    if (currentSort === 'popular')        return b.likes - a.likes;
    if (currentSort === 'commented')      return b.comments - a.comments;
    const dateB = new Date(b.publishedAt || b.date);
    const dateA = new Date(a.publishedAt || a.date);
    const diff = dateB - dateA;
    if (diff !== 0) return diff;
    return (b.id || '').localeCompare(a.id || '');
  };

  list.sort(sortFn);
  return list;
}

function renderFeed() {
  const grid = document.getElementById('feed-grid');
  if (!grid) return;
  const list = getFilteredArticles();
  const token = ++_feedRssToken;

  // 1) Editorial stories first (if any match the current filter/search).
  if (list.length) {
    grid.className = 'feed-grid';
    grid.innerHTML = list.map((a, i) => {
      const isSkynetDrop = (a.cat === 'skynet');
      const isFirstAll = (i === 0 && currentFilter === 'all' && !searchQuery);
      const isFeatured = isSkynetDrop || isFirstAll;
      return renderPost(a, isFeatured, feedBase);
    }).join('');
    bindPostEvents();
  } else {
    grid.className = 'feed-grid';
    grid.innerHTML = '<div class="feed-loading" style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text-mute)">Loading live headlines…</div>';
  }

  // 2) Search is editorial-only — don't mix in live feeds while searching.
  if (searchQuery) {
    if (!list.length) grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text-mute)"><h3 style="margin-bottom:8px;color:var(--text)">No stories match “' + rssEsc(searchQuery) + '”</h3><p>Try a different search or clear it to see the live feed.</p></div>';
    return;
  }

  // 3) Fill the feed with live curated RSS for the current channel (or all).
  loadFeedRss(currentFilter || 'all', grid, list.length, token);
}

// Loads curated RSS items into the main feed grid. Editorial cards (if any)
// stay on top; live headline cards are appended below.
function loadFeedRss(channel, grid, hadEditorial, token) {
  fetch('/api/rss?limit=40&all=1&channel=' + encodeURIComponent(channel))
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (token !== _feedRssToken) return; // a newer filter click superseded us
      const items = (data && data.items) || [];
      const ph = grid.querySelector('.feed-loading');
      if (ph) ph.remove();
      if (!items.length) {
        if (!hadEditorial) {
          grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--text-mute)"><h3 style="margin-bottom:8px;color:var(--text)">Live feed is catching its breath</h3><p>These headlines refresh every few minutes — check back shortly.</p></div>';
        }
        return;
      }
      const rssHtml = items.map(it => rssCardHtml(it, getChannel(it.channel))).join('');
      if (hadEditorial) {
        grid.className = 'feed-grid';
        grid.insertAdjacentHTML('beforeend', rssHtml);
      } else {
        grid.className = 'rss-grid';
        grid.innerHTML = rssHtml;
      }
    })
    .catch(() => {
      if (token !== _feedRssToken) return;
      const ph = grid.querySelector('.feed-loading');
      if (ph) ph.remove();
      if (!hadEditorial) grid.innerHTML = '';
    });
}

function bindPostEvents() {
  document.querySelectorAll('.post-card').forEach(card => {
    card.addEventListener('click', () => {
      const href = card.dataset.href;
      if (href) window.location.href = href;
    });
  });
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const curUp = LS.get('thumbs_up_' + id, false);
      const curDown = LS.get('thumbs_down_' + id, false);
      
      if (curDown) {
        LS.set('thumbs_down_' + id, false);
        const card = btn.closest('.post-card');
        const dBtn = card ? card.querySelector('.dislike-btn') : null;
        if (dBtn) {
          dBtn.classList.remove('disliked');
          const article = ARTICLES.find(a => String(a.id) === id);
          if (article) dBtn.querySelector('span').textContent = formatCount(article.dislikes || 0);
        }
      }
      
      LS.set('thumbs_up_' + id, !curUp);
      btn.classList.toggle('liked');
      const article = ARTICLES.find(a => String(a.id) === id);
      const cnt = btn.querySelector('span');
      if (cnt && article) cnt.textContent = formatCount(article.likes + (curUp ? 0 : 1));
      toast(curUp ? 'Removed thumbs up' : 'Thumbs up!');
      
      renderTrending();
    });
  });

  document.querySelectorAll('.dislike-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const curUp = LS.get('thumbs_up_' + id, false);
      const curDown = LS.get('thumbs_down_' + id, false);
      
      if (curUp) {
        LS.set('thumbs_up_' + id, false);
        const card = btn.closest('.post-card');
        const lBtn = card ? card.querySelector('.like-btn') : null;
        if (lBtn) {
          lBtn.classList.remove('liked');
          const article = ARTICLES.find(a => String(a.id) === id);
          if (article) lBtn.querySelector('span').textContent = formatCount(article.likes);
        }
      }
      
      LS.set('thumbs_down_' + id, !curDown);
      btn.classList.toggle('disliked');
      const article = ARTICLES.find(a => String(a.id) === id);
      const cnt = btn.querySelector('span');
      if (cnt && article) cnt.textContent = formatCount((article.dislikes || 0) + (curDown ? 0 : 1));
      toast(curDown ? 'Removed thumbs down' : 'Thumbs down!');
      
      renderTrending();
    });
  });
  document.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const cur = LS.get('save_' + id, false);
      LS.set('save_' + id, !cur);
      btn.classList.toggle('liked');
      toast(cur ? 'Removed from bookmarks' : 'Saved to bookmarks');
    });
  });
}

// ---------- Filter chips + sort ----------
function initFilters() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.cat || 'all';
      renderFeed();
    });
  });
  const sort = document.getElementById('sort-select');
  if (sort) sort.addEventListener('change', e => { currentSort = e.target.value; renderFeed(); });
}

// ---------- Search ----------
function initSearch() {
  const input = document.getElementById('global-search');
  if (!input) return;
  let deb;
  input.addEventListener('input', e => {
    clearTimeout(deb);
    deb = setTimeout(() => {
      searchQuery = e.target.value.trim();
      renderFeed();
    }, 220);
  });
}

// ---------- Right rail widgets ----------
function renderTrending() {
  const el = document.getElementById('trending-list');
  if (!el) return;
  
  // Sort articles by thumbs up count (a.likes + user thumbs up)
  const sorted = [...ARTICLES].sort((a, b) => {
    const aUp = a.likes + (LS.get('thumbs_up_' + a.id, false) ? 1 : 0);
    const bUp = b.likes + (LS.get('thumbs_up_' + b.id, false) ? 1 : 0);
    return bUp - aUp;
  }).slice(0, 5);

  if (!sorted.length) {
    el.innerHTML = '<li class="trend-empty" style="color:var(--text-mute);padding:12px 4px;font-size:.85rem">No trending articles yet.</li>';
    return;
  }
  
  el.innerHTML = sorted.map((a, i) => {
    const upCount = a.likes + (LS.get('thumbs_up_' + a.id, false) ? 1 : 0);
    return `
      <li data-art-id="${a.id}">
        <span class="trend-num">${String(i + 1).padStart(2, '0')}</span>
        <div class="trend-body">
          <span class="trend-hashtag">${a.title}</span>
          <span class="trend-meta">By ${a.author} • ${categoryLabel(a.cat)} • 👍 ${upCount}</span>
        </div>
      </li>
    `;
  }).join('');

  el.querySelectorAll('li[data-art-id]').forEach(li => {
    li.addEventListener('click', () => {
      const id = li.dataset.artId;
      const base = location.pathname.includes('/pages/') ? '../' : './';
      location.href = base + 'pages/article.html?id=' + id;
    });
  });
}

function renderLeaderboard() {
  const el = document.getElementById('leaderboard');
  if (!el) return;
  if (!LEADERBOARD.length) {
    el.innerHTML = '<div class="lb-empty" style="color:var(--text-mute);padding:12px 4px;font-size:.85rem">Reader rankings open up as the community grows. Check back soon.</div>';
    return;
  }
  el.innerHTML = LEADERBOARD.map(u =>
    '<div class="lb-item">' +
      '<div class="lb-rank">' + u.rank + '</div>' +
      '<div class="lb-avatar">' + u.av + '</div>' +
      '<div class="lb-body">' +
        '<div class="lb-name">' + u.name + '</div>' +
        '<div class="lb-crew">' + u.crew + '</div>' +
      '</div>' +
      '<div class="lb-score">' + formatCount(u.score) + '</div>' +
    '</div>'
  ).join('');
}

function renderCountdown() {
  const el = document.getElementById('countdown-grid');
  if (!el) return;
  // Hide the whole "Featured Event" card unless a real, future event is set.
  const card = el.closest('.countdown-card') || el.closest('.widget');
  const hasEvent = EVENT && EVENT.title && EVENT.target instanceof Date && !isNaN(EVENT.target) && (EVENT.target - new Date()) > 0;
  if (!hasEvent) {
    if (card) card.hidden = true;
    return;
  }
  if (card) card.hidden = false;
  const titleEl = document.getElementById('countdown-title');
  const subEl = document.getElementById('countdown-sub');
  if (titleEl) titleEl.textContent = EVENT.title;
  if (subEl) subEl.textContent = EVENT.sub;
  const linkEl = document.getElementById('countdown-link');
  if (linkEl) {
    if (EVENT.url) {
      linkEl.href = EVENT.url;
      linkEl.hidden = false;
    } else {
      linkEl.hidden = true;
    }
  }
  const tick = () => {
    const diff = Math.max(0, EVENT.target - new Date());
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff / 3600000) % 24);
    const m = Math.floor((diff / 60000) % 60);
    const s = Math.floor((diff / 1000) % 60);
    el.innerHTML =
      '<div class="countdown-cell"><div class="countdown-num">' + String(d).padStart(2, '0') + '</div><div class="countdown-lab">days</div></div>' +
      '<div class="countdown-cell"><div class="countdown-num">' + String(h).padStart(2, '0') + '</div><div class="countdown-lab">hrs</div></div>' +
      '<div class="countdown-cell"><div class="countdown-num">' + String(m).padStart(2, '0') + '</div><div class="countdown-lab">min</div></div>' +
      '<div class="countdown-cell"><div class="countdown-num">' + String(s).padStart(2, '0') + '</div><div class="countdown-lab">sec</div></div>';
  };
  tick();
  setInterval(tick, 1000);
}

// Live "next edition" countdown bar. Reads /api/schedule once, then ticks down
// to the next drop; when it hits zero it refreshes the schedule for the next one.
let _nextDropTimer = null;
function renderNextDrop() {
  const bar = document.getElementById('drop-countdown');
  if (!bar) return;
  const labelEl = document.getElementById('drop-label');
  const timerEl = document.getElementById('drop-timer');
  let target = null;
  let edition = '';

  const load = () => fetch('/api/schedule')
    .then(r => r.ok ? r.json() : null)
    .then(s => {
      if (!s || !s.nextDrop) { bar.hidden = true; return; }
      target = new Date(s.nextDrop.at);
      edition = s.nextDrop.edition || '';
      bar.hidden = false;
    })
    .catch(() => { bar.hidden = true; });

  const tick = () => {
    if (!target) return;
    const diff = target - new Date();
    if (diff <= 0) { target = null; load(); return; }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff / 60000) % 60);
    const s = Math.floor((diff / 1000) % 60);
    if (timerEl) timerEl.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    if (labelEl) labelEl.textContent = edition ? (edition.charAt(0).toUpperCase() + edition.slice(1) + ' edition') : 'Next edition';
  };

  if (_nextDropTimer) clearInterval(_nextDropTimer);
  load().then(tick);
  _nextDropTimer = setInterval(tick, 1000);
}

// Live curated RSS headlines for a channel. If the channel has no editorial
// articles, the live feeds become the channel's main content (rendered into
// #feed-grid); otherwise they appear in the "From around the web" section.
function renderChannelRss(channelId) {
  const rssGrid = document.getElementById('rss-grid');
  const section = document.getElementById('rss-section');
  if (!channelId) return;

  // Editorial/internal channels have no external RSS feeds
  if (channelId === 'network' || channelId === 'skynet') {
    if (section) section.hidden = true;
    if (rssGrid) rssGrid.hidden = true;
    return;
  }

  const ch = getChannel(channelId);
  const cardHtml = it => rssCardHtml(it, ch);
  const more = document.getElementById('rss-more');
  if (more) more.href = (feedBase || '') + 'pages/feeds.html?c=' + channelId;

  // Does this channel have any editorial articles?
  const hasEditorial = getFilteredArticles().length > 0;

  fetch('/api/rss?limit=40&all=1&channel=' + encodeURIComponent(channelId))
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      const items = (data && data.items) || [];
      if (!items.length) return;
      if (!hasEditorial) {
        // Live feeds ARE the channel — render them into the main feed grid.
        const feedGrid = document.getElementById('feed-grid');
        if (feedGrid) {
          feedGrid.className = 'rss-grid';
          feedGrid.innerHTML = items.map(cardHtml).join('');
        }
        if (section) section.hidden = true;
        if (rssGrid) rssGrid.hidden = true;
        return;
      }
      // Channel has editorial stories — show feeds in the secondary section.
      if (!rssGrid) return;
      rssGrid.innerHTML = items.slice(0, 9).map(cardHtml).join('');
      rssGrid.hidden = false;
      if (section) section.hidden = false;
    })
    .catch(() => {});
}

function renderStats() {
  const el = document.getElementById('stat-tiles');
  if (!el) return;
  // Compute honest numbers from the live manifest.
  const today = new Date().toISOString().slice(0, 10);
  const storiesToday = ARTICLES.filter(a => String(a.date || '').slice(0, 10) === today).length;
  const authors = new Set(ARTICLES.map(a => a.author).filter(Boolean));
  STATS.storiesToday = storiesToday;
  STATS.totalStories = ARTICLES.length;
  STATS.contributors = authors.size;
  STATS.channels = CHANNELS.length;
  const tiles = [
    { num: STATS.totalStories, lab: 'Stories Live' },
    { num: STATS.storiesToday, lab: 'Published Today' },
    { num: STATS.channels, lab: 'Channels' },
    { num: STATS.contributors, lab: 'Contributors' }
  ];
  el.innerHTML = tiles.map(t =>
    '<div class="stat-tile"><div class="num">' + formatCount(t.num) + '</div><div class="lab">' + t.lab + '</div></div>'
  ).join('');
}

function renderPoll() {
  const el = document.getElementById('poll-box');
  if (!el) return;
  const voted = LS.get('poll_voted', null);
  const q = document.getElementById('poll-q');
  if (q) q.textContent = POLL.question;
  el.innerHTML = POLL.options.map((o, i) =>
    '<div class="poll-opt' + (voted !== null ? ' voted' : '') + (voted === i ? ' selected' : '') + '" data-i="' + i + '">' +
      '<span class="poll-label">' + o.label + '</span>' +
      (voted === i ? '<span class="poll-pct">✓ your pick</span>' : '') +
    '</div>'
  ).join('');
  if (voted === null) {
    el.querySelectorAll('.poll-opt').forEach(o => {
      o.addEventListener('click', () => {
        LS.set('poll_voted', Number(o.dataset.i));
        renderPoll();
        toast('Thanks for voting!');
      });
    });
  }
}

function renderTicker() {
  const el = document.getElementById('ticker-inner');
  if (!el) return;
  // Prefer real, freshly published headlines; fall back to evergreen site lines.
  let items = ARTICLES.slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6)
    .map(a => ({ label: categoryLabel(a.cat).toUpperCase(), text: a.title }));
  if (!items.length) items = TICKER_FALLBACK;
  
  // Prepend the 4th of July message!
  items.unshift({ label: 'CELEBRATION', text: 'Happy 4th of July 250th Birthday!' });

  // duplicate for seamless scroll
  const html = items.concat(items).map(t =>
    '<span><strong>' + t.label + '</strong> ' + t.text + '</span><span class="sep">•</span>'
  ).join('');
  el.innerHTML = html;
}

function renderNewsletter() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const email = form.querySelector('input').value;
    if (!email || !email.includes('@')) { toast('Enter a valid email'); return; }
    LS.set('subscribed', email);
    toast('Subscribed! Welcome to the crew.');
    form.reset();
  });
}

// ---------- Article Page ----------
function initArticlePage() {
  const container = document.getElementById('article-root');
  if (!container) return;
  const params = new URLSearchParams(location.search);
  const idParam = params.get('id');
  const id = idParam || (ARTICLES[0] && ARTICLES[0].id);
  const a = ARTICLES.find(x => String(x.id) === String(id) || String(x.slug) === String(id) || String(x.legacyId) === String(id)) || ARTICLES[0];
  if (!a) { container.innerHTML = '<div class="empty-state"><h3>Article not found</h3><p>It may have been unpublished or moved.</p></div>'; return; }
  
  // Mark as seen
  const seen = LS.get('seen_articles', []);
  if (a.id && !seen.includes(a.id)) {
    seen.push(a.id);
    LS.set('seen_articles', seen);
  }

  document.title = a.title + ' â€” Skynet Nexus News';
  const thumbsUp = LS.get('thumbs_up_' + a.id, false);
  const thumbsDown = LS.get('thumbs_down_' + a.id, false);
  const saved = LS.get('save_' + a.id, false);

  const bodyHtml = _normalizeArticleBody(a.body || '');

  // Kid-friendly sections (new schema)
  const kidTakeHtml = a.kidTake ? (
    '<div class="kid-take">' +
      '<div class="kid-take-header"><span class="kid-take-badge">Kid Take</span>' +
      (a.ageBand ? '<span class="age-band">Ages ' + a.ageBand + '</span>' : '') + '</div>' +
      '<p>' + a.kidTake + '</p>' +
    '</div>'
  ) : '';

  const glossaryHtml = (a.glossary && a.glossary.length) ? (
    '<div class="glossary">' +
      '<div class="glossary-title">Words to know</div>' +
      '<dl>' + a.glossary.map(g =>
        '<dt>' + g.term + '</dt><dd>' + g.meaning + '</dd>'
      ).join('') + '</dl>' +
    '</div>'
  ) : '';

  const discussionHtml = (a.familyDiscussion && a.familyDiscussion.length) ? (
    '<div class="family-discussion">' +
      '<div class="family-discussion-title"><span class="fd-emoji">💬</span> Talk about it together</div>' +
      '<ol>' + a.familyDiscussion.map(q => '<li>' + q + '</li>').join('') + '</ol>' +
    '</div>'
  ) : '';

  const sourcesHtml = (a.sources && a.sources.length) ? (
    '<div class="sources">' +
      '<div class="sources-title">Read the sources</div>' +
      '<ul>' + a.sources.map(s =>
        '<li><a href="' + s.url + '" target="_blank" rel="noopener">' + s.label + '</a></li>'
      ).join('') + '</ul>' +
    '</div>'
  ) : '';

  // Thread updates timeline
  let threadHtml = '';
  if (a.thread) {
    const threadArticles = ARTICLES.filter(x => x.thread === a.thread).sort((x, y) => new Date(x.date) - new Date(y.date));
    if (threadArticles.length > 1) {
      threadHtml = 
        '<div class="article-thread">' +
          '<style>' +
            '.article-thread { margin: 30px 0; padding: 20px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; }' +
            '.article-thread .thread-title { font-family: "JetBrains Mono", monospace; font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }' +
            '.thread-timeline { display: flex; flex-direction: column; gap: 16px; position: relative; padding-left: 20px; }' +
            '.thread-timeline::before { content: ""; position: absolute; left: 6px; top: 8px; bottom: 8px; width: 2px; background: var(--border); }' +
            '.thread-step { display: flex; align-items: flex-start; gap: 12px; text-decoration: none; color: var(--text-mute); transition: all 0.2s; position: relative; }' +
            '.thread-step:hover { color: var(--text); }' +
            '.thread-step.active { color: var(--accent); pointer-events: none; }' +
            '.thread-step .step-dot { position: absolute; left: -18px; top: 6px; width: 10px; height: 10px; border-radius: 50%; background: var(--border); border: 2px solid var(--bg-card); transition: all 0.2s; }' +
            '.thread-step:hover .step-dot { background: var(--text); box-shadow: 0 0 8px var(--text); }' +
            '.thread-step.active .step-dot { background: var(--accent); box-shadow: 0 0 10px var(--accent); }' +
            '.step-details { display: flex; flex-direction: column; gap: 2px; }' +
            '.step-date { font-size: 0.72rem; text-transform: uppercase; font-weight: 700; opacity: 0.8; }' +
            '.step-title { font-size: 0.92rem; font-weight: 600; line-height: 1.3; }' +
          '</style>' +
          '<div class="thread-title">📁 Timeline: Weekly Updates & News</div>' +
          '<div class="thread-timeline">';
      threadArticles.forEach(ta => {
        const isActive = String(ta.id) === String(a.id);
        const activeClass = isActive ? 'active' : '';
        threadHtml += 
          '<a href="article.html?id=' + ta.id + '" class="thread-step ' + activeClass + '">' +
            '<span class="step-dot"></span>' +
            '<span class="step-details">' +
              '<span class="step-date">' + friendlyDate(ta.date) + '</span>' +
              '<span class="step-title">' + ta.title + '</span>' +
            '</span>' +
          '</a>';
      });
      threadHtml += 
          '</div>' +
        '</div>';
    }
  }

  container.innerHTML =
    '<article class="article">' +
      '<div class="article-hero">' +
        '<img src="' + (a.heroImage || makeThumb(a.cat, a.id)) + '" alt=""/>' +
        '<div class="overlay">' +
          '<span class="article-cat" data-cat="' + a.cat + '">' + categoryLabel(a.cat) + '</span>' +
          '<h1 class="article-title">' + a.title + '</h1>' +
          '<div class="article-meta">' +
            '<span class="author-avatar">' + a.authorInitials + '</span>' +
            '<span><strong>' + a.author + '</strong></span>' +
            '<span>•</span>' +
            '<span>' + friendlyDate(a.date) + '</span>' +
            '<span>•</span>' +
            '<span>' + a.readTime + ' min read</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="article-body">' + bodyHtml + '</div>' +
      kidTakeHtml +
      glossaryHtml +
      discussionHtml +
      sourcesHtml +
      threadHtml +
      '<div class="article-tags">' + (a.tags || []).map(t => '<span class="tag">#' + t + '</span>').join('') + '</div>' +
      '<div class="article-toolbar">' +
        '<div class="reactions">' +
          '<button class="react-btn ' + (thumbsUp ? 'active' : '') + '" id="btn-thumbs-up">' + ICONS.thumbsUp + '<span class="cnt">' + formatCount(a.likes + (thumbsUp ? 1 : 0)) + '</span></button>' +
          '<button class="react-btn ' + (thumbsDown ? 'active-dislike' : '') + '" id="btn-thumbs-down">' + ICONS.thumbsDown + '<span class="cnt">' + formatCount((a.dislikes || 0) + (thumbsDown ? 1 : 0)) + '</span></button>' +
          '<button class="react-btn" id="btn-comment">' + ICONS.comment + '<span class="cnt">' + formatCount(a.comments) + '</span></button>' +
          '<button class="react-btn ' + (saved ? 'active' : '') + '" id="btn-save">' + ICONS.bookmark + '</button>' +
        '</div>' +
        '<button class="share-btn" id="btn-share">' + ICONS.share + '<span>Share</span></button>' +
      '</div>' +
      '<div class="comments">' +
        '<div class="comments-title">' + ICONS.comment + '<span>Comments</span><span class="count">' + a.comments + '</span></div>' +
        '<div class="comment-form">' +
          '<div class="author-avatar" style="width:36px;height:36px;font-size:.8rem">YOU</div>' +
          '<textarea placeholder="Drop your take..." id="cmt-text"></textarea>' +
          '<button id="cmt-submit">Post</button>' +
        '</div>' +
        '<div id="comment-list"></div>' +
      '</div>' +
    '</article>';

  // Comments start empty in production; only real reader comments (stored locally) show.
  const userComments = LS.get('comments_' + a.id, []);
  const cl = document.getElementById('comment-list');
  const paint = () => {
    if (!userComments.length) {
      cl.innerHTML = '<div class="comment-empty" style="color:var(--text-mute);padding:16px 4px;font-size:.9rem">No comments yet — be the first to share a kind, on-topic thought.</div>';
      return;
    }
    cl.innerHTML = userComments.map(c =>
      '<div class="comment">' +
        '<div class="author-avatar">' + c.av + '</div>' +
        '<div class="comment-body">' +
          '<div class="comment-head"><strong>' + c.name + '</strong><span class="time">' + c.time + '</span></div>' +
          '<div class="comment-text">' + c.text + '</div>' +
          '<div class="comment-actions"><button>Like</button><button>Reply</button></div>' +
        '</div>' +
      '</div>'
    ).join('');
  };
  paint();

  document.getElementById('cmt-submit').addEventListener('click', () => {
    const ta = document.getElementById('cmt-text');
    const text = (ta.value || '').trim();
    if (!text) return;
    userComments.unshift({ name: 'You', av: 'ME', time: 'just now', text });
    LS.set('comments_' + a.id, userComments);
    ta.value = '';
    paint();
    toast('Comment posted!');
  });

  document.getElementById('btn-thumbs-up').addEventListener('click', () => {
    const curUp = LS.get('thumbs_up_' + a.id, false);
    const curDown = LS.get('thumbs_down_' + a.id, false);
    
    if (curDown) {
      LS.set('thumbs_down_' + a.id, false);
      const btnDown = document.getElementById('btn-thumbs-down');
      if (btnDown) {
        btnDown.classList.remove('active-dislike');
        btnDown.querySelector('.cnt').textContent = formatCount(a.dislikes || 0);
      }
    }
    
    LS.set('thumbs_up_' + a.id, !curUp);
    const btnUp = document.getElementById('btn-thumbs-up');
    btnUp.classList.toggle('active');
    btnUp.querySelector('.cnt').textContent = formatCount(a.likes + (curUp ? 0 : 1));
    toast(curUp ? 'Removed thumbs up' : 'Thumbs up!');
    
    renderTrending();
  });

  document.getElementById('btn-thumbs-down').addEventListener('click', () => {
    const curUp = LS.get('thumbs_up_' + a.id, false);
    const curDown = LS.get('thumbs_down_' + a.id, false);
    
    if (curUp) {
      LS.set('thumbs_up_' + a.id, false);
      const btnUp = document.getElementById('btn-thumbs-up');
      if (btnUp) {
        btnUp.classList.remove('active');
        btnUp.querySelector('.cnt').textContent = formatCount(a.likes);
      }
    }
    
    LS.set('thumbs_down_' + a.id, !curDown);
    const btnDown = document.getElementById('btn-thumbs-down');
    btnDown.classList.toggle('active-dislike');
    btnDown.querySelector('.cnt').textContent = formatCount((a.dislikes || 0) + (curDown ? 0 : 1));
    toast(curDown ? 'Removed thumbs down' : 'Thumbs down!');
    
    renderTrending();
  });
  document.getElementById('btn-save').addEventListener('click', () => {
    const cur = LS.get('save_' + a.id, false);
    LS.set('save_' + a.id, !cur);
    document.getElementById('btn-save').classList.toggle('active');
    toast(cur ? 'Removed from bookmarks' : 'Saved to bookmarks');
  });
  document.getElementById('btn-comment').addEventListener('click', () => {
    document.getElementById('cmt-text').focus();
    document.getElementById('cmt-text').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.getElementById('btn-share').addEventListener('click', async () => {
    const shareData = { title: a.title, text: a.excerpt, url: location.href };
    try {
      if (navigator.share) { await navigator.share(shareData); }
      else { await navigator.clipboard.writeText(location.href); toast('Link copied!'); }
    } catch { toast('Share cancelled'); }
  });
}

// ---------- Contact form ----------
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    toast('Thanks! We\'ll get back to you soon.');
    form.reset();
  });
}

// ---------- Mobile menu ----------
function initMobileMenu() {
  // Support both button ids used across the site (menu-toggle / menu-btn).
  const btn = document.getElementById('menu-toggle') || document.getElementById('menu-btn');
  const sb = document.querySelector('.sidebar');
  if (!btn || !sb) return;

  // Give the nav a stable id so the toggle can point at it for assistive tech.
  if (!sb.id) sb.id = 'primary-nav';
  const iconSpan = btn.querySelector('span') || btn;
  let backdrop = null;

  // Position the drawer flush below the sticky header (header height can vary on mobile).
  function syncDrawerTop() {
    const bar = document.querySelector('.topbar');
    const bottom = bar ? Math.round(bar.getBoundingClientRect().bottom) : 60;
    document.documentElement.style.setProperty('--drawer-top', bottom + 'px');
  }

  function closeMenu() {
    sb.classList.remove('open');
    document.body.classList.remove('sky-drawer-open');
    btn.setAttribute('aria-expanded', 'false');
    if (iconSpan) iconSpan.innerHTML = ICONS.menu;
    if (backdrop) { backdrop.remove(); backdrop = null; }
  }

  function openMenu() {
    syncDrawerTop();
    sb.classList.add('open');
    document.body.classList.add('sky-drawer-open');
    btn.setAttribute('aria-expanded', 'true');
    if (iconSpan) iconSpan.innerHTML = ICONS.close;
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sky-drawer-backdrop';
      backdrop.addEventListener('click', closeMenu);
      // Append into the sidebar's OWN parent so both share one stacking context;
      // otherwise the backdrop (on <body>) paints over the drawer and blocks taps.
      sb.parentElement.appendChild(backdrop);
    }
  }

  btn.setAttribute('aria-controls', sb.id);
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    if (sb.classList.contains('open')) closeMenu(); else openMenu();
  });

  // Close after tapping any nav link, or on Escape / resize to desktop.
  document.querySelectorAll('.sidebar a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeMenu();
    else if (sb.classList.contains('open')) syncDrawerTop();
  });
}

// ---------- Dynamic channel nav + filter chips ----------
function getCurrentChannel() {
  const params = new URLSearchParams(location.search);
  const c = params.get('c');
  return c && getChannel(c) ? c : null;
}

// Rewrite the sidebar "Channels" list to the 11 live channels. Located by its
// section title so no per-page HTML edits are needed.
function renderChannelNav(base) {
  base = base || '';
  let ul = null;
  document.querySelectorAll('.side-title').forEach(t => {
    if (t.textContent.trim().toLowerCase() === 'channels') {
      const n = t.nextElementSibling;
      if (n && n.classList.contains('nav-list')) ul = n;
    }
  });
  if (!ul) return;
  const current = getCurrentChannel();
  ul.innerHTML = CHANNELS.map(c => {
    const active = c.id === current ? ' active' : '';
    return '<li><a class="nav-link' + active + '" href="' + base + 'pages/channel.html?c=' + c.id + '">'
      + '<span class="cat-dot" style="background:' + c.color + '"></span>' + c.label + '</a></li>';
  }).join('');
  ensureSubmitLink(base);
}

// Make sure the "Submit a Story" link exists in the Feed nav on every page.
function ensureSubmitLink(base) {
  base = base || '';
  let feed = null;
  document.querySelectorAll('.side-title').forEach(t => {
    if (t.textContent.trim().toLowerCase() === 'feed') {
      const n = t.nextElementSibling;
      if (n && n.classList.contains('nav-list')) feed = n;
    }
  });
  if (!feed) return;
  const summer = feed.querySelector('a[href$="summer.html"]');
  const before = summer && summer.parentElement ? summer.parentElement : null;
  const add = (href, iconHtml, label) => {
    if (feed.querySelector('a[href$="' + href + '"]')) return;
    const li = document.createElement('li');
    li.innerHTML = '<a href="' + base + 'pages/' + href + '"><span class="icon">' + iconHtml + '</span><span>' + label + '</span></a>';
    if (before) feed.insertBefore(li, before);
    else feed.appendChild(li);
  };
  add('submit.html', '\u270d\ufe0f', 'Submit a Story');
  add('feeds.html', '\ud83d\udce1', 'STEM Feeds');
  add('creators.html', '\ud83c\udf1f', 'STEM Creators');
}

// Rebuild the filter chips in every .filter-bar from the channel registry,
// preserving any trailing spacer/sort controls, then (re)bind filter events.
function renderFilterChips() {
  document.querySelectorAll('.filter-bar').forEach(bar => {
    const spacer = bar.querySelector('.filter-spacer');
    bar.querySelectorAll('.chip').forEach(ch => ch.remove());
    const frag = document.createDocumentFragment();
    const all = document.createElement('button');
    all.className = 'chip' + (currentFilter === 'all' ? ' active' : '');
    all.dataset.cat = 'all';
    all.textContent = 'All';
    frag.appendChild(all);
    CHANNELS.forEach(c => {
      const b = document.createElement('button');
      b.className = 'chip' + (currentFilter === c.id ? ' active' : '');
      b.dataset.cat = c.id;
      b.textContent = c.icon + ' ' + c.short;
      frag.appendChild(b);
    });
    if (spacer) bar.insertBefore(frag, spacer);
    else bar.appendChild(frag);
  });
  initFilters();
}

// ---------- Set top-bar icons ----------
function paintTopBarIcons() {
  const map = { 'ic-search': ICONS.search, 'ic-bell': ICONS.bell, 'ic-bookmark': ICONS.bookmark, 'ic-menu': ICONS.menu };
  Object.keys(map).forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = map[id]; });
}

// ---------- Init ----------
function _initHome(baseUrl) {
  feedBase = baseUrl || '';
  initTheme();
  paintTopBarIcons();
  initSearch();
  renderChannelNav(feedBase);
  renderFilterChips();
  initMobileMenu();
  renderFeed();
  renderTrending();
  renderLeaderboard();
  renderCountdown();
  renderStats();
  renderPoll();
  renderTicker();
  renderNextDrop();
  renderNewsletter();
}

function _initCategoryPage(cat, baseUrl) {
  currentFilter = cat;
  initHome(baseUrl);
  // set the appropriate chip active
  const chip = document.querySelector('.chip[data-cat="' + cat + '"]');
  if (chip) { document.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); chip.classList.add('active'); }
}

// Generic channel page (channel.html?c=<id>): scopes the feed to one channel
// and paints its hero from the registry.
function _initChannelPage(baseUrl) {
  feedBase = baseUrl || '';
  const cid = getCurrentChannel();
  const ch = getChannel(cid);
  currentFilter = cid || 'all';
  if (ch) {
    const t = document.getElementById('channel-title');
    const d = document.getElementById('channel-icon');
    const l = document.getElementById('channel-label');
    if (t) t.textContent = ch.label;
    if (d) d.textContent = ch.icon;
    if (l) l.textContent = ch.label;
    document.title = ch.label + ' \u00b7 Skynet Nexus News';
    const hero = document.querySelector('.channel-hero');
    if (hero) hero.style.background = 'linear-gradient(135deg, ' + ch.color + '22, ' + ch.color2 + '22)';
  }
  initTheme();
  paintTopBarIcons();
  initSearch();
  renderChannelNav(feedBase);
  renderFilterChips();
  initMobileMenu();
  renderFeed();
  renderTrending();
  renderLeaderboard();
  renderCountdown();
  renderStats();
  renderPoll();
  renderTicker();
  renderNextDrop();
  renderNewsletter();
  renderChannelRss(cid);
}

function _initArticle(baseUrl) {
  initTheme();
  paintTopBarIcons();
  initSearch();
  renderChannelNav(baseUrl);
  initMobileMenu();
  initArticlePage();
}

function _initSimplePage(baseUrl) {
  initTheme();
  paintTopBarIcons();
  initSearch();
  renderChannelNav(baseUrl);
  initMobileMenu();
  initContactForm();
}



// ---------- Public async wrappers (load manifest, then delegate) ----------
async function initHome(baseUrl) {
  await loadManifest(baseUrl);
  _initHome(baseUrl);
}
async function initCategoryPage(cat, baseUrl) {
  await loadManifest(baseUrl);
  _initCategoryPage(cat, baseUrl);
}
async function initArticle(baseUrl) {
  await loadManifest(baseUrl);
  // Load the specific article body before rendering.
  const params = new URLSearchParams(location.search);
  const wanted = params.get('id') || (_manifest && _manifest.articles[0] && _manifest.articles[0].id);
  if (wanted) await loadArticleFull(wanted, baseUrl);
  _initArticle(baseUrl);
}
async function initSimplePage(baseUrl) {
  await loadManifest(baseUrl);
  _initSimplePage(baseUrl);
}
async function initChannelPage(baseUrl) {
  await loadManifest(baseUrl);
  _initChannelPage(baseUrl);
}

// Newsletter form -> POST /api/newsletter (added by polish pass)
document.addEventListener("submit", function (ev) {
  var f = ev.target;
  if (!f || !f.classList || !f.classList.contains("newsletter-form")) return;
  ev.preventDefault();
  var input = f.querySelector('input[type="email"], input[name="email"], input');
  var email = input && input.value ? input.value.trim() : "";
  if (!email) { if (typeof toast === "function") toast("Enter an email first."); return; }
  fetch("/api/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email, kidCount: 0 }) })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (o) {
      if (!o.ok) { if (typeof toast === "function") toast((o.j && o.j.error) || "Signup failed."); return; }
      if (o.j.alreadySubscribed && typeof toast === "function") toast("You are already on the list.");
      else if (typeof toast === "function") toast("Subscribed! Watch your inbox.");
      if (input) input.value = "";
    })
    .catch(function () { if (typeof toast === "function") toast("Network error. Try again."); });
});

// -------- External links open in a popup window (keep readers on the site) --------
// Global, delegated handler so it also covers dynamically rendered links
// (RSS cards, article source lists, creator/program links, etc.).
(function initExternalLinkPopups() {
  function openExternalPopup(href) {
    var aw = screen.availWidth || 1280, ah = screen.availHeight || 800;
    var w = Math.min(1100, Math.max(480, Math.floor(aw * 0.7)));
    var h = Math.min(900, Math.max(420, Math.floor(ah * 0.82)));
    var left = Math.max(0, Math.floor((aw - w) / 2 + (screen.availLeft || 0)));
    var top = Math.max(0, Math.floor((ah - h) / 2 + (screen.availTop || 0)));
    var features = 'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top + ',scrollbars=yes,resizable=yes';
    var win = window.open(href, '_blank', features);
    if (win) { try { win.opener = null; } catch (e) {} try { win.focus(); } catch (e) {} return; }
    // Popup blocked: fall back to a normal new tab so the reader still gets there.
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  function isExternal(a) {
    var href = a.getAttribute('href');
    if (!href) return false;
    if (/^(mailto:|tel:|javascript:|sms:|#)/i.test(href)) return false;
    if (a.hasAttribute('download')) return false;
    var url;
    try { url = new URL(a.href, location.href); } catch (e) { return false; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return url.hostname !== location.hostname;
  }

  document.addEventListener('click', function (ev) {
    // Respect user intent to open in a new tab/window their own way.
    if (ev.defaultPrevented || ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a || !isExternal(a)) return;
    ev.preventDefault();
    openExternalPopup(a.href);
  });
})();
