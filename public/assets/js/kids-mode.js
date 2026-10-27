/* ============================================================
   SKYNET NEXUS — Kids Mode toggle module (piece a)
   Shared by: public/index.html (top bar), public/pages/kid.html
   (kid profile screen), public/pages/profile.html (family
   command deck + per-kid parent lock in the Controls modal).

   STORAGE (localStorage, same pattern as team.html's
   'skynet.corrStyle' portrait-style switcher — no new account
   system, no new database table in v1):
     'skynet.kidsMode'       visitor-level 'on' | 'off'
     'skynet.kidsModeByKid'  JSON { kidId: true | false }
     'skynet.kidsModeLock'   JSON { kidId: 'kids' | 'straight' }
   The active kid id is the existing 'nexus_active_kid' key,
   set at login / kid switch and by profile.html.

   RESOLUTION ORDER (first match wins):
     1. Parent lock for the active kid (locked toggle).
     2. Explicit per-kid preference.
     3. Age-based default (ONLY when the cutoff below is set AND
        the active kid's birth year is known).
     4. Visitor-level preference.
     5. Off (current straight-site behavior).

   PARENT LOCK, STATED PLAINLY: the lock is device-level
   (this browser's localStorage). It is NOT server-enforced:
   clearing browser storage, or another browser/device, bypasses
   it. A server-persisted pin (new kid_settings column + PUT/GET
   mapping) is the v2 follow-up; the server settings endpoint
   today whitelists only listen/channels/a11y/public-chat keys.

   The inline <script> in each page's <head> (right after the CSS
   links) duplicates ONLY the stored-preference/lock lookup so the
   marker is set before first paint (no flash). It uses these same
   key strings; keep them in sync if the keys ever change.
   ============================================================ */
(function () {
  'use strict';

  var MODE_KEY = 'skynet.kidsMode';
  var BY_KID_KEY = 'skynet.kidsModeByKid';
  var LOCK_KEY = 'skynet.kidsModeLock';
  var ACTIVE_KID_KEY = 'nexus_active_kid';
  var AGE_KEY = 'skynet.activeKidBirthYear';

  /* ★ Age cutoff decided by Jeff (Oct 27): 10. Ages 10 and under
     default to Kids Mode ON; ages 11 and up default to the
     straight site (mode off). Change this ONE constant to change
     the cutoff everywhere — do not duplicate the number elsewhere
     (the inline head snippets intentionally carry no cutoff). */
  var KIDS_MODE_AGE_CUTOFF = 10;

  function readJSON(key) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : {};
    } catch (e) { return {}; }
  }
  function writeJSON(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) { /* ignore */ }
  }
  function readStr(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStr(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* ignore */ }
  }

  /* Age in whole years from a birth year; null when unknown. */
  function ageFromBirthYear(birthYear) {
    var y = Number(birthYear);
    if (!y) return null;
    var age = new Date().getFullYear() - y;
    return (age >= 0 && age <= 100) ? age : null;
  }

  /* Default mode for an age, or null when the default does not
     apply (cutoff unset, or age unknown). */
  function defaultForAge(age) {
    if (KIDS_MODE_AGE_CUTOFF === null || age === null || age === undefined) return null;
    return age <= KIDS_MODE_AGE_CUTOFF;
  }

  function getActiveKidId() {
    return readStr(ACTIVE_KID_KEY);
  }

  /* Parent lock for a kid: 'kids' | 'straight' | null. */
  function getLock(kidId) {
    if (!kidId) return null;
    var v = readJSON(LOCK_KEY)[kidId];
    return (v === 'kids' || v === 'straight') ? v : null;
  }
  /* Set ('kids' | 'straight') or clear (null) a parent lock. */
  function setLock(kidId, value) {
    if (!kidId) return false;
    var locks = readJSON(LOCK_KEY);
    if (value === null || value === undefined) delete locks[kidId];
    else if (value === 'kids' || value === 'straight') locks[kidId] = value;
    else return false;
    writeJSON(LOCK_KEY, locks);
    applyState();
    return true;
  }

  function resolveState() {
    var kidId = getActiveKidId();
    var lock = getLock(kidId);
    if (lock) {
      return { on: lock === 'kids', locked: true, lockMode: lock, source: 'lock', kidId: kidId };
    }
    if (kidId) {
      var byKid = readJSON(BY_KID_KEY);
      if (Object.prototype.hasOwnProperty.call(byKid, kidId)) {
        return { on: !!byKid[kidId], locked: false, lockMode: null, source: 'preference', kidId: kidId };
      }
    }
    var d = defaultForAge(ageFromBirthYear(readStr(AGE_KEY)));
    if (d !== null) {
      return { on: d, locked: false, lockMode: null, source: 'age', kidId: kidId };
    }
    var visitor = readStr(MODE_KEY);
    if (visitor === 'on' || visitor === 'off') {
      return { on: visitor === 'on', locked: false, lockMode: null, source: 'visitor', kidId: kidId };
    }
    return { on: false, locked: false, lockMode: null, source: 'default', kidId: kidId };
  }

  function paintToggles(st) {
    document.querySelectorAll('[data-kids-mode-toggle]').forEach(function (btn) {
      var label, title;
      if (st.locked) {
        label = st.lockMode === 'kids' ? '🔒 Kids Mode · locked' : '🔒 Straight site · locked';
        title = 'Locked by a parent on this browser. A parent can change it in Controls on the family command deck.';
        btn.disabled = true;
      } else {
        label = st.on ? '🎨 Kids Mode on' : '🎨 Kids Mode';
        title = st.on ? 'Kids Mode is on — tap to turn it off' : 'Tap to turn on Kids Mode';
        btn.disabled = false;
      }
      btn.textContent = label;
      btn.setAttribute('aria-pressed', st.on ? 'true' : 'false');
      btn.setAttribute('title', title);
    });
  }

  function applyState() {
    var st = resolveState();
    document.documentElement.setAttribute('data-kids-mode', st.on ? 'true' : 'false');
    paintToggles(st);
    return st;
  }

  /* Returns false when locked (toggle refused). */
  function setMode(on) {
    var st = resolveState();
    if (st.locked) return false;
    var kidId = st.kidId;
    if (kidId) {
      var m = readJSON(BY_KID_KEY);
      m[kidId] = !!on;
      writeJSON(BY_KID_KEY, m);
    } else {
      writeStr(MODE_KEY, on ? 'on' : 'off');
    }
    applyState();
    return true;
  }

  /* Best-effort age-default refresh. Runs only when the cutoff is
     set (10). Learns the active kid's birth year from /api/kids,
     caches it, and applies the age default when no lock or explicit
     preference exists. Never blocks rendering; failures are silent. */
  function refreshAgeDefault() {
    if (KIDS_MODE_AGE_CUTOFF === null) return;
    var kidId = getActiveKidId();
    if (!kidId || getLock(kidId)) return;
    if (Object.prototype.hasOwnProperty.call(readJSON(BY_KID_KEY), kidId)) return;
    if (readStr(AGE_KEY)) { applyState(); return; }
    fetch('/api/kids', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var kids = (d && (d.kids || d)) || [];
        if (!Array.isArray(kids)) return;
        var kid = kids.filter(function (k) { return String(k.id) === String(kidId); })[0];
        if (kid && kid.birthYear) {
          writeStr(AGE_KEY, String(kid.birthYear));
          applyState();
        }
      })
      .catch(function () { /* signed out or offline: stay on stored state */ });
  }

  /* One delegated handler covers every [data-kids-mode-toggle]
     button on every page — top bar, kid screen, command deck. */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-kids-mode-toggle]') : null;
    if (!btn || btn.disabled) return;
    setMode(!resolveState().on);
  });

  window.KidsMode = {
    isOn: function () { return resolveState().on; },
    toggle: function () { return setMode(!resolveState().on); },
    getLock: getLock,
    setLock: setLock,
    resolveState: resolveState,
    applyState: applyState,
    defaultForAge: defaultForAge,
    ageFromBirthYear: ageFromBirthYear,
    KIDS_MODE_AGE_CUTOFF: KIDS_MODE_AGE_CUTOFF
  };

  applyState();
  refreshAgeDefault();
})();
