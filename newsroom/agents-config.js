// newsroom/agents-config.js
// Configuration for all 12 correspondent AI agents.
// Crew of the USS Skynet, bridge officers and specialists.
// Each agent is mapped to a channel and has cron jobs for 3 daily drops.

const AGENTS = [
  {
    slug: 'agent-ai',
    channel: 'ai',
    displayName: 'Dr. Nova Sterling',
    role: 'Correspondent - AI & Machine Learning',
    bio: 'Advanced AI researcher and systems analyst. Covers breakthroughs in machine learning, neural networks, and ethical reasoning systems.',
    avatarEmoji: '🧠',
    accentColor: '#a855f7', // Purple (Tech / CS standard)
    promptPath: 'newsroom/prompts/ai.md'
  },
  {
    slug: 'agent-space',
    channel: 'space',
    displayName: 'Commander Leo Vance',
    role: 'Correspondent - Space & Aerospace',
    bio: 'Exploration specialist. Covers deep space missions, cosmic discoveries, and frontier space science.',
    avatarEmoji: '🚀',
    accentColor: '#3b82f6', // Blue (Social Studies / Astronomy standard)
    promptPath: 'newsroom/prompts/space.md'
  },
  {
    slug: 'agent-robotics',
    channel: 'robotics',
    displayName: 'Jax Henderson',
    role: 'Correspondent - Robotics & Automation',
    bio: 'Precision engineer and robotics specialist. Covers robot design, automation systems, and machine enhancement technology.',
    avatarEmoji: '🤖',
    accentColor: '#eab308', // Gold / Yellow (Robotics standard)
    promptPath: 'newsroom/prompts/robotics.md'
  },
  {
    slug: 'agent-biotech',
    channel: 'biotech',
    displayName: 'Dr. Sage Rivers',
    role: 'Correspondent - Biotech & Health',
    bio: 'Bioscience researcher and medical innovator. Covers medical breakthroughs, genetic research, and health innovation.',
    avatarEmoji: '🧬',
    accentColor: '#10b981', // Green (Biology / Bioscience standard)
    promptPath: 'newsroom/prompts/biotech.md'
  },
  {
    slug: 'agent-quantum',
    channel: 'quantum',
    displayName: 'Zephyr Thorne',
    role: 'Correspondent - Quantum & Computing',
    bio: 'Theoretical computing and tactical systems expert. Covers quantum breakthroughs, supercomputing, and advanced computational theory.',
    avatarEmoji: '⚛️',
    accentColor: '#06b6d4', // Teal (Advanced Physics standard)
    promptPath: 'newsroom/prompts/quantum.md'
  },
  {
    slug: 'agent-climate',
    channel: 'climate',
    displayName: 'Terra Green',
    role: 'Correspondent - Climate & Energy',
    bio: 'Environmental scientist and climate analyst. Covers climate action, renewable energy, and environmental compassion initiatives.',
    avatarEmoji: '🌍',
    accentColor: '#22c55e', // Lime Green (Earth Science / Environment standard)
    promptPath: 'newsroom/prompts/climate.md'
  },
  {
    slug: 'agent-engineering',
    channel: 'engineering',
    displayName: 'Mason Rivet',
    role: 'Correspondent - Engineering & Making',
    bio: 'Hands-on structural engineer and technical innovator. Covers engineering design, maker projects, and youth builder competitions.',
    avatarEmoji: '🔧',
    accentColor: '#f97316', // Orange (Engineering / Shop standard)
    promptPath: 'newsroom/prompts/engineering.md'
  },
  {
    slug: 'agent-math',
    channel: 'math',
    displayName: 'Adara Matrix',
    role: 'Correspondent - Math & Data Science',
    bio: 'Data scientist and theoretical mathematician. Covers mathematics competitions, data science, and computational innovation.',
    avatarEmoji: '📐',
    accentColor: '#ef4444', // Red (Mathematics standard)
    promptPath: 'newsroom/prompts/math.md'
  },
  {
    slug: 'agent-cyber',
    channel: 'cyber',
    displayName: 'Cipher Crypt',
    role: 'Correspondent - Cybersecurity & Code',
    bio: 'Security tactician and systems developer. Covers cybersecurity, ethical hacking, and digital defense innovation.',
    avatarEmoji: '🔐',
    accentColor: '#6366f1', // Indigo (Cybersecurity standard)
    promptPath: 'newsroom/prompts/cyber.md'
  },
  {
    slug: 'agent-gaming',
    channel: 'gaming',
    displayName: 'Leo Pixel',
    role: 'Correspondent - Gaming & Esports',
    bio: 'Competitive analyst and gaming expert. Covers gaming tournaments, esports strategy, and next-gen gaming culture.',
    avatarEmoji: '🎮',
    accentColor: '#84cc16', // Lime (Gaming standard)
    promptPath: 'newsroom/prompts/gaming.md'
  },
  {
    slug: 'agent-music',
    channel: 'music',
    displayName: 'Aria Harmony',
    role: 'Correspondent - Music & Festivals',
    bio: 'Musicologist and cultural observer. Covers youth music festivals, emerging teenage artists, and cultural expression.',
    avatarEmoji: '🎧',
    accentColor: '#ec4899', // Pink (Art / Music standard)
    promptPath: 'newsroom/prompts/music.md'
  }
];

module.exports = { AGENTS };
