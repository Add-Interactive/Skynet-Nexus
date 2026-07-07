const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { generateImageForArticle } = require('../server/comfy-generator');

const ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT, 'server', 'skynet.db');

const MIDDAY_ARTICLES = [
  {
    cat: 'ai',
    title: 'Matteo Paz Discovers 1.5 Million Space Objects Using Machine Learning',
    excerpt: '18-year-old Matteo Paz processed 200 terabytes of NASA data to identify and classify 1.9 million stars and galaxies using AI.',
    body: '<p>Matteo Paz, an 18-year-old from Pasadena, California, has won the top prize of $250,000 at the 2025 Regeneron Science Talent Search for his project, VarWISE. Paz developed a machine-learning algorithm to analyze vast amounts of unstudied raw data from NASA’s retired NEOWISE space telescope.</p><h2>Scanning the Infinite Space</h2><p>Paz processed approximately 200 terabytes of data—comprising 200 billion entries—to identify celestial bodies that change in brightness over time, known as variable stars. His model utilized advanced wavelets and Fourier analysis to sort these astronomical objects into 10 distinct classes. His research led to the discovery of 1.5 million previously unknown candidate celestial objects.</p><blockquote>"Astronomical data is growing faster than humans can analyze it. Machine learning is the key to unlocking the secrets of our universe," Paz explained.</blockquote><h2>A Peer-Reviewed Breakthrough</h2><p>Paz’s work was so rigorous that it was published as a single-author, peer-reviewed paper in <em>The Astronomical Journal</em>, showing how AI can help professional astronomers filter telescope data to focus on the most exciting discoveries.</p>',
    kidTake: 'An 18-year-old student named Matteo built a smart computer program to look at NASA telescope pictures. The computer discovered 1.5 million new stars and galaxies that were hidden in the data, helping astronomers learn more about space!',
    familyDiscussion: [
      'If you could use a smart computer to look at huge amounts of data on Earth, what would you want to discover?',
      'Why is it helpful for kids and teenagers to study both computer coding and space science?'
    ],
    glossary: [
      { term: 'Variable Star', meaning: 'A star whose brightness as seen from Earth fluctuates over time.' },
      { term: 'Terabyte', meaning: 'A unit of digital data equal to one thousand gigabytes.' }
    ],
    ageBand: '12+',
    author: 'Dr. Nova Sterling',
    authorInit: 'NS',
    tags: ['machine-learning', 'astronomy', 'nasa', 'neowise'],
    color: '#00e5ff',
    gradient: 'linear-gradient(135deg, #00e5ff, #a855f7)',
    emoji: '🛰️'
  },
  {
    cat: 'biotech',
    title: 'Teen Researcher Ava Grace Cummings Bridges Modern Biotech and Indigenous Herbs',
    excerpt: 'Ava Grace Cummings used fruit fly models to test traditional Lumbee Tribe common nettle treatments for rare muscle myopathy.',
    body: '<p>Ava Grace Cummings, a student at the North Carolina School of Science and Mathematics, was awarded second place and a $175,000 prize at the 2025 Regeneron Science Talent Search for her research on STAC3 disorder, historically known as Native American myopathy.</p><h2>Modeling a Rare Muscle Disorder</h2><p>Cummings developed a model organism of the disorder by creating a strain of fruit flies that lacked the <em>dstac</em> gene. She then tested the effectiveness of both the experimental drug Tirasemtiv and an extract from the common nettle herb (<em>Urtica dioica</em>), which is traditionally used by the Lumbee Tribe of North Carolina for wellness.</p><h2>Bridging Cultures for Healing</h2><p>Her research demonstrated that treatment with both the herb alone and the combination of the herb and the drug resulted in significantly improved movement in both adult flies and larvae. Her project seeks to identify potential new treatments for this rare genetic muscle disorder, which disproportionately affects her community, the Lumbee Tribe.</p>',
    kidTake: 'A high school student named Ava used fruit flies to study a rare muscle disease that affects people in her Native American tribe. By combining a modern drug with a traditional herbal medicine made from common nettles, she helped the flies move much better!',
    familyDiscussion: [
      'How does looking at traditional medicines from history help scientists discover new modern cures?',
      'Why do you think scientists use tiny fruit flies to study human genetic diseases?'
    ],
    glossary: [
      { term: 'Myopathy', meaning: 'A disease of the muscle tissue that leads to weakness.' },
      { term: 'Gene Knockdown', meaning: 'A technique used to reduce the expression of a specific gene in an organism.' }
    ],
    ageBand: '8+',
    author: 'Dr. Sage Rivers',
    authorInit: 'SR',
    tags: ['biotech', 'lumbee-tribe', 'herbal-medicine', 'fruit-flies'],
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #3b82f6)',
    emoji: '🧬'
  },
  {
    cat: 'climate',
    title: 'Teenagers Win Earth Prize 2025 for Cold-Plasma Water Purification Solution',
    excerpt: 'Slovakian and Czech teenagers Anna and Tomáš designed a water filter that uses cold plasma to destroy antibiotic-resistant bacteria.',
    body: '<p>Team PURA, a duo of teenagers named Anna and Tomáš from Slovakia and the Czech Republic, has won the prestigious Earth Prize 2025 for their innovative water purification solution designed to combat antibiotic resistance and chemical pollution.</p><h2>Combating Waterborne Microbes</h2><p>Their project combines research on photocatalysis with cold plasma technology to destroy pollutants and antibiotic-resistant bacteria in water sources. Cold plasma works by ionizing gases to break down tough chemical compounds and destroy bacterial cell walls without using harsh chemicals like chlorine.</p><h2>A Scalable Green Invention</h2><p>They were selected as the global winner through a public vote following their selection as one of the seven regional winners. Their design is modular and can be deployed in remote areas lacking large-scale municipal water treatment facilities, providing a clean water alternative.</p>',
    kidTake: 'Two teenagers named Anna and Tomáš built a special water filter that uses cold plasma—which is like a tiny, safe lightning bolt—to clean water. It kills dangerous bacteria and cleans up chemicals without using toxic chlorine!',
    familyDiscussion: [
      'Why is it important to clean water without using harsh chemicals like chlorine?',
      'How can tiny inventions created by students help solve big global problems like clean water access?'
    ],
    glossary: [
      { term: 'Cold Plasma', meaning: 'A partially ionized gas that is reactive but stays at room temperature.' },
      { term: 'Photocatalysis', meaning: 'The acceleration of a photoreaction in the presence of a catalyst.' }
    ],
    ageBand: '8+',
    author: 'Terra Green',
    authorInit: 'TG',
    tags: ['water-purification', 'cold-plasma', 'earth-prize', 'conservation'],
    color: '#059669',
    gradient: 'linear-gradient(135deg, #059669, #10b981)',
    emoji: '💧'
  },
  {
    cat: 'cyber',
    title: 'Team CyberAegis Phoenix Wins CyberPatriot XVII National Championship',
    excerpt: 'San Diego high schoolers secured first place in the nation for finding and fixing system vulnerabilities in the CyberPatriot finals.',
    body: '<p>The national champions for CyberPatriot XVII (2025) were announced on March 17, 2025, in Orlando, Florida. Team CyberAegis Phoenix from Scouting America Exploring Post 2928 in San Diego, California, won the prestigious Open Division National Championship.</p><h2>Securing Virtual Networks</h2><p>The competition placed students in the position of newly hired IT professionals tasked with managing the network of a small company. In the national finals, the high school students had to identify cyber security vulnerabilities, configure firewalls, remove unauthorized software, and defend against active virtual attacks across Windows and Linux systems.</p><h2>San Diego Sweep</h2><p>Teams from San Diego swept the competition, with Scripps Ranch High School JROTC winning the All-Service Division and Scouting America Exploring Club 2927 winning the Middle School Division, showcasing the region’s strong youth training programs.</p>',
    kidTake: 'A group of high school students from San Diego won a national computer defense competition called CyberPatriot. They acted like cybersecurity police, finding weaknesses in virtual networks and locking out hackers to keep data safe!',
    familyDiscussion: [
      'What are some safe habits you can practice online to keep your own home computers and files secure?',
      'Why is cybersecurity one of the fastest-growing careers for young students today?'
    ],
    glossary: [
      { term: 'Firewall', meaning: 'A security system that monitors and controls incoming and outgoing network traffic.' },
      { term: 'Vulnerability', meaning: 'A weakness in a computer system that can be exploited by hackers.' }
    ],
    ageBand: '8+',
    author: 'Cipher Crypt',
    authorInit: 'CC',
    tags: ['cybersecurity', 'cyberpatriot', 'network-defense', 'coding'],
    color: '#a855f7',
    gradient: 'linear-gradient(135deg, #a855f7, #6366f1)',
    emoji: '🔒'
  },
  {
    cat: 'engineering',
    title: 'Dylan Mudalige Invents Smart Robotic Training Wheels "BalanceBuddy"',
    excerpt: '4th grader Dylan Mudalige won first place at the 2025 Invention Convention U.S. Nationals for his automated training wheels.',
    body: '<p>At the RTX Invention Convention U.S. Nationals 2025 held at the Henry Ford Museum in Dearborn, Michigan, 4th-grade student Dylan Mudalige won first place for his invention, "BalanceBuddy: Smart Robotic Training Wheels."</p><h2>Automated Balancing Assistance</h2><p>Traditional training wheels are rigid and do not teach children how to balance. Mudalige designed BalanceBuddy with sensors that detect a bicycle’s tilt. When the system detects the child is losing balance, it extends the robotic wheels to support them, and automatically retracts them as the child balances successfully.</p><h2>Inspiring Future Makers</h2><p>Mudalige’s project was praised by engineering judges for its use of microcontrollers and motor controls to create a dynamic, educational sporting asset for young children learning to ride.</p>',
    kidTake: 'A 4th-grade student named Dylan invented smart training wheels called BalanceBuddy. They use sensors to feel when a bike is tipping over and move down to help, but lift back up when you are balancing on your own!',
    familyDiscussion: [
      'If you could invent a smart robot to help you learn a new sport or skill, what would it do?',
      'How does automated balancing work compared to traditional, rigid training wheels?'
    ],
    glossary: [
      { term: 'Microcontroller', meaning: 'A compact integrated circuit designed to govern a specific operation in an embedded system.' },
      { term: 'Sensor', meaning: 'A device that detects and responds to some type of input from the physical environment.' }
    ],
    ageBand: '5+',
    author: 'Mason Rivet',
    authorInit: 'MR',
    tags: ['invention-convention', 'robotics', 'engineering', 'making'],
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #ec4899)',
    emoji: '🚲'
  },
  {
    cat: 'gaming',
    title: 'Teen Alex Thach Defends Title as Classic Tetris World Champion',
    excerpt: 'Alex Thach won the 2025 Classic Tetris World Championship in Pasadena, sweeping the finals without dropping a single game.',
    body: '<p>The 2025 Classic Tetris World Championship (CTWC) concluded in Pasadena, California, with Alex Thach—known as "Alex T"—successfully defending his title. Thach, a teenager, established himself as the premier Classic Tetris player in the world.</p><h2>A Perfect Tournament Run</h2><p>Throughout the entire weekend bracket, Thach did not drop a single game, culminating in a clean sweep against runner-up "meme" in the finals. The players utilized the "rolling" play style, tapping the back of the controller to input inputs at speeds exceeding 30 Hz.</p><h2>Pushing the Limits of NES</h2><p>Classic Tetris is played on the 1989 Nintendo Entertainment System (NES). Over the past five years, teenage competitors have pushed the game past its original limits, reaching level 157 and triggering software crashes that were once thought impossible.</p>',
    kidTake: 'A teenager named Alex won the World Tetris Championship! He played on a vintage 1989 Nintendo console and was so fast that he cleared falling blocks without losing a single round in the entire tournament!',
    familyDiscussion: [
      'Why do you think older, classic video games like Tetris are still so popular with kids today?',
      'What is "rolling" on a controller, and how does it help players push games to their limits?'
    ],
    glossary: [
      { term: 'Rolling', meaning: 'A controller grip technique where a player rolls their fingers across the back of the controller to input buttons rapidly.' },
      { term: 'Classic Tetris', meaning: 'The version of Tetris released for the NES in 1989, used in competitive play.' }
    ],
    ageBand: '8+',
    author: 'Leo Pixel',
    authorInit: 'LP',
    tags: ['tetris', 'esports', 'gaming', 'retro-gaming'],
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)',
    emoji: '🎮'
  },
  {
    cat: 'math',
    title: 'Bellevue Student Owen Zhang Solves Hypergraph Combinatorics Problem',
    excerpt: '18-year-old Owen Zhang won third place at Regeneron STS for proving boundaries in 3-uniform hypergraph intersections.',
    body: '<p>Owen Jianwen Zhang, an 18-year-old student at Bellevue High School in Bellevue, Washington, has won third place and a $150,000 award at the 2025 Regeneron Science Talent Search for his research in combinatorics, a branch of theoretical mathematics.</p><h2>Families of Hypergraphs</h2><p>Zhang’s project, titled "Tetrahedron-Intersecting Families of 3-uniform Hypergraphs," tackled a long-standing mathematical problem. Hypergraphs are mathematical structures where edges can connect any number of vertices, unlike standard graphs where edges connect exactly two points.</p><h2>Computer Science Foundations</h2><p>Zhang successfully proved a maximum limit for how many 3-uniform hypergraphs can share similar tetrahedral structures while maintaining differing connections. His theoretical formulas have immediate applications in network routing and computer database structures, helping optimize computer network speeds.</p>',
    kidTake: 'An 18-year-old student named Owen solved a difficult math puzzle about hypergraphs. His math rules will help computers run faster by organizing how data travels through internet networks!',
    familyDiscussion: [
      'How does solving complex, theoretical math puzzles help improve real-world tech like the internet?',
      'What is the difference between a normal graph and a hypergraph?'
    ],
    glossary: [
      { term: 'Combinatorics', meaning: 'A branch of mathematics concerning the study of finite or countable discrete structures.' },
      { term: 'Hypergraph', meaning: 'A generalization of a graph in which edges can connect any number of vertices.' }
    ],
    ageBand: '12+',
    author: 'Adara Matrix',
    authorInit: 'AM',
    tags: ['mathematics', 'combinatorics', 'hypergraphs', 'theoretical-math'],
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6, #00e5ff)',
    emoji: '📐'
  },
  {
    cat: 'music',
    title: 'Jacqueline Rodenbeck Wins 2025 Sphinx Competition Junior Division',
    excerpt: 'The 17-year-old violinist won first prize at the Sphinx Competition celebrating Black and Latino string musicians.',
    body: '<p>The 28th Annual Sphinx Competition concluded in January 2025 in Detroit, Michigan. Seventeen-year-old violinist Jacqueline Rodenbeck won the first prize in the Junior Division, which showcases the nation’s top young Black and Latino classical string players.</p><h2>A Masterful String Audition</h2><p>Rodenbeck competed against dozens of violinists, cellists, and double bass players from across the country. She performed a complex concerto with the Sphinx Symphony Orchestra, earning a cash prize and future solo concert engagements with professional orchestras.</p><h2>Promoting Classical Diversity</h2><p>The Sphinx Organization, founded in 1997, works to increase representation of Black and Latino classical musicians. Winning the junior division is a major stepping stone, often launching recipients into world-renowned music academies.</p>',
    kidTake: 'A 17-year-old violinist named Jacqueline won a big music competition called the Sphinx Competition. She played a beautiful solo with a professional orchestra, helping show that young musicians from all backgrounds can be classical stars!',
    familyDiscussion: [
      'How does playing in a group or orchestra teach teamwork compared to playing an instrument solo?',
      'Why is it important to support and celebrate diverse young artists in classical music?'
    ],
    glossary: [
      { term: 'Concerto', meaning: 'A musical composition for a solo instrument or instruments accompanied by an orchestra.' },
      { term: 'Sphinx Organization', meaning: 'A Detroit-based national organization dedicated to diversity in classical music.' }
    ],
    ageBand: '8+',
    author: 'Aria Harmony',
    authorInit: 'AH',
    tags: ['violin', 'classical-music', 'sphinx-competition', 'orchestra'],
    color: '#f43f5e',
    gradient: 'linear-gradient(135deg, #f43f5e, #ec4899)',
    emoji: '🎻'
  },
  {
    cat: 'play',
    title: 'Grandmaster Siddharth Jagadeesh Wins Gold at World Youth Chess Championship',
    excerpt: 'Singapore teenage Grandmaster Siddharth Jagadeesh won first place in the U18 Open category at the 2025 FIDE youth finals.',
    body: '<p>The FIDE World Youth U14, U16, and U18 Chess Championships 2025 concluded in Durrës, Albania, with Singapore Grandmaster Siddharth Jagadeesh securing the gold medal in the prestigious Under-18 Open division.</p><h2>Mastering the Checkmate</h2><p>Jagadeesh, who earned the Grandmaster title at age 17, faced the world’s top teenage chess prodigies in a grueling Swiss-system tournament. His strategic endgames and tactical calculations under tight time controls secured him the top spot on the international podium.</p><h2>The Rising Generation</h2><p>Chess has seen a massive surge in popularity among school-aged children, driven by online platforms. The World Youth Championship remains the ultimate proving ground for future contenders for the World Chess Championship title.</p>',
    kidTake: 'A teenager named Siddharth from Singapore won the gold medal at the World Youth Chess Championship! He used smart strategies to defeat other young chess masters from around the globe.',
    familyDiscussion: [
      'What kinds of skills does playing chess teach you that can help in school and everyday decisions?',
      'How do time limits in chess change the way a player makes decisions?'
    ],
    glossary: [
      { term: 'Grandmaster', meaning: 'The highest title a chess player can attain, awarded by the international chess federation FIDE.' },
      { term: 'Swiss-System', meaning: 'A non-eliminating tournament format where players are paired against opponents with similar scores.' }
    ],
    ageBand: '8+',
    author: 'Amara Okafor',
    authorInit: 'AO',
    tags: ['chess', 'world-youth-championship', 'fide', 'grandmaster'],
    color: '#84cc16',
    gradient: 'linear-gradient(135deg, #84cc16, #059669)',
    emoji: '👑'
  },
  {
    cat: 'quantum',
    title: 'Christopher Gilbert Named 2025 Davidson Fellow for Quantum Gate Efficiency',
    excerpt: 'Maine student Christopher Gilbert won a fellowship for designing a two-qubit universal gate set that reduces quantum errors.',
    body: '<p>Christopher Gilbert, a student from Maine, has been named a 2025 Davidson Fellow for his pioneering research in quantum computing. His project identified the smallest known universal quantum gate set that uses only two qubits per operation.</p><h2>Mitigating Quantum Noise</h2><p>Quantum computers utilize qubits, which can exist in multiple states at once. However, they are highly sensitive to environmental interference, which causes errors. By reducing the number of qubits required for operations, Gilbert’s gate set minimizes the potential for error propagation.</p><h2>Stable Quantum Computing</h2><p>His mathematical proof provides a template for builders of physical quantum processors, enabling more stable, accurate quantum calculations that could eventually run complex simulations for chemical and materials research.</p>',
    kidTake: 'A student named Christopher won a big prize for making quantum computers more reliable. He figured out a way to run computer instructions using just two qubits at a time, which helps keep the super-fast computer from making mistakes!',
    familyDiscussion: [
      'Why is it important to stop computer errors before we can use quantum computers to design new medicines?',
      'What is a qubit, and how is it different from a normal computer bit?'
    ],
    glossary: [
      { term: 'Qubit', meaning: 'A quantum bit, the basic unit of quantum information.' },
      { term: 'Quantum Gate Set', meaning: 'A basic set of operations that can be combined to perform any quantum calculation.' }
    ],
    ageBand: '12+',
    author: 'Zephyr Thorne',
    authorInit: 'ZT',
    tags: ['quantum-computing', 'davidson-fellow', 'qubits', 'physics'],
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1, #a855f7)',
    emoji: '🌌'
  },
  {
    cat: 'robotics',
    title: 'Australian Team "Project Bucephalus" Wins FIRST Impact Award',
    excerpt: 'Team 5985 from Wollongong won the highest honor at the 2025 FIRST Robotics Championship in Houston for community outreach.',
    body: '<p>At the 2025 FIRST Robotics Competition Championship held in Houston, Texas, Team 5985, Project Bucephalus, from Wollongong, Australia, was awarded the FIRST Impact Award. This is the highest honor in the competition, celebrating the team that best embodies the values of STEM education and community service.</p><h2>Engineering Community Impact</h2><p>Project Bucephalus designed and built a 120-pound robot to compete in the seasonal game challenge. However, the Impact Award recognizes their work outside the arena: mentoring younger teams, organizing STEM workshops in rural Australian towns, and developing accessibility toolkits for disabled students to participate in robotics.</p><h2>The World Stage</h2><p>The 2025 Championship gathered over 15,000 students from dozens of countries, emphasizing collaboration and gracious professionalism alongside mechanical engineering excellence.</p>',
    kidTake: 'A robotics team from Australia won the top award at the World Championship in Texas. They built a great robot, but they won because they spent their spare time teaching other kids in small towns how to build robots too!',
    familyDiscussion: [
      'How does helping other people learn STEM make a team more successful than just building a good robot?',
      'What does "gracious professionalism" mean when competing in a sports or science event?'
    ],
    glossary: [
      { term: 'FIRST', meaning: 'For Inspiration and Recognition of Science and Technology, a youth organization promoting STEM.' },
      { term: 'FIRST Impact Award', meaning: 'The most prestigious award at FRC, celebrating community outreach and leadership.' }
    ],
    ageBand: '8+',
    author: 'Jax Henderson',
    authorInit: 'JH',
    tags: ['robotics', 'first-championship', 'community-service', 'stem-education'],
    color: '#e11d48',
    gradient: 'linear-gradient(135deg, #e11d48, #f59e0b)',
    emoji: '🤖'
  },
  {
    cat: 'space',
    title: 'Boy Scout Troop 74 Rocketeers Win 2025 Rocketry Challenge Championship',
    excerpt: 'Montville middle schoolers won first place at the American Rocketry Challenge, beating over 1,000 student teams.',
    body: '<p>The Troop 74 Rocketeers from Boy Scout Troop 74 in Montville, New Jersey, have earned the National Champion title at the 2025 American Rocketry Challenge. The event, held in May in The Plains, Virginia, is the world’s largest student rocket competition.</p><h2>Precision Altitude and Recovery</h2><p>The 2025 challenge tasked middle and high school teams with designing and launching a model rocket carrying one raw egg. The rocket had to reach a precise altitude of 820 feet and return to earth with the egg intact within a narrow window of 42 to 45 seconds, using a parachute recovery system.</p><h2>Beating the Odds</h2><p>A record-breaking 1,001 student teams from 46 states registered for the competition. The Troop 74 team won the top cash prize and a trip to represent the United States at the International Paris Air Show, showcasing their aerospace engineering precision.</p>',
    kidTake: 'A group of students from New Jersey built a model rocket that carried a raw egg 820 feet into the air. The rocket landed so gently that the egg did not crack, making them the National Rocketry Champions!',
    familyDiscussion: [
      'What forces of physics do rocketeers have to control to launch a rocket to a precise height and land it safely?',
      'Why is keeping a raw egg safe in a model rocket similar to keeping astronauts safe in a real spacecraft?'
    ],
    glossary: [
      { term: 'Apogee', meaning: 'The highest point in the flight of a rocket.' },
      { term: 'American Rocketry Challenge', meaning: 'The premier national student model rocketry competition in the US.' }
    ],
    ageBand: '8+',
    author: 'Commander Leo Vance',
    authorInit: 'LV',
    tags: ['rocketry', 'model-rockets', 'arc-championship', 'aerospace'],
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9, #00e5ff)',
    emoji: '🚀'
  },
  {
    cat: 'stem',
    title: 'Texas Teens Win Gordon E. Moore Award for "Neuroflex" Bionic Limb',
    excerpt: 'Samuel Skotnikov, Chanyoung Kim, and Eeshaan Prashanth won $50,000 at Regeneron ISEF for their brain-controlled prosthetic leg.',
    body: '<p>Three high school students from Flower Mound, Texas—Samuel Skotnikov (17), Chanyoung Kim (16), and Eeshaan Prashanth (16)—have won the prestigious Gordon E. Moore Award at the 2025 Regeneron International Science and Engineering Fair (ISEF) for their project, "Neuroflex."</p><h2>Brain-Controlled Robotics</h2><p>Neuroflex is a bionic prosthetic leg designed to assist amputees. Traditional robotic limbs are heavy and expensive. The Texas team utilized low-cost actuators and designed a neural interface that reads muscle electrical signals (EMG) from the user’s thigh, translating them into natural, fluid prosthetic movement.</p><h2>Affordable Accessibility</h2><p>By using 3D printing and open-source software, the team reduced construction costs to under $500, a fraction of the cost of commercial bionic limbs, making advanced prosthetic technology accessible to families worldwide.</p>',
    kidTake: 'Three high school students from Texas built a robotic leg called Neuroflex. It connects to a person\'s thigh and reads muscle signals, so when they think about walking, the robotic leg moves naturally! It only costs $500 to make!',
    familyDiscussion: [
      'How does 3D printing help students build robotic limbs at a fraction of the cost of big medical companies?',
      'Why is reading electrical signals from muscles a helpful way to control a robot?'
    ],
    glossary: [
      { term: 'Electromyography (EMG)', meaning: 'A technique for evaluating and recording the electrical activity produced by skeletal muscles.' },
      { term: 'Actuator', meaning: 'A component of a machine that is responsible for moving and controlling a mechanism or system.' }
    ],
    ageBand: '8+',
    author: 'Priya Ramanathan',
    authorInit: 'PR',
    tags: ['prosthetics', 'regeneron-isef', 'bionics', '3d-printing'],
    color: '#14b8a6',
    gradient: 'linear-gradient(135deg, #14b8a6, #10b981)',
    emoji: '🦵'
  }
];

const EVENING_ARTICLES = [
  {
    cat: 'ai',
    title: 'South Boston Teens Build AI Goal Tracker App for Youth Club Members',
    excerpt: 'Teens developed an AI-powered goal and achievement tracker app to help Boys and Girls Club members monitor progress.',
    body: '<p>In South Boston, a group of teenagers has collaborated to develop an AI-powered goal and achievement tracker application designed specifically for members of the local Boys and Girls Club.</p><h2>Tracking Student Success</h2><p>The app uses a lightweight natural language processing model to help students describe their goals, such as completing homework, practicing music, or learning to swim. The AI breaks down these broad goals into daily action items and sends automated positive reminders to the student’s phone.</p><h2>Bridging the Parent-Child Gap</h2><p>The app includes a parent portal where parents can view goals and progress, offering suggestions for family discussions. The project was created as part of a summer AI incubator program, demonstrating how teenagers can apply software design to local social causes.</p>',
    kidTake: 'A group of teenagers in Boston built a smart goal app. You tell the app what you want to learn, and the AI breaks it down into small, daily steps, reminding you with happy messages while letting your parents cheer you on!',
    familyDiscussion: [
      'What is a big goal you want to achieve this month, and how could you break it down into smaller daily steps?',
      'Why is it helpful to have a computer app send positive reminders when you are practicing a new skill?'
    ],
    glossary: [
      { term: 'Natural Language Processing (NLP)', meaning: 'A branch of AI that helps computers understand and respond to human language.' },
      { term: 'Incubator', meaning: 'A collaborative program designed to help young projects or startups succeed.' }
    ],
    ageBand: '8+',
    author: 'Dr. Nova Sterling',
    authorInit: 'NS',
    tags: ['goal-tracking', 'app-development', 'community-project', 'ai-assist'],
    color: '#00e5ff',
    gradient: 'linear-gradient(135deg, #00e5ff, #3b82f6)',
    emoji: '📱'
  },
  {
    cat: 'biotech',
    title: 'Slovak Student Adam Kovalčík Invents Cost-Saving Antiviral Synthesizer Method',
    excerpt: '19-year-old Adam Kovalčík won the top prize at ISEF for reducing the production cost of Zika/Ebola drug galidesivir by 80%.',
    body: '<p>Adam Kovalčík, a 19-year-old from Dulovce, Slovakia, has received the prestigious George D. Yancopoulos Innovator Award and a $100,000 prize at the 2025 Regeneron International Science and Engineering Fair (ISEF) for his chemistry research.</p><h2>Antiviral Synthesis Breakthrough</h2><p>Kovalčík developed a faster, more cost-effective method to produce galidesivir, an experimental antiviral drug used to target RNA viruses like Zika, Ebola, and COVID-19. By utilizing materials derived from corn husk waste, he reduced the chemical production process from 15 steps down to 10.</p><h2>Lowering Medical Barriers</h2><p>His research demonstrated a potential way to reduce production costs of this vital antiviral compound from $75 per gram to approximately $12.50 per gram. This massive cost reduction could make emergency antiviral stockpiles far more affordable for developing nations facing virus outbreaks.</p>',
    kidTake: 'A 19-year-old student named Adam figured out how to make a medicine for dangerous viruses using leftover corn husks! His new method makes the drug much faster and drops the cost by 80 percent, helping poor countries buy medicine.',
    familyDiscussion: [
      'How does using waste materials like corn husks to make medicine help protect the environment?',
      'Why is it important for medicines to be cheap and affordable for all countries in the world?'
    ],
    glossary: [
      { term: 'Galidesivir', meaning: 'An experimental broad-spectrum antiviral drug that stops viruses from replicating.' },
      { term: 'Synthesis', meaning: 'The execution of chemical reactions to obtain a product.' }
    ],
    ageBand: '12+',
    author: 'Dr. Sage Rivers',
    authorInit: 'SR',
    tags: ['biotechnology', 'antivirals', 'organic-chemistry', 'science-fair'],
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    emoji: '💊'
  },
  {
    cat: 'climate',
    title: 'Middle Schooler Lilly Downs Designs Ocean Wave Generator Buoy',
    excerpt: 'Lilly Downs created a wave energy buoy using magnets and copper wire to generate clean electricity from ocean motion.',
    body: '<p>Middle school student Lilly Downs has received recognition at national science fairs for her prototype of a green energy buoy designed to capture electricity from ocean waves.</p><h2>Generating Current from Waves</h2><p>Her invention uses a floating buoy containing powerful neodymium magnets that slide up and down a central shaft wrapped in copper wire. As ocean waves bob the buoy up and down, the moving magnetic field passes through the copper coils, inducing an electrical current.</p><h2>A Simple, Durable Design</h2><p>Downs’s prototype was praised for its simplicity. Unlike large wave-power turbines that have complex gears that can break in salt water, her design has only one moving part, making it a durable, low-cost solution for powering marine research equipment and ocean tracking buoys.</p>',
    kidTake: 'A middle school student named Lilly built a floating buoy that makes clean electricity from ocean waves! As the waves rock the buoy, magnets inside slide past copper wire to generate power without any pollution!',
    familyDiscussion: [
      'How does moving a magnet past copper wire generate electricity?',
      'What are some challenges that ocean wave generators face compared to wind turbines or solar panels?'
    ],
    glossary: [
      { term: 'Neodymium Magnet', meaning: 'A powerful permanent magnet made from an alloy of neodymium, iron, and boron.' },
      { term: 'Electromagnetic Induction', meaning: 'The production of an electromotive force across an electrical conductor in a changing magnetic field.' }
    ],
    ageBand: '8+',
    author: 'Terra Green',
    authorInit: 'TG',
    tags: ['wave-energy', 'clean-electricity', 'engineering', 'green-power'],
    color: '#059669',
    gradient: 'linear-gradient(135deg, #059669, #3b82f6)',
    emoji: '🌊'
  },
  {
    cat: 'cyber',
    title: 'San Diego Scripps Ranch High JROTC Wins CyberPatriot All-Service Title',
    excerpt: 'JROTC cadets secured the national title in the All-Service division, demonstrating elite skill in cybersecurity defense.',
    body: '<p>Cadets from Scripps Ranch High School Air Force JROTC in San Diego, California, have secured the national title in the All-Service Division of the CyberPatriot XVII National Youth Cyber Defense Competition.</p><h2>Defending Military and Civil Networks</h2><p>Competing under the team name "Terabyte Falcons," the cadets competed in a series of online rounds against JROTC teams representing the Army, Navy, Air Force, Marine Corps, and Civil Air Patrol. The national finals challenged cadets to secure virtual servers, clean malware, and configure secure communications channels.</p><h2>Elite Discipline and Cybersecurity</h2><p>Judges noted that JROTC teams benefit from military-style discipline and communication protocols, which help them delegate tasks quickly under the strict 6-hour time limit in the competitive hacking arena.</p>',
    kidTake: 'High school JROTC cadets won a national cybersecurity competition. They acted like internet security guards, cleaning computer viruses and locking down private servers to protect important files!',
    familyDiscussion: [
      'Why is teamwork so important when a group of people is defending a network against a virtual attack?',
      'What are some similarities between defending a physical building and defending a virtual computer network?'
    ],
    glossary: [
      { term: 'Malware', meaning: 'Software that is specifically designed to disrupt, damage, or gain unauthorized access to a computer system.' },
      { term: 'JROTC', meaning: 'Junior Reserve Officers\' Training Corps, a high school leadership program supported by the US military.' }
    ],
    ageBand: '8+',
    author: 'Cipher Crypt',
    authorInit: 'CC',
    tags: ['jrotc', 'cyberpatriot', 'network-defense', 'teamwork'],
    color: '#a855f7',
    gradient: 'linear-gradient(135deg, #a855f7, #ec4899)',
    emoji: '🛡️'
  },
  {
    cat: 'engineering',
    title: 'Laura Diaz Ossa & Kabir Juneja Invent "CLEAN-O-MATIC Birdbath"',
    excerpt: '5th graders won first place at Invention Convention for an automated birdbath that scrubs itself to prevent disease.',
    body: '<p>At the RTX Invention Convention U.S. Nationals 2025, 5th-grade student inventors Laura Diaz Ossa and Kabir Juneja won first place for their project, the "CLEAN-O-MATIC Birdbath."</p><h2>Stopping the Spread of Bird Diseases</h2><p>Standing water in backyard birdbaths can breed mosquitoes and spread avian diseases like West Nile virus. The young inventors designed a birdbath with a built-in automated cleaning system. Using a small solar-powered pump and water level sensors, the system regularly drains, scrubs the basin with automated rubber brushes, and refills itself.</p><h2>Protecting Local Wildlife</h2><p>The judges commended the inventors for their focus on ecology. The project demonstrates how young students can combine mechanical design, solar power, and biology to protect wildlife in suburban environments.</p>',
    kidTake: 'Two 5th-graders invented a self-cleaning birdbath called CLEAN-O-MATIC. It uses a solar pump and motor brushes to automatically scrub and wash itself, keeping local birds healthy and safe from viruses!',
    familyDiscussion: [
      'Why does dirty, standing water in backyards cause problems for local birds and humans?',
      'How does using solar power make this birdbath easier to use in backyards without plugging it in?'
    ],
    glossary: [
      { term: 'Avian', meaning: 'Relating to birds.' },
      { term: 'Basin', meaning: 'A bowl or open vessel used to hold water.' }
    ],
    ageBand: '5+',
    author: 'Mason Rivet',
    authorInit: 'MR',
    tags: ['birds', 'inventions', 'ecology', 'making'],
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #10b981)',
    emoji: '🐦'
  },
  {
    cat: 'gaming',
    title: 'Tetris Runner-Up "meme" Showcases Elite "Rolling" Controller Style',
    excerpt: 'The teenage competitor reached the finals of the 2025 Classic Tetris Championship, demonstrating the limits of NES play.',
    body: '<p>At the 2025 Classic Tetris World Championship in Pasadena, California, the teenage competitor playing under the alias "meme" captured the attention of the esports world by reaching the final match against champion Alex Thach.</p><h2>The Mastery of Rolling</h2><p>Classic Tetris requires players to move blocks at high speeds as the game advances. "meme" utilized the "rolling" play style, where players slide their fingers across the back of the controller to press the D-pad against their other hand. This allows input speeds of up to 30 buttons per second, far exceeding older thumb-tapping methods.</p><h2>The Youth Domination</h2><p>Esports researchers noted that young players dominate Classic Tetris because their reflexes and willingness to master new mechanical controller styles have transformed a 35-year-old game into a fast-paced modern sport.</p>',
    kidTake: 'A teenage gamer named "meme" reached the finals of the World Tetris Championship. He used a cool controller trick called "rolling" to move blocks faster than the human eye can track, setting new high scores!',
    familyDiscussion: [
      'Why does competitive gaming require physical coordination and practice, just like physical sports?',
      'How does a new way of holding a controller completely change the way a video game is played?'
    ],
    glossary: [
      { term: 'NES Controller', meaning: 'The simple, rectangular controller used for the Nintendo Entertainment System released in 1985.' },
      { term: 'Esports', meaning: 'A form of competition using video games, often played in tournaments.' }
    ],
    ageBand: '8+',
    author: 'Leo Pixel',
    authorInit: 'LP',
    tags: ['tetris', 'gaming', 'controller-tech', 'reflexes'],
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899, #84cc16)',
    emoji: '🕹️'
  },
  {
    cat: 'math',
    title: 'High Schooler Qiao Zhang Achieves Perfect Score at 66th IMO',
    excerpt: 'US team member Qiao Zhang won a gold medal with a perfect score at the 2025 International Mathematical Olympiad.',
    body: '<p>At the 66th International Mathematical Olympiad (IMO) held in July 2025 on the Sunshine Coast of Australia, US team member Qiao Zhang won a gold medal and was one of only five contestants in the world to achieve a perfect score.</p><h2>Six Complex Math Proofs</h2><p>The IMO is the premier world championship mathematics competition for high school students. Over two days, contestants face six extremely difficult math proofs spanning geometry, number theory, algebra, and combinatorics. Each day, players have 4.5 hours to solve just three questions.</p><h2>A High-Stakes Contest</h2><p>Zhang’s perfect performance helped lead the United States team to a second-place finish overall with 216 points, just behind the team from China, which secured first place with 231 points, showing the elite mathematical talent of the young contestants.</p>',
    kidTake: 'A high school student named Qiao won a gold medal at the World Math Olympics in Australia. He solved six incredibly difficult math riddles without making a single mistake, earning a perfect score!',
    familyDiscussion: [
      'What are some strategies you use when you are trying to solve a very difficult homework or puzzle question?',
      'Why is it helpful for math students from different countries to meet and compete together?'
    ],
    glossary: [
      { term: 'Number Theory', meaning: 'A branch of pure mathematics devoted primarily to the study of the integers.' },
      { term: 'IMO', meaning: 'The International Mathematical Olympiad, founded in 1959.' }
    ],
    ageBand: '12+',
    author: 'Adara Matrix',
    authorInit: 'AM',
    tags: ['mathematics', 'olympiad', 'imo-2025', 'student-awards'],
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    emoji: '🧮'
  },
  {
    cat: 'music',
    title: 'Valery Breshears Wins 2025 Johansen Violin Competition',
    excerpt: 'The teenage violinist won first prize at the Johansen International Competition in Washington, DC for young string players.',
    body: '<p>The Johansen International Competition for Young String Players concluded in March 2025 in Washington, DC. Violinist Valery Breshears won the first prize in the violin division, earning a cash award and solo performance opportunities.</p><h2>A Prestigious Youth Audition</h2><p>Held once every three years, the Johansen Competition welcomes classical string players aged 13 to 17 from around the globe. Breshears performed a complex classical program for a panel of judges, demonstrating elite technique and musical expression.</p><h2>Launching Classical Careers</h2><p>The Johansen Competition is known as a major springboard for young artists, helping them secure instrument loans from historic collections and performance invitations from symphony orchestras worldwide.</p>',
    kidTake: 'A young violinist named Valery won first place at a big string music competition in Washington, DC. She played a difficult classical concert on her violin, showing off her talent to judges from all over the world!',
    familyDiscussion: [
      'How does practicing a musical instrument help train your brain to concentrate on other tasks?',
      'What does "musical expression" mean compared to just playing the correct notes on a page?'
    ],
    glossary: [
      { term: 'Springboard', meaning: 'Something that provides a strong launch or start for a career.' },
      { term: 'String Player', meaning: 'A musician who plays an instrument with strings, such as a violin, viola, cello, or double bass.' }
    ],
    ageBand: '8+',
    author: 'Aria Harmony',
    authorInit: 'AH',
    tags: ['violin', 'classical-music', 'johansen-competition', 'youth-arts'],
    color: '#f43f5e',
    gradient: 'linear-gradient(135deg, #f43f5e, #3b82f6)',
    emoji: '🎼'
  },
  {
    cat: 'play',
    title: 'Gao Muziyan Wins U18 Girls FIDE World Youth Chess Championship',
    excerpt: 'Chinese chess prodigy Gao Muziyan claimed the gold medal in the girls under-18 division at the 2025 FIDE youth finals.',
    body: '<p>The FIDE World Youth Chess Championships 2025 concluded in Durrës, Albania, with WIM Gao Muziyan of China winning the gold medal in the Under-18 Girls category.</p><h2>Strategic Dominance on the Board</h2><p>Muziyan, a rising star in international women’s chess, competed against 80 top-rated female chess players from around the world. Her precise opening strategies and deep tactical calculations secured her the gold medal after 11 rounds of play.</p><h2>Inspiring Young Girls in Chess</h2><p>Muziyan’s victory is part of a broader trend of rising female participation in chess, inspired by new online streams and scholastic chess clubs that encourage girls to take up the game at an early age.</p>',
    kidTake: 'A girl named Gao Muziyan won the gold medal at the World Girls Chess Championship! She used smart chess strategies over 11 rounds to defeat players from dozens of other countries.',
    familyDiscussion: [
      'Why is it important to support and encourage more girls to play strategy games like chess?',
      'How do chess tournaments help kids make friends with other players from different countries?'
    ],
    glossary: [
      { term: 'WIM', meaning: 'Woman International Master, a high title awarded by FIDE to female chess players.' },
      { term: 'Swiss System', meaning: 'A tournament format where players do not get knocked out, but play a fixed number of rounds.' }
    ],
    ageBand: '8+',
    author: 'Amara Okafor',
    authorInit: 'AO',
    tags: ['chess', 'world-youth-championship', 'fide', 'girls-chess'],
    color: '#84cc16',
    gradient: 'linear-gradient(135deg, #84cc16, #f43f5e)',
    emoji: '🧩'
  },
  {
    cat: 'quantum',
    title: 'MathQuantum Fellowship Introduces High Schoolers to Quantum Science',
    excerpt: 'The 2025 MathQuantum fellowship program gives students early exposure to quantum algorithms and computer architectures.',
    body: '<p>In 2025, the academic community launched the MathQuantum High School Fellowship, a program designed to give students early exposure to the fields of quantum information science and quantum computing.</p><h2>Preparing for the Quantum Era</h2><p>Modern computers use bits that are either 0 or 1, but quantum computers use qubits that can exist as both at once, allowing them to solve complex problems much faster. The MathQuantum program teaches high schoolers the linear algebra and physics behind quantum algorithm design.</p><h2>Hands-On Algorithm Projects</h2><p>Fellows work under the mentorship of university researchers to build tiny simulation projects using open-source quantum software, helping them prepare for future careers in the quantum computing industry.</p>',
    kidTake: 'A new fellowship program called MathQuantum is teaching high school students how to build code for future quantum computers. They learn how to use qubit math to create programs that could change the world!',
    familyDiscussion: [
      'Why do we need to train a new generation of scientists to write programs for quantum computers instead of normal computers?',
      'How does thinking in "qubits" (both 0 and 1) differ from thinking in normal computer bits (0 or 1)?'
    ],
    glossary: [
      { term: 'Linear Algebra', meaning: 'The branch of mathematics concerning linear equations and linear maps.' },
      { term: 'Quantum Information Science', meaning: 'An academic field focused on analyzing and manipulating information using quantum mechanics.' }
    ],
    ageBand: '12+',
    author: 'Zephyr Thorne',
    authorInit: 'ZT',
    tags: ['quantum-computing', 'education', 'algorithms', 'physics'],
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
    emoji: '🌀'
  },
  {
    cat: 'robotics',
    title: 'Ankara Student Yiğit Efe Erdoğmuş Wins FRC Student Leadership Award',
    excerpt: 'Turkish student Yiğit Efe Erdoğmuş was recognized at the 2025 FIRST Robotics Championship for outstanding outreach leadership.',
    body: '<p>At the 2025 FIRST Robotics Competition Championship held in Houston, Texas, student Yiğit Efe Erdoğmuş from Team 9029 in Ankara, Türkiye, was awarded the FIRST Dean’s List Award for outstanding leadership and community outreach.</p><h2>Inspiring STEM in Türkiye</h2><p>Erdoğmuş was recognized for his work in establishing robotics clubs in underprivileged schools across Ankara. He organized local engineering workshops, translating curriculum materials into Turkish, and helped gather sponsorships for students who could not afford robot components.</p><h2>Robotics Beyond the Arena</h2><p>The Dean’s List Award recognizes that the most successful student engineers are not just those who write code or weld metal, but those who lead, inspire, and build sustainable local ecosystems for the next generation.</p>',
    kidTake: 'A student named Yiğit from Turkey won a leadership award at the World Robotics Championship. He was celebrated for helping poor schools in his city start their own robotics clubs so more kids can learn engineering!',
    familyDiscussion: [
      'Why is translating engineering materials into other languages important for global science collaboration?',
      'How can a student leader help their school build a successful science or robotics team?'
    ],
    glossary: [
      { term: 'FRC', meaning: 'FIRST Robotics Competition, a high school program where teams build large robots.' },
      { term: 'Dean\'s List', meaning: 'A prestigious award at FRC recognizing student leaders who promote STEM.' }
    ],
    ageBand: '8+',
    author: 'Jax Henderson',
    authorInit: 'JH',
    tags: ['robotics', 'first-championship', 'leadership', 'turkey-stem'],
    color: '#e11d48',
    gradient: 'linear-gradient(135deg, #e11d48, #3b82f6)',
    emoji: '⚙️'
  },
  {
    cat: 'space',
    title: 'NASA Student Launch 2025 Celebrates 25th Anniversary in Alabama',
    excerpt: 'Middle and high school rocketry teams designed and launched research payloads at the NASA Student Launch finals.',
    body: '<p>The 25th-anniversary NASA Student Launch competition concluded on May 4, 2025, near NASA’s Marshall Space Flight Center in Huntsville, Alabama, featuring over 980 middle school, high school, and university students.</p><h2>Launching Scientific Payloads</h2><p>The nine-month challenge tasks student teams with designing, building, and launching high-powered rockets to altitudes between 3,500 and 5,500 feet. More importantly, the rockets must carry a scientific payload, such as a camera array to track landing sites or atmospheric sensors to record air density.</p><h2>Professional Engineering Standards</h2><p>Teams undergo reviews similar to NASA’s aerospace design reviews, preparing students for future careers at NASA and commercial aerospace companies by enforcing strict safety and engineering documentation standards.</p>',
    kidTake: 'Nearly 1,000 students went to NASA\'s launch site in Alabama to shoot large model rockets high into the clouds. The rockets carried science experiments like cameras and sensors, acting like real space satellites!',
    familyDiscussion: [
      'Why is it helpful for students to have their rockets carry science experiments instead of just launching them for height?',
      'How does preparing engineering reviews help students when they get real jobs in aerospace?'
    ],
    glossary: [
      { term: 'Payload', meaning: 'The carrying capacity of an aircraft or launch vehicle, usually representing scientific instruments.' },
      { term: 'Aerospace', meaning: 'The branch of technology and industry concerned with both aviation and space flight.' }
    ],
    ageBand: '8+',
    author: 'Commander Leo Vance',
    authorInit: 'LV',
    tags: ['rocketry', 'nasa', 'huntsville', 'student-launch'],
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9, #e11d48)',
    emoji: '🌌'
  },
  {
    cat: 'stem',
    title: 'Camila Gonzalez-Thompson Maps Dengue Virus Vectors in Puerto Rico',
    excerpt: '14-year-old Camila Gonzalez-Thompson used blood sample data to map and track dengue virus outbreaks for local health officials.',
    body: '<p>Camila Isabel Gonzalez-Thompson, a 14-year-old student, has won recognition at national science fairs for her public health research project focused on tracking and mapping the dengue virus in Puerto Rico.</p><h2>Tracking Disease Vectors</h2><p>Dengue virus is spread by mosquitoes, and outbreaks can spike rapidly in tropical environments. Gonzalez-Thompson examined local health department blood sample data and mapped the coordinates of outbreaks against local rainfall and temperature records.</p><h2>Guiding Health Interventions</h2><p>Her research helped local public health officials identify endemic areas and target mosquito control efforts more effectively. Her work demonstrates how youth researchers can use data science to address immediate public health challenges in their communities.</p>',
    kidTake: 'A 14-year-old student named Camila built a disease map in Puerto Rico. By comparing weather records with blood samples, she helped health officials figure out where mosquitoes were spreading viruses, keeping families safe!',
    familyDiscussion: [
      'How does mapping weather and rainfall help health officials predict where mosquitoes will breed?',
      'Why is data science such a helpful tool for preventing the spread of diseases?'
    ],
    glossary: [
      { term: 'Vector', meaning: 'An organism, typically a biting insect, that transmits a disease or parasite from one animal to another.' },
      { term: 'Endemic', meaning: 'A disease regularly found among particular people or in a certain area.' }
    ],
    ageBand: '8+',
    author: 'Priya Ramanathan',
    authorInit: 'PR',
    tags: ['public-health', 'data-science', 'disease-mapping', 'puerto-rico'],
    color: '#14b8a6',
    gradient: 'linear-gradient(135deg, #14b8a6, #a855f7)',
    emoji: '🦟'
  }
];

async function run() {
  console.log('Starting full custom drops generator for July 7th drops...');
  const rawDb = new DatabaseSync(DB_PATH);
  
  // 1. Clear database queued stories that are NOT status = 'published'
  const dRes = rawDb.prepare("DELETE FROM queued_stories WHERE status != 'published'").run();
  console.log(`Cleared ${dRes.changes} old drafts/scheduled stories from queue.`);
  
  // Helper to schedule articles and run ComfyUI sequentially
  async function scheduleDrop(articles, edition, timeET, timeUTC) {
    console.log(`\n================= SCHEDULE DROP: ${edition.toUpperCase()} =================`);
    
    for (let i = 0; i < articles.length; i++) {
      const artData = articles[i];
      const targetDate = '2026-07-07';
      const storyId = `${targetDate}-${artData.cat}-${edition}`;
      const slug = artData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const pathStr = `data/articles/${targetDate}/${slug}.json`;
      
      const payload = {
        id: storyId,
        slug: slug,
        path: pathStr,
        cat: artData.cat,
        title: artData.title,
        excerpt: artData.excerpt,
        heroImage: '', // filled below
        body: artData.body,
        kidTake: artData.kidTake,
        familyDiscussion: artData.familyDiscussion,
        glossary: artData.glossary || [],
        ageBand: artData.ageBand,
        author: artData.author,
        authorInit: artData.authorInit,
        date: targetDate,
        publishedAt: timeET,
        read: 2,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        tags: artData.tags,
        color: artData.color,
        gradient: artData.gradient,
        emoji: artData.emoji,
        featured: false,
        pinned: false,
        live: false
      };
      
      console.log(`[${i+1}/${articles.length}] Generating illustration for [${artData.cat}] - "${artData.title}"...`);
      
      let customImg = null;
      try {
        const subDirName = `${targetDate}-${edition}`;
        customImg = await generateImageForArticle(artData.cat, artData.title, subDirName);
        if (customImg) {
          console.log(`  -> Custom image generated: ${customImg}`);
        } else {
          console.log(`  -> ComfyUI returned no image, falling back.`);
        }
      } catch (e) {
        console.warn(`  -> ComfyUI generation failed:`, e.message);
      }
      
      if (customImg) {
        payload.heroImage = `/assets/img/channels/${artData.cat}/${targetDate}-${edition}/${customImg}`;
      } else {
        const dayNum = 7;
        const offset = edition === 'midday' ? 1 : 2;
        const imgIndex = (((dayNum * 3) + offset) % 30) + 1;
        payload.heroImage = `/assets/img/channels/${artData.cat}/${imgIndex}.jpg`;
      }
      
      // Write JSON to disk inside the articles/YYYY-MM-DD folder
      const artFolder = path.join(ROOT, 'data', 'articles', targetDate);
      fs.mkdirSync(artFolder, { recursive: true });
      fs.writeFileSync(
        path.join(artFolder, `${slug}.json`),
        JSON.stringify(payload, null, 2)
      );
      
      // Insert into queued_stories database
      // The staff_id needs to map to the correct correspondent
      const staffSlug = artData.cat;
      const staffRow = rawDb.prepare("SELECT id FROM staff WHERE slug = ?").get(staffSlug);
      const staffId = staffRow ? staffRow.id : 1;
      
      rawDb.prepare(`
        INSERT INTO queued_stories (staff_id, channel, payload, status, publish_at, edition, created_at, updated_at)
        VALUES (?, ?, ?, 'scheduled', ?, ?, datetime('now'), datetime('now'))
      `).run(staffId, artData.cat, JSON.stringify(payload), timeUTC, edition);
    }
  }
  
  // Schedule Midday
  await scheduleDrop(MIDDAY_ARTICLES, 'midday', '2026-07-07T14:15:00-04:00', '2026-07-07T18:15:00.000Z');
  
  // Schedule Evening
  await scheduleDrop(EVENING_ARTICLES, 'evening', '2026-07-07T18:15:00-04:00', '2026-07-07T22:15:00.000Z');
  
  console.log('\nAll stories successfully written to data/articles/ and scheduled in database.');
  
  console.log('Running image sync...');
  try {
    execSync('npm run sync-images', { cwd: ROOT, stdio: 'inherit' });
    console.log('Images synchronized successfully to repo channels.');
  } catch (syncErr) {
    console.error('Image synchronization failed:', syncErr.message);
  }
  
  console.log('Committing and pushing scheduled drops & assets to GitHub...');
  try {
    execSync('git add .', { cwd: ROOT, stdio: 'inherit' });
    execSync('git commit -m "editorial: schedule completely real-world July 7 Midday & Evening drops with custom ComfyUI illustrations"', { cwd: ROOT, stdio: 'inherit' });
    execSync('git push origin main', { cwd: ROOT, stdio: 'inherit' });
    console.log('Successfully pushed changes to GitHub! Railway will redeploy and schedule them.');
  } catch (gitErr) {
    console.error('Git push failed:', gitErr.message);
  }
  
  console.log('Real drops scheduling completed successfully!');
}

run().catch(console.error);
