/**
 * The River Town cast. Warm, specific, Year 9 readable, Australian voice. No villains: everyone is reasonable from
 * where they stand. Beats are 60 words or fewer once {placeholders} are filled in.
 *
 * Uncle Ray's content is placeholder text that needs consultation with the local river Aboriginal community before
 * release: the resident, every beat and every ending carry needsConsultation: true.
 */
import { t } from '../../sim/conditions';
import type { ResidentDef } from '../../sim/residents';

const kerry: ResidentDef = {
  id: 'kerry-brennan',
  name: 'Kerry Brennan',
  role: 'Irrigator',
  family: 'The Brennans, fifth-generation citrus and almond growers on the river flat. Her kids help at harvest.',
  blurb: 'Reasonable, proud and in debt to the bank. She farms beside a river she loves, and she knows her trees need that river too.',
  homeHint: { near: 'farmland', description: 'A weatherboard farmhouse among the orange trees on the river flat' },
  portrait: 'kerry-brennan',
  traits: ['proud', 'practical', 'stubborn', 'generous'],
  start: 58,
  cares: [
    { metric: 'farmViability', weight: 3, bad: 25, good: 75 },
    { metric: 'envFlowPct', weight: 1.2, bad: 15, good: 60 },
    { metric: 'townWaterFailures', weight: 1, bad: 3, good: 0 },
    { metric: 'drought', weight: 1, bad: 1, good: 0 },
    { metric: 'riverHealth', weight: 1.5, bad: 25, good: 70 },
    { metric: 'economy', weight: 0.8, bad: 25, good: 70 },
  ],
  reacts: { drought: -6, flood: 1, 'algal-bloom': -2 },
  beats: [
    {
      id: 'kerry-flat', title: 'Oranges on the river flat',
      when: { phase: ['act1'], years: [1950, 2020] },
      text: 'Great-grandad planted the first citrus here when the paddle steamers still came by. In spring the whole flat smells of orange blossom. The river is why we are here, and I wake up thinking about it every day.',
      tone: 'warm',
    },
    {
      id: 'kerry-debt', title: 'The bank letter',
      when: { phase: ['act1'], years: [1990, 2020] },
      text: 'The bank sends a letter every quarter and the pumps eat power. Almond prices are good this year, so I borrowed to plant more. I know water is the weak link. I just do not know a better way to pay the bills.',
      tone: 'concern',
    },
    {
      id: 'kerry-dry', title: 'A bank I could walk across',
      when: { phase: ['turning-point'] },
      urgent: true,
      text: 'I have watched this river my whole life and it has never stopped. Today I walked across it in my boots. The cod are crowded in one pool and the trees on my flat are dropping leaves in spring. Tell me what we do.',
      tone: 'loss',
    },
    {
      id: 'kerry-drip', title: 'Drip lines or wait',
      when: { phase: ['act2'], years: [2027, 2060], all: [t('farmViability', '<=', 75)] },
      text: 'A rep showed me drip lines today. They use far less water and put much less salt in the ground, but the loan is a big one. I can take it on, or keep flooding the rows and hope for good years.',
      tone: 'neutral',
      choice: {
        prompt: 'Kerry is weighing up drip irrigation',
        options: [
          {
            id: 'help', label: 'Help the farm borrow for drip lines',
            effects: { budget: -14, flags: { 'w.farmEff': 0.5 }, mood: { 'kerry-brennan': 8 } },
          },
          { id: 'wait', label: 'Let her decide on her own', effects: { mood: { 'kerry-brennan': -3 } } },
        ],
        ignored: { mood: { 'kerry-brennan': -3 } },
      },
    },
    {
      id: 'kerry-good', title: 'Trees and river, both',
      when: { phase: ['act2'], years: [2050, 2100], all: [t('farmViability', '>=', 55), t('riverHealth', '>=', 55)] },
      text: 'Farm viability is {farm}, and the river is at {river} out of 100. I never thought I would say both in one breath. The flats flooded this spring, the billabong filled, and the kids saw a heron fishing off our jetty.',
      tone: 'joy',
    },
    {
      id: 'kerry-lost', title: 'Selling up',
      when: { phase: ['act2'], years: [2050, 2100], all: [t('farmViability', '<=', 35)] },
      text: 'Half the block is gone to a neighbour who can pay. The salt came up through the soil, and the water never came back in the dry years. I am not angry at the river. I am just tired.',
      tone: 'loss',
    },
  ],
  endings: [
    {
      id: 'kerry-end-good', quality: 'good', title: 'Kerry\'s kids take the flat',
      when: { all: [t('farmViability', '>=', 50), t('riverHealth', '>=', 55), t('mood.kerry-brennan', '>=', 50)] },
      text: 'Kerry still farms the flat, with drip lines and fewer trees. Her kids paddle the billabong after harvest, and her eldest has put her name down to take over the farm. The river runs past the orchard all year.',
    },
    {
      id: 'kerry-end-mixed', quality: 'mixed', title: 'A smaller orchard',
      when: { all: [t('farmViability', '>=', 35)] },
      text: 'Kerry kept the best half of the block and sold the rest. Some years are tight. She says the river and the farm are still learning to share, and that learning is slow but real.',
    },
    {
      id: 'kerry-end-bad', quality: 'bad', title: 'The orchard goes quiet',
      text: 'Kerry sold the orchard and moved into town. The old pump shed still stands on the flat. She drives past on Sundays and does not stop.',
    },
  ],
};

const RAY = { needsConsultation: true } as const;

const ray: ResidentDef = {
  id: 'uncle-ray',
  name: 'Uncle Ray',
  role: 'Elder',
  elder: true,
  family: 'A local river Aboriginal family whose story spans the whole timeline of the town (placeholder: to be written with the community)',
  blurb: 'An Elder of the local river Aboriginal community, with a big family and a dry sense of humour. Knows the river\'s seasons. (Placeholder name: to be agreed with the community. Needs consultation before release.)',
  homeHint: { near: 'wetland', description: 'A house on the edge of the floodplain, near the billabongs' },
  portrait: 'uncle-ray',
  traits: ['patient', 'funny', 'observant', 'generous with time'],
  start: 55,
  needsConsultation: true,
  cares: [
    { metric: 'partnership', weight: 4, bad: 5, good: 65 },
    { metric: 'riverHealth', weight: 2, bad: 25, good: 70 },
    { metric: 'pop.southern-bell-frog', weight: 1, bad: 0, good: 20 },
    { metric: 'pop.superb-parrot', weight: 1, bad: 0, good: 20 },
    { metric: 'flag.water.cultural', weight: 1.2, bad: 0, good: 1 },
    { metric: 'society', weight: 0.5, bad: 25, good: 70 },
  ],
  reacts: { drought: -5, 'algal-bloom': -3 },
  beats: [
    {
      id: 'ray-seasons', title: 'Reading the river',
      when: { phase: ['act1'], years: [1900, 2020] },
      ...RAY,
      text: 'My family has known this river for longer than anyone can count. We know when it rises, which fish run, and where the billabongs fill. The weir and the channels changed that, but the river still keeps its own calendar. I hope you will learn it.',
      tone: 'warm',
    },
    {
      id: 'ray-thanks', title: 'Thanks for asking',
      when: { all: [t('acts.consulted', '>=', 1)] },
      ...RAY,
      text: 'Thank you for sitting down with me. Not many people have, and it means something. There is a lot we can share when it is done in good faith. Bring a thermos and I will bring the stories about the floods.',
      tone: 'warm',
    },
    {
      id: 'ray-door', title: 'The gate is open',
      when: { phase: ['act1', 'turning-point'], years: [1930, 2020], all: [t('acts.consulted', '<=', 0)] },
      ...RAY,
      text: 'I have watched this town grow from my verandah. Nobody has knocked yet, and that is all right. If you ever want to yarn about the river and the flats you are working on, the billy is on.',
      tone: 'warm',
    },
    {
      id: 'ray-thirsty', title: 'Thirsty gums',
      when: { phase: ['act2'], years: [2026, 2100], all: [t('recent.drought', '>=', 1)] },
      ...RAY,
      text: 'You can tell a thirsty red gum by its crown. The leaves go thin and the top branches die back. The old trees have seen droughts before, but not so many close together, and not with the river held back as well.',
      tone: 'concern',
    },
    {
      id: 'ray-teaching', title: 'When the river lifts',
      when: { phase: ['act2'], all: [t('partnership', '>=', 30)] },
      ...RAY,
      text: 'When the river rises in spring, the fish move onto the floodplain and the frogs start calling. We watch for those signs together. The old people knew when to expect them. You can read them too if you stay a while.',
      tone: 'warm',
    },
    {
      id: 'ray-water', title: 'Water for the trees',
      when: { phase: ['act2'], years: [2030, 2100], all: [t('flag.water.cultural', '>=', 1)] },
      ...RAY,
      text: 'The flood came over the bank this spring and soaked the gums right out to the old billabong. I stood there with the grandkids and watched the water move. Parrots overhead. That is how it is supposed to look.',
      tone: 'joy',
    },
  ],
  endings: [
    {
      id: 'ray-end-good', quality: 'good', title: 'Uncle Ray walks the floodplain',
      ...RAY,
      when: { all: [t('partnership', '>=', 40), t('riverHealth', '>=', 55)] },
      text: 'Uncle Ray walks the floodplain with his grandchildren after every spring flood, naming what comes back: frogs, parrots, fish. The town asks him before it plans. He says that is all anyone ever wanted.',
    },
    {
      id: 'ray-end-mixed', quality: 'mixed', title: 'A slow trust',
      ...RAY,
      when: { all: [t('partnership', '>=', 20)] },
      text: 'Uncle Ray sits on the verandah and watches the river. Some things have been done right, and some haven\'t yet. He says good things are slow, and that the gate stays open.',
    },
    {
      id: 'ray-end-bad', quality: 'bad', title: 'The river goes on without them',
      ...RAY,
      text: 'The floodplain is quieter now, and Uncle Ray\'s family feels it. He still goes down to the bank each spring to see whether the river lifts. Some years it does not, and no one has asked him why.',
    },
  ],
};

const sue: ResidentDef = {
  id: 'sue-pellegrino',
  name: 'Sue Pellegrino',
  role: 'Mayor',
  family: 'The Pellegrinos, an Italian-Australian orchard family. Sue\'s nonno planted the first stone-fruit trees outside town.',
  blurb: 'Runs the town through droughts, bills and pool closures. Balances ratepayers, the farmers and the river, and tries to keep everyone talking to each other.',
  homeHint: { near: 'town', description: 'A brick house three streets back from the main street, with a tomato patch' },
  portrait: 'sue-pellegrino',
  traits: ['diplomatic', 'tireless', 'good cook', 'dry humour'],
  start: 57,
  cares: [
    { metric: 'townWaterFailures', weight: 3, bad: 3, good: 0 },
    { metric: 'society', weight: 1.5, bad: 25, good: 70 },
    { metric: 'economy', weight: 1.2, bad: 25, good: 70 },
    { metric: 'farmViability', weight: 1.2, bad: 25, good: 70 },
    { metric: 'riverHealth', weight: 0.8, bad: 25, good: 70 },
  ],
  reacts: { drought: -5, 'algal-bloom': -3, flood: 1 },
  beats: [
    {
      id: 'sue-pool', title: 'The swimming pool',
      when: { phase: ['act1'], years: [1940, 2020] },
      text: 'The town pool opened the year after the war, and half the town learned to swim in it. In a bad summer we drain it to save water. Nobody likes it, but a closed pool is better than dry taps.',
      tone: 'warm',
    },
    {
      id: 'sue-taps', title: 'Weak taps',
      when: { phase: ['act2'], years: [2026, 2100], all: [t('townWaterFailures', '>=', 1)] },
      text: 'We ran short again. Taps coughed and went quiet for an afternoon and my phone did not stop. I understand the anger. I just want the answer to be something better than begging the river for more every summer.',
      tone: 'concern',
    },
    {
      id: 'sue-restrict', title: 'Level 4 restrictions',
      when: { phase: ['act2'], years: [2026, 2100], all: [t('recent.drought', '>=', 1)] },
      text: 'Restrictions on gardens again. The footy club oval is brown, the pool is closed, and the farmers are asking why the town gets any at all. I try to answer all of them honestly. It is not always easy.',
      tone: 'concern',
      choice: {
        prompt: 'The pool, in a drought summer',
        options: [
          {
            id: 'close', label: 'Close the pool and save the water',
            effects: { mood: { 'sue-pellegrino': 3, 'ruby-eli': -6 }, society: -1, flags: { 'town.poolClosed': 1 } },
          },
          {
            id: 'open', label: 'Keep the pool open, with a swim cap',
            effects: { mood: { 'sue-pellegrino': -3, 'ruby-eli': 4 }, flags: { 'town.poolClosed': 0 } },
          },
        ],
        ignored: { mood: { 'sue-pellegrino': -2 } },
      },
    },
    {
      id: 'sue-fair', title: 'Fair shares',
      when: { phase: ['act2'], years: [2035, 2100], all: [t('townWaterFailures', '<=', 0), t('farmViability', '>=', 45)] },
      text: 'We went a whole summer without a restriction notice, and the farmers did not ring me either. I keep expecting it to be a fluke. If it is not, then sharing the water properly is working.',
      tone: 'joy',
    },
    {
      id: 'sue-empty', title: 'Shopfronts',
      when: { phase: ['act2'], years: [2045, 2100], all: [t('economy', '<=', 35)] },
      text: 'Another shop has closed on the main street. The bakery is hanging on. People leave when the farms struggle, and then the school loses a teacher, and then another family goes. I would give a lot to stop that.',
      tone: 'loss',
    },
  ],
  endings: [
    {
      id: 'sue-end-good', quality: 'good', title: 'Sue hands over the chain',
      when: { all: [t('townWaterFailures', '<=', 0), t('society', '>=', 55)] },
      text: 'Sue finally hands over the mayoral chain after a decade without a water failure. The pool stays open all summer, the footy club has a green oval, and the town is still talking about how to share.',
    },
    {
      id: 'sue-end-mixed', quality: 'mixed', title: 'One more term',
      when: { all: [t('society', '>=', 40)] },
      text: 'Sue stood for one more term. The taps mostly worked, the farmers mostly stayed, and the arguments over water kept going. She says an argument is better than a dry river and a quiet town.',
    },
    {
      id: 'sue-end-bad', quality: 'bad', title: 'The pool stays shut',
      text: 'Sue retired tired. The pool did not reopen, the main street thinned out, and half the town has moved to the coast. She still waters her tomato patch from a bucket at dusk.',
    },
  ],
};

const lan: ResidentDef = {
  id: 'lan-nguyen',
  name: 'Dr Lan Nguyen',
  role: 'River ecologist',
  science: true,
  family: 'The Nguyens, who moved inland when Lan\'s dad took a job at the cannery. She grew up swimming in the weir pool.',
  blurb: 'Explains your graphs: flow, salt, algae and fish. Honest about what she knows and what she does not, and fond of the river she studies.',
  homeHint: { near: 'river', description: 'A small field lab with a gauge shed on the riverbank, a short walk from town' },
  portrait: 'lan-nguyen',
  traits: ['curious', 'careful', 'dry-humoured', 'patient'],
  start: 55,
  cares: [
    { metric: 'riverHealth', weight: 3, bad: 25, good: 70 },
    { metric: 'envFlowPct', weight: 1.5, bad: 15, good: 60 },
    { metric: 'evidence', weight: 1, bad: 0, good: 10 },
    { metric: 'tempC', weight: 0.8, bad: 3, good: 1.5 },
    { metric: 'pop.murray-cod', weight: 1, bad: 0, good: 18 },
  ],
  reacts: { 'fish-kill': -10, 'algal-bloom': -4 },
  beats: [
    {
      id: 'lan-gauge', title: 'The old gauge records',
      when: { phase: ['act1'], years: [1980, 2020] },
      text: 'I have the river gauge records back to the 1890s on my desk. The spring floods used to come most years. Now they are rare, because we hold the water back for the summer. The river is doing what we told it to.',
      tone: 'neutral',
    },
    {
      id: 'lan-flow', title: 'Your flow graph',
      when: { phase: ['act2'], years: [2026, 2100], all: [t('envFlowPct', '<=', 35)] },
      text: 'Look at your flow graph. River health is {river} out of 100, and not enough flow is being left in dry years. Fish, trees and frogs all feel that. It is not too late. Leave it more water in dry years and the lines will turn.',
      tone: 'concern',
    },
    {
      id: 'lan-bloom', title: 'Green water',
      when: { phase: ['act2'], years: [2026, 2100], all: [t('recent.algal-bloom', '>=', 1)] },
      text: 'That is a blue-green algae bloom. It comes in hot, slow, nutrient-rich water, and some kinds make toxins. Keep dogs and kids out. Better flows and less fertiliser washing in will stop most of them, but that takes years.',
      tone: 'concern',
    },
    {
      id: 'lan-monitor', title: 'More gauges, better answers',
      when: { phase: ['act2'], years: [2030, 2100], all: [t('riverHealth', '>=', 40), t('evidence', '<=', 6)] },
      text: 'I could use three more gauges and a salt probe. Right now I am guessing in some reaches, and I would rather know. Good measurements make the hard choices about who gets water a lot less like arguments.',
      tone: 'neutral',
      choice: {
        prompt: 'Lan wants more river monitoring',
        options: [
          {
            id: 'fund', label: 'Fund new gauges and a salt probe',
            effects: { budget: -8, flags: { 'river.monitoring': 1 }, mood: { 'lan-nguyen': 8 } },
          },
          { id: 'skip', label: 'Not this year', effects: { mood: { 'lan-nguyen': -3 } } },
        ],
        ignored: { mood: { 'lan-nguyen': -2 } },
      },
    },
    {
      id: 'lan-recover', title: 'The river is breathing',
      when: { phase: ['act2'], years: [2050, 2100], all: [t('riverHealth', '>=', 55)] },
      text: 'River health is {river} out of 100. We have cod breeding below the weir and bell frogs in the billabong. It is not a pre-weir river, and never will be. But it is a living one, and that is a good result.',
      tone: 'joy',
    },
  ],
  endings: [
    {
      id: 'lan-end-good', quality: 'good', title: 'Lan trains the next gauge-readers',
      when: { all: [t('riverHealth', '>=', 60), t('mood.lan-nguyen', '>=', 52)] },
      text: 'Lan runs a monitoring course for the high school. Her students read the gauge, count frogs and sample the water. The data shows a river that is flowing, and cod that are still breeding below the weir.',
    },
    {
      id: 'lan-end-mixed', quality: 'mixed', title: 'Lan keeps measuring',
      when: { all: [t('riverHealth', '>=', 40)] },
      text: 'Lan kept the gauges running through lean years. The data show a river that is neither thriving nor failing. She says the numbers tell the truth, and the truth is that there is more work to do.',
    },
    {
      id: 'lan-end-bad', quality: 'bad', title: 'The last gauge reading',
      text: 'Lan took a job at a university on the coast. The gauge shed is locked up, and the river runs low in summer. She still reads the readings when the council emails them, and she does not like what they say.',
    },
  ],
};

const twins: ResidentDef = {
  id: 'ruby-eli',
  name: 'Ruby and Eli',
  role: 'Schoolkids (twins)',
  family: 'The Carter twins, Year 6 at the primary school. They live above their dad\'s bike shop and swim in the weir pool every summer.',
  blurb: 'Eleven years old and nosy about everything wet. They keep a diary of frogs and fish, and ask the questions adults forget to.',
  homeHint: { near: 'wetland', description: 'A flat above the bike shop, with a view of the billabong from the back step' },
  portrait: 'ruby-eli',
  traits: ['curious', 'cheeky', 'good at noticing', 'brave'],
  start: 65,
  cares: [
    { metric: 'wildlifeAlive', weight: 2, bad: 1, good: 6 },
    { metric: 'pop.southern-bell-frog', weight: 2, bad: 0, good: 20 },
    { metric: 'riverHealth', weight: 1.5, bad: 25, good: 70 },
    { metric: 'recent.algal-bloom', weight: 1.5, bad: 2, good: 0 },
    { metric: 'society', weight: 0.5, bad: 25, good: 70 },
  ],
  reacts: { 'algal-bloom': -6, 'fish-kill': -8, flood: 4 },
  beats: [
    {
      id: 'ruby-swim', title: 'Bombs off the weir',
      when: { phase: ['act1'], years: [2000, 2020] },
      text: 'We swim at the weir pool every summer. The jetty is hot on your feet and the water goes green near the reeds. Eli found a frog under a rock, and we put him in our diary. Frog number one.',
      tone: 'joy',
    },
    {
      id: 'ruby-diary', title: 'The frog and fish diary',
      when: { phase: ['act2'], years: [2026, 2100], all: [t('pop.southern-bell-frog', '>=', 1)] },
      text: 'Our diary says we heard bell frogs calling in the billabong on Tuesday night. There were {bellfrogs} of them, we think. Ruby counted. Eli says he heard more. Mum says we should write down which one of us is right.',
      tone: 'joy',
      choice: {
        prompt: 'The twins want to do a proper frog count',
        options: [
          {
            id: 'count', label: 'Support a school frog count',
            effects: { budget: -3, flags: { 'kids.frogCount': 1 }, mood: { 'ruby-eli': 8, 'lan-nguyen': 3 } },
          },
          { id: 'later', label: 'Maybe later, kids', effects: { mood: { 'ruby-eli': -3 } } },
        ],
        ignored: { mood: { 'ruby-eli': -2 } },
      },
    },
    {
      id: 'ruby-bloom', title: 'No swimming',
      when: { phase: ['act2'], years: [2026, 2100], all: [t('recent.algal-bloom', '>=', 1)] },
      text: 'The weir pool is green and there is a sign. No swimming, no paddling, no dogs. Dad says it is the algae. Eli says it looks like pea soup. I just want to know if the fish are okay under all that.',
      tone: 'concern',
    },
    {
      id: 'ruby-cod', title: 'A fish as long as Dad',
      when: { phase: ['act2'], years: [2035, 2100], all: [t('pop.murray-cod', '>=', 2)] },
      text: 'Marg took us out in her boat and we saw a Murray cod under the log. It was as long as our dad. {cod} cod live in the river now, the sign says. Eli said hi to it. It did not say hi back.',
      tone: 'joy',
    },
    {
      id: 'ruby-grown', title: 'Letter from the weir pool',
      when: { phase: ['act2'], years: [2070, 2100], all: [t('riverHealth', '>=', 55)] },
      text: 'We are grown up now, and Ruby is a river ranger. Eli is a teacher and takes his class to the weir pool every spring. The water is clear and the diary is on its eighth volume. The frogs are still going.',
      tone: 'joy',
    },
  ],
  endings: [
    {
      id: 'ruby-end-good', quality: 'good', title: 'Ruby and Eli: the eighth diary',
      when: { all: [t('riverHealth', '>=', 55), t('mood.ruby-eli', '>=', 55)] },
      text: 'Ruby and Eli are in the weir pool every summer, and their children are with them. The diary is thick with frogs, fish and a platypus sighting. The river looks like the one they hoped for.',
    },
    {
      id: 'ruby-end-mixed', quality: 'mixed', title: 'A shorter list',
      when: { all: [t('riverHealth', '>=', 35)] },
      text: 'Ruby and Eli still keep the diary, though some pages say only "none seen." They tell their kids about the days the weir pool was full of frogs. They hope the list gets longer.',
    },
    {
      id: 'ruby-end-bad', quality: 'bad', title: 'The diary closes',
      text: 'Ruby and Eli moved to the city for work. The diary lives in a box with the old swimmers. Their kids ask what a bell frog sounds like, and they have to hum it.',
    },
  ],
};

const marg: ResidentDef = {
  id: 'marg-kelly',
  name: 'Marg Kelly',
  role: 'Fishing guide',
  family: 'The Kellys, a river family. Marg runs cod tours and a houseboat, and her son Tom is learning to drive the boat.',
  blurb: 'Her business is Murray cod, clear water and the way the river looks. She can tell the health of the river from the colour of the water.',
  homeHint: { near: 'river', description: 'A houseboat tied up at the town jetty, with a tin shed full of rods and lures' },
  portrait: 'marg-kelly',
  traits: ['cheerful', 'weathered', 'storyteller', 'patient'],
  start: 60,
  cares: [
    { metric: 'pop.murray-cod', weight: 3, bad: 0, good: 18 },
    { metric: 'riverHealth', weight: 2, bad: 25, good: 70 },
    { metric: 'recent.algal-bloom', weight: 1.5, bad: 2, good: 0 },
    { metric: 'society', weight: 0.8, bad: 25, good: 70 },
  ],
  reacts: { 'algal-bloom': -7, 'fish-kill': -10, drought: -3 },
  beats: [
    {
      id: 'marg-tours', title: 'Cod on the line',
      when: { phase: ['act1'], years: [1960, 2020] },
      text: 'The best bit of my day is when a big cod comes up out of the green water, looks you in the eye, and goes back under. Tourists come for the quiet. Then the first cod comes up and they stop talking altogether.',
      tone: 'joy',
    },
    {
      id: 'marg-slow', title: 'Slow and green',
      when: { phase: ['act2'], years: [2026, 2100], all: [t('recent.algal-bloom', '>=', 1)] },
      text: 'Cancelled six tours this month. Nobody wants to cruise a green river. The smell is the worst of it. The cod are going deep to escape the heat, and so am I. Is there something we can do about the water?',
      tone: 'concern',
    },
    {
      id: 'marg-rules', title: 'Throwing them back',
      when: { phase: ['act2'], years: [2028, 2100], all: [t('riverHealth', '>=', 30)] },
      text: 'Cod breed in spring, and the big old ones are the best breeders. I am happy to switch my tours to catch-and-release if everyone does. It costs me a few customers, but I want cod for my son to guide.',
      tone: 'neutral',
      choice: {
        prompt: 'Marg proposes a release-only rule for cod',
        options: [
          {
            id: 'release', label: 'Back catch-and-release for cod',
            effects: { flags: { 'cod.releaseOnly': 1 }, mood: { 'marg-kelly': 7 }, society: -0.5 },
          },
          { id: 'leave', label: 'Leave it to each guide', effects: { mood: { 'marg-kelly': -4 } } },
        ],
        ignored: { mood: { 'marg-kelly': -3 } },
      },
    },
    {
      id: 'marg-back', title: 'A big one at the weir',
      when: { phase: ['act2'], years: [2035, 2100], all: [t('pop.murray-cod', '>=', 4)] },
      text: 'There are {cod} cod in the river now, and a big one has moved in below the weir. I took a family out this morning and she came up beside the boat. The little girl screamed. Best tip I ever got.',
      tone: 'joy',
    },
    {
      id: 'marg-sold', title: 'The houseboat for sale',
      when: { phase: ['act2'], years: [2050, 2100], all: [t('riverHealth', '<=', 35)] },
      text: 'I have put the houseboat up for sale. The river is too sick for tourists and too slow for the old tours. Tom is going to do an electrician course in the city. I keep finding fishing line in my pockets.',
      tone: 'loss',
    },
  ],
  endings: [
    {
      id: 'marg-end-good', quality: 'good', title: 'Tom takes the tiller',
      when: { all: [t('pop.murray-cod', '>=', 8), t('riverHealth', '>=', 55)] },
      text: 'Marg lets her son Tom take the houseboat tiller. The cod are back, the water is clear enough to see the snags, and bookings are full. She sits on the jetty with a cuppa and a line, just in case.',
    },
    {
      id: 'marg-end-mixed', quality: 'mixed', title: 'Fewer tours, kinder tours',
      when: { all: [t('riverHealth', '>=', 35)] },
      text: 'Marg runs fewer tours now, always in the cool months. The cod are fewer than she remembers, but there are some. She tells every visitor to be quiet and look. Most of them do.',
    },
    {
      id: 'marg-end-bad', quality: 'bad', title: 'No more tours',
      text: 'Marg sold the houseboat. The jetty is empty, and the rods are in the shed. She still walks down in the evening to watch the water, and wishes it had a cod in it.',
    },
  ],
};

export const RIVER_TOWN_CAST: readonly ResidentDef[] = [kerry, ray, sue, lan, twins, marg];
