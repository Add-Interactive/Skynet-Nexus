/* ============================================================
   NEXUS SHIELD — Security Operations Center
   Standalone dashboard script for the admin panel's 🛡️ Security tab.
   Self-contained: hooks the nav button directly, manages its own
   lifecycle, uses the same session auth as the rest of the panel.
   ============================================================ */
(function () {
  'use strict';

  var API = '/api';
  var VIEW = 'security';
  var active = false;
  var refreshTimer = null;
  var navCheckTimer = null;
  var rafId = null;

  // ---------- minimal helpers (mirror admin.js patterns) ----------
  function $(sel, el) { return (el || document).querySelector(sel); }
  function h(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function api(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      method: opts.method || 'GET',
      body: opts.body != null ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || ('Request failed (' + res.status + ')'));
          err.status = res.status; err.data = data;
          throw err;
        }
        return data;
      });
    });
  }
  function toast(msg, isErr) {
    var el = document.getElementById('admin-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('err', !!isErr);
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- nav interception ----------
  // admin.js's delegated nav handler would show "Unknown view" for 'security'
  // since Views.security lives here. Intercept in the capture phase.
  function hookNav() {
    var navEl = document.getElementById('admin-nav');
    if (!navEl) return false;
    navEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.admin-nav-link');
      if (!btn || btn.getAttribute('data-view') !== VIEW) return;
      e.stopPropagation();
      e.preventDefault();
      // update active states like admin.js navTo does
      Array.prototype.forEach.call(navEl.querySelectorAll('.admin-nav-link'), function (b) {
        b.classList.toggle('active', b === btn);
      });
      navEl.classList.remove('open');
      render();
    }, true);
    return true;
  }

  // ---------- teardown ----------
  function teardown() {
    active = false;
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    if (navCheckTimer) { clearInterval(navCheckTimer); navCheckTimer = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }
  // If the user navigates elsewhere via admin.js navTo, our view is replaced.
  // Watch for that and stop timers/animation.
  function watchNavAway() {
    navCheckTimer = setInterval(function () {
      var btn = document.querySelector('#admin-nav .admin-nav-link.active');
      if (!btn || btn.getAttribute('data-view') !== VIEW) teardown();
    }, 2000);
  }

  // ---------- main render ----------
  function render() {
    teardown();
    active = true;
    var main = document.getElementById('admin-main');
    if (!main) return;
    main.innerHTML = '';

    var root = h(
      '<div class="shield-ops">' +
        '<div class="shield-scanlines"></div>' +
        '<div class="shield-grid-bg"></div>' +

        '<header class="shield-banner">' +
          '<div class="shield-banner-left">' +
            '<div class="shield-emblem">🛡️</div>' +
            '<div>' +
              '<h1 class="shield-title">NEXUS SHIELD</h1>' +
              '<p class="shield-subtitle">CHILD SAFETY OPERATIONS · LIVE THREAT MONITORING</p>' +
            '</div>' +
          '</div>' +
          '<div class="shield-gauge-wrap">' +
            '<div class="shield-gauge" id="shield-gauge"><span id="shield-gauge-level">—</span></div>' +
            '<div class="shield-gauge-label">THREAT LEVEL</div>' +
          '</div>' +
        '</header>' +

        '<div class="shield-stats" id="shield-stats">' +
          '<div class="shield-stat"><div class="shield-stat-val" id="st-failed">—</div><div class="shield-stat-label">FAILED LOGINS · 24H</div></div>' +
          '<div class="shield-stat"><div class="shield-stat-val" id="st-blocked">—</div><div class="shield-stat-label">BLOCKED REQUESTS · 24H</div></div>' +
          '<div class="shield-stat"><div class="shield-stat-val" id="st-ips">—</div><div class="shield-stat-label">SUSPICIOUS IPS · 24H</div></div>' +
          '<div class="shield-stat"><div class="shield-stat-val" id="st-hour">—</div><div class="shield-stat-label">EVENTS · LAST HOUR</div></div>' +
          '<div class="shield-stat"><div class="shield-stat-val" id="st-intercepted">0</div><div class="shield-stat-label">THREATS INTERCEPTED</div></div>' +
        '</div>' +

        '<div class="shield-panels">' +
          '<section class="shield-panel shield-radar-panel">' +
            '<h2><span class="shield-pulse-dot"></span>LIVE INTERCEPTION GRID</h2>' +
            '<canvas id="shield-radar" height="300"></canvas>' +
            '<div class="shield-radar-legend"><span class="lg-threat">● incoming</span><span class="lg-hit">● intercepted</span><span class="lg-sweep">● sweep</span></div>' +
          '</section>' +

          '<section class="shield-panel">' +
            '<h2><span class="shield-pulse-dot"></span>TOP OFFENDERS · 24H</h2>' +
            '<div id="shield-topips" class="shield-topips"><div class="shield-empty">Loading…</div></div>' +
          '</section>' +
        '</div>' +

        '<section class="shield-panel shield-feed-panel">' +
          '<div class="shield-feed-head">' +
            '<h2><span class="shield-pulse-dot"></span>SECURITY EVENT FEED</h2>' +
            '<div class="shield-filters" id="shield-filters">' +
              '<button class="shield-filter active" data-type="">ALL</button>' +
              '<button class="shield-filter" data-type="failed_login">LOGINS</button>' +
              '<button class="shield-filter" data-type="blocked_ip">BLOCKED</button>' +
              '<button class="shield-filter" data-type="scan_detected">SCANS</button>' +
              '<button class="shield-filter" data-type="rate_limit">RATE</button>' +
            '</div>' +
          '</div>' +
          '<div class="shield-sweep" id="shield-sweep" hidden></div>' +
          '<div class="shield-terminal" id="shield-feed"><div class="shield-empty">Establishing secure uplink…</div></div>' +
        '</section>' +

        '<section class="shield-panel">' +
          '<h2>⛔ IP BLOCKLIST</h2>' +
          '<div class="shield-block-form">' +
            '<input id="shield-ip" class="shield-input" placeholder="IP address  (e.g. 203.0.113.45)" />' +
            '<input id="shield-reason" class="shield-input" placeholder="Reason (optional)" />' +
            '<button class="shield-btn shield-btn-danger" id="shield-block-go">BLOCK IP</button>' +
          '</div>' +
          '<div id="shield-blocklist" class="shield-blocklist"><div class="shield-empty">Loading blocklist…</div></div>' +
        '</section>' +

        '<section class="shield-panel">' +
          '<div class="shield-feed-head">' +
            '<h2><span class="shield-pulse-dot"></span>FILE INTEGRITY</h2>' +
            '<button class="shield-btn shield-btn-xs" id="shield-rebaseline">RE-BASELINE</button>' +
          '</div>' +
          '<div id="shield-integrity-status" class="shield-integrity-status"><div class="shield-empty">Verifying file checksums…</div></div>' +
          '<div id="shield-integrity-files" class="shield-integrity-files"></div>' +
        '</section>' +
      '</div>'
    );
    main.appendChild(root);

    var currentFilter = '';
    var interceptedCount = 0;
    var threatLevel = 'LOW';

    var TYPE_META = {
      failed_login: { label: 'FAILED_LOGIN', cls: 'ev-warn' },
      admin_unauthorized: { label: 'ADMIN_403', cls: 'ev-warn' },
      rate_limit: { label: 'RATE_LIMIT', cls: 'ev-info' },
      blocked_ip: { label: 'BLOCKED_IP', cls: 'ev-danger' },
      scan_detected: { label: 'SCAN', cls: 'ev-danger' },
      ip_blocked: { label: 'IP_BLOCKED', cls: 'ev-ok' },
      ip_unblocked: { label: 'IP_UNBLOCKED', cls: 'ev-info' },
      integrity_violation: { label: 'INTEGRITY', cls: 'ev-danger' },
      integrity_rebaseline: { label: 'REBASELINE', cls: 'ev-info' }
    };

    function fmtTime(iso) {
      try {
        var d = new Date(String(iso).replace(' ', 'T') + 'Z');
        return d.toLocaleTimeString(undefined, { hour12: false });
      } catch (e) { return iso; }
    }
    function setStat(id, v) {
      var el = document.getElementById(id);
      if (!el) return;
      el.textContent = v;
      el.classList.remove('stat-flash');
      void el.offsetWidth;
      el.classList.add('stat-flash');
    }
    function renderGauge(level) {
      var g = document.getElementById('shield-gauge');
      var l = document.getElementById('shield-gauge-level');
      if (!g || !l) return;
      l.textContent = level;
      g.className = 'shield-gauge threat-' + level;
    }
    function renderTopIps(ips) {
      var el = document.getElementById('shield-topips');
      if (!el) return;
      if (!ips.length) { el.innerHTML = '<div class="shield-empty">No suspicious activity in the last 24h. All quiet.</div>'; return; }
      el.innerHTML = ips.slice(0, 8).map(function (r) {
        return '<div class="shield-iprow"><code>' + escHtml(r.ip) + '</code>' +
          '<div class="shield-ipbar"><div style="width:' + Math.min(100, r.n * 10) + '%"></div></div>' +
          '<span class="shield-ipcount">' + r.n + '</span>' +
          '<button class="shield-btn shield-btn-xs" data-blockip="' + escHtml(r.ip) + '">block</button></div>';
      }).join('');
      Array.prototype.forEach.call(el.querySelectorAll('[data-blockip]'), function (b) {
        b.addEventListener('click', function () { blockIp(b.getAttribute('data-blockip'), 'top offender'); });
      });
    }

    function loadSummary() {
      return api('/admin/security/summary').then(function (s) {
        if (!active) return;
        var h24 = s.last24h || {};
        var h1 = s.lastHour || {};
        setStat('st-failed', h24.failed_login || 0);
        setStat('st-blocked', (h24.blocked_ip || 0) + (h24.scan_detected || 0));
        setStat('st-ips', (s.topIps || []).length);
        var hourTotal = Object.keys(h1).reduce(function (a, k) { return a + (h1[k] || 0); }, 0);
        setStat('st-hour', hourTotal);
        threatLevel = s.threatLevel || 'LOW';
        renderGauge(threatLevel);
        renderTopIps(s.topIps || []);
      }).catch(function () {});
    }
    function loadEvents() {
      var q = '/admin/security/events?limit=60' + (currentFilter ? '&type=' + encodeURIComponent(currentFilter) : '');
      return api(q).then(function (r) {
        if (!active) return;
        var feed = document.getElementById('shield-feed');
        if (!feed) return;
        var events = r.events || [];
        if (!events.length) { feed.innerHTML = '<div class="shield-empty">No events match this filter.</div>'; return; }
        feed.innerHTML = events.map(function (e) {
          var m = TYPE_META[e.event_type] || { label: String(e.event_type).toUpperCase(), cls: 'ev-info' };
          var det = '';
          try {
            var d = JSON.parse(e.details || '{}');
            det = d.reason || d.path || d.email || '';
          } catch (x) {}
          return '<div class="shield-ev ' + m.cls + '"><span class="ev-time">[' + fmtTime(e.created_at) + ']</span>' +
            '<span class="ev-type">' + m.label + '</span>' +
            '<span class="ev-ip">' + escHtml(e.ip || '—') + '</span>' +
            '<span class="ev-det">' + escHtml(det) + '</span></div>';
        }).join('');
      }).catch(function () {});
    }
    function loadBlocklist() {
      return api('/admin/security/blocklist').then(function (r) {
        if (!active) return;
        var el = document.getElementById('shield-blocklist');
        if (!el) return;
        var ips = r.ips || [];
        if (!ips.length) { el.innerHTML = '<div class="shield-empty">Blocklist is empty. No IPs currently denied.</div>'; return; }
        el.innerHTML = ips.map(function (e) {
          return '<div class="shield-iprow blocked"><code>' + escHtml(e.ip) + '</code>' +
            '<span class="ev-det">' + escHtml(e.reason || '') + '</span>' +
            '<span class="ev-time">' + escHtml((e.blockedAt || '').slice(0, 10)) + '</span>' +
            '<button class="shield-btn shield-btn-xs" data-unblock="' + escHtml(e.ip) + '">unblock</button></div>';
        }).join('');
        Array.prototype.forEach.call(el.querySelectorAll('[data-unblock]'), function (b) {
          b.addEventListener('click', function () { unblockIp(b.getAttribute('data-unblock')); });
        });
      }).catch(function () {});
    }
    function loadIntegrity() {
      return api('/admin/security/integrity').then(function (r) {
        if (!active) return;
        var statusEl = document.getElementById('shield-integrity-status');
        var filesEl = document.getElementById('shield-integrity-files');
        if (!statusEl || !filesEl) return;
        var files = r.files || [];
        var bad = files.filter(function (f) { return f.status !== 'ok'; });
        if (r.baselineCreated) {
          statusEl.innerHTML = '<div class="shield-integrity-banner int-warn">⚠ BASELINE CREATED — ' +
            files.length + ' files fingerprinted. Future changes will raise alerts.</div>';
        } else if (r.ok) {
          statusEl.innerHTML = '<div class="shield-integrity-banner int-ok">✓ ALL FILES VERIFIED — ' +
            files.length + ' checksums match baseline.</div>';
        } else {
          statusEl.innerHTML = '<div class="shield-integrity-banner int-bad">⛔ ' + bad.length +
            ' OF ' + files.length + ' FILES CHANGED — possible tampering, investigate now.</div>';
        }
        filesEl.innerHTML = files.map(function (f) {
          var badge = f.status === 'ok'
            ? '<span class="int-badge int-ok">VERIFIED</span>'
            : f.status === 'missing'
              ? '<span class="int-badge int-bad">MISSING</span>'
              : f.status === 'new'
                ? '<span class="int-badge int-warn">NEW</span>'
                : '<span class="int-badge int-bad">CHANGED</span>';
          return '<div class="shield-iprow"><code>' + escHtml(f.path) + '</code>' + badge + '</div>';
        }).join('');
      }).catch(function () {
        var statusEl = document.getElementById('shield-integrity-status');
        if (statusEl) statusEl.innerHTML = '<div class="shield-empty">Integrity check unavailable.</div>';
      });
    }
    function rebaseline() {
      if (!window.confirm('Re-baseline file integrity?\n\nThis fingerprints all monitored files as the new trusted state. Only do this right after a legitimate deploy.')) return;
      api('/admin/security/integrity/rebaseline', { method: 'POST' })
        .then(function (r) { toast('Baseline updated — ' + r.files + ' files fingerprinted'); loadIntegrity(); })
        .catch(function (e) { toast(e.message, true); });
    }
    function refreshAll(withSweep) {
      if (withSweep) {
        var sw = document.getElementById('shield-sweep');
        if (sw) {
          sw.hidden = false;
          sw.classList.remove('sweep-run');
          void sw.offsetWidth;
          sw.classList.add('sweep-run');
          setTimeout(function () { sw.hidden = true; }, 1200);
        }
      }
      loadSummary();
      loadEvents();
      loadBlocklist();
      loadIntegrity();
    }
    function blockIp(ip, reason) {
      if (!ip) { toast('Enter an IP address', true); return; }
      api('/admin/security/block-ip', { method: 'POST', body: { ip: ip, reason: reason || '' } })
        .then(function () { toast('IP blocked: ' + ip); loadBlocklist(); loadSummary(); })
        .catch(function (e) { toast(e.message, true); });
    }
    function unblockIp(ip) {
      api('/admin/security/unblock-ip', { method: 'POST', body: { ip: ip } })
        .then(function () { toast('IP unblocked: ' + ip); loadBlocklist(); loadSummary(); })
        .catch(function (e) { toast(e.message, true); });
    }

    document.getElementById('shield-block-go').addEventListener('click', function () {
      blockIp(
        document.getElementById('shield-ip').value.trim(),
        document.getElementById('shield-reason').value.trim()
      );
    });
    var rebaseBtn = document.getElementById('shield-rebaseline');
    if (rebaseBtn) rebaseBtn.addEventListener('click', rebaseline);
    document.getElementById('shield-filters').addEventListener('click', function (e) {
      var b = e.target.closest('.shield-filter');
      if (!b) return;
      Array.prototype.forEach.call(this.querySelectorAll('.shield-filter'), function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      currentFilter = b.getAttribute('data-type') || '';
      loadEvents();
    });

    // ----- canvas: live interception grid -----
    var canvas = document.getElementById('shield-radar');
    var ctx = canvas.getContext('2d');
    var threats = [];
    var rings = [];
    var sweepAngle = 0;

    function sizeCanvas() {
      var w = canvas.parentElement.clientWidth - 36;
      canvas.width = Math.max(280, w);
      canvas.style.width = canvas.width + 'px';
    }
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);

    function spawnThreat() {
      threats.push({
        angle: Math.random() * Math.PI * 2,
        dist: 1.05,
        speed: 0.0018 + Math.random() * 0.003,
        hue: Math.random() < 0.7 ? 'ff2e63' : 'ffb020',
        wobble: Math.random() * Math.PI * 2
      });
    }
    function drawRadar() {
      if (!active) return;
      var W = canvas.width, H = canvas.height;
      var cx = W / 2, cy = H / 2;
      var R = Math.min(W, H) / 2 - 14;

      ctx.clearRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(0,229,255,0.07)';
      ctx.lineWidth = 1;
      var gx, gy;
      for (gx = cx - R * 2; gx <= cx + R * 2; gx += 32) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (gy = cy - R * 2; gy <= cy + R * 2; gy += 32) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(0,229,255,0.22)';
      [0.33, 0.66, 1].forEach(function (f) {
        ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2); ctx.stroke();
      });

      sweepAngle += 0.022;
      if (ctx.createConicGradient) {
        var grad = ctx.createConicGradient(sweepAngle, cx, cy);
        grad.addColorStop(0, 'rgba(0,229,255,0.35)');
        grad.addColorStop(0.12, 'rgba(0,229,255,0)');
        grad.addColorStop(1, 'rgba(0,229,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0,229,255,0.6)';
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * R, cy + Math.sin(sweepAngle) * R); ctx.stroke();

      var pulse = 0.5 + 0.5 * Math.sin(Date.now() / 600);
      ctx.fillStyle = 'rgba(0,229,255,' + (0.10 + pulse * 0.08).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.22, 0, Math.PI * 2); ctx.stroke();
      ctx.font = '22px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🛡️', cx, cy + 1);

      ctx.strokeStyle = 'rgba(57,255,20,0.35)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.34, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);

      var spawnRate = threatLevel === 'ELEVATED' ? 0.06 : threatLevel === 'GUARDED' ? 0.03 : 0.012;
      if (Math.random() < spawnRate && threats.length < 24) spawnThreat();

      threats = threats.filter(function (t) {
        t.dist -= t.speed;
        t.wobble += 0.03;
        var wob = Math.sin(t.wobble) * 0.02;
        var x = cx + Math.cos(t.angle + wob) * R * t.dist;
        var y = cy + Math.sin(t.angle + wob) * R * t.dist;
        if (t.dist <= 0.34) {
          rings.push({ r: R * 0.34, alpha: 1 });
          interceptedCount++;
          var el = document.getElementById('st-intercepted');
          if (el) el.textContent = interceptedCount;
          return false;
        }
        var fade = Math.max(0.25, Math.min(1, (t.dist - 0.3) * 1.4));
        var rr = parseInt(t.hue.slice(0, 2), 16), gg = parseInt(t.hue.slice(2, 4), 16), bb = parseInt(t.hue.slice(4, 6), 16);
        ctx.fillStyle = 'rgba(' + rr + ',' + gg + ',' + bb + ',' + fade.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,' + (fade * 0.5).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
        return true;
      });

      rings = rings.filter(function (rg) {
        rg.r += 2.2; rg.alpha -= 0.03;
        if (rg.alpha <= 0) return false;
        ctx.strokeStyle = 'rgba(57,255,20,' + rg.alpha.toFixed(3) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, rg.r, 0, Math.PI * 2); ctx.stroke();
        return true;
      });

      rafId = requestAnimationFrame(drawRadar);
    }

    refreshAll(false);
    refreshTimer = setInterval(function () {
      if (!active) { if (refreshTimer) clearInterval(refreshTimer); return; }
      refreshAll(true);
    }, 30000);
    watchNavAway();
    drawRadar();
  }

  // ---------- boot ----------
  function boot() {
    if (!hookNav()) {
      // admin.js may not have built the nav yet; retry shortly
      var tries = 0;
      var t = setInterval(function () {
        tries++;
        if (hookNav() || tries > 20) clearInterval(t);
      }, 250);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
