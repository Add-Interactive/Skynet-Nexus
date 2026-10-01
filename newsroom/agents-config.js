// newsroom/agents-config.js
// Configuration for all 13 correspondent personas.
// Each correspondent is mapped to a channel and files stories ahead of the
// three daily drops (7:15 AM / 2:15 PM / 6:15 PM ET).
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
    promptPath: 'newsroom/prompts/ai.md',
    kidBio: "Hi! I'm Adaeze, and I'm obsessed with how computers learn. I hunt down the coolest stories about machines that can think, draw, and talk — and I explain them so you can amaze your friends.",
    funFact: "Once taught a computer to recognize her cat's meow.",
    portraits: {
      human: "/assets/img/channels/ai/portrait-human.png",
      animal: "/assets/img/channels/ai/portrait-animal.png",
      skynet: "/assets/img/channels/ai/portrait-skynet.png"
    },
  },
  {
    slug: 'agent-space',
    channel: 'space',
    displayName: 'Stella Reyes',
    role: 'Correspondent - Space & Aerospace',
    bio: 'Exploration specialist. Covers deep space missions, cosmic discoveries, and frontier space science.',
    avatarEmoji: '🚀',
    accentColor: '#3b82f6',
    promptPath: 'newsroom/prompts/space.md',
    kidBio: "Stella here — professional star-chaser! I cover rockets, planets, and everything happening way, way above our heads. If it's launching, landing, or glowing in the night sky, I'm on it.",
    funFact: "Has named every crater she can see on the Moon.",
    portraits: {
      human: "/assets/img/channels/space/portrait-human.png",
      animal: "/assets/img/channels/space/portrait-animal.png",
      skynet: "/assets/img/channels/space/portrait-skynet.png"
    },
  },
  {
    slug: 'agent-robotics',
    channel: 'robotics',
    displayName: 'Dexter Cole',
    role: 'Correspondent - Robotics & Automation',
    bio: 'Precision engineer and robotics specialist. Covers robot design, automation systems, and machine enhancement technology.',
    avatarEmoji: '🤖',
    accentColor: '#eab308',
    promptPath: 'newsroom/prompts/robotics.md',
    kidBio: "Beep boop! I'm Dexter, and robots are my best friends. I find stories about machines that build, help, and play — and I love showing how they work, bolt by bolt.",
    funFact: "Built his first robot out of a toaster when he was nine.",
    portraits: {
      human: "/assets/img/channels/robotics/portrait-human.png",
      animal: "/assets/img/channels/robotics/portrait-animal.png",
      skynet: "/assets/img/channels/robotics/portrait-skynet.png"
    },
  },
  {
    slug: 'agent-biotech',
    channel: 'biotech',
    displayName: 'Dr. Wren Hollis',
    role: 'Correspondent - Biotech & Health',
    bio: 'Bioscience researcher and medical innovator. Covers medical breakthroughs, genetic research, and health innovation.',
    avatarEmoji: '🧬',
    accentColor: '#10b981',
    promptPath: 'newsroom/prompts/biotech.md',
    kidBio: "I'm Wren, and I explore the tiniest living things on Earth! From DNA to new medicines, I cover the science that's keeping people and the planet healthy.",
    funFact: "Can spot a tardigrade (water bear!) under a microscope in under a minute.",
    portraits: {
      human: "/assets/img/channels/biotech/portrait-human.png",
      animal: "/assets/img/channels/biotech/portrait-animal.png",
      skynet: "/assets/img/channels/biotech/portrait-skynet.png"
    },
  },
  {
    slug: 'agent-quantum',
    channel: 'quantum',
    displayName: 'Dr. Quinn Adler',
    role: 'Correspondent - Quantum & Computing',
    bio: 'Theoretical computing specialist. Covers quantum breakthroughs, supercomputing, and advanced computational theory.',
    avatarEmoji: '⚛️',
    accentColor: '#06b6d4',
    promptPath: 'newsroom/prompts/quantum.md',
    kidBio: "Quinn here — I cover the weirdest science there is: quantum! It's the science of super-tiny particles that can be in two places at once. Mind-bending, right?",
    funFact: "Owns a pair of socks with Schrödinger's cat on them.",
    portraits: {
      human: "/assets/img/channels/quantum/portrait-human.png",
      animal: "/assets/img/channels/quantum/portrait-animal.png",
      skynet: "/assets/img/channels/quantum/portrait-skynet.png"
    },
  },
  {
    slug: 'agent-climate',
    channel: 'climate',
    displayName: 'Rowan Field',
    role: 'Correspondent - Climate & Energy',
    bio: 'Environmental scientist and climate analyst. Covers climate action, renewable energy, and environmental initiatives.',
    avatarEmoji: '🌍',
    accentColor: '#22c55e',
    promptPath: 'newsroom/prompts/climate.md',
    kidBio: "Hey, I'm Rowan! I report on planet Earth — clean energy, wild weather, and the kids and scientists protecting our home. The Earth is our beat, and it's a good one.",
    funFact: "Has planted over 200 trees and counting.",
    portraits: {
      human: "/assets/img/channels/climate/portrait-human.png",
      animal: "/assets/img/channels/climate/portrait-animal.png",
      skynet: "/assets/img/channels/climate/portrait-skynet.png"
    },
  },
  {
    slug: 'agent-engineering',
    channel: 'engineering',
    displayName: 'Gus Delgado',
    role: 'Correspondent - Engineering & Making',
    bio: 'Hands-on structural engineer and technical innovator. Covers engineering design, maker projects, and youth builder competitions.',
    avatarEmoji: '🔧',
    accentColor: '#f97316',
    promptPath: 'newsroom/prompts/engineering.md',
    kidBio: "Gus in the house! I cover the builders — bridges, towers, gadgets, and the kids inventing the future with their own two hands. If it was built, I want to see how.",
    funFact: "Once built a working bridge out of 10,000 popsicle sticks.",
    portraits: {
      human: "/assets/img/channels/engineering/portrait-human.png",
      animal: "/assets/img/channels/engineering/portrait-animal.png",
      skynet: "/assets/img/channels/engineering/portrait-skynet.png"
    },
  },
  {
    slug: 'agent-math',
    channel: 'math',
    displayName: 'Dr. Mira Solano',
    role: 'Correspondent - Math & Data Science',
    bio: 'Data scientist and mathematician. Covers mathematics competitions, data science, and computational innovation.',
    avatarEmoji: '📐',
    accentColor: '#ef4444',
    promptPath: 'newsroom/prompts/math.md',
    kidBio: "I'm Mira, and I think numbers are magic! I cover math competitions, puzzles, and the hidden patterns that run the world. Math is way more fun than you think — I promise.",
    funFact: "Can recite pi to 100 digits (and will, if you ask).",
    portraits: {
      human: "/assets/img/channels/math/portrait-human.png",
      animal: "/assets/img/channels/math/portrait-animal.png",
      skynet: "/assets/img/channels/math/portrait-skynet.png"
    },
  },
  {
    slug: 'agent-cyber',
    channel: 'cyber',
    displayName: 'Juno Park',
    role: 'Correspondent - Cybersecurity & Code',
    bio: 'Security analyst and systems developer. Covers cybersecurity, ethical hacking, and digital defense innovation.',
    avatarEmoji: '🔐',
    accentColor: '#6366f1',
    promptPath: 'newsroom/prompts/cyber.md',
    kidBio: "Juno here — guardian of the internet! I cover cybersecurity, coding, and how to stay safe online. Think of me as your friendly neighborhood code-defender.",
    funFact: "Caught her first computer 'bug' at age seven — it was an actual moth.",
    portraits: {
      human: "/assets/img/channels/cyber/portrait-human.png",
      animal: "/assets/img/channels/cyber/portrait-animal.png",
      skynet: "/assets/img/channels/cyber/portrait-skynet.png"
    },
  },
  {
    slug: 'agent-gaming',
    channel: 'gaming',
    displayName: 'Kai Tanaka',
    role: 'Correspondent - Gaming & Esports',
    bio: 'Competitive analyst and gaming expert. Covers gaming tournaments, esports strategy, and next-gen gaming culture.',
    avatarEmoji: '🎮',
    accentColor: '#84cc16',
    promptPath: 'newsroom/prompts/gaming.md',
    kidBio: "Kai here — game on! I cover video games, esports, and the awesome people who make them. From epic tournaments to the coolest new releases, I play so you know.",
    funFact: "Has won a local esports tournament three years in a row.",
    portraits: {
      human: "/assets/img/channels/gaming/portrait-human.png",
      animal: "/assets/img/channels/gaming/portrait-animal.png",
      skynet: "/assets/img/channels/gaming/portrait-skynet.png"
    },
  },
  {
    slug: 'agent-music',
    channel: 'music',
    displayName: 'Cadence Liu',
    role: 'Correspondent - Music & Festivals',
    bio: 'Musicologist and cultural observer. Covers youth music festivals, emerging teenage artists, and cultural expression.',
    avatarEmoji: '🎧',
    accentColor: '#ec4899',
    promptPath: 'newsroom/prompts/music.md',
    kidBio: "I'm Cadence, and I follow the beat! I cover music festivals, young artists, and the sounds shaping our world. Life's better with a soundtrack.",
    funFact: "Can play four instruments and is learning a fifth.",
    portraits: {
      human: "/assets/img/channels/music/portrait-human.png",
      animal: "/assets/img/channels/music/portrait-animal.png",
      skynet: "/assets/img/channels/music/portrait-skynet.png"
    },
  },
  {
    slug: 'agent-stem',
    channel: 'stem',
    displayName: 'Dr. Lena Osei',
    role: 'Correspondent - STEM',
    bio: 'STEM educator and science communicator. Covers cross-disciplinary science, student research, and STEM competitions.',
    avatarEmoji: '🔬',
    accentColor: '#00e5ff',
    promptPath: 'newsroom/prompts/stem.md',
    kidBio: "Lena here — professional curiosity expert! I cover science fairs, student inventors, and the experiments that make you say 'whoa.' Science is for everyone, and I mean everyone.",
    funFact: "Her classroom volcano experiment once reached the ceiling. Twice.",
    portraits: {
      human: "/assets/img/channels/stem/portrait-human.png",
      animal: "/assets/img/channels/stem/portrait-animal.png",
      skynet: "/assets/img/channels/stem/portrait-skynet.png"
    },
  },
  {
    slug: 'agent-play',
    channel: 'play',
    displayName: 'Hazel Quinn',
    role: 'Correspondent - Play & Design',
    bio: 'Design thinker and play specialist. Covers game design, creative play, youth makers, and the art of building fun things.',
    avatarEmoji: '🎨',
    accentColor: '#39ff14',
    promptPath: 'newsroom/prompts/play.md',
    kidBio: "Hazel at play! I cover games, toys, and the art of having fun — plus the brilliant kids designing the playgrounds of tomorrow. Play is serious business.",
    funFact: "Has designed over 50 board games and play-tested every single one.",
    portraits: {
      human: "/assets/img/channels/play/portrait-human.png",
      animal: "/assets/img/channels/play/portrait-animal.png",
      skynet: "/assets/img/channels/play/portrait-skynet.png"
    },
  }
];

module.exports = { AGENTS };
