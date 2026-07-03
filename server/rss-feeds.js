// server/rss-feeds.js
// RSS feed generation for Skynet Nexus News
// Generates main + per-channel + per-agent RSS feeds
// Caches are invalidated at each publication drop (10:15 AM, 2:15 PM, 6:15 PM ET)

const path = require('path');
const fs = require('fs');
const { DATA_DIR } = require('./storage');

// XML escape utility
function xmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Load manifest safely
function loadManifestSafe() {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, 'manifest.json'), 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return { articles: [] };
  }
}

/**
 * Build RSS XML for articles
 * @param {string} title - Feed title
 * @param {string} description - Feed description
 * @param {Array} articles - Article objects
 * @param {string} selfLink - Canonical feed URL
 * @param {string} siteOrigin - Base URL
 * @returns {string} RSS XML
 */
function buildRssXml(title, description, articles, selfLink, siteOrigin) {
  const build = new Date().toUTCString();
  
  const items = articles.slice(0, 40).map(a => {
    const link = siteOrigin + '/pages/article.html?id=' + encodeURIComponent(a.id);
    const pub = a.date ? new Date(a.date).toUTCString() : build;
    const cat = a.cat ? '<category>' + xmlEscape(a.cat) + '</category>' : '';
    const authorTag = a.author ? '<author>noreply@skynet.local (' + xmlEscape(a.author) + ')</author>' : '';
    
    return '  <item>\n' +
      '    <title>' + xmlEscape(a.title || 'Untitled') + '</title>\n' +
      '    <link>' + xmlEscape(link) + '</link>\n' +
      '    <guid isPermaLink="true">' + xmlEscape(link) + '</guid>\n' +
      '    <pubDate>' + xmlEscape(pub) + '</pubDate>\n' +
      '    ' + cat + '\n' +
      '    ' + authorTag + '\n' +
      '    <description>' + xmlEscape(a.excerpt || '') + '</description>\n' +
      '  </item>';
  }).join('\n');
  
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
    '<channel>\n' +
    '  <title>' + xmlEscape(title) + '</title>\n' +
    '  <link>' + xmlEscape(siteOrigin) + '</link>\n' +
    '  <description>' + xmlEscape(description) + '</description>\n' +
    '  <language>en-us</language>\n' +
    '  <lastBuildDate>' + xmlEscape(build) + '</lastBuildDate>\n' +
    '  <copyright>© 2026 Add Interactive Studio, in partnership with STEM Nexus</copyright>\n' +
    '  <managingEditor>editor@addinteractive.com (Skynet Nexus Newsroom / Add Interactive Studio)</managingEditor>\n' +
    '  <atom:link href="' + xmlEscape(selfLink) + '" rel="self" type="application/rss+xml"/>\n' +
    (items ? items + '\n' : '') +
    '</channel>\n</rss>\n';
}

/**
 * Generate main feed (all articles)
 */
function generateMainFeed(siteOrigin) {
  const manifest = loadManifestSafe();
  const articles = (manifest.articles || [])
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  
  return buildRssXml(
    'Skynet Nexus News',
    'Family-first daily news: STEM, robotics, play & design, and music for readers ages 5–50.',
    articles,
    siteOrigin + '/rss.xml',
    siteOrigin
  );
}

/**
 * Generate channel-specific feed
 */
function generateChannelFeed(channel, siteOrigin) {
  const manifest = loadManifestSafe();
  // Manifest articles carry their channel in the `cat` field.
  const articles = (manifest.articles || [])
    .filter(a => String(a.cat || '').toLowerCase() === String(channel).toLowerCase())
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  
  const channelMap = {
    'ai': 'AI & Machine Learning',
    'space': 'Space & Aerospace',
    'robotics': 'Robotics & Automation',
    'biotech': 'Biotech & Health',
    'quantum': 'Quantum & Computing',
    'climate': 'Climate & Energy',
    'engineering': 'Engineering & Making',
    'math': 'Math & Data Science',
    'cyber': 'Cybersecurity & Code',
    'gaming': 'Gaming & Esports',
    'music': 'Music & Festivals'
  };
  
  const channelName = channelMap[channel] || channel;
  const title = channelName + ' — Skynet Nexus News';
  const description = 'Family-first reporting on ' + channelName + ' from Skynet Nexus News.';
  
  return buildRssXml(
    title,
    description,
    articles,
    siteOrigin + '/rss-' + encodeURIComponent(channel) + '.xml',
    siteOrigin
  );
}

/**
 * Generate agent-specific feed (stories by correspondent)
 */
function generateAgentFeed(agentSlug, siteOrigin) {
  const manifest = loadManifestSafe();

  // Agent display name map
  const agentMap = {
    'agent-ai': 'Captain Jean-Luc Picard',
    'agent-space': 'Commander William Riker',
    'agent-robotics': 'Lt. Commander Data',
    'agent-biotech': 'Dr. Beverly Crusher',
    'agent-quantum': 'Lt. Worf',
    'agent-climate': 'Counselor Deanna Troi',
    'agent-engineering': 'Chief Engineer Geordi La Forge',
    'agent-math': 'Dr. Leah Brahms',
    'agent-cyber': 'Commander Ro Laren',
    'agent-gaming': 'Wesley Crusher',
    'agent-music': 'Lt. Guinan'
  };
  
  const agentName = agentMap[agentSlug] || agentSlug;
  // Manifest articles store the correspondent's display name in `author`.
  const articles = (manifest.articles || [])
    .filter(a => String(a.author || '').toLowerCase() === String(agentName).toLowerCase())
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const title = agentName + ' — Skynet Nexus News';
  const description = 'Stories filed by ' + agentName + ' for Skynet Nexus News.';
  
  return buildRssXml(
    title,
    description,
    articles,
    siteOrigin + '/rss-agent-' + encodeURIComponent(agentSlug) + '.xml',
    siteOrigin
  );
}

module.exports = {
  generateMainFeed,
  generateChannelFeed,
  generateAgentFeed,
  xmlEscape,
  buildRssXml
};
