/* Space Center — Deep Space Destinations: Moon + Mars.
 *
 * Runs as a module AFTER the page's inline module, so window.__scB exists.
 * Adds: Moon & Mars globes at their real positions (compressed distances),
 * lunar/Mars orbiter dots (illustrative orbits), landing-history pins from
 * landing-history.json, a Destinations tab UI (fly-to cards + history),
 * and fly-to support reusing the page's flyTo/flyHome/camera system.
 * Also adds night-side city lights on Earth (NASA Black Marble texture on a
 * second sphere, R*1.002, child of `world`; shader uniform holds the sun
 * direction in the world's local frame so lights stay on the true night
 * side as the globe spins — degrades to invisible until the texture is pushed).
 *
 * The catalog's 1,082 objects are all Earth-orbiting TLEs — lunar orbiters
 * have no public TLEs, so orbiters here use clearly-labeled approximate orbits.
 */
(function () {
'use strict';

var b = null, T = null;
var tries = 0;
function wait() {
  b = window.__scB || null;
  if (b && b.scene && b.camera && b.renderer && b.THREE && b.flyTo && b.flyHome && b.showInfo && b.simDate && b.openTab) { init(); return; }
  if (++tries < 120) setTimeout(wait, 250);
}
setTimeout(wait, 0);

/* ---------------- math ---------------- */
var EPS = 23.4393 * Math.PI / 180; // obliquity
function norm360(d) { d = d % 360; return d < 0 ? d + 360 : d; }
// Same lat/lon -> Vector3 mapping as the page (scene Earth-fixed frame).
function llToV3(lat, lon, r) {
  var phi = (90 - lat) * Math.PI / 180, theta = (lon + 180) * Math.PI / 180;
  return new T.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}
function gmstHours(jd) { return (18.697374558 + 24.06570982441908 * (jd - 2451545.0)) % 24; }

// Low-precision lunar theory (Meeus-style). Returns sublunar point + distance.
function moonSubpoint(date) {
  var jd = date.getTime() / 86400000 + 2440587.5;
  var d = jd - 2451543.5;
  var N = norm360(125.1228 - 0.0529538083 * d);
  var inc = 5.1454;
  var w = norm360(318.0634 + 0.1643573223 * d);
  var a = 60.2666, e = 0.054900;
  var M = norm360(115.3654 + 13.0649929509 * d);
  var Mr = M * Math.PI / 180;
  var E = M + (180 / Math.PI) * e * Math.sin(Mr) * (1 + e * Math.cos(Mr));
  for (var k = 0; k < 4; k++) {
    var Er = E * Math.PI / 180;
    E = E - (E - (180 / Math.PI) * e * Math.sin(Er) - M) / (1 - e * Math.cos(Er));
  }
  var E2 = E * Math.PI / 180;
  var xv = a * (Math.cos(E2) - e), yv = a * Math.sqrt(1 - e * e) * Math.sin(E2);
  var v = Math.atan2(yv, xv) * 180 / Math.PI;
  var r = Math.sqrt(xv * xv + yv * yv);
  var Nr = N * Math.PI / 180, ir = inc * Math.PI / 180, wv = (v + w) * Math.PI / 180;
  var xh = r * (Math.cos(Nr) * Math.cos(wv) - Math.sin(Nr) * Math.sin(wv) * Math.cos(ir));
  var yh = r * (Math.sin(Nr) * Math.cos(wv) + Math.cos(Nr) * Math.sin(wv) * Math.cos(ir));
  var zh = r * (Math.sin(wv) * Math.sin(ir));
  var xe = xh, ye = yh * Math.cos(EPS) - zh * Math.sin(EPS), ze = yh * Math.sin(EPS) + zh * Math.cos(EPS);
  var RA = norm360(Math.atan2(ye, xe) * 180 / Math.PI);
  var dec = Math.atan2(ze, Math.sqrt(xe * xe + ye * ye)) * 180 / Math.PI;
  var lon = norm360(RA - gmstHours(jd) * 15 + 180) - 180;
  return { lat: dec, lon: lon, dist: r };
}

// JPL Keplerian elements + rates (per century), valid 1800–2050.
var MARS_EL = { a: [1.52371034, 0.00001847], e: [0.09339410, 0.00007882], I: [1.84969142, -0.008131], L: [-4.55343205, 19140.30268499], lp: [-23.91744784, 0.44441088], om: [49.55953891, -0.29257343] };
var EARTH_EL = { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], lp: [102.93768193, 0.32327364], om: [0, 0] };
function helioEcl(el, Tc) {
  var a = el.a[0] + el.a[1] * Tc, e = el.e[0] + el.e[1] * Tc;
  var I = (el.I[0] + el.I[1] * Tc) * Math.PI / 180;
  var L = norm360(el.L[0] + el.L[1] * Tc), lp = norm360(el.lp[0] + el.lp[1] * Tc), om = norm360(el.om[0] + el.om[1] * Tc);
  var w = (lp - om) * Math.PI / 180, omr = om * Math.PI / 180;
  var M = norm360(L - lp) * Math.PI / 180, E = M;
  for (var k = 0; k < 6; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  var xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  var v = Math.atan2(yp, xp), r = Math.sqrt(xp * xp + yp * yp), vw = v + w;
  return {
    x: r * (Math.cos(omr) * Math.cos(vw) - Math.sin(omr) * Math.sin(vw) * Math.cos(I)),
    y: r * (Math.sin(omr) * Math.cos(vw) + Math.cos(omr) * Math.sin(vw) * Math.cos(I)),
    z: r * (Math.sin(vw) * Math.sin(I))
  };
}
function marsSubpoint(date) {
  var jd = date.getTime() / 86400000 + 2440587.5;
  var Tc = (jd - 2451545.0) / 36525;
  var mh = helioEcl(MARS_EL, Tc), eh = helioEcl(EARTH_EL, Tc);
  var x = mh.x - eh.x, y = mh.y - eh.y, z = mh.z - eh.z;
  var xe = x, ye = y * Math.cos(EPS) - z * Math.sin(EPS), ze = y * Math.sin(EPS) + z * Math.cos(EPS);
  var RA = norm360(Math.atan2(ye, xe) * 180 / Math.PI);
  var dec = Math.atan2(ze, Math.sqrt(xe * xe + ye * ye)) * 180 / Math.PI;
  var lon = norm360(RA - gmstHours(jd) * 15 + 180) - 180;
  return { lat: dec, lon: lon };
}

/* Sun direction in the world's LOCAL frame (the exact vector the page's
 * sunDirection() returns; PR #116 rotates it into scene space each frame).
 * The night-lights mesh is a child of `world` with no own transform, so its
 * local normals live in this same frame — setting the uniform to this vector
 * keeps city lights glued to the true night side no matter how the globe is
 * spun or tilted. Mathematically identical to
 * _sunDir.clone().applyQuaternion(_sunQ.clone().invert()). */
var _sunTmp = null;
function sunLocalDir(date) {
  var jd = date.getTime() / 86400000 + 2440587.5, n = jd - 2451545.0;
  var L = (280.460 + 0.9856474 * n) % 360, g = (357.528 + 0.9856003 * n) % 360 * Math.PI / 180;
  var lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
  var eps = 23.439 * Math.PI / 180;
  var dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  var gmst = (18.697374558 + 24.06570982441908 * (jd - 2451545.0)) % 24;
  var lon = ((L - gmst * 15 + 540) % 360) - 180;
  if (!_sunTmp) _sunTmp = new T.Vector3();
  return _sunTmp.copy(llToV3(dec * 180 / Math.PI, lon, 1)).normalize();
}

/* ---------------- night-side city lights ---------------- */
// Second sphere (R*1.002) as a child of the SAME `world` group, so it spins
// with Earth. Additive shader paints NASA Black Marble city lights only on
// the night side. If the texture 404s (not yet pushed via HANDOFF), the mesh
// stays invisible and the day side is unaffected.
var nightMesh = null, nightMat = null;
function initNightLights() {
  if (!b.world) return;
  nightMat = new T.ShaderMaterial({
    uniforms: {
      nightMap: { value: null },
      sunDirLocal: { value: new T.Vector3(1, 0, 0) }
    },
    vertexShader: [
      'varying vec2 vUv;',
      'varying vec3 vNormalLocal;',
      'void main() {',
      '  vUv = uv;',
      '  vNormalLocal = normal;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D nightMap;',
      'uniform vec3 sunDirLocal;',
      'varying vec2 vUv;',
      'varying vec3 vNormalLocal;',
      'void main() {',
      '  float d = dot(normalize(vNormalLocal), normalize(sunDirLocal));',
      '  float night = 1.0 - smoothstep(-0.2, 0.12, d);',
      '  vec3 city = texture2D(nightMap, vUv).rgb;',
      '  gl_FragColor = vec4(city * night * 1.35, 1.0);',
      '}'
    ].join('\n'),
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false
  });
  nightMesh = new T.Mesh(new T.SphereGeometry(1.002, 64, 64), nightMat);
  nightMesh.visible = false; // shown only once the texture loads
  b.world.add(nightMesh);
  new T.TextureLoader().load('../assets/img/earth-night-2k.jpg',
    function (tex) {
      try { tex.anisotropy = b.renderer.capabilities.getMaxAnisotropy(); } catch (e) {}
      nightMat.uniforms.nightMap.value = tex;
      nightMesh.visible = true;
    },
    undefined,
    function () { nightMesh.visible = false; /* texture not pushed yet — day side unaffected */ });
}

/* ---------------- scene ---------------- */
var MOON_R = 0.2727, MOON_D = 12;    // real Earth:Moon radius ratio; distance compressed (real: 60)
var MARS_R = 0.5327, MARS_D = 40;    // real Earth:Mars radius ratio; distance compressed (real: ~250+)
var destGroup, moonGroup, marsGroup, moonMesh, marsMesh;
var pickables = [];
var orbiters = [];   // {pivot, speed, phase}
var pins = [];       // pin meshes
var pinByEvent = {}; // event name -> pin mesh
var destSelected = null;
var pulsing = null;  // {mesh, t0}
var historyEvents = [];

function makeBody(radius, texPath, fallbackColor) {
  var mat = new T.MeshPhongMaterial({ color: fallbackColor, shininess: 8 });
  var mesh = new T.Mesh(new T.SphereGeometry(radius, 48, 48), mat);
  new T.TextureLoader().load(texPath,
    function (tex) {
      try { tex.anisotropy = b.renderer.capabilities.getMaxAnisotropy(); } catch (e) {}
      mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
    },
    undefined,
    function () { /* keep fallback color — never break */ });
  return mesh;
}

// Orient a body so its geographic subpoint faces Earth (scene origin).
var _d = null, _ax = null, _up = null;
function faceEarth(mesh, centerPos) {
  if (!_d) { _d = new T.Vector3(); _ax = new T.Vector3(); _up = new T.Vector3(0, 1, 0); }
  _d.copy(centerPos).normalize();
  _ax.crossVectors(_d, _up);
  if (_ax.lengthSq() < 1e-6) _ax.set(1, 0, 0); else _ax.normalize();
  mesh.quaternion.setFromAxisAngle(_ax, Math.PI);
}

function makeRing(radius) {
  var g = new T.RingGeometry(radius - radius * 0.004 - 0.01, radius + radius * 0.004 + 0.01, 160);
  var m = new T.MeshBasicMaterial({ color: 0x6fa8ff, transparent: true, opacity: 0.20, side: T.DoubleSide });
  var ring = new T.Mesh(g, m);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

function dotTexture() {
  var c = document.createElement('canvas'); c.width = c.height = 64;
  var x = c.getContext('2d');
  var gr = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(c);
}
var _dotTex = null;
function addOrbiter(group, bodyR, cfg) {
  // cfg: {name, orbitR, tilt, phase, speed, color, blurb, destDist}
  if (!_dotTex) _dotTex = dotTexture();
  var pivot = new T.Group();
  pivot.rotation.x = cfg.tilt || 0;
  pivot.rotation.z = cfg.tiltZ || 0;
  group.add(pivot);
  var dot = new T.Sprite(new T.SpriteMaterial({ map: _dotTex, color: cfg.color || 0x9beaff, transparent: true, depthWrite: false }));
  var s = bodyR * 0.09 + 0.012;
  dot.scale.set(s, s, 1);
  dot.position.set(cfg.orbitR, 0, 0);
  dot.userData = { name: cfg.name, isDestination: true, destKind: 'orbiter', destDist: cfg.destDist || 0.8, info: cfg };
  pivot.add(dot);
  orbiters.push({ pivot: pivot, speed: cfg.speed, phase: cfg.phase || 0 });
  pickables.push(dot);
  return dot;
}

var PIN_COLORS = { active: 0x38d17c, completed: 0xffb020, historic: 0xffb020, impact: 0xff5c5c };
function addPin(bodyMesh, bodyR, ev, destDist) {
  var color = ev.kind === 'impact' ? PIN_COLORS.impact : (PIN_COLORS[ev.status] || PIN_COLORS.historic);
  var s = bodyR * 0.035 + 0.004;
  var pin = new T.Mesh(new T.SphereGeometry(s, 12, 12), new T.MeshBasicMaterial({ color: color }));
  pin.position.copy(llToV3(ev.lat, ev.lon, bodyR * 1.01));
  pin.userData = { name: ev.name, isDestination: true, destKind: 'pin', destDist: destDist, event: ev };
  bodyMesh.add(pin); // glued to the surface
  pins.push(pin); pickables.push(pin);
  pinByEvent[ev.name] = pin;
  return pin;
}

/* ---------------- selection + info ---------------- */
function kindIcon(kind) { return { landing: '🛬', impact: '💥', flyby: '🛰️', orbiter: '🛰️' }[kind] || '📍'; }
function siteStr(ev) {
  return Math.abs(ev.lat).toFixed(2) + '°' + (ev.lat >= 0 ? 'N' : 'S') + ', ' +
         Math.abs(ev.lon).toFixed(2) + '°' + (ev.lon >= 0 ? 'E' : 'W');
}

function showBodyInfo(u) {
  var isMoon = u.destKind === 'moon';
  var rows = isMoon ? [
    ['DIAMETER', '3,474 km'],
    ['DISTANCE', '384,400 km — compressed in view'],
    ['DAY LENGTH', '27.3 days (tidally locked)'],
    ['ORBITERS', '3 tracked · illustrative orbits']
  ] : [
    ['DIAMETER', '6,779 km'],
    ['DISTANCE', '~225M km — compressed in view'],
    ['DAY LENGTH', '24.6 hours'],
    ['ORBITERS', '5 tracked · illustrative orbits']
  ];
  var blurb = isMoon
    ? 'Our Moon — the only world humans have walked on. Shown in its real position tonight; distances are compressed so you can see it.'
    : 'The Red Planet — rovers, landers, and orbiters from five space agencies. Shown in its real position; distances compressed for viewing.';
  b.showInfo(isMoon ? '🌙 MOON' : '🔴 MARS', u.name, rows, blurb, '');
}

function showPinInfo(u) {
  var ev = u.event;
  var rows = [
    ['YEAR', String(ev.year)],
    ['AGENCY', ev.agency],
    ['KIND', ev.kind.toUpperCase()],
    ['STATUS', ev.status.toUpperCase()]
  ];
  if (ev.lat != null) rows.push(['SITE', siteStr(ev)]);
  b.showInfo(kindIcon(ev.kind) + ' ' + (ev.body === 'moon' ? 'MOON' : 'MARS') + ' HISTORY', ev.name, rows, ev.blurb, '');
}

function showOrbiterInfo(u) {
  var c = u.info;
  b.showInfo('🛰️ ORBITER', u.name, [
    ['AGENCY', c.agency],
    ['ORBIT', c.orbit],
    ['STATUS', c.status.toUpperCase()]
  ], c.blurb + ' (Orbit shown is illustrative — lunar/Mars orbiters have no public TLEs.)', '');
}

function selectDestination(obj) {
  var u = obj.userData;
  destSelected = obj;
  try { b.closeSidepanel(); } catch (e) {}
  // Deselect any satellite through the page's own ✕ handler (clears `selected`,
  // hides the panel, flyHome). This makes the 3D-model module detach so it
  // stops writing __scB.modelShowing — no race with the flag below.
  try { document.getElementById('infox').click(); } catch (e) {}
  try { if (b.clearOrbit) b.clearOrbit(); } catch (e) {}
  b.flyTo(obj); // page's flyTo; uses userData.destDist (one-line page edit)
  try { b.modelShowing = true; } catch (e) {} // drag orbits the camera around the destination
  if (u.destKind === 'moon' || u.destKind === 'mars') showBodyInfo(u);
  else if (u.destKind === 'pin') showPinInfo(u);
  else if (u.destKind === 'orbiter') showOrbiterInfo(u);
  if (u.destKind === 'pin' || u.destKind === 'orbiter') pulsing = { mesh: obj, t0: performance.now() }; else pulsing = null;
}

function flyToDest(which) {
  if (which === 'earth') {
    destSelected = null;
    try { b.modelShowing = false; } catch (e) {}
    b.flyHome();
    try { document.getElementById('infopanel').classList.remove('show'); } catch (e) {}
    return;
  }
  var mesh = which === 'moon' ? moonMesh : marsMesh;
  selectDestination(mesh);
}

/* ---------------- picking (capture phase, before the page's handler) ---------------- */
function initPicking() {
  var canvas = b.renderer.domElement;
  var ray = new T.Raycaster(), ptr = new T.Vector2();
  var downX = 0, downY = 0;
  canvas.addEventListener('pointerdown', function (e) { downX = e.clientX; downY = e.clientY; }, true);
  canvas.addEventListener('click', function (e) {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) return; // was a drag
    ptr.x = (e.clientX / window.innerWidth) * 2 - 1;
    ptr.y = -(e.clientY / window.innerHeight) * 2 + 1;
    ray.setFromCamera(ptr, b.camera);
    var hits = ray.intersectObjects(pickables, false);
    if (!hits.length) {
      if (destSelected) { e.stopPropagation(); e.preventDefault(); return; } // stay on the destination; fly back only via ✕ or the Earth button
      destSelected = null; // let the page handle it (satellite pick / empty-space flyHome)
      try { b.modelShowing = false; } catch (e) {} // back to world-spin dragging
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    selectDestination(hits[0].object);
  }, true);
}

/* ---------------- UI injection ---------------- */
// The page wires its rail/tab buttons once at load, so the Destinations
// button + tab + tabpage are injected here with their own handlers —
// no page HTML edit needed.
function injectDestinationsUI() {
  if (document.getElementById('page-destinations')) return; // already injected
  var rail = document.getElementById('iconrail');
  if (rail) {
    var rb = document.createElement('button');
    rb.className = 'rbtn'; rb.setAttribute('data-tab', 'destinations');
    rb.title = 'Destinations'; rb.textContent = '🌌';
    rb.onclick = function () {
      var sp = document.getElementById('sidepanel');
      if (rb.classList.contains('on') && sp && sp.classList.contains('open')) {
        sp.classList.remove('open'); rb.classList.remove('on'); return;
      }
      b.openTab('destinations');
    };
    var mm = rail.querySelector('[data-tab="moonmars"]');
    if (mm && mm.nextSibling) rail.insertBefore(rb, mm.nextSibling);
    else rail.appendChild(rb);
  }
  var tabs = document.querySelector('#sidepanel .tabs');
  if (tabs) {
    var tb = document.createElement('button');
    tb.className = 'tab'; tb.setAttribute('data-tab', 'destinations');
    tb.textContent = '🌌 DESTINATIONS';
    tb.onclick = function () { b.openTab('destinations'); };
    var mmt = tabs.querySelector('[data-tab="moonmars"]');
    if (mmt && mmt.nextSibling) tabs.insertBefore(tb, mmt.nextSibling);
    else tabs.appendChild(tb);
  }
  var panel = document.getElementById('sidepanel');
  if (panel) {
    var pg = document.createElement('div');
    pg.className = 'tabpage'; pg.id = 'page-destinations';
    pg.innerHTML = '<div id="dest-root"></div>';
    panel.appendChild(pg);
  }
}

/* ---------------- UI ---------------- */
var CSS = '' +
'.sc-dest-cards{display:grid;gap:10px;margin:10px 0}' +
'.sc-dest-card{background:rgba(0,229,255,.05);border:1px solid rgba(0,229,255,.18);border-radius:12px;padding:12px}' +
'.sc-dest-card h3{margin:0 0 4px;font-size:1rem}' +
'.sc-dest-card p{margin:0 0 10px;font-size:.8rem;color:#9beaff;opacity:.85}' +
'.sc-flybtn{background:linear-gradient(135deg,#00e5ff33,#7c6cff33);border:1px solid #00e5ff88;color:#eafcff;border-radius:8px;padding:8px 12px;font-size:.85rem;cursor:pointer;width:100%}' +
'.sc-flybtn:hover{background:linear-gradient(135deg,#00e5ff55,#7c6cff55)}' +
'.sc-dest-subtabs{display:flex;gap:6px;margin:12px 0 8px}' +
'.sc-dtab{flex:1;background:transparent;border:1px solid rgba(0,229,255,.25);color:#9beaff;border-radius:8px;padding:7px;font-size:.75rem;cursor:pointer}' +
'.sc-dtab.on{background:rgba(0,229,255,.15);color:#fff}' +
'.sc-hist-group{margin:10px 0 4px;font-size:.8rem;color:#fff;letter-spacing:.05em}' +
'.sc-hist-row{display:flex;gap:8px;align-items:center;padding:7px 8px;border-radius:8px;cursor:pointer;font-size:.78rem}' +
'.sc-hist-row:hover{background:rgba(0,229,255,.08)}' +
'.sc-hist-row .yr{color:#ffb020;min-width:38px;font-variant-numeric:tabular-nums}' +
'.sc-hist-row .nm{flex:1;color:#eafcff}' +
'.sc-hist-row .ag{color:#9beaff;opacity:.7;font-size:.72rem}' +
'.sc-legend{font-size:.72rem;color:#9beaff;margin:6px 0;opacity:.85}' +
'.sc-linkbtn{background:none;border:none;color:#00e5ff;font-size:.78rem;cursor:pointer;padding:0;text-decoration:underline}';

function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

function renderDestinations() {
  var root = document.getElementById('dest-root');
  if (!root) return;
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  root.innerHTML =
    '<div class="sc-dest-subtabs">' +
    '<button class="sc-dtab on" data-dtab="go">🌌 DESTINATIONS</button>' +
    '<button class="sc-dtab" data-dtab="hist">📜 HISTORY</button>' +
    '</div>' +
    '<div id="dest-go"><div class="sc-dest-cards">' +
    '<div class="sc-dest-card"><h3>🛰️ Earth</h3><p>Mission Control home — 1,082 satellites tracked live.</p><button class="sc-flybtn" data-fly="earth">Fly home →</button></div>' +
    '<div class="sc-dest-card"><h3>🌙 Moon</h3><p>Our Moon in its real position tonight. 3 orbiters, 18 landing sites. Distance compressed for viewing.</p><button class="sc-flybtn" data-fly="moon">Fly there →</button></div>' +
    '<div class="sc-dest-card"><h3>🔴 Mars</h3><p>The Red Planet in its real position. 5 orbiters, 14 landing sites. Distance compressed for viewing.</p><button class="sc-flybtn" data-fly="mars">Fly there →</button></div>' +
    '</div></div>' +
    '<div id="dest-hist" hidden>' +
    '<div class="sc-legend">🟢 active &nbsp; 🟡 historic / completed &nbsp; 🔴 impact</div>' +
    '<div id="dest-hist-rows"><div class="sc-empty">▸ LOADING HISTORY…</div></div>' +
    '</div>';
  root.querySelectorAll('[data-dtab]').forEach(function (btn) {
    btn.onclick = function () {
      root.querySelectorAll('[data-dtab]').forEach(function (x) { x.classList.toggle('on', x === btn); });
      var hist = btn.getAttribute('data-dtab') === 'hist';
      document.getElementById('dest-go').hidden = hist;
      document.getElementById('dest-hist').hidden = !hist;
    };
  });
  root.querySelectorAll('[data-fly]').forEach(function (btn) {
    btn.onclick = function () { flyToDest(btn.getAttribute('data-fly')); };
  });
  // cross-link from the Moon+Mars board tab
  var mm = document.getElementById('mm-fly3d');
  if (mm) mm.onclick = function () { b.openTab('destinations'); };
}

function renderHistory() {
  var box = document.getElementById('dest-hist-rows');
  if (!box || !historyEvents.length) return;
  var dot = function (ev) {
    return ev.kind === 'impact' ? '🔴' : (ev.status === 'active' ? '🟢' : '🟡');
  };
  var html = '';
  ['moon', 'mars'].forEach(function (body) {
    html += '<div class="sc-hist-group">' + (body === 'moon' ? '🌙 THE MOON' : '🔴 MARS') + '</div>';
    historyEvents.filter(function (e) { return e.body === body; })
      .sort(function (a, b) { return a.year - b.year || (a.month || 0) - (b.month || 0); })
      .forEach(function (ev) {
        html += '<div class="sc-hist-row" data-ev="' + esc(ev.name) + '">' +
          '<span class="yr">' + ev.year + '</span>' +
          '<span class="nm">' + dot(ev) + ' ' + esc(ev.name) + '</span>' +
          '<span class="ag">' + esc(ev.agency) + '</span>' +
          '<span>' + kindIcon(ev.kind) + '</span></div>';
      });
  });
  box.innerHTML = html;
  box.querySelectorAll('[data-ev]').forEach(function (row) {
    row.onclick = function () {
      var ev = null;
      for (var i = 0; i < historyEvents.length; i++) if (historyEvents[i].name === row.getAttribute('data-ev')) ev = historyEvents[i];
      if (!ev) return;
      flyToDest(ev.body);
      var pin = pinByEvent[ev.name];
      if (pin) selectDestination(pin); // surface pin: info card + pulse
      else {
        // flyby / orbiter with no pin: show its story card directly
        b.showInfo(kindIcon(ev.kind) + ' ' + (ev.body === 'moon' ? 'MOON' : 'MARS') + ' HISTORY', ev.name,
          [['YEAR', String(ev.year)], ['AGENCY', ev.agency], ['KIND', ev.kind.toUpperCase()], ['STATUS', ev.status.toUpperCase()]],
          ev.blurb, '');
      }
    };
  });
}

/* ---------------- build ---------------- */
function init() {
  T = b.THREE;

  destGroup = new T.Group();
  b.scene.add(destGroup);
  destGroup.add(makeRing(MOON_D));
  destGroup.add(makeRing(MARS_D));

  // Moon
  moonGroup = new T.Group(); destGroup.add(moonGroup);
  moonMesh = makeBody(MOON_R, '../assets/img/moon-2k.jpg', 0x9a9a9a);
  moonMesh.userData = { name: 'Moon', isDestination: true, destKind: 'moon', destDist: 1.2 };
  moonGroup.add(moonMesh); pickables.push(moonMesh);

  // Mars
  marsGroup = new T.Group(); destGroup.add(marsGroup);
  marsMesh = makeBody(MARS_R, '../assets/img/mars-2k.jpg', 0xb5533c);
  marsMesh.userData = { name: 'Mars', isDestination: true, destKind: 'mars', destDist: 2.0 };
  marsGroup.add(marsMesh); pickables.push(marsMesh);

  // Lunar orbiters (illustrative — no public TLEs exist for lunar orbiters)
  addOrbiter(moonGroup, MOON_R, { name: 'LRO', orbitR: 0.40, tilt: Math.PI / 2.15, phase: 0.0, speed: 0.35, color: 0x9beaff, destDist: 0.8, agency: 'NASA', orbit: 'Polar · ~50 km', status: 'active', blurb: 'Lunar Reconnaissance Orbiter — mapping the Moon in stunning detail since 2009.' });
  addOrbiter(moonGroup, MOON_R, { name: 'Danuri (KPLO)', orbitR: 0.45, tilt: Math.PI / 1.9, phase: 2.1, speed: 0.28, color: 0x7c6cff, destDist: 0.8, agency: 'KARI', orbit: 'Polar · ~100 km', status: 'active', blurb: "South Korea's first lunar orbiter, scouting future landing sites." });
  addOrbiter(moonGroup, MOON_R, { name: 'CAPSTONE', orbitR: 0.55, tilt: 0.5, tiltZ: 0.4, phase: 4.0, speed: 0.18, color: 0xffb020, destDist: 0.8, agency: 'NASA', orbit: 'Near-rectilinear halo (elliptical)', status: 'active', blurb: 'Testing the lopsided orbit planned for the future lunar Gateway station.' });

  // Mars orbiters (illustrative)
  var marsOrbiters = [
    { name: 'MRO', agency: 'NASA', orbit: 'Sun-sync · ~300 km', blurb: 'Mars Reconnaissance Orbiter — the sharpest eyes at Mars since 2006.' },
    { name: 'Mars Odyssey', agency: 'NASA', orbit: 'Sun-sync · ~400 km', blurb: 'Studying Mars since 2001 and relaying rover data home.' },
    { name: 'MAVEN', agency: 'NASA', orbit: 'Elliptical', blurb: 'Investigating how Mars lost its atmosphere to space.' },
    { name: 'Tianwen-1 orbiter', agency: 'CNSA', orbit: 'Polar', blurb: "China's Mars orbiter, mapping the planet since 2021." },
    { name: 'Hope (EMM)', agency: 'UAE', orbit: 'High science orbit', blurb: 'The Emirates Mars Mission — studying the Martian atmosphere.' }
  ];
  marsOrbiters.forEach(function (o, i) {
    addOrbiter(marsGroup, MARS_R, {
      name: o.name, orbitR: 0.72 + i * 0.07, tilt: Math.PI / 2 + (i - 2) * 0.18, phase: i * 1.7,
      speed: 0.22 - i * 0.02, color: [0x9beaff, 0x7c6cff, 0x38d17c, 0xffb020, 0xff6b6b][i],
      destDist: 1.6, agency: o.agency, orbit: o.orbit, status: 'active', blurb: o.blurb
    });
  });

  // Landing-history pins (also feeds the History tab)
  fetch('../assets/data/space-center/landing-history.json').then(function (r) { return r.json(); }).then(function (evs) {
    historyEvents = evs || [];
    historyEvents.forEach(function (ev) {
      if (ev.lat == null) return; // flybys/orbiters get no surface pin
      var isMoon = ev.body === 'moon';
      addPin(isMoon ? moonMesh : marsMesh, isMoon ? MOON_R : MARS_R, ev, isMoon ? 0.8 : 1.6);
    });
    renderHistory();
  }).catch(function () { /* history stays empty; globes still work */ });

  injectDestinationsUI();
  renderDestinations();
  initPicking();
  initNightLights();

  // Per-frame: real positions, face-Earth orientation, orbiter motion, pin pulse.
  var _mc = new T.Vector3(), _sc = new T.Vector3();
  (function tick() {
    requestAnimationFrame(tick);
    var now;
    try { now = b.simDate(); } catch (e) { now = new Date(); }
    try {
      var mp = moonSubpoint(now);
      _mc.copy(llToV3(mp.lat, mp.lon, MOON_D));
      moonGroup.position.copy(_mc);
      faceEarth(moonMesh, _mc);
      var sp = marsSubpoint(now);
      _sc.copy(llToV3(sp.lat, sp.lon, MARS_D));
      marsGroup.position.copy(_sc);
      faceEarth(marsMesh, _sc);
      var t = now.getTime() / 1000;
      for (var i = 0; i < orbiters.length; i++) orbiters[i].pivot.rotation.y = t * orbiters[i].speed + orbiters[i].phase;
      // Keep the orbit-drag flag asserted while a destination is focused, and
      // clean up if the user flew home via the TRACKING ✕ (trackchip hidden).
      if (destSelected) {
        var chip = null;
        try { chip = document.getElementById('trackchip'); } catch (e) {}
        if (chip && !chip.classList.contains('show')) {
          destSelected = null;
          try { b.modelShowing = false; } catch (e) {}
        } else {
          try { b.modelShowing = true; } catch (e) {}
        }
      }
      // Night-side city lights: sun direction in the world's local frame, so the
      // lights stay glued to the true night side as the globe spins/tilts.
      if (nightMat && nightMesh && nightMesh.visible) {
        nightMat.uniforms.sunDirLocal.value.copy(sunLocalDir(now));
      }
      if (pulsing) {
        var el = (performance.now() - pulsing.t0) / 1000;
        if (el > 2.5) { pulsing.mesh.scale.set(1, 1, 1); pulsing = null; }
        else { var s = 1 + 0.6 * Math.abs(Math.sin(el * 6)); pulsing.mesh.scale.set(s, s, s); }
      }
    } catch (e) { /* never break the render loop */ }
  })();

  window.__scDest = { fly: flyToDest, select: selectDestination };
}

})();
