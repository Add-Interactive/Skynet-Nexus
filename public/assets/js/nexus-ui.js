/**
 * ============================================================
 *   SKYNET NEXUS — Modern UI Overhaul Engine (nexus-ui.js)
 *   Tri-Orbit Mode Switcher, Persistent Audio Dock,
 *   Interactive Lab Bench, and Classroom Bell-Ringer.
 * ============================================================
 */

(function () {
  'use strict';

  var NexusUI = window.NexusUI = {
    currentOrbit: 'student', // 'student' | 'parent' | 'teacher'
    audioState: {
      playing: false,
      title: 'Europa Clipper Odyssey · Liquid Oceans in Deep Space',
      voice: 'Piper (Asteria)',
      speed: 1.0,
      audioEl: null
    }
  };

  // ------------------------------------------------------------
  // 1. INITIALIZATION
  // ------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    initOrbitMode();
    initAudioDock();
    enhanceArticlePageIfPresent();
  });

  // ------------------------------------------------------------
  // 2. TRI-ORBIT LENS SWITCHER
  // ------------------------------------------------------------
  function initOrbitMode() {
    var savedOrbit = localStorage.getItem('nexus_orbit_mode');
    if (savedOrbit) {
      NexusUI.currentOrbit = savedOrbit;
    } else if (window.SkyAuth && window.SkyAuth.state && window.SkyAuth.state.user) {
      var r = window.SkyAuth.state.user.role;
      NexusUI.currentOrbit = (r === 'teacher') ? 'teacher' : (r === 'parent' ? 'parent' : 'student');
    }

    // Bind all buttons
    document.querySelectorAll('.nx-orbit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setOrbit(this.getAttribute('data-orbit'));
      });
    });

    applyOrbit(NexusUI.currentOrbit, false);
  }

  function setOrbit(mode) {
    NexusUI.currentOrbit = mode;
    localStorage.setItem('nexus_orbit_mode', mode);
    applyOrbit(mode, true);
  }
  NexusUI.setOrbit = setOrbit;

  function applyOrbit(mode, animate) {
    document.documentElement.setAttribute('data-orbit', mode);
    
    // Update active state in top orbit switcher pills
    document.querySelectorAll('.nx-orbit-btn').forEach(function (btn) {
      if (btn.getAttribute('data-orbit') === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update or render the Orbit Cockpit on home page or main feed
    renderCockpitBanner(mode);
  }

  function renderCockpitBanner(mode) {
    var mount = document.getElementById('nx-cockpit-mount');
    if (!mount) return;

    var html = '';
    if (mode === 'student') {
      html = 
        '<div class="nx-mission-cockpit">' +
          '<div style="width:100%;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">' +
            '<div class="nx-cockpit-info">' +
              '<div class="nx-cockpit-icon" style="border-color:rgba(0,229,255,0.4);color:var(--nx-cyan);font-size:30px;">🚀</div>' +
              '<div>' +
                '<div class="nx-cockpit-title" style="font-size:1.3rem;">Student Explorer Hub · Mission Control</div>' +
                '<div class="nx-cockpit-sub">Level 3 Junior Scientist · <strong style="color:var(--nx-cyan)">340 / 500 XP</strong> to Next Constellation Badge</div>' +
              '</div>' +
            '</div>' +
            '<div style="display:flex;gap:12px;align-items:center;">' +
              '<span style="background:rgba(255,184,0,0.12);border:1px solid rgba(255,184,0,0.3);padding:6px 14px;border-radius:999px;font-weight:800;color:var(--nx-solar);font-size:0.85rem;">🔥 4-Day Streak</span>' +
              '<span style="background:rgba(0,229,255,0.12);border:1px solid rgba(0,229,255,0.3);padding:6px 14px;border-radius:999px;font-weight:800;color:var(--nx-cyan);font-size:0.85rem;">⭐ 6 Badges</span>' +
            '</div>' +
          '</div>' +
          
          '<div style="width:100%;display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:18px;">' +
            '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);padding:12px 14px;border-radius:12px;">' +
              '<div style="font-size:0.75rem;color:var(--nx-text-muted);font-weight:700;">DAILY QUEST 1</div>' +
              '<div style="font-size:0.9rem;font-weight:700;margin-top:2px;">🛰️ Read 1 STEM Story</div>' +
              '<div style="font-size:0.78rem;color:var(--nx-emerald);margin-top:4px;">✓ Completed (+15 XP)</div>' +
            '</div>' +
            '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(0,229,255,0.25);padding:12px 14px;border-radius:12px;">' +
              '<div style="font-size:0.75rem;color:var(--nx-cyan);font-weight:700;">DAILY QUEST 2</div>' +
              '<div style="font-size:0.9rem;font-weight:700;margin-top:2px;">🧠 Solve Today\'s Quiz</div>' +
              '<div style="font-size:0.78rem;color:var(--nx-solar);margin-top:4px;">Ready to play (+25 XP)</div>' +
            '</div>' +
            '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);padding:12px 14px;border-radius:12px;">' +
              '<div style="font-size:0.75rem;color:var(--nx-text-muted);font-weight:700;">WEEKEND QUEST</div>' +
              '<div style="font-size:0.9rem;font-weight:700;margin-top:2px;">🧪 Build Saturday Lab</div>' +
              '<div style="font-size:0.78rem;color:var(--nx-purple);margin-top:4px;">Opens Saturday (+50 XP)</div>' +
            '</div>' +
          '</div>' +

          '<div class="nx-cockpit-actions">' +
            '<a href="/pages/kid.html" class="nx-btn nx-btn-primary">🌌 My Space &amp; Badges</a>' +
            '<a href="/pages/quiz.html" class="nx-btn nx-btn-glass">🧠 Daily Quiz (+25 XP)</a>' +
            '<a href="/pages/weekend-lab.html" class="nx-btn nx-btn-glass">🧪 STEM Lab Workbench</a>' +
            '<a href="/pages/creations.html" class="nx-btn nx-btn-glass">🎨 My Inventions</a>' +
          '</div>' +
        '</div>';
    } else if (mode === 'parent') {
      html = 
        '<div class="nx-mission-cockpit" style="border-color:rgba(255,184,0,0.4);background:linear-gradient(180deg, rgba(255,184,0,0.06) 0%, var(--nx-bg-glass) 100%);">' +
          '<div style="width:100%;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">' +
            '<div class="nx-cockpit-info">' +
              '<div class="nx-cockpit-icon" style="border-color:rgba(255,184,0,0.4);color:var(--nx-solar);font-size:30px;">🛡️</div>' +
              '<div>' +
                '<div class="nx-cockpit-title" style="font-size:1.3rem;">Parent Mission Control · Family Co-Pilot</div>' +
                '<div class="nx-cockpit-sub">Child: <strong style="color:var(--nx-solar)">Leo (Age 8)</strong> · 2 Stories Read Today · 4-Day Family Streak</div>' +
              '</div>' +
            '</div>' +
            '<button type="button" class="nx-btn nx-btn-solar" onclick="window.NexusUI.triggerCheer(event)">' +
              '🚀 Send 1-Tap Rocket Cheer (+5 XP)' +
            '</button>' +
          '</div>' +

          '<div style="width:100%;background:rgba(255,184,0,0.08);border:1px solid rgba(255,184,0,0.3);border-radius:14px;padding:16px 20px;margin-bottom:18px;">' +
            '<div style="display:flex;align-items:center;gap:8px;font-size:0.8rem;font-weight:800;color:var(--nx-solar);letter-spacing:0.04em;">' +
              '<span>💡 DINNER TABLE SPARK OF THE DAY</span>' +
              '<span style="opacity:0.7;">· 30-Second Family Conversation</span>' +
            '</div>' +
            '<div style="font-size:1.05rem;line-height:1.55;font-weight:600;color:#ffffff;margin-top:6px;">' +
              '"Tonight at dinner, ask: If we had to build an underwater explorer robot to study an icy moon without sunlight, what tools would we pack?"' +
            '</div>' +
          '</div>' +

          '<div class="nx-cockpit-actions">' +
            '<a href="/pages/read-together.html" class="nx-btn nx-btn-solar">📖 Launch Read-Together Sync</a>' +
            '<a href="/pages/profile.html" class="nx-btn nx-btn-glass">👨‍👩‍👧 Family Safety &amp; Quiet Hours</a>' +
            '<a href="/pages/profile.html#digest" class="nx-btn nx-btn-glass">📊 Weekly Family Progress Digest</a>' +
          '</div>' +
        '</div>';
    } else if (mode === 'teacher') {
      html = 
        '<div class="nx-mission-cockpit" style="border-color:rgba(16,185,129,0.4);background:linear-gradient(180deg, rgba(16,185,129,0.06) 0%, var(--nx-bg-glass) 100%);">' +
          '<div style="width:100%;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">' +
            '<div class="nx-cockpit-info">' +
              '<div class="nx-cockpit-icon" style="border-color:rgba(16,185,129,0.4);color:var(--nx-emerald);font-size:30px;">🎓</div>' +
              '<div>' +
                '<div class="nx-cockpit-title" style="font-size:1.3rem;">Classroom Flight Deck · SmartBoard Launchpad</div>' +
                '<div class="nx-cockpit-sub">Class 4-B · <strong style="color:var(--nx-emerald)">18 of 24 students</strong> completed today\'s assigned reading</div>' +
              '</div>' +
            '</div>' +
            '<button type="button" class="nx-btn nx-btn-emerald" onclick="window.NexusUI.openBellRingerModal()">' +
              '📽️ Launch Projector Bell-Ringer' +
            '</button>' +
          '</div>' +

          '<div style="width:100%;display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:18px;">' +
            '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(16,185,129,0.25);padding:12px 14px;border-radius:12px;">' +
              '<div style="font-size:0.75rem;color:var(--nx-emerald);font-weight:700;">DAILY CLASS READING</div>' +
              '<div style="font-size:1.2rem;font-weight:900;margin-top:2px;">75% Completed</div>' +
              '<div style="font-size:0.78rem;color:var(--nx-text-secondary);margin-top:4px;">6 students pending</div>' +
            '</div>' +
            '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);padding:12px 14px;border-radius:12px;">' +
              '<div style="font-size:0.75rem;color:var(--nx-text-muted);font-weight:700;">CLASS QUIZ AVERAGE</div>' +
              '<div style="font-size:1.2rem;font-weight:900;margin-top:2px;">4.6 / 5.0 Qs</div>' +
              '<div style="font-size:0.78rem;color:var(--nx-emerald);margin-top:4px;">Top score: 5/5 (+25 XP)</div>' +
            '</div>' +
            '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);padding:12px 14px;border-radius:12px;">' +
              '<div style="font-size:0.75rem;color:var(--nx-text-muted);font-weight:700;">AT-RISK ALERT</div>' +
              '<div style="font-size:1.2rem;font-weight:900;margin-top:2px;color:var(--nx-rose);">1 Student Idle</div>' +
              '<div style="font-size:0.78rem;color:var(--nx-text-secondary);margin-top:4px;">Idle 3+ days: Maya S.</div>' +
            '</div>' +
          '</div>' +

          '<div class="nx-cockpit-actions">' +
            '<a href="/pages/assignments.html" class="nx-btn nx-btn-emerald">📚 Class Reading Matrix</a>' +
            '<a href="/pages/classroom.html" class="nx-btn nx-btn-glass">🏫 Student Roster &amp; Invites</a>' +
            '<a href="/pages/quiz.html" class="nx-btn nx-btn-glass">🧠 Launch Classroom Live Quiz</a>' +
            '<button type="button" class="nx-btn nx-btn-glass" onclick="window.NexusUI.openBellRingerModal()">🏆 Projector Warmup</button>' +
          '</div>' +
        '</div>';
    }

    mount.innerHTML = html;
  }

  // ------------------------------------------------------------
  // 3. PERSISTENT GLOBAL AUDIO DOCK (PIPER TTS)
  // ------------------------------------------------------------
  function initAudioDock() {
    if (document.getElementById('nexus-audio-dock')) return;

    var dock = document.createElement('div');
    dock.id = 'nexus-audio-dock';
    dock.className = 'nx-audio-dock paused';
    dock.innerHTML = 
      '<button type="button" class="nx-audio-playbtn" id="nx-dock-playbtn" aria-label="Play Narration">▶</button>' +
      '<div class="nx-audio-track">' +
        '<div class="nx-audio-title" id="nx-dock-title">' + NexusUI.audioState.title + '</div>' +
        '<div class="nx-audio-meta">' +
          '<span class="nx-wave-bars">' +
            '<span class="nx-wave-bar"></span><span class="nx-wave-bar"></span>' +
            '<span class="nx-wave-bar"></span><span class="nx-wave-bar"></span>' +
          '</span>' +
          '<span id="nx-dock-voice">Piper TTS · Studio Voice</span>' +
        '</div>' +
      '</div>' +
      '<div class="nx-audio-controls">' +
        '<button type="button" class="nx-speed-chip" id="nx-dock-speed" title="Playback Speed">1.0x</button>' +
        '<button type="button" class="nx-voice-chip" id="nx-dock-voiceswitch" title="Change Voice">🎙️ Asteria</button>' +
        '<button type="button" class="nx-audio-close" id="nx-dock-close" aria-label="Minimize Audio" title="Close">✕</button>' +
      '</div>';

    document.body.appendChild(dock);

    var playBtn = document.getElementById('nx-dock-playbtn');
    var closeBtn = document.getElementById('nx-dock-close');
    var speedBtn = document.getElementById('nx-dock-speed');
    var voiceBtn = document.getElementById('nx-dock-voiceswitch');

    playBtn.addEventListener('click', toggleAudio);
    closeBtn.addEventListener('click', function () {
      dock.classList.add('minimized');
      if (NexusUI.audioState.playing) toggleAudio();
    });

    var speeds = [0.8, 1.0, 1.25, 1.5];
    var speedIdx = 1;
    speedBtn.addEventListener('click', function () {
      speedIdx = (speedIdx + 1) % speeds.length;
      NexusUI.audioState.speed = speeds[speedIdx];
      speedBtn.textContent = NexusUI.audioState.speed + 'x';
      if (NexusUI.audioState.audioEl) {
        NexusUI.audioState.audioEl.playbackRate = NexusUI.audioState.speed;
      }
    });

    var voices = ['Asteria (Clear)', 'Leo (Storyteller)', 'Nova (Youthful)', 'Atlas (Narrator)'];
    var voiceIdx = 0;
    voiceBtn.addEventListener('click', function () {
      voiceIdx = (voiceIdx + 1) % voices.length;
      NexusUI.audioState.voice = voices[voiceIdx];
      voiceBtn.textContent = '🎙️ ' + voices[voiceIdx].split(' ')[0];
      document.getElementById('nx-dock-voice').textContent = 'Piper TTS · ' + voices[voiceIdx];
    });
  }

  function playStoryAudio(title, audioUrl) {
    var dock = document.getElementById('nexus-audio-dock');
    if (!dock) return;

    dock.classList.remove('minimized');
    document.getElementById('nx-dock-title').textContent = title || 'STEM Narration';
    
    if (!NexusUI.audioState.audioEl) {
      NexusUI.audioState.audioEl = new Audio();
      NexusUI.audioState.audioEl.addEventListener('ended', function () {
        NexusUI.audioState.playing = false;
        dock.classList.add('paused');
        document.getElementById('nx-dock-playbtn').textContent = '▶';
      });
    }

    if (audioUrl) {
      NexusUI.audioState.audioEl.src = audioUrl;
      NexusUI.audioState.audioEl.playbackRate = NexusUI.audioState.speed || 1.0;
      NexusUI.audioState.audioEl.play().catch(function () {});
    }

    NexusUI.audioState.playing = true;
    dock.classList.remove('paused');
    document.getElementById('nx-dock-playbtn').textContent = '⏸';
  }
  NexusUI.playStoryAudio = playStoryAudio;

  function toggleAudio() {
    var dock = document.getElementById('nexus-audio-dock');
    var btn = document.getElementById('nx-dock-playbtn');
    if (!dock || !btn) return;

    NexusUI.audioState.playing = !NexusUI.audioState.playing;
    if (NexusUI.audioState.playing) {
      dock.classList.remove('paused');
      btn.textContent = '⏸';
      if (NexusUI.audioState.audioEl && NexusUI.audioState.audioEl.src) {
        NexusUI.audioState.audioEl.play().catch(function () {});
      }
    } else {
      dock.classList.add('paused');
      btn.textContent = '▶';
      if (NexusUI.audioState.audioEl) {
        NexusUI.audioState.audioEl.pause();
      }
    }
  }

  // ------------------------------------------------------------
  // 4. INTERACTIVE LAB BENCH ENHANCER (ARTICLE PAGES)
  // ------------------------------------------------------------
  function enhanceArticlePageIfPresent() {
    var articleRoot = document.getElementById('article-root');
    if (!articleRoot) return;

    var observer = new MutationObserver(function () {
      var articleEl = articleRoot.querySelector('article, .article-layout, .article-view');
      if (articleEl && !articleEl.classList.contains('nx-bench-processed')) {
        articleEl.classList.add('nx-bench-processed');
        buildInteractiveLabBench(articleEl);
      }
    });
    observer.observe(articleRoot, { childList: true, subtree: true });
  }

  function buildInteractiveLabBench(container) {
    if (container.querySelector('.nx-bench-dock')) return;

    var title = container.querySelector('h1') ? container.querySelector('h1').textContent.trim() : 'Story';
    var kidTake = container.querySelector('.kid-take, [data-kidtake]');
    var kidTakeText = kidTake ? kidTake.textContent.trim() : 'Short reading-level version of this breakthrough.';
    
    var wrapper = document.createElement('div');
    wrapper.className = 'nx-bench-container';

    var narrativeCol = document.createElement('div');
    narrativeCol.className = 'nx-bench-narrative';

    while (container.firstChild) {
      narrativeCol.appendChild(container.firstChild);
    }

    var dock = document.createElement('aside');
    dock.className = 'nx-bench-dock';
    dock.innerHTML = 
      '<div class="nx-dock-card highlight-cyan">' +
        '<div class="nx-dock-header">' +
          '<div class="nx-dock-title">📖 Reading Level</div>' +
        '</div>' +
        '<div class="nx-level-switch">' +
          '<button type="button" class="nx-level-btn active" id="nx-mode-standard">Full Story</button>' +
          '<button type="button" class="nx-level-btn" id="nx-mode-kidtake">🧒 Kid Take (Age 8)</button>' +
        '</div>' +
        '<div style="margin-top:12px">' +
          '<button type="button" class="nx-btn nx-btn-primary" style="width:100%;justify-content:center;" id="nx-narrate-btn">' +
            '▶ Listen with Piper Audio' +
          '</button>' +
        '</div>' +
      '</div>' +

      '<div class="nx-dock-card highlight-solar">' +
        '<div class="nx-dock-header">' +
          '<div class="nx-dock-title">💡 Dinner Table Spark</div>' +
          '<span style="font-size:0.75rem;color:var(--nx-solar)">Parent &amp; Family</span>' +
        '</div>' +
        '<div class="nx-spark-prompt">' +
          '"What would be the most exciting part of building this yourself?"' +
        '</div>' +
        '<button type="button" class="nx-cheer-btn" onclick="window.NexusUI.triggerCheer(event)">' +
          '🚀 Send Rocket Cheer (+5 XP)' +
        '</button>' +
      '</div>' +

      '<div class="nx-dock-card">' +
        '<div class="nx-dock-header">' +
          '<div class="nx-dock-title">🧠 Daily Challenge</div>' +
          '<span style="font-size:0.75rem;color:var(--nx-cyan)">XP Quiz</span>' +
        '</div>' +
        '<p style="font-size:0.85rem;color:var(--nx-text-secondary);margin-bottom:12px;">Test your grasp of this story and unlock the weekly constellation badge.</p>' +
        '<a href="/pages/quiz.html" class="nx-btn nx-btn-glass" style="width:100%;justify-content:center;">' +
          'Start 60-Sec Quiz &rarr;' +
        '</a>' +
      '</div>';

    wrapper.appendChild(narrativeCol);
    wrapper.appendChild(dock);
    container.appendChild(wrapper);

    var narrateBtn = dock.querySelector('#nx-narrate-btn');
    if (narrateBtn) {
      narrateBtn.addEventListener('click', function () {
        playStoryAudio(title);
      });
    }

    var stdBtn = dock.querySelector('#nx-mode-standard');
    var kidBtn = dock.querySelector('#nx-mode-kidtake');
    if (stdBtn && kidBtn) {
      kidBtn.addEventListener('click', function () {
        kidBtn.classList.add('active');
        stdBtn.classList.remove('active');
        showKidTakeBanner(narrativeCol, kidTakeText);
      });
      stdBtn.addEventListener('click', function () {
        stdBtn.classList.add('active');
        kidBtn.classList.remove('active');
        hideKidTakeBanner(narrativeCol);
      });
    }
  }

  function showKidTakeBanner(parentCol, text) {
    var banner = parentCol.querySelector('#nx-active-kidtake-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'nx-active-kidtake-banner';
      banner.style.cssText = 'background:rgba(0,229,255,0.1);border-left:4px solid var(--nx-cyan);border-radius:0 12px 12px 0;padding:18px;margin-bottom:20px;font-size:1.15rem;line-height:1.7;color:#ffffff;';
      banner.innerHTML = '<strong>🧒 Kid Take (Easy Read):</strong><br>' + text;
      parentCol.insertBefore(banner, parentCol.firstChild);
    }
    banner.style.display = 'block';
  }

  function hideKidTakeBanner(parentCol) {
    var banner = parentCol.querySelector('#nx-active-kidtake-banner');
    if (banner) banner.style.display = 'none';
  }

  // ------------------------------------------------------------
  // 5. ROCKET CHEER ANIMATION TRIGGER
  // ------------------------------------------------------------
  function triggerCheer(e) {
    var count = 14;
    var emojis = ['🚀', '✨', '⭐', '🌟', '🎉', '🧠'];
    var x = e ? e.clientX : window.innerWidth / 2;
    var y = e ? e.clientY : window.innerHeight / 2;

    for (var i = 0; i < count; i++) {
      var p = document.createElement('div');
      p.className = 'nx-rocket-particle';
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.setProperty('--tx', (Math.random() * 260 - 130) + 'px');
      p.style.setProperty('--ty', (-180 - Math.random() * 180) + 'px');
      document.body.appendChild(p);

      (function (particle) {
        setTimeout(function () { particle.remove(); }, 1800);
      })(p);
    }

    try {
      fetch('/api/cheers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji: '🚀', note: 'Sent a Rocket Cheer!' })
      }).catch(function () {});
    } catch (err) {}
  }
  NexusUI.triggerCheer = triggerCheer;

  // ------------------------------------------------------------
  // 6. SMARTBOARD BELL-RINGER MODAL (TEACHER)
  // ------------------------------------------------------------
  function openBellRingerModal() {
    var modal = document.getElementById('nx-bell-ringer-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'nx-bell-ringer-modal';
      modal.className = 'nx-projector-modal';
      modal.innerHTML = 
        '<div class="nx-projector-header">' +
          '<div style="display:flex;align-items:center;gap:16px;">' +
            '<span class="nx-projector-badge">Classroom Bell-Ringer</span>' +
            '<span style="color:var(--nx-text-secondary);font-size:1.1rem;">Skynet Nexus Morning Edition</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:20px;">' +
            '<div class="nx-projector-timer" id="nx-bell-timer">03:00</div>' +
            '<button type="button" class="nx-btn nx-btn-glass" id="nx-timer-toggle">Start Timer</button>' +
            '<button type="button" class="nx-btn nx-btn-glass" onclick="document.getElementById(\'nx-bell-ringer-modal\').classList.remove(\'active\')">✕ Exit Fullscreen</button>' +
          '</div>' +
        '</div>' +
        '<div class="nx-projector-body">' +
          '<div>' +
            '<div class="nx-projector-title">Robots Learn to Navigate Ocean Moons</div>' +
            '<div class="nx-projector-take">' +
              '"Scientists have developed autonomous submarine robots that use micro-sensors to chart liquid oceans underneath thick extraterrestrial ice."' +
            '</div>' +
            '<div class="nx-projector-prompt">' +
              '<h3>🗣️ 3-Minute Table Discussion:</h3>' +
              '<p>What is the most difficult challenge a robot faces when exploring an ocean without sunlight?</p>' +
            '</div>' +
          '</div>' +
          '<div class="nx-projector-qr-card">' +
            '<div style="font-size:1.2rem;font-weight:800;color:var(--nx-cyan);margin-bottom:8px;">📱 Scan on Chromebook or Tablet</div>' +
            '<p style="color:var(--nx-text-secondary);font-size:0.95rem;margin-bottom:16px;">Students join the classroom quiz automatically.</p>' +
            '<div style="width:180px;height:180px;background:#ffffff;margin:0 auto;border-radius:12px;display:grid;place-items:center;font-size:72px;">' +
              '📶' +
            '</div>' +
            '<div style="margin-top:16px;font-family:var(--font-mono);font-size:1.1rem;color:var(--nx-emerald);">Code: NEXUS-STEM-2026</div>' +
          '</div>' +
        '</div>';

      document.body.appendChild(modal);

      var timerEl = modal.querySelector('#nx-bell-timer');
      var timerBtn = modal.querySelector('#nx-timer-toggle');
      var remaining = 180;
      var interval = null;

      timerBtn.addEventListener('click', function () {
        if (interval) {
          clearInterval(interval);
          interval = null;
          timerBtn.textContent = 'Resume Timer';
        } else {
          timerBtn.textContent = 'Pause Timer';
          interval = setInterval(function () {
            if (remaining <= 0) {
              clearInterval(interval);
              timerEl.textContent = '00:00';
              alert('Time is up for today’s STEM Bell-Ringer!');
              return;
            }
            remaining--;
            var mins = String(Math.floor(remaining / 60)).padStart(2, '0');
            var secs = String(remaining % 60).padStart(2, '0');
            timerEl.textContent = mins + ':' + secs;
          }, 1000);
        }
      });
    }

    modal.classList.add('active');
  }
  NexusUI.openBellRingerModal = openBellRingerModal;

})();
