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
     'skynet.kidsModePreview'  ADMIN PREVIEW ONLY: 'kids' | 'straight'
   The active kid id is the existing 'nexus_active_kid' key,
   set at login / kid switch and by profile.html.

   RESOLUTION ORDER (first match wins):
     0. Admin preview override (admin panel only, this browser
        only). When set, it forces the marker for that browser
        session and NOTHING else: it never writes, clears, or
        alters any profile key above, any lock, or any default.
        Clearing it restores normal resolution with zero profile
        changes.
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
  var PREVIEW_KEY = 'skynet.kidsModePreview';

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

  /* Admin preview for a kid: 'kids' | 'straight' | null. This is
     a view override for the admin's own browser only — it is NOT
     a profile setting and never feeds back into preferences,
     locks, or defaults. */
  function getPreview() {
    var v = readStr(PREVIEW_KEY);
    return (v === 'kids' || v === 'straight') ? v : null;
  }
  /* Set ('kids' | 'straight') or clear (null) the admin preview.
     Writes ONLY the preview key — no profile key is touched. */
  function setPreview(value) {
    try {
      if (value === null || value === undefined) localStorage.removeItem(PREVIEW_KEY);
      else if (value === 'kids' || value === 'straight') localStorage.setItem(PREVIEW_KEY, value);
      else return false;
    } catch (e) { return false; }
    applyState();
    return true;
  }

  function resolveState() {
    var kidId = getActiveKidId();
    /* Step 0 — admin preview override. Wins over everything,
       including a parent lock, because its whole purpose is
       letting an admin SEE both modes regardless of locks. */
    var preview = getPreview();
    if (preview) {
      return { on: preview === 'kids', locked: false, lockMode: null, source: 'preview', preview: preview, kidId: kidId };
    }
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
      if (st.preview) {
        /* Previewing: regular toggles show the previewed view and
           are disabled, so a click cannot silently write a real
           preference that has no visible effect while the preview
           wins. The preview banner / admin control is the way to
           change the view while previewing. */
        label = st.on ? '👁️ Preview: Kids Mode' : '👁️ Preview: Straight site';
        title = 'Admin preview is on — change the view from the preview banner or the admin View mode control.';
        btn.disabled = true;
      } else if (st.locked) {
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
    paintPreviewControl(st);
    ensurePreviewBanner(st);
    return st;
  }

  /* Paint the admin "View mode" control: the button matching the
     current preview (or "Normal" when no preview is set) carries
     aria-pressed + .is-active. Runs on every page; pages without
     the control simply have nothing to paint. */
  function paintPreviewControl(st) {
    document.querySelectorAll('[data-kids-mode-preview]').forEach(function (btn) {
      var val = btn.getAttribute('data-kids-mode-preview');
      var active = (val === 'clear') ? !st.preview : (st.preview === val);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (btn.classList) btn.classList.toggle('is-active', active);
    });
  }

  /* Persistent preview indicator, injected on ANY page that loads
     this module while a preview is active — so it is always
     obvious the view is a preview, on the admin panel and on site
     pages alike. Inline styles only, so it never depends on which
     stylesheets a page loaded. The button clears the preview
     (one tap back to normal). Removed entirely when no preview
     is set. */
  function ensurePreviewBanner(st) {
    var old = document.getElementById('kids-mode-preview-banner');
    if (old && old.remove) old.remove();
    if (!st.preview || !document.body) return;
    var bar = document.createElement('div');
    bar.id = 'kids-mode-preview-banner';
    bar.setAttribute('style', 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#111827;color:#ffffff;font:600 14px/1.4 system-ui,sans-serif;padding:10px 12px;display:flex;gap:12px;align-items:center;justify-content:center;box-shadow:0 -2px 12px rgba(0,0,0,.4)');
    var label = document.createElement('span');
    label.textContent = st.on
      ? '👁️ Previewing: Kids Mode — preview only, no kid settings changed.'
      : '👁️ Previewing: Straight site — preview only, no kid settings changed.';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-kids-mode-preview', 'clear');
    btn.textContent = 'Back to normal';
    btn.setAttribute('style', 'background:#00e5ff;color:#06121f;border:0;border-radius:999px;padding:6px 14px;font-weight:700;cursor:pointer');
    bar.appendChild(label);
    bar.appendChild(btn);
    document.body.appendChild(bar);
  }

  /* Returns false when locked OR previewing (writes are refused
     while previewing: clear the preview first, so a toggle click
     can never silently write a real preference that the preview
     then hides). */
  function setMode(on) {
    var st = resolveState();
    if (st.locked || st.preview) return false;
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

  /* One delegated handler covers every [data-kids-mode-preview]
     button — the admin View mode control and the preview banner's
     "Back to normal" button. Values: 'kids' | 'straight' | 'clear'. */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-kids-mode-preview]') : null;
    if (!btn) return;
    var val = btn.getAttribute('data-kids-mode-preview');
    if (val === 'kids' || val === 'straight') setPreview(val);
    else if (val === 'clear') setPreview(null);
  });

  window.KidsMode = {
    isOn: function () { return resolveState().on; },
    toggle: function () { return setMode(!resolveState().on); },
    getLock: getLock,
    setLock: setLock,
    getPreview: getPreview,
    setPreview: setPreview,
    clearPreview: function () { return setPreview(null); },
    resolveState: resolveState,
    applyState: applyState,
    defaultForAge: defaultForAge,
    ageFromBirthYear: ageFromBirthYear,
    KIDS_MODE_AGE_CUTOFF: KIDS_MODE_AGE_CUTOFF
  };

  applyState();
  refreshAgeDefault();
})();
