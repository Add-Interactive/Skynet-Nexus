// server/seed-agents.js
// Seed all 11 correspondent agents into the database.
// Call from server startup or separately as needed.

const { listStaff, findStaffBySlug, createStaff } = require('./db');

// Import agent config
const AGENTS_CONFIG = require('../newsroom/agents-config');
const { AGENTS } = AGENTS_CONFIG;

/**
 * Seed all correspondent agents.
 * Idempotent: skips agents that already exist by slug.
 * @returns {Object} { created: number, skipped: number, errors: [] }
 */
function seedAgents() {
  const result = { created: 0, skipped: 0, errors: [] };
  
  for (const agent of AGENTS) {
    try {
      // Check if agent already exists
      const existing = findStaffBySlug(agent.slug);
      if (existing) {
        result.skipped++;
        continue;
      }
      
      // Create agent
      const created = createStaff({
        slug: agent.slug,
        kind: 'agent',
        displayName: agent.displayName,
        role: agent.role,
        channel: agent.channel || null,
        byline: agent.displayName || null,
        avatarEmoji: agent.avatarEmoji || '🛰️',
        accentColor: agent.accentColor || '#00e5ff',
        status: 'active',
        bio: agent.bio || null,
        promptPath: agent.promptPath || null,
        linkedUserId: null
      });
      
      result.created++;
      console.log(`[seed-agents] Created agent: ${agent.displayName} (${agent.slug})`);
    } catch (err) {
      result.errors.push({
        slug: agent.slug,
        error: err.message
      });
      console.error(`[seed-agents] Error creating ${agent.slug}:`, err.message);
    }
  }
  
  return result;
}

// If called directly
if (require.main === module) {
  const result = seedAgents();
  console.log('[seed-agents] Complete:', result);
  process.exit(result.errors.length > 0 ? 1 : 0);
}

module.exports = { seedAgents };
