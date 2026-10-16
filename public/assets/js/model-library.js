/* AR Satellite Lab — model-library.js
   Renders the model library cards (Satellites / Telescopes / Community Builds)
   from GET /api/models. Plain ES module, same style as space-center-models.js.
   Loads AFTER model-viewer-ar.js (sharing its model-list cache); exposes window.ModelLibrary. */

function esc(x) {
  return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

var CATS = [
  { key: 'satellite', label: 'SATELLITES' },
  { key: 'telescope', label: 'TELESCOPES' },
  { key: 'community', label: 'COMMUNITY BUILDS' }
];

// Inline SVG placeholder glyph (no emoji): little satellite/rocket line art.
var PLACEHOLDER_SVG =
  '<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">' +
  '<rect width="64" height="64" fill="#06121f"/>' +
  '<g stroke="#00e5ff" stroke-width="2" fill="none" opacity="0.9">' +
  '<rect x="28" y="26" width="10" height="14" rx="2"/>' +
  '<line x1="28" y1="30" x2="12" y2="22"/><line x1="28" y1="36" x2="12" y2="44"/>' +
  '<line x1="38" y1="30" x2="54" y2="22"/><line x1="38" y1="36" x2="54" y2="44"/>' +
  '<rect x="6" y="18" width="12" height="8" rx="1"/><rect x="6" y="40" width="12" height="8" rx="1"/>' +
  '<rect x="46" y="18" width="12" height="8" rx="1"/><rect x="46" y="40" width="12" height="8" rx="1"/>' +
  '<line x1="33" y1="40" x2="33" y2="46"/><circle cx="33" cy="50" r="2" fill="#00e5ff" stroke="none"/>' +
  '</g></svg>';

function thumbHtml(m) {
  if (m.thumbnailUrl) {
    return '<div class="mlab-thumb"><img src="' + esc(m.thumbnailUrl) + '" alt="" loading="lazy" onerror="this.parentNode.innerHTML=window.ModelLibrary._ph"/></div>';
  }
  return '<div class="mlab-thumb">' + PLACEHOLDER_SVG + '</div>';
}

function cardHtml(m) {
  var cat = CATS.filter(function (c) { return c.key === m.category; })[0];
  return '<div class="mlab-card" data-mid="' + esc(m.id) + '" role="button" tabindex="0">' +
    thumbHtml(m) +
    '<div class="mlab-card-body">' +
    '<div class="mlab-name">' + esc(m.name) + '</div>' +
    '<span class="mlab-badge">' + esc(cat ? cat.label : String(m.category || '').toUpperCase()) + '</span>' +
    (m.description ? '<div class="mlab-desc">' + esc(m.description) + '</div>' : '') +
    (m.creatorHandle ? '<div class="mlab-credit">Built by ' + esc(m.creatorHandle) + '</div>' : '') +
    '</div></div>';
}

function getModels() {
  // Shared fetcher lives in model-viewer-ar.js (loaded first); fall back to local.
  if (window.ModelViewerAR && window.ModelViewerAR.getModels) return window.ModelViewerAR.getModels();
  return fetch('/api/models').then(function (r) { return r.json(); }).then(function (d) {
    return Array.isArray(d) ? d : (d && d.models) || [];
  });
}

function render(container, models) {
  var byCat = {};
  models.forEach(function (m) {
    var k = m.category || 'community';
    (byCat[k] = byCat[k] || []).push(m);
  });
  var html = '';
  CATS.forEach(function (c) {
    var list = byCat[c.key] || [];
    html += '<div class="toolhead">' + c.label + ' · ' + list.length + '</div>';
    if (!list.length) {
      html += '<p class="tsub">Nothing here yet — build the first one in Creator Studio below!</p>';
    } else {
      html += '<div class="mlab-grid">' + list.map(cardHtml).join('') + '</div>';
    }
  });
  container.innerHTML = html;
  var byId = {};
  models.forEach(function (m) { byId[String(m.id)] = m; });
  container.querySelectorAll('.mlab-card').forEach(function (el) {
    var open = function () {
      var m = byId[el.getAttribute('data-mid')];
      if (m) window.ModelLibrary.openModel(m);
    };
    el.addEventListener('click', open);
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

window.ModelLibrary = {
  _ph: PLACEHOLDER_SVG,
  init: function (containerEl) {
    if (!containerEl) return;
    containerEl.innerHTML = '<p class="tsub">▸ Loading the model library…</p>';
    getModels().then(function (models) {
      render(containerEl, models);
    }).catch(function () {
      containerEl.innerHTML = '<p class="tsub">The library is waking up — check back soon, or build a model in Creator Studio below!</p>';
    });
  },
  openModel: function (model) {
    // Jump to the AR Viewer section and load the .glb there.
    var b = window.__scB;
    if (b && b.openTab) b.openTab('modellab');
    if (window.ModelViewerAR) window.ModelViewerAR.show(model);
    var v = document.getElementById('mlab-viewer');
    if (v && v.scrollIntoView) v.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },
  refresh: function (containerEl) { window.ModelLibrary.init(containerEl); }
};

/* Self-bootstrap: the wiring diff adds #mlab-library inside the Model Lab tab.
   Deferred module => DOM is ready; refresh on later tab opens is free (cached). */
(function boot() {
  var c = document.getElementById('mlab-library');
  if (c) window.ModelLibrary.init(c);
})();
