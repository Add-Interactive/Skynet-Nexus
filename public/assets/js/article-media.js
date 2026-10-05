/* Skynet Nexus — article media gallery.
 * Adds a "📸 Media (n)" button under the article hero when the story carries
 * a `media` array, opening a lightbox with images, embedded videos, and links.
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
    '@media (max-width:640px){.am-box{width:100vw;height:100dvh;max-height:100dvh;border-radius:0}.am-stage,.am-stage iframe,.am-stage img{max-height:52vh}}'
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
  function fetchFullMedia(entry) {
    if (!entry || !entry.path || entry.body) return Promise.resolve(null);
    var base = location.pathname.indexOf('/pages/') !== -1 ? '../' : '';
    return fetch(base + entry.path, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (full) { return full && Array.isArray(full.media) ? full.media : null; })
      .catch(function () { return null; });
  }
  function cleanMedia(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (m) {
      return m && (m.type === 'image' || m.type === 'video' || m.type === 'link') && okUrl(m.url);
    }).slice(0, 6);
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
    idx = (i + items.length) % items.length;
    renderStage();
  }

  function openLightbox(list, start) {
    items = list; idx = start || 0; broken = {};
    closeLightbox();
    injectCss();
    lb = document.createElement('div');
    lb.className = 'am-lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-label', 'Story media gallery');
    lb.innerHTML =
      '<div class="am-box">' +
        '<button class="am-x" aria-label="Close">✕</button>' +
        '<div class="am-stage"></div>' +
        '<div class="am-cap"></div>' +
        '<div class="am-credit"></div>' +
        '<div class="am-thumbs"></div>' +
        '<div class="am-bar"><div class="am-pos"></div>' +
        '<div class="am-nav"><button class="am-prev" aria-label="Previous">‹</button>' +
        '<button class="am-next" aria-label="Next">›</button></div></div>' +
      '</div>';
    document.body.appendChild(lb);
    requestAnimationFrame(function () { lb.classList.add('show'); });
    document.body.style.overflow = 'hidden';

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

  /* ---------- button ---------- */
  function mountButton(media) {
    if (document.getElementById('am-btn')) return;
    var hero = document.querySelector('#article-root .article-hero');
    if (!hero) return;
    injectCss();
    var btn = document.createElement('button');
    btn.id = 'am-btn';
    btn.className = 'am-btn';
    btn.innerHTML = '📸 Media <span class="am-count">' + media.length + '</span>';
    btn.setAttribute('aria-label', 'Open story media gallery (' + media.length + ' items)');
    btn.addEventListener('click', function () { openLightbox(media, 0); });
    hero.insertAdjacentElement('afterend', btn);
  }

  /* ---------- boot ---------- */
  function boot() {
    // Only on the article page.
    if (!document.getElementById('article-root')) return;
    waitForArticles().then(function (articles) {
      var entry = findEntry(articles, articleIdFromUrl());
      if (!entry) return;
      var fromManifest = cleanMedia(entry.media);
      if (fromManifest.length) { mountWhenReady(fromManifest); return; }
      fetchFullMedia(entry).then(function (full) {
        var m = cleanMedia(full);
        if (m.length) mountWhenReady(m);
      });
    });
  }

  function mountWhenReady(media) {
    // The hero may render after the manifest resolves; watch for it.
    var hero = document.querySelector('#article-root .article-hero');
    if (hero) { mountButton(media); return; }
    var root = document.getElementById('article-root');
    var obs = new MutationObserver(function () {
      if (document.querySelector('#article-root .article-hero')) {
        obs.disconnect();
        mountButton(media);
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
