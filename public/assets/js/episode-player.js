/* Skynet Nexus — Episode Player (Watch mode)
   Turns an edition of the newsroom into a TV episode: Marcus hosts the open,
   then every story plays as a fullscreen narrated segment with auto-advance.
   Data: /api/manifest (same article feed as the homepage).
   Narration: /assets/audio/<article-id>-<voice>.mp3 (Piper voices, rotated
   per story; silent-caption fallback when a story has no audio yet). */
(function () {
  'use strict';
  var VOICES = ['lessac', 'amy', 'ryan', 'danny'];
  var EDITION_LABEL = { morning: 'Morning Edition', midday: 'Midday Edition', evening: 'Evening Edition' };
  var EDITION_EMOJI = { morning: '🌅', midday: '☀️', evening: '🌆' };
  var TITLE_CARD_MS = 4500;

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    poster: $('poster'), posterTitle: $('posterTitle'), posterMeta: $('posterMeta'),
    playBtn: $('playBtn'), posterErr: $('posterErr'), epPickerRow: $('epPickerRow'), epSelect: $('epSelect'),
    controls: $('controls'), ticks: $('ticks'), epLabel: $('epLabel'),
    prevBtn: $('prevBtn'), nextBtn: $('nextBtn'), playPauseBtn: $('playPauseBtn'), fsBtn: $('fsBtn'),
    storyLayer: $('storyLayer'), heroImg: $('heroImg'), catDot: $('catDot'), catLabel: $('catLabel'),
    byline: $('byline'), storyTitle: $('storyTitle'), storyCaption: $('storyCaption'), segCounter: $('segCounter'),
    videoLayer: $('videoLayer'), hostVideo: $('hostVideo'),
    titleLayer: $('titleLayer'), titleCardName: $('titleCardName'), titleCardMeta: $('titleCardMeta'),
    outroLayer: $('outroLayer'), outroMeta: $('outroMeta'), replayBtn: $('replayBtn'),
    narrAudio: $('narrAudio')
  };

  var episodes = [];       // [{key, date, edition, stories:[...]}] newest first
  var ep = null;           // current episode
  var segments = [];       // [{type:'open'|'title'|'story'|'outro', story?, storyIndex?}]
  var segIdx = -1;
  var playing = false;
  var started = false;
  var timerElapsed = 0;    // ms accumulated for timer-driven segments
  var timerTarget = 0;
  var lastTick = 0;
  var voiceTry = 0;        // which voice offset we're on for the current story
  var silentTarget = 0;    // fallback duration when no narration exists
  var hideTimer = null;

  /* ---------- data ---------- */
  function fmtDate(dateStr) {
    var p = dateStr.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  function fmtDateShort(dateStr) {
    var p = dateStr.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function epName(e) { return (EDITION_EMOJI[e.edition] || '🛰️') + ' ' + (EDITION_LABEL[e.edition] || 'Edition'); }

  function buildEpisodes(articles) {
    var groups = {};
    articles.forEach(function (a) {
      if (!a || !a.date || !a.edition || !a.title) return;
      var key = a.date + '-' + a.edition;
      if (!groups[key]) groups[key] = { key: key, date: a.date, edition: a.edition, stories: [], latest: '' };
      groups[key].stories.push(a);
      var pub = a.publishedAt || a.date;
      if (pub > groups[key].latest) groups[key].latest = pub;
    });
    var list = Object.keys(groups).map(function (k) { return groups[k]; });
    list.forEach(function (g) {
      g.stories.sort(function (x, y) {
        return String(x.publishedAt || '').localeCompare(String(y.publishedAt || '')) ||
               String(x.id).localeCompare(String(y.id));
      });
    });
    list.sort(function (a, b) { return String(b.latest).localeCompare(String(a.latest)); });
    return list;
  }

  function pickDefaultEpisode(list) {
    for (var i = 0; i < list.length; i++) if (list[i].stories.length >= 5) return list[i];
    return list[0] || null;
  }

  /* ---------- segments ---------- */
  function buildSegments() {
    segments = [{ type: 'open' }, { type: 'title' }];
    ep.stories.forEach(function (s, i) { segments.push({ type: 'story', story: s, storyIndex: i }); });
    segments.push({ type: 'outro' });
    els.ticks.innerHTML = '';
    segments.forEach(function () {
      var t = document.createElement('div');
      t.className = 'tick';
      t.appendChild(document.createElement('i'));
      els.ticks.appendChild(t);
    });
    els.epLabel.innerHTML = '';
    els.epLabel.appendChild(document.createTextNode(epName(ep)));
    var small = document.createElement('small');
    small.textContent = fmtDate(ep.date) + ' · ' + ep.stories.length + (ep.stories.length === 1 ? ' story' : ' stories');
    els.epLabel.appendChild(small);
    els.outroMeta.textContent = 'You just watched the ' + (EDITION_LABEL[ep.edition] || 'edition') + ' from ' + fmtDate(ep.date) + ' — ' + ep.stories.length + (ep.stories.length === 1 ? ' story' : ' stories') + ', hosted by Marcus Reed.';
  }

  function showLayer(name) {
    els.storyLayer.classList.toggle('on', name === 'story');
    els.videoLayer.classList.toggle('on', name === 'video');
    els.titleLayer.classList.toggle('on', name === 'title');
    els.outroLayer.classList.toggle('on', name === 'outro');
  }

  function setTick(i, frac, done) {
    var tick = els.ticks.children[i];
    if (!tick) return;
    tick.classList.toggle('done', !!done);
    tick.firstChild.style.width = done ? '100%' : Math.round((frac || 0) * 100) + '%';
  }
  function refreshTicks() {
    segments.forEach(function (_, i) {
      if (i < segIdx) setTick(i, 1, true);
      else if (i > segIdx) setTick(i, 0, false);
    });
  }

  function stopMedia() {
    try { els.narrAudio.pause(); } catch (e) {}
    try { els.hostVideo.pause(); } catch (e) {}
  }

  function silentSecondsFor(story) {
    var text = (story.kidTake || story.excerpt || story.title || '');
    var s = 9 + text.length / 11;
    return Math.max(10, Math.min(26, s));
  }

  function startStoryAudio(seg) {
    voiceTry = 0;
    tryVoice(seg);
  }
  function tryVoice(seg) {
    var voice = VOICES[(seg.storyIndex + voiceTry) % VOICES.length];
    var src = '/assets/audio/' + seg.story.id + '-' + voice + '.mp3';
    els.narrAudio.src = src;
    var p = els.narrAudio.play();
    if (p && p.catch) p.catch(function () { /* error event also fires; handled there */ });
  }

  function goToSegment(i) {
    if (i < 0) i = 0;
    if (i >= segments.length) i = segments.length - 1;
    stopMedia();
    segIdx = i;
    timerElapsed = 0;
    lastTick = performance.now();
    var seg = segments[i];
    refreshTicks();
    setTick(i, 0, false);
    if (seg.type === 'open') {
      showLayer('video');
      timerTarget = 0;
      els.hostVideo.currentTime = 0;
      var p = els.hostVideo.play();
      if (p && p.catch) p.catch(function () { advance(); });
    } else if (seg.type === 'title') {
      els.titleCardName.textContent = epName(ep);
      els.titleCardMeta.textContent = fmtDate(ep.date) + ' · ' + ep.stories.length + (ep.stories.length === 1 ? ' story' : ' stories') + ' · hosted by Marcus Reed';
      showLayer('title');
      timerTarget = TITLE_CARD_MS;
    } else if (seg.type === 'story') {
      var s = seg.story;
      showLayer('story');
      els.segCounter.textContent = 'Story ' + (seg.storyIndex + 1) + ' of ' + ep.stories.length;
      els.catDot.style.background = s.color || '#39c6ff';
      els.catLabel.textContent = (s.emoji ? s.emoji + ' ' : '') + (s.cat || 'story');
      els.byline.textContent = s.author ? 'with ' + s.author : '';
      els.storyTitle.textContent = s.title;
      els.storyCaption.textContent = s.kidTake || s.excerpt || '';
      els.heroImg.classList.remove('kenburns');
      els.heroImg.src = s.heroImage || '';
      els.heroImg.alt = s.title;
      // restart the Ken Burns drift on the new image
      void els.heroImg.offsetWidth;
      els.heroImg.classList.add('kenburns');
      silentTarget = silentSecondsFor(s) * 1000;
      timerTarget = 0;
      if (playing) startStoryAudio(seg);
      // preload the next story's art
      var nxt = segments[i + 1];
      if (nxt && nxt.type === 'story' && nxt.story.heroImage) { var im = new Image(); im.src = nxt.story.heroImage; }
    } else if (seg.type === 'outro') {
      showLayer('outro');
      timerTarget = 0;
      setTick(i, 1, true);
    }
    updatePlayPauseIcon();
  }

  function advance() { if (segIdx < segments.length - 1) goToSegment(segIdx + 1); }
  function back() { if (segIdx > 0) goToSegment(segIdx - 1); }

  function setPlaying(on) {
    playing = on;
    var seg = segments[segIdx];
    if (!seg) { updatePlayPauseIcon(); return; }
    if (on) {
      lastTick = performance.now();
      if (seg.type === 'open') { var p = els.hostVideo.play(); if (p && p.catch) p.catch(function () {}); }
      if (seg.type === 'story') {
        if (els.narrAudio.src && !els.narrAudio.ended) { var q = els.narrAudio.play(); if (q && q.catch) q.catch(function () {}); }
        else startStoryAudio(seg);
      }
    } else {
      stopMedia();
    }
    updatePlayPauseIcon();
    pokeControls();
  }
  function updatePlayPauseIcon() { els.playPauseBtn.textContent = playing ? '⏸' : '▶'; }

  /* ---------- engine loop (timer segments + progress) ---------- */
  setInterval(function () {
    var now = performance.now();
    var dt = now - lastTick;
    lastTick = now;
    if (!started || !playing || segIdx < 0) return;
    var seg = segments[segIdx];
    if (!seg) return;
    if (seg.type === 'title') {
      timerElapsed += dt;
      setTick(segIdx, timerElapsed / timerTarget, false);
      if (timerElapsed >= timerTarget) advance();
    } else if (seg.type === 'story') {
      var a = els.narrAudio;
      if (a.src && a.duration && isFinite(a.duration) && a.duration > 0) {
        setTick(segIdx, a.currentTime / a.duration, false);
      } else {
        timerElapsed += dt;
        setTick(segIdx, timerElapsed / silentTarget, false);
        if (timerElapsed >= silentTarget) advance();
      }
    } else if (seg.type === 'open') {
      var v = els.hostVideo;
      if (v.duration && isFinite(v.duration) && v.duration > 0) setTick(segIdx, v.currentTime / v.duration, false);
    }
  }, 200);

  els.narrAudio.addEventListener('ended', function () { if (playing) advance(); });
  els.narrAudio.addEventListener('error', function () {
    var seg = segments[segIdx];
    if (!seg || seg.type !== 'story' || !playing) return;
    voiceTry++;
    if (voiceTry < VOICES.length) tryVoice(seg);
    // else: no narration in any voice — the engine loop's silent timer takes over
  }, true);
  els.hostVideo.addEventListener('ended', function () { if (playing) advance(); });
  els.hostVideo.addEventListener('error', function () {
    var seg = segments[segIdx];
    if (seg && seg.type === 'open' && playing) advance();
  }, true);

  /* ---------- controls ---------- */
  function pokeControls() {
    els.controls.classList.remove('hidden');
    if (hideTimer) clearTimeout(hideTimer);
    if (playing) hideTimer = setTimeout(function () { els.controls.classList.add('hidden'); }, 3200);
  }
  document.addEventListener('pointermove', pokeControls);
  document.addEventListener('pointerdown', pokeControls);
  els.prevBtn.addEventListener('click', function () { back(); pokeControls(); });
  els.nextBtn.addEventListener('click', function () { advance(); pokeControls(); });
  els.playPauseBtn.addEventListener('click', function () { setPlaying(!playing); });
  els.fsBtn.addEventListener('click', function () {
    var st = document.getElementById('stage');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (st.requestFullscreen) st.requestFullscreen();
  });
  document.addEventListener('keydown', function (e) {
    if (!started) return;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
    else if (e.key === 'ArrowRight') advance();
    else if (e.key === 'ArrowLeft') back();
  });
  els.replayBtn.addEventListener('click', function () { setPlaying(true); goToSegment(0); });

  /* ---------- boot ---------- */
  function selectEpisode(key, autoplay) {
    for (var i = 0; i < episodes.length; i++) {
      if (episodes[i].key === key) { ep = episodes[i]; break; }
    }
    if (!ep) ep = episodes[0];
    buildSegments();
    els.posterTitle.textContent = epName(ep);
    els.posterMeta.textContent = fmtDate(ep.date) + ' · ' + ep.stories.length + (ep.stories.length === 1 ? ' story' : ' stories') + ' · Marcus hosts, every story narrated.';
    try { history.replaceState(null, '', '?episode=' + encodeURIComponent(ep.key)); } catch (e) {}
    if (autoplay) startPlayback();
  }

  function startPlayback() {
    if (!ep) return;
    started = true;
    els.poster.style.display = 'none';
    setPlaying(true);
    goToSegment(0);
    pokeControls();
  }

  els.playBtn.addEventListener('click', startPlayback);
  els.epSelect.addEventListener('change', function () { selectEpisode(els.epSelect.value, started); });

  fetch('/api/manifest', { credentials: 'same-origin' })
    .then(function (r) { if (!r.ok) throw new Error('manifest ' + r.status); return r.json(); })
    .then(function (data) {
      var articles = (data && data.articles) || (Array.isArray(data) ? data : []);
      episodes = buildEpisodes(articles).slice(0, 12);
      if (!episodes.length) throw new Error('No episodes yet — check back after the next edition drops.');
      els.epSelect.innerHTML = '';
      episodes.forEach(function (e) {
        var opt = document.createElement('option');
        opt.value = e.key;
        opt.textContent = epName(e) + ' · ' + fmtDateShort(e.date) + ' · ' + e.stories.length + (e.stories.length === 1 ? ' story' : ' stories');
        els.epSelect.appendChild(opt);
      });
      var want = null;
      try { want = new URLSearchParams(location.search).get('episode'); } catch (e) {}
      var initial = null;
      if (want) for (var i = 0; i < episodes.length; i++) if (episodes[i].key === want) initial = episodes[i];
      if (!initial) initial = pickDefaultEpisode(episodes);
      els.epSelect.value = initial.key;
      els.epPickerRow.hidden = episodes.length < 2;
      selectEpisode(initial.key, false);
      els.playBtn.disabled = false;
    })
    .catch(function (err) {
      els.posterTitle.textContent = 'The episode could not load';
      els.posterErr.textContent = 'Please try again in a little while. (' + (err && err.message ? err.message : 'network error') + ')';
    });
})();
