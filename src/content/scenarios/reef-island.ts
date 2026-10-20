import type { ScenarioDef } from '../../sim/scenarios';
import { REEF_ISLAND_TURNING } from '../turning/reef-island';

/** Reef Island (hard): a tropical island that lives off its reef, with a rising sea and hotter summers. */
export const REEF_ISLAND: ScenarioDef = {
  id: 'reef-island',
  name: 'Reef Island',
  difficulty: 'hard',
  blurb: 'A tropical island beside a reef: keep the coral alive, the homes dry and the tourists coming as the sea rises and warms.',
  biome: 'tropical',
  mechanics: ['reef'],
  playMinutes: [70, 105],
  mapW: 32,
  mapH: 32,
  seed: 2007,
  terrain: { kind: 'island', seaFrac: 0.4, escarpmentFrac: 0.05, bushCover: 0.55, riverRowFrac: 0.5, reefRadius: 5, coastWobble: 0.1 },
  startYear: 1900,
  endYear: 2020,
  startBudget: 140,
  availability: {
    coalmine: { disabled: true },
    steelworks: { disabled: true },
    excavation: { disabled: true },
    reservoir: { disabled: true },
    dripfarm: { disabled: true },
    fishway: { disabled: true },
    outfall: { unlock: 1900 },
    port: {
      name: 'Harbour and jetty',
      blurb: 'Supply boats, a fishing fleet and the island ferry tie up here. Jobs and trade, with fuel spills and dredged sand in the lagoon.',
    },
    coalpower: {
      name: 'Diesel power station', nearTerrainAdd: [0], cost: 70,
      blurb: 'Burns diesel shipped in by barge, cooled with seawater. Reliable, noisy, and the biggest source of the island\'s emissions.',
    },
  },
  modifiers: { budgetMult: 1, eventSeverity: 1.5, climateSensitivityMult: 1.35, remediationYears: 20, hintLevel: 0, emissionScale: 0.45 },
  policies: [
    {
      id: 'cots.cull', label: 'Crown-of-thorns control', min: 0, max: 2, step: 1, default: 0, unit: 'level', costPerYear: [0, 5, 10],
      blurb: 'Divers control selected coral-eating starfish using approved injections of vinegar or bile salts. Level 1 patrols the main dive sites. Level 2 covers the whole reef.',
    },
  ],
  act2: {
    startYear: 2025,
    endYear: 2100,
    warmingCap: 2.4,
    meterFailYears: 3,
    features: { tidal: true },
    weedPressure: 1.2,
    fireProneness: 0.4,
    rainfall: 1.1,
    reef: { tolerance: 0.45, nurseryBoost: 0.07 },
    eventMult: { 'marine-heatwave': 1.3, drought: 0.4 },
    turningPoint: REEF_ISLAND_TURNING,
    objectives: [
      { id: 'reef', label: 'Keep the reef alive: coral health 50 or more', metric: 'reefHealth', op: '>=', target: 50 },
      { id: 'homes', label: 'No homes lost to the sea', metric: 'homesLost', op: '<=', target: 0 },
      { id: 'tourism', label: 'Keep the tourism economy going (index 45 or more)', metric: 'tourism', op: '>=', target: 45 },
      { id: 'turtles', label: 'Turtles nesting every summer', metric: 'wildlifeThriving', op: '>=', target: 1, bonus: true, pendingTier: 'wildlife' },
    ],
  },
};
