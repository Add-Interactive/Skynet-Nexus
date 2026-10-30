/* ============================================================
   SKYNET NEXUS — Nexus Field Kit scanners
   Loaded by public/pages/field-kit.html only.

   Three live scanners built only on what a phone browser can
   actually expose to every device:
   - Motion Lab: DeviceMotion (accelerometer incl. gravity)
   - Sound Lab: getUserMedia + Web Audio (relative loudness —
     phone mics are not calibrated, and the page says so)
   - Geo Compass: DeviceOrientation (webkitCompassHeading on
     iOS, absolute alpha where available)

   Rules the page promises, kept here:
   - Nothing is recorded, uploaded, or tracked. Audio is
     analysed live and discarded; scan logs are localStorage
     on this device only ('skynet.fieldKitLog').
   - No fake readings: a missing sensor says so plainly.
   - Presentation + logging only: this file never touches XP,
     streaks, badges, levels, or any endpoint.
   ============================================================ */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- Logbook ---------------- */
  var LOG_KEY = 'skynet.fieldKitLog';
  function readLog() {
    try { var v = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function writeLog(entries) {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(0, 60))); } catch (e) {}
  }
  function renderLog() {
    var entries = readLog();
    var count = $('fk-scan-count');
    if (count) count.textContent = entries.length + (entries.length === 1 ? ' LOGGED' : ' LOGGED');
    var list = $('fk-log-list');
    if (!list) return;
    if (!entries.length) {
      list.innerHTML = '<p class="fk-empty">No scans logged yet. Run a scanner above and tap \u201cLog this scan.\u201d</p>';
      return;
    }
    list.innerHTML = '';
    entries.forEach(function (en) {
      var row = document.createElement('div');
      row.className = 'fk-log-item';
      var left = document.createElement('b');
      left.textContent = en.mode + ' — ' + en.result;
      var right = document.createElement('span');
      right.textContent = en.when;
      row.appendChild(left); row.appendChild(right);
      list.appendChild(row);
    });
  }
  function addLog(mode, result) {
    var entries = readLog();
    var now = new Date();
    var when = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    entries.unshift({ mode: mode, result: result, when: when });
    writeLog(entries); renderLog();
  }
  var clearBtn = $('fk-log-clear');
  if (clearBtn) clearBtn.addEventListener('click', function () { writeLog([]); renderLog(); });

  /* ---------------- shared graph helper ---------------- */
  function stripChart(canvas, color) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height, data = [];
    return {
      push: function (v, max) {
        data.push(v); if (data.length > W / 4) data.shift();
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,.08)';
        ctx.beginPath(); ctx.moveTo(0, H - 1); ctx.lineTo(W, H - 1); ctx.stroke();
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
        data.forEach(function (d, i) {
          var x = i * 4, y = H - 4 - Math.min(1, d / max) * (H - 10);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke(); ctx.lineWidth = 1;
      },
      clear: function () { data = []; ctx.clearRect(0, 0, W, H); }
    };
  }

  /* ---------------- Motion Lab ---------------- */
  (function motion() {
    var btn = $('fk-motion-btn'), logBtn = $('fk-motion-log'), val = $('fk-motion-val'),
        peakEl = $('fk-motion-peak'), status = $('fk-motion-status');
    if (!btn) return;
    var chart = stripChart($('fk-motion-graph'), '#f97316');
    var running = false, peak = 0, sawEvent = false, watchdog = null;
    function onMotion(e) {
      var a = e.accelerationIncludingGravity;
      if (!a || a.x == null) return;
      sawEvent = true;
      var mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      if (mag > peak) { peak = mag; peakEl.textContent = 'PEAK: ' + peak.toFixed(1) + ' m/s\u00b2 (' + (peak / 9.81).toFixed(2) + ' g)'; }
      val.textContent = mag.toFixed(1) + ' m/s\u00b2';
      chart.push(mag, 30);
      logBtn.disabled = false;
    }
    function start() {
      running = true; sawEvent = false; peak = 0;
      peakEl.textContent = 'PEAK: —'; status.textContent = 'Scanning… move your phone!';
      btn.textContent = '⏹ STOP SCAN';
      window.addEventListener('devicemotion', onMotion);
      watchdog = setTimeout(function () {
        if (running && !sawEvent) {
          status.textContent = 'No motion sensor answered on this device — try a phone or tablet. (Nothing was faked for you!)';
          stop();
        }
      }, 3000);
    }
    function stop() {
      running = false;
      window.removeEventListener('devicemotion', onMotion);
      if (watchdog) clearTimeout(watchdog);
      btn.textContent = '▶ START SCAN';
      if (sawEvent) status.textContent = 'Scan stopped. Log it below!';
    }
    btn.addEventListener('click', function () {
      if (running) { stop(); return; }
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission().then(function (res) {
          if (res === 'granted') start();
          else status.textContent = 'Motion permission was not granted — the scanner stays off. That\u2019s okay!';
        }).catch(function () { status.textContent = 'Motion permission could not be asked on this device.'; });
      } else start();
    });
    logBtn.addEventListener('click', function () {
      if (!peak) return;
      addLog('📐 Motion Lab', 'peak ' + peak.toFixed(1) + ' m/s\u00b2 (' + (peak / 9.81).toFixed(2) + ' g)');
      status.textContent = 'Logged! Check your Field Logbook below. 📓';
    });
  })();

  /* ---------------- Sound Lab ---------------- */
  (function sound() {
    var btn = $('fk-sound-btn'), logBtn = $('fk-sound-log'), val = $('fk-sound-val'),
        peakEl = $('fk-sound-peak'), status = $('fk-sound-status');
    if (!btn) return;
    var chart = stripChart($('fk-sound-graph'), '#e879f9');
    var stream = null, ctx = null, raf = null, peak = -Infinity;
    function stop() {
      if (raf) cancelAnimationFrame(raf); raf = null;
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      if (ctx && ctx.close) ctx.close(); ctx = null;
      btn.textContent = '▶ START SCAN';
      if (peak > -Infinity) status.textContent = 'Scan stopped — the microphone is fully off. Log it below!';
    }
    btn.addEventListener('click', function () {
      if (stream) { stop(); return; }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        status.textContent = 'This browser can\u2019t open a microphone — try Chrome or Safari on a phone.';
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        stream = s; peak = -Infinity; peakEl.textContent = 'PEAK: —';
        status.textContent = 'Listening… (live only, never recorded)';
        btn.textContent = '⏹ STOP SCAN';
        var AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
        var src = ctx.createMediaStreamSource(s);
        var analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
        src.connect(analyser);
        var buf = new Uint8Array(analyser.fftSize);
        (function tick() {
          analyser.getByteTimeDomainData(buf);
          var sum = 0;
          for (var i = 0; i < buf.length; i++) { var v = (buf[i] - 128) / 128; sum += v * v; }
          var rms = Math.sqrt(sum / buf.length);
          var db = rms > 0.0001 ? (20 * Math.log10(rms)) : -80; /* dBFS, relative */
          var shown = Math.max(-60, Math.round(db));
          if (db > peak) { peak = db; peakEl.textContent = 'PEAK: ' + Math.max(-60, Math.round(peak)) + ' (relative)'; }
          val.textContent = shown + ' / 0 loudness';
          chart.push(Math.max(0, (db + 60) / 60), 1);
          logBtn.disabled = false;
          raf = requestAnimationFrame(tick);
        })();
      }).catch(function () {
        status.textContent = 'Microphone permission was not granted — the scanner stays off. That\u2019s okay!';
      });
    });
    logBtn.addEventListener('click', function () {
      if (peak === -Infinity) return;
      addLog('🔊 Sound Lab', 'peak loudness ' + Math.max(-60, Math.round(peak)) + ' (relative)');
      status.textContent = 'Logged! Check your Field Logbook below. 📓';
    });
  })();

  /* ---------------- Geo Compass ---------------- */
  (function compass() {
    var btn = $('fk-compass-btn'), logBtn = $('fk-compass-log'), val = $('fk-compass-val'),
        needle = $('fk-needle'), status = $('fk-compass-status');
    if (!btn) return;
    var running = false, heading = null;
    var DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    function onOrient(e) {
      var h = null;
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
      else if (e.absolute && typeof e.alpha === 'number') h = 360 - e.alpha;
      else if (typeof e.alpha === 'number') h = 360 - e.alpha;
      if (h == null) return;
      heading = (h + 360) % 360;
      needle.style.transform = 'rotate(' + heading + 'deg)';
      val.textContent = Math.round(heading) + '° ' + DIRS[Math.round(heading / 45) % 8];
      logBtn.disabled = false;
    }
    function start() {
      running = true; status.textContent = 'Scanning… hold your phone flat and turn slowly.';
      btn.textContent = '⏹ STOP SCAN';
      window.addEventListener('deviceorientationabsolute', onOrient, true);
      window.addEventListener('deviceorientation', onOrient, true);
    }
    function stop() {
      running = false;
      window.removeEventListener('deviceorientationabsolute', onOrient, true);
      window.removeEventListener('deviceorientation', onOrient, true);
      btn.textContent = '▶ START SCAN';
      if (heading != null) status.textContent = 'Scan stopped. Log your heading below!';
    }
    btn.addEventListener('click', function () {
      if (running) { stop(); return; }
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(function (res) {
          if (res === 'granted') start();
          else status.textContent = 'Compass permission was not granted — the scanner stays off. That\u2019s okay!';
        }).catch(function () { status.textContent = 'Compass permission could not be asked on this device.'; });
      } else start();
    });
    logBtn.addEventListener('click', function () {
      if (heading == null) return;
      addLog('🧭 Geo Compass', 'heading ' + Math.round(heading) + '° ' + DIRS[Math.round(heading / 45) % 8]);
      status.textContent = 'Logged! Check your Field Logbook below. 📓';
    });
  })();

  /* ---------------- Astro log ---------------- */
  var astroLog = $('fk-astro-log');
  if (astroLog) astroLog.addEventListener('click', function () {
    addLog('🛰️ Astro Scanner', 'satellite sighting (via Space Center)');
    var st = $('fk-astro-status');
    if (st) st.textContent = 'Logged! Stella is proud of you. 🚀';
  });

  renderLog();
})();
