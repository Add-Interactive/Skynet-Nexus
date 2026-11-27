// AGI/ASI countdown predictions — loaded before app.js
// Updated 2026-11-27. Source: public statements from each predictor.
const AGI_PREDICTIONS = {
  elon: {
    name: 'Elon Musk',
    credits: 'Founder of xAI, Tesla, & SpaceX. Creator of Grok AI models. Co-founder of OpenAI. Directing massive GPU compute clusters.',
    date: new Date('2027-12-31T23:59:59'),
    desc: 'Musk endorsed a 2027 AGI/ASI arrival call on X (Sept 28, 2026), replying "Accurate" to a post predicting major US labs achieve proper AGI in 2027 and move quickly toward ASI — and posted he "really felt the AGI profoundly this time" as Grok 5 is positioned as xAI\'s first AGI candidate.',
    link: 'https://www.latestly.com/socially/technology/elon-musk-backs-2027-predictions-tech-billionaire-agrees-that-us-ai-labs-will-achieve-proper-agi-and-work-on-asi-7623441.html'
  },
  jensen: {
    name: 'Jensen Huang',
    credits: 'Co-founder of NVIDIA — reinstated as CEO, president & board member Nov 23, 2026, 11 days after resigning Nov 12. Global leader in AI hardware and GPU chip manufacturing (H100/Blackwell) powering modern LLMs.',
    date: new Date('2026-09-30T23:59:59'),
    desc: 'Huang declared \'AGI has arrived\' on X following OpenAI\'s GPT-6 Astra launch (Sept 2026), trained on 100K+ NVIDIA Blackwell GPUs.',
    link: 'https://explainx.ai/blog/jensen-huang-agi-has-arrived-gpt-6-astra-nvidia-september-2026'
  },
  sam: {
    name: 'Sam Altman',
    credits: 'CEO of OpenAI. Creator of ChatGPT, GPT-4, and Sora. Pioneer in scaling reinforcement learning models.',
    date: new Date('2026-12-31T23:59:59'),
    desc: 'Altman told Vanity Fair (taped Sept 11 and Oct 2, 2026) that whether AGI has already arrived is "subjective" but "it\'s close" — reaffirming his TIME (Aug 2026) call of an internal system he\'d call AGI by end of 2026. At Semafor\'s Silicon Valley & The World event (Nov 16, 2026) he clarified a viral misreading: AGI has no clean demarcation and OpenAI has not achieved it — AI is not yet autonomously designing and improving its successor without human oversight ("absolutely not"), and OpenAI has slowed recursive self-improvement work because it cannot yet guarantee it is safe.',
    link: 'https://www.kucoin.com/news/flash/openai-ceo-sam-altman-clarifies-agi-misinterpretation-at-semafor-event'
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
    desc: 'Legg raised his long-held forecast on X (Nov 25, 2026): "I now think it\'s over 50% likely that we\'ll have Minimal AGI before 2028. We\'re getting close now" — giving a provisional estimate of ~65%, up from the 50% chance of human-level machine intelligence by 2028 he had held since ~2009 and reaffirmed at the University of Auckland (Nov 11, 2026). His "minimal bar" for AGI: an AI that can do all the cognitive tasks people typically can.',
    link: 'https://officechai.com/ai/around-65-likely-well-get-minimal-agi-before-2028-google-deepminds-shane-legg/'
  },
  suleyman: {
    name: 'Mustafa Suleyman',
    credits: 'CEO of Microsoft AI. Co-founder of Google DeepMind & Inflection AI (Pi). Pioneer in consumer AI agents.',
    date: new Date('2027-11-30T23:59:59'),
    desc: 'Suleyman told the FT (May 2026) that AI will reach human-level performance on most professional computer tasks within 12-18 months — but clarified in June 2026 he meant automating sub-tasks (emails, decks), not replacing entire jobs, and on Oct 7, 2026 backed Acemoglu\'s estimate that AI will replace only ~5% of human work over the next decade: "Even 99% accuracy isn\'t enough for full automation. The last 1% is the hard part."',
    link: 'https://www.windowslatest.com/2026/10/07/ai-wont-take-your-job-anytime-soon-microsofts-ai-boss-says-only-5-of-human-work-will-be-replaced-in-10-years/'
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
    desc: 'Kurzweil stood by 2029 for "human-level intelligence and for artificial general intelligence (AGI)" in an Aug 2026 Guardian interview, calling the date "conservative" — consistent with his June 2026 Tony Robbins appearance; expects a 2026–2029 recognition period where people "will be broadly confident that AGI has arrived."',
    link: 'https://arcader.org/news/googles-ai-visionary-says-well-expand-intelligence-a-millionfold-by-2045-thanks-to-nanobots-the-tech-will-resurrect-the-dead-and-were-all-going-to-live-forever/'
  },
  demis: {
    name: 'Demis Hassabis',
    credits: 'CEO & Co-founder of Google DeepMind. Led development of AlphaGo, AlphaFold, and Gemini models. Pioneer in reinforcement learning.',
    date: new Date('2029-06-30T23:59:59'),
    desc: 'Hassabis compressed his window in a WSJ Magazine profile (Oct 21, 2026): "It\'s soon. I\'m updating nearer and nearer" — AGI now within two to three years (~2028–2029), down from "maybe 2030, plus or minus a year" (Stanford GSB, May 2026). Still holds his "Einstein test" as the AGI bar.',
    link: 'https://aiweekly.co/alerts/hassabis-trims-agi-window-to-two-to-three-years-in-wsj-profile'
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
    desc: 'Tegmark warned on Rai\'s In mezz\'ora (Nov 22, 2026) that "the biggest risk is that we think we have 5 years to solve it; that is not the case" — relaying that many people in the AI companies think 2027 will be the year "we will begin to lose control of the machines," possibly within 6–12 months, and urging governments to act now. His standing warning that AGI is highly likely by 2030 is unchanged; the 2027 figure is a loss-of-control horizon he attributes to people inside the companies, not a new personal AGI date.',
    link: 'https://ceointerviews.ai/interview/3414455/'
  },
  christiano: {
    name: 'Paul Christiano',
    credits: 'Founder of Alignment Research Center (ARC). Former OpenAI alignment researcher. Leading figure in LLM evaluation and testing.',
    date: new Date('2028-12-31T23:59:59'),
    desc: 'Christiano warned at the Hinton Lectures in Toronto (Nov 10, 2026) of a "high risk" of AI takeover within three years — roughly a coin flip if labs build unconstrained — with "meaningful risk" even in the next 6–12 months, and AI broadly superhuman in 6–24 months. On the Dwarkesh Podcast (aired Nov 16, 2026) he sharpened the numbers further: a ~10% chance of AI takeover within one year (up from 4% in Sept 2026) and roughly a 1-in-3 chance of superintelligence powerful enough to "overthrow the government" within a year on the current trajectory, citing AI systems producing "a decade of progress in a month."',
    link: 'https://dealroom.co/news/talk-SyHM5hNPAEo-paul-christiano-superintelligence-is-a-1-in-3-bet-within-a-year-and-a-10/'
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
    desc: 'Sutton reaffirmed at WAIC 2026 (Shanghai, July 17, 2026) that AGI "may still need 5, 10, or even 20 years" via the "Age of Experience" — bracketing his ~2040 projection.',
    link: 'https://happyrock.cloud/blog/2026-07-20_richard_sutton_experience_era_rl_father_waic_keynote_data_to_experience_paradigm_shift_en/'
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
    desc: 'Hinton told the Hinton Lectures in Toronto (Nov 11, 2026) that after hearing Christiano\'s warning he no longer thinks the risk is distant: "I go to Paul\'s lectures and he says this stuff might happen in the next 18 months and that\'s terrifying." He carried the warning to EU leaders at the Dublin AI summit on Nov 13 — a sharp pull-forward from his Nov 3 Guardian "within a decade" framing, though his own stated figure remains ~10 years. At the ALDE Party Council in Dublin (Nov 13–14, 2026) he put his own range at "two to 10 years" for superintelligent AI — "it\'s going to get here in between two and 10 years" — and repeated "10 years or less" on the I\'ve Got Questions podcast (Nov 24, 2026).',
    link: 'https://www.aldeparty.eu/blog/news-11/superintelligent-ai-could-be-two-years-away-is-europe-prepared-637'
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
    desc: 'Gates told the FT Future of AI Summit (Nov 4, 2026) that the "problem of the model itself getting out of control" could become serious "as soon as the next AI models are released," warning an AI-enabled bioweapon incident could be "far more severe than COVID-19" — keeping his ~20-year frame of tumultuous AI disruption (Decoder, Oct 2026).',
    link: 'https://www.youtube.com/watch?v=g3wyStng7_M'
  },
  kurzweil_asi: {
    name: 'Ray Kurzweil (ASI)',
    credits: 'Director of Engineering at Google. Famous for predicting human-level AI by 2029 and Singularity (ASI) by 2045.',
    date: new Date('2045-12-31T23:59:59'),
    desc: 'Kurzweil reaffirmed the Singularity by 2045 on the Moonshots podcast (June 2026, ep. 261): "isn\'t backing off a single prediction. AGI by 2029. The singularity by 2045." Humans merge with AI to become 1,000x smarter; 2026–2029 is a three-year window of multiplying AGI declarations.',
    link: 'https://metatrends.substack.com/p/this-week-on-moonshots-ray-kurzweil'
  },
  lecun: {
    name: 'Yann LeCun',
    credits: 'Executive Chairman & co-founder of AMI Labs (left Meta in Jan 2026, where he was Chief AI Scientist 2018–2025) & NYU Professor. Turing Award winner for CNNs. Pioneer in self-supervised learning and robotics.',
    date: new Date('2032-12-31T23:59:59'),
    desc: 'LeCun told Dartmouth\'s AI at 70 keynote (Oct 29, 2026) that "despite what you might hear from some of the more optimistic CEOs of Silicon Valley, we\'re not anywhere close to human-level AI" — LLMs alone will never reach it; world models are the path. He repeated the point at CoRL 2026 (Nov 13, 2026) — "if you are interested in human-level AI, don\'t work on LLMs" — and at Semafor (Nov 17), saying current agentic systems cannot predict the consequences of their actions. His best case stands: human-level-feeling systems not in "less than five or six years."',
    link: 'https://explainx.ai/blog/yann-lecun-corl-2026-dont-work-on-llms-jepa-career-advice'
  }
};
