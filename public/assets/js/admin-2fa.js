/* admin-2fa.js — TOTP 2FA for the admin panel.
 * Standalone module (admin.js is IIFE-scoped).
 *
 * Two responsibilities:
 *  1. Intercept 403 { needs2fa: true } from /api/admin/* and show a TOTP
 *     code prompt. On success, retry the original request.
 *  2. Inject a "Two-Factor Authentication" settings card into the Console
 *     view for enable/disable/regenerate.
 */
(function () {
  'use strict';
  var API = '/api';

  function toast(msg, isErr) {
    var el = document.getElementById('admin-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('err', !!isErr);
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  function capi(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      method: opts.method || 'GET',
      body: opts.body != null ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || ('Request failed (' + res.status + ')'));
          err.status = res.status; err.data = data; throw err;
        }
        return data;
      });
    });
  }

  function h(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- 1. Fetch interceptor for 2FA gate ---------- */

  var origFetch = window.fetch.bind(window);
  var modalOpen = false;
  var modalPromise = null;

  window.fetch = function (url, opts) {
    return origFetch(url, opts).then(function (res) {
      var urlStr = typeof url === 'string' ? url : (url && url.url) || '';
      if (urlStr.indexOf('/api/admin/') === -1) return res;
      if (res.status !== 403) return res;
      // Peek at the body without consuming the original.
      return res.clone().json().catch(function () { return null; }).then(function (data) {
        if (data && data.needs2fa) {
          return promptFor2FA().then(function (verified) {
            if (verified) return origFetch(url, opts); // retry with 2FA session flag
            return res; // user cancelled — return original 403
          });
        }
        return res;
      });
    });
  };

  function promptFor2FA() {
    if (modalOpen) return modalPromise;
    modalOpen = true;
    modalPromise = new Promise(function (resolve) {
      var overlay = h(
        '<div style="position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center">' +
        '<div class="admin-card" style="max-width:380px;width:90%;text-align:center">' +
        '<h2 style="margin-top:0">🔐 Two-Factor Authentication</h2>' +
        '<p style="color:var(--text-mute);font-size:.85rem">Enter the 6-digit code from your authenticator app.</p>' +
        '<input id="tfa-code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="11" ' +
        ' style="font-size:1.6rem;text-align:center;letter-spacing:.4em;width:100%;padding:10px;margin:8px 0" placeholder="------"/>' +
        '<p class="hint" style="font-size:.75rem;color:var(--text-mute)">Backup codes work too (XXXX-XXXX).</p>' +
        '<div id="tfa-error" class="sky-error" hidden style="margin-bottom:8px"></div>' +
        '<div style="display:flex;gap:8px;justify-content:center">' +
        '<button id="tfa-submit" class="admin-btn admin-btn-primary">Verify</button>' +
        '<button id="tfa-cancel" class="admin-btn admin-btn-ghost">Cancel</button>' +
        '</div></div></div>'
      );
      document.body.appendChild(overlay);
      var input = overlay.querySelector('#tfa-code-input');
      var errEl = overlay.querySelector('#tfa-error');
      input.focus();

      function close(result) {
        overlay.remove();
        modalOpen = false;
        modalPromise = null;
        resolve(result);
      }
      function showErr(m) { errEl.textContent = m; errEl.hidden = false; }

      function submit() {
        var code = input.value.trim();
        if (!code) { showErr('Enter your code.'); return; }
        errEl.hidden = true;
        capi('/admin/2fa/verify-login', { method: 'POST', body: { token: code } })
          .then(function (r) {
            if (r && r.backupCode) toast('Backup code accepted. ' + r.remaining + ' remaining — regenerate soon.');
            else toast('2FA verified ✓');
            close(true);
          })
          .catch(function (e) { showErr(e.message || 'Invalid code.'); input.select(); });
      }

      overlay.querySelector('#tfa-submit').addEventListener('click', submit);
      overlay.querySelector('#tfa-cancel').addEventListener('click', function () { close(false); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(false); });
    });
    return modalPromise;
  }

  /* ---------- 2. Settings UI in Console view ---------- */

  var injected = false;

  function inject2FACard() {
    if (injected) return;
    var main = document.getElementById('admin-main');
    if (!main) return;
    // Find the console view container (task runner section or main).
    var anchor = main.querySelector('.console-task-grid');
    var container = anchor ? anchor.closest('section') : null;

    var card = h(
      '<section class="admin-card" id="tfa-settings-card" style="margin-bottom:20px">' +
      '<h2 style="margin-top:0">🔐 Two-Factor Authentication</h2>' +
      '<div id="tfa-settings-body"><p style="color:var(--text-mute)">Loading…</p></div>' +
      '</section>'
    );
    if (container && container.parentNode) {
      container.parentNode.insertBefore(card, container.nextSibling);
    } else {
      main.insertBefore(card, main.firstChild);
    }
    injected = true;
    renderSettings();
  }

  function renderSettings() {
    var body = document.getElementById('tfa-settings-body');
    if (!body) return;
    capi('/admin/2fa/status').then(function (s) {
      if (s.enabled) {
        body.innerHTML =
          '<p>✅ <strong>2FA is enabled</strong> on your account.' +
          (s.backupCodesRemaining != null ? ' <span style="color:var(--text-mute)">(' + s.backupCodesRemaining + ' backup codes remaining)</span>' : '') + '</p>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button id="tfa-regen" class="admin-btn">🔑 Regenerate backup codes</button>' +
          '<button id="tfa-disable" class="admin-btn admin-btn-danger">Disable 2FA</button>' +
          '</div><div id="tfa-settings-out" style="margin-top:12px"></div>';
        body.querySelector('#tfa-disable').addEventListener('click', disableFlow);
        body.querySelector('#tfa-regen').addEventListener('click', regenFlow);
      } else {
        body.innerHTML =
          '<p style="color:var(--text-mute)">Add an extra layer of security to your admin account. ' +
          'You\'ll enter a 6-digit code from your authenticator app (Google Authenticator, Authy, 1Password, …) ' +
          'after your password.</p>' +
          '<button id="tfa-enable" class="admin-btn admin-btn-primary">🔐 Enable 2FA</button>' +
          '<div id="tfa-settings-out" style="margin-top:12px"></div>';
        body.querySelector('#tfa-enable').addEventListener('click', setupFlow);
      }
    }).catch(function () {
      body.innerHTML = '<p class="sky-error">Could not load 2FA status.</p>';
    });
  }

  function out(html) {
    var el = document.getElementById('tfa-settings-out');
    if (el) el.innerHTML = html;
  }

  function setupFlow() {
    out('<p>Generating…</p>');
    capi('/admin/2fa/setup', { method: 'POST' }).then(function (r) {
      out(
        '<p><strong>Step 1:</strong> Scan this QR code with your authenticator app:</p>' +
        '<div style="text-align:center;background:#fff;display:inline-block;padding:12px;border-radius:8px;margin:8px 0">' +
        '<img src="' + esc(r.qrDataUrl) + '" alt="2FA QR code" width="220" height="220"/></div>' +
        '<p><strong>Step 2:</strong> Or enter this key manually: <code style="user-select:all">' + esc(r.manualKey) + '</code></p>' +
        '<p><strong>Step 3:</strong> Enter the 6-digit code from your app:</p>' +
        '<div style="display:flex;gap:8px;align-items:center">' +
        '<input id="tfa-setup-code" inputmode="numeric" maxlength="8" style="font-size:1.3rem;text-align:center;letter-spacing:.3em;width:180px;padding:8px" placeholder="------"/>' +
        '<button id="tfa-setup-confirm" class="admin-btn admin-btn-primary">Confirm &amp; Enable</button>' +
        '</div>'
      );
      document.getElementById('tfa-setup-confirm').addEventListener('click', function () {
        var code = document.getElementById('tfa-setup-code').value.trim();
        capi('/admin/2fa/verify', { method: 'POST', body: { token: code } })
          .then(function (v) {
            var codesHtml = v.backupCodes.map(function (c) { return '<code>' + esc(c) + '</code>'; }).join('<br/>');
            out(
              '<p>✅ <strong>2FA enabled!</strong></p>' +
              '<p><strong>Save these backup codes now</strong> — each works once if you lose your authenticator:</p>' +
              '<div style="background:var(--bg-soft,#111);padding:12px;border-radius:8px;font-size:1.1rem;line-height:1.9">' + codesHtml + '</div>' +
              '<p class="hint" style="color:var(--text-mute);font-size:.8rem">They will not be shown again.</p>' +
              '<button id="tfa-done" class="admin-btn">Done</button>'
            );
            document.getElementById('tfa-done').addEventListener('click', renderSettings);
          })
          .catch(function (e) { toast(e.message || 'Invalid code.', true); });
      });
    }).catch(function (e) { toast(e.message || 'Setup failed.', true); });
  }

  function disableFlow() {
    var pw = prompt('Enter your password to disable 2FA:');
    if (!pw) return;
    capi('/admin/2fa/disable', { method: 'POST', body: { password: pw } })
      .then(function () { toast('2FA disabled.'); renderSettings(); })
      .catch(function (e) { toast(e.message || 'Failed.', true); });
  }

  function regenFlow() {
    var pw = prompt('Enter your password to regenerate backup codes:');
    if (!pw) return;
    capi('/admin/2fa/regenerate-codes', { method: 'POST', body: { password: pw } })
      .then(function (r) {
        var codesHtml = r.backupCodes.map(function (c) { return '<code>' + esc(c) + '</code>'; }).join('<br/>');
        out(
          '<p>✅ <strong>New backup codes</strong> (old ones no longer work):</p>' +
          '<div style="background:var(--bg-soft,#111);padding:12px;border-radius:8px;font-size:1.1rem;line-height:1.9">' + codesHtml + '</div>' +
          '<p class="hint" style="color:var(--text-mute);font-size:.8rem">Save them now — they will not be shown again.</p>'
        );
        renderSettings();
      })
      .catch(function (e) { toast(e.message || 'Failed.', true); });
  }

  // Observe for the Console view to inject the settings card.
  var observer = new MutationObserver(function () {
    var main = document.getElementById('admin-main');
    if (!main) return;
    // Heuristic: console view is active when task grid or console result areas exist,
    // or when the console nav button is active.
    var navActive = document.querySelector('.admin-nav-link[data-view="console"].active');
    var card = document.getElementById('tfa-settings-card');
    if (navActive && !card) inject2FACard();
    if (!navActive && card) { card.remove(); injected = false; }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
