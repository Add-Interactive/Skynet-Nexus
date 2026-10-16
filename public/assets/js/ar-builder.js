/* Space Center AR — ar-builder.js
   Fun pack: BUILD-A-STATION ("design your own space station, right in your room").
   Loads AFTER ar-placement.js as <script type="module">.

   - Exposes window.ARFun.builder = { open(), close(), saveDesign(),
     loadDesign(), clearDesign(), isOpen() }  (coordinator: wire a "🛠️ Build"
     picker button to ARFun.builder.open()).
   - Builder panel (DOM overlay, class "hud"): 6-part palette. Every part is a
     procedural low-poly three.js primitive — no GLB assets, nothing to download.
     Pick a part, then tap anywhere: it drops at the hit-test reticle (or floats
     in front of you, same flow as the room picker).
   - SNAP-TO-SOCKET: each part defines 1-2 connection points. Drop a new part
     within 14 cm of an existing socket and it snaps on with a "🔗" toast.
   - Drag a placed part to spin it (drag-spin gesture). Inline DOM text input
     names the station (never prompt()) — the name floats above the station as
     a canvas-texture sprite plaque.
   - Save/load: the design (part types + root-relative positions/rotations +
     name) auto-saves to localStorage 'sc-ar-station-v1' on every change;
     loadDesign() rebuilds it at the current reticle. Clear is two-tap confirm.
   - Hooks wrap window.ARPlacement.handleTap / promptText / onSessionEnd
     (property wrapping — same pattern as ar-orbit.js). On session end the live
     build is dropped (AR tracking is gone) but the design stays saved.
   - Kid-safe: no prompt()/alert()/confirm() anywhere; plain tap UI only. */

import * as THREE from 'three';

var LS_KEY = 'sc-ar-station-v1';
var SNAP_DIST = 0.14; // metres — drop this close to a socket and it snaps on

function B() { return window.__scB || null; }
function toast(msg) { var b = B(); if (b && b.toast) b.toast(msg); }
function isARActive() {
  var b = B();
  return !!(b && b.ar && b.ar.isActive && b.ar.isActive());
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function r3(n) { return Math.round(n * 1000) / 1000; }

/* ---------------- state ---------------- */
var S = {
  open: false,
  root: null,        // station root group (pad + plaque + parts live under it)
  pad: null,
  parts: [],         // {type, def, group}
  selected: null,    // selected part entry (drag to spin)
  pendingPart: null,  // palette type waiting for a tap to drop it
  name: '',
  drag: null,        // {entry, pointers, startX, startY, moved, startT}
  clearArm: 0,
  restored: false    // welcome-back auto-load runs once per session
};
var plaqueSprite = null, plaqueCanvas = null, plaqueTex = null;
var selRing = null;
var solarTex = null;

/* ---------------- materials + part builders (all procedural) ---------------- */
function M(color, opts) {
  var o = opts || {};
  return new THREE.MeshStandardMaterial({
    color: color,
    roughness: o.rough != null ? o.rough : 0.55,
    metalness: o.metal != null ? o.metal : 0.35,
    transparent: !!o.transparent,
    opacity: o.opacity != null ? o.opacity : 1,
    emissive: o.emissive || 0x000000,
    emissiveIntensity: o.ei != null ? o.ei : 1,
    side: o.double ? THREE.DoubleSide : THREE.FrontSide
  });
}
function getSolarTex() {
  if (solarTex) return solarTex;
  var c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  var x = c.getContext('2d');
  x.fillStyle = '#123a9e'; x.fillRect(0, 0, 128, 64);
  x.strokeStyle = '#7fb2ff'; x.lineWidth = 2;
  var i, j;
  for (i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16, 64); x.stroke(); }
  for (j = 0; j <= 4; j++) { x.beginPath(); x.moveTo(0, j * 16); x.lineTo(128, j * 16); x.stroke(); }
  solarTex = new THREE.CanvasTexture(c);
  return solarTex;
}
function buildHabitat() {
  var g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.26, 14), M(0xe8eef4, { rough: 0.4, metal: 0.6 })));
  [-0.11, 0.11].forEach(function (y) {
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 22), M(0x00e5ff, { emissive: 0x00e5ff, ei: 0.55 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = y; g.add(ring);
  });
  var win = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.05, 14, 1, true), M(0x0d2b45, { rough: 0.2, metal: 0.8 }));
  g.add(win);
  return g;
}
function buildSolar() {
  var g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), M(0x9aa7b5, { metal: 0.7, rough: 0.35 })));
  var tex = getSolarTex();
  [1, -1].forEach(function (s) {
    var wing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.012, 0.15),
      new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.35, metalness: 0.2, emissive: 0x0a2470, emissiveIntensity: 0.25 }));
    wing.position.x = s * 0.155;
    g.add(wing);
    var spar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.02), M(0x6b7684, { metal: 0.7 }));
    spar.position.x = s * 0.055;
    g.add(spar);
  });
  return g;
}
function buildDocking() {
  var g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.1, 14), M(0xcdd6df, { metal: 0.65, rough: 0.35 })));
  var ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 22), M(0x00e5ff, { emissive: 0x00e5ff, ei: 0.55 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  var hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.012, 14), M(0x10222f, { rough: 0.3, metal: 0.6 }));
  hatch.position.y = 0.052; g.add(hatch);
  return g;
}
function buildCupola() {
  var g = new THREE.Group();
  var dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    M(0x9fdcff, { rough: 0.1, metal: 0.1, transparent: true, opacity: 0.7 }));
  g.add(dome);
  var base = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.098, 0.035, 18), M(0x8b96a3, { metal: 0.7, rough: 0.35 }));
  base.position.y = -0.017; g.add(base);
  for (var i = 0; i < 4; i++) {
    var rib = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.006, 6, 18, Math.PI), M(0x5a6470, { metal: 0.7 }));
    rib.rotation.y = i * Math.PI / 4;
    g.add(rib);
  }
  return g;
}
function buildTruss() {
  var g = new THREE.Group();
  var railMat = M(0xaab4c0, { metal: 0.75, rough: 0.3 });
  [[0.035, 0.035], [0.035, -0.035], [-0.035, 0.035], [-0.035, -0.035]].forEach(function (o) {
    var rail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.014, 0.014), railMat);
    rail.position.set(0, o[0], o[1]); g.add(rail);
  });
  for (var i = 0; i < 5; i++) {
    var bar = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.084, 0.084), railMat);
    bar.position.x = -0.144 + i * 0.072;
    g.add(bar);
  }
  return g;
}
function buildAntenna() {
  var g = new THREE.Group();
  var base = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.025, 12), M(0x8b96a3, { metal: 0.7 }));
  base.position.y = -0.115; g.add(base);
  var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.22, 8), M(0xb9c2cc, { metal: 0.7 }));
  g.add(mast);
  var dish = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 8, 0, Math.PI * 2, 0, 0.7),
    M(0xe8eef4, { rough: 0.4, metal: 0.4, double: true }));
  dish.position.set(0, 0.115, 0.015);
  dish.rotation.x = -0.9;
  g.add(dish);
  var feed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), M(0x00e5ff, { emissive: 0x00e5ff, ei: 0.8 }));
  feed.position.set(0, 0.135, 0.045); g.add(feed);
  return g;
}

/* sockets are local connection points — drop a new part near one and it snaps on */
var PARTS = {
  habitat: { emoji: '🏠', name: 'Habitat module', hint: 'where astronauts live and sleep', halfH: 0.15, ringR: 0.14,
             sockets: [[0, 0.15, 0], [0, -0.15, 0]], build: buildHabitat },
  solar:   { emoji: '☀️', name: 'Solar wing', hint: 'catches sunlight to make power', halfH: 0.04, ringR: 0.3,
             sockets: [[0.28, 0, 0], [-0.28, 0, 0]], build: buildSolar },
  docking: { emoji: '🔌', name: 'Docking port', hint: 'where visiting ships park', halfH: 0.07, ringR: 0.11,
             sockets: [[0, 0.06, 0], [0, -0.06, 0]], build: buildDocking },
  cupola:  { emoji: '🔭', name: 'Cupola', hint: 'the window dome with the best view', halfH: 0.07, ringR: 0.13,
             sockets: [[0, -0.04, 0]], build: buildCupola },
  truss:   { emoji: '🧱', name: 'Truss segment', hint: 'the strong backbone girder', halfH: 0.05, ringR: 0.22,
             sockets: [[0.19, 0, 0], [-0.19, 0, 0]], build: buildTruss },
  antenna: { emoji: '📡', name: 'Antenna', hint: 'talks to mission control', halfH: 0.13, ringR: 0.1,
             sockets: [[0, -0.13, 0]], build: buildAntenna }
};
var PART_ORDER = ['habitat', 'solar', 'docking', 'cupola', 'truss', 'antenna'];

/* ---------------- persistence ---------------- */
function readDesign() {
  try {
    var d = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    return (d && typeof d === 'object') ? d : null;
  } catch (e) { return null; }
}
function writeDesign(d) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch (e) {}
}
function saveDesign() {
  var parts = [];
  for (var i = 0; i < S.parts.length; i++) {
    var p = S.parts[i], q = p.group.quaternion, v = p.group.position;
    parts.push({
      type: p.type,
      pos: [r3(v.x), r3(v.y), r3(v.z)],
      quat: [r3(q.x), r3(q.y), r3(q.z), r3(q.w)],
      scale: r3(p.group.scale.x)
    });
  }
  writeDesign({ name: S.name || '', parts: parts, savedAt: Date.now() });
}

/* ---------------- station root / plaque ---------------- */
function reticleWorld(v) {
  var b = B();
  var r = b && b.ar ? b.ar.reticle() : null;
  if (r && r.visible) { v.copy(r.position); return true; }
  return false;
}
function frontWorld(v) {
  var b = B();
  var cp = new THREE.Vector3(), cd = new THREE.Vector3();
  b.camera.getWorldPosition(cp);
  b.camera.getWorldDirection(cd);
  v.copy(cp).addScaledVector(cd, 1.0);
  v.y -= 0.15;
  return v;
}
function ensureRoot() {
  if (S.root) return S.root;
  var b = B();
  if (!b || !b.scene) return null;
  var wp = new THREE.Vector3();
  if (!reticleWorld(wp)) frontWorld(wp);
  var root = new THREE.Group();
  root.position.copy(wp);
  var pad = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = -0.2;
  root.add(pad);
  S.pad = pad;
  root.add(ensurePlaque());
  b.scene.add(root);
  S.root = root;
  updatePlaquePos();
  return root;
}
function roundRectPath(x, a, b2, w, h, r) {
  x.beginPath();
  x.moveTo(a + r, b2);
  x.arcTo(a + w, b2, a + w, b2 + h, r);
  x.arcTo(a + w, b2 + h, a, b2 + h, r);
  x.arcTo(a, b2 + h, a, b2, r);
  x.arcTo(a, b2, a + w, b2, r);
  x.closePath();
}
function ensurePlaque() {
  if (plaqueSprite) return plaqueSprite;
  plaqueCanvas = document.createElement('canvas');
  plaqueCanvas.width = 512; plaqueCanvas.height = 128;
  plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
  plaqueSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: plaqueTex, transparent: true, depthTest: false }));
  plaqueSprite.scale.set(0.62, 0.155, 1);
  plaqueSprite.renderOrder = 999;
  drawPlaque();
  return plaqueSprite;
}
function drawPlaque() {
  if (!plaqueCanvas) return;
  var x = plaqueCanvas.getContext('2d');
  x.clearRect(0, 0, 512, 128);
  var name = (S.name || 'My Space Station').slice(0, 28);
  x.fillStyle = 'rgba(3,12,24,0.88)';
  roundRectPath(x, 8, 20, 496, 88, 22); x.fill();
  x.strokeStyle = 'rgba(0,229,255,0.9)'; x.lineWidth = 4;
  roundRectPath(x, 8, 20, 496, 88, 22); x.stroke();
  x.fillStyle = '#eaffff';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  var fs = 44;
  x.font = 'bold ' + fs + 'px system-ui, sans-serif';
  while (x.measureText(name).width > 450 && fs > 20) { fs -= 2; x.font = 'bold ' + fs + 'px system-ui, sans-serif'; }
  x.fillText(name, 256, 66);
  if (plaqueTex) plaqueTex.needsUpdate = true;
}
function stationTopY() {
  var top = 0.2;
  for (var i = 0; i < S.parts.length; i++) {
    var p = S.parts[i];
    var t = p.group.position.y + (p.def.halfH || 0.1) * p.group.scale.y;
    if (t > top) top = t;
  }
  return top;
}
function updatePlaquePos() {
  if (!plaqueSprite) return;
  plaqueSprite.position.set(0, stationTopY() + 0.17, 0);
}

/* ---------------- placement (via wrapped handleTap) ---------------- */
function builderHandleTap() {
  if (!S.open || !S.pendingPart) return false;
  placePending();
  return true; // swallowed — the classic tap flow must not also run
}
function placePending() {
  var type = S.pendingPart;
  S.pendingPart = null;
  var def = PARTS[type];
  var b = B();
  if (!def || !b || !b.scene) { setNote('Pick a part 👆'); return; }
  var root = ensureRoot();
  if (!root) { setNote('Pick a part 👆'); return; }
  var grp = def.build();
  // drop point: reticle if the kid is aiming at a surface, else floating ahead
  var wp = new THREE.Vector3();
  if (!reticleWorld(wp)) frontWorld(wp);
  root.updateMatrixWorld(true);
  var local = root.worldToLocal(wp.clone());
  // snap-to-socket: close to an existing connection point? snap on.
  var snapped = false;
  var tmp = new THREE.Vector3();
  for (var i = 0; i < S.parts.length && !snapped; i++) {
    var p = S.parts[i];
    for (var j = 0; j < p.def.sockets.length; j++) {
      tmp.set(p.def.sockets[j][0], p.def.sockets[j][1], p.def.sockets[j][2]);
      p.group.localToWorld(tmp);
      root.worldToLocal(tmp);
      if (local.distanceTo(tmp) < SNAP_DIST) {
        local.copy(tmp);
        snapped = true;
        break;
      }
    }
  }
  grp.position.copy(local);
  root.add(grp);
  var entry = { type: type, def: def, group: grp };
  S.parts.push(entry);
  select(entry, false);
  updatePlaquePos();
  saveDesign();
  setNote(snapped
    ? '🔗 Snapped together — nice building!'
    : def.emoji + ' ' + def.name + ' placed — drag it to spin, pick another part 👆');
  toast(snapped ? '🔗 Snapped together!' : def.emoji + ' ' + def.name + ' placed!');
}

/* ---------------- selection + drag-spin gestures ---------------- */
function ensureSelRing() {
  if (selRing) return selRing;
  selRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.85, depthTest: false }));
  selRing.rotation.x = Math.PI / 2;
  selRing.renderOrder = 998;
  return selRing;
}
function select(entry, announce) {
  if (S.selected && selRing && selRing.parent) {
    try { selRing.parent.remove(selRing); } catch (e) {}
  }
  S.selected = entry || null;
  if (entry) {
    var ring = ensureSelRing();
    ring.scale.setScalar(entry.def.ringR || 0.15);
    ring.position.y = -(entry.def.halfH || 0.1) - 0.04;
    entry.group.add(ring);
    if (announce !== false) setNote(entry.def.emoji + ' ' + entry.def.name + ' — drag to spin it');
  } else if (S.open) {
    setNote('Pick a part 👆');
  }
}
var raycaster = new THREE.Raycaster();
function pickPartAt(x, y) {
  var b = B();
  if (!b || !b.camera || !b.renderer || !S.root) return null;
  var rect = b.renderer.domElement.getBoundingClientRect();
  var nx = ((x - rect.left) / rect.width) * 2 - 1;
  var ny = -((y - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera({ x: nx, y: ny }, b.camera);
  var groups = [];
  for (var i = 0; i < S.parts.length; i++) groups.push(S.parts[i].group);
  if (!groups.length) return null;
  var hits = raycaster.intersectObjects(groups, true);
  if (!hits.length) return null;
  var o = hits[0].object;
  while (o) {
    for (var k = 0; k < S.parts.length; k++) {
      if (S.parts[k].group === o) return S.parts[k];
    }
    o = o.parent;
  }
  return null;
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
  if (!cvs || cvs._arBuildGestures) return;
  cvs._arBuildGestures = true;
  cvs.addEventListener('pointerdown', bDown);
  cvs.addEventListener('pointermove', bMove);
  cvs.addEventListener('pointerup', bUp);
  cvs.addEventListener('pointercancel', bUp);
}
function detachGestures() {
  var cvs = gestureCanvas();
  if (!cvs || !cvs._arBuildGestures) return;
  cvs._arBuildGestures = false;
  cvs.removeEventListener('pointerdown', bDown);
  cvs.removeEventListener('pointermove', bMove);
  cvs.removeEventListener('pointerup', bUp);
  cvs.removeEventListener('pointercancel', bUp);
  S.drag = null;
}
function bDown(e) {
  if (!S.open || !isARActive()) return;
  if (tapOnUI(e.clientX, e.clientY)) return;
  if (S.pendingPart) return; // the tap drops the part via the select/handleTap path
  var hit = pickPartAt(e.clientX, e.clientY);
  if (!hit) { select(null); return; }
  select(hit);
  S.drag = {
    entry: hit, pointers: {},
    startX: e.clientX, startY: e.clientY,
    moved: false, startT: performance.now()
  };
  S.drag.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
}
function bMove(e) {
  var D = S.drag;
  if (!D || !D.pointers[e.pointerId] || !isARActive()) return;
  var prev = D.pointers[e.pointerId];
  D.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
  var dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  if (Math.abs(e.clientX - D.startX) + Math.abs(e.clientY - D.startY) > 8) D.moved = true;
  if (D.moved) {
    var g = D.entry.group;
    g.rotation.y += dx * 0.01;
    g.rotation.x = Math.max(-0.8, Math.min(0.8, g.rotation.x + dy * 0.008));
  }
}
function bUp(e) {
  var D = S.drag;
  if (D && D.pointers) delete D.pointers[e.pointerId];
  if (D && Object.keys(D.pointers || {}).length === 0) {
    var wasTap = !D.moved && (performance.now() - D.startT) < 400;
    if (wasTap) {
      toast(D.entry.def.emoji + ' ' + D.entry.def.name + ' — ' + D.entry.def.hint);
    } else if (D.moved) {
      saveDesign(); // spun it — keep the new angle
      setNote(D.entry.def.emoji + ' ' + D.entry.def.name + ' — looking good! Pick another part 👆');
    }
    S.drag = null;
  }
}

/* ---------------- builder panel (DOM overlay) ---------------- */
function setNote(t) {
  var n = document.getElementById('ar-build-note');
  if (n) n.textContent = t || '';
}
function partCardHtml(type) {
  var d = PARTS[type];
  return '<button data-part="' + esc(type) + '" class="tbtn" style="padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;min-height:86px">' +
    '<span style="font-size:1.7rem">' + d.emoji + '</span>' +
    '<span style="font-size:.72rem;font-weight:700;color:#eaffff;line-height:1.15">' + esc(d.name) + '</span>' +
    '<span style="font-size:.6rem;color:#8fd8ef">' + esc(d.hint) + '</span>' +
  '</button>';
}
function ensurePanel() {
  var p = document.getElementById('ar-build-panel');
  if (p) return p;
  p = document.createElement('div');
  p.id = 'ar-build-panel';
  p.className = 'hud'; // taps on the panel never double-fire 3D
  p.setAttribute('role', 'dialog');
  p.setAttribute('aria-label', 'Build a space station');
  p.style.cssText = [
    'position:fixed', 'left:10px', 'right:10px', 'bottom:92px', 'z-index:70',
    'display:none', 'background:rgba(3,12,24,.96)', 'border:1px solid rgba(0,229,255,.45)',
    'border-radius:16px', 'padding:12px 12px 10px', 'box-shadow:0 8px 40px rgba(0,0,0,.6)',
    'max-height:54vh', 'overflow-y:auto', 'backdrop-filter:blur(6px)'
  ].join(';');
  var cards = '';
  for (var i = 0; i < PART_ORDER.length; i++) cards += partCardHtml(PART_ORDER[i]);
  p.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
      '<div style="font-weight:800;color:#eaffff;font-size:.95rem">🛠️ Build-a-Station</div>' +
      '<div id="ar-build-note" style="font-size:.68rem;color:#8fd8ef;text-align:right;max-width:55%"></div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">' +
      '<label for="ar-build-name" style="font-size:.72rem;color:#8fd8ef;white-space:nowrap">Name it:</label>' +
      '<input id="ar-build-name" type="text" maxlength="40" placeholder="e.g. Starbase Jeff" autocomplete="off" ' +
        'style="flex:1;background:rgba(0,40,60,.6);border:1px solid rgba(0,229,255,.4);border-radius:10px;color:#eaffff;' +
        'padding:8px 10px;font-size:.8rem;outline:none" />' +
    '</div>' +
    '<div id="ar-build-cards" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' + cards + '</div>' +
    '<div style="display:flex;gap:6px;margin-top:10px">' +
      '<button id="ar-build-save" class="tbtn" style="flex:1;font-size:.72rem;padding:8px 2px">💾 Save</button>' +
      '<button id="ar-build-load" class="tbtn" style="flex:1;font-size:.72rem;padding:8px 2px">📥 Load</button>' +
      '<button id="ar-build-clear" class="tbtn" style="flex:1;font-size:.72rem;padding:8px 2px">🧹 Clear</button>' +
      '<button id="ar-build-close" class="tbtn" style="flex:1;font-size:.72rem;padding:8px 2px">✖ Close</button>' +
    '</div>' +
    '<div style="margin-top:8px;text-align:center;font-size:.6rem;color:#5b7c8f">Add Interactive Studio · NEXUS</div>';
  document.body.appendChild(p);
  var btns = p.querySelectorAll('[data-part]');
  for (var k = 0; k < btns.length; k++) {
    btns[k].onclick = function (e) { onPickPart(e.currentTarget.getAttribute('data-part')); };
  }
  document.getElementById('ar-build-name').addEventListener('input', function (e) {
    S.name = String(e.target.value || '').slice(0, 40);
    drawPlaque();
    saveDesign();
  });
  document.getElementById('ar-build-save').onclick = function () {
    saveDesign();
    toast(S.parts.length ? 'Station saved! 💾' : 'Nothing to save yet — pick a part 👆');
  };
  document.getElementById('ar-build-load').onclick = function () { loadDesign(false); };
  document.getElementById('ar-build-clear').onclick = function () {
    var btn = document.getElementById('ar-build-clear');
    var now = Date.now();
    if (now - S.clearArm < 4000) {
      S.clearArm = 0;
      btn.textContent = '🧹 Clear';
      clearDesign();
    } else {
      S.clearArm = now;
      btn.textContent = 'Tap again to confirm';
      setTimeout(function () {
        if (Date.now() - S.clearArm >= 4000 && btn.isConnected) btn.textContent = '🧹 Clear';
      }, 4100);
    }
  };
  document.getElementById('ar-build-close').onclick = function () { close(); };
  return p;
}
function onPickPart(type) {
  var def = PARTS[type];
  if (!def) return;
  if (!isARActive()) { toast('Start AR first, then build 🛠️'); return; }
  S.pendingPart = type;
  setNote('Tap anywhere to drop your ' + def.name + ' 👆');
  toast('Tap anywhere to drop your ' + def.emoji + ' ' + def.name);
}

/* ---------------- public feature API ---------------- */
function open() {
  var b = B();
  if (!b || !isARActive()) { toast('Start AR first, then open 🛠️ Build'); return false; }
  var p = ensurePanel();
  var inp = document.getElementById('ar-build-name');
  if (inp && !inp.value && S.name) inp.value = S.name;
  p.style.display = 'block';
  S.open = true;
  attachGestures();
  setNote(S.pendingPart ? null : 'Pick a part 👆');
  if (!S.root && !S.restored) {
    // welcome back — rebuild the saved station once per session if the pad is empty
    S.restored = true;
    var d = readDesign();
    if (d && d.parts && d.parts.length) {
      loadDesign(true);
      toast('Welcome back, Commander — your station is rebuilt! 🛠️');
    }
  }
  return true;
}
function close() {
  var p = document.getElementById('ar-build-panel');
  if (p) p.style.display = 'none';
  S.open = false;
  S.pendingPart = null;
  S.drag = null;
  select(null);
  detachGestures();
}
function isOpen() { return S.open; }
function clearParts() {
  if (S.selected && selRing && selRing.parent) {
    try { selRing.parent.remove(selRing); } catch (e) {}
  }
  for (var i = 0; i < S.parts.length; i++) {
    var g = S.parts[i].group;
    if (g && g.parent) { try { g.parent.remove(g); } catch (e) {} }
  }
  S.parts = [];
  S.selected = null;
}
function loadDesign(silent) {
  var b = B();
  if (!b || !isARActive()) { if (!silent) toast('Start AR first, then load your station'); return false; }
  var d = readDesign();
  if (!d || !d.parts || !d.parts.length) {
    if (!silent) toast('No saved station yet — build one first! 🛠️');
    return false;
  }
  clearParts();
  var root = ensureRoot();
  if (!root) { if (!silent) toast('Could not set up the build pad'); return false; }
  var placed = 0;
  for (var i = 0; i < d.parts.length; i++) {
    var rec = d.parts[i];
    var def = PARTS[rec.type];
    if (!def) continue;
    var grp = def.build();
    if (rec.pos) grp.position.set(rec.pos[0] || 0, rec.pos[1] || 0, rec.pos[2] || 0);
    if (rec.quat) grp.quaternion.set(rec.quat[0] || 0, rec.quat[1] || 0, rec.quat[2] || 0, rec.quat[3] == null ? 1 : rec.quat[3]);
    if (rec.scale) grp.scale.setScalar(rec.scale);
    root.add(grp);
    S.parts.push({ type: rec.type, def: def, group: grp });
    placed++;
  }
  S.name = d.name || '';
  var inp = document.getElementById('ar-build-name');
  if (inp) inp.value = S.name;
  drawPlaque();
  updatePlaquePos();
  saveDesign(); // normalize the record
  if (!silent) toast(placed ? 'Station restored — welcome back, Commander! 🛠️' : 'Saved station was empty — pick a part 👆');
  return placed > 0;
}
function clearDesign() {
  var b = B();
  clearParts();
  if (S.root && S.root.parent) { try { S.root.parent.remove(S.root); } catch (e) {} }
  S.root = null; S.pad = null;
  plaqueSprite = null; plaqueCanvas = null; plaqueTex = null;
  selRing = null;
  S.name = '';
  S.restored = false;
  var inp = document.getElementById('ar-build-name');
  if (inp) inp.value = '';
  try { localStorage.removeItem(LS_KEY); } catch (e) {}
  setNote('Pick a part 👆');
  if (b && b.toast) b.toast('Station cleared — fresh launchpad! 🚀');
}

/* ---------------- wrapped session lifecycle ---------------- */
function builderSessionEnd() {
  // AR tracking is gone — drop the live build. The design stays in localStorage.
  if (S.root && S.root.parent) { try { S.root.parent.remove(S.root); } catch (e) {} }
  S.root = null; S.pad = null;
  S.parts = []; S.selected = null; S.pendingPart = null; S.drag = null;
  plaqueSprite = null; plaqueCanvas = null; plaqueTex = null;
  selRing = null;
  S.restored = false;
  close();
}
function builderPromptText() {
  if (S.open && S.pendingPart) {
    var def = PARTS[S.pendingPart];
    return ('TAP TO PLACE ' + (def ? def.name : 'part')).toUpperCase().slice(0, 30);
  }
  return null;
}

/* ---------------- install (guarded startup) ---------------- */
function install() {
  var AP = window.ARPlacement;
  if (!AP || typeof AP.handleTap !== 'function' ||
      typeof AP.onSessionEnd !== 'function' ||
      typeof AP.promptText !== 'function') {
    return false;
  }
  // Tap routing: builder taps (pending part) are swallowed here so the classic
  // tap flow never double-fires; everything else falls through to base.
  var _tap = AP.handleTap.bind(AP);
  AP.handleTap = function () { return builderHandleTap() || _tap(); };
  var _prompt = AP.promptText.bind(AP);
  AP.promptText = function () {
    var t = builderPromptText();
    return t != null ? t : _prompt();
  };
  var _end = AP.onSessionEnd.bind(AP);
  AP.onSessionEnd = function () { _end(); builderSessionEnd(); };

  window.ARFun = window.ARFun || {};
  window.ARFun.builder = {
    open: open,
    close: close,
    saveDesign: saveDesign,
    loadDesign: function () { return loadDesign(false); },
    clearDesign: clearDesign,
    isOpen: isOpen
  };
  return true;
}

if (!install()) {
  var tries = 0;
  var bootTimer = setInterval(function () {
    tries++;
    if (install() || tries >= 20) clearInterval(bootTimer);
  }, 500);
}
