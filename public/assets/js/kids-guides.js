/* ============================================================
   SKYNET NEXUS — Kids Mode correspondent guides (piece c)
   Builds the guide strip on channel pages: the correspondent for
   that channel greets the kid, explains the channel in character
   (their existing kidBio), and points at the day's stories.

   Pages: public/pages/channel.html (channel from ?c=) and the
   topic pages stem/robotics/play/music.html (channel from the
   strip container's data-guide-channel attribute). The strip
   container (#kids-guide) is the first child of <main> on each
   page; the strip itself is display:none by default in
   kids-mode.css and renders ONLY when the Kids Mode marker is on
   (html[data-kids-mode="true"], set by kids-mode.js). The
   straight pages are untouched when the marker is off.

   Data: API-first (/api/correspondents, same as team.html) with a
   hardcoded fallback below (kidBio verbatim from
   newsroom/agents-config.js) if the fetch fails. Portraits honor
   the visitor's 'skynet.corrStyle' choice (human/animal/skynet),
   same as team.html and the piece (b) cast strip. Intro videos
   use team.html's INTRO_VIDEOS map — the 13 files live at
   /assets/video/intros/ (PR #152). Guides are correspondent-only
   and NEVER depend on the pending Marcus host media push.

   Video: tap-to-play lightbox only (team-page pattern), never
   autoplay. If a portrait is missing, the image hides and the
   strip still shows the greeting, bio, and buttons — never a
   broken page. No data-flow changes: the stories link just
   scrolls to the page's existing #feed-grid.
   ============================================================ */
(function () {
  'use strict';

  var CHANNELS = ['ai', 'space', 'robotics', 'biotech', 'quantum', 'climate', 'engineering', 'math', 'cyber', 'gaming', 'music', 'stem', 'play'];

  /* Intro video files — same map as public/pages/team.html. */
  var INTRO_VIDEOS = {
    'agent-ai': 'adaeze-obi-intro-40s.mp4',
    'agent-space': 'stella-reyes-intro-40s.mp4',
    'agent-robotics': 'dexter-cole-intro-40s.mp4',
    'agent-biotech': 'wren-hollis-intro-40s.mp4',
    'agent-quantum': 'quinn-adler-intro-40s.mp4',
    'agent-climate': 'rowan-field-intro-40s.mp4',
    'agent-engineering': 'gus-delgado-intro-40s.mp4',
    'agent-math': 'mira-solano-intro-40s.mp4',
    'agent-cyber': 'juno-park-intro-40s.mp4',
    'agent-gaming': 'kai-tanaka-intro-40s.mp4',
    'agent-music': 'cadence-liu-intro-40s.mp4',
    'agent-stem': 'lena-osei-intro-40s.mp4',
    'agent-play': 'hazel-quinn-intro-40s.mp4'
  };

  /* Fallback guide data — kidBio verbatim from
     newsroom/agents-config.js. Used only if /api/correspondents
     fails. Portrait URLs follow the live pattern
     /assets/img/channels/<channel>/portrait-<style>.webp. */
  var FALLBACK_GUIDES = [
    { channel: 'ai', slug: 'agent-ai', name: 'Dr. Adaeze Obi', color: '#a855f7', kidBio: "Hi! I'm Adaeze, and I'm obsessed with how computers learn. I hunt down the coolest stories about machines that can think, draw, and talk — and I explain them so you can amaze your friends." },
    { channel: 'space', slug: 'agent-space', name: 'Stella Reyes', color: '#3b82f6', kidBio: "Stella here — professional star-chaser! I cover rockets, planets, and everything happening way, way above our heads. If it's launching, landing, or glowing in the night sky, I'm on it." },
    { channel: 'robotics', slug: 'agent-robotics', name: 'Dexter Cole', color: '#eab308', kidBio: "Beep boop! I'm Dexter, and robots are my best friends. I find stories about machines that build, help, and play — and I love showing how they work, bolt by bolt." },
    { channel: 'biotech', slug: 'agent-biotech', name: 'Dr. Wren Hollis', color: '#10b981', kidBio: "I'm Wren, and I explore the tiniest living things on Earth! From DNA to new medicines, I cover the science that's keeping people and the planet healthy." },
    { channel: 'quantum', slug: 'agent-quantum', name: 'Dr. Quinn Adler', color: '#06b6d4', kidBio: "Quinn here — I cover the weirdest science there is: quantum! It's the science of super-tiny particles that can be in two places at once. Mind-bending, right?" },
    { channel: 'climate', slug: 'agent-climate', name: 'Rowan Field', color: '#22c55e', kidBio: "Hey, I'm Rowan! I report on planet Earth — clean energy, wild weather, and the kids and scientists protecting our home. The Earth is our beat, and it's a good one." },
    { channel: 'engineering', slug: 'agent-engineering', name: 'Gus Delgado', color: '#f97316', kidBio: "Gus in the house! I cover the builders — bridges, towers, gadgets, and the kids inventing the future with their own two hands. If it was built, I want to see how." },
    { channel: 'math', slug: 'agent-math', name: 'Dr. Mira Solano', color: '#ef4444', kidBio: "I'm Mira, and I think numbers are magic! I cover math competitions, puzzles, and the hidden patterns that run the world. Math is way more fun than you think — I promise." },
    { channel: 'cyber', slug: 'agent-cyber', name: 'Juno Park', color: '#6366f1', kidBio: "Juno here — guardian of the internet! I cover cybersecurity, coding, and how to stay safe online. Think of me as your friendly neighborhood code-defender." },
    { channel: 'gaming', slug: 'agent-gaming', name: 'Kai Tanaka', color: '#84cc16', kidBio: "Kai here — game on! I cover video games, esports, and the awesome people who make them. From epic tournaments to the coolest new releases, I play so you know." },
    { channel: 'music', slug: 'agent-music', name: 'Cadence Liu', color: '#ec4899', kidBio: "I'm Cadence, and I follow the beat! I cover music festivals, young artists, and the sounds shaping our world. Life's better with a soundtrack." },
    { channel: 'stem', slug: 'agent-stem', name: 'Dr. Lena Osei', color: '#00e5ff', kidBio: "Lena here — professional curiosity expert! I cover science fairs, student inventors, and the experiments that make you say 'whoa.' Science is for everyone, and I mean everyone." },
    { channel: 'play', slug: 'agent-play', name: 'Hazel Quinn', color: '#39ff14', kidBio: "Hazel at play! I cover games, toys, and the art of having fun — plus the brilliant kids designing the playgrounds of tomorrow. Play is serious business." }
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

  /* Channel for this page, in order: the strip container's
     data-guide-channel attribute (topic pages), then the ?c=
     query param validated against the 13 live channels
     (channel.html). Anything else renders no guide. */
  function resolveChannel() {
    var box = document.getElementById('kids-guide');
    if (!box) return null;
    var fixed = box.getAttribute('data-guide-channel');
    if (fixed && CHANNELS.indexOf(fixed) !== -1) return fixed;
    try {
      var c = new URLSearchParams(location.search).get('c');
      if (c && CHANNELS.indexOf(c) !== -1) return c;
    } catch (e) { /* no query string: no guide */ }
    return null;
  }

  function portraitFor(c, style) {
    var p = c.portraits || {};
    return p[style] || p.human || ('/assets/img/channels/' + c.channel + '/portrait-' + style + '.webp');
  }

  function introFile(c) {
    return (c && c.slug && INTRO_VIDEOS[c.slug]) || '';
  }

  var built = false;
  var current = null;

  function buildGuide(c) {
    var box = document.getElementById('kids-guide');
    if (!box || built || !c || !isOn()) return;
    var style = corrStyle();
    var src = portraitFor(c, style);
    var name = c.displayName || c.name || 'Your correspondent';
    var color = c.accentColor || c.color || '#00e5ff';
    var bio = c.kidBio || '';
    var file = introFile(c);
    var html = '<div class="kids-guide-inner" style="--gc:' + esc(color) + '">';
    if (src) {
      html += '<button type="button" class="kids-guide-portrait" data-guide-watch aria-label="Watch ' + esc(name) + '\'s introduction video">' +
        '<img src="' + esc(src) + '" alt="Portrait of ' + esc(name) + '" loading="lazy" onerror="this.style.visibility=\'hidden\'"/>' +
        (file ? '<span class="kids-guide-play" aria-hidden="true">▶</span>' : '') + '</button>';
    }
    html += '<div class="kids-guide-text">' +
      '<div class="kids-guide-hello">👋 Meet your guide: ' + esc(name) + '</div>' +
      (bio ? '<p class="kids-guide-bio">' + esc(bio) + '</p>' : '') +
      '<div class="kids-guide-actions">' +
      (file ? '<button type="button" class="kids-guide-watch" data-guide-watch>▶ Watch my intro</button>' : '') +
      '<a class="kids-guide-stories" href="#feed-grid">See today\'s stories ↓</a>' +
      '</div></div></div>';
    box.innerHTML = html;
    built = true;
    current = c;
  }

  /* ---- Intro lightbox (team-page pattern) ----
     Created on first tap, never autoplay: the video src is set
     only when opened and cleared on close. */
  var lightbox, lightboxVideo, lightboxTitle, lightboxNote;
  function ensureLightbox() {
    if (lightbox) return;
    lightbox = document.createElement('div');
    lightbox.className = 'kids-guide-lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Introduction video');
    lightbox.innerHTML = '<div class="kids-guide-lightbox-box">' +
      '<h3 class="kids-guide-lightbox-title"></h3>' +
      '<video controls playsinline></video>' +
      '<p class="kids-guide-lightbox-note" hidden>This intro video isn\'t available right now.</p>' +
      '<div><button type="button" class="kids-guide-lightbox-close">Close</button></div></div>';
    document.body.appendChild(lightbox);
    lightboxVideo = lightbox.querySelector('video');
    lightboxTitle = lightbox.querySelector('.kids-guide-lightbox-title');
    lightboxNote = lightbox.querySelector('.kids-guide-lightbox-note');
    lightboxVideo.addEventListener('error', function () {
      lightboxVideo.hidden = true;
      lightboxNote.hidden = false;
    });
    lightbox.querySelector('.kids-guide-lightbox-close').addEventListener('click', closeIntro);
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) closeIntro(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeIntro(); });
  }
  function closeIntro() {
    if (!lightbox) return;
    lightboxVideo.pause();
    lightboxVideo.removeAttribute('src');
    lightboxVideo.load();
    lightbox.classList.remove('open');
  }
  function openIntro() {
    if (!current || !isOn()) return;
    var file = introFile(current);
    if (!file) return;
    ensureLightbox();
    lightboxNote.hidden = true;
    lightboxVideo.hidden = false;
    lightboxTitle.textContent = (current.displayName || current.name || 'Correspondent') + ' — introduction video';
    lightboxVideo.src = '/assets/video/intros/' + file;
    lightbox.classList.add('open');
    lightboxVideo.play().catch(function () {});
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-guide-watch]') : null;
    if (btn) openIntro();
  });

  function findGuide(list, channel) {
    if (!list) return null;
    var found = list.filter(function (c) { return c.channel === channel; });
    return found.length ? found[0] : null;
  }

  function loadGuide() {
    if (built) return;
    var channel = resolveChannel();
    if (!channel) return;
    fetch('/api/correspondents')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var list = data && (Array.isArray(data) ? data : data.correspondents);
        buildGuide(findGuide(list, channel) || findGuide(FALLBACK_GUIDES, channel));
      })
      .catch(function () {
        buildGuide(findGuide(FALLBACK_GUIDES, channel));
      });
  }

  function maybeBuild() {
    if (isOn()) loadGuide();
  }

  maybeBuild();
  /* The Kids Mode toggle can flip while this page is open: build
     the strip the first time the marker turns on. */
  if (window.MutationObserver) {
    new MutationObserver(function () { maybeBuild(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-kids-mode'] });
  }
})();
