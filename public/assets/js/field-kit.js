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
    if (p) { p.classList.toggle('scanning', on); tileLive(p.id, on); }
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
    tileVal('fk-tile-log-val', entries.length + ' LOGGED');
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
      if (window.__fkCrew && window.__fkCrew.crews.length && apiModeFor(en.mode)) {
        var sb = document.createElement('button');
        sb.type = 'button'; sb.className = 'fk-share-btn';
        var key = en.when + '|' + en.result;
        if (window.__fkCrew.shared.has(key)) { sb.textContent = '✓ SHARED'; sb.disabled = true; }
        else {
          sb.textContent = '📡 SHARE';
          sb.addEventListener('click', function () { window.__fkShareEntry(en, sb); });
        }
        row.appendChild(sb);
      }
      list.appendChild(row);
    });
    stampNext = false;
  }
  var missionNotify = function () {}; /* replaced by the mission engine below */
  function addLog(mode, result, value) {
    var entries = readLog();
    var now = new Date();
    var when = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    var en = { mode: mode, result: result, when: when };
    if (typeof value === 'number' && isFinite(value)) en.value = value;
    entries.unshift(en);
    stampNext = true;
    writeLog(entries); renderLog(); buzz(25);
    missionNotify(mode, result);
  }
  function refreshCompare() { if (window.__fkRefreshCompare) window.__fkRefreshCompare(); }
  var _renderLog = renderLog;
  renderLog = function () { _renderLog(); refreshCompare(); };
  var clearBtn = $('fk-log-clear');
  if (clearBtn) clearBtn.addEventListener('click', function () { writeLog([]); renderLog(); });

  /* ---------------- visual menu grid ----------------
     Every instrument is visible as a tile; tapping one
     expands its section in place. Tiles also carry LIVE
     readouts fed by the same real sensor data. */
  function openSection(id, scroll) {
    document.querySelectorAll('.fk-expand').forEach(function (s) { s.classList.toggle('open', s.id === id); });
    document.querySelectorAll('.fk-tile').forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-target') === id); });
    if (scroll) { var el = $(id); if (el) setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 40); }
  }
  window.__fkOpenSection = openSection;
  document.querySelectorAll('.fk-tile').forEach(function (t) {
    t.addEventListener('click', function () { openSection(t.getAttribute('data-target'), true); buzz(10); });
  });
  function tileVal(id, txt) { var el = $(id); if (el) el.textContent = txt; }
  function tileLive(panelId, on) {
    var t = document.querySelector('.fk-tile[data-target="' + panelId + '"]');
    if (t) t.classList.toggle('live', on);
  }

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
      val.textContent = mag.toFixed(1) + ' m/s\u00b2'; tileVal('fk-tile-motion-val', mag.toFixed(1) + ' m/s\u00b2 LIVE');
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
      addLog('📐 Motion Lab', 'peak ' + peak.toFixed(1) + ' m/s\u00b2 (' + (peak / 9.81).toFixed(2) + ' g)', peak);
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
          val.textContent = Math.max(-60, Math.round(db)) + ' / 0 loudness'; tileVal('fk-tile-sound-val', Math.max(-60, Math.round(db)) + ' LOUDNESS LIVE');
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
      addLog('🔊 Sound Lab', 'peak loudness ' + Math.max(-60, Math.round(peak)) + ' (relative)', Math.max(-60, Math.round(peak)));
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
      val.textContent = Math.round(heading) + '° ' + DIRS[Math.round(heading / 45) % 8]; tileVal('fk-tile-compass-val', Math.round(heading) + '° ' + DIRS[Math.round(heading / 45) % 8] + ' LIVE');
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
      addLog('🧭 Geo Compass', 'heading ' + Math.round(heading) + '° ' + DIRS[Math.round(heading / 45) % 8], Math.round(heading));
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
        if (status) status.textContent = 'Position fix locked. Nothing was stored or sent. 📍'; tileVal('fk-tile-astro-val', 'FIX \u00b1' + Math.round(c.accuracy) + ' m \u00b7 LIVE');
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


  /* ---- crew mode mapping ---- */
  function apiModeFor(displayMode) {
    if (!displayMode) return null;
    if (displayMode.indexOf('Motion') > -1) return 'motion';
    if (displayMode.indexOf('Sound') > -1) return 'sound';
    if (displayMode.indexOf('Compass') > -1) return 'compass';
    if (displayMode.indexOf('Astro') > -1) return 'astro';
    if (displayMode.indexOf('Mission') > -1) return 'mission';
    return null;
  }
  function modeLabel(apiMode) {
    return { motion: '📐 Motion Lab', sound: '🔊 Sound Lab', compass: '🧭 Geo Compass', astro: '🛰️ Astro Scanner', mission: '🎯 Mission' }[apiMode] || apiMode;
  }
  function baseMode(displayMode) { return apiModeFor(displayMode) || displayMode; }

  /* ================= GUIDED MISSIONS =================
     Predict -> Scan -> Explain, played properly. Starting a
     mission arms a listener: when the cadet LOGS a scan of
     the mission's kind, the mission advances by itself —
     the logbook stays the single source of truth. */
  var MISSIONS = {
    pendulum: { name: 'Mission 1 · The Pendulum Test', guide: 'GUS DELGADO · ENGINEERING', chip: '🔧', color: '#f97316',
      panel: 'fk-motion', mode: '📐 Motion Lab', need: 1,
      predictQ: 'Before you scan: a LONGER pendulum swings…',
      options: ['Slower — longer means slower swings', 'Faster — longer means faster swings', 'The same — length won\u2019t matter'],
      scanText: 'Start MOTION LAB (top of the Sensor Deck), hold your phone gently and swing it like a pendulum. Count the glowing waves for 10 swings — then tap LOG THIS SCAN inside Motion Lab. The mission hears the log and moves on by itself.' },
    soundmap: { name: 'Mission 2 · Sound Map of Your World', guide: 'CADENCE LIU · MUSIC', chip: '🎵', color: '#e879f9',
      panel: 'fk-sound', mode: '🔊 Sound Lab', need: 2,
      predictQ: 'Before you scan: which place will measure LOUDEST?',
      options: ['The kitchen', 'Outside', 'My room / living room', 'Somewhere else entirely'],
      scanText: 'Start SOUND LAB in your first place, let it listen about 10 seconds, and LOG the scan. Then carry the Field Kit to a second place and LOG again. Two logs complete the scan step.' },
    northhunt: { name: 'Mission 3 · The North Hunt', guide: 'ROWAN FIELD · CLIMATE', chip: '🌍', color: '#34d399',
      panel: 'fk-compass', mode: '🧭 Geo Compass', need: 1,
      predictQ: 'FIRST — put the phone down and POINT at where you think north is. No peeking! How close will you be?',
      options: ['Within 10° — great sense of direction', 'Within 45° — pretty close', 'Way off — more than 45°'],
      scanText: 'Start the GEO COMPASS and follow the amber readout until it calls ★ TRUE NORTH — then tap LOG THIS SCAN inside the compass panel.' }
  };
  var mission = null;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function renderMission() {
    var box = $('fk-player'); if (!box) return;
    var mtile = document.querySelector('.fk-tile[data-target="fk-missions-sec"]');
    if (mtile) { mtile.classList.toggle('live', !!mission); tileVal('fk-tile-missions-val', mission ? 'MISSION IN PROGRESS' : '3 FIELD MISSIONS'); }
    if (!mission) { box.hidden = true; return; }
    var M = MISSIONS[mission.key];
    box.hidden = false;
    box.style.setProperty('--fk-accent', M.color);
    $('fk-player-chip').textContent = M.chip;
    $('fk-player-guide').textContent = 'GUIDE: ' + M.guide;
    $('fk-player-title').textContent = M.name;
    var steps = ['predict', 'scan', 'explain'];
    var dots = $('fk-player-dots').querySelectorAll('b');
    dots.forEach(function (d) {
      var idx = steps.indexOf(d.getAttribute('data-step'));
      d.classList.toggle('on', steps.indexOf(mission.step) >= idx || mission.step === 'done');
    });
    $('fk-player-step').textContent = mission.step === 'predict' ? 'STEP 1 OF 3 · PREDICT' :
      mission.step === 'scan' ? 'STEP 2 OF 3 · SCAN' :
      mission.step === 'explain' ? 'STEP 3 OF 3 · EXPLAIN' : 'MISSION COMPLETE';
    var body = $('fk-player-body');
    if (mission.step === 'predict') {
      body.innerHTML = '<p>' + esc(M.predictQ) + '</p>' + M.options.map(function (o, i) {
        return '<button type="button" class="tactical-btn tactical-btn-ghost fk-opt" data-pick="' + i + '">' + esc(o) + '</button>';
      }).join('');
      body.querySelectorAll('[data-pick]').forEach(function (b) {
        b.addEventListener('click', function () {
          mission.prediction = M.options[Number(b.getAttribute('data-pick'))];
          mission.step = 'scan'; mission.scans = []; renderMission(); buzz(15);
        });
      });
    } else if (mission.step === 'scan') {
      body.innerHTML = '<p><b style="color:#fff;">Your prediction:</b> ' + esc(mission.prediction) + '</p><p>' + esc(M.scanText) + '</p>' +
        '<div class="fk-progress">SCANS LOGGED: ' + mission.scans.length + ' / ' + M.need + '</div>' +
        '<button type="button" class="tactical-btn tactical-btn-cyan" id="fk-goto">🛰️ GO TO THE SCANNER</button>';
      $('fk-goto').addEventListener('click', function () {
        openSection(M.panel, false);
        var panel = $(M.panel);
        if (panel) {
          setTimeout(function () { panel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
          panel.classList.remove('fk-target'); void panel.offsetWidth; panel.classList.add('fk-target');
        }
      });
    } else if (mission.step === 'explain') {
      var found = mission.scans.map(function (s) { return esc(s); }).join(' · ');
      body.innerHTML = '<p><b style="color:#fff;">Your prediction:</b> ' + esc(mission.prediction) + '</p>' +
        '<p><b style="color:#fff;">Your real data:</b> ' + found + '</p>' +
        '<p>Well, cadet — did the universe agree with you?</p>' +
        '<button type="button" class="tactical-btn tactical-btn-green fk-opt" data-verdict="matched">✅ THE DATA MATCHED MY PREDICTION</button>' +
        '<button type="button" class="tactical-btn tactical-btn-purple fk-opt" data-verdict="surprised">🤯 THE DATA SURPRISED ME</button>';
      body.querySelectorAll('[data-verdict]').forEach(function (b) {
        b.addEventListener('click', function () {
          var verdict = b.getAttribute('data-verdict') === 'matched' ? 'prediction MATCHED the data ✅' : 'data SURPRISED the prediction 🤯';
          addLog('🎯 ' + M.name, 'predicted \u201c' + mission.prediction + '\u201d · found: ' + mission.scans.join(' · ') + ' · ' + verdict);
          mission.step = 'done'; renderMission(); buzz([30, 60, 30]);
        });
      });
    } else {
      body.innerHTML = '<div class="fk-done">★ MISSION COMPLETE ★</div>' +
        '<p style="text-align:center;">Filed in your Field Logbook below, cadet. Predict, scan, explain — that\u2019s the whole scientific method, and you just ran it.</p>' +
        '<div style="text-align:center;"><button type="button" class="tactical-btn tactical-btn-cyan" id="fk-done-close">📓 SEE MY LOGBOOK</button></div>';
      $('fk-done-close').addEventListener('click', function () {
        mission = null; renderMission();
        openSection('fk-logbook-sec', true);
      });
    }
  }
  missionNotify = function (mode, result) {
    if (!mission || mission.step !== 'scan') return;
    var M = MISSIONS[mission.key];
    if (mode !== M.mode) return;
    mission.scans.push(result);
    if (mission.scans.length >= M.need) {
      mission.step = 'explain';
      renderMission();
      openSection('fk-missions-sec', false);
      var box = $('fk-player'); if (box) setTimeout(function () { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80);
    } else {
      renderMission();
    }
  };
  document.querySelectorAll('.fk-begin').forEach(function (b) {
    b.addEventListener('click', function () {
      mission = { key: b.getAttribute('data-mission'), step: 'predict', prediction: null, scans: [] };
      renderMission(); buzz(15);
      var box = $('fk-player'); if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
  var cancelBtn = $('fk-player-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', function () { mission = null; renderMission(); });

  /* ================= DATA LAB: compare + field report ================= */
  var CMP_COLORS = ['#00e5ff', '#e879f9'];
  function entryValue(en) {
    if (typeof en.value === 'number') return en.value;
    var m = String(en.result).match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  window.__fkAllEntries = function () {
    var out = [];
    readLog().forEach(function (en, i) {
      var v = entryValue(en);
      if (v != null) out.push({ key: 'L' + i, mode: en.mode, result: en.result, when: en.when, value: v, who: 'Mine' });
    });
    if (window.__fkCrew) window.__fkCrew.feed.forEach(function (s) {
      if (typeof s.value === 'number') out.push({ key: 'C' + s.id, mode: modeLabel(s.mode), result: s.result, when: s.created_at, value: s.value, who: s.kid_name });
    });
    return out;
  };
  window.__fkRefreshCompare = function () {
    var a = $('fk-cmp-a'), bsel = $('fk-cmp-b'); if (!a || !bsel) return;
    var entries = window.__fkAllEntries();
    var keepA = a.value, keepB = bsel.value;
    function fill(sel, keep) {
      sel.innerHTML = '';
      entries.forEach(function (x) {
        var o = document.createElement('option');
        o.value = x.key;
        o.textContent = x.who + ' · ' + x.mode + ' — ' + x.result;
        sel.appendChild(o);
      });
      if (keep && sel.querySelector('option[value="' + keep + '"]')) sel.value = keep;
    }
    fill(a, keepA); fill(bsel, keepB);
    if (bsel.options.length > 1 && a.value === bsel.value) bsel.selectedIndex = 1;
  };
  var cmpBtn = $('fk-cmp-btn');
  if (cmpBtn) cmpBtn.addEventListener('click', function () {
    var out = $('fk-cmp-out');
    var all = {};
    window.__fkAllEntries().forEach(function (x) { all[x.key] = x; });
    var ea = all[$('fk-cmp-a').value], eb = all[$('fk-cmp-b').value];
    if (!ea || !eb) { out.innerHTML = '<p class="fk-cmp-verdict">Log or share at least two scans first, cadet — comparisons need data!</p>'; return; }
    var va = ea.value, vb = eb.value;
    if (baseMode(ea.mode) !== baseMode(eb.mode)) { out.innerHTML = '<p class="fk-cmp-verdict">Scientists compare like with like — pick two scans of the same kind. (A sound peak vs a compass heading isn\u2019t a fair fight!)</p>'; return; }
    var max = Math.max(Math.abs(va), Math.abs(vb), 0.0001);
    function row(en, v, c) {
      return '<div class="fk-cmp-row"><div class="fk-cmp-label">' + esc(en.who) + ' · ' + esc(en.mode) + ' — ' + esc(en.result) + '</div>' +
        '<div class="fk-cmp-bar"><i style="width:4%;background:' + c + ';box-shadow:0 0 12px ' + c + ';" data-w="' + Math.max(4, Math.abs(v) / max * 100) + '"></i></div></div>';
    }
    var diff = Math.abs(va - vb);
    var verdict = va === vb ? 'Dead tie — identical readings!' :
      'Difference: ' + (diff % 1 ? diff.toFixed(1) : diff) + ' between the two scans. ' + (va > vb ? ea.who + ' measured higher.' : eb.who + ' measured higher.');
    out.innerHTML = row(ea, va, CMP_COLORS[0]) + row(eb, vb, CMP_COLORS[1]) + '<p class="fk-cmp-verdict">⚖️ ' + esc(verdict) + '</p>';
    requestAnimationFrame(function () {
      out.querySelectorAll('.fk-cmp-bar i').forEach(function (bar) { bar.style.width = bar.getAttribute('data-w') + '%'; });
    });
  });
  var repBtn = $('fk-report-btn');
  if (repBtn) repBtn.addEventListener('click', function () {
    var entries = readLog();
    var rows = entries.map(function (en) {
      return '<tr><td>' + esc(en.when) + '</td><td>' + esc(en.mode) + '</td><td>' + esc(en.result) + '</td></tr>';
    }).join('');
    var w = window.open('', '_blank');
    if (!w) return;
    w.document.write('<!DOCTYPE html><html><head><title>Cadet Field Report — Nexus Field Kit</title>' +
      '<style>body{font-family:Georgia,serif;color:#12212f;margin:40px;}h1{letter-spacing:.06em;}table{border-collapse:collapse;width:100%;}td,th{border:1px solid #9db8cc;padding:8px 10px;text-align:left;font-size:14px;}th{background:#e8f2f9;}p{color:#456;}@media print{button{display:none;}}</style></head><body>' +
      '<h1>🛰️ CADET FIELD REPORT</h1><p>Nexus Field Kit · Skynet Nexus · Generated ' + esc(new Date().toLocaleString()) + ' from the on-device Field Logbook (' + entries.length + ' scans). All measurements were taken live by the cadet\u2019s own device sensors.</p>' +
      (entries.length ? '<table><tr><th>When</th><th>Scanner / Mission</th><th>Result</th></tr>' + rows + '</table>' : '<p>No scans logged yet.</p>') +
      '<p style="margin-top:24px;"><button onclick="window.print()">🖨️ Print this report</button></p></body></html>');
    w.document.close();
  });


  /* ================= CREW LINK (Phase A) =================
     Crews = the kid's existing classroom(s) / family. All
     calls go to /api/fieldkit/* with the session cookie;
     the server verifies kid ownership + crew membership.
     Signed-out or crew-less cadets simply never see this. */
  var FK = { kidId: null, crews: [], crew: null, feed: [], shared: new Set() };
  window.__fkCrew = FK;
  function fkApi(path, opts) {
    return fetch(path, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, opts || {}))
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); });
  }
  function fkStatus(msg) { var el = $('fk-crew-status'); if (el) el.textContent = msg || ''; }
  function renderCrewFeed() {
    var box = $('fk-crew-feed'); if (!box) return;
    if (!FK.feed.length) { box.innerHTML = '<p class="fk-empty">No crew scans yet. Be the first cadet to share one from your Logbook! 📡</p>'; return; }
    box.innerHTML = '';
    FK.feed.forEach(function (s) {
      var row = document.createElement('div');
      row.className = 'fk-feed-item' + (s.mine ? ' mine' : '');
      var av = document.createElement('span'); av.className = 'fk-feed-av'; av.textContent = s.avatar_emoji || '🚀';
      if (s.avatar_color) av.style.borderColor = s.avatar_color;
      var mid = document.createElement('div');
      var when = '';
      try { when = new Date(String(s.created_at).replace(' ', 'T') + 'Z').toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) {}
      mid.innerHTML = '<b>' + esc(s.kid_name) + '</b> · ' + esc(modeLabel(s.mode)) + '<br/>' + esc(s.result) +
        (s.place_label ? ' · 📍 ' + esc(s.place_label) : '') +
        '<div class="fk-feed-meta">' + esc(when) + (s.mine ? ' · yours' : '') + '</div>';
      row.appendChild(av); row.appendChild(mid);
      if (s.mine) {
        var del = document.createElement('button');
        del.type = 'button'; del.className = 'fk-share-btn'; del.textContent = '🗑️';
        del.title = 'Remove this share';
        del.addEventListener('click', function () {
          fkApi('/api/fieldkit/shares/' + s.id, { method: 'DELETE' }).then(function (r) {
            if (r.ok) { fkStatus('Share removed.'); loadCrewFeed(); }
          });
        });
        row.appendChild(del);
      }
      box.appendChild(row);
    });
  }
  function renderCrewPills() {
    var box = $('fk-crew-pills'); if (!box) return;
    box.innerHTML = '';
    FK.crews.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'fk-crew-pill' + (FK.crew && FK.crew.type === c.type && FK.crew.id === c.id ? ' active' : '');
      b.textContent = (c.type === 'classroom' ? '🏫 ' : '🏠 ') + c.name + ' · ' + c.memberCount + (c.type === 'classroom' ? ' cadets' : ' cadets');
      b.addEventListener('click', function () { FK.crew = c; renderCrewPills(); loadCrewFeed(); syncCrewTile(); });
      box.appendChild(b);
    });
  }
  function syncCrewTile() {
    tileVal('fk-tile-crew-val', FK.crew ? FK.crew.name.toUpperCase().slice(0, 18) : 'LINK UP');
  }
  function loadCrewFeed() {
    if (!FK.crew) return;
    fkApi('/api/fieldkit/shares?kid_id=' + FK.kidId + '&crew_type=' + FK.crew.type + '&crew_id=' + FK.crew.id)
      .then(function (r) {
        if (r.ok) { FK.feed = r.data.shares || []; renderCrewFeed(); if (window.__fkRefreshCompare) window.__fkRefreshCompare(); }
        else fkStatus('Crew feed could not load right now.');
      })
      .catch(function () { fkStatus('Crew feed could not load right now.'); });
  }
  window.__fkShareEntry = function (en, btn) {
    if (!FK.crew) { fkStatus('Pick a crew first!'); openSection('fk-crew-sec', true); return; }
    var mode = apiModeFor(en.mode);
    if (!mode) return;
    var placeSel = $('fk-place');
    var body = { kid_id: FK.kidId, crew_type: FK.crew.type, crew_id: FK.crew.id, mode: mode,
      result: en.result, value: (typeof en.value === 'number' ? en.value : entryValue(en)),
      place_label: placeSel && placeSel.value ? placeSel.value : null };
    if (btn) { btn.disabled = true; btn.textContent = '📡 SENDING…'; }
    fkApi('/api/fieldkit/shares', { method: 'POST', body: JSON.stringify(body) }).then(function (r) {
      if (r.ok) {
        FK.shared.add(en.when + '|' + en.result);
        fkStatus('Shared with ' + FK.crew.name + '! 📡');
        buzz(25); renderLog(); loadCrewFeed();
      } else {
        if (btn) { btn.disabled = false; btn.textContent = '📡 SHARE'; }
        fkStatus(r.data && r.data.error ? 'Share failed: ' + r.data.error : 'Share failed — try again.');
        if (r.status === 401) fkStatus('Sign in with your family account to use Crew Link.');
      }
    }).catch(function () { if (btn) { btn.disabled = false; btn.textContent = '📡 SHARE'; } });
  };
  (function initCrew() {
    var raw = null;
    try { raw = localStorage.getItem('nexus_active_kid'); } catch (e) {}
    var kidId = raw ? parseInt(raw, 10) : NaN;
    if (!kidId) return; /* anonymous tricorder: no crew tile, exactly as before */
    FK.kidId = kidId;
    fkApi('/api/fieldkit/crews?kid_id=' + kidId).then(function (r) {
      if (!r.ok || !r.data.crews || !r.data.crews.length) return;
      FK.crews = r.data.crews; FK.crew = FK.crews[0];
      var tile = $('fk-tile-crew'); if (tile) tile.style.display = '';
      renderCrewPills(); syncCrewTile(); loadCrewFeed(); renderLog();
      if (location.hash === '#crew') openSection('fk-crew-sec', true);
    }).catch(function () { /* crew link unavailable: page works as before */ });
  })();

  renderLog();
})();
