
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

// Utility: color-coded SVG placeholder for post thumbnails
function makeThumb(cat, id) {
  const palettes = {
    stem:     ['#00e5ff', '#7c3aed'],
    robotics: ['#a855f7', '#ff2e63'],
    play:     ['#39ff14', '#00e5ff'],
    music:    ['#ff2e63', '#ffb800'],
    network:  ['#00e5ff', '#a855f7']
  };
  const [c1, c2] = palettes[cat] || palettes.stem;
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
      <text x='40' y='320' font-size='42' letter-spacing='-1'>${(cat || '').toUpperCase()}</text>
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
// -------- TRENDING TOPICS --------
const TRENDING = [
  { tag: '#ScienceFair2026', posts: '2.1K', tone: 'stem' },
  { tag: '#FIRSTRobotics', posts: '4.3K', tone: 'robotics' },
  { tag: '#ScratchMakes', posts: '3.7K', tone: 'play' },
  { tag: '#YoungArts26', posts: '1.9K', tone: 'music' },
  { tag: '#MinecraftEDU', posts: '5.2K', tone: 'play' },
  { tag: '#TeenAstronomer', posts: '1.4K', tone: 'stem' },
  { tag: '#StudentComposer', posts: '890', tone: 'music' }
];

// -------- LEADERBOARD (weekly reader highlights: young makers readers loved most) --------
const LEADERBOARD = [
  { rank: 1, name: 'Priya R.',        crew: 'Regeneron STS Finalist \u2022 STEM',   score: 1240, av: 'PR' },
  { rank: 2, name: 'Team 254',        crew: 'FRC Champions \u2022 Robotics',        score: 1180, av: '254' },
  { rank: 3, name: 'Amara O.',        crew: 'Scratch Creator, Age 10 \u2022 Play',  score: 1105, av: 'AO' },
  { rank: 4, name: 'Ana K.',          crew: 'YoungArts Violin \u2022 Music',        score: 987,  av: 'AK' },
  { rank: 5, name: 'The Ideators',    crew: 'FLL Global Innovation \u2022 Robotics', score: 942,  av: 'FLL' }
];

// -------- FEATURED EVENT (for countdown) --------
const now = new Date();
const EVENT = {
  title: 'FIRST Robotics Championship 2026',
  sub: 'Kick-off ceremony. 600 student teams. Free livestream.',
  target: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8, 18, 0, 0)
};

// -------- POLL --------
const POLL = {
  question: 'Which channel are you most excited about this week?',
  options: [
    { label: '\ud83e\uddec STEM \u2014 young scientists',        pct: 28 },
    { label: '\ud83e\udd16 Robotics \u2014 FIRST & VEX',           pct: 32 },
    { label: '\ud83c\udfa8 Play & Design \u2014 kid creators',    pct: 24 },
    { label: '\ud83c\udfa7 Music \u2014 teen musicians',           pct: 16 }
  ]
};

// -------- LIVE STATS --------
const STATS = {
  activeReaders: 128,
  storiesToday: 1,
  liveEvents: 1,
  contributors: 5
};

// -------- TICKER MESSAGES --------
const TICKER = [
  { label: 'LAUNCH', text: 'Skynet Nexus News goes live \u2014 first full edition tomorrow at 10 AM ET' },
  { label: 'STEM', text: 'FIRST Robotics Championship kicks off in Houston next week' },
  { label: 'PLAY', text: 'Scratch Foundation announces 2026 Creator Awards' },
  { label: 'MUSIC', text: 'YoungArts announces 2026 Winter Finalists' },
  { label: 'FAMILY', text: 'Every article now includes a Kid Take and Family Discussion questions' }
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
  return ({stem: 'STEM', robotics: 'Robotics', play: 'Play & Design', music: 'Music', network: 'Network'})[cat] || cat;
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
  const liked = LS.get('likes_' + a.id, false);
  const saved = LS.get('save_' + a.id, false);
  const likesDisplay = formatCount(a.likes + (liked ? 1 : 0));
  return (
    '<article class="post-card ' + (featured ? 'featured' : '') + '" data-id="' + a.id + '" data-cat="' + a.cat + '" data-href="' + base + 'pages/article.html?id=' + a.id + '">' +
      '<div class="post-media-wrap">' +
        '<img class="post-media" src="' + makeThumb(a.cat, a.id) + '" alt="' + a.title.replace(/"/g, '&quot;') + '"/>' +
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
            '<button class="like-btn ' + (liked ? 'liked' : '') + '" data-id="' + a.id + '" title="Like">' + ICONS.heart + '<span>' + likesDisplay + '</span></button>' +
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
  if (currentSort === 'trending')       list.sort((a, b) => (b.likes + b.shares) - (a.likes + a.shares));
  else if (currentSort === 'popular')   list.sort((a, b) => b.likes - a.likes);
  else if (currentSort === 'commented') list.sort((a, b) => b.comments - a.comments);
  else                                  list.sort((a, b) => new Date(b.date) - new Date(a.date));
  return list;
}

function renderFeed() {
  const grid = document.getElementById('feed-grid');
  if (!grid) return;
  const list = getFilteredArticles();
  if (list.length === 0) {
    grid.innerHTML =
      '<div class="empty-state">' + ICONS.search +
      '<h3>No stories match your filters</h3>' +
      '<p>Try switching categories or clearing your search.</p></div>';
    return;
  }
  grid.innerHTML = list.map((a, i) => renderPost(a, i === 0 && currentFilter === 'all' && !searchQuery, feedBase)).join('');
  bindPostEvents();
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
      const cur = LS.get('likes_' + id, false);
      LS.set('likes_' + id, !cur);
      btn.classList.toggle('liked');
      toast(cur ? 'Removed from likes' : 'Liked!');
      const article = ARTICLES.find(a => String(a.id) === id);
      const cnt = btn.querySelector('span');
      if (cnt && article) cnt.textContent = formatCount(article.likes + (cur ? 0 : 1));
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
  el.innerHTML = TRENDING.map((t, i) =>
    '<li data-tag="' + t.tag + '">' +
      '<span class="trend-num">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<div class="trend-body">' +
        '<span class="trend-hashtag">' + t.tag + '</span>' +
        '<span class="trend-meta">' + t.posts + ' posts • ' + categoryLabel(t.tone) + '</span>' +
      '</div>' +
    '</li>'
  ).join('');
  el.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
      searchQuery = li.dataset.tag.replace('#', '');
      const input = document.getElementById('global-search');
      if (input) input.value = searchQuery;
      renderFeed();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function renderLeaderboard() {
  const el = document.getElementById('leaderboard');
  if (!el) return;
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
  const titleEl = document.getElementById('countdown-title');
  const subEl = document.getElementById('countdown-sub');
  if (titleEl) titleEl.textContent = EVENT.title;
  if (subEl) subEl.textContent = EVENT.sub;
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

function renderStats() {
  const el = document.getElementById('stat-tiles');
  if (!el) return;
  const tiles = [
    { num: STATS.activeReaders, lab: 'Reading Now' },
    { num: STATS.storiesToday, lab: 'Stories Today' },
    { num: STATS.liveEvents, lab: 'Live Events' },
    { num: STATS.contributors, lab: 'Contributors' }
  ];
  el.innerHTML = tiles.map(t =>
    '<div class="stat-tile"><div class="num">' + formatCount(t.num) + '</div><div class="lab">' + t.lab + '</div></div>'
  ).join('');
  // Roll active readers occasionally
  setInterval(() => {
    STATS.activeReaders += Math.floor(Math.random() * 21) - 10;
    const first = el.querySelector('.stat-tile .num');
    if (first) first.textContent = formatCount(STATS.activeReaders);
  }, 4000);
}

function renderPoll() {
  const el = document.getElementById('poll-box');
  if (!el) return;
  const voted = LS.get('poll_voted', null);
  const q = document.getElementById('poll-q');
  if (q) q.textContent = POLL.question;
  el.innerHTML = POLL.options.map((o, i) =>
    '<div class="poll-opt' + (voted !== null ? ' voted' : '') + (voted === i ? ' selected' : '') + '" data-i="' + i + '">' +
      (voted !== null ? '<div class="poll-bar" data-pct="' + o.pct + '"></div>' : '') +
      '<span class="poll-label">' + o.label + '</span>' +
      (voted !== null ? '<span class="poll-pct">' + o.pct + '%</span>' : '') +
    '</div>'
  ).join('');
  if (voted !== null) {
    requestAnimationFrame(() => {
      el.querySelectorAll('.poll-bar').forEach(b => { b.style.width = b.dataset.pct + '%'; });
    });
  } else {
    el.querySelectorAll('.poll-opt').forEach(o => {
      o.addEventListener('click', () => {
        LS.set('poll_voted', Number(o.dataset.i));
        renderPoll();
        toast('Vote counted!');
      });
    });
  }
}

function renderTicker() {
  const el = document.getElementById('ticker-inner');
  if (!el) return;
  // duplicate for seamless scroll
  const html = TICKER.concat(TICKER).map(t =>
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
  document.title = a.title + ' â€” Skynet Nexus News';
  const liked = LS.get('likes_' + a.id, false);
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

  container.innerHTML =
    '<article class="article">' +
      '<div class="article-hero">' +
        '<img src="' + makeThumb(a.cat, a.id) + '" alt=""/>' +
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
      '<div class="article-tags">' + (a.tags || []).map(t => '<span class="tag">#' + t + '</span>').join('') + '</div>' +
      '<div class="article-toolbar">' +
        '<div class="reactions">' +
          '<button class="react-btn ' + (liked ? 'active' : '') + '" id="btn-like">' + ICONS.heart + '<span class="cnt">' + formatCount(a.likes + (liked ? 1 : 0)) + '</span></button>' +
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

  // seed sample comments
  const seedComments = [
    { name: 'JennyBuilds', av: 'JB', time: '2h ago', text: 'This is genuinely inspiring. Sharing with my whole class tomorrow.' },
    { name: 'PixelPunk', av: 'PP', time: '5h ago', text: 'Ok but the fact they open sourced everything is the real MVP move.' },
    { name: 'RhythmRae',  av: 'RR', time: '1d ago', text: 'Been waiting for coverage like this. More youth voices, less corporate takes. ðŸ™Œ' }
  ];
  const userComments = LS.get('comments_' + a.id, []);
  const cl = document.getElementById('comment-list');
  const paint = () => {
    cl.innerHTML = userComments.concat(seedComments).map(c =>
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

  document.getElementById('btn-like').addEventListener('click', () => {
    const cur = LS.get('likes_' + a.id, false);
    LS.set('likes_' + a.id, !cur);
    const btn = document.getElementById('btn-like');
    btn.classList.toggle('active');
    btn.querySelector('.cnt').textContent = formatCount(a.likes + (cur ? 0 : 1));
    toast(cur ? 'Unliked' : 'Liked!');
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
  const btn = document.getElementById('menu-toggle');
  const sb = document.querySelector('.sidebar');
  if (!btn || !sb) return;
  btn.addEventListener('click', () => sb.classList.toggle('open'));
  document.querySelectorAll('.sidebar a').forEach(a => a.addEventListener('click', () => sb.classList.remove('open')));
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
  initFilters();
  initMobileMenu();
  renderFeed();
  renderTrending();
  renderLeaderboard();
  renderCountdown();
  renderStats();
  renderPoll();
  renderTicker();
  renderNewsletter();
}

function _initCategoryPage(cat, baseUrl) {
  currentFilter = cat;
  initHome(baseUrl);
  // set the appropriate chip active
  const chip = document.querySelector('.chip[data-cat="' + cat + '"]');
  if (chip) { document.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); chip.classList.add('active'); }
}

function _initArticle() {
  initTheme();
  paintTopBarIcons();
  initSearch();
  initMobileMenu();
  initArticlePage();
}

function _initSimplePage() {
  initTheme();
  paintTopBarIcons();
  initSearch();
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
