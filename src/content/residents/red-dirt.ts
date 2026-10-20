/**
 * The Red Dirt cast: an outback mining town. Warm, specific, Year 9 readable, Australian voice. No villains: the
 * truck driver, the publican, the station owner and the scientist are all reasonable from where they stand.
 *
 * Uncle Wally's name and every line he speaks are placeholder text that needs consultation with the Traditional
 * Owners of the Country the mine sits on before release. Every one of his beats and endings carries
 * needsConsultation: true. No named nation, language, places or stories are used anywhere.
 */
import { t } from '../../sim/conditions';
import type { ResidentDef } from '../../sim/residents';

const MINE_CLOSED = [t('count.coalmine', '<=', 0)] as const;
const MINE_GONE_BY_PLAN = [t('count.coalmine', '<=', 0), t('acts.demolished.coalmine', '>=', 1)] as const;

// ---------------------------------------------------------------------------------------------------------
// Uncle Wally (placeholder name), Elder. All content needs consultation.
// ---------------------------------------------------------------------------------------------------------
const wally: ResidentDef = {
  id: 'uncle-wally',
  name: 'Uncle Wally',
  role: 'Elder',
  family: 'Wally\'s family, who have known this Country for a very long time',
  blurb: 'A Traditional Owner Elder who ran the local ranger crew and wants the Traditional Owners involved in decisions about the pit, the waterhole, the plants and the animals.',
  homeHint: { near: 'wetland', description: 'A tin-roofed house in sight of the waterhole' },
  portrait: 'uncle-wally',
  traits: ['experienced', 'direct', 'practical'],
  start: 55,
  cares: [
    { metric: 'partnership', weight: 3, bad: 10, good: 70 },
    { metric: 'rehabPct', weight: 2, bad: 0, good: 100 },
    { metric: 'pop.bilby', weight: 1, bad: 0, good: 10 },
    { metric: 'pop.budgerigar', weight: 1, bad: 0, good: 120 },
    { metric: 'aquifer', weight: 1.5, bad: 25, good: 75 },
  ],
  reacts: { drought: -2, heatwave: -2 },
  needsConsultation: true,
  elder: true,
  beats: [
    {
      id: 'wally-waterhole', title: 'Before the pub',
      when: { phase: ['act1'], years: [1890, 1955] },
      text: 'That waterhole was here long before the pub, and plenty of people have drunk from it. Camp, build, dig: I am not saying don\'t. I am saying yarn with us first. And keep the cattle off the edge, because the birds need somewhere to land.',
      tone: 'neutral',
      needsConsultation: true,
    },
    {
      id: 'wally-pit', title: 'The big hole',
      when: { phase: ['act1'], years: [1960, 2020], all: [t('count.coalmine', '>=', 1)] },
      text: 'Nobody asked us about the big hole. When the ore is gone, I want a seat at the table, not a letter in the post. The people who work there have a job to do, and deciding what happens to this ground is part of ours too.',
      tone: 'concern',
      needsConsultation: true,
    },
    {
      id: 'wally-rest', title: 'Let the waterhole rest',
      when: { phase: ['act2'], years: [2028, 2075] },
      text: 'After a good wet the waterhole fills and everyone wants a piece of it. I reckon it should rest for a season: no stock, no machinery, just the birds and the animals. The cattle people will not love that. Back me up?',
      tone: 'neutral',
      needsConsultation: true,
      choice: {
        prompt: 'Uncle Wally asks for the waterhole to rest',
        options: [
          {
            id: 'rest', label: 'Agree: rest the waterhole for a full season',
            effects: { partnership: 4, flags: { 'o.rest': 1 }, mood: { 'uncle-wally': 7, 'pete-hanrahan': -3 }, incomePerYear: -1 },
          },
          {
            id: 'short', label: 'Try a shorter rest, a few months at the driest time',
            effects: { partnership: 1, mood: { 'uncle-wally': 2 } },
          },
        ],
        ignored: { mood: { 'uncle-wally': -3 } },
      },
    },
    {
      id: 'wally-seed', title: 'Local seed',
      when: { phase: ['act2'], all: [t('acts.rehab.2', '>=', 1)] },
      text: 'We collected seed from plants that already grow on this Country, so the new growth suits the ground. Imported grass would have been quicker, but it can spread where it is not wanted. Twelve kinds of seed were counted in a single bucket.',
      tone: 'joy',
      needsConsultation: true,
    },
    {
      id: 'wally-lowtrust', title: 'Still turning up',
      when: { phase: ['act2'], years: [2035, 2100], all: [t('partnership', '<=', 28)] },
      text: 'I keep coming to your meetings, and I will keep coming. But it would be good if somebody asked before the machines moved, not after. We know this ground. We would like to help you get it right.',
      tone: 'concern',
      needsConsultation: true,
    },
    {
      id: 'wally-signoff', title: 'The whole pit, green',
      when: { phase: ['act2'], all: [t('rehabPct', '>=', 100)] },
      urgent: true,
      text: 'We walked the old pit today with the rehabilitation team, and I stood where the edge used to be. Green. Spinifex coming back, a hawk riding the warm air. I told the young fellas: remember this. Remember being asked.',
      tone: 'joy',
      needsConsultation: true,
    },
  ],
  endings: [
    {
      id: 'wally-good', quality: 'good', title: 'Uncle Wally walks the ranger crew out',
      when: { all: [t('partnership', '>=', 45), t('mood.uncle-wally', '>=', 52)] },
      text: 'Uncle Wally and the young ranger crew walk the old pit, now green, checking the ground and the plants together. The rehabilitation plan was written with the Traditional Owners from the start, and their advice shaped the final land use.',
      needsConsultation: true,
    },
    {
      id: 'wally-mixed', quality: 'mixed', title: 'Uncle Wally keeps turning up',
      when: { all: [t('partnership', '>=', 28)] },
      text: 'Uncle Wally still comes to the meetings. Some of the Country is healing and some is still waiting. He asks that the Traditional Owners stay involved in every decision about the site, not only the big ones.',
      needsConsultation: true,
    },
    {
      id: 'wally-bad', quality: 'bad', title: 'Uncle Wally watches from the verandah',
      text: 'Many decisions about the pit were made without the Traditional Owners at the table. How Uncle Wally and his family respond is theirs to say, and this game does not presume it. Asking, and acting on the answer, is still possible.',
      needsConsultation: true,
    },
  ],
};

// ---------------------------------------------------------------------------------------------------------
// Shaz Dimitriou, haul-truck operator.
// ---------------------------------------------------------------------------------------------------------
const shaz: ResidentDef = {
  id: 'shaz-dimitriou',
  name: 'Shaz Dimitriou',
  role: 'Haul-truck operator',
  family: 'The Dimitrious: Shaz, her partner Con, and their two kids Mia and Theo',
  blurb: 'Drives a 200-tonne truck at the mine and is proud of the pay. Worried about what happens to the family when the ore runs out.',
  homeHint: { near: 'town', description: 'A demountable home two streets from the pub, with a trampoline in the red dirt out the back' },
  portrait: 'shaz-dimitriou',
  traits: ['proud', 'hard-working', 'blunt', 'warm'],
  start: 60,
  cares: [
    { metric: 'heavyJobsPct', weight: 2.5, bad: 0, good: 80 },
    { metric: 'employment', weight: 1.5, bad: 40, good: 90 },
    { metric: 'economy', weight: 1, bad: 25, good: 70 },
    { metric: 'society', weight: 0.8, bad: 25, good: 70 },
    { metric: 'flag.mine.retrain', weight: 2, bad: 0, good: 1 },
    { metric: 'cleanJobs', weight: 1, bad: 0, good: 10 },
  ],
  reacts: { blackout: -3, heatwave: -2 },
  beats: [
    {
      id: 'shaz-truck', title: 'Two hundred tonnes',
      when: { phase: ['act1'], years: [1985, 2020], all: [t('count.coalmine', '>=', 1)] },
      text: 'My truck carries two hundred tonnes, and the tyres are taller than the ute. Red dust in my teeth, and the pay buys Mia and Theo everything they need. Ask me if I like it and I will say yes, then ask me about the future.',
      tone: 'warm',
    },
    {
      id: 'shaz-worry', title: 'What comes after the ore',
      when: { phase: ['act2'], years: [2025, 2060], all: [t('count.coalmine', '>=', 1)] },
      text: 'Everyone knows the ore is not forever. I am not asking for the mine to run until I am old. I am asking for a plan with my name on it, and a ticket for the next job before the last one ends.',
      tone: 'concern',
      choice: {
        prompt: 'Shaz asks for a plan for mine workers',
        options: [
          {
            id: 'retrain', label: 'Fund retraining for mine workers now',
            effects: { budget: -12, flags: { 'mine.retrain': 1 }, mood: { 'shaz-dimitriou': 8 }, society: 0.5 },
          },
          { id: 'later', label: 'Not yet, but promise to revisit it soon', effects: { mood: { 'shaz-dimitriou': -4 } } },
        ],
        ignored: { mood: { 'shaz-dimitriou': -5 } },
      },
    },
    {
      id: 'shaz-solar', title: 'Cleaning the panels',
      when: { phase: ['act2'], years: [2030, 2100], all: [t('count.solarfarm', '>=', 1)] },
      text: 'I do two days a week on the solar farm now, hosing dust off the panels at sunrise. Different job, same red dirt. Con says I sing in the cab. Out here the sun is the one thing nobody has to dig up.',
      tone: 'warm',
    },
    {
      id: 'shaz-closed-retrained', title: 'Moving the spoil back',
      when: { phase: ['act2'], all: [...MINE_GONE_BY_PLAN, t('flag.mine.retrain', '>=', 1)] },
      text: 'Same truck, new job. We are pushing the old spoil back into the pit and shaping it, following the rehabilitation team\'s plan for where the water should run. The mine paid for my house. Now I get to help fix the hole.',
      tone: 'warm',
      effects: { mood: { 'shaz-dimitriou': 4 } },
    },
    {
      id: 'shaz-closed-abrupt', title: 'The gate and the letter',
      when: { phase: ['act2'], all: [...MINE_GONE_BY_PLAN, t('flag.mine.retrain', '<=', 0)] },
      urgent: true,
      text: 'The gate shut and the letter came the same week. No plan, no ticket for a next job. Con and I sat up with the kids\' school fees and the mortgage. I am not angry. I just do not know where we go from here.',
      tone: 'loss',
      effects: { mood: { 'shaz-dimitriou': -8 }, society: -1 },
    },
    {
      id: 'shaz-stuck', title: 'Still hauling',
      when: { phase: ['act2'], years: [2055, 2100], all: [t('count.coalmine', '>=', 1)] },
      text: 'The pit gets deeper and the trucks get older. I see Mia\'s friends leaving town for jobs that are not here. I would stay, if there was something to stay for. Nobody has told us what that something is.',
      tone: 'concern',
    },
  ],
  endings: [
    {
      id: 'shaz-good', quality: 'good', title: 'Shaz drives the first truck onto green ground',
      when: { all: [t('mood.shaz-dimitriou', '>=', 50)], any: [t('flag.mine.retrain', '>=', 1), t('cleanJobs', '>=', 8)] },
      text: 'Shaz drives a truck again, this time carrying topsoil to the old pit. Mia runs the solar farm control room and Theo rides along on school holidays. "Dirt is dirt," Shaz says. "We just got better at putting it back."',
    },
    {
      id: 'shaz-mixed', quality: 'mixed', title: 'Shaz makes it work',
      when: { all: [t('mood.shaz-dimitriou', '>=', 42)] },
      text: 'Shaz found work, though it is not the pay she had. The kids stayed at school in town, and she says the town did what it could. She still misses the sound of the big truck starting up in the morning.',
    },
    {
      id: 'shaz-bad', quality: 'bad', title: 'Shaz moves the family',
      text: 'Shaz and Con packed up the demountable and drove south, kids asleep in the back. Mia says she misses the red dirt. Shaz does not say much, but she still checks the mine\'s jobs board every week.',
    },
  ],
};

// ---------------------------------------------------------------------------------------------------------
// Bev Gallagher, publican. The turning point hits her.
// ---------------------------------------------------------------------------------------------------------
const bev: ResidentDef = {
  id: 'bev-gallagher',
  name: 'Bev Gallagher',
  role: 'Publican',
  family: 'The Gallaghers, who have kept the pub for two generations. Bev\'s daughter Jess helps out on weekends.',
  blurb: 'Runs the pub, which is also the town\'s cool room, noticeboard and meeting place. She knows everyone\'s business and keeps most of it to herself.',
  homeHint: { near: 'town', description: 'Rooms above the pub, with a veranda that looks over the gravel strip where the flying doctor lands' },
  portrait: 'bev-gallagher',
  traits: ['sharp', 'generous', 'unflappable', 'a good listener'],
  start: 62,
  cares: [
    { metric: 'heatDeaths', weight: 3, bad: 8, good: 0 },
    { metric: 'recent.heatwave', weight: 1.5, bad: 2, good: 0 },
    { metric: 'society', weight: 1.5, bad: 25, good: 70 },
    { metric: 'unmetPct', weight: 1, bad: 10, good: 0 },
    { metric: 'economy', weight: 1, bad: 25, good: 70 },
    { metric: 'population', weight: 0.7, bad: 20, good: 150 },
  ],
  reacts: { heatwave: -8, blackout: -6 },
  beats: [
    {
      id: 'bev-pub', title: 'The heart of the town',
      when: { phase: ['act1'], years: [1890, 2020] },
      text: 'The pub is where the town keeps itself. Shearers, truckies, the flying doctor and the school bus driver all end up at my bar. When the generator dies, they bring their own torches. I do not run a business, I run a living room.',
      tone: 'warm',
    },
    {
      id: 'bev-heatwave', title: 'Out of ice',
      when: { phase: ['turning-point'] },
      urgent: true,
      text: 'By Wednesday every old bloke in town was sleeping on my floor, because the pub was the only cool room we had. I ran out of ice. The flying doctor landed three times in one arvo. Then the rain came, and nobody said a word.',
      tone: 'loss',
    },
    {
      id: 'bev-battery', title: 'When the grid trips',
      when: { phase: ['act2'], years: [2026, 2070] },
      text: 'The pub is the cool room, and when the power trips, so does the cool room. I can hire a bigger diesel generator or put in a battery. The battery costs more upfront. The diesel makes the whole street smell like a truck stop.',
      tone: 'neutral',
      choice: {
        prompt: 'Bev asks how to keep the cool room running in a blackout',
        options: [
          {
            id: 'battery', label: 'Help fund a battery for the pub',
            effects: { budget: -10, flags: { 'heat.pubBattery': 1 }, mood: { 'bev-gallagher': 7 }, society: 0.5 },
          },
          {
            id: 'diesel', label: 'Hire a bigger diesel generator',
            effects: { budget: -3, emissionsKt: 3, mood: { 'bev-gallagher': 2 } },
          },
        ],
        ignored: { mood: { 'bev-gallagher': -4 } },
      },
    },
    {
      id: 'bev-heat-loss', title: 'A card on the bar',
      when: { phase: ['act2'], years: [2028, 2100], all: [t('heatDeaths', '>=', 1)] },
      text: 'We have lost {deaths} people to the heat since that week. I know every name. I put a card on the bar for each of them. I would like a number that stops going up.',
      tone: 'loss',
    },
    {
      id: 'bev-heat-ok', title: 'Hottest week, full house',
      when: { phase: ['act2'], years: [2035, 2100], all: [t('heatDeaths', '<=', 0), t('recent.heatwave', '>=', 1)] },
      text: 'Hottest week in years and nobody went to hospital. The cool room was full of kids, old blokes and one very smug dog. I stood at the bar and thought, this is what a town is for.',
      tone: 'joy',
    },
    {
      id: 'bev-quiet', title: 'Quiet on a Friday',
      when: { phase: ['act2'], years: [2045, 2100], all: [...MINE_CLOSED, t('society', '<=', 50)] },
      text: 'Friday used to mean a full bar at knock-off. Now it is a few locals and the kids\' school fundraiser. I am not going anywhere. But a pub needs a town around it, and a town needs a reason.',
      tone: 'concern',
    },
  ],
  endings: [
    {
      id: 'bev-good', quality: 'good', title: 'Bev hangs up the bar towel, slowly',
      when: { all: [t('mood.bev-gallagher', '>=', 52), t('heatDeaths', '<=', 4)] },
      text: 'Bev\'s pub is still the cool room on the hottest days, and Jess runs it now. Bev has a seat by the window, a bowl of ice and a view of the flying doctor landing on the gravel. "I know everyone\'s business," she says, "and it is mostly good."',
    },
    {
      id: 'bev-mixed', quality: 'mixed', title: 'Bev keeps the doors open',
      when: { all: [t('mood.bev-gallagher', '>=', 42)] },
      text: 'Bev keeps the pub open, and the cool room still runs, though some summers are frightening. She keeps the cards from the bar in a biscuit tin. "We look after each other," she says. "We have to."',
    },
    {
      id: 'bev-bad', quality: 'bad', title: 'Bev closes the pub',
      text: 'The pub closed the winter after the worst summer. Bev kept the cards from the bar and the old noticeboard. People still call round to her kitchen, because that is where the town went when the pub shut.',
    },
  ],
};

// ---------------------------------------------------------------------------------------------------------
// Dr Rohan Mehta, rehabilitation scientist (the science voice).
// ---------------------------------------------------------------------------------------------------------
const rohan: ResidentDef = {
  id: 'rohan-mehta',
  name: 'Dr Rohan Mehta',
  role: 'Rehabilitation scientist',
  family: 'Rohan, his wife Anjali and their baby daughter, who all moved out from the city for his job at the mine',
  blurb: 'The mine\'s environmental scientist, who becomes the town\'s science voice. Explains the staged rehabilitation, the aquifer and the heat, and likes a graph with a joke in it.',
  homeHint: { near: 'mine', description: 'A donga beside the mine office, with a weather station and a soil lab in the shed out the back' },
  portrait: 'rohan-mehta',
  traits: ['curious', 'careful', 'dry-humoured', 'honest about uncertainty'],
  start: 58,
  science: true,
  cares: [
    { metric: 'rehabPct', weight: 2, bad: 0, good: 100 },
    { metric: 'aquifer', weight: 2, bad: 25, good: 75 },
    { metric: 'tempC', weight: 1.5, bad: 2.6, good: 1.4 },
    { metric: 'evidence', weight: 1, bad: 0, good: 6 },
    { metric: 'emissionsPct', weight: 1.5, bad: 100, good: 10 },
  ],
  reacts: { drought: -2 },
  beats: [
    {
      id: 'rohan-monitor', title: 'Measuring the pit',
      when: { phase: ['act1'], years: [2000, 2020], all: [t('count.coalmine', '>=', 1)] },
      text: 'I am the mine\'s environmental scientist. I check the bore levels, the dust and the water in the bottom of the pit. The hole is big enough to see from a plane, so I think a lot about what happens after it.',
      tone: 'neutral',
    },
    {
      id: 'rohan-stages', title: 'Rehabilitation in stages',
      when: { phase: ['act2'], years: [2025, 2060] },
      text: 'Giving the pit back is not one job, it is four. Reshape the walls, spread topsoil, seed with plants suited to the site, then monitor against agreed criteria before sign-off. Real monitoring can run for many years; the game simplifies it. A lab would help.',
      tone: 'neutral',
      choice: {
        prompt: 'Rohan asks for a monitoring lab',
        options: [
          {
            id: 'lab', label: 'Fund a soil and plant monitoring lab',
            effects: { budget: -10, flags: { 'rehab.lab': 1 }, mood: { 'rohan-mehta': 7 } },
          },
          { id: 'basic', label: 'Keep monitoring basic and cheap for now', effects: { mood: { 'rohan-mehta': -3 } } },
        ],
        ignored: { mood: { 'rohan-mehta': -3 } },
      },
    },
    {
      id: 'rohan-aquifer', title: 'The slow water',
      when: { phase: ['act2'], years: [2028, 2100], all: [t('aquifer', '<=', 55)] },
      text: 'The aquifer reads {aquifer} out of 100. It refills very slowly, and rain out here is rare and uneven. When we pump faster than it fills, we are borrowing from the future. I wish I had better news.',
      tone: 'concern',
    },
    {
      id: 'rohan-emissions', title: 'The twelve kilotonne line',
      when: { phase: ['act2'], years: [2030, 2100], all: [t('emissionsKt', '>', 12)] },
      text: 'The town emits {kt} kilotonnes of carbon dioxide a year. This game uses twelve as a simplified target; real net zero means balancing what remains with removals. The mine and the diesel are the big ones. The sun is our best replacement.',
      tone: 'concern',
    },
    {
      id: 'rohan-halfway', title: 'Halfway back',
      when: { phase: ['act2'], all: [t('rehabPct', '>=', 50)] },
      text: 'Half the old mine ground is signed off. I did not expect to say that out loud. The seed mix was selected for this site, and our monitoring shows which species are establishing. Some are doing better than I hoped.',
      tone: 'joy',
    },
    {
      id: 'rohan-signoff', title: 'Sign-off day',
      when: { phase: ['act2'], all: [t('rehabPct', '>=', 100)] },
      urgent: true,
      text: 'Sign-off day. Years of monitoring data on my laptop, checked against the agreed criteria by the whole rehabilitation team. Someone asked a question I had not thought of. That is the best result I have had. I wrote it in my notebook.',
      tone: 'joy',
    },
  ],
  endings: [
    {
      id: 'rohan-good', quality: 'good', title: 'Rohan\'s data goes in a textbook',
      when: { all: [t('rehabPct', '>=', 80), t('aquifer', '>=', 45), t('mood.rohan-mehta', '>=', 50)] },
      text: 'Rohan\'s long-term data on the pit goes into a university textbook, with the whole rehabilitation team credited. His daughter, now a teenager, helps him count seedlings. "Rehabilitation is slow," he says. "Slow is allowed."',
    },
    {
      id: 'rohan-mixed', quality: 'mixed', title: 'Rohan keeps measuring',
      when: { all: [t('mood.rohan-mehta', '>=', 42)] },
      text: 'Rohan keeps measuring the bores and the plants every season. Some graphs go the right way and some do not. He keeps saying that is what honest science looks like, and he keeps measuring anyway.',
    },
    {
      id: 'rohan-bad', quality: 'bad', title: 'Rohan writes the warning report',
      text: 'Rohan writes a long report about the aquifer and the unfinished pit, and sends it to everyone he can think of. He does not shout. He just keeps the graphs up to date, in case someone finally wants them.',
    },
  ],
};

// ---------------------------------------------------------------------------------------------------------
// Pete Hanrahan, station owner.
// ---------------------------------------------------------------------------------------------------------
const pete: ResidentDef = {
  id: 'pete-hanrahan',
  name: 'Pete Hanrahan',
  role: 'Station owner',
  family: 'The Hanrahans, running cattle across the creek for four generations',
  blurb: 'Fourth-generation pastoralist. The waterhole and the bores are his livelihood and the town\'s, and he knows it.',
  homeHint: { near: 'farmland', description: 'A long homestead with a tin roof and a windmill, a few kilometres across the creek from town' },
  portrait: 'pete-hanrahan',
  traits: ['stubborn', 'dry-humoured', 'weather-wise', 'loyal'],
  start: 58,
  cares: [
    { metric: 'aquifer', weight: 2.5, bad: 25, good: 75 },
    { metric: 'drought', weight: 1.5, bad: 1, good: 0 },
    { metric: 'waterFailures', weight: 1.5, bad: 4, good: 0 },
    { metric: 'economy', weight: 1, bad: 25, good: 70 },
    { metric: 'pop.budgerigar', weight: 0.7, bad: 0, good: 100 },
  ],
  reacts: { drought: -7, heatwave: -3 },
  beats: [
    {
      id: 'pete-station', title: 'My great-grandfather\'s bore',
      when: { phase: ['act1'], years: [1890, 2020] },
      text: 'My great-grandfather sank the first bore on this place, and every Hanrahan since has watched the water level like a family member. The cattle are the business. The water is the whole reason we are here.',
      tone: 'neutral',
    },
    {
      id: 'pete-drought', title: 'Hauling water',
      when: { phase: ['act2'], years: [2026, 2100], all: [t('recent.drought', '>=', 1)] },
      text: 'Third dry season running, and I am carting water to the troughs by the tanker load. The cattle are thin. I could use the town\'s bore water for a few months, if you will share it, and I will pay.',
      tone: 'concern',
      choice: {
        prompt: 'Pete asks to share the town\'s bore water for his stock',
        options: [
          {
            id: 'share', label: 'Share bore water with the station for the drought',
            effects: { incomePerYear: 1, flags: { 'o.stockshare': 1 }, mood: { 'pete-hanrahan': 8 }, society: 0.5 },
          },
          { id: 'town-first', label: 'Say no: the town\'s water comes first', effects: { mood: { 'pete-hanrahan': -6 } } },
        ],
        ignored: { mood: { 'pete-hanrahan': -5 } },
      },
    },
    {
      id: 'pete-lowaquifer', title: 'The windmill coughs',
      when: { phase: ['act2'], years: [2030, 2100], all: [t('aquifer', '<=', 50)] },
      text: 'The windmill coughed this morning and pulled up sand. Aquifer is down to {aquifer} on Rohan\'s chart. My granddad said never trust a bore that gets easy. I reckon the opposite is true too.',
      tone: 'concern',
    },
    {
      id: 'pete-budgies', title: 'Budgies on the trough',
      when: { phase: ['act2'], years: [2030, 2100], all: [t('pop.budgerigar', '>=', 40), t('aquifer', '>=', 55)] },
      text: 'Budgies on the cattle trough at dusk, about {budgies} of them, green as new leaves. My kids stood and watched for an hour. You can run a station and still love the birds. Don\'t tell the other cockies.',
      tone: 'joy',
    },
    {
      id: 'pete-wally', title: 'A walk along the fence',
      when: { phase: ['act2'], years: [2035, 2100], all: [t('partnership', '>=', 40)] },
      text: 'Wally and I walked the boundary fence together. We disagree about plenty, including cattle and who is the better driver. We both want feral cats and foxes managed, and I like the company.',
      tone: 'warm',
      needsConsultation: true,
    },
  ],
  endings: [
    {
      id: 'pete-good', quality: 'good', title: 'Pete\'s bores run, the budgies come',
      when: { all: [t('mood.pete-hanrahan', '>=', 52), t('aquifer', '>=', 45)] },
      text: 'Pete\'s bores still run, the station is still in the family, and budgies drink at his troughs every dusk. His eldest has taken over the books. "My great-grandfather would not believe the solar pumps," he says.',
    },
    {
      id: 'pete-mixed', quality: 'mixed', title: 'Pete holds on',
      when: { all: [t('mood.pete-hanrahan', '>=', 42)] },
      text: 'Pete has fewer cattle than his father had, and a bigger water bill. The station is still in the family and so is he. He says every generation makes do with what the sky gives it, and keeps watching the clouds.',
    },
    {
      id: 'pete-bad', quality: 'bad', title: 'Pete sells up',
      text: 'The Hanrahans sold the station after the bores failed one dry year too many. Pete moved into town and walks to the pub every afternoon. He still looks up at the clouds, out of habit, and shakes his head.',
    },
  ],
};

// ---------------------------------------------------------------------------------------------------------
// Tia and Ben, School of the Air kids.
// ---------------------------------------------------------------------------------------------------------
const kids: ResidentDef = {
  id: 'tia-ben',
  name: 'Tia and Ben',
  role: 'Schoolkids (twins)',
  family: 'Twins in Year 5 who live out of town and learn by School of the Air. Their mum drives the water truck.',
  blurb: 'They count budgies at the waterhole, track bilby diggings and write letters to the Flying Doctor. Their questions are the ones the town should be asking.',
  homeHint: { near: 'wetland', description: 'A cattle-station cottage near the creek, with a satellite dish on the roof and a school desk on the veranda' },
  portrait: 'tia-ben',
  traits: ['curious', 'competitive', 'tender-hearted', 'full of questions'],
  start: 62,
  cares: [
    { metric: 'wildlifeAlive', weight: 2, bad: 0, good: 3 },
    { metric: 'pop.budgerigar', weight: 1.5, bad: 0, good: 100 },
    { metric: 'pop.bilby', weight: 1.5, bad: 0, good: 8 },
    { metric: 'heatDeaths', weight: 1, bad: 8, good: 0 },
    { metric: 'tempC', weight: 1, bad: 2.6, good: 1.4 },
  ],
  reacts: { heatwave: -4, drought: -2 },
  beats: [
    {
      id: 'tia-ben-dish', title: 'The new dish',
      when: { phase: ['act1'], years: [2015, 2020] },
      text: 'The new satellite dish came on Tuesday! Now our teacher is a face on the screen, not just a voice on the radio. Ben waved at her for five minutes. We usually learn from home through School of the Air, and we go to the waterhole whenever we can.',
      tone: 'joy',
    },
    {
      id: 'tia-ben-budgies', title: 'Budgie count',
      when: { phase: ['act2'], years: [2026, 2045], all: [t('pop.budgerigar', '>=', 20)] },
      text: 'Today\'s budgie count at the waterhole was {budgies}! Tia counted in fives and I counted in tens and we still got the same answer. They drink at sunrise, in rows, like a green and yellow ribbon. Our teacher put the numbers on the board.',
      tone: 'joy',
    },
    {
      id: 'tia-ben-bilby', title: 'Fresh diggings',
      when: { phase: ['act2'], years: [2030, 2050], all: [t('pop.bilby', '>=', 1)] },
      text: 'We found fresh bilby diggings by the mulga, with a tail drag next to them! Ben took a photo. The ranger said it means the shrubland is healing. We are writing a letter to the Flying Doctor to tell them the news.',
      tone: 'joy',
    },
    {
      id: 'tia-ben-shade', title: 'The hot playground',
      when: { phase: ['act2'], years: [2026, 2042] },
      text: 'It was forty-four at our school gathering this term and the swings were too hot to use. Mum says we need shade trees and a rain tank in the yard. We wrote it in our class newsletter. Will you help us plant them?',
      tone: 'neutral',
      choice: {
        prompt: 'Tia and Ben ask for shade trees at the school',
        options: [
          {
            id: 'shade', label: 'Plant shade trees and put in a rain tank',
            effects: { budget: -5, flags: { 'heat.schoolShade': 1 }, mood: { 'tia-ben': 8 }, society: 0.5, tiles: [{ op: 'health', scope: 'land', add: 0.03 }] },
          },
          { id: 'wait', label: 'Not this year, but put it on the list', effects: { mood: { 'tia-ben': -4 } } },
        ],
        ignored: { mood: { 'tia-ben': -3 } },
      },
    },
    {
      id: 'tia-ben-empty', title: 'Zero budgies',
      when: { phase: ['act2'], years: [2040, 2100], all: [t('pop.budgerigar', '<=', 0)] },
      text: 'We took our own kids to the waterhole at sunrise, the way Mum used to take us. We counted {budgies} budgies and wrote down the date, the weather and how long we watched. Ben\'s little girl asked if they would come back when it rained. We said we hoped so.',
      tone: 'loss',
    },
    {
      id: 'tia-ben-grown', title: 'Grown up on Country',
      when: { phase: ['act2'], years: [2046, 2070], all: [t('wildlifeAlive', '>=', 2)] },
      text: 'We are grown now. Ben is a ranger and Tia studies desert animals at uni. We still count budgies when we are home, and the numbers are mostly good. We kept every letter we wrote to the Flying Doctor.',
      tone: 'warm',
    },
  ],
  endings: [
    {
      id: 'tia-ben-good', quality: 'good', title: 'Tia and Ben count the big flock',
      when: { all: [t('wildlifeAlive', '>=', 3), t('mood.tia-ben', '>=', 52)] },
      text: 'Tia and Ben, grown up, count a flock of budgerigars so big it darkens the waterhole. Bilby tracks wind between the mulga. They write to the Flying Doctor: "The animals came back, and so did we."',
    },
    {
      id: 'tia-ben-mixed', quality: 'mixed', title: 'Tia and Ben keep counting',
      when: { all: [t('wildlifeAlive', '>=', 1)] },
      text: 'Tia and Ben still count budgies and look for tracks, though there are fewer than they remember. They tell the new kids that numbers go up and down, and that is why you keep counting.',
    },
    {
      id: 'tia-ben-bad', quality: 'bad', title: 'Tia and Ben go to school in the city',
      text: 'Tia and Ben finished school in the city. They still have their old counting book with the waterhole tallies, and the last page says zero. They tell their friends about the budgies, and nobody quite believes them.',
    },
  ],
};

export const RED_DIRT_CAST: readonly ResidentDef[] = [wally, shaz, bev, rohan, pete, kids];
