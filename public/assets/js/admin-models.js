/* ============================================================
   Skynet Nexus News — Admin Portal: AR Satellite Lab model queue
   Moderation view for kid-uploaded 3D satellite models.
   Vanilla JS, no dependencies. three.js (vendored r160, same as
   the Space Center) is lazy-loaded via dynamic import only when
   this view first opens.

   Auth: same session-cookie pattern as the rest of the console
   (fetch with credentials:'same-origin' against /api/admin/*).

   The module auto-wires the nav item
   <button class="admin-nav-link" data-view="models"> — no change
   to admin.js is needed (its Views registry is IIFE-closed, so we
   intercept the nav click in the capture phase before its handler).
   ============================================================ */
(function () {
  'use strict';

  /* ---------- endpoints ---------- */
  var E = {
    pending: '/api/admin/models/pending',
    file: function (id) { return '/api/admin/models/pending/' + encodeURIComponent(id) + '/file'; },
    approve: function (id) { return '/api/admin/models/' + encodeURIComponent(id) + '/approve'; },
    reject: function (id) { return '/api/admin/models/' + encodeURIComponent(id) + '/reject'; }
  };

  /* ---------- session-auth fetch (same pattern as admin.js api()) ---------- */
  function sessionApi(path, opts) {
    opts = opts || {};
    return fetch('/api' + path, {
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
  var api = sessionApi; // set by init()

  function fetchBytes(path) {
    return fetch('/api' + path, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) {
        var err = new Error('Preview fetch failed (' + res.status + ')');
        err.status = res.status;
        throw err;
      }
      return res.arrayBuffer();
    });
  }

  /* ---------- small helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso.indexOf('T') > -1 ? iso : String(iso).replace(' ', 'T') + 'Z');
    if (isNaN(d)) return esc(iso);
    var diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function fmtSize(bytes) {
    var n = Number(bytes);
    if (!isFinite(n) || n < 0) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
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
  function setBadge(n) {
    var el = document.getElementById('nav-badge-models');
    if (!el) return;
    if (n && n > 0) { el.textContent = n; el.hidden = false; } else { el.hidden = true; }
  }

  /* ---------- one-time scoped styles ---------- */
  var stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var css =
      '.amq-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(430px,1fr));gap:16px}' +
      '.amq-card{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;overflow:hidden;display:flex;gap:0;transition:border-color .18s,opacity .3s}' +
      '.amq-card:hover{border-color:var(--accent)}' +
      '.amq-card.amq-done{opacity:.45;pointer-events:none}' +
      '.amq-prev{flex:0 0 220px;width:220px;height:220px;background:#04070f;position:relative;display:flex;align-items:center;justify-content:center}' +
      '.amq-prev canvas{width:220px;height:220px;display:block}' +
      '.amq-prev .amq-ph{padding:18px;text-align:center;color:var(--text-mute);font-size:.78rem;line-height:1.6}' +
      '.amq-prev .amq-ph .big{font-size:1.6rem;display:block;margin-bottom:6px}' +
      '.amq-body{flex:1;min-width:0;padding:14px 16px;display:flex;flex-direction:column;gap:6px}' +
      '.amq-title{margin:0;font-size:1rem;font-weight:800;color:var(--text);word-break:break-word;line-height:1.3}' +
      '.amq-meta{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:.76rem;color:var(--text-dim)}' +
      '.amq-meta b{color:var(--text);font-weight:700}' +
      '.amq-meta .mono{font-family:"JetBrains Mono",monospace;font-size:.72rem}' +
      '.amq-actions{margin-top:auto;padding-top:10px;display:flex;gap:8px}' +
      '.amq-note{font-size:.8rem;color:var(--text-dim);background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.18);border-radius:10px;padding:10px 14px;margin-bottom:16px;line-height:1.55}' +
      '@media (max-width:560px){.amq-card{flex-direction:column}.amq-prev{flex:none;width:100%;height:200px}.amq-prev canvas{width:100%;height:200px}}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- lazy three.js (vendored r160, same files as Space Center) ---------- */
  var threeMod = null;
  function loadThree() {
    if (threeMod) return Promise.resolve(threeMod);
    // importmap on admin.html maps "three" and "three/addons/" to /vendor/three/
    return Promise.all([import('three'), import('three/addons/loaders/GLTFLoader.js')])
      .then(function (mods) {
        threeMod = { THREE: mods[0], GLTFLoader: mods[1].GLTFLoader };
        return threeMod;
      });
  }

  /* ---------- 3D preview: one small scene per card, shared rAF loop ---------- */
  var previews = new Set();
  var rafId = 0;
  function tick() {
    rafId = 0;
    previews.forEach(function (p) {
      try {
        if (p.spin) p.spin.rotation.y += 0.012;
        p.renderer.render(p.scene, p.camera);
      } catch (e) { /* keep other previews alive */ }
    });
    if (previews.size) rafId = requestAnimationFrame(tick);
  }
  function kick() {
    if (!rafId && previews.size) rafId = requestAnimationFrame(tick);
  }

  function placeholderHtml(icon, line1, line2) {
    return '<div class="amq-ph"><span class="big">' + icon + '</span>' + esc(line1) +
      (line2 ? '<br><span style="opacity:.75">' + esc(line2) + '</span>' : '') + '</div>';
  }

  // Builds the ~220px preview inside prevEl. Never throws.
  function buildPreview(prevEl, model, T) {
    var THREE = T.THREE, GLTFLoader = T.GLTFLoader;
    prevEl.innerHTML = placeholderHtml('…', 'Loading 3D preview…');
    fetchBytes(E.file(model.id)).then(function (buf) {
      return new Promise(function (resolve, reject) {
        try {
          new GLTFLoader().parse(buf, '', resolve, reject);
        } catch (e) { reject(e); }
      });
    }).then(function (gltf) {
      var canvas = document.createElement('canvas');
      prevEl.innerHTML = '';
      prevEl.appendChild(canvas);
      var W = 220, H = 220;
      var renderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      } catch (e) {
        prevEl.innerHTML = placeholderHtml('!', 'WebGL unavailable', 'Model metadata is fine — review by name.');
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, H, false);
      if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(38, W / H, 0.01, 100);
      camera.position.set(0, 0.9, 3.1);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.HemisphereLight(0xcfeaff, 0x140f2a, 1.25));
      var key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2.5, 3.5, 4); scene.add(key);
      var rim = new THREE.DirectionalLight(0x00e5ff, 1.6); rim.position.set(-3, 1, -2.5); scene.add(rim);

      // Normalize: fit longest dimension to ~2 units, recenter on origin
      var inner = new THREE.Group();
      try {
        var box = new THREE.Box3().setFromObject(gltf.scene);
        var size = new THREE.Vector3(); box.getSize(size);
        var center = new THREE.Vector3(); box.getCenter(center);
        var maxDim = Math.max(size.x, size.y, size.z) || 1;
        var s = 2 / maxDim;
        gltf.scene.scale.setScalar(s);
        gltf.scene.position.copy(center).multiplyScalar(-s);
      } catch (e) { /* show as-is */ }
      inner.add(gltf.scene);
      var spin = new THREE.Group();
      spin.add(inner);
      scene.add(spin);

      var pv = { renderer: renderer, scene: scene, camera: camera, spin: spin };
      canvas._amqPreview = pv;
      previews.add(pv);
      kick();
      try { renderer.render(scene, camera); } catch (e) {}
    }).catch(function (err) {
      if (err && err.status === 404) {
        prevEl.innerHTML = placeholderHtml('◎', 'Preview available after approval', 'Pending files are not publicly served.');
      } else {
        prevEl.innerHTML = placeholderHtml('!', 'Preview failed to load', 'Model metadata is fine — review by name.');
      }
    });
  }

  function disposePreviews(root) {
    var nodes = root.querySelectorAll('canvas');
    Array.prototype.forEach.call(nodes, function (c) {
      var pv = c._amqPreview;
      if (!pv) return;
      previews.delete(pv);
      try {
        pv.scene.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            var ms = Array.isArray(o.material) ? o.material : [o.material];
            ms.forEach(function (m) {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          }
        });
        pv.renderer.dispose();
      } catch (e) {}
    });
  }

  /* ---------- row rendering ---------- */
  function renderCard(model) {
    var card = document.createElement('div');
    card.className = 'amq-card';
    card.setAttribute('data-model-id', String(model.id));

    var submitted = model.submittedAt || model.createdAt || model.submitted_at || model.created_at;

    card.innerHTML =
      '<div class="amq-prev"></div>' +
      '<div class="amq-body">' +
        '<h3 class="amq-title">' + esc(model.name || '(untitled model)') + '</h3>' +
        '<div class="amq-meta">' +
          '<span class="pill">' + esc(model.category || 'uncategorized') + '</span>' +
        '</div>' +
        '<div class="amq-meta">' +
          '<span>For satellite <b class="mono">' + esc(model.satelliteId || model.satellite_id || '—') + '</b></span>' +
        '</div>' +
        '<div class="amq-meta">' +
          '<span>By <b>' + esc(model.creatorHandle || model.creator_handle || model.creator || 'anonymous') + '</b></span>' +
          '<span>· ' + esc(fmtDate(submitted)) + '</span>' +
          '<span>· <b class="mono">' + esc(fmtSize(model.fileSize || model.file_size || model.size)) + '</b></span>' +
        '</div>' +
        (model.notes ? '<div class="amq-meta"><span>"' + esc(model.notes) + '"</span></div>' : '') +
        '<div class="amq-actions">' +
          '<button class="admin-btn admin-btn-sm admin-btn-primary amq-approve">Approve</button>' +
          '<button class="admin-btn admin-btn-sm admin-btn-danger amq-reject">Reject</button>' +
        '</div>' +
      '</div>';

    var prevEl = card.querySelector('.amq-prev');
    loadThree()
      .then(function (T) { buildPreview(prevEl, model, T); })
      .catch(function () {
        prevEl.innerHTML = placeholderHtml('◎', 'Preview available after approval', '3D engine failed to load — review by name.');
      });

    var approveBtn = card.querySelector('.amq-approve');
    var rejectBtn = card.querySelector('.amq-reject');

    approveBtn.addEventListener('click', function () {
      approveBtn.disabled = true;
      rejectBtn.disabled = true;
      approveBtn.textContent = 'Approving…';
      api(E.approve(model.id), { method: 'POST', body: {} }).then(function () {
        toast('Model approved — it will appear in the AR Satellite Lab');
        card.classList.add('amq-done');
        approveBtn.textContent = 'Approved';
        setTimeout(function () {
          disposePreviews(card);
          card.remove();
          afterRowRemoved();
        }, 900);
      }).catch(function (err) {
        approveBtn.disabled = false;
        rejectBtn.disabled = false;
        approveBtn.textContent = 'Approve';
        toast('Approve failed: ' + (err.message || 'unknown error'), true);
      });
    });

    // Two-step inline confirm (no native prompt/confirm)
    var rejectArmed = false, rejectTimer = 0;
    function disarmReject() {
      rejectArmed = false;
      clearTimeout(rejectTimer);
      rejectBtn.textContent = 'Reject';
      rejectBtn.classList.remove('admin-btn-primary');
    }
    rejectBtn.addEventListener('click', function () {
      if (!rejectArmed) {
        rejectArmed = true;
        rejectBtn.textContent = 'Click again to reject';
        rejectBtn.classList.add('admin-btn-primary');
        rejectTimer = setTimeout(disarmReject, 5000);
        return;
      }
      clearTimeout(rejectTimer);
      approveBtn.disabled = true;
      rejectBtn.disabled = true;
      rejectBtn.textContent = 'Rejecting…';
      api(E.reject(model.id), { method: 'POST', body: {} }).then(function () {
        toast('Model rejected — removed from the review queue');
        card.classList.add('amq-done');
        setTimeout(function () {
          disposePreviews(card);
          card.remove();
          afterRowRemoved();
        }, 900);
      }).catch(function (err) {
        approveBtn.disabled = false;
        rejectBtn.disabled = false;
        disarmReject();
        toast('Reject failed: ' + (err.message || 'unknown error'), true);
      });
    });

    return card;
  }

  function afterRowRemoved() {
    var grid = document.getElementById('amq-grid');
    var main = document.getElementById('admin-main');
    if (grid && !grid.children.length && main) renderEmpty(main);
    var badge = document.getElementById('nav-badge-models');
    var n = badge && !badge.hidden ? (parseInt(badge.textContent, 10) || 1) - 1 : 0;
    setBadge(n);
  }

  function renderEmpty(main) {
    setBadge(0);
    main.innerHTML =
      '<div class="admin-view-head"><h1>3D Models</h1>' +
      '<p>Review kid-uploaded satellite models for the AR Satellite Lab. Nothing approved shows up for young readers until you approve it here.</p></div>' +
      '<div class="admin-empty">No models waiting for review.</div>';
  }

  /* ---------- the view ---------- */
  function renderView(main) {
    injectStyles();
    main.innerHTML =
      '<div class="admin-view-head"><h1>3D Models</h1>' +
      '<p>Review kid-uploaded satellite models for the AR Satellite Lab. Nothing approved shows up for young readers until you approve it here.</p></div>' +
      '<div class="admin-loading">Loading pending models…</div>';

    api(E.pending).then(function (r) {
      var models = (r && (r.models || r.items || r.pending)) || [];
      main.innerHTML =
        '<div class="admin-view-head"><h1>3D Models</h1>' +
        '<p>Review kid-uploaded satellite models for the AR Satellite Lab. Nothing approved shows up for young readers until you approve it here.</p></div>';
      if (!models.length) { renderEmpty(main); return; }
      setBadge(models.length);
      var grid = document.createElement('div');
      grid.className = 'amq-grid';
      grid.id = 'amq-grid';
      models.forEach(function (m) {
        try { grid.appendChild(renderCard(m)); } catch (e) { /* skip one bad row */ }
      });
      main.appendChild(grid);
    }).catch(function (err) {
      if (err && (err.status === 404 || err.status === 501)) {
        main.innerHTML =
          '<div class="admin-view-head"><h1>3D Models</h1>' +
          '<p>Review kid-uploaded satellite models for the AR Satellite Lab.</p></div>' +
          '<div class="admin-inline-note" style="border-color:rgba(255,176,32,.4)">' +
          'The model-moderation API is not deployed yet (<code>GET /api/admin/models/pending</code> returned ' +
          esc(String(err.status)) + '). The queue will light up automatically once the backend ships the endpoints.' +
          '</div>' +
          '<div class="admin-empty">No models waiting for review.</div>';
        return;
      }
      main.innerHTML =
        '<div class="admin-view-head"><h1>3D Models</h1>' +
        '<p>Review kid-uploaded satellite models for the AR Satellite Lab.</p></div>' +
        '<div class="admin-empty">Could not load the model queue.<br><small>' + esc(err && err.message) + '</small><br><br>' +
        '<button class="admin-btn admin-btn-sm" id="amq-retry">Try again</button></div>';
      var rb = document.getElementById('amq-retry');
      if (rb) rb.addEventListener('click', function () { renderView(main); });
    });
  }

  /* ---------- nav wiring: intercept before admin.js's own handler ----------
     admin.js keeps its Views registry inside an IIFE, so a new view cannot be
     registered from outside. Instead we catch clicks on
     .admin-nav-link[data-view="models"] in the capture phase and stop them
     before admin.js's bubble-phase listener on #admin-nav can render
     "Unknown view." — no edit to admin.js required. */
  var navWired = false;
  function wireNav() {
    if (navWired) return;
    navWired = true;
    document.addEventListener('click', function (e) {
      var t = e.target;
      var btn = t && t.closest ? t.closest('.admin-nav-link[data-view="models"]') : null;
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var nav = document.getElementById('admin-nav');
      if (nav) {
        Array.prototype.forEach.call(nav.querySelectorAll('.admin-nav-link'), function (b) {
          b.classList.toggle('active', b === btn);
        });
        nav.classList.remove('open'); // close mobile menu, like admin.js navTo()
      }
      var main = document.getElementById('admin-main');
      if (main) renderView(main);
    }, true);
  }

  /* ---------- public API ---------- */
  window.AdminModels = {
    // init(containerEl, apiFetch?) — apiFetch is an optional (path, opts) =>
    // Promise<json> helper. Defaults to the console's session-cookie pattern.
    init: function (containerEl, apiFetch) {
      if (typeof apiFetch === 'function') api = apiFetch;
      injectStyles();
      wireNav();
      var main = containerEl || document.getElementById('admin-main');
      if (main) renderView(main);
      return window.AdminModels;
    },
    refresh: function () {
      var main = document.getElementById('admin-main');
      if (main) renderView(main);
    },
    endpoints: E
  };

  // Auto-wire when the script loads (it is included at the end of admin.html,
  // after the nav markup exists).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireNav);
  } else {
    wireNav();
  }
})();
