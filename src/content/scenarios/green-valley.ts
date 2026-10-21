import type { ScenarioDef } from '../../sim/scenarios';
import { GREEN_VALLEY_TURNING } from '../turning/green-valley';

/** Green Valley: the tutorial. A small inland valley, six decades of building, a short clean-up and restoration. */
export const GREEN_VALLEY: ScenarioDef = {
  id: 'green-valley',
  name: 'Green Valley',
  difficulty: 'tutorial',
  blurb: 'A small valley to learn the ropes: build a town, switch it to clean power, heal the land and welcome an animal home.',
  biome: 'valley',
  mechanics: ['tutorial'],
  playMinutes: [28, 38],
  mapW: 20,
  mapH: 20,
  pollutionRefTiles: 256,
  seed: 7,
  terrain: { kind: 'valley', seaFrac: 0, escarpmentFrac: 0, bushCover: 0.5, riverRowFrac: 0.4, reefRadius: 0, coastWobble: 0 },
  startYear: 1960,
  endYear: 2020,
  startBudget: 150,
  availability: {
    steelworks: { disabled: true },
    port: { disabled: true },
    outfall: { disabled: true },
  },
  modifiers: { budgetMult: 1.5, eventSeverity: 0, climateSensitivityMult: 1, remediationYears: 12, hintLevel: 3, emissionScale: 0.15 },
  act1: {
    intro: 'A quiet valley with a creek, a few farms and a lot of bush. The state wants a town here, and families are on their way. Over the next sixty years you will build it: homes, work, power. The land will answer every choice you make.',
    why: 'Your goals, by 2020:',
    cardGap: 10,
    cardsPerTurn: 2,
    goals: [
      { id: 'people', label: 'Grow the valley to 200 people by 2020', metric: 'population', op: '>=', target: 200 },
      { id: 'jobs', label: 'Give 120 of them jobs', metric: 'filledJobs', op: '>=', target: 120 },
      { id: 'power', label: 'Keep the lights on: power for every building', metric: 'powerCovered', op: '>=', target: 1 },
      { id: 'careful', label: 'Grow without wrecking it: keep Environment at 55 or more', metric: 'environment', op: '>=', target: 55, bonus: true },
    ],
  },
  act2: {
    startYear: 2025,
    endYear: 2040,
    warmingCap: 3.5,
    meterFailYears: 4,
    features: { tidal: false },
    weedPressure: 0.5,
    fireProneness: 0.5,
    rainfall: 1,
    circularYear: 2030,
    turningPoint: GREEN_VALLEY_TURNING,
    objectives: [
      { id: 'energy', label: 'Run the valley on mostly clean power (60% renewable or more)', metric: 'renewableShare', op: '>=', target: 60 },
      { id: 'healing', label: 'Heal the valley: Environment 70 or more', metric: 'environment', op: '>=', target: 70 },
      { id: 'return', label: 'Welcome an animal home that had gone', metric: 'speciesBack', op: '>=', target: 1 },
      { id: 'recycle', label: 'Give the old industrial sites a second life (half or more)', metric: 'act1Repurposed', op: '>=', target: 50, pendingTier: 'circular' },
      { id: 'frogs', label: 'Frogs calling from the wetlands', metric: 'wildlifeThriving', op: '>=', target: 1, bonus: true, pendingTier: 'wildlife' },
    ],
  },
};
