// Skynet Nexus — narration voice picker.
// Inserts a voice dropdown next to the article Listen button and rewires Listen
// to play server narration MP3s (/assets/audio/<article-id>-<voice>.mp3) from the
// Piper voices (Lessac / Amy / Ryan / Danny), falling back to browser TTS while
// an MP3 is still being generated. Voice choice persists per device.
(function () {
  'use strict';

  var VOICES = [
    ['lessac', 'Lessac'],
    ['amy', 'Amy'],
    ['ryan', 'Ryan'],
    ['danny', 'Danny']
  ];
  var DEF_VOICE = 'lessac';
  var LS_KEY = 'skeynet_listen_voice';
  var LS_SPEED_KEY = 'skynet_listen_speed';
  var SPEEDS = [['0.75','0.75x'],['1','1x'],['1.25','1.25x'],['1.5','1.5x']];
  var DEF_SPEED = '1';
  function speedGet() { try { var v = localStorage.getItem(LS_SPEED_KEY); return SPEEDS.some(function(s){return s[0]===v;}) ? v : DEF_SPEED; } catch (e) { return DEF_SPEED; } }
  function speedSet(v) { try { localStorage.setItem(LS_SPEED_KEY, v); } catch (e) {} }

  function lsGet(d) { try { var v = localStorage.getItem(LS_KEY); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(v) { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch (e) {} }
  function articleId() {
    try { return new URLSearchParams(location.search).get('id') || ''; } catch (e) { return ''; }
  }

  // Article text for the browser-TTS fallback (fetched once, cached).
  var articleTextPromise = null;
  function getArticleText() {
    if (!articleTextPromise) {
      articleTextPromise = (async function () {
        var id = articleId();
        if (!id) return '';
        var man = await (await fetch('/api/manifest')).json();
        var arts = man.articles || [];
        var entry = arts.find(function (x) { return String(x.id) === String(id); });
        if (!entry || !entry.path) return '';
        var rel = String(entry.path).replace(/^data\//, '');
        var aj = await (await fetch('/data/' + rel)).json();
        var tmp = document.createElement('div');
        tmp.innerHTML = aj.body || '';
        var bodyText = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
        return [aj.title, aj.kidTake, bodyText].filter(Boolean).join('. ');
      })().catch(function () { return ''; });
    }
    return articleTextPromise;
  }

  function browserTTS(onDone) {
    if (!('speechSynthesis' in window)) { onDone(false); return; }
    getArticleText().then(function (text) {
      if (!text) { onDone(false); return; }
      var synth = window.speechSynthesis;
      try { synth.getVoices(); } catch (e) {}
      var vs = synth.getVoices().filter(function (v) { return v.lang && v.lang.toLowerCase().indexOf('en') === 0; });
      var voice = vs.find(function (v) { return /google us english/i.test(v.name); }) ||
                  vs.find(function (v) { return /samantha|zira|aria|jenny/i.test(v.name); }) ||
                  vs[0] || null;
      var sentences = text.match(/[^.!?]+[.!?]+["']?|\S[^.!?]*$/g) || [text];
      var chunks = [], cur = '';
      sentences.forEach(function (s) {
        if ((cur + ' ' + s).length > 220) { if (cur) chunks.push(cur.trim()); cur = s; }
        else cur += ' ' + s;
      });
      if (cur.trim()) chunks.push(cur.trim());
      synth.cancel();
      onDone(true);
      chunks.forEach(function (chunk, i) {
        var u = new SpeechSynthesisUtterance(chunk);
        if (voice) u.voice = voice;
        u.rate = parseFloat(speedGet()) || 1; u.pitch = 1;
        if (i === chunks.length - 1) u.onend = function () { onDone(false); };
        u.onerror = function () { onDone(false); };
        synth.speak(u);
      });
    });
  }

  function wire() {
    var btn = document.getElementById('btn-listen');
    if (!btn || document.getElementById('voice-picker')) return false;

    // Voice dropdown next to the Listen button.
    var sel = document.createElement('select');
    sel.id = 'voice-picker';
    sel.className = 'share-btn voice-picker';
    sel.title = 'Narration voice';
    sel.setAttribute('aria-label', 'Narration voice');
    sel.innerHTML = VOICES.map(function (v) {
      return '<option value="' + v[0] + '">\uD83D\uDD0A ' + v[1] + '</option>';
    }).join('');
    sel.value = lsGet(DEF_VOICE);
    sel.addEventListener('change', function () { lsSet(sel.value); });
    btn.insertAdjacentElement('afterend', sel);

    // Playback speed control (0.75x-1.5x), persisted per device.
    var spd = document.createElement('select');
    spd.id = 'speed-picker';
    spd.className = 'share-btn voice-picker';
    spd.title = 'Playback speed';
    spd.setAttribute('aria-label', 'Playback speed');
    spd.innerHTML = SPEEDS.map(function (s) {
      return '<option value="' + s[0] + '">' + s[1] + '</option>';
    }).join('');
    spd.value = speedGet();
    spd.addEventListener('change', function () {
      speedSet(spd.value);
      try { if (audio) audio.playbackRate = parseFloat(spd.value) || 1; } catch (e) {}
    });
    sel.insertAdjacentElement('afterend', spd);

    // Replace the button to drop the old browser-TTS-only listener, then rewire.
    var nb = btn.cloneNode(true);
    btn.replaceWith(nb);

    var audio = null, playing = false;
    function setUI(p) {
      playing = p;
      nb.innerHTML = p
        ? '<span aria-hidden="true">\u23F9</span><span>Stop</span>'
        : '<span aria-hidden="true">\uD83D\uDD0A</span><span>Listen</span>';
      nb.classList.toggle('listening', p);
      nb.setAttribute('aria-pressed', p ? 'true' : 'false');
    }
    function stop() {
      try { if (audio) { audio.pause(); audio = null; } } catch (e) {}
      try { window.speechSynthesis.cancel(); } catch (e) {}
      setUI(false);
    }
    nb.addEventListener('click', function () {
      if (playing || (audio && !audio.paused)) { stop(); return; }
      var vid = sel.value || lsGet(DEF_VOICE);
      var url = '/assets/audio/' + articleId() + '-' + vid + '.mp3';
      fetch(url, { method: 'HEAD' }).then(function (h) {
        if (!h.ok) throw new Error('no mp3');
        audio = new Audio(url);
        try { audio.playbackRate = parseFloat(speedGet()) || 1; } catch (e) {}
        audio.onended = function () { audio = null; setUI(false); };
        audio.onerror = function () { audio = null; browserTTS(function (ok) { if (ok) setUI(true); else setUI(false); }); };
        setUI(true);
        return audio.play();
      }).then(function () {
        // playing
      }).catch(function () {
        audio = null;
        // MP3 not ready — try on-demand server TTS (Kokoro), then browser TTS.
        var ttsUrl = '/api/tts/audio/' + encodeURIComponent(articleId()) + '/af_heart';
        fetch(ttsUrl, { credentials: 'same-origin' }).then(function (tr) {
          if (!tr.ok) throw new Error('no server tts');
          return tr.blob();
        }).then(function (blob) {
          var url = URL.createObjectURL(blob);
          audio = new Audio(url);
          try { audio.playbackRate = parseFloat(speedGet()) || 1; } catch (e) {}
          audio.onended = function () { URL.revokeObjectURL(url); audio = null; setUI(false); };
          audio.onerror = function () { URL.revokeObjectURL(url); audio = null; browserTTS(function (ok) { setUI(!!ok); }); };
          setUI(true);
          return audio.play();
        }).catch(function () {
          audio = null;
          browserTTS(function (ok) { setUI(!!ok); });
        });
      });
    });
    document.addEventListener('pagehide', stop);

    // Move the action toolbar (Save, Share, Listen) to the top of the article,
    // right after the Read together nav — static in the flow, never floating.
    try {
      var toolbar = document.querySelector('.article-toolbar');
      var journey = document.querySelector('.read-journey');
      if (toolbar && journey && toolbar.previousElementSibling !== journey) {
        journey.insertAdjacentElement('afterend', toolbar);
      }
    } catch (e) {}
    return true;
  }

  // The article renders async — poll until the Listen button exists.
  var tries = 0;
  var timer = setInterval(function () {
    if (wire() || ++tries > 100) clearInterval(timer);
  }, 250);
})();
