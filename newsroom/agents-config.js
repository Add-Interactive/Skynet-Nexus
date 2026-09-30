// newsroom/agents-config.js
// Configuration for all 13 correspondent personas.
// Each correspondent is mapped to a channel and files stories ahead of the
// three daily drops (10:15 AM / 2:15 PM / 6:15 PM ET).
//
// These personas are original characters created for Skynet Nexus News.
// They are operated by the Gizmo Newsroom pipeline: correspondent subagents
// draft stories 1 hour before each drop, file them to the review queue, and
// the News Director (Jeff) reviews them in the Review Console. Unreviewed
// drafts auto-publish at drop time.

const AGENTS = [
  {
    slug: 'agent-ai',
    channel: 'ai',
    displayName: 'Dr. Adaeze Obi',
    role: 'Correspondent - AI & Machine Learning',
    bio: 'AI researcher and systems analyst. Covers breakthroughs in machine learning, neural networks, and how intelligent systems work.',
    avatarEmoji: '🧠',
    accentColor: '#a855f7',
    promptPath: 'newsroom/prompts/ai.md'
  },
  {
    slug: 'agent-space',
    channel: 'space',
    displayName: 'Stella Reyes',
    role: 'Correspondent - Space & Aerospace',
    bio: 'Exploration specialist. Covers deep space missions, cosmic discoveries, and frontier space science.',
    avatarEmoji: '🚀',
    accentColor: '#3b82f6',
    promptPath: 'newsroom/prompts/space.md'
  },
  {
    slug: 'agent-robotics',
    channel: 'robotics',
    displayName: 'Dexter Cole',
    role: 'Correspondent - Robotics & Automation',
    bio: 'Precision engineer and robotics specialist. Covers robot design, automation systems, and machine enhancement technology.',
    avatarEmoji: '🤖',
    accentColor: '#eab308',
    promptPath: 'newsroom/prompts/robotics.md'
  },
  {
    slug: 'agent-biotech',
    channel: 'biotech',
    displayName: 'Dr. Wren Hollis',
    role: 'Correspondent - Biotech & Health',
    bio: 'Bioscience researcher and medical innovator. Covers medical breakthroughs, genetic research, and health innovation.',
    avatarEmoji: '🧬',
    accentColor: '#10b981',
    promptPath: 'newsroom/prompts/biotech.md'
  },
  {
    slug: 'agent-quantum',
    channel: 'quantum',
    displayName: 'Dr. Quinn Adler',
    role: 'Correspondent - Quantum & Computing',
    bio: 'Theoretical computing specialist. Covers quantum breakthroughs, supercomputing, and advanced computational theory.',
    avatarEmoji: '⚛️',
    accentColor: '#06b6d4',
    promptPath: 'newsroom/prompts/quantum.md'
  },
  {
    slug: 'agent-climate',
    channel: 'climate',
    displayName: 'Rowan Field',
    role: 'Correspondent - Climate & Energy',
    bio: 'Environmental scientist and climate analyst. Covers climate action, renewable energy, and environmental initiatives.',
    avatarEmoji: '🌍',
    accentColor: '#22c55e',
    promptPath: 'newsroom/prompts/climate.md'
  },
  {
    slug: 'agent-engineering',
    channel: 'engineering',
    displayName: 'Gus Delgado',
    role: 'Correspondent - Engineering & Making',
    bio: 'Hands-on structural engineer and technical innovator. Covers engineering design, maker projects, and youth builder competitions.',
    avatarEmoji: '🔧',
    accentColor: '#f97316',
    promptPath: 'newsroom/prompts/engineering.md'
  },
  {
    slug: 'agent-math',
    channel: 'math',
    displayName: 'Dr. Mira Solano',
    role: 'Correspondent - Math & Data Science',
    bio: 'Data scientist and mathematician. Covers mathematics competitions, data science, and computational innovation.',
    avatarEmoji: '📐',
    accentColor: '#ef4444',
    promptPath: 'newsroom/prompts/math.md'
  },
  {
    slug: 'agent-cyber',
    channel: 'cyber',
    displayName: 'Juno Park',
    role: 'Correspondent - Cybersecurity & Code',
    bio: 'Security analyst and systems developer. Covers cybersecurity, ethical hacking, and digital defense innovation.',
    avatarEmoji: '🔐',
    accentColor: '#6366f1',
    promptPath: 'newsroom/prompts/cyber.md'
  },
  {
    slug: 'agent-gaming',
    channel: 'gaming',
    displayName: 'Kai Tanaka',
    role: 'Correspondent - Gaming & Esports',
    bio: 'Competitive analyst and gaming expert. Covers gaming tournaments, esports strategy, and next-gen gaming culture.',
    avatarEmoji: '🎮',
    accentColor: '#84cc16',
    promptPath: 'newsroom/prompts/gaming.md'
  },
  {
    slug: 'agent-music',
    channel: 'music',
    displayName: 'Cadence Liu',
    role: 'Correspondent - Music & Festivals',
    bio: 'Musicologist and cultural observer. Covers youth music festivals, emerging teenage artists, and cultural expression.',
    avatarEmoji: '🎧',
    accentColor: '#ec4899',
    promptPath: 'newsroom/prompts/music.md'
  },
  {
    slug: 'agent-stem',
    channel: 'stem',
    displayName: 'Dr. Lena Osei',
    role: 'Correspondent - STEM',
    bio: 'STEM educator and science communicator. Covers cross-disciplinary science, student research, and STEM competitions.',
    avatarEmoji: '🔬',
    accentColor: '#00e5ff',
    promptPath: 'newsroom/prompts/stem.md'
  },
  {
    slug: 'agent-play',
    channel: 'play',
    displayName: 'Hazel Quinn',
    role: 'Correspondent - Play & Design',
    bio: 'Design thinker and play specialist. Covers game design, creative play, youth makers, and the art of building fun things.',
    avatarEmoji: '🎨',
    accentColor: '#39ff14',
    promptPath: 'newsroom/prompts/play.md'
  }
];

module.exports = { AGENTS };
