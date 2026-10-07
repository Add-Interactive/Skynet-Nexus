/* Skynet Nexus — shared collapsible sidebar nav (site reorg).
 * Loaded on every page with a sidebar, right after app.js. Rebuilds
 * aside.sidebar as Do / Read / Community / You with collapsible sections.
 * The static HTML sidebar remains as a no-JS fallback. */

var SKY_NAV_CHANNELS = ['ai','space','robotics','biotech','quantum','climate','engineering','math','cyber','gaming','music','stem','play'];
var SKY_NAV_DEDICATED = { stem: 1, robotics: 1, play: 1, music: 1 };

function skyNavState() {
  try { return JSON.parse(localStorage.getItem('skynet-nav-state') || '{}'); }
  catch (e) { return {}; }
}
function skyNavSave(s) {
  try { localStorage.setItem('skynet-nav-state', JSON.stringify(s)); } catch (e) {}
}

function renderSkyNav(base) {
  base = base || '';
  var sb = document.querySelector('aside.sidebar');
  if (!sb) return;
  var P = function (file) { return base + 'pages/' + file; };
  function chanHref(id) {
    return SKY_NAV_DEDICATED[id] ? P(id + '.html') : P('channel.html?c=' + id);
  }
  function chanMeta(id) {
    var c = (typeof getChannel === 'function') ? getChannel(id) : null;
    return { label: c ? c.label : id, color: c ? c.color : '#00e5ff' };
  }
  var st = skyNavState();
  function secOpen(key, def) { return (key in st) ? !!st[key] : def; }
  function link(href, iconHtml, label) {
    return '<li><a href="' + href + '"><span class="icon">' + iconHtml + '</span><span>' + label + '</span></a></li>';
  }

  var channelsHtml = SKY_NAV_CHANNELS.map(function (id) {
    var m = chanMeta(id);
    return '<li><a href="' + chanHref(id) + '" data-channel="' + id + '">'
      + '<span class="cat-dot" style="background:' + m.color + '"></span><span>' + m.label + '</span></a></li>';
  }).join('');

  function section(key, title, inner, defOpen) {
    var open = secOpen(key, defOpen);
    return '<div class="side-section' + (open ? '' : ' closed') + '" data-section="' + key + '">'
      + '<button type="button" class="side-title collapsible" aria-expanded="' + open + '">'
      + '<span>' + title + '</span><span class="chev">\u25be</span></button>'
      + '<ul class="nav-list">' + inner + '</ul></div>';
  }

  var chanOpen = secOpen('channels', false);
  var doHtml =
    link(P('weekend-lab.html'), '🧪', 'Weekend Lab') +
    link(P('events.html'), '📅', 'Events') +
    link(P('summer.html'), '🏕️', 'Summer STEM') +
    link(P('quiz.html'), '🧠', 'Daily Quiz') +
    link(P('submit.html'), '✍️', 'Submit a Story');

  var readHtml =
    link(base + 'index.html', '<span id="nav-home"></span>', 'Home') +
    link(base + 'index.html?feed=your', '🔖', 'Your Feed') +
    link(base + 'index.html#trending', '<span id="nav-flame"></span>', 'Trending') +
    link(P('archive.html'), '📚', 'Archive') +
    link(P('feeds.html'), '📡', 'STEM Feeds') +
    '<li class="nav-nested"><button type="button" class="nav-sub-toggle" aria-expanded="' + chanOpen + '">'
    + '<span class="cat-dot" style="background:#00e5ff"></span><span>Channels</span><span class="chev">\u25be</span></button>'
    + '<ul class="nav-list nav-sub' + (chanOpen ? '' : ' closed') + '">' + channelsHtml + '</ul></li>';

  var commHtml =
    link(P('leaderboard.html'), '<span id="nav-trophy"></span>', 'Leaderboard') +
    link(P('team.html'), '<span id="nav-team"></span>', 'Meet the Team') +
    link(P('creators.html'), '🌟', 'Creators');

  var youHtml =
    link(P('profile.html'), '👤', 'Profile') +
    link(P('about.html'), '<span id="nav-info"></span>', 'About') +
    link(P('contact.html'), '<span id="nav-mail"></span>', 'Contact') +
    link(P('safety.html'), '\uD83D\uDEE1\uFE0F', 'Safety & Security');

  sb.innerHTML =
    section('do', 'Do', doHtml, true) +
    section('read', 'Read', readHtml, false) +
    section('community', 'Community', commHtml, false) +
    section('you', 'You', youHtml, false) +
    '<div class="side-section"><div class="sky-intro-slot"></div></div>' +
    '<div class="side-section"><div class="sky-user-card-slot"></div></div>';

  // Paint SVG icons into the placeholder spans (ICONS is global in app.js).
  // The per-page inline NAV map runs before the manifest loads, so repaint here.
  try {
    var ICONMAP = { 'nav-home': 'home', 'nav-flame': 'flame', 'nav-trophy': 'trophy', 'nav-team': 'users', 'nav-info': 'info', 'nav-mail': 'mail' };
    Object.keys(ICONMAP).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && window.ICONS && ICONS[ICONMAP[id]]) el.innerHTML = ICONS[ICONMAP[id]];
    });
  } catch (e) {}

  // Collapsible section toggles (persisted in localStorage).
  sb.querySelectorAll('.side-title.collapsible').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var sec = btn.closest('.side-section');
      var key = sec.getAttribute('data-section');
      var willClose = !sec.classList.contains('closed');
      sec.classList.toggle('closed', willClose);
      btn.setAttribute('aria-expanded', String(!willClose));
      var s = skyNavState(); s[key] = !willClose; skyNavSave(s);
    });
  });
  var subToggle = sb.querySelector('.nav-sub-toggle');
  if (subToggle) {
    subToggle.addEventListener('click', function () {
      var sub = subToggle.nextElementSibling;
      var willClose = subToggle.getAttribute('aria-expanded') === 'true';
      subToggle.setAttribute('aria-expanded', String(!willClose));
      if (sub) sub.classList.toggle('closed', willClose);
      var s = skyNavState(); s.channels = !willClose; skyNavSave(s);
    });
  }

  highlightSkyNav(sb);
}

function highlightSkyNav(sb) {
  var path = location.pathname;
  var params = new URLSearchParams(location.search);
  var page = path.split('/').pop() || 'index.html';
  var isHome = (page === 'index.html' || path === '/' || page === '');
  sb.querySelectorAll('a.active').forEach(function (a) { a.classList.remove('active'); });
  var target = null;
  if (isHome) {
    var feedType = params.get('feed') || 'home';
    target = feedType === 'your'
      ? sb.querySelector('a[href*="feed=your"]')
      : sb.querySelector('.nav-list a[href$="index.html"]:not([href*="feed="]):not([href*="#"])');
  } else if (page === 'channel.html' && params.get('c')) {
    target = sb.querySelector('a[data-channel="' + params.get('c') + '"]');
  } else {
    var links = sb.querySelectorAll('.nav-list a[href]');
    for (var i = 0; i < links.length; i++) {
      var h = links[i].getAttribute('href') || '';
      if (h.endsWith('/' + page) || h === page) { target = links[i]; break; }
    }
  }
  if (!target) return;
  target.classList.add('active');
  // Open any collapsed ancestor section so the active link is visible.
  var sec = target.closest('.side-section');
  if (sec && sec.classList.contains('closed')) {
    sec.classList.remove('closed');
    var btn = sec.querySelector('.side-title.collapsible');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }
  var sub = target.closest('.nav-sub');
  if (sub && sub.classList.contains('closed')) {
    sub.classList.remove('closed');
    var tgl = sub.previousElementSibling;
    if (tgl && tgl.classList.contains('nav-sub-toggle')) tgl.setAttribute('aria-expanded', 'true');
  }
}


/* Inject collapsible-nav styles (site reorg). */
(function () {
  var css = ".side-title.collapsible{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:0;cursor:pointer;font-size:.7rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-mute);padding:0 12px;margin-bottom:8px;text-align:left}"
    + ".side-title.collapsible:hover{color:var(--text)}"
    + ".side-title .chev{display:inline-block;transition:transform .18s ease;font-size:.8rem;letter-spacing:0}"
    + ".side-section.closed .side-title .chev{transform:rotate(-90deg)}"
    + ".side-section.closed>.nav-list{display:none}"
    + ".nav-sub-toggle{display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border:0;border-radius:10px;background:none;cursor:pointer;color:var(--text-dim);font-weight:500;font-size:.92rem;text-align:left}"
    + ".nav-sub-toggle:hover{background:var(--bg-card);color:var(--text)}"
    + ".nav-sub-toggle .chev{margin-left:auto;transition:transform .18s ease;font-size:.8rem}"
    + ".nav-sub-toggle[aria-expanded=\"false\"] .chev{transform:rotate(-90deg)}"
    + "ul.nav-sub{margin:2px 0 4px 18px;padding-left:10px;border-left:2px solid var(--border);list-style:none}"
    + "ul.nav-sub.closed{display:none}"
    + "ul.nav-sub li a{padding:8px 12px;font-size:.87rem}";
  var st = document.createElement('style');
  st.id = 'sky-nav-css';
  st.textContent = css;
  document.head.appendChild(st);
})();


/* Runtime rebrand bridge: app.js still ships the old "Skynet Nexus News"
 * strings in a few JS-rendered spots (document.title, ticker items).
 * Patch them here until app.js is next rebuilt. */
function skyRebrand() {
  try {
    if (document.title.indexOf('Skynet Nexus News') !== -1) {
      document.title = document.title.replace(/Skynet Nexus News/g, 'Skynet Nexus');
    }
    document.querySelectorAll('#ticker-inner, .ticker-inner').forEach(function (el) {
      if (el.innerHTML.indexOf('Skynet Nexus News') !== -1) {
        el.innerHTML = el.innerHTML.replace(/Skynet Nexus News/g, 'Skynet Nexus');
      }
    });
  } catch (e) {}
}


/* ---------- Footer columns (site footer mirrors the sidebar) ---------- */
var SKY_FOOTER_CHANNELS = [
  ['stem', '\uD83E\uDDEA STEM', 'stem.html'],
  ['ai', '\uD83E\uDD16 AI', null],
  ['space', '\uD83D\uDE80 Space', null],
  ['robotics', '\uD83E\uDDBE Robotics', 'robotics.html'],
  ['biotech', '\uD83E\uDDEC Biotech', null],
  ['quantum', '\u269B\uFE0F Quantum', null],
  ['climate', '\uD83C\uDF0D Climate', null],
  ['engineering', '\uD83C\uDFD7\uFE0F Engineering', null],
  ['math', '\uD83D\uDD22 Math', null],
  ['cyber', '\uD83D\uDD12 Cybersecurity', null],
  ['gaming', '\uD83C\uDFAE Gaming', null],
  ['music', '\uD83C\uDFB5 Music', 'music.html'],
  ['play', '\uD83C\uDFA8 Play & Design', 'play.html']
];

function renderSkyFooter(base) {
  base = base || '';
  var inner = document.querySelector('footer .footer-inner');
  if (!inner) return;
  var P = function (file) { return base + 'pages/' + file; };
  function chanHref(id, dedicated) {
    return dedicated ? P(dedicated) : P('channel.html?c=' + id);
  }
  function col(title, links) {
    var lis = links.map(function (l) {
      return '<li><a href="' + l[0] + '">' + l[1] + '</a></li>';
    }).join('');
    return '<div class="footer-col"><h5>' + title + '</h5><ul>' + lis + '</ul></div>';
  }
  var doCol = col('Do', [
    [P('weekend-lab.html'), '\uD83E\uDDEA Weekend Lab'],
    [P('events.html'), '\uD83D\uDCC5 Events'],
    [P('summer.html'), '\uD83C\uDFD5\uFE0F Summer STEM'],
    [P('quiz.html'), '\uD83E\uDDE0 Daily Quiz']
  ]);
  var readCol = col('Read', [
    [base + 'index.html', 'Home'],
    [base + 'index.html#trending', 'Trending'],
    [P('archive.html'), '\uD83D\uDCDA Archive'],
    [P('feeds.html'), '\uD83D\uDCE1 STEM Feeds']
  ]);
  var chanCol = col('Channels', SKY_FOOTER_CHANNELS.map(function (c) {
    return [chanHref(c[0], c[2]), c[1]];
  }));
  var commCol = col('Community', [
    [P('leaderboard.html'), 'Leaderboard'],
    [P('team.html'), 'Meet the Team'],
    [P('creators.html'), '\uD83C\uDF1F Creators'],
    [P('whats-new.html'), "What's New"]
  ]);
  var youCol = col('You', [
    [P('profile.html'), '\uD83D\uDC64 Profile'],
    [P('about.html'), 'About'],
    [P('contact.html'), 'Contact'],
    [P('privacy.html'), 'Privacy'],
    [P('safety.html'), '\uD83D\uDEE1\uFE0F Safety & Security']
  ]);
  // Replace the old link columns (Channels/Company/Community) but keep the
  // brand block and the Network/partners column.
  var cols = inner.querySelectorAll(':scope > .footer-col');
  var keep = [];
  cols.forEach(function (c) {
    var h = c.querySelector('h5');
    var t = h ? h.textContent.trim() : '';
    if (t === 'Network' || c.classList.contains('footer-col-partners')) keep.push(c);
    else c.remove();
  });
  var brand = inner.querySelector('.footer-brand');
  var html = doCol + readCol + chanCol + commCol + youCol;
  keep.forEach(function (c) { html += c.outerHTML; c.remove(); });
  if (brand) brand.insertAdjacentHTML('afterend', html);
  else inner.insertAdjacentHTML('afterbegin', html);
  // Beta-gated footer column: only rendered for beta testers.
  // Silent on failure (logged out, non-beta, or API down) — footer stays unchanged.
  (function addBetaCol() {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var user = d && d.user;
        if (!user || !user.isBetaTester) return;
        var fi = document.querySelector('footer .footer-inner');
        if (!fi || fi.querySelector('.footer-col-beta')) return;
        var betaCol = col('\uD83E\uDDEA Beta', [
          [P('beta.html'), '\uD83E\uDDEA Beta HQ'],
          [P('debug-checklist.html'), '\u2705 Debug Checklist']
        ]);
        var tmp = document.createElement('div');
        tmp.innerHTML = betaCol;
        var el = tmp.firstChild;
        if (el) el.classList.add('footer-col-beta');
        fi.insertAdjacentHTML('beforeend', tmp.innerHTML);
      })
      .catch(function () {});
  })();
}

/* Init: rebuild the sidebar, keep the mobile drawer working, apply rebrand. */
(function skyNavInit() {
  function boot() {
    var base = location.pathname.indexOf('/pages/') !== -1 ? '../' : '';
    renderSkyNav(base);
    renderSkyFooter(base);
    // The rebuilt links need the drawer's close-on-tap behavior (app.js bound
    // the old ones). Delegate here.
    var sb = document.querySelector('aside.sidebar');
    if (sb && !sb.dataset.skyNavBound) {
      sb.dataset.skyNavBound = '1';
      sb.addEventListener('click', function (e) {
        if (e.target.closest('a') && sb.classList.contains('open')) {
          sb.classList.remove('open');
          var btn = document.getElementById('menu-toggle');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      });
    }
    skyRebrand();
    // Re-run after app.js finishes its async renders (ticker, titles).
    if (document.readyState !== 'complete') {
      window.addEventListener('load', function () { setTimeout(skyRebrand, 500); });
    } else {
      setTimeout(skyRebrand, 500);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

