/* Space Center AR — ar-placement.js
   What-to-place picker + persistent room placements (WebXR anchors).
   - AR session start: restores saved placements (persistent anchors via
     anchor.requestPersistentHandle()/session.restorePersistentAnchor(),
     localStorage position fallback), then shows the picker.
   - Picker: big kid-simple cards — Earth + model library (GET /api/models).
     Pick one, tap a surface at the hit-test reticle, it places + anchors + saves.
   - "Clear room" (two-tap confirm, no prompt()) removes everything.
   - Placed models: drag to spin, pinch to resize, tap for name/creator.
   Plain ES module. Own GLTFLoader — never touches the Model Lab viewer pane.
   Wires into space-center-main.js via the window.__scB.ar hooks (surgical). */

import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/addons/loaders/GLTFLoader.js';

var LS_KEY = 'sc-ar-room-v1';
var MAX_SAVED = 12;

function B() { return window.__scB || null; }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

var loader = new GLTFLoader();
var glbCache = {};
function loadGlb(url) {
  if (glbCache[url]) return glbCache[url];
  var p = new Promise(function (res, rej) {
    loader.load(url, function (gltf) { res(gltf.scene); }, undefined, rej);
  });
  glbCache[url] = p;
  p.catch(function () { delete glbCache[url]; });
  return p;
}
function normalize(group, targetSize) {
  var box = new THREE.Box3().setFromObject(group);
  var size = new THREE.Vector3(); box.getSize(size);
  var center = new THREE.Vector3(); box.getCenter(center);
  var s = targetSize / (Math.max(size.x, size.y, size.z) || 1);
  var inner = new THREE.Group(); inner.add(group);
  // Center the model on its own origin. inner.scale (below) sizes both the
  // geometry and this offset uniformly — do NOT pre-scale the offset here
  // (that would displace the model from the tap point by s^2 instead of s).
  group.position.sub(center);
  inner.scale.setScalar(s);
  return inner;
}

/* ---------- saved placements (localStorage) ---------- */
function readSaved() {
  try {
    var a = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    return Array.isArray(a) ? a : [];
  } catch (e) { return []; }
}
function writeSaved(a) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(a)); } catch (e) {}
}

/* ---------- state ---------- */
var S = {
  session: null,
  placing: false,      // a choice is pending — next 3D tap places it
  pickerOpen: false,
  choice: null,        // {type:'earth'} | {type:'model', model}
  placed: [],          // {id, kind, model, group, anchor, uuid, record}
  pendingAnchors: [],  // entries awaiting frame.createAnchor
  models: null,
  domOverlay: false,
  tapOnModel: false, tapOnModelTimer: 0,
  gesture: null,       // {root, pointers:{}, lastPinch, moved, startT}
  clearArm: 0
};
var nextId = 1;

function isARActive() {
  var b = B();
  return !!(b && b.ar && b.ar.isActive && b.ar.isActive());
}
function choiceName(c) {
  if (!c) return '';
  return c.type === 'earth' ? 'Earth' : (c.model && c.model.name) || 'model';
}

/* ---------- picker UI (DOM overlay) ---------- */
function ensurePicker() {
  var p = document.getElementById('ar-place-picker');
  if (p) return p;
  p = document.createElement('div');
  p.id = 'ar-place-picker';
  p.className = 'hud'; // arTapOnUI treats .hud as UI — taps never double-fire 3D
  p.setAttribute('role', 'dialog');
  p.setAttribute('aria-label', 'Choose what to place in your room');
  p.style.cssText = [
    'position:fixed', 'left:10px', 'right:10px', 'bottom:92px', 'z-index:70',
    'display:none', 'background:rgba(3,12,24,.96)', 'border:1px solid rgba(0,229,255,.45)',
    'border-radius:16px', 'padding:12px 12px 10px', 'box-shadow:0 8px 40px rgba(0,0,0,.6)',
    'max-height:46vh', 'overflow-y:auto', 'backdrop-filter:blur(6px)'
  ].join(';');
  p.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
      '<div style="font-weight:800;color:#eaffff;font-size:.95rem">🛸 What goes in your room?</div>' +
      '<div id="ar-picker-note" style="font-size:.68rem;color:#8fd8ef"></div>' +
    '</div>' +
    '<div id="ar-picker-cards" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"></div>' +
    '<div style="display:flex;gap:8px;margin-top:10px">' +
      '<button id="ar-picker-done" class="tbtn" style="flex:1">✓ Done</button>' +
      '<button id="ar-picker-clear" class="tbtn" style="flex:1;opacity:.85">🧹 Clear room</button>' +
    '</div>';
  document.body.appendChild(p);
  document.getElementById('ar-picker-done').onclick = function () {
    hidePicker();
    setPlacing(false);
    var b = B();
    if (b && b.toast) b.toast('Tap satellites to inspect · open 🛸 to place more');
  };
  document.getElementById('ar-picker-clear').onclick = function () {
    var btn = document.getElementById('ar-picker-clear');
    var now = Date.now();
    if (now - S.clearArm < 4000) {
      S.clearArm = 0;
      btn.textContent = '🧹 Clear room';
      clearRoom();
    } else {
      S.clearArm = now;
      btn.textContent = 'Tap again to confirm';
      setTimeout(function () {
        if (Date.now() - S.clearArm >= 4000 && btn.isConnected) btn.textContent = '🧹 Clear room';
      }, 4100);
    }
  };
  return p;
}
function getModels() {
  if (S.models) return Promise.resolve(S.models);
  return fetch('/api/models').then(function (r) { return r.json(); }).then(function (d) {
    var list = Array.isArray(d) ? d : (d.models || []);
    S.models = list;
    return list;
  }).catch(function () { return []; });
}
function cardHtml(kind, id, title, sub) {
  return '<button data-pick="' + esc(kind) + ':' + esc(id) + '" class="tbtn" style="padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;min-height:86px">' +
    '<span style="font-size:1.7rem">' + (kind === 'earth' ? '🌍' : kind === 'telescope' ? '🔭' : '🛰️') + '</span>' +
    '<span style="font-size:.72rem;font-weight:700;color:#eaffff;line-height:1.15">' + esc(title) + '</span>' +
    (sub ? '<span style="font-size:.62rem;color:#8fd8ef">' + esc(sub) + '</span>' : '') +
  '</button>';
}
function showPicker(note) {
  if (!S.domOverlay) return; // picker needs the DOM overlay; otherwise the classic Earth flow runs
  var p = ensurePicker();
  var noteEl = document.getElementById('ar-picker-note');
  if (noteEl) noteEl.textContent = note || '';
  var cards = document.getElementById('ar-picker-cards');
  cards.innerHTML = cardHtml('earth', 'earth', 'Earth', 'our home planet');
  getModels().then(function (list) {
    var html = cardHtml('earth', 'earth', 'Earth', 'our home planet');
    list.forEach(function (m) {
      html += cardHtml(m.category || 'model', m.id, m.name || 'model',
        m.creatorHandle ? 'by ' + m.creatorHandle : '');
    });
    var c = document.getElementById('ar-picker-cards');
    if (c) {
      c.innerHTML = html;
      var btns = c.querySelectorAll('[data-pick]');
      for (var i = 0; i < btns.length; i++) {
        btns[i].onclick = onPickCard;
      }
    }
  });
  var btns0 = cards.querySelectorAll('[data-pick]');
  for (var i = 0; i < btns0.length; i++) btns0[i].onclick = onPickCard;
  p.style.display = 'block';
  S.pickerOpen = true;
}
function hidePicker() {
  var p = document.getElementById('ar-place-picker');
  if (p) p.style.display = 'none';
  S.pickerOpen = false;
}
function onPickCard(e) {
  var v = (e.currentTarget.getAttribute('data-pick') || '').split(':');
  var kind = v[0], id = v.slice(1).join(':');
  if (kind === 'earth') { requestPlace({ type: 'earth' }); return; }
  getModels().then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === id) { requestPlace({ type: 'model', model: list[i] }); return; }
    }
  });
}
function setPlacing(v) {
  S.placing = !!v;
  if (!v) S.choice = null;
  var b = B();
  if (b && b.ar && b.ar.setPlacing) b.ar.setPlacing(!!v);
}
function requestPlace(choice) {
  var b = B();
  if (!b || !b.ar || !isARActive()) {
    if (b && b.toast) b.toast('Start AR first, then place your model');
    return;
  }
  hidePicker();
  S.choice = choice;
  setPlacing(true);
  if (b.toast) b.toast('Tap a surface to place ' + choiceName(choice));
}
function promptText() {
  if (S.pickerOpen) return 'CHOOSE WHAT TO PLACE';
  if (S.placing && S.choice) return ('TAP TO PLACE ' + choiceName(S.choice)).toUpperCase().slice(0, 30);
  return null;
}
function isPlacing() { return S.placing; }

/* ---------- placement ---------- */
function positionAtReticleOrFront(obj) {
  var b = B();
  var r = b && b.ar ? b.ar.reticle() : null;
  if (r && r.visible) { obj.position.copy(r.position); return 'reticle'; }
  var cp = new THREE.Vector3(), cd = new THREE.Vector3();
  b.camera.getWorldPosition(cp); b.camera.getWorldDirection(cd);
  obj.position.copy(cp).addScaledVector(cd, 1.0);
  obj.position.y -= 0.15;
  return 'front';
}
function trackPlaced(entry) {
  entry.id = 'p' + (nextId++);
  S.placed.push(entry);
  S.pendingAnchors.push(entry); // anchor created on the next XR frame
  return entry;
}
function handleTap() {
  if (S.pickerOpen) return true;              // let the DOM picker have the tap
  if (S.placing && S.choice) { doPlace(); return true; }
  if (S.tapOnModel) { S.tapOnModel = false; return true; } // gesture toast handled it
  return false;                               // not ours — classic flow may run
}
function doPlace() {
  var b = B();
  var choice = S.choice;
  setPlacing(false);
  if (!b || !b.ar || !choice) { showPicker(); return; }
  if (choice.type === 'earth') {
    // replacing Earth: drop the old earth placement + record first (one Earth only)
    S.placed = S.placed.filter(function (e) {
      if (e.kind === 'earth') {
        if (e.anchor) { try { e.anchor.delete(); } catch (x) {} }
        return false;
      }
      return true;
    });
    writeSaved(readSaved().filter(function (r) { return r.kind !== 'earth'; }));
    b.ar.placeEarth();                        // existing Earth flow (reticle or float)
    var g = b.ar.earthObject();
    if (g) {
      trackPlaced({ kind: 'earth', group: g });
      if (b.toast) b.toast('Earth placed — it will stay in your room!');
    }
  } else if (choice.model) {
    var url = choice.model.modelUrl || choice.model.fileUrl;
    if (!url) { if (b.toast) b.toast('That model has no file yet'); showPicker(); return; }
    loadGlb(url).then(function (tpl) {
      var bb = B();
      if (!bb || !isARActive()) return;
      var inner = normalize(tpl.clone(true), 0.5); // tabletop scale
      positionAtReticleOrFront(inner);
      bb.scene.add(inner);
      trackPlaced({ kind: 'model', model: choice.model, group: inner });
      if (bb.toast) bb.toast(choice.model.name + ' placed — drag to spin, pinch to resize');
    }).catch(function () {
      var bb2 = B();
      if (bb2 && bb2.toast) bb2.toast('Could not load ' + choiceName(choice) + ' for AR');
    });
  }
  showPicker(); // place another, or Done
}

/* ---------- anchors + persistence ---------- */
function saveRecord(entry) {
  var p = entry.group.position, q = entry.group.quaternion;
  var rec = {
    uuid: entry.uuid || null,
    kind: entry.kind,
    modelId: entry.model ? entry.model.id : null,
    modelName: entry.model ? entry.model.name : (entry.kind === 'earth' ? 'Earth' : ''),
    modelUrl: entry.model ? (entry.model.modelUrl || entry.model.fileUrl) : null,
    position: [p.x, p.y, p.z],
    quaternion: [q.x, q.y, q.z, q.w],
    scale: entry.group.scale.x,
    savedAt: Date.now()
  };
  var all = readSaved().filter(function (r) { return r.uuid !== rec.uuid || !rec.uuid; });
  all.push(rec);
  entry.record = rec;
  entry.uuid = rec.uuid;
  writeSaved(all);
  enforceCap();
}
function enforceCap() {
  var all = readSaved();
  if (all.length <= MAX_SAVED) return;
  all.sort(function (a, b) { return (a.savedAt || 0) - (b.savedAt || 0); });
  var drop = all.slice(0, all.length - MAX_SAVED);
  var dropIds = {};
  drop.forEach(function (r) { dropIds[r.uuid || ('noid-' + r.savedAt)] = true; });
  // remove from the live scene too
  S.placed = S.placed.filter(function (e) {
    var key = e.uuid || ('noid-' + (e.record && e.record.savedAt));
    if (dropIds[key]) {
      if (e.group && e.group.parent && e.kind !== 'earth') e.group.parent.remove(e.group);
      if (e.anchor) { try { e.anchor.delete(); } catch (x) {} }
      return false;
    }
    return true;
  });
  writeSaved(all.slice(all.length - MAX_SAVED));
  var b = B();
  if (b && b.toast) b.toast('Room is full — removed the oldest to make space');
}
function onAnchor(entry, anchor) {
  entry.anchor = anchor || null;
  if (!anchor || typeof anchor.requestPersistentHandle !== 'function') {
    entry.uuid = null; // anchors unsupported — static position fallback
    saveRecord(entry);
    return;
  }
  Promise.resolve().then(function () { return anchor.requestPersistentHandle(); }).then(function (uuid) {
    entry.uuid = uuid || null;
    saveRecord(entry);
  }).catch(function () {
    entry.uuid = null;
    saveRecord(entry);
  });
}
function onFrame(frame) {
  var b = B();
  if (!b || !b.ar || !frame) return;
  var refSpace = null;
  try { refSpace = b.ar.refSpace(); } catch (e) {}
  if (!refSpace) return;
  // 1) create anchors for freshly placed objects
  if (S.pendingAnchors.length && typeof frame.createAnchor === 'function') {
    var batch = S.pendingAnchors;
    S.pendingAnchors = [];
    batch.forEach(function (entry) {
      try {
        var p = entry.group.position;
        var t = new XRRigidTransform({ x: p.x, y: p.y, z: p.z }, { x: 0, y: 0, z: 0, w: 1 });
        Promise.resolve(frame.createAnchor(t, refSpace)).then(function (a) {
          onAnchor(entry, a);
        }).catch(function () { onAnchor(entry, null); });
      } catch (e) { onAnchor(entry, null); }
    });
  } else if (S.pendingAnchors.length) {
    var batch2 = S.pendingAnchors;
    S.pendingAnchors = [];
    batch2.forEach(function (entry) { onAnchor(entry, null); });
  }
  // 2) glue anchored objects to the refined world map
  for (var i = 0; i < S.placed.length; i++) {
    (function (entry) {
      if (!entry.anchor || !entry.anchor.anchorSpace) return;
      try {
        var pose = frame.getPose(entry.anchor.anchorSpace, refSpace);
        if (pose) {
          entry.group.position.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
          entry.group.quaternion.set(pose.transform.orientation.x, pose.transform.orientation.y, pose.transform.orientation.z, pose.transform.orientation.w);
        }
      } catch (e) {}
    })(S.placed[i]);
  }
}

/* ---------- session lifecycle ---------- */
function restoreOne(rec, session, done) {
  var b = B();
  if (rec.kind === 'earth') {
    if (!b || !b.ar) { done(false); return; }
    var pos = new THREE.Vector3(rec.position[0], rec.position[1], rec.position[2]);
    b.ar.placeEarth(pos);
    var g = b.ar.earthObject();
    if (!g) { done(false); return; }
    if (rec.quaternion) g.quaternion.set(rec.quaternion[0], rec.quaternion[1], rec.quaternion[2], rec.quaternion[3]);
    finishRestore({ kind: 'earth', group: g, record: rec }, session, done);
  } else if (rec.kind === 'model' && rec.modelUrl) {
    loadGlb(rec.modelUrl).then(function (tpl) {
      var bb = B();
      if (!bb || !bb.scene) { done(false); return; }
      var inner = normalize(tpl.clone(true), 0.5);
      inner.position.fromArray(rec.position);
      if (rec.quaternion) inner.quaternion.fromArray(rec.quaternion);
      if (rec.scale) inner.scale.setScalar(rec.scale);
      bb.scene.add(inner);
      finishRestore({ kind: 'model', model: { id: rec.modelId, name: rec.modelName, modelUrl: rec.modelUrl }, group: inner, record: rec }, session, done);
    }).catch(function () { done(false); });
  } else { done(false); }
}
function finishRestore(entry, session, done) {
  var rec = entry.record;
  var canRestore = rec.uuid && session && typeof session.restorePersistentAnchor === 'function';
  entry.id = 'p' + (nextId++);
  entry.uuid = rec.uuid || null;
  entry.anchor = null;
  S.placed.push(entry);
  if (!canRestore) { done(false); return; }
  Promise.resolve(session.restorePersistentAnchor(rec.uuid)).then(function (anchor) {
    entry.anchor = anchor || null;
    done(!!anchor);
  }).catch(function () { done(false); });
}
function onSessionStart(session) {
  var b = B();
  if (!b || !b.ar) return;
  S.session = session;
  S.placed = []; S.pendingAnchors = [];
  S.placing = false; S.choice = null;
  S.domOverlay = document.body.classList.contains('ar-overlay');
  attachGestures();
  var saved = readSaved();
  if (!saved.length) { showPicker(); return; }
  var pending = saved.length, anchored = 0;
  function oneDone(ok) {
    if (ok) anchored++;
    if (--pending === 0) {
      var bb = B();
      var msg = anchored === saved.length
        ? 'Welcome back — restored ' + saved.length + ' thing' + (saved.length === 1 ? '' : 's') + ' to your room'
        : 'Welcome back — restored ' + saved.length + ' from saved spots';
      showPicker(msg);
      if (bb && bb.toast) bb.toast(msg);
    }
  }
  saved.forEach(function (rec) { restoreOne(rec, session, oneDone); });
}
function onSessionEnd() {
  // Main's endAR restores Earth to the scene; we drop our model groups + anchor refs
  // (persistent handles stay valid in the device anchor store — we do NOT delete them here).
  S.placed.forEach(function (e) {
    if (e.kind === 'model' && e.group && e.group.parent) {
      try { e.group.parent.remove(e.group); } catch (x) {}
    }
  });
  S.placed = []; S.pendingAnchors = [];
  S.placing = false; S.choice = null; S.pickerOpen = false;
  S.tapOnModel = false;
  detachGestures();
  var p = document.getElementById('ar-place-picker');
  if (p) p.style.display = 'none';
}
function clearRoom() {
  var b = B();
  S.placed.forEach(function (e) {
    if (e.kind !== 'earth' && e.group && e.group.parent) {
      try { e.group.parent.remove(e.group); } catch (x) {}
    }
    if (e.anchor) { try { e.anchor.delete(); } catch (x) {} } // explicit user wipe: drop stored anchors
  });
  S.placed = []; S.pendingAnchors = [];
  if (b && b.ar && b.ar.resetEarth) b.ar.resetEarth();
  writeSaved([]);
  if (b && b.toast) b.toast('Room cleared — fresh canvas!');
  showPicker();
}

/* ---------- gestures on placed models (drag spin · pinch resize · tap info) ---------- */
var raycaster = new THREE.Raycaster();
function placedGroups() {
  var g = [];
  for (var i = 0; i < S.placed.length; i++) {
    if (S.placed[i].kind === 'model' && S.placed[i].group) g.push(S.placed[i].group);
  }
  return g;
}
function rootOf(obj) {
  var groups = placedGroups();
  var o = obj;
  while (o) {
    if (groups.indexOf(o) !== -1) return o;
    o = o.parent;
  }
  return null;
}
function pickModelAt(x, y) {
  var b = B();
  if (!b || !b.camera) return null;
  var rect = b.renderer.domElement.getBoundingClientRect();
  var nx = ((x - rect.left) / rect.width) * 2 - 1;
  var ny = -((y - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera({ x: nx, y: ny }, b.camera);
  var hits = raycaster.intersectObjects(placedGroups(), true);
  return hits.length ? rootOf(hits[0].object) : null;
}
function tapOnUI(x, y) {
  var els = document.querySelectorAll('.hud');
  for (var i = 0; i < els.length; i++) {
    var r = els[i].getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
  }
  return false;
}
function gestureCanvas() {
  var b = B();
  return b && b.renderer ? b.renderer.domElement : null;
}
function attachGestures() {
  var cvs = gestureCanvas();
  if (!cvs || cvs._arPlaceGestures) return;
  cvs._arPlaceGestures = true;
  cvs.addEventListener('pointerdown', gDown);
  cvs.addEventListener('pointermove', gMove);
  cvs.addEventListener('pointerup', gUp);
  cvs.addEventListener('pointercancel', gUp);
}
function detachGestures() {
  var cvs = gestureCanvas();
  if (!cvs || !cvs._arPlaceGestures) return;
  cvs._arPlaceGestures = false;
  cvs.removeEventListener('pointerdown', gDown);
  cvs.removeEventListener('pointermove', gMove);
  cvs.removeEventListener('pointerup', gUp);
  cvs.removeEventListener('pointercancel', gUp);
  S.gesture = null;
}
function gDown(e) {
  if (!isARActive() || S.placing || S.pickerOpen) return;
  if (tapOnUI(e.clientX, e.clientY)) return;
  var root = pickModelAt(e.clientX, e.clientY);
  S.tapOnModel = !!root;
  clearTimeout(S.tapOnModelTimer);
  if (root) S.tapOnModelTimer = setTimeout(function () { S.tapOnModel = false; }, 1200);
  if (!root) return;
  S.gesture = S.gesture || { root: root, pointers: {}, lastPinch: 0, moved: false, startT: 0, startX: 0, startY: 0 };
  S.gesture.root = root;
  S.gesture.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  S.gesture.moved = false; S.gesture.startT = performance.now();
  S.gesture.startX = e.clientX; S.gesture.startY = e.clientY;
  var ids = Object.keys(S.gesture.pointers);
  if (ids.length === 2) {
    var a = S.gesture.pointers[ids[0]], q = S.gesture.pointers[ids[1]];
    S.gesture.lastPinch = Math.hypot(a.x - q.x, a.y - q.y);
  }
}
function gMove(e) {
  var G = S.gesture;
  if (!G || !G.pointers[e.pointerId] || !isARActive()) return;
  var prev = G.pointers[e.pointerId];
  G.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  var dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  if (Math.abs(e.clientX - G.startX) + Math.abs(e.clientY - G.startY) > 8) G.moved = true;
  var ids = Object.keys(G.pointers);
  if (ids.length === 2) {
    var a = G.pointers[ids[0]], q = G.pointers[ids[1]];
    var d = Math.hypot(a.x - q.x, a.y - q.y);
    if (G.lastPinch > 0 && d > 0) {
      var s = G.root.scale.x * (d / G.lastPinch);
      G.root.scale.setScalar(Math.min(4, Math.max(0.16, s)));
    }
    G.lastPinch = d;
    return;
  }
  if (ids.length === 1 && G.moved) {
    G.root.rotation.y += dx * 0.008;
    G.root.rotation.x = Math.max(-1.2, Math.min(1.2, G.root.rotation.x + dy * 0.008));
  }
}
function gUp(e) {
  var G = S.gesture;
  if (G && G.pointers) delete G.pointers[e.pointerId];
  var wasTap = G && !G.moved && (performance.now() - G.startT) < 400 && !tapOnUI(e.clientX, e.clientY);
  if (wasTap && G.root) {
    var entry = null;
    for (var i = 0; i < S.placed.length; i++) {
      if (S.placed[i].group === G.root) { entry = S.placed[i]; break; }
    }
    var b = B();
    if (b && b.toast) {
      var nm = entry && entry.model ? entry.model.name : 'Model';
      var by = entry && entry.model && entry.model.creatorHandle ? ' · Built by ' + entry.model.creatorHandle : '';
      b.toast(nm + by);
    }
  } else {
    S.tapOnModel = false; // it was a drag — don't swallow the following select
  }
  if (G && Object.keys(G.pointers || {}).length === 0) S.gesture = null;
}

/* ---------- public API ---------- */
window.ARPlacement = {
  onSessionStart: onSessionStart,
  onSessionEnd: onSessionEnd,
  onFrame: onFrame,
  handleTap: handleTap,
  requestPlace: requestPlace,
  isPlacing: isPlacing,
  promptText: promptText,
  clearRoom: clearRoom,
  showPicker: showPicker
};
