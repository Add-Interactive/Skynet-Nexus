# Space video files

This folder holds the videos for the Space Center video panels
(see `public/assets/js/space-video-panels.js`). Videos are large
binary files, so they are NOT pushed through the Muse GitHub
connector — push them from Jeff's local machine with git, as with
other large files in this repo.

## Hubble — first object (already in the panel code)

- File: `public/assets/video/hubble-2min.mp4`
- Source video: the Hubble 2-minute video (2m 32s, 1280x720, 44 MB)
  delivered in chat / on the Skynet Nexus — All Videos dashboard as #43.
- Until this file lands, the Hubble video panel shows a note:
  "Video file not yet uploaded to this site."

Local-git steps (from the repo root, on the PR branch):

```bash
git checkout gizmo/space-center-video-panels-hubble
# copy the Hubble video to public/assets/video/hubble-2min.mp4
# (download it from chat or from the All Videos dashboard, #43)
git add public/assets/video/hubble-2min.mp4
git commit -m "Add Hubble 2-minute video for Space Center video panel"
git push origin gizmo/space-center-video-panels-hubble
```

Then merge the PR and redeploy as usual. The panel will play
the video once the file is on the deployed site.

## Adding the next object

1. Make its 2-minute video.
2. Add one entry to `VIDEO_PANELS` in
   `public/assets/js/space-video-panels.js` (key = text that appears
   in the info panel title, e.g. `iss`, `jwst`).
3. Push that video file the same way, to
   `public/assets/video/<key>-2min.mp4`, and point the entry at it.
4. No change to `space-center-main.js` is needed — the panel
   appears automatically when that object's info panel is shown.
