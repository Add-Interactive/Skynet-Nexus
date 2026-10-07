/* ============================================================
   NEXUS SHIELD — Security Team Command Deck
   Cinematic security console for the admin panel's Security tab.
   Sentinel, Hunter and Guardian patrol hourly and report here;
   admins chat with each agent directly from this console.

   Replaces admin-security.js (same nav hook, full view ownership).
   ============================================================ */
(function () {
  'use strict';

  var API = '/api';
  var VIEW = 'security';
  var active = false;
  var refreshTimer = null;
  var navCheckTimer = null;
  var rafId = null;
  var clockTimer = null;

  var AGENTS = {
    sentinel: { name: 'Sentinel', emoji: '\uD83D\uDCE1', role: 'SITE HEALTH', color: '#00e5ff' },
    hunter:   { name: 'Hunter',   emoji: '\uD83C\uDFAF', role: 'THREAT TRACKER', color: '#ff2e63' },
    guardian: { name: 'Guardian', emoji: '\uD83D\uDEE1\uFE0F', role: 'DEFENSE CHECK', color: '#39ff14' }
  };
  var AGENT_ORDER = ['sentinel', 'hunter', 'guardian'];

  var teamState = null;      // latest /team/status
  var threatLevel = 'LOW';
  var interceptedCount = 0;
  var currentFilter = '';
  var chatAgent = 'team';
  var chatBusy = false;

  /* ---------- helpers ---------- */
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
  function fmtTime(iso) {
    try {
      var d = new Date(String(iso).replace(' ', 'T') + 'Z');
      return d.toLocaleTimeString(undefined, { hour12: false });
    } catch (e) { return iso; }
  }
  function fmtAge(min) {
    if (min == null) return 'never';
    if (min < 1) return 'just now';
    if (min < 60) return min + 'm ago';
    return Math.floor(min / 60) + 'h ' + (min % 60) + 'm ago';
  }
  function mdLight(s) {
    // tiny markdown: **bold** only — agent replies are plain text + bold
    return escHtml(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');
  }

  /* ---------- nav hook ---------- */
  function hookNav() {
    var navEl = document.getElementById('admin-nav');
    if (!navEl) return false;
    navEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.admin-nav-link');
      if (!btn || btn.getAttribute('data-view') !== VIEW) return;
      e.stopPropagation();
      e.preventDefault();
      Array.prototype.forEach.call(navEl.querySelectorAll('.admin-nav-link'), function (b) {
        b.classList.toggle('active', b === btn);
      });
      navEl.classList.remove('open');
      render();
    }, true);
    return true;
  }
  function teardown() {
    active = false;
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    if (navCheckTimer) { clearInterval(navCheckTimer); navCheckTimer = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  }
  function watchNavAway() {
    navCheckTimer = setInterval(function () {
      var btn = document.querySelector('#admin-nav .admin-nav-link.active');
      if (!btn || btn.getAttribute('data-view') !== VIEW) teardown();
    }, 2000);
  }

  /* ---------- boot overlay ---------- */
  var BOOT_LINES = [
    'NEXUS SHIELD // SECURE UPLINK',
    '> authenticating command deck … OK',
    '> waking Sentinel … ON PATROL',
    '> waking Hunter … ON PATROL',
    '> waking Guardian … ON PATROL',
    '> threat grid synchronized'
  ];
  function bootSequence(done) {
    var ov = $('#st-boot');
    if (!ov) { done(); return; }
    ov.hidden = false;
    var term = $('#st-boot-term');
    term.innerHTML = '';
    var i = 0;
    function next() {
      if (!active) { done(); return; }
      if (i >= BOOT_LINES.length) {
        setTimeout(function () {
          ov.classList.add('st-boot-done');
          setTimeout(function () { ov.hidden = true; done(); }, 450);
        }, 350);
        return;
      }
      var div = document.createElement('div');
      div.className = 'st-boot-line';
      div.textContent = BOOT_LINES[i];
      term.appendChild(div);
      i++;
      setTimeout(next, 220);
    }
    next();
  }

  /* ---------- main render ---------- */
  function render() {
    teardown();
    active = true;
    var main = document.getElementById('admin-main');
    if (!main) return;
    main.innerHTML = '';

    var root = h(
      '<div class="st-deck">' +
        '<div class="shield-scanlines"></div>' +
        '<div class="shield-grid-bg"></div>' +

        '<div class="st-boot" id="st-boot" hidden>' +
          '<div class="st-boot-box">' +
            '<div class="st-boot-title">🛡️ NEXUS SHIELD</div>' +
            '<div class="st-boot-term" id="st-boot-term"></div>' +
            '<div class="st-boot-bar"><div id="st-boot-fill"></div></div>' +
          '</div>' +
        '</div>' +

        '<header class="st-banner">' +
          '<div class="st-banner-left">' +
            '<div class="st-emblem"><span>🛡️</span></div>' +
            '<div>' +
              '<h1 class="st-title">NEXUS SHIELD</h1>' +
              '<p class="st-subtitle">SECURITY TEAM COMMAND DECK · <span id="st-clock">--:--:--</span></p>' +
            '</div>' +
          '</div>' +
          '<div class="st-banner-right">' +
            '<div class="st-agents-online"><span class="st-pulse-dot"></span><span id="st-online-count">—</span> AGENTS ON PATROL</div>' +
            '<div class="shield-gauge-wrap">' +
              '<div class="shield-gauge" id="shield-gauge"><span id="shield-gauge-level">—</span></div>' +
              '<div class="shield-gauge-label">THREAT LEVEL</div>' +
            '</div>' +
          '</div>' +
        '</header>' +

        '<section class="st-team" id="st-team">' +
          AGENT_ORDER.map(function (id) {
            var a = AGENTS[id];
            return '<button class="st-agent" data-agent="' + id + '" data-chat="' + id + '">' +
              '<div class="st-agent-avatar" style="--ac:' + a.color + '"><span>' + a.emoji + '</span></div>' +
              '<div class="st-agent-info">' +
                '<div class="st-agent-name">' + a.name + '</div>' +
                '<div class="st-agent-role">' + a.role + '</div>' +
                '<div class="st-agent-status" id="st-status-' + id + '"><span class="st-dot"></span>waking…</div>' +
              '</div>' +
              '<div class="st-agent-meta">' +
                '<div class="st-agent-patrol" id="st-patrol-' + id + '">—</div>' +
                '<div class="st-agent-summary" id="st-summary-' + id + '">Awaiting first patrol…</div>' +
              '</div>' +
            '</button>';
          }).join('') +
        '</section>' +

        '<div class="shield-stats" id="shield-stats">' +
          '<div class="shield-stat"><div class="shield-stat-val" id="st-failed">—</div><div class="shield-stat-label">FAILED LOGINS · 24H</div></div>' +
          '<div class="shield-stat"><div class="shield-stat-val" id="st-blocked">—</div><div class="shield-stat-label">BLOCKED REQUESTS · 24H</div></div>' +
          '<div class="shield-stat"><div class="shield-stat-val" id="st-ips">—</div><div class="shield-stat-label">SUSPICIOUS IPS · 24H</div></div>' +
          '<div class="shield-stat"><div class="shield-stat-val" id="st-hour">—</div><div class="shield-stat-label">EVENTS · LAST HOUR</div></div>' +
          '<div class="shield-stat"><div class="shield-stat-val" id="st-intercepted">0</div><div class="shield-stat-label">THREATS INTERCEPTED</div></div>' +
        '</div>' +

        '<div class="st-grid">' +
          '<section class="shield-panel st-chat-panel">' +
            '<h2><span class="shield-pulse-dot"></span>SECURITY TEAM COMMS</h2>' +
            '<div class="st-chat-tabs" id="st-chat-tabs">' +
              '<button class="st-chat-tab active" data-chat="team">🛡️ TEAM</button>' +
              AGENT_ORDER.map(function (id) {
                return '<button class="st-chat-tab" data-chat="' + id + '">' + AGENTS[id].emoji + ' ' + AGENTS[id].name.toUpperCase() + '</button>';
              }).join('') +
            '</div>' +
            '<div class="st-chat-log" id="st-chat-log">' +
              '<div class="st-msg st-msg-team"><span class="st-msg-who">🛡️ TEAM</span><span class="st-msg-text">Secure channel open. Talk to Sentinel (site health), Hunter (threats) or Guardian (defenses) — or ask the team for a briefing.</span></div>' +
            '</div>' +
            '<form class="st-chat-form" id="st-chat-form">' +
              '<input id="st-chat-input" class="st-chat-input" placeholder="Ask the security team…" autocomplete="off" maxlength="1000"/>' +
              '<button class="st-chat-send" type="submit">SEND ▸</button>' +
            '</form>' +
            '<div class="st-tickets"><h3>🚨 ESCALATIONS <span id="st-ticket-count"></span></h3><div id="st-ticket-list"><div class="shield-empty">No open escalations.</div></div></div>' +
          '</section>' +

          '<div class="st-grid-right">' +
            '<section class="shield-panel shield-radar-panel">' +
              '<h2><span class="shield-pulse-dot"></span>LIVE INTERCEPTION GRID</h2>' +
              '<canvas id="shield-radar" height="260"></canvas>' +
              '<div class="shield-radar-legend"><span class="lg-threat">● incoming</span><span class="lg-hit">● intercepted</span><span class="lg-sweep">● sweep</span></div>' +
            '</section>' +

            '<section class="shield-panel">' +
              '<h2><span class="shield-pulse-dot"></span>TOP OFFENDERS · 24H</h2>' +
              '<div id="shield-topips" class="shield-topips"><div class="shield-empty">Loading…</div></div>' +
            '</section>' +
          '</div>' +
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

        '<div class="st-grid">' +
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
        '</div>' +
      '</div>'
    );
    main.appendChild(root);

    wireChat();
    wireControls();
    startClock();

    bootSequence(function () {
      refreshAll(false);
      refreshTimer = setInterval(function () {
        if (!active) { if (refreshTimer) clearInterval(refreshTimer); return; }
        refreshAll(true);
      }, 30000);
    });
    watchNavAway();
    drawRadar();
  }

  function startClock() {
    function tick() {
      var el = document.getElementById('st-clock');
      if (el) el.textContent = new Date().toLocaleTimeString(undefined, { hour12: false });
    }
    tick();
    clockTimer = setInterval(tick, 1000);
  }

  /* ---------- data loaders ---------- */
  var TYPE_META = {
    failed_login: { label: 'FAILED_LOGIN', cls: 'ev-warn' },
    admin_unauthorized: { label: 'ADMIN_403', cls: 'ev-warn' },
    rate_limit: { label: 'RATE_LIMIT', cls: 'ev-info' },
    blocked_ip: { label: 'BLOCKED_IP', cls: 'ev-danger' },
    scan_detected: { label: 'SCAN', cls: 'ev-danger' },
    ip_blocked: { label: 'IP_BLOCKED', cls: 'ev-ok' },
    ip_unblocked: { label: 'IP_UNBLOCKED', cls: 'ev-info' },
    integrity_violation: { label: 'INTEGRITY', cls: 'ev-danger' },
    integrity_rebaseline: { label: 'REBASELINE', cls: 'ev-info' },
    team_critical: { label: 'TEAM_ALERT', cls: 'ev-danger' }
  };

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

  function loadTeam() {
    return api('/admin/security/team/status').then(function (s) {
      if (!active) return;
      teamState = s;
      var online = 0;
      AGENT_ORDER.forEach(function (id) {
        var a = (s.agents || {})[id];
        if (!a) return;
        var stEl = document.getElementById('st-status-' + id);
        var patEl = document.getElementById('st-patrol-' + id);
        var sumEl = document.getElementById('st-summary-' + id);
        var card = document.querySelector('.st-agent[data-agent="' + id + '"]');
        if (a.status === 'critical') {
          if (stEl) stEl.innerHTML = '<span class="st-dot st-dot-crit"></span>CRITICAL';
          if (card) card.classList.add('st-agent-crit');
        } else if (a.overdue) {
          if (stEl) stEl.innerHTML = '<span class="st-dot st-dot-warn"></span>OVERDUE';
          if (card) card.classList.remove('st-agent-crit');
        } else {
          if (stEl) stEl.innerHTML = '<span class="st-dot st-dot-ok"></span>ON PATROL';
          if (card) card.classList.remove('st-agent-crit');
          online++;
        }
        if (patEl) patEl.textContent = 'last patrol ' + fmtAge(a.lastPatrolMinAgo);
        if (sumEl) sumEl.textContent = a.summary || '—';
      });
      var oc = document.getElementById('st-online-count');
      if (oc) oc.textContent = online + '/3';
    }).catch(function () {});
  }

  function loadSummary() {
    return api('/admin/security/summary').then(function (s) {
      if (!active) return;
      var h24 = s.last24h || {};
      var h1 = s.lastHour || {};
      setStat('st-failed', h24.failed_login || 0);
      setStat('st-blocked', (h24.blocked_ip || 0) + (h24.scan_detected || 0));
      setStat('st-ips', (s.topIps || []).length);
      var hourTotal = Object.keys(h1).reduce(function (acc, k) { return acc + (h1[k] || 0); }, 0);
      setStat('st-hour', hourTotal);
      threatLevel = s.threatLevel || 'LOW';
      renderGauge(threatLevel);
      renderTopIps(s.topIps || []);
    }).catch(function () {});
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

  function loadTickets() {
    return api('/admin/security/team/tickets').then(function (r) {
      if (!active) return;
      var el = document.getElementById('st-ticket-list');
      var count = document.getElementById('st-ticket-count');
      if (!el) return;
      var open = (r.tickets || []).filter(function (t) { return t.status === 'open'; });
      if (count) count.textContent = open.length ? '(' + open.length + ' open)' : '';
      if (!open.length) { el.innerHTML = '<div class="shield-empty">No open escalations.</div>'; return; }
      el.innerHTML = open.slice(0, 5).map(function (t) {
        var ag = AGENTS[t.agent] || { emoji: '🛡️', name: 'TEAM' };
        return '<div class="st-ticket"><span class="st-ticket-agent">' + ag.emoji + '</span>' +
          '<span class="st-ticket-q">#' + t.id + ' ' + escHtml(t.question).slice(0, 90) + '</span>' +
          '<span class="st-ticket-time">' + fmtTime(t.created_at) + '</span></div>';
      }).join('');
    }).catch(function () {});
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
    loadTeam();
    loadSummary();
    loadEvents();
    loadBlocklist();
    loadIntegrity();
    loadTickets();
  }

  /* ---------- team chat ---------- */
  function chatLog() { return document.getElementById('st-chat-log'); }
  function scrollChat() {
    var log = chatLog();
    if (log) log.scrollTop = log.scrollHeight;
  }
  function addMsg(agentId, text, who) {
    var log = chatLog();
    if (!log) return;
    var ag = AGENTS[agentId] || { emoji: '🛡️', name: 'TEAM', color: '#a855f7' };
    var div = h('<div class="st-msg st-msg-' + agentId + '"><span class="st-msg-who" style="color:' + ag.color + '">' +
      ag.emoji + ' ' + (who || ag.name.toUpperCase()) + '</span><span class="st-msg-text">' + mdLight(text) + '</span></div>');
    log.appendChild(div);
    scrollChat();
  }
  function addTyping(agentId) {
    var log = chatLog();
    if (!log) return null;
    var ag = AGENTS[agentId] || { emoji: '🛡️', name: 'TEAM', color: '#a855f7' };
    var div = h('<div class="st-msg st-typing"><span class="st-msg-who" style="color:' + ag.color + '">' +
      ag.emoji + ' ' + ag.name.toUpperCase() + '</span><span class="st-msg-text"><span class="st-dots"><i></i><i></i><i></i></span></span></div>');
    log.appendChild(div);
    scrollChat();
    return div;
  }

  function sendChat(text) {
    if (chatBusy || !text) return;
    chatBusy = true;
    addMsg('you', text, 'YOU');
    var typing = addTyping(chatAgent === 'team' ? 'team' : chatAgent);
    // Cinematic beat — the agent "thinks" for a moment
    setTimeout(function () {
      api('/admin/security/team/chat', { method: 'POST', body: { agent: chatAgent, message: text } })
        .then(function (r) {
          if (typing) typing.remove();
          addMsg(r.agent || chatAgent, r.reply || '…');
          if (r.escalated) { loadTickets(); toast('Escalated to Gizmo — ticket #' + r.ticket_id); }
        })
        .catch(function (e) {
          if (typing) typing.remove();
          addMsg('team', 'Comms are down right now — the team is unreachable. Try again in a minute.');
        })
        .then(function () { chatBusy = false; scrollChat(); });
    }, 650);
  }

  function wireChat() {
    var tabs = document.getElementById('st-chat-tabs');
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('.st-chat-tab');
      if (!b) return;
      Array.prototype.forEach.call(tabs.querySelectorAll('.st-chat-tab'), function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      chatAgent = b.getAttribute('data-chat');
      var ag = AGENTS[chatAgent];
      addMsg('team', ag ? 'Channel switched — you are now talking to ' + ag.emoji + ' ' + ag.name + ' (' + ag.role + ').' : 'Channel switched — addressing the full team.');
    });
    // Agent cards double as chat shortcuts
    document.getElementById('st-team').addEventListener('click', function (e) {
      var card = e.target.closest('.st-agent');
      if (!card) return;
      var id = card.getAttribute('data-agent');
      var tab = tabs.querySelector('[data-chat="' + id + '"]');
      if (tab) tab.click();
      var log = chatLog();
      if (log) log.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      var input = document.getElementById('st-chat-input');
      if (input) input.focus();
    });
    var form = document.getElementById('st-chat-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('st-chat-input');
      var text = input.value.trim();
      if (!text) return;
      input.value = '';
      sendChat(text);
    });
  }

  /* ---------- controls (blocklist / integrity / filters) ---------- */
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
  function wireControls() {
    document.getElementById('shield-block-go').addEventListener('click', function () {
      blockIp(
        document.getElementById('shield-ip').value.trim(),
        document.getElementById('shield-reason').value.trim()
      );
    });
    document.getElementById('shield-rebaseline').addEventListener('click', function () {
      if (!window.confirm('Re-baseline file integrity?\n\nThis fingerprints all monitored files as the new trusted state. Only do this right after a legitimate deploy.')) return;
      api('/admin/security/integrity/rebaseline', { method: 'POST' })
        .then(function (r) { toast('Baseline updated — ' + r.files + ' files fingerprinted'); loadIntegrity(); })
        .catch(function (e) { toast(e.message, true); });
    });
    document.getElementById('shield-filters').addEventListener('click', function (e) {
      var b = e.target.closest('.shield-filter');
      if (!b) return;
      Array.prototype.forEach.call(this.querySelectorAll('.shield-filter'), function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      currentFilter = b.getAttribute('data-type') || '';
      loadEvents();
    });
  }

  /* ---------- canvas: live interception grid (ported from SHIELD v1) ---------- */
  function drawRadar() {
    var canvas = document.getElementById('shield-radar');
    if (!canvas) return;
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
    function frame() {
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
        var rr = parseInt(t.hue.slice(0, 2), 16), gg = parseInt(t.hue.slice(2, 4), 16), bb = parseInt(t.hue.slice(4, 4 + 2), 16);
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

      rafId = requestAnimationFrame(frame);
    }
    frame();
  }

  /* ---------- boot ---------- */
  function boot() {
    if (!hookNav()) {
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
