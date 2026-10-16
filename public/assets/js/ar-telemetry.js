/* Space Center AR fun pack — LIVE TELEMETRY ("where is it RIGHT NOW?")
   - Default ON: when a placed model matches the NORAD table, a small 📡 chip
     appears; tap it for the tracking panel.
   - TLEs come from the site's own static snapshots
     (../assets/data/space-center/tle-snapshot-a.json / -b.json, CelesTrak source),
     cached in localStorage (sc-ar-tle-v1, 6 h TTL).
   - Detail view: live altitude + velocity, refreshed every 10 s, plus a
     "Point at sky" arrow (compass + geolocation, both optional & kid-explained).
   - Plain ES module. Loads AFTER ar-placement.js. Kid-safe text (~age 8).
   No prompt()/alert()/confirm() anywhere. */

import * as THREE from 'three';

/* ---------------- constants ---------------- */
var NORAD = {
  iss: 25544, hubble: 20580, aqua: 27424, terra: 25994,
  chandra: 25867, fermi: 33053, jwst: 50463
};
// Same relative path space-center-main.js uses — resolves identically on this page.
var TLE_URLS = [
  '../assets/data/space-center/tle-snapshot-a.json',
  '../assets/data/space-center/tle-snapshot-b.json'
];
var LS_TLE = 'sc-ar-tle-v1';
var LS_GEO = 'sc-ar-geo-v1';
var TTL_MS = 6 * 3600 * 1000;
var EARTH_R_KM = 6371;

function B() { return window.__scB || null; }
function AP() { return window.ARPlacement || null; }
function satLib() {
  var s = window.satellite;
  if (!s || typeof s.twoline2satrec !== 'function' || typeof s.propagate !== 'function' ||
      typeof s.gstime !== 'function' || typeof s.eciToEcf !== 'function' ||
      typeof s.ecfToLookAngles !== 'function') return null;
  return s;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function toast(msg) { var b = B(); if (b && b.toast) b.toast(msg); }
function arActive() { var b = B(); return !!(b && b.ar && b.ar.isActive && b.ar.isActive()); }

/* ---------------- state ---------------- */
var S = {
  on: true,                 // default ON (delightful)
  tles: null,               // {norad: {l1, l2, fetchedAt}}
  tlesLoading: false,
  tleError: '',             // '' | 'fetch' — "Couldn't reach the tracking data…"
  recs: {},                 // norad -> satrec
  chipTimer: 0,
  tickTimer: 0,             // 10 s live-number refresh
  secTimer: 0,              // 1 s "updated Ns ago" label
  lastNumbersAt: 0,
  detailNorad: null,
  arrowOn: false,
  geo: null,                // {lat, lon} — fetched ONCE, cached in localStorage
  heading: null,            // compass heading, degrees 0..360 (0 = north)
  orientTimer: 0,
  panelMode: ''             // '' | 'list' | 'detail'
};

/* ---------------- NORAD matching ---------------- */
function matchNorad(entry) {
  if (!entry || entry.kind !== 'model' || !entry.model) return null;
  var hay = ((entry.model.id || '') + ' ' + (entry.model.name || '')).toLowerCase();
  for (var key in NORAD) {
    if (NORAD.hasOwnProperty(key) && hay.indexOf(key) >= 0) return NORAD[key];
  }
  return null;
}
function modelName(entry) {
  return (entry.model && entry.model.name) || 'satellite';
}
function tracked() {
  var ap = AP();
  if (!ap || typeof ap.placedEntries !== 'function') return [];
  var out = [];
  ap.placedEntries().forEach(function (e) {
    var n = matchNorad(e);
    if (n) out.push({ entry: e, norad: n, name: modelName(e) });
  });
  return out;
}
function noradKey(norad) {
  for (var k in NORAD) if (NORAD[k] === norad) return k;
  return '';
}

/* ---------------- TLE loading (site's own snapshots) ---------------- */
function readTleCache() {
  try {
    var c = JSON.parse(localStorage.getItem(LS_TLE) || 'null');
    return (c && typeof c === 'object') ? c : null;
  } catch (e) { return null; }
}
function writeTleCache(map) {
  try { localStorage.setItem(LS_TLE, JSON.stringify(map)); } catch (e) {}
}
function tlesFresh(map) {
  if (!map) return false;
  for (var n in map) {
    if (map[n] && map[n].fetchedAt && (Date.now() - map[n].fetchedAt) < TTL_MS) return true;
  }
  return false;
}
function loadTLEs() {
  if (S.tles && tlesFresh(S.tles)) return Promise.resolve(S.tles);
  if (S.tlesLoading) return Promise.resolve(S.tles);
  var cached = readTleCache();
  if (cached && tlesFresh(cached)) { S.tles = cached; return Promise.resolve(S.tles); }
  S.tlesLoading = true;
  S.tleError = '';
  return Promise.all(TLE_URLS.map(function (u) {
    return fetch(u, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).catch(function () { return null; });
  })).then(function (files) {
    var map = {};
    files.forEach(function (f) {
      if (!f || !Array.isArray(f.sats)) return;
      f.sats.forEach(function (s) {
        if (!s || !s.id || !s.l1 || !s.l2) return;
        map[String(s.id)] = { l1: s.l1, l2: s.l2, fetchedAt: Date.now() };
      });
    });
    S.tlesLoading = false;
    if (Object.keys(map).length) {
      S.tles = map; S.recs = {}; writeTleCache(map);
      return map;
    }
    // Fetch failed: keep stale cache if we have one.
    if (cached && Object.keys(cached).length) { S.tles = cached; return cached; }
    S.tleError = 'fetch';
    return null;
  }).catch(function () {
    S.tlesLoading = false;
    if (cached && Object.keys(cached).length) { S.tles = cached; return cached; }
    S.tleError = 'fetch';
    return null;
  });
}
function getRec(norad) {
  var sat = satLib();
  if (!sat || !S.tles) return null;
  if (S.recs[norad]) return S.recs[norad];
  var t = S.tles[String(norad)];
  if (!t) return null;
  try {
    var rec = sat.twoline2satrec(t.l1, t.l2);
    S.recs[norad] = rec;
    return rec;
  } catch (e) { return null; }
}

/* ---------------- live numbers ---------------- */
function liveNumbers(norad) {
  var sat = satLib();
  var rec = getRec(norad);
  if (!sat || !rec) return null;
  var pv;
  try { pv = sat.propagate(rec, new Date()); } catch (e) { return null; }
  if (!pv || !pv.position || pv.position === false || !pv.velocity || pv.velocity === false) return null;
  var p = pv.position, v = pv.velocity;
  var r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
  var spd = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (!isFinite(r) || !isFinite(spd)) return null;
  return { alt: r - EARTH_R_KM, vel: spd };
}
function lookAngles(rec) {
  var sat = satLib();
  if (!sat || !rec || !S.geo) return null;
  var now = new Date(), pv;
  try { pv = sat.propagate(rec, now); } catch (e) { return null; }
  if (!pv || !pv.position || pv.position === false) return null;
  try {
    var gmst = sat.gstime(now);
    var ecf = sat.eciToEcf(pv.position, gmst);
    var look = sat.ecfToLookAngles(
      { longitude: S.geo.lon * Math.PI / 180, latitude: S.geo.lat * Math.PI / 180, height: 0 },
      ecf
    );
    var az = look.azimuth * 180 / Math.PI;
    az = ((az % 360) + 360) % 360;
    return { az: az, el: look.elevation * 180 / Math.PI };
  } catch (e) { return null; }
}
/* ---------------- UI: chip ---------------- */
var HUD_CSS = 'position:fixed;z-index:72;background:rgba(3,12,24,.96);border:1px solid rgba(0,229,255,.45);border-radius:14px;color:#eaffff;box-shadow:0 8px 40px rgba(0,0,0,.6)';
function ensureChip() {
  var c = document.getElementById('ar-tel-chip');
  if (c) return c;
  c = document.createElement('div');
  c.id = 'ar-tel-chip';
  c.className = 'hud';
  c.setAttribute('role', 'button');
  c.setAttribute('aria-label', 'Open live satellite tracking');
  c.style.cssText = HUD_CSS + ';top:14px;right:12px;padding:8px 12px;font-size:.8rem;font-weight:800;display:none;cursor:pointer';
  c.onclick = function () { openPanel(); };
  document.body.appendChild(c);
  return c;
}
function syncChip() {
  var c = ensureChip();
  var list = (S.on && arActive()) ? tracked() : [];
  if (!list.length || S.panelMode) { c.style.display = 'none'; return; }
  var withTle = list.filter(function (t) { return S.tles && S.tles[String(t.norad)]; }).length;
  c.textContent = '📡 ' + (withTle ? withTle + ' live' : list.length + ' tracked');
  c.style.display = 'block';
}

/* ---------------- UI: panel (bottom sheet) ---------------- */
function ensurePanel() {
  var p = document.getElementById('ar-tel-panel');
  if (p) return p;
  p = document.createElement('div');
  p.id = 'ar-tel-panel';
  p.className = 'hud';
  p.setAttribute('role', 'dialog');
  p.setAttribute('aria-label', 'Live satellite tracking');
  p.style.cssText = [
    'position:fixed', 'left:10px', 'right:10px', 'bottom:92px', 'z-index:73',
    'display:none', 'background:rgba(3,12,24,.96)', 'border:1px solid rgba(0,229,255,.45)',
    'border-radius:16px', 'padding:12px', 'box-shadow:0 8px 40px rgba(0,0,0,.6)',
    'max-height:54vh', 'overflow-y:auto', 'backdrop-filter:blur(6px)', 'color:#eaffff'
  ].join(';');
  document.body.appendChild(p);
  return p;
}
function agoText() {
  var s = Math.max(0, Math.round((Date.now() - S.lastNumbersAt) / 1000));
  return s < 2 ? 'updated just now' : 'updated ' + s + 's ago';
}
function openPanel() {
  if (!S.on) { toast('Live tracking is off — tap 📡 Track to turn it on'); return; }
  S.panelMode = 'list';
  ensurePanel().style.display = 'block';
  syncChip();
  renderList();
  loadTLEs().then(function () { if (S.panelMode === 'list') renderList(); });
}
function closePanel() {
  S.panelMode = '';
  S.detailNorad = null;
  stopDetailTimers();
  setArrowOn(false);
  var p = document.getElementById('ar-tel-panel');
  if (p) p.style.display = 'none';
  syncChip();
}
function renderList() {
  var p = ensurePanel();
  var sat = satLib();
  var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
    '<div style="font-weight:800;font-size:.95rem">📡 Live tracking</div>' +
    '<button id="ar-tel-close" class="tbtn" style="padding:6px 10px">✕</button></div>';
  if (!sat) {
    html += '<div style="font-size:.85rem;color:#ffd9a8">Live tracking needs the satellite library — it will be back soon!</div>';
  } else if (S.tleError && !S.tles) {
    html += '<div style="font-size:.85rem;color:#ffd9a8">Couldn\'t reach the tracking data — try again later.</div>';
  } else {
    var list = tracked();
    if (!list.length) {
      html += '<div style="font-size:.85rem;color:#9fd8ef">No trackable satellites in your room yet.<br>Place the ISS, Hubble, Aqua or Terra from the 🛸 picker!</div>';
    } else {
      html += '<div style="font-size:.75rem;color:#8fd8ef;margin-bottom:6px">Tap one to see where it is RIGHT NOW:</div>';
      list.forEach(function (t) {
        var hasTle = !!(S.tles && S.tles[String(t.norad)]);
        html += '<div class="ar-tel-row" data-norad="' + t.norad + '" role="button" tabindex="0" ' +
          'style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid rgba(0,229,255,.25);border-radius:10px;margin-bottom:6px;cursor:pointer">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:' + (hasTle ? '#3dff7a' : '#557') +
          ';box-shadow:0 0 8px ' + (hasTle ? '#3dff7a' : 'transparent') + '"></span>' +
          '<span style="font-weight:700;font-size:.88rem;flex:1">' + esc(t.name) + '</span>' +
          '<span style="font-size:.68rem;color:' + (hasTle ? '#3dff7a' : '#8fd8ef') + '">' +
          (hasTle ? 'LIVE' : 'soon') + '</span></div>';
      });
    }
  }
  html += '<div style="font-size:.62rem;color:#6fa8c0;margin-top:8px;text-align:center">NEXUS · numbers refresh every 10 seconds</div>';
  p.innerHTML = html;
  document.getElementById('ar-tel-close').onclick = closePanel;
  Array.prototype.forEach.call(p.querySelectorAll('.ar-tel-row'), function (row) {
    row.onclick = function () { openDetail(parseInt(row.getAttribute('data-norad'), 10)); };
  });
}
function openDetail(norad) {
  S.panelMode = 'detail';
  S.detailNorad = norad;
  renderDetail();
  startDetailTimers();
  // Warm the TLEs so the numbers appear fast.
  loadTLEs().then(function () { if (S.panelMode === 'detail') renderDetail(true); });
}
function renderDetail(keepArrow) {
  var p = ensurePanel();
  var list = tracked();
  var t = null;
  for (var i = 0; i < list.length; i++) if (list[i].norad === S.detailNorad) t = list[i];
  var name = t ? t.name : (noradKey(S.detailNorad) ? noradKey(S.detailNorad).toUpperCase() : 'Satellite');
  var sat = satLib();
  var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
    '<button id="ar-tel-back" class="tbtn" style="padding:6px 10px">‹ Back</button>' +
    '<div style="font-weight:800;font-size:.95rem">📡 ' + esc(name) + '</div>' +
    '<button id="ar-tel-close2" class="tbtn" style="padding:6px 10px">✕</button></div>';
  if (!sat) {
    html += '<div style="font-size:.85rem;color:#ffd9a8">Live tracking needs the satellite library — it will be back soon!</div>';
  } else if (S.tleError && !S.tles) {
    html += '<div style="font-size:.85rem;color:#ffd9a8">Couldn\'t reach the tracking data — try again later.</div>';
  } else {
    var nums = liveNumbers(S.detailNorad);
    if (!nums) {
      html += '<div style="font-size:.85rem;color:#ffd9a8">We don\'t have live numbers for this one yet — check back later!</div>';
    } else {
      html +=
        '<div style="text-align:center;padding:6px 0 2px">' +
          '<div style="font-size:.72rem;color:#8fd8ef">RIGHT NOW it is</div>' +
          '<div style="font-size:2rem;font-weight:800;color:#7df9ff">' + nums.alt.toFixed(1) + ' km</div>' +
          '<div style="font-size:.78rem;color:#cfe">above Earth</div>' +
        '</div>' +
        '<div style="text-align:center;padding:6px 0">' +
          '<div style="font-size:1.15rem;font-weight:800;color:#ffe08a">' + nums.vel.toFixed(2) + ' km/s</div>' +
          '<div style="font-size:.72rem;color:#8fd8ef">zooming around Earth — that\'s super fast!</div>' +
        '</div>' +
        '<div id="ar-tel-ago" style="text-align:center;font-size:.68rem;color:#6fa8c0">' + esc(agoText()) + '</div>' +
        '<div style="margin-top:10px"><button id="ar-tel-sky" class="tbtn" style="width:100%;padding:10px">' +
          (S.arrowOn ? '⬆ Point at sky: ON' : '⬆ Point at sky') + '</button></div>' +
        '<div id="ar-tel-skynote" style="font-size:.72rem;color:#8fd8ef;text-align:center;margin-top:6px;min-height:1.1em"></div>';
    }
  }
  p.innerHTML = html;
  document.getElementById('ar-tel-back').onclick = function () { S.panelMode = 'list'; setArrowOn(false); renderList(); };
  document.getElementById('ar-tel-close2').onclick = closePanel;
  var skyBtn = document.getElementById('ar-tel-sky');
  if (skyBtn) skyBtn.onclick = function () { toggleSkyArrow(); };
  if (!keepArrow) setArrowOn(false);
}
function startDetailTimers() {
  stopDetailTimers();
  S.lastNumbersAt = Date.now();
  S.tickTimer = setInterval(function () {
    if (S.panelMode !== 'detail' || S.detailNorad == null) return;
    S.lastNumbersAt = Date.now();
    renderDetail(true); // recompute numbers + sky arrow, keep arrow state
  }, 10000);
  S.secTimer = setInterval(function () {
    var el = document.getElementById('ar-tel-ago');
    if (el) el.textContent = agoText();
    if (S.arrowOn) updateArrow(); // heading may have moved
  }, 1000);
}
function stopDetailTimers() {
  if (S.tickTimer) clearInterval(S.tickTimer);
  if (S.secTimer) clearInterval(S.secTimer);
  S.tickTimer = 0; S.secTimer = 0;
}
/* ---------------- sky arrow ---------------- */
function ensureArrow() {
  var a = document.getElementById('ar-tel-arrow');
  if (a) return a;
  a = document.createElement('div');
  a.id = 'ar-tel-arrow';
  a.className = 'hud';
  a.style.cssText = HUD_CSS + ';top:26%;left:50%;transform:translateX(-50%);padding:10px 14px;text-align:center;display:none';
  a.innerHTML = '<div id="ar-tel-arrowg" style="font-size:3rem;line-height:1;transition:transform .3s">▲</div>' +
    '<div id="ar-tel-arrowt" style="font-size:.7rem;color:#8fd8ef;margin-top:4px"></div>';
  document.body.appendChild(a);
  return a;
}
function skyNote(msg) {
  var el = document.getElementById('ar-tel-skynote');
  if (el) el.textContent = msg || '';
}
function setArrowOn(on) {
  S.arrowOn = on;
  var btn = document.getElementById('ar-tel-sky');
  if (btn) btn.textContent = on ? '⬆ Point at sky: ON' : '⬆ Point at sky';
  var a = document.getElementById('ar-tel-arrow');
  if (a && !on) a.style.display = 'none';
  if (!on) stopCompass(); // enabling is driven by toggleSkyArrow (geo first, then compass)
}
function toggleSkyArrow() {
  if (S.arrowOn) { setArrowOn(false); skyNote(''); return; }
  skyNote('Getting your location…');
  ensureGeo(function (ok) {
    if (!ok) { skyNote('Turn on location to use the sky arrow'); return; }
    skyNote('');
    startCompass();
    setArrowOn(true);
  });
}
function readGeoCache() {
  try {
    var g = JSON.parse(localStorage.getItem(LS_GEO) || 'null');
    if (g && isFinite(g.lat) && isFinite(g.lon)) return g;
  } catch (e) {}
  return null;
}
function ensureGeo(cb) {
  if (S.geo) { cb(true); return; }
  var cached = readGeoCache();
  if (cached) { S.geo = cached; cb(true); return; }
  if (!navigator.geolocation) { cb(false); return; }
  try {
    navigator.geolocation.getCurrentPosition(function (pos) {
      S.geo = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      try { localStorage.setItem(LS_GEO, JSON.stringify(S.geo)); } catch (e) {}
      cb(true);
    }, function () { cb(false); }, { timeout: 12000, maximumAge: 3600000 });
  } catch (e) { cb(false); }
}
function onOrient(e) {
  var h = null;
  if (e && typeof e.webkitCompassHeading === 'number' && isFinite(e.webkitCompassHeading)) {
    h = e.webkitCompassHeading;
  } else if (e && typeof e.alpha === 'number' && e.alpha != null && isFinite(e.alpha)) {
    h = (360 - e.alpha) % 360;
  }
  if (h != null) {
    S.heading = h;
    if (S.orientTimer) { clearTimeout(S.orientTimer); S.orientTimer = 0; }
    skyNote('');
    updateArrow();
  }
}
function startCompass() {
  stopCompass();
  S.heading = null;
  var DOE = window.DeviceOrientationEvent;
  function listen() {
    try { window.addEventListener('deviceorientation', onOrient); } catch (e) {}
    // If no compass data arrives, say so (kid-friendly).
    S.orientTimer = setTimeout(function () {
      S.orientTimer = 0;
      if (S.heading == null && S.arrowOn) {
        skyNote('Compass not available on this device');
        var a = document.getElementById('ar-tel-arrow');
        if (a) a.style.display = 'none';
      }
    }, 5000);
  }
  if (DOE && typeof DOE.requestPermission === 'function') {
    // iOS: must be called from the tap gesture — toggleSkyArrow is one.
    try {
      DOE.requestPermission().then(function (res) {
        if (res === 'granted') listen();
        else { skyNote('Compass is off — allow it to use the sky arrow'); setArrowOn(false); }
      }).catch(function () { listen(); });
    } catch (e) { listen(); }
  } else {
    listen();
  }
}
function stopCompass() {
  try { window.removeEventListener('deviceorientation', onOrient); } catch (e) {}
  if (S.orientTimer) { clearTimeout(S.orientTimer); S.orientTimer = 0; }
}
function updateArrow() {
  if (!S.arrowOn || S.detailNorad == null || !S.geo || S.heading == null) return;
  var rec = getRec(S.detailNorad);
  var la = rec ? lookAngles(rec) : null;
  if (!la) return;
  var rot = la.az - S.heading;
  rot = ((rot + 540) % 360) - 180; // -180..180
  var a = ensureArrow();
  var g = document.getElementById('ar-tel-arrowg');
  var t = document.getElementById('ar-tel-arrowt');
  if (g) g.style.transform = 'rotate(' + rot.toFixed(0) + 'deg)';
  if (t) t.textContent = la.el >= 0 ? 'Above the horizon ✓' : 'Below the horizon ✗';
  a.style.display = 'block';
}

/* ---------------- public API ---------------- */
function syncTrackButton() {
  var btn = document.getElementById('ar-fun-track');
  if (btn) btn.textContent = S.on ? '📡 Track: on' : '📡 Track';
}
function toggle() {
  S.on = !S.on;
  syncTrackButton();
  if (S.on) {
    toast('Live tracking on — tap the 📡 chip to see where satellites are!');
    loadTLEs().then(function () { syncChip(); });
    syncChip();
  } else {
    closePanel();
    var c = document.getElementById('ar-tel-chip');
    if (c) c.style.display = 'none';
    toast('Live tracking off');
  }
}
function isOn() { return S.on; }

function cleanup() {
  stopDetailTimers();
  stopCompass();
  S.panelMode = ''; S.detailNorad = null; S.arrowOn = false;
  S.heading = null; S.geo = null;
  ['ar-tel-panel', 'ar-tel-arrow', 'ar-tel-chip'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  skyNote('');
}

/* ---------------- boot (guarded, retried) ---------------- */
var bootTries = 0;
function boot() {
  if (!window.ARPlacement || !window.__scB || !document.body) {
    if (++bootTries < 20) { setTimeout(boot, 500); return; }
  }
  var ap = AP();
  if (!ap) return; // nothing to wrap — stay inert
  window.ARFun = window.ARFun || {};
  window.ARFun.telemetry = { toggle: toggle, isOn: isOn };
  // Wrap onSessionEnd with call-through: close panels + stop listeners.
  var prevEnd = ap.onSessionEnd;
  ap.onSessionEnd = function () {
    try { if (typeof prevEnd === 'function') prevEnd.apply(ap, arguments); }
    finally { cleanup(); }
  };
  syncTrackButton();
  // Light poll: show the 📡 chip while AR is active and something trackable is placed.
  if (!S.chipTimer) {
    S.chipTimer = setInterval(function () {
      if (!S.on) return;
      if (arActive() && tracked().length && !S.tles && !S.tlesLoading && !S.tleError) loadTLEs().then(function () { syncChip(); });
      syncChip();
    }, 2500);
  }
  // Pre-warm TLEs shortly after boot so the panel opens fast.
  setTimeout(function () { if (S.on) loadTLEs().then(function () { syncChip(); }); }, 2000);
}
boot();
