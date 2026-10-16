/* AR Satellite Lab — model-viewer-ar.js
   GLTFLoader viewer (Model Lab tab) + satellite info-panel "Place in room".
   - Viewer pane: own small renderer/scene/camera + OrbitControls (isolated from
     the main Space Center loop so it never fights camera tracking).
   - AR placement is owned by ar-placement.js (hit-test reticle + WebXR anchors +
     persistence). placeInAR() just routes there.
     (2026-10-16 fix: the old code added the model to renderer.xr.getCamera(),
     which is NOT in the scene graph — the model loaded but never rendered.)
   Plain ES module, matches repo style (see space-center-models.js). */

import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from '../../vendor/three/addons/controls/OrbitControls.js';

function B() { return window.__scB || null; }
function esc(x) {
  return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ---------- shared models cache (library + studio + satellite tap use this) ---------- */
var modelsCache = null, modelsPromise = null;
function normName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function getModels() {
  if (modelsCache) return Promise.resolve(modelsCache);
  if (modelsPromise) return modelsPromise;
  modelsPromise = fetch('/api/models').then(function (r) { return r.json(); }).then(function (d) {
    var list = Array.isArray(d) ? d : (d && d.models) || [];
    modelsCache = list.map(function (m) {
      return {
        id: m.id, name: m.name, category: m.category || 'community',
        description: m.description || '', creatorHandle: m.creatorHandle || '',
        satelliteId: m.satelliteId || null, satelliteName: m.satelliteName || '',
        thumbnailUrl: m.thumbnailUrl || null, modelUrl: m.modelUrl || m.fileUrl || m.url || ''
      };
    });
    return modelsCache;
  }).catch(function () { modelsPromise = null; return []; });
  return modelsPromise;
}
function modelForSatellite(satelliteId) {
  return getModels().then(function (list) {
    var want = String(satelliteId == null ? '' : satelliteId).trim();
    if (!want) return null;
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.satelliteId != null && String(m.satelliteId).trim() === want) return m;
      if (m.satelliteName && normName(m.satelliteName) === normName(want)) return m;
    }
    return null;
  });
}

/* ---------- viewer pane (own renderer, own scene) ---------- */
var V = null; // {renderer, scene, camera, controls, mount, gltf, group, info}
function viewer() {
  if (V) return V;
  var mount = document.getElementById('mlab-viewer-canvas');
  var info = document.getElementById('mlab-viewer-info');
  if (!mount) return null;
  var w = mount.clientWidth || 360, h = 260;
  var renderer = new THREE.WebGLRenderer({ canvas: mount, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 50);
  camera.position.set(0.7, 0.45, 1.1);
  var controls = new OrbitControls(camera, mount);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 0.3; controls.maxDistance = 6;
  scene.add(new THREE.HemisphereLight(0xbfefff, 0x0a1020, 1.2));
  var key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(1.5, 2, 1.2); scene.add(key);
  var rim = new THREE.DirectionalLight(0x00e5ff, 0.7); rim.position.set(-1.5, -0.5, -1); scene.add(rim);
  // soft grid floor so the model has something to stand on
  var grid = new THREE.GridHelper(3, 24, 0x00e5ff, 0x0b2a3a);
  grid.position.y = -0.45; grid.material.transparent = true; grid.material.opacity = 0.35;
  scene.add(grid);
  var loader = new GLTFLoader();
  V = { renderer: renderer, scene: scene, camera: camera, controls: controls, mount: mount, info: info, loader: loader, group: null, model: null, spin: false };
  (function tick() {
    requestAnimationFrame(tick);
    if (!V.mount.isConnected || !V.mount.clientWidth) return; // tab hidden — skip render
    if (V.spin && V.group) V.group.rotation.y += 0.004;
    V.controls.update();
    V.renderer.render(V.scene, V.camera);
  })();
  new ResizeObserver(function () {
    var ww = V.mount.clientWidth || 360, hh = 260;
    V.camera.aspect = ww / hh; V.camera.updateProjectionMatrix();
    V.renderer.setSize(ww, hh, false);
  }).observe(mount);
  return V;
}
function clearGroup(v) {
  if (v.group) { v.scene.remove(v.group); v.group = null; v.model = null; }
}
function normalize(group, targetSize) {
  var box = new THREE.Box3().setFromObject(group);
  var size = new THREE.Vector3(); box.getSize(size);
  var center = new THREE.Vector3(); box.getCenter(center);
  var s = targetSize / (Math.max(size.x, size.y, size.z) || 1);
  var inner = new THREE.Group(); inner.add(group);
  group.position.sub(center).multiplyScalar(s);
  inner.scale.setScalar(s);
  return inner;
}
var glbCache = {}; // modelUrl -> Promise<Group template>
function loadGlb(url) {
  if (glbCache[url]) return glbCache[url];
  var p = new Promise(function (res, rej) {
    var v = viewer(); if (!v) { rej(new Error('viewer not ready')); return; }
    v.loader.load(url, function (gltf) { res(gltf.scene); }, undefined, function (err) { rej(err); });
  });
  glbCache[url] = p;
  p.catch(function () { delete glbCache[url]; });
  return p;
}
function show(model) {
  var v = viewer();
  if (!v || !model || !model.modelUrl) {
    if (v && v.info) v.info.textContent = 'Model file missing.';
    return;
  }
  var b = B();
  if (b && b.openTab) b.openTab('modellab');
  if (v.info) v.info.textContent = 'Loading ' + model.name + '…';
  clearGroup(v);
  v.loadToken = (v.loadToken || 0) + 1;
  var tok = v.loadToken;
  loadGlb(model.modelUrl).then(function (tpl) {
    if (v.loadToken !== tok) return; // a newer show() won — drop this stale load
    var g = tpl.clone(true);
    var inner = normalize(g, 0.7); // ~70 cm across in the viewer pane
    v.scene.add(inner); v.group = inner; v.model = model;
    v.controls.target.set(0, 0, 0); v.controls.update();
    if (v.info) {
      v.info.innerHTML = '<b>' + esc(model.name) + '</b>' +
        (model.creatorHandle ? ' · Built by ' + esc(model.creatorHandle) : '') +
        ' <span class="mlab-hint">drag to spin · scroll to zoom</span>';
    }
  }).catch(function () {
    if (v.loadToken !== tok) return;
    if (v.info) v.info.textContent = 'Could not load ' + model.name + ' — the file may still be uploading.';
  });
}

/* ---------- AR placement: routed to ar-placement.js ----------
   The old implementation attached the model to renderer.xr.getCamera().
   That internal XR camera is not part of the scene graph, so the model was
   loaded but never rendered ("Place in room" appeared to do nothing).
   All AR placement now goes through window.ARPlacement (reticle + anchors). */
function xrPresenting() {
  var b = B();
  return !!(b && b.renderer && b.renderer.xr && b.renderer.xr.isPresenting);
}
function placeInAR(model) {
  var b = B();
  if (!b) return;
  if (!xrPresenting()) {
    if (b.toast) b.toast('Tap the AR button first, then place your model in the room');
    if (b.openTab) b.openTab('modellab');
    show(model);
    return;
  }
  if (window.ARPlacement && window.ARPlacement.requestPlace) {
    window.ARPlacement.requestPlace({ type: 'model', model: model });
    return;
  }
  // Fallback if the placement module failed to load: add to the SCENE at the
  // reticle (or floating in front of the camera) — never on the XR camera.
  loadGlb(model.modelUrl).then(function (tpl) {
    var bb = B();
    if (!bb || !xrPresenting()) return;
    var g = tpl.clone(true);
    var inner = normalize(g, 0.5);
    var r = (bb.ar && bb.ar.reticle) ? bb.ar.reticle() : null;
    if (r && r.visible) inner.position.copy(r.position);
    else {
      var cp = new THREE.Vector3(), cd = new THREE.Vector3();
      bb.camera.getWorldPosition(cp); bb.camera.getWorldDirection(cd);
      inner.position.copy(cp).addScaledVector(cd, 1.0); inner.position.y -= 0.15;
    }
    bb.scene.add(inner);
    if (bb.toast) bb.toast((model.name || 'Model') + ' placed!');
  }).catch(function () {
    if (b.toast) b.toast('Could not load ' + (model.name || 'model') + ' for AR');
  });
}

/* ---------- satellite info-panel integration ---------- */
var attachStamp = 0;
function attachViewButton(satelliteId) {
  // Called by space-center-main.js after showInfo() renders the satellite panel.
  // Appends a "Place in room" button when this satellite has an approved model.
  if (!satelliteId) return;
  var old = document.getElementById('mlab-view3d-btn');
  if (old && old.parentNode) old.parentNode.removeChild(old);
  var stamp = ++attachStamp;
  modelForSatellite(satelliteId).then(function (m) {
    if (stamp !== attachStamp) return; // newer selection won
    if (!m) return;
    var zone = document.getElementById('infodata');
    if (!zone || document.getElementById('mlab-view3d-btn')) return;
    var btn = document.createElement('button');
    btn.id = 'mlab-view3d-btn';
    btn.className = 'tbtn';
    btn.style.cssText = 'width:100%;margin:0 0 12px';
    btn.textContent = '🛰 Place in room';
    btn.onclick = function () {
      if (xrPresenting()) window.ModelViewerAR.placeInAR(m);
      else window.ModelViewerAR.show(m);
    };
    zone.parentNode.insertBefore(btn, zone.nextSibling);
  }).catch(function () {});
}

window.ModelViewerAR = {
  getModels: getModels,
  modelForSatellite: modelForSatellite,
  show: show,
  placeInAR: placeInAR,
  attachViewButton: attachViewButton
};

/* Self-bootstrap: wires the AR "Models" overlay button (added by the HTML diff)
   and the viewer pane's "Place in room" button. Deferred module => DOM is ready. */
(function boot() {
  var modelsBtn = document.getElementById('armodelsbtn');
  if (modelsBtn) modelsBtn.onclick = function () {
    var b = B();
    if (b && b.openTab) b.openTab('modellab');
  };
  var placeBtn = document.getElementById('mlab-place-btn');
  if (placeBtn) placeBtn.onclick = function () {
    if (V && V.model) window.ModelViewerAR.placeInAR(V.model);
  };
})();
