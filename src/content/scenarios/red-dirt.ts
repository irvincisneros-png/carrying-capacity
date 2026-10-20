import type { ScenarioDef } from '../../sim/scenarios';
import { RED_DIRT_TURNING } from '../turning/red-dirt';

/** NOTE: Traditional Owner references in this file and in turning/red-dirt.ts remain needsConsultation (placeholder pending community authorship). Red Dirt (hard): an outback mining town with the best sun in the country, very little water and a pit to rehabilitate. */
export const RED_DIRT: ScenarioDef = {
  id: 'red-dirt',
  name: 'Red Dirt',
  difficulty: 'hard',
  blurb: 'An outback mining town: go solar, make the water last, and restore the mine site under an agreed plan developed with its Traditional Owners.',
  biome: 'arid',
  mechanics: ['outback', 'heat'],
  playMinutes: [75, 110],
  mapW: 32,
  mapH: 32,
  seed: 1893,
  terrain: { kind: 'outback', seaFrac: 0, escarpmentFrac: 0.2, bushCover: 0.25, riverRowFrac: 0.4, reefRadius: 0, coastWobble: 0 },
  startYear: 1890,
  endYear: 2020,
  startBudget: 80,
  availability: {
    port: { disabled: true },
    steelworks: { disabled: true },
    outfall: { disabled: true },
    resort: { disabled: true },
    seawall: { disabled: true },
    coalmine: { name: 'Open-cut mine', blurb: 'Digs minerals from the red ground. Lots of jobs, a lot of dust, a lot of water, and a pit to deal with later.' },
  },
  modifiers: { budgetMult: 1.4, eventSeverity: 1.5, climateSensitivityMult: 1.1, remediationYears: 30, hintLevel: 0, emissionScale: 0.5 },
  policies: [
    {
      id: 'water.restrict', label: 'Water restrictions', min: 0, max: 2, step: 1, default: 0, unit: 'level',
      blurb: 'Level 1 bans sprinklers and washing down. Level 2 limits showers and gardens. Demand falls, and patience wears thin.',
    },
  ],
  act2: {
    startYear: 2025,
    endYear: 2100,
    warmingCap: 2.6,
    meterFailYears: 3,
    features: { tidal: false },
    weedPressure: 1.3,
    fireProneness: 1.3,
    rainfall: 0.6,
    solarCf: 1.28,
    windCf: 0.9,
    heat: { deathsPer1000: 0.12 },
    netZeroKt: 12,
    eventMult: { heatwave: 1.6, drought: 1.2, flood: 0.4 },
    turningPoint: RED_DIRT_TURNING,
    objectives: [
      { id: 'netzero', label: 'Net zero by 2060 and holding', metric: 'netZeroYear', op: '<=', target: 2060 },
      { id: 'rehab', label: 'Mine site fully rehabilitated under an agreed plan with the Traditional Owners', metric: 'rehabPct', op: '>=', target: 100 },
      { id: 'water', label: 'Water secure: aquifer at 40 or more', metric: 'aquifer', op: '>=', target: 40 },
      { id: 'taps', label: 'No town water failures after 2040', metric: 'waterFailures', op: '<=', target: 0 },
      { id: 'renewable', label: 'A 100% renewable grid', metric: 'renewableShare', op: '>=', target: 99.5, bonus: true },
    ],
  },
};
