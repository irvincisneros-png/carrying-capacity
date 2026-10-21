/**
 * Words and per-place tuning for the carrying capacity meter (sim/capacity.ts, UI in ui/capacity.ts).
 * Definitions are written for Year 9 and come from docs/research/wp8-wp9-facts.md section 4.
 */
import type { ScenarioId } from '../sim/types';

export interface CapProfile {
  /** Multiplies what the land renews, per line. A dry inland place renews less water than a wet coast; an island has no deep river. */
  water: number;
  food: number;
  harvest: number;
  carbon: number;
  /** Which stocks this place's overshoot can run down. A city leans on land and water far outside its map, so its own creek is not drawn down. */
  draws: { flow: boolean; fish: boolean; soil: boolean };
  /** Lines supplied from outside the map (a city's water and food). They are shown but not counted as this land's overshoot. */
  external?: readonly ('water' | 'food' | 'harvest' | 'energy' | 'carbon')[];
  /** A line that is over because the place relies on land elsewhere, said in the panel. */
  note?: string;
}

const DEFAULT: CapProfile = { water: 1, food: 1, harvest: 1, carbon: 1, draws: { flow: true, fish: true, soil: true } };

export const CAP_PROFILES: Partial<Record<ScenarioId, Partial<CapProfile>>> = {
  'green-valley': { water: 1, food: 1 },
  'coal-coast': { water: 1.5, food: 1.9, harvest: 1.4 },
  'river-town': { water: 0.3, food: 0.4 },
  'reef-island': { water: 1.6, food: 1.1 },
  'red-dirt': { water: 0.55, food: 0.8, harvest: 3 },
  'net-zero-city': {
    water: 1, food: 1, harvest: 1, carbon: 1,
    draws: { flow: false, fish: true, soil: false },
    external: ['water', 'food', 'harvest'],
    note: 'A big city eats food and drinks water that come from far outside this map. Its real footprint is much bigger than the land you can see.',
  },
};

export function capProfile(id: ScenarioId): CapProfile {
  const o = CAP_PROFILES[id] ?? {};
  return { ...DEFAULT, ...o, draws: { ...DEFAULT.draws, ...(o.draws ?? {}) } };
}

/** Plain-English definitions for the click-open panel. */
export const CAPACITY_WORDS = {
  carryingCapacity: 'Carrying capacity is the most living things a place can support for a long time, using its own food, water and space.',
  overshoot: 'Overshoot is using nature faster than it can grow back. It is like spending more than you earn: it works for a while, but the savings run out.',
  footprint: 'An ecological footprint is how much land and sea it takes to supply what we use and to soak up our waste. Biocapacity is how much nature can regrow in a year.',
  facts: [
    'Earth Overshoot Day fell on 30 July in 2026 (Global Footprint Network). From then on, people were using more than the planet regrows in a year.',
    'If everyone lived like the average Australian, it would take more than four Earths. Australia has lots of land for few people, so at home it is not short of land, but its lifestyle is a big load on the world (Global Footprint Network and WWF figures).',
  ],
  howToRead: 'Each bar is what the town uses in a year compared with what the land renews or absorbs. Under the line is sustainable. Over the line, the stocks run down: the creek runs lower, fish become fewer and the soil gets tired.',
  stocks: {
    flow: 'Creek flow: how well the creek runs. When the town takes too much water, the flow drops and the dirt in the creek is less diluted.',
    fish: 'Fish: the stock of fish in the creek, estuary and sea. Too much fishing, dirty water and a warming sea all lower it.',
    soil: 'Soil fertility: how well the soil grows food and timber. Working the farmland too hard, or taking too much wood, tires it.',
  },
  recover: 'Under the line, the stocks slowly recover. Act 2 is about getting back under the line: use less, renew more, and let nature catch up.',
} as const;
