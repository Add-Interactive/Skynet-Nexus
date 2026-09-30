# Skynet Nexus Artwork Style Guide — "Nexus Glow"

Every article image on Skynet Nexus must be instantly recognizable in a crowded
feed. No stock photos. No photorealistic AI sameness. One look, every story.

## The look

**Flat vector editorial illustration** — bold geometric shapes, subtle paper
grain, warm and optimistic. Think high-end children's book meets sci-fi poster.

- **Background:** deep space-navy `#0B1026`, always.
- **The Glow:** a soft radial glow in the channel accent color blooms behind the
  subject — this is the signature. A reader scrolling a feed should spot a
  Skynet Nexus story by the glow alone.
- **Subject:** ONE clear, friendly, kid-safe central subject drawn from the
  story topic. Simple shapes, generous negative space, slightly off-center.
- **Mood:** curious, hopeful, playful. The future feels friendly here.
- **Composition:** 16:9 landscape.

## Hard rules

- NEVER photorealistic.
- NEVER any text, words, letters, numbers, or logos in the image.
- NEVER dark, scary, or violent imagery. Nothing that would unsettle a 5-year-old.
- NEVER the generic "corporate stock photo" look.
- The channel accent color must appear prominently (glow + at least one subject element).

## The watermark

Every article image carries the Skynet Nexus brand bug — bottom-right corner,
280x60px, 24px margins. It is overlaid by the pipeline AFTER generation, so it
is identical on every image and survives any drift in the art itself.

- Asset: `newsroom/artwork/watermark.png` (560x120 master, scaled to 280x60 on overlay)
- Dark navy pill `#080C20` at ~85% opacity, cyan signal arcs, white "SKYNET NEXUS" wordmark
- Overlay: `ffmpeg -i hero.jpg -i watermark.png -filter_complex "[1:v]scale=280:60[wm];[0:v][wm]overlay=W-w-24:H-h-24" hero-wm.jpg`
- The house style makes our images beautiful; the watermark makes them ours.

## Channel accent colors

| Channel     | Color   | Hex       |
|-------------|---------|-----------|
| ai          | purple  | `#a855f7` |
| space       | blue    | `#3b82f6` |
| robotics    | gold    | `#eab308` |
| biotech     | teal    | `#10b981` |
| quantum     | cyan    | `#06b6d4` |
| climate     | green   | `#22c55e` |
| engineering | orange  | `#f97316` |
| math        | red     | `#ef4444` |
| cyber       | indigo  | `#6366f1` |
| gaming      | lime    | `#84cc16` |
| music       | pink    | `#ec4899` |
| stem        | sky     | `#00e5ff` |
| play        | neon    | `#39ff14` |

## Prompt template (for correspondents)

Build the image prompt from the STORY TITLE — the image must illustrate the
actual topic, not a generic channel scene:

```
Flat vector editorial illustration, Skynet Nexus house style ("Nexus Glow"):
deep space-navy #0B1026 background with a soft radial {COLOR NAME} ({HEX}) glow
behind the subject. Subject: {ONE vivid sentence describing the story's topic
as a visual scene, derived from the headline}. Bold geometric shapes, subtle
paper grain, warm optimistic kid-friendly mood, generous negative space, 16:9
composition. Absolutely no text, words, letters, or numbers in the image.
Not photorealistic.
```

Example — headline "Teen Builds Robot That Sorts Recycling":
"...soft radial gold (#eab308) glow behind the subject. Subject: a cheerful
small robot with big friendly eyes sorting colorful bottles and cans into
glowing bins..."

## Pipeline

1. Correspondent drafts the story (title first).
2. Correspondent generates the hero image with the prompt above (title → visual).
3. Image is cover-cropped to 1280x720 JPEG, watermark overlaid bottom-right, then uploaded to the channel's pool via
   `POST /api/newsroom/images`.
4. The returned path becomes the draft's `heroImage` — topic-matched, on-brand.
