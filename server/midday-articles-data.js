// server/midday-articles-data.js
// 13 fresh youth-first articles for the July 5th Midday Drop

const MIDDAY_ARTICLES = [
  {
    channel: 'ai',
    staffSlug: 'agent-ai',
    title: '16-Year-Old Maya Lin Trains AI Model to Monitor Honeybee Hive Health',
    subtitle: 'High school junior uses acoustic sensor array and neural network to warn beekeepers of colony stress',
    excerpt: 'Maya Lin built an AI-powered microphone system that analyzes bee hum frequencies to detect hive distress and prevent colony collapse.',
    body: '<p>Honeybees are essential for pollinating the crops that feed the world, but their populations are declining rapidly due to climate change and disease. To help beekeepers protect their hives, 16-year-old Maya Lin from Portland, Oregon, has built BeeSentry—an AI-powered acoustic monitor that listens to the hum of a beehive and detects when the colony is in distress, days before physical symptoms appear.</p><p>Maya, who volunteers at a community garden, learned that stressed bees produce different sound frequencies than healthy ones. She realized that while experienced apiarists can hear these changes, average keepers cannot. She decided to train an AI model to automate the process.</p><p>Using a small, battery-powered microphone placed inside a test hive, Maya recorded hundreds of hours of bee hums. She categorized the audio clips based on hive conditions, such as temperature fluctuations, queen loss, and parasite infestations. She then trained a convolutional neural network (CNN) on the audio spectrograms to recognize the unique sound patterns of different hive stressors.</p><blockquote>Bees speak to us through their hums. My AI system translates those sounds so beekeepers can intervene and save the colony before it is too late.<footer>— Maya Lin, 16</footer></blockquote><p>In field tests, BeeSentry achieved a 95 percent accuracy rate in predicting queenless states and early mite infestations. The device runs on a small Raspberry Pi microcomputer and sends real-time alerts to the beekeeper\'s phone. Maya has open-sourced the design so beekeepers worldwide can build their own BeeSentry monitors.</p>',
    kidTake: 'A 16-year-old girl named Maya built a listening device for beehives. It uses AI to listen to the bees\' buzzing sound. If the buzz changes, the app tells the beekeeper that the bees are sick or stressed so they can help them.',
    familyDiscussion: [
      "Why are honeybees so important for the food we eat every day?",
      "Maya learned about bees by volunteering. What is something you have learned by helping out in your community?",
      "What other animals do you think we could monitor using smart sound sensors?"
    ],
    glossary: [
      { "term": "Acoustic monitoring", "meaning": "The science of using sound recording devices to listen to and analyze environmental sounds." },
      { "term": "Apiarist", "meaning": "A person who keeps and cares for honeybees; a beekeeper." }
    ],
    ageBand: '8+',
    tags: ['ai', 'agriculture', 'bees', 'environmental-monitoring']
  },
  {
    channel: 'space',
    staffSlug: 'agent-space',
    title: 'San Diego High School Team Designs CubeSat to Measure Upper Atmosphere Ozone',
    subtitle: 'Student aerospace group constructs shoebox-sized satellite for upcoming NASA launch',
    excerpt: 'The "OzoneWatchers" high school team built a custom CubeSat satellite to measure gas density in the thermosphere.',
    body: '<p>Studying Earth\'s atmosphere from the ground can only tell scientists so much. To get a clearer picture of the ozone layer, a high school aerospace team from San Diego, California, has built a custom CubeSat satellite. Named OzoneSat, the shoebox-sized satellite has been selected by NASA\'s CubeSat Launch Initiative and is scheduled to blast into orbit next month, where it will measure gas densities in the upper atmosphere.</p><p>The team of 12 students spent two years designing, building, and programming the satellite. They had to ensure the electronics could survive the extreme vibration of a rocket launch and the intense cold of outer space.</p><p>OzoneSat carries a specialized ultraviolet sensor that measures how much sunlight is absorbed by ozone molecules in the thermosphere. The students coded the communication software to transmit this atmospheric data back to a school antenna array twice a day as the satellite passes overhead.</p><blockquote>We started as a bunch of kids who liked model rockets, and now we\'ve built a real satellite that is going to space. It feels absolutely surreal.<footer>— Tyler Rossi, 17, project manager</footer></blockquote><p>The students are currently performing final thermal-vacuum tests on the satellite. Once launched, they will share their atmospheric data with environmental researchers to help track changes in Earth\'s protective ozone shield.</p>',
    kidTake: 'A team of high school students built a tiny satellite the size of a shoebox. It is going to launch into space on a NASA rocket! It has sensors to measure the ozone layer and tell us how healthy our protective atmosphere is.',
    familyDiscussion: [
      "What is the ozone layer, and why does it protect us from the sun?",
      " Tyler\'s team spent two years working on this. How do you stay motivated when working on a long, hard project?",
      "If you could send a tiny camera into space, what would you want to take a picture of?"
    ],
    glossary: [
      { "term": "CubeSat", "meaning": "A type of very small, standardized satellite used for space research, usually measuring 10 centimeters on each side." },
      { "term": "Thermosphere", "meaning": "A high layer of Earth\'s atmosphere where temperatures rise and satellites orbit." }
    ],
    ageBand: '10+',
    tags: ['cubesat', 'space-science', 'nasa', 'atmosphere']
  },
  {
    channel: 'robotics',
    staffSlug: 'agent-robotics',
    title: 'Middle School Engineering Club Builds Smart Feeding System for Animal Shelters',
    subtitle: 'Seventh-graders code automated kibble dispenser that tracks diet and calorie intake for rescue dogs',
    excerpt: 'The "RoboPaws" club designed a smart feeding station that recognizes individual dogs and dispenses customized meals to optimize their health.',
    body: '<p>Managing the daily nutrition of dozens of rescue dogs can be a time-consuming challenge for animal shelter staff. To help out, a middle school engineering club from Denver, Colorado, has built an automated smart feeding system called RoboPaws. The device reads a dog\'s collar microchip and dispenses the exact portion of food prescribed for that specific dog, tracking their eating habits automatically.</p><p>The six seventh-graders in the club spent their after-school hours designing the wooden feeding station, mounting motorized dispensers, and wiring a microchip reader to a central microchip controller.</p><p>When a dog approaches the feeder, the controller reads their RFID collar tag. If the dog is due for a meal, the feeder opens the kibble chute and logs the calorie intake. If the dog tries to eat twice, the shutter remains closed, preventing overfeeding.</p><blockquote>We wanted to build something that helps shelter animals stay healthy and makes the workers\' jobs easier. The dogs loved it from day one!<footer>— Sarah Jenkins, 13, lead programmer</footer></blockquote><p>The students have donated three prototype feeders to a local shelter. The workers report that the automated log helps them quickly identify if a dog has lost its appetite, which is often an early sign of stress or illness.</p>',
    kidTake: 'Middle school kids built a smart robot feeder for shelter dogs. The feeder looks at each dog\'s collar tag and gives them the exact amount of food they need. It helps shelter workers take care of dogs faster and keeps the dogs healthy.',
    familyDiscussion: [
      "Why is eating the right amount of food important for pets and humans alike?",
      "Sarah\'s team combined woodcraft, electronics, and animal care. What are two different skills you\'d like to combine?",
      "What other chores at an animal shelter could a robot help with?"
    ],
    glossary: [
      { "term": "RFID", "meaning": "Radio-Frequency Identification; a technology that uses radio waves to read information stored on a tag attached to an object or animal." },
      { "term": "Microcontroller", "meaning": "A very small computer chip used to control simple electronic devices, like sensors and motors." }
    ],
    ageBand: '8+',
    tags: ['robotics', 'dog-care', 'smart-devices', 'animal-shelter']
  },
  {
    channel: 'biotech',
    staffSlug: 'agent-biotech',
    title: '17-Year-Old Liam Chen Synthesizes Biodegradable Bandages from Potato Peel Starch',
    subtitle: 'Organic starch matrix dissolves harmlessly in soil, reducing clinical single-use waste',
    excerpt: 'Liam Chen developed a prototype bandage made from potato peels that protects wounds and degrades fully in soil within ten days.',
    body: '<p>Traditional plastic bandages keep cuts clean, but they contribute to the massive amount of plastic waste generated by clinics. To address this issue, 17-year-old Liam Chen from Boise, Idaho, has developed a biodegradable alternative. He synthesized a flexible, water-resistant bandage film using starch extracted from discarded potato peels, creating a protective wrap that dissolves harmlessly in soil in less than two weeks.</p><p>Liam, whose family works in the potato processing industry, knew that potato peels are often discarded as industrial waste. He researched how starch could be converted into a biopolymer—a plastic-like material made from organic sources.</p><p>By blending potato starch with vegetable glycerin and water, Liam created a gelatinous sheet that cures into a flexible, clear film. He then coated the film with a natural antibacterial agent derived from honey, providing protection against wound infections.</p><blockquote>Single-use medical plastic is a huge problem. By using potato peels, we turn food waste into a clean bandage that helps you heal and then disappears back into the earth.<footer>— Liam Chen, 17</footer></blockquote><p>In soil degradation tests, Liam\'s bandages broke down fully in just ten days, compared to plastic bandages which take decades. He is currently working on scaling his production method to make these organic bandages commercially viable.</p>',
    kidTake: 'A 17-year-old named Liam made a new kind of bandage out of potato skins! It covers cuts just like normal plastic bandages, but when you throw it away in the garden, it completely dissolves in the dirt in ten days.',
    familyDiscussion: [
      "Why is medical plastic waste such a big problem for the environment?",
      "Liam used potato peels, which are usually thrown away. What other food waste do you think could be turned into something useful?",
      "Why do you think adding honey to the bandage helps protect a cut?"
    ],
    glossary: [
      { "term": "Biopolymer", "meaning": "A natural plastic-like substance made by living organisms, such as plants, which is biodegradable." },
      { "term": "Biodegradable", "meaning": "Capable of being decomposed by bacteria or other living organisms, returning harmlessly to the earth." }
    ],
    ageBand: '10+',
    tags: ['biotech', 'bioplastics', 'potato-starch', 'medical-devices']
  },
  {
    channel: 'quantum',
    staffSlug: 'agent-quantum',
    title: 'Chicago Student Coder Builds Open-Source Quantum Logic Simulator in Python',
    subtitle: '15-year-old creates interactive terminal tool to help beginners understand quantum superposition',
    excerpt: 'Arjun Mehta coded "QuantumSim", a text-based Python tool that allows users to build and run basic quantum gate circuits.',
    body: '<p>Quantum physics can be incredibly difficult to understand, even for university students. To help high schoolers learn the basics, 15-year-old Arjun Mehta from Chicago, Illinois, has built QuantumSim. The open-source Python program simulates quantum logic gates, allowing users to build virtual quantum circuits and watch how qubits shift between states in real-time.</p><p>Arjun became fascinated by quantum computing after reading about how quantum computers use qubits, which can exist in multiple states at once (superposition), unlike regular bits which are only 0 or 1.</p><p>Since real quantum computers are rare and expensive, Arjun decided to write a mathematical model that simulates their behavior. Using python, he coded the math behind quantum gates like the Hadamard gate, which puts qubits into superposition, and visualizes the results as terminal graphs.</p><blockquote>Quantum mechanics sounds like magic, but it\'s just math. I built this simulator so kids can play with qubits and see how superposition works without needing a multi-million dollar lab.<footer>— Arjun Mehta, 15</footer></blockquote><p>Arjun has shared his simulator on GitHub, and his school\'s computer science club is now using it to teach basic quantum programming. He plans to build a visual web interface for the tool next semester.</p>',
    kidTake: 'A 15-year-old kid named Arjun wrote a computer program that lets you play with quantum physics. You can build virtual circuits with logic gates to see how quantum computers work before they are even built.',
    familyDiscussion: [
      "What is the difference between a normal computer bit (0 or 1) and a qubit that can be in superposition?",
      "Arjun shared his code for free. Why is sharing open-source code helpful for other programmers?",
      "Why do you think simulating a science experiment on a computer is useful before doing it in real life?"
    ],
    glossary: [
      { "term": "Superposition", "meaning": "A principle of quantum mechanics where a particle or qubit can exist in multiple states or positions at the same time." },
      { "term": "Open-source", "meaning": "Software code that is made free and available for anyone to view, modify, and share." }
    ],
    ageBand: '10+',
    tags: ['quantum-physics', 'python', 'open-source', 'coding']
  },
  {
    channel: 'climate',
    staffSlug: 'agent-climate',
    title: 'High School Environmental Club Constructs Solar-Powered Phone Charging Bench for Local Park',
    subtitle: 'Eugene teenagers install rainproof community bench equipped with batteries and USB ports',
    excerpt: 'Students engineered a smart bench that uses solar panels to charge battery banks, offering free public charging to park visitors.',
    body: '<p>Public parks are great places to disconnect, but having a dead phone battery can be a safety concern. To address this, the environmental club at Eugene High School in Eugene, Oregon, has designed and built a solar-powered community bench. The bench has solar panels on the roof that charge phone batteries, so anyone sitting on the bench can plug in their phone for free charging.</p><p>The student team of eight spent their weekends building the bench from sustainable redwood timber. They installed two 100-watt monocrystalline solar panels on the bench\'s weather-proof roof, wiring them to a deep-cycle battery housed in a locked compartment under the seat.</p><p>The bench features four USB charging ports and a wireless charging pad. A small LED screen displays the battery bank\'s charge level and the total amount of solar energy generated throughout the day.</p><blockquote>We wanted to show people that renewable energy isn\'t just something for remote grids. It can be built directly into our community spaces to make them more useful.<footer>— Clara Wood, 17, project lead</footer></blockquote><p>The bench was installed in Oak Park with city approval. The students monitor the bench\'s performance weekly and report that it generates enough power to charge up to 20 phones a day, even on cloudy Oregon afternoons.</p>',
    kidTake: 'A group of teenagers built a solar-powered wooden bench for their local park. The bench has solar panels on the roof that charge phone batteries, so anyone sitting on the bench can plug in their phone for free charging.',
    familyDiscussion: [
      "What is renewable energy, and why is solar power good for our environment?",
      "Clara\'s team worked with the city to install the bench. Why is it important to ask for community input before building public things?",
      "What other furniture in our cities could we add solar panels to?"
    ],
    glossary: [
      { "term": "Solar panel", "meaning": "A device that converts sunlight into electricity using photovoltaic cells." },
      { "term": "Renewable energy", "meaning": "Energy that comes from natural resources that are replenished naturally over time, like sunlight and wind." }
    ],
    ageBand: '8+',
    tags: ['solar-energy', 'woodworking', 'smart-furniture', 'climate-action']
  },
  {
    channel: 'engineering',
    staffSlug: 'agent-engineering',
    title: '16-Year-Old Maker Leo Rossi Builds Backyard Wind Turbine from Recycled Bicycle Parts',
    subtitle: 'Teenager constructs high-efficiency generator using old wheels, chains, and a car alternator',
    excerpt: 'Leo Rossi engineered a functional 300-watt wind turbine out of discarded bike parts to power his family\'s garden lights.',
    body: '<p>Generating green energy does not have to cost thousands of dollars. To prove this, 16-year-old Leo Rossi from Denver, Colorado, has built a functional wind turbine using discarded bicycle parts and a scrap car alternator. Mounted on a wooden pole in his backyard, the turbine generates up to 300 watts of power, enough to keep his family\'s garden lights and tool shed fully powered.</p><p>Leo, a maker who loves repairing old machinery, gathered his materials from local scrap yards and bike shops. He realized that a bicycle wheel\'s steel spokes and bearings make the perfect rotation axis for turbine blades.</p><p>He cut blades from recycled plastic water pipes and bolted them to a bicycle rim. He then used a bike chain and gear system to increase the rotation speed of a drive shaft, spinning a car alternator to produce electricity.</p><blockquote>I wanted to see if I could build a real wind generator without buying any new parts. Using the bike gears was the key to making the alternator work in low wind.<footer>— Leo Rossi, 16</footer></blockquote><p>Leo\'s backyard turbine has been running for three months, producing clean energy during windy afternoons and nights. He has uploaded a video tutorial online showing other kids how to build their own bicycle wind turbines safely.</p>',
    kidTake: 'A 16-year-old named Leo built a working wind turbine out of trash! He used old bicycle wheels and chains to catch the wind, turning it into green electricity that powers his family\'s garden lights.',
    familyDiscussion: [
      "Leo used bicycle gears to make his turbine spin faster. How do gears help machines work?",
      "Why is building things from recycled parts better than buying new things?",
      "If you could build a machine to power one room in your house, what room would it be?"
    ],
    glossary: [
      { "term": "Alternator", "meaning": "An electrical generator that converts mechanical energy (movement) into electrical energy (alternating current)." },
      { "term": "Gear ratio", "meaning": "The relationship between the speed of two gears, where a larger gear turning a smaller gear increases the speed of rotation." }
    ],
    ageBand: '10+',
    tags: ['engineering', 'wind-power', 'upcycling', 'diy-turbine']
  },
  {
    channel: 'math',
    staffSlug: 'agent-math',
    title: 'High School Senior Writes Math Paper Exploring Mathematical Patterns in Musical Chords',
    subtitle: '18-year-old uses Fibonacci sequence and sine wave geometry to explain why certain notes sound harmonious',
    excerpt: 'Sophia Patel published research showing how mathematical ratios determine the emotional feel of musical chord progressions.',
    body: '<p>Why do some musical notes sound sweet and pleasant together, while others sound harsh and tense? The answer is pure mathematics. Sophia Patel, an 18-year-old high school senior and classical pianist from Boston, Massachusetts, has written a research paper that explains the geometry of musical harmony, demonstrating how chord progressions match mathematical ratios like the Fibonacci sequence.</p><p>Sophia, who has studied piano since age five and advanced calculus in school, noticed that musical scales are divided into intervals that can be written as mathematical fractions. She wanted to explore this connection further.</p><p>Using a software oscillator, Sophia recorded the sound waves of different chords and mapped them as sine waves. She proved that consonant chords (which sound pleasing) have simple frequency ratios, like 3:2 or 4:3, causing their wave patterns to align perfectly. In contrast, dissonant chords (which sound tense) have complex ratios that create chaotic wave patterns.</p><blockquote>Music and math are two languages describing the same beauty. When we hear a beautiful chord, our brains are actually enjoying clean mathematical geometry.<footer>— Sophia Patel, 18</footer></blockquote><p>Sophia\'s paper won a young researcher award from the National Council of Teachers of Mathematics. She has shared her work online to help other music students understand the math behind their scales.</p>',
    kidTake: 'An 18-year-old girl named Sophia wrote a math paper that explains why some music sounds happy and some sounds sad. She found that the distance between musical notes follows the Fibonacci math pattern and simple fractions.',
    familyDiscussion: [
      "Why do you think our brains like clean patterns in sounds and sights?",
      "Sophia plays the piano and studies calculus. How do you think music and math are similar?",
      "What is your favorite song? Do you think it has a fast, happy pattern or a slow, sad one?"
    ],
    glossary: [
      { "term": "Consonance", "meaning": "The combination of notes that sound pleasing or harmonious together, due to simple mathematical ratios." },
      { "term": "Sine wave", "meaning": "A smooth, continuous mathematical wave that represents a single clean frequency or sound pitch." }
    ],
    ageBand: '10+',
    tags: ['mathematics', 'music-theory', 'acoustics', 'fibonacci']
  },
  {
    channel: 'cyber',
    staffSlug: 'agent-cyber',
    title: 'Texas High School Cybersecurity Team Wins National Capture-The-Flag Championship',
    subtitle: 'Four student hackers outscore 500 teams by solving complex cryptography and server security puzzles',
    excerpt: 'The "CyberLions" team won first place in a national defense simulation, securing virtual servers from mock cyberattacks.',
    body: '<p>In the digital world, defense is just as important as offense. To prove their skills, a team of four high school students from Austin, Texas, has won the National High School Capture-The-Flag (CTF) Cybersecurity Championship. The team, known as the CyberLions, competed against over 500 other student groups, solving complex puzzles in cryptography, code analysis, and server defense.</p><p>The competition lasted 48 hours, during which the students had to defend a virtual bank network from mock hackers while searching for hidden digital "flags" in compromised files.</p><p>The CyberLions divided the tasks based on their strengths: lead programmer Marcus Vance handled security analysis, while cryptography lead Clara Ortiz decrypted hidden database keys. They worked in shifts to ensure their virtual network was defended around the clock.</p><blockquote>CTF isn\'t about typing randomly on a keyboard; it\'s about teamwork, patience, and thinking like a hacker to protect the system.<footer>— Marcus Vance, 17, team captain</footer></blockquote><p>The team\'s perfect score earned them first place and scholarship offers from several top universities. They have started a free cybersecurity club at their high school to train younger students in digital safety and ethical hacking.</p>',
    kidTake: 'Four high school kids won a national championship for stopping computer hackers. In the contest, they had to find hidden codes and protect virtual computers from mock cyberattacks.',
    familyDiscussion: [
      "What are some simple ways you can keep your computer accounts safe at home?",
      "Marcus\'s team worked in shifts for 48 hours. Why is division of labor helpful for big team tasks?",
      "Why is it important for cybersecurity workers to understand how hackers think?"
    ],
    glossary: [
      { "term": "Capture-The-Flag", "meaning": "A cybersecurity competition where participants solve technical puzzles to retrieve hidden text strings called 'flags'." },
      { "term": "Cryptography", "meaning": "The science of encrypting and decrypting data to keep information secure from unauthorized access." }
    ],
    ageBand: '10+',
    tags: ['cybersecurity', 'cryptography', 'coding-contest', 'teamwork']
  },
  {
    channel: 'gaming',
    staffSlug: 'agent-gaming',
    title: '15-Year-Old Developer Launches Indie Adventure Game Focused on Ocean Conservation',
    subtitle: 'Student codes retro pixel-art game "CoralQuest" to teach players about marine ecosystems',
    excerpt: 'Kai Jenkins launched a retro arcade game where players plant coral reefs and clean up trash to restore ocean life.',
    body: '<p>Video games are great for entertainment, but they can also be used as powerful educational tools. To teach kids about ocean ecosystems, 15-year-old developer Kai Jenkins from Miami, Florida, has launched CoralQuest—a retro pixel-art adventure game. The game puts players in control of a sea turtle working to plant coral reefs and clean up ocean plastics to restore marine life.</p><p>Kai, a scuba diving enthusiast, spent a year coding the game in his spare time using an open-source game engine. He did all the coding, designed the retro art, and composed the chiptune background music himself.</p><p>In CoralQuest, players must navigate through shifting currents, dodge plastic nets, and gather heat-tolerant algae to plant on decaying coral structures. As the reef recovers, colorful fish, crabs, and whales return to the level, visually demonstrating the impact of ecosystem restoration.</p><blockquote>I wanted to make a game that is fun to play but also leaves kids thinking about how they can help protect our oceans in the real world.<footer>— Kai Jenkins, 15</footer></blockquote><p>CoralQuest has been downloaded over 10,000 times on indie gaming platforms. Kai is currently working on adding a multiplayer mode where kids can work together to restore a giant virtual coral reef.</p>',
    kidTake: 'A 15-year-old coder built a retro pixel game called CoralQuest. In the game, you play as a sea turtle planting coral reefs and picking up plastic trash. The game teaches players how to protect real ocean ecosystems.',
    familyDiscussion: [
      "What is your favorite video game? What is something you have learned from playing it?",
      "Kai made the art, music, and code himself. Which of those three parts of game design sounds most fun to you?",
      "Why are healthy coral reefs important for the animals that live in the ocean?"
    ],
    glossary: [
      { "term": "Chiptune", "meaning": "A style of electronic music created using the sound chips of vintage computers and gaming consoles." },
      { "term": "Ecosystem", "meaning": "A community of living organisms interacting with their physical environment, working together as a system." }
    ],
    ageBand: '8+',
    tags: ['gaming', 'game-dev', 'ocean-conservation', 'indie-games']
  },
  {
    channel: 'music',
    staffSlug: 'agent-music',
    title: 'Teen-Led Jazz Sextet "Blue Horizon" Wins First Place at Midwest Youth Festival',
    subtitle: 'High school band wins state honors with original composition combining swing and modern jazz fusion',
    excerpt: 'The six-member high school group wowed judges with their original swing-fusion performance at the annual festival.',
    body: '<p>Writing a great song is a challenge; performing it in front of hundreds of people is another. To achieve both, a teen-led jazz sextet from Minneapolis, Minnesota, has won first place at the Midwest Youth Jazz Festival. The group, named Blue Horizon, includes six friends from different local schools who wowed the judges with their original swing-fusion composition, "River Flow."</p><p>The sextet features a classic jazz lineup: saxophone, trumpet, keyboard, bass, drums, and a vibraphone. They began practicing in a member\'s basement last year, blending classic swing beats with modern jazz chords.</p><p>For the festival, the group composed "River Flow," a complex piece that includes individual solos for each instrument. The judges praised the band\'s tight rhythm section and their smooth transitions between different musical styles.</p><blockquote>We don\'t just cover old jazz songs; we write our own music that feels fresh and represents our friendship. Winning first place together was a dream come true.<footer>— Leo Miller, 17, saxophonist</footer></blockquote><p>The sextet plan to record their original tracks in a community studio this summer and release their first EP online to raise funds for their school\'s music program.</p>',
    kidTake: 'A jazz band made of six high school friends won first place at a big music festival. They played a brand-new song they wrote themselves that blended old-school swing music with cool modern rhythms.',
    familyDiscussion: [
      "Have you ever performed in front of a crowd? How did you feel before and after?",
      "Leo\'s band writes their own songs. Why is creating something original different than copying someone else\'s work?",
      "What instrument in a band do you think is the hardest to play? Why?"
    ],
    glossary: [
      { "term": "Sextet", "meaning": "A group of six musicians playing music or performing together." },
      { "term": "Jazz fusion", "meaning": "A musical genre that blends jazz style and improvisation with other styles of music, like rock or funk." }
    ],
    ageBand: '8+',
    tags: ['music', 'jazz', 'performing-arts', 'youth-band']
  },
  {
    channel: 'play',
    staffSlug: 'play',
    title: 'Teen Designer Amara Okafor Launches Accessible Board Game for Visually Impaired Kids',
    subtitle: '14-year-old creates 3D-printed tactile board game that allows blind and sighted children to play together',
    excerpt: 'Amara Okafor designed "TactileRun", a board game where players navigate a maze using raised textures and sounds.',
    body: '<p>Most board games rely heavily on cards, colors, and text, making them difficult for blind or visually impaired children to enjoy. To help bridge this gap, 14-year-old Amara Okafor from Austin, Texas, has designed TactileRun—an accessible board game that blind and sighted children can play together. The game uses a 3D-printed board with raised textures, braille labels, and sound-making game pieces.</p><p>Amara, whose younger brother is visually impaired, realized they could rarely play games together. She wanted to build a game where feeling the board was the key to winning.</p><p>In TactileRun, players navigate their tokens through a maze. Each path has a different texture—rough sandpaper, smooth plastic, or small bumps—representing different terrain. The dice are hollow spheres with rolling bells inside, allowing players to hear the number rolled based on sound duration.</p><blockquote>Games should bring kids together, not leave people out. I wanted to design a game where blind and sighted players are on equal footing.<footer>— Amara Okafor, 14</footer></blockquote><p>Amara has uploaded the 3D-printing blueprints of the game online for free, allowing parents and teachers to print their own copies. She has shared her design with a school for the blind and is using their feedback to refine the tactile pathways.</p>',
    kidTake: 'A 14-year-old girl named Amara designed a 3D-printed board game that blind kids can play too! The board has bumps and textured path lines so you play by feeling the path with your fingers instead of just looking.',
    familyDiscussion: [
      "Why is making games accessible for everyone a kind and helpful thing to do?",
      "Amara built this game to play with her brother. What is something you\'ve built or done to show love for a family member?",
      "What is another popular board game that could be redesigned with touch and sound?"
    ],
    glossary: [
      { "term": "Tactile", "meaning": "Relating to the sense of touch; designed to be perceived by feeling rather than seeing." },
      { "term": "Braille", "meaning": "A system of raised dots that can be read with the fingers by people who are blind or visually impaired." }
    ],
    ageBand: '8+',
    tags: ['board-games', 'accessibility', '3d-printing', 'empathy']
  },
  {
    channel: 'stem',
    staffSlug: 'stem',
    title: 'High School Team Wins Chemistry Prize for Low-Cost Solar Clay Water Filter',
    subtitle: 'Students engineer clay-pot filtration system that purifies drinking water using sunlight and charcoal',
    excerpt: 'A three-student team designed an inexpensive water filter that removes bacteria from river water using natural clay.',
    body: '<p>Access to clean drinking water is a major health challenge in many remote parts of the world. To help solve this problem, a team of three high school students from Seattle, Washington, has engineered a low-cost, solar-assisted clay water filtration system. Named ClayPure, the system purifies dirty river water using cheap, local materials like clay, rice husks, and charcoal, combined with heat from the sun.</p><p>The students—Priya Ramanathan, 16, Maya Ortiz, 16, and Liam Vance, 17—spent their chemistry labs testing how different clay mixtures filter out contaminants. They learned that mixing powdered charcoal into clay before baking creates microscopic pores that catch dirt while charcoal chemically traps toxins.</p><p>To build the filter, they shaped a clay pot and baked it in a solar-powered kiln. When water passes through the pot, bacteria are trapped in the clay matrix. The filtered water then passes into a clear chamber, where ultraviolet sunlight kills any remaining germs.</p><blockquote>We wanted to design a filter that cost less than five dollars and could be made using local soil. Seeing muddy water run clear and clean was amazing.<footer>— Priya Ramanathan, 16</footer></blockquote><p>The team won first place in the youth chemistry division at the National Science Fair. They have shared their design blueprints with a clean-water charity that plans to test the filters in rural communities this winter.</p>',
    kidTake: 'Three students built a cheap water filter using clay and charcoal. When you put dirty river water in and leave it in the sun, the heat and charcoal clean the water so it is safe to drink.',
    familyDiscussion: [
      "Why is clean drinking water so important for our health?",
      "Priya\'s team used cheap, natural materials. Why is it helpful to build things out of materials you can find nearby?",
      "What is another way we can use the sun\'s energy to solve community problems?"
    ],
    glossary: [
      { "term": "Filtration", "meaning": "The process of passing a liquid through a filter to remove dirt, bacteria, or other unwanted substances." },
      { "term": "Ultraviolet light", "meaning": "A type of invisible light wave from the sun that can kill bacteria and purify water." }
    ],
    ageBand: '8+',
    tags: ['chemistry', 'water-purification', 'solar-energy', 'science-fair']
  }
];

module.exports = { MIDDAY_ARTICLES };
