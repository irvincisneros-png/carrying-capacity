import { BUILDINGS, isUnlocked } from '../../src/sim';
import type { BuildingId, GameState } from '../../src/sim';
import { buildN, countOf } from './autoplay';
import type { Plan } from './autoplay';

/** A careful player builds compactly along the roads it has (one tile of new road is worth three tiles of walking to the hub). */
export const CAREFUL_ROADS = 3;
/**
 * The build-everything player gives some weight to where the roads already run. Re-tuned 1.5 -> 1 with bridges (round 7): the
 * entrance road now ends two tiles off the water and the creek south of it can be bridged, so this knife-edge run builds a
 * different town (1.17 C by 2020, was 1.26 C; fewer factories and steelworks before the first power station). Values from 2.25 to
 * 2.6 give a hotter town (1.35 C) that breaks more Act 2 bands than this does; 1 is the nearest to the old worst case.
 */
export const DIRTY_ROADS = 1;

interface Want {
  id: BuildingId;
  max: number;
  prefer?: 'near' | 'far';
  /** Once unlocked and still unbuilt, the player stops spending and saves up for it (the town cannot run without it). */
  save?: boolean;
  /** The player only starts saving for it from this year (a dirty-minded player does not worry about power until it bites). */
  saveFrom?: number;
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
export function greedyPlan(employers: Want[], housingRatio: number, maxPerDecade = 30, roadWeight?: number): Plan {
  // An employer whose road the town could not yet afford: the player saves up for it instead of spending on anything else.
  let saving: Want | null = null;
  return (state) => {
    let s = state;
    for (let n = 0; n < maxPerDecade; n++) {
      const { housing, jobs } = housingAndJobs(s);
      let choice: Want | null = null;
      const waitFor = employers.find((w) => (w.save === true || w.id === 'coalpower') && s.year >= (w.saveFrom ?? 0) && isUnlocked(s, w.id) && countOf(s, w.id) === 0);
      if (waitFor && s.budget < BUILDINGS[waitFor.id].cost) break;
      if (waitFor) {
        choice = waitFor;
      } else if (saving && countOf(s, saving.id) < saving.max) {
        choice = saving;
      } else if (housing < jobs * housingRatio || jobs === 0 && housing < 20) {
        const id: BuildingId = isUnlocked(s, 'suburb') ? 'suburb' : 'cottage';
        choice = { id, max: 999 };
      } else {
        choice = employers.find((w) => isUnlocked(s, w.id) && countOf(s, w.id) < w.max && BUILDINGS[w.id].cost <= s.budget) ?? null;
      }
      if (!choice) break;
      const r = buildN(s, choice.id, 1, choice.prefer ?? 'near', roadWeight);
      if (r.built === 0 && r.needsFunds) { saving = choice; break; } // the road to it is not affordable yet: save up
      if (choice === saving) saving = null;
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
  { id: 'coalpower', max: 4, saveFrom: 1950 },
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
  { id: 'coalpower', max: 1, save: true },
  { id: 'carpark', max: 2, prefer: 'far' },
];
