import { BUILDINGS, isUnlocked } from '../../src/sim';
import type { BuildingId, GameState } from '../../src/sim';
import { buildN, countOf } from './autoplay';
import type { Plan } from './autoplay';
import { hubOf } from './autoplay';
import { pendingHousing, waitingForPower, zoneHomesFor } from './zoning';
import type { HomeOpts } from './zoning';

/** A careful player builds compactly along the roads it has (one tile of new road is worth three tiles of walking to the hub). */
export const CAREFUL_ROADS = 3;
/**
 * The build-everything player gives some weight to where the roads already run. Re-tuned 1.5 -> 1 with bridges (round 7): the
 * entrance road now ends two tiles off the water and the creek south of it can be bridged, so this knife-edge run builds a
 * different town (1.17 C by 2020, was 1.26 C; fewer factories and steelworks before the first power station). Values from 2.25 to
 * 2.6 give a hotter town (1.35 C) that breaks more Act 2 bands than this does; 1 is the nearest to the old worst case.
 */
export const DIRTY_ROADS = 1;
/** Most coal power stations a scripted player builds to keep zoned homes growing. */
const POWER_CAP = 3;

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
  // Home tiles that are zoned but have not grown yet count as homes on the way.
  return { housing: housing + pendingHousing(s), jobs };
}

/**
 * Greedy scripted player. Each decade: keep housing >= `housingRatio` x jobs, otherwise add the next wanted
 * employer from the queue, until nothing more is affordable / placeable.
 */
export function greedyPlan(employers: Want[], housingRatio: number, maxPerDecade = 30, roadWeight?: number, homes: HomeOpts = {}): Plan {
  // An employer whose road the town could not yet afford: the player saves up for it instead of spending on anything else.
  let saving: Want | null = null;
  return (state) => {
    let s = state;
    for (let n = 0; n < maxPerDecade; n++) {
      // Homes are zoned, not placed: top the zones up so the town can house its jobs, then pick the next employer.
      s = zoneHomesFor(s, Math.max(housingAndJobs(s).jobs * housingRatio, 20), hubOf(s), homes);
      const { housing, jobs } = housingAndJobs(s);
      let choice: Want | null = null;
      const waitFor = employers.find((w) => (w.save === true || w.id === 'coalpower') && s.year >= (w.saveFrom ?? 0) && isUnlocked(s, w.id) && countOf(s, w.id) === 0);
      if (waitFor && s.budget < BUILDINGS[waitFor.id].cost) break;
      // Zoned homes wait for power once the town outgrows its first power station: a player who sees "Waiting for power" builds more.
      const powerWant = employers.find((w) => w.id === 'coalpower');
      const needPower = !waitFor && powerWant !== undefined && isUnlocked(s, 'coalpower') && countOf(s, "coalpower") < Math.max(powerWant.max, POWER_CAP) && waitingForPower(s);
      if (needPower && s.budget < BUILDINGS.coalpower.cost) break;
      if (waitFor) {
        choice = waitFor;
      } else if (needPower) {
        choice = { id: 'coalpower', max: 999, prefer: 'near' };
      } else if (saving && countOf(s, saving.id) < saving.max) {
        choice = saving;
      } else {
        choice = employers.find((w) => isUnlocked(s, w.id) && countOf(s, w.id) < w.max && BUILDINGS[w.id].cost <= s.budget) ?? null;
      }
      if (!choice) break;
      const r = buildN(s, choice.id, 1, choice.prefer ?? 'near', roadWeight);
      if (r.built === 0 && r.needsFunds) { saving = choice; break; } // the road to it is not affordable yet: save up
      if (choice === saving) saving = null;
      if (r.built === 0 && s.budget < BUILDINGS[choice.id].cost) { saving = choice; break; } // short of the building's own price: keep saving
      if (r.built === 0) {
        // Placement failed for an employer: skip it by pretending it is maxed.
        employers = employers.filter((w) => w.id !== choice?.id);
        continue;
      }
      s = r.state;
    }
    return s;
  };
}

/**
 * "Build everything dirty": every dirty industry as soon as it unlocks, as much as the budget allows.
 *
 * Re-banded for zoning (phase 2): homes used to cost this player cottages and brick suburbs ($10k and $30k each, plus the road to
 * every one), so the budget held its town to 5 factories and no car parks by 2020 (T 1.17 C, 6.7 Mt). Zoned homes grow for the
 * council's streets-and-pipes fee and no road of their own, so the same script reached every cap by 2000 (8 factories, 12 car
 * parks: T 1.47 C, 12.3 Mt) and no Act 2 could win from that start. The caps now hold the worst case where it always was: the
 * same 5 factories and no car parks (the town it reaches is the old one, a few decades earlier).
 */
export const DIRTY_WANTS: Want[] = [
  { id: 'coalmine', max: 5 },
  { id: 'farm', max: 6 },
  { id: 'port', max: 2 },
  { id: 'rail', max: 4 },
  { id: 'outfall', max: 2 },
  { id: 'coalpower', max: 4, saveFrom: 1950 },
  { id: 'steelworks', max: 2 },
  { id: 'factory', max: 4 },
  { id: 'landfill', max: 4 },
  { id: 'carpark', max: 0 },
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
