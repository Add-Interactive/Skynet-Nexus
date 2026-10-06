// What's New auto-open modal for beta testers.
// Shows unseen What's New items in a modal on login during the beta cycle.
// Dismissal updates localStorage so it only appears once per new batch.
(function () {
  var SEEN_KEY = 'sky_whatsnew_seen';
  var SHOWN_SESSION_KEY = 'sky_whatsnew_modal_shown';

  function getSeen() {
    try { return localStorage.getItem(SEEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setSeen(date) {
    try { localStorage.setItem(SEEN_KEY, date); } catch (e) {}
  }
  function shownThisSession() {
    try { return sessionStorage.getItem(SHOWN_SESSION_KEY) === '1'; } catch (e) { return false; }
  }
  function markShownThisSession() {
    try { sessionStorage.setItem(SHOWN_SESSION_KEY, '1'); } catch (e) {}
  }

  function showModal(items, newestDate) {
    // Build modal
    var overlay = document.createElement('div');
    overlay.id = 'wn-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(4,8,20,.72);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);';

    var box = document.createElement('div');
    box.style.cssText = 'background:#0B1026;border:1px solid rgba(0,229,255,.25);border-radius:16px;max-width:520px;width:100%;max-height:80vh;overflow-y:auto;padding:28px;color:#e8f4ff;box-shadow:0 20px 60px rgba(0,0,0,.5);';

    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
      '<h2 style="margin:0;font-size:20px;">✨ What\'s New</h2>' +
      '<button id="wn-modal-close" style="background:none;border:none;color:#8899bb;font-size:24px;cursor:pointer;line-height:1;">&times;</button></div>';

    items.forEach(function (it) {
      var tagColor = it.tag === 'New' ? '#00e5ff' : it.tag === 'Fixed' ? '#39ff14' : '#a855f7';
      html += '<div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.08);">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
        '<span style="font-size:11px;font-weight:700;color:' + tagColor + ';text-transform:uppercase;letter-spacing:.5px;">' + escapeHtml(it.tag || 'Update') + '</span>' +
        '<span style="font-size:11px;color:#66788f;">' + escapeHtml(it.date || '') + '</span></div>' +
        '<div style="font-weight:700;font-size:15px;margin-bottom:4px;">' + escapeHtml(it.title || '') + '</div>' +
        '<div style="font-size:13px;color:#aabbcc;line-height:1.5;">' + escapeHtml(it.body || '') + '</div></div>';
    });

    html += '<button id="wn-modal-gotit" style="width:100%;padding:12px;background:#00e5ff;color:#04121f;border:none;border-radius:10px;font-weight:800;font-size:15px;cursor:pointer;margin-top:8px;">Got it!</button>';
    box.innerHTML = html;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function close() {
      setSeen(newestDate);
      markShownThisSession();
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    document.getElementById('wn-modal-close').onclick = close;
    document.getElementById('wn-modal-gotit').onclick = close;
    overlay.onclick = function (e) { if (e.target === overlay) close(); };
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function boot() {
    if (shownThisSession()) return;
    // Only for logged-in beta testers
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var user = d && d.user;
        if (!user || !user.isBetaTester) return;
        return fetch('/data/whats-new.json', { credentials: 'same-origin' })
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (items) {
            if (!items.length) return;
            items.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
            var newest = items[0].date || '';
            var seen = getSeen();
            if (!newest || newest <= seen) return;
            // Show only unseen items
            var unseen = items.filter(function (it) { return (it.date || '') > seen; });
            if (!unseen.length) return;
            showModal(unseen, newest);
          });
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
