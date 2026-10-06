// Injects "Debug Checklist" link + live progress into profile settings for beta testers.
(function () {
  function boot() {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var user = d && d.user;
        if (!user || !user.isBetaTester) return;
        var tries = 0;
        var timer = setInterval(function () {
          var panel = document.getElementById('p-settings');
          if (panel && !document.getElementById('debug-checklist-row')) {
            var p = document.createElement('p');
            p.id = 'debug-checklist-row';
            p.style.marginTop = '14px';
            p.innerHTML = '<a class="btn" href="/pages/debug-checklist.html">\uD83E\uDDEA Debug Checklist</a> ' +
              '<span style="color:#8899bb;font-size:13px" id="debug-checklist-pct"></span>';
            panel.appendChild(p);
            fetch('/api/checklist/progress', { credentials: 'same-origin' })
              .then(function (r) { return r.ok ? r.json() : null; })
              .then(function (pr) {
                if (pr) {
                  var el = document.getElementById('debug-checklist-pct');
                  if (el) el.textContent = pr.percent + '% \u2014 ' + pr.completed + '/' + pr.total;
                }
              }).catch(function () {});
            clearInterval(timer);
          }
          if (++tries > 40) clearInterval(timer);
        }, 500);
      }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
