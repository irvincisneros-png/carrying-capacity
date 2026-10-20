import { BUILDINGS, isUnlocked } from '../../src/sim';
import type { BuildingId, GameState } from '../../src/sim';
import { buildN, countOf } from './autoplay';
import type { Plan } from './autoplay';

interface Want {
  id: BuildingId;
  max: number;
  prefer?: 'near' | 'far';
}

function housingAndJobs(s: GameState): { housing: number; jobs: number } {
  let housing = 0, jobs = 0;
  for (const b of s.buildings) { housing += BUILDINGS[b.type].housing; jobs += BUILDINGS[b.type].jobs; }
  return { housing, jobs };
}

/**
 * Greedy scripted player. Each decade: keep housing >= `housingRatio` x jobs, otherwise add the next wanted
 * employer from the queue, until nothing more is affordable / placeable.
 */
export function greedyPlan(employers: Want[], housingRatio: number, maxPerDecade = 30): Plan {
  return (state) => {
    let s = state;
    for (let n = 0; n < maxPerDecade; n++) {
      const { housing, jobs } = housingAndJobs(s);
      let choice: Want | null = null;
      if (housing < jobs * housingRatio || jobs === 0 && housing < 20) {
        const id: BuildingId = isUnlocked(s, 'suburb') ? 'suburb' : 'cottage';
        choice = { id, max: 999 };
      } else {
        choice = employers.find((w) => isUnlocked(s, w.id) && countOf(s, w.id) < w.max && BUILDINGS[w.id].cost <= s.budget) ?? null;
      }
      if (!choice) break;
      const r = buildN(s, choice.id, 1, choice.prefer ?? 'near');
      if (r.built === 0) {
        // Could not afford / place the housing: stop for this decade.
        if (choice.max === 999) break;
        // Placement failed for an employer: skip it by pretending it is maxed.
        employers = employers.filter((w) => w.id !== choice?.id);
        continue;
      }
      s = r.state;
    }
    return s;
  };
}

/** "Build everything dirty": every dirty industry as soon as it unlocks, as much as the budget allows. */
export const DIRTY_WANTS: Want[] = [
  { id: 'coalmine', max: 5 },
  { id: 'farm', max: 6 },
  { id: 'port', max: 2 },
  { id: 'rail', max: 4 },
  { id: 'outfall', max: 2 },
  { id: 'coalpower', max: 4 },
  { id: 'steelworks', max: 4 },
  { id: 'factory', max: 8 },
  { id: 'landfill', max: 4 },
  { id: 'carpark', max: 12 },
];

/** "Cautious": a smaller, cleaner town - no steelworks, one coal mine, one power station, little industry. */
export const CAUTIOUS_WANTS: Want[] = [
  { id: 'farm', max: 5, prefer: 'far' },
  { id: 'road', max: 6 },
  { id: 'coalmine', max: 1 },
  { id: 'port', max: 1 },
  { id: 'factory', max: 2, prefer: 'far' },
  { id: 'coalpower', max: 1 },
  { id: 'carpark', max: 2, prefer: 'far' },
];
