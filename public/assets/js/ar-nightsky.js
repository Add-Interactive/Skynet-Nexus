/* Space Center AR fun pack — NIGHT SKY MODE ("point your phone at the sky").
   A pocket planetarium that extends the telemetry "point at sky" arrow:
   fullscreen canvas (NOT WebXR) that renders the real sky in whatever
   direction the phone points, using deviceorientation + geolocation.

   - 200 verified stars (J2000 RA/dec, V magnitudes, B-V colors) + 12 classic
     Western constellation figures with labels.
   - Star data: astronoreay/constellation_figures Constellation_Stars.csv
     (HYG/Hipparcos-derived), spot-checked against Wikipedia's star tables
     ("List of brightest stars", "List of stars in Scorpius") and individual
     star articles (Arcturus, Sirius, Vega, Altair, Polaris...).
   - Live satellites: ISS + the 6 tracked sats via window.satellite SGP4 +
     the site's own TLE snapshots (same URLs + same localStorage cache as
     ar-telemetry.js, so the two modules share one download).
   - Tap a star for its name + a kid-safe fact. Constellation labels on/off.
   - Plain ES module. Loads AFTER ar-placement.js. Kid-safe text (~age 8).
   - Orientation math assumes portrait phone (documented in currentMatrix).
   No prompt()/alert()/confirm() anywhere. NEXUS / Add Interactive Studio
   branding. Never JARVIS.
*/

/* 200 verified stars: [name, raHours, decDeg, mag, constAbbr, kidFact, bv] */
var STARS=[
["Sirius", 6.7525, -16.7161, -1.46, "CMa", "The brightest star in our night sky! It actually has a tiny, super-dense companion star.", 0.0],
["Canopus", 6.3992, -52.6957, -0.74, "Car", "The second-brightest star in the night sky — a beacon for the southern hemisphere!", 0.15],
["Arcturus", 14.261, 19.1824, -0.05, "Boo", "The brightest star in the northern sky! An orange giant — follow the Big Dipper's handle to find it.", 1.23],
["Vega", 18.6154, 38.7837, 0.03, "Lyr", "The jewel of the lyre — one of the brightest stars, and part of the Summer Triangle!", 0.0],
["Capella", 5.2782, 45.998, 0.08, "Aur", "A bright yellow star — actually two giant stars side by side! 'The little goat'.", 0.8],
["Rigel", 5.2423, -8.2016, 0.13, "Ori", "A blue supergiant — one of the most powerful stars we can see!", -0.03],
["Procyon", 7.655, 5.225, 0.37, "CMi", "The little dog's brightest star — 'before the dog', because it rises just before Sirius!", 0.42],
["Betelgeuse", 5.9195, 7.4071, 0.42, "Ori", "A red supergiant — hundreds of times wider than our Sun! One day it will explode as a supernova.", 1.85],
["Achernar", 1.6286, -57.2368, 0.46, "Eri", "A blue star spinning so fast it's squashed flat like a pumpkin! 'The end of the river'.", -0.16],
["Altair", 19.8464, 8.8683, 0.76, "Aql", "The flying eagle! One of the Summer Triangle stars — and it spins super fast!", 0.22],
["Aldebaran", 4.5987, 16.5093, 0.86, "Tau", "The bull's glowing red eye! An orange giant — but it's just passing in front of the Hyades cluster.", 1.54],
["Antares", 16.4901, -26.432, 0.91, "Sco", "The scorpion's glowing red heart! Its name means 'rival of Mars' because it looks so much like the planet.", 1.84],
["Spica", 13.4199, -11.1613, 0.97, "Vir", "A brilliant blue-white star — the brightest in Virgo! Its name means 'ear of wheat'.", -0.23],
["Pollux", 7.7553, 28.0262, 1.14, "Gem", "The brighter twin — an orange giant, and scientists found a planet orbiting it!", 1.0],
["Fomalhaut", 22.9608, -29.6222, 1.16, "PsA", "The lonely bright star of the southern fish — 'the fish's mouth'! It wears a dusty ring where planets may be forming.", 0.09],
["Deneb", 20.6905, 45.2803, 1.25, "Cyg", "The tail of the swan — one of the most luminous stars we know! It anchors the Summer Triangle.", 0.09],
["Regulus", 10.1395, 11.9672, 1.4, "Leo", "The heart of the lion! A blue-white star spinning so fast it's slightly squashed.", -0.16],
["Adhara", 6.9771, -28.9721, 1.5, "CMa", "A super-hot blue star — one of the brightest sources of ultraviolet light in the sky!", -0.21],
["Castor", 7.5766, 31.8883, 1.58, "Gem", "One of the Gemini twins — actually six stars all orbiting together!", 0.04],
["Shaula", 17.5601, -37.1038, 1.62, "Sco", "The scorpion's stinger — a super-hot blue star!", -0.14],
["Bellatrix", 5.4189, 6.3497, 1.64, "Ori", "A hot blue star on Orion's shoulder. Its name means 'female warrior'!", -0.22],
["Elnath", 5.4382, 28.6075, 1.65, "Tau", "The tip of the bull's northern horn!", -0.13],
["Alnilam", 5.6036, -1.2019, 1.69, "Ori", "The middle star of Orion's Belt — a blue supergiant thousands of light-years away!", -0.18],
["Miaplacidus", 9.22, -69.7172, 1.69, "Car", "A white star in the ship's keel — 'the calm waters'!", 0.0],
["Alnitak", 5.6793, -1.9426, 1.77, "Ori", "The left star of Orion's Belt — actually three stars crowded together!", -0.21],
["Alioth", 12.9005, 55.9598, 1.77, "UMa", "The brightest star of the Big Dipper!", -0.02],
["Dubhe", 11.0621, 61.751, 1.79, "UMa", "One of the Big Dipper's pointer stars — it helps point the way to the North Star!", 1.07],
["Mirfak", 3.4054, 49.8612, 1.79, "Per", "The brightest star in Perseus — a yellow supergiant!", 0.48],
["Wezen", 7.1399, -26.3932, 1.84, "CMa", "A yellow supergiant — the big dog's belly!", 0.68],
["Sargas", 17.622, -42.9978, 1.85, "Sco", "A bright yellow-white star in the scorpion's tail!", 0.44],
["Alkaid", 13.7923, 49.3133, 1.86, "UMa", "The star at the very tip of the Big Dipper's handle!", -0.19],
["Avior", 8.3752, -59.5095, 1.86, "Car", "An orange-and-blue double star — spaceships have used it to navigate!", 1.27],
["Menkalinan", 5.9921, 44.9474, 1.9, "Aur", "A white star in the charioteer's shoulder — 'the shoulder of the rein-holder'!", 0.03],
["Alhena", 6.6285, 16.3993, 1.92, "Gem", "A white star below the twins!", 0.0],
["Mirzam", 6.3783, -17.9559, 1.97, "CMa", "A blue star in the big dog — its name means 'the announcer', because it rises just before Sirius!", -0.24],
["Algieba", 10.3329, 19.8415, 1.98, "Leo", "A golden double star in the lion's mane — two stars dancing around each other!", 1.15],
["Polaris", 2.5303, 89.2641, 2.02, "UMi", "The North Star! It sits almost exactly above Earth's North Pole, so it barely moves all night.", 0.6],
["Mirach", 1.1622, 35.6206, 2.05, "And", "A red giant in Andromeda — star-hop from it to find the Andromeda Galaxy!", 1.57],
["Saiph", 5.7959, -9.6696, 2.06, "Ori", "A hot blue star marking Orion's knee!", -0.18],
["Alpheratz", 0.1398, 29.0904, 2.06, "And", "Marks the princess Andromeda's head — at the corner of the Great Square!", -0.11],
["Kochab", 14.8451, 74.1555, 2.08, "UMi", "The bright guard of the Little Dipper's bowl. Long ago, sailors used it as the North Star!", 1.47],
["Almach", 2.065, 42.3297, 2.1, "And", "A stunning double star — one gold, one blue!", 1.2],
["Algol", 3.1361, 40.9556, 2.12, "Per", "The 'demon star' — it winks every few days as two stars eclipse each other!", -0.05],
["Denebola", 11.8177, 14.5721, 2.13, "Leo", "The lion's tail — its name literally means 'tail of the lion'!", 0.09],
["Mizar", 13.3988, 54.9254, 2.22, "UMa", "Look very closely — a tiny companion star, Alcor, sits right beside it! Ancient people used it as an eyesight test.", 0.05],
["Schedar", 0.6751, 56.5373, 2.23, "Cas", "The brightest star in Cassiopeia's W — an orange giant!", 1.17],
["Sadr", 20.3705, 40.2567, 2.23, "Cyg", "The swan's chest — the center of the Northern Cross!", 0.67],
["Aspidiske", 9.2848, -59.2752, 2.26, "Car", "A white supergiant in the ship's keel — 'the little shield'!", 0.18],
["Caph", 0.153, 59.1498, 2.27, "Cas", "One corner of Cassiopeia's W — a star that pulses slightly!", 0.34],
["Larawag", 16.8361, -34.2932, 2.29, "Sco", "An orange giant in the scorpion's body!", 1.16],
["Dschubba", 16.0056, -22.6217, 2.32, "Sco", "Marks the scorpion's forehead — and its brightness slowly changes!", -0.12],
["Merak", 11.0307, 56.3824, 2.37, "UMa", "The other pointer star! Draw a line through Dubhe and Merak to find north.", -0.02],
["κ Sco", 17.7081, -39.03, 2.39, "Sco", "", -0.17],
["γ Cas", 0.9451, 60.7167, 2.39, "Cas", "", -0.1],
["Mintaka", 5.5334, -0.2991, 2.41, "Ori", "The right star of Orion's Belt. Its name simply means 'the belt'!", -0.39],
["Phecda", 11.8972, 53.6948, 2.44, "UMa", "Marks the bottom corner of the Big Dipper's bowl!", 0.01],
["Aludra", 7.4016, -29.3031, 2.45, "CMa", "A blue supergiant in the big dog's tail!", -0.08],
["Izar", 14.7498, 27.0742, 2.45, "Boo", "A beautiful double star — 'the girdle' of the herdsman!", 1.16],
["Aljanah", 20.7702, 33.9703, 2.48, "Cyg", "The swan's wing — its name means 'the wing'!", 1.04],
["Zosma", 11.2351, 20.5237, 2.53, "Leo", "A white star on the lion's back!", 0.15],
["Arneb", 5.5455, -17.8223, 2.57, "Lep", "A yellow supergiant in the hare — 'the hare'!", 0.2],
["Acrab", 16.0906, -19.8055, 2.62, "Sco", "The scorpion's claw — actually a whole family of stars orbiting each other!", -0.07],
["Mahasim", 5.9954, 37.2126, 2.62, "Aur", "A white star in the charioteer — 'the wrist'!", -0.08],
["Ruchbah", 1.4303, 60.2353, 2.68, "Cas", "One of the zigzags in Cassiopeia's W. Its name means 'the knee'!", 0.13],
["Muphrid", 13.9114, 18.3977, 2.68, "Boo", "A yellow star near Arcturus — 'the single one' of the herdsman!", 0.57],
["Hassaleh", 4.9499, 33.1661, 2.69, "Aur", "An orange giant in the charioteer!", 1.53],
["Lesath", 17.5127, -37.2958, 2.7, "Sco", "The scorpion's second stinger star, right beside Shaula!", -0.23],
["Tarazed", 19.771, 10.6133, 2.72, "Aql", "An orange giant by Altair — the eagle's shoulder!", 1.51],
["Porrima", 12.6943, -1.4494, 2.74, "Vir", "A famous double star — two nearly identical stars waltzing together!", 0.36],
["θ Car", 10.7159, -64.3945, 2.76, "Car", "", -0.22],
["Cursa", 5.1308, -5.0864, 2.79, "Eri", "A white star — 'the footstool' of Orion, where the river begins!", 0.13],
["Vindemiatrix", 13.0363, 10.9592, 2.79, "Vir", "A yellow giant in Virgo — 'the grape gatherer'!", 0.92],
["Paikauhale", 16.598, -28.216, 2.81, "Sco", "A hot blue star near the scorpion's heart — its name comes from Hawaii!", -0.25],
["Nihal", 5.4716, -20.7594, 2.84, "Lep", "A yellow giant in the hare!", 0.82],
["Tejat", 6.3827, 22.5136, 2.87, "Gem", "A red giant marking one of the twins' feet!", 1.64],
["Fawaris", 19.7496, 45.1308, 2.87, "Cyg", "A star in the swan's other wing!", -0.02],
["Alniyat", 16.3531, -25.5928, 2.89, "Sco", "One of the twin stars hugging Antares — 'the arteries'!", 0.13],
["Gomeisa", 7.4525, 8.2893, 2.89, "CMi", "A blue-white star in the little dog!", -0.09],
["ε Per", 3.9642, 40.0102, 2.89, "Per", "", -0.18],
["Fang", 15.9809, -26.1141, 2.91, "Sco", "Marks the scorpion's head. Its Chinese name means 'room'!", -0.2],
["γ Per", 3.0799, 53.5064, 2.93, "Per", "", 0.7],
["Zaurak", 3.9672, -13.5085, 2.94, "Eri", "A red giant in the river Eridanus — 'the boat'!", 1.6],
["Xamidimura", 16.8645, -38.0474, 2.98, "Sco", "One of a close pair of blue stars in the scorpion's tail!", -0.16],
["Algenubi", 9.7642, 23.7743, 2.98, "Leo", "A yellow giant in the lion's mane!", 0.81],
["Mebsuta", 6.7322, 25.1311, 2.98, "Gem", "A yellow supergiant in the twins!", 1.41],
["Okab", 19.0902, 13.8635, 2.99, "Aql", "A white star in the eagle's wing!", 0.01],
["Almaaz", 5.0328, 43.8233, 2.99, "Aur", "A strange star that dims every 27 years — 'the goat'!", 0.54],
["ι¹ Sco", 17.7931, -40.127, 2.99, "Sco", "", 0.5],
["α Gem", 7.5767, 31.8885, 3.0, "Gem", "", 0.04],
["Pherkad", 15.3455, 71.834, 3.0, "UMi", "One of the 'two calves' guarding Polaris!", 0.07],
["ψ UMa", 11.1611, 44.4985, 3.01, "UMa", "", 1.14],
["δ Per", 3.7154, 47.7875, 3.01, "Per", "", -0.12],
["Seginus", 14.5346, 38.3083, 3.02, "Boo", "A white star in the herdsman's shoulder!", 0.19],
["Tianguan", 5.6274, 21.1425, 3.03, "Tau", "The tip of the bull's southern horn — 'the heavenly gate'!", -0.19],
["Tania Australis", 10.3721, 41.4995, 3.05, "UMa", "An orange giant in the bear's paws — 'the southern leaper'!", 1.59],
["Albireo", 19.512, 27.9597, 3.08, "Cyg", "A famous double star — one gold, one blue! It marks the swan's beak.", 1.13],
["Talitha", 8.9868, 48.0418, 3.14, "UMa", "A white star in the bear's front paws!", 0.19],
["θ UMa", 9.5476, 51.6773, 3.18, "UMa", "", 0.46],
["Haedus", 5.1086, 41.2345, 3.18, "Aur", "A blue-white star in the charioteer — one of 'the kids', the baby goats!", -0.18],
["Tabit", 4.8307, 6.9613, 3.19, "Ori", "Part of Orion's shield — a white star spinning super fast!", 0.44],
["Fuyue", 17.831, -37.0433, 3.21, "Sco", "An orange giant in the scorpion's tail — its Chinese name honors an ancient builder!", 1.17],
["ζ Cyg", 21.2156, 30.2269, 3.21, "Cyg", "", 0.99],
["θ Aql", 20.1884, -0.8215, 3.22, "Aql", "", -0.07],
["Sulafat", 18.9824, 32.6896, 3.25, "Lyr", "A blue-white star in the lyre's frame!", -0.05],
["Propus", 6.248, 22.5068, 3.28, "Gem", "A red giant near Castor's foot!", 1.61],
["δ And", 0.6555, 30.861, 3.28, "And", "", 1.28],
["Megrez", 12.2571, 57.0326, 3.32, "UMa", "The faintest Big Dipper star — it links the bowl to the handle!", 0.09],
["η Sco", 17.2026, -43.2392, 3.33, "Sco", "", 0.41],
["η Ori", 5.4079, -2.3971, 3.35, "Ori", "", -0.17],
["Chertan", 11.2373, 15.6102, 3.35, "Leo", "A white star in the lion's body!", -0.02],
["Alzirr", 6.7548, 12.8956, 3.36, "Gem", "A white star at the twins' feet — 'the button'!", 0.43],
["δ Aql", 19.425, 3.1148, 3.36, "Aql", "", 0.32],
["Segin", 1.9066, 63.6701, 3.37, "Cas", "The leftmost star of Cassiopeia's W!", -0.15],
["η Leo", 10.1222, 16.7627, 3.41, "Leo", "", -0.02],
["Adhafera", 10.2782, 23.4173, 3.41, "Leo", "A yellow-white star in the lion's shaggy mane!", 0.31],
["Chamukuy", 4.4777, 15.8709, 3.41, "Tau", "One of the Hyades stars — part of the bull's face!", 0.19],
["λ Tau", 4.0113, 12.4903, 3.41, "Tau", "", -0.12],
["Muscida", 8.5044, 60.7182, 3.42, "UMa", "Marks the bear's snout — 'the muzzle'!", 0.85],
["Sheliak", 18.8347, 33.3627, 3.42, "Lyr", "A star in the lyre that winks — two stars taking turns blocking each other!", 0.0],
["λ Aql", 19.1041, -4.8826, 3.43, "Aql", "", -0.09],
["Tania Borealis", 10.2849, 42.9144, 3.45, "UMa", "Its partner — 'the northern leaper'! Long ago people saw gazelles leaping here.", 0.03],
["Meissa", 5.5856, 9.9342, 3.47, "Ori", "Orion's head! It sits inside a faint glowing cloud of gas.", 0.01],
["Alula Borealis", 11.308, 33.0943, 3.49, "UMa", "One of a close pair of stars — 'the northern wing' of the bear!", 1.4],
["δ Boo", 15.2584, 33.3148, 3.49, "Boo", "", 0.95],
["Nekkar", 15.0324, 40.3906, 3.52, "Boo", "A yellow giant in the herdsman — 'the ox-driver'!", 0.95],
["Ain", 4.4769, 19.1804, 3.53, "Tau", "The bull's eye! One of the Hyades cluster stars.", 1.01],
["Wasat", 7.3354, 21.9823, 3.53, "Gem", "A star between the twins — its name means 'middle'!", 0.34],
["δ Eri", 3.7208, -9.7634, 3.54, "Eri", "", 0.92],
["Pipirima", 16.8723, -38.0175, 3.54, "Sco", "Its blue partner star in the scorpion's tail!", -0.2],
["Alkaphrah", 9.0604, 47.1565, 3.55, "UMa", "A white star near the bear's paws!", 0.0],
["λ Gem", 7.3016, 16.5404, 3.56, "Gem", "", 0.12],
["κ Gem", 7.7408, 24.398, 3.57, "Gem", "", 0.92],
["ρ Boo", 14.5305, 30.3714, 3.59, "Boo", "", 1.3],
["ο Tau", 3.4136, 9.0289, 3.6, "Tau", "", 0.89],
["θ Gem", 6.8798, 33.9613, 3.6, "Gem", "", 0.1],
["ζ² Sco", 16.9097, -42.3613, 3.62, "Sco", "", 1.37],
["Prima Hyadum", 4.3299, 15.6276, 3.65, "Tau", "The brightest of the Hyades — the V-shaped star cluster forming the bull's face!", 0.99],
["h UMa", 9.5255, 63.0619, 3.67, "UMa", "", 0.33],
["π⁴ Ori", 4.8534, 5.6051, 3.68, "Ori", "", -0.18],
["Alshain", 19.9219, 6.4068, 3.71, "Aql", "A yellow star by Altair — the eagle's other shoulder!", 0.85],
["Taiyangshou", 11.7675, 47.7794, 3.72, "UMa", "A star in the bear's leg — its Chinese name means 'the sun's guardian'!", 1.18],
["π⁵ Ori", 4.9042, 2.4407, 3.73, "Ori", "", -0.19],
["ξ Tau", 3.4528, 9.7327, 3.75, "Tau", "", -0.09],
["ι² Cyg", 19.4951, 51.7298, 3.75, "Cyg", "", 0.14],
["Secunda Hyadum", 4.3823, 17.5425, 3.76, "Tau", "Another Hyades star in the bull's V-shaped face!", 0.98],
["κ Cyg", 19.285, 53.3685, 3.76, "Cyg", "", 0.97],
["ζ Gem", 7.0685, 20.5703, 3.79, "Gem", "", 0.79],
["ι Gem", 7.4288, 27.7981, 3.79, "Gem", "", 1.04],
["η Aql", 19.8745, 1.0057, 3.8, "Aql", "", 0.81],
["υ UMa", 9.8498, 59.0387, 3.81, "UMa", "", 0.29],
["θ¹ Tau", 4.4762, 15.9622, 3.84, "Tau", "", 0.94],
["Iklil", 15.9481, -29.2141, 3.86, "Sco", "A blue star in the scorpion's body — 'the crown'!", -0.2],
["ο¹ CMa", 6.9022, -24.1842, 3.87, "CMa", "", 1.73],
["ζ² UMa", 13.399, 54.9218, 3.88, "UMa", "", 0.17],
["Rasalas", 9.8794, 26.007, 3.88, "Leo", "The lion's head — an orange giant star!", 1.22],
["ν Tau", 4.0526, 5.9893, 3.88, "Tau", "", 0.04],
["ι Leo", 11.3987, 10.5295, 3.89, "Leo", "", 0.46],
["ν² CMa", 6.6114, -19.2559, 3.91, "CMa", "", 1.1],
["ν Cyg", 20.9529, 41.1671, 3.94, "Cyg", "", 0.02],
["ο² Cyg", 20.2579, 47.7142, 3.98, "Cyg", "", 1.52],
["ε Aql", 18.9937, 15.0683, 4.02, "Aql", "", 1.08],
["12 Aql", 19.028, -5.7391, 4.02, "Aql", "", 1.09],
["σ Leo", 11.3523, 6.0293, 4.04, "Leo", "", -0.06],
["ο² Ori", 4.9395, 13.5145, 4.06, "Ori", "", 1.15],
["υ Gem", 7.5987, 26.8958, 4.06, "Gem", "", 1.54],
["θ CMa", 6.9032, -12.0386, 4.08, "CMa", "", 1.43],
["φ² Ori", 5.6151, 9.2907, 4.09, "Ori", "", 0.95],
["Muliphein", 7.0626, -15.6333, 4.12, "CMa", "A white star in the big dog!", -0.12],
["μ Ori", 6.0397, 9.6473, 4.13, "Ori", "", 0.16],
["ν Gem", 6.4827, 20.2121, 4.14, "Gem", "", -0.14],
["1 Gem", 6.0687, 23.2633, 4.15, "Gem", "", 0.87],
["ε UMi", 16.7662, 82.0373, 4.21, "UMi", "", 0.9],
["Alula Australis", 11.303, 31.5292, 4.25, "UMa", "Its partner — 'the southern wing'! The two look like one star to sharp eyes.", 0.54],
["ζ UMi", 15.7343, 77.7945, 4.27, "UMi", "", 0.04],
["δ³ Tau", 4.4248, 17.9279, 4.3, "Tau", "", 0.07],
["10 Tau", 3.6145, 0.3996, 4.3, "Tau", "", 0.85],
["δ² Lyr", 18.9084, 36.8986, 4.3, "Lyr", "", 1.67],
["Alterf", 9.5287, 22.968, 4.31, "Leo", "A star in the lion's face!", 1.54],
["Yildun", 17.5369, 86.5865, 4.34, "UMi", "A white star in the Little Dipper's handle!", 0.03],
["Jabbah", 16.1999, -19.4607, 4.35, "Sco", "A star in the scorpion's head — 'the crown of the forehead'!", 0.01],
["π² Ori", 4.8435, 8.9002, 4.35, "Ori", "", 0.01],
["ζ¹ Lyr", 18.7462, 37.6051, 4.36, "Lyr", "", 0.19],
["ι Aql", 19.612, -1.2866, 4.36, "Aql", "", -0.08],
["ι CMa", 6.9356, -17.0542, 4.38, "CMa", "", -0.09],
["ν Ori", 6.1262, 14.7685, 4.4, "Ori", "", -0.16],
["χ¹ Ori", 5.9064, 20.2762, 4.4, "Ori", "", 0.6],
["φ¹ Ori", 5.5803, 9.4896, 4.41, "Ori", "", -0.15],
["τ Gem", 7.1857, 30.2452, 4.42, "Gem", "", 1.26],
["κ Leo", 9.4109, 26.1823, 4.45, "Leo", "", 1.24],
["π⁶ Ori", 4.9758, 1.714, 4.46, "Ori", "", 1.39],
["ξ Ori", 6.199, 14.2088, 4.48, "Ori", "", -0.17],
["χ² Ori", 6.0653, 20.1385, 4.63, "Ori", "", 0.28],
["π¹ Ori", 4.9149, 10.1508, 4.65, "Ori", "", 0.07],
["11 Ori", 5.0753, 15.4013, 4.66, "Ori", "", -0.05],
["η UMi", 16.2917, 75.7553, 4.7, "UMi", "", 0.62],
["ζ¹ Sco", 16.8999, -42.362, 4.79, "Sco", "", 0.52],
["δ² Tau", 4.4016, 17.4441, 4.8, "Tau", "", 0.15],
["ι² Sco", 17.8364, -40.0904, 4.8, "Sco", "", 0.24],
["β² Sco", 16.0907, -19.8019, 4.89, "Sco", "", -0.02],
["ε¹ Lyr", 18.739, 39.6701, 4.99, "Lyr", "", 0.12],
];
/* Classic Western stick figures. Endpoints are indices into STARS. */
var LINES=[
{n:"Orion",a:7,s:[[121,7],[7,24],[20,54],[24,22],[22,54],[24,5],[54,38],[5,38]]},
{n:"Ursa Major",a:25,s:[[26,51],[51,55],[55,106],[106,26],[106,25],[25,44],[44,30]]},
{n:"Ursa Minor",a:36,s:[[40,89],[89,173],[173,171],[171,40],[171,178],[178,36]]},
{n:"Cassiopeia",a:45,s:[[48,45],[45,53],[53,63],[63,112]]},
{n:"Scorpius",a:11,s:[[79,61],[61,50],[50,76],[76,11],[11,72],[72,49],[49,82],[82,135],[135,107],[107,29],[29,87],[87,52],[52,66],[66,19]]},
{n:"Leo",a:16,s:[[83,154],[154,114],[114,35],[35,113],[113,16],[16,59],[59,109],[109,43],[43,59]]},
{n:"Taurus",a:10,s:[[136,144],[144,125],[125,93],[93,21],[136,10],[10,115]]},
{n:"Gemini",a:13,s:[[88,187],[187,134],[13,164],[164,147],[134,147]]},
{n:"Cygnus",a:15,s:[[15,46],[46,95],[75,46],[46,58]]},
{n:"Lyra",a:3,s:[[3,199],[199,181],[181,118],[118,103],[103,176],[176,181]]},
{n:"Aquila",a:9,s:[[67,9],[9,139],[85,9],[9,102]]},
{n:"Canis Major",a:0,s:[[0,34],[0,152],[152,28],[28,17],[17,56]]},
];

/* ---------------- constants ---------------- */
var NORAD = { iss: 25544, hubble: 20580, aqua: 27424, terra: 25994, chandra: 25867, fermi: 33053, jwst: 50463 };
var SATS = [
  ['ISS', 25544], ['Hubble', 20580], ['Aqua', 27424], ['Terra', 25994],
  ['Chandra', 25867], ['Fermi', 33053], ['JWST', 50463]
];
// Same relative paths the telemetry module uses — resolve identically here.
var TLE_URLS = [
  '../assets/data/space-center/tle-snapshot-a.json',
  '../assets/data/space-center/tle-snapshot-b.json'
];
var LS_TLE = 'sc-ar-tle-v1';   // shared with ar-telemetry.js on purpose
var LS_GEO = 'sc-ar-geo-v1';   // shared with ar-telemetry.js on purpose
var TTL_MS = 6 * 3600 * 1000;
var D2R = Math.PI / 180, R2D = 180 / Math.PI;
// Hoonah, Alaska — Jeff's project town. Used only when location is off,
// with an on-screen note saying the sky is approximate.
var GEO_FALLBACK = { lat: 58.11, lon: -135.44, label: 'Hoonah, Alaska' };
var VFOV = 55 * D2R;           // vertical field of view for the projection
var FULLNAME = {
  Ori: 'Orion', UMa: 'Ursa Major', UMi: 'Ursa Minor', Cas: 'Cassiopeia',
  Sco: 'Scorpius', Leo: 'Leo', Tau: 'Taurus', Gem: 'Gemini', Cyg: 'Cygnus',
  Lyr: 'Lyra', Aql: 'Aquila', CMa: 'Canis Major', Boo: 'Boötes', Aur: 'Auriga',
  CMi: 'Canis Minor', Vir: 'Virgo', Car: 'Carina', PsA: 'Piscis Austrinus',
  And: 'Andromeda', Per: 'Perseus', Eri: 'Eridanus', Lep: 'Lepus'
};

function B() { return window.__scB || null; }
function toast(msg) { var b = B(); if (b && b.toast) b.toast(msg); }
function satLib() {
  var s = window.satellite;
  if (!s || typeof s.twoline2satrec !== 'function' || typeof s.propagate !== 'function' ||
      typeof s.gstime !== 'function' || typeof s.eciToEcf !== 'function' ||
      typeof s.ecfToLookAngles !== 'function') return null;
  return s;
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

/* ---------------- state ---------------- */
var S = {
  on: false,
  geo: null,            // {lat, lon}
  geoApprox: false,
  orient: null,         // {a,b,g} radians, compass-referenced alpha
  orientSeen: false,
  orientDenied: false,
  gotAbsolute: false,
  orientTimer: 0,
  tles: null,
  tlesLoading: false,
  recs: {},
  labelsOn: true,
  renderTimer: 0,
  lastRender: 0,
  proj: [],             // last-frame hit-test list [{x,y,kind,ref}]
  canvas: null, ctx: null
};

/* ---------------- TLE handling (same approach as ar-telemetry.js) ---------------- */
function readTleCache() {
  try {
    var c = JSON.parse(localStorage.getItem(LS_TLE) || 'null');
    return (c && typeof c === 'object') ? c : null;
  } catch (e) { return null; }
}
function writeTleCache(map) {
  try { localStorage.setItem(LS_TLE, JSON.stringify(map)); } catch (e) {}
}
function tlesFresh(map) {
  if (!map) return false;
  for (var n in map) {
    if (map[n] && map[n].fetchedAt && (Date.now() - map[n].fetchedAt) < TTL_MS) return true;
  }
  return false;
}
function loadTLEs(cb) {
  cb = cb || function () {};
  if (S.tles && tlesFresh(S.tles)) { cb(true); return; }
  if (S.tlesLoading) { cb(!!S.tles); return; }
  var cached = readTleCache();
  if (cached && tlesFresh(cached)) { S.tles = cached; cb(true); return; }
  S.tlesLoading = true;
  var done = 0, map = {};
  function finish() {
    if (++done !== TLE_URLS.length) return;
    S.tlesLoading = false;
    if (Object.keys(map).length) { S.tles = map; S.recs = {}; writeTleCache(map); cb(true); }
    else if (cached && Object.keys(cached).length) { S.tles = cached; cb(true); }
    else cb(false);
  }
  TLE_URLS.forEach(function (u) {
    fetch(u, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (f) {
      if (f && Array.isArray(f.sats)) f.sats.forEach(function (s) {
        if (s && s.id && s.l1 && s.l2) map[String(s.id)] = { l1: s.l1, l2: s.l2, fetchedAt: Date.now() };
      });
    }).catch(function () {}).then(finish);
  });
}
function getRec(norad) {
  var sat = satLib();
  if (!sat || !S.tles) return null;
  if (S.recs[norad]) return S.recs[norad];
  var t = S.tles[String(norad)];
  if (!t) return null;
  try {
    var rec = sat.twoline2satrec(t.l1, t.l2);
    S.recs[norad] = rec;
    return rec;
  } catch (e) { return null; }
}
/* Live azimuth/elevation (degrees, az from north eastward) for a NORAD id. */
function satAltAz(norad) {
  var sat = satLib(), rec = getRec(norad);
  if (!sat || !rec || !S.geo) return null;
  var now = new Date(), pv;
  try { pv = sat.propagate(rec, now); } catch (e) { return null; }
  if (!pv || !pv.position || pv.position === false) return null;
  try {
    var gmst = sat.gstime(now);
    var ecf = sat.eciToEcf(pv.position, gmst);
    var look = sat.ecfToLookAngles(
      { longitude: S.geo.lon * D2R, latitude: S.geo.lat * D2R, height: 0 }, ecf);
    var az = look.azimuth * R2D;
    az = ((az % 360) + 360) % 360;
    return { az: az, el: look.elevation * R2D };
  } catch (e) { return null; }
}

/* ---------------- astronomy math ---------------- */
/* GMST in degrees. Prefers the satellite lib (same as telemetry), with a
   standard low-precision fallback so stars still work without it. */
function gmstDeg(now) {
  var sat = satLib();
  if (sat) { try { return sat.gstime(now) * R2D; } catch (e) {} }
  var d = now.getTime() / 86400000 - 10957.5; // days since J2000.0
  var g = (280.46061837 + 360.98564736629 * d) % 360;
  return (g + 360) % 360;
}
/* RA (hours) / dec (deg) -> {alt, az} in degrees. az from north, eastward. */
function radecToAltAz(raH, decD, now) {
  var lat = S.geo.lat * D2R, dec = decD * D2R;
  var lst = (gmstDeg(now) + S.geo.lon) * D2R;
  var H = lst - raH * 15 * D2R;
  var sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
  var alt = Math.asin(clamp(sinAlt, -1, 1));
  var az = Math.PI + Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat));
  az = az % (2 * Math.PI);
  if (az < 0) az += 2 * Math.PI;
  return { alt: alt * R2D, az: az * R2D };
}
/* alt/az (degrees) -> world unit vector [east, north, up]. */
function altAzToVec(alt, az) {
  var a = alt * D2R, z = az * D2R;
  return [Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z), Math.sin(a)];
}
/* Deviceorientation (alpha/beta/gamma, radians, compass-referenced alpha)
   -> device-to-world rotation matrix. Follows the W3C orientation-event
   spec: R = Rz(alpha) * Rx(beta) * Ry(gamma). On iOS we synthesize alpha
   from webkitCompassHeading as (360 - heading), the same compass relation
   ar-telemetry.js uses. Portrait phone assumed. */
function orientMatrix(a, b, g) {
  var xA = Math.cos(a), xB = Math.sin(a);
  var xC = Math.cos(b), xD = Math.sin(b);
  var xE = Math.cos(g), xF = Math.sin(g);
  return [
    [xA * xE - xB * xD * xF, -xB * xC, xA * xF + xB * xD * xE],
    [xB * xE + xA * xD * xF,  xA * xC, xB * xF - xA * xD * xE],
    [-xC * xF,                xD,      xC * xE]
  ];
}
/* Fallback view matrix: look toward az/el with zero roll (used when the
   device has no motion sensors, e.g. desktop). */
function viewMatrix(azDeg, elDeg) {
  var v = altAzToVec(elDeg, azDeg);
  var z = [-v[0], -v[1], -v[2]];
  var up = [0, 0, 1];
  var dot = up[0] * z[0] + up[1] * z[1] + up[2] * z[2];
  var y = [up[0] - dot * z[0], up[1] - dot * z[1], up[2] - dot * z[2]];
  var yl = Math.sqrt(y[0] * y[0] + y[1] * y[1] + y[2] * y[2]) || 1;
  y = [y[0] / yl, y[1] / yl, y[2] / yl];
  var x = [y[1] * z[2] - y[2] * z[1], y[2] * z[0] - y[0] * z[2], y[0] * z[1] - y[1] * z[0]];
  return [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]];
}
function currentMatrix() {
  if (S.orient) return orientMatrix(S.orient.a, S.orient.b, S.orient.g);
  return viewMatrix(180, 45); // no sensors yet: face south, 45 deg up
}
/* World vector -> screen px (null when behind the viewer). The phone screen
   is a window: the camera looks along device -z, so visible means dz < 0. */
function projectVec(w, W, H, R) {
  var dx = R[0][0] * w[0] + R[1][0] * w[1] + R[2][0] * w[2];
  var dy = R[0][1] * w[0] + R[1][1] * w[1] + R[2][1] * w[2];
  var dz = R[0][2] * w[0] + R[1][2] * w[1] + R[2][2] * w[2];
  if (dz > -0.03) return null;
  var f = (H / 2) / Math.tan(VFOV / 2);
  return { x: W / 2 + (-dx / dz) * f, y: H / 2 - (-dy / dz) * f };
}
function starColor(bv) {
  if (bv == null || !isFinite(bv)) return '#ffffff';
  if (bv < 0.1) return '#cfe6ff';
  if (bv < 0.5) return '#ffffff';
  if (bv < 1.0) return '#ffe9c4';
  return '#ffb377';
}

/* ---------------- rendering ---------------- */
function ensureCanvas() {
  var c = document.getElementById('ar-sky-canvas');
  if (c) { S.canvas = c; S.ctx = c.getContext('2d'); return c; }
  c = document.createElement('canvas');
  c.id = 'ar-sky-canvas';
  c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:90;display:none;' +
    'background:#020610;touch-action:manipulation';
  document.body.appendChild(c);
  S.canvas = c;
  S.ctx = c.getContext('2d');
  c.addEventListener('click', onCanvasTap);
  return c;
}
function sizeCanvas() {
  if (!S.canvas) return;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  S.canvas.width = Math.floor(window.innerWidth * dpr);
  S.canvas.height = Math.floor(window.innerHeight * dpr);
  S.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function render() {
  if (!S.on || !S.geo || !S.canvas) return;
  var now = new Date();
  var W = window.innerWidth, H = window.innerHeight;
  var ctx = S.ctx, R = currentMatrix();
  S.proj = [];
  var bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#050b1e');
  bg.addColorStop(0.6, '#020610');
  bg.addColorStop(1, '#010409');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  var t = now.getTime();
  var pos = new Array(STARS.length);
  var i, st, aa, p, r;
  // stars
  for (i = 0; i < STARS.length; i++) {
    st = STARS[i]; // [name, raHours, decDeg, mag, abbr, fact, bv]
    aa = radecToAltAz(st[1], st[2], now);
    if (aa.alt < -1) { pos[i] = null; continue; }
    p = projectVec(altAzToVec(aa.alt, aa.az), W, H, R);
    pos[i] = p;
    if (!p || p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) continue;
    r = clamp(4.6 - 1.05 * st[3], 0.9, 6);
    ctx.globalAlpha = 0.72 + 0.28 * Math.sin(t / 900 + i * 1.7);
    ctx.fillStyle = starColor(st[6]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, 6.2832);
    ctx.fill();
    S.proj.push({ x: p.x, y: p.y, kind: 'star', ref: i });
    if (S.labelsOn && st[3] <= 1.3) {
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = '#bfe9ff';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(st[0], p.x + r + 4, p.y + 4);
    }
  }
  ctx.globalAlpha = 1;
  // constellation figures
  ctx.strokeStyle = 'rgba(0,229,255,0.30)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  var li, si, segs, pa, pb;
  for (li = 0; li < LINES.length; li++) {
    segs = LINES[li].s;
    for (si = 0; si < segs.length; si++) {
      pa = pos[segs[si][0]];
      pb = pos[segs[si][1]];
      if (pa && pb) { ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); }
    }
  }
  ctx.stroke();
  // constellation labels
  if (S.labelsOn) {
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(143,216,239,0.9)';
    for (li = 0; li < LINES.length; li++) {
      pa = pos[LINES[li].a];
      if (pa && pa.y > 30) ctx.fillText(LINES[li].n, pa.x, pa.y - 14);
    }
  }
  // live satellites
  for (var qi = 0; qi < SATS.length; qi++) {
    var la = satAltAz(SATS[qi][1]);
    if (!la || la.el < 0) continue;
    var sp = projectVec(altAzToVec(la.el, la.az), W, H, R);
    if (!sp || sp.x < -20 || sp.x > W + 20 || sp.y < -20 || sp.y > H + 20) continue;
    ctx.fillStyle = '#ffcf5e';
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 4.5, 0, 6.2832);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,207,94,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 9, 0, 6.2832);
    ctx.stroke();
    ctx.fillStyle = '#ffe6a8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🛰 ' + SATS[qi][0], sp.x + 12, sp.y + 4);
    S.proj.push({ x: sp.x, y: sp.y, kind: 'sat', ref: qi });
  }
}

/* ---------------- UI chrome ---------------- */
var BTN_CSS = 'background:rgba(0,229,255,.12);border:1px solid rgba(0,229,255,.4);' +
  'border-radius:999px;color:#eaffff;font-size:.72rem;font-weight:700;padding:6px 12px;cursor:pointer';
function showChrome() {
  var bar = document.getElementById('ar-sky-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'ar-sky-bar';
    bar.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:91;' +
      'display:flex;gap:8px;align-items:center;background:rgba(3,12,24,.92);' +
      'border:1px solid rgba(0,229,255,.45);border-radius:999px;padding:8px 10px 8px 14px;' +
      'color:#eaffff;font-size:.8rem;font-weight:800;white-space:nowrap';
    bar.innerHTML = '<span>🌌 Night Sky</span>' +
      '<button id="ar-sky-labels" style="' + BTN_CSS + '">Labels: on</button>' +
      '<button id="ar-sky-close" aria-label="Close night sky" style="' + BTN_CSS + '">✕</button>';
    document.body.appendChild(bar);
    document.getElementById('ar-sky-labels').onclick = function () {
      S.labelsOn = !S.labelsOn;
      this.textContent = S.labelsOn ? 'Labels: on' : 'Labels: off';
      render();
    };
    document.getElementById('ar-sky-close').onclick = function () { stop(); };
  }
  bar.style.display = 'flex';
  var hint = document.getElementById('ar-sky-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'ar-sky-hint';
    hint.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:91;' +
      'text-align:center;font-size:.68rem;line-height:1.5;color:#8fd8ef;pointer-events:none';
    document.body.appendChild(hint);
  }
  hint.style.display = 'block';
  syncHint();
}
function hideChrome() {
  ['ar-sky-bar', 'ar-sky-hint', 'ar-sky-card'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}
function syncHint() {
  var hint = document.getElementById('ar-sky-hint');
  if (!hint) return;
  var parts = [];
  if (S.geoApprox) parts.push('📍 Location is off — showing the sky over ' + GEO_FALLBACK.label + ' (approximate).');
  else parts.push('📍 Using your location for the real sky.');
  if (S.orientDenied) parts.push('🧭 Motion needs permission — tap 🌌 Sky again and choose Allow.');
  else if (!S.orientSeen) parts.push('🧭 No motion sensors found — showing a sample view. It works best on a phone!');
  else parts.push('📱 Move your phone to look around. Tap a star to learn its name!');
  hint.innerHTML = parts.join('<br>') +
    '<br><span style="color:#5b7f95">NEXUS · Add Interactive Studio</span>';
}
function showCard(title, sub, fact) {
  var card = document.getElementById('ar-sky-card');
  if (!card) {
    card = document.createElement('div');
    card.id = 'ar-sky-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Star information');
    card.style.cssText = 'position:fixed;left:12px;right:12px;bottom:64px;z-index:92;display:none;' +
      'background:rgba(3,12,24,.96);border:1px solid rgba(0,229,255,.45);border-radius:16px;' +
      'padding:14px;color:#eaffff;box-shadow:0 8px 40px rgba(0,0,0,.6)';
    document.body.appendChild(card);
  }
  card.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
      '<div style="font-weight:800;font-size:1rem">⭐ ' + esc(title) + '</div>' +
      '<button id="ar-sky-cardx" aria-label="Close" style="' + BTN_CSS + '">✕</button></div>' +
    '<div style="font-size:.72rem;color:#8fd8ef;margin-bottom:6px">' + esc(sub) + '</div>' +
    '<div style="font-size:.85rem;line-height:1.45">' + esc(fact) + '</div>';
  card.style.display = 'block';
  document.getElementById('ar-sky-cardx').onclick = function () { card.style.display = 'none'; };
}
function onCanvasTap(ev) {
  if (!S.canvas) return;
  var rect = S.canvas.getBoundingClientRect();
  var x = ev.clientX - rect.left, y = ev.clientY - rect.top;
  var best = null, bestD = 30, i, p, d;
  for (i = 0; i < S.proj.length; i++) {
    p = S.proj[i];
    d = Math.sqrt((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y));
    if (d < bestD) { bestD = d; best = p; }
  }
  var card = document.getElementById('ar-sky-card');
  if (!best) { if (card) card.style.display = 'none'; return; }
  if (best.kind === 'star') {
    var st = STARS[best.ref]; // [name, raHours, decDeg, mag, abbr, fact, bv]
    showCard(st[0],
      'Magnitude ' + st[3].toFixed(2) + ' · ' + FULLNAME[st[4]],
      st[5] || ('A distant sun in ' + FULLNAME[st[4]] + '!'));
  } else {
    var s = SATS[best.ref];
    showCard('🛰 ' + s[0], 'Live satellite — tracked right now!',
      'This is the real ' + s[0] + ', flying overhead right now! Satellites zoom around Earth super fast — about 7.5 km every single second.');
  }
}

/* ---------------- orientation + geolocation ---------------- */
function onOrient(e) {
  if (!e || !S.on) return;
  if (e.absolute === true) S.gotAbsolute = true;
  else if (S.gotAbsolute) return; // prefer the compass-referenced stream
  var a = null;
  if (typeof e.webkitCompassHeading === 'number' && isFinite(e.webkitCompassHeading)) {
    // iOS: true heading of the view direction -> W3C alpha (same relation
    // ar-telemetry.js uses for its compass arrow).
    a = (360 - e.webkitCompassHeading) % 360;
  } else if (typeof e.alpha === 'number' && e.alpha != null && isFinite(e.alpha)) {
    a = e.alpha;
  }
  if (a == null) return;
  var b = (typeof e.beta === 'number' && isFinite(e.beta)) ? e.beta : 0;
  var g = (typeof e.gamma === 'number' && isFinite(e.gamma)) ? e.gamma : 0;
  S.orient = { a: a * D2R, b: b * D2R, g: g * D2R };
  if (!S.orientSeen) {
    S.orientSeen = true;
    if (S.orientTimer) { clearTimeout(S.orientTimer); S.orientTimer = 0; }
    syncHint();
  }
  var now = Date.now();
  if (now - S.lastRender > 90) { S.lastRender = now; render(); }
}
function startOrientation() {
  stopOrientation();
  S.orient = null;
  S.orientSeen = false;
  S.orientDenied = false;
  S.gotAbsolute = false;
  function listen() {
    try {
      if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onOrient);
      window.addEventListener('deviceorientation', onOrient);
    } catch (e) {}
    // No sensor data (desktop)? Fall back to a fixed sample view.
    S.orientTimer = setTimeout(function () {
      S.orientTimer = 0;
      if (!S.orientSeen && S.on) { syncHint(); render(); }
    }, 4000);
  }
  var DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    // iOS 13+: must run inside the tap gesture — start() is called from one.
    try {
      DOE.requestPermission().then(function (res) {
        if (res === 'granted') listen();
        else { S.orientDenied = true; syncHint(); render(); }
      }).catch(function () { listen(); });
    } catch (e) { listen(); }
  } else {
    listen();
  }
}
function stopOrientation() {
  try {
    window.removeEventListener('deviceorientation', onOrient);
    window.removeEventListener('deviceorientationabsolute', onOrient);
  } catch (e) {}
  if (S.orientTimer) { clearTimeout(S.orientTimer); S.orientTimer = 0; }
}
function ensureGeo(cb) {
  if (S.geo) { cb(true); return; }
  var cached = null;
  try {
    var g = JSON.parse(localStorage.getItem(LS_GEO) || 'null');
    if (g && isFinite(g.lat) && isFinite(g.lon)) cached = g;
  } catch (e) {}
  if (cached) { S.geo = cached; S.geoApprox = false; cb(true); return; }
  function fallback() {
    S.geo = { lat: GEO_FALLBACK.lat, lon: GEO_FALLBACK.lon };
    S.geoApprox = true;
    cb(true);
  }
  if (!navigator.geolocation) { fallback(); return; }
  try {
    navigator.geolocation.getCurrentPosition(function (pos) {
      S.geo = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      S.geoApprox = false;
      try { localStorage.setItem(LS_GEO, JSON.stringify(S.geo)); } catch (e) {}
      cb(true);
    }, fallback, { timeout: 12000, maximumAge: 3600000 });
  } catch (e) { fallback(); }
}
function onResize() { if (S.on) { sizeCanvas(); render(); } }

/* ---------------- public API ---------------- */
function isOn() { return S.on; }
function start() {
  if (S.on) return true;
  S.on = true;
  ensureCanvas();
  sizeCanvas();
  S.canvas.style.display = 'block';
  showChrome();
  window.addEventListener('resize', onResize);
  startOrientation(); // iOS permission runs inside this tap gesture
  ensureGeo(function () {
    syncHint();
    render();
    if (!S.renderTimer) S.renderTimer = setInterval(render, 5000);
    loadTLEs(function () { render(); });
  });
  syncPickerBtn();
  toast('Night Sky on — point your phone at the sky! 🌌');
  return true;
}
function stop() {
  S.on = false;
  stopOrientation();
  window.removeEventListener('resize', onResize);
  if (S.renderTimer) { clearInterval(S.renderTimer); S.renderTimer = 0; }
  hideChrome();
  if (S.canvas) S.canvas.style.display = 'none';
  S.proj = [];
  syncPickerBtn();
}
function toggle() { if (S.on) { stop(); return false; } start(); return true; }
function syncPickerBtn() {
  var btn = document.getElementById('ar-fun-nightsky');
  if (btn) btn.textContent = S.on ? '🌌 Sky: on' : '🌌 Sky';
}

/* ---------------- boot (guarded, retried) ---------------- */
var bootTries = 0;
function boot() {
  if (!window.__scB || !document.body) {
    if (++bootTries < 20) { setTimeout(boot, 500); return; }
  }
  window.ARFun = window.ARFun || {};
  window.ARFun.nightsky = { toggle: toggle, start: start, stop: stop, isOn: isOn };
  syncPickerBtn();
}
boot();
