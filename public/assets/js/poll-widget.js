/* Skynet Nexus — Weekend Lab poll widget.
 * Renders on the homepage (compact card) and weekend-lab.html (full widget)
 * wherever a #poll-widget-mount element exists. Standalone: no app.js
 * dependency, CSS injected below. Votes are private (counts only). */
(function () {
  'use strict';

  var MAX_VOTES = 3;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function injectCss() {
    if (document.getElementById('poll-widget-css')) return;
    var css =
      '.pw-card{background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:20px 22px;margin:18px 0}' +
      '.pw-kicker{font-size:.7rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-mute);margin-bottom:6px}' +
      '.pw-title{margin:0 0 4px;font-size:1.25rem}' +
      '.pw-sub{color:var(--text-dim);font-size:.9rem;margin:0 0 14px;line-height:1.5}' +
      '.pw-opt{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--border);border-radius:12px;margin-bottom:10px;cursor:pointer;transition:border-color .15s}' +
      '.pw-opt:hover{border-color:var(--accent)}' +
      '.pw-opt.sel{border-color:var(--accent);background:rgba(0,229,255,.06)}' +
      '.pw-opt input{margin-top:4px;accent-color:#00e5ff;transform:scale(1.2)}' +
      '.pw-emoji{font-size:1.6rem;flex-shrink:0}' +
      '.pw-opt-body{flex:1;min-width:0}' +
      '.pw-opt-label{font-weight:700;font-size:.98rem}' +
      '.pw-opt-desc{color:var(--text-dim);font-size:.87rem;line-height:1.5;margin-top:2px}' +
      '.pw-story{font-size:.78rem;margin-top:6px;color:var(--text-mute)}' +
      '.pw-story a{color:var(--accent);text-decoration:none}' +
      '.pw-story a:hover{text-decoration:underline}' +
      '.pw-actions{display:flex;align-items:center;gap:12px;margin-top:6px;flex-wrap:wrap}' +
      '.pw-btn{background:linear-gradient(90deg,#00e5ff,#a855f7);border:0;border-radius:10px;color:#06121f;font-weight:800;padding:10px 22px;font-size:.95rem;cursor:pointer}' +
      '.pw-btn:disabled{opacity:.5;cursor:default}' +
      '.pw-count{font-size:.82rem;color:var(--text-mute)}' +
      '.pw-err{color:#ff7b7b;font-size:.85rem;margin-top:8px}' +
      '.pw-bar-row{margin-bottom:10px}' +
      '.pw-bar-top{display:flex;justify-content:space-between;font-size:.88rem;margin-bottom:4px;gap:8px}' +
      '.pw-bar-top .n{color:var(--text-mute);flex-shrink:0}' +
      '.pw-track{height:10px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}' +
      '.pw-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#00e5ff,#a855f7);transition:width .4s ease}' +
      '.pw-winner{font-size:.75rem;font-weight:800;color:#ffd54a;margin-left:6px}' +
      '.pw-login{margin-top:10px;font-size:.9rem;color:var(--text-dim)}' +
      '.pw-login a{color:var(--accent);font-weight:700}' +
      '.pw-note{font-size:.78rem;color:var(--text-mute);margin-top:10px}';
    var st = document.createElement('style');
    st.id = 'poll-widget-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function storyLink(articleId, manifest) {
    if (!articleId || !manifest) return '';
    var a = null;
    for (var i = 0; i < manifest.length; i++) {
      if (manifest[i].id === articleId) { a = manifest[i]; break; }
    }
    if (!a) return '';
    var base = location.pathname.indexOf('/pages/') !== -1 ? '../' : '';
    return '<div class="pw-story">From the story: <a href="' + base + 'pages/article.html?id=' +
      encodeURIComponent(a.id) + '">' + esc(a.title) + '</a></div>';
  }

  function renderResults(mount, data, manifest, opts) {
    var total = 0, max = 0;
    data.options.forEach(function (o) { total += o.votes; if (o.votes > max) max = o.votes; });
    var sorted = data.options.slice().sort(function (a, b) { return b.votes - a.votes; });
    var rows = sorted.map(function (o, i) {
      var pct = max > 0 ? Math.round((o.votes / max) * 100) : 0;
      return '<div class="pw-bar-row">' +
        '<div class="pw-bar-top"><span>' + esc(o.emoji) + ' <strong>' + esc(o.label) + '</strong>' +
        (i === 0 && o.votes > 0 ? '<span class="pw-winner">★ leading</span>' : '') +
        '</span><span class="n">' + o.votes + ' vote' + (o.votes === 1 ? '' : 's') + '</span></div>' +
        '<div class="pw-track"><div class="pw-fill" style="width:' + pct + '%"></div></div>' +
        '</div>';
    }).join('');
    mount.innerHTML =
      '<div class="pw-card">' +
      '<div class="pw-kicker">🗳️ Weekend Lab vote</div>' +
      '<h2 class="pw-title">' + esc(data.poll.title) + '</h2>' +
      '<p class="pw-sub">' + (opts.voted
        ? 'Thanks for voting! Here\'s how it\'s going — winners become Saturday\'s activities.'
        : 'Here\'s how the vote is going.') + '</p>' +
      rows +
      (opts.note ? '<div class="pw-note">' + esc(opts.note) + '</div>' : '') +
      '</div>';
  }

  function renderVoting(mount, data, manifest, user, opts) {
    var sel = {};
    var cards = data.options.map(function (o) {
      var id = 'pw-opt-' + o.id;
      return '<label class="pw-opt" data-oid="' + o.id + '">' +
        '<input type="checkbox" id="' + id + '" value="' + o.id + '">' +
        '<span class="pw-emoji">' + esc(o.emoji) + '</span>' +
        '<span class="pw-opt-body"><span class="pw-opt-label">' + esc(o.label) + '</span>' +
        '<div class="pw-opt-desc">' + esc(o.description) + '</div>' +
        storyLink(o.article_id, manifest) + '</span></label>';
    }).join('');
    mount.innerHTML =
      '<div class="pw-card">' +
      '<div class="pw-kicker">🗳️ Weekend Lab vote</div>' +
      '<h2 class="pw-title">' + esc(data.poll.title) + '</h2>' +
      '<p class="pw-sub">Pick up to ' + MAX_VOTES + ' activities you\'d love to try — the winners become this Saturday\'s Weekend Lab!</p>' +
      '<div id="pw-options">' + cards + '</div>' +
      '<div class="pw-actions"><button type="button" class="pw-btn" id="pw-vote-btn">Vote</button>' +
      '<span class="pw-count" id="pw-count">0 of ' + MAX_VOTES + ' picked</span></div>' +
      '<div class="pw-err" id="pw-err" hidden></div>' +
      (opts.note ? '<div class="pw-note">' + esc(opts.note) + '</div>' : '') +
      '</div>';

    var btn = mount.querySelector('#pw-vote-btn');
    var countEl = mount.querySelector('#pw-count');
    var errEl = mount.querySelector('#pw-err');
    mount.querySelectorAll('.pw-opt input').forEach(function (box) {
      box.addEventListener('change', function () {
        var checked = mount.querySelectorAll('.pw-opt input:checked');
        if (checked.length > MAX_VOTES) { box.checked = false; checked = mount.querySelectorAll('.pw-opt input:checked'); }
        box.closest('.pw-opt').classList.toggle('sel', box.checked);
        countEl.textContent = checked.length + ' of ' + MAX_VOTES + ' picked';
      });
    });
    btn.addEventListener('click', function () {
      var picked = Array.prototype.map.call(
        mount.querySelectorAll('.pw-opt input:checked'), function (b) { return Number(b.value); });
      errEl.hidden = true;
      if (!picked.length) { errEl.textContent = 'Pick at least one activity first!'; errEl.hidden = false; return; }
      btn.disabled = true;
      fetch('/api/polls/' + data.poll.id + '/vote', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIds: picked }),
      }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.d.error || 'Vote failed');
          renderResults(mount, res.d, manifest, { voted: true, note: opts.note });
        })
        .catch(function (e) { errEl.textContent = e.message; errEl.hidden = false; btn.disabled = false; });
    });
  }

  function boot() {
    var mounts = document.querySelectorAll('[data-poll-mount]');
    if (!mounts.length) return;
    injectCss();
    var isLabPage = location.pathname.indexOf('weekend-lab') !== -1;
    var note = isLabPage ? 'Voting closes Saturday 6:00 AM ET — winners become this weekend\'s Lab.' : null;

    Promise.all([
      fetch('/api/polls/current', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).catch(function () { return {}; }),
      fetch('/api/auth/me', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).catch(function () { return {}; }),
      fetch('/api/manifest', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).catch(function () { return {}; }),
    ]).then(function (res) {
      var data = res[0];
      var me = res[1] && res[1].user ? res[1].user : null;
      var manifest = (res[2] && res[2].articles) || [];
      if (!data || !data.poll) return; // no open poll: stay hidden
      mounts.forEach(function (mount) {
        var voted = data.votedOptionIds && data.votedOptionIds.length > 0;
        if (voted) {
          renderResults(mount, data, manifest, { voted: true, note: note });
        } else if (me) {
          renderVoting(mount, data, manifest, me, { note: note });
        } else {
          // Logged out: show options + login prompt, no voting.
          var cards = data.options.map(function (o) {
            return '<div class="pw-opt" style="cursor:default">' +
              '<span class="pw-emoji">' + esc(o.emoji) + '</span>' +
              '<span class="pw-opt-body"><span class="pw-opt-label">' + esc(o.label) + '</span>' +
              '<div class="pw-opt-desc">' + esc(o.description) + '</div>' +
              storyLink(o.article_id, manifest) + '</span></div>';
          }).join('');
          mount.innerHTML =
            '<div class="pw-card"><div class="pw-kicker">🗳️ Weekend Lab vote</div>' +
            '<h2 class="pw-title">' + esc(data.poll.title) + '</h2>' +
            '<p class="pw-sub">Vote for the activities you want in this Saturday\'s Weekend Lab!</p>' +
            cards +
            '<div class="pw-login"><a href="/pages/login.html">Log in</a> to cast your vote (up to ' + MAX_VOTES + ').</div>' +
            (note ? '<div class="pw-note">' + esc(note) + '</div>' : '') + '</div>';
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
