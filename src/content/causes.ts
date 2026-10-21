/**
 * "Why did that happen?" cause chains (WP8c): one short chain of boxes for each kind of event. The sim reads the
 * player's own causes from the map and the town (sim/causes.ts) and the UI shows them under the matching box.
 * Plain Australian English at Year 9 level. Facts follow docs/research/wp8-wp9-facts.md.
 */

export type ChainKey =
  | 'fish-kill' | 'algal-bloom' | 'smog' | 'species-loss' | 'heat-deaths' | 'coral-bleaching' | 'flood'
  | 'drought' | 'erosion' | 'bushfire' | 'blackout' | 'crown-of-thorns' | 'storm-surge';

export interface CauseChain {
  key: ChainKey;
  title: string;
  /** 3 to 5 boxes, cause to effect. */
  boxes: readonly string[];
  /** What to do about it. */
  fix: string;
  /** A fact to anchor the chain, with its source. */
  fact?: string;
}

export const CAUSE_CHAINS: Record<ChainKey, CauseChain> = {
  'fish-kill': {
    key: 'fish-kill',
    title: 'Why did the fish die?',
    boxes: [
      'Fertiliser, sewage and farm runoff wash nutrients into the water',
      'Nutrients feed fast-growing algae in warm, slow water',
      'Algae die and rot, and the germs that rot them use up the oxygen',
      'Dissolved oxygen crashes',
      'Fish and water bugs suffocate',
    ],
    fix: 'Keep nutrients out of the water: treat sewage, leave grassy buffer strips beside the creek, and build wetlands that filter runoff.',
    fact: 'Healthy lowland rivers sit between 85 and 110 percent dissolved oxygen. Fish start to struggle well below that (NSW Environment and Heritage, ANZECC default trigger values).',
  },
  'algal-bloom': {
    key: 'algal-bloom',
    title: 'Why did the water turn green?',
    boxes: [
      'Nutrients (nitrogen and phosphorus) reach the river from fertiliser and sewage',
      'Sun, warmth and slow water let blue-green algae multiply',
      'The bloom covers the surface and some types make toxins',
      'Swimming and stock watering are banned, and fish die when the oxygen runs out',
    ],
    fix: 'Cut the nutrients and keep some water flowing. A thin, warm river is where blooms start.',
    fact: 'Blooms are most likely when total nitrogen and phosphorus sit above the trigger values (about 350 and 25 micrograms a litre for rivers draining to the NSW coast).',
  },
  smog: {
    key: 'smog',
    title: 'Why was the air so bad?',
    boxes: [
      'Coal power stations, factories and vehicles burn fuel',
      'Smoke, fine particles and gases pour into the air',
      'On a still, cool day a layer of warm air traps it near the ground',
      'A smog day: coughs, sore eyes and asthma attacks',
    ],
    fix: 'Fit filters and scrubbers at the source, move to cleaner power, and keep homes away from the worst of the smoke.',
    fact: 'Smoke scrubbers and dust filters cut local air pollution a lot, but they do not cut the carbon dioxide, which is a different problem.',
  },
  'species-loss': {
    key: 'species-loss',
    title: 'Why did the animals go?',
    boxes: [
      'Bush is cleared for farms, roads and buildings',
      'Habitat shrinks and is cut into small patches',
      'Animals cannot find food, mates or safe paths between patches',
      'Fewer pairs breed, and heat, fire and roads kill more',
      'The species disappears from the area',
    ],
    fix: 'Protect the bush that is left, join patches with corridors and wildlife crossings, and replant. Animals can return when habitat does.',
  },
  'heat-deaths': {
    key: 'heat-deaths',
    title: 'Why did people get sick in the heat?',
    boxes: [
      'Burning fossil fuels adds carbon dioxide to the air',
      'The climate warms, so heatwaves come more often and last longer',
      'Few trees and cool places, and the grid strains when everyone turns on air conditioners',
      'Older people, babies and sick people cannot cool down',
      'Heat illness and deaths',
    ],
    fix: 'Plant street trees, open cooling centres, keep the power on, and cut emissions so the heat stops getting worse.',
  },
  'coral-bleaching': {
    key: 'coral-bleaching',
    title: 'Why did the coral turn white?',
    boxes: [
      'Carbon dioxide from burning fuels warms the planet and the sea',
      'A marine heatwave: the water stays too hot for weeks',
      'Corals push out the tiny algae that live in them and feed them',
      'Without their food and colour, the corals turn white and starve',
      'Dead coral means fewer homes for fish and a weaker reef',
    ],
    fix: 'Cut emissions to slow the warming. Locally, cut muddy, nutrient-rich runoff and grow coral nurseries so the reef is in better shape to cope.',
  },
  'crown-of-thorns': {
    key: 'crown-of-thorns',
    title: 'Why did the starfish take over?',
    boxes: [
      'Fertiliser and sewage runoff reaches the reef',
      'Extra nutrients feed the plankton the starfish larvae eat',
      'More larvae survive and grow into coral-eating starfish',
      'An outbreak strips the coral',
    ],
    fix: 'Cut runoff, and use trained teams to control the starfish at the most important reef sites.',
  },
  flood: {
    key: 'flood',
    title: 'Why did it flood?',
    boxes: [
      'A warmer atmosphere holds more water, so storms drop heavier rain',
      'Cleared, paved and bare ground sheds water fast instead of soaking it up',
      'The creek rises quickly, and homes on low ground go under',
      'Soil and farm chemicals wash into the river',
    ],
    fix: 'Keep bush and wetlands that soak up water, keep homes off low ground, and cut emissions so storms stop getting stronger.',
  },
  'storm-surge': {
    key: 'storm-surge',
    title: 'Why did the sea come in?',
    boxes: [
      'Melting ice and warming water raise sea level',
      'A cyclone pushes the sea higher still',
      'Low-lying homes and beaches are flooded',
      'Mangroves and seawalls that could have slowed the water are missing or too low',
    ],
    fix: 'Move homes to higher ground, keep mangroves and seawalls in good shape, and cut emissions.',
  },
  drought: {
    key: 'drought',
    title: 'Why did the dry spell hurt so much?',
    boxes: [
      'Less rain, and a warmer climate dries the land faster',
      'Creek flow and storage fall',
      'Farms, homes and the river all want the same water',
      'Crops fail, fish are stranded and fire danger climbs',
    ],
    fix: 'Use water efficiently, store it in wet years, and leave enough in the river for nature. A town that already uses more than its creek renews is hit hardest.',
  },
  erosion: {
    key: 'erosion',
    title: 'Why did the soil wash away?',
    boxes: [
      'Bush and ground cover are cleared from a slope',
      'Rain hits bare soil and carries it downhill',
      'Mud clouds the creek and smothers the gravel where fish lay eggs',
      'The farm loses its best soil, and the creek silts up',
    ],
    fix: 'Keep steep land in bush, plant strips of trees, and build contour banks across slopes.',
    fact: 'Roots bind soil and leaves slow the rain. Turbidity above about 50 NTU is outside the trigger range for lowland rivers (NSW Environment and Heritage).',
  },
  bushfire: {
    key: 'bushfire',
    title: 'Why did the bush burn?',
    boxes: [
      'Warming and drought dry out the bush',
      'Fuel builds up on the ground, and hot, windy days arrive',
      'A spark from lightning, power lines or people starts a fire',
      'A hot fire kills trees and animals and threatens homes',
    ],
    fix: 'Cool, patchy burns in the cool season reduce fuel, and healthy, moist bush burns less fiercely. Cutting emissions slows the drying.',
  },
  blackout: {
    key: 'blackout',
    title: 'Why did the lights go out?',
    boxes: [
      'Demand for power peaks, often in a heatwave',
      'Supply from the power stations and the sun or wind falls short',
      'There is not enough stored energy to cover the gap',
      'Homes and factories go dark',
    ],
    fix: 'Build enough generation, add batteries to shift sunny-day power into the evening, and keep a mix of sources.',
  },
};

/** Words in a wildlife story that mean animals were lost, so the story can open the species-loss chain. */
export const LOSS_WORDS = /(\bgone\b|disappear|no longer|died|killed|lost the last|local extinction|empty)/i;
