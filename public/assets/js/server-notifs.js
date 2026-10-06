// Skynet Nexus — server notifications enhancement.
// Loaded after app.js. Adds server-side notifications (from /api/notifications)
// to the existing bell dropdown, alongside the localStorage unseen-articles.
// Progressive enhancement: if the server API is unavailable or the user is
// signed out, the bell falls back to local-only behavior.
(function () {
  'use strict';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>\"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var KIND_ICON = { assignment: '📝', comment: '💬', cheer: '🎉', edition: '🛰️', creation: '🎨', info: '🔔' };

  // Add server unread count to the badge.
  function updateServerBadge() {
    var badge = document.getElementById('notif-badge');
    if (!badge) return;
    fetch('/api/notifications/unread-count', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var n = (d && d.unread) || 0;
        if (n > 0) {
          var cur = parseInt(badge.textContent, 10) || 0;
          // Only bump if badge is hidden or showing a smaller number
          if (badge.style.display === 'none' || cur < n) {
            badge.style.display = 'grid';
            badge.textContent = n > 99 ? '99+' : n;
          }
        }
      })
      .catch(function () {});
  }

  // Inject server notifications at the top of the dropdown when it opens.
  function injectServerNotifs() {
    var dropdown = document.getElementById('notif-dropdown');
    if (!dropdown || dropdown.dataset.serverNotifs === '1') return;
    fetch('/api/notifications', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var notifs = (d && d.notifications) || [];
        if (!notifs.length) return;
        dropdown.dataset.serverNotifs = '1';
        var html = '<div class="notif-header"><span>Notifications</span>' +
          '<button class="notif-clear" id="btn-server-readall">Mark all read</button></div>' +
          '<ul class="notif-list">';
        notifs.slice(0, 8).forEach(function (n) {
          var icon = KIND_ICON[n.kind] || '🔔';
          html += '<li class="notif-item" data-server-nid="' + n.id + '"' +
            (n.link ? ' data-server-link="' + esc(n.link).replace(/"/g, '&quot;') + '"' : '') +
            (n.read_at ? ' style="opacity:.55"' : '') + '>' +
            '<div class="notif-item-title">' + icon + ' ' + esc(n.title) + '</div>' +
            (n.body ? '<div class="notif-item-meta">' + esc(n.body.slice(0, 120)) + '</div>' : '') +
            '</li>';
        });
        html += '</ul>';
        dropdown.insertAdjacentHTML('afterbegin', html);
        // Bind clicks
        dropdown.querySelectorAll('[data-server-nid]').forEach(function (el) {
          el.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var nid = el.getAttribute('data-server-nid');
            fetch('/api/notifications/' + nid + '/read', { method: 'POST', credentials: 'same-origin' }).catch(function () {});
            var link = el.getAttribute('data-server-link');
            if (link) location.href = link;
          });
        });
        var ra = dropdown.querySelector('#btn-server-readall');
        if (ra) ra.addEventListener('click', function (ev) {
          ev.stopPropagation();
          fetch('/api/notifications/read-all', { method: 'POST', credentials: 'same-origin' })
            .then(function () { dropdown.dataset.serverNotifs = ''; updateServerBadge(); })
            .catch(function () {});
        });
      })
      .catch(function () {});
  }

  // Watch for the bell button; hook dropdown opens.
  function init() {
    var btn = document.getElementById('notif-toggle');
    if (!btn) {
      // Bell not yet created (app.js creates it lazily) — retry.
      setTimeout(init, 1000);
      return;
    }
    btn.addEventListener('click', function () {
      setTimeout(injectServerNotifs, 50);
    });
    updateServerBadge();
    // Refresh badge every 5 minutes.
    setInterval(updateServerBadge, 5 * 60 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
