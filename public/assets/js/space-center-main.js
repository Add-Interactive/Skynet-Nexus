
    import * as THREE from 'three';
    var FACTS = {
      iss: { t: 'International Space Station', p: 'The ISS is as big as a football field! Six astronauts live there, circling Earth every 90 minutes — that\'s 16 sunrises and sunsets every single day.' },
      tiangong: { t: 'Tiangong Space Station', p: 'Tiangong means "Heavenly Palace" — it\'s China\'s space station. Three astronauts live and work there, running science experiments high above Earth.' },
      hubble: { t: 'Hubble Space Telescope', p: 'Hubble has taken over 1.5 million pictures of space! It helped scientists figure out how old the universe is — about 13.8 billion years.' },
      starlink: { t: 'Starlink Satellite', p: 'This satellite beams internet down to places cables can\'t reach — ships at sea, airplanes, and remote villages. Thousands of them work together like a team!' },
      noaa: { t: 'Weather Satellite', p: 'Weather satellites stare at Earth around the clock, tracking hurricanes and storms so forecasters can warn people in time to stay safe.' },
      def: { t: 'Satellite', p: 'This satellite is working hard above Earth — beaming signals, taking pictures of our planet, or doing science experiments in space!' },
      oneweb: { t: 'OneWeb Satellite', p: 'OneWeb satellites beam internet to schools, airplanes, and ships — a whole team of them circling Earth together!' },
      kuiper: { t: 'Kuiper Satellite', p: 'Amazon\'s Kuiper satellites are building a space-internet network for homes and villages that don\'t have good connections yet.' },
      iridium: { t: 'Iridium Satellite', p: 'Iridium satellites carry phone calls and texts from the most remote places on Earth — even the middle of the ocean!' }
    };
    // ---- Object encyclopedia: rich profiles for satellites, stations, rockets, pads ----
    var OBJPROF = null, profByKey = {}, profById = {}, selProf = null;
    function normKey(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
    fetch('../assets/data/space-center/object-profiles.json').then(function (r) { return r.json(); }).then(function (d) {
      OBJPROF = d || {};
      Object.keys(OBJPROF.profiles || {}).forEach(function (pid) {
        var p = OBJPROF.profiles[pid]; p.pid = pid; profById[pid] = p;
        (p.keys || []).forEach(function (k) { profByKey[normKey(k)] = p; });
      });
    }).catch(function () { OBJPROF = null; });
    function findSatProfile(u) {
      if (!OBJPROF) return null;
      var p = profByKey[normKey(String(u.id))] || profByKey[normKey(u.name)] || profByKey[normKey(u.tag || '')];
      if (p) return p;
      var n = (u.name || '').toUpperCase(), kw = OBJPROF.fleetKeywords || {}, k;
      for (k in kw) { if (n.indexOf(k) !== -1) return profById[kw[k]]; }
      return null;
    }
    function timeInOrbit(p) {
      var d = p.launchDate ? new Date(p.launchDate + 'T00:00:00Z') : new Date((p.launchYear || 2000) + '-01-01T00:00:00Z');
      var ms = Date.now() - d.getTime();
      if (isNaN(ms) || ms < 0) return '\u2014';
      var days = Math.floor(ms / 86400000), yrs = Math.floor(days / 365.25), rem = Math.floor(days - yrs * 365.25);
      return yrs > 0 ? yrs + ' yrs, ' + rem + ' days' : days + ' days';
    }
    function whereNowHtml(x) { return escapeHtml(x); }
    function profileCardHtml(p, ageLabel) {
      var h = '';
      if (p.image) h += '<img class="pimg" src="' + p.image + '" alt="' + escapeHtml(p.name) + '" loading="lazy" onerror="this.style.display=\'none\'"/>';
      if (p.imageCredit) h += '<div class="pcredit">' + escapeHtml(p.imageCredit) + '</div>';
      var _rows = [['BUILDER', p.builder || '\u2014'], ['LAUNCHED', p.launchYear || '\u2014'],
        [ageLabel || 'TIME IN ORBIT', '<span class="p-age">' + timeInOrbit(p) + '</span>'],
        ['DESIGN LIFE', p.designLife || '\u2014']];
      if (p.missionType) _rows.push(['MISSION TYPE', { 'student-built': '\uD83C\uDF93 Student-built', 'classroom-link': '\uD83C\uDFEB Classroom link', 'citizen-science': '\uD83D\uDD2C Citizen science' }[p.missionType] || p.missionType]);
      if (p.status === 'retired') _rows.push(['STATUS', '\uD83D\uDD34 Retired']);
      if (p.whereNow) _rows.push(['WHERE NOW', whereNowHtml(p.whereNow)]);
      h += rowsHtml(_rows);
      if (p.funFact) h += '<div class="pfact">\uD83C\uDF1F <b>Fun fact:</b> ' + escapeHtml(p.funFact) + '</div>';
      if (p.learnMore) h += '<a class="pmore" href="' + p.learnMore + '" target="_blank" rel="noopener">Learn more on Wikipedia \u2197</a>';
      return h;
    }
    function companyOf(name, tag) {
      var n = (name || '').toUpperCase();
      if (tag === 'iss') return 'iss';
      if (tag === 'tiangong') return 'tiangong';
      if (tag === 'hubble') return 'hubble';
      if (n.indexOf('STARLINK') !== -1) return 'spacex';
      if (n.indexOf('ONEWEB') !== -1) return 'oneweb';
      if (n.indexOf('KUIPER') !== -1) return 'kuiper';
      if (n.indexOf('IRIDIUM') !== -1) return 'iridium';
      if (tag === 'noaa' || n.indexOf('GOES') !== -1 || n.indexOf('METOP') !== -1) return 'noaa';
      return 'def';
    }
    var COMPANY_COLORS = { iss: 0xffe27a, tiangong: 0xff9d7a, hubble: 0xc4b5fd, spacex: 0xffffff, oneweb: 0xa855f7, kuiper: 0xffb020, iridium: 0xff7ab8, noaa: 0x38d17c, def: 0x1d4ed8 };
    var COMPANY_FACT = { iss: 'iss', tiangong: 'tiangong', hubble: 'hubble', spacex: 'starlink', oneweb: 'oneweb', kuiper: 'kuiper', iridium: 'iridium', noaa: 'noaa', def: 'def' };
    var PADS = [
      { n: 'Kennedy LC-39A', lat: 28.608, lon: -80.604, d: 'Where astronauts launch to the Moon and the space station!', k: ['39a', 'kennedy'], prof: 'pad39a' },
      { n: 'Cape Canaveral SLC-40', lat: 28.562, lon: -80.577, d: 'SpaceX\'s busiest launch pad — rockets lift off here almost every week.', k: ['slc-40', 'cape canaveral'], prof: 'padslc40' },
      { n: 'Vandenberg SLC-4E', lat: 34.632, lon: -120.611, d: 'California\'s spaceport — rockets here fly south over the ocean to polar orbits.', k: ['4e', 'vandenberg'], prof: 'padslc4e' },
      { n: 'Starbase, Texas', lat: 25.997, lon: -97.155, d: 'Home of Starship, the biggest rocket ever built. Mars starts here!', k: ['starbase', 'boca chica'], prof: 'padstarbase' },
      { n: 'Mahia, New Zealand', lat: -39.083, lon: 177.867, d: 'Rocket Lab\'s launch site — small Electron rockets carry small satellites to space.', k: ['mahia', 'lc-1'], prof: 'padmahia' },
      { n: 'Kourou, French Guiana', lat: 5.236, lon: -52.768, d: 'Europe\'s spaceport, near the equator — Earth\'s spin gives rockets an extra push here!', k: ['kourou', 'ela'], prof: 'padkourou' },
      { n: 'Tanegashima, Japan', lat: 30.375, lon: 130.957, d: 'Japan\'s beautiful island spaceport, launching H3 rockets and Moon missions.', k: ['tanegashima'], prof: 'padtanegashima' },
      { n: 'Jiuquan, China', lat: 40.957, lon: 100.298, d: 'China\'s historic launch site in the Gobi Desert — astronauts ride Long March rockets from here.', k: ['jiuquan'], prof: 'padjiuquan' }
    ];
    var MISSIONS = [
      { id: 'm-iss', em: '🛰️', t: 'Say hello to the ISS — click it!' },
      { id: 'm-tiangong', em: '🏮', t: 'Find China\'s station, Tiangong' },
      { id: 'm-hubble', em: '🔭', t: 'Spot the Hubble telescope' },
      { id: 'm-five', em: '✨', t: 'Meet 5 different satellites' },
      { id: 'm-pad', em: '🚀', t: 'Visit a launch pad' },
      { id: 'm-spin', em: '🌍', t: 'Spin Earth all the way around' },
      { id: 'm-search', em: '🔍', t: 'Find a satellite with search' },
      { id: 'm-filter', em: '🎛️', t: 'Hide a fleet with the filter' },
      { id: 'm-pause', em: '⏸️', t: 'Pause time' },
      { id: 'm-closeup', em: '🔎', t: 'Zoom in close on a satellite' },
      { id: 'm-ar', em: '📲', t: 'Place Earth on your table in AR' },
      { id: 'm-tour', em: '🎬', t: 'Take a guided tour' },
      { id: 'm-tonight', em: '🔭', t: 'Find tonight\'s next flyover' },
      { id: 'm-orbitlab', em: '🛠\uFE0F', t: 'Build a satellite in Orbit Lab' },
      { id: 'm-zones', em: '🗺\uFE0F', t: 'Open the Orbit Zones guide' },
      { id: 'm-stem', em: '🎓', t: 'Visit a STEM mission' },
      { id: 'm-science', em: '🔬', t: 'Meet a space telescope' },
      { id: 'm-debris', em: '🟠', t: 'Turn on the debris layer' },
      { id: 'm-cal', em: '📅', t: 'Save a pass to your calendar' },
      { id: 'm-train', em: '🚂', t: 'Spot a Starlink train' }
    ];
    var canvas = document.getElementById('scene');
    // Hardening: a WebGL failure used to throw here and leave the loading screen
    // stuck on "ACQUIRING SATELLITES…" with no visible error. Show the failure instead.
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    } catch (e) {
      var _ld0 = document.getElementById('loading');
      if (_ld0) _ld0.innerHTML = '<div>🛰️</div><div>3D GRAPHICS NOT AVAILABLE — TRY ANOTHER BROWSER OR DEVICE</div>';
      throw e;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.xr.enabled = true;
    // Hardening: a lost GPU context used to leave a frozen 3D view with no error.
    // Show the loading screen with a Reload path instead; a restored context restarts cleanly.
    canvas.addEventListener('webglcontextlost', function (ev) {
      ev.preventDefault();
      var _ldL = document.getElementById('loading');
      if (_ldL) { _ldL.style.display = 'flex'; _ldL.innerHTML = '<div>🛰️</div><div>GRAPHICS CONTEXT LOST — RELOAD TO RESTORE</div><div class="load-actions" style="display:flex"><button class="lbtn" type="button" onclick="window.location.reload()">Reload</button></div>'; }
    });
    canvas.addEventListener('webglcontextrestored', function () { window.location.reload(); });
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 100);
    camera.position.set(0, 0.6, 3.2);
    // ---- full camera navigation: orbit target + fly-to-satellite ----
    var camTarget = new THREE.Vector3(0, 0, 0);   // smoothed look-at point
    var camGoal = new THREE.Vector3(0, 0, 0);     // desired look-at point
    var camDist = 3.26, camGoalDist = 3.26;        // smoothed / desired distance
    var camDir = new THREE.Vector3(0, 0.6, 3.2).normalize(); // view direction
    var _orbQ = new THREE.Quaternion(), _upY = new THREE.Vector3(0, 1, 0), _right = new THREE.Vector3(), _camDirPrev = new THREE.Vector3(); // orbit-around-model temps
    var focusSat = null, _sv = new THREE.Vector3();
    function flyTo(sp) {
      focusSat = sp; camGoalDist = sp.userData.isPad ? 0.9 : sp.userData.destDist || 0.5;
      // Space Bay: travelling re-skins the bay walls to the destination.
      // Armored (2026-10-30): the bay is decoration — it must never be able
      // to break selection or flying, so its hook swallows its own errors
      // and takes the fast path for ordinary satellites and pads.
      try {
        if (sp.userData && sp.userData.isDestination) { var _bs = baySceneFor(sp); if (_bs) baySetScene(_bs); }
        else baySetScene('earth');
      } catch (e) { /* bay stays as-is; flying is unaffected */ }
      var u = sp.userData;
      document.getElementById('trackname').textContent = u.isPad ? u.pad.n : (u.name.length > 24 ? u.name.slice(0, 24) + '…' : u.name);
      document.getElementById('trackchip').classList.add('show');
    }
    function flyHome() {
      focusSat = null; camGoal.set(0, 0, 0); camGoalDist = 3.26;
      try { baySetScene('earth'); } catch (e) { /* bay only */ }
      document.getElementById('trackchip').classList.remove('show');
    }
    document.getElementById('trackx').onclick = function () {
      infopanel.classList.remove('show'); selected = null; selKind = null; clearOrbit(); flyHome();
    };
    var world = new THREE.Group(); scene.add(world); // everything spinnable lives here
    var R = 1;
    // stars
    (function () {
      var g = new THREE.BufferGeometry(), pos = new Float32Array(1200 * 3);
      for (var i = 0; i < 1200; i++) {
        var v = new THREE.Vector3().randomDirection().multiplyScalar(40);
        pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfeaff, size: 0.06, sizeAttenuation: true, transparent: true, opacity: 0.85 })));
    })();
    // earth (4096px + max anisotropy for sharp close-ups; falls back to the 1024 file until the 4096 one is pushed)
    var earthTex = new THREE.TextureLoader().load('../assets/img/earth-blue-marble-4096.jpg', undefined, undefined,
      function () { var fb = new THREE.TextureLoader().load('../assets/img/earth-blue-marble-1024.jpg');
        earth.material.map = fb; if (earth.material.emissiveMap) earth.material.emissiveMap = fb;
        earth.material.map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); earth.material.needsUpdate = true; });
    earthTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    var earth = new THREE.Mesh(
      new THREE.SphereGeometry(R, 64, 64),
      new THREE.MeshPhongMaterial({ map: earthTex })
    );
    world.add(earth);
    // atmosphere glow
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: (function () {
        var c = document.createElement('canvas'); c.width = c.height = 256;
        var x = c.getContext('2d'), gr = x.createRadialGradient(128, 128, 100, 128, 128, 128);
        gr.addColorStop(0, 'rgba(0,229,255,0)'); gr.addColorStop(0.82, 'rgba(0,229,255,0)');
        gr.addColorStop(0.92, 'rgba(0,229,255,0.35)'); gr.addColorStop(1, 'rgba(0,229,255,0)');
        x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
        return new THREE.CanvasTexture(c);
      })(), transparent: true, depthWrite: false
    }));
    glow.scale.setScalar(2.55); world.add(glow);
    // ---- Stella's Space Bay (2026-10-30, Jeff's direction) ----
    // The simulation no longer floats in open space: it is a hologram inside
    // a starship holo bay. The Earth and its live satellites hover over the
    // bay's projector platform, and the vista outside its windows changes
    // per destination (Earth orbit / Moon / Mars — see baySetScene). The bay lives in `scene`,
    // never in `world`, so spinning the globe never spins the room. This block
    // replaces the spacetime warp grid, removed at Jeff's direction.
    var bayGroup = new THREE.Group(); scene.add(bayGroup);
    var bayState = { ready: false, sceneName: 'earth', coneMat: null, shellMat: null, light: null, vistas: {}, setLoaded: false };
    function bayCanvas(w, h, draw) {
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      var t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
    }
    // The modeled set (2026-10-30, Jeff's direction): a real starship bay
    // modeled + textured in Blender at this room's exact scale
    // (public/assets/models/space-bay.glb — paneled hull walls, real window
    // openings, emitter panels, consoles, a tiered projector, ceiling hub)
    // replaces the first-pass procedural room. It carries its own
    // destination vistas — VistaEarth / VistaMoon / VistaMars backdrops
    // outside the windows — which baySetScene toggles per destination.
    // The set is carried by space-center-models.js, the module that already
    // brings GLTFLoader in statically for the satellite models, and handed
    // over through bayAttachSet below. (The first cut loaded it from here
    // via a dynamic import; on the live page the set never arrived and the
    // fallback room appeared, so the proven path carries it now.) If no
    // set attaches within a few seconds, the fallback room builds so the
    // hologram never floats in a void.
    var baySetTimer = setTimeout(function () { if (!bayState.setLoaded) bayFallbackRoom(); }, 6000);
    function bayAttachSet(set) {
      try {
        if (bayState.setLoaded || !set) return;
        clearTimeout(baySetTimer);
        (bayState.fallbackMeshes || []).forEach(function (m) { bayGroup.remove(m); });
        bayState.fallbackMeshes = [];
        set.position.y = -2.4;
        bayGroup.add(set);
        ['earth', 'moon', 'mars'].forEach(function (k) {
          var v = set.getObjectByName('Vista' + k.charAt(0).toUpperCase() + k.slice(1));
          if (v) { bayState.vistas[k] = v; v.visible = (k === bayState.sceneName); }
        });
        bayState.setLoaded = true;
      } catch (e) { bayFallbackRoom(); }
    }
    function bayFallbackRoom() {
      try {
        var fl = new THREE.Mesh(new THREE.CircleGeometry(15, 48), new THREE.MeshBasicMaterial({ color: 0x0a1424 }));
        fl.rotation.x = -Math.PI / 2; fl.position.y = -3; bayGroup.add(fl);
        var pr = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.68, 0.26, 40),
          new THREE.MeshPhongMaterial({ color: 0x1a2436, emissive: 0x050d16, shininess: 70, specular: 0x7fb2ff }));
        pr.position.y = -1.62; bayGroup.add(pr);
        bayState.fallbackMeshes = [fl, pr];
      } catch (e) { /* the room is decoration; never break the page */ }
    }
    // light cone from the projector into the hologram
    bayState.coneMat = new THREE.MeshBasicMaterial({
      map: bayCanvas(32, 256, function (x, w, h) {
        var lg = x.createLinearGradient(0, h, 0, 0);
        lg.addColorStop(0, 'rgba(150,242,255,0.6)'); lg.addColorStop(1, 'rgba(150,242,255,0)');
        x.fillStyle = lg; x.fillRect(0, 0, w, h);
      }), transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    var cone = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.32, 0.55, 48, 1, true), bayState.coneMat);
    cone.position.y = -1.22; bayGroup.add(cone);
    bayState.light = new THREE.PointLight(0x66d9ff, 30, 13, 1.8);
    bayState.light.position.set(0, -0.9, 0); bayGroup.add(bayState.light);
    // hologram treatment for the Earth itself: fresnel shell + faint lat/long wire
    bayState.shellMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x35c8ff) }, uStr: { value: 0.85 } },
      vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uStr; varying vec3 vN; varying vec3 vP; void main(){ vec3 v = normalize(-vP); float f = pow(1.0 - abs(dot(v, normalize(vN))), 3.2); gl_FragColor = vec4(uColor, 1.0) * f * uStr; }',
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    earth.add(new THREE.Mesh(new THREE.SphereGeometry(1.045, 48, 48), bayState.shellMat));
    earth.add(new THREE.Mesh(new THREE.SphereGeometry(1.02, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x35c8ff, wireframe: true, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false })));
    // The imagery itself is the hologram (Jeff, 2026-10-30: the glow used to
    // sit BEHIND the photographic globe). The Blue Marble texture now glows
    // with itself via emissiveMap — same texture object the runtime de-seam
    // repairs, so the fix applies to the glow too — cyan-tinted, scanlined,
    // while the real sun shading and night side keep working on top.
    earth.material.color.set(0xa8c8e0);
    earth.material.emissive = new THREE.Color(0x2fb9e8);
    earth.material.emissiveMap = earthTex;
    earth.material.emissiveIntensity = 0.55;
    earth.material.onBeforeCompile = function (sh) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= 0.90 + 0.10 * sin(gl_FragCoord.y * 1.9);');
    };
    earth.material.needsUpdate = true;
    bayState.ready = true;
    function baySceneFor(sp) {
      var u = (sp && sp.userData) || {};
      if (u.destKind === 'moon') return 'moon';
      if (u.destKind === 'mars') return 'mars';
      if (u.event && u.event.body) return u.event.body === 'mars' ? 'mars' : 'moon';
      var n = sp, hops = 0;
      while (n && hops < 5) {
        if (n.userData && n.userData.destKind === 'moon') return 'moon';
        if (n.userData && n.userData.destKind === 'mars') return 'mars';
        if (n.children) for (var i = 0; i < n.children.length; i++) {
          var cd = n.children[i].userData || {};
          if (cd.destKind === 'moon') return 'moon';
          if (cd.destKind === 'mars') return 'mars';
        }
        n = n.parent; hops++;
      }
      return null;
    }
    function baySetScene(name) {
      if (!bayState.ready) return;
      bayState.sceneName = name;
      ['earth', 'moon', 'mars'].forEach(function (k) {
        if (bayState.vistas[k]) bayState.vistas[k].visible = (k === name);
      });
      if (bayState.light) bayState.light.color.setHex(name === 'moon' ? 0xbfd4e6 : name === 'mars' ? 0xffb37a : 0x66d9ff);
    }
    window.__scBay = { setScene: baySetScene, sceneFor: baySceneFor, attachSet: bayAttachSet, get sceneName() { return bayState.sceneName; } };
    function bayPulse(t) {
      try { bayPulseInner(t); } catch (e) { /* the pulse must never break the render loop */ }
    }
    function bayPulseInner(t) {
      // the room hides itself in AR (the tabletop Earth is a guest in YOUR room there)
      bayGroup.visible = !arMode && !(renderer.xr && renderer.xr.isPresenting);
      if (!bayGroup.visible) return;
      var p = 0.5 + 0.5 * Math.sin(t * 2.2);
      if (bayState.light) bayState.light.intensity = 26 + 8 * p;
      if (bayState.coneMat) bayState.coneMat.opacity = 0.12 + 0.05 * p;
      if (bayState.shellMat) bayState.shellMat.uniforms.uStr.value = 0.78 + 0.14 * Math.sin(t * 1.7);
    }
    var sun = new THREE.DirectionalLight(0xffffff, 1.6); scene.add(sun);
    var _sunQ = new THREE.Quaternion(), _sunDir = new THREE.Vector3();
    scene.add(new THREE.AmbientLight(0x334455, 0.7));
    function llToVec3(lat, lon, altKm) {
      var phi = (90 - lat) * Math.PI / 180, theta = (lon + 180) * Math.PI / 180;
      var r = R * (1 + altKm / 6371);
      return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    }
    function sunDirection(date) {
      // subsolar point approximation
      var jd = date.getTime() / 86400000 + 2440587.5, n = jd - 2451545.0;
      var L = (280.460 + 0.9856474 * n) % 360, g = (357.528 + 0.9856003 * n) % 360 * Math.PI / 180;
      var lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
      var eps = 23.439 * Math.PI / 180;
      var dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
      var gmst = (18.697374558 + 24.06570982441908 * (jd - 2451545.0)) % 24;
      var lon = ((L - gmst * 15 + 540) % 360) - 180;
      return llToVec3(dec * 180 / Math.PI, lon, 0).normalize();
    }
    // satellite dot texture
    var dotTex = (function () {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 30);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(0,229,255,0.9)'); gr.addColorStop(1, 'rgba(0,229,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    var sats = [], satGroup = new THREE.Group(); world.add(satGroup);
    var heroSats = {};
    var clickedIds = new Set();
    var lastLaunchList = [];
        function closeSidepanel() {
      var sp2 = document.getElementById('sidepanel');
      if (sp2) sp2.classList.remove('open');
      document.querySelectorAll('.rbtn.on').forEach(function (b) { b.classList.remove('on'); });
    }
window.__scB = {
      get sats() { return sats; }, get satById() { return satById; },
      get padMeshes() { return padMeshes; }, get heroSats() { return heroSats; },
      get profById() { return profById; }, get selected() { return selected; },
      get world() { return world; }, get camera() { return camera; },
      get scene() { return scene; }, get renderer() { return renderer; },
      get infopanel() { return infopanel; }, get lastLaunches() { return lastLaunchList; },
      selectSat, showInfo, flyTo, flyHome, toast, openTab, complete, escapeHtml, simDate, closeSidepanel,
      findSatProfile, satLiveData, satRows, satOrbitShape, fleetName, profileCardHtml,
      makeLabelSprite, arStatus, THREE, satellite,
      cmp: {}, wireCompare: null, renderCompare: null, tools: null
    };
    function addSat(rec, name, tag, id) {
      var co = companyOf(name, tag);
      var mat = new THREE.SpriteMaterial({ map: dotTex, transparent: true, depthWrite: false, color: COMPANY_COLORS[co] });
      var sp = new THREE.Sprite(mat);
      var sz = (co === 'iss' || co === 'tiangong' || co === 'hubble') ? 0.038 : co === 'def' ? 0.018 : 0.024;
      sp.scale.setScalar(sz);
      sp.userData = { rec: rec, name: name, tag: tag, id: id, co: co };
      satGroup.add(sp); sats.push(sp);
      if (tag === 'iss' || tag === 'tiangong' || tag === 'hubble') heroSats[tag] = sp;
      return sp;
    }
    function propagate(sp, date) {
      try {
        var pv = satellite.propagate(sp.userData.rec, date);
        if (!pv || !pv.position) return null;
        var gd = satellite.eciToGeodetic(pv.position, satellite.gstime(date));
        return llToVec3(gd.latitude * 180 / Math.PI, gd.longitude * 180 / Math.PI, gd.height);
      } catch (e) { return null; }
    }
    // launch pads
    var padMeshes = [];
    var padTexC = new THREE.CanvasTexture((function () {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var x = c.getContext('2d'); x.fillStyle = '#ffb020';
      x.beginPath(); x.moveTo(32, 6); x.lineTo(44, 40); x.lineTo(32, 34); x.lineTo(20, 40); x.closePath(); x.fill();
      x.fillRect(28, 34, 8, 18);
      return c;
    })());
    PADS.forEach(function (p) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: padTexC, transparent: true, depthWrite: false }));
      sp.scale.setScalar(0.05);
      sp.position.copy(llToVec3(p.lat, p.lon, 30));
      sp.userData = { pad: p, isPad: true };
      world.add(sp); padMeshes.push(sp);
    });
    // missions
    var done = {};
    try { done = JSON.parse(localStorage.getItem('sc3d-missions') || '{}'); } catch (e) {}
    function renderMissions() {
      document.getElementById('mission-list').innerHTML = MISSIONS.map(function (m) {
        return '<div class="mission' + (done[m.id] ? ' done' : '') + '"><span class="em">' + m.em + '</span><span class="mt">' + m.t + '</span></div>';
      }).join('');
    }
    function toast(msg) {
      var t = document.getElementById('toast');
      t.textContent = '🏅 Mission complete: ' + msg;
      t.style.display = 'block';
      setTimeout(function () { t.style.display = 'none'; }, 2600);
    }
    function complete(id, label) {
      if (done[id]) return;
      done[id] = 1;
      try { localStorage.setItem('sc3d-missions', JSON.stringify(done)); } catch (e) {}
      renderMissions(); toast(label);
    }
    renderMissions();
    // ---- KeepTrack-style UI: icon rail, slide-out panel, info panel, time bar ----
    var infopanel = document.getElementById('infopanel');
    var sidepanel = document.getElementById('sidepanel');
    var frameNo = 0, paused = false, selKind = null, warpBeforePause = 1;
    function cssColor(hex) { return '#' + hex.toString(16).padStart(6, '0'); }
    function escapeHtml(x) { return String(x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    var FLEET_NAMES = { iss: 'ISS', tiangong: 'TIANGONG', hubble: 'HUBBLE', spacex: 'SPACEX · STARLINK', oneweb: 'ONEWEB', kuiper: 'AMAZON · KUIPER', iridium: 'IRIDIUM', noaa: 'WEATHER · NOAA', def: 'OTHERS' };
    function fleetName(co) { return FLEET_NAMES[co] || 'OTHERS'; }
    function openTab(tab) {
      document.querySelectorAll('.rbtn').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-tab') === tab); });
      document.querySelectorAll('#sidepanel .tab').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-tab') === tab); });
      document.querySelectorAll('.tabpage').forEach(function (x) { x.classList.toggle('on', x.id === 'page-' + tab); });
      sidepanel.classList.toggle('wide', ['launches', 'students', 'moonmars', 'stories', 'tonight', 'orbitlab', 'zones', 'stem', 'science', 'tours', 'modellab'].indexOf(tab) !== -1);
      sidepanel.classList.add('open');
      if (typeof loadContent === 'function') loadContent(tab);
    }
    document.querySelectorAll('.rbtn').forEach(function (b) {
      b.onclick = function () {
        var tab = b.getAttribute('data-tab');
        if (b.classList.contains('on') && sidepanel.classList.contains('open')) {
          sidepanel.classList.remove('open'); b.classList.remove('on'); return;
        }
        openTab(tab);
        if (tab === 'search') document.getElementById('searchbox').focus();
      };
    });
    document.querySelectorAll('#sidepanel .tab').forEach(function (b) {
      b.onclick = function () { openTab(b.getAttribute('data-tab')); };
    });
    var satById = {};
    var searchbox = document.getElementById('searchbox'), searchresults = document.getElementById('searchresults');
    searchbox.addEventListener('input', function () {
      var q = searchbox.value.trim().toLowerCase();
      if (q.length < 2) { searchresults.innerHTML = q ? '<div class="sr-empty">Type a few letters…</div>' : ''; return; }
      var hits = sats.filter(function (sp) { return sp.userData.name.toLowerCase().indexOf(q) !== -1; }).slice(0, 8);
      searchresults.innerHTML = hits.length ? hits.map(function (sp) {
        var u = sp.userData;
        return '<div class="sr" data-id="' + u.id + '"><span class="dot" style="color:' + cssColor(COMPANY_COLORS[u.co]) + '">●</span><span>' + escapeHtml(u.name) + '</span></div>';
      }).join('') : '<div class="sr-empty">No satellites match "' + escapeHtml(q) + '"</div>';
      searchresults.querySelectorAll('.sr').forEach(function (el) {
        el.onclick = function () { var sp = satById[el.getAttribute('data-id')]; if (sp) { selectSat(sp); complete('m-search', 'Find a satellite with search!'); } };
      });
    });
    function satLiveData(sp, date) {
      try {
        var pv = satellite.propagate(sp.userData.rec, date);
        if (!pv || !pv.position || !pv.velocity) return null;
        var r = Math.sqrt(pv.position.x * pv.position.x + pv.position.y * pv.position.y + pv.position.z * pv.position.z);
        var v = Math.sqrt(pv.velocity.x * pv.velocity.x + pv.velocity.y * pv.velocity.y + pv.velocity.z * pv.velocity.z);
        return { alt: r - 6371, vel: v, period: 2 * Math.PI / sp.userData.rec.no };
      } catch (e) { return null; }
    }
    function satOrbitShape(sp) {
      try {
        var rec = sp.userData.rec, n0 = rec.no / 60, a = Math.pow(398600.8 / (n0 * n0), 1 / 3), e = rec.ecco;
        return { incl: rec.inclo * 180 / Math.PI, apogee: a * (1 + e) - 6371, perigee: a * (1 - e) - 6371 };
      } catch (err) { return null; }
    }
    function rowsHtml(rows) {
      return rows.map(function (r) { return '<div class="drow"><span class="dk">' + r[0] + '</span><span class="dv">' + r[1] + '</span></div>'; }).join('');
    }
    function satRows(sp) {
      var u = sp.userData, rows = [['NORAD ID', u.id], ['FLEET', fleetName(u.co)]];
      var ld = satLiveData(sp, simDate());
      if (ld) {
        rows.push(['ALTITUDE', Math.round(ld.alt).toLocaleString() + ' km']);
        rows.push(['SPEED', ld.vel.toFixed(2) + ' km/s']);
        rows.push(['PERIOD', ld.period.toFixed(1) + ' min']);
        rows.push(['ORBIT', ld.alt > 34000 ? 'GEO' : ld.alt > 2000 ? 'MEO' : 'LEO']);
      }
      var shape = satOrbitShape(sp);
      if (shape) {
        rows.push(['INCLINATION', shape.incl.toFixed(1) + '°']);
        rows.push(['APOGEE', Math.round(shape.apogee).toLocaleString() + ' km']);
        rows.push(['PERIGEE', Math.round(shape.perigee).toLocaleString() + ' km']);
      }
      return rows;
    }
    function showInfo(kind, title, rows, body, profHtml) {
      document.getElementById('infok').textContent = kind;
      document.getElementById('infot').textContent = title;
      document.getElementById('infoprof').innerHTML = profHtml || '';
      document.getElementById('infodata').innerHTML = rowsHtml(rows);
      document.getElementById('infop').textContent = body || '';
      infopanel.classList.remove('min');
      infopanel.classList.add('show');
      if (window.__scB && window.__scB.wireCompare) window.__scB.wireCompare(kind);
    }
    document.getElementById('infox').onclick = function () { infopanel.classList.remove('show'); selected = null; selKind = null; clearOrbit(); flyHome(); };
    document.getElementById('infomin').onclick = function (e) { e.stopPropagation(); infopanel.classList.add('min'); };
    infopanel.addEventListener('click', function () { if (infopanel.classList.contains('min')) infopanel.classList.remove('min'); });
    document.getElementById('trackchip').addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('#trackx')) return;
      if (infopanel.classList.contains('min')) { infopanel.classList.remove('min'); infopanel.classList.add('show'); }
    });
    function selectSat(sp) {
      var u = sp.userData;
      var __b = window.__scB;
      if (__b && __b.cmp.pick && !u.isPad && sp !== __b.cmp.a && __b.cmp.a && __b.renderCompare) { __b.cmp.pick = false; __b.renderCompare(__b.cmp.a, sp); return; }
      selected = sp;
      closeSidepanel();
      flyTo(sp);
      if (u.isPad) {
        selKind = 'pad'; selProf = null;
        clearOrbit();
        var pp = (u.pad.prof && profById[u.pad.prof]) || null;
        showInfo('LAUNCH PAD', pp ? pp.name : u.pad.n, [],
          pp ? pp.blurb : (u.pad.d + ' Tap a pad when it glows red — a launch is close!'),
          pp ? profileCardHtml(pp, 'SITE AGE') : '');
        complete('m-pad', 'Visit a launch pad!');
        return;
      }
      selKind = 'sat';
      drawOrbit(sp);
      var f = FACTS[COMPANY_FACT[u.co] || 'def'];
      var nm = u.name.length > 28 ? u.name.slice(0, 28) + '…' : u.name;
      selProf = findSatProfile(u);
      showInfo(u.tag === 'iss' ? 'SPACE STATION' : u.tag ? u.tag.toUpperCase() : 'SATELLITE',
        selProf ? selProf.name : (f.t === 'Satellite' ? nm : f.t), satRows(sp), selProf ? selProf.blurb : f.p,
        selProf ? profileCardHtml(selProf, 'TIME IN ORBIT') : '');
      clickedIds.add(u.id);
      if (window.ModelViewerAR) window.ModelViewerAR.attachViewButton(u.id);
      if (u.tag === 'iss') complete('m-iss', 'Say hello to the ISS!');
      if (u.tag === 'tiangong') complete('m-tiangong', 'Find Tiangong!');
      if (u.tag === 'hubble') complete('m-hubble', 'Spot Hubble!');
      if (clickedIds.size >= 5) complete('m-five', 'Meet 5 satellites!');
    }
    // full orbit path for the selected satellite (drawn correctly now the clock is real)
    var orbitLine = null;
    function clearOrbit() {
      if (orbitLine) { world.remove(orbitLine); orbitLine.geometry.dispose(); orbitLine.material.dispose(); orbitLine = null; }
    }
    function drawOrbit(sp) {
      clearOrbit();
      var ld = satLiveData(sp, simDate());
      if (!ld) return;
      var periodMs = ld.period * 60000, now = simDate().getTime(), pts = [], N = 128;
      for (var i = 0; i <= N; i++) {
        try {
          var pv = satellite.propagate(sp.userData.rec, new Date(now + (i / N) * periodMs));
          if (pv && pv.position) {
            var gd = satellite.eciToGeodetic(pv.position, satellite.gstime(new Date(now + (i / N) * periodMs)));
            pts.push(llToVec3(gd.latitude * 180 / Math.PI, gd.longitude * 180 / Math.PI, gd.height));
          }
        } catch (e) {}
      }
      if (pts.length < 2) return;
      orbitLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0xbff3ff, transparent: true, opacity: 0.45 })
      );
      world.add(orbitLine);
    }
    var hiddenFleets = {};
    function renderFleets() {
      var counts = {};
      sats.forEach(function (sp) { var c = sp.userData.co; counts[c] = (counts[c] || 0) + 1; });
      var order = ['iss', 'tiangong', 'hubble', 'spacex', 'oneweb', 'kuiper', 'iridium', 'noaa', 'def'];
      document.getElementById('fleet-list').innerHTML = order.map(function (c) {
        if (!counts[c]) return '';
        return '<div class="fleetrow' + (hiddenFleets[c] ? ' off' : '') + '" data-co="' + c + '"><span class="dot" style="color:' + cssColor(COMPANY_COLORS[c]) + '">●</span>' + fleetName(c) + '<small>' + counts[c] + '</small></div>';
      }).join('');
    }
    document.getElementById('fleet-list').addEventListener('click', function (e) {
      var row = e.target.closest ? e.target.closest('.fleetrow') : null;
      if (!row) return;
      var co = row.getAttribute('data-co');
      hiddenFleets[co] = !hiddenFleets[co];
      sats.forEach(function (sp) { if (sp.userData.co === co) sp.visible = !hiddenFleets[co]; });
      if (hiddenFleets[co] && selected && !selected.userData.isPad && selected.userData.co === co) {
        infopanel.classList.remove('show'); selected = null; selKind = null; clearOrbit(); flyHome();
      }
      renderFleets();
      complete('m-filter', 'Hide a fleet with the filter!');
    });
    document.querySelectorAll('[data-fly]').forEach(function (b) {
      b.onclick = function () {
        var sp = heroSats[b.getAttribute('data-fly')];
        if (sp && sp.visible !== false) selectSat(sp);
      };
    });
    document.getElementById('pausebtn').onclick = function () {
      warpStartOffset = simDate().getTime(); warpStart = Date.now();
      if (paused) { warp = warpBeforePause; } else { warpBeforePause = warp; warp = 0; complete('m-pause', 'Pause time!'); }
      paused = !paused;
      this.textContent = paused ? '▶' : '⏸';
    };
    // custom orbit controls
    var rotX = 0.35, targetRotX = 0.35, spinAccum = 0;
    var dragging = false, px = 0, py = 0;
    var pointers = {}, pinchStart = 0, pinched = false;
    canvas.addEventListener('pointerdown', function (e) {
      if (arMode) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var n = Object.keys(pointers).length;
      if (n === 2) {
        var pts = Object.keys(pointers).map(function (k) { return pointers[k]; });
        pinchStart = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        pinched = true; dragging = false;
      } else if (n === 1) { pinched = false; dragging = true; px = e.clientX; py = e.clientY; moved = 0; }
    });
    function endPointer(e) {
      delete pointers[e.pointerId];
      var keys = Object.keys(pointers);
      if (keys.length === 1) { px = pointers[keys[0]].x; py = pointers[keys[0]].y; dragging = true; pinchStart = 0; }
      else if (keys.length === 0) { dragging = false; pinchStart = 0; }
    }
    addEventListener('pointerup', endPointer);
    addEventListener('pointercancel', endPointer);
    var moved = 0;
    addEventListener('pointermove', function (e) {
      if (pointers[e.pointerId]) { pointers[e.pointerId].x = e.clientX; pointers[e.pointerId].y = e.clientY; }
      var keys = Object.keys(pointers);
      if (keys.length === 2 && pinchStart > 0) {
        var pts = [pointers[keys[0]], pointers[keys[1]]];
        var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (d > 0) { camGoalDist = Math.max(focusSat ? 0.06 : 1.15, Math.min(8, camGoalDist * (pinchStart / d))); pinchStart = d; }
        return;
      }
      if (!dragging) return;
      var dx = e.clientX - px, dy = e.clientY - py;
      moved += Math.abs(dx) + Math.abs(dy);
      if (focusSat && window.__scB && window.__scB.modelShowing) {
        // orbit the camera around the close-up 3D model instead of spinning the world
        _orbQ.setFromAxisAngle(_upY, -dx * 0.005);
        camDir.applyQuaternion(_orbQ);
        _camDirPrev.copy(camDir);
        _right.crossVectors(camDir, _upY).normalize();
        _orbQ.setFromAxisAngle(_right, -dy * 0.004);
        camDir.applyQuaternion(_orbQ).normalize();
        var polar = Math.acos(Math.max(-1, Math.min(1, camDir.y)));
        if (polar < 0.15 || polar > Math.PI - 0.15) camDir.copy(_camDirPrev); // keep the camera off the poles
      } else {
        world.rotation.y += dx * 0.005; spinAccum += Math.abs(dx * 0.005);
        targetRotX = Math.max(-1.2, Math.min(1.2, targetRotX + dy * 0.004));
      }
      px = e.clientX; py = e.clientY;
      if (spinAccum > Math.PI * 2) complete('m-spin', 'Spin Earth all the way around!');
    });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var lo = focusSat ? 0.06 : 1.7; // zoom right into a satellite when focused
      camGoalDist = Math.max(lo, Math.min(8, camGoalDist + e.deltaY * 0.002));
    }, { passive: false });
    // picking
    var ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), selected = null;
    var label = document.getElementById('satlabel');
    canvas.addEventListener('click', function (e) {
      if (arMode) return;
      if (pinched) { pinched = false; return; } // pinch-release, not a tap
      if (moved > 8) return; // was a drag
      ptr.x = (e.clientX / innerWidth) * 2 - 1; ptr.y = -(e.clientY / innerHeight) * 2 + 1;
      ray.setFromCamera(ptr, camera);
      var hits = ray.intersectObjects(satGroup.children.concat(padMeshes));
      if (!hits.length) { infopanel.classList.remove('show'); selected = null; selKind = null; clearOrbit(); flyHome(); return; }
      selectSat(hits[0].object);
    });
    // hover name tags (throttled raycast)
    var hoverlabel = document.getElementById('hoverlabel'), lastHover = 0;
    canvas.addEventListener('pointermove', function (e) {
      if (dragging) { hoverlabel.style.display = 'none'; return; }
      var now = performance.now();
      if (now - lastHover < 90) return;
      lastHover = now;
      ptr.x = (e.clientX / innerWidth) * 2 - 1; ptr.y = -(e.clientY / innerHeight) * 2 + 1;
      ray.setFromCamera(ptr, camera);
      var hits = ray.intersectObjects(satGroup.children.concat(padMeshes));
      if (!hits.length) { hoverlabel.style.display = 'none'; return; }
      var u = hits[0].object.userData;
      var nm = u.isPad ? u.pad.n : (u.name.length > 26 ? u.name.slice(0, 26) + '…' : u.name);
      hoverlabel.textContent = (u.isPad ? '🚀 ' : '🛰 ') + nm;
      hoverlabel.style.display = 'block';
      hoverlabel.style.left = (e.clientX + 14) + 'px';
      hoverlabel.style.top = (e.clientY - 10) + 'px';
    });
    canvas.addEventListener('pointerleave', function () { hoverlabel.style.display = 'none'; });
    // idle auto-rotate + esc to reset view
    var lastInteract = performance.now();
    ['pointerdown', 'wheel'].forEach(function (ev) {
      canvas.addEventListener(ev, function () { lastInteract = performance.now(); }, { passive: true });
    });
    addEventListener('keydown', function (e) {
      lastInteract = performance.now();
      if (e.key === 'Escape' && selected) {
        infopanel.classList.remove('show'); selected = null; selKind = null; clearOrbit(); flyHome();
      }
    });
    // time warp — simulated clock starts at real now, preserved across warp changes
    var warp = 1, warpStart = Date.now(), warpStartOffset = Date.now();
    function simDate() { return new Date(warpStartOffset + (Date.now() - warpStart) * warp); }
    document.querySelectorAll('.wbtn').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('.wbtn').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        if (paused) { paused = false; document.getElementById('pausebtn').textContent = '⏸'; }
        warpStartOffset = simDate().getTime();
        warpStart = Date.now();
        warp = +b.getAttribute('data-warp');
      };
    });
    /* ---------- Space Center content: launches / students / moon+mars / stories ---------- */
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    var LL2 = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=15';
    var PROVIDER_COLORS = {
      'SpaceX': '#00e5ff', 'NASA': '#4d7cff', 'Blue Origin': '#7c6cff',
      'Rocket Lab': '#ff3b5c', 'United Launch Alliance': '#ffb020',
      'Arianespace': '#38d17c', 'European Space Agency': '#38d17c',
      'Mitsubishi Heavy Industries': '#ff7ab8', 'Japan Aerospace Exploration Agency': '#ff7ab8',
      'Indian Space Research Organization': '#ffa94d',
      'China Aerospace Science and Technology Corporation': '#ff5c5c',
      'China National Space Administration': '#ff5c5c', 'LandSpace': '#c084fc'
    };
    function providerColor(p) {
      if (PROVIDER_COLORS[p]) return PROVIDER_COLORS[p];
      var k = Object.keys(PROVIDER_COLORS).find(function (k) { return (p || '').toLowerCase().indexOf(k.toLowerCase().split(' ')[0]) === 0; });
      return k ? PROVIDER_COLORS[k] : '#00e5ff';
    }
    function youtubeId(url) {
      var m = String(url || '').match(/(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      return m ? m[1] : null;
    }
    function fmtNet(iso) {
      try { return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
      catch (e) { return iso; }
    }
    function blurbFor(launch, blurbs) {
      var hay = ((launch.name || '') + ' ' + (launch.mission || '') + ' ' + (launch.provider || '')).toLowerCase();
      for (var i = 0; i < blurbs.blurbs.length; i++) {
        var b = blurbs.blurbs[i];
        for (var j = 0; j < b.keywords.length; j++) if (hay.indexOf(b.keywords[j].toLowerCase()) !== -1) return b;
      }
      return blurbs['default'];
    }
    function preciseEnough(l) {
      var p = (l.netPrecision || '').toLowerCase();
      return p.indexOf('second') !== -1 || p.indexOf('minute') !== -1 || p.indexOf('hour') !== -1;
    }
    function sysStatus(l) {
      var s = (l.status || '').toLowerCase();
      if (/success|liftoff|in flight|launched/.test(s)) return { cls: 'go', txt: 'LIFTOFF ✓' };
      if (/hold/.test(s)) return { cls: 'hold', txt: 'HOLD' };
      if (/go/.test(s)) return { cls: 'go', txt: 'GO FOR LAUNCH' };
      if (/tbd|to be|to be determined|to be confirmed/.test(s)) return { cls: 'wait', txt: 'TBD' };
      return { cls: 'wait', txt: (l.status || 'STANDING BY').toUpperCase().slice(0, 18) };
    }
    function normalize(api) {
      return (api.results || []).map(function (r) {
        var vids = r.vidURLs || [];
        return {
          id: r.id, name: r.name, net: r.net, netPrecision: (r.net_precision && r.net_precision.name) || '',
          status: (r.status && r.status.name) || '', provider: r.lsp_name || ((r.launch_service_provider && r.launch_service_provider.name) || ''),
          mission: (typeof r.mission === 'string' ? r.mission : (r.mission && r.mission.name)) || '',
          missionType: r.mission_type || (r.mission && r.mission.type) || '',
          pad: (typeof r.pad === 'string' ? r.pad : (r.pad && r.pad.name)) || '',
          location: r.location || ((r.pad && r.pad.location && r.pad.location.name) || ''),
          image: r.image || '', webcastLive: !!r.webcast_live, videoUrl: vids[0] || '', webcastUrl: vids[0] || ''
        };
      });
    }
    function normalizeSnapshot(snap) {
      return (snap.launches || []).map(function (r) {
        return {
          id: r.id, name: r.name, net: r.net, netPrecision: r.netPrecision || '', status: r.status || '',
          provider: r.provider || '', mission: r.mission || '', missionType: r.missionType || '',
          pad: r.pad || '', location: r.location || '', image: r.image || '',
          webcastLive: false, videoUrl: '', webcastUrl: ''
        };
      });
    }
    function launchCard(l, blurbs) {
      var b = blurbFor(l, blurbs), color = providerColor(l.provider), sys = sysStatus(l);
      var netMs = new Date(l.net).getTime();
      var countHtml = preciseEnough(l)
        ? '<div class="sc-count" data-net="' + netMs + '"><small>T-MINUS</small>--:--:--</div>'
        : '<div class="sc-count"><small>NO EARLIER THAN</small>' + esc(fmtNet(l.net)) + '</div>';
      var watchHtml = '';
      if (l.webcastLive && l.webcastUrl && youtubeId(l.webcastUrl)) {
        watchHtml = '<span class="sc-live-badge">● LIVE NOW</span>';
      } else if (l.videoUrl && youtubeId(l.videoUrl)) {
        watchHtml = '<a class="sc-btn ghost" href="' + esc(l.videoUrl) + '" target="_blank" rel="noopener">▶ Watch the webcast</a>';
      } else {
        var ch = (blurbs.providerChannels && blurbs.providerChannels[l.provider]) || 'https://www.youtube.com/results?search_query=' + encodeURIComponent(l.provider + ' launch live');
        watchHtml = '<a class="sc-btn ghost" href="' + esc(ch) + '" target="_blank" rel="noopener">▶ ' + esc(l.provider) + ' on YouTube</a>';
      }
      return '<article class="sc-card" style="--pc:' + color + '">'
        + '<div class="sc-card-body">'
        + '<div class="sc-sysrow"><span class="sc-provider" style="--pc:' + color + '"><span class="dot"></span>' + esc(l.provider || 'Spaceflight') + '</span>'
        + '<span class="sc-sys ' + sys.cls + '"><span class="sdot"></span>' + esc(sys.txt) + '</span></div>'
        + '<h3>' + esc(l.name) + '</h3>'
        + countHtml
        + '<div class="sc-net">🗓 ' + esc(fmtNet(l.net)) + '</div>'
        + '<div class="sc-blurb"><strong>' + esc(b.title) + '</strong>' + esc(b.text) + '</div>'
        + '<div class="sc-meta">' + (l.pad ? '<span>📍 ' + esc(l.pad) + '</span>' : '') + (l.missionType ? '<span>🎯 ' + esc(l.missionType) + '</span>' : '') + '</div>'
        + '<div class="sc-actions">' + watchHtml + '<button class="sc-btn ghost" data-ics-lid="' + esc(l.id || '') + '">\uD83D\uDCC5 Add to calendar</button></div>'
        + '</div></article>';
    }
    function renderLaunches(list, blurbs, note) {
      lastLaunchList = list;
      var now = Date.now();
      var upcoming = list.filter(function (l) { return new Date(l.net).getTime() > now - 6 * 3600000; })
        .sort(function (a, b) { return new Date(a.net) - new Date(b.net); });
      var future = upcoming.filter(function (l) { return new Date(l.net).getTime() > now; });
      var hero = future[0];
      document.getElementById('launch-hero').innerHTML = hero
        ? '<div class="cc-hero-label">▲ NEXT LAUNCH</div>' + launchCard(hero, blurbs) : '';
      var rest = upcoming.filter(function (l) { return !hero || l.id !== hero.id; }).slice(0, 8);
      document.getElementById('launch-grid').innerHTML = rest.length ? rest.map(function (l) { return launchCard(l, blurbs); }).join('')
        : '<div class="sc-empty">▸ NO FURTHER LAUNCHES ON THE BOARD</div>';
      document.getElementById('launch-note').textContent = note || '';
    }
    function loadLaunches(blurbs) {
      function useFallback(why) {
        fetch('../assets/data/space-center/launches-fallback.json', { cache: 'no-store' })
          .then(function (r) { return r.json(); })
          .then(function (snap) { renderLaunches(normalizeSnapshot(snap), blurbs, '▸ Saved board (' + (snap.updated || 'recent') + '). ' + (why || '')); })
          .catch(function () {
            document.getElementById('launch-grid').innerHTML = '<div class="sc-empty">▸ BOARD OFFLINE — FIXING THE ANTENNA 📡</div>';
          });
      }
      fetch(LL2, { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('ll2 ' + r.status); return r.json(); })
        .then(function (api) {
          if (!api.results) throw new Error('bad shape');
          renderLaunches(normalize(api), blurbs, '▸ LIVE DATA · AUTO-REFRESHING');
        })
        .catch(function () { useFallback('Live feed resting —'); });
    }
    function renderStudents(data) {
      var grid = document.getElementById('student-grid'), ps = (data && data.projects) || [];
      if (!ps.length) { grid.innerHTML = '<div class="sc-empty">▸ LOADING STUDENT MISSIONS…</div>'; return; }
      grid.innerHTML = ps.map(function (p) {
        return '<article class="sc-card" style="--pc:#a855f7"><div class="sc-card-body">'
          + '<span class="sc-provider" style="--pc:#a855f7"><span class="dot"></span>' + esc(p.org) + '</span>'
          + '<h3>' + esc(p.name) + '</h3>'
          + '<p style="margin:0;font-size:.9rem;line-height:1.6;color:var(--text-dim)">' + esc(p.kidFriendly) + '</p>'
          + '<div class="sc-meta"><span>🚀 ' + esc(p.flight) + '</span></div>'
          + '<div class="sc-actions"><a class="sc-btn ghost" href="' + esc(p.followUrl) + '" target="_blank" rel="noopener">Follow the mission →</a></div>'
          + '</div></article>';
      }).join('');
    }
    function renderMoonMars(data) {
      var grid = document.getElementById('player-grid'), ps = (data && data.players) || [];
      if (!ps.length) { grid.innerHTML = '<div class="sc-empty">▸ BUILDING DEEP SPACE BOARD…</div>'; return; }
      var colors = ['#00e5ff', '#4d7cff', '#7c6cff', '#38d17c', '#ff5c5c', '#ffb020'];
      grid.innerHTML = ps.map(function (p, i) {
        return '<article class="sc-card sc-player" style="--pc:' + colors[i % colors.length] + '"><div class="sc-card-body">'
          + '<h3>' + esc(p.player) + '</h3>'
          + '<div class="sc-target">🌙 <b>Moon:</b> ' + esc(p.moonTarget) + (p.moonDetail ? ' — ' + esc(p.moonDetail) : '') + '</div>'
          + '<div class="sc-target">🔴 <b>Mars:</b> ' + esc(p.marsTarget) + (p.marsDetail ? ' — ' + esc(p.marsDetail) : '') + '</div>'
          + '</div></article>';
      }).join('');
      if (data.gizmoOdds) {
        var box = document.getElementById('odds-box'); box.hidden = false;
        box.innerHTML = '<h3>🤖 Gizmo\u2019s honest odds</h3>'
          + '<p><span class="pct">' + esc(data.gizmoOdds.moonBase30yrPct || '') + '</span> ' + esc(data.gizmoOdds.moonBase30yr || '') + '</p>'
          + '<p><span class="pct">' + esc(data.gizmoOdds.marsCrew30yrPct || '') + '</span> ' + esc(data.gizmoOdds.marsCrew30yr || '') + '</p>';
      }
    }
    function renderStories() {
      fetch('../data/manifest.json', { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (m) {
          var arts = (m.articles || []).filter(function (a) { return a && a.cat === 'space'; })
            .sort(function (a, b) { return new Date(b.publishedAt || b.date || 0) - new Date(a.publishedAt || a.date || 0); }).slice(0, 6);
          document.getElementById('story-grid').innerHTML = arts.length ? arts.map(function (a) {
            return '<a class="sc-story" href="article.html?id=' + esc(a.id) + '">'
              + (a.heroImage ? '<img src="' + esc(a.heroImage) + '" alt="" loading="lazy"/>' : '')
              + '<div><h4>' + esc(a.title) + '</h4><p>' + esc(a.excerpt || '') + '</p></div></a>';
          }).join('') : '<div class="sc-empty">▸ SPACE REPORTS INCOMING</div>';
        }).catch(function () {});
    }
    var contentLoaded = {};
    function loadContent(tab) {
      if (contentLoaded[tab]) return;
      contentLoaded[tab] = true;
      if (tab === 'launches') {
        fetch('../assets/data/space-center/launch-blurbs.json').then(function (r) { return r.json(); })
          .catch(function () { return { blurbs: [], 'default': { title: 'Up, up, and away!', text: 'A rocket is heading to space.' }, providerChannels: {} }; })
          .then(function (blurbs) { loadLaunches(blurbs); });
      }
      else if (tab === 'students') {
        fetch('../assets/data/space-center/student-projects.json').then(function (r) { return r.json(); })
          .then(renderStudents).catch(function () { renderStudents(null); });
      }
      else if (tab === 'moonmars') {
        fetch('../assets/data/space-center/moon-mars.json').then(function (r) { return r.json(); })
          .then(renderMoonMars).catch(function () { renderMoonMars(null); });
      }
      else if (tab === 'stories') renderStories();
    }
    setInterval(function () {
      var now = Date.now();
      document.querySelectorAll('#page-launches [data-net]').forEach(function (el) {
        var diff = (+el.getAttribute('data-net')) - now;
        if (diff <= 0) { el.innerHTML = '<small>STATUS</small>LIFTOFF! 🎉'; return; }
        function p(n) { return String(n).padStart(2, '0'); }
        el.innerHTML = '<small>T-MINUS</small>' + (diff > 86400000 ? Math.floor(diff / 86400000) + 'd ' : '')
          + p(Math.floor(diff / 3600000) % 24) + ':' + p(Math.floor(diff / 60000) % 60) + ':' + p(Math.floor(diff / 1000) % 60);
      });
    }, 1000);
    // VR
    if ('xr' in navigator) {
      navigator.xr.isSessionSupported('immersive-vr').then(function (ok) {
        if (!ok) return;
        var vb = document.getElementById('vrbtn');
        vb.style.display = 'inline-flex';
        vb.onclick = function () {
          navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] }).then(function (s) {
            renderer.xr.setReferenceSpaceType('local-floor');
            renderer.xr.setSession(s);
            vb.textContent = '🥽 In VR — look around!';
          }).catch(function () {});
        };
      }).catch(function () {});
    }
    // AR — tabletop mode (Android Chrome with ARCore). Proven pattern: no DOM overlay,
    // placement via select events, tap always does something, Back button exits.
    var arMode = false, arPlaced = false, arGroup = null, reticle = null, crosshair = null,
        hitTestSource = null, hitTestRequested = false, arLabels = [], arInfoSprite = null,
        arInfoTimer = 0, arWatchdog = 0, arPromptSprite = null, arPromptTimer = 0,
        arButtons = [], arDomOverlay = false, arPlacing = false;
    // AR placement hooks for ar-placement.js (picker + persistent anchors).
    // Surgical: read-only access plus the existing arPlace(); the module owns all new UI/logic.
    window.__scB.ar = {
      isActive: function () { return arMode && !!(renderer.xr && renderer.xr.isPresenting); },
      isPlacing: function () { return arPlacing; },
      setPlacing: function (v) { arPlacing = !!v; },
      isEarthPlaced: function () { return arPlaced; },
      reticle: function () { return reticle; },
      refSpace: function () { try { return renderer.xr.getReferenceSpace(); } catch (e) { return null; } },
      session: function () { try { return renderer.xr.getSession(); } catch (e) { return null; } },
      earthObject: function () { return arGroup; },
      placeEarth: function (atPos) { arPlace(atPos); },
      resetEarth: function () {
        try {
          if (arGroup) scene.remove(arGroup);
          arGroup = new THREE.Group(); scene.add(arGroup); arGroup.add(world);
          world.scale.setScalar(0.18);
        } catch (e) {}
        arButtons = []; arPlaced = false;
      },
      prompt3D: function (msg, holdMs) { arPrompt3D(msg, holdMs); }
    };
    function arStatus(msg) {
      var el = document.getElementById('arstatus');
      el.style.display = 'inline-block'; el.textContent = msg;
    }
    // AR DOM overlay: is this tap on Space Center UI rather than the 3D scene?
    function arTapOnUI(x, y) {
      var els = document.querySelectorAll('.hud');
      for (var i = 0; i < els.length; i++) {
        var r = els[i].getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
      }
      return false;
    }
    // Track direct taps so satellites/buttons can be tapped where they appear (DOM overlay mode)
    window.__arTapX = null; window.__arTapY = null;
    document.addEventListener('pointerdown', function (e) {
      if (!arMode) return;
      window.__arTapX = e.clientX; window.__arTapY = e.clientY;
    }, true);
    function makeLabelSprite(lines) {
      var c = document.createElement('canvas'); c.width = 512; c.height = 64 + (lines.length - 1) * 56;
      var g = c.getContext('2d');
      g.fillStyle = 'rgba(3,10,22,0.85)';
      if (g.roundRect) { g.beginPath(); g.roundRect(6, 8, 500, c.height - 16, 36); g.fill(); }
      else g.fillRect(6, 8, 500, c.height - 16);
      g.strokeStyle = '#00e5ff'; g.lineWidth = 4;
      if (g.roundRect) { g.beginPath(); g.roundRect(6, 8, 500, c.height - 16, 36); g.stroke(); }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      lines.forEach(function (ln, i) {
        g.font = (i === 0 ? 'bold 44px' : '32px') + ' monospace';
        g.fillStyle = i === 0 ? '#eaffff' : '#8fd8ef';
        g.fillText(ln, 256, 52 + i * 56);
      });
      var tex = new THREE.CanvasTexture(c);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      var w = 0.5, h = w * c.height / 512;
      sp.scale.set(w, h, 1); sp.renderOrder = 999;
      return sp;
    }
    // AR in-view prompts: DOM #arstatus is invisible inside AR, mirror as 3D sprites.
    function arPrompt3D(msg, holdMs) {
      // DOM overlay: the real Space Center UI is visible, so mirror prompts as DOM text too
      if (arDomOverlay && msg) arStatus('AR \u00b7 ' + msg);
      try {
        if (arPromptSprite && arPromptSprite.parent) arPromptSprite.parent.remove(arPromptSprite);
        arPromptSprite = null; clearTimeout(arPromptTimer);
        if (!msg || !arMode || !camera) return;
        arPromptSprite = makeLabelSprite([msg]);
        arPromptSprite.position.set(0, 0.34, -0.9);
        camera.add(arPromptSprite);
        if (holdMs) arPromptTimer = setTimeout(function () { arPrompt3D(null); }, holdMs);
      } catch (e) {}
    }
    function arPickSat(clientX, clientY) {
      var v = new THREE.Vector3(), best = null, bestD = 110;
      for (var i = 0; i < sats.length; i++) {
        sats[i].getWorldPosition(v); v.project(camera);
        if (v.z > 1) continue;
        var d = Math.hypot((v.x * 0.5 + 0.5) * innerWidth - clientX, (-v.y * 0.5 + 0.5) * innerHeight - clientY);
        if (d < bestD) { bestD = d; best = sats[i]; }
      }
      return best;
    }
    function arButtonHit(clientX, clientY) {
      // nearest floating AR button to the tap point (direct tap w/ DOM overlay, else center crosshair)
      if (clientX == null) clientX = innerWidth / 2;
      if (clientY == null) clientY = innerHeight / 2;
      var v = new THREE.Vector3(), best = null, bestD = 80;
      for (var i = 0; i < arButtons.length; i++) {
        arButtons[i].getWorldPosition(v); v.project(camera);
        if (v.z > 1) continue;
        var d = Math.hypot((v.x * 0.5 + 0.5) * innerWidth - clientX, (-v.y * 0.5 + 0.5) * innerHeight - clientY);
        if (d < bestD) { bestD = d; best = arButtons[i]; }
      }
      return best;
    }
    function arDoButton(btn) {
      var a = btn.userData.arAction, s = arGroup.scale.x;
      if (a === '➕') { arGroup.scale.setScalar(Math.min(0.9, s * 1.35)); }
      else if (a === '➖') { arGroup.scale.setScalar(Math.max(0.09, s / 1.35)); }
      else if (a === '◀') { arGroup.rotation.y -= 0.4; }
      else if (a === '▶') { arGroup.rotation.y += 0.4; }
      if (a === '➕' || a === '➖') arPrompt3D('ZOOM ' + Math.round(arGroup.scale.x / 0.18 * 100) + '%', 1200);
      else arPrompt3D('ROTATED', 1200);
    }
    var AR_ZOOMS = [0.18, 0.32, 0.55];
    function arCycleZoom() {
      var s = arGroup.scale.x, next = AR_ZOOMS[0];
      for (var i = 0; i < AR_ZOOMS.length; i++) {
        if (AR_ZOOMS[i] > s + 0.001) { next = AR_ZOOMS[i]; break; }
      }
      arGroup.scale.setScalar(next);
      arPrompt3D('ZOOM ' + Math.round(next / 0.18 * 100) + '%', 1200);
    }
    function arShowInfo(sp) {
      if (arInfoSprite && arInfoSprite.parent) arInfoSprite.parent.remove(arInfoSprite);
      var u = sp.userData, lines;
      if (u.isPad) lines = ['🚀 ' + u.pad.n];
      else { var ld = satLiveData(sp); lines = ['🛰 ' + u.name, Math.round(ld.alt).toLocaleString() + ' km · ' + ld.spd.toFixed(1) + ' km/s']; }
      arInfoSprite = makeLabelSprite(lines);
      arInfoSprite.position.set(0, 0.14, 0);
      sp.add(arInfoSprite);
      clearTimeout(arInfoTimer);
      arInfoTimer = setTimeout(function () {
        if (arInfoSprite && arInfoSprite.parent) arInfoSprite.parent.remove(arInfoSprite);
        arInfoSprite = null;
      }, 6000);
    }
    function arPlace(atPos) {
      if (atPos && typeof atPos.x === 'number') {
        arGroup.position.copy(atPos);
      } else if (reticle && reticle.visible) {
        arGroup.position.copy(reticle.position);
      } else {
        // no surface found — float the Earth 1.2 m in front of the viewer
        var cp = new THREE.Vector3(), cd = new THREE.Vector3();
        camera.getWorldPosition(cp); camera.getWorldDirection(cd);
        arGroup.position.copy(cp).addScaledVector(cd, 1.2);
        arGroup.position.y -= 0.3;
      }
      arPlaced = true;
      // AR controls: world-anchored buttons — aim with the crosshair and tap
      if (arButtons.length === 0) {
        [['➕', 'ZOOM', 0.9], ['➖', 'ZOOM', 0.2], ['◀', 'ROT', -0.5], ['▶', 'ROT', -1.2]].forEach(function (b) {
          var sp = makeLabelSprite([b[0], b[1]]);
          sp.scale.multiplyScalar(1.8);
          sp.position.set(-2.0, b[2], 0);
          sp.userData.arAction = b[0];
          arGroup.add(sp);
          arButtons.push(sp);
        });
      }
      arPrompt3D('PLACED! AIM+TAP SATS/BUTTONS · 2×TAP ZOOM', 6000);
      if (reticle) reticle.visible = false;
      if (crosshair) crosshair.visible = true;
      complete('m-ar', 'Place Earth on your table in AR!');
      arStatus('AR: placed — point at a satellite + tap to inspect · Back exits');
    }
    function endAR(reason) {
      clearTimeout(arWatchdog);
      arMode = false; arPlaced = false; arPlacing = false; hitTestSource = null;
      if (window.ARPlacement && window.ARPlacement.onSessionEnd) { try { window.ARPlacement.onSessionEnd(); } catch (e) {} }
      arDomOverlay = false; document.body.classList.remove('ar-overlay');
      clearTimeout(arInfoTimer); arInfoSprite = null;
      arPrompt3D(null);
      arLabels.forEach(function (l) { if (l.parent) l.parent.remove(l); }); arLabels = [];
      arButtons = [];
      if (crosshair) { scene.remove(crosshair); crosshair = null; }
      if (reticle) { scene.remove(reticle); reticle = null; }
      if (arGroup) { scene.add(world); world.scale.setScalar(1); world.position.set(0, 0, 0); scene.remove(arGroup); arGroup = null; }
      var ab = document.getElementById('arbtn'); if (ab) ab.textContent = '📲';
      arStatus(reason || 'AR: session ended');
    }
    if ('xr' in navigator) {
      navigator.xr.isSessionSupported('immersive-ar').then(function (ok) {
        if (!ok) { arStatus('AR: not supported on this device'); return; }
        var ab = document.getElementById('arbtn');
        ab.style.display = 'inline-flex';
        ab.onclick = function () {
          arStatus('AR: starting — point at a table, move phone slowly, tap to place · Back exits');
          navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['hit-test'],
            optionalFeatures: ['dom-overlay'],
            domOverlay: { root: document.body }
          }).then(function (session) {
            renderer.xr.setReferenceSpaceType('local');
            renderer.xr.setSession(session).catch(function(){try{session.end()}catch(e){}endAR('AR: failed to start')});
            // DOM overlay: the full Space Center UI stays visible + tappable over the camera feed,
            // so the room itself becomes the Space Center. Falls back gracefully when unsupported.
            try { arDomOverlay = !!(session.domOverlayState); } catch (e) { arDomOverlay = false; }
            document.body.classList.toggle('ar-overlay', arDomOverlay);
            if (arDomOverlay) arStatus('AR \u00b7 full Space Center UI is live \u2014 tap menus directly, tap a satellite to inspect');
            arMode = true; arPlaced = false; arPlacing = false; hitTestRequested = false; hitTestSource = null;
            arGroup = new THREE.Group(); scene.add(arGroup); arGroup.add(world);
            arButtons = [];
            world.scale.setScalar(0.18); // tabletop Earth, ~36 cm across
            reticle = new THREE.Mesh(
              new THREE.RingGeometry(0.06, 0.075, 32),
              new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
            );
            reticle.rotation.x = -Math.PI / 2; reticle.visible = false; scene.add(reticle);
            // crosshair: point phone at a satellite, tap to inspect
            scene.add(camera);
            crosshair = new THREE.Mesh(
              new THREE.RingGeometry(0.008, 0.012, 24),
              new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.85, depthTest: false })
            );
            crosshair.position.set(0, 0, -0.8); crosshair.renderOrder = 1000; crosshair.visible = false;
            camera.add(crosshair);
            // floating name tags on the heroes (AR only)
            [['iss', 'ISS'], ['tiangong', 'TIANGONG'], ['hubble', 'HUBBLE']].forEach(function (pair) {
              var hero = heroSats[pair[0]];
              if (hero) { var lab = makeLabelSprite([pair[1]]); lab.position.set(0, 0.09, 0); hero.add(lab); arLabels.push(lab); }
            });
            var controller = renderer.xr.getController(0);
            var onSelect = function () {
              if (!arMode) return;
              var AP = window.ARPlacement;
              if (AP && AP.handleTap()) return;
              if (!arPlaced) { arPlace(); return; }
              var tx = (window.__arTapX != null) ? window.__arTapX : innerWidth / 2;
              var ty = (window.__arTapY != null) ? window.__arTapY : innerHeight / 2;
              window.__arTapX = window.__arTapY = null;
              // DOM overlay: taps on Space Center UI are handled by the DOM — never double-fire 3D
              if (arDomOverlay && arTapOnUI(tx, ty)) return;
              var now = performance.now();
              var isDouble = (now - (window.__arLastTap || 0)) < 350;
              window.__arLastTap = now;
              if (isDouble) { arCycleZoom(); return; }
              var btn = arButtonHit(tx, ty);
              if (btn) { arDoButton(btn); return; }
              var sp = arPickSat(tx, ty);
              if (sp) arShowInfo(sp);
            };
            controller.addEventListener('select', onSelect);
            session.addEventListener('end', function () { controller.removeEventListener('select', onSelect); endAR('AR: ended — tap AR to go again'); });
            arWatchdog = setTimeout(function () {
              if (arMode && !renderer.xr.isPresenting) {
                try { session.end(); } catch (e) {}
                endAR('AR: failed to start — exited safely, try again');
              }
            }, 15000);
            ab.textContent = '📲 AR active…';
            if (window.ARPlacement && window.ARPlacement.onSessionStart) {
              try { window.ARPlacement.onSessionStart(session); } catch (e) {}
            }
          }).catch(function () { arStatus('AR: could not start (cancelled?)'); });
        };
      }).catch(function () {});
    }
    // orbit trails for heroes
    // pad launch urgency from the launch board snapshot
    function markUrgentPads() {
      fetch('../assets/data/space-center/launches-fallback.json').then(function (r) { return r.json(); }).then(function (snap) {
        var now = Date.now();
        (snap.launches || []).forEach(function (l) {
          var t = new Date(l.net).getTime() - now;
          if (t > 0 && t < 30 * 3600000) {
            var hay = ((l.pad || '') + ' ' + (l.location || '')).toLowerCase();
            padMeshes.forEach(function (pm) {
              if (pm.userData.pad.k.some(function (k) { return hay.indexOf(k) !== -1; })) pm.userData.urgent = true;
            });
          }
        });
      }).catch(function () {});
    }
    // load satellites
    // Hardening: this gate used to wait forever on a stalled fetch — the loading
    // screen never cleared and no error appeared. Each TLE fetch now aborts after
    // 15s and a non-200 response is treated as a failure, so a stall reaches the
    // SIGNAL LOST path (and the watchdog's Reload) instead of hanging silently.
    function fetchJsonTimeout(url, ms) {
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;
      return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
        if (timer) clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
        return r.json();
      }).catch(function (e) {
        if (timer) clearTimeout(timer);
        throw e;
      });
    }
    // Daily TLE refresh: the server rebuilds this snapshot from CelesTrak once a
    // day (see server/space-tle-refresh.js). Prefer the live endpoint; fall back
    // to the bundled snapshots if it is unreachable, so the globe never goes blank.
    function renderTleFreshness(upd) {
      try {
        if (!upd || document.querySelector('[data-tle="daily"]')) return;
        var sub = document.querySelector('#topbar .sub');
        if (!sub) return;
        var days = Math.floor((Date.now() - new Date(upd + 'T00:00:00Z').getTime()) / 86400000);
        if (isNaN(days) || days < 0) days = 0;
        var age = days === 0 ? 'today' : (days === 1 ? 'yesterday' : days + ' days ago');
        var el = document.createElement('div');
        el.setAttribute('data-tle', 'daily');
        if (days > 14) {
          el.style.cssText = 'font-size:.62rem;color:#f0a35e;margin-top:3px;letter-spacing:.04em';
          el.textContent = '⚠️ Satellite positions may be slightly stale — orbital data from ' + upd;
        } else {
          el.style.cssText = 'font-size:.62rem;color:#9fb8cc;margin-top:3px;letter-spacing:.04em';
          el.textContent = '🛰 Orbital data: ' + upd + ' · ' + age;
        }
        sub.parentNode.insertBefore(el, sub.nextSibling);
      } catch (e) {}
    }
    function loadSats() {
      return fetchJsonTimeout('../api/space-center/tle', 15000).then(function (d) {
        return { sats: d.sats || [], updated: d.updated || null };
      }).catch(function () {
        return Promise.all([
          fetchJsonTimeout('../assets/data/space-center/tle-snapshot-a.json', 15000),
          fetchJsonTimeout('../assets/data/space-center/tle-snapshot-b.json', 15000)
        ]).then(function (parts) {
          return { sats: (parts[0].sats || []).concat(parts[1].sats || []), updated: parts[0].updated || null };
        });
      });
    }
    loadSats().then(function (snap) {
      renderTleFreshness(snap.updated);
      var list = snap.sats || [];
      var shown = 0;
      list.forEach(function (s) {
        try {
          var rec = satellite.twoline2satrec(s.l1, s.l2);
          var sp = addSat(rec, s.n.trim(), s.tag, s.id);
          if (sp) satById[s.id] = sp;
          shown++;
        } catch (e) {}
      });
      document.getElementById('satcount').textContent = shown;
      renderFleets();
      markUrgentPads();
      document.getElementById('loading').style.display = 'none';
      animate();
    }).catch(function () {
      document.getElementById('loading').innerHTML = '<div>📡</div><div>SIGNAL LOST — PLEASE RELOAD</div>';
    });
    var clock = new THREE.Clock();
    function animate() {
      renderer.setAnimationLoop(function (time, frame) {
        var dt = Math.min(clock.getDelta(), 0.1);
        var now = simDate();
        // AR hit-test: move the reticle over real-world surfaces until placed
        if (arMode && renderer.xr.isPresenting && frame) {
          var session = renderer.xr.getSession();
          if (!hitTestRequested) {
            hitTestRequested = true;
            session.requestReferenceSpace('viewer').then(function (viewerSpace) {
              session.requestHitTestSource({ space: viewerSpace }).then(function (src) { hitTestSource = src; });
            }).catch(function () {});
          }
          if (hitTestSource && reticle && (arPlacing || !arPlaced)) {
            var hits = frame.getHitTestResults(hitTestSource);
            if (hits.length > 0) {
              var pose = hits[0].getPose(renderer.xr.getReferenceSpace());
              reticle.visible = true;
              reticle.position.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
            } else reticle.visible = false;
          }
          if (!arPromptSprite) {
            var _ap = window.ARPlacement, _pt = _ap ? _ap.promptText() : null;
            if (_pt) arPrompt3D(_pt);
            else if (!arPlaced) arPrompt3D('TAP ANYWHERE TO PLACE EARTH');
          }
          if (window.ARPlacement) { try { window.ARPlacement.onFrame(frame); } catch (e) {} }
        }
        // sun — sunDirection() is in the world's local frame (same as llToVec3);
        // rotate into scene space so the terminator stays accurate while Earth spins/tilts
        _sunDir.copy(sunDirection(now));
        world.getWorldQuaternion(_sunQ);
        _sunDir.applyQuaternion(_sunQ);
        sun.position.copy(_sunDir.multiplyScalar(10));
        // satellites (staggered: 1/3 per frame keeps 1000+ sats at full speed)
        for (var i = 0; i < sats.length; i++) {
          if ((i + frameNo) % 3 !== 0) continue;
          var p = propagate(sats[i], now);
          if (p) sats[i].position.copy(p);
        }
        // sim clock + live info refresh
        var t = performance.now() / 1000;
        if (++frameNo % 15 === 0) {
          var sd = simDate();
          document.getElementById('simclock').textContent = sd.toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
          if (selKind === 'sat' && selected && infopanel.classList.contains('show')) {
            document.getElementById('infodata').innerHTML = rowsHtml(satRows(selected));
            var ageEl = document.querySelector('#infoprof .p-age');
            if (ageEl && selProf) ageEl.textContent = timeInOrbit(selProf);
          }
        }
        // pads pulse
        padMeshes.forEach(function (pm, idx) {
          var urgent = pm.userData.urgent;
          var s = 0.05 * (1 + 0.25 * Math.sin(t * (urgent ? 6 : 2) + idx));
          pm.scale.setScalar(s);
          pm.material.color.setHex(urgent ? 0xff3b5c : 0xffb020);
        });
        // Space Bay projector pulse — throttled to every 3rd frame
        if (frameNo % 3 === 0) bayPulse(t);
        // smooth tilt
        rotX += (targetRotX - rotX) * 0.08;
        world.rotation.x = rotX;
        // selected label (hidden in AR)
        if (selected && !arMode) {
          var v = selected.position.clone().applyMatrix4(world.matrixWorld).project(camera);
          if (v.z < 1) {
            label.style.display = 'block';
            label.style.left = ((v.x * 0.5 + 0.5) * innerWidth + 14) + 'px';
            label.style.top = ((-v.y * 0.5 + 0.5) * innerHeight - 14) + 'px';
            var u = selected.userData;
            label.textContent = u.isPad ? '🚀 ' + u.pad.n : '🛰 ' + (u.name.length > 24 ? u.name.slice(0, 24) + '…' : u.name);
          } else label.style.display = 'none';
        } else label.style.display = 'none';
        // close-up mission: zoomed right into a tracked satellite
        if (focusSat && !focusSat.userData.isPad && camGoalDist < 0.35) complete('m-closeup', 'Zoom in close on a satellite!');
        // idle auto-rotate after 10s of no interaction
        if (!dragging && !focusSat && !renderer.xr.isPresenting && performance.now() - lastInteract > 10000) {
          world.rotation.y += dt * 0.02;
        }
        // camera navigation (skipped in VR — headset drives the camera)
        if (!renderer.xr.isPresenting) {
          if (focusSat) { focusSat.getWorldPosition(_sv); camGoal.copy(_sv); }
          camTarget.lerp(camGoal, 0.1);
          camDist += (camGoalDist - camDist) * 0.12;
          camera.position.copy(camTarget).addScaledVector(camDir, camDist);
          if (camera.position.lengthSq() < 1.3225) camera.position.setLength(1.15); // earth R=1: never go inside
          camera.lookAt(camTarget);
        }
        renderer.render(scene, camera);
      });
    }
    addEventListener('resize', function () {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
    // ==================== PR #105: TOOLS (See It Tonight / Orbit Lab / Zones / STEM / Science) ====================
    (function () {
      'use strict';
      var MU = 398600.4418, RE = 6371;
      // ---------- shared orbital math ----------
      function zoneOf(altKm) {
        if (altKm < 2000) return 'LEO';
        if (Math.abs(altKm - 35786) <= 100) return 'GEO';
        if (altKm < 35700) return 'MEO';
        return 'HEO';
      }
      function periodMin(altKm) { var a = RE + altKm; return 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / MU) / 60; }
      function speedKms(altKm) { var a = RE + altKm; return Math.sqrt(MU / a); }
      function fmtPeriod(min) {
        if (min < 120) return Math.round(min) + ' minutes';
        var h = min / 60;
        if (h < 48) return h.toFixed(1) + ' hours';
        return (h / 24).toFixed(1) + ' days';
      }
      function compass(az) {
        if (az == null || isNaN(az)) return '?';
        var dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        return dirs[Math.round((((az % 360) + 360) % 360) / 45) % 8];
      }
      // ---------- PART D/E: tag -> tracked-sat matching ----------
      var tagSatCache = {};
      function satsForTag(tag) {
        if (!OBJPROF) return new Set();
        if (tagSatCache[tag]) return tagSatCache[tag];
        var ids = new Set(), nameIdx = {};
        sats.forEach(function (sp) { nameIdx[normKey(sp.userData.name)] = sp; });
        Object.keys(OBJPROF.profiles || {}).forEach(function (pid) {
          var p = OBJPROF.profiles[pid];
          if ((p.tags || []).indexOf(tag) === -1) return;
          (p.keys || []).forEach(function (k) {
            var sp = satById[k] || nameIdx[normKey(k)];
            if (sp) ids.add(sp.userData.id);
          });
        });
        tagSatCache[tag] = ids;
        return ids;
      }
      var isolateTag = null;
      function setIsolate(tag) {
        isolateTag = (isolateTag === tag) ? null : tag;
        var ids = isolateTag ? satsForTag(isolateTag) : null, n = 0;
        sats.forEach(function (sp) {
          var on = !isolateTag || ids.has(sp.userData.id);
          sp.material.opacity = on ? 1 : 0.07;
          if (on && isolateTag) n++;
        });
        document.getElementById('iso-stem').classList.toggle('on', isolateTag === 'stem');
        document.getElementById('iso-science').classList.toggle('on', isolateTag === 'science');
        if (isolateTag) {
          if (n === 0) toast('No ' + isolateTag + ' satellites in today\u2019s tracking set \u2014 explore their story cards below!');
          else toast('Isolating ' + n + ' ' + isolateTag + ' mission' + (n > 1 ? 's' : '') + ' \u2014 tap again to restore');
        }
      }
      document.getElementById('iso-stem').onclick = function () { setIsolate('stem'); complete('m-stem', 'Visited a STEM mission!'); };
      document.getElementById('iso-science').onclick = function () { setIsolate('science'); complete('m-science', 'Met a space telescope!'); };
      // ---------- PART D/E: browse cards ----------
      var MT_LABEL = {
        'student-built': ['\uD83C\uDF93 Student-built', 'tag-student'],
        'classroom-link': ['\uD83C\uDFEB Classroom link', 'tag-class'],
        'citizen-science': ['\uD83D\uDD2C Citizen science', 'tag-citizen']
      };
      function browseCard(p) {
        var h = '<div class="stcard">';
        if (p.image) h += '<img src="' + p.image + '" alt="' + escapeHtml(p.name) + '" loading="lazy" onerror="this.style.display=\'none\'"/>';
        h += '<h4>' + escapeHtml(p.name) + '</h4><div>';
        if (p.missionType && MT_LABEL[p.missionType]) h += '<span class="tagchip ' + MT_LABEL[p.missionType][1] + '">' + MT_LABEL[p.missionType][0] + '</span>';
        if (p.status === 'retired') h += '<span class="tagchip tag-retired">\uD83D\uDD34 RETIRED</span>';
        else if (p.type === 'science') h += '<span class="tagchip tag-active">\uD83D\uDFE2 ACTIVE</span>';
        h += '</div>';
        h += '<div class="smeta">' + escapeHtml(p.builder || '') + (p.launchYear ? ' \u00B7 Launched ' + p.launchYear : '') + (p.whereNow ? ' \u00B7 Now: ' + escapeHtml(p.whereNow) : '') + '</div>';
        h += '<p>' + escapeHtml(p.blurb || '') + '</p>';
        if (p.funFact) h += '<div class="pfact">\u2B50 <b>Fun fact:</b> ' + escapeHtml(p.funFact) + '</div>';
        var sp = null;
        (p.keys || []).forEach(function (k) { if (!sp) sp = satById[k]; });
        if (sp) h += '<button class="tbtn find3d" data-find="' + p.pid + '">\uD83D\uDEF0\uFE0F Find in 3D</button>';
        if (p.learnMore) h += '<div style="margin-top:6px"><a class="pmore" href="' + p.learnMore + '" target="_blank" rel="noopener">Learn more \u2197</a></div>';
        return h + '</div>';
      }
      function gridFind(e) {
        var b = e.target.closest ? e.target.closest('[data-find]') : null;
        if (!b || !OBJPROF) return;
        var p = OBJPROF.profiles[b.getAttribute('data-find')];
        if (!p) return;
        var sp = null;
        (p.keys || []).forEach(function (k) { if (!sp) sp = satById[k]; });
        if (sp) selectSat(sp);
      }
      function renderStemGrid(filter) {
        var el = document.getElementById('stem-grid');
        if (!el || !OBJPROF) return;
        var list = Object.keys(OBJPROF.profiles).map(function (k) { return OBJPROF.profiles[k]; })
          .filter(function (p) { return p.type === 'student' && (!filter || filter === 'all' || p.missionType === filter); });
        el.innerHTML = list.map(browseCard).join('') || '<p class="tsub">No missions in this group yet.</p>';
      }
      function renderScienceGrid() {
        var el = document.getElementById('science-grid');
        if (!el || !OBJPROF) return;
        var list = Object.keys(OBJPROF.profiles).map(function (k) { return OBJPROF.profiles[k]; })
          .filter(function (p) { return p.type === 'science'; });
        list.sort(function (a, b) { return (a.status === 'retired' ? 1 : 0) - (b.status === 'retired' ? 1 : 0); });
        el.innerHTML = list.map(browseCard).join('');
      }
      document.getElementById('stem-grid').addEventListener('click', gridFind);
      document.getElementById('science-grid').addEventListener('click', gridFind);
      document.querySelectorAll('#stem-chips .fchip').forEach(function (c) {
        c.onclick = function () {
          document.querySelectorAll('#stem-chips .fchip').forEach(function (x) { x.classList.remove('on'); });
          c.classList.add('on');
          renderStemGrid(c.getAttribute('data-mt'));
        };
      });
      // ---------- PART A: See It Tonight ----------
      var CITIES = [
        ['New York', 40.71, -74.0], ['Los Angeles', 34.05, -118.24], ['Chicago', 41.88, -87.63],
        ['Houston', 29.76, -95.37], ['San Francisco', 37.77, -122.42], ['Seattle', 47.61, -122.33],
        ['Miami', 25.76, -80.19], ['Denver', 39.74, -104.99], ['Boston', 42.36, -71.06],
        ['Washington DC', 38.91, -77.04], ['Atlanta', 33.75, -84.39], ['Dallas', 32.78, -96.8],
        ['Phoenix', 33.45, -112.07], ['Honolulu', 21.31, -157.86], ['Anchorage', 61.22, -149.9],
        ['Toronto', 43.65, -79.38], ['Vancouver', 49.28, -123.12], ['Montreal', 45.5, -73.57],
        ['Mexico City', 19.43, -99.13], ['Havana', 23.11, -82.37], ['Bogot\u00E1', 4.71, -74.07],
        ['Lima', -12.05, -77.04], ['S\u00E3o Paulo', -23.55, -46.63], ['Buenos Aires', -34.6, -58.38],
        ['Santiago', -33.45, -70.67], ['Reykjavik', 64.15, -21.94], ['London', 51.51, -0.13],
        ['Paris', 48.86, 2.35], ['Madrid', 40.42, -3.7], ['Rome', 41.9, 12.5],
        ['Berlin', 52.52, 13.4], ['Amsterdam', 52.37, 4.9], ['Stockholm', 59.33, 18.07],
        ['Warsaw', 52.23, 21.01], ['Athens', 37.98, 23.73], ['Istanbul', 41.01, 28.98],
        ['Moscow', 55.76, 37.62], ['Cairo', 30.04, 31.24], ['Lagos', 6.52, 3.38],
        ['Nairobi', -1.29, 36.82], ['Johannesburg', -26.2, 28.05], ['Dubai', 25.2, 55.27],
        ['Riyadh', 24.71, 46.68], ['Tehran', 35.69, 51.39], ['Karachi', 24.86, 67.01],
        ['Mumbai', 19.08, 72.88], ['Delhi', 28.61, 77.21], ['Dhaka', 23.81, 90.41],
        ['Bangkok', 13.76, 100.5], ['Singapore', 1.35, 103.82], ['Jakarta', -6.21, 106.85],
        ['Manila', 14.6, 120.98], ['Hong Kong', 22.32, 114.17], ['Beijing', 39.9, 116.4],
        ['Shanghai', 31.23, 121.47], ['Seoul', 37.57, 126.98], ['Tokyo', 35.68, 139.69],
        ['Sydney', -33.87, 151.21], ['Melbourne', -37.81, 144.96], ['Auckland', -36.85, 174.76]
      ];
      var citySel = document.getElementById('city-sel');
      CITIES.forEach(function (c) {
        var o = document.createElement('option');
        o.value = c[1] + ',' + c[2]; o.textContent = c[0];
        citySel.appendChild(o);
      });
      function getObserver() {
        try {
          var o = JSON.parse(localStorage.getItem('scObserver') || 'null');
          if (o && isFinite(o.lat) && isFinite(o.lon)) return o;
        } catch (e) {}
        return null;
      }
      function setObserver(lat, lon, name) {
        var o = { lat: +lat, lon: +lon, name: name || (lat + ', ' + lon) };
        try { localStorage.setItem('scObserver', JSON.stringify(o)); } catch (e) {}
        updateObsLabel();
      }
      function updateObsLabel() {
        var o = getObserver();
        document.getElementById('obs-label').textContent = o ?
          ('\uD83D\uDCCD ' + o.name + ' (' + o.lat.toFixed(2) + '\u00B0, ' + o.lon.toFixed(2) + '\u00B0)') :
          'No location set yet.';
      }
      document.getElementById('geo-btn').onclick = function () {
        if (!navigator.geolocation) { toast('Geolocation not available \u2014 pick a city instead'); return; }
        toast('Locating you\u2026');
        navigator.geolocation.getCurrentPosition(function (pos) {
          setObserver(pos.coords.latitude, pos.coords.longitude, 'My location');
          computePasses();
        }, function () { toast('Location blocked \u2014 pick a city instead'); });
      };
      citySel.onchange = function () {
        if (!citySel.value) return;
        var parts = citySel.value.split(',');
        setObserver(+parts[0], +parts[1], citySel.options[citySel.selectedIndex].text);
        computePasses();
      };
      document.getElementById('loc-set').onclick = function () {
        var la = parseFloat(document.getElementById('lat-in').value),
            lo = parseFloat(document.getElementById('lon-in').value);
        if (!isFinite(la) || !isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
          toast('Enter a valid latitude (-90..90) and longitude (-180..180)'); return;
        }
        setObserver(la, lo, 'Custom spot');
        computePasses();
      };
      function sunEci(date) {
        var jd = date.getTime() / 86400000 + 2440587.5, n = jd - 2451545.0;
        var L = (280.460 + 0.9856474 * n) * Math.PI / 180, g = (357.528 + 0.9856003 * n) * Math.PI / 180;
        var lam = L + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
        var eps = (23.439 - 0.0000004 * n) * Math.PI / 180;
        return new THREE.Vector3(Math.cos(lam), Math.cos(eps) * Math.sin(lam), Math.sin(eps) * Math.sin(lam));
      }
      function obsGeo(lat, lon) {
        // satellite.js ecfToLookAngles wants the observer as geodetic {longitude, latitude, height}
        return { longitude: lon * Math.PI / 180, latitude: lat * Math.PI / 180, height: 0 };
      }
      function sunElevObs(lat, lon, date, sv) {
        var dec = Math.asin(Math.max(-1, Math.min(1, sv.z))), ra = Math.atan2(sv.y, sv.x);
        var H = satellite.gstime(date) + lon * Math.PI / 180 - ra, phi = lat * Math.PI / 180;
        return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
      }
      function satLook(rec, date, obsE) {
        var pv;
        try { pv = satellite.propagate(rec, date); } catch (e) { return null; }
        if (!pv || !pv.position) return null;
        var ecf, look;
        try {
          ecf = satellite.eciToEcf(pv.position, satellite.gstime(date));
          look = satellite.ecfToLookAngles(obsE, ecf);
        } catch (e) { return null; }
        return { el: look.elevation * 180 / Math.PI, az: look.azimuth * 180 / Math.PI, pos: pv.position };
      }
      function isSunlit(eciKm, sv) {
        var d = eciKm.x * sv.x + eciKm.y * sv.y + eciKm.z * sv.z;
        if (d > 0) return true;
        var px = eciKm.x - sv.x * d, py = eciKm.y - sv.y * d, pz = eciKm.z - sv.z * d;
        return Math.sqrt(px * px + py * py + pz * pz) > RE;
      }
      function passVisible(rec, t, obs, obsE, sv) {
        var L = satLook(rec, t, obsE);
        if (!L || L.el < 15) return null;
        if (sunElevObs(obs.lat, obs.lon, t, sv) > -6 * Math.PI / 180) return null;
        if (!isSunlit(L.pos, sv)) return null;
        return L;
      }
      function refineEdge(rec, obs, obsE, tLo, tHi, rising) {
        var step = 10000;
        if (rising) {
          for (var tt = tLo.getTime(); tt <= tHi.getTime(); tt += step) {
            var t = new Date(tt), sv = sunEci(t), L = passVisible(rec, t, obs, obsE, sv);
            if (L) return { t: t, az: L.az };
          }
        } else {
          for (var t2 = tHi.getTime(); t2 >= tLo.getTime(); t2 -= step) {
            var tB = new Date(t2), svB = sunEci(tB), LB = passVisible(rec, tB, obs, obsE, svB);
            if (LB) return { t: tB, az: LB.az };
          }
        }
        var Lf = satLook(rec, rising ? tHi : tLo, obsE);
        return { t: rising ? tHi : tLo, az: Lf ? Lf.az : null };
      }
      function findPasses(rec, obs, t0, hours) {
        var obsE = obsGeo(obs.lat, obs.lon), step = 60000,
            N = Math.floor(hours * 3600000 / step), passes = [], cur = null, i, t, L, sv;
        for (i = 0; i <= N; i++) {
          t = new Date(t0.getTime() + i * step);
          sv = sunEci(t);
          L = passVisible(rec, t, obs, obsE, sv);
          if (L && !cur) cur = { riseT: t, maxEl: L.el, maxT: t };
          else if (L && cur) { if (L.el > cur.maxEl) { cur.maxEl = L.el; cur.maxT = t; } }
          else if (!L && cur) {
            var rs = refineEdge(rec, obs, obsE, new Date(cur.riseT.getTime() - step), cur.riseT, true);
            var st = refineEdge(rec, obs, obsE, cur.riseT, t, false);
            cur.riseT = rs.t; cur.riseAz = rs.az; cur.setT = st.t; cur.setAz = st.az;
            var bt = cur.maxT, be = cur.maxEl;
            for (var k = -6; k <= 6; k++) {
              var tt = new Date(cur.maxT.getTime() + k * 10000), svk = sunEci(tt), Lk = passVisible(rec, tt, obs, obsE, svk);
              if (Lk && Lk.el > be) { be = Lk.el; bt = tt; }
            }
            cur.maxEl = be; cur.maxT = bt;
            passes.push(cur); cur = null;
          }
        }
        if (cur) { cur.setT = new Date(t0.getTime() + hours * 3600000); cur.setAz = null; passes.push(cur); }
        return passes.filter(function (p) { return p.maxEl >= 15; });
      }
      function brightWord(el) { return el > 60 ? 'very bright \uD83C\uDF1F' : el > 30 ? 'bright \u2728' : 'faint \uD83D\uDD2D'; }
      function fmtT(d) {
        return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' +
               d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }
      function countdown(ms) {
        if (ms < 0) return 'happening now';
        var m = Math.floor(ms / 60000), h = Math.floor(m / 60);
        m = m % 60;
        return h > 0 ? ('in ' + h + 'h ' + m + 'm') : ('in ' + m + 'm');
      }
      var passTargets = [
        { label: 'ISS', get: function () { return heroSats.iss || satById['25544']; } },
        { label: 'Tiangong', get: function () { return heroSats.tiangong || satById['48274']; } },
        { label: 'Hubble', get: function () { return heroSats.hubble || satById['20580']; } },
        { label: 'Terra', get: function () { return satById['25994']; } },
        { label: 'Aqua', get: function () { return satById['27424']; } }
      ];
      var lastPassData = null;
      function computePasses() {
        var obs = getObserver();
        if (!obs) { toast('Set your location first!'); return; } complete('m-tonight', 'Checked tonight\u2019s flyovers!');
        document.getElementById('pass-list').innerHTML = '<p class="tsub">\uD83D\uDD2D Scanning the skies\u2026</p>';
        setTimeout(function () {
          var now = new Date(), out = [];
          passTargets.forEach(function (tg) {
            var sp = tg.get();
            if (!sp) return;
            var passes = [];
            try { passes = findPasses(sp.userData.rec, obs, now, 48); } catch (e) {}
            out.push({ label: tg.label, passes: passes });
          });
          lastPassData = { data: out };
          renderPasses();
          if (window.__scB.tools.afterPasses) window.__scB.tools.afterPasses(obs, now);
        }, 30);
      }
      function renderPasses() {
        if (!lastPassData) return;
        var nowMs = Date.now(), next = null;
        var html = lastPassData.data.map(function (d) {
          if (!d.passes.length)
            return '<div class="passcard"><div class="pname">' + d.label + '</div><div class="pdet">No visible passes in the next 48h from your spot. Try again tomorrow!</div></div>';
          var p = d.passes[0], ms = p.riseT.getTime() - nowMs;
          if (!next || p.riseT < next.riseT) next = { label: d.label, riseT: p.riseT };
          var more = d.passes.slice(1, 3).map(function (q) {
            return fmtT(q.riseT) + ' (' + compass(q.riseAz) + ' \u2192 ' + compass(q.setAz) + ', ' + Math.round(q.maxEl) + '\u00B0)';
          }).join('<br>');
          return '<div class="passcard"><div class="pname">\uD83D\uDEF0\uFE0F ' + d.label + '</div>' +
            '<div class="pwhen">' + fmtT(p.riseT) + '</div>' +
            '<div class="pdet">Flies ' + compass(p.riseAz) + ' \u2192 ' + compass(p.setAz) +
            ' \u00B7 peaks ' + Math.round(p.maxEl) + '\u00B0 up \u00B7 ' + brightWord(p.maxEl) + '</div>' +
            '<div class="pcount">' + (ms < 0 ? '\uD83D\uDEF0\uFE0F Overhead right now \u2014 go outside!' : '\u23F0 ' + countdown(ms) + ' \u2014 go outside!') + '</div>' +
            '<div class="trow"><button class="tbtn" data-ics-pass="' + escapeHtml(d.label) + '">\uD83D\uDCC5 Add to calendar</button></div>' +
            (more ? '<div class="pmore">Also:<br>' + more + '</div>' : '') + '</div>';
        }).join('');
        document.getElementById('pass-list').innerHTML = html;
        document.getElementById('pass-next').innerHTML = next ?
          '<div class="passcard" style="border-color:#ffe27a"><div class="pcount">\u2B50 Next up: ' + next.label + ' ' + countdown(next.riseT.getTime() - nowMs) + '</div></div>' : '';
      }
      document.getElementById('pass-go').onclick = computePasses;
      setInterval(function () { if (lastPassData) renderPasses(); }, 30000);
      // ---------- PART B: Orbit Lab ----------
      var labRing = null, labDot = null, labAngle = 0, labPeriodMs = 0;
      var X_AXIS = null;
      function labUpdate() {
        var alt = +document.getElementById('lab-alt').value, inc = +document.getElementById('lab-inc').value;
        document.getElementById('alt-val').textContent = alt.toLocaleString() + ' km';
        document.getElementById('inc-val').textContent = inc.toFixed(1) + '\u00B0';
        if (!X_AXIS) X_AXIS = new THREE.Vector3(1, 0, 0);
        var r = R * (1 + alt / RE);
        if (labRing) { world.remove(labRing); labRing.geometry.dispose(); labRing.material.dispose(); }
        if (labDot) { world.remove(labDot); labDot.material.dispose(); }
        var pts = [];
        for (var i = 0; i <= 128; i++) {
          var a = i / 128 * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
        }
        labRing = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0x7df3ff, transparent: true, opacity: 0.85 }));
        labRing.rotation.x = inc * Math.PI / 180;
        world.add(labRing);
        labDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xffe27a, transparent: true, depthWrite: false }));
        labDot.scale.setScalar(0.05);
        world.add(labDot);
        labPeriodMs = periodMin(alt) * 60000;
        labUpdateDot();
        var z = zoneOf(alt), T = periodMin(alt), v = speedKms(alt);
        var who = {
          LEO: 'The busy downtown \u2014 the ISS, Tiangong, Hubble, Starlink and Earth-photo satellites all live here.',
          MEO: 'The navigation highway \u2014 GPS, Galileo and GLONASS guide your phone from here.',
          GEO: 'The magic parking ring \u2014 TV and weather satellites hover over one spot forever.',
          HEO: 'The stretched loops \u2014 special missions that swing far out and swoop back in.'
        }[z];
        var cons = alt < 300 ? '\u26A0\uFE0F Too low! Air drag would burn your satellite up within months.' :
          alt < 600 ? 'Low and fast \u2014 it needs rocket boosts to stay up, just like the ISS.' :
          alt < 2000 ? 'Safe LEO cruising \u2014 but watch out, it\u2019s crowded up here!' :
          alt < 35700 ? 'MEO cruising \u2014 fewer neighbors, but harsher radiation.' :
          z === 'GEO' ? '\u2728 Perfect parking! It hovers over one spot on Earth forever.' :
          'Way out high \u2014 slow, lonely, and hard to reach.';
        document.getElementById('lab-read').innerHTML =
          '<div class="zone">' + z + '</div>' +
          '<div>\u23F1\uFE0F <b>Orbital period:</b> ' + fmtPeriod(T) + '</div>' +
          '<div>\uD83D\uDCA8 <b>Speed:</b> ' + v.toFixed(2) + ' km/s</div>' +
          '<div>\uD83C\uDFE0 <b>Who lives here:</b> ' + who + '</div>' +
          '<div>' + cons + '</div>';
      }
      function labUpdateDot() {
        if (!labRing || !labDot) return;
        var alt = +document.getElementById('lab-alt').value, inc = +document.getElementById('lab-inc').value;
        var r = R * (1 + alt / RE);
        var p = new THREE.Vector3(Math.cos(labAngle) * r, 0, Math.sin(labAngle) * r);
        p.applyAxisAngle(X_AXIS, inc * Math.PI / 180);
        labDot.position.copy(p);
      }
      setInterval(function () {
        if (!labRing || !labPeriodMs) return;
        labAngle += (2 * Math.PI) * (100 / labPeriodMs);
        labUpdateDot();
      }, 100);
      document.getElementById('lab-alt').addEventListener('input', function(){ complete('m-orbitlab', 'Built a satellite in Orbit Lab!'); labUpdate(); });
      document.getElementById('lab-inc').addEventListener('input', function(){ complete('m-orbitlab', 'Built a satellite in Orbit Lab!'); labUpdate(); });
      var PRESETS = { iss: [420, 51.6], gps: [20200, 55], geo: [35786, 0], molniya: [20190, 63.4] };
      document.querySelectorAll('[data-preset]').forEach(function (b) {
        b.onclick = function () {
          var pr = PRESETS[b.getAttribute('data-preset')];
          if (!pr) return;
          document.getElementById('lab-alt').value = pr[0];
          document.getElementById('lab-inc').value = pr[1];
          labUpdate();
          document.getElementById('lab-note').textContent = b.getAttribute('data-preset') === 'molniya' ?
            'Note: a real Molniya flies a stretched ellipse \u2014 this shows its average height (the 12-hour period matches!).' : '';
        };
      });
      // ---------- PART C: zone shells ----------
      var zoneObjs = {};
      function zoneToggle(key, make) {
        var b = document.getElementById('zone-' + key);
        b.onclick = function () {
          if (zoneObjs[key]) {
            world.remove(zoneObjs[key]);
            zoneObjs[key].geometry.dispose(); zoneObjs[key].material.dispose();
            zoneObjs[key] = null; b.classList.remove('on');
          } else {
            zoneObjs[key] = make(); world.add(zoneObjs[key]); b.classList.add('on'); complete('m-zones', 'Explored the orbit zones!');
          }
        };
      }
      zoneToggle('leo', function () {
        return new THREE.Mesh(new THREE.SphereGeometry(R * (1 + 2000 / RE), 48, 32),
          new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.05, depthWrite: false }));
      });
      zoneToggle('meo', function () {
        return new THREE.Mesh(new THREE.SphereGeometry(R * (1 + 20200 / RE), 48, 32),
          new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.035, depthWrite: false }));
      });
      zoneToggle('geo', function () {
        var t = new THREE.Mesh(new THREE.TorusGeometry(R * (1 + 35786 / RE), 0.012, 8, 160),
          new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.55, depthWrite: false }));
        t.rotation.x = Math.PI / 2;
        return t;
      });
      window.__scB.tools = {
        findPasses, getObserver, fmtT, countdown, compass, satLook, obsGeo,
        get lastPassData() { return lastPassData; }, afterPasses: null
      };
      // ---------- init ----------
      updateObsLabel();
      labUpdate();
      var profIv = setInterval(function () {
        if (OBJPROF) { clearInterval(profIv); renderStemGrid('all'); renderScienceGrid(); }
      }, 400);
    })();
  