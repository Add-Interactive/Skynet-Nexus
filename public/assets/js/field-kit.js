/* ============================================================
   SKYNET NEXUS — Nexus Field Kit scanners (cinematic build)
   Loaded by public/pages/field-kit.html only.

   EVERY visual on the page is fed by real, live device data:
   - Motion Lab: DeviceMotion accelerometer — trace graph,
     G-force bar, and the tilt-level bubble are all the same
     real acceleration vector, drawn three ways.
   - Sound Lab: getUserMedia + Web Audio — the spectrum bars
     are the analyser's real frequency bins; loudness is the
     real time-domain RMS (relative, and labelled relative:
     phone mics are not calibrated).
   - Geo Compass: DeviceOrientation heading — dial, needle,
     and the degrees-from-north readout are the real heading.
   - Astro Scanner: a real Geolocation position fix, shown
     on screen only and never stored or sent.
   - Systems check + device clock: real feature detection
     and the real local time.
   Animation is used ONLY for device chrome (frame LEDs, scan
   sweeps, boot-in panels) — never to imitate a reading. A
   missing sensor says so plainly; nothing is faked.

   Privacy rules the page promises, kept here: nothing is
   recorded, uploaded, or tracked; scan logs are localStorage
   on this device only ('skynet.fieldKitLog'); this file never
   touches XP, streaks, badges, levels, or any endpoint.
   ============================================================ */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  /* ---------------- device frame: live state + clock ---------------- */
  var deviceEl = $('fk-device');
  var liveCount = 0;
  function setLive(on) {
    liveCount = Math.max(0, liveCount + (on ? 1 : -1));
    if (deviceEl) deviceEl.classList.toggle('live', liveCount > 0);
  }
  function panelOf(el) { return el ? el.closest('.fk-panel') : null; }
  function setScanning(btn, on) {
    var p = panelOf(btn);
    if (p) p.classList.toggle('scanning', on);
    setLive(on);
  }
  (function clock() {
    var el = $('fk-clock'); if (!el) return;
    function tick() {
      var d = new Date();
      el.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    tick(); setInterval(tick, 5000);
  })();

  /* ---------------- systems check (real feature detection) ---------------- */
  (function syscheck() {
    var body = $('fk-sys-body'); if (!body) return;
    function sensorState(hasEvt, obj) {
      if (!hasEvt) return '<span class="off">NOT ON THIS DEVICE</span>';
      if (obj && typeof obj.requestPermission === 'function') return '<span class="wait">READY — THIS DEVICE ASKS FIRST (TAP START)</span>';
      return '<b>READY</b>';
    }
    var rows = [
      ['📐 MOTION', sensorState('DeviceMotionEvent' in window, window.DeviceMotionEvent)],
      ['🔊 SOUND', (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? '<b>READY</b>' : '<span class="off">NOT IN THIS BROWSER</span>'],
      ['🧭 COMPASS', sensorState('DeviceOrientationEvent' in window, window.DeviceOrientationEvent)],
      ['📍 POSITION', ('geolocation' in navigator) ? '<b>READY</b>' : '<span class="off">NOT ON THIS DEVICE</span>']
    ];
    body.innerHTML = rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('<br/>');
  })();

  /* ---------------- Logbook ---------------- */
  var LOG_KEY = 'skynet.fieldKitLog';
  var stampNext = false;
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
    if (count) count.textContent = entries.length + ' LOGGED';
    var list = $('fk-log-list');
    if (!list) return;
    if (!entries.length) {
      list.innerHTML = '<p class="fk-empty">No scans logged yet. Run a scanner above and tap \u201cLog this scan.\u201d</p>';
      return;
    }
    list.innerHTML = '';
    entries.forEach(function (en, i) {
      var row = document.createElement('div');
      row.className = 'fk-log-item' + (stampNext && i === 0 ? ' fk-new' : '');
      var left = document.createElement('b');
      left.textContent = en.mode + ' — ' + en.result;
      var right = document.createElement('span');
      right.textContent = en.when;
      row.appendChild(left); row.appendChild(right);
      list.appendChild(row);
    });
    stampNext = false;
  }
  function addLog(mode, result) {
    var entries = readLog();
    var now = new Date();
    var when = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    entries.unshift({ mode: mode, result: result, when: when });
    stampNext = true;
    writeLog(entries); renderLog(); buzz(25);
  }
  var clearBtn = $('fk-log-clear');
  if (clearBtn) clearBtn.addEventListener('click', function () { writeLog([]); renderLog(); });

  /* ---------------- motion strip chart (grid + glow + fill + peak dot) ---------------- */
  function stripChart(canvas, color) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height, data = [];
    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1;
      [0.25, 0.5, 0.75].forEach(function (f) {
        ctx.beginPath(); ctx.moveTo(0, H * f); ctx.lineTo(W, H * f); ctx.stroke();
      });
      if (data.length < 2) return;
      var max = draw.max;
      function Y(v) { return H - 4 - Math.min(1, v / max) * (H - 12); }
      /* filled area */
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, color + '55'); grad.addColorStop(1, color + '05');
      ctx.beginPath(); ctx.moveTo(0, H);
      data.forEach(function (d, i) { ctx.lineTo(i * 4, Y(d)); });
      ctx.lineTo((data.length - 1) * 4, H); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      /* glowing trace */
      ctx.beginPath();
      data.forEach(function (d, i) { if (i === 0) ctx.moveTo(0, Y(d)); else ctx.lineTo(i * 4, Y(d)); });
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0; ctx.lineWidth = 1;
      /* peak dot */
      var pi = 0; data.forEach(function (d, i) { if (d > data[pi]) pi = i; });
      ctx.beginPath(); ctx.arc(pi * 4, Y(data[pi]), 3.5, 0, 7);
      ctx.fillStyle = '#ffd23f'; ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
    }
    draw.max = 30;
    return { push: function (v, max) { draw.max = max; data.push(v); if (data.length > W / 4) data.shift(); draw(); } };
  }

  /* ---------------- Motion Lab ---------------- */
  (function motion() {
    var btn = $('fk-motion-btn'), logBtn = $('fk-motion-log'), val = $('fk-motion-val'),
        peakEl = $('fk-motion-peak'), status = $('fk-motion-status'),
        gFill = $('fk-gbar-fill'), gVal = $('fk-g-val'), bubble = $('fk-bubble');
    if (!btn) return;
    var chart = stripChart($('fk-motion-graph'), '#f97316');
    var running = false, peak = 0, sawEvent = false, watchdog = null;
    function onMotion(e) {
      var a = e.accelerationIncludingGravity;
      if (!a || a.x == null) return;
      sawEvent = true;
      var mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      var g = mag / 9.81;
      if (mag > peak) { peak = mag; peakEl.textContent = 'PEAK: ' + peak.toFixed(1) + ' m/s\u00b2 (' + (peak / 9.81).toFixed(2) + ' g)'; }
      val.textContent = mag.toFixed(1) + ' m/s\u00b2';
      chart.push(mag, 30);
      if (gFill) gFill.style.width = Math.min(100, g / 3 * 100) + '%';
      if (gVal) gVal.textContent = g.toFixed(2) + ' g';
      if (bubble) {
        var bx = Math.max(-1, Math.min(1, a.x / 9.81)) * 30;
        var by = Math.max(-1, Math.min(1, -a.y / 9.81)) * 30;
        var len = Math.hypot(bx, by); if (len > 30) { bx = bx / len * 30; by = by / len * 30; }
        bubble.style.transform = 'translate(' + bx.toFixed(1) + 'px,' + by.toFixed(1) + 'px)';
      }
      logBtn.disabled = false;
    }
    function start() {
      running = true; sawEvent = false; peak = 0;
      peakEl.textContent = 'PEAK: —'; status.textContent = 'Scanning… move your phone!';
      btn.textContent = '⏹ STOP SCAN'; setScanning(btn, true);
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
      btn.textContent = '▶ START SCAN'; setScanning(btn, false);
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

  /* ---------------- Sound Lab (real spectrum bars + loudness) ---------------- */
  (function sound() {
    var btn = $('fk-sound-btn'), logBtn = $('fk-sound-log'), val = $('fk-sound-val'),
        peakEl = $('fk-sound-peak'), status = $('fk-sound-status'), lvl = $('fk-lvl-fill');
    if (!btn) return;
    var canvas = $('fk-sound-graph'), ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var stream = null, actx = null, raf = null, peak = -Infinity;
    var BARS = 44, caps = new Array(BARS).fill(0);
    function drawSpectrum(analyser) {
      var freq = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freq);
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.07)';
      [0.33, 0.66].forEach(function (f) { ctx.beginPath(); ctx.moveTo(0, H * f); ctx.lineTo(W, H * f); ctx.stroke(); });
      var bw = W / BARS;
      for (var i = 0; i < BARS; i++) {
        /* log-ish bin pick: deep sounds get more bars, like real analysers */
        var bin = Math.floor(Math.pow(i / BARS, 1.6) * freq.length * 0.72) + 2;
        var v = freq[Math.min(bin, freq.length - 1)] / 255;
        var h = Math.max(2, v * (H - 10));
        var grad = ctx.createLinearGradient(0, H, 0, 0);
        grad.addColorStop(0, '#7b2ff7'); grad.addColorStop(0.6, '#e879f9'); grad.addColorStop(1, '#ffd23f');
        ctx.fillStyle = grad;
        ctx.shadowColor = '#e879f9'; ctx.shadowBlur = v > 0.55 ? 9 : 0;
        ctx.fillRect(i * bw + 1.5, H - h, bw - 3, h);
        ctx.shadowBlur = 0;
        /* falling peak cap */
        if (v > caps[i]) caps[i] = v; else caps[i] = Math.max(0, caps[i] - 0.008);
        ctx.fillStyle = '#fff';
        ctx.fillRect(i * bw + 1.5, H - Math.max(2, caps[i] * (H - 10)) - 3, bw - 3, 2);
      }
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf); raf = null;
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      if (actx && actx.close) actx.close(); actx = null;
      btn.textContent = '▶ START SCAN'; setScanning(btn, false);
      if (lvl) lvl.style.width = '0%';
      if (peak > -Infinity) status.textContent = 'Scan stopped — the microphone is fully off. Log it below!';
    }
    btn.addEventListener('click', function () {
      if (stream) { stop(); return; }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        status.textContent = 'This browser can\u2019t open a microphone — try Chrome or Safari on a phone.';
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        stream = s; peak = -Infinity; peakEl.textContent = 'PEAK: —'; caps = new Array(BARS).fill(0);
        status.textContent = 'Listening… (live only, never recorded)';
        btn.textContent = '⏹ STOP SCAN'; setScanning(btn, true);
        var AC = window.AudioContext || window.webkitAudioContext;
        actx = new AC();
        var src = actx.createMediaStreamSource(s);
        var analyser = actx.createAnalyser(); analyser.fftSize = 2048;
        src.connect(analyser);
        var buf = new Uint8Array(analyser.fftSize);
        (function tick() {
          analyser.getByteTimeDomainData(buf);
          var sum = 0;
          for (var i = 0; i < buf.length; i++) { var v = (buf[i] - 128) / 128; sum += v * v; }
          var rms = Math.sqrt(sum / buf.length);
          var db = rms > 0.0001 ? (20 * Math.log10(rms)) : -80; /* dBFS, relative */
          if (db > peak) { peak = db; peakEl.textContent = 'PEAK: ' + Math.max(-60, Math.round(peak)) + ' (relative)'; }
          val.textContent = Math.max(-60, Math.round(db)) + ' / 0 loudness';
          if (lvl) lvl.style.width = Math.min(100, Math.max(0, (db + 60) / 60 * 100)) + '%';
          drawSpectrum(analyser);
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
        needle = $('fk-needle'), status = $('fk-compass-status'), delta = $('fk-delta'), dial = $('fk-dial');
    if (!btn) return;
    /* real dial furniture: degree ticks every 30°, cardinals at 0/90/180/270 */
    if (dial) {
      var labels = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
      for (var d = 0; d < 360; d += 30) {
        var t = document.createElement('span');
        t.className = 'fk-tick';
        t.textContent = labels[d] || '·';
        if (labels[d]) { t.style.color = '#fff'; t.style.fontWeight = '800'; }
        t.style.transform = 'rotate(' + d + 'deg) translateY(-74px)';
        t.style.transformOrigin = '0 0';
        dial.appendChild(t);
      }
    }
    var running = false, heading = null;
    var DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    function onOrient(e) {
      var h = null;
      if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
      else if (typeof e.alpha === 'number') h = 360 - e.alpha;
      if (h == null) return;
      heading = (h + 360) % 360;
      needle.style.transform = 'rotate(' + heading + 'deg)';
      val.textContent = Math.round(heading) + '° ' + DIRS[Math.round(heading / 45) % 8];
      var off = Math.min(heading, 360 - heading);
      if (off <= 3) delta.textContent = '★ TRUE NORTH — YOU FOUND IT!';
      else delta.textContent = '▲ ' + Math.round(off) + '° FROM TRUE NORTH — TURN ' + (heading <= 180 ? 'LEFT' : 'RIGHT');
      logBtn.disabled = false;
    }
    function start() {
      running = true; status.textContent = 'Scanning… hold your phone flat and turn slowly.';
      btn.textContent = '⏹ STOP SCAN'; setScanning(btn, true);
      window.addEventListener('deviceorientationabsolute', onOrient, true);
      window.addEventListener('deviceorientation', onOrient, true);
    }
    function stop() {
      running = false;
      window.removeEventListener('deviceorientationabsolute', onOrient, true);
      window.removeEventListener('deviceorientation', onOrient, true);
      btn.textContent = '▶ START SCAN'; setScanning(btn, false);
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

  /* ---------------- Astro: real position fix (display only) ---------------- */
  (function astro() {
    var posBtn = $('fk-pos-btn'), pos = $('fk-pos'), status = $('fk-astro-status');
    if (posBtn) posBtn.addEventListener('click', function () {
      if (!('geolocation' in navigator)) {
        if (status) status.textContent = 'This device has no position fix for the Astro Scanner.';
        return;
      }
      if (status) status.textContent = 'Asking your device for a position fix…';
      navigator.geolocation.getCurrentPosition(function (p) {
        var c = p.coords;
        pos.innerHTML = '<small>YOUR SKY POSITION · MEASURED JUST NOW, SHOWN ONLY HERE</small>' +
          'LAT ' + c.latitude.toFixed(3) + '° · LON ' + c.longitude.toFixed(3) + '°<br/>' +
          '<small>FIX ACCURACY ±' + Math.round(c.accuracy) + ' m · NOW OPEN THE SPACE CENTER AND FIND WHAT IS OVER THIS SKY</small>';
        if (status) status.textContent = 'Position fix locked. Nothing was stored or sent. 📍';
        buzz(25);
      }, function () {
        if (status) status.textContent = 'Position permission was not granted — that\u2019s okay, the Space Center still works!';
      }, { timeout: 10000, maximumAge: 60000 });
    });
    var astroLog = $('fk-astro-log');
    if (astroLog) astroLog.addEventListener('click', function () {
      addLog('🛰️ Astro Scanner', 'satellite sighting (via Space Center)');
      if (status) status.textContent = 'Logged! Stella is proud of you. 🚀';
    });
  })();

  renderLog();
})();
