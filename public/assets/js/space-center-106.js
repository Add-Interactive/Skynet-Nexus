(function () {
  "use strict";
  var B = window.__scB, T = window.__scB && window.__scB.tools;
  if (!B || !T) return;

    // ---------- PR #106 FEATURE 2: Add to Calendar (.ics, client-side) ----------
    function icsEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
    function icsStamp(d) { function p(n) { return String(n).padStart(2, '0'); } return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + 'T' + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z'; }
    function downloadIcs(title, start, end, desc) {
      var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Add Interactive Studio//Skynet Nexus Space Center//EN',
        'BEGIN:VEVENT', 'UID:' + Date.now() + Math.floor(Math.random() * 1e6) + '@skynet-nexus',
        'DTSTAMP:' + icsStamp(new Date()), 'DTSTART:' + icsStamp(start), 'DTEND:' + icsStamp(end),
        'SUMMARY:' + icsEsc(title), 'DESCRIPTION:' + icsEsc(desc), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      a.download = 'space-center-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) + '.ics';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
      B.toast('\uD83D\uDCC5 Calendar file downloaded!');
    }
    document.getElementById('page-launches').addEventListener('click', function (e) {
      var b = e.target.closest('[data-ics-lid]'); if (!b) return;
      var l = null;
      for (var i = 0; i < B.lastLaunches.length; i++) { if (String(B.lastLaunches[i].id) === b.getAttribute('data-ics-lid')) { l = B.lastLaunches[i]; break; } }
      if (!l || !l.net) return;
      var s = new Date(l.net);
      downloadIcs((l.name || 'Rocket launch') + ' \u2014 liftoff', s, new Date(s.getTime() + 3600000),
        (l.provider || 'Spaceflight') + (l.pad ? ' from ' + l.pad : '') + '. Live from the Skynet Nexus Space Center: https://skynet-nexus-production.up.railway.app/pages/space-center.html');
    });

    function wireCompare(kind) {
      var z = document.getElementById('cmpzone');
      if (!z) return;
      if ((kind === 'SATELLITE' || kind === 'SPACE STATION') && B.selected && !B.selected.userData.isPad) {
        z.innerHTML = '<button class="tbtn" id="cmp-btn" style="margin-top:10px">\u2696\uFE0F Compare with another\u2026</button>';
        document.getElementById('cmp-btn').onclick = function () {
          B.cmp.a = B.selected; B.cmp.pick = true; z.innerHTML = '';
          B.toast('Now search & tap a second B.satellite!');
          B.openTab('search');
        };
      } else { z.innerHTML = ''; }
    }
    function cmpCol(sp) {
      var u = sp.userData, p = B.findSatProfile(u), ld = B.satLiveData(sp, B.simDate()), shape = B.satOrbitShape(sp);
      var img = (p && p.image)
        ? '<img class="cmpimg" src="' + p.image + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"/>'
        : '<div class="cmpnoimg">\uD83D\uDEF0\uFE0F</div>';
      function row(k, v) { return '<div class="cmprow"><span>' + k + '</span><b>' + v + '</b></div>'; }
      return '<div class="cmpcol"><div class="cmpname">' + B.escapeHtml(u.name) + '</div>' + img +
        row('Builder', B.escapeHtml((p && p.builder) || B.fleetName(u.co))) +
        row('Launched', B.escapeHtml(String((p && p.launchYear) || '\u2014'))) +
        row('Altitude', ld ? Math.round(ld.alt).toLocaleString() + ' km' : '\u2014') +
        row('Speed', ld ? ld.vel.toFixed(2) + ' km/s' : '\u2014') +
        row('Period', ld ? ld.period.toFixed(1) + ' min' : '\u2014') +
        row('Inclination', shape ? shape.incl.toFixed(1) + '\u00B0' : '\u2014') +
        row('Design life', B.escapeHtml(String((p && p.designLife) || '\u2014'))) + '</div>';
    }
    function renderCompare(a, b) {
      function short(s) { s = String(s); return B.escapeHtml(s.length > 20 ? s.slice(0, 20) + '\u2026' : s); }
      var la = B.satLiveData(a, B.simDate()), lb = B.satLiveData(b, B.simDate()), line = '';
      if (la && lb) {
        if (Math.abs(la.alt - lb.alt) > 50)
          line = la.alt < lb.alt ? ('\u26A1 ' + short(a.userData.name) + ' flies lower & faster!') : ('\u26A1 ' + short(b.userData.name) + ' flies lower & faster!');
        else line = '\uD83E\uDD1D These two cruise at almost the same height!';
      }
      document.getElementById('infok').textContent = '\u2696\uFE0F COMPARE';
      document.getElementById('infot').textContent = 'Side by side';
      document.getElementById('infoprof').innerHTML = '';
      document.getElementById('infodata').innerHTML = '';
      document.getElementById('infop').innerHTML = '<div class="cmpgrid">' + cmpCol(a) + cmpCol(b) + '</div>' +
        '<div class="cmpline">' + line + '</div>' +
        '<div class="trow"><button class="tbtn" id="cmp-swap">\uD83D\uDD04 Swap</button>' +
        '<button class="tbtn" id="cmp-clear">\u2715 Clear</button></div>';
      B.infopanel.classList.add('show');
      document.getElementById('cmp-swap').onclick = function () { var t = B.cmp.a; B.cmp.a = b; renderCompare(b, t); };
      document.getElementById('cmp-clear').onclick = function () { B.cmp.a = null; B.infopanel.classList.remove('show'); B.flyHome(); };
    }
  B.wireCompare = wireCompare;
  B.renderCompare = renderCompare;

      // ================= PR #106: tours / debris / sky / trains / pass-ics =================

      // ---------- FEATURE 1: guided tours ----------
      var TOURS = [
        { id: 'observatories', em: '\uD83D\uDD2D', t: 'Great Observatories', d: 'The giant eyes watching the universe — from Hubble to the retired legends.', stops: [
          { k: 'sat', id: '20580', line: "This is Hubble \u2014 it's taken over a million photos of the universe in 30+ years, and it's still working!" },
          { k: 'sat', id: '25778', prof: 'chandra', line: 'Chandra sees X-rays from black holes \u2014 the hottest, wildest places in space.' },
          { k: 'prof', pid: 'jwst', line: "Webb spots the very first galaxies ever born, using infrared light our eyes can't see." },
          { k: 'prof', pid: 'spitzer', line: 'Spitzer retired in 2020 \u2014 it mapped dusty stellar nurseries in infrared for 16 years.' },
          { k: 'sat', id: '33053', prof: 'fermi', line: 'Fermi hunts gamma rays \u2014 light from the most powerful explosions in the universe!' },
          { k: 'sat', id: '43435', prof: 'tess', line: "TESS is a planet hunter \u2014 it's found thousands of worlds orbiting other stars." }
        ]},
        { id: 'stations', em: '\uD83D\uDEF0\uFE0F', t: 'Space Stations', d: "Humanity's outposts \u2014 people are living up there right now!", stops: [
          { k: 'sat', id: '25544', line: 'The ISS \u2014 as big as a football field, with astronauts aboard every single day since 2000!' },
          { k: 'sat', id: '48274', line: "Tiangong \u2014 China's T-shaped space station, finished in 2022." }
        ]},
        { id: 'rockets', em: '\uD83D\uDE80', t: 'Rockets of the World', d: "Fly to the pads where the B.world's biggest rockets lift off.", stops: [
          { k: 'pad', name: 'Cape Canaveral SLC-40', line: "SpaceX's busiest pad \u2014 a Falcon 9 lifts off from here almost every week!" },
          { k: 'pad', name: 'Starbase, Texas', line: 'Home of Starship \u2014 the biggest rocket ever built. Mars missions start here!' },
          { k: 'pad', name: 'Kennedy LC-39A', line: 'Legendary pad 39A \u2014 Apollo Moon rockets AND today\u2019s Falcon Heavy and SLS.' },
          { k: 'prof', pid: 'soyuz', line: 'Soyuz \u2014 flying since the 1960s, the most-flown rocket family in history!' },
          { k: 'pad', name: 'Kourou, French Guiana', line: "Europe's spaceport on the equator \u2014 Earth's spin gives rockets a free push here!" },
          { k: 'pad', name: 'Jiuquan, China', line: "China's desert spaceport \u2014 Long March rockets carry astronauts from here." }
        ]}
      ];
      var tour = null, tourIdx = 0, tourTimer = null;
      function tourResolve(s) {
        if (s.k === 'sat' && typeof B.satById !== 'undefined' && B.satById[s.id]) return { sp: B.satById[s.id] };
        if (s.k === 'pad' && typeof B.padMeshes !== 'undefined') {
          for (var i = 0; i < B.padMeshes.length; i++) if (B.padMeshes[i].userData.pad.n === s.name) return { sp: B.padMeshes[i] };
        }
        var pid = s.prof || s.pid;
        if (pid && typeof B.profById !== 'undefined' && B.profById[pid]) return { prof: B.profById[pid] };
        return null;
      }
      function tourGo(i) {
        if (!tour) return;
        tourIdx = (i + tour.stops.length) % tour.stops.length;
        var s = tour.stops[tourIdx], r = tourResolve(s);
        if (r && r.sp) B.selectSat(r.sp);
        else if (r && r.prof) { B.flyHome(); B.showInfo('TOUR STOP', r.prof.name, [], r.prof.blurb, B.profileCardHtml(r.prof, 'FIRST FLIGHT')); }
        else B.toast('That stop is out of range right now');
        document.getElementById('tourbar-title').textContent = tour.em + ' ' + tour.t + ' \u2014 stop ' + (tourIdx + 1) + ' of ' + tour.stops.length;
        document.getElementById('tourbar-line').textContent = s.line;
        document.getElementById('tourbar-dots').innerHTML = tour.stops.map(function (_, j) {
          return '<span class="tdot' + (j === tourIdx ? ' on' : '') + '"></span>';
        }).join('');
      }
      function tourArm() {
        clearInterval(tourTimer);
        tourTimer = setInterval(function () {
          if (tour && document.getElementById('tour-auto').checked) tourGo(tourIdx + 1);
        }, 8000);
      }
      function tourStart(id) {
        for (var i = 0; i < TOURS.length; i++) if (TOURS[i].id === id) tour = TOURS[i];
        if (!tour) return;
        document.getElementById('tourbar').style.display = 'block';
        B.complete('m-tour', 'Take a guided tour!');
        tourGo(0); tourArm();
      }
      function tourEnd() {
        tour = null; clearInterval(tourTimer);
        document.getElementById('tourbar').style.display = 'none';
        B.flyHome();
      }
      document.getElementById('tour-prev').onclick = function () { tourGo(tourIdx - 1); tourArm(); };
      document.getElementById('tour-next').onclick = function () { tourGo(tourIdx + 1); tourArm(); };
      document.getElementById('tour-skip').onclick = tourEnd;
      document.getElementById('tour-list').innerHTML = TOURS.map(function (t) {
        return '<div class="tourcard"><div class="tname">' + t.em + ' ' + B.escapeHtml(t.t) + '</div>' +
          '<div class="tdesc">' + B.escapeHtml(t.d) + '</div><div class="tsub">' + t.stops.length + ' stops</div>' +
          '<button class="tbtn" data-tour="' + t.id + '">\u25B6 Start tour</button></div>';
      }).join('');
      document.getElementById('tour-list').addEventListener('click', function (e) {
        var b = e.target.closest('[data-tour]'); if (b) tourStart(b.getAttribute('data-tour'));
      });

      // ---------- FEATURE 3: debris mode ----------
      var DEB_RE = /(\bDEB\b|R\/B|ROCKET BODY|\bDEBRIS\b)/i, debrisOn = false;
      function isDebrisSp(sp) { var u = sp.userData; return !u.isPad && DEB_RE.test(u.name || ''); }
      document.getElementById('debris-toggle').onclick = function () {
        debrisOn = !debrisOn; var n = 0;
        B.sats.forEach(function (sp) {
          if (!isDebrisSp(sp)) return; n++;
          if (sp.userData._oc === undefined) { sp.userData._oc = sp.material.color.getHex(); sp.userData._os = sp.scale.x; }
          if (debrisOn) { sp.material.color.setHex(0xff6b35); sp.scale.setScalar(0.034); }
          else { sp.material.color.setHex(sp.userData._oc); sp.scale.setScalar(sp.userData._os); }
        });
        document.getElementById('debris-count').textContent = debrisOn ?
          ('\uD83D\uDFE0 ~' + n + ' tracked debris objects glowing orange \u2014 dead rocket stages & shattered bits') : '';
        document.getElementById('debris-kessler').hidden = !debrisOn;
        this.textContent = debrisOn ? '\uD83D\uDFE0 Hide debris layer' : '\uD83D\uDFE0 Show debris layer';
        B.toast(debrisOn ? 'Debris layer on \u2014 orange = space junk' : 'Debris layer off');
      };
      document.getElementById('debris-zones').onclick = function () { B.openTab('zones'); };

      // ---------- FEATURE 2 (passes): add-to-calendar on pass + train cards ----------
      document.getElementById('page-tonight').addEventListener('click', function (e) {
        var b = e.target.closest('[data-ics-pass],[data-ics-train]'); if (!b) return;
        if (b.hasAttribute('data-ics-pass')) {
          var entry = null;
          if (T.lastPassData) for (var i = 0; i < T.lastPassData.data.length; i++)
            if (T.lastPassData.data[i].label === b.getAttribute('data-ics-pass')) { entry = T.lastPassData.data[i]; break; }
          if (!entry || !entry.passes.length) return;
          var p = entry.passes[0];
          downloadIcs('See the ' + entry.label + ' fly over!', p.riseT, p.setT || new Date(p.riseT.getTime() + 600000),
            entry.label + ' passes over your sky ' + T.fmtT(p.riseT) + ' \u2014 look ' + T.compass(p.riseAz) + ' to ' + T.compass(p.setAz) + '! Computed by the Skynet Nexus Space Center.');
        } else {
          var t = lastTrains[+b.getAttribute('data-ics-train')]; if (!t) return;
          downloadIcs('Starlink train flyover!', t.riseT, new Date(t.riseT.getTime() + 600000),
            'A Starlink B.satellite train (' + t.count + ' satellites in a row!) crosses your sky ' + T.fmtT(t.riseT) + '. Computed by the Skynet Nexus Space Center.');
        }
      });

      // ---------- FEATURE 6: Starlink train predictor ----------
      var lastTrains = [];
      function renderTrains(obs, now) {
        var box = document.getElementById('train-list'); if (!box) return;
        try {
          var sl = B.sats.filter(function (sp) { return /STARLINK/i.test(sp.userData.name || ''); })
            .sort(function (a, b) { return parseInt(b.userData.id, 10) - parseInt(a.userData.id, 10); }).slice(0, 14);
          var evs = [];
          sl.forEach(function (sp) {
            var ps = []; try { ps = T.findPasses(sp.userData.rec, obs, now, 48); } catch (e) {}
            ps.forEach(function (p) { evs.push({ riseT: p.riseT, maxEl: p.maxEl, riseAz: p.riseAz, setAz: p.setAz }); });
          });
          evs.sort(function (a, b) { return a.riseT - b.riseT; });
          var groups = [], g = null;
          evs.forEach(function (e) {
            if (g && e.riseT - g.riseT < 4 * 60000) { g.count++; if (e.maxEl > g.maxEl) g.maxEl = e.maxEl; }
            else { g = { riseT: e.riseT, maxEl: e.maxEl, riseAz: e.riseAz, setAz: e.setAz, count: 1 }; groups.push(g); }
          });
          groups = groups.filter(function (x) { return x.count >= 3; }).slice(0, 5);
          lastTrains = groups;
          box.innerHTML = groups.length ? groups.map(function (t, i) {
            var ms = t.riseT.getTime() - Date.now();
            return '<div class="passcard"><div class="pname">\uD83D\uDE82 Starlink train \u2014 ' + t.count + ' satellites in a row!</div>' +
              '<div class="pwhen">' + T.fmtT(t.riseT) + '</div>' +
              '<div class="pdet">Flies ' + T.compass(t.riseAz) + ' \u2192 ' + T.compass(t.setAz) + ' \u00B7 peaks ' + Math.round(t.maxEl) + '\u00B0 up</div>' +
              '<div class="pcount">' + (ms < 0 ? '\uD83D\uDEF0\uFE0F Overhead right now \u2014 go outside!' : '\u23F0 ' + T.countdown(ms) + ' \u2014 go outside!') + '</div>' +
              '<div class="trow"><button class="tbtn" data-ics-train="' + i + '">\uD83D\uDCC5 Add to calendar</button></div></div>';
          }).join('') : '<p class="tsub">No fresh trains in the next 48h \u2014 check back after a Starlink launch!</p>';
        } catch (e) { box.innerHTML = '<p class="tsub">Train scan hiccup \u2014 try again.</p>'; }
      }

      // ---------- FEATURE 4: AR Sky Pointer ----------
      var skyOn = false, skyGroup = null, skyLabels = [], skyTimer = null, skySession = null,
          skyHeading = null, skyTilt = null, skyGotOri = false;
      function skyBright() {
        var out = [];
        [['ISS', function () { return B.heroSats.iss || B.satById['25544']; }],
         ['Tiangong', function () { return B.heroSats.tiangong || B.satById['48274']; }],
         ['Hubble', function () { return B.heroSats.hubble || B.satById['20580']; }],
         ['Terra', function () { return B.satById['25994']; }],
         ['Aqua', function () { return B.satById['27424']; }]].forEach(function (pair) {
          var sp = null; try { sp = pair[1](); } catch (e) {}
          if (sp) out.push({ label: pair[0], sp: sp });
        });
        return out;
      }
      function skyOri(e) {
        if (e.alpha == null) return;
        skyGotOri = true; skyHeading = e.alpha;
        skyTilt = 90 - (e.beta == null ? 90 : e.beta);
      }
      function skyUpdate() {
        if (!skyOn) return;
        var obs = T.getObserver(); if (!obs) return;
        var obsE = T.obsGeo(obs.lat, obs.lon), now = new Date(), best = null;
        skyLabels.forEach(function (o) { if (o.parent) o.parent.remove(o); });
        skyLabels = [];
        skyBright().forEach(function (b) {
          var L = null; try { L = T.satLook(b.sp.userData.rec, now, obsE); } catch (e) {}
          if (!L || L.el <= 2) return;
          var relAz = L.az - (skyHeading == null ? 0 : skyHeading), relEl = L.el - (skyTilt == null ? 0 : skyTilt);
          var rA = relAz * Math.PI / 180, rE = relEl * Math.PI / 180, d = 4;
          var spr = B.makeLabelSprite([b.label, Math.round(L.el) + '\u00B0 up']);
          spr.position.set(Math.sin(rA) * Math.cos(rE) * d, Math.sin(rE) * d, -Math.cos(rA) * Math.cos(rE) * d);
          spr.scale.set(0.35, 0.35 * spr.scale.y / spr.scale.x, 1);
          B.camera.add(spr); skyLabels.push(spr);
          if (!best || L.el > best.el) best = { label: b.label, relAz: relAz, el: L.el };
        });
        if (best) {
          var dir = best.relAz > 12 ? 'right' : best.relAz < -12 ? 'left' : 'straight ahead';
          B.arStatus('\uD83D\uDCCD ' + best.label + ' is highest (' + Math.round(best.el) + '\u00B0 up) \u2014 look ' + dir +
            (Math.abs(best.relAz) > 12 ? ' (' + Math.round(Math.abs(best.relAz)) + '\u00B0)' : '') + ' \u00B7 Back exits');
        } else B.arStatus('\uD83D\uDCF1 Sky mode \u2014 no bright satellites above your horizon right now \u00B7 Back exits');
      }
      function endSky(reason) {
        skyOn = false;
        if (skyTimer) { clearInterval(skyTimer); skyTimer = null; }
        window.removeEventListener('deviceorientation', skyOri);
        skyLabels.forEach(function (o) { if (o.parent) o.parent.remove(o); });
        skyLabels = [];
        if (skyGroup) { B.scene.remove(skyGroup); skyGroup = null; }
        B.world.visible = true;
        var sb = document.getElementById('arskybtn'); if (sb) sb.textContent = '\uD83D\uDCF1 Sky';
        B.arStatus(reason || 'Sky mode ended');
      }
      function startSky() {
        if (skyOn) return;
        if (!T.getObserver()) { B.toast('Set your location in \uD83D\uDD2D Tonight first!'); B.openTab('tonight'); return; }
        function go() {
          navigator.xr.isSessionSupported('immersive-ar').then(function (ok) {
            if (!ok) { B.arStatus('Sky mode: AR not supported on this device'); return; }
            skyGotOri = false; skyHeading = null; skyTilt = null;
            window.addEventListener('deviceorientation', skyOri);
            navigator.xr.requestSession('immersive-ar', { optionalFeatures: ['local-floor'] }).then(function (session) {
              skySession = session; skyOn = true;
              B.renderer.xr.setSession(session);
              B.world.visible = false;
              B.scene.add(B.camera);
              skyGroup = new B.THREE.Group(); B.scene.add(skyGroup);
              var sb = document.getElementById('arskybtn'); if (sb) sb.textContent = '\uD83D\uDCF1 Sky on\u2026';
              B.arStatus('\uD83D\uDCF1 Sky mode \u2014 point your phone at the sky \u00B7 Back exits');
              setTimeout(function () {
                if (skyOn && !skyGotOri) { try { session.end(); } catch (e) {} endSky('\uD83D\uDCF1 No motion sensors found \u2014 sky mode needs them'); }
              }, 4000);
              skyUpdate();
              skyTimer = setInterval(skyUpdate, 1500);
              session.addEventListener('end', function () { endSky('Sky mode ended \u2014 tap Sky to go again'); });
            }).catch(function () { window.removeEventListener('deviceorientation', skyOri); B.arStatus('Sky mode: could not start'); });
          }).catch(function () { B.arStatus('Sky mode: could not start'); });
        }
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
          DeviceOrientationEvent.requestPermission().then(function (r) {
            if (r === 'granted') go(); else B.toast('Motion access denied \u2014 sky mode needs it');
          }).catch(function () { B.toast('Motion access blocked'); });
        } else go();
      }
      if ('xr' in navigator) {
        navigator.xr.isSessionSupported('immersive-ar').then(function (ok) {
          if (!ok) return;
          var sb = document.getElementById('arskybtn');
          if (sb) { sb.style.display = 'inline-block'; sb.onclick = startSky; }
        }).catch(function () {});
      }
  T.afterPasses = renderTrains;
})();
