// server/analytics.js
// Analytics engine for Skynet Nexus Newsroom
// Provides deep story-level, agent-level, and channel-level metrics

const db = require('./db');
const fs = require('fs');
const path = require('path');

const { DATA_DIR } = require('./storage');

/**
 * STORY-LEVEL ANALYTICS
 * Metrics for individual stories
 */
function getStoryAnalytics(storyId) {
  try {
    const story = db.getQueuedStory(storyId);
    if (!story) return null;

    const createdAt = new Date(story.createdAt);
    const approvedAt = story.approvedAt ? new Date(story.approvedAt) : null;
    const publishedAt = story.publishedAt ? new Date(story.publishedAt) : null;

    const timeToApprove = approvedAt ? (approvedAt - createdAt) / 1000 / 60 : null; // minutes
    const timeToPublish = publishedAt ? (publishedAt - createdAt) / 1000 / 60 : null;

    return {
      id: story.id,
      title: story.title,
      channel: story.channel,
      agent: story.agentSlug,
      status: story.status,
      createdAt: story.createdAt,
      approvedAt: story.approvedAt,
      publishedAt: story.publishedAt,
      revisionCount: story.revisionCount || 0,
      guardrailPass: story.guardrailPass !== false,
      guardrailFailures: story.guardrailFailures ? JSON.parse(story.guardrailFailures) : [],
      qualityScore: story.qualityScore || 0,
      timeToApproveMinutes: timeToApprove,
      timeToPublishMinutes: timeToPublish,
      wordCount: story.bodyHtml ? story.bodyHtml.split(/\s+/).length : 0,
    };
  } catch (e) {
    console.error('[analytics] getStoryAnalytics error:', e);
    return null;
  }
}

/**
 * AGENT-LEVEL ANALYTICS
 * Performance metrics for each agent/correspondent
 */
function getAgentAnalytics(agentSlug, options = {}) {
  const {
    days = 7, // last N days
  } = options;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffISO = cutoffDate.toISOString();

    // Get all stories by this agent
    const allStories = db.listQueuedStories({ agentSlug, limit: 10000 });
    const recentStories = allStories.filter(s => s.createdAt >= cutoffISO);

    const stats = {
      agent: agentSlug,
      period: { days, from: cutoffISO },
      total: {
        filed: recentStories.length,
        approved: recentStories.filter(s => s.status === 'approved' || s.status === 'published').length,
        published: recentStories.filter(s => s.status === 'published').length,
        rejected: recentStories.filter(s => s.status === 'rejected').length,
      },
      quality: {
        averageScore: recentStories.length ? 
          (recentStories.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / recentStories.length).toFixed(2) : 0,
        minScore: recentStories.length ? Math.min(...recentStories.map(s => s.qualityScore || 0)) : 0,
        maxScore: recentStories.length ? Math.max(...recentStories.map(s => s.qualityScore || 0)) : 0,
      },
      guardrail: {
        passRate: recentStories.length ?
          ((recentStories.filter(s => s.guardrailPass !== false).length / recentStories.length) * 100).toFixed(1) : 100,
        failures: recentStories.filter(s => s.guardrailPass === false).length,
      },
      revisions: {
        requestedCount: recentStories.filter(s => s.revisionCount > 0).length,
        averagePerStory: recentStories.length ?
          (recentStories.reduce((sum, s) => sum + (s.revisionCount || 0), 0) / recentStories.length).toFixed(2) : 0,
      },
      timing: {
        averageTimeToPublishMinutes: recentStories.length ?
          (recentStories.reduce((sum, s) => {
            if (!s.publishedAt) return sum;
            const created = new Date(s.createdAt);
            const published = new Date(s.publishedAt);
            return sum + ((published - created) / 1000 / 60);
          }, 0) / recentStories.filter(s => s.publishedAt).length).toFixed(1) : 0,
      },
      topChannels: (() => {
        const channels = {};
        for (const s of recentStories) {
          channels[s.channel] = (channels[s.channel] || 0) + 1;
        }
        return Object.entries(channels)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([ch, count]) => ({ channel: ch, count }));
      })(),
    };

    return stats;
  } catch (e) {
    console.error('[analytics] getAgentAnalytics error:', e);
    return null;
  }
}

/**
 * CHANNEL-LEVEL ANALYTICS
 * Performance metrics per channel
 */
function getChannelAnalytics(channel, options = {}) {
  const { days = 7 } = options;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffISO = cutoffDate.toISOString();

    const allStories = db.listQueuedStories({ channel, limit: 10000 });
    const recentStories = allStories.filter(s => s.createdAt >= cutoffISO);

    const stats = {
      channel,
      period: { days, from: cutoffISO },
      volume: {
        filed: recentStories.length,
        published: recentStories.filter(s => s.status === 'published').length,
        rejected: recentStories.filter(s => s.status === 'rejected').length,
      },
      quality: {
        averageScore: recentStories.length ?
          (recentStories.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / recentStories.length).toFixed(2) : 0,
      },
      guardrail: {
        passRate: recentStories.length ?
          ((recentStories.filter(s => s.guardrailPass !== false).length / recentStories.length) * 100).toFixed(1) : 100,
      },
      revisions: {
        rate: recentStories.length ?
          ((recentStories.filter(s => s.revisionCount > 0).length / recentStories.length) * 100).toFixed(1) : 0,
      },
      topAgents: (() => {
        const agents = {};
        for (const s of recentStories) {
          agents[s.agentSlug] = (agents[s.agentSlug] || 0) + 1;
        }
        return Object.entries(agents)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([agent, count]) => ({ agent, count }));
      })(),
    };

    return stats;
  } catch (e) {
    console.error('[analytics] getChannelAnalytics error:', e);
    return null;
  }
}

/**
 * AGGREGATE ANALYTICS
 * System-wide metrics
 */
function getAggregateAnalytics(options = {}) {
  const { days = 7 } = options;

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffISO = cutoffDate.toISOString();

    const allStories = db.listQueuedStories({ limit: 100000 });
    const recentStories = allStories.filter(s => s.createdAt >= cutoffISO);

    // Group by date
    const byDate = {};
    for (const story of recentStories) {
      const date = story.createdAt.slice(0, 10);
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(story);
    }

    // Compute daily metrics
    const dailyMetrics = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stories]) => ({
        date,
        filed: stories.length,
        published: stories.filter(s => s.status === 'published').length,
        avgQuality: (stories.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / stories.length).toFixed(2),
        guardrailPassRate: ((stories.filter(s => s.guardrailPass !== false).length / stories.length) * 100).toFixed(1),
      }));

    const stats = {
      period: { days, from: cutoffISO },
      total: {
        filed: recentStories.length,
        published: recentStories.filter(s => s.status === 'published').length,
        rejected: recentStories.filter(s => s.status === 'rejected').length,
      },
      quality: {
        averageScore: recentStories.length ?
          (recentStories.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / recentStories.length).toFixed(2) : 0,
        trend: dailyMetrics.length > 0 ? 'stable' : 'unknown', // TODO: calculate trend
      },
      guardrail: {
        passRate: recentStories.length ?
          ((recentStories.filter(s => s.guardrailPass !== false).length / recentStories.length) * 100).toFixed(1) : 100,
        failures: recentStories.filter(s => s.guardrailPass === false).length,
      },
      revisions: {
        totalRequests: recentStories.filter(s => s.revisionCount > 0).length,
        rate: recentStories.length ?
          ((recentStories.filter(s => s.revisionCount > 0).length / recentStories.length) * 100).toFixed(1) : 0,
      },
      channels: (() => {
        const channels = {};
        for (const story of recentStories) {
          if (!channels[story.channel]) {
            channels[story.channel] = { filed: 0, published: 0, avgQuality: 0, count: 0 };
          }
          channels[story.channel].filed++;
          if (story.status === 'published') channels[story.channel].published++;
          channels[story.channel].avgQuality += story.qualityScore || 0;
          channels[story.channel].count++;
        }
        // Calculate averages
        for (const ch in channels) {
          channels[ch].avgQuality = (channels[ch].avgQuality / channels[ch].count).toFixed(2);
        }
        return channels;
      })(),
      agents: (() => {
        const agents = {};
        for (const story of recentStories) {
          if (!agents[story.agentSlug]) {
            agents[story.agentSlug] = { filed: 0, published: 0, avgQuality: 0, count: 0 };
          }
          agents[story.agentSlug].filed++;
          if (story.status === 'published') agents[story.agentSlug].published++;
          agents[story.agentSlug].avgQuality += story.qualityScore || 0;
          agents[story.agentSlug].count++;
        }
        for (const ag in agents) {
          agents[ag].avgQuality = (agents[ag].avgQuality / agents[ag].count).toFixed(2);
        }
        return agents;
      })(),
      dailyMetrics,
    };

    return stats;
  } catch (e) {
    console.error('[analytics] getAggregateAnalytics error:', e);
    return null;
  }
}

/**
 * EXPORT DATA
 * Generate CSV/JSON exports for reporting
 */
function exportStoriesAsJSON(filter = {}) {
  try {
    const stories = db.listQueuedStories(filter);
    return stories.map(s => ({
      id: s.id,
      title: s.title,
      channel: s.channel,
      agent: s.agentSlug,
      status: s.status,
      createdAt: s.createdAt,
      publishedAt: s.publishedAt,
      qualityScore: s.qualityScore,
      revisionCount: s.revisionCount,
    }));
  } catch (e) {
    console.error('[analytics] exportStoriesAsJSON error:', e);
    return [];
  }
}

function exportStoriesAsCSV(filter = {}) {
  try {
    const stories = exportStoriesAsJSON(filter);
    const csv = [
      ['ID', 'Title', 'Channel', 'Agent', 'Status', 'Created', 'Published', 'Quality', 'Revisions'].join(',')
    ];
    for (const s of stories) {
      csv.push([
        s.id,
        `"${(s.title || '').replace(/"/g, '""')}"`,
        s.channel,
        s.agent,
        s.status,
        s.createdAt,
        s.publishedAt || '',
        s.qualityScore,
        s.revisionCount,
      ].join(','));
    }
    return csv.join('\n');
  } catch (e) {
    console.error('[analytics] exportStoriesAsCSV error:', e);
    return '';
  }
}

module.exports = {
  getStoryAnalytics,
  getAgentAnalytics,
  getChannelAnalytics,
  getAggregateAnalytics,
  exportStoriesAsJSON,
  exportStoriesAsCSV,
};
