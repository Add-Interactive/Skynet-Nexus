/**
 * ar-compare.js — TRUE-SCALE COMPARE for the AR fun pack
 *
 * Loads as <script type="module"> AFTER ar-placement.js on branch
 * gizmo/ar-fun-pack (repo Add-Interactive/Skynet-Nexus).
 *
 * Public API: window.ARFun.compare = { start(), cancel(), isActive() }
 *
 * Kid story: pick 2-3 models and see them side-by-side at TRUE relative
 * scale — the biggest model's real length becomes exactly 1.15 meters on
 * the table (or floor), and every other model is scaled to match. Plus an
 * optional real school bus (a true 12 meters) for a familiar anchor, and
 * a caption chip that tells you what you're looking at in kid-friendly
 * words ("JWST is about as wide as a tennis court! 🎾").
 *
 * Base APIs expected (see ar-placement.js):
 *   window.ARPlacement = { placedEntries(), placeAt(group, meta), ... }
 *   - placeAt(group, { kind:'model', model }) adds a PRE-POSITIONED group
 *     to the scene + anchors + persists it.
 *   window.__scB = { scene, camera, renderer, toast(msg), ar:{...} }
 *   window.ARFun = {} namespace.
 *
 * Rules: no prompt()/alert()/confirm(). Kid-safe copy (~age 8). NEXUS
 * branding. Never JARVIS.
 */

import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/addons/loaders/GLTFLoader.js';

/* ------------------------------------------------------------------ */
/* VERIFIED DIMENSIONS TABLE (meters)                                  */
/*   ISS        109    — solar array tip to tip (NASA)                  */
/*   Hubble     13.2   — length (NASA)                                  */
/*   JWST       21.2   — sunshield diagonal span (corrected per NASA)    */
/*   Chandra    13.8   — length (NASA)                                  */
/*   Fermi      4.3    — APPROXIMATE, solar array span (flag approx)    */
/*   Aqua       4.81   — width incl. solar array (NASA)                 */
/*   Terra      6.8    — width incl. solar array (NASA)                 */
/*   school bus 12     — standard school bus (reference anchor)         */
/*   unknown / kid uploads → default 6 ("size estimated")              */
/* ------------------------------------------------------------------ */

const MODELS_API = '/api/models';

// Matches by model id (lowercased) to real-world size in meters.
const VERIFIED_M = {
  iss: 109,
  hubble: 13.2,
  jwst: 21.2,
  chandra: 13.8,
  fermi: 4.3,
  aqua: 4.81,
  terra: 6.8,
};
const BUS_M = 12;
const BUS_ID = 'schoolbus';
const UNKNOWN_DEFAULT_M = 6;

// "approximate" flags — caption copy says "size approximate".
const APPROX_IDS = new Set(['fermi']);
// "estimated" flags — caption copy says "size estimated".
const ESTIMATED_DEFAULT = true;

// Scale rule: biggest real length → exactly this many scene meters.
const BIGGEST_IS_M = 1.15;
const ROW_SPACING_M = 1.5;
const ROW_FORWARD_M = 1.3;
const ROW_Y_M = 0.45;
const MIN_MODELS = 2;
const MAX_MODELS = 3;

// Ratio-engine references (meters).
const REFS = {
  bus: { m: 12, name: 'a school bus', emoji: '🚌' },
  whale: { m: 25, name: 'a blue whale', emoji: '🐋' },
  tennis: { m: 23.8, name: 'a tennis court', emoji: '🎾' },
  football: { m: 91, name: 'a football field', emoji: '🏈' },
  grownup: { m: 1.7, name: 'a grown-up', emoji: '🧍' },
};

const AP = () => window.ARPlacement;
const SCB = () => window.__scB;
const NEXUS = 'NEXUS';

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let active = false;
let panelEl = null;
let captionEl = null;
let modelRows = []; // [{model, checked}]
let placedGroups = []; // THREE.Group wrappers placed this session
let gltfLoader = null;

function toast(msg) {
  try {
    const scb = SCB();
    if (scb && typeof scb.toast === 'function') scb.toast(msg);
  } catch (e) { /* toast is best-effort */ }
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function hudStyle(e) {
  e.style.position = 'fixed';
  e.style.zIndex = '12000';
  e.style.fontFamily = 'system-ui, sans-serif';
  return e;
}

function buildPanel(models) {
  const wrap = el('div', 'hud');
  hudStyle(wrap);
  wrap.style.left = '50%';
  wrap.style.bottom = '16px';
  wrap.style.transform = 'translateX(-50%)';
  wrap.style.maxWidth = 'min(92vw, 420px)';
  wrap.style.background = 'rgba(10, 18, 32, 0.92)';
  wrap.style.border = '1px solid rgba(0, 255, 200, 0.35)';
  wrap.style.borderRadius = '14px';
  wrap.style.padding = '12px 14px';
  wrap.style.color = '#e8fbff';
  wrap.style.backdropFilter = 'blur(6px)';

  const title = el('div', '', '📏 <b>True-Scale Compare</b> — pick 2 or 3 models');
  title.style.marginBottom = '8px';
  wrap.appendChild(title);

  const sub = el('div', '', 'They line up at their true sizes, next to each other.');
  sub.style.fontSize = '12px';
  sub.style.opacity = '0.8';
  sub.style.marginBottom = '8px';
  wrap.appendChild(sub);

  const list = el('div', '');
  list.style.maxHeight = '180px';
  list.style.overflowY = 'auto';
  list.style.marginBottom = '8px';
  modelRows = [];
  models.forEach((m) => {
    const row = el('label', '');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.style.padding = '4px 0';
    row.style.fontSize = '14px';
    const cb = el('input', '');
    cb.type = 'checkbox';
    const size = modelRealMeters(m);
    const note = size.approx ? ' (size approximate)' : (size.estimated ? ' (size estimated)' : '');
    const span = el('span', '', `${m.name || m.id}${note}`);
    row.appendChild(cb);
    row.appendChild(span);
    list.appendChild(row);
    modelRows.push({ model: m, checkbox: cb });
  });
  wrap.appendChild(list);

  const busRow = el('label', '');
  busRow.style.display = 'flex';
  busRow.style.alignItems = 'center';
  busRow.style.gap = '8px';
  busRow.style.padding = '4px 0';
  busRow.style.fontSize = '14px';
  busRow.style.marginBottom = '10px';
  const busCb = el('input', '');
  busCb.type = 'checkbox';
  busCb.id = 'arcompare-bus';
  const busSpan = el('span', '', '🚌 Add a school bus (12 m)');
  busRow.appendChild(busCb);
  busRow.appendChild(busSpan);
  wrap.appendChild(busRow);

  const btnRow = el('div', '');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '8px';
  const goBtn = el('button', '', '📏 Compare!');
  goBtn.style.flex = '1';
  goBtn.style.padding = '10px';
  goBtn.style.borderRadius = '10px';
  goBtn.style.border = 'none';
  goBtn.style.background = '#00ffc8';
  goBtn.style.color = '#06231d';
  goBtn.style.fontWeight = '700';
  goBtn.style.fontSize = '15px';
  goBtn.addEventListener('click', onConfirm);
  const cancelBtn = el('button', '', 'Cancel');
  cancelBtn.style.padding = '10px 14px';
  cancelBtn.style.borderRadius = '10px';
  cancelBtn.style.border = '1px solid rgba(255,255,255,0.3)';
  cancelBtn.style.background = 'transparent';
  cancelBtn.style.color = '#e8fbff';
  cancelBtn.addEventListener('click', cancel);
  btnRow.appendChild(goBtn);
  btnRow.appendChild(cancelBtn);
  wrap.appendChild(btnRow);

  const foot = el('div', '', 'From the ' + NEXUS + ' AR lab');
  foot.style.fontSize = '11px';
  foot.style.opacity = '0.55';
  foot.style.marginTop = '8px';
  wrap.appendChild(foot);

  return wrap;
}

async function fetchModels() {
  try {
    const r = await fetch(MODELS_API);
    if (!r.ok) throw new Error('http ' + r.status);
    const j = await r.json();
    if (Array.isArray(j)) return j;
    if (j && Array.isArray(j.models)) return j.models;
    return [];
  } catch (e) {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Dimensions                                                          */
/* ------------------------------------------------------------------ */

function modelRealMeters(m) {
  const id = String(m.id || m.modelId || '').toLowerCase();
  const name = String(m.name || m.title || '').toLowerCase();
  for (const key of Object.keys(VERIFIED_M)) {
    if (id.includes(key) || name.includes(key)) {
      return { meters: VERIFIED_M[key], approx: APPROX_IDS.has(key), estimated: false };
    }
  }
  return { meters: UNKNOWN_DEFAULT_M, approx: false, estimated: ESTIMATED_DEFAULT };
}

/* ------------------------------------------------------------------ */
/* Placement                                                           */
/* ------------------------------------------------------------------ */

function cameraSlotTransform(index, count) {
  const scb = SCB();
  const cam = scb.camera;
  const pos = new THREE.Vector3();
  cam.getWorldPosition(pos);
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  dir.y = 0;
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
  dir.normalize();
  const center = pos.clone().add(dir.clone().multiplyScalar(ROW_FORWARD_M));
  center.y = ROW_Y_M;
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const offset = (index - (count - 1) / 2) * ROW_SPACING_M;
  const spot = center.clone().add(right.clone().multiplyScalar(offset));
  return { position: spot, lookAt: new THREE.Vector3(pos.x, ROW_Y_M, pos.z) };
}

function measureModel(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  return { size, center, maxDim };
}

function loader() {
  if (!gltfLoader) gltfLoader = new GLTFLoader();
  return gltfLoader;
}

function loadModel(url) {
  return new Promise((resolve, reject) => {
    loader().load(url, resolve, undefined, reject);
  });
}

/**
 * Place one real model at true relative scale.
 *
 * wrapper (scaled by ARFun) → inner offset (centers the model on origin;
 * offset lives on the UNSCALED child so we never double-scale) → gltf root.
 */
async function placeRealModel(m, realMeters, index, total, K) {
  const ap = AP();
  const displayName = m.name || m.id || 'model';
  const url = m.modelUrl || m.url || m.glb || m.file;
  if (!url) {
    toast("Couldn't load " + displayName + ' — skipping');
    return null;
  }
  let gltf;
  try {
    gltf = await loadModel(url);
  } catch (e) {
    toast("Couldn't load " + displayName + ' — skipping');
    return null;
  }
  const root = gltf.scene || gltf.scenes?.[0];
  if (!root) {
    toast("Couldn't load " + displayName + ' — skipping');
    return null;
  }

  // Measure BEFORE any scaling, center on the unscaled child.
  const { center, maxDim } = measureModel(root);
  const wrapper = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.copy(center.clone().negate()); // offset on unscaled child — avoid double-scaling
  inner.add(root);
  wrapper.add(inner);
  wrapper.scale.setScalar((realMeters * K) / maxDim);

  const { position, lookAt } = cameraSlotTransform(index, total);
  wrapper.position.copy(position);
  wrapper.lookAt(lookAt);

  ap.placeAt(wrapper, { kind: 'model', model: m });
  placedGroups.push(wrapper);
  return wrapper;
}

/* ------------------------------------------------------------------ */
/* Procedural school bus                                               */
/* ------------------------------------------------------------------ */

/**
 * Synthetic school bus: a procedural yellow box (true 12 m) + dark window
 * band + 4 cylinder wheels + a canvas-sprite label "🚌 school bus · 12 m".
 *
 * Meta uses modelUrl: null so it is treated as "no asset to load".
 * NOTE: ar-placement.js's restoreOne skips null-URL records next session
 * rather than crashing — the bus is session-only and is re-added from the
 * Compare picker each time.
 */
function buildBusModel() {
  const bus = new THREE.Group();

  const L = BUS_M, W = 2.55, H = 3.0; // true school-bus proportions
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffb400, roughness: 0.6, metalness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.4, metalness: 0.2 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

  // Body (true 12 m long)
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), yellow);
  body.position.y = H / 2 + 0.9;
  bus.add(body);

  // Dark window band
  const band = new THREE.Mesh(new THREE.BoxGeometry(L * 0.94, 0.7, W + 0.06), dark);
  band.position.y = H + 0.35;
  bus.add(band);

  // 4 cylinder wheels (rotated to roll along the bus length)
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 20);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelX = [L * 0.32, -L * 0.32];
  const wheelZ = [W / 2, -W / 2];
  for (const x of wheelX) {
    for (const z of wheelZ) {
      const wheel = new THREE.Mesh(wheelGeo, tire);
      wheel.position.set(x, 0.5, z);
      bus.add(wheel);
    }
  }

  // Canvas-sprite label
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(6, 20, 28, 0.85)';
  ctx.fillRect(0, 0, 512, 128);
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('🚌 school bus · 12 m', 256, 66);
  const tex = new THREE.CanvasTexture(canvas);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  label.scale.set(4.2, 1.05, 1);
  label.position.set(0, H + 2.0, 0);
  bus.add(label);

  return bus;
}

function placeBus(index, total, K) {
  const ap = AP();
  const bus = buildBusModel();

  // Scale so the TRUE 12 m bus obeys the same K rule as everything else.
  const { maxDim } = measureModel(bus);
  const wrapper = new THREE.Group();
  wrapper.add(bus);
  wrapper.scale.setScalar((BUS_M * K) / maxDim);

  const { position, lookAt } = cameraSlotTransform(index, total);
  wrapper.position.copy(position);
  wrapper.lookAt(lookAt);

  // Synthetic meta — null URL, see NOTE in buildBusModel().
  const meta = { kind: 'model', model: { id: BUS_ID, name: 'School bus', modelUrl: null } };
  ap.placeAt(wrapper, meta);
  placedGroups.push(wrapper);
  return wrapper;
}

/* ------------------------------------------------------------------ */
/* Caption chip + ratio engine                                         */
/* ------------------------------------------------------------------ */

function showCaption(html) {
  hideCaption();
  const chip = el('div', 'hud');
  hudStyle(chip);
  chip.style.top = '14px';
  chip.style.left = '50%';
  chip.style.transform = 'translateX(-50%)';
  chip.style.maxWidth = 'min(92vw, 480px)';
  chip.style.background = 'rgba(10, 18, 32, 0.92)';
  chip.style.border = '1px solid rgba(0, 255, 200, 0.35)';
  chip.style.borderRadius = '999px';
  chip.style.padding = '8px 12px 8px 18px';
  chip.style.color = '#e8fbff';
  chip.style.fontSize = '14px';
  chip.style.display = 'flex';
  chip.style.alignItems = 'center';
  chip.style.gap = '10px';
  chip.style.backdropFilter = 'blur(6px)';

  const text = el('span', '', html);
  chip.appendChild(text);
  const x = el('button', '', '✕');
  x.setAttribute('aria-label', 'Dismiss');
  x.style.border = 'none';
  x.style.background = 'rgba(255,255,255,0.12)';
  x.style.color = '#e8fbff';
  x.style.borderRadius = '50%';
  x.style.width = '26px';
  x.style.height = '26px';
  x.style.fontSize = '13px';
  x.style.cursor = 'pointer';
  x.addEventListener('click', hideCaption);
  chip.appendChild(x);

  document.body.appendChild(chip);
  captionEl = chip;
}

function hideCaption() {
  if (captionEl && captionEl.parentNode) captionEl.parentNode.removeChild(captionEl);
  captionEl = null;
}

// Special pair: Hubble could park on the ISS's solar wing.
function pairCaption(a, b) {
  const ids = new Set([a.id, b.id]);
  if (ids.has('iss') && ids.has('hubble')) return 'Hubble could park on the ISS\'s solar wing! 🛰️';
  return null;
}

function captionFor(entries) {
  // entries: [{id, name, meters}]
  const lines = [];
  const big = entries.reduce((p, c) => (c.meters >= p.meters ? c : p), entries[0]);

  // Pairwise line.
  if (entries.length === 2) {
    const [a, b] = entries;
    const special = pairCaption(a, b);
    if (special) lines.push(special);
    else if (Math.abs(a.meters - b.meters) / Math.max(a.meters, b.meters) < 0.12) {
      lines.push('Almost twins!');
    } else {
      const hi = a.meters >= b.meters ? a : b;
      const lo = a.meters >= b.meters ? b : a;
      const r = (hi.meters / lo.meters).toFixed(1);
      lines.push(hi.name + ' is ' + r + '× the size of ' + lo.name + '!');
    }
  } else if (entries.length === 3) {
    const sorted = [...entries].sort((x, y) => y.meters - x.meters);
    const r = (sorted[0].meters / sorted[2].meters).toFixed(1);
    lines.push(sorted[0].name + ' is ' + r + '× the size of ' + sorted[2].name + '!');
  }

  // Familiar-object line for the biggest thing.
  const refs = [REFS.football, REFS.tennis, REFS.whale, REFS.bus, REFS.grownup];
  let best = null;
  for (const ref of refs) {
    const ratio = big.meters / ref.m;
    if (ratio >= 0.75 && ratio <= 1.3) { best = { ref, ratio }; break; }
  }
  if (best) {
    if (best.ratio >= 0.92 && best.ratio <= 1.08) {
      lines.push(big.name + ' is about as long as ' + best.ref.name + '! ' + best.ref.emoji);
    } else {
      lines.push(big.name + ' is about the size of ' + best.ref.name + '! ' + best.ref.emoji);
    }
  } else if (big.meters > REFS.football.m * 1.3) {
    const r = (big.meters / REFS.football.m).toFixed(1);
    lines.push(big.name + ' is ' + r + '× a football field! ' + REFS.football.emoji);
  }

  return lines.join(' ');
}

/* ------------------------------------------------------------------ */
/* Flow                                                                */
/* ------------------------------------------------------------------ */

function clearPanel() {
  if (panelEl && panelEl.parentNode) panelEl.parentNode.removeChild(panelEl);
  panelEl = null;
  modelRows = [];
}

async function onConfirm() {
  const picked = modelRows.filter((r) => r.checkbox.checked).map((r) => r.model);
  const wantBus = panelEl && panelEl.querySelector('#arcompare-bus')?.checked;

  if (picked.length < MIN_MODELS || picked.length > MAX_MODELS) {
    toast('Pick 2 or 3 models to compare!');
    return;
  }
  if (picked.length === 0 && !wantBus) {
    toast('Pick 2 or 3 models to compare!');
    return;
  }

  // Tear down the panel and any previous compare scene.
  clearPanel();
  clearCompareScene();

  // Resolve true sizes.
  const sized = picked.map((m) => {
    const s = modelRealMeters(m);
    return { id: String(m.id || m.modelId || '').toLowerCase(), name: m.name || m.id, model: m, meters: s.meters };
  });
  if (wantBus) sized.push({ id: BUS_ID, name: 'School bus', model: null, meters: BUS_M });

  if (sized.length < MIN_MODELS) {
    toast('Pick 2 or 3 models to compare!');
    return;
  }

  // Scale factor: biggest real length → exactly BIGGEST_IS_M meters.
  const maxReal = Math.max(...sized.map((s) => s.meters));
  const K = BIGGEST_IS_M / maxReal;

  // Place everything left→right, biggest first for a tidy row.
  const ordered = [...sized].sort((a, b) => b.meters - a.meters);
  let idx = 0;
  for (const s of ordered) {
    if (s.id === BUS_ID) placeBus(idx, ordered.length, K);
    else await placeRealModel(s.model, s.meters, idx, ordered.length, K);
    idx++;
  }

  if (placedGroups.length < MIN_MODELS) {
    toast('Hmm, not enough models loaded — try again!');
    clearCompareScene();
    return;
  }

  const shown = ordered.filter((s, i) => i < placedGroups.length);
  showCaption(captionFor(shown));
  toast('True-scale compare is on! ✨');
}

function clearCompareScene() {
  const scb = SCB();
  for (const g of placedGroups) {
    try { scb?.scene?.remove(g); } catch (e) { /* best-effort */ }
  }
  placedGroups = [];
  hideCaption();
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

async function waitForPlacement(retries = 40) {
  for (let i = 0; i < retries; i++) {
    if (window.ARPlacement && typeof window.ARPlacement.placeAt === 'function') return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function start() {
  if (active) return;
  if (!(await waitForPlacement())) {
    toast('AR placement isn\'t ready yet — try again in a moment.');
    return;
  }
  const models = await fetchModels();
  if (!models.length) {
    toast('No models found to compare yet.');
    return;
  }
  active = true;
  panelEl = buildPanel(models);
  document.body.appendChild(panelEl);
}

function cancel() {
  if (!active) return;
  active = false;
  clearPanel();
  clearCompareScene();
  toast('Compare closed.');
}

function isActive() {
  return active;
}

window.ARFun = window.ARFun || {};
window.ARFun.compare = { start, cancel, isActive };
