/* Skynet Nexus — article reading navigation.
 * 1. Moves the "Free art" download button out of the hero overlay (where it
 *    covered the title on narrow screens) into the sticky article toolbar.
 * 2. Adds a "Newer story / Older story" pager at the bottom of the article.
 * 3. Swipe left/right anywhere on the article to move between stories in
 *    front-page feed order — no back button or menu needed.
 * Swipes that start inside the media lightbox or a horizontally-scrolling
 * element are left alone so gallery browsing still works.
 * Standalone file (loaded after app.js on article.html only) — app.js is not touched.
 */
(function () {
  'use strict';

  // The article page renders into #article-root via initArticlePage in app.js.
  var root = document.getElementById('article-root');
  if (!root) return;

  // Wait for the article to render (app.js builds it async from the manifest).
  var tries = 0;
  var timer = setInterval(function () {
    var art = root.querySelector('article.article');
    if (art) { clearInterval(timer); init(art); }
    else if (++tries > 100) { clearInterval(timer); }
  }, 100);

  function init(art) {
    // ---- 1. Relocate the Free art button: hero overlay -> toolbar ----
    var dl = art.querySelector('.article-hero .art-dl');
    var toolbar = art.querySelector('.article-toolbar');
    if (dl && toolbar) toolbar.appendChild(dl);

    // ---- 2 & 3. Pager + swipe, in front-page feed order ----
    // ARTICLES is seeded from data/manifest.json by app.js (feed order).
    var list = (typeof ARTICLES !== 'undefined' && ARTICLES) || [];
    var params = new URLSearchParams(location.search);
    var idParam = params.get('id');
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (String(x.id) === String(idParam) || String(x.slug) === String(idParam) || String(x.legacyId) === String(idParam)) { idx = i; break; }
    }
    if (idx < 0) return;
    var prev = list[idx - 1] || null; // newer
    var next = list[idx + 1] || null; // older
    if (!prev && !next) return;

    // Visible pager at the bottom of the article.
    var pager = document.createElement('nav');
    pager.className = 'article-pager';
    pager.setAttribute('aria-label', 'More stories');
    var html = '';
    if (prev) {
      html += '<a class="pager-link pager-prev" href="article.html?id=' + prev.id + '">' +
        '<span class="pager-arrow" aria-hidden="true">\u2190</span>' +
        '<span class="pager-text"><span class="pager-label">Newer story</span>' +
        '<span class="pager-title">' + prev.title + '</span></span></a>';
    } else { html += '<span class="pager-link pager-empty" aria-hidden="true"></span>'; }
    if (next) {
      html += '<a class="pager-link pager-next" href="article.html?id=' + next.id + '">' +
        '<span class="pager-text"><span class="pager-label">Older story</span>' +
        '<span class="pager-title">' + next.title + '</span></span>' +
        '<span class="pager-arrow" aria-hidden="true">\u2192</span></a>';
    } else { html += '<span class="pager-link pager-empty" aria-hidden="true"></span>'; }
    pager.innerHTML = html;
    var comments = art.querySelector('.comments');
    if (comments && comments.parentNode) comments.parentNode.insertBefore(pager, comments.nextSibling);
    else art.appendChild(pager);

    // Swipe left/right to move between stories.
    var startX = 0, startY = 0, startEl = null, tracking = false;
    art.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { tracking = false; return; }
      var t = e.touches[0];
      startX = t.clientX; startY = t.clientY; startEl = e.target; tracking = true;
    }, { passive: true });
    art.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - startX, dy = t.clientY - startY;
      if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (document.querySelector('.am-lb.show')) return; // media lightbox open
      var el = startEl;
      while (el && el !== art) {
        if (el.scrollWidth > el.clientWidth + 10) return; // horizontal scroller
        el = el.parentElement;
      }
      var dest = dx < 0 ? next : prev;
      if (dest) location.href = 'article.html?id=' + dest.id;
    }, { passive: true });
  }
})();
