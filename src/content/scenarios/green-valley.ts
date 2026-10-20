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
  playMinutes: [20, 30],
  mapW: 16,
  mapH: 16,
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
      { id: 'healing', label: 'Heal the valley: Environment 65 or more', metric: 'environment', op: '>=', target: 65 },
      { id: 'return', label: 'Welcome an animal home that had gone', metric: 'speciesBack', op: '>=', target: 1 },
      { id: 'recycle', label: 'Give the old industrial sites a second life (half or more)', metric: 'act1Repurposed', op: '>=', target: 50, pendingTier: 'circular' },
      { id: 'frogs', label: 'Frogs calling from the wetlands', metric: 'wildlifeThriving', op: '>=', target: 1, bonus: true, pendingTier: 'wildlife' },
    ],
  },
};
