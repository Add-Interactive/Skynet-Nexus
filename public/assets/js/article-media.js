/* Skynet Nexus — article media gallery.
 * Adds a "📸 Media (n)" button under the article hero when the story carries
 * a `media` array (or "📰 Sources (n)" when it only has sources), opening a
 * lightbox with images, embedded videos, links, and a Sources section
 * (original reporting featured first, then more sources).
 * Standalone file (loaded after app.js on article.html only) — app.js is not touched.
 */

(function () {
  'use strict';

  /* ---------- styles ---------- */
  var CSS = [
    '.am-btn{display:inline-flex;align-items:center;gap:8px;margin:14px 0 4px;padding:10px 18px;border-radius:999px;',
    'border:1px solid var(--border,#2a3348);background:var(--bg-card,#131822);color:var(--text,#e8edf5);',
    'font-weight:700;font-size:.92rem;cursor:pointer;transition:all .18s ease}',
    '.am-btn:hover{border-color:var(--accent,#00e5ff);color:var(--accent,#00e5ff);transform:translateY(-1px)}',
    '.am-count{background:var(--accent,#00e5ff);color:#06121a;font-size:.75rem;font-weight:800;border-radius:999px;padding:2px 9px}',
    '.am-lb{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;',
    'background:rgba(4,8,16,.92);backdrop-filter:blur(4px);opacity:0;transition:opacity .2s ease}',
    '.am-lb.show{opacity:1}',
    '.am-box{position:relative;width:min(920px,94vw);max-height:92vh;display:flex;flex-direction:column;',
    'background:var(--bg-card,#131822);border:1px solid var(--border,#2a3348);border-radius:16px;overflow:hidden}',
    '.am-stage{position:relative;flex:1;min-height:280px;max-height:62vh;display:flex;align-items:center;justify-content:center;background:#05080f}',
    '.am-stage img{max-width:100%;max-height:62vh;object-fit:contain;display:block}',
    '.am-stage iframe{width:100%;height:62vh;max-height:62vh;border:0}',
    '.am-linkcard{display:flex;flex-direction:column;align-items:center;gap:10px;padding:48px 32px;text-align:center;color:var(--text,#e8edf5)}',
    '.am-linkcard .am-linkicon{font-size:44px}',
    '.am-linkcard a{color:var(--accent,#00e5ff);font-weight:700;font-size:1.05rem;word-break:break-all}',
    '.am-broken{display:flex;align-items:center;justify-content:center;min-height:200px;color:var(--text-mute,#8b94a7);padding:32px;text-align:center}',
    '.am-cap{padding:14px 20px 6px;font-size:.95rem;line-height:1.5;color:var(--text,#e8edf5)}',
    '.am-credit{padding:0 20px 14px;font-size:.8rem;color:var(--text-mute,#8b94a7)}',
    '.am-credit a{color:var(--accent,#00e5ff)}',
    '.am-bar{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-top:1px solid var(--border,#2a3348)}',
    '.am-pos{font-size:.82rem;color:var(--text-mute,#8b94a7);font-variant-numeric:tabular-nums}',
    '.am-nav{display:flex;gap:8px}',
    '.am-x,.am-prev,.am-next{border:1px solid var(--border,#2a3348);background:var(--panel2,#1a2130);color:var(--text,#e8edf5);',
    'border-radius:10px;min-width:42px;height:42px;font-size:1.15rem;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}',
    '.am-x:hover,.am-prev:hover,.am-next:hover{border-color:var(--accent,#00e5ff);color:var(--accent,#00e5ff)}',
    '.am-x{position:absolute;top:10px;right:10px;z-index:2}',
    '.am-thumbs{display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--border,#2a3348);overflow-x:auto}',
    '.am-thumb{flex:none;width:64px;height:44px;border-radius:8px;overflow:hidden;border:2px solid transparent;cursor:pointer;',
    'background:var(--panel2,#1a2130);display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:var(--text-mute,#8b94a7)}',
    '.am-thumb img{width:100%;height:100%;object-fit:cover}',
    '.am-thumb.active{border-color:var(--accent,#00e5ff)}',
    '@media (max-width:640px){.am-box{width:100vw;height:100dvh;max-height:100dvh;border-radius:0}.am-stage,.am-stage iframe,.am-stage img{max-height:52vh}}',
    '.am-sources{border-top:1px solid var(--border,#2a3348);padding:14px 20px;overflow-y:auto;max-height:44vh}',
    '.am-src-head{font-size:.72rem;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--text-mute,#8b94a7);margin:12px 0 8px}',
    '.am-src-head:first-child{margin-top:0}',
    '.am-src-main{display:block;padding:12px 14px;border:1px solid var(--accent,#00e5ff);border-radius:12px;background:rgba(0,229,255,.06);text-decoration:none}',
    '.am-src-main:hover{background:rgba(0,229,255,.12)}',
    '.am-src-title{color:var(--text,#e8edf5);font-weight:700;font-size:.95rem;line-height:1.4}',
    '.am-src-pub{color:var(--accent,#00e5ff);font-size:.8rem;margin-top:4px}',
    '.am-src-list{display:flex;flex-direction:column;gap:6px}',
    '.am-src-list a{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:9px 12px;border:1px solid var(--border,#2a3348);border-radius:10px;color:var(--text,#e8edf5);text-decoration:none;font-size:.88rem}',
    '.am-src-list a:hover{border-color:var(--accent,#00e5ff)}',
    '.am-src-list .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.am-src-list .p{color:var(--text-mute,#8b94a7);font-size:.78rem;white-space:nowrap;flex:none}',
    '.am-nomedia .am-stage,.am-nomedia .am-cap,.am-nomedia .am-credit,.am-nomedia .am-thumbs,.am-nomedia .am-bar{display:none}',
    '.am-nomedia .am-sources{border-top:0}',
    '.am-trust{display:inline-block;font-size:.66rem;font-weight:800;padding:2px 9px;border-radius:999px;background:var(--panel2,#1a2130);color:var(--text-mute,#8b94a7);margin-left:8px;white-space:nowrap;vertical-align:middle}',
    '.am-tryit{display:flex;align-items:center;gap:14px;margin:22px 0;padding:16px 18px;border-radius:14px;border:1px solid var(--accent,#00e5ff);background:rgba(0,229,255,.07);text-decoration:none;color:var(--text,#e8edf5);transition:background .18s ease}',
    '.am-tryit:hover{background:rgba(0,229,255,.14)}',
    '.am-tryit-emoji{font-size:1.9rem;flex:none}',
    '.am-tryit-text{font-size:1rem;line-height:1.45}',
    '.am-tryit-text b{color:var(--accent,#00e5ff)}',
    '.am-watch{margin:16px 0 6px;max-width:720px}',
    '.am-watch-head{font-weight:800;font-size:.88rem;margin-bottom:8px;color:var(--text,#e8edf5)}',
    '.am-watch-frame{position:relative;padding-bottom:56.25%;height:0;border-radius:12px;overflow:hidden;background:#05080f;border:1px solid var(--border,#2a3348)}',
    '.am-watch-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}',
    '@media (max-width:640px){.am-watch{margin-left:-4px;margin-right:-4px}.am-tryit{padding:14px}}'
  ].join('\n');

  function injectCss() {
    if (document.getElementById('am-css')) return;
    var st = document.createElement('style');
    st.id = 'am-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function okUrl(u) {
    return typeof u === 'string' && /^https?:\/\//i.test(u.trim());
  }
  function youtubeId(url) {
    var m = String(url).match(/(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/|v\/)|youtu\.be\/|music\.youtube\.com\/watch\?[^#]*v=)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  function vimeoId(url) {
    var m = String(url).match(/vimeo\.com\/(\d+)/);
    return m ? m[1] : null;
  }
  /* Trust tag from the source domain — teaches media literacy, kept factual. */
  function trustTag(url) {
    var host = '';
    try { host = new URL(String(url)).hostname.toLowerCase(); } catch (e) { return null; }
    var paper = /arxiv\.org$|doi\.org$|nature\.com$|science\.org$|sciencedirect\.com$|cell\.com$|plos\.org$|pnas\.org$|pubmed|\.nih\.gov$|ieee\.org$|acm\.org$|springer\.com$|wiley\.com$|tandfonline\.com$/;
    var official = /\.gov$|\.edu$|\.ac\.uk$|\.edu\.au$/;
    if (paper.test(host)) return { icon: '\U0001F4C4', label: 'Research paper' };
    if (official.test(host)) return { icon: '\U0001F3DB\uFE0F', label: 'Official source' };
    return { icon: '\U0001F4F0', label: 'News report' };
  }
  function trustPill(url) {
    var t = trustTag(url);
    if (!t) return '';
    return '<span class="am-trust">' + t.icon + ' ' + esc(t.label) + '</span>';
  }

  /* ---------- article lookup ---------- */
  function articleIdFromUrl() {
    try { return new URLSearchParams(location.search).get('id'); } catch (e) { return null; }
  }
  function waitForArticles() {
    return new Promise(function (resolve) {
      var tries = 0;
      (function tick() {
        try {
          if (typeof ARTICLES !== 'undefined' && ARTICLES && ARTICLES.length) return resolve(ARTICLES);
        } catch (e) {}
        if (++tries > 60) return resolve([]);
        setTimeout(tick, 250);
      })();
    });
  }
  function findEntry(articles, id) {
    if (!articles || !articles.length) return null;
    if (id) {
      for (var i = 0; i < articles.length; i++) {
        var x = articles[i];
        if (String(x.id) === String(id) || String(x.slug) === String(id)) return x;
      }
    }
    return articles[0];
  }
  function cleanMedia(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (m) {
      return m && (m.type === 'image' || m.type === 'video' || m.type === 'link') && okUrl(m.url);
    }).slice(0, 6);
  }
  function cleanSources(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (s) {
      return s && okUrl(s.url) && String(s.title || s.label || '').trim();
    }).map(function (s) {
      return { title: String(s.title || s.label || '').trim(), url: s.url, publisher: String(s.publisher || '').trim() };
    }).slice(0, 5);
  }
  function cleanTryIt(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (raw.type !== 'weekend-lab' && raw.type !== 'quiz') return null;
    if (!okUrl(raw.url)) return null;
    var label = String(raw.label || '').trim();
    if (!label) return null;
    return { type: raw.type, label: label.slice(0, 80), url: raw.url };
  }
  function fetchFullArticle(entry) {
    if (!entry || !entry.path || entry.body) return Promise.resolve(null);
    var base = location.pathname.indexOf('/pages/') !== -1 ? '../' : '';
    return fetch(base + entry.path, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* ---------- lightbox ---------- */
  var lb = null, items = [], idx = 0, broken = {};

  function itemLabel(m) {
    return m.type === 'image' ? '🖼️' : (m.type === 'video' ? '▶️' : '🔗');
  }

  function renderStage() {
    var stage = lb.querySelector('.am-stage');
    var m = items[idx];
    if (!m) { stage.innerHTML = '<div class="am-broken">Nothing here.</div>'; return; }

    if (m.type === 'image' && !broken[idx]) {
      stage.innerHTML = '<img alt="' + esc(m.caption || 'Story image') + '"/>';
      var img = stage.querySelector('img');
      img.onerror = function () {
        broken[idx] = true;
        renderStage();
        renderThumbs();
      };
      img.src = m.url;
    } else if (m.type === 'image' && broken[idx]) {
      stage.innerHTML = '<div class="am-broken">This image could not be loaded.<br>Try the source link below.</div>';
    } else if (m.type === 'video') {
      var yt = youtubeId(m.url), vm = vimeoId(m.url);
      if (yt) {
        stage.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + yt +
          '" title="' + esc(m.caption || 'Video') +
          '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
      } else if (vm) {
        stage.innerHTML = '<iframe src="https://player.vimeo.com/video/' + vm +
          '" title="' + esc(m.caption || 'Video') + '" allowfullscreen></iframe>';
      } else {
        stage.innerHTML = linkCard(m);
      }
    } else {
      stage.innerHTML = linkCard(m);
    }

    lb.querySelector('.am-cap').textContent = m.caption || '';
    var cred = lb.querySelector('.am-credit');
    var srcUrl = okUrl(m.sourceUrl) ? m.sourceUrl : (okUrl(m.url) ? m.url : null);
    cred.innerHTML = 'Credit: ' + esc(m.credit || 'Unknown source') +
      (srcUrl ? ' · <a href="' + esc(srcUrl) + '" target="_blank" rel="noopener">View source ↗</a>' : '');
    lb.querySelector('.am-pos').textContent = (idx + 1) + ' / ' + items.length;
    renderThumbs();
  }

  function linkCard(m) {
    return '<div class="am-linkcard"><div class="am-linkicon">' + itemLabel(m) + '</div>' +
      '<a href="' + esc(m.url) + '" target="_blank" rel="noopener">' + esc(m.caption || m.url) + '</a>' +
      '<div style="font-size:.85rem;color:var(--text-mute,#8b94a7)">Opens in a new tab</div></div>';
  }

  function renderThumbs() {
    var wrap = lb.querySelector('.am-thumbs');
    wrap.innerHTML = items.map(function (m, i) {
      var inner;
      if (m.type === 'image' && !broken[i]) {
        inner = '<img src="' + esc(m.url) + '" alt="" loading="lazy" onerror="this.closest(\'.am-thumb\').innerHTML=\'' + itemLabel(m) + '\'"/>';
      } else {
        inner = itemLabel(m);
      }
      return '<button class="am-thumb' + (i === idx ? ' active' : '') + '" data-i="' + i + '" aria-label="Media ' + (i + 1) + '">' + inner + '</button>';
    }).join('');
    wrap.querySelectorAll('.am-thumb').forEach(function (t) {
      t.addEventListener('click', function () { go(+t.dataset.i); });
    });
  }

  function go(i) {
    if (!items.length) return;
    idx = (i + items.length) % items.length;
    renderStage();
  }

  function renderSourcesHtml(sources) {
    if (!sources || !sources.length) return '';
    var first = sources[0], rest = sources.slice(1);
    var html = '<div class="am-sources">' +
      '<div class="am-src-head">\U0001F4F0 Original reporting</div>' +
      '<a class="am-src-main" href="' + esc(first.url) + '" target="_blank" rel="noopener">' +
        '<div class="am-src-title">' + esc(first.title) + trustPill(first.url) + '</div>' +
        '<div class="am-src-pub">' + esc(first.publisher || 'Source') + ' \u2197</div></a>';
    if (rest.length) {
      html += '<div class="am-src-head">More sources</div><div class="am-src-list">' +
        rest.map(function (s) {
          return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
            '<span class="t">' + esc(s.title) + trustPill(s.url) + '</span>' +
            '<span class="p">' + esc(s.publisher || '') + '</span></a>';
        }).join('') + '</div>';
    }
    return html + '</div>';
  }

  var srcList = [];
  function openLightbox(list, start, sources) {
    items = list; idx = start || 0; broken = {}; srcList = sources || [];
    closeLightbox();
    injectCss();
    lb = document.createElement('div');
    lb.className = 'am-lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-label', 'Story media gallery');
    lb.innerHTML =
      '<div class="am-box' + (items.length ? '' : ' am-nomedia') + '">' +
        '<button class="am-x" aria-label="Close">✕</button>' +
        '<div class="am-stage"></div>' +
        '<div class="am-cap"></div>' +
        '<div class="am-credit"></div>' +
        '<div class="am-thumbs"></div>' +
        '<div class="am-bar"><div class="am-pos"></div>' +
        '<div class="am-nav"><button class="am-prev" aria-label="Previous">‹</button>' +
        '<button class="am-next" aria-label="Next">›</button></div></div>' +
        renderSourcesHtml(srcList) +
      '</div>';
    document.body.appendChild(lb);
    requestAnimationFrame(function () { lb.classList.add('show'); });
    document.body.style.overflow = 'hidden';

    if (!items.length) { var st = lb.querySelector('.am-stage'); if (st) st.style.display = 'none'; }
    lb.querySelector('.am-x').addEventListener('click', closeLightbox);
    lb.querySelector('.am-prev').addEventListener('click', function (e) { e.stopPropagation(); go(idx - 1); });
    lb.querySelector('.am-next').addEventListener('click', function (e) { e.stopPropagation(); go(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
    document.addEventListener('keydown', onKey);
    renderStage();
  }

  function onKey(e) {
    if (!lb) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') go(idx - 1);
    else if (e.key === 'ArrowRight') go(idx + 1);
  }

  function closeLightbox() {
    if (!lb) return;
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = '';
    lb.remove();
    lb = null;
  }

  /* ---------- try-it card + inline video ---------- */
  function whenArticleReady(sel, fn) {
    var el = document.querySelector(sel);
    if (el) { fn(el); return; }
    var root = document.getElementById('article-root');
    if (!root) return;
    var obs = new MutationObserver(function () {
      var t = document.querySelector(sel);
      if (t) { obs.disconnect(); fn(t); }
    });
    obs.observe(root, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, 15000);
  }
  function mountTryIt(tryIt) {
    if (!tryIt || document.getElementById('am-tryit')) return;
    injectCss();
    whenArticleReady('#article-root .family-discussion', function (anchor) {
      if (document.getElementById('am-tryit')) return;
      var a = document.createElement('a');
      a.id = 'am-tryit';
      a.className = 'am-tryit';
      a.href = tryIt.url;
      a.innerHTML = '<span class="am-tryit-emoji">\U0001F9EA</span>' +
        '<span class="am-tryit-text"><b>Try it yourself:</b> ' + esc(tryIt.label) + ' \u2192</span>';
      anchor.parentNode.insertBefore(a, anchor);
    });
  }
  function videoEmbedUrl(m) {
    var yt = youtubeId(m.url), vm = vimeoId(m.url);
    if (yt) return 'https://www.youtube-nocookie.com/embed/' + yt;
    if (vm) return 'https://player.vimeo.com/video/' + vm;
    return null;
  }
  function mountWatchEmbed(media) {
    if (document.getElementById('am-watch')) return;
    var firstVideo = null;
    for (var i = 0; i < media.length; i++) {
      if (media[i].type === 'video') { firstVideo = media[i]; break; }
    }
    if (!firstVideo) return;
    var embed = videoEmbedUrl(firstVideo);
    if (!embed) return;
    injectCss();
    whenArticleReady('#article-root .article-hero', function (hero) {
      if (document.getElementById('am-watch')) return;
      var wrap = document.createElement('div');
      wrap.id = 'am-watch';
      wrap.className = 'am-watch';
      wrap.innerHTML = '<div class="am-watch-head">\u25B6 Watch the story</div>' +
        '<div class="am-watch-frame"><iframe src="' + esc(embed) + '" title="' + esc(firstVideo.caption || 'Story video') +
        '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>';
      hero.insertAdjacentElement('afterend', wrap);
    });
  }

  /* ---------- button ---------- */
  function mountButton(media, sources) {
    if (document.getElementById('am-btn')) return;
    var hero = document.querySelector('#article-root .article-hero');
    if (!hero) return;
    injectCss();
    var hasMedia = media.length > 0;
    var btn = document.createElement('button');
    btn.id = 'am-btn';
    btn.className = 'am-btn';
    btn.innerHTML = hasMedia
      ? '📸 Media <span class="am-count">' + media.length + '</span>'
      : '📰 Sources <span class="am-count">' + sources.length + '</span>';
    btn.setAttribute('aria-label', hasMedia
      ? 'Open story media gallery (' + media.length + ' items)'
      : 'Open story sources (' + sources.length + ' sources)');
    btn.addEventListener('click', function () { openLightbox(media, 0, sources); });
    hero.insertAdjacentElement('afterend', btn);
  }

  /* ---------- boot ---------- */
  function boot() {
    // Only on the article page.
    if (!document.getElementById('article-root')) return;
    waitForArticles().then(function (articles) {
      var entry = findEntry(articles, articleIdFromUrl());
      if (!entry) return;
      var media = cleanMedia(entry.media);
      var sources = cleanSources(entry.sources);
      var tryIt = cleanTryIt(entry.tryIt);
      if (media.length || sources.length || tryIt) {
        mountAll(media, sources, tryIt);
        return;
      }
      fetchFullArticle(entry).then(function (full) {
        if (!full) return;
        mountAll(cleanMedia(full.media), cleanSources(full.sources), cleanTryIt(full.tryIt));
      });
    });
  }

  function mountAll(media, sources, tryIt) {
    if (media.length || (sources && sources.length)) mountWhenReady(media, sources || []);
    if (tryIt) mountTryIt(tryIt);
    if (media.length) mountWatchEmbed(media);
  }

  function mountWhenReady(media, sources) {
    // The hero may render after the manifest resolves; watch for it.
    var hero = document.querySelector('#article-root .article-hero');
    if (hero) { mountButton(media, sources); return; }
    var root = document.getElementById('article-root');
    var obs = new MutationObserver(function () {
      if (document.querySelector('#article-root .article-hero')) {
        obs.disconnect();
        mountButton(media, sources);
      }
    });
    obs.observe(root, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
