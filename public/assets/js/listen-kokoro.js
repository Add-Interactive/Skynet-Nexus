// public/assets/js/listen-kokoro.js
// Kokoro neural TTS for article Listen button.
// Replaces the browser speechSynthesis implementation with server-generated
// natural voices + a voice picker. Loaded after app.js; takes over #btn-listen.
(function () {
  'use strict';

  function init() {
    var btn = document.getElementById('btn-listen');
    if (!btn) return;

    // Remove app.js's speechSynthesis listeners by cloning the button.
    var fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    btn = fresh;

    // Article data: app.js exposes it via window.__article or data attributes.
    var article = window.__article || {};
    var articleId = article.id || article.slug ||
      (document.querySelector('[data-article-id]') || {}).getAttribute?.('data-article-id');
    if (!articleId) {
      // Fall back to URL ?id= param (article.html uses ?id=)
      var m = /[?&]id=([^&]+)/.exec(location.search);
      if (m) articleId = decodeURIComponent(m[1]);
    }
    if (!articleId) { btn.style.display = 'none'; return; }

    // Inject voice-picker styles.
    var st = document.createElement('style');
    st.textContent = '.voice-picker-wrap{display:inline-block;margin-left:8px}' +
      '.voice-picker{background:rgba(255,255,255,.08);color:inherit;border:1px solid rgba(255,255,255,.15);' +
      'border-radius:20px;padding:6px 10px;font-size:13px;cursor:pointer;max-width:190px}' +
      '.voice-picker option{background:#0b1026}';
    document.head.appendChild(st);

    var audio = null, playing = false;
    var voice = null;
    try { voice = localStorage.getItem('sn-voice'); } catch (e) {}

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

    // Voice picker dropdown.
    var wrap = document.createElement('span');
    wrap.className = 'voice-picker-wrap';
    var picker = document.createElement('select');
    picker.className = 'voice-picker';
    picker.setAttribute('aria-label', 'Narration voice');
    wrap.appendChild(picker);
    btn.parentNode.insertBefore(wrap, btn.nextSibling);

    fetch('/api/tts/voices').then(function (r) { return r.json(); }).then(function (d) {
      var voices = d.voices || [];
      if (!voices.length) { wrap.style.display = 'none'; return; }
      if (!voice || !voices.some(function (v) { return v.id === voice; })) voice = d.default || voices[0].id;
      voices.forEach(function (v) {
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
    }).catch(function () { wrap.style.display = 'none'; });

    btn.addEventListener('click', function () {
      if (playing) { stop(); return; }
      setUI('loading', 'Preparing audio…');
      var url = '/api/articles/' + encodeURIComponent(articleId) + '/audio?voice=' + encodeURIComponent(voice || 'af_heart');
      audio = new Audio();
      audio.preload = 'auto';
      audio.oncanplay = function () { playing = true; setUI('playing'); };
      audio.onended = stop;
      audio.onerror = function () { stop(); fallback(); };
      audio.src = url;
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
