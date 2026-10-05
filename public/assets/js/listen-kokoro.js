// public/assets/js/listen-kokoro.js
// Piper TTS narration for articles. Plays pre-generated MP3s from
// /assets/audio/<article-id>-<voice>.mp3 with a voice picker.
// Falls back to browser speechSynthesis if no MP3 exists yet.
(function () {
  'use strict';

  var VOICES = [
    { id: 'lessac', label: 'Heart', desc: 'Warm feminine' },
    { id: 'amy', label: 'Amy', desc: 'Friendly feminine' },
    { id: 'ryan', label: 'Ryan', desc: 'Friendly masculine' },
    { id: 'danny', label: 'Danny', desc: 'Deep masculine' },
  ];
  var DEFAULT_VOICE = 'lessac';

  function init() {
    var btn = document.getElementById('btn-listen');
    if (!btn) return;

    // Remove app.js's speechSynthesis listeners by cloning the button.
    var fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    btn = fresh;

    var article = window.__article || {};
    var articleId = article.id || article.slug;
    if (!articleId) {
      var m = /[?&]id=([^&]+)/.exec(location.search);
      if (m) articleId = decodeURIComponent(m[1]);
    }
    if (!articleId) { btn.style.display = 'none'; return; }

    var st = document.createElement('style');
    st.textContent = '.voice-picker-wrap{display:inline-block;margin-left:8px}' +
      '.voice-picker{background:rgba(255,255,255,.08);color:inherit;border:1px solid rgba(255,255,255,.15);' +
      'border-radius:20px;padding:6px 10px;font-size:13px;cursor:pointer;max-width:190px}' +
      '.voice-picker option{background:#0b1026}';
    document.head.appendChild(st);

    var audio = null, playing = false;
    var voice = null;
    try { voice = localStorage.getItem('sn-voice'); } catch (e) {}
    if (!voice || !VOICES.some(function (v) { return v.id === voice; })) voice = DEFAULT_VOICE;

    function setUI(state, label) {
      btn.classList.toggle('listening', state === 'playing');
      btn.setAttribute('aria-pressed', state === 'playing' ? 'true' : 'false');
      btn.innerHTML = state === 'playing'
        ? '<span aria-hidden="true">⏹</span><span>Stop</span>'
        : state === 'loading'
        ? '<span aria-hidden="true">⏳</span><span>' + (label || 'Loading…') + '</span>'
        : '<span aria-hidden="true">🔊</span><span>Listen</span>';
    }
    function stop() {
      if (audio) { try { audio.pause(); } catch (e) {} audio = null; }
      playing = false; setUI('idle');
    }

    var wrap = document.createElement('span');
    wrap.className = 'voice-picker-wrap';
    var picker = document.createElement('select');
    picker.className = 'voice-picker';
    picker.setAttribute('aria-label', 'Narration voice');
    VOICES.forEach(function (v) {
      var o = document.createElement('option');
      o.value = v.id; o.textContent = '🔊 ' + v.label + ' — ' + v.desc;
      if (v.id === voice) o.selected = true;
      picker.appendChild(o);
    });
    picker.addEventListener('change', function () {
      voice = picker.value;
      try { localStorage.setItem('sn-voice', voice); } catch (e) {}
      if (playing) stop();
    });
    wrap.appendChild(picker);
    btn.parentNode.insertBefore(wrap, btn.nextSibling);

    function audioUrl(v) {
      return '/assets/audio/' + encodeURIComponent(articleId) + '-' + encodeURIComponent(v || voice) + '.mp3';
    }

    btn.addEventListener('click', function () {
      if (playing) { stop(); return; }
      setUI('loading', 'Loading audio…');
      audio = new Audio();
      audio.preload = 'auto';
      audio.oncanplay = function () { playing = true; setUI('playing'); };
      audio.onended = stop;
      audio.onerror = function () {
        // No pre-generated MP3 for this voice yet — fall back to browser TTS.
        stop();
        fallback();
      };
      audio.src = audioUrl();
      audio.play().catch(function () { stop(); fallback(); });
    });

    function fallback() {
      if (!('speechSynthesis' in window)) return;
      var tmp = document.createElement('div');
      tmp.innerHTML = article.body || '';
      var text = [article.title, article.kidTake, (tmp.textContent || '').replace(/\s+/g, ' ').trim()]
        .filter(Boolean).join('. ').slice(0, 4000);
      if (!text) return;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }

    document.addEventListener('pagehide', stop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
