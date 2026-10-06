// ---------- Skynet Nexus: server-backed article engagement ----------
// Thumbs up/down + moderated article comments, backed by the /api/articles
// endpoints. Takes over the toolbar buttons rendered by app.js (which were
// localStorage-only) via clone-replace, so no app.js changes are needed.
//
// Kid-safety model (enforced server-side):
// - Kid comments start 'pending', visible only to their family until approved.
// - Kid first names never appear on the shared list ("a young reader").
// - Approve/Reject is limited to the parent of the authoring kid (or admin).
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var ARTICLE_ID = params.get('id');
  if (!ARTICLE_ID) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) {
    n = Number(n) || 0;
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }
  function toast(msg) {
    if (typeof window.toast === 'function') { try { window.toast(msg); return; } catch (e) {} }
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:10px 16px;border-radius:8px;z-index:9999;font-size:.9rem';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }
  function activeKid() {
    try {
      if (window.SkyAuth && typeof window.SkyAuth.getActiveKid === 'function') return window.SkyAuth.getActiveKid();
    } catch (e) {}
    return null;
  }
  function api(path, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    return fetch(path, opts).then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; })
        .catch(function () { return { ok: r.ok, status: r.status, data: {} }; });
    });
  }
  // Replace a button with a clean clone (drops app.js's localStorage listeners).
  function takeOver(id) {
    var el = document.getElementById(id);
    if (!el || el.dataset.engaged) return null;
    var clone = el.cloneNode(true);
    clone.dataset.engaged = '1';
    el.replaceWith(clone);
    return clone;
  }

  // ---------------- Reactions ----------------
  function paintReactions(d) {
    var up = document.getElementById('btn-thumbs-up');
    var down = document.getElementById('btn-thumbs-down');
    if (up) {
      var c = up.querySelector('.cnt'); if (c) c.textContent = fmt(d.up);
      up.classList.toggle('active', d.mine === 'up');
    }
    if (down) {
      var c2 = down.querySelector('.cnt'); if (c2) c2.textContent = fmt(d.down);
      down.classList.toggle('active-dislike', d.mine === 'down');
    }
  }
  function react(which) {
    var k = activeKid();
    var up = document.getElementById('btn-thumbs-up');
    var down = document.getElementById('btn-thumbs-down');
    var current = up && up.classList.contains('active') ? 'up'
      : (down && down.classList.contains('active-dislike') ? 'down' : null);
    var next = current === which ? 'none' : which;
    api('/api/articles/' + encodeURIComponent(ARTICLE_ID) + '/react', {
      method: 'POST',
      body: JSON.stringify({ reaction: next, kid_id: k ? k.id : null })
    }).then(function (res) {
      if (res.ok) {
        paintReactions(res.data);
        toast(next === 'none' ? 'Reaction removed' : (next === 'up' ? 'Thumbs up!' : 'Thumbs down!'));
      } else if (res.status === 401) {
        toast('Log in to react');
      } else {
        toast('\u26A0\uFE0F ' + (res.data.error || 'Could not react'));
      }
    }).catch(function () { toast('\u26A0\uFE0F Could not reach the server'); });
  }
  function wireReactions() {
    var up = takeOver('btn-thumbs-up');
    var down = takeOver('btn-thumbs-down');
    if (!up || !down) return false;
    up.addEventListener('click', function () { react('up'); });
    down.addEventListener('click', function () { react('down'); });
    // Hydrate live counts + my vote.
    var k = activeKid();
    api('/api/articles/' + encodeURIComponent(ARTICLE_ID) + '/reactions' + (k ? '?kid_id=' + k.id : ''))
      .then(function (res) { if (res.ok) paintReactions(res.data); })
      .catch(function () {});
    return true;
  }

  // ---------------- Comments ----------------
  var serverComments = null;
  var canModerate = false;
  function paintComments() {
    var cl = document.getElementById('comment-list');
    if (!cl) return;
    var list = serverComments || [];
    var approved = list.filter(function (c) { return c.status === 'approved'; }).length;
    document.querySelectorAll('#btn-comment .cnt, .comments .count').forEach(function (el) {
      el.textContent = fmt(approved);
    });
    if (!list.length) {
      cl.innerHTML = '<div class="comment-empty" style="color:var(--text-mute);padding:16px 4px;font-size:.9rem">' +
        (serverComments === null
          ? '<a href="/pages/profile.html">Log in</a> to join the conversation.'
          : 'No comments yet \u2014 be the first to share a kind, on-topic thought.') + '</div>';
      return;
    }
    cl.innerHTML = list.map(function (c) {
      var av = c.author.type === 'kid'
        ? '<div class="author-avatar">' + esc(c.author.emoji || '\u{1F31F}') + '</div>'
        : '<div class="author-avatar">' + esc((c.author.name || 'G').charAt(0).toUpperCase()) + '</div>';
      var note = c.status === 'pending'
        ? '<div class="comment-pending">\u23F3 Waiting for parent approval' +
          (canModerate
            ? ' <button data-approve="' + c.id + '">Approve</button>' +
              '<button data-reject="' + c.id + '">Reject</button>'
            : '') + '</div>'
        : '';
      return '<div class="comment">' + av +
        '<div class="comment-body">' +
          '<div class="comment-head"><strong>' + esc(c.author.name) + '</strong>' +
          '<span class="time">' + esc((c.createdAt || '').slice(0, 10)) + '</span></div>' +
          '<div class="comment-text">' + esc(c.body) + '</div>' + note +
        '</div></div>';
    }).join('');
    cl.querySelectorAll('[data-approve]').forEach(function (b) {
      b.addEventListener('click', function () { moderate(b.getAttribute('data-approve'), true); });
    });
    cl.querySelectorAll('[data-reject]').forEach(function (b) {
      b.addEventListener('click', function () { moderate(b.getAttribute('data-reject'), false); });
    });
  }
  function loadComments() {
    api('/api/articles/' + encodeURIComponent(ARTICLE_ID) + '/comments').then(function (res) {
      serverComments = res.ok ? (res.data.comments || []) : null;
      paintComments();
      if (!res.ok) return;
      api('/api/comments/pending?article_id=' + encodeURIComponent(ARTICLE_ID)).then(function (p) {
        var has = !!(p.ok && p.data.comments && p.data.comments.length);
        if (has !== canModerate) { canModerate = has; paintComments(); }
      }).catch(function () {});
    }).catch(function () {
      if (serverComments === null) serverComments = [];
      paintComments();
    });
  }
  function moderate(id, approve) {
    api('/api/comments/' + id + '/' + (approve ? 'approve' : 'reject'), { method: 'POST' })
      .then(function (res) {
        toast(res.ok ? (approve ? 'Comment approved!' : 'Comment rejected.')
                     : ('\u26A0\uFE0F ' + (res.data.error || 'Not allowed')));
        if (res.ok) loadComments();
      }).catch(function () { toast('\u26A0\uFE0F Could not reach the server'); });
  }
  function wireComments() {
    var submit = takeOver('cmt-submit');
    var ta = document.getElementById('cmt-text');
    if (!submit || !ta) return false;
    // Clear app.js's localStorage-painted list; we render from the server.
    loadComments();
    submit.addEventListener('click', function () {
      var text = (ta.value || '').trim();
      if (!text) return;
      var k = activeKid();
      api('/api/articles/' + encodeURIComponent(ARTICLE_ID) + '/comments', {
        method: 'POST',
        body: JSON.stringify({ body: text, kid_id: k ? k.id : null })
      }).then(function (res) {
        if (!res.ok) {
          toast(res.status === 401 ? 'Log in to join the conversation'
                                  : ('\u26A0\uFE0F ' + (res.data.error || 'Could not post')));
          return;
        }
        ta.value = '';
        toast(res.data.status === 'pending' ? 'Sent! A parent will review it soon. \u23F3' : 'Comment posted!');
        loadComments();
      }).catch(function () { toast('\u26A0\uFE0F Could not reach the server'); });
    });
    var cbtn = document.getElementById('btn-comment');
    if (cbtn && !cbtn.dataset.engaged) {
      // Keep app.js's scroll-to-form behavior; it survives (no clone needed).
      cbtn.dataset.engaged = '1';
    }
    return true;
  }

  // Wait for app.js to render the article toolbar, then take over.
  var wired = false;
  function tryWire() {
    if (wired) return;
    if (!document.getElementById('btn-thumbs-up') || !document.getElementById('comment-list')) return;
    wired = wireReactions() && wireComments();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      tryWire();
      new MutationObserver(tryWire).observe(document.body, { childList: true, subtree: true });
      setTimeout(function () { tryWire(); }, 3000); // final sweep
    });
  } else {
    tryWire();
    new MutationObserver(tryWire).observe(document.body, { childList: true, subtree: true });
  }
})();
