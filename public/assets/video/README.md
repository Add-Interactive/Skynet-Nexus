# Space video files

This folder holds the videos for the Space Center video panels
(see `public/assets/js/space-video-panels.js`). Videos are large
binary files, so they are NOT pushed through the Muse GitHub
connector — push them from Jeff's local machine with git, as with
other large files in this repo.

## How the panels work (v2: video is the main view)

Selecting an object that has a video — clicking its dot in the 3D
world, clicking its 3D model, or finding it through search — opens
that object's video panel automatically. No extra click on a button
in the side info panel is needed. The panel:

- puts the video at the top, fills the view, animates in, and autoplays;
- shrinks to a small floating player when you tap "—" (minimize) or
  tap outside the panel, so you can see the 3D model and the world
  behind it while the video keeps playing;
- comes back full-size when you tap the floating player (or "⤢");
- closes with "×" for that selection; the side info panel keeps a
  "▶ Replay video" button, and selecting the object again after
  selecting something else reopens it automatically.

If the browser blocks autoplay with sound, a big ▶ overlay appears
on the video — one tap on it plays with sound.

Every future object works the same way: one `VIDEO_PANELS` entry,
one video file, no change to `space-center-main.js`.

## Hubble — first object (already in the panel code)

- File: `public/assets/video/hubble-2min.mp4`
- Source video: the Hubble 2-minute video (2m 32s, 1280x720)
  delivered in chat / on the Skynet Nexus — All Videos dashboard as #43.
- Until this file lands, the Hubble video panel shows a note:
  "Video file not yet uploaded to this site."

Local-git steps (from the repo root, on main, after PR #141 merged):

```bash
git checkout main
git pull
# copy the Hubble video to public/assets/video/hubble-2min.mp4
# (download it from chat or from the All Videos dashboard, #43)
git add public/assets/video/hubble-2min.mp4
git commit -m "Add Hubble 2-minute video for Space Center video panel"
git push origin main
```

Then redeploy as usual. The panel will play the video once the
file is on the deployed site.

## Adding the next object

1. Make its 2-minute video.
2. Add one entry to `VIDEO_PANELS` in
   `public/assets/js/space-video-panels.js` (key = text that appears
   in the info panel title, e.g. `iss`, `jwst`).
3. Push that video file the same way, to
   `public/assets/video/<key>-2min.mp4`, and point the entry at it.
4. No change to `space-center-main.js` is needed — the panel
   opens automatically when that object is selected, by dot, model,
   or search.
