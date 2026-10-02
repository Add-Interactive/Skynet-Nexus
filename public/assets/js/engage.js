// ---------- Web Push: edition drop alerts ----------
var SkyPush = {
  supported: ('serviceWorker' in navigator) && ('PushManager' in window),
  registration: null,
  subscribed: false,

  async init() {
    if (!this.supported) return;
    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');
    } catch (e) { return; }
    try {
      const sub = await this.registration.pushManager.getSubscription();
      this.subscribed = !!sub;
    } catch (e) { /* ignore */ }
  },

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  },

  async toggle() {
    if (!this.supported || !this.registration) { toast('Push notifications are not supported on this browser.'); return; }
    // Requires sign-in so alerts map to a user.
    if (window.SkyAuth) await window.SkyAuth.refresh().catch(() => {});
    if (!window.SkyAuth || !window.SkyAuth.isSignedIn()) {
      toast('Sign in to get drop alerts.');
      return;
    }
    try {
      if (this.subscribed) {
        const sub = await this.registration.pushManager.getSubscription();
        const endpoint = sub ? sub.endpoint : null;
        if (sub) await sub.unsubscribe();
        if (endpoint) {
          await fetch('/api/push/unsubscribe', {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint })
          });
        }
        this.subscribed = false;
        toast('Drop alerts off.');
      } else {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { toast('Notifications blocked — allow them in your browser settings.'); return; }
        const kr = await fetch('/api/push/vapid-key', { credentials: 'same-origin' });
        const { publicKey, enabled } = await kr.json();
        if (!enabled || !publicKey) { toast('Drop alerts are not set up yet.'); return; }
        const sub = await this.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(publicKey)
        });
        const sr = await fetch('/api/push/subscribe', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() })
        });
        if (!sr.ok) throw new Error('subscribe failed');
        this.subscribed = true;
        toast('🔔 You’ll get an alert for every edition drop!');
      }
    } catch (e) {
      toast('Could not change alert setting.');
    }
    renderNotificationsList();
  }
};


// ---------- Teacher assignments ----------
// "Assign to class" button on article pages (teachers/admins). Injected after
// SkyAuth loads because auth.js is deferred.
function injectAssignButton(article) {
  if (document.getElementById('btn-assign')) return;
  const tryInject = () => {
    if (document.getElementById('btn-assign')) return true;
    if (!window.SkyAuth || !SkyAuth.state || !SkyAuth.state.user) return false;
    const role = SkyAuth.state.user.role;
    if (role !== 'teacher' && role !== 'admin') return true; // not a teacher: done
    const toolbar = document.querySelector('.article-toolbar');
    if (!toolbar) return false;
    const btn = document.createElement('button');
    btn.className = 'share-btn';
    btn.id = 'btn-assign';
    btn.innerHTML = '<span aria-hidden="true">📚</span><span>Assign to class</span>';
    btn.addEventListener('click', () => openAssignModal(article));
    toolbar.appendChild(btn);
    return true;
  };
  if (window.SkyAuth && SkyAuth.subscribe) {
    SkyAuth.subscribe(() => tryInject());
  }
  // Poll a few times in case SkyAuth loads late.
  let attempts = 0;
  const iv = setInterval(() => {
    if (tryInject() || ++attempts > 20) clearInterval(iv);
  }, 500);
}

function openAssignModal(article) {
  // Build a lightweight modal.
  const back = document.createElement('div');
  back.className = 'qa-modal-backdrop';
  back.style.cssText = 'position:fixed;inset:0;background:rgba(4,8,16,.7);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px';
  back.innerHTML =
    '<div style="background:#0d1424;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:26px;max-width:440px;width:100%">' +
    '<h3 style="margin:0 0 6px;color:#e6ecf3">📚 Assign to class</h3>' +
    '<p style="color:#9aa7bd;font-size:13px;margin:0 0 14px">“' + (article.title || '').replace(/</g, '&lt;') + '”</p>' +
    '<label style="display:block;color:#9aa7bd;font-size:12px;margin-bottom:6px">Classroom</label>' +
    '<select id="assign-class" style="width:100%;padding:10px;border-radius:10px;background:#0a0e17;color:#e6ecf3;border:1px solid rgba(255,255,255,.15);margin-bottom:12px"><option>Loading…</option></select>' +
    '<label style="display:block;color:#9aa7bd;font-size:12px;margin-bottom:6px">Due date (optional)</label>' +
    '<input id="assign-due" type="date" style="width:100%;padding:10px;border-radius:10px;background:#0a0e17;color:#e6ecf3;border:1px solid rgba(255,255,255,.15);margin-bottom:12px;box-sizing:border-box"/>' +
    '<label style="display:block;color:#9aa7bd;font-size:12px;margin-bottom:6px">Note for students (optional)</label>' +
    '<input id="assign-note" type="text" maxlength="200" placeholder="e.g. Read before Friday’s discussion" style="width:100%;padding:10px;border-radius:10px;background:#0a0e17;color:#e6ecf3;border:1px solid rgba(255,255,255,.15);margin-bottom:16px;box-sizing:border-box"/>' +
    '<div style="display:flex;gap:10px;justify-content:flex-end">' +
    '<button id="assign-cancel" style="padding:11px 20px;border-radius:999px;border:0;background:rgba(255,255,255,.08);color:#e6ecf3;font-weight:700;cursor:pointer">Cancel</button>' +
    '<button id="assign-go" style="padding:11px 20px;border-radius:999px;border:0;background:linear-gradient(90deg,#00e5ff,#a855f7);color:#0a0e17;font-weight:700;cursor:pointer">Assign</button>' +
    '</div></div>';
  document.body.appendChild(back);
  const close = () => back.remove();
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  back.querySelector('#assign-cancel').addEventListener('click', close);
  const sel = back.querySelector('#assign-class');
  fetch('/api/classrooms', { credentials: 'same-origin' })
    .then(r => r.json())
    .then(d => {
      const cs = d.classrooms || [];
      sel.innerHTML = cs.length
        ? cs.map(c => '<option value="' + c.id + '">' + c.name.replace(/</g, '&lt;') + '</option>').join('')
        : '<option value="">No classrooms yet</option>';
    })
    .catch(() => { sel.innerHTML = '<option value="">Could not load</option>'; });
  back.querySelector('#assign-go').addEventListener('click', async () => {
    const classroomId = Number(sel.value);
    if (!classroomId) { toast('Pick a classroom first.'); return; }
    const btn = back.querySelector('#assign-go');
    btn.disabled = true;
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroom_id: classroomId,
          article_id: article.id,
          article_title: article.title,
          due_at: back.querySelector('#assign-due').value || null,
          note: back.querySelector('#assign-note').value.trim() || null,
        })
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || 'Assign failed.');
      close();
      toast('📚 Assigned! Track reads on the Assignments page.');
    } catch (e) {
      toast(e.message || 'Assign failed.');
      btn.disabled = false;
    }
  });
}

// When a signed-in kid opens an article, mark any matching assignments read.
function trackAssignmentRead(article) {
  if (!window.SkyAuth) return;
  const send = () => {
    const kid = (window.SkyAuth.getActiveKid && window.SkyAuth.getActiveKid()) || null;
    if (!kid || !article || !article.id) return;
    fetch('/api/assignments/track-read', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kid_id: kid.id, article_id: article.id })
    }).catch(() => {});
  };
  if (window.SkyAuth.state && window.SkyAuth.state.user) send();
  else if (window.SkyAuth.subscribe) {
    const unsub = window.SkyAuth.subscribe(() => { send(); });
  }
}


// ---------- Wiring (wraps app.js functions; engage.js loads after app.js) ----------
(function () {
  // Push toggle inside the notifications dropdown.
  if (typeof renderNotificationsList === 'function') {
    const _origNotif = renderNotificationsList;
    renderNotificationsList = function () {
      _origNotif();
      if (typeof SkyPush === 'undefined' || !SkyPush.supported) return;
      const dropdown = document.getElementById('notif-dropdown');
      if (!dropdown || dropdown.querySelector('#btn-push-toggle')) return;
      const on = SkyPush.subscribed;
      const btn = document.createElement('button');
      btn.id = 'btn-push-toggle';
      btn.style.cssText = 'width:100%;display:flex;align-items:center;gap:8px;padding:10px 14px;background:' +
        (on ? 'rgba(0,229,255,.08)' : 'transparent') +
        ';border:0;border-bottom:1px solid var(--border,#222e45);color:var(--text,#e6ecf3);font:600 13px/1.4 Inter,sans-serif;cursor:pointer;text-align:left';
      btn.innerHTML = '<span style="font-size:16px">' + (on ? '🔔' : '🔕') + '</span><span>' +
        (on ? 'Drop alerts on — you\u2019ll be notified of every edition.' : 'Get an alert when each edition drops') + '</span>';
      btn.addEventListener('click', (e) => { e.stopPropagation(); SkyPush.toggle(); });
      dropdown.insertBefore(btn, dropdown.firstChild);
    };
  }

  // Teacher Assignments link in the sidebar "You" section.
  function teacherLink() {
    try {
      const u = window.SkyAuth && window.SkyAuth.state && window.SkyAuth.state.user;
      const isTeacher = u && (u.role === 'teacher' || u.role === 'admin');
      document.querySelectorAll('[data-teacher-link]').forEach(el => el.remove());
      if (!isTeacher) return;
      const base = location.pathname.includes('/pages/') ? '' : 'pages/';
      document.querySelectorAll('.side-section').forEach(sec => {
        const title = sec.querySelector('.side-title');
        if (!title || title.textContent.trim() !== 'You') return;
        const ul = sec.querySelector('.nav-list');
        if (!ul || ul.querySelector('[data-teacher-link]')) return;
        const li = document.createElement('li');
        li.setAttribute('data-teacher-link', '1');
        const here = location.pathname.endsWith('assignments.html') ? ' class="active"' : '';
        li.innerHTML = '<a href="' + base + 'assignments.html"' + here + '><span class="icon">📚</span><span>Assignments</span></a>';
        ul.appendChild(li);
      });
    } catch (e) {}
  }
  if (window.SkyAuth && window.SkyAuth.subscribe) window.SkyAuth.subscribe(teacherLink);
  let _tries = 0;
  const _iv = setInterval(() => { teacherLink(); if (++_tries > 20) clearInterval(_iv); }, 500);
})();
