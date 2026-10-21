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
  playMinutes: [75, 105],
  mapW: 44,
  mapH: 44,
  pollutionRefTiles: 1024,
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
  modifiers: { budgetMult: 1, eventSeverity: 1.5, climateSensitivityMult: 1.35, remediationYears: 20, hintLevel: 0, emissionScale: 0.5, climateInfluence: 0.6 },
  policies: [
    {
      id: 'cots.cull', label: 'Crown-of-thorns control', min: 0, max: 2, step: 1, default: 0, unit: 'level', costPerYear: [0, 5, 10],
      blurb: 'Divers control selected coral-eating starfish using approved injections of vinegar or bile salts. Level 1 patrols the main dive sites. Level 2 covers the whole reef.',
    },
    {
      id: 'turtle.lights', label: 'Turtle-friendly lighting', min: 0, max: 2, step: 1, default: 0, unit: 'level', costPerYear: [0, 2, 3],
      blurb: 'Hatchlings head for the brightest horizon. Level 1 swaps beachfront lights for shielded, low amber ones, so only buildings right on the sand still glow. Level 2 also turns beachfront lights out on nesting nights. Lights further inland do not reach the beach either way.',
    },
  ],
  act1: {
    intro: 'A tropical island in 1900, with a fringing reef and a few families who fish and farm. Over the next 120 years you will build it up: homes, work, power and visitors. The reef will show you what each choice costs.',
    why: 'Your job for the boom:',
    goals: [
      { id: 'people', label: 'Grow to 200 people by 2020', metric: 'population', op: '>=', target: 200 },
      { id: 'jobs', label: 'Give 180 of them jobs', metric: 'filledJobs', op: '>=', target: 180 },
      { id: 'power', label: 'Keep the lights on: power for every building', metric: 'powerCovered', op: '>=', target: 1 },
      { id: 'careful', label: 'Grow without wrecking it: keep Environment at 55 or more', metric: 'environment', op: '>=', target: 55, bonus: true },
    ],
  },
  act2: {
    carryOverCap: 700,
    fundShare: 0.6,
    fundYears: 25,
    carryOverNote: 'Most of the boom\'s profits went to the resort owners and the shipping lines.',
    startYear: 2025,
    endYear: 2100,
    warmingCap: 2.4,
    meterFailYears: 3,
    features: { tidal: true },
    weedPressure: 1.2,
    fireProneness: 0.4,
    rainfall: 1.1,
    reef: { tolerance: 0.3, nurseryBoost: 0.14, nurseryStack: 3, cleanWaterTolerance: 0.45 },
    eventMult: { 'marine-heatwave': 1.3, drought: 0.4 },
    turningPoint: REEF_ISLAND_TURNING,
    objectives: [
      { id: 'reef', label: 'Keep the reef alive: coral health 50 or more (average of the last 5 years)', metric: 'reefHealth', op: '>=', target: 50, avgYears: 5 },
      { id: 'homes', label: 'No homes lost to the sea', metric: 'homesLost', op: '<=', target: 0 },
      { id: 'tourism', label: 'Keep the tourism economy going (index 45 or more)', metric: 'tourism', op: '>=', target: 45 },
      { id: 'turtles', label: 'Turtles nesting every summer', metric: 'wildlifeThriving', op: '>=', target: 1, bonus: true, pendingTier: 'wildlife' },
    ],
  },
};
