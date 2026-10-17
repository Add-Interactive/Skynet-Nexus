/* Space Center AR — ar-docking.js
   Fun pack: DOCKING GAME ("fly your capsule into the glowing ring").
   Loads AFTER ar-placement.js as <script type="module">.

   - Exposes window.ARFun.docking = { start(), stop(), isPlaying() }
   - Target: if an ISS model is placed (model name/id contains 'iss'), a
     glowing docking ring appears beside it; otherwise a small target
     outpost is spawned in front of the camera.
   - Controls (kid-simple): drag on the screen to push the capsule in the
     drag direction (screen plane, camera-relative), ◀ ▶ buttons yaw the
     capsule. Arcade physics: damped velocity, no gravity.
   - Win: capsule within DOCK_DIST of the port, approach speed under
     MAX_DOCK_SPEED, nose roughly aligned with the port. Confetti burst,
     best time in localStorage.
   - Hooks wrap window.ARPlacement.onFrame / onSessionStart / onSessionEnd
     (property wrapping — space-center-main.js looks the props up per call).
   - Kid-safe: no prompt()/alert()/confirm() anywhere; plain tap UI only.
*/

import * as THREE from 'three';

function B() { return window.__scB || null; }
function toast(msg) { var b = B(); if (b && b.toast) b.toast(msg); }

/* ---------------- tuning (room-scale meters) ---------------- */
var LS_BEST = 'sc-ar-dock-best-v1';
var DOCK_DIST = 0.20;      // win: this close to the port (m)
var MAX_DOCK_SPEED = 0.15; // win: approach speed under this (m/s)
var ALIGN_DEG = 40;        // win: nose within this angle of the port
var WARN_DIST = 0.7;       // "slow down!" warning inside this range (m)
var MAX_SPEED = 0.9;       // hard speed cap (m/s)
var DAMP = 1.6;            // velocity damping (1/s, exponential)
var THRUST_PX = 0.0016;    // m/s of velocity per dragged pixel
var YAW_RATE = 1.6;        // rad/s while a yaw button is held

var ALIGN_RAD = (ALIGN_DEG * Math.PI) / 180;

/* ---------------- state ---------------- */
var G = {
  playing: false,
  state: 'idle',        // idle | briefing | playing | won
  capsule: null,        // THREE.Group
  vel: new THREE.Vector3(),
  yaw: 0,
  yawDir: 0,            // -1 | 0 | +1 while a yaw button is held
  thrustFlash: 0,
  ringGroup: null,      // glowing docking ring + beacon (always ours)
  outpost: null,        // spawned target station, or null when using a placed ISS
  port: new THREE.Vector3(),   // world dock point
  portN: new THREE.Vector3(0, 0, 1), // world approach axis (points at the player)
  guide: null,          // THREE.Line capsule->ring aim aid
  particles: null,      // confetti burst state
  t0: 0, elapsed: 0, lastT: 0,
  dragId: null, lastX: 0, lastY: 0,
  best: null
};

/* ---------------- small helpers ---------------- */
function readBest() {
  try {
    var v = parseFloat(localStorage.getItem(LS_BEST));
    return (isFinite(v) && v > 0) ? v : null;
  } catch (e) { return null; }
}
function writeBest(t) {
  try { localStorage.setItem(LS_BEST, String(t)); } catch (e) {}
}
function fmtTime(s) {
  var m = Math.floor(s / 60), sec = s - m * 60;
  var whole = Math.floor(sec), tenth = Math.floor((sec - whole) * 10);
  return m + ':' + (whole < 10 ? '0' : '') + whole + '.' + tenth;
}
function camPos(out) {
  var b = B();
  out = out || new THREE.Vector3();
  b.camera.getWorldPosition(out);
  return out;
}
function camDir(out) {
  var b = B();
  out = out || new THREE.Vector3();
  b.camera.getWorldDirection(out);
  return out;
}
function isARActive() {
  var b = B();
  return !!(b && b.ar && b.ar.isActive && b.ar.isActive());
}
function findISS() {
  var AP = window.ARPlacement;
  var list = (AP && typeof AP.placedEntries === 'function') ? AP.placedEntries() : [];
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (!e || e.kind !== 'model' || !e.group) continue;
    var m = e.model || {};
    var hay = ((m.name || '') + ' ' + (m.id || '')).toLowerCase();
    if (hay.indexOf('iss') !== -1) return e;
  }
  return null;
}

/* ---------------- builders ---------------- */
function buildCapsule() {
  var g = new THREE.Group();
  var white = new THREE.MeshBasicMaterial({ color: 0xf2f6ff });
  var cyan = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  var dark = new THREE.MeshBasicMaterial({ color: 0x223448 });
  // body along +Z (nose at +Z)
  var body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 20), white);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  var nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), white);
  nose.position.z = 0.08;
  g.add(nose);
  var tail = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), white);
  tail.position.z = -0.08;
  g.add(tail);
  // NEXUS stripe
  var stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 20), cyan);
  stripe.rotation.x = Math.PI / 2;
  stripe.position.z = -0.02;
  g.add(stripe);
  // window
  var win = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), cyan);
  win.position.set(0, 0.038, 0.055);
  g.add(win);
  // docking probe at the nose tip
  var probe = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 10), dark);
  probe.rotation.x = Math.PI / 2;
  probe.position.z = 0.14;
  g.add(probe);
  var probeTip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), cyan);
  probeTip.position.z = 0.165;
  g.add(probeTip);
  // thruster flame (flickers while thrusting)
  var flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.03, 0.09, 12),
    new THREE.MeshBasicMaterial({ color: 0xffa726, transparent: true, opacity: 0.9 })
  );
  flame.rotation.x = -Math.PI / 2; // point -Z
  flame.position.z = -0.16;
  flame.visible = false;
  g.add(flame);
  g.userData.flame = flame;
  return g;
}

function buildRing() {
  // Glowing docking ring, facing local +Z. Caller positions/orients it.
  var g = new THREE.Group();
  var ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.013, 12, 40),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff })
  );
  g.add(ring);
  var halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.03, 12, 40),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.25 })
  );
  g.add(halo);
  var disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.095, 32),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
  );
  g.add(disc);
  g.userData.halo = halo;
  g.userData.disc = disc;
  return g;
}

function buildOutpost() {
  // Small target station, local +Z faces the player at spawn time.
  var g = new THREE.Group();
  var white = new THREE.MeshBasicMaterial({ color: 0xdfe9f5 });
  var blue = new THREE.MeshBasicMaterial({ color: 0x1a56c9 });
  var cyan = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  var core = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 16), white);
  core.rotation.z = Math.PI / 2; // along X
  g.add(core);
  var hub = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), white);
  g.add(hub);
  var panL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.015, 0.2), blue);
  panL.position.x = -0.38;
  g.add(panL);
  var panR = panL.clone();
  panR.position.x = 0.38;
  g.add(panR);
  var mast = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 8), white);
  mast.position.z = 0.15;
  mast.rotation.x = Math.PI / 2; // along Z
  g.add(mast);
  var beacon = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), cyan);
  beacon.position.z = 0.3;
  g.add(beacon);
  g.userData.beacon = beacon;
  return g;
}

function buildGuide() {
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  var line = new THREE.Line(geo, new THREE.LineBasicMaterial({
    color: 0x00e5ff, transparent: true, opacity: 0.55
  }));
  line.frustumCulled = false;
  return line;
}

/* ---------------- target setup ---------------- */
function setupTarget() {
  var b = B();
  var scene = b.scene;
  var cp = camPos();
  var iss = findISS();
  if (iss) {
    // Ring floats just off the ISS, facing where the player starts.
    var c = iss.group.position.clone();
    var n = cp.clone().sub(c);
    n.y = 0;
    if (n.lengthSq() < 1e-4) n.set(0, 0, 1);
    n.normalize();
    G.portN.copy(n);
    G.ringGroup = buildRing();
    G.ringGroup.position.copy(c).addScaledVector(n, 0.42);
    G.ringGroup.lookAt(c.clone().addScaledVector(n, 2));
    scene.add(G.ringGroup);
    G.port.copy(G.ringGroup.position).addScaledVector(n, 0.16);
    G.outpost = null;
  } else {
    // Spawn a target outpost ~1.5 m in front of the camera.
    var dir = camDir();
    dir.y = 0;
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
    dir.normalize();
    var center = cp.clone().addScaledVector(dir, 1.5);
    center.y = cp.y - 0.25;
    G.outpost = buildOutpost();
    G.outpost.position.copy(center);
    G.outpost.lookAt(cp.x, center.y, cp.z); // local +Z faces the player
    scene.add(G.outpost);
    G.portN.set(0, 0, 1).applyQuaternion(G.outpost.quaternion).normalize();
    G.ringGroup = buildRing();
    // matrixWorld is not updated yet this early, so place the ring manually
    // along the outpost's approach axis instead of transforming local coords.
    G.ringGroup.position.copy(center).addScaledVector(G.portN, 0.32);
    G.ringGroup.quaternion.copy(G.outpost.quaternion);
    scene.add(G.ringGroup);
    G.port.copy(G.ringGroup.position).addScaledVector(G.portN, 0.16);
  }
}

function setupCapsule() {
  var b = B();
  var cp = camPos();
  var dir = camDir();
  G.capsule = buildCapsule();
  G.capsule.position.copy(cp).addScaledVector(dir, 0.75);
  G.capsule.position.y = cp.y - 0.12;
  // Start with the nose pointing at the port (horizontal).
  var toPort = G.port.clone().sub(G.capsule.position);
  G.yaw = Math.atan2(toPort.x, toPort.z);
  G.capsule.rotation.set(0, G.yaw, 0);
  G.vel.set(0, 0, 0);
  G.yawDir = 0;
  G.thrustFlash = 0;
  b.scene.add(G.capsule);
  G.guide = buildGuide();
  b.scene.add(G.guide);
}

/* ---------------- HUD (DOM overlay) ---------------- */
var HUD_CSS = [
  'position:fixed', 'z-index:80', 'background:rgba(3,12,24,.92)',
  'border:1px solid rgba(0,229,255,.5)', 'border-radius:14px',
  'padding:10px 12px', 'color:#eaffff', 'font-size:.72rem',
  'user-select:none', '-webkit-user-select:none'
].join(';');
var BTN_CSS = [
  'background:rgba(0,229,255,.14)', 'border:1px solid rgba(0,229,255,.55)',
  'border-radius:12px', 'color:#eaffff', 'font-weight:800',
  'cursor:pointer', 'touch-action:none', 'user-select:none', '-webkit-user-select:none'
].join(';');

function ensureHud() {
  var h = document.getElementById('ar-dock-hud');
  if (h) return h;
  h = document.createElement('div');
  h.id = 'ar-dock-hud';
  h.className = 'hud'; // taps on .hud never double-fire 3D selection
  h.setAttribute('role', 'status');
  h.setAttribute('aria-label', 'Docking game status');
  h.style.cssText = HUD_CSS + ';top:10px;left:10px;display:none;min-width:150px';
  h.innerHTML =
    '<div style="font-weight:800;font-size:.8rem;margin-bottom:4px">🎮 Docking</div>' +
    '<div id="ar-dock-timer" style="font-variant-numeric:tabular-nums">⏱ 0:00.0</div>' +
    '<div style="margin-top:6px;font-size:.62rem;color:#8fd8ef">SPEED</div>' +
    '<div style="height:8px;border-radius:99px;background:rgba(0,229,255,.15);overflow:hidden">' +
      '<div id="ar-dock-speedbar" style="height:100%;width:0%;background:#00e5ff;border-radius:99px"></div>' +
    '</div>' +
    '<div id="ar-dock-dist" style="margin-top:4px;color:#8fd8ef">📏 —</div>' +
    '<div id="ar-dock-warn" style="display:none;margin-top:4px;font-weight:800;color:#ffb300">🐢 SLOW DOWN!</div>' +
    '<div id="ar-dock-best" style="margin-top:4px;font-size:.62rem;color:#8fd8ef"></div>' +
    '<button id="ar-dock-quit" style="' + BTN_CSS + ';margin-top:8px;width:100%;padding:8px">✖ Quit</button>';
  document.body.appendChild(h);
  document.getElementById('ar-dock-quit').onclick = function () { stop(false); };

  // Yaw pad: two big buttons, bottom-right.
  var y = document.createElement('div');
  y.id = 'ar-dock-yaw';
  y.className = 'hud';
  y.setAttribute('aria-label', 'Turn your capsule');
  y.style.cssText = 'position:fixed;z-index:80;right:10px;bottom:110px;display:none;gap:10px;' +
    'user-select:none;-webkit-user-select:none';
  y.style.display = 'none';
  y.innerHTML =
    '<button id="ar-dock-left" aria-label="Turn left" style="' + BTN_CSS + ';width:64px;height:64px;font-size:1.4rem">◀</button>' +
    '<button id="ar-dock-right" aria-label="Turn right" style="' + BTN_CSS + ';width:64px;height:64px;font-size:1.4rem">▶</button>';
  document.body.appendChild(y);
  bindHold(document.getElementById('ar-dock-left'), -1);
  bindHold(document.getElementById('ar-dock-right'), 1);
  return h;
}
function bindHold(btn, dir) {
  function on(e) { if (e) e.preventDefault(); G.yawDir = dir; }
  function off() { if (G.yawDir === dir) G.yawDir = 0; }
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointercancel', off);
  btn.addEventListener('pointerleave', off);
  btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}
function showHudBits() {
  ensureHud();
  document.getElementById('ar-dock-hud').style.display = 'block';
  var y = document.getElementById('ar-dock-yaw');
  y.style.display = 'flex';
  updateBestLine();
}
function hideHudBits() {
  var h = document.getElementById('ar-dock-hud');
  if (h) h.style.display = 'none';
  var y = document.getElementById('ar-dock-yaw');
  if (y) y.style.display = 'none';
}
function updateBestLine() {
  var el = document.getElementById('ar-dock-best');
  if (el) el.textContent = G.best != null ? ('🏆 Best: ' + fmtTime(G.best)) : '🏆 Best: —';
}
function updateHud() {
  var t = document.getElementById('ar-dock-timer');
  if (t) t.textContent = '⏱ ' + fmtTime(G.elapsed);
  var bar = document.getElementById('ar-dock-speedbar');
  if (bar) {
    var sp = G.vel.length();
    bar.style.width = Math.min(100, (sp / MAX_SPEED) * 100).toFixed(0) + '%';
    bar.style.background = sp > MAX_DOCK_SPEED ? '#ffb300' : '#00e5ff';
  }
  var d = document.getElementById('ar-dock-dist');
  var dist = G.capsule ? G.capsule.position.distanceTo(G.port) : 0;
  if (d) d.textContent = '📏 ' + dist.toFixed(1) + ' m to the ring';
  var w = document.getElementById('ar-dock-warn');
  if (w) w.style.display = (dist < WARN_DIST && G.vel.length() > MAX_DOCK_SPEED) ? 'block' : 'none';
}

/* ---------------- tutorial + win overlays ---------------- */
function ensureTutorial() {
  var t = document.getElementById('ar-dock-tutorial');
  if (t) return t;
  t = document.createElement('div');
  t.id = 'ar-dock-tutorial';
  t.className = 'hud';
  t.setAttribute('role', 'dialog');
  t.setAttribute('aria-label', 'Docking game how to play');
  t.style.cssText = HUD_CSS +
    ';left:50%;top:50%;transform:translate(-50%,-50%);display:none;' +
    'max-width:min(340px,86vw);text-align:left';
  t.innerHTML =
    '<div style="font-weight:800;font-size:1rem;margin-bottom:8px">🎮 Docking Game</div>' +
    '<div style="font-size:.8rem;line-height:1.5;color:#d7f6ff">' +
      'Fly your capsule into the <b style="color:#00e5ff">glowing ring</b>!<br><br>' +
      '👆 <b>DRAG</b> anywhere to push your capsule<br>' +
      '🐢 Go <b>SLOW</b> near the ring — ease in gently!<br>' +
      '🎯 Point your nose at the ring, then drift in<br>' +
      '◀ ▶ buttons turn your capsule' +
    '</div>' +
    '<button id="ar-dock-launch" style="' + BTN_CSS + ';margin-top:12px;width:100%;padding:12px;font-size:.9rem">🚀 Launch!</button>' +
    '<div style="margin-top:8px;font-size:.6rem;color:#8fd8ef;text-align:center">Add Interactive Studio · NEXUS</div>';
  document.body.appendChild(t);
  document.getElementById('ar-dock-launch').onclick = launch;
  return t;
}
function ensureWin() {
  var w = document.getElementById('ar-dock-win');
  if (w) return w;
  w = document.createElement('div');
  w.id = 'ar-dock-win';
  w.className = 'hud';
  w.setAttribute('role', 'dialog');
  w.setAttribute('aria-label', 'Docked!');
  w.style.cssText = HUD_CSS +
    ';left:50%;top:50%;transform:translate(-50%,-50%);display:none;' +
    'max-width:min(320px,86vw);text-align:center';
  w.innerHTML =
    '<div style="font-size:2rem">🎉</div>' +
    '<div style="font-weight:800;font-size:1.05rem;margin:6px 0">DOCKED! Amazing flying, cadet!</div>' +
    '<div id="ar-dock-wintime" style="font-size:.85rem;color:#d7f6ff"></div>' +
    '<div id="ar-dock-winbest" style="font-size:.75rem;color:#8fd8ef;margin-top:4px"></div>' +
    '<div style="display:flex;gap:8px;margin-top:12px">' +
      '<button id="ar-dock-again" style="' + BTN_CSS + ';flex:1;padding:10px">🔁 Fly again</button>' +
      '<button id="ar-dock-done" style="' + BTN_CSS + ';flex:1;padding:10px">✓ Done</button>' +
    '</div>' +
    '<div style="margin-top:8px;font-size:.6rem;color:#8fd8ef">Add Interactive Studio · NEXUS</div>';
  document.body.appendChild(w);
  document.getElementById('ar-dock-again').onclick = function () {
    hideWin();
    start();
  };
  document.getElementById('ar-dock-done').onclick = function () { stop(false); };
  return w;
}
function showWin(time, isBest) {
  var w = ensureWin();
  document.getElementById('ar-dock-wintime').textContent = '⏱ Time: ' + fmtTime(time);
  document.getElementById('ar-dock-winbest').textContent =
    isBest ? '🏆 NEW BEST TIME!' : (G.best != null ? '🏆 Best: ' + fmtTime(G.best) : '');
  w.style.display = 'block';
}
function hideWin() {
  var w = document.getElementById('ar-dock-win');
  if (w) w.style.display = 'none';
}

/* ---------------- thrust input (canvas drag, capture phase) ---------------- */
function canvasEl() {
  var b = B();
  return b && b.renderer ? b.renderer.domElement : null;
}
function claimCanvas() {
  var c = canvasEl();
  if (!c || c._arDockClaim) return;
  c._arDockClaim = true;
  c.style.touchAction = 'none';
  // Capture phase: fires before ar-placement's bubble-phase gesture
  // handlers on the same canvas, so thrust drags never spin models.
  c.addEventListener('pointerdown', dDown, { capture: true });
  c.addEventListener('pointermove', dMove, { capture: true });
  c.addEventListener('pointerup', dUp, { capture: true });
  c.addEventListener('pointercancel', dUp, { capture: true });
}
function releaseCanvas() {
  var c = canvasEl();
  if (!c || !c._arDockClaim) return;
  c._arDockClaim = false;
  c.style.touchAction = '';
  c.removeEventListener('pointerdown', dDown, { capture: true });
  c.removeEventListener('pointermove', dMove, { capture: true });
  c.removeEventListener('pointerup', dUp, { capture: true });
  c.removeEventListener('pointercancel', dUp, { capture: true });
  G.dragId = null;
}
function thrustBasis() {
  // Camera-relative screen-plane axes in world space.
  var fwd = camDir(new THREE.Vector3());
  var up = B().camera.up;
  var right = new THREE.Vector3().crossVectors(fwd, up);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();
  var upv = new THREE.Vector3().crossVectors(right, fwd).normalize();
  return { right: right, up: upv };
}
function dDown(e) {
  if (!G.playing || G.state !== 'playing') return;
  if (G.dragId !== null) return; // one thrust finger at a time
  G.dragId = e.pointerId;
  G.lastX = e.clientX; G.lastY = e.clientY;
  e.stopImmediatePropagation();
  if (e.cancelable) e.preventDefault();
}
function dMove(e) {
  if (e.pointerId !== G.dragId || !G.playing || G.state !== 'playing') return;
  var dx = e.clientX - G.lastX, dy = e.clientY - G.lastY;
  G.lastX = e.clientX; G.lastY = e.clientY;
  if (dx === 0 && dy === 0) { e.stopImmediatePropagation(); return; }
  var ax = thrustBasis();
  G.vel.addScaledVector(ax.right, dx * THRUST_PX);
  G.vel.addScaledVector(ax.up, -dy * THRUST_PX);
  G.thrustFlash = 1;
  e.stopImmediatePropagation();
  if (e.cancelable) e.preventDefault();
}
function dUp(e) {
  if (e.pointerId !== G.dragId) return;
  G.dragId = null;
  e.stopImmediatePropagation();
}

/* ---------------- confetti burst ---------------- */
function burst(at) {
  teardownParticles();
  var n = 160;
  var pos = new Float32Array(n * 3);
  var col = new Float32Array(n * 3);
  var vels = [];
  var palette = [0x00e5ff, 0xffd54f, 0xff6f91, 0x9dff6e, 0xffffff, 0xffa726];
  var c = new THREE.Color();
  for (var i = 0; i < n; i++) {
    pos[i * 3] = at.x; pos[i * 3 + 1] = at.y; pos[i * 3 + 2] = at.z;
    c.setHex(palette[i % palette.length]);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    var th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    var sp = 0.4 + Math.random() * 0.9;
    vels.push(new THREE.Vector3(
      Math.sin(ph) * Math.cos(th) * sp,
      Math.abs(Math.cos(ph)) * sp * 0.9 + 0.25,
      Math.sin(ph) * Math.sin(th) * sp
    ));
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  var mat = new THREE.PointsMaterial({
    size: 0.022, vertexColors: true, transparent: true, opacity: 1, depthWrite: false
  });
  var pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  B().scene.add(pts);
  G.particles = { pts: pts, vels: vels, life: 0 };
}
function updateParticles(dt) {
  var P = G.particles;
  if (!P) return;
  P.life += dt;
  var arr = P.pts.geometry.attributes.position.array;
  for (var i = 0; i < P.vels.length; i++) {
    var v = P.vels[i];
    v.multiplyScalar(Math.max(0, 1 - 0.9 * dt));
    v.y -= 0.25 * dt;
    arr[i * 3] += v.x * dt;
    arr[i * 3 + 1] += v.y * dt;
    arr[i * 3 + 2] += v.z * dt;
  }
  P.pts.geometry.attributes.position.needsUpdate = true;
  P.pts.material.opacity = Math.max(0, 1 - P.life / 2.2);
  if (P.life > 2.4) teardownParticles();
}
function teardownParticles() {
  var P = G.particles;
  G.particles = null;
  if (!P) return;
  if (P.pts.parent) P.pts.parent.remove(P.pts);
  P.pts.geometry.dispose();
  P.pts.material.dispose();
}

/* ---------------- per-frame update (runs after the base onFrame) ---------------- */
function noseDir(out) {
  out = out || new THREE.Vector3();
  return out.set(Math.sin(G.yaw), 0, Math.cos(G.yaw));
}
function updateGuide() {
  if (!G.guide || !G.capsule) return;
  var a = G.guide.geometry.attributes.position.array;
  var tip = noseDir(new THREE.Vector3()).multiplyScalar(0.17).add(G.capsule.position);
  a[0] = tip.x; a[1] = tip.y; a[2] = tip.z;
  a[3] = G.ringGroup.position.x; a[4] = G.ringGroup.position.y; a[5] = G.ringGroup.position.z;
  G.guide.geometry.attributes.position.needsUpdate = true;
  var toPort = G.port.clone().sub(G.capsule.position);
  var dist = toPort.length();
  var sp = G.vel.length();
  var ang = noseDir(new THREE.Vector3()).angleTo(toPort.normalize());
  var good = dist < WARN_DIST && sp <= MAX_DOCK_SPEED && ang < ALIGN_RAD;
  var hot = dist < WARN_DIST && sp > MAX_DOCK_SPEED;
  G.guide.material.color.setHex(good ? 0x9dff6e : (hot ? 0xffb300 : 0x00e5ff));
}
function pulseRing(now) {
  if (!G.ringGroup) return;
  var s = 1 + 0.07 * Math.sin(now * 0.006);
  G.ringGroup.scale.setScalar(s);
  var u = G.ringGroup.userData;
  if (u.disc) u.disc.material.opacity = 0.12 + 0.08 * Math.sin(now * 0.006);
}
function checkWin() {
  var toPort = G.port.clone().sub(G.capsule.position);
  var dist = toPort.length();
  if (dist > DOCK_DIST) return;
  if (G.vel.length() > MAX_DOCK_SPEED) return;
  // Must be on the approach side of the ring plane.
  var side = G.capsule.position.clone().sub(G.ringGroup.position).dot(G.portN);
  if (side < 0) return;
  // Nose roughly pointing at the port.
  var ang = noseDir(new THREE.Vector3()).angleTo(toPort.normalize());
  if (ang > ALIGN_RAD) return;
  // DOCKED!
  G.state = 'won';
  G.playing = false;
  releaseCanvas();
  var isBest = G.best == null || G.elapsed < G.best;
  if (isBest) { G.best = G.elapsed; writeBest(G.best); }
  updateBestLine();
  burst(G.port);
  toast(isBest ? '🎉 DOCKED! New best time — amazing flying, cadet!' : '🎉 DOCKED! Amazing flying, cadet!');
  showWin(G.elapsed, isBest);
}
function dockFrame() {
  if (!G.playing) { updateParticles(0.016); return; }
  if (!isARActive()) return;
  var now = performance.now();
  var dt = G.lastT ? Math.min((now - G.lastT) / 1000, 0.1) : 0; // clamp stalls
  G.lastT = now;
  pulseRing(now);
  updateParticles(dt);
  if (G.state !== 'playing' || dt <= 0 || !G.capsule) return;
  // Yaw from the ◀ ▶ buttons.
  if (G.yawDir !== 0) {
    G.yaw += G.yawDir * YAW_RATE * dt;
    G.capsule.rotation.y = G.yaw;
  }
  // Arcade drift: damped velocity, no gravity.
  G.vel.multiplyScalar(Math.exp(-DAMP * dt));
  var sp = G.vel.length();
  if (sp > MAX_SPEED) G.vel.multiplyScalar(MAX_SPEED / sp);
  G.capsule.position.addScaledVector(G.vel, dt);
  // Thruster flame flicker.
  var flame = G.capsule.userData.flame;
  if (flame) {
    G.thrustFlash = Math.max(0, G.thrustFlash - dt * 4);
    flame.visible = G.thrustFlash > 0;
    if (flame.visible) flame.scale.set(1, 1, 0.7 + Math.random() * 0.7);
  }
  G.elapsed = (now - G.t0) / 1000;
  updateHud();
  updateGuide();
  checkWin();
}

/* ---------------- public game API ---------------- */
function launch() {
  if (!G.playing || G.state !== 'briefing') return;
  var t = document.getElementById('ar-dock-tutorial');
  if (t) t.style.display = 'none';
  G.state = 'playing';
  G.t0 = performance.now();
  G.lastT = 0;
  updateHud();
  toast('🐢 Drag to thrust — ease into the ring SLOWLY!');
}

function start() {
  if (G.playing) { toast('Already flying your capsule! 🎮'); return true; }
  var b = B();
  if (!isARActive()) { toast('Start AR first, then play Docking 🎮'); return false; }
  teardown(); // clean slate (e.g. after a previous quit)
  G.best = readBest();
  setupTarget();
  setupCapsule();
  if (!G.capsule || !G.ringGroup) { teardown(); toast('Could not set up the game — try again'); return false; }
  G.playing = true;
  G.state = 'briefing';
  G.elapsed = 0;
  ensureHud();
  showHudBits();
  ensureTutorial().style.display = 'block';
  claimCanvas();
  syncPickerBtn();
  return true;
}

function stop(silent) {
  var was = G.playing;
  teardown();
  G.playing = false;
  G.state = 'idle';
  syncPickerBtn();
  if (!silent && was) toast('Docking game over — nice flying! 🚀');
}

function isPlaying() { return G.playing; }

function teardown() {
  releaseCanvas();
  hideHudBits();
  hideWin();
  var t = document.getElementById('ar-dock-tutorial');
  if (t) t.style.display = 'none';
  var b = B();
  function drop(obj) {
    if (!obj) return;
    if (obj.parent) obj.parent.remove(obj);
    obj.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        var mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(function (m) { m.dispose(); });
      }
    });
  }
  drop(G.capsule); G.capsule = null;
  drop(G.ringGroup); G.ringGroup = null;
  drop(G.outpost); G.outpost = null; // only non-null when we spawned it
  drop(G.guide); G.guide = null;
  teardownParticles();
  G.vel.set(0, 0, 0);
  G.yawDir = 0;
  G.dragId = null;
}

function syncPickerBtn() {
  var btn = document.getElementById('ar-fun-dock');
  if (!btn) return; // coordinator adds the picker button later
  btn.textContent = G.playing ? '🎮 Dock: flying' : '🎮 Dock';
}

/* ---------------- wrapped session lifecycle ---------------- */
function dockSessionStart() {
  // Fresh session: make sure no stale game objects linger.
  if (G.playing) stop(true);
  else teardown();
  syncPickerBtn();
}
function dockSessionEnd() {
  if (G.playing) stop(true);
  else teardown();
}

/* ---------------- install (guarded startup) ---------------- */
function install() {
  var AP = window.ARPlacement;
  if (!AP || typeof AP.onFrame !== 'function' ||
      typeof AP.onSessionStart !== 'function' ||
      typeof AP.onSessionEnd !== 'function') {
    return false;
  }
  var _onFrame = AP.onFrame.bind(AP);
  AP.onFrame = function (frame) { _onFrame(frame); dockFrame(frame); };
  var _onStart = AP.onSessionStart.bind(AP);
  AP.onSessionStart = function (session) { _onStart(session); dockSessionStart(session); };
  var _onEnd = AP.onSessionEnd.bind(AP);
  AP.onSessionEnd = function () { _onEnd(); dockSessionEnd(); };

  window.ARFun = window.ARFun || {};
  window.ARFun.docking = {
    start: start,
    stop: stop,
    isPlaying: isPlaying
  };

  G.best = readBest();
  syncPickerBtn();
  return true;
}

if (!install()) {
  var tries = 0;
  var bootTimer = setInterval(function () {
    tries++;
    if (install() || tries >= 20) clearInterval(bootTimer);
  }, 500);
}

// Desktop convenience: arrow keys yaw while playing (AR itself needs a phone).
document.addEventListener('keydown', function (e) {
  if (!G.playing || G.state !== 'playing') return;
  if (e.key === 'ArrowLeft') G.yawDir = -1;
  else if (e.key === 'ArrowRight') G.yawDir = 1;
});
document.addEventListener('keyup', function (e) {
  if (e.key === 'ArrowLeft' && G.yawDir === -1) G.yawDir = 0;
  if (e.key === 'ArrowRight' && G.yawDir === 1) G.yawDir = 0;
});
