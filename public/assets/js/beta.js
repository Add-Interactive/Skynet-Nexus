/* Skynet Nexus — beta tester welcome banner.
 * Shown on the homepage and profile page to logged-in beta testers who
 * haven't dismissed it. Dismissal is per-user in localStorage. */
(function () {
  var KEY_PREFIX = 'skynet-beta-welcome-dismissed:';

  function boot() {
    // Only on pages that opt in with the banner mount.
    var mount = document.getElementById('beta-welcome-mount');
    if (!mount) return;
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var user = d && d.user;
        if (!user || !user.isBetaTester) return;
        try {
          if (localStorage.getItem(KEY_PREFIX + user.id) === '1') return;
        } catch (e) {}
        var bar = document.createElement('div');
        bar.id = 'beta-welcome';
        bar.setAttribute('role', 'status');
        bar.innerHTML =
          '<div style="display:flex;align-items:center;gap:12px;max-width:1100px;margin:0 auto;padding:12px 18px">' +
          '<span style="font-size:26px">🧪</span>' +
          '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:800;font-size:15px">Welcome, founding tester!</div>' +
          '<div style="font-size:13px;opacity:.85">You\'re one of the first people trying Skynet Nexus. ' +
          'Found a bug or have an idea? <a href="/pages/profile.html#beta-section" style="color:#00e5ff;font-weight:700">Tell us from your profile</a> ' +
          '— and you\'ll earn the <strong>🏅 Beta Tester badge</strong> at launch.</div>' +
          '</div>' +
          '<button type="button" id="beta-welcome-x" aria-label="Dismiss" ' +
          'style="background:none;border:1px solid rgba(255,255,255,.25);border-radius:8px;color:inherit;font-size:16px;padding:4px 10px;cursor:pointer">✕</button>' +
          '</div>';
        bar.style.cssText += 'background:linear-gradient(90deg,rgba(0,229,255,.14),rgba(168,85,247,.14));' +
          'border-bottom:1px solid rgba(0,229,255,.3);color:#e6ecf3;';
        mount.appendChild(bar);
        document.getElementById('beta-welcome-x').addEventListener('click', function () {
          try { localStorage.setItem(KEY_PREFIX + user.id, '1'); } catch (e) {}
          bar.remove();
        });
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
