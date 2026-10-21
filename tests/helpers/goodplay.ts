import { applyAction, balanceGrid, BUILDINGS, TileKind } from '../../src/sim';
import type { BuildingId, GameState } from '../../src/sim';
import { bestSpot, count, demolishAll, fieldSum, place, placeUpTo } from './act2play';
import { kScale } from './mapscale';

/** Would the grid hold (<= 1.5% unmet in all four seasons) if this building were removed? */
export function gridHoldsWithout(s: GameState, uid: number): boolean {
  const b = s.buildings.find((o) => o.uid === uid);
  if (!b) return true;
  const r = applyAction(s, { type: 'demolish', x: b.x, y: b.y });
  if (!r.result.ok) return false;
  for (let k = 0; k < 4; k++) {
    const probe: GameState = { ...r.state, a2: { ...r.state.a2, season: k as 0 | 1 | 2 | 3 } };
    // Worst plausible weather: check three different weather draws.
    for (const off of [0, 1, 2]) {
      if (balanceGrid(probe, (probe.year - 1850) * 4 + k + off * 40).report.unmetFrac > 0.015) return false;
    }
    // And a summer heatwave (homes use a quarter more power) must not bring a real blackout.
    if (k === 0) {
      const hot: GameState = { ...probe, a2: { ...probe.a2, active: [...probe.a2.active, { type: 'heatwave', endsAt: 1e9, severity: 1 }] } };
      if (balanceGrid(hot, (hot.year - 1850) * 4).report.unmetFrac > 0.04) return false;
    }
  }
  return true;
}

function toward(hub: { x: number; y: number }) {
  return (x: number, y: number): number => -Math.hypot(x - hub.x, y - hub.y);
}

/** Open land tiles within `r` of the footprint that no nursery already covers. */
function uncoveredLand(s: GameState, x: number, y: number, w: number, h: number, r: number): number {
  const g = s.grid;
  let n = 0;
  for (let yy = Math.max(0, y - r); yy <= Math.min(g.h - 1, y + h - 1 + r); yy++) {
    for (let xx = Math.max(0, x - r); xx <= Math.min(g.w - 1, x + w - 1 + r); xx++) {
      const i = yy * g.w + xx;
      if (g.kind[i] === TileKind.Land && (g.building[i] ?? 0) === 0 && (g.stage[i] ?? 0) <= 1 && (g.soilContamination[i] ?? 0) < 0.8) {
        let covered = false;
        for (const b of s.buildings) {
          if (b.type !== 'nursery') continue;
          const dx = Math.max(b.x - xx, xx - (b.x + b.w - 1), 0), dy = Math.max(b.y - yy, yy - (b.y + b.h - 1), 0);
          if (Math.hypot(dx, dy) <= 5) { covered = true; break; }
        }
        if (!covered) n++;
      }
    }
  }
  return n;
}

export interface GoodPlayOpts {
  /** Years of delay before the first action (for the "late action" comparisons). */
  startDelay?: number;
  nurseries?: number;
  /** Keep the steelworks until the transition program has been funded (so Mick is not left behind). */
  holdSteel?: boolean;
  /** Once the circular tier is open, never plain-demolish legacy sites (that would send them to landfill). */
  circularSafe?: boolean;
  /** Clean the water and soil before buying more clean power (a player with a capped budget has to choose). */
  waterFirst?: boolean;
}

function soilStep(state: GameState): GameState {
  let s = state;
  // 4. Soil: dig out the worst hotspots first, plant the rest.
  const soil = s.grid.soilContamination;
  const hot = (x: number, y: number, w: number, h: number): number => fieldSum(s, soil, x, y, w, h, 3);
  for (const id of ['excavation', 'phytoremediation'] as const) {
    const have = count(s, id);
    const goal = id === 'excavation' ? 2 : 4;
    for (let i = have; i < goal; i++) {
      const spot = bestSpot(s, id, hot);
      if (!spot) break;
      const covered = hot(spot.x, spot.y, 2, 2);
      if (covered < 6) break; // nothing contaminated enough left
      const p = place(s, id, spot);
      if (!p.ok) break;
      s = p.state;
    }
  }

  return s;
}

/** Scripted "good player" for coal-coast. Called once per year before the year is simulated. */
export function goodPlayPlan(opts: GoodPlayOpts = {}): (s: GameState) => GameState {
  return (state) => {
    let s = state;
    if (s.year < state.a2.startYear + (opts.startDelay ?? 0)) return s;
    const hubTiles: number[] = [];
    for (let i = 0; i < s.grid.kind.length; i++) if (s.grid.kind[i] === TileKind.Estuary) hubTiles.push(i);
    const hub = { x: (hubTiles.reduce((a, i) => a + (i % s.grid.w), 0)) / Math.max(1, hubTiles.length), y: (hubTiles.reduce((a, i) => a + Math.floor(i / s.grid.w), 0)) / Math.max(1, hubTiles.length) };
    const near = toward(hub);

    // 1. Heavy industry that can go without the grid: close it straight away.
    const sorting = opts.circularSafe === true && s.circular.unlocked;
    if (!sorting) {
      if (!opts.holdSteel || s.flags['transition.funded'] === 1) s = demolishAll(s, 'steelworks');
      s = demolishAll(s, 'coalmine');
      s = demolishAll(s, 'landfill');
      s = demolishAll(s, 'carpark');
      s = demolishAll(s, 'rail');
    }

    // 2. Cheap water fixes.
    for (const b of s.buildings.filter((o) => o.type === 'outfall')) {
      const p = place(s, 'sewagetreatment', { x: b.x, y: b.y, rotation: 0 });
      if (p.ok) s = p.state;
    }
    s = placeUpTo(s, 'wetland', Math.max(0, kScale('coal-coast', 5) - count(s, 'wetland')), (x, y) => near(x, y));

    if (opts.waterFirst) s = soilStep(s);

    // 3. Energy: build clean capacity, then retire coal and (later) gas when the grid holds without it.
    const want: [BuildingId, number, number][] = [
      ['windfarm', 8, 0],
      ['solarfarm', 4, 0],
      ['battery', 3, 0],
      ['solarfarm', 6, 0],
      ['battery', 5, 0],
      ['hydro', 1, 0],
      ['gaspower', 1, 0],
      ['pumpedhydro', 1, 2030],
      ['offshorewind', 4, 2040],
      ['rooftopsolar', 6, 0],
    ];
    for (const [id, n, from] of want) {
      if (s.year < from) continue;
      const score = id === 'windfarm' || id === 'offshorewind' ? () => 0 : near;
      s = placeUpTo(s, id, Math.max(0, n - count(s, id)), score);
    }
    // After a year with blackouts, one more battery (night) or solar farm (day) goes in: the roads to the ridge turbines
    // and the sites the town's roads reach cost real money, so the fixed shopping list above can fall short.
    if (s.a2.lastUnmetFrac > 0.02 && s.year > 2030) {
      const day = (s.a2.lastGrid?.day.unmet ?? 0) > (s.a2.lastGrid?.night.unmet ?? 0);
      const id: BuildingId = day ? 'solarfarm' : 'battery';
      if (count(s, id) < (day ? 12 : 10)) s = placeUpTo(s, id, 2, near);
    }
    for (const b of s.buildings.filter((o) => o.type === 'coalpower')) {
      if (gridHoldsWithout(s, b.uid)) {
        if (opts.circularSafe && s.circular.unlocked) {
          const r = applyAction(s, { type: 'dispose', x: b.x, y: b.y, how: 'recycle' });
          if (r.result.ok) s = r.state;
        } else {
          s = applyAction(s, { type: 'demolish', x: b.x, y: b.y }).state;
        }
      }
    }

    if (!opts.waterFirst) s = soilStep(s);

    // 5. Restoration: nurseries where they cover the most uncovered open land.
    const cover = (x: number, y: number, w: number, h: number): number => uncoveredLand(s, x, y, w, h, 5);
    const total = opts.nurseries ?? kScale('coal-coast', 10);
    s = placeUpTo(s, 'nursery', Math.max(0, Math.min(3, total - count(s, 'nursery'))), cover);
    return s;
  };
}

export { BUILDINGS };
