// server/scheduler.js
// The cadence engine: three daily editions at 10:15 / 2:15 PM / 6:15 PM America/New_York.
// Correspondents (AI) and approved human submissions are queued ahead of time and
// time-released at the drop. Human stories must be scheduled >= CUTOFF_MIN before a
// drop to make that edition; otherwise they roll to the next one. If no human story
// is scheduled for a drop, the AI correspondents' edition simply carries it (fallback).

const db = require('./db');
const { publishPayload } = require('./publisher');

const TZ = 'America/New_York';
const DROP_HOURS = [10, 14, 18];        // edition drop times, Eastern (at :15 minutes)
const DROP_MINUTES = 15;                 // drop at :15 past the hour (10:15 AM, 2:15 PM, 6:15 PM)
const CUTOFF_MIN = 60;                   // human stories must be in 1 hour before a drop
const EDITIONS = { 10: 'morning', 14: 'midday', 18: 'evening' };
const TICK_MS = 60_000;

// Current wall-clock parts in Eastern time.
function etParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const p = {};
  for (const part of fmt.formatToParts(date)) p[part.type] = part.value;
  return {
    year: +p.year, month: +p.month, day: +p.day,
    hour: +(p.hour === '24' ? 0 : p.hour), minute: +p.minute, second: +p.second
  };
}

// The UTC offset (minutes) for Eastern at a given instant (handles DST).
function etOffsetMinutes(date = new Date()) {
  const p = etParts(date);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

// Build a Date for a given Eastern Y/M/D + hour + minute.
function etDateToUtc(year, month, day, hour, minute = 0) {
  // First guess using a fixed offset, then correct for the true offset at that instant.
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const off = etOffsetMinutes(guess);
  return new Date(guess.getTime() - off * 60000);
}

// The next drop instant strictly after `from`.
function nextDrop(from = new Date()) {
  const p = etParts(from);
  for (const h of DROP_HOURS) {
    const cand = etDateToUtc(p.year, p.month, p.day, h, DROP_MINUTES);
    if (cand.getTime() > from.getTime()) return { at: cand, hour: h, edition: EDITIONS[h] };
  }
  // Past today's last drop -> first drop tomorrow.
  const t = new Date(from.getTime() + 24 * 3600_000);
  const tp = etParts(t);
  const cand = etDateToUtc(tp.year, tp.month, tp.day, DROP_HOURS[0], DROP_MINUTES);
  return { at: cand, hour: DROP_HOURS[0], edition: EDITIONS[DROP_HOURS[0]] };
}

// The next drop a human story can still make, honoring the review cutoff.
function nextEligibleDrop(from = new Date(), cutoffMin = CUTOFF_MIN) {
  const cutoff = new Date(from.getTime() + cutoffMin * 60000);
  return nextDrop(cutoff);
}

function scheduleInfo() {
  const now = new Date();
  const nd = nextDrop(now);
  const ne = nextEligibleDrop(now);
  return {
    timezone: TZ,
    dropHours: DROP_HOURS,
    dropMinutes: DROP_MINUTES,
    cutoffMinutes: CUTOFF_MIN,
    editions: EDITIONS,
    nextDrop: { at: nd.at.toISOString(), edition: nd.edition, hour: nd.hour },
    nextEligibleDrop: { at: ne.at.toISOString(), edition: ne.edition, hour: ne.hour },
    serverTime: now.toISOString()
  };
}

// Release any scheduled stories that are now due.
async function releaseDue() {
  let due = [];
  try { due = db.listDueScheduledStories(new Date().toISOString()); }
  catch (e) { console.warn('[scheduler] query failed:', e.message); return; }
  for (const story of due) {
    try {
      const result = await publishPayload(story.payload, `drop-${story.id}`);
      if (result.code === 0) {
        db.updateQueuedStory({
          id: story.id, status: 'published',
          publishedArticleId: result.articleId, publishedAt: new Date().toISOString()
        });
        if (story.submissionId) {
          db.updateSubmission({
            id: story.submissionId, status: 'published',
            reviewedAt: new Date().toISOString(), resultingStoryId: result.articleId
          });
        }
        console.log(`[scheduler] released queued story #${story.id} -> ${result.articleId || '(unknown id)'}`);
      } else {
        db.updateQueuedStory({ id: story.id, status: 'draft', editorNotes: '[scheduler] publish failed, returned to drafts: ' + (result.stderr || '').slice(0, 300) });
        console.warn(`[scheduler] publish failed for #${story.id} (code ${result.code}); returned to drafts`);
      }
    } catch (e) {
      console.warn(`[scheduler] release error for #${story.id}:`, e.message);
    }
  }
}

let _timer = null;
function start() {
  if (_timer) return;
  const info = scheduleInfo();
  const dropStr = DROP_HOURS.map(h => `${h}:${(DROP_MINUTES < 10 ? '0' : '') + DROP_MINUTES}`).join(' / ');
  console.log(`[scheduler] cadence active — drops ${dropStr} ${TZ}; next drop ${info.nextDrop.at} (${info.nextDrop.edition})`);
  releaseDue();
  _timer = setInterval(releaseDue, TICK_MS);
  if (_timer.unref) _timer.unref();
}

module.exports = { start, scheduleInfo, nextDrop, nextEligibleDrop, releaseDue, DROP_HOURS, DROP_MINUTES, CUTOFF_MIN, EDITIONS };
