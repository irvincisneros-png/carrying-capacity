import { t } from '../sim/conditions';
import type { TutorialStep } from '../sim/tutorial';
import type { ScenarioId } from '../sim/types';

/**
 * Green Valley's guided steps (about 20 to 30 minutes). Completion uses the player's action counters
 * (acts.built.*) so a step stays done once it is done. Highlight keys are described in sim/tutorial.ts.
 */
const GREEN_VALLEY_STEPS: readonly TutorialStep[] = [
  {
    id: 'homes', title: 'Build some homes', phase: ['act1'], highlight: 'build:cottage',
    instruction: 'Welcome to Green Valley! Open the build menu, pick Cottage, and place three homes on open ground a few tiles back from the creek. People need somewhere to live before anything else grows.',
    hint: 'Click the Cottage button, then click an open tile. Bush tiles need clearing first.',
    done: { all: [t('acts.built.cottage', '>=', 3)] },
  },
  {
    id: 'farm', title: 'Grow some food', phase: ['act1'], highlight: 'build:farm',
    instruction: 'Now give the town work and food: place a Farm on flat ground. Farms are big, so look for a 2 by 2 patch. They also wash a little fertiliser into the creek, so notice where you put it.',
    done: { all: [t('acts.built.farm', '>=', 1)] },
  },
  {
    id: 'roads', title: 'Connect the town', phase: ['act1'], highlight: 'build:road',
    instruction: 'Lay a couple of Road tiles between your homes and the farm. Roads are cheap, and they also split up bushland, which will matter for animals later.',
    done: { all: [t('acts.built.road', '>=', 2)] },
  },
  {
    id: 'clear', title: 'Clear a little bush', phase: ['act1'], highlight: 'tool:clear',
    instruction: 'Bushland has to be cleared before you can build on it. Use the Clear tool on one bush tile, then check the Environment meter at the top. Every choice has a cost.',
    done: { all: [t('acts.cleared', '>=', 1)] },
  },
  {
    id: 'decade', title: 'Let a decade pass', phase: ['act1'], highlight: 'button:next-decade',
    instruction: 'Press Next decade. Ten years go by, money comes in, and the graphs begin to draw two lines: yours, and the real world\'s.',
    done: { all: [t('year', '>=', 1970)] },
  },
  {
    id: 'factory', title: 'Make some jobs', phase: ['act1'], highlight: 'build:factory',
    instruction: 'Factories are ready to build. Build one for jobs and goods. Watch what happens to the air and soil around it: that is pollution you will have to clean up in the second half.',
    done: { all: [t('acts.built.factory', '>=', 1)] },
  },
  {
    id: 'power', title: 'Switch the lights on', phase: ['act1'], highlight: 'build:coalpower',
    instruction: 'Homes and factories need electricity. Build a Coal power station near the creek (it needs cooling water). It makes power for the whole town, and a great deal of carbon dioxide.',
    done: { all: [t('acts.built.coalpower', '>=', 1)] },
  },
  {
    id: 'mine', title: 'Dig the coal', phase: ['act1'], highlight: 'build:coalmine',
    instruction: 'The power station needs fuel. Build a Coal mine beside the rocky hills. It means jobs now, and a site to clean up later.',
    done: { all: [t('acts.built.coalmine', '>=', 1)] },
  },
  {
    id: 'grow', title: 'Grow until 2020', phase: ['act1'], highlight: 'button:next-decade',
    instruction: 'Keep adding homes and jobs and press Next decade after each round. Check the graphs: CO2 and temperature are climbing. Around 2020 something will happen that changes everything.',
    done: { all: [t('year', '>=', 2020)] },
  },
  {
    id: 'crisis', title: 'Face the crisis', phase: ['turning-point'], highlight: 'button:start-transition',
    instruction: 'A fire has come to the valley. Read the ranger\'s notes on your own graphs, and answer anyone who asks you something. Then start the transition.',
    done: { phase: ['act2', 'epilogue', 'failed'] },
  },
  {
    id: 'solar', title: 'Catch the sun', phase: ['act2'], highlight: 'build:solarfarm',
    instruction: 'It is 2025. Time now runs by itself: use pause and the speed buttons. First, build a Solar farm (or put Rooftop solar next to homes). Sun only shines in the day.',
    done: { any: [t('acts.built.solarfarm', '>=', 1), t('acts.built.rooftopsolar', '>=', 3)] },
  },
  {
    id: 'wind', title: 'Add the wind', phase: ['act2'], highlight: 'build:windfarm',
    instruction: 'Wind turbines need a windy site: a ridge or high ground. Place one on a slope. Turbines can generate by day or night, but output varies with the wind, so check storage and backup for calm periods.',
    done: { all: [t('acts.built.windfarm', '>=', 1)] },
  },
  {
    id: 'battery', title: 'Store the power', phase: ['act2'], highlight: 'build:battery',
    instruction: 'Build a Battery to save daytime power for the evening. The grid graph shows when supply falls short, and a blackout hurts everyone.',
    done: { all: [t('acts.built.battery', '>=', 1)] },
  },
  {
    id: 'swap', title: 'Retire the coal', phase: ['act2'], highlight: 'tool:dispose',
    instruction: 'When clean power covers the town by day and night, retire the Coal power station: pick the Old sites tool (it appears once the valley runs on clean power) and recycle or repurpose it. Plain Demolish means landfill, the worst choice. Too early and the lights go out.',
    done: { all: [t('acts.demolished.coalpower', '>=', 1)] },
  },
  {
    id: 'clean', title: 'Clean the soil', phase: ['act2'], highlight: 'build:phytoremediation',
    instruction: 'The old factory and mine left contamination in the soil, and some of it harms plant growth. A Phytoremediation garden uses selected plants to take up or stabilise certain pollutants (slow; contaminated plant material may need safe disposal). A Soil excavation site removes soil for treatment elsewhere (fast, expensive, diesel trucks). Build one on or beside the dark patches.',
    done: { any: [t('acts.built.phytoremediation', '>=', 1), t('acts.built.excavation', '>=', 1)] },
  },
  {
    id: 'plant', title: 'Plant the bush', phase: ['act2'], highlight: 'build:nursery',
    instruction: 'Place a Native plant nursery near bare ground. It grows local seedlings, and bushland spreads outwards from it over the years. Weeds creep in where nobody is looking.',
    done: { all: [t('acts.built.nursery', '>=', 1)] },
  },
  {
    id: 'wetland', title: 'Make a frog pond', phase: ['act2'], highlight: 'tile:@wetland',
    instruction: 'Build a Stormwater wetland beside the creek. It filters runoff, and frogs that have been gone for years may find it.',
    done: { all: [t('acts.built.wetland', '>=', 1)] },
  },
  {
    id: 'return', title: 'Wait for an animal', phase: ['act2'], highlight: 'button:animals',
    instruction: 'Let time run and watch the animals panel. In this game, an animal that had gone may return once its habitat stays good for long enough (in real places, nearby populations, barriers and other threats also matter). Open its card to see what it needed.',
    done: { all: [t('speciesBack', '>=', 1)] },
  },
  {
    id: 'recycle', title: 'Give an old site a second life', phase: ['act2'], highlight: 'tool:dispose',
    instruction: 'From 2030 the old factory, mine, power station and tip can be dealt with by the waste hierarchy. Pick the Old sites tool (bottom bar) and click one to choose its future. Repurposing is best, recycling next, and landfill is a last resort.',
    done: { all: [t('legacyPct', '>=', 50)] },
  },
  {
    id: 'finish', title: 'See it through', phase: ['act2'], highlight: 'button:objectives',
    instruction: 'Keep the valley healthy until 2040. Open Objectives any time to see how you are going. Finish with all four goals to earn the first star, and add a second wetland for a chorus big enough to earn the bonus.',
    done: { phase: ['epilogue'] },
  },
];

export const TUTORIAL_STEPS: Readonly<Partial<Record<ScenarioId, readonly TutorialStep[]>>> = {
  'green-valley': GREEN_VALLEY_STEPS,
};
