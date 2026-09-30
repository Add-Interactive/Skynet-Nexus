# Skynet Nexus Newsroom — Director's Runbook

How the daily editions get made. The pipeline is operated by Gizmo (Add Interactive Studio);
the News Director (Jeff) reviews in the Review Console. No OpenClaw, no Antigravity.

## The daily cadence (America/New_York)

| Time | Event |
|------|-------|
| T-60 min | Correspondent subagents spawn — one per channel (13). Each reads its brief in `newsroom/prompts/<channel>.md`, researches 1–2 fresh stories (Brave Search, primary sources only), and returns article JSON in the house schema. |
| T-45 min | Gizmo validates every draft (schema + kid-safe guardrails — the same rules as `newsroom/publish.js`) and files it to the review queue: `POST /api/newsroom/drafts` with `x-newsroom-key` (server env `NEWSROOM_API_KEY`). Each draft is stamped for its drop (`publish_at`, `edition`). |
| T-60 → T-0 | Director review window in the Review Console (`newsroom/dashboard.html`): approve, spike (reject), publish-now, or leave notes on any draft. Notes are applied on the final pass. |
| T-15 min | Final pass: director notes applied, drafts revised, queue updated. |
| Drop (10:15 AM / 2:15 PM / 6:15 PM ET) | `server/scheduler.js` releases scheduled stories, then **auto-publishes any draft stamped for that drop which is still unreviewed**. The director's review is a courtesy, never a blocker. Rejected stories never auto-publish. A failed publish clears the drop stamp and parks the story as a draft with a note. |

## Filing a draft (pipeline)

```
POST /api/newsroom/drafts
x-newsroom-key: <NEWSROOM_API_KEY>
{
  "staffSlug": "agent-ai",
  "channel": "ai",
  "payload": { ...article JSON... },
  "dropAt": "2026-10-01T14:15:00.000Z",
  "edition": "morning"
}
```

The server stamps `author`/`authorRole` from the staff roster, validates the payload
with `newsroom/agent-orchestrator.js` `validateDraft()`, and inserts a `draft` row
in `queued_stories`. Validation failures return 422 with details — the story is
never queued half-baked.

## Review actions (Review Console → admin API)

- `GET /api/admin/stories/queue?status=draft` — list drafts
- `PATCH /api/admin/stories/queue/:id` — `{ status: approved|rejected, editorNotes, payload }`
- `POST /api/admin/stories/queue/:id/schedule` — pin to a drop (default: next eligible)
- `POST /api/admin/stories/queue/:id/publish` — publish immediately
- `GET /api/admin/stories/scheduled` — what's queued for upcoming drops

## Publish path

`newsroom/publish.js --file article.json` validates, writes
`data/articles/<date>/<slug>.json`, and updates `data/manifest.json`
(newest-first). The server publishes through the same code via
`server/publisher.js`. Push to `main` → Railway redeploys → the edition is live.

## Correspondents

The 13 correspondents are defined in `newsroom/agents-config.js` (original
characters created for this network). `server/seed-agents.js` syncs them into
the `staff` table on every boot — renames propagate automatically.

## Logging the day

Append one line per day to `newsroom/log.md`:

```
- **2026-10-01** · 13/13 filed · morning ✓ · midday ✓ · evening ✓
```
