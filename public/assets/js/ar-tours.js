/* Space Center AR — ar-tours.js
   Fun pack: NARRATED TOURS ("your pocket docent for the Space Center").
   Loads AFTER ar-placement.js as <script type="module">.

   - Exposes window.ARFun.tours = { open(), close(), start('iss'|'hubble'|'jwst'), stop(), next() }
   - Guided voice tours around a PLACED AR model: the ISS, Hubble, or the
     James Webb Space Telescope. Narration is synthesized on-device with the
     Web Speech API (window.speechSynthesis) — no audio assets, works offline.
   - Tour scripts are plain DATA below (TOURS): each stop has a title, a list
     of mesh-name match terms, and one kid-safe line (age ~8 reading level).
     Facts verified against NASA material, Oct 2026.
   - Each stop HIGHLIGHTS the relevant part: matched meshes get their emissive
     pulsed in the wrapped XR frame. Meshes are found by traversing the placed
     model's group and matching mesh.name (case-insensitive contains), with a
     graceful fallback to the whole model when names don't match.
   - Advance: tap the "Next" button, or auto-advance when the utterance ends
     (onend). The Stop button cancels speech. Captions always show, so tours
     still work on devices without speechSynthesis.
   - Voice tuning: rate 0.95, pitch 1.1, prefer an en-US voice, else any
     English voice, else the device default.
   - Kid-safe: no prompt()/alert()/confirm() anywhere; plain tap UI only.
   - Add Interactive Studio / NEXUS branding. Never JARVIS.
*/

function B() { return window.__scB || null; }
function toast(msg) { var b = B(); if (b && b.toast) b.toast(msg); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ---------------- tour scripts (DATA) ----------------
   match: mesh-name fragments (lowercase contains). Empty array => whole model. */
var TOURS = {
  iss: {
    name: 'ISS Tour', short: 'ISS', emoji: '🛰️',
    alias: ['iss'],
    blurb: 'The International Space Station',
    stops: [
      { title: 'Welcome aboard!', match: [],
        line: 'Welcome to the International Space Station! It is a giant science lab, as long as a football field, flying 250 miles above your head.' },
      { title: 'The Cupola — the world\'s best window', match: ['cupola'],
        line: 'This is the Cupola. It has seven big windows, so astronauts get the best view in space — sunrises, storms, and Earth spinning by below!' },
      { title: 'Destiny lab', match: ['destiny', 'lab', 'laboratory'],
        line: 'This is the Destiny lab, America\'s science room in space. Crews grow crystals, study flames, and learn how our bodies work without gravity!' },
      { title: 'Canadarm2', match: ['canadarm', 'arm', 'ssrms'],
        line: 'That is Canadarm2, Canada\'s giant robot arm! It is 58 feet long, and it catches visiting spaceships and gently helps them dock.' },
      { title: 'Solar arrays', match: ['solar', 'array', 'panel'],
        line: 'Those big blue wings are solar panels. They drink up sunlight and turn it into electricity to power the whole station!' },
      { title: 'The truss backbone', match: ['truss', 'girder', 'beam'],
        line: 'That long spine is the truss. It holds everything together — the labs, the panels, and the robot arm all hang on it.' },
      { title: 'The crew', match: [],
        line: 'Six or seven astronauts usually live here, from countries all around the world. They exercise two hours a day to stay strong, and the station laps Earth about every 90 minutes. Wave at it sometime!' }
    ]
  },
  hubble: {
    name: 'Hubble Tour', short: 'Hubble', emoji: '🔭',
    alias: ['hubble', 'hst'],
    blurb: 'The Hubble Space Telescope',
    stops: [
      { title: 'Meet Hubble!', match: [],
        line: 'Meet the Hubble Space Telescope! It launched in 1990 and has been taking amazing pictures of the universe for more than 35 years.' },
      { title: 'The 8-foot mirror', match: ['mirror', 'optics', 'primary'],
        line: 'Hubble\'s eye is a mirror 8 feet across — about as tall as a door! It is polished so smoothly that you cannot feel a single bump on it.' },
      { title: 'Wide Field Camera 3', match: ['wfc', 'wide field', 'camera', 'aft shroud'],
        line: 'Its camera is called Wide Field Camera 3. It sees light our eyes cannot see, and it has spotted galaxies 13 billion light-years away!' },
      { title: 'Solar panels', match: ['solar', 'panel', 'array'],
        line: 'These solar panels make electricity from sunlight, giving Hubble all the power it needs to explore the universe.' },
      { title: 'Five house calls', match: ['antenna', 'dish', 'aperture', 'door', 'gyroscope', 'fgs'],
        line: 'Astronauts visited Hubble five times to give it new parts and sharper eyes. No other telescope has ever had house calls!' },
      { title: 'Still discovering', match: [],
        line: 'Hubble helped us learn that the universe is getting bigger all the time — and it is still working today. Keep looking up!' }
    ]
  },
  jwst: {
    name: 'Webb Tour', short: 'Webb', emoji: '🌟',
    alias: ['jwst', 'webb'],
    blurb: 'The James Webb Space Telescope',
    stops: [
      { title: 'Meet Webb!', match: [],
        line: 'Meet the James Webb Space Telescope — the biggest space telescope ever built! It launched on Christmas Day, 2021.' },
      { title: 'The gold mirrors', match: ['mirror', 'segment', 'primary', 'ote'],
        line: 'Webb\'s giant eye is made of 18 gold-covered hexagons! The gold layer is thinner than a soap bubble, but it catches the faintest heat-light from the first stars.' },
      { title: 'The sunshield', match: ['sunshield', 'sun shield', 'shield', 'parasol', 'kite'],
        line: 'That shiny kite shape is the sunshield — as big as a tennis court! It keeps the telescope colder than anywhere on Earth, so its cameras can work.' },
      { title: 'Parked a million miles away', match: ['bus', 'spacecraft', 'antenna', 'dish', 'secondary', 'tripod'],
        line: 'Webb does not orbit Earth. It parks a million miles away in a spot called L2, where the Sun and Earth always stay lined up behind it.' },
      { title: 'Heat vision', match: ['mirror', 'segment', 'primary'],
        line: 'Webb does not take normal photos — it sees heat light! That lets it peek through dusty clouds and watch baby stars being born.' },
      { title: 'Thousands of galaxies', match: [],
        line: 'Webb\'s very first photo showed thousands of galaxies in a patch of sky smaller than a grain of sand held at arm\'s length! New discoveries happen every single day.' }
    ]
  }
};

/* ---------------- state ---------------- */
var S = {
  touring: false,
  tour: null,       // active TOURS entry
  tourId: null,
  entry: null,      // placed-model entry being toured
  idx: -1,
  token: 0,         // stale speech-callback guard
  panelMode: 'picker' // 'picker' | 'tour'
};

/* ---------------- speech ---------------- */
var voices = [];
function speechOK() {
  return ('speechSynthesis' in window) && ('SpeechSynthesisUtterance' in window);
}
function loadVoices() {
  try { voices = window.speechSynthesis.getVoices() || []; } catch (e) { voices = []; }
}
function pickVoice() {
  var i, v;
  for (i = 0; i < voices.length; i++) { v = voices[i]; if (v.lang === 'en-US') return v; }
  for (i = 0; i < voices.length; i++) { v = voices[i]; if (v.lang && v.lang.indexOf('en-US') === 0) return v; }
  for (i = 0; i < voices.length; i++) { v = voices[i]; if (v.lang && v.lang.indexOf('en') === 0) return v; }
  return null; // device default
}
/* Returns true when a line was actually queued for speech, false in
   captions-only mode (the callback is NOT called in that mode). */
function speakLine(text, onDone) {
  if (!speechOK()) return false;
  try {
    var ss = window.speechSynthesis;
    ss.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1.1;
    u.volume = 1.0;
    u.lang = 'en-US';
    var v = pickVoice();
    if (v) u.voice = v;
    var done = false;
    function fin() { if (!done) { done = true; if (onDone) onDone(); } }
    u.onend = fin;
    u.onerror = fin; // interrupted voices still advance the tour gracefully
    ss.speak(u);
    return true;
  } catch (e) { return false; }
}

/* ---------------- placed-model lookup ---------------- */
function entries() {
  var AP = window.ARPlacement;
  return (AP && typeof AP.placedEntries === 'function') ? AP.placedEntries() : [];
}
/* Find the placed model for a tour: name/id match first, then the most
   recently tapped model, then any placed model. */
function findTourEntry(tourId) {
  var T = TOURS[tourId];
  var list = entries();
  var i, e, m, hay, a, j;
  if (T) {
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (e.kind !== 'model' || !e.group) continue;
      m = e.model || {};
      hay = ((m.name || '') + ' ' + (m.id || '')).toLowerCase();
      for (j = 0; j < T.alias.length; j++) {
        a = T.alias[j];
        if (a && hay.indexOf(a) !== -1) return e;
      }
    }
  }
  var AP = window.ARPlacement;
  if (AP && typeof AP.lastTapped === 'function') {
    var t = AP.lastTapped();
    if (t && t.kind === 'model' && t.group) return t;
  }
  for (i = 0; i < list.length; i++) {
    if (list[i].kind === 'model' && list[i].group) return list[i];
  }
  return null;
}

/* ---------------- part highlighting (emissive pulse) ---------------- */
var HI = { meshes: [], active: false };
function findHighlightMeshes(group, terms) {
  var out = [];
  var want = [];
  for (var i = 0; i < terms.length; i++) {
    if (terms[i]) want.push(String(terms[i]).toLowerCase());
  }
  group.traverse(function (o) {
    if (!o.isMesh || !o.material) return;
    var n = (o.name || '').toLowerCase();
    for (var k = 0; k < want.length; k++) {
      if (n.indexOf(want[k]) !== -1) { out.push(o); return; }
    }
  });
  return out;
}
function highlightStart(group, terms) {
  highlightStop();
  var meshes = findHighlightMeshes(group, terms || []);
  if (!meshes.length) {
    // graceful fallback: names don't match — pulse the whole model
    group.traverse(function (o) { if (o.isMesh && o.material) meshes.push(o); });
  }
  meshes.forEach(function (m) {
    // clone once so sibling models sharing a material don't all glow
    if (!m.userData._tourCloned) {
      m.material = m.material.clone();
      m.userData._tourCloned = true;
    }
    var mat = m.material;
    if (!m.userData._tourEmis) {
      m.userData._tourEmis = {
        color: (mat.emissive && mat.emissive.getHex) ? mat.emissive.getHex() : 0x000000,
        intensity: (mat.emissiveIntensity != null) ? mat.emissiveIntensity : 1
      };
    }
    if (mat.emissive) mat.emissive.setHex(0x00e5ff); // NEXUS cyan
    HI.meshes.push(m);
  });
  HI.active = HI.meshes.length > 0;
}
function highlightStop() {
  HI.meshes.forEach(function (m) {
    var s = m.userData._tourEmis;
    var mat = m.material;
    if (s && mat && mat.emissive) {
      mat.emissive.setHex(s.color);
      mat.emissiveIntensity = s.intensity;
    }
  });
  HI.meshes = [];
  HI.active = false;
}
/* Runs AFTER the base onFrame (property-wrapped below), so the pulse
   never fights anchor gluing. No WebXR calls here. */
function pulseFrame() {
  if (!HI.active || !HI.meshes.length) return;
  var t = performance.now() / 1000;
  var k = 0.55 + 0.45 * Math.sin(t * 4.0);
  for (var i = 0; i < HI.meshes.length; i++) {
    var mat = HI.meshes[i].material;
    if (mat && mat.emissiveIntensity != null) mat.emissiveIntensity = 0.4 + k * 1.2;
  }
}

/* ---------------- HUD panel (DOM overlay) ---------------- */
function ensurePanel() {
  var p = document.getElementById('ar-tours-panel');
  if (p) return p;
  p = document.createElement('div');
  p.id = 'ar-tours-panel';
  p.className = 'hud'; // arTapOnUI treats .hud as UI — taps never double-fire 3D
  p.setAttribute('role', 'dialog');
  p.setAttribute('aria-label', 'Narrated space tours');
  p.style.cssText = [
    'position:fixed', 'left:10px', 'right:10px', 'bottom:92px', 'z-index:72',
    'display:none', 'background:rgba(3,12,24,.96)', 'border:1px solid rgba(0,229,255,.45)',
    'border-radius:16px', 'padding:12px 12px 10px', 'box-shadow:0 8px 40px rgba(0,0,0,.6)',
    'max-height:44vh', 'overflow-y:auto', 'backdrop-filter:blur(6px)'
  ].join(';');
  p.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
      '<div style="font-weight:800;color:#eaffff;font-size:.95rem">🎧 Narrated Tours</div>' +
      '<button id="ar-tours-close" class="tbtn" style="padding:4px 10px;font-size:.72rem">✕</button>' +
    '</div>' +
    '<div id="ar-tours-pick" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"></div>' +
    '<div id="ar-tours-caption" style="display:none;margin-top:8px;background:rgba(0,229,255,.07);' +
      'border:1px solid rgba(0,229,255,.25);border-radius:10px;padding:10px">' +
      '<div id="ar-tours-stop" style="font-weight:800;color:#aef3ff;font-size:.8rem;margin-bottom:4px"></div>' +
      '<div id="ar-tours-line" style="color:#eaffff;font-size:.85rem;line-height:1.45"></div>' +
      '<div id="ar-tours-hint" style="color:#8fd8ef;font-size:.66rem;margin-top:6px"></div>' +
    '</div>' +
    '<div id="ar-tours-controls" style="display:none;gap:8px;margin-top:10px">' +
      '<button id="ar-tours-next" class="tbtn" style="flex:1">⏭ Next stop</button>' +
      '<button id="ar-tours-stopbtn" class="tbtn" style="flex:1;opacity:.9">⏹ Stop tour</button>' +
    '</div>' +
    '<div style="margin-top:8px;font-size:.6rem;color:#5f93a8;text-align:center">' +
      'Add Interactive Studio · NEXUS — your pocket docent' +
    '</div>';
  document.body.appendChild(p);
  var cards = document.getElementById('ar-tours-pick');
  var html = '';
  ['iss', 'hubble', 'jwst'].forEach(function (id) {
    var T = TOURS[id];
    html += '<button data-tour="' + esc(id) + '" class="tbtn" style="padding:10px 6px;display:flex;' +
      'flex-direction:column;align-items:center;gap:4px;min-height:86px">' +
      '<span style="font-size:1.7rem">' + esc(T.emoji) + '</span>' +
      '<span style="font-size:.72rem;font-weight:700;color:#eaffff;line-height:1.15">' + esc(T.name) + '</span>' +
      '<span style="font-size:.62rem;color:#8fd8ef">' + esc(T.blurb) + '</span>' +
    '</button>';
  });
  cards.innerHTML = html;
  var btns = cards.querySelectorAll('[data-tour]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].onclick = function (e) { start(e.currentTarget.getAttribute('data-tour')); };
  }
  document.getElementById('ar-tours-close').onclick = function () { close(); };
  document.getElementById('ar-tours-next').onclick = function () { next(); };
  document.getElementById('ar-tours-stopbtn').onclick = function () { stop(); };
  return p;
}
function showPickerMode() {
  S.panelMode = 'picker';
  document.getElementById('ar-tours-pick').style.display = 'grid';
  document.getElementById('ar-tours-caption').style.display = 'none';
  document.getElementById('ar-tours-controls').style.display = 'none';
}
function showTourMode() {
  S.panelMode = 'tour';
  document.getElementById('ar-tours-pick').style.display = 'none';
  document.getElementById('ar-tours-caption').style.display = 'block';
  document.getElementById('ar-tours-controls').style.display = 'flex';
}
function setCaption(title, line, hint) {
  document.getElementById('ar-tours-stop').innerHTML = esc(title);
  document.getElementById('ar-tours-line').innerHTML = esc(line);
  document.getElementById('ar-tours-hint').innerHTML = esc(hint || '');
}

/* ---------------- tour engine ---------------- */
function speakStop(i) {
  var T = S.tour;
  if (!T || i >= T.stops.length) { finishTour(); return; }
  S.idx = i;
  var st = T.stops[i];
  setCaption((i + 1) + ' of ' + T.stops.length + ' · ' + st.title, st.line, '');
  highlightStart(S.entry.group, st.match);
  var my = ++S.token;
  var voiced = speakLine(st.line, function () {
    if (!S.touring || my !== S.token) return; // stale callback — ignore
    setTimeout(function () {
      if (S.touring && my === S.token) speakStop(i + 1); // auto-advance
    }, 900);
  });
  if (!voiced) {
    setCaption((i + 1) + ' of ' + T.stops.length + ' · ' + st.title, st.line,
      '🔇 No voice on this device — tap ⏭ Next stop to continue the tour.');
  }
}
function finishTour() {
  highlightStop();
  S.touring = false; S.tour = null; S.tourId = null; S.entry = null; S.idx = -1;
  S.token++;
  setCaption('🎉 Tour complete!', 'Great exploring, cadet! Pick another tour above to keep going.', '');
  showPickerMode();
  toast('🎉 Tour complete — great exploring!');
}
function isARActive() {
  var b = B();
  return !!(b && b.ar && b.ar.isActive && b.ar.isActive());
}

/* ---------------- public API ---------------- */
function open() {
  var p = ensurePanel();
  p.style.display = 'block';
  if (!S.touring) showPickerMode(); else showTourMode();
  return true;
}
function close() {
  stop();
  var p = document.getElementById('ar-tours-panel');
  if (p) p.style.display = 'none';
  return true;
}
function start(tourId) {
  var T = TOURS[tourId];
  if (!T) return false;
  if (!isARActive()) {
    toast('Start AR first, then take a narrated tour 🎧');
    return false;
  }
  var entry = findTourEntry(tourId);
  if (!entry) {
    toast('Place the ' + T.short + ' model first, then start the ' + T.name);
    return false;
  }
  if (!speechOK()) toast('No voice on this device — captions only 🎧');
  S.touring = true; S.tour = T; S.tourId = tourId; S.entry = entry; S.idx = -1;
  ensurePanel().style.display = 'block';
  showTourMode();
  toast(T.emoji + ' ' + T.name + ' — listen and watch the highlights!');
  speakStop(0);
  return true;
}
function stop() {
  S.touring = false; S.tour = null; S.tourId = null; S.entry = null; S.idx = -1;
  S.token++; // orphan any in-flight onend/onerror
  try { if (speechOK()) window.speechSynthesis.cancel(); } catch (e) {}
  highlightStop();
  var cap = document.getElementById('ar-tours-caption');
  if (cap) {
    setCaption('Tour stopped', 'Pick a tour above to start again.', '');
    cap.style.display = 'block';
    document.getElementById('ar-tours-controls').style.display = 'flex';
  }
  return true;
}
function next() {
  if (!S.touring || !S.tour) return false;
  if (S.idx + 1 >= S.tour.stops.length) { finishTour(); return true; }
  speakStop(S.idx + 1); // speakLine cancels the current utterance first
  return true;
}

/* ---------------- install (guarded startup) ---------------- */
function tourSessionEnd() {
  // XR session ended: stop narration + highlights, hide the panel
  stop();
  var p = document.getElementById('ar-tours-panel');
  if (p) p.style.display = 'none';
}
function install() {
  var AP = window.ARPlacement;
  if (!AP || typeof AP.onFrame !== 'function' ||
      typeof AP.onSessionEnd !== 'function') {
    return false;
  }
  // property wrapping — space-center-main.js looks the props up per call
  var _onFrame = AP.onFrame.bind(AP);
  AP.onFrame = function (frame) { _onFrame(frame); pulseFrame(frame); };
  var _onEnd = AP.onSessionEnd.bind(AP);
  AP.onSessionEnd = function () { _onEnd(); tourSessionEnd(); };

  window.ARFun = window.ARFun || {};
  window.ARFun.tours = {
    open: open,
    close: close,
    start: start,
    stop: stop,
    next: next
  };

  if (speechOK()) {
    loadVoices();
    try {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    } catch (e) {
      try { window.speechSynthesis.onvoiceschanged = loadVoices; } catch (x) {}
    }
  }
  return true;
}

if (!install()) {
  var tries = 0;
  var bootTimer = setInterval(function () {
    tries++;
    if (install() || tries >= 20) clearInterval(bootTimer);
  }, 500);
}
