/* Space Center AR — ar-orbit.js
   Fun pack: ORBIT MODE ("watch it happen on your ceiling").
   Loads AFTER ar-placement.js as <script type="module">.

   - Exposes window.ARFun.orbit = { toggle()->bool, isOn()->bool, cycleSpeed()->label }
   - When on, every placed model (kind:'model') orbits the placed Earth, using
     real orbital periods + inclinations (truth table below), time-lapsed so
     the ISS laps once per 120s at 1x.
   - Hooks wrap window.ARPlacement.onFrame / onSessionStart / onSessionEnd
     (property wrapping — space-center-main.js looks the props up per call).
   - Per-frame orbit math runs AFTER the base onFrame, so it overrides the
     anchor gluing; orbiting entries get their anchors detached (delete+null)
     so nothing snaps them back. Toggle-off leaves satellites where they are.
   - Kid-safe: no prompt()/alert()/confirm() anywhere; plain tap UI only.

   Truth table (matched by case-insensitive name/id contains):
     iss    ->  92.9 min / 51.6 deg
     hubble ->  96.4 min / 28.5 deg
     aqua   ->  99.1 min / 98.2 deg
     terra  ->  99.2 min / 98.2 deg
     fermi  ->  95.3 min / 25.6 deg
     chandra-> 3852  min / 28   deg (radius clamped to 1.6 m, noted in a toast)
     jwst   -> SPECIAL: 2.4 m ring, 20 min/lap at 1x (it orbits the Sun, not Earth)
     unknown/kid uploads -> 100 min / 30 deg
   Radius per model index i (placedEntries order): 0.55 + i*0.30 m.
*/

import * as THREE from 'three';

var LS_KEY = 'sc-ar-orbit-v1';
var SPEEDS = [1, 4, 0.25];            // cycle order for the speed chip
var SCALE = 120 / (92.9 * 60);       // ISS: 92.9 real min -> 120 s per lap at 1x

function B() { return window.__scB || null; }
function toast(msg) { var b = B(); if (b && b.toast) b.toast(msg); }

var ORBIT = { on: false, speed: 1 };
var angles = {};        // entry.id -> current angle, radians
var lastT = 0;          // last orbit-frame timestamp (performance.now)
var resumeTimer = null; // session-start poll handle
var noted = {};         // per-enable one-shot flags: {jwst:true, chandra:true}

/* ---------------- orbit params ---------------- */
function matchParams(entry) {
  var m = (entry && entry.model) || {};
  var hay = ((m.name || '') + ' ' + (m.id || '')).toLowerCase();
  if (hay.indexOf('jwst') !== -1)    return { min: 20,   incl: 0,    radius: 2.4, special: 'jwst' };
  if (hay.indexOf('iss') !== -1)     return { min: 92.9, incl: 51.6 };
  if (hay.indexOf('hubble') !== -1)   return { min: 96.4, incl: 28.5 };
  if (hay.indexOf('aqua') !== -1)     return { min: 99.1, incl: 98.2 };
  if (hay.indexOf('terra') !== -1)    return { min: 99.2, incl: 98.2 };
  if (hay.indexOf('fermi') !== -1)    return { min: 95.3, incl: 25.6 };
  if (hay.indexOf('chandra') !== -1)  return { min: 3852, incl: 28, clampR: 1.6, special: 'chandra' };
  return { min: 100, incl: 30 }; // unknown + kid uploads
}
function periodSeconds(p) { return p.min * 60 * SCALE / ORBIT.speed; }
function radiusFor(i, p) {
  var r = 0.55 + i * 0.30;
  if (p.radius) r = p.radius;      // jwst special ring
  if (p.clampR) r = Math.min(r, p.clampR); // chandra squeeze
  return r;
}
function speedLabel(s) { return s === 0.25 ? '\u00BC\u00D7' : (s + '\u00D7'); }

/* ---------------- persistence (pref only) ---------------- */
function readPref() {
  try {
    var p = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    if (p && typeof p === 'object') {
      return { on: !!p.on, speed: SPEEDS.indexOf(p.speed) !== -1 ? p.speed : 1 };
    }
  } catch (e) {}
  return { on: false, speed: 1 };
}
function writePref() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ on: ORBIT.on, speed: ORBIT.speed })); } catch (e) {}
}

/* ---------------- entries ---------------- */
function entries() {
  var AP = window.ARPlacement;
  return (AP && typeof AP.placedEntries === 'function') ? AP.placedEntries() : [];
}
function earthEntry() {
  var list = entries();
  for (var i = 0; i < list.length; i++) {
    if (list[i].kind === 'earth' && list[i].group) return list[i];
  }
  return null;
}
function modelEntries() {
  var out = [], list = entries();
  for (var i = 0; i < list.length; i++) {
    if (list[i].kind === 'model' && list[i].group) out.push(list[i]);
  }
  return out;
}
function detachAnchor(e) {
  if (e.anchor) { try { e.anchor.delete(); } catch (x) {} } // real XRAnchor API
  e.anchor = null;
}

/* ---------------- HUD chip ---------------- */
function ensureChip() {
  var c = document.getElementById('ar-orbit-chip');
  if (c) return c;
  c = document.createElement('div');
  c.id = 'ar-orbit-chip';
  c.className = 'hud'; // taps on .hud never double-fire 3D selection
  c.setAttribute('role', 'button');
  c.setAttribute('aria-label', 'Orbit speed — tap to change');
  c.style.cssText = [
    'position:fixed', 'top:10px', 'right:10px', 'z-index:80', 'display:none',
    'background:rgba(3,12,24,.92)', 'border:1px solid rgba(0,229,255,.5)',
    'border-radius:999px', 'padding:8px 14px', 'color:#eaffff',
    'font-size:.72rem', 'font-weight:700', 'cursor:pointer',
    'user-select:none', '-webkit-user-select:none'
  ].join(';');
  c.onclick = function () { cycleSpeed(); };
  document.body.appendChild(c);
  return c;
}
function updateChip() {
  var c = document.getElementById('ar-orbit-chip');
  if (c) c.textContent = '\uD83D\uDEF0 Orbit on \u00B7 ' + speedLabel(ORBIT.speed);
}
function showChip() { var c = ensureChip(); c.style.display = 'block'; updateChip(); }
function hideChip() { var c = document.getElementById('ar-orbit-chip'); if (c) c.style.display = 'none'; }
function syncPickerBtn() {
  var btn = document.getElementById('ar-fun-orbit');
  if (btn) btn.textContent = ORBIT.on ? '\uD83D\uDEF0 Orbit: on' : '\uD83D\uDEF0 Orbit';
}

/* ---------------- public feature API ---------------- */
function isOn() { return ORBIT.on; }

function setOrbit(on, silent) {
  var b = B();
  if (on) {
    if (!b || !b.ar || !b.ar.isActive || !b.ar.isActive()) {
      toast('Start AR first, then turn on Orbit \uD83D\uDEF0');
      return false;
    }
    var earth = earthEntry();
    if (!earth) {
      toast('Place Earth first, then turn on Orbit \uD83D\uDEF0');
      return false;
    }
    ORBIT.on = true;
    lastT = 0; // first wrapped frame measures dt from here — no jump
    noted = {};
    var models = modelEntries();
    for (var i = 0; i < models.length; i++) {
      var e = models[i];
      e._orbiting = true;
      detachAnchor(e); // orbit math owns the group now; base gluing must not fight it
      if (!(e.id in angles)) angles[e.id] = i * 0.9; // staggered starting spots
      if (!silent) {
        var p = matchParams(e);
        if (p.special === 'jwst' && !noted.jwst) {
          noted.jwst = true;
          toast("JWST doesn't orbit Earth \u2014 it orbits the Sun with us! \u2600\uFE0F");
        }
        if (p.special === 'chandra' && !noted.chandra) {
          noted.chandra = true;
          toast("Chandra's real orbit is huge \u2014 we squeezed it to fit your room! \uD83D\uDD2D");
        }
      }
    }
    writePref();
    showChip();
    syncPickerBtn();
    if (!silent) toast('Orbit on \u2014 watch them fly around Earth! \uD83D\uDEF0');
    return true;
  }
  // off — leave satellites exactly where they are
  var list = entries();
  for (var j = 0; j < list.length; j++) {
    if (list[j]._orbiting) {
      list[j]._orbiting = false;
      detachAnchor(list[j]); // base gluing must not snap them back to old anchors
    }
  }
  ORBIT.on = false;
  angles = {};
  writePref();
  hideChip();
  syncPickerBtn();
  if (!silent) toast('Orbit off \u2014 satellites stay where they are');
  return false;
}

function toggle() { return setOrbit(!ORBIT.on, false); }

function cycleSpeed() {
  var i = SPEEDS.indexOf(ORBIT.speed);
  ORBIT.speed = SPEEDS[(i + 1) % SPEEDS.length];
  writePref();
  updateChip();
  return speedLabel(ORBIT.speed);
}

/* ---------------- wrapped XR frame ----------------
   Runs AFTER the base onFrame, so orbit positions override anchor gluing.
   No WebXR calls here at all — just scene-graph positions. */
function orbitFrame() {
  if (!ORBIT.on) return;
  var earth = earthEntry();
  if (!earth) { setOrbit(false, true); return; } // earth gone (clear room) — stand down quietly
  var now = performance.now();
  var dt = lastT ? Math.min((now - lastT) / 1000, 0.1) : 0; // clamp stalls to 0.1 s
  lastT = now;
  if (dt <= 0) return;
  var ex = earth.group.position.x;
  var ey = earth.group.position.y;
  var ez = earth.group.position.z;
  var models = modelEntries(); // fresh every frame — late-placed models join in
  for (var i = 0; i < models.length; i++) {
    var e = models[i];
    e._orbiting = true;
    if (e.anchor) detachAnchor(e); // late anchor arrival — orbit still owns the group
    var p = matchParams(e);
    var R = radiusFor(i, p);
    var T = periodSeconds(p);
    var a = (angles[e.id] || 0) + (2 * Math.PI * dt) / T;
    angles[e.id] = a;
    var incl = (p.incl * Math.PI) / 180;
    var s = Math.sin(a), co = Math.cos(a);
    e.group.position.set(
      ex + R * co,
      ey + R * s * Math.sin(incl),
      ez + R * s * Math.cos(incl)
    );
  }
}

/* ---------------- wrapped session lifecycle ---------------- */
function clearResume() {
  if (resumeTimer) { clearInterval(resumeTimer); resumeTimer = null; }
}
function orbitSessionStart() {
  clearResume();
  var pref = readPref();
  ORBIT.speed = pref.speed; // speed always restored; chip label stays truthful
  updateChip();
  if (!pref.on) return;
  // Saved placements restore async (GLB loads) — poll for Earth, then resume.
  var tries = 0;
  resumeTimer = setInterval(function () {
    tries++;
    var bb = B();
    if (!bb || !bb.ar || !bb.ar.isActive || !bb.ar.isActive()) { clearResume(); return; }
    if (earthEntry()) {
      clearResume();
      if (setOrbit(true, true)) toast('Welcome back \u2014 orbit resumed \uD83D\uDEF0');
      return;
    }
    if (tries >= 12) clearResume(); // 12 s — earth never came back, stop polling
  }, 1000);
}
function orbitSessionEnd() {
  clearResume();
  ORBIT.on = false; // in-memory only — persisted pref is kept for next session
  angles = {};
  lastT = 0;
  hideChip();
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
  AP.onFrame = function (frame) { _onFrame(frame); orbitFrame(frame); };
  var _onStart = AP.onSessionStart.bind(AP);
  AP.onSessionStart = function (session) { _onStart(session); orbitSessionStart(session); };
  var _onEnd = AP.onSessionEnd.bind(AP);
  AP.onSessionEnd = function () { _onEnd(); orbitSessionEnd(); };

  window.ARFun = window.ARFun || {};
  window.ARFun.orbit = {
    toggle: toggle,
    isOn: isOn,
    cycleSpeed: cycleSpeed
  };

  ORBIT.speed = readPref().speed;
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
