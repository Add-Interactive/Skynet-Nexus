// Skynet Nexus — site fixes (contact form + leaderboard).
// Rewires the contact form to POST /api/contact and populates the leaderboard
// from GET /api/leaderboard. Both degrade gracefully if the endpoints aren't ready.
(function () {
  'use strict';

  function toast(msg) {
    try {
      if (window.toast) { window.toast(msg); return; }
      alert(msg);
    } catch (e) { alert(msg); }
  }

  // ---- Contact form: POST to /api/contact instead of fake toast ----
  function fixContact() {
    var form = document.getElementById('contact-form');
    if (!form || form.dataset.fixed) return;
    // Drop the old stub listener by cloning.
    var nf = form.cloneNode(true);
    form.replaceWith(nf);
    form = nf;
    form.dataset.fixed = '1';
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = (form.querySelector('[name=name]') || {}).value || '';
      var email = (form.querySelector('[name=email]') || {}).value || '';
      var message = (form.querySelector('[name=message]') || form.querySelector('textarea') || {}).value || '';
      name = String(name).trim(); email = String(email).trim(); message = String(message).trim();
      if (!name || !email || !message) { toast('Please fill in your name, email, and message.'); return; }
      var btn = form.querySelector('[type=submit]');
      if (btn) btn.disabled = true;
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, email: email, message: message })
      }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (btn) btn.disabled = false;
          if (res.ok) {
            toast('Thanks! We got your message and will get back to you soon.');
            form.reset();
          } else {
            toast((res.d && res.d.error) || 'Something went wrong. Please try again.');
          }
        })
        .catch(function () {
          if (btn) btn.disabled = false;
          toast('Something went wrong. Please try again.');
        });
    });
  }

  // ---- Leaderboard: populate from /api/leaderboard ----
  function fixLeaderboard() {
    var el = document.getElementById('leaderboard');
    if (!el || el.dataset.fixed) return;
    el.dataset.fixed = '1';
    fetch('/api/leaderboard')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var rows = d && d.leaders;
        if (!rows || !rows.length) return; // keep the "warming up" placeholder
        el.innerHTML = rows.map(function (u, i) {
          return '<div class="lb-item">' +
            '<div class="lb-rank">' + (i + 1) + '</div>' +
            '<div class="lb-avatar">' + (u.avatar || '🌟') + '</div>' +
            '<div class="lb-body">' +
              '<div class="lb-name">' + u.name + '</div>' +
              '<div class="lb-crew">Level ' + (u.level || 1) + '</div>' +
            '</div>' +
            '<div class="lb-score">' + (u.xp || 0) + ' XP</div>' +
          '</div>';
        }).join('');
      })
      .catch(function () { /* keep placeholder */ });
  }

  // Run when DOM is ready.
  function init() {
    fixContact();
    fixLeaderboard();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // Also retry shortly after (app.js renders async on some pages).
  setTimeout(init, 1500);
})();
