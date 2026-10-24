// Space video panels — Skynet Nexus Space Center
// A video panel opens in the 3D world for an object that has a video.
// First object: Hubble. To add the next object, add one entry to VIDEO_PANELS
// below (key = match text, video = file under public/assets/video/),
// upload that video file via local git, and the panel appears automatically
// when that object's info panel is shown. No change to space-center-main.js
// is needed: this module watches the info panel title for a match.
const VIDEO_PANELS = {
  hubble: {
    title: 'Hubble — 2-Minute Video',
    duration: '2m 32s',
    video: '../assets/video/hubble-2min.mp4',
    description:
      'The first per-object video for the Space Center video panels: Hubble\'s 1990 launch, five servicing missions, how its 2.4-metre mirror sees, the deep field, and tracking Hubble live in Space Center. One clear voiceover, matched to the video.',
  },
};

function matchKey() {
  const titleEl = document.getElementById('infot');
  const title = titleEl ? titleEl.textContent.toLowerCase() : '';
  if (!title) return null;
  for (const key of Object.keys(VIDEO_PANELS)) {
    if (title.includes(key)) return key;
  }
  return null;
}

function renderButton() {
  const slot = document.getElementById('videopanel-slot');
  if (!slot) return;
  const key = matchKey();
  if (!key) {
    slot.innerHTML = '';
    return;
  }
  const panel = VIDEO_PANELS[key];
  if (slot.dataset.key === key) return;
  slot.dataset.key = key;
  slot.innerHTML = '';
  const btn = document.createElement('button');
  btn.className = 'vbtn';
  btn.textContent = '▶ Watch video: ' + panel.title + ' (' + panel.duration + ')';
  btn.addEventListener('click', () => openPanel(key));
  slot.appendChild(btn);
}

function openPanel(key) {
  const panel = VIDEO_PANELS[key];
  if (!panel) return;
  const modal = document.getElementById('videopanel');
  const video = document.getElementById('vp-video');
  const note = document.getElementById('vp-note');
  if (!modal || !video) return;
  document.getElementById('vp-title').textContent = panel.title;
  document.getElementById('vp-desc').textContent = panel.description;
  video.src = panel.video;
  video.load();
  note.style.display = 'none';
  video.onerror = () => {
    note.style.display = 'block';
  };
  modal.classList.add('open');
}

function closePanel() {
  const modal = document.getElementById('videopanel');
  const video = document.getElementById('vp-video');
  if (!modal) return;
  modal.classList.remove('open');
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const titleEl = document.getElementById('infot');
  if (titleEl) {
    new MutationObserver(renderButton).observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
  const closeBtn = document.getElementById('vp-close');
  if (closeBtn) closeBtn.addEventListener('click', closePanel);
  const modal = document.getElementById('videopanel');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closePanel();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });
  renderButton();
});

// Exposed for future objects and for manual testing in the console.
window.SpaceVideoPanels = { VIDEO_PANELS, openPanel, closePanel, renderButton };
