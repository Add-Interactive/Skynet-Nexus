// newsroom/agent-orchestrator.js
// Gizmo Newsroom pipeline protocol.
//
// How daily editions get made (replaces the old OpenClaw/Antigravity setup):
//
//   T-60 min  Gizmo's scheduler spawns one correspondent subagent per channel
//             (13 channels). Each subagent reads its channel brief in
//             newsroom/prompts/<channel>.md, researches 1-2 fresh stories via
//             Brave Search, and returns article JSON in the house schema.
//   T-45 min  Gizmo validates every draft (schema + kid-safe guardrails, same
//             rules as newsroom/publish.js) and files it to the review queue
//             via POST /api/newsroom/drafts, stamped for the upcoming drop.
//   T-60..0   The News Director reviews in the Review Console
//             (newsroom/dashboard.html): approve, spike, or leave notes.
//             Notes left on a draft are applied on the final pass.
//   T-15 min  Final pass: notes applied, drafts revised, queue updated.
//   Drop      server/scheduler.js releases scheduled stories. Any draft still
//             sitting unreviewed at drop time auto-publishes (the director's
//             review is a courtesy, never a blocker). Spiked (rejected)
//             stories never auto-publish.
//
// The correspondent roster lives in newsroom/agents-config.js.

const path = require('path');
const fs = require('fs');
const { AGENTS } = require('./agents-config');

const DROP_TIMES_ET = ['10:15 AM', '2:15 PM', '6:15 PM'];
const EDITIONS = { 10: 'morning', 14: 'midday', 18: 'evening' };

// The prompt template handed to each correspondent subagent.
function generateAgentPrompt(agent, drops) {
  const briefPath = path.join(__dirname, 'prompts', `${agent.channel}.md`);
  let brief = '';
  try { brief = fs.readFileSync(briefPath, 'utf8'); }
  catch (e) { brief = '(channel brief not found — use house style)'; }

  return `You are ${agent.displayName}, ${agent.role} for Skynet Nexus News, a family-first news network (ages 5-50, parent/child co-reading).

CHANNEL BRIEF:
${brief}

YOUR ASSIGNMENT — file 1-2 fresh stories for the upcoming edition(s): ${drops.join(', ')}.

Research each story with web search. Use PRIMARY sources only (universities, agencies, competition results, official announcements). No made-up stories, no unverifiable claims. Today's date context matters — prefer stories from the last 72 hours.

For each story, return ONE valid article JSON object with:
- "title": catchy, youth-first headline (under 80 chars)
- "cat": "${agent.channel}"
- "author": "${agent.displayName}"
- "authorRole": "${agent.role}"
- "date": "YYYY-MM-DD" (today)
- "excerpt": 1-2 sentence summary
- "body": clean HTML (<p>, <h2>, <blockquote>, <ul>, <li>), ~400 words
- "kidTake": 2-3 sentences at age-8 reading level
- "familyDiscussion": array of 2+ open-ended questions parents can ask kids
- "glossary": optional array of {term, meaning} for technical stories
- "ageBand": "5+", "8+", or "12+"
- "sources": array of {label, url} (primary sources only)
- "heroImage": "" (leave blank — the newsroom attaches artwork)
- "tags": array of 2-5 topic tags

GUARDRAILS (stories violating these are rejected):
- Youth-first, inspiring, not scary. Family-safe: no violence, weapons, politics, drugs.
- No jargon without explanation. Accessible language throughout.
- Every factual claim must trace to a source you actually found.

Return ONLY the JSON objects, one per line (JSONL). No commentary, no markdown fences.`;
}


// Validate the optional `media` array on a draft:
// [{type:'image'|'video'|'link', url, caption, credit, sourceUrl?}]
// Caps: max 6 items, http(s) urls, caption <= 200 chars, credit <= 120 chars.
// Kid-safe guardrail applies to captions too.
function validateMediaArray(media) {
  const errors = [];
  if (media == null) return errors;
  if (!Array.isArray(media)) return ['media must be an array'];
  if (media.length > 6) errors.push('media: max 6 items (got ' + media.length + ')');
  const okUrl = u => typeof u === 'string' && /^https?:\/\//i.test(u.trim());
  const flagged = ['killed', 'murder', 'suicide', 'terrorist', 'assault', 'rape', 'overdose', 'nazi', 'slavery', 'gun ', 'shooting', 'weapon', 'combat'];
  media.forEach((m, i) => {
    const tag = 'media[' + i + ']';
    if (!m || typeof m !== 'object') { errors.push(tag + ': must be an object'); return; }
    if (!['image', 'video', 'link'].includes(m.type)) errors.push(tag + ': type must be image|video|link');
    if (!okUrl(m.url)) errors.push(tag + ': url must be an http(s) URL');
    if (m.sourceUrl && !okUrl(m.sourceUrl)) errors.push(tag + ': sourceUrl must be an http(s) URL');
    const cap = String(m.caption || '').trim();
    if (!cap) errors.push(tag + ': caption required');
    else if (cap.length > 200) errors.push(tag + ': caption max 200 chars');
    const cred = String(m.credit || '').trim();
    if (!cred) errors.push(tag + ': credit required (name the source)');
    else if (cred.length > 120) errors.push(tag + ': credit max 120 chars');
    const hits = flagged.filter(w => cap.toLowerCase().includes(w));
    if (hits.length) errors.push(tag + ': KID-SAFE VIOLATION in caption: ' + hits.join(', '));
  });
  return errors;
}

// Validate a filed draft against the house schema + kid-safe guardrails.
// Mirrors the rules in newsroom/publish.js so bad drafts never reach the queue.
function validateDraft(article) {
  const errors = [];
  if (!article.title) errors.push('title required');
  if (!article.cat) errors.push('cat required');
  if (!article.body) errors.push('body required (HTML string)');
  if (!article.date) errors.push('date required (YYYY-MM-DD)');
  if (!article.excerpt) errors.push('excerpt required');
  if (!article.kidTake) errors.push('kidTake required (2-3 sentences, ~age 8 reading level)');
  if (!article.familyDiscussion || !Array.isArray(article.familyDiscussion) || article.familyDiscussion.length < 2) {
    errors.push('familyDiscussion required (array of 2+ question strings)');
  }
  const validCats = ['ai', 'space', 'robotics', 'biotech', 'quantum', 'climate', 'engineering', 'math', 'cyber', 'gaming', 'music', 'stem', 'play'];
  if (article.cat && !validCats.includes(article.cat)) errors.push('cat must be one of: ' + validCats.join(', '));

  const flagged = ['killed', 'murder', 'suicide', 'terrorist', 'assault', 'rape', 'overdose', 'nazi', 'slavery', 'gun ', 'shooting', 'weapon', 'combat'];
  const haystack = (String(article.title || '') + ' ' + String(article.body || '')).toLowerCase();
  const hits = flagged.filter(w => haystack.includes(w));
  if (hits.length) errors.push('KID-SAFE VIOLATION: flagged terms: ' + hits.join(', '));

  errors.push(...validateMediaArray(article.media));

  return errors;
}

// ---- Drop-time helpers (America/New_York) ----

function etParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
  const p = {};
  for (const part of fmt.formatToParts(date)) p[part.type] = part.value;
  return { year: +p.year, month: +p.month, day: +p.day, hour: +(p.hour === '24' ? 0 : p.hour), minute: +p.minute };
}

function etOffsetMinutes(date = new Date()) {
  const p = etParts(date);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
  return Math.round((asUTC - date.getTime()) / 60000);
}

function etDateToUtc(year, month, day, hour, minute = 0) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  return new Date(guess.getTime() - etOffsetMinutes(guess) * 60000);
}

// The next drop instant strictly after `from`.
function nextDrop(from = new Date()) {
  const p = etParts(from);
  for (const h of [10, 14, 18]) {
    const cand = etDateToUtc(p.year, p.month, p.day, h, 15);
    if (cand.getTime() > from.getTime()) return { at: cand, hour: h, edition: EDITIONS[h] };
  }
  const t = new Date(from.getTime() + 24 * 3600_000);
  const tp = etParts(t);
  const cand = etDateToUtc(tp.year, tp.month, tp.day, 10, 15);
  return { at: cand, hour: 10, edition: EDITIONS[10] };
}

// Correspondents file 60 minutes before the drop.
function agentSpawnTime(from = new Date()) {
  const nd = nextDrop(from);
  return { at: new Date(nd.at.getTime() - 60 * 60000), drop: nd };
}

module.exports = {
  validateMediaArray,
  AGENTS,
  DROP_TIMES_ET,
  EDITIONS,
  generateAgentPrompt,
  validateDraft,
  nextDrop,
  agentSpawnTime
};
