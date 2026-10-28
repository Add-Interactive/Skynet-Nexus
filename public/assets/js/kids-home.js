/* ============================================================
   SKYNET NEXUS — Kids Mode home variant (piece b)
   Builds the Kids Mode home section on public/index.html:
   the correspondent cast strip (portraits honor the visitor's
   'skynet.corrStyle' choice, same as team.html) and the Marcus
   welcome lightbox (tap-to-play only, never autoplay).
   Runs ONLY when the Kids Mode marker is on
   (html[data-kids-mode="true"], set by kids-mode.js). The section
   itself is display:none by default in kids-mode.css, so the
   straight homepage is untouched when the marker is off.
   Media the variant references (Jeff's local-git media push):
     /assets/img/newsroom/flagship-newsroom.webp (hero backdrop)
     /assets/img/host/marcus-reed-portrait.webp (welcome card + poster)
     /assets/video/marcus-reed-intro-40s-v2.mp4 (welcome player)
   If a Marcus file is missing, the welcome card falls back to
   text and the lightbox shows a friendly message — never a
   broken page. Cast portraits are already live on the site.
   ============================================================ */
(function () {
  'use strict';

  var MARCUS_VIDEO = '/assets/video/marcus-reed-intro-40s-v2.mp4';
  var MARCUS_POSTER = '/assets/img/host/marcus-reed-portrait.webp';

  /* Fallback correspondent list (channel, name, accent) — used only
     if /api/correspondents fails. Portrait URLs follow the live
     pattern /assets/img/channels/<channel>/portrait-<style>.webp. */
  var FALLBACK_CAST = [
    { channel: 'ai', name: 'Dr. Adaeze Obi', color: '#a855f7' },
    { channel: 'space', name: 'Stella Reyes', color: '#3b82f6' },
    { channel: 'robotics', name: 'Dexter Cole', color: '#eab308' },
    { channel: 'biotech', name: 'Dr. Wren Hollis', color: '#10b981' },
    { channel: 'quantum', name: 'Dr. Quinn Adler', color: '#06b6d4' },
    { channel: 'climate', name: 'Rowan Field', color: '#22c55e' },
    { channel: 'engineering', name: 'Gus Delgado', color: '#f97316' },
    { channel: 'math', name: 'Dr. Mira Solano', color: '#ef4444' },
    { channel: 'cyber', name: 'Juno Park', color: '#6366f1' },
    { channel: 'gaming', name: 'Kai Tanaka', color: '#84cc16' },
    { channel: 'music', name: 'Cadence Liu', color: '#ec4899' },
    { channel: 'stem', name: 'Dr. Lena Osei', color: '#00e5ff' },
    { channel: 'play', name: 'Hazel Quinn', color: '#39ff14' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function isOn() {
    return document.documentElement.getAttribute('data-kids-mode') === 'true';
  }

  function corrStyle() {
    try {
      var s = localStorage.getItem('skynet.corrStyle');
      return (s === 'human' || s === 'animal' || s === 'skynet') ? s : 'human';
    } catch (e) { return 'human'; }
  }

  var built = false;
  function buildCast(list) {
    var strip = document.getElementById('kids-cast-strip');
    if (!strip || built) return;
    var style = corrStyle();
    strip.innerHTML = list.map(function (c) {
      var src = c.portrait || ('/assets/img/channels/' + c.channel + '/portrait-' + style + '.webp');
      var name = c.name || c.displayName || c.channel || 'Correspondent';
      var color = c.color || c.accentColor || '#00e5ff';
      return '<a class="kids-cast-tile" href="/pages/channel.html?c=' + encodeURIComponent(c.channel) + '" style="--cc:' + esc(color) + '">' +
        '<img src="' + esc(src) + '" alt="Portrait of ' + esc(name) + '" loading="lazy" onerror="this.style.visibility=\'hidden\'"/>' +
        '<span>' + esc(name) + '</span></a>';
    }).join('');
    built = true;
  }

  function loadCast() {
    if (built) return;
    fetch('/api/correspondents')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var list = data && (Array.isArray(data) ? data : data.correspondents);
        if (list && list.length) {
          buildCast(list.map(function (c) {
            var style = corrStyle();
            var p = c.portraits || {};
            return { channel: c.channel, name: c.displayName, color: c.accentColor, portrait: p[style] || p.human || '' };
          }));
        } else {
          buildCast(FALLBACK_CAST);
        }
      })
      .catch(function () { buildCast(FALLBACK_CAST); });
  }

  function maybeBuild() {
    if (isOn()) loadCast();
  }

  /* ---- Marcus welcome lightbox (team-page pattern) ---- */
  var lightbox, lightboxVideo, lightboxFallback;
  /* Viewport anchoring + scroll lock: game-ui.css puts perspective on
     body, which degrades position:fixed to document-relative and lands
     the player mid-document, so the overlay is anchored to the
     viewport rect on open. Mobile follow-up: window.innerHeight is
     NOT the visible height under dynamic mobile toolbars, and
     overflow:hidden does not lock touch scrolling on iOS Safari --
     the page scrolls under the overlay and the anchor goes stale.
     Anchor to window.visualViewport instead, re-anchor on
     visualViewport resize/scroll, and lock scrolling with
     position:fixed on body (the iOS-proof lock), restoring the
     exact scroll position on close. */
  var savedScrollY = 0;
  var savedBodyOverflow = '';
  var savedBodyPosition = '';
  var savedBodyTop = '';
  var savedBodyWidth = '';
  function viewportRect() {
    var vv = window.visualViewport;
    if (vv) return { top: savedScrollY + (vv.offsetTop || 0), height: vv.height };
    return { top: savedScrollY, height: window.innerHeight };
  }
  function blockBackdropScroll(e) {
    /* Block backdrop drags only when the lightbox has nothing to
       scroll: on short portrait screens its content can overflow,
       and a backdrop drag must then scroll the lightbox. The page
       behind stays locked regardless (body position:fixed + html
       overflow:hidden), so this never re-enables page scrolling. */
    if (e.target === lightbox && lightbox.scrollHeight <= lightbox.clientHeight) e.preventDefault();
  }
  function anchorLightbox() {
    savedScrollY = window.scrollY || 0;
    savedBodyOverflow = document.body.style.overflow || '';
    savedBodyPosition = document.body.style.position || '';
    savedBodyTop = document.body.style.top || '';
    savedBodyWidth = document.body.style.width || '';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = (-savedScrollY) + 'px';
    document.body.style.width = '100%';
    var rect = viewportRect();
    lightbox.style.position = 'absolute';
    lightbox.style.top = rect.top + 'px';
    lightbox.style.left = '0';
    lightbox.style.width = '100%';
    lightbox.style.height = rect.height + 'px';
    window.addEventListener('resize', reanchorLightbox);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', reanchorLightbox);
      window.visualViewport.addEventListener('scroll', reanchorLightbox);
    }
    lightbox.addEventListener('touchmove', blockBackdropScroll, { passive: false });
  }
  function reanchorLightbox() {
    if (!lightbox.classList.contains('open')) return;
    var rect = viewportRect();
    lightbox.style.top = rect.top + 'px';
    lightbox.style.height = rect.height + 'px';
  }
  function releaseLightbox() {
    window.removeEventListener('resize', reanchorLightbox);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', reanchorLightbox);
      window.visualViewport.removeEventListener('scroll', reanchorLightbox);
    }
    lightbox.removeEventListener('touchmove', blockBackdropScroll);
    lightbox.style.position = '';
    lightbox.style.top = '';
    lightbox.style.left = '';
    lightbox.style.width = '';
    lightbox.style.height = '';
    document.body.style.overflow = savedBodyOverflow;
    document.body.style.position = savedBodyPosition;
    document.body.style.top = savedBodyTop;
    document.body.style.width = savedBodyWidth;
    document.documentElement.style.overflow = '';
    window.scrollTo(0, savedScrollY);
  }
  function closeWelcome() {
    if (!lightbox) return;
    var wasOpen = lightbox.classList.contains('open');
    lightboxVideo.pause();
    lightboxVideo.removeAttribute('src');
    lightboxVideo.load();
    lightbox.classList.remove('open');
    if (wasOpen) releaseLightbox();
  }
  function openWelcome() {
    if (!lightbox || !isOn()) return;
    lightboxFallback.hidden = true;
    lightboxVideo.hidden = false;
    lightboxVideo.poster = MARCUS_POSTER;
    lightboxVideo.src = MARCUS_VIDEO;
    lightbox.classList.add('open');
    anchorLightbox();
    lightboxVideo.play().catch(function () {});
  }
  function initLightbox() {
    lightbox = document.getElementById('kids-lightbox');
    if (!lightbox) return;
    lightboxVideo = document.getElementById('kids-lightbox-video');
    lightboxFallback = document.getElementById('kids-lightbox-fallback');
    lightboxVideo.addEventListener('error', function () {
      lightboxVideo.hidden = true;
      lightboxFallback.hidden = false;
    });
    var play = document.getElementById('kids-welcome-play');
    if (play) play.addEventListener('click', openWelcome);
    var close = document.getElementById('kids-lightbox-close');
    if (close) close.addEventListener('click', closeWelcome);
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeWelcome(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeWelcome(); });
  }

  initLightbox();
  maybeBuild();
  /* The Kids Mode toggle can flip while this page is open: build the
     cast strip the first time the marker turns on. */
  if (window.MutationObserver) {
    new MutationObserver(function () { maybeBuild(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-kids-mode'] });
  }
})();
