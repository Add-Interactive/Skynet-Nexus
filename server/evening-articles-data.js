// server/evening-articles-data.js
// 13 fresh youth-first articles for the July 5th Evening Drop

const EVENING_ARTICLES = [
  {
    channel: 'ai',
    staffSlug: 'agent-ai',
    title: '15-Year-Old Coder Trains AI Model to Translate Sign Language in Real Time',
    subtitle: 'High school sophomore uses laptop webcam and computer vision to translate gestures to spoken English',
    excerpt: 'Liam Patel built a lightweight AI translator that translates American Sign Language (ASL) finger-spelling instantly.',
    body: '<p>Communication is the bridge that connects us, but for the deaf and hard-of-hearing, interacting with people who do not know sign language can be a challenge. To help close this gap, 15-year-old Liam Patel from Austin, Texas, has developed signSpeak—a browser-based AI tool that uses a standard webcam to translate American Sign Language (ASL) finger-spelling into spoken English in real time.</p><p>Liam, whose older sister is deaf, saw how often she had to type out messages on her phone to communicate with retail workers or teachers. He wondered if modern computer vision could make this interaction more natural.</p><p>Using a database of over 50,000 images of hands forming ASL letters and basic words, Liam trained a deep learning neural network to recognize the subtle orientation of fingers and wrist angles. He optimized the model so it could run directly in a standard web browser, without needing to upload video data to an external server.</p><blockquote>I wanted to create something that runs on any cheap laptop with a basic webcam. If we can make sign language translation free and instant, we can make public spaces much more inclusive.<footer>— Liam Patel, 15</footer></blockquote><p>In testing, signSpeak achieved a 96 percent accuracy rate. Liam has shared the tool with several local schools and is currently working on expanding the AI database to include full-phrase sign gestures, rather than just finger-spelled letters.</p>',
    kidTake: 'A 15-year-old kid named Liam built a computer program that listens to hand signs instead of voices. If a person makes sign language gestures in front of a webcam, the AI instantly speaks the letters out loud in English.',
    familyDiscussion: [
      "Why is it important to create tools that help people with different abilities communicate?",
      "Liam built this tool to help his sister. What is something you\'ve made or done to help a sibling or friend?",
      "What are other ways we can use computer webcams to help people in their daily lives?"
    ],
    glossary: [
      { "term": "ASL", "meaning": "American Sign Language; a complete, natural language that uses hand gestures, facial expressions, and body postures." },
      { "term": "Deep learning", "meaning": "A subset of artificial intelligence that uses multi-layered neural networks to learn patterns from complex data like images." }
    ],
    ageBand: '8+',
    tags: ['ai', 'asl-translation', 'accessibility', 'computer-vision']
  },
  {
    channel: 'space',
    staffSlug: 'agent-space',
    title: 'New Hampshire High School Team Launches High-Altitude Balloon to Capture Cosmic Radiation',
    subtitle: 'Student science club sends payload to 95,000 feet, recording atmospheric ionization data',
    excerpt: 'The "StratoScholars" high school team built a custom sensor payload that successfully tracked radiation levels near the stratosphere.',
    body: '<p>Measuring cosmic radiation from the ground is difficult because Earth\'s thick atmosphere acts as a protective shield. To study these high-energy particles directly, a high school science club from Concord, New Hampshire, has launched a weather balloon carrying a custom-built sensor payload to an altitude of 95,000 feet, capturing valuable atmospheric data near the edge of space.</p><p>The team of five students, known as the StratoScholars, spent six months designing the flight payload. They had to construct a lightweight, insulated styrofoam capsule to keep their sensors functioning in temperatures that dropped below minus-60 degrees Fahrenheit.</p><p>The capsule carried a Geiger counter to measure radiation levels and a flight computer that logged GPS coordinates, temperature, and atmospheric pressure. After a two-hour ascent, the balloon burst as planned, and the capsule floated back to Earth under a parachute, where the students retrieved it from a forest using a GPS tracker.</p><blockquote>Tracking the balloon\'s live GPS signal as it crossed 90,000 feet was incredibly exciting. Analyzing the radiation data we collected is showing us exactly how our atmosphere blocks cosmic rays.<footer>— Clara Wood, 17, project lead</footer></blockquote><p>The team\'s data showed that cosmic radiation levels increase ten-fold once the weather balloon crosses the lower atmosphere. The students have posted their data online for other high school science classes to study.</p>',
    kidTake: 'A team of high school students sent a giant helium balloon nearly 18 miles high into the sky! The balloon carried a small capsule with sensors to measure radiation from outer space. The capsule parachuted back down, and the kids found it in the forest using GPS.',
    familyDiscussion: [
      "What is cosmic radiation? Why is it safer for us on the ground than it is for astronauts in space?",
      "Clara\'s team had to find their capsule in a deep forest. What is the most exciting adventure you\'ve had outdoors?",
      "If you could send one small object up in a high-altitude balloon, what would it be?"
    ],
    glossary: [
      { "term": "Geiger counter", "meaning": "An instrument used for detecting and measuring ionizing radiation, like cosmic rays." },
      { "term": "Stratosphere", "meaning": "The second major layer of Earth\'s atmosphere, extending from about 6 to 31 miles above the surface." }
    ],
    ageBand: '10+',
    tags: ['space-science', 'weather-balloon', 'cosmic-radiation', 'flight-data']
  },
  {
    channel: 'robotics',
    staffSlug: 'agent-robotics',
    title: 'High School Club Designs Autonomous Beach-Cleaning Rover for Coastal Cleanup',
    subtitle: 'Students build 3D-printed robot equipped with rotating sieve to filter microplastics from sand',
    excerpt: 'The "EcoBots" club engineered a motorized rover that clears small plastic debris from community beaches.',
    body: '<p>While large plastic bottles are easy to pick up, tiny microplastics—small fragments of degraded trash—often remain mixed in beach sand, posing a threat to marine life. To tackle this, a high school robotics club from Galveston, Texas, has designed and built an autonomous beach-cleaning rover named EcoSweep. The robot drives along the coastline, scooping up sand and filtering out microplastics using a rotating motorized sieve.</p><p>The student team of eight spent their winter break designing the rover\'s tread system to navigate loose, wet sand and coding its GPS navigation software.</p><p>Powered by a solar-charged battery, EcoSweep uses an onboard camera and AI to detect and follow the tide line, where microplastics are most concentrated. The rover scoops sand into a rotating cylinder sieve. Sand falls back onto the beach through tiny holes, while plastic pieces larger than two millimeters are collected in a hopper.</p><blockquote>Large cleanups miss the tiny plastics that birds and fish eat. We built EcoSweep to filter the sand automatically so we can keep these chemicals out of the food chain.<footer>— Sarah Jenkins, 17, lead mechanical designer</footer></blockquote><p>The club has run several tests at Galveston Beach, clearing over ten pounds of microplastics in a single weekend. They are now working on open-sourcing the rover\'s mechanical blueprints so coastal communities worldwide can build their own beach-cleaning rovers.</p>',
    kidTake: 'A high school robotics team built a motorized sand-sifting robot that cleans beaches. The robot drives along the shore, scoops up sand, shakes it through a metal screen, and collects tiny plastic trash pieces while leaving the clean sand behind.',
    familyDiscussion: [
      "Why are tiny plastic pieces in the sand dangerous for birds and fish?",
      "Sarah\'s team focused on a problem that large cleanups miss. Why is it important to pay attention to small details?",
      "If you were designing a cleaning robot, what environment (park, ocean, street) would you want it to clean?"
    ],
    glossary: [
      { "term": "Microplastics", "meaning": "Tiny plastic particles less than five millimeters in size, which result from the breakdown of larger plastic products." },
      { "term": "Sieve", "meaning": "A tool with mesh or perforated holes used to separate smaller particles from larger ones." }
    ],
    ageBand: '8+',
    tags: ['robotics', 'beach-cleanup', 'microplastics', 'marine-conservation']
  },
  {
    channel: 'biotech',
    staffSlug: 'agent-biotech',
    title: '16-Year-Old Student Isolates Soil Bacteria That Accelerates Composting',
    subtitle: 'Research shows local bacterial strain speeds up breakdown of organic food waste by 50 percent',
    excerpt: 'Chloe Kim discovered a local soil bacterium that breaks down organic starch and cellulose in half the usual time.',
    body: '<p>Composting organic waste is a great way to recycle nutrients back into the earth, but the process can take months. To help speed things up, 16-year-old Chloe Kim from Seattle, Washington, has isolated a unique strain of soil bacteria that accelerates the breakdown of kitchen compost. Her research shows that introducing this bacterium to a standard compost pile reduces composting time by half.</p><p>Chloe, a biology student, became interested in soil chemistry while helping in her school\'s greenhouse. She wondered why some compost bins broke down materials much faster than others.</p><p>She collected soil samples from forest floors and compost piles, isolating different bacterial colonies in petri dishes. By feeding the bacteria different organic substrates—like cellulose and starch—she identified a high-performing strain of Bacillus bacteria that produces large amounts of organic enzymes.</p><blockquote>Composting is usually a slow process. By boosting the naturally occurring bacteria, we can turn food scraps into rich soil booster in weeks instead of months.<footer>— Chloe Kim, 16</footer></blockquote><p>Chloe\'s bacterial culture was tested on school compost bins, reducing the breakdown cycle from 12 weeks to just six. She won a first-place award at the regional science fair and is currently working on packaging the dried bacteria so home gardeners can use it.</p>',
    kidTake: 'A 16-year-old girl named Chloe found a special helper bacteria in forest soil. When you add this bacteria to kitchen waste like apple cores and potato peels, it helps them rot and turn into healthy garden soil twice as fast.',
    familyDiscussion: [
      "What is composting? Why is it better to compost food scraps than throw them in the trash?",
      "Chloe found her helper bacteria by exploring the forest floor. What is something interesting you have observed in nature?",
      "How do bacteria help keep our gardens and forests healthy?"
    ],
    glossary: [
      { "term": "Cellulose", "meaning": "An organic compound that makes up the cell walls of plants; it gives plants structure but is hard to break down." },
      { "term": "Enzyme", "meaning": "A chemical substance produced by living organisms that helps speed up chemical reactions, like digestion or decomposition." }
    ],
    ageBand: '10+',
    tags: ['biotech', 'composting', 'soil-biology', 'science-fair']
  },
  {
    channel: 'quantum',
    staffSlug: 'agent-quantum',
    title: '16-Year-Old Programmer Builds Visual Game Explaining Quantum Entanglement',
    subtitle: 'Student codes interactive maze game "SpookyAction" to teach kids quantum mechanics basics',
    excerpt: 'Aris Thorne built a browser game where players must entangle particles to solve logic puzzles.',
    body: '<p>Quantum entanglement sounds like science fiction—it is the phenomenon where two particles become linked so that what happens to one instantly affects the other, no matter how far apart they are. To explain this strange rule, 16-year-old Aris Thorne from Boston, Massachusetts, has coded SpookyAction—an interactive web-based puzzle game that introduces middle schoolers to quantum mechanics.</p><p>Aris, who enjoys coding and physics, noticed that textbooks described entanglement using complicated physics math that confused his friends. He wanted to see if the concept could be represented visually as a game.</p><p>In SpookyAction, players control a pair of entangled particles navigating through a maze. When one particle moves or rotates, the other particle mimics its movements instantly, even if they are in different chambers. Players must use this connection to press switches, bypass security lasers, and unlock doors together.</p><blockquote>Albert Einstein called quantum entanglement \'spooky action at a distance.\' My game shows kids that this spooky rule is actually a cool tool for solving puzzles.<footer>— Aris Thorne, 16</footer></blockquote><p>The game won a first-place award in the educational software division at the State Science Fair. Aris has made the game free online, and several high school physics teachers have integrated it into their lesson plans.</p>',
    kidTake: 'A 16-year-old programmer built an online maze game called SpookyAction. In the game, you move two magic particles that are linked together. When you move one particle, the other one moves the exact same way, helping you solve puzzles.',
    familyDiscussion: [
      "In Aris\'s game, moving one particle instantly changes another. Why is that a helpful rule for solving puzzles?",
      "Why is it sometimes easier to learn a hard science topic by playing a game rather than reading a textbook?",
      "If you had a magic link with your best friend where they felt whatever you felt, how would you use it?"
    ],
    glossary: [
      { "term": "Quantum entanglement", "meaning": "A physical phenomenon where two or more particles become interconnected, so that the state of one instantly dictates the state of the other." },
      { "term": "Superposition", "meaning": "The ability of a quantum particle to exist in multiple states at the same time until it is measured." }
    ],
    ageBand: '10+',
    tags: ['quantum-physics', 'educational-games', 'javascript', 'physics']
  },
  {
    channel: 'climate',
    staffSlug: 'agent-climate',
    title: 'Teenagers Launch Cafeteria Food Waste Audit, Slashing Waste by 40 Percent',
    subtitle: 'Student-led initiative in local high school introduces smart compost bins and meal portion adjustments',
    excerpt: 'Eugene High School students cut cafeteria trash by over 200 pounds a week through custom compost tracking.',
    body: '<p>School cafeterias serve thousands of meals a day, but they also generate a massive amount of food waste. To address this issue, a team of high school students in Eugene, Oregon, has launched a student-led food waste audit. Through careful measurement, composting, and menu adjustments, the students have successfully cut their school\'s cafeteria waste by 40 percent, keeping tons of organic trash out of local landfills.</p><p>The project, named PlateCheck, was started by 17-year-old Clara Wood and three classmates. They noticed that a large amount of healthy food was being scraped into trash bins at the end of lunch every day.</p><p>The team set up sorting stations where students separated food scraps, recyclables, and trash. They used digital scales to weigh the food waste daily, logging the data in a spreadsheet. They shared their findings with the cafeteria kitchen staff, showing which meals had the highest waste and helping adjust portion sizes accordingly.</p><blockquote>We wanted to show people that food waste isn\'t just a kitchen problem. When we track what we throw away, we can make small changes that save money and protect the planet.<footer>— Clara Wood, 17</footer></blockquote><p>The PlateCheck initiative has successfully diverted over 200 pounds of food waste per week into community compost bins. The school district is now planning to expand the audit program to four other high schools this fall.</p>',
    kidTake: 'A group of teenagers in Oregon set up sorting scales in their school lunchroom to weigh leftovers. By showing the kitchen staff what food kids threw away most, they helped adjust lunch recipes and cut trash by 40 percent.',
    familyDiscussion: [
      "Why is throwing away food bad for the environment and for communities?",
      "Clara\'s team worked with the school kitchen to solve a problem. How can we reduce food waste in our own home?",
      "What is your favorite school lunch? If you could suggest a recipe change to the cafeteria, what would it be?"
    ],
    glossary: [
      { "term": "Food waste audit", "meaning": "A structured process to measure, record, and analyze the amount of food that is thrown away in a home or facility." },
      { "term": "Diversion rate", "meaning": "The percentage of waste that is recycled, composted, or reused instead of being sent to a landfill." }
    ],
    ageBand: '8+',
    tags: ['climate-action', 'food-waste', 'composting', 'school-project']
  },
  {
    channel: 'engineering',
    staffSlug: 'agent-engineering',
    title: 'Students Build Prototype Solar-Powered Water Distiller for Coastal Communities',
    subtitle: 'High school team uses recycled mirrors and copper pipes to purify seawater using sunlight',
    excerpt: 'A three-student team engineered a solar distiller that yields two gallons of clean drinking water daily from sea water.',
    body: '<p>For coastal communities facing water scarcity, seawater is abundant but undrinkable. To help solve this problem, a team of three high school students from Miami, Florida, has built a prototype solar-powered water distiller. Named SolarDistill, the device uses recycled parabolic mirrors and copper pipes to heat seawater, condensing the vapor into pure, clean drinking water using only energy from the sun.</p><p>The students—Priya Ramanathan, 16, Maya Ortiz, 16, and Liam Vance, 17—spent their engineering class designing the solar concentrator. They realized that curved mirrors could focus sunlight onto a central pipe, raising water temperatures rapidly.</p><p>Seawater is pumped into a copper pipe placed at the focal line of a curved mirror. The intense heat boils the water, turning it into steam. The steam is channeled into a condensation tube cooled by incoming sea water, turning the vapor back into liquid. The salt and impurities are left behind in the boiling chamber, leaving pure water.</p><blockquote>We wanted to build a simple, clean water system that runs without electricity. SolarDistill can be made using local scrap metal and plastic pipes, making it cheap to build in remote areas.<footer>— Priya Ramanathan, 16</footer></blockquote><p>The prototype distiller successfully produces two gallons of clean drinking water a day. The team won a first-place award in the environmental engineering division at the State Science Fair.</p>',
    kidTake: 'Three students built a sun-powered machine that turns salty ocean water into clean drinking water. The machine uses curved mirrors to heat up the water until it turns into steam, leaving the salt behind, and then cools the steam into fresh water.',
    familyDiscussion: [
      "Why is fresh water so important for coastal communities even though they live right next to the ocean?",
      "Priya\'s team built their distiller out of recycled metal and plastic. Why is it helpful to build things out of materials you can find nearby?",
      "What is another way we can use the sun\'s heat to help people in their daily lives?"
    ],
    glossary: [
      { "term": "Distillation", "meaning": "A process of purifying a liquid by heating it to create vapor, and then cooling the vapor to collect the purified liquid." },
      { "term": "Parabolic mirror", "meaning": "A curved mirror shaped like a bowl that reflects light rays to a single focal point, generating intense heat." }
    ],
    ageBand: '8+',
    tags: ['engineering', 'solar-energy', 'water-purification', 'green-tech']
  },
  {
    channel: 'math',
    staffSlug: 'agent-math',
    title: '17-Year-Old Data Scientist Wins National Modeling Prize for Traffic Optimization Algorithm',
    subtitle: 'High school senior codes mathematical model that minimizes bottleneck delays at school crossings',
    excerpt: 'Sophia Patel designed a coordinate-free queue model that reduces morning traffic delays by 25 percent.',
    body: '<p>Morning drop-offs at schools can create traffic bottlenecks that delay buses, frustrate parents, and increase carbon emissions from idling cars. To address this, 17-year-old Sophia Patel, a high school senior from Boston, Massachusetts, has written a mathematical model that optimizes car flow through school crossings, reducing morning traffic delays by 25 percent.</p><p>Sophia, a member of her school\'s math team, noticed that the daily traffic jam followed a predictable pattern. She realized that traffic flow could be represented mathematically as a queue network—a system where cars are treated as moving particles passing through bottlenecks.</p><p>Using coordinate-free geometry and queue theory, Sophia wrote a computer simulation that models traffic patterns. She proved that adjusting traffic light timing by just six seconds and rearranging drop-off lane markers could significantly increase flow rate.</p><blockquote>Traffic isn\'t just random cars; it\'s a math puzzle. By adjusting lane geometry and light timing, we can keep traffic moving smoothly and reduce carbon emissions.<footer>— Sophia Patel, 17</footer></blockquote><p>Sophia\'s research won a young investigator award from the National Council of Teachers of Mathematics. Her school district has implemented her lane design, reducing morning drop-off queue times significantly.</p>',
    kidTake: 'An 17-year-old girl named Sophia wrote a math paper that explains how to stop school traffic jams. She used math models to rearrange drop-off lanes and traffic lights, cutting morning traffic delays by 25 percent.',
    familyDiscussion: [
      "Have you ever been stuck in a traffic jam? How did it make you feel?",
      "Sophia used math to solve a real-world problem in her neighborhood. What is a neighborhood problem you\'d like to solve?",
      "How do you think keeping cars moving instead of idling helps the environment?"
    ],
    glossary: [
      { "term": "Queue theory", "meaning": "The mathematical study of waiting lines, or queues, used to predict queue lengths and waiting times in systems." },
      { "term": "Bottleneck", "meaning": "A point of congestion in a system, such as a narrow road, that slows down progress or movement." }
    ],
    ageBand: '10+',
    tags: ['mathematics', 'traffic-modeling', 'data-science', 'optimization']
  },
  {
    channel: 'cyber',
    staffSlug: 'agent-cyber',
    title: 'Student Programmer Builds Chrome Extension to Shield Kids from Online Ad Trackers',
    subtitle: '14-year-old creates open-source privacy extension that blocks corporate telemetry on educational sites',
    excerpt: 'Leo Pixel built "PrivacyPup", a privacy extension that intercepts tracking scripts on popular school websites.',
    body: '<p>Many educational websites are helpful, but they often carry hidden tracking scripts that collect data on student browsing habits. To help keep kids safe online, 14-year-old Leo Pixel from Denver, Colorado, has coded PrivacyPup—a free, open-source Google Chrome extension that blocks tracking scripts on popular school websites.</p><p>Leo, a student coder, became interested in internet privacy after learning how advertising networks build profiles on web users. He realized that while adults use ad blockers, kids often use school-managed chromebooks without privacy protection.</p><p>Using JavaScript, Leo wrote a lightweight extension that monitors web requests. The extension runs in the background, matching incoming scripts against a database of known telemetry networks and blocking them before they can run in the browser. It displays a cute cartoon dog that "barks" when a tracker is blocked, showing a counter of blocked scripts.</p><blockquote>Kids should be able to learn online without being tracked by advertising companies. I built PrivacyPup to keep our school chromebooks private and safe.<footer>— Leo Pixel, 14</footer></blockquote><p>PrivacyPup has been downloaded over 5,000 times by parents, students, and teachers. Leo has open-sourced the code on GitHub so other student programmers can contribute to the tracking database.</p>',
    kidTake: 'A 14-year-old kid named Leo built a privacy extension for school computers. It features a cartoon dog that bark-blocks tracking scripts, keeping companies from spying on what you learn online.',
    familyDiscussion: [
      "What is internet privacy? Why is it important to keep our personal information private online?",
      "Leo\'s extension uses a cartoon dog to make security fun. How can design make technology easier to understand?",
      "What is a website you use for school? Why do you think it needs to be safe and private?"
    ],
    glossary: [
      { "term": "Chrome extension", "meaning": "A small software program that extends the features and functionality of the Google Chrome web browser." },
      { "term": "Telemetry", "meaning": "The automatic collection and transmission of user data from remote sources for monitoring or analysis." }
    ],
    ageBand: '10+',
    tags: ['cybersecurity', 'browser-extension', 'privacy', 'javascript']
  },
  {
    channel: 'gaming',
    staffSlug: 'agent-gaming',
    title: '15-Year-Old Wins National High School Chess and Speedrunning Double-Title',
    subtitle: 'Student master dominates rapid chess league while setting new speedrun record for retro game',
    excerpt: 'Kai Jenkins captured first place in the national scholastic rapid chess tournament and set a new retro game record.',
    body: '<p>Excelling in chess requires intense strategic calculation; setting a speedrun record in a classic video game requires split-second reflexes. To achieve both, 15-year-old Kai Jenkins from Miami, Florida, has won the National High School Chess and Speedrunning Double-Title. He placed first in the national rapid chess league and set a new speedrun record for the retro game *SuperJump* on the same weekend.</p><p>Kai, who has played competitive chess since age seven, noticed that both activities require similar mental skills: memorizing patterns, planning moves in advance, and staying calm under pressure.</p><p>In the chess tournament, Kai outmaneuvered 128 players in rapid matches, winning the final game with a brilliant queen sacrifice. Two hours later, he streamed his speedrun attempt online, completing the 30-level retro game in just 11 minutes and 14 seconds, beating the previous world record by three seconds.</p><blockquote>Rapid chess teaches you to think ahead under time pressure, and speedrunning teaches you to react instantly. Both games are about finding the fastest path to victory.<footer>— Kai Jenkins, 15</footer></blockquote><p>Kai plans to host a free gaming and chess workshop at his school to show younger kids how playing games can improve focus and spatial reasoning.</p>',
    kidTake: 'A 15-year-old kid named Kai won two national gaming titles on the same weekend! He won a big rapid chess tournament and set a world speedrunning record for a retro arcade game by beating it in 11 minutes.',
    familyDiscussion: [
      "How do you stay focused when playing a game under time pressure?",
      "Kai believes chess and speedrunning require similar skills. What are two different games you play that use similar skills?",
      "What is a hobby or skill you have spent a lot of time practicing?"
    ],
    glossary: [
      { "term": "Rapid chess", "meaning": "A chess game where each player has a limited amount of time to make all their moves, usually between 10 and 60 minutes." },
      { "term": "Speedrunning", "meaning": "The act of playing a video game with the intent of completing it as fast as possible, often using special tricks and glitches." }
    ],
    ageBand: '8+',
    tags: ['gaming', 'chess', 'speedrun', 'mental-focus']
  },
  {
    channel: 'music',
    staffSlug: 'agent-music',
    title: 'Youth Orchestra Records Album Composed Entirely by High School Students',
    subtitle: 'Local ensemble records seven original symphonic movements written by teenage musicians',
    excerpt: 'The 80-member youth symphony recorded a professional album featuring original teen compositions.',
    body: '<p>Classical orchestras usually perform music written by composers who lived centuries ago. But the Boston Youth Symphony is changing that. The 80-member orchestra, made of students aged 12 to 18, has recorded a professional album composed entirely by high school students. Named *New Horizons*, the album features seven original symphonic movements written by teenage musicians.</p><p>The project was started to give young composers a chance to hear their music performed by a full orchestra. Students spent months writing orchestral scores, detailing notes for every violin, flute, and drum.</p><p>During recording sessions, the student composers stood alongside the conductor, helping guide the orchestra\'s performance. The movements range from sweeping string melodies to modern percussion-heavy segments.</p><blockquote>Hearing 80 of your peers play a song you wrote in your bedroom is an incredible feeling. It shows that classical music can be a living, modern art form.<footer>— Aria Harmony, 17, student composer</footer></blockquote><p>The album has been released on digital streaming platforms, with all proceeds going to fund music scholarships for low-income students in the Boston area.</p>',
    kidTake: 'A youth orchestra made of 80 kids recorded a music album. All seven symphonic songs on the album were written by high school students. The kids stood next to the conductor to help guide the recording.',
    familyDiscussion: [
      "How do you think writing music for 80 instruments is different than writing a song for a guitar or piano?",
      "Aria\'s orchestra is raising money for music scholarships. Why is it important to support music education for everyone?",
      "If you could compose a song for a movie, what kind of movie would it be for (action, scary, happy)?"
    ],
    glossary: [
      { "term": "Symphony", "meaning": "A long, complex musical piece played by a large classical orchestra, usually divided into several movements." },
      { "term": "EP", "meaning": "Extended Play; a musical recording that contains more tracks than a single but is shorter than a full album." }
    ],
    ageBand: '8+',
    tags: ['music', 'performing-arts', 'classical-orchestra', 'composition']
  },
  {
    channel: 'play',
    staffSlug: 'play',
    title: 'Teenager Designs Modular Treehouse Playground for Children with Physical Disabilities',
    subtitle: '17-year-old uses 3D design to construct wheelchair-accessible ramp and sensory swings',
    excerpt: 'Amara Okafor built a modular model for an inclusive playground with ramps, sensory panels, and swings.',
    body: '<p>Playgrounds are places where all children should feel welcome, but traditional treehouses and slides often leave kids with physical disabilities on the sidelines. To help solve this, 17-year-old Amara Okafor from Seattle, Washington, has designed a modular treehouse playground named CanopyPlay. The 3D design features wheelchair-accessible ramps, sensory play boards, and inclusive swings, allowing children of all abilities to play together in nature.</p><p>Amara, whose younger brother uses a wheelchair, noticed how frustrating it was that he could not join his friends in neighborhood treehouses. She decided to use her 3D design skills to engineer a playground that is both accessible and fun.</p><p>CanopyPlay features modular wooden platforms connected by low-grade ramps that wind around mature trees. It includes tactical path markers, Braille sensory panels, and swings with high-back support. The design can be adjusted to fit different park layouts and tree configurations.</p><blockquote>Treehouses are magical, and every kid deserves to experience being up in the leaves. CanopyPlay makes this possible by making accessibility a core design feature.<footer>— Amara Okafor, 17</footer></blockquote><p>Amara\'s designs won first place in a national student design competition. She is currently working with a local park board to build a prototype CanopyPlay playground in a city park next summer.</p>',
    kidTake: 'A 17-year-old girl named Amara designed a cool treehouse playground that kids in wheelchairs can play in. The design uses wooden ramps winding around trees, tactile paths, and inclusive swings so all kids can play together.',
    familyDiscussion: [
      "Amara built this treehouse to play with her brother. What is something you\'ve built or done to show love for a family member?",
      "Why is making public spaces like playgrounds accessible for everyone a kind and helpful thing to do?",
      "What is another popular playground toy that could be redesigned to be more accessible?"
    ],
    glossary: [
      { "term": "Modular design", "meaning": "A design approach that subdivides a system into smaller parts called modules, which can be created, used, and replaced independently." },
      { "term": "Tactile path", "meaning": "A path designed to be felt, usually with raised bumps or textures, helping guide people with visual impairments." }
    ],
    ageBand: '8+',
    tags: ['playgrounds', 'accessibility', '3d-design', 'empathy']
  },
  {
    channel: 'stem',
    staffSlug: 'stem',
    title: 'Middle School Science Team Wins Prize for Water Filtration Using Banana Peels',
    subtitle: 'Seventh-graders prove dried banana peel powder effectively binds and extracts heavy metals from water',
    excerpt: 'The team engineered a simple, low-cost bio-filter that cleans well water using kitchen scraps.',
    body: '<p>Access to clean drinking water is a major health challenge in many remote parts of the world. To help solve this, a team of three middle school students from Seattle, Washington, has engineered a low-cost, organic water filter. The system purifies dirty water using a surprising ingredient: dried banana peels, which naturally bind to and remove heavy metals from water.</p><p>The students—Priya Ramanathan, 13, Maya Ortiz, 13, and Liam Vance, 14—spent their science class testing how kitchen scraps could clean water. They learned that banana peels contain chemical compounds that attract and lock onto heavy metal ions like lead and copper.</p><p>To build the filter, they dried banana peels in the sun and ground them into a fine powder. They layered the powder between sand and charcoal inside a simple plastic bottle filter. When dirty well water passes through, the sand catches dirt, while the banana peel powder binds to heavy metals, yielding clean drinking water.</p><blockquote>We wanted to design a filter that cost less than two dollars and could be made using kitchen scraps. Seeing dirty well water run clean and safe was amazing.<footer>— Priya Ramanathan, 13</footer></blockquote><p>The team won first place in the youth chemistry division at the State Science Fair. They have shared their design blueprints with a clean-water charity that plans to test the bio-filters in rural communities this winter.</p>',
    kidTake: 'Three students built a cheap water filter using dried banana peels and sand. When you pass dirty well water through it, the banana peels absorb heavy metals, cleaning the water so it is safe to drink.',
    familyDiscussion: [
      "Why is clean drinking water so important for our health?",
      "Priya\'s team used banana peels, which are usually thrown away. What other food waste do you think could be turned into something useful?",
      "Why is it helpful to build things out of materials you can find nearby?"
    ],
    glossary: [
      { "term": "Adsorption", "meaning": "The process by which a solid holds molecules of a gas or liquid as a thin film on its surface." },
      { "term": "Heavy metals", "meaning": "Dense metals, like lead and mercury, that can be toxic and dangerous to human health if found in drinking water." }
    ],
    ageBand: '8+',
    tags: ['chemistry', 'water-purification', 'upcycling', 'science-fair']
  }
];

module.exports = { EVENING_ARTICLES };
