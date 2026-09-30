// server/seed-agents.js
// Seed all 13 correspondent agents into the database.
// Call from server startup or separately as needed.

const { listStaff, findStaffBySlug, createStaff, updateStaff } = require('./db');

// Import agent config
const AGENTS_CONFIG = require('../newsroom/agents-config');
const { AGENTS } = AGENTS_CONFIG;

/**
 * Seed all correspondent agents.
 * Idempotent: creates agents missing by slug, and updates displayName/role/bio
 * for existing slugs so renames propagate on deploy.
 * @returns {Object} { created: number, updated: number, skipped: number, errors: [] }
 */
function seedAgents() {
  const result = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const agent of AGENTS) {
    try {
      const existing = findStaffBySlug(agent.slug);
      const fields = {
        displayName: agent.displayName,
        role: agent.role,
        channel: agent.channel || null,
        byline: agent.displayName || null,
        avatarEmoji: agent.avatarEmoji || '🛰️',
        accentColor: agent.accentColor || '#00e5ff',
        bio: agent.bio || null,
        promptPath: agent.promptPath || null,
        status: 'active'
      };
      if (!existing) {
        createStaff(Object.assign({ slug: agent.slug, kind: 'agent', linkedUserId: null }, fields));
        result.created++;
        console.log(`[seed-agents] Created agent: ${agent.displayName} (${agent.slug})`);
      } else if (
        existing.displayName !== fields.displayName ||
        existing.role !== fields.role ||
        existing.byline !== fields.byline
      ) {
        updateStaff(existing.id, fields);
        result.updated++;
        console.log(`[seed-agents] Updated agent: ${agent.displayName} (${agent.slug})`);
      } else {
        result.skipped++;
      }
    } catch (err) {
      result.errors.push({ slug: agent.slug, error: err.message });
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
