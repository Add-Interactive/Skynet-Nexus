// Space video panels — Skynet Nexus Space Center (v3: the video IS the side panel)
// Selecting an object that has a video — clicking its dot in the 3D world,
// clicking its 3D model, or finding it through search — shows that object's
// video at the TOP of its side info panel (#infopanel), autoplaying, with
// all the panel's other windows around it: the photo profile, the telemetry
// data grid, the description, and the compare zone, in that order below the
// video. No separate click is needed, and no full-screen modal opens on its
// own. The side panel leaves the 3D world visible beside it, and minimizing
// the side panel (its own "—" button) hides the other windows but keeps the
// video playing at the top, so the 3D model stays in view.
//   Full screen -> tap "⤢" on the video card. The full-screen panel opens
//                  with the same video, picking up where the side video
//                  left off. Closing it ("×", or Escape twice) returns
//                  playback to the side panel at the same spot.
//   Dismiss    -> tap "×" on the video card to hide the video for this
//                  selection; a small "▶ Show video" button takes its place.
//                  Selecting another object, then this one again, restores it.
// To add the next object, add one entry to VIDEO_PANELS below (key = match
// text in the info-panel title, video = file under public/assets/video/).
// The same side-panel behaviour then applies automatically. No change to
// space-center-main.js is needed: every selection route in the site funnels
// through the info panel title (#infot), which this module watches.
const VIDEO_PANELS = {
  hubble: {
    title: 'Hubble — 2-Minute Video',
    duration: '2m 32s',
    video: '../assets/video/hubble-2min.mp4',
    description:
      "Hubble's 1990 launch, five servicing missions, how its 2.4-metre mirror sees, the deep field, and tracking Hubble live in Space Center. One clear voiceover, matched to the video.",
  },
};

let sideKey = null; // object whose video is currently in the side panel
let dismissedKey = null; // object the user hid the video for, this selection only
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

function panelVisible() {
  const panelEl = document.getElementById('infopanel');
  return !!(panelEl && panelEl.classList.contains('show'));
}

function sideVideo() {
  return document.getElementById('vp-side-video');
}

function pauseSide() {
  const video = sideVideo();
  if (video) video.pause();
}

function showSidePlayOverlay(show) {
  const overlay = document.getElementById('vp-side-play');
  if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

// Build (or rebuild) the animated video card at the top of the side panel.
function renderSide(key) {
  const slot = document.getElementById('videopanel-slot');
  if (!slot) return;
  if (!key || key === dismissedKey) {
    if (key && key === dismissedKey) {
      // Hidden for this selection: leave a small way back in.
      if (slot.dataset.mode !== 'replay-' + key) {
        slot.dataset.mode = 'replay-' + key;
        slot.innerHTML = '';
        const btn = document.createElement('button');
        btn.className = 'vbtn';
        btn.textContent = '▶ Show video: ' + VIDEO_PANELS[key].title;
        btn.addEventListener('click', () => {
          dismissedKey = null;
          renderSide(key);
        });
        slot.appendChild(btn);
      }
      return;
    }
    slot.innerHTML = '';
    slot.dataset.mode = '';
    slot.dataset.key = '';
    sideKey = null;
    return;
  }
  // Already showing this object's video: keep playing, don't rebuild.
  if (slot.dataset.key === key && slot.dataset.mode === 'video' && sideVideo()) return;
  const panel = VIDEO_PANELS[key];
  sideKey = key;
  slot.dataset.key = key;
  slot.dataset.mode = 'video';
  slot.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'vp-side';
  card.innerHTML =
    '<div class="vp-side-head">' +
    '<span class="vp-side-badge">▶ VIDEO</span>' +
    '<span class="vp-side-title"></span>' +
    '<button class="vp-side-btn" type="button" title="Full screen">⤢</button>' +
    '<button class="vp-side-btn" type="button" title="Hide video">×</button>' +
    '</div>' +
    '<div class="vp-side-wrap">' +
    '<video controls playsinline preload="auto"></video>' +
    '<button class="vp-side-play" type="button" aria-label="Play video">▶</button>' +
    '</div>' +
    '<p class="vp-side-note">Video file not yet uploaded to this site. See public/assets/video/README.md for the local-git step to add it.</p>' +
    '<p class="vp-side-hint"></p>';
  card.querySelector('.vp-side-title').textContent = panel.title;
  card.querySelector('.vp-side-hint').textContent =
    panel.duration + ' · Tap ⤢ for full screen, or — on the side panel to keep watching over the 3D model.';
  const video = card.querySelector('video');
  video.id = 'vp-side-video';
  video.src = panel.video;
  const note = card.querySelector('.vp-side-note');
  video.onerror = () => {
    note.style.display = 'block';
    showSidePlayOverlay(false);
  };
  const playBtn = card.querySelector('.vp-side-play');
  playBtn.id = 'vp-side-play';
  playBtn.addEventListener('click', () => {
    video.play().then(() => showSidePlayOverlay(false)).catch(() => {});
  });
  const [expandBtn, closeBtn] = card.querySelectorAll('.vp-side-btn');
  expandBtn.addEventListener('click', () => openPanel(key));
  closeBtn.addEventListener('click', () => {
    pauseSide();
    dismissedKey = key;
    renderSide(key);
  });
  slot.appendChild(card);
  // The click on the dot / model / search result is the user's gesture,
  // so autoplay with sound is allowed on most browsers. If the browser
  // still blocks it (the watcher runs async, after the gesture), the big
  // ▶ overlay on the video appears instead — one tap plays with sound.
  showSidePlayOverlay(false);
  const attempt = video.play();
  if (attempt && attempt.catch) {
    attempt.catch(() => showSidePlayOverlay(true));
  }
}

// Full-screen panel (opened only from the side card's ⤢ button). It picks
// up the side video's position and hands it back on close.
function openPanel(key) {
  const panel = VIDEO_PANELS[key];
  if (!panel) return;
  const modal = document.getElementById('videopanel');
  const video = document.getElementById('vp-video');
  const note = document.getElementById('vp-note');
  if (!modal || !video) return;
  const side = sideVideo();
  const resumeAt = side ? side.currentTime : 0;
  if (side) side.pause();
  document.getElementById('vp-title').textContent = panel.title;
  document.getElementById('vp-desc').textContent = panel.description;
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
  video.currentTime = resumeAt || 0;
  const attempt = video.play();
  if (attempt && attempt.catch) {
    attempt.catch(() => showPlayOverlay(true));
  }
}

function showPlayOverlay(show) {
  const overlay = document.getElementById('vp-play');
  if (overlay) overlay.style.display = show ? 'flex' : 'none';
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

function closePanel() {
  const modal = document.getElementById('videopanel');
  const video = document.getElementById('vp-video');
  if (!modal) return;
  const resumeAt = video ? video.currentTime : 0;
  modal.classList.remove('open', 'minimized');
  showPlayOverlay(false);
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  // Hand playback back to the side panel, at the same spot.
  const side = sideVideo();
  if (side && sideKey) {
    side.currentTime = resumeAt || 0;
    side.play().catch(() => showSidePlayOverlay(true));
  }
}

// Called whenever the info panel title or visibility may have changed.
// This is the one gate for every selection route: dot, model, and search
// all set #infot and show #infopanel.
function onSelectionChange() {
  const key = matchKey();
  if (key !== lastSeenKey) {
    // A new selection: a previous hide no longer counts as "dismissed".
    dismissedKey = null;
    lastSeenKey = key;
  }
  if (!key || !panelVisible()) {
    if (!panelVisible()) pauseSide();
    if (!key) renderSide(null);
    return;
  }
  renderSide(key);
}

// Backwards-compatible name: v2 auto-opened the modal; v3 auto-shows the
// side-panel video instead. The modal is now expand-only.
function maybeAutoOpen() {
  onSelectionChange();
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
    new MutationObserver(onSelectionChange).observe(panelEl, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }
  const closeBtn = document.getElementById('vp-close');
  if (closeBtn) closeBtn.addEventListener('click', closePanel);
  const minBtn = document.getElementById('vp-min');
  if (minBtn) minBtn.addEventListener('click', minimizePanel);
  const expandBtn = document.getElementById('vp-expand');
  if (expandBtn) expandBtn.addEventListener('click', expandPanel);
  const modal = document.getElementById('videopanel');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) minimizePanel(); // backdrop tap: shrink, don't kill it
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
    // First Escape shrinks to the 3D view; second Escape closes it
    // (and hands playback back to the side panel).
    if (modal.classList.contains('minimized')) closePanel();
    else minimizePanel();
  });
  onSelectionChange();
});

// Exposed for future objects and for manual testing in the console.
window.SpaceVideoPanels = { VIDEO_PANELS, openPanel, closePanel, minimizePanel, expandPanel, renderSide, maybeAutoOpen, onSelectionChange };
