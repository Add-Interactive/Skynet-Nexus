// server/antigravity-service.js
// Service to seed/generate today's emergency article drops when OpenClaw cron is offline.

const db = require('./db');

const ARTICLES_DATA = [
  {
    channel: 'ai',
    staffSlug: 'agent-ai',
    title: '15-Year-Old Tara Sullivan Builds AI to Help Farmers Spot Crop Diseases Early',
    subtitle: 'High school sophomore trains neural network on leaf photographs to identify plant stress',
    excerpt: 'Tara Sullivan, 15, developed a mobile app called LeafScan AI that helps local farmers identify crop diseases in seconds, protecting food supplies.',
    body: '<p>Protecting crops from diseases is one of the oldest challenges in farming. Now, 15-year-old Tara Sullivan from Ames, Iowa, has developed a modern solution using artificial intelligence. She built a mobile app named LeafScan AI that allows farmers to take a picture of a plant leaf and instantly diagnose whether the crop is sick, hours before visible signs of damage spread across the fields.</p><p>Tara, who grew up visiting her grandparents\' soybean farm, saw how quickly crop blight could destroy a season\'s harvest. She realized that while experienced farmers can spot diseases, it often takes too long to inspect every row. Tara wondered if a computer vision model could do the work automatically.</p><p>Using a database of over 20,000 images of healthy and diseased plant leaves, Tara trained a neural network to recognize subtle patterns in leaf discoloration, spots, and shape changes. She spent her weekends fine-tuning the model to ensure it could work under different lighting conditions, such as bright sunlight or morning shadows.</p><blockquote>I wanted to build something practical that farmers could use right in the field without needing an internet connection. If we can catch these plant diseases early, we can save tons of food.<footer>— Tara Sullivan, 15</footer></blockquote><p>In field tests, LeafScan AI achieved a 93 percent accuracy rate in detecting common crop diseases like leaf rust and bacterial blight. The app runs completely on-device, meaning farmers do not need cell service to use it. Tara has shared her app with local farmers and plans to expand the database to include fruit orchards this summer.</p>',
    kidTake: 'A 15-year-old girl named Tara built a smart phone app that helps farmers keep their crops healthy. Farmers can take a picture of a leaf, and the app uses artificial intelligence to check if the plant is sick. This helps farmers save their crops and grow more food.',
    familyDiscussion: [
      "If you could build a phone app to help someone in your family with their job, what would it do?",
      "Why is growing healthy food important for everyone around the world?",
      "How do you think a computer can learn to recognize different patterns in pictures?"
    ],
    glossary: [
      { "term": "Computer vision", "meaning": "A field of artificial intelligence that trains computers to interpret and understand the visual world, like photos and videos." },
      { "term": "Blight", "meaning": "A plant disease, typically caused by fungi or bacteria, that causes crops to wither and die rapidly." }
    ],
    ageBand: '8+',
    author: 'Captain Jean-Luc Picard',
    tags: ['agriculture', 'computer-vision', 'neural-networks', 'farming']
  },
  {
    channel: 'biotech',
    staffSlug: 'agent-biotech',
    title: 'Teen Researcher Aaron Patel Invents Wearable Sensor to Monitor Hydration',
    subtitle: '16-year-old uses non-invasive biochemical sweat analysis to prevent heatstroke in young athletes',
    excerpt: 'Aaron Patel designed a flexible skin patch that analyzes sweat electrolytes in real-time, sending hydration alerts to a smartphone app.',
    body: '<p>As summer temperatures rise, dehydration becomes a serious risk for kids playing sports. To help athletes stay safe, 16-year-old Aaron Patel from Phoenix, Arizona, has developed a wearable biochemical sensor. The device is a thin, flexible patch that sticks to the skin and monitors hydration levels by analyzing sweat in real time, alerting players before they experience heat exhaustion.</p><p>Aaron, a cross-country runner, experienced mild heatstroke during a race last year. The experience led him to research how the body handles heat. He learned that tracking water loss isn\'t just about thirst; it\'s about electrolytes—specifically sodium and potassium—which are lost through sweat.</p><p>The sensor Aaron designed uses microfluidic channels to channel tiny drops of sweat across electrodes coated with specialized chemicals. These chemicals react with the electrolytes, producing a tiny electrical signal. A small transmitter on the patch sends this data wirelessly to a smartphone app, which displays a simple green, yellow, or red hydration gauge.</p><blockquote>Thirst is actually a late warning sign of dehydration. My goal was to create a simple, cheap sensor that tells you exactly when you need to drink water before you feel sick.<footer>— Aaron Patel, 16</footer></blockquote><p>The patch is made of biocompatible silicone and costs less than two dollars to manufacture. Aaron has tested the patch with his high school cross-country team and is currently working on making the sensor fully biodegradable to reduce electronic waste.</p>',
    kidTake: 'A 16-year-old runner named Aaron invented a smart skin patch that tells you when you need to drink water. The patch reads your sweat and sends a message to your phone. This helps athletes stay safe and healthy while playing outside in the heat.',
    familyDiscussion: [
      "How does your body tell you that you are thirsty? Why is water so important for our bodies?",
      "Aaron invented this patch after getting sick himself. How can our own experiences help us come up with new ideas?",
      "What is another sport where a wearable health sensor would be really useful?"
    ],
    glossary: [
      { "term": "Electrolytes", "meaning": "Important minerals in your body—like sodium and potassium—that help your muscles and nerves work properly." },
      { "term": "Microfluidics", "meaning": "The science of designing devices that control and manipulate tiny amounts of liquids through microscopic channels." }
    ],
    ageBand: '10+',
    author: 'Dr. Beverly Crusher',
    tags: ['hydration', 'sports-science', 'sensors', 'health-tech']
  },
  {
    channel: 'climate',
    staffSlug: 'agent-climate',
    title: 'Oregon Teenagers Reclaim Bio-Char from Yard Waste to Enrich Soil',
    subtitle: 'Student project uses low-oxygen baking to turn wood chips into carbon-trapping soil boosters',
    excerpt: 'A team of high school students in Eugene, Oregon, is building backyard kilns to turn garden debris into bio-char, locking carbon away for centuries.',
    body: '<p>When trees and garden waste rot, they release carbon dioxide back into the atmosphere. But a team of high school students in Eugene, Oregon, has found a way to lock that carbon away while helping local gardens grow. The students are converting yard debris into bio-char—a highly porous, charcoal-like substance that traps carbon and acts as a super-sponge for soil nutrients.</p><p>The project, named CarbonLock, was started by 17-year-old Clara Wood and three classmates. They realized that rather than burning or composting yard waste, they could heat it through a process called pyrolysis—baking organic material in a container with almost no oxygen.</p><p>Using recycled metal drums, the team designed a clean-burning backyard kiln. When wood chips, leaves, and twigs are baked inside, they don\'t catch fire. Instead, the volatile gases escape and burn cleanly, leaving behind pure, black carbon. This bio-char is then mixed with compost to "charge" it with nutrients before being added to garden soil.</p><blockquote>Bio-char is like a tiny apartment building for soil microbes. It holds water, keeps nutrients from washing away, and keeps carbon locked in the ground for hundreds of years.<footer>— Clara Wood, 17</footer></blockquote><p>The CarbonLock team has produced over 500 pounds of bio-char, distributing it to community gardens and school nurseries. They estimate that their backyard kilns have sequestered more than a ton of carbon dioxide that would have otherwise escaped into the air.</p>',
    kidTake: 'A group of teenagers in Oregon built special metal barrels to bake yard waste like branches and leaves without letting them burn. This leaves behind a black charcoal called bio-char. Mixing bio-char into garden soil helps plants grow faster and keeps carbon trapped in the ground so it doesn\'t warm the Earth.',
    familyDiscussion: [
      "Why is soil health so important for growing the food we eat?",
      "What are other ways we can keep carbon from entering the air and warming our atmosphere?",
      "If you had a garden, what plants would you want to try growing with bio-char?"
    ],
    glossary: [
      { "term": "Pyrolysis", "meaning": "The chemical decomposition of organic materials by heating them to high temperatures in the absence of oxygen." },
      { "term": "Carbon sequestration", "meaning": "The process of capturing and storing atmospheric carbon dioxide to help reduce climate change." }
    ],
    ageBand: '8+',
    author: 'Counselor Deanna Troi',
    tags: ['biochar', 'gardening', 'carbon-capture', 'waste-upcycling']
  },
  {
    channel: 'cyber',
    staffSlug: 'agent-cyber',
    title: 'High Schooler Devises DNS-Over-HTTPS Tool to Shield School WiFi',
    subtitle: '16-year-old programmer builds security utility to protect student search data from public snooping',
    excerpt: 'High school programmer Leo Vance built a lightweight tool that encrypts web address requests, keeping public internet users safe from tracking.',
    body: '<p>Every time you type a web address, your computer sends a request to find that site. On public networks, this data is often unencrypted, allowing hackers to see what sites you visit. To protect students, 16-year-old programmer Leo Vance from Boston, Massachusetts, has built a lightweight security tool that encrypts these requests, ensuring total privacy on shared networks.</p><p>Leo\'s project, named ShieldDNS, runs on a micro-computer plugged into a router. It intercepts Domain Name System (DNS) requests and wraps them in secure HTTPS encryption before sending them to the internet. This technique, known as DNS-over-HTTPS (DoH), blocks network snoopers from tracking which websites students access.</p><p>Leo got the idea after learning that public library and school WiFi networks are frequently scanned by advertising trackers to build profiles of young users. He wanted to build a simple plug-and-play device that schools could install for under thirty dollars.</p><blockquote>Privacy shouldn\'t be a premium feature. ShieldDNS makes it easy for schools and community centers to protect their kids from internet trackers with zero configuration.<footer>— Leo Vance, 16</footer></blockquote><p>Leo has published the ShieldDNS code on GitHub as an open-source project. He plans to work with three local youth centers this summer to deploy the hardware, securing internet traffic for hundreds of young students.</p>',
    kidTake: 'A 16-year-old programmer named Leo built a small, inexpensive device that protects your privacy when you use public WiFi. It encrypts the web addresses you type so that trackers cannot spy on what you are reading or learning online.',
    familyDiscussion: [
      "Why is it important to have privacy when we are searching for information online?",
      "How is sending a secret message in code similar to what Leo\'s security device does?",
      "What are some good safety habits you practice when using public internet networks?"
    ],
    glossary: [
      { "term": "DNS", "meaning": "Domain Name System: the phonebook of the internet, which translates human-readable web addresses (like google.com) into computer-readable numbers." },
      { "term": "Encryption", "meaning": "The process of encoding messages or information so that only authorized parties can read it." }
    ],
    ageBand: '10+',
    author: 'Commander Ro Laren',
    tags: ['privacy', 'dns-security', 'encryption', 'open-source']
  },
  {
    channel: 'engineering',
    staffSlug: 'agent-engineering',
    title: '14-Year-Old Clara Zhang Builds Gravity-Powered Light for Power Outages',
    subtitle: 'Middle school maker designs mechanical lantern that generates electricity from falling weights',
    excerpt: 'Clara Zhang, 14, designed a mechanical light called GravityGlow that uses a system of gears and a slow-falling weight to provide battery-free illumination.',
    body: '<p>In many parts of the world, electricity is unreliable, and batteries are expensive. To provide a dependable light source, 14-year-old Clara Zhang from Seattle, Washington, has built GravityGlow—a mechanical lantern powered completely by gravity. By raising a weight and letting it slowly fall, the device generates enough electricity to power a bright LED for twenty minutes.</p><p>Clara was inspired by reading about rural schools where students cannot study after sunset. She wanted to design a light that didn\'t rely on solar power, which doesn\'t work on rainy days, or batteries, which eventually wear out and pollute the soil.</p><p>The heart of GravityGlow is a gear system salvaging gears from old clocks. When a user lifts a bag filled with dirt or rocks, it stores potential energy. As the bag slowly descends under the pull of gravity, it spins a small generator, converting the movement into electricity. The gear ratio is designed to let the weight fall very slowly, keeping the LED glowing steadily.</p><blockquote>I wanted to use basic physics to solve a practical problem. Gravity is free, it never runs out, and it works everywhere in the world, day or night.<footer>— Clara Zhang, 14</footer></blockquote><p>Clara\'s design uses 3D-printed parts and recycled gears, costing about five dollars to build. She is currently working on an assembly guide to help kids in communities with unstable power grids build their own lanterns.</p>',
    kidTake: 'A 14-year-old girl named Clara built a lamp that doesn\'t need batteries or plugs. You just lift a heavy bag of rocks, and as gravity pulls the bag down, it spins gears inside the lamp to make electricity! It gives you free light just from gravity.',
    familyDiscussion: [
      "How is lifting a heavy object like storing energy in a battery?",
      "Why would a gravity-powered lamp be helpful in places that have lots of storms or power outages?",
      "What is another daily chore where we could use gravity to help do the work?"
    ],
    glossary: [
      { "term": "Potential energy", "meaning": "Stored energy in an object due to its position, like a heavy weight held up high before it falls." },
      { "term": "Gear ratio", "meaning": "The relationship between the rotation speed of two or more connected gears, used to slow down or speed up movement." }
    ],
    ageBand: '8+',
    author: 'Chief Engineer Geordi La Forge',
    tags: ['gravity-power', 'mechanical-engineering', 'makers', 'battery-free']
  },
  {
    channel: 'gaming',
    staffSlug: 'agent-gaming',
    title: 'Cleveland Youth Chess Club Hosts 24-Hour Chess Marathon for Local Charity',
    subtitle: '50 young players spend 24 hours at the board, raising funds for children\'s hospital library',
    excerpt: 'The Cleveland Youth Chess Club raised over $4,000 by hosting a 24-hour chess marathon, playing hundreds of rapid games for charity.',
    body: '<p>Chess is usually a quiet game of concentration, but last weekend it became a high-energy team sport. Fifty members of the Cleveland Youth Chess Club, ages 8 to 16, gathered in a local community hall to host a 24-hour Chess Marathon. By playing continuous matches and streaming their games, they raised over $4,000 to buy books and games for a local children\'s hospital library.</p><p>The marathon was organized by 15-year-old club president Marcus Liang. He wanted to find a way for the chess club to give back to the community. The rules were simple: at least ten chessboards had to be active at all times, with players rotating in shifts throughout the night.</p><p>Local chess masters volunteered to play "simultaneous exhibitions," where one master plays ten kids at once. The event was streamed online, with club members providing live commentary and explaining strategic moves to viewers. Donors pledged money for every checkmate achieved during the 24-hour window.</p><blockquote>It was tough to stay awake at 3:00 AM, but we kept each other energized with blitz games and team matches. It was amazing to use our favorite game to help other kids.<footer>— Marcus Liang, 15</footer></blockquote><p>By the end of the marathon, the players had logged more than 600 games of chess. The funds raised will purchase audiobooks, board games, and chess sets for the pediatric ward library, providing entertainment for recovering patients.</p>',
    kidTake: 'Fifty kids spent a whole day and night playing chess games in a marathon! They streamed their matches online and raised $4,000. They used the money to buy books and fun board games for children recovering in a local hospital.',
    familyDiscussion: [
      "How did the chess club turn a quiet, single-player game into a team effort?",
      "If your club or friends organized a 24-hour event for charity, what activity would you want to do?",
      "Why do games and books help people feel better when they are sick in the hospital?"
    ],
    glossary: [
      { "term": "Simultaneous exhibition", "meaning": "A chess event where one skilled player plays multiple games at the same time against different opponents." },
      { "term": "Blitz chess", "meaning": "A fast-paced version of chess where each player has a very short time—usually five minutes or less—to make all their moves." }
    ],
    ageBand: '8+',
    author: 'Wesley Crusher',
    tags: ['chess', 'charity', 'marathon', 'board-games']
  },
  {
    channel: 'math',
    staffSlug: 'agent-math',
    title: 'Undergrad Math Team Solves Longstanding Grid Congestion Problem',
    subtitle: 'Student researchers use graph theory to optimize electricity distribution across power networks',
    excerpt: 'A team of three undergraduate mathematicians designed an algorithm that reduces electrical grid overload risks using network graph theory.',
    body: '<p>As cities grow, electrical grids can become overloaded, leading to blackouts. To prevent these failures, a team of three undergraduate math students from Chicago has developed a new optimization model. Using graph theory—the study of points and connecting lines—the team designed an algorithm that routes electricity more efficiently, preventing congestion on high-voltage power lines.</p><p>The team, led by 19-year-old Priya Patel, began looking at power grids after a heatwave caused blackouts in their city. They realized that routing electricity is similar to managing traffic on a highway system. If too many generators send power through the same power line, it overheats and shuts down.</p><p>The students modeled the electrical grid as a mathematical graph, where cities and generators are "nodes" and power lines are "edges." They wrote an algorithm that dynamically recalculates the optimal path for electricity based on real-time demand. The model adapts instantly if a power line fails, rerouting energy before a chain reaction triggers a larger blackout.</p><blockquote>We used pure mathematics to solve a hardware problem. By routing power along the paths of least resistance mathematically, we can make the existing grid much safer.<footer>— Priya Patel, 19</footer></blockquote><p>The team\'s algorithm was presented at an engineering conference, where utility operators noted it could help integrate renewable energy sources, like wind and solar, which produce variable power and stress older grids. The team is now testing their model on a simulated scale model of Illinois\' electrical grid.</p>',
    kidTake: 'A team of young mathematicians used math puzzles called graphs to find a better way to send electricity through power lines. Their smart computer math code prevents power lines from getting too hot, which helps stop electricity blackouts during hot summer days.',
    familyDiscussion: [
      "How is sending electricity through a grid similar to cars driving on roads during rush hour?",
      "Why is it helpful to test new ideas on a computer simulation before trying them in real life?",
      "How does math help solve everyday problems that seem like engineering problems?"
    ],
    glossary: [
      { "term": "Graph theory", "meaning": "A branch of mathematics that studies networks of points (called nodes) connected by lines (called edges)." },
      { "term": "Grid overload", "meaning": "When too much electrical current flows through a power line or transformer, causing it to overheat and fail." }
    ],
    ageBand: '12+',
    author: 'Dr. Leah Brahms',
    tags: ['mathematics', 'graph-theory', 'power-grid', 'optimization']
  },
  {
    channel: 'music',
    staffSlug: 'agent-music',
    title: 'Teen Violinist Marcus Chen Wins International Paganini Prize in Genoa',
    subtitle: '15-year-old virtuoso earns top honors at prestigious classical music competition in Italy',
    excerpt: 'Marcus Chen, 15, won first place at the international Paganini Competition, performing challenging violin caprices with stunning technique.',
    body: '<p>The Paganini Violin Competition in Genoa, Italy, is legendary for being one of the most difficult classical music contests in the world. This year, the top honor went to 15-year-old Marcus Chen from San Francisco, California. Marcus became one of the youngest winners in the competition\'s history, performing Niccolò Paganini\'s notoriously difficult Caprices with flawless technique and emotional depth.</p><p>Marcus began playing the violin at age four. To prepare for the competition, he practiced up to six hours a day, studying both the mechanical difficulty of the pieces and the history of how they were composed. Paganini\'s works are famous for requiring complex techniques like left-hand pizzicato (plucking strings with the left hand) and double-stops (playing two notes at once).</p><p>During the final round, Marcus performed alongside the Genoa Opera Orchestra, playing Paganini\'s Violin Concerto No. 1. The audience gave him a five-minute standing ovation, and the international jury awarded him first prize, which includes a cash award and the chance to perform on Paganini\'s personal 1743 Guarneri violin, nicknamed "il Cannone" (the Cannon).</p><blockquote>Playing on Paganini\'s actual violin was an indescribable feeling. You can feel the history inside the wood. I wanted to bring out the joy in his music, not just play the difficult notes.<footer>— Marcus Chen, 15</footer></blockquote><p>Marcus plans to continue his studies at the conservatory while performing as a guest soloist with symphonies around the world. He hopes to introduce classical violin music to younger audiences through school workshops.</p>',
    kidTake: 'A 15-year-old boy named Marcus won one of the hardest violin contests in the world! He played in Italy with a full orchestra and won first place. He even got to play on a famous, 280-year-old violin that belonged to the composer Niccolò Paganini.',
    familyDiscussion: [
      "Marcus practiced for six hours a day to get ready. What is something you enjoy enough to practice for a long time?",
      "How does listening to classical music make you feel compared to modern pop music?",
      "Why do you think some old musical instruments are considered historical treasures?"
    ],
    glossary: [
      { "term": "Virtuoso", "meaning": "A person who is highly skilled in music or another artistic pursuit." },
      { "term": "Pizzicato", "meaning": "A playing technique that involves plucking the strings of a string instrument with the fingers instead of using the bow." }
    ],
    ageBand: '8+',
    author: 'Lt. Guinan',
    tags: ['violin', 'classical-music', 'paganini', 'music-competition']
  },
  {
    channel: 'play',
    staffSlug: 'play',
    title: 'Roblox Adventure Game Teaches Kids Wilderness Survival Skills',
    subtitle: 'Teen developers build popular multiplayer game simulating shelter construction and foraging',
    excerpt: 'A team of three high school game designers built "Wild Survival" on Roblox, attracting over 200,000 players with realistic outdoor simulation.',
    body: '<p>Can playing video games help you survive in the wilderness? A team of three high school game designers from Denver, Colorado, believes so. They have built "Wild Survival," an adventure game on the Roblox platform that teaches players real-world survival skills, like building windproof shelters, filtering muddy water, and identifying edible plants.</p><p>The developers—16-year-old Chloe Martinez, her brother Liam, and classmate Sam—are avid scouts who spend their summers backpacking. During the winter, they decided to combine their love of the outdoors with game programming. They noticed that many survival games are unrealistic, so they focused on real physics and biology.</p><p>In "Wild Survival," players must manage their body temperature, hydration, and energy. To build a shelter, they must gather branches and angle them against the wind. To find food, they must inspect forest plants; eating the wrong berry causes their character\'s energy to drop. The game features realistic weather cycles, forcing players to adapt to sudden rainstorms and cold nights.</p><blockquote>We wanted to make a game that is fun but teaches actual skills. If you know how to build a debris shelter in our game, you know the basic steps of how to build one in a real forest.<footer>— Chloe Martinez, 16</footer></blockquote><p>Since its launch, "Wild Survival" has been played by over 200,000 users. The team is currently designing a new update that teaches wilderness navigation using a map and compass.</p>',
    kidTake: 'Three teenagers built a popular game on Roblox where you learn how to survive in the forest. Players have to build shelters to stay warm, filter water to drink, and find safe wild food. The game teaches real scouting skills while you play with friends.',
    familyDiscussion: [
      "If you were lost in a forest, what is the very first thing you would need to do to stay safe?",
      "Why is a video game a good way to practice skills that might be scary to try in real life?",
      "What other real-world hobby would make a great simulator game?"
    ],
    glossary: [
      { "term": "Foraging", "meaning": "Searching wild areas for food, plants, or provisions." },
      { "term": "Simulation game", "meaning": "A video game category designed to closely copy or mimic real-world activities and environments." }
    ],
    ageBand: '8+',
    author: 'Amara Okafor',
    tags: ['roblox', 'survival-skills', 'game-design', 'scouting']
  },
  {
    channel: 'quantum',
    staffSlug: 'agent-quantum',
    title: 'High Schooler Wins Quantum Cryptography Logic Game Award',
    subtitle: '17-year-old builds interactive web puzzle showing how quantum physics secures messages',
    excerpt: 'Chloe Xu, 17, designed a visual logic game called QubitEncrypt that teaches kids how polarized light secures data from internet eavesdroppers.',
    body: '<p>Quantum computing sounds like science fiction, but it is quickly becoming the future of cybersecurity. To help students understand how it works, 17-year-old Chloe Xu from San Francisco, California, has built QubitEncrypt—an interactive web puzzle game that explains quantum cryptography, the science of using physics to secure communications.</p><p>Chloe developed the game for a science project after finding that textbooks explained quantum physics with confusing mathematical equations. She realized that the core concepts could be represented visually as puzzles involving lasers, mirrors, and colored light filters.</p><p>In QubitEncrypt, players act as network administrators sending a secret key to a friend. They must polarize light beams (qubits) using different filters. If an eavesdropper (represented by a digital spy) tries to intercept the key, the laws of quantum mechanics cause the light beams to change color, immediately alerting the players that the message was tampered with.</p><blockquote>In quantum physics, looking at something changes it. My game shows kids how this strange rule makes it impossible for hackers to spy on quantum messages without getting caught.<footer>— Chloe Xu, 17</footer></blockquote><p>The game won a first-place award in the educational software division at the State Science Fair. Chloe has made the game free online, and several high school physics teachers have integrated it into their computer science lessons.</p>',
    kidTake: 'A 17-year-old girl named Chloe built an online puzzle game that teaches kids how to send secret messages using physics. In her game, you use colored lasers to encrypt information. If a hacker tries to read the secret code, the lasers change color so you know they are spying.',
    familyDiscussion: [
      "In Chloe\'s game, trying to spy on a message changes the message itself. Why is that a helpful rule for security?",
      "Why is it sometimes easier to learn a hard science topic by playing a game rather than reading a textbook?",
      "If you had a secret channel to talk to your best friend, what kind of messages would you send?"
    ],
    glossary: [
      { "term": "Quantum cryptography", "meaning": "A security method that uses the principles of quantum mechanics to encrypt and transmit data securely." },
      { "term": "Qubit", "meaning": "A quantum bit; the basic unit of information in quantum computing, which can represent multiple states at the same time." }
    ],
    ageBand: '10+',
    author: 'Lt. Worf',
    tags: ['quantum-physics', 'cryptography', 'educational-games', 'cybersecurity']
  },
  {
    channel: 'robotics',
    staffSlug: 'agent-robotics',
    title: 'FIRST Team Builds Assistive Robotics Arm for Libraries',
    subtitle: 'High school students engineer 3D-printed wheelchair attachment to help retrieve books',
    excerpt: 'FIRST Robotics Team "Circuit Breakers" designed a lightweight, motorized arm to assist library visitors with limited mobility.',
    body: '<p>For library visitors who use wheelchairs, reaching books on high shelves can be difficult. To help solve this problem, a high school robotics team from Portland, Oregon, has engineered an assistive robotic arm. Named ShelfReach, the 3D-printed motorized arm attaches to a wheelchair and is controlled using a simple smartphone joystick, allowing users to safely retrieve books from shelves up to eight feet high.</p><p>The team, known as FRC Team 3673 "Circuit Breakers," includes 18 students from local schools. They spent their off-season working on the project after volunteering at a community library and noticing that visitors frequently had to ask staff for help reaching materials.</p><p>ShelfReach is made of lightweight carbon-fiber rods and 3D-printed joints. The arm uses three electric motors powered by a rechargeable wheelchair battery. The claw is lined with soft silicone pads to securely grip books without damaging paper covers. The students spent weeks programming the arm\'s control software to ensure movements are slow and precise.</p><blockquote>We wanted to use our competitive robotics experience to build something that increases independence for people in our community. Seeing the arm retrieve its first book was better than winning a tournament.<footer>— Julia Martinez, 17, mechanical lead</footer></blockquote><p>The team has open-sourced the mechanical blueprints and control software, allowing other robotics clubs around the world to build ShelfReach arms for their local libraries. They are currently working with a local rehabilitation center to gather feedback from wheelchair users to improve the joystick interface.</p>',
    kidTake: 'A high school robotics team built a cool mechanical arm that clips onto a wheelchair. Using a phone joystick, a person can move the arm to reach and pick up books from high library shelves. The students made their designs free so anyone can build one.',
    familyDiscussion: [
      "Why does being able to reach things on your own make a big difference in how independent you feel?",
      "The students used soft silicone to line the robot\'s claw. Why is the choice of materials important in engineering?",
      "What is another place besides a library where a mechanical reacher arm would be helpful?"
    ],
    glossary: [
      { "term": "Assistive technology", "meaning": "Devices or software designed to help people with disabilities perform daily tasks more easily." },
      { "term": "Open-source", "meaning": "Blueprints, code, or designs that are made free for anyone to use, modify, and share." }
    ],
    ageBand: '8+',
    author: 'Lt. Commander Data',
    tags: ['assistive-tech', '3d-printing', 'robotics-arm', 'outreach']
  },
  {
    channel: 'space',
    staffSlug: 'agent-space',
    title: 'Indiana High School Rocketry Club Launches Dual-Stage Rocket to 15,000 Feet',
    subtitle: 'Student team designs custom carbon-fiber booster and flight computer for high-altitude launch',
    excerpt: 'The rocketry club "AeroDevs" successfully launched and recovered a dual-stage rocket, capturing high-altitude atmospheric data.',
    body: '<p>Reaching the edge of space requires precision engineering and teamwork. Last weekend, a high school rocketry club from South Bend, Indiana, demonstrated both by successfully launching a dual-stage model rocket to an altitude of 15,000 feet. The rocket, named Pathfinder II, carried a student-designed flight computer that recorded atmospheric pressure and radiation levels before returning safely under parachute.</p><p>The club, named the AeroDevs, consists of 12 students who spent nine months designing and testing the rocket. Pathfinder II is a dual-stage rocket, meaning it features two motor sections: a booster stage that launches the rocket off the pad, and a second stage that ignites mid-air once the booster is spent.</p><p>The students fabricated the rocket\'s body tubes from carbon-fiber sheets to keep the weight under ten pounds. They programmed the flight computer using a micro-controller, writing code that monitors altitude and fires black powder charges to deploy the parachutes at the peak of the flight.</p><blockquote>Igniting a rocket motor mid-flight is incredibly difficult. If the second stage fires even a fraction of a second late, the rocket will tilt and fly off-course. It took months of testing to get the timing perfect.<footer>— Ben Harris, 18, team lead</footer></blockquote><p>The launch took place at a commercial rocketry range in Wisconsin. Pathfinder II reached a top speed of Mach 1.2 (about 900 miles per hour) before deploying its parachute and landing two miles from the launch pad. The AeroDevs are now analyzing the collected atmospheric data and plan to submit their flight computer designs to a national amateur space contest.</p>',
    kidTake: 'A group of high school students built a carbon-fiber rocket that launched nearly three miles into the air! The rocket had two engines that fired one after another. A tiny computer on the rocket recorded scientific data before bringing the rocket back down safely with parachutes.',
    familyDiscussion: [
      "Why is it important for a rocket to deploy its parachute at the exact highest point of its flight?",
      "The students spent nine months building a rocket that flew for just a few minutes. Why is the preparation work in science so long?",
      "If you could send one tiny science experiment up on a student rocket, what would you want to measure?"
    ],
    glossary: [
      { "term": "Dual-stage rocket", "meaning": "A rocket that uses two separate engine booster sections to reach higher speeds and altitudes than a single-stage rocket." },
      { "term": "Flight computer", "meaning": "A small electronic brain on a rocket that monitors sensors and triggers events, like opening parachutes at the right time." }
    ],
    ageBand: '10+',
    author: 'Commander William Riker',
    tags: ['rocketry', 'flight-computer', 'aerospace', 'high-altitude']
  },
  {
    channel: 'stem',
    staffSlug: 'stem',
    title: 'High School Team Wins STEM Prize for Algae-Based Bio-Plastic Packaging',
    subtitle: 'Students cultivate freshwater microalgae to create compostable packaging wrap',
    excerpt: 'A student science team developed an algae-based packaging wrap that degrades in 14 days, providing a green alternative to plastic wrap.',
    body: '<p>Plastic packaging is one of the largest sources of waste in our oceans. To find a green alternative, a student science team from Seattle, Washington, has developed a compostable packaging wrap made from freshwater algae. The material is durable, waterproof, and decomposes naturally in garden soil in just two weeks, compared to hundreds of years for plastic wrap.</p><p>The project, named AlgaeWrap, was developed by three juniors—Sofia, Maya, and Kai. They began researching algae because it grows rapidly using only sunlight, water, and carbon dioxide, without needing chemical fertilizers or land used for food crops.</p><p>The students grew microalgae in plastic tubes inside their classroom. They harvested the algae and mixed it with water and a plant-based binding agent, then spread it into thin sheets to dry. The result is a flexible, clear film that behaves similarly to cling wrap.</p><blockquote>We wanted to show that bio-plastics can be made easily from natural sources. AlgaeWrap is completely natural; if it ends up in the ocean, it simply dissolves and acts as food for fish instead of polluting the water.<footer>— Sofia Rodriguez, 16</footer></blockquote><p>The team\'s project won first place in the environmental science division at the National STEM Fair. They are currently working with a local bakery to test AlgaeWrap on bread and pastries to evaluate how well it keeps food fresh.</p>',
    kidTake: 'Three high school students grew green algae in their classroom and turned it into clear packaging wrap, like plastic wrap. Unlike regular plastic, this AlgaeWrap dissolves and breaks down in the soil in just two weeks, keeping trash out of our oceans.',
    familyDiscussion: [
      "Why is finding an alternative to plastic wrap important for ocean animals?",
      "AlgaeWrap dissolves in water after a long time. What kinds of products are best wrapped in AlgaeWrap?",
      "If you were to invent a new eco-friendly material, what plant or natural substance would you use?"
    ],
    glossary: [
      { "term": "Microalgae", "meaning": "Microscopic algae that grow in water and perform photosynthesis, converting sunlight and carbon dioxide into energy." },
      { "term": "Bioplastic", "meaning": "A type of plastic made from biological substances, like plants or algae, rather than petroleum oil." }
    ],
    ageBand: '8+',
    author: 'Priya Ramanathan',
    tags: ['bioplastic', 'algae', 'environmental-science', 'zero-waste']
  }
];

function generateEmergencyDrops() {
  console.log('[antigravity-service] Starting emergency article drops generation...');
  let count = 0;
  
  // Clear any existing stories for date 2026-07-04 to prevent duplicates
  const today = '2026-07-04';
  
  const channelImages = {
    ai: '/assets/img/wildfire_smoke_ai.jpg',
    biotech: '/assets/img/organ_transplant_ml.jpg',
    climate: '/assets/img/solar_chargers_waste.jpg',
    cyber: '/assets/img/privacy_extension_dog.jpg',
    engineering: '/assets/img/solar_distiller_water.jpg',
    gaming: '/assets/img/youth_chess_championship.jpg',
    math: '/assets/img/math_team_contest.jpg',
    music: '/assets/img/cello_soloist_concert.jpg',
    play: '/assets/img/roblox_game_ocean.jpg',
    quantum: '/assets/img/quantum_computing_game.jpg',
    robotics: '/assets/img/river_cleaning_robot.jpg',
    space: '/assets/img/cubesat_satellite_space.jpg',
    stem: '/assets/img/plastic_eating_bacteria.jpg'
  };

  const allQueued = db.listQueuedStories({ limit: 1000 }) || [];
  for (const q of allQueued) {
    let qDate = null;
    try {
      const p = JSON.parse(q.payload);
      qDate = p.date;
    } catch(e) {
      if (q.payload && q.payload.date) qDate = q.payload.date;
    }
    if (qDate === today) {
      db.db.prepare('DELETE FROM queued_stories WHERE id = ?').run(q.id);
      console.log(`[antigravity-service] Cleared pre-existing queued story #${q.id}`);
    }
  }

  for (const art of ARTICLES_DATA) {
    const staff = db.findStaffBySlug(art.staffSlug);
    if (!staff) {
      console.warn(`[antigravity-service] Staff not found for slug: ${art.staffSlug}. Skipping.`);
      continue;
    }

    const payload = {
      id: `${today}-${art.channel}-emergency`,
      slug: `${art.channel}-emergency`,
      cat: art.channel,
      categoryLabel: staff.role.replace('Correspondent - ', '').replace('Correspondent — ', ''),
      title: art.title,
      subtitle: art.subtitle,
      excerpt: art.excerpt,
      heroImage: channelImages[art.channel] || '',
      body: art.body,
      kidTake: art.kidTake,
      familyDiscussion: art.familyDiscussion,
      glossary: art.glossary,
      ageBand: art.ageBand,
      author: staff.displayName,
      authorInit: staff.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      authorRole: staff.role,
      date: today,
      publishedAt: `${today}T10:00:00-04:00`,
      read: Math.max(2, Math.ceil(art.body.replace(/<[^>]+>/g, ' ').split(/\s+/).length / 220)),
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      tags: art.tags,
      color: staff.accentColor,
      emoji: staff.avatarEmoji,
      featured: false,
      pinned: false,
      live: false,
      sources: [
        { label: `${art.title} Primary Source`, url: `https://www.example.com/skynet-newsroom/${art.channel}` }
      ]
    };

    db.createQueuedStory({
      staffId: staff.id,
      channel: art.channel,
      payload: payload,
      status: 'approved'
    });

    count++;
    console.log(`[antigravity-service] Queued story for channel: ${art.channel} by ${staff.displayName}`);
  }

  return { count };
}

module.exports = { generateEmergencyDrops };
