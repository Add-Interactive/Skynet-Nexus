// newsroom/agent-orchestrator.js
// Spawns correspondent agents for each channel 1 hour before each drop.
// Agents file 5 story ideas to the draft queue; auto-publish fallback if no human review.
//
// Used by: cron jobs or scheduler to trigger story generation.

const path = require('path');
const { AGENTS } = require('./agents-config');

// Agent story generator prompt template
function generateAgentPrompt(agent, drops) {
  return `You are ${agent.displayName}, a correspondent for Skynet Nexus News covering ${agent.channel}.

You have 1 hour to file **5 story ideas** for the upcoming news drops today.

Read your channel brief: ${agent.promptPath}

For each story, generate a valid article JSON object with:
- **title**: Catchy, youth-first headline (under 80 chars)
- **body**: Clean HTML (<p>, <h2>, <blockquote>, <ul>, <li>). ~400 words.
- **kidTake**: 2-3 sentences at age 8 reading level
- **familyDiscussion**: Array of 2+ open-ended questions parents can ask kids
- **glossary**: Optional array of {term, meaning} pairs (for technical stories)
- **ageBand**: "5+", "8+", or "12+" 
- **sources**: Array of {label, url} (PRIMARY sources only: universities, agencies, competition results, etc.)
- **images**: Array of {src, alt, credit} (placeholder URLs, we'll scrape real images)

**Format:** Return ONLY valid JSON, one object per line (JSONL format):
\`\`\`
{...article1...}
{...article2...}
{...article3...}
{...article4...}
{...article5...}
\`\`\`

**Guidelines:**
✅ Youth-first angle (ages 5-50 co-reading)
✅ Real, verifiable sources (no made-up stories)
✅ Accessible language (no jargon without explanation)
✅ Inspiring, not scary
✅ Family-safe guardrails (no violence/weapons/politics/drugs)

**Today's drops:** ${drops.join(', ')}

Begin.`;
}

// Spawn an agent and collect its story ideas
async function spawnCorrespondent(agent, drops) {
  console.log(`[agent] Spawning ${agent.displayName} (${agent.channel})...`);

  // In a real system, this would:
  // 1. Spawn a sub-agent via sessions_spawn with the prompt
  // 2. Wait for JSONL output
  // 3. Parse and validate each story
  // 4. File to db.createQueuedStory() with status='draft'
  // 5. Return { agent, stories: [validated...], errors: [...] }

  return {
    agent: agent.slug,
    channel: agent.channel,
    displayName: agent.displayName,
    prompt: generateAgentPrompt(agent, drops),
    status: 'ready_to_spawn',
    drops
  };
}

// Spawn all agents (batch spawn, wait for completion)
async function spawnAllCorrespondents(drops = ['10:00 AM ET', '2:00 PM ET', '6:00 PM ET']) {
  console.log(`[orchestrator] Spawning ${AGENTS.length} correspondents...`);
  
  const results = await Promise.all(
    AGENTS.map(agent => spawnCorrespondent(agent, drops))
  );

  return {
    timestamp: new Date().toISOString(),
    spawned: results.length,
    agents: results,
    nextStep: 'File stories to queue via cron job handler'
  };
}

// Calculate next drop time (ET)
function nextDrop() {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  
  const drops = [
    { hour: 10, minute: 0 },    // 10 AM
    { hour: 14, minute: 0 },    // 2 PM
    { hour: 18, minute: 0 }     // 6 PM
  ];

  for (const drop of drops) {
    const dropTime = new Date(et.getFullYear(), et.getMonth(), et.getDate(), drop.hour, drop.minute, 0);
    if (dropTime > et) {
      return dropTime;
    }
  }

  // Next day's first drop
  const tomorrow = new Date(et.getFullYear(), et.getMonth(), et.getDate() + 1, 10, 0, 0);
  return tomorrow;
}

// Calculate when agents should spawn (1 hour before next drop)
function agentSpawnTime() {
  const next = nextDrop();
  next.setHours(next.getHours() - 1);
  return next;
}

module.exports = {
  AGENTS,
  spawnCorrespondent,
  spawnAllCorrespondents,
  nextDrop,
  agentSpawnTime,
  generateAgentPrompt
};
