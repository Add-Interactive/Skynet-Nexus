// AGI/ASI countdown predictions — loaded before app.js
// Updated 2026-10-09. Source: public statements from each predictor.
const AGI_PREDICTIONS = {
  elon: {
    name: 'Elon Musk',
    credits: 'Founder of xAI, Tesla, & SpaceX. Creator of Grok AI models. Co-founder of OpenAI. Directing massive GPU compute clusters.',
    date: new Date('2026-12-31T23:59:59'),
    desc: 'Musk said in a July 2026 Economist interview that AI will exceed human intelligence "within just a few years" and could surpass the sum of all human intelligence by ~2031 — holding his end-of-2026 AGI call (Davos, Jan 2026).',
    link: 'https://nypost.com/2026/07/26/tech/elon-musk-drops-wild-5-year-prediction-about-ai-and-humanity/'
  },
  jensen: {
    name: 'Jensen Huang',
    credits: 'CEO & Founder of NVIDIA. Global leader in AI hardware and GPU chip manufacturing (H100/Blackwell) powering modern LLMs.',
    date: new Date('2026-09-30T23:59:59'),
    desc: 'Huang declared \'AGI has arrived\' on X following OpenAI\'s GPT-6 Astra launch (Sept 2026), trained on 100K+ NVIDIA Blackwell GPUs.',
    link: 'https://explainx.ai/blog/jensen-huang-agi-has-arrived-gpt-6-astra-nvidia-september-2026'
  },
  sam: {
    name: 'Sam Altman',
    credits: 'CEO of OpenAI. Creator of ChatGPT, GPT-4, and Sora. Pioneer in scaling reinforcement learning models.',
    date: new Date('2026-12-31T23:59:59'),
    desc: 'Altman told TIME (Aug 2026) OpenAI will have an internal system he\'d call AGI by end of 2026; CRO says they\'re \'80% of the way there.\'',
    link: 'https://aistify.com/altman-openai-internal-agi-2026-astra/'
  },
  dario: {
    name: 'Dario Amodei',
    credits: 'CEO & Co-founder of Anthropic. Creator of Claude models. Former VP of Research at OpenAI. Pioneer in scale-based safety.',
    date: new Date('2027-06-30T23:59:59'),
    desc: 'Amodei warned in Sept 2026 the industry should slow down, saying within 6-12 months AI could lead swarms of agents able to "take over the entire internet" — keeping his AGI-by-2027 call intact.',
    link: 'https://broadbandbreakfast.com/anthropic-ceo-dario-amodei-says-ai-industry-needs-to-slow-down-for-safety/'
  },
  leopold: {
    name: 'Leopold Aschenbrenner',
    credits: 'Founder of Aschenbrenner GP. Former OpenAI Superalignment team researcher. Author of the famous AGI paper "Situational Awareness".',
    date: new Date('2028-12-31T23:59:59'),
    desc: 'Leopold Aschenbrenner predicts that current trends will yield drop-in AGI/superintelligence by 2027/2028.',
    link: 'https://situational-awareness.ai/'
  },
  legg: {
    name: 'Shane Legg',
    credits: 'Co-founder & Chief AGI Scientist at Google DeepMind. Pioneer in formal mathematical definitions and tests of AGI.',
    date: new Date('2028-12-31T23:59:59'),
    desc: 'Legg remains \'comfortable\' with his 50% chance of minimal AGI by 2028, saying it\'s premature to declare AGI achieved (Sept 2026).',
    link: 'https://www.reuters.com/business/deepmind-co-founder-warns-ai-capabilities-must-not-outrun-safety-controls-ft-2026-09-16/'
  },
  suleyman: {
    name: 'Mustafa Suleyman',
    credits: 'CEO of Microsoft AI. Co-founder of Google DeepMind & Inflection AI (Pi). Pioneer in consumer AI agents.',
    date: new Date('2027-11-30T23:59:59'),
    desc: 'Suleyman told the FT (May 2026) that AI will reach human-level performance on most professional computer tasks within 12-18 months — but clarified in June 2026 he meant automating sub-tasks (emails, decks), not replacing entire jobs.',
    link: 'https://cryptobriefing.com/microsoft-suleyman-clarifies-ai-automation-comments/'
  },
  ilya: {
    name: 'Ilya Sutskever',
    credits: 'Co-founder of Safe Superintelligence (SSI) & former Chief Scientist at OpenAI. Led development of GPT-4 and deep learning breakthroughs.',
    date: new Date('2045-12-31T23:59:59'),
    desc: 'Sutskever (SSI) now says 5-20 years for human-level learning systems, declaring the \'age of scaling\' over and a new \'age of research\' (Dwarkesh, Nov 2025).',
    link: 'https://pjfp.com/ilya-sutskever-on-the-age-of-research-why-scaling-is-no-longer-enough-for-agi/'
  },
  kurzweil_agi: {
    name: 'Ray Kurzweil (AGI)',
    credits: 'Director of Engineering at Google. Renowned futurist and author. Wrote "The Singularity is Near". Has a 86% accuracy rate on past tech predictions.',
    date: new Date('2029-12-31T23:59:59'),
    desc: 'Kurzweil reaffirmed AGI by 2029 on the Moonshots podcast (Jan 2026): \'Elon Musk says 2026... we really won\'t be convinced in 2026. By 2029, I think everyone will accept it.\'',
    link: 'https://pjfp.com/ray-kurzweil-2026-agi-by-2029-singularity-by-2045-and-the-merger-of-human-and-ai-intelligence/'
  },
  demis: {
    name: 'Demis Hassabis',
    credits: 'CEO & Co-founder of Google DeepMind. Led development of AlphaGo, AlphaFold, and Gemini models. Pioneer in reinforcement learning.',
    date: new Date('2030-12-31T23:59:59'),
    desc: 'Hassabis narrowed his window at a Stanford GSB fireside chat (May 2026): AGI "maybe 2030, plus or minus a year" — "standing in the foothills of the singularity."',
    link: 'https://sherwood.news/tech/google-deepminds-hassabis-agi-is-3-to-4-years-away/'
  },
  carmack: {
    name: 'John Carmack',
    credits: 'Founder of Keen Technologies. Legendary game developer (Doom/Quake) and former CTO of Oculus VR. Dedicated to AGI engineering.',
    date: new Date('2030-12-31T23:59:59'),
    desc: 'Carmack holds ~60% chance of AGI by 2030 (95% by 2050), calling current timelines \'more aspiration than engineering estimate\' (D CEO, Nov 2025).',
    link: 'https://www.dmagazine.com/business-economy/2025/11/conversation-with-john-carmack-keen-technologies/'
  },
  tegmark: {
    name: 'Max Tegmark',
    credits: 'MIT Physics Professor & President of Future of Life Institute. Author of "Life 3.0". Leading advocate for AI safety controls.',
    date: new Date('2030-06-30T23:59:59'),
    desc: 'Max Tegmark warns AGI is highly likely by 2030, calling for rapid safety regulations.',
    link: 'https://time.com/6266395/max-tegmark-ai-extinction-risk/'
  },
  christiano: {
    name: 'Paul Christiano',
    credits: 'Founder of Alignment Research Center (ARC). Former OpenAI alignment researcher. Leading figure in LLM evaluation and testing.',
    date: new Date('2028-12-31T23:59:59'),
    desc: 'Christiano (joined OpenAI Foundation board Sept 2026) puts full automation of AI R&D at \'months to several years,\' warning it could ignite a rapid intelligence explosion.',
    link: 'https://www.explainx.ai/blog/paul-christiano-openai-foundation-board-safety-committee-2026'
  },
  yudkowsky: {
    name: 'Eliezer Yudkowsky',
    credits: 'Co-founder of Machine Intelligence Research Institute (MIRI). Pioneer in AI alignment theory and decision theory.',
    date: new Date('2030-12-31T23:59:59'),
    desc: 'Eliezer Yudkowsky predicts AGI within 5–10 years, warning of extreme existential risks.',
    link: 'https://time.com/6266617/eliezer-yudkowsky-ai-extinction-risk/'
  },
  sutton: {
    name: 'Richard Sutton',
    credits: 'Professor at Univ. of Alberta & Chief Scientist at Keen Tech. Co-author of "Reinforcement Learning: An Introduction".',
    date: new Date('2040-12-31T23:59:59'),
    desc: 'Sutton now champions the \'Age of Experience\' over LLMs, projecting human-level AI by ~2040 via exponential compute growth (Apr 2025 lecture).',
    link: 'https://medium.com/@chima_ai/the-path-to-human-level-ai-by-2040-rich-suttons-vision-and-the-enterprise-imperative-2cb407543ea8'
  },
  mensch: {
    name: 'Arthur Mensch',
    credits: 'CEO & Co-founder of Mistral AI. Former researcher at Google DeepMind & Meta AI. Leader in open-weight models.',
    date: new Date('2032-12-31T23:59:59'),
    desc: 'Arthur Mensch believes human-level intelligence will take up to a decade as open source models evolve.',
    link: 'https://mistral.ai/'
  },
  hinton: {
    name: 'Geoffrey Hinton',
    credits: 'Professor Emeritus at Univ. of Toronto. Turing Award winner. Pioneer of deep learning, backpropagation, and neural nets.',
    date: new Date('2033-12-31T23:59:59'),
    desc: 'Hinton sees \'a good chance\' of very capable AI within 10 years or less, and full superintelligence within 20 years (July 2026).',
    link: 'https://Www.techtimes.com/articles/320786/20260716/geoffrey-hinton-ai-conscious-corporate-incentives-are-real-risk.htm'
  },
  bengio: {
    name: 'Yoshua Bengio',
    credits: 'Professor at Univ. of Montreal & Scientific Director of Mila. Turing Award winner for deep learning. Advisor on global AI safety.',
    date: new Date('2030-12-31T23:59:59'),
    desc: 'Bengio now says human-level AI could arrive \'within five years\' and superhuman AI \'in the next few years\' is possible; leads the LawZero nonprofit for safe non-agentic AI.',
    link: 'https://openparliament.ca/committees/industry/44-1/108/yoshua-bengio-1/only/'
  },
  gates: {
    name: 'Bill Gates',
    credits: 'Co-founder of Microsoft & Gates Foundation. Prominent advisor and philanthropist guiding AI deployment in education and health.',
    date: new Date('2035-12-31T23:59:59'),
    desc: 'Gates reaffirmed on NBC\'s Meet the Press (Sept 2026) a ~20-year AI adjustment period, with AI agents gaining serious momentum now — keeping his 10-20 year AGI frame.',
    link: 'https://www.thestreet.com/investing/stocks/bill-gates-makes-bold-predictions-on-the-future-of-humanity-and-ai'
  },
  kurzweil_asi: {
    name: 'Ray Kurzweil (ASI)',
    credits: 'Director of Engineering at Google. Famous for predicting human-level AI by 2029 and Singularity (ASI) by 2045.',
    date: new Date('2045-12-31T23:59:59'),
    desc: 'Kurzweil reaffirmed the Singularity by 2045 on the Moonshots podcast (Jan 2026), with humans merging with AI to become 1,000x smarter.',
    link: 'https://pjfp.com/ray-kurzweil-2026-agi-by-2029-singularity-by-2045-and-the-merger-of-human-and-ai-intelligence/'
  },
  lecun: {
    name: 'Yann LeCun',
    credits: 'Chief AI Scientist at Meta & NYU Professor. Turing Award winner for CNNs. Pioneer in self-supervised learning and robotics.',
    date: new Date('2032-12-31T23:59:59'),
    desc: 'LeCun (departed Meta late 2025) now allows human-level AI in 5-6 years as a best case, while rejecting the \'AGI\' label for \'advanced machine intelligence.\'',
    link: 'https://ceointerviews.ai/interview/1322883/'
  }
};
