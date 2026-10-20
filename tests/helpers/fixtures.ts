import {
  BUILDINGS, climateAt, cloneState, computeMeters, createGame, emptyAct2, footprintFor, getScenario, initRestoration,
  referenceCumulative, TileKind,
} from '../../src/sim';
import type { BuildingId, GameState, PlacedBuilding, Rotation, ScenarioId, TileKindValue } from '../../src/sim';

/** Game on the scenario's map but with all tiles replaced by `fill`, 2020 and lots of money. */
export function sandbox(
  fill: TileKindValue = TileKind.Land,
  opts: { year?: number; budget?: number; scenario?: ScenarioId } = {},
): GameState {
  const s = cloneState(createGame(opts.scenario ?? 'coal-coast'));
  s.grid.kind.fill(fill);
  s.grid.building.fill(0);
  s.year = opts.year ?? 2020;
  s.budget = opts.budget ?? 1_000_000;
  s.initialBushTiles = 100;
  return s;
}

export function paint(s: GameState, x: number, y: number, w: number, h: number, kind: TileKindValue): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) s.grid.kind[yy * s.grid.w + xx] = kind;
}

/**
 * Act 2 game on the scenario's map with every tile replaced by `fill`, no buildings, flat ground (elevation 1),
 * 2025, lots of money, climate exactly on the reference pathway (m = 1) so nothing jumps at the first year end.
 */
export function act2Sandbox(
  fill: TileKindValue = TileKind.Land,
  opts: { year?: number; budget?: number; scenario?: ScenarioId; seed?: number } = {},
): GameState {
  const base = createGame(opts.scenario ?? 'coal-coast', opts.seed);
  const sc = getScenario(base.scenarioId);
  const s = cloneState(base);
  s.grid.kind.fill(fill);
  s.grid.elevation.fill(1);
  s.grid.building.fill(0);
  s.buildings = [];
  s.phase = 'act2';
  s.status = 'playing';
  s.year = opts.year ?? sc.act2.startYear;
  s.budget = opts.budget ?? 1_000_000;
  s.initialBushTiles = 100;
  const scale = sc.modifiers.emissionScale ?? 1;
  s.cumulativeKt = referenceCumulative(s.year) * scale;
  const clim = climateAt(s.year, s.cumulativeKt, sc.modifiers.climateSensitivityMult, scale);
  s.co2 = clim.co2;
  s.tempC = clim.tempC;
  s.multiplier = clim.m;
  s.a2 = emptyAct2(s.year, clim.tempC);
  initRestoration(s);
  s.meters = computeMeters(s);
  return s;
}

/** Puts a building on the map without any rule checks (tests only). */
export function addBuilding(s: GameState, type: BuildingId, x: number, y: number, rotation: Rotation = 0): PlacedBuilding {
  const { w, h } = footprintFor(BUILDINGS[type], rotation);
  const uid = s.nextUid++;
  const b: PlacedBuilding = { uid, type, x, y, rotation, w, h, builtYear: s.year };
  s.buildings.push(b);
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      s.grid.building[yy * s.grid.w + xx] = uid;
      s.grid.health[yy * s.grid.w + xx] = 0;
      s.grid.stage[yy * s.grid.w + xx] = 0;
    }
  }
  return b;
}

/** Sets a field to `value` on every tile of a rect. */
export function fillField(s: GameState, field: Float32Array, x: number, y: number, w: number, h: number, value: number): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) field[yy * s.grid.w + xx] = value;
}

/** Make a tile fully grown (stage 3, health 0.95). */
export function growTile(s: GameState, x: number, y: number): void {
  const i = y * s.grid.w + x;
  s.grid.health[i] = 0.95;
  s.grid.stage[i] = 3;
  if (s.grid.kind[i] === TileKind.Land) s.grid.kind[i] = TileKind.Bush;
}
