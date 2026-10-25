// Space video panels — Skynet Nexus Space Center (v2: video is the main view)
// The video IS part of the tour. Selecting an object that has a video —
// clicking its dot in the 3D world, clicking its 3D model, or finding it
// through search — opens that object's video panel automatically, with the
// video at the top, filling the view, and autoplaying. No extra click on a
// button in the side info panel is needed.
//   Full view  -> tap "—" (minimize) or tap outside the panel, and the
//                 video shrinks to a small floating player so the 3D model
//                 and the world behind it are visible. It keeps playing.
//   Minimized  -> tap the floating player (or "⤢") to bring it back full.
//                 Tap "×" to close it for this selection.
//   Closed     -> the "▶ Replay video" button left in the side info panel
//                 reopens it, and selecting the object again after selecting
//                 something else reopens it automatically.
// To add the next object, add one entry to VIDEO_PANELS below (key = match
// text in the info-panel title, video = file under public/assets/video/)
// and upload that video file via local git. The same auto-open / autoplay /
// minimize behaviour then applies to that object automatically. No change
// to space-center-main.js is needed: every selection route in the site
// funnels through the info panel title (#infot), which this module watches.
const VIDEO_PANELS = {
  hubble: {
    title: 'Hubble — 2-Minute Video',
    duration: '2m 32s',
    video: '../assets/video/hubble-2min.mp4',
    description:
      "Hubble's 1990 launch, five servicing missions, how its 2.4-metre mirror sees, the deep field, and tracking Hubble live in Space Center. One clear voiceover, matched to the video.",
  },
};

let currentKey = null; // object whose panel is open (full or minimized)
let dismissedKey = null; // object the user closed, for this selection only
let lastSeenKey = null; // last key the info title matched, to spot a change

function matchKey() {
  const titleEl = document.getElementById('infot');
  const title = titleEl ? titleEl.textContent.toLowerCase() : '';
  if (!title) return null;
  for (const key of Object.keys(VIDEO_PANELS)) {
    if (title.includes(key)) return key;
  }
  return null;
}

function showPlayOverlay(show) {
  const overlay = document.getElementById('vp-play');
  if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

function openPanel(key, { autoplay = true } = {}) {
  const panel = VIDEO_PANELS[key];
  if (!panel) return;
  const modal = document.getElementById('videopanel');
  const video = document.getElementById('vp-video');
  const note = document.getElementById('vp-note');
  if (!modal || !video) return;
  currentKey = key;
  dismissedKey = null;
  document.getElementById('vp-title').textContent = panel.title;
  document.getElementById('vp-desc').textContent = panel.description;
  document.getElementById('vp-mini-title').textContent = panel.title;
  if (video.getAttribute('src') !== panel.video) {
    video.src = panel.video;
    video.load();
  }
  if (note) note.style.display = 'none';
  video.onerror = () => {
    if (note) note.style.display = 'block';
    showPlayOverlay(false);
  };
  modal.classList.add('open');
  modal.classList.remove('minimized');
  showPlayOverlay(false);
  if (autoplay) {
    // The click on the dot / model / search result is the user's gesture,
    // so autoplay with sound is allowed on most browsers. If the browser
    // still blocks it (the watcher runs async, after the gesture), the big
    // ▶ overlay appears instead — one tap on it plays with sound.
    const attempt = video.play();
    if (attempt && attempt.catch) {
      attempt.catch(() => showPlayOverlay(true));
    }
  }
}

function minimizePanel() {
  const modal = document.getElementById('videopanel');
  if (!modal || !modal.classList.contains('open')) return;
  modal.classList.add('minimized');
  showPlayOverlay(false);
}

function expandPanel() {
  const modal = document.getElementById('videopanel');
  if (!modal || !modal.classList.contains('open')) return;
  modal.classList.remove('minimized');
}

function closePanel({ markDismissed = true } = {}) {
  const modal = document.getElementById('videopanel');
  const video = document.getElementById('vp-video');
  if (markDismissed && currentKey) dismissedKey = currentKey;
  currentKey = null;
  if (!modal) return;
  modal.classList.remove('open', 'minimized');
  showPlayOverlay(false);
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}

// Called whenever the info panel title may have changed. This is the one
// gate for every selection route: dot, model, and search all set #infot.
function maybeAutoOpen() {
  const key = matchKey();
  if (key !== lastSeenKey) {
    // A new selection: a previous close no longer counts as "dismissed".
    dismissedKey = null;
    lastSeenKey = key;
  }
  if (!key) {
    // Moved on to an object with no video: park the video panel so the
    // 3D tour is unobstructed, without marking it dismissed.
    if (currentKey) closePanel({ markDismissed: false });
    return;
  }
  if (key === dismissedKey) return; // user closed it for this selection
  if (key === currentKey) return; // already open (full or minimized)
  openPanel(key);
}

function renderButton() {
  // Fallback / replay only. The main path is automatic now, but after the
  // user closes the video, this button in the side info panel reopens it
  // without having to re-select the object.
  const slot = document.getElementById('videopanel-slot');
  if (!slot) return;
  const key = matchKey();
  if (!key || key === currentKey) {
    slot.innerHTML = '';
    if (key) slot.dataset.key = key;
    return;
  }
  if (slot.dataset.key === key && slot.querySelector('button')) return;
  slot.dataset.key = key;
  slot.innerHTML = '';
  const btn = document.createElement('button');
  btn.className = 'vbtn';
  btn.textContent = '▶ Replay video: ' + VIDEO_PANELS[key].title + ' (' + VIDEO_PANELS[key].duration + ')';
  btn.addEventListener('click', () => openPanel(key));
  slot.appendChild(btn);
}

function onSelectionChange() {
  maybeAutoOpen();
  renderButton();
}

document.addEventListener('DOMContentLoaded', () => {
  const titleEl = document.getElementById('infot');
  if (titleEl) {
    new MutationObserver(onSelectionChange).observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
  const panelEl = document.getElementById('infopanel');
  if (panelEl) {
    // showInfo toggles .show on the panel as well as setting the title;
    // watching both covers selection routes that only flip visibility.
    new MutationObserver(onSelectionChange).observe(panelEl, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }
  const closeBtn = document.getElementById('vp-close');
  if (closeBtn) closeBtn.addEventListener('click', () => closePanel());
  const minBtn = document.getElementById('vp-min');
  if (minBtn) minBtn.addEventListener('click', minimizePanel);
  const expandBtn = document.getElementById('vp-expand');
  if (expandBtn) expandBtn.addEventListener('click', expandPanel);
  const modal = document.getElementById('videopanel');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) minimizePanel(); // backdrop tap: shrink, don't kill it
      if (e.target && e.target.closest && e.target.closest('.vp-box.minimized-hit')) expandPanel();
    });
    const box = modal.querySelector('.vp-box');
    if (box) {
      box.addEventListener('click', (e) => {
        // Tapping the floating minimized player restores it full-size.
        if (modal.classList.contains('minimized') && !e.target.closest('button')) expandPanel();
      });
    }
  }
  const playBtn = document.getElementById('vp-play');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      const video = document.getElementById('vp-video');
      if (!video) return;
      video.play().then(() => showPlayOverlay(false)).catch(() => {});
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!modal || !modal.classList.contains('open')) return;
    // First Escape shrinks to the 3D view; second Escape closes it.
    if (modal.classList.contains('minimized')) closePanel();
    else minimizePanel();
  });
  onSelectionChange();
});

// Exposed for future objects and for manual testing in the console.
window.SpaceVideoPanels = { VIDEO_PANELS, openPanel, closePanel, minimizePanel, expandPanel, renderButton, maybeAutoOpen };
