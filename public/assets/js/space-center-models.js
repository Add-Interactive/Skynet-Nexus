/* Space Center 3D models — LOD swap: dots at distance, real models up close.
   Loaded as a module after the page bridge (window.__scB) exists.
   Model files live in ../assets/models/ (pushed via local git, not the PR).
   Missing files degrade cleanly: the dot stays, nothing breaks. */
import { GLTFLoader } from '../../vendor/three/addons/loaders/GLTFLoader.js';
import './space-center-destinations.js'; // Moon + Mars destinations, landing history pins, night-side city lights

const MODEL_BASE = '../assets/models/';
const SHOW_DIST = 1.0;      // camera-to-satellite distance under which the model appears
const DISPLAY_SIZE = 0.06;   // every model normalized to this diameter (true scale is invisible)

// profile "model" id -> file. 'proc:*' entries are built in code, no download.
const REGISTRY = {
  hubble: 'hubble.glb',
  iss: 'iss.glb',
  chandra: 'chandra.glb',
  fermi: 'fermi.glb',
  jwst: 'jwst.glb',
  terra: 'terra.glb',
  aqua: 'aqua.glb',
  'proc:starlink': null,
  'proc:tiangong': null,
  'proc:cubesat': null,
};

const cache = {};   // key -> { group, failed }
let cur = null;     // { sp, key, group }
let hintEl = null;

function B() { return window.__scB || null; }

function modelKeyFor(u, b) {
  try {
    const p = b.findSatProfile(u);
    if (p && p.model && REGISTRY[p.model] !== undefined) return p.model;
  } catch (e) {}
  const n = String(u.name || '').toUpperCase();
  if (n.indexOf('STARLINK') !== -1) return 'proc:starlink';
  if (n.indexOf('TIANGONG') !== -1 || n.indexOf('CSS') !== -1 || n.indexOf('TIANHE') !== -1) return 'proc:tiangong';
  if (n.indexOf('CUBESAT') !== -1 || n.indexOf('CUBE-SAT') !== -1) return 'proc:cubesat';
  return null;
}

function normalize(group, b) {
  const box = new b.THREE.Box3().setFromObject(group);
  const size = new b.THREE.Vector3(); box.getSize(size);
  const center = new b.THREE.Vector3(); box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const s = DISPLAY_SIZE / maxDim;
  group.scale.setScalar(s);
  // recenter: wrap in an outer group so the inner offset stays correct
  const wrap = new b.THREE.Group();
  group.position.sub(center).multiplyScalar(s);
  wrap.add(group);
  return wrap;
}

function buildProcedural(key, b) {
  const T = b.THREE;
  const g = new T.Group();
  const metal = (c, r) => new T.MeshStandardMaterial({ color: c, roughness: r == null ? 0.55 : r, metalness: 0.65 });
  const panel = new T.MeshStandardMaterial({ color: 0x1a3fa0, roughness: 0.35, metalness: 0.8 });
  const box = (w, h, d, m, x, y, z) => {
    const ms = new T.Mesh(new T.BoxGeometry(w, h, d), m);
    ms.position.set(x || 0, y || 0, z || 0); g.add(ms); return ms;
  };
  const cyl = (r, len, m, x, y, z, axis) => {
    const ms = new T.Mesh(new T.CylinderGeometry(r, r, len, 12), m);
    if (axis === 'x') ms.rotation.z = Math.PI / 2;
    if (axis === 'z') ms.rotation.x = Math.PI / 2;
    ms.position.set(x || 0, y || 0, z || 0); g.add(ms); return ms;
  };
  if (key === 'proc:starlink') {
    box(0.55, 0.16, 0.28, metal(0x8a93a0));            // flat bus
    box(1.7, 0.025, 0.55, panel, 0.15, 0, 0);          // single solar wing
  } else if (key === 'proc:tiangong') {
    cyl(0.17, 1.05, metal(0xd8dce2), 0, 0, 0, 'x');         // core module
    cyl(0.13, 0.72, metal(0xb9c0cc), -0.28, 0, 0.32, 'z');  // lab modules (T shape)
    cyl(0.13, 0.72, metal(0xb9c0cc), -0.28, 0, -0.32, 'z');
    box(0.9, 0.02, 0.3, panel, 0.32, 0.12, 0);              // solar wing
  } else { // proc:cubesat
    box(0.3, 0.3, 0.3, metal(0x9aa2ae));
    box(0.55, 0.02, 0.32, panel, -0.42, 0, 0);
    box(0.55, 0.02, 0.32, panel, 0.42, 0, 0);
  }
  return normalize(g, b);
}

function loadModel(key, b) {
  if (cache[key]) return cache[key].promise;
  let resolveFn, rejectFn;
  const promise = new Promise((res, rej) => { resolveFn = res; rejectFn = rej; });
  cache[key] = { promise, group: null, failed: false };
  if (key.indexOf('proc:') === 0) {
    try {
      const group = buildProcedural(key, b);
      cache[key].group = group;
      resolveFn(group);
    } catch (e) { cache[key].failed = true; rejectFn(e); }
    return promise;
  }
  const file = REGISTRY[key];
  if (!file) { cache[key].failed = true; rejectFn(new Error('no file')); return promise; }
  b.toast('🔭 Loading 3D model…');
  new GLTFLoader().load(
    MODEL_BASE + file,
    (gltf) => {
      try {
        const group = normalize(gltf.scene, b);
        cache[key].group = group;
        resolveFn(group);
      } catch (e) { cache[key].failed = true; rejectFn(e); }
    },
    undefined,
    () => {
      // Missing file (Jeff hasn't pushed binaries yet) — degrade cleanly to the dot.
      cache[key].failed = true;
      b.toast('3D model not on server yet — showing dot');
      rejectFn(new Error('load failed'));
    }
  );
  return promise;
}

function clearHint() {
  if (hintEl && hintEl.parentNode) hintEl.parentNode.removeChild(hintEl);
  hintEl = null;
}

function showHint(b, label) {
  clearHint();
  const panel = b.infopanel || document.getElementById('infopanel');
  if (!panel) return;
  hintEl = document.createElement('div');
  hintEl.className = 'sc-model-hint';
  hintEl.style.cssText = 'margin:8px 0;padding:7px 10px;border-radius:8px;background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.25);font-size:.75rem;color:#9beaff';
  hintEl.textContent = '🔭 3D model available — zoom in close to see ' + label;
  const head = panel.querySelector('.ip-head') || panel.firstChild;
  if (head && head.parentNode === panel) panel.insertBefore(hintEl, head.nextSibling);
  else panel.appendChild(hintEl);
}

function detach() {
  const b = B(); if (!b) return;
  try { b.modelShowing = false; } catch (e) {}
  if (cur) {
    if (cur.group) { cur.group.visible = false; }
    // only restore the dot if WE hid it (fleet filters may hide sats themselves)
    try { if (cur.sp && cur.dotHidden) cur.sp.visible = true; } catch (e) {}
    cur = null;
  }
  clearHint();
}

const _v1 = { p: null, q: null, w: null }; // lazy vectors
const _m = { m: null };

function tick() {
  const b = B();
  if (!b || !b.sats) { requestAnimationFrame(tick); return; }
  if (!_v1.p) {
    _v1.p = new b.THREE.Vector3(); _v1.q = new b.THREE.Vector3(); _v1.w = new b.THREE.Vector3();
    _m.m = new b.THREE.Matrix4();
  }
  const sel = b.selected;
  const isSat = sel && sel.userData && !sel.userData.isPad;

  if (!isSat) { if (cur) detach(); requestAnimationFrame(tick); return; }

  const key = modelKeyFor(sel.userData, b);
  if (!key) { if (cur) detach(); requestAnimationFrame(tick); return; }

  if (!cur || cur.sp !== sel || cur.key !== key) {
    detach();
    const entry = cache[key];
    cur = { sp: sel, key, group: (entry && entry.group) || null, failed: !!(entry && entry.failed) };
    try {
      const p = b.findSatProfile(sel.userData);
      showHint(b, (p && p.name) || sel.userData.name);
    } catch (e) {}
    if (!cur.group && !cur.failed) {
      loadModel(key, b).then((group) => {
        if (cur && cur.key === key) { cur.group = group; cur.failed = false; }
        else { b.scene.add(group); group.visible = false; } // keep cached, hidden
      }).catch(() => { if (cur && cur.key === key) cur.failed = true; });
    }
  }

  // sel.position is local to the tilted/spun `world` group; the camera and the
  // scene-rooted model group live in scene space — compare in world space.
  sel.getWorldPosition(_v1.w);

  // LOD: model only when the camera is close; otherwise the dot.
  // (never force the dot visible — fleet filters hide sats themselves)
  let show = false;
  if (cur.group && !cur.failed) {
    const d = b.camera.position.distanceTo(_v1.w);
    show = d < SHOW_DIST;
  }
  try { b.modelShowing = !!show; } catch (e) {} // page uses this to orbit-drag around the model
  try {
    if (show) { sel.visible = false; cur.dotHidden = true; }
    else if (cur.dotHidden) { sel.visible = true; cur.dotHidden = false; }
  } catch (e) {}
  if (cur.group) {
    const g = cur.group;
    if (!g.parent) b.scene.add(g);
    g.visible = show;
    if (show) {
      // orient long axis along velocity, "up" away from Earth
      _v1.p.copy(_v1.w);
      if (cur.last) {
        _v1.q.copy(_v1.p).sub(cur.last);
        if (_v1.q.lengthSq() > 1e-10) {
          _v1.q.normalize();
          const up = _v1.p.clone().normalize();
          _m.m.lookAt(new b.THREE.Vector3(0, 0, 0), _v1.q.clone().negate(), up);
          g.quaternion.setFromRotationMatrix(_m.m);
        }
      }
      cur.last = (cur.last || new b.THREE.Vector3()).copy(_v1.p);
      g.position.copy(_v1.w);
    }
  }
  requestAnimationFrame(tick);
}

(function boot() {
  let tries = 0;
  (function wait() {
    const b = B();
    if (b && b.sats && b.scene && b.camera && b.THREE) { tick(); return; }
    if (++tries < 80) setTimeout(wait, 250);
  })();
})();

// ---- Stella's Space Bay set (2026-10-30) ----
// The Blender-modeled bay rides this module's proven static GLTFLoader
// path and is handed to the bay code in space-center-main.js via
// window.__scBay.attachSet. If the file is missing or fails, main.js
// builds its fallback room on a timer — nothing here can break the page.
(function loadSpaceBay() {
  try {
    new GLTFLoader().load(MODEL_BASE + 'space-bay-v2.glb', function (gltf) {
      let tries = 0;
      (function hand() {
        if (window.__scBay && window.__scBay.attachSet) { window.__scBay.attachSet(gltf.scene); return; }
        if (++tries < 20) setTimeout(hand, 500);
      })();
    }, undefined, function () { /* main.js fallback timer covers a missing set */ });
  } catch (e) { /* the bay is decoration */ }
})();
