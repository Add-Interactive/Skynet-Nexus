/* admin-console-pro.js — Console Pro: visual one-click ops center.
 * Standalone module (admin.js is IIFE-scoped, so we inject via DOM observation).
 * Injects Task Runner Grid + API Health Board at the top of the 🔧 Console view.
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
          err.status = res.status; throw err;
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

  var injected = false;

  function buildTaskRunner() {
    var sec = h(
      '<section class="admin-card" style="margin-bottom:20px">' +
        '<h2 style="margin-top:0">⚡ Task Runner</h2>' +
        '<p class="hint" style="color:var(--text-mute);font-size:.8rem">One-click operations — no typing required. Destructive actions ask for confirmation.</p>' +
        '<div class="console-task-grid"></div>' +
        '<pre class="admin-console-result" hidden style="margin-top:12px"></pre>' +
      '</section>'
    );
    var grid = sec.querySelector('.console-task-grid');
    var out = sec.querySelector('pre');

    function log(msg, isErr) {
      out.hidden = false;
      out.textContent = msg;
    }

    var TASKS = [
      { icon: '🏥', label: 'API Health Check', desc: 'Ping all critical endpoints',
        run: function (done) { runHealthCheck(true); done('Health check running — see board below.'); } },
      { icon: '📰', label: 'Edition Status', desc: "Today's filed/published counts",
        run: function (done) {
          var today = new Date().toISOString().slice(0, 10);
          capi('/manifest').then(function (m) {
            var arts = (m.articles || []).filter(function (a) { return a.date === today; });
            var byEd = {};
            arts.forEach(function (a) { var e = a.edition || '?'; byEd[e] = (byEd[e] || 0) + 1; });
            var lines = ['Edition status ' + today + ' (' + arts.length + ' articles):'];
            Object.keys(byEd).sort().forEach(function (e) { lines.push('  ' + e + ': ' + byEd[e]); });
            done(lines.join('\n')); toast('Edition status loaded');
          }).catch(function (e) { done('ERROR: ' + e.message, true); });
        } },
      { icon: '🗑️', label: 'Prune Old Data', desc: 'Clean events >30 days', danger: true,
        run: function (done) {
          if (!confirm('Prune security events older than 30 days?\n\nAre you sure?')) { done('Cancelled.'); return; }
          log('Pruning…');
          capi('/admin/system/prune', { method: 'POST', body: {} })
            .then(function (r) { done('Pruned:\n' + JSON.stringify(r.pruned, null, 2)); toast('Prune complete'); })
            .catch(function (e) { done('ERROR: ' + e.message, true); });
        } },
      { icon: '🔄', label: 'Rebaseline Integrity', desc: 'Re-fingerprint files', danger: true,
        run: function (done) {
          if (!confirm('Re-baseline file integrity?\nDo this after every legitimate deploy.\n\nAre you sure?')) { done('Cancelled.'); return; }
          log('Re-baselining…');
          capi('/admin/security/integrity/rebaseline', { method: 'POST', body: {} })
            .then(function (r) { done('OK — re-baselined.\n' + JSON.stringify(r, null, 2).slice(0, 800)); toast('Integrity re-baselined'); })
            .catch(function (e) { done('ERROR: ' + e.message, true); });
        } },
      { icon: '📧', label: 'Push Config Check', desc: 'Verify VAPID push setup',
        run: function (done) {
          fetch(API + '/push/public-key', { credentials: 'same-origin' })
            .then(function (res) { return res.json().catch(function () { return null; }).then(function (d) {
              if (res.ok && d && d.publicKey) done('Push configured ✓\nPublic key present.');
              else done('Push NOT configured — set VAPID keys in Railway env.', true);
            }); })
            .catch(function (e) { done('Push check failed: ' + e.message, true); });
        } },
      { icon: '💾', label: 'Volume Usage', desc: 'Railway volume disk usage',
        run: function (done) {
          capi('/admin/system/stats')
            .then(function (r) { done('Volume: ' + (r.diskUsage || 'unknown') + '\nPath: ' + (r.dataDir || '?')); toast('Volume stats loaded'); })
            .catch(function (e) { done('ERROR: ' + e.message, true); });
        } },
      { icon: '🔑', label: 'Newsroom Key', desc: 'Check / generate API key',
        run: function (done) {
          capi('/admin/system/key-status').then(function (r) {
            var msg = 'Newsroom key: ' + (r.configured ? 'CONFIGURED (' + r.keyPreview + ')' : 'NOT SET');
            if (confirm(msg + '\n\nGenerate a NEW key?\n(You must paste it into Railway env vars.)')) {
              capi('/admin/system/generate-key', { method: 'POST', body: {} })
                .then(function (g) { done('NEW KEY — copy now (shown once):\n' + g.newKey + '\n\n' + g.note); })
                .catch(function (e) { done('ERROR: ' + e.message, true); });
            } else done(msg);
          }).catch(function (e) { done('ERROR: ' + e.message, true); });
        } },
      { icon: '📊', label: 'DB Stats', desc: 'Table row counts',
        run: function (done) {
          capi('/admin/system/stats').then(function (r) {
            var lines = ['Database tables:'];
            Object.keys(r.tables).sort().forEach(function (t) {
              lines.push('  ' + t + ': ' + (r.tables[t] === null ? 'n/a' : r.tables[t]));
            });
            done(lines.join('\n')); toast('DB stats loaded');
          }).catch(function (e) { done('ERROR: ' + e.message, true); });
        } }
    ];

    TASKS.forEach(function (t) {
      var card = h(
        '<button class="console-task-card' + (t.danger ? ' danger' : '') + '">' +
          '<span class="console-task-icon">' + t.icon + '</span>' +
          '<span class="console-task-label">' + t.label + '</span>' +
          '<span class="console-task-desc">' + t.desc + '</span>' +
          '<span class="console-task-status" hidden></span>' +
        '</button>'
      );
      card.addEventListener('click', function () {
        var st = card.querySelector('.console-task-status');
        st.hidden = false; st.textContent = '⏳'; st.className = 'console-task-status running';
        log('Running: ' + t.label + '…');
        try {
          t.run(function (msg, isErr) {
            log(msg, isErr);
            st.textContent = isErr ? '✗' : '✓';
            st.className = 'console-task-status ' + (isErr ? 'err' : 'ok');
          });
        } catch (e) {
          log('ERROR: ' + e.message, true);
          st.textContent = '✗'; st.className = 'console-task-status err';
        }
      });
      grid.appendChild(card);
    });
    return sec;
  }

  function buildHealthBoard() {
    var sec = h(
      '<section class="admin-card" style="margin-bottom:20px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
          '<h2 style="margin:0">🏥 API Health Board</h2>' +
          '<button class="admin-btn admin-btn-sm">↻ Refresh</button>' +
        '</div>' +
        '<p class="hint" style="color:var(--text-mute);font-size:.8rem">Auto-checks when the Console tab opens.</p>' +
        '<table class="console-health-table"><thead><tr><th>Endpoint</th><th>Status</th><th>Time</th><th>Checked</th></tr></thead>' +
        '<tbody><tr><td colspan="4" style="text-align:center;color:var(--text-mute)">Checking…</td></tr></tbody></table>' +
      '</section>'
    );
    var tbody = sec.querySelector('tbody');
    var ENDPOINTS = [
      { name: 'Manifest', path: '/manifest' },
      { name: 'Security Summary', path: '/admin/security/summary' },
      { name: 'Security Integrity', path: '/admin/security/integrity' },
      { name: 'Security Events', path: '/admin/security/events?limit=1' },
      { name: 'Questions', path: '/questions?limit=1' }
    ];

    function check(showToast) {
      tbody.innerHTML = '';
      var pending = ENDPOINTS.length;
      ENDPOINTS.forEach(function (ep) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td><code>' + ep.path + '</code><br><small style="color:var(--text-mute)">' + ep.name + '</small></td>' +
          '<td>⏳</td><td>—</td><td>—</td>';
        tbody.appendChild(tr);
        var tds = tr.querySelectorAll('td');
        var t0 = performance.now();
        fetch(API + ep.path, { credentials: 'same-origin' })
          .then(function (res) {
            var ms = Math.round(performance.now() - t0);
            tds[1].innerHTML = res.ok
              ? '<span class="h-dot ok">●</span> ' + res.status
              : '<span class="h-dot err">●</span> ' + res.status;
            tds[2].textContent = ms + 'ms';
            tds[3].textContent = new Date().toLocaleTimeString();
            if (--pending === 0 && showToast) toast('Health check complete');
          })
          .catch(function () {
            tds[1].innerHTML = '<span class="h-dot err">●</span> ERR';
            tds[3].textContent = new Date().toLocaleTimeString();
            if (--pending === 0 && showToast) toast('Health check done (errors found)', true);
          });
      });
    }

    window.__consoleProHealthCheck = check;
    sec.querySelector('button').addEventListener('click', function () { check(true); });
    return { el: sec, check: check };
  }

  // Observe the main content area; inject when the Console view renders.
  // Reset the flag when navigating away so re-visiting the tab re-injects.
  function tryInject() {
    var main = document.querySelector('#admin-main, main, .admin-main');
    if (!main) { injected = false; return; }
    var head = main.querySelector('h1');
    var isConsole = head && head.textContent.indexOf('Console') !== -1;
    if (!isConsole) { injected = false; return; }
    if (injected && main.querySelector('.console-task-grid')) return;
    injected = true;
    var hb = buildHealthBoard();
    main.insertBefore(buildTaskRunner(), main.firstChild);
    main.insertBefore(hb.el, main.children[1]);
    hb.check(false);
  }

  // Watch for view changes
  var obs = new MutationObserver(tryInject);
  obs.observe(document.body, { childList: true, subtree: true });
  // Also try on load in case console is already rendered
  if (document.readyState === 'complete') tryInject();
  else window.addEventListener('load', tryInject);
})();
