/**
 * The Green Valley cast (the tutorial): two friendly people. Gentle, plain, a bit funny. No villains.
 * Jo Marsh grows fruit on the valley floor and is hit by the fire. Ali Rahman is the ranger and the science voice.
 */
import { t } from '../../sim/conditions';
import type { ResidentDef } from '../../sim/residents';

const jo: ResidentDef = {
  id: 'jo-marsh',
  name: 'Jo Marsh',
  role: 'Orchardist',
  family: 'The Marshes, growing apples and stone fruit on the valley floor for three generations',
  blurb: 'Third-generation fruit grower. Practical, brave in a fire, and worried about the dry. Talks to her trees when she thinks nobody is listening.',
  homeHint: { near: 'farmland', description: 'A tin-roofed farmhouse in the orchard, a short walk from the creek' },
  portrait: 'jo-marsh',
  traits: ['practical', 'brave', 'chatty', 'worried about the dry'],
  start: 58,
  cares: [
    { metric: 'drought', weight: 2, bad: 1, good: 0 },
    { metric: 'healthPct', weight: 2, bad: 30, good: 75 },
    { metric: 'renewablePct', weight: 1.5, bad: 0, good: 70 },
    { metric: 'economy', weight: 1.5, bad: 25, good: 70 },
    { metric: 'count.farm', weight: 1, bad: 0, good: 3 },
  ],
  reacts: { bushfire: -10, drought: -5, heatwave: -3 },
  beats: [
    {
      id: 'jo-orchard', title: 'Apples by the creek',
      when: { phase: ['act1'], years: [1960, 2020], all: [t('year', '>=', 1970)] },
      text: 'My grandad planted these apple trees by hand. In spring the whole paddock smells like honey, and the bees are so loud you can hear them from the road. The creek keeps the roots happy. Look after the creek and it looks after us.',
      tone: 'warm',
    },
    {
      id: 'jo-fire', title: 'The fire stopped at the creek',
      when: { phase: ['turning-point'] },
      urgent: true,
      text: 'The wind turned and the grass went up in a roar. We ran hoses all night with half the valley beside us. The creek held the line, thank goodness. One side of my orchard is black now. I just stood there and said sorry to the trees.',
      tone: 'loss',
    },
    {
      id: 'jo-firebreak', title: 'Never again like that',
      when: { phase: ['act2'], years: [2025, 2040] },
      text: 'Next summer will be dry again. I would like to be ready this time. I can slash a wide firebreak around the orchard, or plant a belt of tough native trees as a windbreak. Both take work. What do you reckon?',
      tone: 'concern',
      choice: {
        prompt: 'Getting ready for fire',
        options: [
          {
            id: 'firebreak', label: 'Help Jo slash a firebreak',
            effects: { budget: -8, flags: { 'fire.prep': 1 }, mood: { 'jo-marsh': 6 } },
          },
          {
            id: 'windbreak', label: 'Plant a native windbreak with Jo',
            effects: { budget: -12, flags: { 'fire.prep': 1 }, mood: { 'jo-marsh': 8 }, tiles: [{ op: 'health', scope: 'land', add: 0.03 }] },
          },
          { id: 'later', label: 'Not this year', effects: { mood: { 'jo-marsh': -5 } } },
        ],
        ignored: { mood: { 'jo-marsh': -4 } },
      },
    },
    {
      id: 'jo-power', title: 'The pump runs on sunshine',
      when: { phase: ['act2'], years: [2028, 2040], all: [t('renewablePct', '>=', 40)] },
      text: 'I put the irrigation pump on the new solar power, and the bill dropped. The funny part is the pump works hardest on the sunniest days, which is exactly when the panels make the most. Even I can follow that one. The valley is now {ren} percent clean power.',
      tone: 'joy',
    },
    {
      id: 'jo-blossom', title: 'Blossom on the burnt side',
      when: { phase: ['act2'], years: [2035, 2040], all: [t('healthPct', '>=', 45)] },
      text: 'I walked the burnt side of the orchard this morning. There is green on the old stumps, and the bees have found the new blossom. The bush is coming back around the edges, too. I did not think I would see that so soon.',
      tone: 'joy',
    },
  ],
  endings: [
    {
      id: 'jo-good', quality: 'good', title: 'Jo sells the first clean crop',
      when: { all: [t('mood.jo-marsh', '>=', 55), t('renewablePct', '>=', 50)] },
      text: 'Jo packs her best apples into crates stamped with a little sun. The burnt rows have grown back, the pump runs on panels, and the bees are loud again. She waves the van off and goes back to talking to her trees.',
    },
    {
      id: 'jo-mixed', quality: 'mixed', title: 'Jo keeps going',
      when: { all: [t('mood.jo-marsh', '>=', 42)] },
      text: 'Jo kept the orchard going, though the dry still worries her. Some rows are new and some are scarred. She says it will take a few good years to feel safe, and she says it with a small smile.',
    },
    {
      id: 'jo-bad', quality: 'bad', title: 'Jo sells up',
      text: 'After the fire and the dry, Jo sold the orchard to a neighbour. She still drops by in spring to smell the blossom. She says the trees deserved better, and she is a little sad when she says it.',
    },
  ],
};

const ali: ResidentDef = {
  id: 'ali-rahman',
  name: 'Ali Rahman',
  role: 'Ranger',
  family: 'The Rahmans, who moved to the valley when Ali took the ranger job. Two kids, one very muddy dog.',
  blurb: 'The valley ranger. Explains the graphs in plain words, cheers every small win, and has a bad habit of getting excited about frog calls at dinner parties.',
  homeHint: { near: 'river', description: 'A small ranger station beside the creek, with a ute and a whiteboard out the front' },
  portrait: 'ali-rahman',
  traits: ['curious', 'encouraging', 'funny', 'patient'],
  start: 62,
  science: true,
  cares: [
    { metric: 'renewablePct', weight: 2, bad: 0, good: 70 },
    { metric: 'healthPct', weight: 2, bad: 30, good: 75 },
    { metric: 'pop.frogs', weight: 1.5, bad: 0, good: 40 },
    { metric: 'tempC', weight: 1, bad: 3, good: 1.5 },
    { metric: 'evidence', weight: 1, bad: 0, good: 8 },
  ],
  reacts: { bushfire: -6, heatwave: -3 },
  beats: [
    {
      id: 'ali-welcome', title: 'Welcome to the valley',
      when: { phase: ['act1'], years: [1960, 2020], all: [t('year', '>=', 1990)] },
      text: 'G\'day, I am Ali, the new ranger. I will keep an eye on the creek and the bush while you build. Nothing you do is a mistake yet. Just remember that smoke, waste and cleared land all leave a mark that lasts.',
      tone: 'warm',
    },
    {
      id: 'ali-graphs', title: 'Reading your graphs',
      when: { phase: ['act2'], years: [2025, 2040] },
      text: 'Here is the plain version of your graphs. Coal power puts carbon dioxide in the air, and that warms the valley. Right now we run on {ren} percent clean power. Solar, wind and batteries push that number up. Let\'s go and move it.',
      tone: 'neutral',
    },
    {
      id: 'ali-soil', title: 'Healing the ground',
      when: { phase: ['act2'], years: [2026, 2040], any: [t('acts.built.phytoremediation', '>=', 1), t('acts.built.excavation', '>=', 1), t('acts.built.nursery', '>=', 1)] },
      text: 'You have started on the soil, and I am chuffed. Some plants soak up metals from dirty ground, and digging out the worst patches helps too. A nursery then grows native seedlings to spread. Slow work, but it does stick.',
      tone: 'joy',
    },
    {
      id: 'ali-frogs', title: 'A frog at the pond',
      when: { phase: ['act2'], years: [2028, 2040], all: [t('pop.frogs', '>=', 1)] },
      text: 'Listen. That deep, creaky call is a green and golden bell frog, and the wetland is working. We counted {frogs} this week. They had vanished from most places, so every one is a small miracle with a very rude voice.',
      tone: 'joy',
    },
    {
      id: 'ali-woodland', title: 'Join the bush up',
      when: { phase: ['act2'], years: [2032, 2040], all: [t('healthPct', '>=', 40)] },
      text: 'The bush is greener, but animals need it joined up, not in little patches. Koalas want a connected woodland of at least 14 mature trees. Koala count today: {koalas}. A few more plantings could close the gaps.',
      tone: 'neutral',
    },
  ],
  endings: [
    {
      id: 'ali-good', quality: 'good', title: 'Ali hears the chorus',
      when: { all: [t('mood.ali-rahman', '>=', 55), t('healthPct', '>=', 50)] },
      text: 'On a warm evening Ali sits by the wetland with a thermos and listens to the frogs. Panels glint on the hill and the bush is thick again. She writes in her log: the valley is healing, and so are we.',
    },
    {
      id: 'ali-mixed', quality: 'mixed', title: 'Ali keeps counting',
      when: { all: [t('mood.ali-rahman', '>=', 42)] },
      text: 'Ali keeps counting frogs and checking the graphs. Some numbers are better and some are not, but they are moving the right way. She says the next lot of rangers will finish what you started.',
    },
    {
      id: 'ali-bad', quality: 'bad', title: 'Ali packs the ute',
      text: 'The valley changed less than Ali hoped, and the creek is still tired. She moves to another park, carrying her notebooks and a jar of creek water. She says she will come back when the frogs do.',
    },
  ],
};

export const GREEN_VALLEY_CAST: readonly ResidentDef[] = [jo, ali];
