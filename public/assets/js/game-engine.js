/**
 * ============================================================
 *   SKYNET NEXUS // HOLO-OS GAME ENGINE (game-engine.js)
 *   Synthesized Audio SFX, Starfield Canvas, Dynamic Missions,
 *   Interactive Holo-Briefing Reader, and Quiz Battle Arena.
 * ============================================================
 */

(function () {
  'use strict';

  var GameEngine = window.GameEngine = {
    sfxEnabled: true,
    currentRole: 'cadet', // 'cadet' | 'guardian' | 'commander'
    activeTab: 'expeditions', // 'expeditions' | 'quiz' | 'workbench' | 'trophies' | 'comms'
    player: {
      xp: 340,
      level: 3,
      streak: 4,
      badges: 6
    },
    articles: [],
    audioContext: null
  };

  // ------------------------------------------------------------
  // 1. SYNTHESIZED WEB AUDIO SFX (ZERO FILE DEPENDENCY)
  // ------------------------------------------------------------
  function getAudioCtx() {
    if (!GameEngine.audioContext) {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) GameEngine.audioContext = new AudioCtx();
    }
    if (GameEngine.audioContext && GameEngine.audioContext.state === 'suspended') {
      GameEngine.audioContext.resume();
    }
    return GameEngine.audioContext;
  }

  function playSfx(type) {
    if (!GameEngine.sfxEnabled) return;
    try {
      var ctx = getAudioCtx();
      if (!ctx) return;
      var now = ctx.currentTime;

      if (type === 'hover') {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.04);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'click') {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.07);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.07);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.07);
      } else if (type === 'success') {
        // High-tech victory chime: C5, E5, G5, C6
        [523.25, 659.25, 783.99, 1046.50].forEach(function (freq, i) {
          var noteOsc = ctx.createOscillator();
          var noteGain = ctx.createGain();
          var t = now + (i * 0.07);
          noteOsc.type = 'sine';
          noteOsc.frequency.setValueAtTime(freq, t);
          noteGain.gain.setValueAtTime(0.12, t);
          noteGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
          noteOsc.connect(noteGain);
          noteGain.connect(ctx.destination);
          noteOsc.start(t);
          noteOsc.stop(t + 0.25);
        });
      } else if (type === 'wrong') {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.2);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      }
    } catch (e) {}
  }
  GameEngine.playSfx = playSfx;

  // ------------------------------------------------------------
  // 2. 3D PARALLAX COSMIC CANVAS & NEBULA POSITIONING
  // ------------------------------------------------------------
  var mouseTargetX = 0, mouseTargetY = 0;
  var mouseCurX = 0, mouseCurY = 0;

  window.addEventListener('mousemove', function (e) {
    var centerX = window.innerWidth / 2;
    var centerY = window.innerHeight / 2;
    mouseTargetX = (e.clientX - centerX) / centerX; // -1 to 1
    mouseTargetY = (e.clientY - centerY) / centerY; // -1 to 1

    // Update global CSS variables for parallax background grid & nebulae
    document.documentElement.style.setProperty('--parallax-x', (mouseTargetX * 18) + 'px');
    document.documentElement.style.setProperty('--parallax-y', (mouseTargetY * 18) + 'px');
    document.documentElement.style.setProperty('--tilt-x', (mouseTargetX * 4) + 'deg');
    document.documentElement.style.setProperty('--tilt-y', (mouseTargetY * 4) + 'deg');
  });

  function initStarfieldCanvas() {
    var canvas = document.getElementById('space-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var stars = [];
    var count = 130;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    for (var i = 0; i < count; i++) {
      // 3 Depth planes: 0 = Far, 1 = Mid, 2 = Near
      var plane = (i < 75) ? 0 : (i < 110) ? 1 : 2;
      var speed = (plane === 0) ? 0.15 : (plane === 1) ? 0.35 : 0.7;
      var size = (plane === 0) ? Math.random() * 1.2 + 0.4 : (plane === 1) ? Math.random() * 2 + 1 : Math.random() * 2.8 + 1.8;
      var color = (plane === 2) ? ['#00e5ff', '#b026ff', '#ffffff'][Math.floor(Math.random() * 3)] : '#ffffff';

      stars.push({
        baseX: Math.random() * canvas.width,
        baseY: Math.random() * canvas.height,
        x: 0,
        y: 0,
        plane: plane,
        speed: speed,
        size: size,
        color: color,
        alpha: Math.random() * 0.7 + 0.3
      });
    }

    function render() {
      // Smooth interpolation for mouse parallax
      mouseCurX += (mouseTargetX - mouseCurX) * 0.05;
      mouseCurY += (mouseTargetY - mouseCurY) * 0.05;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.baseY -= s.speed;
        if (s.baseY < 0) {
          s.baseY = canvas.height;
          s.baseX = Math.random() * canvas.width;
        }

        // Parallax offset proportional to plane depth
        var parallaxFactor = (s.plane === 0) ? 12 : (s.plane === 1) ? 28 : 60;
        s.x = s.baseX + (mouseCurX * parallaxFactor);
        s.y = s.baseY + (mouseCurY * parallaxFactor);

        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();

        // Extra halo for near cosmic dust particles
        if (s.plane === 2) {
          ctx.globalAlpha = s.alpha * 0.35;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      requestAnimationFrame(render);
    }
    render();
  }

  // ------------------------------------------------------------
  // 3. INTERACTIVE 3D HOLOGRAPHIC DISPLAY CARDS (TILT & SPECULAR SHEEN)
  // ------------------------------------------------------------
  function initHolo3DCards() {
    var cardSelector = '.feed-grid .card, .card, .mission-card, .summer-promo, .dropbar, .widget, .cadet-hero-card, .guardian-hero-card, .commander-hero-card, .prog-card';

    document.addEventListener('mousemove', function (e) {
      var card = e.target.closest(cardSelector);
      if (!card) return;

      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left; // x position within element
      var y = e.clientY - rect.top;  // y position within element

      var centerX = rect.width / 2;
      var centerY = rect.height / 2;

      // Calculate tilt angles (subtle 3D angle)
      var rotateX = ((y - centerY) / centerY) * -7;
      var rotateY = ((x - centerX) / centerX) * 7;

      var percentX = (x / rect.width) * 100;
      var percentY = (y / rect.height) * 100;

      card.style.setProperty('--holo-x', percentX + '%');
      card.style.setProperty('--holo-y', percentY + '%');
      card.style.transform = 'perspective(1000px) rotateX(' + rotateX.toFixed(2) + 'deg) rotateY(' + rotateY.toFixed(2) + 'deg) translateZ(10px) scale3d(1.015, 1.015, 1.015)';
    });

    document.addEventListener('mouseout', function (e) {
      var card = e.target.closest(cardSelector);
      if (card && (!e.relatedTarget || !card.contains(e.relatedTarget))) {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0) scale3d(1, 1, 1)';
      }
    });
  }

  // ------------------------------------------------------------
  // 4. INITIALIZATION & BINDING
  // ------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    initStarfieldCanvas();
    initHolo3DCards();
    bindGlobalUIEvents();
    loadMissions();
  });

  function bindGlobalUIEvents() {
    // SFX toggle
    var sfxBtn = document.getElementById('sfx-toggle');
    if (sfxBtn) {
      sfxBtn.addEventListener('click', function () {
        GameEngine.sfxEnabled = !GameEngine.sfxEnabled;
        sfxBtn.textContent = GameEngine.sfxEnabled ? '🔊 SFX ON' : '🔇 SFX OFF';
        playSfx('click');
      });
    }

    // Role switcher
    document.querySelectorAll('.role-pill-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        playSfx('click');
        var role = this.getAttribute('data-role');
        setRole(role);
      });
      btn.addEventListener('mouseenter', function () { playSfx('hover'); });
    });

    // Game tabs
    document.querySelectorAll('.game-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        playSfx('click');
        var tab = this.getAttribute('data-tab');
        setTab(tab);
      });
      btn.addEventListener('mouseenter', function () { playSfx('hover'); });
    });

    // Sector Filter Chips
    document.querySelectorAll('.sector-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        playSfx('click');
        document.querySelectorAll('.sector-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');

        var label = chip.textContent.trim().toUpperCase();
        if (label.indexOf('ALL') !== -1) {
          renderMissions(GameEngine.articles);
        } else {
          var keyword = label.replace(/[^\w\s]/g, '').trim().toLowerCase();
          var filtered = GameEngine.articles.filter(function (art) {
            var cat = (art.cat || '').toLowerCase();
            var title = (art.title || '').toLowerCase();
            var excerpt = (art.excerpt || '').toLowerCase();
            return cat.includes(keyword) || title.includes(keyword) || excerpt.includes(keyword) ||
              (keyword.includes('space') && (cat.includes('space') || cat.includes('stem'))) ||
              (keyword.includes('robot') && (cat.includes('robot') || title.includes('robot')));
          });
          renderMissions(filtered.length ? filtered : GameEngine.articles);
        }
      });
    });

    // Global Delegated Sound FX for any interactive tactile game elements
    var interactiveSelector = 'button, a.tactical-btn, .btn, .tile, .game-tab-btn, .role-pill-btn, .mission-card, .trophy-badge-item, .quiz-ans-btn, .quiz-choice-btn, .holo-claim-btn, .checkpoint-node, .co-seat-btn';
    
    document.addEventListener('mouseover', function (e) {
      var target = e.target.closest(interactiveSelector);
      if (target && !target.dataset.sfxHovered) {
        target.dataset.sfxHovered = 'true';
        playSfx('hover');
        setTimeout(function () { delete target.dataset.sfxHovered; }, 150);
      }
    });

    document.addEventListener('click', function (e) {
      var target = e.target.closest(interactiveSelector);
      if (target) {
        playSfx('click');
      }
    });
  }

  function setRole(role) {
    GameEngine.currentRole = role;
    document.querySelectorAll('.role-pill-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-role') === role);
    });

    // Render Station
    var cadetCard = document.getElementById('cadet-station');
    var guardianCard = document.getElementById('guardian-station');
    var commanderCard = document.getElementById('commander-station');

    if (cadetCard) cadetCard.style.display = (role === 'cadet') ? 'grid' : 'none';
    if (guardianCard) guardianCard.style.display = (role === 'guardian') ? 'block' : 'none';
    if (commanderCard) commanderCard.style.display = (role === 'commander') ? 'block' : 'none';
  }

  function setTab(tab) {
    GameEngine.activeTab = tab;
    document.querySelectorAll('.game-tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });

    var expeditionsView = document.getElementById('expeditions-view');
    var quizView = document.getElementById('quiz-view');
    var workbenchView = document.getElementById('workbench-view');
    var trophyView = document.getElementById('trophy-view');

    if (expeditionsView) expeditionsView.style.display = (tab === 'expeditions') ? 'block' : 'none';
    if (quizView) {
      quizView.style.display = (tab === 'quiz') ? 'block' : 'none';
      if (tab === 'quiz') initQuizArena();
    }
    if (workbenchView) workbenchView.style.display = (tab === 'workbench') ? 'block' : 'none';
    if (trophyView) trophyView.style.display = (tab === 'trophies') ? 'block' : 'none';
  }

  // ------------------------------------------------------------
  // 4. MISSION LOADER (MANIFEST & EXPEDITION BOARD)
  // ------------------------------------------------------------
  function loadMissions() {
    fetch('/api/manifest')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        GameEngine.articles = data.articles || [];
        renderMissions(GameEngine.articles);
      })
      .catch(function () {
        // Fallback default stories
        GameEngine.articles = [
          {
            id: '2026-09-30-welcome-back-to-the-nexus',
            title: 'Welcome to the STEM Nexus Network',
            cat: 'network',
            excerpt: 'Thirteen correspondents tracking AI, deep space robotics, biotech, and game design for youth explorers.',
            kidTake: 'Reporters write true stories about cool things kids and students are doing in science, robots, and music!',
            heroImage: '/assets/img/channels/network/skywelcome.png',
            body: '<p>Welcome Explorer to the Skynet Nexus Signal.</p>'
          },
          {
            id: '2026-07-04-franklin-stem-excellence',
            title: 'Autonomous Robotics on Deep Sea Moons',
            cat: 'robotics',
            excerpt: 'Scientists deploy micro-submarines to chart alien oceans under 10 miles of cosmic ice.',
            kidTake: 'Mini submarines with bright sensors can swim under ice to find alien sea creatures.',
            heroImage: '/assets/img/channels/robotics/franklin_stem.jpg',
            body: '<p>Exploring Europa and Enceladus with autonomous AI navigation.</p>'
          }
        ];
        renderMissions(GameEngine.articles);
      });
  }

  function renderMissions(articles) {
    var matrix = document.getElementById('missions-matrix');
    if (!matrix) return;

    matrix.innerHTML = articles.map(function (art) {
      var cat = (art.cat || 'stem').toUpperCase();
      var img = art.heroImage || '/assets/img/skynet_newsroom_banner.jpg';
      var title = art.title || 'Untitled Mission';
      var desc = art.excerpt || art.subtitle || 'STEM Intelligence Briefing.';

      return (
        '<div class="mission-card" data-id="' + art.id + '">' +
          '<div class="mission-thumb-wrap">' +
            '<img src="' + img + '" alt="' + title + '" onerror="this.src=\'/assets/img/skynet_newsroom_banner.jpg\'"/>' +
            '<div class="mission-scanlines"></div>' +
            '<div class="mission-bounty-badge">+25 XP</div>' +
            '<div class="mission-sector-tag">📡 ' + cat + '</div>' +
          '</div>' +
          '<div class="mission-body">' +
            '<div class="mission-title">' + title + '</div>' +
            '<div class="mission-excerpt">' + desc + '</div>' +
            '<div style="display:flex;gap:8px;margin-top:14px;">' +
              '<button type="button" class="mission-launch-btn" style="flex:1;" onclick="window.GameEngine.openHoloBriefing(\'' + art.id + '\')">' +
                '⚡ QUICK HOLO' +
              '</button>' +
              '<a href="/pages/article.html?id=' + encodeURIComponent(art.id) + '" class="mission-launch-btn" style="flex:1;text-decoration:none;text-align:center;background:rgba(0,229,255,0.15);border-color:var(--neon-cyan);color:#fff;">' +
                '🛰️ DEEP INTEL &rarr;' +
              '</a>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    // Attach sound to launch buttons
    matrix.querySelectorAll('.mission-launch-btn').forEach(function (btn) {
      btn.addEventListener('mouseenter', function () { playSfx('hover'); });
    });
  }

  // ------------------------------------------------------------
  // 5. INTERACTIVE HOLO-BRIEFING READER (FULLSCREEN MODAL)
  // ------------------------------------------------------------
  function openHoloBriefing(articleId) {
    playSfx('click');
    var art = GameEngine.articles.find(function (a) { return a.id === articleId; }) || GameEngine.articles[0];
    if (!art) return;

    var modal = document.getElementById('holo-intel-modal');
    if (!modal) return;

    document.getElementById('holo-title').textContent = art.title;
    document.getElementById('holo-meta').textContent = 'SECTOR: ' + (art.cat || 'STEM').toUpperCase() + ' · LEVEL 3 BRIEFING';
    
    var deepLink = document.getElementById('holo-deep-link');
    if (deepLink) {
      deepLink.href = '/pages/article.html?id=' + encodeURIComponent(art.id);
    }
    
    var readingBox = document.getElementById('holo-reading-box');
    var fullBody = art.body || '<p>' + (art.excerpt || '') + '</p>';
    var kidTake = art.kidTake || art.kid_take || 'Simplified briefing for age 8 cadets.';

    readingBox.innerHTML = fullBody;

    // Level toggle
    var fullBtn = document.getElementById('holo-btn-full');
    var codexBtn = document.getElementById('holo-btn-codex');

    if (fullBtn && codexBtn) {
      fullBtn.onclick = function () {
        playSfx('click');
        fullBtn.classList.add('active');
        codexBtn.classList.remove('active');
        readingBox.innerHTML = fullBody;
      };
      codexBtn.onclick = function () {
        playSfx('click');
        codexBtn.classList.add('active');
        fullBtn.classList.remove('active');
        readingBox.innerHTML = 
          '<div style="background:rgba(0,229,255,0.1);border-left:4px solid var(--neon-cyan);padding:20px;border-radius:12px;font-size:1.3rem;line-height:1.7;">' +
            '<strong>🧒 CADET CODEX (EASY READ):</strong><br><br>' + kidTake +
          '</div>';
      };
    }

    modal.classList.add('open');
  }
  GameEngine.openHoloBriefing = openHoloBriefing;

  function closeHoloBriefing() {
    playSfx('click');
    var modal = document.getElementById('holo-intel-modal');
    if (modal) modal.classList.remove('open');
  }
  GameEngine.closeHoloBriefing = closeHoloBriefing;

  function claimMissionXp() {
    playSfx('success');
    GameEngine.player.xp += 25;
    document.getElementById('hud-xp-val').textContent = GameEngine.player.xp + ' XP';
    
    // Spawn floating victory particles
    var btn = document.getElementById('holo-claim-btn');
    var rect = btn.getBoundingClientRect();
    for (var i = 0; i < 16; i++) {
      var p = document.createElement('div');
      p.className = 'nx-rocket-particle';
      p.textContent = ['⭐', '✨', '💎', '🚀', '+25 XP'][Math.floor(Math.random() * 5)];
      p.style.left = (rect.left + rect.width / 2) + 'px';
      p.style.top = rect.top + 'px';
      p.style.setProperty('--tx', (Math.random() * 240 - 120) + 'px');
      p.style.setProperty('--ty', (-120 - Math.random() * 160) + 'px');
      document.body.appendChild(p);
      (function (particle) { setTimeout(function () { particle.remove(); }, 1800); })(p);
    }

    alert('🎉 MISSION COMPLETE! +25 XP Added to your Cadet Codex!');
    closeHoloBriefing();
  }
  GameEngine.claimMissionXp = claimMissionXp;

  // ------------------------------------------------------------
  // 6. QUIZ BATTLE ARENA (BOSS TRIVIA ARENA)
  // ------------------------------------------------------------
  var quizQuestions = [
    {
      q: 'Which spacecraft just deployed the largest solar array in deep space history to study an icy ocean moon?',
      answers: ['Europa Clipper', 'Voyager 1', 'James Webb Telescope', 'Curiosity Rover'],
      correct: 0
    },
    {
      q: 'What is the main power source that keeps submarine probes operating underneath frozen extraterrestrial ice?',
      answers: ['Nuclear Radioisotope', 'Wind Turbines', 'Photosynthesis', 'Combustion Engines'],
      correct: 0
    },
    {
      q: 'How many daily news editions does the Skynet Nexus newsroom transmit to families and schools?',
      answers: ['Three editions', 'Only once a week', 'Twelve editions', 'Once a month'],
      correct: 0
    }
  ];
  var currentQIdx = 0;
  var comboCount = 0;

  function initQuizArena() {
    currentQIdx = 0;
    comboCount = 0;
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    var q = quizQuestions[currentQIdx];
    if (!q) {
      document.getElementById('quiz-box').innerHTML = 
        '<div style="text-align:center;padding:40px;">' +
          '<div style="font-size:64px;margin-bottom:14px;">🏆</div>' +
          '<h2 style="font-family:var(--font-game);color:var(--neon-green);margin-bottom:10px;">VICTORY! TRIVIA ARENA CLEARED</h2>' +
          '<p style="color:#9cb5d6;font-size:1.1rem;margin-bottom:24px;">You scored 100% on today\'s STEM intelligence check.</p>' +
          '<button class="holo-claim-btn" onclick="window.GameEngine.claimMissionXp()">CLAIM +25 XP REWARD</button>' +
        '</div>';
      return;
    }

    var html = 
      '<div class="quiz-arena-header">' +
        '<div class="quiz-lives">❤️❤️❤️</div>' +
        '<div class="quiz-streak-combo">COMBO STREAK: x' + (comboCount + 1) + '</div>' +
        '<div style="font-family:var(--font-code);color:var(--neon-cyan);">ROUND ' + (currentQIdx + 1) + ' / ' + quizQuestions.length + '</div>' +
      '</div>' +
      '<div class="quiz-question-box">' + q.q + '</div>' +
      '<div class="quiz-answers-grid">' +
        q.answers.map(function (ans, idx) {
          return '<button type="button" class="quiz-ans-btn" data-idx="' + idx + '">' + (String.fromCharCode(65 + idx)) + '. ' + ans + '</button>';
        }).join('') +
      '</div>';

    document.getElementById('quiz-box').innerHTML = html;

    document.querySelectorAll('.quiz-ans-btn').forEach(function (btn) {
      btn.addEventListener('mouseenter', function () { playSfx('hover'); });
      btn.addEventListener('click', function () {
        var chosen = parseInt(this.getAttribute('data-idx'), 10);
        if (chosen === q.correct) {
          playSfx('success');
          this.classList.add('correct');
          comboCount++;
          setTimeout(function () {
            currentQIdx++;
            renderQuizQuestion();
          }, 700);
        } else {
          playSfx('wrong');
          this.classList.add('wrong');
          comboCount = 0;
        }
      });
    });
  }

})();
