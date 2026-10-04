/* ============================================================
   Skynet Nexus News — Admin Portal client
   Talks to /api/admin/* (role: admin | editor).
   Vanilla JS, no dependencies.
   ============================================================ */
(function () {
  'use strict';

  var API = '/api';
  var ADMIN_ROLES = ['admin', 'editor'];

  var State = {
    user: null,
    staff: [],
    overview: null,
    view: 'dashboard',
    agentId: null,
    agentTab: 'chat'
  };

  // ---------- DOM helpers ----------
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var gate = $('#admin-gate');
  var app = $('#admin-app');
  var main = $('#admin-main');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function h(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso.indexOf('T') > -1 ? iso : iso.replace(' ', 'T') + 'Z');
    if (isNaN(d)) return esc(iso);
    var now = new Date();
    var diff = (now - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  var toastEl = $('#admin-toast');
  var toastTimer = null;
  function toast(msg, isErr) {
    toastEl.textContent = msg;
    toastEl.classList.toggle('err', !!isErr);
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 3200);
  }

  // ---------- API ----------
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
  function isFullAdmin() { return State.user && State.user.role === 'admin'; }

  // ---------- Modal ----------
  function openModal(title) {
    var overlay = h('<div class="admin-modal-overlay"><div class="admin-modal" role="dialog" aria-modal="true"><div class="admin-modal-head"><h2 class="admin-modal-title"></h2><button class="admin-modal-close" aria-label="Close">✕</button></div><div class="admin-modal-body"></div></div></div>');
    var modal = {
      overlay: overlay,
      body: overlay.querySelector('.admin-modal-body'),
      setTitle: function (t) { overlay.querySelector('.admin-modal-title').textContent = t; }
    };
    modal.setTitle(title || '');
    function onEsc(e) { if (e.key === 'Escape') closeModal(modal); }
    modal._esc = onEsc;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(modal); });
    overlay.querySelector('.admin-modal-close').addEventListener('click', function () { closeModal(modal); });
    document.addEventListener('keydown', onEsc);
    document.body.appendChild(overlay);
    document.body.classList.add('admin-modal-open');
    return modal;
  }
  function closeModal(modal) {
    if (!modal || !modal.overlay) return;
    document.removeEventListener('keydown', modal._esc);
    modal.overlay.remove();
    document.body.classList.remove('admin-modal-open');
  }

  // ---------- Boot / auth gate ----------
  function boot() {
    api('/auth/me').then(function (r) {
      var user = r && r.user;
      if (user && ADMIN_ROLES.indexOf(user.role) > -1) {
        State.user = user;
        showApp();
      } else if (user) {
        showGate('Your account (' + esc(user.email) + ') is not an admin. Ask an administrator for access.', false);
      } else {
        showGate('Sign in with an admin account to continue.', true);
      }
    }).catch(function () {
      showGate('Sign in with an admin account to continue.', true);
    });
  }

  function showGate(message, showForm) {
    app.hidden = true;
    gate.hidden = false;
    $('#admin-gate-status').textContent = message;
    $('#admin-login-form').hidden = !showForm;
  }

  function showApp() {
    gate.hidden = true;
    app.hidden = false;
    $('#admin-whoami').textContent = State.user.displayName + ' · ' + State.user.email;
    $('#admin-role-pill').textContent = State.user.role;
    document.body.classList.toggle('is-full-admin', isFullAdmin());
    // Hide admin-only nav for editors
    Array.prototype.forEach.call(document.querySelectorAll('.admin-only'), function (el) {
      el.style.display = isFullAdmin() ? '' : 'none';
    });
    refreshBadges();
    
    var params = new URLSearchParams(location.search);
    var editId = params.get('editStoryId');
    if (editId) {
      navTo('published');
      api('/stories/queue?status=published&limit=100').then(function (r) {
        var story = (r.stories || []).find(function (s) { return s.id === Number(editId); });
        if (story) {
          editPublishedStory(story);
        }
      });
    } else {
      navTo('dashboard');
    }
  }

  // ---------- Login ----------
  $('#admin-login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var errEl = $('#admin-login-error');
    errEl.hidden = true;
    var email = $('#admin-login-email').value.trim();
    var password = $('#admin-login-password').value;
    api('/auth/login', { method: 'POST', body: { email: email, password: password } })
      .then(function (r) {
        var user = r && r.user;
        if (user && ADMIN_ROLES.indexOf(user.role) > -1) {
          State.user = user; showApp();
        } else {
          errEl.textContent = 'That account does not have admin access.';
          errEl.hidden = false;
        }
      })
      .catch(function (err) {
        errEl.textContent = err.message || 'Sign in failed.';
        errEl.hidden = false;
      });
  });

  $('#admin-logout').addEventListener('click', function () {
    api('/auth/logout', { method: 'POST' }).finally(function () { location.reload(); });
  });

  // ---------- Nav ----------
  var navEl = $('#admin-nav');
  navEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.admin-nav-link');
    if (!btn) return;
    navTo(btn.getAttribute('data-view'));
    navEl.classList.remove('open');
  });
  $('#admin-menu-btn').addEventListener('click', function () { navEl.classList.toggle('open'); });

  function navTo(view) {
    State.view = view;
    Array.prototype.forEach.call(navEl.querySelectorAll('.admin-nav-link'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === view);
    });
    main.innerHTML = '<div class="admin-loading">Loading…</div>';
    var fn = Views[view];
    if (fn) fn(); else main.innerHTML = '<div class="admin-empty">Unknown view.</div>';
  }

  function refreshBadges() {
    api('/admin/overview').then(function (o) {
      State.overview = o;
      setBadge('nav-badge-submissions', o.submissions && o.submissions.pending);
      setBadge('nav-badge-queue', o.queue && o.queue.draft);
      setBadge('nav-badge-social', o.social && o.social.draft);
      setBadge('nav-badge-rejected', o.queue && o.queue.rejected);
      setBadge('nav-badge-qa', o.questions && o.questions.pending);
    api('/admin/feedback?status=new&limit=1').then(function (r) {
      setBadge('nav-badge-feedback', r && r.newCount);
    }).catch(function () {});
    }).catch(function () {});
  }
  function setBadge(id, n) {
    var el = document.getElementById(id);
    if (!el) return;
    if (n && n > 0) { el.textContent = n; el.hidden = false; } else { el.hidden = true; }
  }

  // ---------- Views ----------
  var Views = {};

  // ===== Dashboard =====
  Views.dashboard = function () {
    api('/admin/overview').then(function (o) {
      State.overview = o;
      var a = o.articles || {}, q = o.queue || {}, s = o.submissions || {}, u = o.users || {};
      var per = a.perChannel || {};
      main.innerHTML = '';
      main.appendChild(h(
        '<div class="admin-view-head"><h1>Newsroom Dashboard</h1><p>Live snapshot · ' + fmtDate(o.now) + '</p></div>'
      ));
      main.appendChild(h(
        '<div class="admin-stat-grid">' +
          stat('accent', a.total || 0, 'Published articles') +
          stat('green', a.today || 0, 'Published today') +
          stat('pink', s.pending || 0, 'Tips awaiting review') +
          stat('purple', q.draft || 0, 'Drafts in queue') +
          stat('', q.approved || 0, 'Approved, ready') +
          stat('', u.total || 0, 'Registered users') +
          stat('', u.newsletter || 0, 'Newsletter subs') +
          stat('', (o.staff && o.staff.total) || 0, 'Staff & agents') +
        '</div>'
      ));
      main.appendChild(h(
        '<div class="admin-panel"><h2>Coverage by channel</h2>' +
        '<div class="admin-stat-grid">' +
          stat('accent', per.stem || 0, 'STEM') +
          stat('purple', per.robotics || 0, 'Robotics') +
          stat('green', per.play || 0, 'Play & Design') +
          stat('pink', per.music || 0, 'Music') +
          stat('', per.network || 0, 'Network') +
        '</div></div>'
      ));
      var quick = h(
        '<div class="admin-panel"><h2>Quick actions</h2><div class="row-actions"></div></div>'
      );
      var ra = quick.querySelector('.row-actions');
      [['agents', 'Message an agent'], ['submissions', 'Review reader tips'], ['queue', 'Review story queue'], ['compose', 'Write & publish']]
        .forEach(function (p) {
          var b = h('<button class="admin-btn">' + p[1] + '</button>');
          b.addEventListener('click', function () { navTo(p[0]); });
          ra.appendChild(b);
        });
      main.appendChild(quick);
    }).catch(errView);
  };
  function stat(cls, n, label) {
    return '<div class="admin-stat ' + cls + '"><div class="n">' + esc(n) + '</div><div class="l">' + esc(label) + '</div></div>';
  }

  function hexToRgba(hex, alpha) {
    if (!hex) return 'transparent';
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  // ===== Agents & Staff =====
  Views.agents = function () {
    api('/admin/staff').then(function (r) {
      State.staff = r.staff || [];
      main.innerHTML = '';
      main.appendChild(h('<div class="admin-view-head"><h1>Agents &amp; Staff</h1><p>Message correspondents and assign them stories to write. Tasks & messages are picked up by each agent during its next newsroom run.</p></div>'));
      
      // Inject CSS styles for the collapsible accordion layout
      var styles = h(
        '<style>' +
          '.agent-group { margin-bottom: 16px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }' +
          '.group-header { width: 100%; padding: 12px 16px; background: rgba(30, 41, 59, 0.4); border: none; color: var(--text); font-family: inherit; font-size: 0.95rem; font-weight: 700; text-align: left; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s; border-bottom: 1px solid transparent; }' +
          '.group-header:hover { background: rgba(255,255,255,0.05); }' +
          '.group-content { padding: 12px; display: none; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; transition: all 0.3s ease; }' +
          '.group-content.open { display: grid; }' +
          '.group-header .arrow { transition: transform 0.2s; font-size: 0.8rem; opacity: 0.7; }' +
          '.group-header.open .arrow { transform: rotate(180deg); }' +
          '.humans-hdr.open { background: rgba(239, 68, 68, 0.15) !important; border-bottom: 1px solid rgba(239, 68, 68, 0.3); }' +
          '.humans-content.open { background: rgba(239, 68, 68, 0.04); }' +
          '.subs-hdr.open { background: rgba(168, 85, 247, 0.15) !important; border-bottom: 1px solid rgba(168, 85, 247, 0.3); }' +
          '.subs-content.open { background: rgba(168, 85, 247, 0.04); }' +
        '</style>'
      );
      main.appendChild(styles);

      var layout = h('<div class="agents-layout"><div class="agent-list" id="agent-list"></div><div id="agent-detail"></div></div>');
      main.appendChild(layout);
      var list = layout.querySelector('#agent-list');

      // Separate staff list into humans and correspondents
      var humans = [];
      var subs = [];
      
      State.staff.forEach(function (st) {
        if (st.slug === 'jeffrey-hunt') {
          humans.push(st);
        } else {
          subs.push(st);
        }
      });

      // Create Group Containers
      var humansGroup = h(
        '<div class="agent-group" id="g-humans">' +
          '<button class="group-header humans-hdr">👤 Humans (' + humans.length + ') <span class="arrow">▼</span></button>' +
          '<div class="group-content humans-content" id="list-humans"></div>' +
        '</div>'
      );
      var subsGroup = h(
        '<div class="agent-group" id="g-subs">' +
          '<button class="group-header subs-hdr">🛰️ Correspondents (' + subs.length + ') <span class="arrow">▼</span></button>' +
          '<div class="group-content subs-content" id="list-subs"></div>' +
        '</div>'
      );
      
      list.appendChild(humansGroup);
      list.appendChild(subsGroup);
      
      var listHumans = humansGroup.querySelector('#list-humans');
      var listSubs = subsGroup.querySelector('#list-subs');

      // Render all cards
      State.staff.forEach(function (st) {
        var col = st.accentColor || '#00e5ff';
        var bg = hexToRgba(col, 0.08);
        var border = hexToRgba(col, 0.25);
        var style = 'background:' + bg + '; border:1px solid ' + border + '; border-left:5px solid ' + col + ';';
        var card = h(
          '<button class="agent-card" data-id="' + st.id + '" data-color="' + col + '" style="' + style + '">' +
            '<span class="agent-av" style="background:' + col + '22">' + esc(st.avatarEmoji || '🛰️') + '</span>' +
            '<span><span class="an">' + esc(st.displayName) + '</span><br><span class="ar">' + esc(st.role) + '</span></span>' +
          '</button>'
        );
        card.addEventListener('click', function () { selectAgent(st.id); });
        card.addEventListener('mouseenter', function () {
          if (!card.classList.contains('active')) {
            card.style.background = hexToRgba(col, 0.15);
            card.style.borderColor = hexToRgba(col, 0.5);
          }
        });
        card.addEventListener('mouseleave', function () {
          if (!card.classList.contains('active')) {
            card.style.background = hexToRgba(col, 0.08);
            card.style.borderColor = hexToRgba(col, 0.25);
          }
        });

        // Distribute to correct group container
        if (st.slug === 'jeffrey-hunt') {
          listHumans.appendChild(card);
        } else {
          listSubs.appendChild(card);
        }
      });

      // Add collapsible trigger listeners
      [humansGroup, subsGroup].forEach(function (g) {
        var hdr = g.querySelector('.group-header');
        var content = g.querySelector('.group-content');
        
        // Default to active open
        hdr.classList.add('open');
        content.classList.add('open');
        
        hdr.addEventListener('click', function () {
          hdr.classList.toggle('open');
          content.classList.toggle('open');
        });
      });

      if (State.staff.length) selectAgent(State.agentId || State.staff[0].id);
      else layout.querySelector('#agent-detail').innerHTML = '<div class="admin-empty">No staff configured.</div>';
    }).catch(errView);
  };

  function selectAgent(id) {
    State.agentId = id;
    Array.prototype.forEach.call(document.querySelectorAll('.agent-card'), function (c) {
      var isActive = Number(c.getAttribute('data-id')) === Number(id);
      c.classList.toggle('active', isActive);
      var col = c.getAttribute('data-color') || '#00e5ff';
      if (isActive) {
        c.style.boxShadow = '0 0 14px ' + hexToRgba(col, 0.35);
        c.style.borderColor = col;
        c.style.background = hexToRgba(col, 0.22);
      } else {
        c.style.boxShadow = 'none';
        c.style.borderColor = hexToRgba(col, 0.25);
        c.style.background = hexToRgba(col, 0.08);
      }
    });
    api('/admin/staff/' + id).then(function (r) {
      renderAgentDetail(r.staff, r.tasks || [], r.messages || []);
    }).catch(errView);
  }

  function renderAgentDetail(st, tasks, messages) {
    var box = document.getElementById('agent-detail');
    if (!box) return;
    box.className = 'agent-detail';
    box.innerHTML = '';
    box.appendChild(h(
      '<div class="agent-detail-head">' +
        '<span class="agent-av" style="background:' + esc(st.accentColor || '#1a2233') + '22">' + esc(st.avatarEmoji || '🛰️') + '</span>' +
        '<div class="meta"><h2>' + esc(st.displayName) + '</h2><div class="sub">' + esc(st.role) + (st.channel ? ' · #' + esc(st.channel) : '') + '</div>' +
        (st.bio ? '<div class="sub">' + esc(st.bio) + '</div>' : '') + '</div>' +
        '<span class="pill ' + esc(st.status) + '">' + esc(st.status) + '</span>' +
      '</div>'
    ));
    var tabs = h(
      '<div class="agent-tabs">' +
        '<button class="agent-tab" data-tab="chat">💬 Chat</button>' +
        '<button class="agent-tab" data-tab="task">📝 Assign task</button>' +
        '<button class="agent-tab" data-tab="tasks">📋 Tasks (' + tasks.length + ')</button>' +
        '<button class="agent-tab" data-tab="sources">🔍 Sources</button>' +
      '</div>'
    );
    box.appendChild(tabs);
    var pane = h('<div class="agent-pane" id="agent-pane"></div>');
    box.appendChild(pane);
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('.agent-tab'); if (!b) return;
      State.agentTab = b.getAttribute('data-tab');
      paintAgentTab(st, tasks, messages);
    });
    paintAgentTab(st, tasks, messages);
  }

  function paintAgentTab(st, tasks, messages) {
    var tab = State.agentTab || 'chat';
    Array.prototype.forEach.call(document.querySelectorAll('.agent-tab'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    var pane = document.getElementById('agent-pane');
    if (!pane) return;
    if (tab === 'chat') paintChat(st, messages);
    else if (tab === 'task') paintTaskForm(st);
    else if (tab === 'sources') paintSources(st);
    else paintTasks(st, tasks);
  }

  function paintSources(st) {
    var pane = document.getElementById('agent-pane');
    pane.innerHTML = '';
    var wrap = h('<div class="sources-wrap"><div class="sources-loading">Loading sources…</div></div>');
    pane.appendChild(wrap);
    api('/admin/staff/' + st.id + '/sources').then(function (r) {
      var sources = r.sources || [];
      wrap.innerHTML = '';
      var head = h('<div class="sources-head"><h3>Story sources for ' + esc(st.displayName) + '</h3>' +
        '<div class="sub">RSS feeds, sites, and guided searches this correspondent checks before each filing. Priority 1 = checked first.</div></div>');
      wrap.appendChild(head);
      var list = h('<div class="sources-list"></div>');
      if (!sources.length) list.appendChild(h('<div class="chat-empty">No sources yet. Add the first one below — or seed from the registry.</div>'));
      sources.forEach(function (s) {
        var badge = s.type === 'rss' ? '📡 RSS' : (s.type === 'site' ? '🌐 Site' : '🔎 Search');
        var target = s.type === 'search' ? esc(s.query || '') : esc(s.url || '');
        var row = h(
          '<div class="source-row' + (s.enabled ? '' : ' disabled') + '">' +
            '<span class="source-badge">' + badge + '</span>' +
            '<div class="source-main"><div class="source-label">' + esc(s.label || '(untitled)') + ' <span class="source-prio">P' + Number(s.priority) + '</span></div>' +
            '<div class="source-target">' + target + '</div>' +
            (s.notes ? '<div class="source-notes">' + esc(s.notes) + '</div>' : '') + '</div>' +
            '<label class="source-toggle"><input type="checkbox"' + (s.enabled ? ' checked' : '') + '> on</label>' +
            '<button class="admin-btn admin-btn-danger admin-btn-sm source-del">✕</button>' +
          '</div>'
        );
        row.querySelector('input').addEventListener('change', function (e) {
          api('/admin/sources/' + s.id, { method: 'PATCH', body: { enabled: e.target.checked } })
            .then(function () { toast(e.target.checked ? 'Source enabled' : 'Source disabled'); })
            .catch(function (err) { toast(err.message, true); e.target.checked = !e.target.checked; });
        });
        row.querySelector('.source-del').addEventListener('click', function () {
          if (!confirm('Delete this source?')) return;
          api('/admin/sources/' + s.id, { method: 'DELETE' })
            .then(function () { toast('Source deleted'); paintSources(st); })
            .catch(function (err) { toast(err.message, true); });
        });
        list.appendChild(row);
      });
      wrap.appendChild(list);
      var form = h(
        '<div class="source-add"><h4>Add source</h4>' +
        '<div class="form-row"><label>Type <select id="ns-type"><option value="rss">📡 RSS feed</option><option value="site">🌐 Website</option><option value="search">🔎 Guided search</option></select></label>' +
        '<label>Priority (1–10) <input id="ns-prio" type="number" min="1" max="10" value="5"></label></div>' +
        '<div class="form-row"><label style="flex:2">Label <input id="ns-label" placeholder="e.g. MIT News - AI"></label></div>' +
        '<div class="form-row"><label style="flex:2"><span id="ns-target-label">Feed / site URL</span> <input id="ns-target" placeholder="https://…"></label></div>' +
        '<div class="form-row"><label style="flex:2">Notes <input id="ns-notes" placeholder="What to look for here"></label></div>' +
        '<button class="admin-btn admin-btn-primary" id="ns-add">Add source</button></div>'
      );
      wrap.appendChild(form);
      var typeSel = form.querySelector('#ns-type'), targetLabel = form.querySelector('#ns-target-label');
      typeSel.addEventListener('change', function () {
        targetLabel.textContent = typeSel.value === 'search' ? 'Search query' : 'Feed / site URL';
        form.querySelector('#ns-target').placeholder = typeSel.value === 'search' ? 'site:.edu …' : 'https://…';
      });
      form.querySelector('#ns-add').addEventListener('click', function () {
        var type = typeSel.value;
        var target = form.querySelector('#ns-target').value.trim();
        if (!target) { toast('Enter a URL or search query', true); return; }
        var body = { type: type, label: form.querySelector('#ns-label').value.trim(), notes: form.querySelector('#ns-notes').value.trim(), priority: Number(form.querySelector('#ns-prio').value) || 5 };
        if (type === 'search') body.query = target; else body.url = target;
        api('/admin/staff/' + st.id + '/sources', { method: 'POST', body: body })
          .then(function () { toast('Source added'); paintSources(st); })
          .catch(function (e) { toast(e.message, true); });
      });
    }).catch(function (e) { wrap.innerHTML = '<div class="chat-empty">Failed to load sources: ' + esc(e.message) + '</div>'; });
  }

  function paintChat(st, messages) {
    var pane = document.getElementById('agent-pane');
    pane.innerHTML = '';
    var log = h('<div class="chat-log" id="chat-log"></div>');
    if (!messages.length) log.appendChild(h('<div class="chat-empty">No messages yet. Say hello or hand over a brief below.</div>'));
    messages.forEach(function (m) {
      log.appendChild(h(
        '<div class="chat-msg ' + esc(m.author) + '">' +
          '<div class="who">' + esc(m.author) + '</div>' +
          '<div>' + esc(m.body) + '</div>' +
          '<div class="t">' + fmtDate(m.createdAt) + '</div>' +
        '</div>'
      ));
    });
    pane.appendChild(log);
    var compose = h(
      '<div class="chat-compose">' +
        '<textarea id="chat-input" placeholder="Message ' + esc(st.displayName) + '… (Ctrl+Enter to send)"></textarea>' +
        '<button class="admin-btn admin-btn-primary" id="chat-send">Send</button>' +
      '</div>'
    );
    pane.appendChild(compose);
    log.scrollTop = log.scrollHeight;
    var input = compose.querySelector('#chat-input');
    function send() {
      var body = input.value.trim();
      if (!body) return;
      compose.querySelector('#chat-send').disabled = true;
      api('/admin/staff/' + st.id + '/messages', { method: 'POST', body: { body: body } })
        .then(function () { input.value = ''; toast('Message sent'); selectAgent(st.id); })
        .catch(function (e) { toast(e.message, true); compose.querySelector('#chat-send').disabled = false; });
    }
    compose.querySelector('#chat-send').addEventListener('click', send);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
  }

  function paintTaskForm(st, prefill) {
    prefill = prefill || {};
    var pane = document.getElementById('agent-pane');
    pane.innerHTML = '';
    var form = h(
      '<form class="admin-form">' +
        '<label>Task title<input id="task-title" maxlength="200" required value="' + esc(prefill.title || '') + '"/></label>' +
        '<label>Instructions <span class="hint">What to research, verify, and write. Include sources if you have them.</span>' +
          '<textarea id="task-instructions" maxlength="8000" required>' + esc(prefill.instructions || '') + '</textarea></label>' +
        '<div class="admin-form-row">' +
          '<label>Priority<select id="task-priority">' +
            '<option value="low">Low</option><option value="normal" selected>Normal</option>' +
            '<option value="high">High</option><option value="urgent">Urgent</option></select></label>' +
        '</div>' +
        '<button type="submit" class="admin-btn admin-btn-primary">Assign task to ' + esc(st.displayName) + '</button>' +
      '</form>'
    );
    pane.appendChild(form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var body = {
        title: form.querySelector('#task-title').value.trim(),
        instructions: form.querySelector('#task-instructions').value.trim(),
        priority: form.querySelector('#task-priority').value
      };
      if (prefill.submissionId) body.submissionId = prefill.submissionId;
      api('/admin/staff/' + st.id + '/tasks', { method: 'POST', body: body })
        .then(function () { toast('Task assigned'); State.agentTab = 'tasks'; selectAgent(st.id); refreshBadges(); })
        .catch(function (err) { toast(err.message, true); });
    });
  }

  function paintTasks(st, tasks) {
    var pane = document.getElementById('agent-pane');
    pane.innerHTML = '';
    if (!tasks.length) { pane.appendChild(h('<div class="admin-empty">No tasks assigned yet.</div>')); return; }
    tasks.forEach(function (t) {
      var item = h(
        '<div class="task-item">' +
          '<div class="th"><span class="tt">' + esc(t.title) + '</span>' +
            '<span><span class="pill priority-' + esc(t.priority) + '">' + esc(t.priority) + '</span> ' +
            '<span class="pill ' + esc(t.status) + '">' + esc(t.status) + '</span></span></div>' +
          '<div class="ti">' + esc(t.instructions) + '</div>' +
          '<div class="tf"><span class="hint">' + fmtDate(t.createdAt) + '</span></div>' +
        '</div>'
      );
      var tf = item.querySelector('.tf');
      ['in_progress', 'delivered', 'cancelled'].forEach(function (s) {
        if (t.status === s) return;
        var b = h('<button class="admin-btn admin-btn-sm">Mark ' + s.replace('_', ' ') + '</button>');
        b.addEventListener('click', function () {
          api('/admin/tasks/' + t.id, { method: 'PATCH', body: { status: s } })
            .then(function () { toast('Task updated'); selectAgent(st.id); }).catch(function (e) { toast(e.message, true); });
        });
        tf.appendChild(b);
      });
      pane.appendChild(item);
    });
  }

  // ===== Submissions =====
  Views.submissions = function () {
    api('/admin/submissions?limit=100').then(function (r) {
      var subs = r.submissions || [], counts = r.counts || {};
      main.innerHTML = '';
      main.appendChild(h('<div class="admin-view-head"><h1>Reader Submissions</h1><p>Story tips sent by readers. Review, then assign to a correspondent to write up.</p></div>'));
      main.appendChild(h(
        '<div class="admin-stat-grid">' +
          stat('pink', counts.pending || 0, 'Pending') +
          stat('green', counts.approved || 0, 'Approved') +
          stat('purple', counts.assigned || 0, 'Assigned') +
          stat('accent', counts.published || 0, 'Published') +
          stat('', counts.rejected || 0, 'Rejected') +
        '</div>'
      ));
      if (!subs.length) { main.appendChild(h('<div class="admin-empty">No submissions yet.</div>')); return; }
      var panel = h('<div class="admin-panel"><table class="admin-table"><thead><tr><th>Title</th><th>Channel</th><th>Status</th><th>When</th><th></th></tr></thead><tbody></tbody></table></div>');
      var tb = panel.querySelector('tbody');
      subs.forEach(function (s) {
        var tr = h(
          '<tr><td><strong>' + esc(s.title) + '</strong></td>' +
          '<td>' + esc(s.channel) + '</td>' +
          '<td><span class="pill ' + esc(s.status) + '">' + esc(s.status) + '</span></td>' +
          '<td class="num">' + fmtDate(s.createdAt) + '</td>' +
          '<td class="row-actions"></td></tr>'
        );
        var actions = tr.querySelector('.row-actions');
        var view = h('<button class="admin-btn admin-btn-sm">Open</button>');
        view.addEventListener('click', function () { openSubmission(s); });
        actions.appendChild(view);
        tb.appendChild(tr);
      });
      main.appendChild(panel);
    }).catch(errView);
  };

  function openSubmission(s) {
    var panel = h('<div class="admin-panel"><h2>📥 ' + esc(s.title) + '</h2></div>');
    panel.appendChild(h(
      '<dl class="admin-detail-box">' +
        '<dt>Channel</dt><dd>' + esc(s.channel) + '</dd>' +
        '<dt>Summary</dt><dd>' + esc(s.summary) + '</dd>' +
        (s.body ? '<dt>Body</dt><dd>' + esc(s.body) + '</dd>' : '') +
        (s.sourceUrl ? '<dt>Source</dt><dd><a href="' + esc(s.sourceUrl) + '" target="_blank" rel="noopener">' + esc(s.sourceUrl) + '</a></dd>' : '') +
        (s.submitterName ? '<dt>From</dt><dd>' + esc(s.submitterName) + (s.submitterEmail ? ' · ' + esc(s.submitterEmail) : '') + '</dd>' : '') +
        '<dt>Status</dt><dd><span class="pill ' + esc(s.status) + '">' + esc(s.status) + '</span></dd>' +
      '</dl>'
    ));
    var actions = h('<div class="row-actions" style="margin-top:14px"></div>');
    var approve = h('<button class="admin-btn admin-btn-sm">Approve</button>');
    approve.addEventListener('click', function () { patchSubmission(s.id, { status: 'approved' }); });
    var reject = h('<button class="admin-btn admin-btn-sm admin-btn-danger">Reject</button>');
    reject.addEventListener('click', function () { patchSubmission(s.id, { status: 'rejected' }); });
    actions.appendChild(approve); actions.appendChild(reject);

    // Assign to correspondent
    var assignWrap = h('<div style="margin-top:14px"></div>');
    ensureStaff().then(function () {
      var opts = State.staff.filter(function (st) { return st.kind === 'agent'; })
        .map(function (st) { return '<option value="' + st.id + '"' + (st.channel === s.channel ? ' selected' : '') + '>' + esc(st.displayName) + ' (' + esc(st.role) + ')</option>'; }).join('');
      var row = h('<div class="admin-form-row"><label>Assign to correspondent<select id="assign-staff">' + opts + '</select></label></div>');
      var btn = h('<button class="admin-btn admin-btn-primary" style="margin-top:8px">Assign & create writing task</button>');
      btn.addEventListener('click', function () {
        var staffId = Number(assignWrap.querySelector('#assign-staff').value);
        api('/admin/submissions/' + s.id + '/assign', { method: 'POST', body: { staffId: staffId } })
          .then(function () { toast('Assigned to correspondent'); Views.submissions(); refreshBadges(); })
          .catch(function (e) { toast(e.message, true); });
      });
      assignWrap.appendChild(row); assignWrap.appendChild(btn);
    });

    panel.appendChild(actions);
    panel.appendChild(assignWrap);
    // Replace current view content below the head/stats
    main.appendChild(panel);
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function patchSubmission(id, body) {
    api('/admin/submissions/' + id, { method: 'PATCH', body: body })
      .then(function () { toast('Submission updated'); Views.submissions(); refreshBadges(); })
      .catch(function (e) { toast(e.message, true); });
  }

  // ===== Story queue =====
  var emojiByCat = { skynet:'🛰️', ai:'🧠', space:'🚀', robotics:'🤖', biotech:'🧬', quantum:'⚛️', climate:'🌍', engineering:'🔧', math:'📐', cyber:'🔐', gaming:'🎮', music:'🎧', stem:'🧬', play:'🎨', network:'🛰️' };
  var colorByCat = { skynet:'#00e5ff', ai:'#00e5ff', space:'#7c5cff', robotics:'#a855f7', biotech:'#2dd4bf', quantum:'#22d3ee', climate:'#34d399', engineering:'#ffb800', math:'#f472b6', cyber:'#38bdf8', gaming:'#39ff14', music:'#ff2e63', stem:'#00e5ff', play:'#39ff14', network:'#00e5ff' };

  Views.queue = function () {
    api('/admin/stories/queue?limit=100').then(function (r) {
      // The queue holds only actionable drafts: after each drop, published
      // stories move to Published Articles and rejected ones to the Rejected store.
      var stories = (r.stories || []).filter(function (st) { return st.status === 'draft' || st.status === 'approved'; });
      main.innerHTML = '';
      main.appendChild(h('<div class="admin-view-head"><h1>Story Queue</h1><p>Drafts filed by correspondents. Review, approve, and publish. Publishing runs the kid-safe guardrail pipeline and posts to the live site. After each drop the queue clears itself: published stories move to Published Articles, rejected ones to the Rejected store.</p></div>'));
      main.appendChild(h('<div class="admin-inline-note">Auto-post: an approved draft can be published in one click — it is validated by the newsroom guardrails, written to <code>data/articles</code>, and added to the live manifest instantly.</div>'));
      if (!stories.length) { main.appendChild(h('<div class="admin-empty">Queue is clear — no drafts awaiting review. Assign a correspondent a task, or use “Write / Publish”.</div>')); return; }
      
      var grid = h('<div class="admin-queue-grid"></div>');
      

      ensureStaff().then(function () {
        stories.forEach(function (st) {
          var p = st.payload || {};
          var author = staffName(st.staffId);
          var chanColor = colorByCat[st.channel] || '#00e5ff';
          var chanEmoji = emojiByCat[st.channel] || '📝';
          
          var heroHtml = '';
          if (p.heroImage) {
            heroHtml = '<img src="' + esc(p.heroImage) + '" class="admin-queue-card-hero" alt="Cover">';
          } else {
            heroHtml = '<div class="admin-queue-card-placeholder" style="border-bottom: 3px solid ' + chanColor + '">' + chanEmoji + '</div>';
          }
          
          var card = h(
            '<div class="admin-queue-card">' +
              heroHtml +
              '<div class="admin-queue-card-content">' +
                '<div class="admin-queue-card-meta">' +
                  '<span class="admin-queue-card-channel" style="color:' + chanColor + '">' + esc(st.channel) + '</span>' +
                  '<span class="pill ' + esc(st.status) + '">' + esc(st.status) + '</span>' +
                '</div>' +
                '<h3 class="admin-queue-card-title">' + esc(p.title || '(untitled)') + '</h3>' +
                '<div class="admin-queue-card-author">✍️ ' + esc(author) + '</div>' +
                '<div class="admin-queue-card-time">' + fmtDate(st.createdAt) + '</div>' +
              '</div>' +
              '<div class="admin-queue-card-actions">' +
                '<button class="admin-btn admin-btn-sm admin-btn-primary" style="width: 100%">Review Draft</button>' +
              '</div>' +
            '</div>'
          );
          
          card.querySelector('.admin-queue-card-actions button').addEventListener('click', function () {
            openStory(st);
          });
          
          grid.appendChild(card);
        });
      });
      main.appendChild(grid);
    }).catch(errView);
  };

  function openStory(st) {
    var p = st.payload || {};
    
    var emojiByCat = { skynet:'🛰️', ai:'🧠', space:'🚀', robotics:'🤖', biotech:'🧬', quantum:'⚛️', climate:'🌍', engineering:'🔧', math:'📐', cyber:'🔐', gaming:'🎮', music:'🎧', stem:'🧬', play:'🎨', network:'🛰️' };
    var colorByCat = { skynet:'#00e5ff', ai:'#00e5ff', space:'#7c5cff', robotics:'#a855f7', biotech:'#2dd4bf', quantum:'#22d3ee', climate:'#34d399', engineering:'#ffb800', math:'#f472b6', cyber:'#38bdf8', gaming:'#39ff14', music:'#ff2e63', stem:'#00e5ff', play:'#39ff14', network:'#00e5ff' };
    var chanColor = colorByCat[st.channel] || '#00e5ff';
    var chanEmoji = emojiByCat[st.channel] || '📝';

    var modal = openModal('Review Draft');
    modal.overlay.querySelector('.admin-modal').style.maxWidth = '640px';
    
    var container = h('<div class="admin-story-review"></div>');
    container.appendChild(h(
      '<h2 style="font-size:1.3rem; font-weight:800; margin:0 0 16px 0; color:var(--text); line-height:1.35;">📝 ' + esc(p.title || '(untitled)') + '</h2>'
    ));
    
    container.appendChild(h(
      '<dl class="admin-detail-box" style="margin-bottom: 20px;">' +
        '<dt>Channel</dt><dd style="color:' + chanColor + '; font-weight:700;">' + chanEmoji + ' ' + esc(st.channel) + '</dd>' +
        '<dt>Status</dt><dd><span class="pill ' + esc(st.status) + '">' + esc(st.status) + '</span></dd>' +
        (p.excerpt ? '<dt>Excerpt</dt><dd style="color:var(--text-dim);">' + esc(p.excerpt) + '</dd>' : '') +
        (p.kidTake ? '<dt>Kid Take</dt><dd style="background:rgba(0,229,255,0.06); padding:10px; border-radius:6px; border-left:3px solid var(--accent);">' + esc(p.kidTake) + '</dd>' : '') +
        (p.body ? '<dt>Body (HTML)</dt><dd style="max-height:220px; overflow-y:auto; padding:10px; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; font-size:0.85rem; line-height:1.6;">' + esc(p.body) + '</dd>' : '') +
        (st.editorNotes ? '<dt>Editor notes</dt><dd style="color:var(--accent-5);">' + esc(st.editorNotes) + '</dd>' : '') +
        (st.scheduledAt ? '<dt>Scheduled for</dt><dd>' + fmtDate(st.scheduledAt) + (st.edition ? ' (' + esc(st.edition) + ')' : '') + '</dd>' : '') +
        (st.publishedArticleId ? '<dt>Published as</dt><dd><code>' + esc(st.publishedArticleId) + '</code></dd>' : '') +
        '<dt>Cover Image</dt><dd id="draft-cover-container" style="margin-top:8px;">' +
          (p.heroImage ? '<img src="' + esc(p.heroImage) + '" style="max-width:100%; height:180px; object-fit:cover; border-radius:8px; display:block; margin-bottom:8px; border:1px solid var(--border);" id="draft-cover-preview">' : '<span class="hint" id="draft-cover-none">No cover image selected</span>') +
          '<button class="admin-btn admin-btn-sm" id="btn-change-draft-cover" style="margin-top:6px;">🖼️ Change Cover Image</button>' +
        '</dd>' +
      '</dl>'
    ));

    var changeBtn = container.querySelector('#btn-change-draft-cover');
    if (changeBtn) {
      changeBtn.addEventListener('click', function () {
        var selectedImgUrl = p.heroImage || '';
        var pickerModal = openModal('Select Hero Image');
        pickerModal.overlay.querySelector('.admin-modal').classList.add('admin-image-picker-modal');
        
        pickerModal.body.appendChild(h('<p style="font-size:13px; color:var(--text-mute); margin-bottom:12px;">Choose an illustration from the <strong>' + esc(st.channel) + '</strong> channel pool:</p>'));
        
        var grid = h('<div class="admin-image-picker-grid"></div>');
        
        api('/admin/images/list').then(function (r) {
          var files = r.images[st.channel] || [];
          if (!files.length) {
            grid.appendChild(h('<div class="admin-empty" style="grid-column:1/-1">No images in this channel pool.</div>'));
          } else {
            files.forEach(function (filename) {
              var url = '/assets/img/channels/' + st.channel + '/' + filename;
              var isSel = (url === selectedImgUrl);
              var card = h(
                '<div class="admin-image-picker-card' + (isSel ? ' selected' : '') + '">' +
                  '<img src="' + url + '" class="admin-image-picker-thumb">' +
                '</div>'
              );
              card.addEventListener('click', function () {
                selectedImgUrl = url;
                p.heroImage = url;
                
                api('/admin/stories/queue/' + st.id, {
                  method: 'PATCH',
                  body: { payload: p }
                }).then(function () {
                  toast('Draft cover image updated');
                  var containerEl = container.querySelector('#draft-cover-container');
                  var preview = containerEl.querySelector('#draft-cover-preview');
                  if (!preview) {
                    var none = containerEl.querySelector('#draft-cover-none');
                    if (none) none.remove();
                    preview = h('<img style="max-width:100%; height:180px; object-fit:cover; border-radius:8px; display:block; margin-bottom:8px; border:1px solid var(--border);" id="draft-cover-preview">');
                    containerEl.insertBefore(preview, changeBtn);
                  }
                  preview.src = url;
                  Views.queue();
                }).catch(function (e) {
                  toast(e.message, true);
                });
                
                closeModal(pickerModal);
              });
              grid.appendChild(card);
            });
          }
        }).catch(function (err) { toast(err.message, true); });
        
        pickerModal.body.appendChild(grid);
      });
    }

    var actions = h('<div class="row-actions" style="margin-top:18px; justify-content: flex-end; gap: 8px;"></div>');
    if (st.status === 'rejected') {
      // Rejected store actions: re-queue for a later edition, or delete for good.
      var rq = h('<button class="admin-btn admin-btn-primary admin-btn-sm">\u21A9 Re-queue as draft</button>');
      rq.addEventListener('click', function () {
        rq.disabled = true; rq.textContent = 'Re-queuing\u2026';
        api('/admin/stories/queue/' + st.id + '/requeue', { method: 'POST' })
          .then(function () {
            toast('Back in the story queue as a draft \u2014 give it a fresh drop');
            closeModal(modal);
            Views.rejected(); refreshBadges();
          })
          .catch(function (e) { toast(e.message, true); rq.disabled = false; rq.textContent = '\u21A9 Re-queue as draft'; });
      });
      actions.appendChild(rq);
      var rdel = h('<button class="admin-btn admin-btn-sm admin-btn-danger">Delete permanently</button>');
      rdel.addEventListener('click', function () {
        if (!window.confirm('Delete this rejected story permanently? This cannot be undone.')) return;
        api('/admin/stories/queue/' + st.id, { method: 'DELETE' })
          .then(function () { toast('Rejected story deleted'); closeModal(modal); Views.rejected(); refreshBadges(); })
          .catch(function (e) { toast(e.message, true); });
      });
      actions.appendChild(rdel);
    } else if (st.status !== 'published') {
      if (st.status !== 'approved') {
        var approve = h('<button class="admin-btn admin-btn-sm" style="background:rgba(57,255,20,0.1); border-color:var(--accent-4); color:var(--accent-4);">Approve</button>');
        approve.addEventListener('click', function () { 
          patchStory(st.id, { status: 'approved' }); 
          closeModal(modal);
        });
        actions.appendChild(approve);
      }
      var pub = h('<button class="admin-btn admin-btn-primary admin-btn-sm">Publish now ▶</button>');
      pub.addEventListener('click', function () {
        pub.disabled = true; pub.textContent = 'Publishing…';
        api('/admin/stories/queue/' + st.id + '/publish', { method: 'POST' })
          .then(function () { 
            toast('Published to the live site'); 
            Views.queue(); 
            refreshBadges(); 
            closeModal(modal);
          })
          .catch(function (e) { 
            toast(e.message, true); 
            pub.disabled = false; 
            pub.textContent = 'Publish now ▶'; 
          });
      });
      actions.appendChild(pub);
      var sched = h('<button class="admin-btn admin-btn-sm">Schedule next drop ⏱</button>');
      sched.addEventListener('click', function () {
        sched.disabled = true; sched.textContent = 'Scheduling…';
        api('/admin/stories/queue/' + st.id + '/schedule', { method: 'POST', body: {} })
          .then(function (r) {
            var when = r && r.story && r.story.scheduledAt ? fmtDate(r.story.scheduledAt) : 'next drop';
            toast('Scheduled for ' + when); 
            Views.queue(); 
            refreshBadges(); 
            closeModal(modal);
          })
          .catch(function (e) { 
            toast(e.message, true); 
            sched.disabled = false; 
            sched.textContent = 'Schedule next drop ⏱'; 
          });
      });
      actions.appendChild(sched);
      var reject = h('<button class="admin-btn admin-btn-sm admin-btn-danger">Reject</button>');
      reject.addEventListener('click', function () { 
        patchStory(st.id, { status: 'rejected' }); 
        closeModal(modal);
      });
      actions.appendChild(reject);
    }
    
    container.appendChild(actions);
    modal.body.appendChild(container);
  }

  function patchStory(id, body) {
    api('/admin/stories/queue/' + id, { method: 'PATCH', body: body })
      .then(function () { toast('Draft updated'); Views.queue(); refreshBadges(); })
      .catch(function (e) { toast(e.message, true); });
  }


  // ===== Rejected store =====
  // Rejected stories wait here — never auto-published, never in the queue —
  // so a good angle can be re-queued as a draft for a later edition.
  Views.rejected = function () {
    api('/admin/stories/queue?status=rejected&limit=100').then(function (r) {
      var stories = r.stories || [];
      main.innerHTML = '';
      main.appendChild(h('<div class="admin-view-head"><h1>Rejected Stories</h1><p>Stories rejected instead of published. They are kept here — never auto-published — so a good angle can be re-queued as a draft for a later edition.</p></div>'));
      if (!stories.length) { main.appendChild(h('<div class="admin-empty">Nothing rejected. Stories you reject will wait here for a second chance.</div>')); return; }

      var grid = h('<div class="admin-queue-grid"></div>');

      ensureStaff().then(function () {
        stories.forEach(function (st) {
          var pl = st.payload || {};
          var author = staffName(st.staffId);
          var chanColor = colorByCat[st.channel] || '#00e5ff';
          var chanEmoji = emojiByCat[st.channel] || '📝';

          var heroHtml = '';
          if (pl.heroImage) {
            heroHtml = '<img src="' + esc(pl.heroImage) + '" class="admin-queue-card-hero" alt="Cover">';
          } else {
            heroHtml = '<div class="admin-queue-card-placeholder" style="border-bottom: 3px solid ' + chanColor + '">' + chanEmoji + '</div>';
          }

          var card = h(
            '<div class="admin-queue-card">' +
              heroHtml +
              '<div class="admin-queue-card-content">' +
                '<div class="admin-queue-card-meta">' +
                  '<span class="admin-queue-card-channel" style="color:' + chanColor + '">' + esc(st.channel) + '</span>' +
                  '<span class="pill ' + esc(st.status) + '">' + esc(st.status) + '</span>' +
                '</div>' +
                '<h3 class="admin-queue-card-title">' + esc(pl.title || '(untitled)') + '</h3>' +
                '<div class="admin-queue-card-author">\u270D\uFE0F ' + esc(author) + '</div>' +
                '<div class="admin-queue-card-time">' + fmtDate(st.createdAt) + '</div>' +
              '</div>' +
              '<div class="admin-queue-card-actions">' +
                '<button class="admin-btn admin-btn-sm admin-btn-primary" data-act="review" style="width:100%;margin-bottom:6px;">Review</button>' +
                '<button class="admin-btn admin-btn-sm" data-act="requeue" style="width:100%;">\u21A9 Re-queue as draft</button>' +
              '</div>' +
            '</div>'
          );

          card.querySelector('[data-act="review"]').addEventListener('click', function () { openStory(st); });
          card.querySelector('[data-act="requeue"]').addEventListener('click', function (e) {
            var btn = e.currentTarget;
            btn.disabled = true; btn.textContent = 'Re-queuing\u2026';
            api('/admin/stories/queue/' + st.id + '/requeue', { method: 'POST' })
              .then(function () { toast('Back in the story queue as a draft \u2014 give it a fresh drop'); Views.rejected(); refreshBadges(); })
              .catch(function (err) { toast(err.message, true); btn.disabled = false; btn.textContent = '\u21A9 Re-queue as draft'; });
          });

          grid.appendChild(card);
        });
      });
      main.appendChild(grid);
    }).catch(errView);
  };

  // ===== Social ===
  var SOCIAL_META = {
    youtube_shorts: { label: 'YouTube Shorts', emoji: '\u25b6\uFE0F', color: '#ff0033' },
    tiktok: { label: 'TikTok', emoji: '\uD83C\uDFB5', color: '#25f4ee' },
    instagram_reels: { label: 'Instagram Reels', emoji: '\uD83D\uDCF8', color: '#e1306c' }
  };

  Views.social = function () {
    var platformFilter = null;
    function load() {
      var q = '/admin/social/queue?limit=100' + (platformFilter ? '&platform=' + platformFilter : '');
      api(q).then(render).catch(errView);
    }
    function render(r) {
      var drafts = r.drafts || [];
      main.innerHTML = '';
      main.appendChild(h('<div class="admin-view-head"><h1>Social Command Center</h1><p>Video packages filed by the social producer agents ~30 min after each edition drop. Review, approve, then post manually &mdash; v1 has no platform API integration.</p></div>'));

      // Accounts (placeholder rows until handles are created)
      var acc = h('<div class="admin-panel"><h2>Accounts</h2><div class="admin-stat-grid"></div><p class="hint" style="margin-top:8px;">No accounts connected yet. Handles are added when the YouTube, TikTok, and Instagram accounts are created.</p></div>');
      var ag = acc.querySelector('.admin-stat-grid');
      Object.keys(SOCIAL_META).forEach(function (p) {
        var m = SOCIAL_META[p];
        ag.appendChild(h(
          '<div class="admin-stat"><div class="n" style="color:' + m.color + '">' + m.emoji + '</div>' +
          '<div class="l">' + m.label + '</div>' +
          '<div style="margin-top:6px;"><span class="pill draft">not connected yet</span></div></div>'
        ));
      });
      main.appendChild(acc);

      // Queue with platform tabs
      var panel = h('<div class="admin-panel"><h2>Social queue</h2><div class="row-actions" style="margin-bottom:12px;" id="social-tabs"></div><div class="admin-queue-grid" id="social-grid"></div></div>');
      main.appendChild(panel);
      var tabs = panel.querySelector('#social-tabs');
      [['', 'All platforms'], ['youtube_shorts', '\u25b6\uFE0F Shorts'], ['tiktok', '\uD83C\uDFB5 TikTok'], ['instagram_reels', '\uD83D\uDCF8 Reels']]
        .forEach(function (td) {
          var active = (!platformFilter && !td[0]) || platformFilter === td[0];
          var b = h('<button class="admin-btn admin-btn-sm' + (active ? ' admin-btn-primary' : '') + '">' + td[1] + '</button>');
          b.addEventListener('click', function () { platformFilter = td[0] || null; load(); });
          tabs.appendChild(b);
        });
      var sg = panel.querySelector('#social-grid');
      if (!drafts.length) {
        sg.appendChild(h('<div class="admin-empty">No social packages yet. Producers file ~30 min after each edition drop (7:45 AM / 2:45 PM / 6:45 PM ET).</div>'));
        return;
      }
      drafts.forEach(function (d) {
        var m = SOCIAL_META[d.platform] || { label: d.platform, emoji: '\uD83D\uDCF1', color: '#00e5ff' };
        var card = h(
          '<div class="admin-queue-card">' +
            '<div class="admin-queue-card-content">' +
              '<div class="admin-queue-card-meta">' +
                '<span class="admin-queue-card-channel" style="color:' + m.color + '">' + m.emoji + ' ' + esc(m.label) + '</span>' +
                '<span class="pill ' + esc(d.status) + '">' + esc(d.status) + '</span>' +
              '</div>' +
              '<h3 class="admin-queue-card-title">' + esc(d.storyTitle || '(untitled)') + '</h3>' +
              '<div class="admin-queue-card-author">\uD83E\uDE9D ' + esc((d.hook || '').slice(0, 90)) + '</div>' +
              '<div class="admin-queue-card-time">' + fmtDate(d.createdAt) + (d.dropKey ? ' \u00b7 ' + esc(d.dropKey) : '') + '</div>' +
            '</div>' +
            '<div class="admin-queue-card-actions"><button class="admin-btn admin-btn-sm admin-btn-primary" style="width:100%">Review Package</button></div>' +
          '</div>'
        );
        card.querySelector('button').addEventListener('click', function () { openSocialDraft(d.id); });
        sg.appendChild(card);
      });
    }
    load();
  };

  function openSocialDraft(id) {
    api('/admin/social/queue/' + id).then(function (r) {
      var d = r.draft;
      var m = SOCIAL_META[d.platform] || { label: d.platform, emoji: '\uD83D\uDCF1', color: '#00e5ff' };
      var modal = openModal('Review Social Package');
      modal.overlay.querySelector('.admin-modal').style.maxWidth = '640px';
      var c = h('<div class="admin-story-review"></div>');
      c.appendChild(h('<h2 style="font-size:1.3rem;font-weight:800;margin:0 0 16px 0;color:var(--text);">' + m.emoji + ' ' + esc(d.storyTitle || '(untitled)') + '</h2>'));
      c.appendChild(h(
        '<dl class="admin-detail-box" style="margin-bottom:20px;">' +
          '<dt>Platform</dt><dd style="color:' + m.color + ';font-weight:700;">' + esc(m.label) + '</dd>' +
          '<dt>Status</dt><dd><span class="pill ' + esc(d.status) + '">' + esc(d.status) + '</span></dd>' +
          (d.edition ? '<dt>Edition</dt><dd>' + esc(d.edition) + '</dd>' : '') +
          (d.artPick ? '<dt>Art pick</dt><dd><code>' + esc(d.artPick) + '</code></dd>' : '') +
          (d.editorNotes ? '<dt>Editor notes</dt><dd style="color:var(--accent-5);">' + esc(d.editorNotes) + '</dd>' : '') +
        '</dl>'
      ));
      function field(label, name, value, rows) {
        var w = h('<label style="display:block;margin:0 0 12px 0;"><span style="font-weight:700;font-size:0.85rem;">' + label + '</span><textarea data-f="' + name + '" rows="' + rows + '" style="width:100%;margin-top:4px;">' + esc(value || '') + '</textarea></label>');
        c.appendChild(w);
      }
      field('Hook (first 3 seconds)', 'hook', d.hook, 2);
      field('Script (30-60s spoken)', 'script', d.script, 6);
      field('Caption', 'caption', d.caption, 3);
      field('Hashtags (comma-separated)', 'hashtags', (d.hashtags || []).join(', '), 1);
      field('CTA', 'cta', d.cta, 2);
      field('Art pick (image path)', 'artPick', d.artPick, 1);
      field('Editor notes', 'editorNotes', d.editorNotes, 2);
      function readFields() {
        var out = {};
        c.querySelectorAll('[data-f]').forEach(function (el) { out[el.getAttribute('data-f')] = el.value; });
        out.hashtags = out.hashtags.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        return out;
      }
      var actions = h('<div class="row-actions" style="margin-top:8px;"></div>');
      function patch(body, msg) {
        api('/admin/social/queue/' + d.id, { method: 'PATCH', body: body })
          .then(function () { toast(msg || 'Package updated'); closeModal(modal); Views.social(); refreshBadges(); })
          .catch(function (e) { toast(e.message, true); });
      }
      var save = h('<button class="admin-btn">Save edits</button>');
      save.addEventListener('click', function () { patch(readFields(), 'Edits saved'); });
      var approve = h('<button class="admin-btn admin-btn-primary">Approve</button>');
      approve.addEventListener('click', function () { var f = readFields(); f.status = 'approved'; patch(f, 'Package approved'); });
      var posted = h('<button class="admin-btn admin-btn-sm">Mark posted</button>');
      posted.addEventListener('click', function () { patch({ status: 'posted' }, 'Marked as posted'); });
      var del = h('<button class="admin-btn admin-btn-sm admin-btn-danger">Delete</button>');
      del.addEventListener('click', function () {
        if (!confirm('Delete this social package?')) return;
        api('/admin/social/queue/' + d.id, { method: 'DELETE' })
          .then(function () { toast('Package deleted'); closeModal(modal); Views.social(); refreshBadges(); })
          .catch(function (e) { toast(e.message, true); });
      });
      [save, approve, posted, del].forEach(function (b) { actions.appendChild(b); });
      c.appendChild(actions);
      modal.body.appendChild(c);
    }).catch(function (e) { toast(e.message, true); });
  }

  // ===== Compose / publish =====
  Views.qa = function () {
    var status = State.qaStatus || 'pending';
    api('/admin/questions?status=' + status).then(function (r) {
      var qs = r.questions || [];
      main.innerHTML = '';
      main.appendChild(h('<div class="admin-view-head"><h1>💬 Ask the Correspondent</h1><p>Kid questions for the correspondents. Approve the good ones (the nightly job answers them), reject the rest, or answer directly.</p></div>'));
      var tabs = h('<div class="admin-tabs">' +
        ['pending', 'approved', 'answered', 'rejected'].map(function (s) {
          return '<button class="admin-tab' + (s === status ? ' active' : '') + '" data-s="' + s + '">' +
            s.charAt(0).toUpperCase() + s.slice(1) + '</button>';
        }).join('') + '</div>');
      tabs.querySelectorAll('.admin-tab').forEach(function (b) {
        b.addEventListener('click', function () { State.qaStatus = b.dataset.s; Views.qa(); });
      });
      main.appendChild(tabs);
      if (!qs.length) { main.appendChild(h('<div class="admin-empty">No ' + esc(status) + ' questions.</div>')); return; }
      var panel = h('<div class="admin-panel"><table class="admin-table"><thead><tr><th>Question</th><th>Channel</th><th>From</th><th>When</th><th></th></tr></thead><tbody></tbody></table></div>');
      var tb = panel.querySelector('tbody');
      qs.forEach(function (q) {
        var tr = h(
          '<tr><td><strong>' + esc(q.question) + '</strong>' +
          (q.answer ? '<br/><span style="opacity:.75">💬 ' + esc(q.answer.slice(0, 140)) + (q.answer.length > 140 ? '…' : '') + '</span>' : '') + '</td>' +
          '<td>' + esc(q.channel) + '</td>' +
          '<td>' + esc(q.kid_name || '—') + '</td>' +
          '<td class="num">' + fmtDate(q.created_at) + '</td>' +
          '<td class="row-actions"></td></tr>'
        );
        var actions = tr.querySelector('.row-actions');
        function act(label, fn, primary) {
          var b = h('<button class="admin-btn admin-btn-sm' + (primary ? ' admin-btn-primary' : '') + '">' + label + '</button>');
          b.addEventListener('click', function () { fn(q); });
          actions.appendChild(b);
        }
        if (q.status === 'pending') {
          act('Approve', function (q) {
            api('/admin/questions/' + q.id + '/approve', { method: 'POST' })
              .then(function () { toast('Approved — the nightly job will answer it.'); Views.qa(); refreshBadges(); })
              .catch(function (e) { toast(e.message, true); });
          }, true);
          act('Reject', function (q) {
            api('/admin/questions/' + q.id + '/reject', { method: 'POST' })
              .then(function () { toast('Rejected.'); Views.qa(); refreshBadges(); })
              .catch(function (e) { toast(e.message, true); });
          });
        }
        if (q.status === 'approved' || q.status === 'pending') {
          act('Answer', function (q) { openQaAnswer(q); });
        }
        tb.appendChild(tr);
      });
      main.appendChild(panel);
    }).catch(errView);
  };

  function openQaAnswer(q) {
    var modal = openModal('💬 Answer this question');
    var wrap = h('<div><p style="margin-top:0"><strong>Q:</strong> ' + esc(q.question) + '</p>' +
      '<textarea id="qa-admin-answer" rows="6" style="width:100%;box-sizing:border-box" placeholder="Write the answer in the correspondent\'s voice…">' +
      esc(q.answer || '') + '</textarea></div>');
    modal.body.appendChild(wrap);
    var save = h('<button class="admin-btn admin-btn-primary">Publish answer</button>');
    save.addEventListener('click', function () {
      var a = modal.body.querySelector('#qa-admin-answer').value.trim();
      if (a.length < 3) { toast('Write the answer first.', true); return; }
      api('/admin/questions/' + q.id + '/answer', { method: 'POST', body: JSON.stringify({ answer: a }) })
        .then(function () { toast('Answer published.'); closeModal(modal); Views.qa(); refreshBadges(); })
        .catch(function (e) { toast(e.message, true); });
    });
    var cancel = h('<button class="admin-btn">Cancel</button>');
    cancel.addEventListener('click', function () { closeModal(modal); });
    var row = h('<div class="row-actions" style="margin-top:12px"></div>');
    row.appendChild(save); row.appendChild(cancel);
    modal.body.appendChild(row);
  }

  // ===== Beta feedback =====
  Views.feedback = function () {
    var type = State.feedbackType || '';
    var status = State.feedbackStatus || 'new';
    var qs = '/admin/feedback?limit=100' +
      (type ? '&type=' + encodeURIComponent(type) : '') +
      (status ? '&status=' + encodeURIComponent(status) : '');
    api(qs).then(function (r) {
      var items = r.items || [];
      main.innerHTML = '';
      main.appendChild(h('<div class="admin-view-head"><h1>🧪 Beta Feedback</h1><p>Bug reports and ideas from beta testers. Marking one <strong>Reviewed</strong> awards the tester +10 XP.</p></div>'));
      var filters = h('<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap"></div>');
      function sel(label, opts, cur, set) {
        var s = h('<label style="font-size:13px;opacity:.8">' + label + ' <select class="admin-select"></select></label>');
        var dd = s.querySelector('select');
        opts.forEach(function (o) {
          var op = document.createElement('option');
          op.value = o[0]; op.textContent = o[1];
          if (o[0] === cur) op.selected = true;
          dd.appendChild(op);
        });
        dd.addEventListener('change', function () { set(dd.value); Views.feedback(); });
        filters.appendChild(s);
      }
      sel('Type ', [['', 'All'], ['bug', '🐞 Bugs'], ['idea', '💡 Ideas']], type, function (v) { State.feedbackType = v; });
      sel('Status ', [['', 'All'], ['new', 'New'], ['reviewed', 'Reviewed'], ['resolved', 'Resolved']], status, function (v) { State.feedbackStatus = v; });
      main.appendChild(filters);
      if (!items.length) { main.appendChild(h('<div class="admin-empty">No feedback here yet.</div>')); return; }
      var panel = h('<div class="admin-panel"><table class="admin-table"><thead><tr><th></th><th>Title</th><th>From</th><th>Status</th><th>When</th><th></th></tr></thead><tbody></tbody></table></div>');
      var tb = panel.querySelector('tbody');
      items.forEach(function (f) {
        var tr = h(
          '<tr><td style="font-size:18px">' + (f.type === 'idea' ? '💡' : '🐞') + '</td>' +
          '<td><strong>' + esc(f.title) + '</strong>' +
          '<div class="fb-body" hidden style="margin-top:6px;white-space:pre-wrap;opacity:.85;font-size:13px">' + esc(f.body) + '</div>' +
          (f.page_url ? '<div style="font-size:12px;opacity:.6;margin-top:4px">📄 ' + esc(f.page_url) + '</div>' : '') + '</td>' +
          '<td>' + esc(f.submitter_name || '—') + '<br/><span style="font-size:12px;opacity:.6">' + esc(f.submitter_email || '') + '</span></td>' +
          '<td>' + esc(f.status) + '</td>' +
          '<td class="num">' + fmtDate(f.created_at) + '</td>' +
          '<td class="row-actions"></td></tr>'
        );
        var actions = tr.querySelector('.row-actions');
        function act(label, fn, primary) {
          var b = h('<button class="admin-btn admin-btn-sm' + (primary ? ' admin-btn-primary' : '') + '">' + label + '</button>');
          b.addEventListener('click', function () { fn(f); });
          actions.appendChild(b);
        }
        act(f.body && tr.querySelector('.fb-body').hidden ? 'Expand' : 'Expand', function () {
          var bd = tr.querySelector('.fb-body'); bd.hidden = !bd.hidden;
        });
        if (f.status === 'new') {
          act('Mark reviewed', function (q) {
            api('/admin/feedback/' + q.id, { method: 'PATCH', body: JSON.stringify({ status: 'reviewed' }) })
              .then(function (r) { toast('Marked reviewed (+10 XP to tester).'); Views.feedback(); refreshBadges(); })
              .catch(function (e) { toast(e.message, true); });
          }, true);
        }
        if (f.status !== 'resolved') {
          act('Resolve', function (q) {
            api('/admin/feedback/' + q.id, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) })
              .then(function () { toast('Resolved.'); Views.feedback(); refreshBadges(); })
              .catch(function (e) { toast(e.message, true); });
          });
        }
        tb.appendChild(tr);
      });
      main.appendChild(panel);
    }).catch(errView);
  };

  Views.compose = function () {
    main.innerHTML = '';
    main.appendChild(h('<div class="admin-view-head"><h1>Write &amp; Publish</h1><p>Compose a story and file it to the queue as a draft, or publish it live immediately.</p></div>'));
    ensureStaff().then(function () {
      var agentOpts = State.staff.map(function (st) { return '<option value="' + st.id + '">' + esc(st.displayName) + '</option>'; }).join('');
      var today = new Date().toISOString().slice(0, 10);
      var form = h(
        '<form class="admin-form admin-panel">' +
          '<div class="admin-form-row">' +
            '<label>Channel<select id="c-cat"><option value="skynet">Skynet</option><option value="ai">AI &amp; Machine Learning</option><option value="space">Space &amp; Aerospace</option><option value="robotics">Robotics &amp; Automation</option><option value="biotech">Biotech &amp; Health</option><option value="quantum">Quantum &amp; Computing</option><option value="climate">Climate &amp; Energy</option><option value="engineering">Engineering &amp; Making</option><option value="math">Math &amp; Data Science</option><option value="cyber">Cybersecurity &amp; Code</option><option value="gaming">Gaming Tournaments</option><option value="music">Music Festivals</option><option value="stem">STEM (legacy)</option><option value="play">Play &amp; Design (legacy)</option><option value="network">Network</option></select></label>' +
            '<label>Filed by<select id="c-staff">' + agentOpts + '</select></label>' +
          '</div>' +
          '<label>Title<input id="c-title" maxlength="200" required/></label>' +
          '<label>Excerpt <span class="hint">One-sentence summary shown on cards.</span><textarea id="c-excerpt" required></textarea></label>' +
          '<label>Body <span class="hint">HTML allowed (&lt;p&gt;, &lt;h2&gt;, &lt;ul&gt;…). Kid-safe guardrails apply on publish.</span><textarea id="c-body" style="min-height:180px" required></textarea></label>' +
          '<label>Kid Take <span class="hint">2–3 sentences at ~age-8 reading level.</span><textarea id="c-kidtake" required></textarea></label>' +
          '<label>Family discussion questions <span class="hint">One per line, at least 2.</span><textarea id="c-family" required>What did you find most surprising?\nHow could you try something like this yourself?</textarea></label>' +
          '<div class="admin-form-row">' +
            '<label>Author byline<input id="c-author" placeholder="The Newsroom"/></label>' +
            '<label>Date<input id="c-date" type="date" value="' + today + '" required/></label>' +
          '</div>' +
          '<label>Tags <span class="hint">Comma-separated.</span><input id="c-tags" placeholder="robotics, first, teens"/></label>' +
          '<div class="row-actions">' +
            '<button type="button" class="admin-btn" id="c-draft">Save to queue as draft</button>' +
            '<button type="submit" class="admin-btn admin-btn-primary">Publish live now ▶</button>' +
          '</div>' +
        '</form>'
      );
      main.appendChild(form);

      function collect() {
        var family = form.querySelector('#c-family').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
        var tags = form.querySelector('#c-tags').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        return {
          cat: form.querySelector('#c-cat').value,
          title: form.querySelector('#c-title').value.trim(),
          excerpt: form.querySelector('#c-excerpt').value.trim(),
          body: form.querySelector('#c-body').value.trim(),
          kidTake: form.querySelector('#c-kidtake').value.trim(),
          familyDiscussion: family,
          author: form.querySelector('#c-author').value.trim() || 'The Newsroom',
          date: form.querySelector('#c-date').value,
          tags: tags
        };
      }
      function validate(p) {
        if (!p.title || !p.excerpt || !p.body || !p.kidTake) { toast('Fill in title, excerpt, body and kid take.', true); return false; }
        if (p.familyDiscussion.length < 2) { toast('Add at least 2 family discussion questions.', true); return false; }
        return true;
      }

      form.querySelector('#c-draft').addEventListener('click', function () {
        var p = collect(); if (!validate(p)) return;
        api('/admin/stories/queue', { method: 'POST', body: { staffId: Number(form.querySelector('#c-staff').value), channel: p.cat, payload: p, status: 'draft' } })
          .then(function () { toast('Saved to queue'); navTo('queue'); refreshBadges(); })
          .catch(function (e) { toast(e.message, true); });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var p = collect(); if (!validate(p)) return;
        var btn = form.querySelector('button[type=submit]');
        btn.disabled = true; btn.textContent = 'Publishing…';
        api('/admin/stories/queue', { method: 'POST', body: { staffId: Number(form.querySelector('#c-staff').value), channel: p.cat, payload: p, status: 'approved' } })
          .then(function (r) { return api('/admin/stories/queue/' + r.story.id + '/publish', { method: 'POST' }); })
          .then(function () { toast('Published live'); navTo('queue'); refreshBadges(); })
          .catch(function (e) { toast(e.message, true); btn.disabled = false; btn.textContent = 'Publish live now ▶'; });
      });
    });
  };

  // ===== Users & roles =====
  var usersState = { q: '', users: [], total: 0, admins: 0 };

  Views.users = function () {
    if (!isFullAdmin()) { main.innerHTML = '<div class="admin-empty">Admin-only.</div>'; return; }
    main.innerHTML = '';
    main.appendChild(h(
      '<div class="admin-view-head"><h1>Users &amp; Accounts</h1>' +
      '<p>Manage every registered account — search, change roles, reset passwords, review kid profiles, and remove accounts.</p></div>'
    ));
    var bar = h(
      '<div class="admin-toolbar">' +
      '<input id="user-search" class="admin-input" type="search" placeholder="Search name or email…" autocomplete="off"/>' +
      '<span class="admin-toolbar-stat" id="user-count">—</span>' +
      '</div>'
    );
    main.appendChild(bar);
    var panelWrap = h('<div id="users-panel-wrap"></div>');
    main.appendChild(panelWrap);

    var searchEl = bar.querySelector('#user-search');
    searchEl.value = usersState.q;
    var t = null;
    searchEl.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { usersState.q = searchEl.value.trim(); loadUsers(); }, 200);
    });
    loadUsers();
  };

  function loadUsers() {
    var wrap = document.getElementById('users-panel-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="admin-loading">Loading…</div>';
    api('/admin/users?limit=500&q=' + encodeURIComponent(usersState.q)).then(function (r) {
      usersState.users = r.users || [];
      usersState.total = r.total || usersState.users.length;
      usersState.admins = r.admins || 0;
      var cnt = document.getElementById('user-count');
      if (cnt) cnt.textContent = usersState.total + ' account' + (usersState.total === 1 ? '' : 's') + ' · ' + usersState.admins + ' admin' + (usersState.admins === 1 ? '' : 's');
      renderUsersTable(wrap);
    }).catch(function (e) { wrap.innerHTML = '<div class="admin-empty">' + esc(e.message) + '</div>'; });
  }

  function renderUsersTable(wrap) {
    var users = usersState.users;
    wrap.innerHTML = '';
    if (!users.length) { wrap.appendChild(h('<div class="admin-empty">No accounts match “' + esc(usersState.q) + '”.</div>')); return; }
    var panel = h('<div class="admin-panel"><table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Kids</th><th>Joined</th><th>Last login</th><th></th></tr></thead><tbody></tbody></table></div>');
    var tb = panel.querySelector('tbody');
    users.forEach(function (u) {
      var tr = h(
        '<tr class="user-row">' +
        '<td><span class="user-dot" style="background:' + esc(u.avatarColor || '#00e5ff') + '"></span><strong>' + esc(u.displayName) + '</strong></td>' +
        '<td>' + esc(u.email) + '</td>' +
        '<td><span class="pill ' + rolePill(u.role) + '">' + esc(u.role) + '</span></td>' +
        '<td class="num">' + (u.kidCount || 0) + '</td>' +
        '<td class="num">' + fmtDate(u.createdAt) + '</td>' +
        '<td class="num">' + fmtDate(u.lastLoginAt) + '</td>' +
        '<td><button class="admin-btn admin-btn-sm">Manage</button></td>' +
        '</tr>'
      );
      tr.querySelector('button').addEventListener('click', function () { openUserModal(u.id); });
      tb.appendChild(tr);
    });
    wrap.appendChild(panel);
  }

  function rolePill(role) {
    return role === 'admin' ? 'published' : role === 'editor' ? 'assigned' : role === 'teacher' ? 'approved' : 'paused';
  }

  function openUserModal(id) {
    var modal = openModal('Loading…');
    api('/admin/users/' + id).then(function (r) {
      var u = r.user;
      modal.setTitle(u.displayName);
      var kids = (u.kids || []).map(function (k) {
        return '<li><span class="kid-badge" style="background:' + esc(k.avatarColor || '#39ff14') + '">' + esc(k.avatarEmoji || '🚀') + '</span>' +
          '<span><strong>' + esc(k.name) + '</strong> · born ' + esc(String(k.birthYear)) + '</span></li>';
      }).join('');
      modal.body.innerHTML =
        '<div class="user-detail">' +
        '<div class="user-detail-head"><span class="user-dot lg" style="background:' + esc(u.avatarColor || '#00e5ff') + '"></span>' +
        '<div><div class="user-detail-email">' + esc(u.email) + '</div>' +
        '<div class="user-detail-meta">Joined ' + fmtDate(u.createdAt) + ' · Last login ' + fmtDate(u.lastLoginAt) + '</div></div></div>' +

        '<label class="admin-label">Display name</label>' +
        '<input id="um-name" class="admin-input" value="' + esc(u.displayName) + '" maxlength="40"/>' +

        '<label class="admin-label">Role</label>' +
        '<select id="um-role" class="admin-input"><option value="parent">parent</option><option value="teacher">teacher</option><option value="editor">editor</option><option value="admin">admin</option></select>' +

        '<label class="admin-label">Admin notes <span class="admin-hint">(private, staff-only)</span></label>' +
        '<textarea id="um-notes" class="admin-input" rows="3" maxlength="2000" placeholder="Notes about this account…">' + esc(u.adminNotes || '') + '</textarea>' +

        '<div class="user-kids"><div class="admin-label">Kid profiles (' + (u.kids ? u.kids.length : 0) + ')</div>' +
        (kids ? '<ul class="kid-list">' + kids + '</ul>' : '<div class="admin-hint">No kid profiles.</div>') + '</div>' +

        '<div id="um-temp" class="user-temp" hidden></div>' +

        '<div class="user-actions">' +
        '<button id="um-save" class="admin-btn admin-btn-primary">Save changes</button>' +
        '<button id="um-reset" class="admin-btn">Reset password</button>' +
        '<button id="um-sendreset" class="admin-btn">Email reset link</button>' +
        '<button id="um-delete" class="admin-btn admin-btn-danger">Delete account</button>' +
        '</div></div>';

      modal.body.querySelector('#um-role').value = u.role;

      modal.body.querySelector('#um-save').addEventListener('click', function () {
        var name = modal.body.querySelector('#um-name').value.trim();
        var notes = modal.body.querySelector('#um-notes').value;
        var role = modal.body.querySelector('#um-role').value;
        var chain = Promise.resolve();
        if (name !== u.displayName || notes !== (u.adminNotes || '')) {
          chain = chain.then(function () { return api('/admin/users/' + id, { method: 'PATCH', body: { displayName: name, adminNotes: notes } }); });
        }
        if (role !== u.role) {
          chain = chain.then(function () { return api('/admin/users/' + id + '/role', { method: 'PATCH', body: { role: role } }); });
        }
        chain.then(function () { toast('Account updated'); closeModal(modal); loadUsers(); })
          .catch(function (e) { toast(e.message, true); });
      });

      modal.body.querySelector('#um-reset').addEventListener('click', function () {
        if (!confirm('Generate a new temporary password for ' + u.email + '? Their current password will stop working.')) return;
        api('/admin/users/' + id + '/reset-password', { method: 'POST', body: {} }).then(function (r) {
          var box = modal.body.querySelector('#um-temp');
          box.hidden = false;
          box.innerHTML = 'Temporary password (share securely, shown once):<br><code>' + esc(r.tempPassword) + '</code>';
          toast('Password reset');
        }).catch(function (e) { toast(e.message, true); });
      });

      modal.body.querySelector('#um-sendreset').addEventListener('click', function () {
        if (!confirm('Send a self-service password reset link to ' + u.email + '? Their current password keeps working until they use it.')) return;
        api('/admin/users/' + id + '/send-reset', { method: 'POST', body: {} }).then(function (r) {
          var box = modal.body.querySelector('#um-temp');
          box.hidden = false;
          if (r.emailed) {
            box.innerHTML = 'Reset link emailed to <strong>' + esc(u.email) + '</strong> (valid 1 hour).';
            toast('Reset link emailed');
          } else {
            box.innerHTML = 'Email not configured — copy this reset link and share it securely (valid 1 hour):<br><code>' + esc(r.link) + '</code>';
            toast('Reset link generated');
          }
        }).catch(function (e) { toast(e.message, true); });
      });

      modal.body.querySelector('#um-delete').addEventListener('click', function () {
        if (!confirm('Permanently delete ' + u.email + ' and all their kid profiles? This cannot be undone.')) return;
        api('/admin/users/' + id, { method: 'DELETE' }).then(function () {
          toast('Account deleted'); closeModal(modal); loadUsers();
        }).catch(function (e) { toast(e.message, true); });
      });
    }).catch(function (e) { modal.body.innerHTML = '<div class="admin-empty">' + esc(e.message) + '</div>'; });
  }

  // ===== Audit log =====
  Views.audit = function () {
    api('/admin/actions?limit=200').then(function (r) {
      var actions = r.actions || [];
      main.innerHTML = '';
      main.appendChild(h('<div class="admin-view-head"><h1>Audit Log</h1><p>Every admin action, newest first.</p></div>'));
      if (!actions.length) { main.appendChild(h('<div class="admin-empty">No actions logged yet.</div>')); return; }
      var panel = h('<div class="admin-panel"><table class="admin-table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th></tr></thead><tbody></tbody></table></div>');
      var tb = panel.querySelector('tbody');
      actions.forEach(function (a) {
        tb.appendChild(h(
          '<tr><td class="num">' + fmtDate(a.createdAt) + '</td>' +
          '<td>' + esc(a.userDisplayName || a.userEmail || ('#' + a.userId)) + '</td>' +
          '<td><code>' + esc(a.action) + '</code></td>' +
          '<td>' + esc(a.targetKind || '') + (a.targetId ? ' #' + esc(a.targetId) : '') + '</td></tr>'
        ));
      });
      main.appendChild(panel);
    }).catch(errView);
  };

  // ===== Published Articles =====
  Views.published = function () {
    api('/admin/stories/queue?status=published&limit=100').then(function (r) {
      var stories = r.stories || [];
      main.innerHTML = '';
      main.appendChild(h('<div class="admin-view-head"><h1>Published Articles</h1><p>Edit cover images, titles, contents, pin updates, or remove published articles from live feeds.</p></div>'));
      
      if (!stories.length) {
        main.appendChild(h('<div class="admin-empty">No published articles found. Run a drop to publish some!</div>'));
        return;
      }
      
      var panel = h(
        '<div class="admin-panel">' +
          '<table class="admin-table">' +
            '<thead>' +
              '<tr>' +
                '<th>Title</th>' +
                '<th>Channel</th>' +
                '<th>Date</th>' +
                '<th>Edition</th>' +
                '<th>Badges</th>' +
                '<th>Actions</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody></tbody>' +
          '</table>' +
        '</div>'
      );
      
      var tbody = panel.querySelector('tbody');
      stories.forEach(function (st) {
        var p = st.payload || {};
        var tr = h(
          '<tr>' +
            '<td><strong>' + esc(p.title || '(untitled)') + '</strong></td>' +
            '<td>' + esc(st.channel) + '</td>' +
            '<td class="num">' + esc(p.date || '—') + '</td>' +
            '<td>' + esc(st.edition || 'morning') + '</td>' +
            '<td>' +
              (p.pinned ? '<span class="pill approved" style="background:#e11d48">Pinned</span>' : '') +
              (p.featured ? '<span class="pill approved" style="background:var(--lcars-gold); color:#000">Featured</span>' : '') +
            '</td>' +
            '<td class="row-actions"></td>' +
          '</tr>'
        );
        
        var actions = tr.querySelector('.row-actions');
        
        var editBtn = h('<button class="admin-btn admin-btn-sm">Edit</button>');
        editBtn.addEventListener('click', function () { editPublishedStory(st); });
        actions.appendChild(editBtn);
        
        var pinBtn = h('<button class="admin-btn admin-btn-sm">' + (p.pinned ? '📌 Unpin' : '📌 Pin') + '</button>');
        pinBtn.addEventListener('click', function () {
          p.pinned = !p.pinned;
          api('/admin/stories/published/' + st.id, { method: 'PATCH', body: { payload: p } })
            .then(function () { toast(p.pinned ? 'Article Pinned!' : 'Article Unpinned!'); Views.published(); })
            .catch(function (e) { toast(e.message, true); });
        });
        actions.appendChild(pinBtn);
        
        var deleteBtn = h('<button class="admin-btn admin-btn-sm admin-btn-danger">Delete</button>');
        deleteBtn.addEventListener('click', function () {
          if (!confirm("Are you sure you want to PERMANENTLY delete this published article? This deletes the SQLite database row, the JSON file on disk, and manifest index.")) return;
          api('/admin/stories/published/' + st.id, { method: 'DELETE' })
            .then(function () { toast('Successfully deleted published article!'); Views.published(); })
            .catch(function (e) { toast(e.message, true); });
        });
        actions.appendChild(deleteBtn);
        
        tbody.appendChild(tr);
      });
      
      main.appendChild(panel);
    }).catch(errView);
  };

  function editPublishedStory(st) {
    var p = st.payload || {};
    var modal = openModal('Edit Published Article');
    
    var form = h(
      '<form style="display:flex; flex-direction:column; gap:12px;">' +
        '<label class="admin-label">Title<input type="text" id="edit-title" class="admin-input" required></label>' +
        '<label class="admin-label">Subtitle<input type="text" id="edit-subtitle" class="admin-input"></label>' +
        '<label class="admin-label">Excerpt<textarea id="edit-excerpt" class="admin-input" rows="2" required></textarea></label>' +
        '<label class="admin-label">Body (HTML)<textarea id="edit-body" class="admin-input" rows="6" required></textarea></label>' +
        '<label class="admin-label">Kid Take<textarea id="edit-kidtake" class="admin-input" rows="2" required></textarea></label>' +
        '<div class="admin-form-image-picker">' +
          '<span class="admin-label" style="margin:0">Hero Image</span>' +
          '<div class="admin-form-image-current">' +
            '<img src="' + esc(p.heroImage) + '" id="edit-image-preview" class="admin-form-image-preview">' +
            '<span id="edit-image-path" class="admin-form-image-path">' + esc(p.heroImage || '(none)') + '</span>' +
            '<button type="button" id="btn-browse-gallery" class="admin-btn admin-btn-sm">🖼️ Browse Pool</button>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex; gap:16px; margin-top:8px;">' +
          '<label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="edit-pinned"> Pin on feed</label>' +
          '<label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="checkbox" id="edit-featured"> Feature article</label>' +
        '</div>' +
        '<div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;">' +
          '<button type="button" id="btn-edit-cancel" class="admin-btn">Cancel</button>' +
          '<button type="submit" class="admin-btn admin-btn-primary">Save Changes</button>' +
        '</div>' +
      '</form>'
    );
    
    form.querySelector('#edit-title').value = p.title || '';
    form.querySelector('#edit-subtitle').value = p.subtitle || '';
    form.querySelector('#edit-excerpt').value = p.excerpt || '';
    form.querySelector('#edit-body').value = p.body || '';
    form.querySelector('#edit-kidtake').value = p.kidTake || '';
    form.querySelector('#edit-pinned').checked = !!p.pinned;
    form.querySelector('#edit-featured').checked = !!p.featured;
    
    var selectedImgUrl = p.heroImage || '';
    
    form.querySelector('#btn-browse-gallery').addEventListener('click', function () {
      var pickerModal = openModal('Select Hero Image');
      pickerModal.overlay.querySelector('.admin-modal').classList.add('admin-image-picker-modal');
      
      pickerModal.body.appendChild(h('<p style="font-size:13px; color:var(--text-mute); margin-bottom:12px;">Choose an illustration from the <strong>' + esc(st.channel) + '</strong> channel pool:</p>'));
      
      var grid = h('<div class="admin-image-picker-grid"></div>');
      
      api('/admin/images/list').then(function (r) {
        var files = r.images[st.channel] || [];
        if (!files.length) {
          grid.appendChild(h('<div class="admin-empty" style="grid-column:1/-1">No images in this channel pool.</div>'));
        } else {
          files.forEach(function (filename) {
            var url = '/assets/img/channels/' + st.channel + '/' + filename;
            var isSel = (url === selectedImgUrl);
            var card = h(
              '<div class="admin-image-picker-card' + (isSel ? ' selected' : '') + '">' +
                '<img src="' + url + '" class="admin-image-picker-thumb">' +
              '</div>'
            );
            card.addEventListener('click', function () {
              selectedImgUrl = url;
              form.querySelector('#edit-image-preview').src = url;
              form.querySelector('#edit-image-path').textContent = url;
              closeModal(pickerModal);
            });
            grid.appendChild(card);
          });
        }
      }).catch(function (err) { toast(err.message, true); });
      
      pickerModal.body.appendChild(grid);
    });
    
    form.querySelector('#btn-edit-cancel').addEventListener('click', function () { closeModal(modal); });
    
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      
      p.title = form.querySelector('#edit-title').value;
      p.subtitle = form.querySelector('#edit-subtitle').value;
      p.excerpt = form.querySelector('#edit-excerpt').value;
      p.body = form.querySelector('#edit-body').value;
      p.kidTake = form.querySelector('#edit-kidtake').value;
      p.heroImage = selectedImgUrl;
      p.pinned = form.querySelector('#edit-pinned').checked;
      p.featured = form.querySelector('#edit-featured').checked;
      
      api('/admin/stories/published/' + st.id, {
        method: 'PATCH',
        body: { payload: p }
      }).then(function () {
        toast('Published article updated successfully!');
        closeModal(modal);
        Views.published();
      }).catch(function (err) {
        toast(err.message, true);
      });
    });
    
    modal.body.appendChild(form);
  }

  // ===== Image Pools =====
  Views.images = function () {
    main.innerHTML = '';
    main.appendChild(h('<div class="admin-view-head"><h1>Image Pools Manager</h1><p>Browse and upload images for each channel. Uploaded files grow the monthly image pools.</p></div>'));
    
    var layout = h(
      '<div class="admin-split-layout">' +
        '<div class="admin-left-pane"><ul class="admin-sidebar-list" id="images-channel-list"></ul></div>' +
        '<div class="admin-right-pane" id="images-channel-gallery"></div>' +
      '</div>'
    );
    main.appendChild(layout);
    
    var activeChannel = 'ai';
    var imagesList = {};
    
    var channelLabels = {
      skynet:'Skynet', ai:'AI & Machine Learning', space:'Space & Aerospace', robotics:'Robotics & Automation',
      biotech:'Biotech & Health', quantum:'Quantum & Computing', climate:'Climate & Energy', engineering:'Engineering & Making',
      math:'Math & Data Science', cyber:'Cybersecurity & Code', gaming:'Gaming Tournaments', music:'Music Festivals',
      stem:'STEM Signal', play:'Play & Design', network:'Network News'
    };
    
    function renderChannelsList() {
      var ul = $('#images-channel-list');
      if (!ul) return;
      ul.innerHTML = '';
      Object.keys(channelLabels).forEach(function (ch) {
        var li = h('<li><button class="admin-sidebar-item' + (ch === activeChannel ? ' active' : '') + '">' + esc(channelLabels[ch]) + '</button></li>');
        li.querySelector('button').addEventListener('click', function () {
          activeChannel = ch;
          renderChannelsList();
          renderGallery();
        });
        ul.appendChild(li);
      });
    }
    
    function renderGallery() {
      var pane = $('#images-channel-gallery');
      if (!pane) return;
      pane.innerHTML = '';
      
      var files = imagesList[activeChannel] || [];
      
      var box = h(
        '<div class="admin-gallery-box">' +
          '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px;">' +
            '<div>' +
              '<h3 style="margin:0">' + esc(channelLabels[activeChannel]) + ' Pool</h3>' +
              '<p style="margin:4px 0 0; font-size:13px; color:var(--text-mute)">' + files.length + ' images available in <code>/public/assets/img/channels/' + activeChannel + '/</code></p>' +
            '</div>' +
            '<div style="display:flex; gap:10px;">' +
              '<button id="btn-toggle-batch" class="admin-btn">Toggle Selection Mode</button>' +
              '<button id="btn-delete-selected" class="admin-btn admin-btn-danger" style="display:none">🗑️ Delete Selected</button>' +
              '<input type="file" id="image-upload-file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" multiple style="display:none">' +
              '<button id="btn-trigger-upload" class="admin-btn admin-btn-primary">📤 Upload Image(s)</button>' +
            '</div>' +
          '</div>' +
          '<div style="margin-bottom:18px;">' +
            '<input type="text" id="gallery-search" placeholder="🔍 Search images by filename..." class="admin-input" style="width:100%; max-width:360px; padding:8px 12px; font-size:13px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-alt); color: var(--text);">' +
          '</div>' +
          '<div class="admin-image-grid" id="gallery-grid"></div>' +
        '</div>'
      );
      
      var batchMode = false;
      var selectedFiles = [];
      
      var toggleBatchBtn = box.querySelector('#btn-toggle-batch');
      var deleteSelectedBtn = box.querySelector('#btn-delete-selected');
      var searchInput = box.querySelector('#gallery-search');
      
      searchInput.addEventListener('input', function (e) {
        var query = e.target.value.toLowerCase().trim();
        box.querySelectorAll('.admin-image-card').forEach(function (card) {
          var name = card.dataset.filename.toLowerCase();
          if (name.indexOf(query) > -1) {
            card.style.display = '';
          } else {
            card.style.display = 'none';
          }
        });
      });
      
      toggleBatchBtn.addEventListener('click', function () {
        batchMode = !batchMode;
        selectedFiles = [];
        toggleBatchBtn.classList.toggle('admin-btn-primary', batchMode);
        toggleBatchBtn.textContent = batchMode ? 'Cancel Selection Mode' : 'Toggle Selection Mode';
        deleteSelectedBtn.style.display = batchMode ? '' : 'none';
        deleteSelectedBtn.textContent = '🗑️ Delete Selected';
        
        box.querySelectorAll('.admin-image-card').forEach(function (c) {
          c.classList.remove('selected');
        });
        box.querySelectorAll('.admin-card-actions').forEach(function (el) {
          el.style.display = batchMode ? 'none' : 'flex';
        });
      });
      
      deleteSelectedBtn.addEventListener('click', function () {
        if (!selectedFiles.length) {
          alert('No images selected.');
          return;
        }
        if (!confirm('Are you sure you want to permanently delete these ' + selectedFiles.length + ' selected images from the ' + activeChannel + ' pool?')) return;
        
        deleteSelectedBtn.disabled = true;
        deleteSelectedBtn.textContent = 'Deleting...';
        
        api('/images/delete-batch', {
          method: 'POST',
          body: {
            channel: activeChannel,
            filenames: selectedFiles
          }
        }).then(function (r) {
          toast('Successfully deleted ' + r.deletedCount + ' images!');
          refreshImages();
        }).catch(function (err) {
          toast(err.message, true);
          deleteSelectedBtn.disabled = false;
          deleteSelectedBtn.textContent = '🗑️ Delete Selected';
        });
      });
      
      var grid = box.querySelector('#gallery-grid');
      if (!files.length) {
        grid.appendChild(h('<div class="admin-empty" style="grid-column:1/-1">No custom images uploaded yet.</div>'));
      } else {
        files.forEach(function (filename) {
          var imgUrl = '/assets/img/channels/' + activeChannel + '/' + filename;
          var card = h(
            '<div class="admin-image-card" data-filename="' + esc(filename) + '">' +
              '<img src="' + imgUrl + '" class="admin-image-thumb" loading="lazy">' +
              '<div class="admin-image-info">' +
                '<div class="filename-text" style="font-weight:600; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; margin-bottom:4px;" title="' + esc(filename) + '">' + esc(filename) + '</div>' +
                '<div class="admin-card-actions" style="display:flex; gap:6px; font-size:11px; margin-top:2px; flex-wrap:wrap;">' +
                  '<button class="action-btn btn-rename" style="background:none; border:none; color:var(--accent); cursor:pointer; padding:0; font-size:11px;">✏️ Rename</button>' +
                  '<span style="color:var(--border)">|</span>' +
                  '<button class="action-btn btn-move" style="background:none; border:none; color:var(--accent-3); cursor:pointer; padding:0; font-size:11px;">🔄 Move</button>' +
                  '<span style="color:var(--border)">|</span>' +
                  '<button class="action-btn btn-delete" style="background:none; border:none; color:#ff5555; cursor:pointer; padding:0; font-size:11px;">🗑️ Delete</button>' +
                '</div>' +
              '</div>' +
            '</div>'
          );
          
          card.addEventListener('click', function () {
            if (batchMode) {
              var idx = selectedFiles.indexOf(filename);
              if (idx > -1) {
                selectedFiles.splice(idx, 1);
                card.classList.remove('selected');
              } else {
                selectedFiles.push(filename);
                card.classList.add('selected');
              }
              deleteSelectedBtn.textContent = '🗑️ Delete Selected (' + selectedFiles.length + ')';
            } else {
              navigator.clipboard.writeText(imgUrl).then(function () {
                toast('Copied image path to clipboard: ' + imgUrl);
              });
            }
          });
          
          card.querySelector('.btn-rename').addEventListener('click', function (ev) {
            ev.stopPropagation();
            var newName = prompt('Enter a new filename/number for this image:', filename);
            if (!newName || newName.trim() === filename) return;
            
            api('/images/rename', {
              method: 'POST',
              body: {
                channel: activeChannel,
                oldFilename: filename,
                newFilename: newName
              }
            }).then(function (r) {
              toast('Successfully renamed image to ' + r.filename + '!');
              refreshImages();
            }).catch(function (err) {
              alert(err.message);
            });
          });

          card.querySelector('.btn-move').addEventListener('click', function (ev) {
            ev.stopPropagation();
            var listHtml = Object.keys(channelLabels)
              .filter(function (ch) { return ch !== activeChannel; })
              .map(function (ch) { return ch.toUpperCase(); })
              .join(', ');
            var target = prompt('Enter destination channel name (choose from: ' + listHtml + '):');
            if (!target) return;
            target = target.toLowerCase().trim();
            if (!channelLabels[target]) {
              alert('Invalid channel name.');
              return;
            }
            
            api('/images/move', {
              method: 'POST',
              body: {
                sourceChannel: activeChannel,
                targetChannel: target,
                filename: filename
              }
            }).then(function () {
              toast('Successfully moved image to ' + target.toUpperCase() + '!');
              refreshImages();
            }).catch(function (err) {
              alert(err.message);
            });
          });

          card.querySelector('.btn-delete').addEventListener('click', function (ev) {
            ev.stopPropagation();
            if (!confirm('Are you sure you want to permanently delete ' + filename + '?')) return;
            
            api('/images/delete-batch', {
              method: 'POST',
              body: {
                channel: activeChannel,
                filenames: [filename]
              }
            }).then(function () {
              toast('Successfully deleted image!');
              refreshImages();
            }).catch(function (err) {
              alert(err.message);
            });
          });
          
          grid.appendChild(card);
        });
      }
      
      var fileInput = box.querySelector('#image-upload-file');
      var uploadBtn = box.querySelector('#btn-trigger-upload');
      
      uploadBtn.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function (e) {
        var filesList = Array.prototype.slice.call(e.target.files);
        if (!filesList.length) return;
        
        uploadBtn.disabled = true;
        
        var customName = null;
        if (filesList.length === 1) {
          customName = prompt("Enter a number or name for this image (e.g. '5' to save as '5.jpg' in pool 1-100).\nLeave blank to auto-assign the next available number (1-100):");
          if (customName === null) {
            uploadBtn.disabled = false;
            fileInput.value = '';
            return;
          }
        }
        
        var uploadIndex = 0;
        
        function uploadNext(overwrite) {
          if (uploadIndex >= filesList.length) {
            toast('Successfully uploaded ' + filesList.length + ' images!');
            refreshImages();
            return;
          }
          
          var file = filesList[uploadIndex];
          uploadBtn.textContent = 'Uploading (' + (uploadIndex + 1) + '/' + filesList.length + ')...';
          
          var reader = new FileReader();
          reader.onload = function (evt) {
            api('/admin/images/upload', {
              method: 'POST',
              body: {
                channel: activeChannel,
                filename: file.name,
                base64: evt.target.result,
                customName: filesList.length === 1 ? customName : null,
                overwrite: !!overwrite
              }
            }).then(function (r) {
              if (r && r.conflict) {
                if (confirm("An image named '" + r.filename + "' already exists in this pool. Overwrite it?")) {
                  uploadNext(true);
                } else {
                  uploadBtn.disabled = false;
                  uploadBtn.textContent = '📤 Upload Image(s)';
                }
                return;
              }
              uploadIndex++;
              uploadNext();
            }).catch(function (err) {
              toast('Failed uploading ' + file.name + ': ' + err.message, true);
              uploadBtn.disabled = false;
              uploadBtn.textContent = '📤 Upload Image(s)';
            });
          };
          reader.readAsDataURL(file);
        }
        
        uploadNext();
      });
      
      // Bind Drag & Drop uploads
      box.addEventListener('dragover', function (e) {
        e.preventDefault();
        box.style.border = '2px dashed var(--accent)';
        box.style.background = 'rgba(0, 229, 255, 0.05)';
      });
      box.addEventListener('dragleave', function (e) {
        e.preventDefault();
        box.style.border = '1px solid var(--border)';
        box.style.background = 'var(--bg-alt)';
      });
      box.addEventListener('drop', function (e) {
        e.preventDefault();
        box.style.border = '1px solid var(--border)';
        box.style.background = 'var(--bg-alt)';
        
        var filesList = Array.prototype.slice.call(e.dataTransfer.files);
        if (!filesList.length) return;
        
        uploadBtn.disabled = true;
        
        var customName = null;
        if (filesList.length === 1) {
          customName = prompt("Enter a number or name for this image (e.g. '5' to save as '5.jpg' in pool 1-100).\nLeave blank to auto-assign the next available number (1-100):");
          if (customName === null) {
            uploadBtn.disabled = false;
            return;
          }
        }
        
        var uploadIndex = 0;
        
        function uploadNext(overwrite) {
          if (uploadIndex >= filesList.length) {
            toast('Successfully uploaded ' + filesList.length + ' images!');
            refreshImages();
            return;
          }
          
          var file = filesList[uploadIndex];
          uploadBtn.textContent = 'Uploading (' + (uploadIndex + 1) + '/' + filesList.length + ')...';
          
          var reader = new FileReader();
          reader.onload = function (evt) {
            api('/admin/images/upload', {
              method: 'POST',
              body: {
                channel: activeChannel,
                filename: file.name,
                base64: evt.target.result,
                customName: filesList.length === 1 ? customName : null,
                overwrite: !!overwrite
              }
            }).then(function (r) {
              if (r && r.conflict) {
                if (confirm("An image named '" + r.filename + "' already exists in this pool. Overwrite it?")) {
                  uploadNext(true);
                } else {
                  uploadBtn.disabled = false;
                  uploadBtn.textContent = '📤 Upload Image(s)';
                }
                return;
              }
              uploadIndex++;
              uploadNext();
            }).catch(function (err) {
              toast('Failed uploading ' + file.name + ': ' + err.message, true);
              uploadBtn.disabled = false;
              uploadBtn.textContent = '📤 Upload Image(s)';
            });
          };
          reader.readAsDataURL(file);
        }
        
        uploadNext();
      });
      
      pane.appendChild(box);
    }
    
    function refreshImages() {
      api('/admin/images/list').then(function (r) {
        imagesList = r.images || {};
        renderChannelsList();
        renderGallery();
      }).catch(errView);
    }
    
    refreshImages();
  };

  // ===== Correspondents =====
  Views.correspondents = function () {
    var PORTRAIT_STYLES = [
      ['human', 'Humans', '🧑'],
      ['animal', 'Animals', '🐾'],
      ['skynet', 'Skynet Agents', '🤖']
    ];

    function styleLabel(style) {
      for (var i = 0; i < PORTRAIT_STYLES.length; i++) {
        if (PORTRAIT_STYLES[i][0] === style) return PORTRAIT_STYLES[i][1];
      }
      return style;
    }

    function load() {
      api('/admin/correspondents').then(render).catch(errView);
    }

    function portraitUrl(c, style) {
      return (c.portraits && c.portraits[style]) || '';
    }

    function render(r) {
      var list = r.correspondents || [];
      main.innerHTML = '';
      main.appendChild(h(
        '<div class="admin-view-head"><h1>Meet the Correspondents</h1>' +
        '<p>These are the 13 public-facing characters who write for Skynet Nexus. ' +
        'Each one comes in three portrait styles — Humans, Animals, and Skynet Agents — ' +
        'and kids pick their favorite style in their kid profile.</p></div>'
      ));
      if (!list.length) {
        main.appendChild(h('<div class="admin-empty">No correspondents configured yet.</div>'));
        return;
      }
      var grid = h('<div class="admin-queue-grid" id="corr-grid"></div>');
      main.appendChild(grid);
      list.forEach(function (c) {
        if (c.kind && c.kind !== 'agent') return;
        grid.appendChild(correspondentCard(c));
      });
    }

    function correspondentCard(c) {
      var accent = c.accentColor || '#00e5ff';
      var curStyle = 'human';
      var img = null;

      function paintSwitch() {
        Array.prototype.forEach.call(card.querySelectorAll('[data-style-btn]'), function (b) {
          b.classList.toggle('admin-btn-primary', b.getAttribute('data-style-btn') === curStyle);
        });
        if (img) {
          var u = portraitUrl(c, curStyle);
          if (u) img.src = u;
        }
      }

      var name = esc(c.displayName || c.slug || 'Correspondent');
      var card = h(
        '<div class="admin-queue-card">' +
          '<div class="admin-queue-card-content">' +
            '<div style="text-align:center;margin-bottom:10px;">' +
              '<img data-portrait alt="' + name + ' portrait" style="width:120px;height:120px;border-radius:16px;object-fit:cover;border:2px solid ' + esc(accent) + ';"/>' +
            '</div>' +
            '<div class="row-actions" data-style-switch style="justify-content:center;margin-bottom:10px;"></div>' +
            '<div class="admin-queue-card-meta" style="margin-bottom:10px;">' +
              '<span class="admin-queue-card-channel" style="color:' + esc(accent) + '">' +
                (c.avatarEmoji ? esc(c.avatarEmoji) + ' ' : '') + esc(c.channel || '') +
              '</span>' +
              '<span class="pill ' + esc(c.status || 'active') + '">' + esc(c.status || 'active') + '</span>' +
            '</div>' +
            '<label style="display:block;margin:0 0 10px 0;"><span style="font-weight:700;font-size:0.85rem;">Name</span>' +
              '<input type="text" data-f="displayName" value="' + name + '" style="width:100%;margin-top:4px;"/></label>' +
            '<label style="display:block;margin:0 0 10px 0;"><span style="font-weight:700;font-size:0.85rem;">Kid bio</span>' +
              '<textarea data-f="kidBio" rows="3" style="width:100%;margin-top:4px;">' + esc(c.kidBio || '') + '</textarea></label>' +
            '<label style="display:block;margin:0 0 10px 0;"><span style="font-weight:700;font-size:0.85rem;">Fun fact</span>' +
              '<input type="text" data-f="funFact" value="' + esc(c.funFact || '') + '" style="width:100%;margin-top:4px;"/></label>' +
            '<div data-uploads style="border-top:1px solid var(--border);padding-top:10px;"></div>' +
          '</div>' +
          '<div class="admin-queue-card-actions">' +
            '<button class="admin-btn admin-btn-sm admin-btn-primary" data-save style="width:100%">Save changes</button>' +
          '</div>' +
        '</div>'
      );

      img = card.querySelector('[data-portrait]');

      // Style preview switcher: swaps the img src client-side, no server call
      var sw = card.querySelector('[data-style-switch]');
      PORTRAIT_STYLES.forEach(function (ps) {
        var b = h('<button class="admin-btn admin-btn-sm">' + ps[2] + ' ' + ps[1] + '</button>');
        b.setAttribute('data-style-btn', ps[0]);
        b.addEventListener('click', function () { curStyle = ps[0]; paintSwitch(); });
        sw.appendChild(b);
      });

      // Per-style portrait uploads
      var ups = card.querySelector('[data-uploads]');
      PORTRAIT_STYLES.forEach(function (ps) {
        var w = h(
          '<label style="display:block;margin:0 0 8px 0;">' +
            '<span style="font-weight:700;font-size:0.8rem;">Replace ' + ps[1] + ' portrait</span>' +
            '<input type="file" accept="image/*" data-upload="' + ps[0] + '" style="width:100%;margin-top:4px;font-size:0.85rem;"/>' +
          '</label>'
        );
        var input = w.querySelector('input');
        input.addEventListener('change', function () {
          var file = input.files && input.files[0];
          if (!file) return;
          if (file.type.indexOf('image/') !== 0) {
            toast('Please choose an image file (PNG, JPG, …).', true);
            input.value = '';
            return;
          }
          var reader = new FileReader();
          reader.onload = function () {
            api('/admin/correspondents/' + encodeURIComponent(c.slug) + '/portrait', {
              method: 'POST',
              body: { style: ps[0], base64: reader.result }
            }).then(function (res) {
              var url = (res && res.url) || portraitUrl(c, ps[0]);
              c.portraits = c.portraits || {};
              c.portraits[ps[0]] = url;
              if (url && ps[0] === curStyle && img) {
                img.src = url + (url.indexOf('?') > -1 ? '&' : '?') + 't=' + Date.now();
              }
              input.value = '';
              toast(ps[1] + ' portrait updated');
            }).catch(function (e) {
              input.value = '';
              toast(e.message, true);
            });
          };
          reader.onerror = function () {
            input.value = '';
            toast('Could not read that file.', true);
          };
          reader.readAsDataURL(file);
        });
        ups.appendChild(w);
      });

      // Save
      card.querySelector('[data-save]').addEventListener('click', function () {
        var body = {};
        card.querySelectorAll('[data-f]').forEach(function (el) {
          body[el.getAttribute('data-f')] = el.value;
        });
        if (!body.displayName || !body.displayName.trim()) {
          toast('Name cannot be empty.', true);
          return;
        }
        api('/admin/correspondents/' + encodeURIComponent(c.slug), {
          method: 'PATCH',
          body: body
        }).then(function () {
          c.displayName = body.displayName;
          c.kidBio = body.kidBio;
          c.funFact = body.funFact;
          toast('Correspondent updated');
        }).catch(function (e) { toast(e.message, true); });
      });

      paintSwitch();
      return card;
    }

    load();
  };

  // ---------- Shared helpers ----------
  function ensureStaff() {
    if (State.staff && State.staff.length) return Promise.resolve(State.staff);
    return api('/admin/staff').then(function (r) { State.staff = r.staff || []; return State.staff; });
  }
  function staffName(id) {
    var s = (State.staff || []).find(function (x) { return x.id === id; });
    return s ? s.displayName : '#' + id;
  }
  function errView(err) {
    main.innerHTML = '<div class="admin-empty">Could not load this view.<br><small>' + esc(err && err.message) + '</small></div>';
  }

  boot();
})();
