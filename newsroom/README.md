# 🛰️ Newsroom Infrastructure — Skynet Nexus

This directory contains all editorial systems for automated daily news production.

## Structure

```
newsroom/
  ├── director.md                    — Editorial playbook (how the workflow runs)
  ├── log.md                         — Daily editorial ledger
  ├── publish.js                     — Core publish pipeline (validate → guardrail → publish)
  ├── sync.js                        — Git sync (commit → push → Railway redeploy)
  ├── brave.js                       — Brave Search API wrapper (keyword research)
  ├── dashboard.html                 — Standalone newsroom UI (open in browser, no backend needed)
  ├── agents-config.js               — 12 correspondent agent definitions
  ├── agent-orchestrator.js          — Spawn agents, schedule story filing
  ├── image-scraper.js               — Extract images from source URLs
  ├── CHANNEL_BRIEFS.md              — Editorial guidelines for all 12 channels
  └── prompts/
      ├── ai.md                      — AI & Machine Learning correspondent
      ├── space.md                   — Space & Aerospace correspondent
      ├── robotics.md                — Robotics & Automation correspondent
      ├── biotech.md                 — Biotech & Health correspondent
      ├── quantum.md                 — Quantum & Computing correspondent
      ├── climate.md                 — Climate & Energy correspondent
      ├── engineering.md             — Engineering & Making correspondent
      ├── math.md                    — Math & Data Science correspondent
      ├── cyber.md                   — Cybersecurity & Code correspondent
      ├── gaming.md                  — Gaming & Esports correspondent
      ├── music.md                   — Music & Festivals correspondent
      └── [note: 4 existing prompts from Phase 1: stem.md, robotics.md, play.md, music.md]
```

## How It Works

### Daily Editorial Cycle (3 drops per day)

```
9:00 AM ET (1h before drop)
  ↓
agents-config.js + agent-orchestrator.js
  ↓
Spawn 12 correspondent sub-agents (in parallel)
  ├─ Dr. Aisha Khan (AI)
  ├─ Marcus Webb (Space)
  ├─ Maya Ortiz (Robotics)
  ├─ Priya Ramanathan (Biotech)
  ├─ Pavel Novikov (Quantum)
  ├─ Zara Green (Climate)
  ├─ James Chen (Engineering)
  ├─ Sophie Müller (Math)
  ├─ Alex Rivera (Cybersecurity)
  ├─ Jordan Lee (Gaming)
  ├─ Riley Chen (Music)
  └─ [+ one more for balanced load]
  ↓
Each agent reads channel brief (prompts/*.md)
  ↓
Each agent researches (Brave Search)
  ↓
Each agent files 5 story ideas as JSON (JSONL)
  ↓
admin-orchestrator collects + validates (kid-safe guardrail)
  ↓
Stories land in db.queued_stories (status='draft')
  ↓
10:00 AM ET (drop time)
  ↓
scheduler.releaseDue() checks for approved stories
  ├─ If human approved: publish immediately
  └─ If no review: auto-publish AI draft (fallback)
  ↓
publish.js runs (validate → guardrail → update manifest)
  ↓
sync.js commits + pushes to GitHub
  ↓
Railway auto-redeploys
  ↓
Live site updated: https://skynet-nexus-production.up.railway.app/
  ↓
Repeat at 2:00 PM ET and 6:00 PM ET
```

## Files in Detail

### agents-config.js

Defines all 12 correspondent agents with metadata:
```javascript
{
  slug: 'agent-ai',           // unique id
  channel: 'ai',              // maps to channel.id
  displayName: 'Dr. Aisha Khan',
  role: 'Correspondent - AI & Machine Learning',
  bio: '...',
  avatarEmoji: '🧠',
  accentColor: '#00e5ff',
  promptPath: 'newsroom/prompts/ai.md'
}
```

Each agent is wired to one channel. The 12 agents cover:
- 🧠 AI & Machine Learning (Dr. Aisha Khan)
- 🚀 Space & Aerospace (Marcus Webb)
- 🤖 Robotics & Automation (Maya Ortiz)
- 🧬 Biotech & Health (Dr. Priya Ramanathan)
- ⚛️ Quantum & Computing (Dr. Pavel Novikov)
- 🌍 Climate & Energy (Zara Green)
- 🔧 Engineering & Making (James Chen)
- 📐 Math & Data Science (Dr. Sophie Müller)
- 🔐 Cybersecurity & Code (Alex Rivera)
- 🎮 Gaming & Esports (Jordan Lee)
- 🎧 Music & Festivals (Riley Chen)

### prompts/*.md

**Editorial guidelines for each channel.** Each prompt includes:
- **Your Beat** — story angle examples
- **Family-First Lens** — kidTake template, discussion questions, ageBand
- **Research Method** — Brave Search query, verification sources
- **Article Format** — JSON schema with all required fields
- **Standards** — DO's and DON'Ts

Agents read their brief before generating stories.

### agent-orchestrator.js

Orchestrates story filing:
- `spawnCorrespondent(agent, drops)` — generate prompt for one agent
- `spawnAllCorrespondents(drops)` — batch-spawn all 12 agents
- `nextDrop()` — calculate next drop time (ET)
- `agentSpawnTime()` — when to spawn agents (1h before drop)

**Usage (in a cron job or scheduler):**
```javascript
const orch = require('./newsroom/agent-orchestrator');
const drops = ['10:00 AM ET', '2:00 PM ET', '6:00 PM ET'];
const results = await orch.spawnAllCorrespondents(drops);
// results = { timestamp, spawned: 12, agents: [...] }
```

### image-scraper.js

Extracts images from article source URLs:
- `fetchUrl(urlStr)` — fetch page HTML (with redirects, timeout)
- `extractImages(html, baseUrl)` — parse og:image, twitter:image, img tags
- `scrapeSourceImages(sourceUrl)` — get 3 best images from one URL
- `scrapeArticleImages(article)` — scrape all sources in an article

**Usage:**
```javascript
const scraper = require('./newsroom/image-scraper');
const sourceImages = await scraper.scrapeArticleImages(article);
// sourceImages = { [url]: [{ src, alt, credit }, ...] }
```

After scraping, images are embedded in article.images for display.

### dashboard.html

**Standalone newsroom floor UI** — open directly in browser:
1. Save this file locally or keep in `newsroom/dashboard.html`
2. Open in browser: `file:///C:/Users/bekin/OneDrive/Desktop/Skynet/newsroom/dashboard.html`\n3. Connect to live admin API at `https://skynet-nexus-production.up.railway.app/api/admin`

**Sections:**
- 📊 **Dashboard** — today's metrics, recent queue, next drop
- 📥 **Queue** — all queued stories (draft/approved/published), edit/publish buttons
- 📸 **Image Editor** — upload/replace/crop article images, scrape from sources
- 🛰️ **Agents** — status of all 12 correspondents (when integrated)
- ⏰ **Schedule** — publication calendar, scheduled stories

## Integration Checklist

- [ ] **Agent spawning** — wire OpenClaw sessions_spawn to call `agent-orchestrator.spawnAllCorrespondents()`
- [ ] **Story filing** — agents output JSONL → parsed + validated → `db.createQueuedStory()`
- [ ] **Image scraping** — run `image-scraper.scrapeArticleImages()` after story creation
- [ ] **Admin API routes** — expose `/api/admin/queue`, `/api/admin/submissions`, etc. (already done ✅)
- [ ] **Scheduler** — releaseDue() every 60s (already done ✅)
- [ ] **Dashboard UI** — serve dashboard.html locally or via newsroom-server
- [ ] **First cron job** — set up cron to spawn agents at agentSpawnTime() for first drop

## Next Steps for You

1. **Integrate with OpenClaw:**
   - Create cron jobs for each drop (10 AM / 2 PM / 6 PM ET)
   - Each cron spawns `agent-orchestrator.spawnAllCorrespondents()`
   - Agents generate stories → file to queue

2. **Test workflow:**
   - Manually trigger one agent via `sessions_spawn`
   - Verify story lands in db.queued_stories
   - Approve in admin → auto-publish → check manifest

3. **Polish dashboard:**
   - Add edit/approve buttons (linked to `/api/admin/stories/queue/:id`)
   - Add image upload/crop UI
   - Test with real article data

## Editorial Philosophy

**Skynet Nexus News is for families (ages 5–50).**

Every story must:
- ✅ Center young people's achievements + voices
- ✅ Use accessible language (no jargon without explanation)
- ✅ Link primary sources (not press releases)
- ✅ Inspire hope + curiosity (not fear)
- ✅ Include kid-friendly explanation (kidTake)
- ✅ Encourage family conversation (familyDiscussion)

The guardrail blocks any article with flagged terms (violence, weapons, politics, drugs, unverified claims).

## Debugging

**If a story fails validation:**
```bash
# Check publish.js stderr
node newsroom/publish.js --file data/articles/YYYY-MM-DD/story-id.json
```

**If image scraping fails:**
```bash
# Test scraper directly
node -e "const s = require('./newsroom/image-scraper'); s.scrapeSourceImages('https://example.com').then(console.log)"
```

**If agents don't spawn:**
- Check OpenClaw cron job status: `cron status`
- Check cron job logs: `cron runs --jobId <id>`
- Verify agent-orchestrator.js syntax

---

**Status:** Infrastructure ready. Awaiting OpenClaw integration for agent spawning. 🛰️
