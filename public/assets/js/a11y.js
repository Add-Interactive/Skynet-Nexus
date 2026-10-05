/* Skynet Nexus Accessibility — audio guide, voice commands, gesture nav.
   Activated per-kid via parent settings. Parent declares blindness in kid profile. */
(function () {
  'use strict';
  var A11Y = window.NexusA11y = {};

  var settings = { audioGuide: false, voiceCommands: false, largeText: false, highContrast: false };
  var speaking = false;

  function speak(text) {
    if (!settings.audioGuide || !text) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text).slice(0, 500));
      u.rate = 1.0; u.pitch = 1.0;
      speaking = true;
      u.onend = function () { speaking = false; };
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  A11Y.speak = speak;
  A11Y.stop = function () { try { speechSynthesis.cancel(); } catch (e) {} };

  function applyVisual() {
    document.documentElement.classList.toggle('a11y-large', !!settings.largeText);
    document.documentElement.classList.toggle('a11y-contrast', !!settings.highContrast);
  }

  // Announce page on load
  function announcePage() {
    if (!settings.audioGuide) return;
    var t = document.title.replace(/·.*$/, '').trim();
    var h1 = document.querySelector('h1');
    var label = h1 ? h1.textContent.trim().slice(0, 120) : t;
    setTimeout(function () { speak('You are on: ' + label + '. Swipe right for next, left for previous. Double tap to read aloud. Say "help" for voice commands.'); }, 600);
  }

  // Speak focused buttons/links
  function bindFocusAnnounce() {
    document.addEventListener('focusin', function (e) {
      if (!settings.audioGuide) return;
      var el = e.target;
      var label = el.getAttribute('aria-label') || el.textContent.trim().slice(0, 80) || el.tagName;
      if (label) speak(label);
    });
  }

  // ---- Voice commands ----
  var recog = null;
  function startVoice() {
    if (!settings.voiceCommands) return;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { console.warn('[a11y] speech recognition unavailable'); return; }
    try {
      recog = new SR();
      recog.continuous = true; recog.interimResults = false; recog.lang = 'en-US';
      recog.onresult = function (e) {
        var cmd = e.results[e.results.length - 1][0].transcript.toLowerCase().trim();
        handleCommand(cmd);
      };
      recog.onend = function () { if (settings.voiceCommands) { try { recog.start(); } catch (x) {} } };
      recog.start();
      speak('Voice commands on. Say help to hear commands.');
    } catch (e) {}
  }
  function handleCommand(cmd) {
    if (cmd.includes('help')) { speak('Commands: go home. read this. next story. previous story. go back. stop talking.'); return; }
    if (cmd.includes('stop talking') || cmd.includes('be quiet')) { A11Y.stop(); return; }
    if (cmd.includes('go home')) { location.href = '/'; return; }
    if (cmd.includes('go back')) { history.back(); return; }
    if (cmd.includes('next story') || cmd.includes('next article')) {
      var n = document.querySelector('[data-next], .pager-next, a[rel="next"]');
      if (n) n.click(); else speak('No next story found.');
      return;
    }
    if (cmd.includes('previous story') || cmd.includes('last story')) {
      var p = document.querySelector('[data-prev], .pager-prev, a[rel="prev"]');
      if (p) p.click(); else speak('No previous story found.');
      return;
    }
    if (cmd.includes('read this') || cmd.includes('read aloud') || cmd.includes('read article')) {
      readArticle(); return;
    }
    if (cmd.includes('my profile') || cmd.includes('dashboard')) { location.href = '/pages/profile.html'; return; }
  }
  function readArticle() {
    var art = document.querySelector('article, .article-body, main');
    var text = art ? art.textContent.trim().slice(0, 4000) : document.body.textContent.trim().slice(0, 4000);
    if (text) { A11Y.stop(); speak(text); } else speak('Nothing to read here.');
  }
  A11Y.readArticle = readArticle;

  // ---- Gestures ----
  function bindGestures() {
    var sx = 0, sy = 0, lastTap = 0;
    document.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY;
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0];
      var dx = t.clientX - sx, dy = t.clientY - sy;
      var now = Date.now();
      // Double-tap: read aloud
      if (now - lastTap < 350 && Math.abs(dx) < 20 && Math.abs(dy) < 20) {
        if (settings.audioGuide) { readArticle(); }
        lastTap = 0; return;
      }
      lastTap = now;
      // Horizontal swipe: navigate (only if mostly horizontal)
      if (Math.abs(dx) > 90 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        if (dx < 0) { var n = document.querySelector('[data-next], .pager-next, a[rel="next"]'); if (n) { speak('Next story'); n.click(); } }
        else { var p = document.querySelector('[data-prev], .pager-prev, a[rel="prev"]'); if (p) { speak('Previous story'); p.click(); } }
      }
    }, { passive: true });
    // Triple-tap anywhere: toggle voice commands help
    var taps = 0, tapTimer = null;
    document.addEventListener('touchend', function () {
      taps++;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(function () {
        if (taps >= 3 && settings.audioGuide) speak('Voice commands: say go home, read this, next story, previous story, or go back.');
        taps = 0;
      }, 400);
    }, { passive: true });
  }

  // ---- Init ----
  A11Y.init = function (kidId) {
    if (!kidId) return;
    fetch('/api/kids/' + kidId + '/a11y', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        settings.audioGuide = !!s.audioGuide;
        settings.voiceCommands = !!s.voiceCommands;
        settings.largeText = !!s.largeText;
        settings.highContrast = !!s.highContrast;
        if (!settings.audioGuide && !settings.voiceCommands && !settings.largeText && !settings.highContrast) return;
        applyVisual();
        bindFocusAnnounce();
        bindGestures();
        announcePage();
        if (settings.voiceCommands) startVoice();
      })
      .catch(function () {});
  };

  // Auto-init if kid id in localStorage (set at login/kid switch)
  document.addEventListener('DOMContentLoaded', function () {
    try {
      var kidId = localStorage.getItem('nexus_active_kid');
      if (kidId) A11Y.init(kidId);
    } catch (e) {}
  });
})();
