import { addFreeRoad, advanceYear, cloneState, createGame, TileKind, ZONE } from '../../src/sim';
import type { GameState } from '../../src/sim';
import { addBuilding } from './fixtures';
import { zoneArea } from './zoning';

/**
 * Two towns with the same jobs and power on the same bushland, with a street running in from the west edge: one zones nothing but
 * low-density homes along a long street, the other zones medium and high density with shops along a short one.
 */
export function grow(compact: boolean): { s: GameState; bushLost: number } {
  let s = cloneState(createGame('green-valley'));
  const g = s.grid;
  // A plain of bush, so the only difference is how the town is zoned (and how much street it needs).
  for (let i = 0; i < g.kind.length; i++) g.kind[i] = TileKind.Bush;
  g.elevation.fill(1);
  g.building.fill(0);
  g.significant.fill(0);
  g.soilContamination.fill(0);
  g.airPollution.fill(0);
  s.buildings = [];
  s.nextUid = 1;
  for (const k of Object.keys(s.flags)) if (k.startsWith('road.entrance')) delete s.flags[k];
  const row = 16;
  const len = compact ? 16 : 31;
  for (let x = 0; x <= len; x++) addFreeRoad(s, row * g.w + x);
  s.flags['road.entrance'] = row * g.w;
  s.budget = 5000;
  s.year = 1970;
  // The same jobs and power in both towns, at the start of the street.
  for (const [x, y] of [[1, 14], [3, 14], [1, 17], [3, 17]] as [number, number][]) addBuilding(s, 'factory', x, y);
  addBuilding(s, 'coalpower', 5, 14);
  addBuilding(s, 'coalpower', 5, 17);
  for (const b of s.buildings) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) g.kind[y * g.w + x] = TileKind.Land;
  let bush0 = 0;
  for (const k of g.kind) if (k === TileKind.Bush) bush0++;
  // The plain is the starting bush, so cleared land (landPerPerson) counts from it.
  s.initialBushTiles = bush0;
  if (compact) {
    s = zoneArea(s, { x: 7, y: row - 2, w: 10, h: 2 }, ZONE.rhigh);
    s = zoneArea(s, { x: 7, y: row + 1, w: 4, h: 2 }, ZONE.com);
    s = zoneArea(s, { x: 11, y: row + 1, w: 6, h: 2 }, ZONE.rmed);
  } else {
    s = zoneArea(s, { x: 7, y: row - 2, w: 25, h: 2 }, ZONE.rlow);
    s = zoneArea(s, { x: 7, y: row + 1, w: 25, h: 2 }, ZONE.rlow);
  }
  // No transit in 1970, so the high-rise only fill half way (60 people a tile): still the most people per tile.
  for (let i = 0; i < 30; i++) s = advanceYear(s).state;
  let bush = 0;
  for (const k of s.grid.kind) if (k === TileKind.Bush) bush++;
  // The street counts too: a long street splits more bush than a short one.
  return { s, bushLost: bush0 - bush + (len + 1) };
}
