// server/channels.js
// Single source of truth for the Skynet Nexus channel taxonomy (server side).
// The client mirrors this list in public/assets/js/app.js (CHANNELS).

// The 15 live channels: 11 edge-STEM + 2 culture + 2 editorial.
const CHANNELS = [
  { id: 'skynet',      label: 'Skynet',                icon: '🛰️', color: '#00e5ff' },
  { id: 'network',     label: 'Network',               icon: '🛰️', color: '#00e5ff' },
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
  { id: 'music',       label: 'Music Festivals',        icon: '🎧', color: '#ff2e63' },
  { id: 'stem',        label: 'STEM Signal',            icon: '🔬', color: '#00e5ff' },
  { id: 'play',        label: 'Play & Design',          icon: '🎨', color: '#39ff14' }
];

// The Skynet and Network channels are editorial (SNN original content), not a reader-submission target.
const EDITORIAL_ONLY = new Set(['skynet', 'network']);

// Channels a reader may submit a story to (all live channels except editorial-only).
const SUBMISSION_IDS = new Set(CHANNELS.map(c => c.id).filter(id => !EDITORIAL_ONLY.has(id)));

// (stem/play were promoted to full channels; kept here empty for compatibility.)
const LEGACY_IDS = new Set([]);

// Everything the publish pipeline + admin queue will accept.
const PUBLISH_IDS = new Set([...SUBMISSION_IDS, ...LEGACY_IDS]);

module.exports = { CHANNELS, SUBMISSION_IDS, LEGACY_IDS, PUBLISH_IDS };
