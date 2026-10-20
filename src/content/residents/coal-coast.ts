/**
 * The Coal Coast cast (GAMEPLAY section 3). Warm, specific, Year 9 readable, Australian voice. No villains: each
 * person is reasonable from where they stand. Beats are 60 words or fewer after {placeholders} are filled in.
 *
 * Aunty June's content is placeholder text that needs consultation with the local Aboriginal community before
 * release: every one of her beats and endings carries needsConsultation: true.
 */
import { t } from '../../sim/conditions';
import type { ResidentDef } from '../../sim/residents';

const MICK_TRANSITION = [t('flag.transition.funded', '>=', 1), t('acts.repurposed.steelworks', '>=', 1)] as const;

const mick: ResidentDef = {
  id: 'mick-kowalski',
  name: 'Mick Kowalski',
  role: 'Steelworker',
  family: 'The Kowalskis, a Polish migrant family who came to the works in the 1950s',
  blurb: 'Second-generation steelworker. Proud of the work, worried about his daughter\'s cough and about what happens if the works close.',
  homeHint: { near: 'town', description: 'A weatherboard house two streets from the works gate' },
  portrait: 'mick-kowalski',
  traits: ['loyal', 'practical', 'funny', 'stubborn'],
  start: 60,
  cares: [
    { metric: 'heavyJobsPct', weight: 3, bad: 0, good: 80 },
    { metric: 'employment', weight: 1.5, bad: 40, good: 90 },
    { metric: 'flag.transition.funded', weight: 2, bad: 0, good: 1 },
    { metric: 'acts.repurposed.steelworks', weight: 1.5, bad: 0, good: 1 },
    { metric: 'airQuality', weight: 1, bad: 30, good: 85 },
    { metric: 'society', weight: 0.8, bad: 25, good: 70 },
  ],
  reacts: { blackout: -3, heatwave: -2 },
  beats: [
    {
      id: 'mick-furnace', title: 'Three generations of steel',
      when: { phase: ['act1'], years: [1950, 2020], all: [t('heavyJobs', '>=', 60)] },
      text: 'Dad stepped off the ship with one suitcase and walked straight to the works gate. Now I run the same furnace. It is hot, loud, honest work, and it built this street. I would like my kids to be proud of it too.',
      tone: 'warm',
    },
    {
      id: 'mick-dust', title: 'A cough that won\'t go',
      when: { phase: ['act1'], years: [1960, 2020], all: [t('heavyJobs', '>=', 60), t('airQuality', '<=', 75)] },
      text: 'My little girl has coughed all winter, and the doctor says it is the dust. I do not want to lose my job, and I do not want her breathing this. Surely there is something in between?',
      tone: 'concern',
      choice: {
        prompt: 'Dust and jobs',
        options: [
          {
            id: 'filters', label: 'Ask the works to fit dust filters',
            effects: { budget: -20, flags: { 'steel.filters': 1 }, mood: { 'mick-kowalski': 8 }, tiles: [{ op: 'air', scope: 'all', mult: 0.85 }] },
          },
          { id: 'later', label: 'Not right now', effects: { mood: { 'mick-kowalski': -6 } } },
        ],
        ignored: { mood: { 'mick-kowalski': -4 } },
      },
    },
    {
      id: 'mick-rumours', title: 'What happens to the works?',
      when: { phase: ['turning-point'], all: [t('heavyJobs', '>=', 60)] },
      urgent: true,
      text: 'At the pub they say the works will not see out the century. I have never done anything else. Priya on the news says the town has to change. Fine. But change to what? Who hires a fifty-year-old furnace man?',
      tone: 'concern',
    },
    {
      id: 'mick-closure-gentle', title: 'The last pour',
      when: {
        phase: ['act2'], all: [t('count.steelworks', '<=', 0), t('acts.demolished.steelworks', '>=', 1)], any: MICK_TRANSITION,
      },
      urgent: true,
      text: 'The furnace went cold last week, and I will admit I cried a bit. But the retraining is real. I start at the new site on Monday, and Dad\'s old welding torch is going on the museum wall. We lost something and kept something. I can live with that.',
      tone: 'warm',
      effects: { mood: { 'mick-kowalski': 5 } },
    },
    {
      id: 'mick-closure-abrupt', title: 'A letter, and the gates',
      when: {
        phase: ['act2'],
        all: [
          t('count.steelworks', '<=', 0), t('acts.demolished.steelworks', '>=', 1),
          t('flag.transition.funded', '<=', 0), t('acts.repurposed.steelworks', '<=', 0),
        ],
      },
      urgent: true,
      text: 'They shut it in a week. No plan, no retraining, just a letter. Hundreds of us outside the gates, half the street. I am not angry at anyone. I just do not know what I am meant to do now. My daughter keeps asking if we will have to move.',
      tone: 'loss',
      effects: { mood: { 'mick-kowalski': -10 }, society: -1 },
    },
    {
      id: 'mick-later-good', title: 'Pop would approve',
      when: { phase: ['act2'], years: [2045, 2100], all: [t('count.steelworks', '<=', 0)], any: MICK_TRANSITION },
      text: 'I am Mick\'s granddaughter, and my school project was on the old works. I called it the place where Pop learned to make steel without coal. {cleanJobs} people work in clean jobs here now. I reckon he would have approved.',
      tone: 'joy',
    },
    {
      id: 'mick-later-stuck', title: 'Waiting for a plan',
      when: { phase: ['act2'], years: [2050, 2100], all: [t('count.steelworks', '>=', 1)] },
      text: 'I run the furnace my father ran, but the coal gets dearer every year and the heat in summer is brutal. The young ones are leaving town. We keep waiting for somebody to tell us what comes next.',
      tone: 'concern',
    },
    {
      id: 'mick-later-abrupt', title: 'Home again',
      when: {
        phase: ['act2'], years: [2050, 2100],
        all: [t('count.steelworks', '<=', 0), t('flag.transition.funded', '<=', 0), t('acts.repurposed.steelworks', '<=', 0), t('acts.demolished.steelworks', '>=', 1)],
      },
      text: 'After the works shut, I drove trucks at a mine up north for ten years. Good money, but I missed the sea. I came home when I heard there were new jobs here. Funny how a town can lose its people and then want them back.',
      tone: 'neutral',
    },
  ],
  endings: [
    {
      id: 'mick-good', quality: 'good', title: 'Mick teaches the next lot',
      when: { all: [t('mood.mick-kowalski', '>=', 48)], any: MICK_TRANSITION },
      text: 'The Kowalskis teach apprentices at the new works. Mick\'s granddaughter wears his old hard hat to open day, two sizes too big. "Great-Pop came here for steel," she says. "We stayed for the town."',
    },
    {
      id: 'mick-mixed', quality: 'mixed', title: 'Mick finds his feet',
      when: { all: [t('mood.mick-kowalski', '>=', 42)] },
      text: 'The Kowalskis found work, though never again at a furnace. They say the town did its best, and they say it a little quietly. On Sundays someone in the family still walks past where the gates used to be.',
    },
    {
      id: 'mick-bad', quality: 'bad', title: 'Mick moves away',
      text: 'The Kowalskis left town to chase work, and the kids finished school somewhere new. There is still a photo of the works on the fridge, and the family never quite stops missing it.',
    },
  ],
};

const lena: ResidentDef = {
  id: 'lena-tran',
  name: 'Lena Tran',
  role: 'Fisher',
  family: 'The Trans, fishing the estuary for three generations. Her daughter Linh is learning the boat.',
  blurb: 'Her catch follows the health of the estuary. Practical, up before dawn, and quietly hopeful.',
  homeHint: { near: 'estuary', description: 'A cottage by the boat ramp at the estuary mouth' },
  portrait: 'lena-tran',
  traits: ['early riser', 'patient', 'observant', 'dry sense of humour'],
  start: 62,
  cares: [
    { metric: 'estuary', weight: 3, bad: 10, good: 80 },
    { metric: 'recent.fish-kill', weight: 2, bad: 2, good: 0 },
    { metric: 'flag.fishingProtocol', weight: 1, bad: 0, good: 1 },
    { metric: 'pop.shorebirds', weight: 0.5, bad: 0, good: 40 },
    { metric: 'society', weight: 0.5, bad: 25, good: 70 },
  ],
  reacts: { 'fish-kill': -18, flood: -4 },
  beats: [
    {
      id: 'lena-catch', title: 'The net comes in singing',
      when: { phase: ['act1'], years: [1960, 2020], all: [t('estuary', '>=', 45)] },
      text: 'Mum taught me to read the tide off the mangrove roots. Bream, flathead, whiting: some mornings the net comes in so full it sings. My Linh is six and already says she will be captain. I tell her: first learn to love early mornings.',
      tone: 'joy',
    },
    {
      id: 'lena-slick', title: 'The water has changed',
      when: { phase: ['act1'], years: [1960, 2020], all: [t('estuary', '<=', 60)] },
      text: 'The water has gone the colour of weak tea, and the oysters on the pylons are shrinking. Something is coming down the river that was not there when I was Linh\'s age. I cannot prove it. I only know the catch is thinner every year.',
      tone: 'concern',
      choice: {
        prompt: 'The estuary is getting worse',
        options: [
          {
            id: 'sewage', label: 'Back a sewage upgrade',
            effects: { budget: -20, tiles: [{ op: 'water', scope: 'estuary', mult: 0.85 }], flags: { 'lena.sewageBacked': 1 }, mood: { 'lena-tran': 8 } },
          },
          { id: 'wait', label: 'Wait and see', effects: { mood: { 'lena-tran': -5 } } },
        ],
        ignored: { mood: { 'lena-tran': -3 } },
      },
    },
    {
      id: 'lena-kill', title: 'Silver water',
      when: { phase: ['turning-point'] },
      urgent: true,
      text: 'Four in the morning, and the water was silver with dead fish from bank to bank. Thirty years on this estuary and I have never seen it. Linh asked what was wrong with the water. I had no answer a ten-year-old could understand. I want one.',
      tone: 'loss',
    },
    {
      id: 'lena-hope', title: 'Young bream in the seagrass',
      when: { phase: ['act2'], years: [2026, 2100], all: [t('estuary', '>=', 45), t('recent.fish-kill', '<=', 1)] },
      text: 'Saw young bream in the seagrass this morning, silver as coins. The wetland upstream is working: you can watch the water clear week by week. Linh is counting fish for her school project. I am trying not to hope too loudly.',
      tone: 'joy',
    },
    {
      id: 'lena-linh-good', title: 'Linh\'s data',
      when: { phase: ['act2'], years: [2065, 2100], all: [t('estuary', '>=', 60)] },
      text: 'I am Linh, and I finished my marine science degree years ago. Yesterday I checked the data: the estuary\'s health score is {est} out of 100, and I also track oxygen, nutrients and wildlife. Mum\'s boat is always mine, but I suspect I will use a drone.',
      tone: 'joy',
    },
    {
      id: 'lena-linh-bad', title: 'Selling the boat',
      when: { phase: ['act2'], years: [2060, 2100], all: [t('estuary', '<=', 40)] },
      text: 'I live in Brisbane now, and we have listed the family boat. The estuary is tired, and so is Mum. I ring on Sundays and tell her about other people\'s reefs. She tells me she is fine.',
      tone: 'loss',
    },
  ],
  endings: [
    {
      id: 'lena-good', quality: 'good', title: 'Linh tags the first bream',
      when: { all: [t('estuary', '>=', 60), t('mood.lena-tran', '>=', 52)] },
      text: 'Linh Tran, marine scientist, tags the first bream of the season from the Trans\' old boat. The estuary is her laboratory and her inheritance, and the fish still come when the tide turns.',
    },
    {
      id: 'lena-mixed', quality: 'mixed', title: 'A smaller boat',
      when: { all: [t('estuary', '>=', 35)] },
      text: 'The Trans still fish, with a smaller boat and a smaller catch. Linh runs the estuary monitoring on weekends. They are not giving up, and the estuary has not either.',
    },
    {
      id: 'lena-bad', quality: 'bad', title: 'The boat ramp is quiet',
      text: 'The Trans sold the boat, and Linh lives far away. Some mornings someone from the family walks down to the ramp and just looks at the estuary, remembering when it sang.',
    },
  ],
};

const JUNE = { needsConsultation: true } as const;

const june: ResidentDef = {
  id: 'aunty-june',
  name: 'Aunty June',
  role: 'Elder',
  elder: true,
  family: 'A local Aboriginal family whose story spans the whole timeline of the town (placeholder: to be written with the community)',
  blurb: 'An Elder of the local Aboriginal community.',
  homeHint: { near: 'escarpment', description: 'A house at the foot of the escarpment, with a view of the bush' },
  portrait: 'aunty-june',
  traits: ['thoughtful', 'direct', 'community-minded'],
  start: 55,
  needsConsultation: true,
  cares: [
    { metric: 'partnership', weight: 4, bad: 5, good: 65 },
    { metric: 'healthPct', weight: 1.5, bad: 10, good: 50 },
    { metric: 'flag.culturalBurning', weight: 1, bad: 0, good: 0.8 },
    { metric: 'wildlifeAlive', weight: 1, bad: 1, good: 6 },
    { metric: 'society', weight: 0.5, bad: 25, good: 70 },
  ],
  reacts: { bushfire: -4 },
  beats: [
    {
      id: 'june-country', title: 'On Country',
      when: { phase: ['act1'], years: [1900, 2020] },
      ...JUNE,
      text: 'The local Aboriginal community has its own priorities and its own history with this place. The community decides what knowledge is shared and on what terms, and the town needs to ask and listen.',
      tone: 'warm',
    },
    {
      id: 'june-thanks', title: 'Thank you for asking',
      when: { all: [t('acts.consulted', '>=', 1)] },
      ...JUNE,
      text: 'Thank you for sitting down with the community. Listening is a start, but the community decides what is shared, on what terms, and what it wants from the town.',
      tone: 'warm',
    },
    {
      id: 'june-waiting', title: 'Written with community',
      when: { phase: ['act1', 'turning-point'], years: [1930, 2020], all: [t('acts.consulted', '<=', 0)] },
      ...JUNE,
      text: 'The community has not yet been consulted. Its priorities, and how it wants to be involved in the town\'s planning, should come from the community, not be assumed.',
      tone: 'warm',
    },
    {
      id: 'june-teaching', title: 'Reading the seasons',
      when: { phase: ['act2'], all: [t('partnership', '>=', 30)] },
      ...JUNE,
      text: 'What is shared about reading the seasons, and how, is for the community to decide. Many people notice flowering, fish and birds as signs of the year changing, and it helps to learn from those who know.',
      tone: 'warm',
      effects: { flags: { 'june.seasons': 1 } },
    },
    {
      id: 'june-fire', title: 'Cool fire',
      when: { phase: ['act2'], all: [t('flag.culturalBurning', '>', 0)] },
      ...JUNE,
      text: 'Cultural burning needs skilled practitioners, suitable conditions and an agreed plan. If the community is willing, we could plan it together, with your fire crews alongside. Shall we start by talking it through?',
      tone: 'warm',
      choice: {
        prompt: 'Cool burning',
        options: [
          { id: 'together', label: 'Ask Aunty June to teach the fire crews', effects: { partnership: 3, mood: { 'aunty-june': 8 }, flags: { 'june.crewsTaught': 1 } } },
          { id: 'brigade', label: 'Leave it to the fire brigade', effects: { mood: { 'aunty-june': -4 } } },
        ],
        ignored: { mood: { 'aunty-june': -3 } },
      },
    },
    {
      id: 'june-neglect', title: 'Talking past each other',
      when: { phase: ['act2'], years: [2040, 2100], all: [t('partnership', '<=', 22)] },
      ...JUNE,
      text: 'The relationship has not developed. The community will decide what needs to change before it takes part in further discussions, and what it wants to see.',
      tone: 'concern',
    },
    {
      id: 'june-later', title: 'The next generation',
      when: { phase: ['act2'], years: [2065, 2100], all: [t('partnership', '>=', 55)] },
      ...JUNE,
      text: 'Younger community members joined approved learning activities on the creek this year, guided by people with the right knowledge and training. Caring for Country is shared work across the generations.',
      tone: 'joy',
    },
  ],
  endings: [
    {
      id: 'june-good', quality: 'good', title: 'Country, looked after together', ...JUNE,
      when: { all: [t('partnership', '>=', 58)] },
      text: 'Country is looked after together now. Community-led cultural burns happen in autumn with fire agencies as partners, and the signs in town show two names. "We are still here," June\'s family say.',
    },
    {
      id: 'june-mixed', quality: 'mixed', title: 'A good start', ...JUNE,
      when: { all: [t('partnership', '>=', 35)] },
      text: 'June\'s community says the relationship has started well but has a long way to go. What happens next is for the community to decide, and the town needs to keep showing up.',
    },
    {
      id: 'june-bad', quality: 'bad', title: 'The community decides', ...JUNE,
      text: 'The community has not agreed to further participation. Its representatives will decide what needs to change before any discussions resume.',
    },
  ],
};

const priya: ResidentDef = {
  id: 'priya-shah',
  name: 'Priya Shah',
  role: 'Climate scientist',
  science: true,
  family: 'The Shahs, who ran the corner chemist for forty years',
  blurb: 'Climate scientist at the local university. Explains your graphs using your own numbers.',
  homeHint: { near: 'town', description: 'A flat near the university, with graphs on every wall' },
  portrait: 'priya-shah',
  traits: ['clear', 'kind', 'curious', 'allergic to jargon'],
  start: 55,
  cares: [
    { metric: 'tempC', weight: 3, bad: 2.4, good: 1.4 },
    { metric: 'emissionsPct', weight: 2, bad: 100, good: 20 },
    { metric: 'evidence', weight: 1, bad: 0, good: 6 },
    { metric: 'renewablePct', weight: 1, bad: 0, good: 90 },
    { metric: 'society', weight: 0.5, bad: 25, good: 70 },
  ],
  reacts: {},
  beats: [
    {
      id: 'priya-graphs', title: 'Your own graphs',
      when: { phase: ['turning-point'] },
      urgent: true,
      text: 'Look at your own graphs. CO2 is {co2} ppm, against {realCo2} in the real world, and warming is {temp} C against {realTemp} C. The estuary scores {est} out of 100. These lines are your decisions. The next lines are still unwritten.',
      tone: 'neutral',
    },
    {
      id: 'priya-emissions-good', title: 'Good news, and a caution',
      when: { phase: ['act2'], years: [2030, 2100], all: [t('emissionsPct', '<=', 60), t('renewablePct', '>=', 25)] },
      text: 'Good news and a caution. Your emissions are down to {kt} kilotonnes a year from a peak of {peakKt}, and {ren}% of your power is renewable. But CO2 is {co2} ppm and still rising, because we are still adding more than is removed. Reaching net zero would roughly stabilise it.',
      tone: 'warm',
    },
    {
      id: 'priya-emissions-bad', title: 'Where can we cut first?',
      when: { phase: ['act2'], years: [2035, 2100], all: [t('emissionsPct', '>', 80)] },
      text: 'Your emissions are still {kt} kilotonnes a year, close to the peak of {peakKt}. I know change is hard and costs money. But every year at this rate adds to a CO2 level of {co2} ppm that will linger for centuries. Where can we cut first?',
      tone: 'concern',
    },
    {
      id: 'priya-lag', title: 'Why is it still getting warmer?',
      when: { phase: ['act2'], years: [2050, 2100] },
      text: 'Here is the hard part. Emissions are {kt} kilotonnes now, but the temperature is {temp} C and still moving towards {eqTemp} C. Oceans warm slowly and CO2 lasts for centuries. Warming roughly levels off once CO2 emissions reach net zero, so every year we cut earlier lowers the peak.',
      tone: 'neutral',
    },
    {
      id: 'priya-letter-good', title: 'Seventy-five years of data',
      when: { phase: ['act2'], years: [2080, 2100], all: [t('tempC', '<=', 1.8)] },
      text: 'Our department has charted your town for seventy-five years. Final reading: {temp} C, {species} species back or holding on, estuary {est}. I tell my students data does not care what we hope. This time it agreed with us a little. Thank you for letting us show you the graphs.',
      tone: 'joy',
    },
    {
      id: 'priya-letter-bad', title: 'Honest graphs',
      when: { phase: ['act2'], years: [2080, 2100], all: [t('tempC', '>', 1.8)] },
      text: 'Final reading: {temp} C, estuary {est}. The graphs are honest, even when they are not kind. But look at what the town did manage: {species} species are still here. Show this to the next town. Tell them what we learned, and when.',
      tone: 'concern',
    },
  ],
  endings: [
    {
      id: 'priya-good', quality: 'good', title: 'Graphs on the school wall',
      when: { all: [t('tempC', '<=', 1.8), t('mood.priya-shah', '>=', 48)] },
      text: 'Priya\'s graphs hang in the school hall: a town that read its data and acted on it. Her students\' students still add the new numbers every spring.',
    },
    {
      id: 'priya-mixed', quality: 'mixed', title: 'Better than most',
      when: { all: [t('tempC', '<=', 2.2)] },
      text: 'Priya\'s data show the town helped, but not fast enough. "Better than most," she wrote in her last paper. "Not as good as it could have been." Her students kept the monitoring going.',
    },
    {
      id: 'priya-bad', quality: 'bad', title: 'The warning stays on file',
      text: 'Priya filed her last report knowing it would be read too late. Her students still teach from it. "The graphs only tell you where you are," she used to say. "What you do next is up to you."',
    },
  ],
};

const kids: ResidentDef = {
  id: 'sam-jordan',
  name: 'Sam and Jordan',
  role: 'Schoolkids (twins)',
  family: 'The Harts, who live near the beach. They grow up across the whole of Act 2.',
  blurb: 'Twins who follow the beach and bush as they grow up.',
  homeHint: { near: 'beach', description: 'A house behind the dunes, close to the turtle beach' },
  portrait: 'sam-jordan',
  traits: ['curious', 'blunt', 'kind', 'impatient'],
  start: 65,
  cares: [
    { metric: 'wildlifeAlive', weight: 2, bad: 1, good: 6 },
    { metric: 'streak.green-turtle', weight: 2, bad: 0, good: 3 },
    { metric: 'tempC', weight: 1.5, bad: 2.4, good: 1.4 },
    { metric: 'estuary', weight: 1, bad: 10, good: 80 },
    { metric: 'pop.koala', weight: 1, bad: 0, good: 16 },
  ],
  reacts: { heatwave: -2, bushfire: -3 },
  beats: [
    {
      id: 'sj-fish', title: 'Did we do that?',
      when: { phase: ['act1'], years: [1990, 2020], all: [t('estuary', '<=', 70)] },
      text: 'Dad says there used to be loads of fish. Mr Hossain says the river was clear enough to see your feet. Did we do that? Can we fix it? Jordan says yes. Sam says it will take longer than a school project.',
      tone: 'concern',
    },
    {
      id: 'sj-turtles', title: 'Will there still be turtles?',
      when: { phase: ['act2'], years: [2026, 2060], all: [t('pop.green-turtle', '>=', 1)] },
      text: 'Our teacher took us to the beach at night to look for Old Shelly. Sam fell asleep; Jordan stayed up. Will there still be turtles when we are old? Please be honest.',
      tone: 'warm',
      choice: {
        prompt: 'Will there still be turtles?',
        options: [
          {
            id: 'honest', label: 'I do not know. It depends on what we all do. I will do my part.',
            effects: { mood: { 'sam-jordan': 8 }, flags: { 'kids.honest': 1 } },
          },
          { id: 'reassure', label: 'Of course there will. Do not worry about it.', effects: { mood: { 'sam-jordan': 2 }, flags: { 'kids.reassured': 1 } } },
        ],
        ignored: { mood: { 'sam-jordan': -3 } },
      },
    },
    {
      id: 'sj-teens', title: 'We are not too young',
      when: { phase: ['act2'], years: [2036, 2100] },
      text: 'We are sixteen. Our class compared the emissions plans, and Priya checked our maths. Someone said we are too young to understand. It is {temp} C now, and we want council to explain what each plan would achieve, and when. We vote soon.',
      tone: 'warm',
      minGapYears: 8,
    },
    {
      id: 'sj-koala', title: 'A real koala',
      when: { phase: ['act2'], years: [2040, 2100], all: [t('pop.koala', '>=', 2)] },
      text: 'We saw a koala today! A real one, in a tree right behind the school. Sam took forty-one photos. Mum says koalas had not been seen here since she was little. It looked at us like we were the strange ones.',
      tone: 'joy',
    },
    {
      id: 'sj-nokoala', title: 'Drawing koalas from photos',
      when: { phase: ['act2'], years: [2055, 2100], all: [t('pop.koala', '<=', 0)] },
      text: 'Mrs Singh says koalas used to live in the trees behind the school. We drew them from photos. We would like to see a real one before we have kids of our own. Is it too late?',
      tone: 'concern',
    },
    {
      id: 'sj-letter', title: 'A letter from Sam and Jordan',
      when: { phase: ['act2'], years: [2085, 2100] },
      text: 'To whoever looks after the town: we are in our seventies now, with grandkids. We think about what was decided in the early years. Whatever happened, thank you for thinking of us before we were old enough to ask. Please keep thinking about the ones after us.',
      tone: 'warm',
      minGapYears: 0,
    },
  ],
  endings: [
    {
      id: 'sj-good', quality: 'good', title: 'Yes, there are still turtles',
      when: { all: [t('wildlifeAlive', '>=', 5), t('streak.green-turtle', '>=', 1), t('mood.sam-jordan', '>=', 52)] },
      text: 'Sam is a ranger on the headland. Jordan runs the school nature program. Their grandkids spot Old Shelly\'s tracks in the sand. "Yes," Sam tells them. "There are still turtles."',
    },
    {
      id: 'sj-mixed', quality: 'mixed', title: 'Fewer than hoped, more than feared',
      when: { all: [t('wildlifeAlive', '>=', 4)] },
      text: 'Sam and Jordan raise their kids near a quieter bush than they hoped for, and a warmer one. They teach them the names of the animals that are left, and plant a tree for each one that is not.',
    },
    {
      id: 'sj-bad', quality: 'bad', title: 'Stories about turtles',
      text: 'Sam and Jordan tell their grandkids about turtles the way their own grandparents told them about steam trains: as something that used to be. They keep writing letters anyway.',
    },
  ],
};

const dot: ResidentDef = {
  id: 'dot-harris',
  name: 'Dot Harris',
  role: 'Dairy farmer',
  family: 'The Harrises, who have milked cows on the river flat for four generations',
  blurb: 'Fourth-generation dairy farmer. Caught between the creek, the drought and the price of milk.',
  homeHint: { near: 'farmland', description: 'A farmhouse on the flat, up the river from town' },
  portrait: 'dot-harris',
  traits: ['straight-talking', 'resilient', 'generous', 'always checking the sky'],
  start: 58,
  cares: [
    { metric: 'drought', weight: 2, bad: 1, good: 0 },
    { metric: 'estuary', weight: 1, bad: 10, good: 80 },
    { metric: 'economy', weight: 1.5, bad: 25, good: 75 },
    { metric: 'flag.farm.riparian', weight: 1.2, bad: 0, good: 1 },
    { metric: 'recent.flood', weight: 0.5, bad: 2, good: 0 },
    { metric: 'tempC', weight: 1, bad: 2.4, good: 1.4 },
  ],
  reacts: { drought: -8, flood: -5, heatwave: -3 },
  beats: [
    {
      id: 'dot-milk', title: 'Four generations on the flat',
      when: { phase: ['act1'], years: [1900, 2020], all: [t('count.farm', '>=', 1)] },
      text: 'Four generations of Harrises have milked cows on this flat. My great-grandfather cleared it by hand. We have good grass, good dogs and a creek that never ran dry, until lately. Farming is just a long conversation with the weather.',
      tone: 'warm',
    },
    {
      id: 'dot-runoff', title: 'When it rains hard',
      when: { years: [1990, 2100], all: [t('estuary', '<=', 55), t('count.farm', '>=', 1)] },
      text: 'Lena is not wrong. When it rains hard, my paddock washes into the creek and down to her estuary. I never meant that. Fencing the creek and planting the banks would help, but it costs, and it takes land out of grass.',
      tone: 'concern',
      choice: {
        prompt: 'Runoff from the farm',
        options: [
          {
            id: 'fence', label: 'Help fence the creek and plant the banks',
            effects: {
              budget: -20, flags: { 'farm.riparian': 1 }, tiles: [{ op: 'water', scope: 'river', mult: 0.88 }, { op: 'water', scope: 'estuary', mult: 0.94 }],
              mood: { 'dot-harris': 3, 'lena-tran': 6 },
            },
          },
          { id: 'leave', label: 'Leave it for now', effects: { mood: { 'lena-tran': -5, 'dot-harris': 2 } } },
        ],
        ignored: { mood: { 'lena-tran': -3 } },
      },
    },
    {
      id: 'dot-drought', title: 'Third dry summer',
      when: { phase: ['act2'], years: [2026, 2100], all: [t('recent.drought', '>=', 1)] },
      text: 'The creek is a string of puddles and I am buying hay at prices that make my accountant cry. I am not asking for charity. I just want to know the town has not forgotten the people who feed it.',
      tone: 'concern',
      choice: {
        prompt: 'Drought on the farm',
        options: [
          { id: 'grant', label: 'Offer a drought support grant', effects: { budget: -25, mood: { 'dot-harris': 12 } } },
          {
            id: 'resilience', label: 'Help with drought-hardy pasture, shade and water',
            effects: { budget: -12, flags: { 'farm.resilient': 1 }, mood: { 'dot-harris': 7 }, incomePerYear: 1 },
          },
          { id: 'none', label: 'Say it is up to the farm', effects: { mood: { 'dot-harris': -8 } } },
        ],
        ignored: { mood: { 'dot-harris': -6 } },
      },
    },
    {
      id: 'dot-solar', title: 'Panels on the top paddock',
      when: { phase: ['act2'], years: [2035, 2100], all: [t('renewablePct', '>=', 30)] },
      text: 'A company wants to lease my top paddock for solar panels. Sheep could graze underneath, and it is steady money when milk prices wobble. Before I decide, I want to check what it means for grazing, access and the soil.',
      tone: 'warm',
      choice: {
        prompt: 'Solar on the farm',
        options: [
          { id: 'lease', label: 'Welcome it. A farm that survives is a farm that stays.', effects: { incomePerYear: 3, mood: { 'dot-harris': 5 }, flags: { 'farm.solar': 1 } } },
          { id: 'keep', label: 'Respect her wish to keep the pasture', effects: { mood: { 'dot-harris': 3 } } },
        ],
        ignored: { mood: { 'dot-harris': -2 } },
      },
    },
    {
      id: 'dot-later-good', title: 'Farms and rivers can share',
      when: { phase: ['act2'], years: [2065, 2100], all: [t('flag.farm.riparian', '>=', 1), t('estuary', '>=', 50)] },
      text: 'Dot\'s grandson runs the dairy now. "Nan always said the creek and the farm were one job," he says. The creek is lined with native trees, the water is clear enough to see the stones, and the herd cools off in the shade.',
      tone: 'joy',
    },
    {
      id: 'dot-later-bad', title: 'Selling the herd',
      when: { phase: ['act2'], years: [2060, 2100], any: [t('flag.farm.riparian', '<=', 0), t('economy', '<=', 40)], all: [t('mood.dot-harris', '<=', 48)] },
      text: 'We sold the herd last spring. Nan\'s grandkids did not want it: the summers are too hot and the paddocks too dry. We wish the conversation about drought, creeks and farm income had started thirty years earlier.',
      tone: 'loss',
    },
  ],
  endings: [
    {
      id: 'dot-good', quality: 'good', title: 'A farm that kept going',
      when: { all: [t('flag.farm.riparian', '>=', 1), t('mood.dot-harris', '>=', 52)] },
      text: 'The Harris dairy is still milking, now with a solar paddock and a creek full of frogs. Dot\'s grandson runs it, and he still keeps her habit of checking the sky each morning.',
    },
    {
      id: 'dot-mixed', quality: 'mixed', title: 'Smaller, but still there',
      when: { all: [t('mood.dot-harris', '>=', 42)] },
      text: 'The Harris farm is smaller now, and runs on fewer cows and more worry. But the gate is still painted green, and the family still checks the sky every morning.',
    },
    {
      id: 'dot-bad', quality: 'bad', title: 'The last milking',
      text: 'The Harris dairy closed after four generations. The paddocks are leased to someone else, and the family still walks the creek line, remembering where the cows used to stand.',
    },
  ],
};

export const COAL_COAST_CAST: readonly ResidentDef[] = [mick, lena, june, priya, kids, dot];
