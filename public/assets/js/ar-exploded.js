/* Space Center AR — ar-exploded.js
   Fun pack: EXPLODED VIEW ("take it apart without breaking it").
   Loads as <script type="module"> AFTER ar-placement.js.

   - Exposes window.ARFun.explode = { toggle(), explode(entry), collapse(), isExploded() }
   - Acts on the last-tapped placed model (window.ARPlacement.lastTapped()).
     The picker has a "💥 Explode" button wired to toggle().
   - Explode: the model's top-level meshes animate outward from its center
     over ~0.7 s, each with a floating label. Tap a part (or its row in the
     parts sheet) for a one-line kid-safe fact (~age 8). "Collapse" restores.
   - Parts dictionary below holds REAL part names + facts for the 7 library
     models. Kid-uploaded models without entries get graceful numbered
     callouts ("Part 1", "Part 2", …).
   - Plain ES module. No prompt()/alert()/confirm(). Kid-safe copy.
   - Animation + label projection run inside a wrapped ARPlacement.onFrame
     (call-through — chains fine with the orbit/photo wrappers). */

import * as THREE from 'three';

function B() { return window.__scB || null; }
function AP() { return window.ARPlacement || null; }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function toast(msg) { var b = B(); if (b && b.toast) b.toast(msg); }
function arActive() { var b = B(); return !!(b && b.ar && b.ar.isActive && b.ar.isActive()); }

/* ---------------- real parts dictionary ----------------
   keys: matched as case-insensitive substrings of mesh names.
   Every fact is one line at ~age-8 reading level. */
var UNKNOWN_FACT = 'This piece is part of the model — every piece has a job!';

var PARTS = {
  iss: [
    { keys: ['solar', 'array', 'wing', 'panel'], name: 'Solar arrays', fact: 'These giant wings drink sunlight and turn it into electricity for the whole station!' },
    { keys: ['truss', 'backbone', 'beam', 'segment'], name: 'Integrated truss', fact: 'The station\'s backbone — a long beam that holds everything together.' },
    { keys: ['destiny', 'lab'], name: 'Destiny lab', fact: 'America\'s science lab in space, where astronauts run experiments.' },
    { keys: ['cupola'], name: 'Cupola', fact: 'The window dome with the best view ever — seven windows looking down at Earth!' },
    { keys: ['canadarm', 'arm', 'robot'], name: 'Canadarm2', fact: 'A robot arm that catches visiting spaceships and helps astronauts on spacewalks.' },
    { keys: ['zvezda', 'service'], name: 'Zvezda module', fact: 'The Russian module where the crew sleeps and eats — the station\'s living room.' },
    { keys: ['unity', 'node'], name: 'Unity node', fact: 'The hallway that connects the American modules together.' },
    { keys: ['radiator'], name: 'Radiators', fact: 'Giant panels that dump extra heat into space so the station doesn\'t overheat.' }
  ],
  hubble: [
    { keys: ['mirror', 'primary'], name: 'Primary mirror', fact: 'A mirror as wide as a grown-up is tall — it catches light from faraway galaxies!' },
    { keys: ['solar', 'array', 'wing', 'panel'], name: 'Solar arrays', fact: 'Hubble\'s power wings, always turned to face the Sun.' },
    { keys: ['aperture', 'door', 'cover'], name: 'Aperture door', fact: 'The front door that opens so starlight can come in — it shuts to stay safe.' },
    { keys: ['wfc3', 'wide field', 'camera'], name: 'Wide Field Camera 3', fact: 'Hubble\'s main camera — it has taken over a million pictures of space!' },
    { keys: ['fgs', 'guidance', 'sensor'], name: 'Fine Guidance Sensors', fact: 'Super-steady pointers that keep Hubble locked onto its target.' },
    { keys: ['antenna', 'dish'], name: 'High-gain antenna', fact: 'The big dish that beams Hubble\'s pictures back down to Earth.' }
  ],
  jwst: [
    { keys: ['mirror', 'segment', 'hex', 'gold'], name: 'Gold mirror segments', fact: '18 golden hexagons that unfold like a flower to catch the faintest light ever!' },
    { keys: ['sunshield', 'shield', 'kapton'], name: 'Sunshield', fact: 'A tennis-court-sized sunscreen with 5 layers that keeps the telescope super cold.' },
    { keys: ['secondary'], name: 'Secondary mirror', fact: 'A smaller mirror that bounces the caught light into the science cameras.' },
    { keys: ['bus', 'spacecraft'], name: 'Spacecraft bus', fact: 'The part that holds the computers, steering, and radios — the telescope\'s brain.' },
    { keys: ['solar', 'array', 'wing', 'panel'], name: 'Solar array', fact: 'One power wing that keeps the whole observatory running.' }
  ],
  chandra: [
    { keys: ['mirror', 'hra', 'optic'], name: 'X-ray mirrors', fact: 'Special curved mirrors that focus X-rays — light our eyes can\'t see!' },
    { keys: ['solar', 'array', 'wing', 'panel'], name: 'Solar arrays', fact: 'Power wings that keep Chandra charged up.' },
    { keys: ['hrc', 'camera', 'acis', 'detector'], name: 'Science cameras', fact: 'Takes super-sharp pictures of black holes and exploded stars.' },
    { keys: ['antenna', 'dish'], name: 'Antenna', fact: 'Sends Chandra\'s X-ray pictures home to Earth.' }
  ],
  fermi: [
    { keys: ['lat', 'telescope', 'tracker'], name: 'Large Area Telescope', fact: 'Fermi\'s main eye — it spots the most powerful light in the universe!' },
    { keys: ['gbm', 'burst', 'monitor'], name: 'Burst monitor', fact: 'Listens for gamma-ray bursts — the biggest explosions in space!' },
    { keys: ['solar', 'array', 'wing', 'panel'], name: 'Solar arrays', fact: 'Two power wings that keep Fermi hunting gamma rays.' },
    { keys: ['bus', 'spacecraft'], name: 'Spacecraft bus', fact: 'Holds the computers and radios that run the whole mission.' }
  ],
  aqua: [
    { keys: ['modis'], name: 'MODIS', fact: 'A camera that photographs all of Earth\'s surface every 1–2 days!' },
    { keys: ['airs'], name: 'AIRS', fact: 'Sniffs the air to measure temperature and water vapor.' },
    { keys: ['solar', 'array', 'wing', 'panel'], name: 'Solar array', fact: 'One big wing that powers Aqua\'s Earth-watching tools.' },
    { keys: ['amsr', 'antenna', 'dish'], name: 'AMSR-E antenna', fact: 'A spinning dish that measures rain, ice, and ocean winds.' }
  ],
  terra: [
    { keys: ['modis'], name: 'MODIS', fact: 'Maps Earth\'s land, oceans, and clouds every single day!' },
    { keys: ['misr'], name: 'MISR', fact: 'Nine cameras looking at clouds from nine angles at once.' },
    { keys: ['aster'], name: 'ASTER', fact: 'Makes detailed 3D maps of mountains and volcanoes.' },
    { keys: ['solar', 'array', 'wing', 'panel'], name: 'Solar array', fact: 'Terra\'s power wing, drinking sunlight high above Earth.' }
  ]
};

function modelKey(entry) {
  var m = (entry && entry.model) || {};
  var hay = ((m.id || '') + ' ' + (m.name || '')).toLowerCase();
  for (var k in PARTS) {
    if (PARTS.hasOwnProperty(k) && hay.indexOf(k) >= 0) return k;
  }
  return null;
}
function partInfo(modelKeyName, meshName, n) {
  var nm = String(meshName || '').toLowerCase();
  var dict = modelKeyName && PARTS[modelKeyName];
  if (dict) {
    for (var i = 0; i < dict.length; i++) {
      var d = dict[i];
      for (var j = 0; j < d.keys.length; j++) {
        if (d.keys[j] && nm.indexOf(d.keys[j]) >= 0) return { name: d.name, fact: d.fact };
      }
    }
  }
  return { name: 'Part ' + n, fact: UNKNOWN_FACT };
}

/* ---------------- state ---------------- */
var S = {
  entry: null,        // the exploded placement entry
  parts: [],          // [{obj, from, to, localCenter, info, labelEl}]
  tweens: [],         // active position tweens
  sheetEl: null,
  exploded: false,
  tapDown: null
};
var MAX_LABELS = 10;
var TWEEN_MS = 700;

function syncExplodeBtn() {
  var btn = document.getElementById('ar-fun-explode');
  if (btn) btn.textContent = S.exploded ? '💥 Collapse' : '💥 Explode';
}

/* ---------------- part discovery ----------------
   The placed group is usually wrapper→(inner)→glbRoot. Walk down
   single-child Group chains, then take the node's Mesh/Group children. */
function findParts(group) {
  var node = group;
  var guard = 0;
  while (guard++ < 8 && node && node.children && node.children.length === 1 &&
         node.children[0].type === 'Group' && node.children[0].children.length) {
    node = node.children[0];
  }
  if (!node || !node.children) return { node: group, parts: [] };
  var parts = [];
  for (var i = 0; i < node.children.length; i++) {
    var c = node.children[i];
    if (c.type === 'Mesh' || c.type === 'Group') parts.push(c);
  }
  if (!parts.length && (node.type === 'Mesh')) parts = [node];
  return { node: node, parts: parts };
}

/* ---------------- explode / collapse ---------------- */
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function explode(entry) {
  if (!entry || !entry.group) return false;
  collapse(true); // silent reset if something else was open
  var found = findParts(entry.group);
  var node = found.node, parts = found.parts;
  if (!parts.length) { toast('Nothing to take apart on this one!'); return false; }
  node.updateWorldMatrix(true, true);
  var box = new THREE.Box3().setFromObject(node);
  var size = new THREE.Vector3(); box.getSize(size);
  var ctr = new THREE.Vector3(); box.getCenter(ctr);
  var ws = new THREE.Vector3(); node.getWorldScale(ws);
  var localMax = (Math.max(size.x, size.y, size.z) || 1) / (ws.x || 1);
  var spread = 0.55 * localMax;
  var key = modelKey(entry);
  var n = 0;
  var now = performance.now();
  for (var i = 0; i < parts.length; i++) {
    (function (obj, idx) {
      var pb = new THREE.Box3().setFromObject(obj);
      var pcWorld = pb.getCenter(new THREE.Vector3());
      var pc = pcWorld.clone(); node.worldToLocal(pc);
      var nc = ctr.clone(); node.worldToLocal(nc);
      var dir = pc.clone().sub(nc);
      if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
      dir.normalize();
      var from = obj.position.clone();
      var to = from.clone().addScaledVector(dir, spread);
      // center in the PART's own local frame — labels track it as it flies out
      var pcObj = obj.worldToLocal(pcWorld.clone());
      n++;
      var info = partInfo(key, obj.name, n);
      S.parts.push({ obj: obj, from: from, to: to, localCenter: pcObj, info: info, labelEl: null });
      S.tweens.push({ obj: obj, from: from, to: to, t0: now + idx * 40, dur: TWEEN_MS });
    })(parts[i], i);
  }
  S.entry = entry;
  S.exploded = true;
  buildLabels();
  buildSheet();
  attachTap();
  syncExplodeBtn();
  toast('Exploded! Tap a part to learn its job 💥');
  return true;
}

function collapse(silent) {
  detachTap();
  clearLabels();
  clearSheet();
  // snap parts home instantly (collapse is a reset, not a show)
  for (var i = 0; i < S.parts.length; i++) {
    try { S.parts[i].obj.position.copy(S.parts[i].from); } catch (e) {}
  }
  S.parts = []; S.tweens = []; S.entry = null; S.exploded = false;
  syncExplodeBtn();
  if (!silent) toast('Back together!');
}

function isExploded() { return S.exploded; }

function toggle() {
  if (S.exploded) { collapse(false); return; }
  var ap = AP();
  var entry = ap && typeof ap.lastTapped === 'function' ? ap.lastTapped() : null;
  if (!entry || !entry.group || entry.kind !== 'model') {
    toast('Tap a satellite first, then hit 💥 Explode');
    return;
  }
  if (!arActive()) { toast('Start AR first, then explode a model 💥'); return; }
  explode(entry);
}

/* ---------------- labels (projected each frame) ---------------- */
function buildLabels() {
  clearLabels();
  var n = Math.min(S.parts.length, MAX_LABELS);
  for (var i = 0; i < n; i++) {
    (function (p) {
      var d = document.createElement('div');
      d.className = 'hud';
      d.style.cssText = [
        'position:fixed', 'z-index:75', 'display:none', 'pointer-events:none',
        'background:rgba(3,12,24,.88)', 'border:1px solid rgba(0,229,255,.5)',
        'border-radius:999px', 'padding:3px 9px', 'color:#eaffff',
        'font-size:.62rem', 'font-weight:700', 'white-space:nowrap',
        'transform:translate(-50%,-50%)'
      ].join(';');
      d.textContent = p.info.name;
      document.body.appendChild(d);
      p.labelEl = d;
    })(S.parts[i]);
  }
}
function clearLabels() {
  for (var i = 0; i < S.parts.length; i++) {
    var el = S.parts[i].labelEl;
    if (el && el.parentNode) { try { el.parentNode.removeChild(el); } catch (e) {} }
    S.parts[i].labelEl = null;
  }
}
var _pv = new THREE.Vector3();
function updateLabels() {
  var b = B();
  if (!b || !b.camera || !b.renderer) return;
  var rect = b.renderer.domElement.getBoundingClientRect();
  for (var i = 0; i < S.parts.length; i++) {
    (function (p) {
      var el = p.labelEl;
      if (!el) return;
      _pv.copy(p.localCenter);
      p.obj.localToWorld(_pv);
      _pv.project(b.camera);
      if (_pv.z > 1 || _pv.z < -1) { el.style.display = 'none'; return; }
      var x = (_pv.x * 0.5 + 0.5) * rect.width + rect.left;
      var y = (-_pv.y * 0.5 + 0.5) * rect.height + rect.top;
      el.style.display = 'block';
      el.style.left = x.toFixed(1) + 'px';
      el.style.top = y.toFixed(1) + 'px';
    })(S.parts[i]);
  }
}

/* ---------------- parts sheet ---------------- */
function buildSheet() {
  clearSheet();
  var s = document.createElement('div');
  s.id = 'ar-explode-sheet';
  s.className = 'hud';
  s.setAttribute('role', 'dialog');
  s.setAttribute('aria-label', 'Model parts');
  s.style.cssText = [
    'position:fixed', 'left:10px', 'right:10px', 'bottom:92px', 'z-index:74',
    'display:block', 'background:rgba(3,12,24,.96)', 'border:1px solid rgba(0,229,255,.45)',
    'border-radius:16px', 'padding:12px', 'box-shadow:0 8px 40px rgba(0,0,0,.6)',
    'max-height:44vh', 'overflow-y:auto', 'color:#eaffff'
  ].join(';');
  var name = (S.entry && S.entry.model && S.entry.model.name) || 'model';
  var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
    '<div style="font-weight:800;font-size:.9rem">💥 ' + esc(name) + ' — take it apart!</div>' +
    '<button id="ar-explode-collapse" class="tbtn" style="padding:6px 12px">Collapse</button></div>' +
    '<div style="font-size:.72rem;color:#8fd8ef;margin-bottom:8px">Tap a part below — or tap it on the model — to learn its job:</div>' +
    '<div id="ar-explode-rows"></div>' +
    '<div id="ar-explode-fact" style="font-size:.82rem;color:#ffe08a;margin-top:8px;min-height:1.2em"></div>';
  s.innerHTML = html;
  document.body.appendChild(s);
  S.sheetEl = s;
  var rows = document.getElementById('ar-explode-rows');
  S.parts.forEach(function (p, idx) {
    var r = document.createElement('button');
    r.className = 'tbtn';
    r.style.cssText = 'display:block;width:100%;text-align:left;margin-bottom:6px;padding:8px 10px;font-size:.8rem';
    r.textContent = (idx + 1) + '. ' + p.info.name;
    r.onclick = function () { showFact(p); };
    rows.appendChild(r);
  });
  document.getElementById('ar-explode-collapse').onclick = function () { collapse(false); };
}
function clearSheet() {
  if (S.sheetEl && S.sheetEl.parentNode) { try { S.sheetEl.parentNode.removeChild(S.sheetEl); } catch (e) {} }
  S.sheetEl = null;
}
function showFact(p) {
  var f = document.getElementById('ar-explode-fact');
  if (f) f.textContent = '🔧 ' + p.info.name + ': ' + p.info.fact;
  else toast(p.info.name + ': ' + p.info.fact);
}

/* ---------------- tap-a-part in 3D ---------------- */
var raycaster = new THREE.Raycaster();
function canvas() { var b = B(); return b && b.renderer ? b.renderer.domElement : null; }
function onTapDown(e) { S.tapDown = { x: e.clientX, y: e.clientY, t: performance.now() }; }
function onTapUp(e) {
  var d = S.tapDown; S.tapDown = null;
  if (!d || !S.exploded) return;
  var moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
  if (moved > 10 || performance.now() - d.t > 400) return;
  var b = B();
  if (!b || !b.camera) return;
  // ignore taps that land on HUD UI
  var els = document.querySelectorAll('.hud');
  for (var i = 0; i < els.length; i++) {
    var r = els[i].getBoundingClientRect();
    if (r.width > 0 && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return;
  }
  var rect = b.renderer.domElement.getBoundingClientRect();
  var nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  var ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera({ x: nx, y: ny }, b.camera);
  var objs = S.parts.map(function (p) { return p.obj; });
  var hits = raycaster.intersectObjects(objs, true);
  if (!hits.length) return;
  var hit = hits[0].object, found = null;
  for (var j = 0; j < S.parts.length; j++) {
    var o = hit;
    while (o) { if (o === S.parts[j].obj) { found = S.parts[j]; break; } o = o.parent; }
    if (found) break;
  }
  if (found) showFact(found);
}
function attachTap() {
  var c = canvas();
  if (!c || c._arExplodeTap) return;
  c._arExplodeTap = true;
  c.addEventListener('pointerdown', onTapDown);
  c.addEventListener('pointerup', onTapUp);
}
function detachTap() {
  var c = canvas();
  if (!c || !c._arExplodeTap) return;
  c._arExplodeTap = false;
  c.removeEventListener('pointerdown', onTapDown);
  c.removeEventListener('pointerup', onTapUp);
}

/* ---------------- frame hook: tweens + labels ---------------- */
function frameTick() {
  // exploded model vanished (Clear room / session reset) — stand down quietly
  if (S.exploded && S.entry && (!S.entry.group || !S.entry.group.parent)) { collapse(true); return; }
  if (!S.exploded && !S.tweens.length) return;
  var now = performance.now();
  var keep = [];
  for (var i = 0; i < S.tweens.length; i++) {
    (function (tw) {
      var t = (now - tw.t0) / tw.dur;
      if (t < 0) { keep.push(tw); return; }
      if (t >= 1) { tw.obj.position.copy(tw.to); return; }
      var k = easeOutCubic(t);
      tw.obj.position.copy(tw.from).lerp(tw.to, k);
      keep.push(tw);
    })(S.tweens[i]);
  }
  S.tweens = keep;
  if (S.exploded) updateLabels();
}

/* ---------------- public API + install ---------------- */
function cleanup() {
  collapse(true);
  var btn = document.getElementById('ar-fun-explode');
  if (btn) btn.textContent = '💥 Explode';
}

window.ARFun = window.ARFun || {};
window.ARFun.explode = { toggle: toggle, explode: explode, collapse: collapse, isExploded: isExploded };

(function install() {
  var ap = AP();
  if (!ap || typeof ap.onFrame !== 'function' || typeof ap.onSessionEnd !== 'function') {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var a2 = AP();
      if ((a2 && typeof a2.onFrame === 'function' && typeof a2.onSessionEnd === 'function') || tries >= 20) {
        clearInterval(t);
        if (a2) wrapFns(a2);
      }
    }, 500);
    return;
  }
  wrapFns(ap);
  function wrapFns(a) {
    var _onFrame = a.onFrame;
    a.onFrame = function (frame) {
      if (typeof _onFrame === 'function') _onFrame(frame);
      try { frameTick(); } catch (e) {}
    };
    var _onEnd = a.onSessionEnd;
    a.onSessionEnd = function () {
      try { cleanup(); } catch (e) {}
      if (typeof _onEnd === 'function') _onEnd.apply(a, arguments);
    };
  }
})();
