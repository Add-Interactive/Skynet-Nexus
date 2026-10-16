/* Space Center AR — ar-replay.js
   Fun pack: MISSION REPLAY ("relive the great moments, right in your room").
   Loads AFTER ar-placement.js as <script type="module">.

   - Exposes window.ARFun.replay = { open(), close(), play('apollo11'|'hubble'|'jwst') }
   - open(): DOM-overlay mission chooser (big kid-simple cards).
   - play(key): spawns a self-contained replay stage in the AR scene — a scripted
     ~60-90 s moment from real space history with caption cards of REAL facts
     (dates/names verified against NASA). No persistent anchors: the stage lives
     only while a replay is open and is removed on close()/session end.
   - Animation is a PURE FUNCTION of timeline time t (keyframe helper kf), so the
     DOM timeline scrubber can drag back and forth freely. No accumulated state.
   - Kid-safe: no prompt()/alert()/confirm() anywhere; plain tap UI only.
   - No WebXR calls of its own — scene-graph only, driven from the wrapped
     ARPlacement.onFrame (same pattern as ar-orbit.js).
*/

import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/addons/loaders/GLTFLoader.js';

function B() { return window.__scB || null; }
function toast(msg) { var b = B(); if (b && b.toast) b.toast(msg); }
function isARActive() { var b = B(); return !!(b && b.ar && b.ar.isActive && b.ar.isActive()); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ---------- keyframes: a value as a pure function of time t (scrub-safe) ----------
   frames: [[t0,v0],[t1,v1],...] sorted by t. Smoothstep easing between keys. */
function kf(frames, t) {
  if (t <= frames[0][0]) return frames[0][1];
  for (var i = 1; i < frames.length; i++) {
    if (t <= frames[i][0]) {
      var t0 = frames[i - 1][0], v0 = frames[i - 1][1];
      var t1 = frames[i][0], v1 = frames[i][1];
      var u = (t - t0) / Math.max(1e-6, t1 - t0);
      u = u < 0 ? 0 : (u > 1 ? 1 : u);
      u = u * u * (3 - 2 * u);
      return v0 + (v1 - v0) * u;
    }
  }
  return frames[frames.length - 1][1];
}
function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

/* ---------- three.js helpers ---------- */
function mat(color, o) {
  var opts = { color: color, roughness: 0.75, metalness: 0.15 };
  if (o) for (var k in o) opts[k] = o[k];
  return new THREE.MeshStandardMaterial(opts);
}
function box(w, h, d, c, o) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, o)); }
function cyl(rt, rb, h, c, seg, o) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 16), mat(c, o));
}
function sph(r, c, o, ws, hs) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, ws || 24, hs || 18), mat(c, o));
}
function starField(n, r) {
  var g = new THREE.BufferGeometry();
  var pos = new Float32Array(n * 3);
  for (var i = 0; i < n; i++) {
    var v = new THREE.Vector3().randomDirection().multiplyScalar(r);
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.025, sizeAttenuation: true }));
}
function normalize(group, targetSize) {
  var b3 = new THREE.Box3().setFromObject(group);
  var size = new THREE.Vector3(); b3.getSize(size);
  var center = new THREE.Vector3(); b3.getCenter(center);
  var s = targetSize / (Math.max(size.x, size.y, size.z) || 1);
  var inner = new THREE.Group(); inner.add(group);
  group.position.sub(center);
  inner.scale.setScalar(s);
  return inner;
}

/* ---------- Hubble GLB (existing model-loader pattern, own GLTFLoader) ---------- */
var loader = new GLTFLoader();
var modelsCache = null;
function getModels() {
  if (modelsCache) return modelsCache;
  modelsCache = fetch('/api/models').then(function (r) { return r.json(); }).then(function (d) {
    return Array.isArray(d) ? d : (d.models || []);
  }).catch(function () { return []; });
  return modelsCache;
}
function loadHubbleGlb() {
  return getModels().then(function (list) {
    var m = null;
    for (var i = 0; i < list.length; i++) {
      var hay = ((list[i].name || '') + ' ' + (list[i].id || '')).toLowerCase();
      if (hay.indexOf('hubble') !== -1) { m = list[i]; break; }
    }
    if (!m) return null;
    var url = m.modelUrl || m.fileUrl;
    if (!url) return null;
    return new Promise(function (res) {
      loader.load(url, function (gltf) { res(gltf.scene); }, undefined, function () { res(null); });
    });
  });
}

/* ---------- procedural builders ---------- */
function buildLander() {
  var g = new THREE.Group();
  var gold = { color: 0xd9a41b, metalness: 0.65, roughness: 0.35 };
  var descent = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.34, 0.16, 8), mat(0xffffff, gold));
  descent.position.y = 0.42;
  g.add(descent);
  for (var i = 0; i < 4; i++) {
    var a = i * Math.PI / 2 + Math.PI / 4;
    var leg = cyl(0.02, 0.02, 0.5, 0xbbbbbb, 8);
    leg.position.set(Math.cos(a) * 0.33, 0.21, Math.sin(a) * 0.33);
    leg.rotation.z = Math.cos(a) * 0.55;
    leg.rotation.x = -Math.sin(a) * 0.55;
    g.add(leg);
    var pad = cyl(0.07, 0.07, 0.02, 0x999999, 12);
    pad.position.set(Math.cos(a) * 0.47, 0.015, Math.sin(a) * 0.47);
    g.add(pad);
  }
  var asc = box(0.34, 0.26, 0.34, 0xe8e8e8, { metalness: 0.3, roughness: 0.5 });
  asc.position.y = 0.63;
  g.add(asc);
  var win = box(0.1, 0.08, 0.02, 0x123a5c, { metalness: 0.6, roughness: 0.2 });
  win.position.set(0.08, 0.66, 0.175); g.add(win);
  var win2 = win.clone(); win2.position.x = -0.08; g.add(win2);
  var mast = cyl(0.015, 0.015, 0.25, 0xbbbbbb, 8);
  mast.position.set(-0.24, 0.74, 0); g.add(mast);
  var dish = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.05, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xdddddd, side: THREE.DoubleSide, roughness: 0.6 })
  );
  dish.position.set(-0.2, 0.88, 0); dish.rotation.z = -0.6;
  g.add(dish);
  return g;
}
function buildAstronaut() {
  var g = new THREE.Group();
  var body = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.16, 6, 12), mat(0xf2f2f2, { roughness: 0.6 }));
  body.position.y = 0.24; g.add(body);
  var helm = sph(0.085, 0xffffff, { roughness: 0.4 }, 16, 12);
  helm.position.y = 0.44; g.add(helm);
  var visor = sph(0.07, 0xc8862a, { metalness: 0.8, roughness: 0.25 }, 16, 12);
  visor.scale.set(1, 0.7, 0.6); visor.position.set(0, 0.44, 0.045); g.add(visor);
  var pack = box(0.16, 0.2, 0.1, 0xdddddd, {});
  pack.position.set(0, 0.28, -0.14); g.add(pack);
  return g;
}
function buildFlag() {
  var g = new THREE.Group();
  var pole = cyl(0.012, 0.012, 0.52, 0xcccccc, 8);
  pole.position.y = 0.26; g.add(pole);
  var cvs = document.createElement('canvas');
  cvs.width = 65; cvs.height = 39;
  var x = cvs.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 65, 39);
  x.fillStyle = '#c0392b';
  for (var i = 0; i < 13; i += 2) x.fillRect(0, i * 3, 65, 3);
  x.fillStyle = '#2c3e70'; x.fillRect(0, 0, 26, 21);
  var tex = new THREE.CanvasTexture(cvs);
  var flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.18),
    new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 })
  );
  flag.position.set(0.165, 0.42, 0);
  g.add(flag);
  g.userData.flag = flag;
  return g;
}
function buildMoon() {
  var g = new THREE.Group();
  var moon = sph(1.0, 0x9a9a9a, { roughness: 1, metalness: 0 }, 40, 28);
  moon.position.y = -1.0;
  g.add(moon);
  // a few darker craters near the top (static, deterministic)
  var craters = [[0.3, 0.2, 0.10], [-0.4, -0.1, 0.14], [0.05, -0.45, 0.08], [-0.15, 0.45, 0.07], [0.55, -0.25, 0.06]];
  for (var i = 0; i < craters.length; i++) {
    var c = new THREE.Mesh(
      new THREE.CircleGeometry(craters[i][2], 20),
      new THREE.MeshStandardMaterial({ color: 0x7c7c7c, roughness: 1 })
    );
    c.position.set(craters[i][0], -0.02, craters[i][1]);
    c.rotation.x = -Math.PI / 2 + craters[i][0] * 0.5;
    c.rotation.z = craters[i][1] * 0.5;
    g.add(c);
  }
  return g;
}
function buildShuttle() {
  var g = new THREE.Group();
  var fuse = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.7, 6, 14), mat(0xf0f0f0, {}));
  fuse.rotation.z = Math.PI / 2; g.add(fuse);
  var wingL = box(0.5, 0.03, 0.34, 0xe2e2e2, {});
  wingL.position.set(-0.1, 0, 0.32); wingL.rotation.x = 0.12; g.add(wingL);
  var wingR = wingL.clone(); wingR.position.z = -0.32; wingR.rotation.x = -0.12; g.add(wingR);
  var tail = box(0.28, 0.34, 0.03, 0xe2e2e2, {});
  tail.position.set(-0.4, 0.22, 0); tail.rotation.z = 0.25; g.add(tail);
  for (var i = -1; i <= 1; i++) {
    var e = cyl(0.06, 0.09, 0.16, 0x555555, 12);
    e.rotation.z = Math.PI / 2; e.position.set(-0.56, 0, i * 0.11); g.add(e);
  }
  var bay = box(0.7, 0.02, 0.2, 0x8a8a8a, {});
  bay.position.set(0, 0.16, 0); g.add(bay);
  return g;
}
function buildHubbleProc() {
  // Procedural fallback if the Hubble GLB is unavailable.
  var g = new THREE.Group();
  var tube = cyl(0.14, 0.14, 0.7, 0xd8d8d8, 20);
  tube.rotation.z = Math.PI / 2; g.add(tube);
  var ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 10, 24), mat(0x999999, { metalness: 0.5 }));
  ring.rotation.y = Math.PI / 2; ring.position.x = 0.36; g.add(ring);
  var aft = cyl(0.15, 0.15, 0.08, 0xbbbbbb, 20);
  aft.rotation.z = Math.PI / 2; aft.position.x = -0.38; g.add(aft);
  var panels = new THREE.Group();
  var p1 = box(0.52, 0.015, 0.24, 0x1a4d8f, { metalness: 0.4, roughness: 0.4 });
  p1.position.x = -0.44; panels.add(p1);
  var p2 = p1.clone(); p2.position.x = 0.44; panels.add(p2);
  g.add(panels);
  g.userData.panels = panels;
  return g;
}
function buildJWST() {
  var g = new THREE.Group();
  var refs = { layers: [], booms: [] };
  var bus = box(0.22, 0.16, 0.16, 0xcfcfcf, {});
  bus.position.y = 0.02; g.add(bus);
  // primary mirror: center hex + two fold-out wings
  function hex(r) {
    return new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 6), mat(0xd4af37, { metalness: 0.85, roughness: 0.25 }));
  }
  var tower = new THREE.Group(); tower.position.y = 0.14; g.add(tower);
  var backplane = box(0.5, 0.03, 0.28, 0x555555, {});
  tower.add(backplane);
  tower.add(hex(0.11));
  var wingL = new THREE.Group(); wingL.position.x = -0.115;
  var wl = hex(0.11); wl.position.x = -0.1; wingL.add(wl);
  tower.add(wingL);
  var wingR = new THREE.Group(); wingR.position.x = 0.115;
  var wr = hex(0.11); wr.position.x = 0.1; wingR.add(wr);
  tower.add(wingR);
  refs.wingL = wingL; refs.wingR = wingR;
  // secondary mirror on its tripod (pops up later)
  var tri = new THREE.Group();
  for (var s = 0; s < 3; s++) {
    var a = s * Math.PI * 2 / 3;
    var strut = cyl(0.012, 0.012, 0.34, 0x999999, 8);
    strut.position.set(Math.cos(a) * 0.09, 0.17, Math.sin(a) * 0.09);
    strut.rotation.z = Math.cos(a) * 0.28;
    strut.rotation.x = -Math.sin(a) * 0.28;
    tri.add(strut);
  }
  var sec = sph(0.05, 0xd4af37, { metalness: 0.85, roughness: 0.25 }, 16, 12);
  sec.scale.y = 0.4; sec.position.y = 0.34; tri.add(sec);
  tri.position.y = 0.14;
  g.add(tri);
  refs.tri = tri;
  // 5 sunshield layers (kite-ish, shrinking toward the telescope)
  for (var i = 0; i < 5; i++) {
    var w = 1.5 - i * 0.12;
    var layer = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w * 0.66),
      new THREE.MeshStandardMaterial({
        color: 0xc9a227, metalness: 0.7, roughness: 0.35,
        side: THREE.DoubleSide, transparent: true, opacity: 0.92
      })
    );
    layer.rotation.x = -Math.PI / 2;
    layer.position.y = -0.12 - i * 0.035;
    g.add(layer);
    refs.layers.push(layer);
  }
  // mid-booms: extend along +/- x, pulling the layers out
  for (var sd = -1; sd <= 1; sd += 2) {
    var boom = cyl(0.015, 0.015, 0.78, 0xaaaaaa, 8);
    boom.rotation.z = Math.PI / 2;
    boom.userData.side = sd;
    g.add(boom);
    refs.booms.push(boom);
  }
  refs.bus = bus;
  return { group: g, refs: refs };
}
function buildEarthBall(r, c1) {
  var e = sph(r, c1, { roughness: 0.9 }, 32, 24);
  // simple land blobs (deterministic spots)
  var spots = [[0.5, 0.3, 0.22], [-0.6, -0.2, 0.28], [0.1, -0.6, 0.18], [-0.2, 0.65, 0.16]];
  for (var i = 0; i < spots.length; i++) {
    var s = sph(spots[i][2], 0x2e8b57, { roughness: 1 }, 12, 8);
    var v = new THREE.Vector3(spots[i][0], spots[i][1], 0).normalize().multiplyScalar(r * 0.99);
    s.position.copy(v);
    s.scale.z = 0.4;
    e.add(s);
  }
  return e;
}

/* ---------- replay definitions (all facts real, kid-simple copy) ---------- */
function makeDust(n) {
  var g = new THREE.BufferGeometry();
  var pos = new Float32Array(n * 3);
  var dirs = [];
  for (var i = 0; i < n; i++) {
    var a = (i / n) * Math.PI * 2 + (i % 5) * 0.13;
    dirs.push([Math.cos(a), 0.25 + (i % 3) * 0.2, Math.sin(a)]);
    pos[i * 3] = 0; pos[i * 3 + 1] = 0.02; pos[i * 3 + 2] = 0;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  var pts = new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xbbbbbb, size: 0.03, transparent: true, opacity: 0.9
  }));
  pts.userData.dirs = dirs;
  pts.visible = false;
  return pts;
}

var REPLAYS = {
  apollo11: {
    title: 'Apollo 11 — First Steps on the Moon',
    emoji: '🌕',
    dur: 80,
    captions: [
      { t: 0, title: 'July 20, 1969', text: 'The lunar lander Eagle carries Neil Armstrong and Buzz Aldrin down toward the Moon. Michael Collins waits above in the ship Columbia.' },
      { t: 18, title: 'The Eagle has landed!', text: 'Armstrong radios: "Houston, Tranquility Base here. The Eagle has landed." The fuel tank is almost empty!' },
      { t: 31, title: 'One small step', text: 'Hours later, Neil Armstrong climbs down the ladder and becomes the first person to walk on the Moon.' },
      { t: 45, title: 'Buzz joins him', text: 'Buzz Aldrin steps out too. He calls the Moon "magnificent desolation." They explore for about two and a half hours.' },
      { t: 57, title: 'Planting the flag', text: 'They plant an American flag and leave a plaque that says: "We came in peace for all mankind."' },
      { t: 69, title: 'Home again', text: 'On July 24, 1969, all three astronauts splash down safely in the Pacific Ocean. Mission complete!' }
    ],
    build: function () {
      var g = new THREE.Group();
      g.add(starField(220, 8));
      var moon = buildMoon(); g.add(moon);
      var earth = buildEarthBall(0.18, 0x2a7fd4);
      earth.position.set(1.1, 1.7, -2.6); g.add(earth);
      var lander = buildLander(); g.add(lander);
      var dust = makeDust(44); g.add(dust);
      var astroA = buildAstronaut(); astroA.visible = false; g.add(astroA);
      var astroB = buildAstronaut(); astroB.visible = false; g.add(astroB);
      var flag = buildFlag(); flag.visible = false; flag.position.set(1.15, 0, 0.35); g.add(flag);
      var TOUCH = 17;
      function update(t) {
        lander.position.x = kf([[0, -0.6], [TOUCH, 0], [80, 0]], t);
        lander.position.y = kf([[0, 2.3], [TOUCH - 3, 2.3], [TOUCH, 0.46], [80, 0.46]], t);
        // touchdown dust puff
        var dp = (t - TOUCH) / 9;
        dust.visible = dp > 0 && dp < 1;
        if (dust.visible) {
          var p = dust.geometry.attributes.position;
          var dirs = dust.userData.dirs;
          for (var i = 0; i < dirs.length; i++) {
            p.setXYZ(i,
              dirs[i][0] * dp * 1.1,
              0.02 + dirs[i][1] * dp * 0.7,
              dirs[i][2] * dp * 1.1);
          }
          p.needsUpdate = true;
          dust.material.opacity = 0.9 * (1 - dp);
        }
        // astronaut A: moonwalk
        var aIn = kf([[31, 0], [33, 1], [80, 1]], t);
        astroA.visible = aIn > 0;
        astroA.scale.setScalar(Math.max(0.001, aIn));
        astroA.position.set(kf([[33, 0.35], [40, 0.9], [80, 0.9]], t), 0, 0.55);
        astroA.rotation.y = -0.5 + Math.sin(t * 1.4) * 0.08 * aIn;
        // astronaut B joins later
        var bIn = kf([[45, 0], [47, 1], [80, 1]], t);
        astroB.visible = bIn > 0;
        astroB.scale.setScalar(Math.max(0.001, bIn));
        astroB.position.set(0.55, 0, -0.5);
        // flag goes up + waves
        var fIn = kf([[57, 0], [59, 1], [80, 1]], t);
        flag.visible = fIn > 0;
        flag.scale.setScalar(Math.max(0.001, fIn));
        flag.userData.flag.rotation.y = Math.sin(t * 7) * 0.14 * fIn;
        // finale: Earth grows in the sky
        var es = kf([[0, 1], [68, 1], [78, 2.4], [80, 2.4]], t);
        earth.scale.setScalar(es);
      }
      return { group: g, update: update };
    }
  },

  hubble: {
    title: 'Hubble — The Telescope That Sees Everything',
    emoji: '🔭',
    dur: 78,
    captions: [
      { t: 0, title: 'April 24, 1990', text: 'Space Shuttle Discovery blasts off from Florida with the Hubble Space Telescope tucked in its cargo bay.' },
      { t: 12, title: 'In orbit', text: 'Discovery reaches space, about 550 kilometers above Earth — higher than most satellites fly.' },
      { t: 24, title: 'April 25, 1990 — release!', text: 'The shuttle\u2019s robot arm lifts Hubble out and lets it go. Two astronauts wait in spacesuits nearby, ready to help if anything goes wrong.' },
      { t: 38, title: 'Power on', text: 'Hubble\u2019s two solar wings unfold to drink in sunlight — enough power to run a few hair dryers.' },
      { t: 52, title: 'Hubble is free', text: 'Discovery backs away. Hubble is on its own — the sharpest eye on the sky ever launched.' },
      { t: 66, title: 'Still working today', text: 'Astronauts visited Hubble 5 times to fix and upgrade it. It has been taking pictures of the universe for over 35 years!' }
    ],
    build: function () {
      var g = new THREE.Group();
      var refs = {};
      g.add(starField(220, 9));
      var earth = buildEarthBall(2.0, 0x2a7fd4);
      earth.position.y = -3.4; g.add(earth);
      refs.earth = earth;
      var shuttle = buildShuttle(); g.add(shuttle);
      refs.shuttle = shuttle;
      var hubblePivot = new THREE.Group(); g.add(hubblePivot);
      refs.pivot = hubblePivot;
      var proc = buildHubbleProc();
      hubblePivot.add(proc);
      refs.hubble = proc;
      // try the real Hubble GLB from the model library — swap it in if it loads
      var alive = true;
      loadHubbleGlb().then(function (scene) {
        if (!alive || !scene) return;
        hubblePivot.remove(proc);
        var inner = normalize(scene, 0.9);
        refs.hubble = inner;
        hubblePivot.add(inner);
      });
      refs.dispose = function () { alive = false; };
      var REL = 26;
      function shuttleX(t) { return kf([[0, -2.4], [10, -1.2], [24, -1.2], [36, -2.8], [78, -3.6]], t); }
      function update(t) {
        refs.earth.rotation.y = t * 0.04;
        var sx = shuttleX(t);
        shuttle.position.set(sx, 0.4, 0);
        shuttle.rotation.z = kf([[0, 0], [24, 0], [32, -0.18], [78, -0.18]], t);
        var hp = refs.pivot.position;
        if (t < REL) {
          hp.set(sx, 0.82, 0); // riding in the payload bay
          refs.pivot.rotation.set(0, 0, 0);
        } else {
          var u = t - REL;
          hp.set(shuttleX(REL) + u * 0.035, 0.82 + u * 0.012, 0);
          refs.pivot.rotation.y = kf([[REL, 0], [78, 1.5]], t);
        }
        // solar wings unfold (procedural model only; the GLB brings its own)
        if (refs.hubble === proc && proc.userData.panels) {
          proc.userData.panels.scale.x = kf([[0, 0.12], [36, 0.12], [46, 1], [78, 1]], t);
        }
      }
      return { group: g, update: update, dispose: refs.dispose };
    }
  },

  jwst: {
    title: 'JWST — Unfolding the Giant',
    emoji: '✨',
    dur: 78,
    captions: [
      { t: 0, title: 'December 25, 2021', text: 'On Christmas morning, the James Webb Space Telescope launches from South America — folded up like origami inside its rocket.' },
      { t: 14, title: 'December 31 — stretch!', text: 'Two long arms pull Webb\u2019s folded sunshield out to its full size — as big as a tennis court!' },
      { t: 30, title: 'January 4, 2022 — sunshield done', text: 'All 5 thin layers are pulled tight. The sunny side can reach 90\u00B0C while the telescope side chills near \u2013230\u00B0C.' },
      { t: 46, title: 'January 5 — mirror pops up', text: 'Webb\u2019s small round secondary mirror swings into place on its three skinny arms.' },
      { t: 57, title: 'January 8 — gold wings unfold', text: 'The two side wings of Webb\u2019s gold mirror fold out flat. The mirror is 6.5 meters wide — too big for the rocket, so it had to fold!' },
      { t: 69, title: 'January 24 — home at last', text: 'Webb reaches its parking spot 1.5 million km from Earth and starts its mission: seeing the first stars ever born.' }
    ],
    build: function () {
      var g = new THREE.Group();
      g.add(starField(240, 9));
      var sun = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 24, 18),
        new THREE.MeshBasicMaterial({ color: 0xffd76a })
      );
      sun.position.set(3.2, 1.6, -3); g.add(sun);
      var built = buildJWST();
      var jw = built.group, refs = built.refs;
      g.add(jw);
      function update(t) {
        jw.position.x = kf([[0, -1.7], [14, -1.7], [22, -0.6], [78, 0.9]], t);
        jw.position.z = kf([[0, 0], [69, 0], [78, -1.2]], t);
        jw.rotation.y = Math.sin(t * 0.25) * 0.25;
        // mid-booms extend, pulling the folded shield out
        var bs = kf([[0, 0.03], [14, 0.03], [23, 1], [78, 1]], t);
        for (var b = 0; b < refs.booms.length; b++) {
          var boom = refs.booms[b], sd = boom.userData.side;
          boom.scale.x = Math.max(0.001, bs);
          boom.position.set(sd * 0.39 * bs, -0.16, 0);
        }
        // 5 layers unfurl one after another, then tension flat
        for (var i = 0; i < refs.layers.length; i++) {
          var u = kf([[0, 0.06], [30 + i * 2.5, 0.06], [38 + i * 2.5, 1], [78, 1]], t);
          refs.layers[i].scale.set(Math.max(0.001, u), Math.max(0.001, u), 1);
          refs.layers[i].position.y = -0.12 - i * 0.035 * kf([[38, 0.2], [46, 1], [78, 1]], t);
        }
        // secondary mirror pops up on its tripod
        refs.tri.scale.setScalar(Math.max(0.001, kf([[46, 0], [50, 1], [78, 1]], t)));
        // gold mirror wings fold out flat
        var wr = kf([[57, 2.4], [66, 0], [78, 0]], t);
        refs.wingL.rotation.z = wr;
        refs.wingR.rotation.z = -wr;
      }
      return { group: g, update: update };
    }
  }
};

/* ---------- replay engine state ---------- */
var R = { key: null, def: null, group: null, update: null, dispose: null, t: 0, playing: false, scrubbing: false, wasPlaying: false };
var lastFrameT = 0;
var capIdx = -1;

function placeStage(group) {
  var b = B();
  var cp = new THREE.Vector3(), cd = new THREE.Vector3();
  b.camera.getWorldPosition(cp);
  b.camera.getWorldDirection(cd);
  group.position.copy(cp).addScaledVector(cd, 1.4);
  group.position.y = Math.max(group.position.y - 0.1, cp.y - 0.8);
  group.lookAt(cp); // face the viewer (+z toward camera for plain objects)
}

/* ---------- DOM overlay ---------- */
function baseStyle(el, extra) {
  el.className = 'hud'; // taps on .hud never double-fire 3D selection
  el.style.cssText = [
    'position:fixed', 'z-index:90', 'display:none',
    'background:rgba(3,12,24,.94)', 'border:1px solid rgba(0,229,255,.5)',
    'border-radius:14px', 'color:#eaffff', 'padding:12px 14px',
    'font-family:inherit', 'box-sizing:border-box'
  ].join(';') + (extra ? ';' + extra : '');
  return el;
}
function ensureChooser() {
  var p = document.getElementById('ar-replay-panel');
  if (p) return p;
  p = baseStyle(document.createElement('div'), 'left:50%;top:50%;transform:translate(-50%,-50%);width:min(92vw,380px);z-index:95');
  p.id = 'ar-replay-panel';
  p.setAttribute('role', 'dialog');
  p.setAttribute('aria-label', 'Mission Replay — pick a true space story');
  var html = '<div style="font-weight:800;font-size:1rem;margin-bottom:2px">🎬 Mission Replay</div>' +
    '<div style="font-size:.62rem;color:#8fd8ef;margin-bottom:10px">Add Interactive Studio · NEXUS — true stories from space history</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px">';
  var order = ['apollo11', 'hubble', 'jwst'];
  for (var i = 0; i < order.length; i++) {
    var d = REPLAYS[order[i]];
    html += '<button data-replay="' + order[i] + '" style="text-align:left;background:rgba(0,229,255,.08);' +
      'border:1px solid rgba(0,229,255,.35);border-radius:10px;color:#eaffff;padding:10px 12px;cursor:pointer">' +
      '<span style="font-size:1.3rem;margin-right:8px">' + d.emoji + '</span>' +
      '<span style="font-weight:700;font-size:.85rem">' + esc(d.title) + '</span></button>';
  }
  html += '</div><button id="ar-replay-cancel" style="margin-top:10px;width:100%;background:none;' +
    'border:1px solid rgba(143,216,239,.4);border-radius:10px;color:#8fd8ef;padding:8px;cursor:pointer;font-size:.8rem">✕ Not now</button>';
  p.innerHTML = html;
  document.body.appendChild(p);
  var btns = p.querySelectorAll('[data-replay]');
  for (var j = 0; j < btns.length; j++) {
    (function (key) {
      btns[j].onclick = function () { play(key); };
    })(btns[j].getAttribute('data-replay'));
  }
  document.getElementById('ar-replay-cancel').onclick = function () { hideChooser(); };
  return p;
}
function ensureBar() {
  var bar = document.getElementById('ar-replay-bar');
  if (bar) return bar;
  bar = baseStyle(document.createElement('div'), 'left:50%;bottom:14px;transform:translateX(-50%);width:min(94vw,480px)');
  bar.id = 'ar-replay-bar';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Replay timeline controls');
  bar.innerHTML =
    '<div style="display:flex;align-items:center;gap:10px">' +
      '<button id="ar-replay-play" aria-label="Play or pause" style="background:rgba(0,229,255,.15);border:1px solid rgba(0,229,255,.5);' +
        'border-radius:999px;color:#eaffff;font-size:1rem;width:40px;height:40px;cursor:pointer;flex:none">⏸</button>' +
      '<input id="ar-replay-scrub" type="range" min="0" max="80" step="0.1" value="0" aria-label="Timeline scrubber" ' +
        'style="flex:1;accent-color:#00e5ff;cursor:pointer">' +
      '<span id="ar-replay-time" style="font-size:.7rem;color:#8fd8ef;flex:none;min-width:86px;text-align:right">0:00 / 1:20</span>' +
      '<button id="ar-replay-close" aria-label="Close replay" style="background:none;border:1px solid rgba(143,216,239,.4);' +
        'border-radius:999px;color:#8fd8ef;width:34px;height:34px;cursor:pointer;flex:none">✕</button>' +
    '</div>';
  document.body.appendChild(bar);
  var playBtn = document.getElementById('ar-replay-play');
  playBtn.onclick = function () { setPlaying(!R.playing); };
  var scrub = document.getElementById('ar-replay-scrub');
  scrub.addEventListener('pointerdown', function () {
    R.scrubbing = true; R.wasPlaying = R.playing; R.playing = false; syncPlayBtn();
  });
  var endScrub = function () {
    if (!R.scrubbing) return;
    R.scrubbing = false;
    R.playing = R.wasPlaying; syncPlayBtn();
  };
  scrub.addEventListener('pointerup', endScrub);
  scrub.addEventListener('pointercancel', endScrub);
  scrub.addEventListener('input', function () {
    R.t = parseFloat(scrub.value) || 0;
    setCaption(R.t);
    updateTimeLabel();
  });
  document.getElementById('ar-replay-close').onclick = function () { close(); };
  return bar;
}
function ensureCaption() {
  var c = document.getElementById('ar-replay-caption');
  if (c) return c;
  c = baseStyle(document.createElement('div'), 'left:50%;bottom:78px;transform:translateX(-50%);width:min(94vw,480px);pointer-events:none');
  c.id = 'ar-replay-caption';
  c.setAttribute('role', 'status');
  c.innerHTML = '<div id="ar-replay-cap-title" style="font-weight:800;font-size:.85rem;margin-bottom:4px"></div>' +
    '<div id="ar-replay-cap-text" style="font-size:.78rem;line-height:1.35;color:#d7f4ff"></div>';
  document.body.appendChild(c);
  return c;
}
function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
}
function updateTimeLabel() {
  var el = document.getElementById('ar-replay-time');
  if (el && R.def) el.textContent = fmtTime(R.t) + ' / ' + fmtTime(R.def.dur);
}
function updateScrub() {
  var scrub = document.getElementById('ar-replay-scrub');
  if (scrub && R.def) {
    scrub.max = String(R.def.dur);
    if (!R.scrubbing) scrub.value = String(R.t);
  }
  updateTimeLabel();
}
function syncPlayBtn() {
  var b = document.getElementById('ar-replay-play');
  if (b) b.textContent = R.playing ? '⏸' : '▶';
}
function setPlaying(v) {
  if (!R.group) return;
  if (v && R.t >= R.def.dur) R.t = 0; // replay from the start at the end
  R.playing = !!v;
  syncPlayBtn();
}
function setCaption(t) {
  if (!R.def) return;
  var idx = 0;
  for (var i = 0; i < R.def.captions.length; i++) {
    if (R.def.captions[i].t <= t + 0.001) idx = i;
  }
  if (idx === capIdx) return;
  capIdx = idx;
  var cap = R.def.captions[idx];
  var te = document.getElementById('ar-replay-cap-title');
  var tx = document.getElementById('ar-replay-cap-text');
  if (te) te.textContent = cap.title;
  if (tx) tx.textContent = cap.text;
}
function showChooser() { ensureChooser().style.display = 'block'; }
function hideChooser() {
  var p = document.getElementById('ar-replay-panel');
  if (p) p.style.display = 'none';
}
function showPlayer() {
  ensureBar().style.display = 'block';
  ensureCaption().style.display = 'block';
}
function hidePlayer() {
  var bar = document.getElementById('ar-replay-bar');
  if (bar) bar.style.display = 'none';
  var c = document.getElementById('ar-replay-caption');
  if (c) c.style.display = 'none';
}

/* ---------- public feature API ---------- */
function open() {
  if (!isARActive()) { toast('Start AR first, then watch a replay 🎬'); return false; }
  showChooser();
  return true;
}
function teardown() {
  if (R.dispose) { try { R.dispose(); } catch (e) {} }
  if (R.group && R.group.parent) {
    try { R.group.parent.remove(R.group); } catch (e) {}
  }
  R.key = null; R.def = null; R.group = null; R.update = null; R.dispose = null;
  R.t = 0; R.playing = false; R.scrubbing = false; R.wasPlaying = false;
  lastFrameT = 0; capIdx = -1;
}
function play(key) {
  var def = REPLAYS[key];
  if (!def) return false;
  if (!isARActive()) { toast('Start AR first, then watch a replay 🎬'); return false; }
  teardown();
  var b = B();
  if (!b || !b.scene || !b.camera) { toast('Hmm, the AR scene is not ready — try again 🎬'); return false; }
  var built = def.build();
  R.key = key; R.def = def;
  R.group = built.group; R.update = built.update;
  R.dispose = built.dispose || null;
  R.t = 0; R.playing = true;
  placeStage(R.group);
  b.scene.add(R.group);
  hideChooser();
  showPlayer();
  capIdx = -1;
  setCaption(0);
  updateScrub();
  syncPlayBtn();
  try { R.update(0); } catch (e) {}
  toast(def.emoji + ' ' + def.title + ' — drag the timeline to explore!');
  return true;
}
function close() {
  teardown();
  hideChooser();
  hidePlayer();
}

/* ---------- per-frame driver (runs AFTER base onFrame, like ar-orbit) ---------- */
function replayFrame() {
  if (!R.group || !R.update) return;
  var now = performance.now();
  var dt = lastFrameT ? Math.min((now - lastFrameT) / 1000, 0.1) : 0;
  lastFrameT = now;
  if (R.playing && !R.scrubbing && dt > 0) {
    R.t += dt;
    if (R.t >= R.def.dur) { R.t = R.def.dur; setPlaying(false); }
    setCaption(R.t);
    updateScrub();
  }
  try { R.update(R.t); } catch (e) {}
}

/* ---------- install (guarded startup, same pattern as ar-orbit.js) ---------- */
function install() {
  var AP = window.ARPlacement;
  if (!AP || typeof AP.onFrame !== 'function' || typeof AP.onSessionEnd !== 'function') {
    return false;
  }
  var _onFrame = AP.onFrame.bind(AP);
  AP.onFrame = function (frame) { _onFrame(frame); replayFrame(frame); };
  var _onEnd = AP.onSessionEnd.bind(AP);
  AP.onSessionEnd = function () { close(); _onEnd(); };

  window.ARFun = window.ARFun || {};
  window.ARFun.replay = {
    open: open,
    close: close,
    play: play
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
