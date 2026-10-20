/**
 * The Net Zero City cast. A big harbour city, 2025 to 2100, no Act 1: every beat is turning point or Act 2.
 * No villains: the power station worker, the retired teacher, the bus driver and the student are all reasonable.
 *
 * Aunty Lorraine's content is placeholder text that needs consultation with the local Aboriginal community before
 * release: her resident entry, every beat and every ending carries needsConsultation: true.
 */
import { t } from '../../sim/conditions';
import type { ResidentDef } from '../../sim/residents';

const LORRAINE_ID = 'aunty-lorraine';
const NC = { needsConsultation: true } as const;

const lorraine: ResidentDef = {
  id: LORRAINE_ID,
  name: 'Aunty Lorraine',
  role: 'Elder',
  elder: true,
  family: 'A local Aboriginal family who have lived around this harbour since long before the city (placeholder: to be written with the community)',
  blurb: 'An Elder of the local Aboriginal community: practical, funny, a city person and a Country person. Wants to be at the table when the city plans. (Placeholder name: to be agreed with the community. All text needs consultation before release.)',
  homeHint: { near: 'estuary', description: 'A brick house near the estuary mudflats, with a view of the birds' },
  portrait: LORRAINE_ID,
  traits: ['practical', 'funny', 'patient', 'sharp-eyed'],
  start: 55,
  needsConsultation: true,
  cares: [
    { metric: 'partnership', weight: 4, bad: 5, good: 65 },
    { metric: 'healthPct', weight: 1.5, bad: 10, good: 50 },
    { metric: 'pop.shorebirds', weight: 1.2, bad: 0, good: 40 },
    { metric: 'pop.powerful-owl', weight: 1, bad: 0, good: 5 },
    { metric: 'canopyPct', weight: 1, bad: 10, good: 35 },
  ],
  reacts: { heatwave: -2, bushfire: -4 },
  beats: [
    {
      id: 'lorraine-table', title: 'A seat at the table',
      when: { phase: ['act2'], years: [2026, 2060], all: [t('acts.consulted', '<=', 0)] }, ...NC,
      text: 'I have sat in a lot of council meetings, love, usually at the back. This city plans for the next fifty years, and my family has been here far longer than that. I am not asking for much. Just a chair at the table, early on.',
      tone: 'warm',
    },
    {
      id: 'lorraine-foreshore', title: 'The edge of the harbour',
      when: { phase: ['act2'], years: [2030, 2100], all: [t('acts.consulted', '>=', 1)] }, ...NC,
      text: 'Thank you for asking first. The foreshore is the city\'s air-conditioner if you look after it: trees, mudflats, shade, a breeze off the water. Plan it with us and we can keep the birds, the shade and the walking track.',
      tone: 'warm',
      choice: {
        prompt: 'Planning the foreshore',
        options: [
          { id: 'together', label: 'Plan the foreshore together with Aunty Lorraine', effects: { partnership: 3, mood: { [LORRAINE_ID]: 8 }, flags: { 'lorraine.foreshore': 1 } } },
          { id: 'council', label: 'Let the council planners draw it up', effects: { mood: { [LORRAINE_ID]: -4 } } },
        ],
        ignored: { mood: { [LORRAINE_ID]: -3 } },
      },
    },
    {
      id: 'lorraine-birds', title: 'The birds on the mudflats',
      when: { phase: ['act2'], years: [2030, 2100], all: [t('pop.shorebirds', '>=', 5)] }, ...NC,
      text: 'The long-legged ones are back on the mudflat. They fly all the way from the far north to feed here, you know. Come down at low tide with a thermos and count them with me. {shorebirds} so far this season.',
      tone: 'joy',
    },
    {
      id: 'lorraine-fire', title: 'Cool burns in the foothills',
      when: { phase: ['act2'], years: [2035, 2100], all: [t('flag.culturalBurning', '>', 0)] }, ...NC,
      text: 'A low, slow burn in the cool months keeps the foothills bush healthy and the fuel down near the houses. We can do it together with your fire crews. They bring the trucks and the training. We bring the reading of the season.',
      tone: 'warm',
      choice: {
        prompt: 'Cool burning in the foothills',
        options: [
          { id: 'crews', label: 'Ask Aunty Lorraine to work alongside the fire crews', effects: { partnership: 3, mood: { [LORRAINE_ID]: 8 }, flags: { 'lorraine.crews': 1 } } },
          { id: 'brigade', label: 'Leave it to the fire brigade', effects: { mood: { [LORRAINE_ID]: -4 } } },
        ],
        ignored: { mood: { [LORRAINE_ID]: -3 } },
      },
    },
    {
      id: 'lorraine-heat', title: 'Checking on the old ones',
      when: { phase: ['turning-point', 'act2'], years: [2025, 2100], all: [t('recent.heatwave', '>=', 1)] }, ...NC,
      text: 'In the heat, our family does the rounds: tea, a cold cloth, a fan, a chat. Half the street is on the list now. Funny how a city has to be reminded that looking out for each other is an old way, not a new one.',
      tone: 'concern',
    },
    {
      id: 'lorraine-later', title: 'The grandkids and the river',
      when: { phase: ['act2'], years: [2065, 2100], all: [t('partnership', '>=', 50)] }, ...NC,
      text: 'My great-niece led the school walk along the river this year, and the council planners were walking behind her with clipboards. I nearly cried. Then I told her to stop talking so fast, because the owls were listening.',
      tone: 'joy',
    },
    {
      id: 'lorraine-neglect', title: 'Still at the back of the room',
      when: { phase: ['act2'], years: [2045, 2100], all: [t('partnership', '<=', 22)] }, ...NC,
      text: 'Plans keep arriving for comment after they are already drawn. I am not angry, love, only tired. A city that wants to be around in a hundred years needs the people who have been here for a lot longer.',
      tone: 'concern',
    },
  ],
  endings: [
    {
      id: 'lorraine-good', quality: 'good', title: 'The foreshore, planned together', ...NC,
      when: { all: [t('partnership', '>=', 58)] },
      text: 'The foreshore is shady, the mudflats are busy at low tide, and the city plans with the Traditional Owners at the table from day one. Aunty Lorraine still sits at the back, out of habit, and everyone moves to sit with her.',
    },
    {
      id: 'lorraine-mixed', quality: 'mixed', title: 'A good start', ...NC,
      when: { all: [t('partnership', '>=', 35)] },
      text: 'Aunty Lorraine says the city is learning to ask early, but not every time. She is patient and funny about it. "We will keep turning up," she says. "Bring a biscuit and a decent map."',
    },
    {
      id: 'lorraine-bad', quality: 'bad', title: 'Still waiting to be asked', ...NC,
      text: 'The city grew, cooled and changed, and most of it was decided without Aunty Lorraine\'s family in the room. She holds no grudge. "It is not too late to ask," she says. "The kettle is always on."',
    },
  ],
};

const gary: ResidentDef = {
  id: 'gary-novak',
  name: 'Gary Novak',
  role: 'Power station operator',
  family: 'The Novaks, with two kids at the local school and a footy club that runs on his weekends',
  blurb: 'Has run a coal unit for thirty years, is a union delegate and coaches the juniors. Knows the plant better than anyone, and knows what its closing means.',
  homeHint: { near: 'town', description: 'A brick house near the river, in sight of the power station chimneys' },
  portrait: 'gary-novak',
  traits: ['reliable', 'dry-humoured', 'loyal', 'proud'],
  start: 58,
  cares: [
    { metric: 'count.coalpower', weight: 2, bad: 0, good: 1 },
    { metric: 'employment', weight: 2, bad: 55, good: 95 },
    { metric: 'cleanJobs', weight: 2, bad: 0, good: 60 },
    { metric: 'society', weight: 1.2, bad: 40, good: 75 },
    { metric: 'economy', weight: 1, bad: 25, good: 70 },
  ],
  reacts: { blackout: -4, heatwave: -1 },
  beats: [
    {
      id: 'gary-shift', title: 'Keeping the lights on',
      when: { phase: ['turning-point', 'act2'], years: [2025, 2045], all: [t('count.coalpower', '>=', 1)] },
      text: 'Forty-seven degrees outside and I was inside the control room keeping half the city\'s fans running. Nobody thanks the bloke who stops a blackout. I am not asking for a medal, only for people to remember who was on shift.',
      tone: 'neutral',
    },
    {
      id: 'gary-closing', title: 'What happens to the crew',
      when: { phase: ['act2'], years: [2028, 2050], all: [t('acts.demolished.coalpower', '>=', 1)] },
      urgent: true,
      text: 'They are closing the station. I know the case for it, honestly. But there are three hundred of us, and we do not retrain by Friday. My mate\'s wife asked me if the town has a plan. I could not tell her.',
      tone: 'concern',
      choice: {
        prompt: 'The crew at the power station',
        options: [
          { id: 'retrain', label: 'Fund retraining and guaranteed clean-energy jobs for the crew', effects: { budget: -20, mood: { 'gary-novak': 10 }, flags: { 'gary.retrain': 1 } } },
          { id: 'payout', label: 'Offer redundancy payments only', effects: { budget: -8, mood: { 'gary-novak': -4 } } },
        ],
        ignored: { mood: { 'gary-novak': -6 }, society: -1 },
      },
    },
    {
      id: 'gary-footy', title: 'Under-12s on Saturday',
      when: { phase: ['act2'], years: [2030, 2070], all: [t('employment', '<=', 80)] },
      text: 'Half my under-twelves are asking if they will have to move. Their dads work down at the plant or the port. I teach them to kick with both feet. It is the only advice I have for a changing economy.',
      tone: 'concern',
    },
    {
      id: 'gary-battery', title: 'The new control room',
      when: { phase: ['act2'], years: [2035, 2100], all: [t('cleanJobs', '>=', 15), t('renewablePct', '>=', 40)] },
      text: 'Spent the week at the big battery site. Same job, really: watch the numbers, keep supply matched to demand. The coal dust is gone, and the screens are better. Do not tell the lads I said it was an improvement.',
      tone: 'warm',
    },
    {
      id: 'gary-late-good', title: 'Pop\'s old hard hat',
      when: { phase: ['act2'], years: [2055, 2100], all: [t('count.coalpower', '<=', 0)], any: [t('flag.gary.retrain', '>=', 1), t('cleanJobs', '>=', 25)] },
      text: 'My daughter runs a team at the grid control centre now. She wears my old hard hat to the open day, two sizes too big. {cleanJobs} people in this city work in clean jobs. I am proud, and a bit jealous.',
      tone: 'joy',
    },
    {
      id: 'gary-late-bad', title: 'The gate on Station Road',
      when: { phase: ['act2'], years: [2050, 2100], all: [t('count.coalpower', '<=', 0), t('flag.gary.retrain', '<=', 0), t('cleanJobs', '<=', 20)] },
      text: 'The station closed and the work did not follow us. Some of the crew went north to the mines. Some went on the pension early. I am not angry at anyone, but nobody ever sat us down and said, here is the plan.',
      tone: 'loss',
    },
  ],
  endings: [
    {
      id: 'gary-good', quality: 'good', title: 'Gary coaches the grid crew\'s kids',
      when: { all: [t('mood.gary-novak', '>=', 50), t('cleanJobs', '>=', 20)] },
      text: 'Gary trains the new control-room apprentices and still coaches the juniors on Saturday. The chimneys are gone from the skyline, and the crew\'s kids have their pick of clean jobs. "We kept the lights on," he says. "We just changed how."',
    },
    {
      id: 'gary-mixed', quality: 'mixed', title: 'A different kind of shift',
      when: { all: [t('mood.gary-novak', '>=', 42)] },
      text: 'Gary found work, though not the work he knew. He says the city did its best, and he says it a little quietly. On Saturdays he still coaches, and the boys still call him Coach and not Mr Novak.',
    },
    {
      id: 'gary-bad', quality: 'bad', title: 'Gary leaves the shift behind',
      text: 'Gary left for work up north, and the junior footy team folded without him. He rings the old crew every Sunday. The city got cleaner, he says, but nobody ever asked the crew how.',
    },
  ],
};

const dolores: ResidentDef = {
  id: 'dolores-fitzgerald',
  name: 'Dolores Fitzgerald',
  role: 'Retired teacher (lives alone)',
  family: 'The Fitzgeralds. Dolores is 82 and has taught three generations of the suburb. Her nephew rings every Sunday.',
  blurb: 'Retired primary teacher in a top-floor flat on the hot western side. Sharp, independent and not good at asking for help.',
  homeHint: { near: 'town', description: 'A top-floor flat in an old brick block on a treeless western street' },
  portrait: 'dolores-fitzgerald',
  traits: ['sharp-witted', 'independent', 'kind', 'stubborn'],
  start: 52,
  cares: [
    { metric: 'heatDeaths', weight: 3, bad: 25, good: 0 },
    { metric: 'canopyPct', weight: 2, bad: 8, good: 35 },
    { metric: 'recent.heatwave', weight: 1.5, bad: 3, good: 0 },
    { metric: 'recent.blackout', weight: 1.5, bad: 2, good: 0 },
    { metric: 'society', weight: 1, bad: 40, good: 75 },
  ],
  reacts: { heatwave: -8, blackout: -6 },
  beats: [
    {
      id: 'dolores-night', title: 'Too hot to sleep',
      when: { phase: ['turning-point'] },
      urgent: true,
      text: 'My flat was hotter inside than out, so I lay on the tiles in the bathroom with a wet tea towel on my neck. Mrs Haddad next door heard me knocking and took me in. I taught half this street, and I was too proud to ring anyone.',
      tone: 'concern',
    },
    {
      id: 'dolores-shade', title: 'A tree outside my window',
      when: { phase: ['act2'], years: [2026, 2060], all: [t('canopyPct', '>=', 12)] },
      text: 'They planted a tree outside my block last winter. It is only as tall as the letterbox, but already the footpath feels different. I watch it every morning like it is one of my old students. {canopy}% shade across the city, they tell me.',
      tone: 'warm',
    },
    {
      id: 'dolores-checkin', title: 'Someone knocks',
      when: { phase: ['act2'], years: [2027, 2100], all: [t('recent.heatwave', '>=', 1)] },
      text: 'A young woman from the council rang this morning, then knocked on the door to make sure I was drinking water. I said I was fine. She asked to see the water. I must say, I found that very reassuring.',
      tone: 'warm',
      choice: {
        prompt: 'Checking on people who live alone',
        options: [
          { id: 'checkin', label: 'Fund a neighbour check-in and cooling-centre ride service', effects: { budget: -12, mood: { 'dolores-fitzgerald': 9 }, flags: { 'heat.checkin': 1 } } },
          { id: 'leaflet', label: 'Send a heat-safety leaflet to every household', effects: { budget: -3, mood: { 'dolores-fitzgerald': 1 } } },
        ],
        ignored: { mood: { 'dolores-fitzgerald': -5 } },
      },
    },
    {
      id: 'dolores-blackout', title: 'The power goes off',
      when: { phase: ['act2'], years: [2026, 2100], all: [t('recent.blackout', '>=', 1)] },
      text: 'The lights went out at four in the afternoon, in the middle of a heatwave. The lift stopped, and so did the fan. I sat by the window with a book and a bottle of water and tried to behave like a person who was not frightened.',
      tone: 'concern',
    },
    {
      id: 'dolores-cool', title: 'The library has air-conditioning',
      when: { phase: ['act2'], years: [2030, 2100], all: [t('count.coolingcentre', '>=', 1)] },
      text: 'On hot days I walk to the cooling centre. The chairs are comfortable and there is a quiz on Tuesdays. I have met more of my neighbours in two summers than in twenty years. That, I did not see coming.',
      tone: 'joy',
    },
    {
      id: 'dolores-late', title: 'Letters from the old class',
      when: { phase: ['act2'], years: [2060, 2100], all: [t('heatDeaths', '<=', 30)] },
      text: 'A former student, now a grandfather, wrote to say the street trees have grown over his old school fence. He said the summers are still hot, but nobody on this street has to be afraid of them. I read it twice.',
      tone: 'joy',
    },
  ],
  endings: [
    {
      id: 'dolores-good', quality: 'good', title: 'Dolores on the shady verandah',
      when: { all: [t('heatDeaths', '<=', 30), t('mood.dolores-fitzgerald', '>=', 50)] },
      text: 'Dolores sits under a canopy of street trees with a cold drink and a book. Her neighbours check in on hot days, and so does she. "I taught this street to read," she says. "Now it looks after me."',
    },
    {
      id: 'dolores-mixed', quality: 'mixed', title: 'Hot summers, kind neighbours',
      when: { all: [t('mood.dolores-fitzgerald', '>=', 40)] },
      text: 'Summers are still brutal on the western side, but there is a tree, a fan, a knock on the door. Dolores gets through each one with the help of Mrs Haddad and a very good quiz team.',
    },
    {
      id: 'dolores-bad', quality: 'bad', title: 'The summer she did not ring',
      text: 'Dolores did not make it through a long hot week. The neighbours put a bench under the new tree in her name. Her old students came, and the street was quiet for a long time afterwards.',
    },
  ],
};

const aisha: ResidentDef = {
  id: 'aisha-rahman',
  name: 'Dr Aisha Rahman',
  role: 'City climate scientist',
  science: true,
  family: 'The Rahmans: her mother ran a pharmacy in the west, her brother is a paramedic',
  blurb: 'The council\'s chief scientist. Explains emissions, the lag in warming and the urban heat island with your own numbers.',
  homeHint: { near: 'town', description: 'A flat near the council building, with a thermometer on every windowsill' },
  portrait: 'aisha-rahman',
  traits: ['clear', 'calm', 'curious', 'allergic to jargon'],
  start: 55,
  cares: [
    { metric: 'tempC', weight: 3, bad: 2.4, good: 1.4 },
    { metric: 'emissionsPct', weight: 2.5, bad: 100, good: 20 },
    { metric: 'evidence', weight: 1, bad: 0, good: 6 },
    { metric: 'renewablePct', weight: 1.5, bad: 0, good: 90 },
    { metric: 'canopyPct', weight: 1, bad: 8, good: 35 },
  ],
  reacts: {},
  beats: [
    {
      id: 'aisha-numbers', title: 'The city in numbers',
      when: { phase: ['turning-point'] },
      urgent: true,
      text: 'Your city emits about {kt} kilotonnes of carbon dioxide a year, mostly from power stations, factories and highways. Asphalt soaks up heat all day and gives it back all night. The hottest streets are the ones with the fewest trees.',
      tone: 'neutral',
    },
    {
      id: 'aisha-progress', title: 'Good news, and a caution',
      when: { phase: ['act2'], years: [2030, 2100], all: [t('emissionsPct', '<=', 70), t('renewablePct', '>=', 30)] },
      text: 'Emissions are down to {kt} kilotonnes, from a peak of {peakKt}, and {ren}% of your power is renewable. Cutting emissions stops the warming from growing. It does not cool the city. Trees and shade do that.',
      tone: 'warm',
    },
    {
      id: 'aisha-slow', title: 'Where can we cut next?',
      when: { phase: ['act2'], years: [2035, 2100], all: [t('emissionsPct', '>', 75)] },
      text: 'Emissions are still {kt} kilotonnes a year, close to the peak of {peakKt}. I know it costs money. But every year we wait leaves more carbon dioxide in the air, and it stays there for centuries. Where can we cut first?',
      tone: 'concern',
    },
    {
      id: 'aisha-lag', title: 'Why is it still getting warmer?',
      when: { phase: ['act2'], years: [2045, 2100] },
      text: 'We cut emissions, yet it is {temp} C and still creeping up. Oceans warm slowly and carbon dioxide lasts for centuries, so some warming is already locked in. Every year we cut earlier makes the final number smaller.',
      tone: 'neutral',
      choice: {
        prompt: 'Cooling the city',
        options: [
          { id: 'trees', label: 'Back a city-wide shade and street-tree plan', effects: { budget: -15, mood: { 'aisha-rahman': 8 }, flags: { 'aisha.shade': 1 } } },
          { id: 'nothing', label: 'Focus on emissions only, for now', effects: { mood: { 'aisha-rahman': -2 } } },
        ],
        ignored: { mood: { 'aisha-rahman': -2 } },
      },
    },
    {
      id: 'aisha-netzero', title: 'The curve bends',
      when: { phase: ['act2'], years: [2040, 2100], all: [t('netZeroYear', '<=', 2060)] },
      text: 'Look at the line. Yearly emissions have stayed under 40 kilotonnes for a while now. That does not undo the carbon already in the air, but it means the city has stopped adding to the pile. Tell people it can be done.',
      tone: 'joy',
    },
    {
      id: 'aisha-letter-bad', title: 'Honest graphs',
      when: { phase: ['act2'], years: [2060, 2100], all: [t('netZeroYear', '>', 2050)] },
      text: 'The target year has passed and the city has not quite made it. The graphs are honest, even when they are not kind. But look at what you did manage: {species} species are still here, and emissions have fallen to {kt} kilotonnes.',
      tone: 'concern',
    },
  ],
  endings: [
    {
      id: 'aisha-good', quality: 'good', title: 'Graphs in the town hall',
      when: { all: [t('tempC', '<=', 1.9), t('mood.aisha-rahman', '>=', 48)] },
      text: 'Aisha\'s city dashboard hangs in the foyer, where residents check the heat, the trees and the emissions line each morning. "It used to be my job to explain these," she says. "Now everybody reads them."',
    },
    {
      id: 'aisha-mixed', quality: 'mixed', title: 'Better than most',
      when: { all: [t('tempC', '<=', 2.3)] },
      text: 'Aisha\'s data show the city helped, but not fast enough. "Better than most," she wrote in her last report. "Not as good as it could have been." She kept teaching at the university anyway.',
    },
    {
      id: 'aisha-bad', quality: 'bad', title: 'The warning stays on file',
      text: 'Aisha filed her last report knowing it would be read too late. She still teaches. "A graph only tells you where you are," she says. "What you do next is up to you."',
    },
  ],
};

const ravi: ResidentDef = {
  id: 'ravi-patel',
  name: 'Ravi Patel',
  role: 'Bus driver',
  family: 'The Patels, with a daughter at uni and a mother who still takes his bus on Thursdays',
  blurb: 'Drives route 441 through the western suburbs. Knows who has no car, no air-conditioning and no one to ring.',
  homeHint: { near: 'town', description: 'A townhouse near the depot, with a hand-written route map on the fridge' },
  portrait: 'ravi-patel',
  traits: ['friendly', 'observant', 'patient', 'a bit of a joker'],
  start: 58,
  cares: [
    { metric: 'transitPct', weight: 3, bad: 5, good: 70 },
    { metric: 'employment', weight: 1.5, bad: 55, good: 95 },
    { metric: 'airQuality', weight: 1.5, bad: 30, good: 85 },
    { metric: 'society', weight: 1.2, bad: 40, good: 75 },
    { metric: 'emissionsPct', weight: 1, bad: 100, good: 20 },
  ],
  reacts: { heatwave: -3, blackout: -3 },
  beats: [
    {
      id: 'ravi-441', title: 'Route 441',
      when: { phase: ['turning-point', 'act2'], years: [2025, 2040], all: [t('transitPct', '<=', 30)] },
      text: 'Half my passengers do not own a car. They go to the clinic, the shops, the night shift. Last week the bus air-conditioning broke at the hottest stop and a bloke sat in the aisle with his shirt off. I handed him my water bottle.',
      tone: 'concern',
    },
    {
      id: 'ravi-rail', title: 'The light rail opens',
      when: { phase: ['act2'], years: [2028, 2100], all: [t('count.transitline', '>=', 1)] },
      text: 'They opened the new line, and the first morning I rode it as a passenger. Strange to sit down while somebody else drives. It is quiet, quick and full by Wednesday. {transit}% of the city is within reach of it.',
      tone: 'joy',
    },
    {
      id: 'ravi-air', title: 'Clear air on the main road',
      when: { phase: ['act2'], years: [2032, 2100], all: [t('airQuality', '>=', 65), t('transitPct', '>=', 30)] },
      text: 'My daughter did not cough once this winter. The traffic on the main road is thinner, and I can see the ranges at the end of the street. I am a bus driver, not a scientist, but I reckon those two things are related.',
      tone: 'warm',
    },
    {
      id: 'ravi-electric', title: 'My new electric bus',
      when: { phase: ['act2'], years: [2030, 2100] },
      text: 'They have swapped half the depot to electric. No diesel smell, no rattle, and passengers can hear each other talk. The transition is a bit like my mother\'s cooking. Everyone has an opinion, and everyone is happy after.',
      tone: 'warm',
      choice: {
        prompt: 'The bus fleet',
        options: [
          { id: 'fleet', label: 'Replace the diesel buses with electric ones, depot by depot', effects: { budget: -20, emissionsKt: -2, mood: { 'ravi-patel': 8 }, flags: { 'ravi.electricFleet': 1 } } },
          { id: 'later', label: 'Keep the diesel fleet running until it wears out', effects: { mood: { 'ravi-patel': -2 } } },
        ],
        ignored: { mood: { 'ravi-patel': -3 } },
      },
    },
    {
      id: 'ravi-cars', title: 'The cars are still coming',
      when: { phase: ['act2'], years: [2040, 2100], all: [t('transitPct', '<=', 25)] },
      text: 'Cars everywhere, one person in each. The buses crawl through the same jams, and nobody picks a slow bus over a car. I am not blaming anyone. If you want the bus to win, give the bus a lane of its own.',
      tone: 'concern',
    },
    {
      id: 'ravi-late', title: 'The last day on 441',
      when: { phase: ['act2'], years: [2065, 2100], all: [t('transitPct', '>=', 50)] },
      text: 'My last shift on route 441. The whole bus clapped when I pulled in, and Mum was on the back seat with a tin of biscuits. I told her she was not supposed to tell the passengers. She said, Ravi, everyone knows.',
      tone: 'joy',
    },
  ],
  endings: [
    {
      id: 'ravi-good', quality: 'good', title: 'The 441 runs every five minutes',
      when: { all: [t('transitPct', '>=', 45), t('mood.ravi-patel', '>=', 50)] },
      text: 'Ravi retires after thirty-one years on the buses. The 441 runs every five minutes now, the air-conditioning works, and nobody waits in the heat. His mum rides it to the shops, free, and tells everyone he used to drive it.',
    },
    {
      id: 'ravi-mixed', quality: 'mixed', title: 'More buses, still gaps',
      when: { all: [t('mood.ravi-patel', '>=', 40)] },
      text: 'Ravi still drives, and the buses are better than they were. But some suburbs are still a long walk from a stop, and he still keeps a spare water bottle in the cab for the person who needs it.',
    },
    {
      id: 'ravi-bad', quality: 'bad', title: 'Fewer stops, longer walks',
      text: 'Ravi drives a cut-back route now. The stops he used to know by heart are gone, and so are some of his regulars. He hands out the water bottle, anyway. It is the only service he can still offer.',
    },
  ],
};

const zoe: ResidentDef = {
  id: 'zoe-lin',
  name: 'Zoe Lin',
  role: 'Student and climate-strike organiser',
  family: 'The Lins, with a mum who works nights and a little brother Zoe babysits most afternoons',
  blurb: 'Seventeen, organises the school strike, babysits for the neighbours and wants to know why it is taking so long.',
  homeHint: { near: 'town', description: 'A unit above a bakery, with strike banners drying on the balcony' },
  portrait: 'zoe-lin',
  traits: ['determined', 'funny', 'impatient', 'organised'],
  start: 55,
  cares: [
    { metric: 'tempC', weight: 2.5, bad: 2.4, good: 1.4 },
    { metric: 'emissionsPct', weight: 2.5, bad: 100, good: 20 },
    { metric: 'renewablePct', weight: 1.5, bad: 0, good: 90 },
    { metric: 'evidence', weight: 1, bad: 0, good: 6 },
    { metric: 'canopyPct', weight: 1, bad: 8, good: 35 },
  ],
  reacts: { heatwave: -3 },
  beats: [
    {
      id: 'zoe-strike', title: 'We are not too young',
      when: { phase: ['turning-point', 'act2'], years: [2025, 2045] },
      text: 'We walked out of school today, three hundred of us, in forty-one degrees. Someone said we should be in class. We were: it was a class about what the adults decided. I made the signs. My little brother drew a sun with a sad face.',
      tone: 'warm',
      choice: {
        prompt: 'The school strike',
        options: [
          { id: 'meet', label: 'Invite the strikers to present to council', effects: { mood: { 'zoe-lin': 8 }, flags: { 'zoe.invited': 1 } } },
          { id: 'ignore', label: 'Thank them and carry on with the plan', effects: { mood: { 'zoe-lin': -3 } } },
        ],
        ignored: { mood: { 'zoe-lin': -4 } },
      },
    },
    {
      id: 'zoe-slow', title: 'Why so slow?',
      when: { phase: ['act2'], years: [2030, 2060], all: [t('emissionsPct', '>', 65)] },
      text: 'Emissions are still {kt} kilotonnes a year. I am not trying to be rude. I babysit three kids on my street, and I do the sums: they will be thirty-five in 2050. Can we please be faster?',
      tone: 'concern',
    },
    {
      id: 'zoe-solar', title: 'Panels on the school roof',
      when: { phase: ['act2'], years: [2030, 2100], all: [t('renewablePct', '>=', 30)] },
      text: 'Our school roof is covered in solar panels and the whole assembly watched the meter run backwards. {ren}% of the city\'s power is renewable now. Mr Adeyemi said it started with a few kids and a petition. I made him say that again for the camera.',
      tone: 'joy',
    },
    {
      id: 'zoe-trees', title: 'Our class planted trees',
      when: { phase: ['act2'], years: [2028, 2100], all: [t('canopyPct', '>=', 14)] },
      text: 'We planted forty trees along the oval fence and named every one of them. It is a small thing compared with a power station. But the shade is real, and the little kids already play under it. Small things add up.',
      tone: 'warm',
    },
    {
      id: 'zoe-vote', title: 'First time voting',
      when: { phase: ['act2'], years: [2028, 2100] },
      text: 'I am eighteen next month and I have already checked the enrolment form three times. I know what I am voting for: trees, trains and a date for the last coal station. Is that too much to ask of a council?',
      tone: 'warm',
      minGapYears: 6,
    },
    {
      id: 'zoe-letter', title: 'A letter from Zoe, aged fifty',
      when: { phase: ['act2'], years: [2072, 2100] },
      text: 'To whoever is deciding things: I turn fifty next year. I think about the kids on the strike, the trees outside my window, and the year the lines finally bent. Whatever happened, thank you for listening before we were old enough to vote.',
      tone: 'warm',
      minGapYears: 0,
    },
  ],
  endings: [
    {
      id: 'zoe-good', quality: 'good', title: 'Zoe runs for council',
      when: { all: [t('emissionsPct', '<=', 25), t('mood.zoe-lin', '>=', 50)] },
      text: 'Zoe Lin is a councillor now, and her first motion is to plant a tree for every new baby born in the city. "I was seventeen when this started," she says. "I am forty-something and still impatient."',
    },
    {
      id: 'zoe-mixed', quality: 'mixed', title: 'The strike goes on',
      when: { all: [t('emissionsPct', '<=', 50)] },
      text: 'Zoe says the city got there more slowly than she wanted. She teaches kids to read data now, and the strike banners hang on her classroom wall. "We did it," she says. "We could have done it sooner."',
    },
    {
      id: 'zoe-bad', quality: 'bad', title: 'The banners come out again',
      text: 'Zoe still organises on the first Friday of the month. The banners are faded, and the kids carrying them are different kids. "We keep turning up," she says. "Somebody has to."',
    },
  ],
};

export const NET_ZERO_CITY_CAST: readonly ResidentDef[] = [lorraine, gary, dolores, aisha, ravi, zoe];
