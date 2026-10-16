/* AR Satellite Lab — creator-studio.js
   Kid-safe model upload form: POSTs multipart FormData to /api/models/upload.
   No real-name fields, no prompt(). Client-side validation only;
   the server is the final gate (approval flow lives there). */

function esc(x) {
  return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

var HANDLE_RE = /^[A-Za-z0-9_]{3,20}$/;
var MAX_BYTES = 25 * 1024 * 1024;

function fleetLabel(u) {
  var b = window.__scB;
  try { if (b && b.fleetName) return b.fleetName(u.co); } catch (e) {}
  return u.co || 'SATELLITES';
}

function satelliteOptions() {
  // Live catalog from the bridge: [{id, name}]. Falls back to a small hero list
  // while the catalog is still loading (sats stream in after page load).
  var b = window.__scB, out = [];
  try {
    var byId = b && b.satById;
    if (byId) {
      Object.keys(byId).forEach(function (id) {
        var sp = byId[id], u = sp && sp.userData;
        if (u && !u.isPad && u.name) out.push({ id: String(u.id), name: u.name, fleet: fleetLabel(u) });
      });
    }
  } catch (e) {}
  if (!out.length) {
    out = [
      { id: '25544', name: 'ISS (ZARYA)', fleet: 'ISS' },
      { id: '48274', name: 'TIANGONG', fleet: 'TIANGONG' },
      { id: '20580', name: 'HST (HUBBLE)', fleet: 'HUBBLE' }
    ];
  }
  out.sort(function (a, b2) { return a.fleet === b2.fleet ? (a.name < b2.name ? -1 : 1) : (a.fleet < b2.fleet ? -1 : 1); });
  var seen = {}, html = '<option value="">Not a real satellite / original design</option>', lastFleet = null;
  out.forEach(function (s) {
    if (seen[s.id]) return; seen[s.id] = 1;
    if (s.fleet !== lastFleet) {
      if (lastFleet !== null) html += '</optgroup>';
      html += '<optgroup label="' + esc(s.fleet) + '">';
      lastFleet = s.fleet;
    }
    html += '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>';
  });
  if (lastFleet !== null) html += '</optgroup>';
  return html;
}

function formHtml() {
  return '' +
    '<p class="tsub">Built a satellite or telescope in 3D? Upload your <b>.glb</b> file here. ' +
    'A grown-up on the Skynet Nexus team reviews every model before it appears in the library — ' +
    'never use your real name.</p>' +
    '<form id="mlab-upload" novalidate>' +
    '<label class="mlab-label" for="mlab-name">Model name</label>' +
    '<input class="mlab-input" id="mlab-name" name="name" type="text" maxlength="80" required placeholder="e.g. My CubeSat"/>' +
    '<label class="mlab-label" for="mlab-cat">Category</label>' +
    '<select class="mlab-input" id="mlab-cat" name="category">' +
    '<option value="satellite">Satellite</option>' +
    '<option value="telescope">Telescope</option>' +
    '<option value="community">Community build</option>' +
    '</select>' +
    '<label class="mlab-label" for="mlab-sat">Is it a real satellite?</label>' +
    '<select class="mlab-input" id="mlab-sat" name="satelliteId"><option value="">Loading satellite catalog…</option></select>' +
    '<label class="mlab-label" for="mlab-handle">Your creator handle</label>' +
    '<input class="mlab-input" id="mlab-handle" name="creatorHandle" type="text" required ' +
    'placeholder="e.g. rocket_kid7" pattern="[A-Za-z0-9_]{3,20}" maxlength="20" autocomplete="off"/>' +
    '<div class="mlab-hintline">Letters, numbers, underscore — 3 to 20 characters. This is a nickname, not your name.</div>' +
    '<label class="mlab-label" for="mlab-file">Model file (.glb, up to 25 MB)</label>' +
    '<input class="mlab-input" id="mlab-file" name="model" type="file" accept=".glb" required/>' +
    '<div class="trow" style="margin-top:10px"><button class="tbtn" id="mlab-submit" type="submit">Upload for review</button></div>' +
    '<div id="mlab-msg" class="mlab-msg" role="status" aria-live="polite"></div>' +
    '</form>';
}

function fillPicker(form) {
  var sel = form.querySelector('#mlab-sat');
  var tries = 0;
  function fill() {
    tries++;
    var b = window.__scB, n = 0;
    try { n = b && b.satById ? Object.keys(b.satById).length : 0; } catch (e) {}
    if (n > 10 || tries > 40) {
      sel.innerHTML = satelliteOptions();
    } else {
      setTimeout(fill, 500); // catalog still streaming in — retry briefly
    }
  }
  fill();
}

function msgEl(form) { return form.querySelector('#mlab-msg'); }
function setMsg(form, text, ok) {
  var m = msgEl(form);
  m.textContent = text;
  m.className = 'mlab-msg ' + (ok ? 'ok' : 'err');
}

window.CreatorStudio = {
  init: function (containerEl) {
    if (!containerEl || containerEl.dataset.init) return;
    containerEl.dataset.init = '1';
    containerEl.innerHTML = '<div class="toolhead">CREATOR STUDIO</div>' + formHtml();
    var form = containerEl.querySelector('#mlab-upload');
    fillPicker(form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.querySelector('#mlab-name').value.trim();
      var category = form.querySelector('#mlab-cat').value;
      var satelliteId = form.querySelector('#mlab-sat').value;
      var handle = form.querySelector('#mlab-handle').value.trim();
      var file = form.querySelector('#mlab-file').files[0];
      var btn = form.querySelector('#mlab-submit');

      if (!name) { setMsg(form, 'Give your model a name first!', false); return; }
      if (!HANDLE_RE.test(handle)) { setMsg(form, 'Creator handle must be 3–20 characters: letters, numbers, underscore only.', false); return; }
      if (!file) { setMsg(form, 'Choose a .glb file to upload.', false); return; }
      if (!/\.glb$/i.test(file.name)) { setMsg(form, 'That file is not a .glb — export your model as .glb and try again.', false); return; }
      if (file.size > MAX_BYTES) { setMsg(form, 'That file is bigger than 25 MB — try a smaller model.', false); return; }

      var fd = new FormData();
      fd.append('name', name);
      fd.append('category', category);
      fd.append('creatorHandle', handle);
      if (satelliteId) fd.append('satelliteId', satelliteId);
      fd.append('model', file, file.name);

      btn.disabled = true;
      btn.textContent = 'Uploading… 0%';
      setMsg(form, '', true);

      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/models/upload', true);
      xhr.upload.onprogress = function (ev) {
        if (ev.lengthComputable) {
          var pct = Math.round(ev.loaded / ev.total * 100);
          btn.textContent = 'Uploading… ' + pct + '%';
          setMsg(form, 'Uploading… ' + pct + '%', true);
        }
      };
      xhr.onload = function () {
        btn.disabled = false; btn.textContent = 'Upload for review';
        var ok = xhr.status >= 200 && xhr.status < 300;
        if (ok) {
          form.reset();
          setMsg(form, 'Your model is waiting for review — you\'ll see it in the library once approved!', true);
        } else {
          var detail = '';
          try { detail = (JSON.parse(xhr.responseText) || {}).error || ''; } catch (e) {}
          setMsg(form, 'Upload did not go through' + (detail ? ' — ' + detail : '') + '. Try again!', false);
        }
      };
      xhr.onerror = function () {
        btn.disabled = false; btn.textContent = 'Upload for review';
        setMsg(form, 'Upload did not go through — check your connection and try again!', false);
      };
      xhr.send(fd);
    });
  }
};

/* Self-bootstrap: the wiring diff adds #mlab-studio inside the Model Lab tab.
   Deferred module => DOM is ready at execution time. */
(function boot() {
  var c = document.getElementById('mlab-studio');
  if (c) window.CreatorStudio.init(c);
})();
