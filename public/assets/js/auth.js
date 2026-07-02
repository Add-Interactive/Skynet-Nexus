/* ==========================================================================
   auth.js — Skynet Nexus News client auth + splash video + kid profile switcher.
   Pure vanilla. Depends on nothing.
   Loads on every page. Provides window.SkyAuth for other scripts to consume.
   ========================================================================== */

(function () {
  'use strict';

  const API = '/api';
  const LS_ACTIVE_KID = 'skynet.activeKidId';
  const LS_SEEN_INTRO = 'skynet.seenIntro.v1';
  const VIDEO_URL = '/assets/video/skynet-intro.mp4';

  // Discover the correct asset prefix for pages nested under /pages/*.
  // Splash video is served from /assets/video/... — that always works because
  // the site is served by Express with everything under public/ mounted at /.
  const State = {
    user: null,
    kids: [],
    activeKidId: null,
    onChange: []
  };

  // ---------- Public API ----------
  const SkyAuth = window.SkyAuth = {
    state: State,
    subscribe(fn) { State.onChange.push(fn); return () => { State.onChange = State.onChange.filter(f => f !== fn); }; },
    refresh: fetchMe,
    logout,
    playIntro: showSplash,
    getActiveKid() { return State.kids.find(k => k.id === State.activeKidId) || null; },
    setActiveKid,
    isSignedIn() { return !!State.user; },
    // For read-time / feed filters — returns { minAge } based on active kid, else null.
    kidFilter() {
      const kid = this.getActiveKid();
      if (!kid) return null;
      const currentYear = new Date().getFullYear();
      return { age: currentYear - kid.birthYear };
    }
  };

  function emit() {
    for (const fn of State.onChange) { try { fn(State); } catch (e) { console.warn(e); } }
  }

  // ---------- API helpers ----------
  async function api(path, opts = {}) {
    const res = await fetch(API + path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts.body != null && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function fetchMe() {
    try {
      const { user, kids } = await api('/auth/me');
      State.user = user || null;
      State.kids = kids || [];
      // Reconcile active kid: read from localStorage; verify still exists.
      let saved = null;
      try { saved = Number(localStorage.getItem(LS_ACTIVE_KID)); } catch {}
      State.activeKidId = (saved && State.kids.some(k => k.id === saved)) ? saved : null;
      emit();
      return State;
    } catch (err) {
      console.warn('[skynet-auth] fetchMe failed:', err);
      State.user = null; State.kids = []; State.activeKidId = null;
      emit();
      return State;
    }
  }

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    State.user = null; State.kids = []; State.activeKidId = null;
    try { localStorage.removeItem(LS_ACTIVE_KID); } catch {}
    emit();
    // Reload so protected UI resets cleanly.
    setTimeout(() => location.reload(), 200);
  }

  function setActiveKid(kidId) {
    if (kidId == null) {
      State.activeKidId = null;
      try { localStorage.removeItem(LS_ACTIVE_KID); } catch {}
    } else {
      const found = State.kids.find(k => k.id === Number(kidId));
      if (!found) return;
      State.activeKidId = found.id;
      try { localStorage.setItem(LS_ACTIVE_KID, String(found.id)); } catch {}
    }
    emit();
  }

  // ---------- Splash video overlay ----------
  function alreadySeenIntro() {
    try { return localStorage.getItem(LS_SEEN_INTRO) === '1'; } catch { return false; }
  }
  function markIntroSeen() {
    try { localStorage.setItem(LS_SEEN_INTRO, '1'); } catch {}
  }

  function showSplash({ force = false } = {}) {
    if (document.getElementById('sky-splash')) return; // already open

    const overlay = document.createElement('div');
    overlay.id = 'sky-splash';
    overlay.className = 'sky-splash';
    overlay.innerHTML = `
      <div class="sky-splash-frame">
        <video id="sky-splash-video" playsinline preload="auto" controls>
          <source src="${VIDEO_URL}" type="video/mp4"/>
        </video>
        <div class="sky-splash-actions">
          <button type="button" class="sky-splash-skip" id="sky-splash-skip">Skip ✕</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add('sky-splash-open');

    const video = overlay.querySelector('#sky-splash-video');
    const closeBtn = overlay.querySelector('#sky-splash-skip');

    function close() {
      markIntroSeen();
      overlay.remove();
      document.body.classList.remove('sky-splash-open');
    }

    // Try to autoplay with sound; if the browser refuses (autoplay-policy),
    // start it muted so the first frames play, then unmute after user gesture.
    video.muted = false;
    video.volume = 1;
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => {
        video.muted = true;
        video.play().catch(() => { /* fine, user can click play */ });
      });
    }
    // Any user click anywhere on overlay unmutes if we had to mute.
    overlay.addEventListener('click', () => {
      if (video.muted) { video.muted = false; }
    }, { once: true });

    video.addEventListener('ended', close);
    closeBtn.addEventListener('click', close);
    // Esc to close
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }

  // ---------- Header widget: avatar / sign in ----------
  function paintHeaderAvatar() {
    // Find the header avatar button (added in every page HTML).
    const target = document.querySelector('.sky-user-slot');
    if (!target) return;

    if (!State.user) {
      target.innerHTML = `
        <a class="sky-signin-btn" href="/pages/login.html" data-nav="login">Sign in</a>
      `;
      return;
    }

    const kid = SkyAuth.getActiveKid();
    const shown = kid || {
      name: State.user.displayName,
      avatarColor: State.user.avatarColor,
      avatarEmoji: null
    };
    const initials = shown.name.trim().slice(0, 2).toUpperCase();
    target.innerHTML = `
      <div class="sky-user-dd">
        <button type="button" class="sky-user-btn" id="sky-user-btn" aria-haspopup="menu">
          <span class="sky-user-av" style="background:${shown.avatarColor}">
            ${shown.avatarEmoji ? shown.avatarEmoji : initials}
          </span>
          <span class="sky-user-name">${escapeHtml(shown.name)}${kid ? ' <em class="sky-kid-tag">kid</em>' : ''}</span>
        </button>
        <div class="sky-user-menu" id="sky-user-menu" hidden>
          <div class="sky-menu-head">${escapeHtml(State.user.displayName)}<br><small>${escapeHtml(State.user.email)}</small></div>
          ${State.kids.length ? '<div class="sky-menu-label">Reading as</div>' : ''}
          <div class="sky-kid-list">
            <button type="button" class="sky-kid-item ${State.activeKidId == null ? 'active' : ''}" data-kid-id="">
              <span class="sky-kid-av" style="background:${State.user.avatarColor}">${State.user.displayName.trim().slice(0,2).toUpperCase()}</span>
              <span>Me (parent)</span>
            </button>
            ${State.kids.map(k => `
              <button type="button" class="sky-kid-item ${State.activeKidId === k.id ? 'active' : ''}" data-kid-id="${k.id}">
                <span class="sky-kid-av" style="background:${k.avatarColor}">${k.avatarEmoji || k.name.trim().slice(0,2).toUpperCase()}</span>
                <span>${escapeHtml(k.name)} <em class="sky-kid-tag">age ${new Date().getFullYear() - k.birthYear}</em></span>
              </button>
            `).join('')}
          </div>
          <a class="sky-menu-link" href="/pages/profile.html">👪 Family profile</a>
          <button type="button" class="sky-menu-link sky-menu-link-btn" id="sky-menu-intro">▶ Watch intro again</button>
          <button type="button" class="sky-menu-link sky-menu-link-btn sky-danger" id="sky-menu-logout">Sign out</button>
        </div>
      </div>
    `;

    const btn = target.querySelector('#sky-user-btn');
    const menu = target.querySelector('#sky-user-menu');
    const closeMenu = () => menu.hidden = true;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });
    document.addEventListener('click', (e) => {
      if (!target.contains(e.target)) closeMenu();
    });
    menu.querySelectorAll('[data-kid-id]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-kid-id');
        setActiveKid(id === '' ? null : Number(id));
        closeMenu();
      });
    });
    target.querySelector('#sky-menu-intro').addEventListener('click', () => { closeMenu(); showSplash({ force: true }); });
    target.querySelector('#sky-menu-logout').addEventListener('click', logout);
  }

  // ---------- Sidebar user card ----------
  function paintSidebarCard() {
    const card = document.querySelector('.sky-user-card-slot');
    if (!card) return;
    if (!State.user) {
      card.innerHTML = `
        <div class="user-card sky-user-card">
          <div class="av sky-av-anon">👋</div>
          <div class="u-name">Welcome, reader</div>
          <div class="u-tier">Sign in for kid profiles + saved articles</div>
          <div class="sky-cta-row">
            <a class="sky-btn sky-btn-primary" href="/pages/login.html">Sign in</a>
            <a class="sky-btn" href="/pages/register.html">Create account</a>
          </div>
        </div>
      `;
      return;
    }
    const kid = SkyAuth.getActiveKid();
    const shown = kid || { name: State.user.displayName, avatarColor: State.user.avatarColor, avatarEmoji: null };
    const initials = shown.name.trim().slice(0, 2).toUpperCase();
    card.innerHTML = `
      <div class="user-card sky-user-card">
        <div class="av" style="background:${shown.avatarColor}">${shown.avatarEmoji || initials}</div>
        <div class="u-name">${escapeHtml(shown.name)}</div>
        <div class="u-tier">${kid ? '🎒 Kid mode active' : '👪 Parent account'} · ${State.kids.length} kid profile${State.kids.length === 1 ? '' : 's'}</div>
        <div class="sky-cta-row">
          <a class="sky-btn sky-btn-primary" href="/pages/profile.html">Manage family</a>
        </div>
      </div>
    `;
  }

  // ---------- Watch-again button in footer ----------
  function paintIntroButton() {
    const slot = document.querySelector('.sky-intro-slot');
    if (!slot) return;
    slot.innerHTML = `<button type="button" class="sky-intro-btn" id="sky-intro-btn">▶ Watch the welcome video</button>`;
    slot.querySelector('#sky-intro-btn').addEventListener('click', () => showSplash({ force: true }));
  }

  // ---------- Kid-mode banner + feed filter ----------
  function paintKidBanner() {
    // Remove existing banner if any.
    const existing = document.getElementById('sky-kid-banner');
    if (existing) existing.remove();
    const kid = SkyAuth.getActiveKid();
    if (!kid) {
      applyKidAgeFilter(null);
      return;
    }
    const age = new Date().getFullYear() - kid.birthYear;
    const banner = document.createElement('div');
    banner.id = 'sky-kid-banner';
    banner.className = 'sky-kid-mode-banner';
    banner.innerHTML =
      '<span>🎒 Kid mode: ' + escapeHtml(kid.name) + ' (age ' + age + ')</span>' +
      '<button type="button" id="sky-exit-kid">Switch back to parent</button>';
    // Insert just after the ticker if present, else at the top of .app.
    const anchor = document.querySelector('.ticker') || document.querySelector('.app') || document.body.firstChild;
    anchor.parentNode.insertBefore(banner, anchor.nextSibling || null);
    banner.querySelector('#sky-exit-kid').addEventListener('click', () => setActiveKid(null));
    applyKidAgeFilter(age);
  }

  function applyKidAgeFilter(kidAge) {
    // If the current page has a feed grid, tag it so app.js CSS/renderers can react.
    document.body.dataset.kidAge = kidAge == null ? '' : String(kidAge);
    // For simple pages where age filter matters most: hide items marked age-band >= threshold.
    // Post cards render with data-age-band; article page has data-age-band on <article>.
    const threshold = kidAge == null ? Infinity : kidAge;
    document.querySelectorAll('[data-age-band]').forEach(el => {
      const band = parseInt(el.dataset.ageBand, 10);
      if (isNaN(band)) return;
      const tooOld = kidAge != null && band > threshold;
      el.style.display = tooOld ? 'none' : '';
    });
  }

  // ---------- Utils ----------
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  }

  // ---------- Init ----------
  function repaint() {
    paintHeaderAvatar();
    paintSidebarCard();
    paintIntroButton();
    paintKidBanner();
  }

  SkyAuth.subscribe(repaint);

  document.addEventListener('DOMContentLoaded', () => {
    fetchMe().then(() => {
      if (!alreadySeenIntro()) {
        // Small delay so the page has time to paint before the overlay lands.
        setTimeout(() => showSplash(), 400);
      }
    });
  });
})();
