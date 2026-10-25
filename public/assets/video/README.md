# Space video files

This folder holds the videos for the Space Center video panels
(see `public/assets/js/space-video-panels.js`). Videos are large
binary files, so they are NOT pushed through the Muse GitHub
connector — push them from Jeff's local machine with git, as with
other large files in this repo.

## How the panels work (v4: full-space grid side panel)

Selecting an object that has a video — clicking its dot in the 3D
world, clicking its 3D model, or finding it through search — shows
that object's video in a FULL-SPACE GRID panel, autoplaying. It is
not a narrow one-column panel: it uses the full space available.

Grid layout (desktop):
- Video, large, on the left (spanning the profile + telemetry rows)
- Photo profile and telemetry data grid on the right
- Description and compare zone across the bottom
- Title across the top

The model and Earth behind the panel are covered while the grid is
open — that is by design. To see them, minimize the panel (its own
"—" button): it shrinks to a small floating bar with just the title
and the video still playing. Tapping that bar restores the grid.
Other satellites, with no video, keep the original narrow panel.

- Tap "⤢" on the video card for full screen. It picks up where the
  grid video left off; closing it hands playback back to the grid
  panel at the same spot.
- Tap "×" on the video card to hide the video for that selection;
  a small "▶ Show video" button takes its place, and selecting the
  object again after selecting something else restores it.
- If the browser blocks autoplay with sound, a big ▶ overlay appears
  on the video — one tap on it plays with sound.
- On phones the grid stacks its tiles (video, profile, telemetry,
  description, compare) in that order, still using the full space.

Every future object works the same way: one `VIDEO_PANELS` entry,
one video file, no change to `space-center-main.js`.

## Hubble — first object (live)

- File: `public/assets/video/hubble-2min.mp4` — live on main since
  PR #143 (67,806,919 bytes, h264 1280x720, 2m 32s, clips-only cut).
- Source video: the Hubble 2-minute video delivered in chat / on the
  Skynet Nexus — All Videos dashboard.

## Adding the next object

1. Make its 2-minute video.
2. Add one entry to `VIDEO_PANELS` in
   `public/assets/js/space-video-panels.js` (key = text that appears
   in the info panel title, e.g. `iss`, `jwst`).
3. Push that video file the same way, to
   `public/assets/video/<key>-2min.mp4`, and point the entry at it.
4. No change to `space-center-main.js` is needed — the video appears
   in that object's grid panel automatically, by dot, model, or search.
