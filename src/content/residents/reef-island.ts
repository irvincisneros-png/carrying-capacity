/**
 * The Reef Island cast. Warm, specific, Year 9 readable, Australian voice. No villains: each person is reasonable
 * from where they stand. Beats are 60 words or fewer after {placeholders} are filled in.
 *
 * Aunty Mere is a placeholder Elder of the island community. Every one of her beats and endings is general and
 * respectful, and carries needsConsultation: true. It must be written with the community before release.
 */
import { t } from '../../sim/conditions';
import type { ResidentDef } from '../../sim/residents';

const MERE = { needsConsultation: true } as const;

const mere: ResidentDef = {
  id: 'aunty-mere',
  name: 'Aunty Mere',
  role: 'Elder',
  elder: true,
  family: 'A Torres Strait Islander family who have lived on and fished this island for generations (placeholder: to be written with the community)',
  blurb: 'Elder of the island community. Funny, sharp-eyed and patient, with a big family and a boat shed full of nets. Placeholder name: to be agreed with the community. (Placeholder text: needs consultation before release.)',
  homeHint: { near: 'beach', description: 'A house above the beach with a verandah facing the reef pass' },
  portrait: 'aunty-mere',
  traits: ['patient', 'warm', 'sharp-eyed', 'good humoured'],
  start: 55,
  needsConsultation: true,
  cares: [
    { metric: 'partnership', weight: 4, bad: 5, good: 65 },
    { metric: 'reefPct', weight: 1.5, bad: 20, good: 70 },
    { metric: 'pop.reef-turtle', weight: 1, bad: 0, good: 6 },
    { metric: 'pop.dugong', weight: 1, bad: 0, good: 8 },
    { metric: 'streak.reef-turtle', weight: 1, bad: 0, good: 6 },
  ],
  reacts: { 'marine-heatwave': -4, 'storm-surge': -2 },
  beats: [
    {
      id: 'mere-country', title: 'Sea Country is family',
      when: { phase: ['act1'], years: [1900, 2020] },
      ...MERE,
      text: 'The reef, the seagrass, the turtles and the dugong are family to us, not just food. We read the winds and the tides to know the season. The town is new here, but we are not going anywhere. I hope you will listen.',
      tone: 'warm',
    },
    {
      id: 'mere-thanks', title: 'Thank you for asking',
      when: { all: [t('acts.consulted', '>=', 1)] },
      ...MERE,
      text: 'Thank you for sitting down with me on the verandah. Not many do. Listening is a good start, and there is plenty we can share when it is done in good faith. Bring the kids next time. They can help with the tea.',
      tone: 'warm',
    },
    {
      id: 'mere-waiting', title: 'The kettle is on',
      when: { phase: ['act1', 'turning-point'], years: [1930, 2020], all: [t('acts.consulted', '<=', 0)] },
      ...MERE,
      text: 'I have watched this island grow from my verandah. Nobody has knocked yet, and that is all right. If you ever want to yarn about the ground you are building on, or the water around it, the kettle is on.',
      tone: 'warm',
    },
    {
      id: 'mere-rangers', title: 'Our rangers',
      when: { phase: ['act2'], all: [t('partnership', '>=', 30)] },
      ...MERE,
      text: 'Our community rangers watch the reef, the seagrass and the turtle nests every season. They know when something is off long before a report says so. Would you back them with a boat and a few more hands?',
      tone: 'warm',
      choice: {
        prompt: 'Community rangers',
        options: [
          { id: 'back', label: 'Fund a boat and more ranger positions', effects: { budget: -15, partnership: 3, flags: { 'mere.rangersBacked': 1 }, mood: { 'aunty-mere': 8 } } },
          { id: 'later', label: 'Not this year', effects: { mood: { 'aunty-mere': -4 } } },
        ],
        ignored: { mood: { 'aunty-mere': -3 } },
      },
    },
    {
      id: 'mere-neglect', title: 'Talking past each other',
      when: { phase: ['act2'], years: [2040, 2100], all: [t('partnership', '<=', 22)] },
      ...MERE,
      text: 'Years go by and we still mostly talk past each other. I am not angry, only tired. The reef does not wait for us to sort it out. There is so much we could do together if someone just asked.',
      tone: 'concern',
    },
    {
      id: 'mere-later', title: 'The next generation',
      when: { phase: ['act2'], years: [2060, 2100], all: [t('partnership', '>=', 55)] },
      ...MERE,
      text: 'My granddaughter ran the ranger boat this season. She is nineteen and reads the water better than I did at her age. The sea remembers who looks after it, and it looks after them in return.',
      tone: 'joy',
    },
  ],
  endings: [
    {
      id: 'mere-good', quality: 'good', title: 'Sea Country, looked after together',
      when: { all: [t('partnership', '>=', 58)] },
      ...MERE,
      text: 'Sea Country is looked after together now. Aunty Mere\'s grandchildren run the ranger boat, and the school kids join the turtle patrol. "We are still here," she says, grinning. "And now so are you."',
    },
    {
      id: 'mere-mixed', quality: 'mixed', title: 'A good start',
      when: { all: [t('partnership', '>=', 35)] },
      ...MERE,
      text: 'Aunty Mere says the friendship has started well but has a long way to go. She is patient. "Tides take their time," she says. "I am happy to keep walking the beach with you."',
    },
    {
      id: 'mere-bad', quality: 'bad', title: 'It is not too late',
      ...MERE,
      text: 'The old knowledge stayed in Aunty Mere\'s family because nobody asked. She holds no grudge. "It is never too late to ask," she says, filling the kettle. "The door is always open."',
    },
  ],
};

const kieran: ResidentDef = {
  id: 'kieran-walsh',
  name: 'Kieran Walsh',
  role: 'Dive operator',
  family: 'The Walshes, who came north in the 1980s and now run the island\'s dive boat with their two teenagers on deckhand duty',
  blurb: 'Runs the dive boat and sees the reef every single day. Cheerful, weathered, and the first to notice when something is wrong underwater.',
  homeHint: { near: 'beach', description: 'A tin-roofed house by the jetty, with wetsuits on the line' },
  portrait: 'kieran-walsh',
  traits: ['cheerful', 'observant', 'sunburnt', 'a bit stubborn'],
  start: 62,
  cares: [
    { metric: 'reefPct', weight: 3, bad: 15, good: 75 },
    { metric: 'tourism', weight: 2, bad: 20, good: 70 },
    { metric: 'recent.marine-heatwave', weight: 2, bad: 2, good: 0 },
    { metric: 'recent.crown-of-thorns', weight: 1.5, bad: 2, good: 0 },
    { metric: 'society', weight: 0.5, bad: 25, good: 70 },
  ],
  reacts: { 'marine-heatwave': -18, 'crown-of-thorns': -8, 'storm-surge': -3 },
  beats: [
    {
      id: 'kieran-first-dive', title: 'Every dive a postcard',
      when: { phase: ['act1'], years: [1960, 2020] },
      text: 'Some mornings I roll off the back of the boat and the whole drop-off is lit up: staghorn, giant clams, a reef shark cruising past like it owns the place. Twenty years on and I still say "wow" into my regulator.',
      tone: 'joy',
    },
    {
      id: 'kieran-starfish', title: 'Spikes on the bommie',
      when: { phase: ['act1'], years: [1980, 2020], all: [t('estuary', '<=', 65)] },
      text: 'Found a crown-of-thorns starfish chewing through the bommie today, then another, then ten. Coral gets eaten from the inside out. The water has been greener lately, and I have a feeling that is not a coincidence.',
      tone: 'concern',
      choice: {
        prompt: 'Starfish on the reef',
        options: [
          { id: 'cull', label: 'Pay divers to cull the starfish', effects: { budget: -12, flags: { 'kieran.culled': 1 }, mood: { 'kieran-walsh': 8 } } },
          { id: 'wait', label: 'Wait and watch', effects: { mood: { 'kieran-walsh': -5 } } },
        ],
        ignored: { mood: { 'kieran-walsh': -3 } },
      },
    },
    {
      id: 'kieran-white', title: 'No colour',
      when: { phase: ['turning-point'] },
      urgent: true,
      text: 'Last dive of the season, and the reef was white. Bone white, drop-off to lagoon. Guests asked me where the colour went. I had no good answer. I have taught that reef to ten thousand people. I do not know what to tell the next one.',
      tone: 'loss',
    },
    {
      id: 'kieran-nursery', title: 'Planting coral',
      when: { phase: ['act2'], years: [2026, 2100], all: [t('count.coralnursery', '>=', 1)] },
      text: 'The nursery is growing coral fragments on frames in the lagoon, and we plant them out by hand. It is slow, wet work. Last week I saw a baby clownfish move into one of ours. Tell me that is not worth it.',
      tone: 'joy',
    },
    {
      id: 'kieran-bookings', title: 'Cancelled bookings',
      when: { phase: ['act2'], years: [2028, 2100], all: [t('recent.marine-heatwave', '>=', 1), t('tourism', '<=', 55)] },
      text: 'Three groups cancelled this week. They read the news about bleaching and do not want to see a graveyard. I do not blame them. But my boat loan does not know about bleaching, and neither does my fuel bill.',
      tone: 'concern',
    },
    {
      id: 'kieran-back', title: 'Colour on the drop-off',
      when: { phase: ['act2'], years: [2050, 2100], all: [t('reefPct', '>=', 50)] },
      text: 'There is colour on the drop-off again. Not like my dad\'s photos, but real: branching coral, small fish, a turtle. My daughter, who is nineteen and unimpressed by most things, just stared. Then she asked if she could work the boat.',
      tone: 'joy',
    },
    {
      id: 'kieran-grey', title: 'Selling the boat',
      when: { phase: ['act2'], years: [2055, 2100], all: [t('reefPct', '<=', 30)] },
      text: 'I sold the boat in autumn to a bloke from the mainland. The reef is grey rubble in most places now. I took the kids out one last time and showed them where the good dives used to be. They were quiet all the way back.',
      tone: 'loss',
    },
  ],
  endings: [
    {
      id: 'kieran-good', quality: 'good', title: 'Kieran takes the kids out',
      when: { all: [t('reefPct', '>=', 50), t('mood.kieran-walsh', '>=', 50)] },
      text: 'Kieran\'s daughter skippers the dive boat now. The reef is not what it was, but it is alive, and every morning the first snorkellers surface and shout. He sits on the jetty and lets them.',
    },
    {
      id: 'kieran-mixed', quality: 'mixed', title: 'A smaller business',
      when: { all: [t('reefPct', '>=', 30)] },
      text: 'Kieran runs half as many trips as he used to, and takes guests to the few sites that are still bright. He gets up early, tells the truth about the reef, and people come anyway.',
    },
    {
      id: 'kieran-bad', quality: 'bad', title: 'The jetty is quiet',
      text: 'Kieran works on the mainland now, fixing boats for other people. Sometimes a photo of the old drop-off turns up on his phone. He swipes past it quickly and then goes back to find it.',
    },
  ],
};

const sione: ResidentDef = {
  id: 'sione-havili',
  name: 'Sione Havili',
  role: 'Fisher',
  family: 'The Havilis, a Pacific Islander family on the island for three generations. His kids help with the traps on weekends.',
  blurb: 'Handline and trap fisher. His catch follows the health of the reef and the inlet. Generous, loud at church, and quiet on the water.',
  homeHint: { near: 'estuary', description: 'A house by the mangrove inlet with a tinny on a trailer out front' },
  portrait: 'sione-havili',
  traits: ['generous', 'hard-working', 'loud laugher', 'proud'],
  start: 60,
  cares: [
    { metric: 'reefPct', weight: 2, bad: 15, good: 70 },
    { metric: 'pop.reef-fish', weight: 2.5, bad: 0, good: 100 },
    { metric: 'estuary', weight: 2, bad: 15, good: 80 },
    { metric: 'flag.fishingProtocol', weight: 1, bad: 0, good: 1 },
    { metric: 'flag.fishing.rest', weight: 1, bad: 0, good: 1 },
    { metric: 'society', weight: 0.5, bad: 25, good: 70 },
  ],
  reacts: { 'marine-heatwave': -10, 'fish-kill': -10, 'storm-surge': -4 },
  beats: [
    {
      id: 'sione-handline', title: 'A good day on the handline',
      when: { phase: ['act1'], years: [1940, 2020] },
      text: 'Dad taught me to feel a coral trout bite through the line before you see it. Dinner for forty people from one good morning on the reef. Church on Sunday, a feed after. I want my kids to have that.',
      tone: 'warm',
    },
    {
      id: 'sione-inlet', title: 'The inlet has changed',
      when: { phase: ['act1'], years: [1970, 2020], all: [t('estuary', '<=', 60)] },
      text: 'The mangrove inlet used to be thick with mud crabs and baby fish. Now the water is cloudy, and the traps come up half empty. Something is going into it from the town. I am not blaming anyone. I just want it fixed.',
      tone: 'concern',
      choice: {
        prompt: 'The inlet is getting worse',
        options: [
          { id: 'treat', label: 'Back a sewage upgrade for the town', effects: { budget: -18, tiles: [{ op: 'water', scope: 'estuary', mult: 0.88 }], flags: { 'sione.sewageBacked': 1 }, mood: { 'sione-havili': 8 } } },
          { id: 'wait', label: 'Wait and see', effects: { mood: { 'sione-havili': -5 } } },
        ],
        ignored: { mood: { 'sione-havili': -3 } },
      },
    },
    {
      id: 'sione-bleach', title: 'Fish with nowhere to go',
      when: { phase: ['act2'], years: [2025, 2100], all: [t('recent.marine-heatwave', '>=', 1)] },
      text: 'The coral went white, and now the fish are gone from my spots. A parrotfish or two, nothing like before. Fish need the coral for a home. You cannot catch what has nowhere to live. My kids ask me when it will come back.',
      tone: 'loss',
    },
    {
      id: 'sione-rest', title: 'Letting the reef rest',
      when: { phase: ['act2'], years: [2028, 2100], all: [t('pop.reef-fish', '<=', 80)] },
      text: 'Fishers talk about it at the ramp. A few weeks each summer when nobody fishes the spawning spots, so the fish can breed in peace. It costs me income, but a reef with no fish costs me everything.',
      tone: 'concern',
      choice: {
        prompt: 'Seasonal rests for the reef',
        options: [
          { id: 'rest', label: 'Support seasonal rests on the spawning spots', effects: { budget: -8, flags: { 'fishing.rest': 1 }, mood: { 'sione-havili': 5 } } },
          { id: 'keep', label: 'Leave the fishing as it is', effects: { mood: { 'sione-havili': 2 } } },
        ],
        ignored: { mood: { 'sione-havili': -2 } },
      },
    },
    {
      id: 'sione-shoals', title: 'The shoals are back',
      when: { phase: ['act2'], years: [2045, 2100], all: [t('pop.reef-fish', '>=', 90)] },
      text: 'Pulled up a coral trout this morning the length of my forearm. My boy, fourteen, took the photo. We let her go. He asked why. I said so there is one for his kids to meet. He looked at me like I was clever.',
      tone: 'joy',
    },
    {
      id: 'sione-empty', title: 'Working on the mainland',
      when: { phase: ['act2'], years: [2055, 2100], all: [t('pop.reef-fish', '<=', 30)] },
      text: 'I do shifts at the sugar mill on the mainland now. The traps stay in the shed, and the tinny is for sale. My boy asks if he could ever fish here. I want to say yes, and I do not have the words.',
      tone: 'loss',
    },
  ],
  endings: [
    {
      id: 'sione-good', quality: 'good', title: 'Sione and the next boat',
      when: { all: [t('pop.reef-fish', '>=', 80), t('mood.sione-havili', '>=', 50)] },
      text: 'Sione\'s son runs his own boat, handline only, a trout or two a day and all of it sold on the island. Sione sits in the stern with a thermos, telling him he is holding the line wrong.',
    },
    {
      id: 'sione-mixed', quality: 'mixed', title: 'Fishing part-time',
      when: { all: [t('pop.reef-fish', '>=', 40)] },
      text: 'Sione fishes at weekends and works the rest of the week at the resort. The catch is smaller, but it is still dinner for forty after church, and he still goes out every Saturday.',
    },
    {
      id: 'sione-bad', quality: 'bad', title: 'The traps stay in the shed',
      text: 'Sione moved the family to the mainland for work. The tinny is gone, but the stories about the reef are still his, and his kids tell them as if they had seen it themselves.',
    },
  ],
};

const tess: ResidentDef = {
  id: 'tess-okafor',
  name: 'Tess Okafor',
  role: 'Resort worker',
  family: 'The Okafors. Tess supports her mum and two young kids on her wage, and her sister works at the clinic.',
  blurb: 'Started as a housekeeper at the resort and is now a supervisor. The resort is the biggest employer on the island, and she knows every person who depends on it.',
  homeHint: { near: 'town', description: 'A low-set house a few streets back from the beach, with a mango tree out the front' },
  portrait: 'tess-okafor',
  traits: ['organised', 'loyal', 'quick witted', 'tired but not beaten'],
  start: 60,
  cares: [
    { metric: 'tourism', weight: 3, bad: 15, good: 70 },
    { metric: 'economy', weight: 1.5, bad: 25, good: 70 },
    { metric: 'homesLost', weight: 2, bad: 4, good: 0 },
    { metric: 'employment', weight: 1.5, bad: 40, good: 90 },
    { metric: 'society', weight: 1, bad: 25, good: 70 },
  ],
  reacts: { 'storm-surge': -8, 'marine-heatwave': -6, 'crown-of-thorns': -3 },
  beats: [
    {
      id: 'tess-housekeeper', title: 'From housekeeper to supervisor',
      when: { phase: ['act1'], years: [1970, 2020] },
      text: 'I started making beds at the resort at nineteen. Now I run the housekeeping team, eighteen of us, half from this island. Pay day is when the whole town gets a bit louder. I know what the resort means to this place.',
      tone: 'warm',
    },
    {
      id: 'tess-cyclone', title: 'After the cyclone',
      when: { phase: ['turning-point'] },
      urgent: true,
      text: 'The guests left on the last flight, and the bookings did not come back for a month. The resort cut hours. My mum asked if we are safe in our house. It is a metre above the high tide. I did not know what to say.',
      tone: 'concern',
    },
    {
      id: 'tess-cap', title: 'Fewer guests, fewer shifts',
      when: { phase: ['act2'], years: [2028, 2100], all: [t('flag.reef.visitorCap', '>=', 1)] },
      text: 'They have capped the number of guests on the reef. I get why. But the rosters are shorter, and two of my team have asked about work on the mainland. I told them to hold on. I am not sure I should have.',
      tone: 'concern',
    },
    {
      id: 'tess-flood', title: 'Water in the kitchen',
      when: { phase: ['act2'], years: [2028, 2100], all: [t('recent.storm-surge', '>=', 1), t('homesLost', '>=', 1)] },
      text: 'Our neighbours lost the house to the surge. The whole street helped carry what they could save up the hill, and the kids slept at the school. {homesLost} homes gone so far. I keep looking at the water mark on my own wall.',
      tone: 'loss',
    },
    {
      id: 'tess-solar', title: 'Guests who come back',
      when: { phase: ['act2'], years: [2030, 2100], all: [t('tourism', '>=', 50)] },
      text: 'Guests say they pick us because the reef is alive. You work somewhere good, they tell me. I almost cried at the front desk. Then I got on with the rosters, because the reef trips still need staff.',
      tone: 'joy',
    },
    {
      id: 'tess-leaving', title: 'The island is emptying',
      when: { phase: ['act2'], years: [2055, 2100], all: [t('tourism', '<=', 35)] },
      text: 'The resort closed wings last year. Half the shops on the main street are shuttered. My sister left the clinic for a job in Cairns. I still do the rosters. There are just fewer names on them.',
      tone: 'loss',
    },
  ],
  endings: [
    {
      id: 'tess-good', quality: 'good', title: 'Tess runs the front desk',
      when: { all: [t('tourism', '>=', 50), t('mood.tess-okafor', '>=', 50)] },
      text: 'Tess manages the resort now, and her whole housekeeping team is still on the island. Her kids go to the island school. She tells new staff the same thing: look after the reef and it looks after us.',
    },
    {
      id: 'tess-mixed', quality: 'mixed', title: 'Holding on',
      when: { all: [t('tourism', '>=', 30)] },
      text: 'Tess still works at the resort, on shorter rosters, and picks up shifts at the café on the side. The island is smaller but alive. She says that is something, and it is.',
    },
    {
      id: 'tess-bad', quality: 'bad', title: 'The last flight',
      text: 'Tess moved her family to Cairns after the resort shut. Her mum cried at the airport. Tess has kept the old staff badge in a drawer, and sometimes takes it out just to read the name of the island.',
    },
  ],
};

const hana: ResidentDef = {
  id: 'hana-yamamoto',
  name: 'Dr Hana Yamamoto',
  role: 'Marine biologist',
  science: true,
  family: 'The Yamamotos. Hana came to the island for a three-month project and stayed for the turtles.',
  blurb: 'Marine biologist at the island research station. Explains bleaching, sea level, runoff and starfish using your own numbers, and is honest about what is uncertain.',
  homeHint: { near: 'town', description: 'A flat above the research station, with tanks of coral on the verandah' },
  portrait: 'hana-yamamoto',
  traits: ['clear', 'kind', 'curious', 'allergic to jargon'],
  start: 55,
  cares: [
    { metric: 'reefPct', weight: 3, bad: 15, good: 70 },
    { metric: 'tempC', weight: 2, bad: 2.4, good: 1.4 },
    { metric: 'evidence', weight: 1, bad: 0, good: 6 },
    { metric: 'seaRiseCm', weight: 1.5, bad: 60, good: 10 },
    { metric: 'pop.dugong', weight: 1, bad: 0, good: 8 },
  ],
  reacts: { 'marine-heatwave': -8, 'crown-of-thorns': -4 },
  beats: [
    {
      id: 'hana-survey', title: 'The reef survey',
      when: { phase: ['act1'], years: [1980, 2020] },
      text: 'I have been counting coral on the same transect for years. Every colony is a little city. A reef takes decades to build and can lose a lot of it in one hot summer. I would like us to pay attention before then.',
      tone: 'warm',
    },
    {
      id: 'hana-explain', title: 'Why the coral turned white',
      when: { phase: ['turning-point'] },
      urgent: true,
      text: 'Coral lives with tiny algae that feed it and give it colour. When the sea stays too hot for too long, the coral expels them and goes white. It is not dead yet. If the water cools in time, it can recover.',
      tone: 'concern',
    },
    {
      id: 'hana-satellite', title: 'A warning from space',
      when: { phase: ['act2'], years: [2028, 2100], all: [t('recent.marine-heatwave', '>=', 1)] },
      text: 'Satellites watch the sea surface temperature from orbit. If we had that overlay running, we would have seen the heat building a season ahead. That gives the rangers and the boats time to shade, to cull, and to get ready.',
      tone: 'neutral',
    },
    {
      id: 'hana-sea', title: 'Higher tides',
      when: { phase: ['act2'], years: [2035, 2100], all: [t('seaRiseCm', '>=', 8)] },
      text: 'The sea is up about {slr} centimetres since 2025. Warm water expands, and ice on land melts into the ocean. Most of the island is only a metre above the high tide, so a few centimetres matter most when a cyclone arrives.',
      tone: 'concern',
    },
    {
      id: 'hana-recovery', title: 'Coral babies',
      when: { phase: ['act2'], years: [2045, 2100], all: [t('reefPct', '>=', 50)] },
      text: 'We found coral recruits on the plates this morning, thousands of tiny polyps settling on bare rock. Reefs recover when we give them time and cool, clear water. I did not expect to be this happy at six a.m.',
      tone: 'joy',
    },
    {
      id: 'hana-dugong', title: 'Dugongs in the meadow',
      when: { phase: ['act2'], years: [2040, 2100], all: [t('pop.dugong', '>=', 3)] },
      text: 'There are about {dugongs} dugongs grazing the seagrass this season, leaving long trails across the lagoon floor. They breed so slowly that every calf matters. Clear water and healthy seagrass are all they ask.',
      tone: 'joy',
    },
  ],
  endings: [
    {
      id: 'hana-good', quality: 'good', title: 'Hana publishes the good news',
      when: { all: [t('reefPct', '>=', 50), t('mood.hana-yamamoto', '>=', 50)] },
      text: 'Hana\'s paper on the island\'s coral comeback is read in classrooms around the world. She still dives every Tuesday. Her research station has a waiting list, mostly teenagers who want to count turtles.',
    },
    {
      id: 'hana-mixed', quality: 'mixed', title: 'The long monitoring',
      when: { all: [t('reefPct', '>=', 30)] },
      text: 'Hana keeps counting. The reef is half what it was, but it is still there, and the data show it can bounce back. She says science is mostly patience. She says it a little less sadly each year.',
    },
    {
      id: 'hana-bad', quality: 'bad', title: 'The last survey',
      text: 'Hana did the final survey of the old transect last winter. Most of it was rubble and algae. She wrote the report anyway, because someone should, and because the next generation will want to know what happened.',
    },
  ],
};

const twins: ResidentDef = {
  id: 'kiah-bailey',
  name: 'Kiah and Bailey',
  role: 'Schoolkids (twins)',
  family: 'Twins in Year 7 at the island school, who help the rangers with the turtle nest patrol after school',
  blurb: 'Twelve-year-olds who help the rangers check turtle nests at dawn. They ask the questions nobody else asks out loud.',
  homeHint: { near: 'beach', description: 'A fibro house near the school, with a turtle nest map taped to the fridge' },
  portrait: 'kiah-bailey',
  traits: ['curious', 'bossy', 'kind', 'full of questions'],
  start: 62,
  cares: [
    { metric: 'streak.reef-turtle', weight: 3, bad: 0, good: 6 },
    { metric: 'wildlifeAlive', weight: 1.5, bad: 1, good: 4 },
    { metric: 'homesLost', weight: 1.5, bad: 4, good: 0 },
    { metric: 'seaRiseCm', weight: 1, bad: 60, good: 10 },
    { metric: 'reefPct', weight: 1.5, bad: 20, good: 70 },
  ],
  reacts: { 'storm-surge': -6, 'marine-heatwave': -6 },
  beats: [
    {
      id: 'twins-nest', title: 'The dawn patrol',
      when: { phase: ['act1'], years: [1990, 2020] },
      text: 'Kiah says we have to be at the beach at five-thirty. Bailey says that is rude. But a ranger showed us the tracks where a turtle came up in the night, a trail as wide as a ute tyre. Okay. That was worth it.',
      tone: 'joy',
    },
    {
      id: 'twins-tilly', title: 'Meeting Big Tilly',
      when: { phase: ['act2'], years: [2025, 2100], all: [t('pop.reef-turtle', '>=', 1)] },
      text: 'We saw Big Tilly in the lagoon! She came up for air right beside the boat. She is as big as the kitchen table, and she looked right at us. Bailey wants to know how old she is. Nobody knows.',
      tone: 'joy',
    },
    {
      id: 'twins-lights', title: 'The wrong way',
      when: { phase: ['act2'], years: [2025, 2100], all: [t('flag.turtle.lights', '<=', 0)] },
      text: 'Some hatchlings went up the beach towards the car park lights instead of the sea. We carried them down in a bucket. Kiah cried a bit. Why can\'t the lights just be a different colour or turned off?',
      tone: 'concern',
      choice: {
        prompt: 'Lights and hatchlings',
        options: [
          { id: 'amber', label: 'Switch the beach lights to shielded amber', effects: { budget: -8, flags: { 'turtle.lights': 1 }, mood: { 'kiah-bailey': 8 } } },
          { id: 'ignore', label: 'Leave the lights as they are', effects: { mood: { 'kiah-bailey': -6 } } },
        ],
        ignored: { mood: { 'kiah-bailey': -4 } },
      },
    },
    {
      id: 'twins-streak', title: 'Another summer',
      when: { phase: ['act2'], years: [2028, 2100], all: [t('streak.reef-turtle', '>=', 2)] },
      text: 'Tilly nested again! The nest is on our patrol map, marked with a red flag. Bailey drew a calendar to count the summers in a row, and the rangers pinned it up at the station. Six in a row would be amazing.',
      tone: 'joy',
    },
    {
      id: 'twins-sea', title: 'Will it still be here?',
      when: { phase: ['act2'], years: [2040, 2100], all: [t('seaRiseCm', '>=', 10)] },
      text: 'Our teacher says the sea is rising. Our house is nearly as low as the road. Will the island still be here when we are old? Mum says to ask you. We are going to ask you again next year too.',
      tone: 'concern',
    },
    {
      id: 'twins-grown', title: 'Dear twins, from the future',
      when: { phase: ['act2'], years: [2070, 2100], all: [t('homesLost', '<=', 0)] },
      text: 'Our letter to you is finished. Dear town: we still live here, and nobody lost their home. We took our own kids to meet Tilly\'s grandchildren this summer. Thank you for listening to us when we were twelve.',
      tone: 'joy',
    },
  ],
  endings: [
    {
      id: 'twins-good', quality: 'good', title: 'Rangers, both of them',
      when: { all: [t('streak.reef-turtle', '>=', 3), t('mood.kiah-bailey', '>=', 50)] },
      text: 'Kiah and Bailey are both community rangers now. They lead the dawn turtle patrol with a clipboard and a head torch with a red filter. The island is still here. So are the turtles.',
    },
    {
      id: 'twins-mixed', quality: 'mixed', title: 'Still asking questions',
      when: { all: [t('wildlifeAlive', '>=', 2)] },
      text: 'Kiah and Bailey grew up and went to uni on the mainland. They come home each summer to help count nests. They still ask hard questions, and the island is still trying to answer them.',
    },
    {
      id: 'twins-bad', quality: 'bad', title: 'The empty nest map',
      text: 'The nest map in Kiah and Bailey\'s old kitchen has stayed bare for years. They live in the city and look at the sea from a high window. "We tried," Kiah says. "Did you?"',
    },
  ],
};

export const REEF_ISLAND_CAST: readonly ResidentDef[] = [mere, kieran, sione, tess, hana, twins];
