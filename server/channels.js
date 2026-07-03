// server/channels.js
// Single source of truth for the Skynet Nexus channel taxonomy (server side).
// The client mirrors this list in public/assets/js/app.js (CHANNELS).

// The 11 live channels: 9 edge-STEM + 2 culture.
const CHANNELS = [
  { id: 'ai',          label: 'AI & Machine Learning',  icon: '🧠', color: '#00e5ff' },
  { id: 'space',       label: 'Space & Aerospace',      icon: '🚀', color: '#7c5cff' },
  { id: 'robotics',    label: 'Robotics & Automation',  icon: '🤖', color: '#a855f7' },
  { id: 'biotech',     label: 'Biotech & Health',       icon: '🧬', color: '#2dd4bf' },
  { id: 'quantum',     label: 'Quantum & Computing',    icon: '⚛️', color: '#22d3ee' },
  { id: 'climate',     label: 'Climate & Energy',       icon: '🌍', color: '#34d399' },
  { id: 'engineering', label: 'Engineering & Making',   icon: '🔧', color: '#ffb800' },
  { id: 'math',        label: 'Math & Data Science',    icon: '📐', color: '#f472b6' },
  { id: 'cyber',       label: 'Cybersecurity & Code',   icon: '🔐', color: '#38bdf8' },
  { id: 'gaming',      label: 'Gaming Tournaments',     icon: '🎮', color: '#39ff14' },
  { id: 'music',       label: 'Music Festivals',        icon: '🎧', color: '#ff2e63' }
];

// Channels a reader may submit a story to (all live channels).
const SUBMISSION_IDS = new Set(CHANNELS.map(c => c.id));

// Legacy category ids kept valid so pre-existing articles still resolve/publish.
const LEGACY_IDS = new Set(['stem', 'play', 'network']);

// Everything the publish pipeline + admin queue will accept.
const PUBLISH_IDS = new Set([...SUBMISSION_IDS, ...LEGACY_IDS]);

module.exports = { CHANNELS, SUBMISSION_IDS, LEGACY_IDS, PUBLISH_IDS };
