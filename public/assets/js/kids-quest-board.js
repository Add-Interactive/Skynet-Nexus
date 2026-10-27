/* ============================================================
   SKYNET NEXUS — Kids Mode quest board (piece d)
   Loaded by public/pages/kid.html only, AFTER kids-mode.js.
   Presentation ONLY: it never touches XP, streaks, badges,
   levels, endpoints, or scoring. The numbers on the page stay
   exactly what they are today; only how missions look changes.

   WHAT IT DOES (only while the Kids Mode marker is on):
   - Turns the Daily Cadet Protocols checklist into a quest
     board: a "Today's Quest Board" kicker above the list.
   - Adds one correspondent cheer line per quest, drawn from
     that correspondent's own kidBio/funFact in
     newsroom/agents-config.js (paraphrased into a cheer, never
     a new claim). Portraits honor the visitor's stored
     skynet.corrStyle choice (human/animal/skynet), same pattern
     as the team page.
   - Marks checked quests as done (green ring + "Quest
     complete!" badge) and plays a CSS confetti burst + bounce
     when the kid checks a quest. Unchecking removes the done
     state. The pre-checked quest shows as done on load, with
     no burst (celebrations are for the kid's own tap only).
   - Watches the marker: toggling Kids Mode while on the page
     applies or removes the whole enhancement; toggling off
     leaves the page exactly as it was (all injected nodes and
     classes removed).
   - No-ops on any page without #quest-board, and never depends
     on window.KidsMode existing (it reads the marker directly).
   No new libraries, no autoplay video, no sound. The existing
   checkbox sound handlers on kid.html keep running untouched.
   ============================================================ */
(function () {
  'use strict';

  /* Checklist order -> correspondent cheer. kidBio/funFact
     sources (newsroom/agents-config.js, verbatim themes):
     - Lena Osei (stem): "Science is for everyone" + experiments
       that make you say "whoa".
     - Mira Solano (math): "Math is way more fun than you
       think — I promise" + hidden patterns and puzzles.
     - Hazel Quinn (play): 50+ board games designed and
       play-tested; "Play is serious business". */
  var QUESTS = [
    {
      channel: 'stem', name: 'Lena Osei', emoji: '🔬', accent: '#00e5ff',
      cheer: '\u201cScience is for everyone!\u201d Lena is cheering you on \u2014 today\u2019s story is full of \u201cwhoa\u201d moments. Go find yours!'
    },
    {
      channel: 'math', name: 'Mira Solano', emoji: '📐', accent: '#ef4444',
      cheer: '\u201cPuzzles are way more fun than you think \u2014 I promise!\u201d Mira\u2019s got your back in the Quiz Arena.'
    },
    {
      channel: 'play', name: 'Hazel Quinn', emoji: '🎨', accent: '#39ff14',
      cheer: 'Hazel has designed 50+ board games and play-tested every one \u2014 she says the best part of a story is talking it over together!'
    }
  ];
  var CONFETTI_COLORS = ['#ffd23f', '#ff6ec7', '#00e5ff', '#39ff14', '#a855f7'];

  function corrStyle() {
    try {
      var s = localStorage.getItem('skynet.corrStyle');
      return (s === 'animal' || s === 'skynet') ? s : 'human';
    } catch (e) { return 'human'; }
  }
  function portraitUrl(q) {
    return '/assets/img/channels/' + q.channel + '/portrait-' + corrStyle() + '.webp';
  }
  function isOn() {
    return document.documentElement.getAttribute('data-kids-mode') === 'true';
  }
  function board() { return document.getElementById('quest-board'); }
  function labels() {
    var b = board();
    if (!b) return [];
    return Array.prototype.slice.call(b.querySelectorAll('label'));
  }
  function textDiv(label) { return label.querySelector('div'); }

  function cheerEl(q) {
    var wrap = document.createElement('div');
    wrap.className = 'quest-cheer';
    wrap.style.borderColor = q.accent;
    var img = document.createElement('img');
    img.src = portraitUrl(q);
    img.alt = q.name + ', your quest cheerleader';
    img.loading = 'lazy';
    img.onerror = function () {
      /* One fallback (human portrait), then drop the image
         rather than rendering broken art. */
      if (img.src.indexOf('portrait-human.webp') === -1) {
        img.src = '/assets/img/channels/' + q.channel + '/portrait-human.webp';
      } else if (img.remove) { img.remove(); }
    };
    var text = document.createElement('div');
    text.className = 'quest-cheer-text';
    var name = document.createElement('div');
    name.className = 'quest-cheer-name';
    name.textContent = q.emoji + ' ' + q.name + ' cheers you on:';
    var line = document.createElement('div');
    line.textContent = q.cheer;
    text.appendChild(name);
    text.appendChild(line);
    wrap.appendChild(img);
    wrap.appendChild(text);
    return wrap;
  }

  function badgeEl() {
    var b = document.createElement('span');
    b.className = 'quest-complete-badge';
    b.textContent = '\uD83C\uDF89 Quest complete!';
    return b;
  }

  function burst(label) {
    /* Decorative confetti pieces (CSS-animated, removed after
       the animation so nothing accumulates in the DOM). */
    for (var i = 0; i < 12; i++) {
      (function (piece) {
        piece.className = 'quest-confetti';
        piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        piece.style.left = (8 + Math.random() * 84) + '%';
        piece.style.animationDelay = (Math.random() * 0.15).toFixed(2) + 's';
        label.appendChild(piece);
        var done = false;
        function clean() {
          if (done) return;
          done = true;
          if (piece.remove) piece.remove();
        }
        if (piece.addEventListener) piece.addEventListener('animationend', clean);
        setTimeout(clean, 1400);
      })(document.createElement('i'));
    }
  }

  function markDone(label, celebrate) {
    label.classList.add('quest-done');
    if (!label.querySelector('.quest-complete-badge')) label.appendChild(badgeEl());
    if (celebrate) {
      /* Restart the bounce so rapid re-checks replay it. */
      label.classList.remove('quest-celebrate');
      void label.offsetWidth;
      label.classList.add('quest-celebrate');
      burst(label);
    }
  }
  function markUndone(label) {
    label.classList.remove('quest-done');
    label.classList.remove('quest-celebrate');
    var badge = label.querySelector('.quest-complete-badge');
    if (badge && badge.remove) badge.remove();
  }

  function apply() {
    if (!isOn()) { remove(); return; }
    var b = board();
    if (!b) return;
    if (!b.querySelector('.quest-board-kicker')) {
      var kicker = document.createElement('div');
      kicker.className = 'quest-board-kicker';
      kicker.textContent = '\uD83D\uDDFA\uFE0F Today\u2019s Quest Board';
      b.insertBefore(kicker, b.firstChild);
    }
    labels().forEach(function (label, i) {
      var q = QUESTS[i];
      if (!q) return;
      var text = textDiv(label);
      if (text && !text.querySelector('.quest-cheer')) text.appendChild(cheerEl(q));
      var box = label.querySelector('input[type="checkbox"]');
      if (box && box.checked) markDone(label, false);
      else markUndone(label);
    });
    if (!b._questWired) {
      b.addEventListener('change', function (e) {
        if (!isOn()) return;
        var box = (e.target && e.target.type === 'checkbox') ? e.target : null;
        if (!box) return;
        var label = box.closest ? box.closest('label') : null;
        if (!label) return;
        if (box.checked) markDone(label, true);
        else markUndone(label);
      });
      b._questWired = true;
    }
  }

  function remove() {
    var b = board();
    if (!b) return;
    var kicker = b.querySelector('.quest-board-kicker');
    if (kicker && kicker.remove) kicker.remove();
    labels().forEach(function (label) {
      var text = textDiv(label);
      var cheer = text ? text.querySelector('.quest-cheer') : null;
      if (cheer && cheer.remove) cheer.remove();
      markUndone(label);
    });
  }

  /* Re-apply (or remove) when the marker flips, e.g. the kid
     toggles Kids Mode while already on this page. */
  if (window.MutationObserver) {
    new MutationObserver(function () { apply(); }).observe(
      document.documentElement, { attributes: true, attributeFilter: ['data-kids-mode'] });
  }

  apply();
})();
