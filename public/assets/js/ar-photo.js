/* Space Center AR fun pack — PHOTO MODE ("snap your satellites").
   Loads as <script type="module"> AFTER ar-placement.js.
   Exposes window.ARFun.photo = { snap() }, wired to the "📸 Photo" picker button.

   PLATFORM LIMIT (honest version for grown-ups reading this):
   In WebXR immersive-ar, the browser composites the real-world camera feed
   OUTSIDE the WebGL canvas — the page's canvas only ever holds the virtual
   objects (satellites/Earth/models), possibly on transparency. There is no
   API that gives the page the camera image. So an "AR photo" taken here
   captures your satellites over a painted NEXUS night-sky backdrop, never
   your room. The on-photo honesty line says exactly that.

   Capture timing: renderer was NOT created with preserveDrawingBuffer, so
   the WebGL drawing buffer is only valid synchronously inside the XR frame
   callback. We wrap window.ARPlacement.onFrame (space-center-main.js calls
   it inside its XR animation loop) with call-through, and capture
   synchronously right there when a photo is pending.
   Plain ES module — 2D canvas API only, no three.js needed. */

(function () {
  'use strict';

  var FUN_NAME = 'photo';

  function B() { return window.__scB || null; }
  function toast(msg) {
    var b = B();
    if (b && typeof b.toast === 'function') b.toast(msg);
  }

  var pendingPhoto = false;

  /* ---------- backdrop + stars ---------- */
  // Deterministic pseudo-random so the star field looks the same every photo.
  function starRand(seed) {
    var s = seed >>> 0;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function paintBackdrop(ctx, w, h) {
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0B1026');
    g.addColorStop(1, '#12264d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    var rnd = starRand(20261016);
    for (var i = 0; i < 80; i++) {
      var x = rnd() * w, y = rnd() * h;
      var r = rnd() * 1.8 + 0.4;
      var a = rnd() * 0.5 + 0.25;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
      ctx.fill();
    }
  }

  /* ---------- NEXUS photo frame ---------- */
  function paintFrame(ctx, w, h) {
    var pad = Math.round(w * 0.03);
    var big = Math.max(28, Math.round(w / 34));
    var small = Math.max(18, Math.round(w / 60));
    var tiny = Math.max(14, Math.round(w / 90));

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;

    // top bar
    var barH = big * 2.1;
    ctx.fillStyle = 'rgba(3,10,24,0.55)';
    ctx.fillRect(0, 0, w, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '700 ' + big + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('NEXUS · Space Center AR', pad, barH / 2);
    var d = new Date();
    var dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, w - pad, barH / 2);

    // bottom bar
    var capH = small * 2.4 + tiny * 1.8;
    ctx.fillStyle = 'rgba(3,10,24,0.55)';
    ctx.fillRect(0, h - capH, w, capH);
    ctx.textAlign = 'center';
    ctx.font = '700 ' + small + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText('My AR satellites 🛰️ — Add Interactive Studio', w / 2, h - capH + small * 1.1);
    ctx.font = '400 ' + tiny + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('AR camera photos capture your satellites — your room stays private', w / 2, h - tiny * 1.1);

    ctx.restore();
  }

  /* ---------- share / download ---------- */
  function downloadFallback(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'nexus-ar.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { document.body.removeChild(a); } catch (e) {}
      try { URL.revokeObjectURL(url); } catch (e) {}
    }, 1000);
  }

  function shareBlob(blob) {
    try {
      var file = new File([blob], 'nexus-ar.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'My Space Center AR' }).then(function () {
          toast('Photo ready! 📸 (AR photos capture your satellites — the real room stays private)');
        }).catch(function (err) {
          // AbortError = kid hit cancel; stay silent. Anything else → save a file instead.
          if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return;
          downloadFallback(blob);
          toast('Photo ready! 📸 (AR photos capture your satellites — the real room stays private)');
        });
        return;
      }
    } catch (e) { /* fall through to download */ }
    downloadFallback(blob);
    toast('Photo ready! 📸 (AR photos capture your satellites — the real room stays private)');
  }

  /* ---------- capture (runs INSIDE the XR frame callback) ---------- */
  function capture() {
    var b = B();
    var src = b && b.renderer ? b.renderer.domElement : null;
    if (!src || !src.width || !src.height) {
      toast("Couldn't take the photo — try again");
      return;
    }
    var w = src.width, h = src.height;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    if (!ctx) {
      toast("Couldn't take the photo — try again");
      return;
    }
    // Backdrop first (the camera feed is composited by the browser, not in the canvas).
    paintBackdrop(ctx, w, h);
    // Virtual satellites over the backdrop.
    ctx.drawImage(src, 0, 0);
    // NEXUS frame on top.
    paintFrame(ctx, w, h);
    c.toBlob(function (blob) {
      if (!blob) {
        toast("Couldn't take the photo — try again");
        return;
      }
      shareBlob(blob);
    }, 'image/png');
  }

  /* ---------- public: snap ---------- */
  function snap() {
    var b = B();
    if (!b || !b.ar || !b.ar.isActive || !b.ar.isActive()) {
      toast('Start AR first, then take a photo 📸');
      return;
    }
    pendingPhoto = true;
    toast('Say cheese! 📸');
  }

  /* ---------- wire into ar-placement.js ---------- */
  function hook() {
    var P = window.ARPlacement;
    if (!P) return false;
    // Wrap onFrame: call the original first (anchors, gestures, other fun-pack
    // modules), then capture synchronously if a photo is pending.
    var origFrame = P.onFrame;
    P.onFrame = function (frame) {
      if (typeof origFrame === 'function') origFrame(frame);
      if (pendingPhoto) {
        pendingPhoto = false;
        try {
          capture();
        } catch (e) {
          toast("Couldn't take the photo — try again");
        }
      }
    };
    // Wrap onSessionEnd: clear any stale pending request.
    var origEnd = P.onSessionEnd;
    P.onSessionEnd = function (session) {
      pendingPhoto = false;
      if (typeof origEnd === 'function') origEnd(session);
    };
    return true;
  }

  window.ARFun = window.ARFun || {};
  window.ARFun[FUN_NAME] = { snap: snap };

  // ar-placement.js loads before us by contract, but retry briefly in case of
  // bundler reordering — the picker button degrades to "still loading" meanwhile.
  if (!hook()) {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (hook() || tries >= 20) clearInterval(t);
    }, 250);
  }
})();
