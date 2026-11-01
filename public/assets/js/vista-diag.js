// Vista diagnostic (2026-11-01): gated on ?diag=1. Shows an on-screen
// readout of the Space Bay vista panels' real state on THIS machine's GPU —
// material type, texture size/colorspace, the artwork's own average color,
// a raycast for occluders, and the actual rendered pixel color sampled from
// the framebuffer at each panel's screen position. Built to find why the
// vistas render white on Jeff's GPU while rendering fine in software WebGL.
// Inert unless ?diag=1 is in the URL.
(function () {
  if (!/[?&]diag=1/.test(location.search)) return;
  var box = document.createElement('div');
  box.id = 'sc-diag';
  box.setAttribute('style', 'position:fixed;left:8px;top:8px;z-index:99999;background:rgba(2,8,16,.92);color:#9fe8ff;font:11px/1.55 ui-monospace,Menlo,Consolas,monospace;padding:10px 12px;border:1px solid #1d5f7a;border-radius:8px;max-width:min(560px,94vw);max-height:88vh;overflow:auto;white-space:pre-wrap;word-break:break-word;');
  box.textContent = 'VISTA DIAG — waiting for the bay to load…';
  document.documentElement.appendChild(box);

  function fmt(n) { return Math.round(n); }
  function rgbStr(r, g, b) { return 'rgb(' + r + ',' + g + ',' + b + ')'; }

  function texAvg(tex) {
    try {
      var img = tex && tex.image;
      if (!img) return 'no-image';
      var w = img.width || img.videoWidth || 0, h = img.height || img.videoHeight || 0;
      if (!w || !h) return 'img-0x0';
      var c = document.createElement('canvas'); c.width = 24; c.height = 24;
      var x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, 24, 24);
      var d = x.getImageData(0, 0, 24, 24).data, r = 0, g = 0, b = 0, n = 0;
      for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      return rgbStr(Math.round(r / n), Math.round(g / n), Math.round(b / n));
    } catch (e) { return 'err:' + (e && e.message ? e.message.slice(0, 40) : e); }
  }

  function build(refs) {
    var THREE = refs.THREE, renderer = refs.renderer, scene = refs.scene,
        camera = refs.camera, bayState = refs.bayState, bayGroup = refs.bayGroup;
    var out = [];
    var gl = renderer.getContext();
    var dbg = gl.getExtension('WEBGL_debug_renderer_info');
    var gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '(masked)';
    out.push('VISTA DIAG — screenshot this whole box');
    out.push('GPU: ' + gpu);
    out.push('WebGL2: ' + !!renderer.capabilities.isWebGL2 + ' | maxTex: ' + gl.getParameter(gl.MAX_TEXTURE_SIZE) + ' | pixelRatio: ' + renderer.getPixelRatio());
    out.push('toneMapping: ' + renderer.toneMapping + ' | exposure: ' + renderer.toneMappingExposure + ' | outputCS: ' + renderer.outputColorSpace);
    out.push('setLoaded: ' + bayState.setLoaded + ' | scene: ' + bayState.sceneName + ' | cam: ' + camera.position.toArray().map(fmt).join(','));
    // One fresh render, then sample the framebuffer in the same task.
    renderer.render(scene, camera);
    var db = renderer.getDrawingBufferSize(new THREE.Vector2());
    function sampleAt(worldPos) {
      try {
        var v = worldPos.clone().project(camera);
        if (v.z > 1 || v.x < -1 || v.x > 1 || v.y < -1 || v.y > 1) return 'offscreen';
        var px = Math.floor((v.x * 0.5 + 0.5) * db.x), py = Math.floor((v.y * 0.5 + 0.5) * db.y);
        var buf = new Uint8Array(4 * 16), r = 0, g = 0, b = 0;
        gl.readPixels(px - 2, py - 2, 4, 4, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        for (var i = 0; i < buf.length; i += 4) { r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; }
        return rgbStr(Math.round(r / 16), Math.round(g / 16), Math.round(b / 16)) + ' @' + px + ',' + (db.y - py);
      } catch (e) { return 'err'; }
    }
    ['earth', 'moon', 'mars'].forEach(function (k) {
      var name = 'Vista' + k.charAt(0).toUpperCase() + k.slice(1);
      var mesh = bayState.vistas[k];
      if (!mesh) { out.push(name + ': NOT FOUND'); return; }
      var m = mesh.material || {};
      var tex = m.map || m.emissiveMap || null;
      var img = tex && tex.image;
      var wp = new THREE.Vector3(); mesh.getWorldPosition(wp);
      out.push(name + ': vis=' + mesh.visible + ' mat=' + (m.type || '?') +
        ' tex=' + (tex ? ((img ? (img.width || 0) + 'x' + (img.height || 0) : 'noimg') + ' cs=' + tex.colorSpace) : 'NONE') +
        ' texAvg=' + (tex ? texAvg(tex) : '-') +
        ' uv=' + (mesh.geometry && mesh.geometry.attributes && mesh.geometry.attributes.uv ? 'yes' : 'NO') +
        ' px=' + sampleAt(wp));
    });
    // Occluder check: raycast from the camera through the visible vista.
    try {
      var vis = bayState.vistas[bayState.sceneName] || bayState.vistas.earth;
      if (vis) {
        var c = new THREE.Vector3(); vis.getWorldPosition(c);
        var dir = c.clone().sub(camera.position).normalize();
        var rc = new THREE.Raycaster(camera.position, dir, 0.01, 100);
        var hits = rc.intersectObjects(bayGroup.children, true).slice(0, 3);
        out.push('raycast→' + vis.name + ': ' + (hits.length ? hits.map(function (h) {
          return h.object.name + '(' + (h.object.material ? h.object.material.type : '?') + ')';
        }).join(' → ') : 'no hits'));
      }
    } catch (e) { out.push('raycast: err'); }
    // Floor state (its outer ring was blowing out too).
    try {
      bayGroup.traverse(function (o) {
        if (o.isMesh && o.material && o.material.name === 'FloorMat') {
          var fm = o.material;
          out.push('Floor: mat=' + fm.type + ' color=#' + fm.color.getHexString() +
            ' emissive=#' + (fm.emissive ? fm.emissive.getHexString() : '-') + ' eInt=' + fm.emissiveIntensity +
            ' emissiveMap=' + (fm.emissiveMap ? 'yes' : 'no') + ' map=' + (fm.map ? 'yes' : 'no'));
        }
      });
    } catch (e) { /* floor line is best-effort */ }
    return out.join('\n');
  }

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var bay = window.__scBay;
    if (!bay || typeof bay.diagRefs !== 'function') {
      if (tries > 60) { clearInterval(timer); box.textContent = 'VISTA DIAG — bay hooks never appeared (main module failed?)'; }
      return;
    }
    var refs;
    try { refs = bay.diagRefs(); } catch (e) { refs = null; }
    if (!refs || !refs.renderer) {
      if (tries > 60) { clearInterval(timer); box.textContent = 'VISTA DIAG — no renderer refs'; }
      return;
    }
    clearInterval(timer);
    var runs = 0;
    var iv = setInterval(function () {
      runs++;
      try { box.textContent = build(refs); } catch (e) { box.textContent = 'VISTA DIAG error: ' + (e && e.message); }
      if (runs >= 4) clearInterval(iv);
    }, 1800);
    try { box.textContent = build(refs); } catch (e) { box.textContent = 'VISTA DIAG error: ' + (e && e.message); }
  }, 250);
})();
