import type { ScenarioDef } from '../../sim/scenarios';
import { RIVER_TOWN_TURNING } from '../turning/river-town';

/** River Town (medium): a Murray-Darling irrigation town sharing a river between taps, farms and the river itself. */
export const RIVER_TOWN: ScenarioDef = {
  id: 'river-town',
  name: 'River Town',
  difficulty: 'medium',
  blurb: 'A Murray-Darling inland town: share the river between the taps, the farms and the fish, through droughts, salt and algae.',
  biome: 'inland-river',
  mechanics: ['river'],
  playMinutes: [70, 110],
  mapW: 32,
  mapH: 32,
  seed: 1901,
  terrain: { kind: 'river', seaFrac: 0, escarpmentFrac: 0.1, bushCover: 0.5, riverRowFrac: 0.4, reefRadius: 0, coastWobble: 0 },
  startYear: 1880,
  endYear: 2020,
  startBudget: 90,
  availability: {
    port: { disabled: true },
    steelworks: { disabled: true },
    outfall: { unlock: 1900 },
    excavation: { disabled: true },
    reservoir: { unlock: 1900 },
    resort: { disabled: true },
    seawall: { disabled: true },
  },
  modifiers: { budgetMult: 1, eventSeverity: 1.3, climateSensitivityMult: 1, remediationYears: 25, hintLevel: 1 },
  policies: [
    {
      id: 'alloc.town', label: 'Town water share', min: 0.05, max: 0.6, step: 0.05, default: 0.15, unit: 'of the river',
      blurb: 'The most of the river\'s flow that the town may take. A bigger share keeps the taps running in a drought.',
    },
    {
      id: 'alloc.env', label: 'Share left for the river', min: 0.05, max: 0.7, step: 0.05, default: 0.2, unit: 'of the river',
      blurb: 'The share set aside for fish, red gums and billabongs. The farms get whatever is left over.',
    },
  ],
  act2: {
    startYear: 2025,
    endYear: 2100,
    warmingCap: 2.7,
    meterFailYears: 3,
    features: { tidal: false },
    weedPressure: 1,
    fireProneness: 1.2,
    rainfall: 0.8,
    eventMult: { drought: 1.5, heatwave: 1.2 },
    turningPoint: RIVER_TOWN_TURNING,
    objectives: [
      { id: 'river', label: 'Bring the river back to good health (60 or more)', metric: 'riverHealth', op: '>=', target: 60 },
      { id: 'taps', label: 'No town water failures after 2040', metric: 'townWaterFailures', op: '<=', target: 0 },
      { id: 'farms', label: 'Keep the farms viable (50 or more)', metric: 'farmViability', op: '>=', target: 50 },
      { id: 'platypus', label: 'The platypus returns', metric: 'wildlifeThriving', op: '>=', target: 1, bonus: true, pendingTier: 'wildlife' },
    ],
  },
};
