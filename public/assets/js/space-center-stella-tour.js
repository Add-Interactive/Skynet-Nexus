/* Stella's Mission Control tour — Kids Mode guide layer for Space Center.
   Chrome + guide ONLY. The 3D canvas, satellite code, TLE data, fleet colors,
   and all Space Center behavior are untouched; the grid stays off live.
   Runs only when Kids Mode is on (html[data-kids-mode="true"]).
   Tour state is device-level localStorage only: 'skynet.scStellaTourSeenV2' (v2: re-shows once to devices that took the 8-step tour).
   Portrait: API-first (/api/correspondents, same pattern as kids-guides.js),
   falling back to the already-live channel portrait
   /assets/img/channels/space/portrait-<style>.webp. No new media. */
(function () {
  var SEEN_KEY = 'skynet.scStellaTourSeenV2';
  var STYLE_KEY = 'skynet.corrStyle';
  var WIDE_TABS = ['launches', 'students', 'moonmars', 'stories', 'tonight',
    'orbitlab', 'zones', 'stem', 'science', 'tours', 'modellab'];

  var STEPS = [
    { tab: null, sel: '#topbar .title',
      line: "Hi, cadet! I'm Stella Reyes, and this is my Mission Control — my home in space! I'll show you around. Ready? Tap Next!" },
    { tab: 'search', sel: '#searchbox',
      line: "This is Search! Type a satellite's name — or tap a Quick Fly button like ISS — and the camera zooms right to it. And tapping any satellite dot in the sky opens its profile card with photos and facts!" },
    { tab: 'missions', sel: '#mission-list',
      line: "This is Missions — your challenge board! Finish challenges like saying hello to the ISS or spotting a Starlink train, and earn badges!" },
    { tab: 'fleets', sel: '#fleet-list',
      line: "These are the fleets! Starlink shines white, the Others fleet is dark blue, and every other fleet has its own color. Tap a fleet name to hide it from the sky — or bring it back!" },
    { tab: 'launches', sel: '#launch-grid',
      line: "Launches is the launch board! The next big liftoff sits on top, with up to eight more upcoming launches below!" },
    { tab: 'students', sel: '#student-grid',
      line: "Students in space! These are real experiments built by students like you, riding on real rockets!" },
    { tab: 'moonmars', sel: '#page-moonmars',
      line: "The race back to the Moon — and on to Mars! This is the deep space board — meet the spacecraft exploring the Moon and Mars!" },
    { tab: 'stories', sel: '#story-grid',
      line: "Stories brings you the latest space reports from the Newsroom — real space news, right here in Mission Control!" },
    { tab: 'tonight', sel: '#pass-go',
      line: "See It Tonight finds satellites flying over YOUR backyard in the next 48 hours! Set your location, then tap Find my passes — and go look up!" },
    { tab: 'orbitlab', sel: '#lab-alt',
      line: "In Orbit Lab YOU build a satellite! Drag the Altitude slider and watch its orbit change around Earth. That's real space science, cadet!" },
    { tab: 'zones', sel: '#page-zones',
      line: "Orbit Zones shows how the sky is divided into neighborhoods — LEO, MEO, GEO, and more! You can even see the zones in 3D!" },
    { tab: 'stem', sel: '#stem-grid',
      line: "STEM Missions are satellites built by students like you, plus missions linking classrooms and citizen scientists to space. Proof you don't need a PhD to reach orbit!" },
    { tab: 'science', sel: '#science-grid',
      line: "Science Satellites are space telescopes and Earth detectives — they study black holes, hunt new planets, and take Earth's temperature!" },
    { tab: 'tours', sel: '#tour-list',
      line: "Guided Tours fly the camera from stop to stop while a guide tells each story. Pick one whenever you want a ride!" },
    { tab: 'whatsnew', sel: '#page-whatsnew',
      line: "What's New lists the freshest upgrades to Mission Control — check here whenever something new lands!" },
    { tab: null, sel: '#timebar',
      line: "Down here is time itself! Pause the sky, or speed it up 60× or 600× and watch the satellites race around Earth!" },
    { tab: 'modellab', sel: '#mlab-library',
      line: "Last stop: the Model Library! Spin real 3D satellites around — or place one in your room in AR. That's the whole tour — every menu in Mission Control! You're ready, cadet — go explore! Tap Blast off to finish!" }
  ];

  var card = null, lineEl = null, dotsEl = null, nextBtn = null, backBtn = null;
  var portraitEl = null, tourBtn = null, step = 0, open = false, spotlit = null;

  function kidsOn() {
    return document.documentElement.getAttribute('data-kids-mode') === 'true';
  }
  function seen() {
    try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return true; }
  }
  function markSeen() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* private mode */ }
    if (tourBtn) tourBtn.classList.remove('sc-tour-nudge');
  }
  function corrStyle() {
    try {
      var s = localStorage.getItem(STYLE_KEY);
      if (s === 'animal' || s === 'skynet' || s === 'human') return s;
    } catch (e) { /* ignore */ }
    return 'human';
  }
  function portraitFallback() {
    return '/assets/img/channels/space/portrait-' + corrStyle() + '.webp';
  }
  function loadPortrait() {
    if (!portraitEl) return;
    portraitEl.src = portraitFallback();
    portraitEl.onerror = function () { portraitEl.style.display = 'none'; };
    try {
      fetch('/api/correspondents').then(function (r) { return r.json(); }).then(function (list) {
        var arr = Array.isArray(list) ? list : (list.correspondents || []);
        for (var i = 0; i < arr.length; i++) {
          if (arr[i].channel === 'space') {
            var p = arr[i].portraits || {};
            var style = corrStyle();
            var src = p[style] || p.human;
            if (src && portraitEl) portraitEl.src = src;
            return;
          }
        }
      }).catch(function () { /* fallback already set */ });
    } catch (e) { /* fallback already set */ }
  }

  function openTabVia(tab) {
    try {
      if (window.__scB && typeof window.__scB.openTab === 'function') {
        window.__scB.openTab(tab);
        return;
      }
    } catch (e) { /* fall through */ }
    var tabBtn = document.querySelector('#sidepanel .tab[data-tab="' + tab + '"]');
    if (tabBtn) { tabBtn.click(); return; }
    /* Last-resort manual mirror of openTab (main.js) if its handlers are gone. */
    document.querySelectorAll('.rbtn').forEach(function (x) {
      x.classList.toggle('on', x.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('#sidepanel .tab').forEach(function (x) {
      x.classList.toggle('on', x.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('.tabpage').forEach(function (x) {
      x.classList.toggle('on', x.id === 'page-' + tab);
    });
    var sp = document.getElementById('sidepanel');
    if (sp) {
      sp.classList.toggle('wide', WIDE_TABS.indexOf(tab) !== -1);
      sp.classList.add('open');
    }
  }

  function clearSpotlight() {
    if (spotlit) spotlit.classList.remove('sc-tour-spotlight');
    spotlit = null;
  }
  function spotlight(sel) {
    clearSpotlight();
    var el = document.querySelector(sel);
    if (!el) return;
    el.classList.add('sc-tour-spotlight');
    spotlit = el;
    try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { /* old browsers */ }
  }

  function renderDots() {
    var html = '';
    for (var i = 0; i < STEPS.length; i++) {
      html += '<span class="sc-tour-dot' + (i === step ? ' on' : '') + '"></span>';
    }
    dotsEl.innerHTML = html;
  }
  function showStep(i) {
    step = i;
    var s = STEPS[i];
    if (s.tab) openTabVia(s.tab);
    lineEl.textContent = s.line;
    backBtn.disabled = (i === 0);
    nextBtn.textContent = (i === STEPS.length - 1) ? '🎉 Blast off!' : 'Next ▶';
    renderDots();
    /* Let the panel open before ringing the control. */
    setTimeout(function () { if (open) spotlight(s.sel); }, 150);
  }
  function start() {
    if (open || !kidsOn()) return;
    open = true;
    card.classList.add('open');
    showStep(0);
  }
  function close(mark) {
    if (!open) return;
    open = false;
    card.classList.remove('open');
    clearSpotlight();
    if (mark) markSeen();
  }

  function buildCard() {
    card = document.createElement('div');
    card.id = 'sc-stella-tour';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Tour with Stella Reyes');
    card.innerHTML =
      '<img class="sc-tour-portrait" alt="Stella Reyes, your Space Center guide" />' +
      '<div class="sc-tour-body">' +
        '<div class="sc-tour-name">🚀 Stella Reyes — your Mission Control guide</div>' +
        '<p class="sc-tour-line"></p>' +
        '<div class="sc-tour-dots"></div>' +
        '<div class="trow sc-tour-actions">' +
          '<button class="tbtn" type="button" data-sc-back>◀ Back</button>' +
          '<button class="tbtn" type="button" data-sc-next>Next ▶</button>' +
          '<button class="tbtn" type="button" data-sc-skip>⏹ Skip tour</button>' +
        '</div>' +
      '</div>' +
      '<button class="sc-tour-close" type="button" aria-label="Close tour">×</button>';
    document.body.appendChild(card);
    portraitEl = card.querySelector('.sc-tour-portrait');
    lineEl = card.querySelector('.sc-tour-line');
    dotsEl = card.querySelector('.sc-tour-dots');
    nextBtn = card.querySelector('[data-sc-next]');
    backBtn = card.querySelector('[data-sc-back]');
    card.querySelector('[data-sc-skip]').addEventListener('click', function () { close(true); });
    card.querySelector('.sc-tour-close').addEventListener('click', function () { close(true); });
    backBtn.addEventListener('click', function () { if (step > 0) showStep(step - 1); });
    nextBtn.addEventListener('click', function () {
      if (step >= STEPS.length - 1) close(true);
      else showStep(step + 1);
    });
    document.addEventListener('keydown', function (e) {
      if (open && (e.key === 'Escape' || e.key === 'Esc')) close(true);
    });
    loadPortrait();
  }
  function buildButton() {
    var topright = document.querySelector('#topbar .topright');
    if (!topright) return;
    tourBtn = document.createElement('button');
    tourBtn.id = 'sc-stella-tour-btn';
    tourBtn.type = 'button';
    tourBtn.textContent = '🚀 Tour with Stella';
    tourBtn.title = 'Take the guided tour with Stella Reyes';
    tourBtn.addEventListener('click', function () { start(); });
    var back = document.getElementById('backbtn');
    if (back && back.parentNode === topright) topright.insertBefore(tourBtn, back);
    else topright.appendChild(tourBtn);
    if (!seen()) tourBtn.classList.add('sc-tour-nudge');
  }

  function loadingHidden() {
    var l = document.getElementById('loading');
    return !l || l.style.display === 'none' || l.offsetParent === null;
  }
  function maybeAutoShow() {
    if (!kidsOn() || seen() || open) return;
    var tries = 0;
    (function wait() {
      if (open || !kidsOn() || seen()) return;
      if (loadingHidden()) {
        setTimeout(function () { if (!open && kidsOn() && !seen()) start(); }, 900);
        return;
      }
      if (++tries < 120) setTimeout(wait, 250);
    })();
  }

  buildCard();
  buildButton();
  maybeAutoShow();
  if (window.MutationObserver) {
    new MutationObserver(function () {
      if (kidsOn()) maybeAutoShow();
      else close(false); /* left Kids Mode mid-tour: hide, but don't mark seen */
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-kids-mode'] });
  }
})();
