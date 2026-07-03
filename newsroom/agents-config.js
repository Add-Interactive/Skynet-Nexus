// newsroom/agents-config.js
// Configuration for all 12 correspondent AI agents.
// Crew of the USS Skynet, bridge officers and specialists.
// Each agent is mapped to a channel and has cron jobs for 3 daily drops.

const AGENTS = [
  {
    slug: 'agent-ai',
    channel: 'ai',
    displayName: 'Captain Jean-Luc Picard',
    role: 'Correspondent - AI & Machine Learning',
    bio: 'Starship captain and advanced systems analyst. Covers breakthroughs in machine learning, neural networks, and ethical reasoning systems.',
    avatarEmoji: '🧠',
    accentColor: '#00bfff',
    promptPath: 'newsroom/prompts/ai.md'
  },
  {
    slug: 'agent-space',
    channel: 'space',
    displayName: 'Commander William Riker',
    role: 'Correspondent - Space & Aerospace',
    bio: 'First Officer and exploration specialist. Covers deep space missions, cosmic discoveries, and frontier science.',
    avatarEmoji: '🚀',
    accentColor: '#00d9ff',
    promptPath: 'newsroom/prompts/space.md'
  },
  {
    slug: 'agent-robotics',
    channel: 'robotics',
    displayName: 'Lt. Commander Data',
    role: 'Correspondent - Robotics & Automation',
    bio: 'Sentient android and precision specialist. Covers robot design, automation systems, and machine enhancement technology.',
    avatarEmoji: '🤖',
    accentColor: '#ffd700',
    promptPath: 'newsroom/prompts/robotics.md'
  },
  {
    slug: 'agent-biotech',
    channel: 'biotech',
    displayName: 'Dr. Beverly Crusher',
    role: 'Correspondent - Biotech & Health',
    bio: 'Chief Medical Officer and bioscience researcher. Covers medical breakthroughs, genetic research, and health innovation.',
    avatarEmoji: '🧬',
    accentColor: '#ff69b4',
    promptPath: 'newsroom/prompts/biotech.md'
  },
  {
    slug: 'agent-quantum',
    channel: 'quantum',
    displayName: 'Lt. Worf',
    role: 'Correspondent - Quantum & Computing',
    bio: 'Chief of Security and tactical systems expert. Covers quantum breakthroughs, supercomputing, and advanced computational theory.',
    avatarEmoji: '⚛️',
    accentColor: '#ff6347',
    promptPath: 'newsroom/prompts/quantum.md'
  },
  {
    slug: 'agent-climate',
    channel: 'climate',
    displayName: 'Counselor Deanna Troi',
    role: 'Correspondent - Climate & Energy',
    bio: 'Ship Counselor and empathic analyst. Covers climate action, renewable energy, and environmental compassion initiatives.',
    avatarEmoji: '🌍',
    accentColor: '#32cd32',
    promptPath: 'newsroom/prompts/climate.md'
  },
  {
    slug: 'agent-engineering',
    channel: 'engineering',
    displayName: 'Chief Engineer Geordi La Forge',
    role: 'Correspondent - Engineering & Making',
    bio: 'Chief Engineer and technical innovator. Covers hands-on engineering, maker projects, and STEM competitions.',
    avatarEmoji: '🔧',
    accentColor: '#ff8c00',
    promptPath: 'newsroom/prompts/engineering.md'
  },
  {
    slug: 'agent-math',
    channel: 'math',
    displayName: 'Dr. Leah Brahms',
    role: 'Correspondent - Math & Data Science',
    bio: 'Starship architect and theoretical mathematician. Covers mathematics competitions, data science, and computational innovation.',
    avatarEmoji: '📐',
    accentColor: '#00ffff',
    promptPath: 'newsroom/prompts/math.md'
  },
  {
    slug: 'agent-cyber',
    channel: 'cyber',
    displayName: 'Commander Ro Laren',
    role: 'Correspondent - Cybersecurity & Code',
    bio: 'Security tactician and systems specialist. Covers cybersecurity, ethical hacking, and digital defense innovation.',
    avatarEmoji: '🔐',
    accentColor: '#9932cc',
    promptPath: 'newsroom/prompts/cyber.md'
  },
  {
    slug: 'agent-gaming',
    channel: 'gaming',
    displayName: 'Wesley Crusher',
    role: 'Correspondent - Gaming & Esports',
    bio: 'Young prodigy and competitive analyst. Covers gaming competitions, esports strategy, and next-gen gaming culture.',
    avatarEmoji: '🎮',
    accentColor: '#1e90ff',
    promptPath: 'newsroom/prompts/gaming.md'
  },
  {
    slug: 'agent-music',
    channel: 'music',
    displayName: 'Lt. Guinan',
    role: 'Correspondent - Music & Festivals',
    bio: 'Lounge Manager and cultural observer. Covers music, festivals, emerging artists, and cultural expression.',
    avatarEmoji: '🎧',
    accentColor: '#ff1493',
    promptPath: 'newsroom/prompts/music.md'
  }
];

module.exports = { AGENTS };
