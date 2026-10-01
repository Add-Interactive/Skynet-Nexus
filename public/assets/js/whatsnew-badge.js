// What's New badge: cyan dot on "What's New" links when updates are unseen.
(function () {
  function mark() {
    try {
      var seen = localStorage.getItem('sky_whatsnew_seen') || '';
      fetch('/data/whats-new.json', { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (items) {
          if (!items.length) return;
          items.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
          if (items[0].date > seen) {
            document.querySelectorAll('a[data-whatsnew]').forEach(function (a) {
              if (a.querySelector('.wn-dot')) return;
              var dot = document.createElement('span');
              dot.className = 'wn-dot';
              dot.textContent = ' \u25cf';
              dot.style.cssText = 'color:#00e5ff;font-size:10px;';
              dot.title = 'New updates';
              a.appendChild(dot);
            });
          }
        })
        .catch(function () {});
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mark);
  else mark();
})();
