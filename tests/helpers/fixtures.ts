import {
  BUILDINGS, climateAt, cloneState, computeMeters, createGame, emptyAct2, footprintFor, getScenario, initRestoration,
  generateTerrain, referenceCumulative, TileKind,
} from '../../src/sim';
import type { BuildingId, GameState, PlacedBuilding, Rotation, ScenarioId, TileKindValue } from '../../src/sim';

/**
 * Unit-test fixtures keep the original map sizes (green-valley 16, net-zero-city 48, the rest 32) so the painted
 * rectangles and `y * 32 + x` indexing in the mechanic tests do not depend on how big the shipped scenarios are.
 */
export const FIXTURE_SIZE: Record<string, number> = { 'green-valley': 16, 'net-zero-city': 48 };
/** Event seeds the fixtures keep (a scenario's own seed may have changed with its map). */
const FIXTURE_SEED: Record<string, number> = { 'coal-coast': 1850 };

/** Swaps the game's map for the scenario's terrain generated at the fixture size (the shipped maps are larger). */
function useFixtureMap(s: GameState): void {
  const sc = getScenario(s.scenarioId);
  const n = FIXTURE_SIZE[s.scenarioId] ?? 32;
  if (sc.mapW === n && sc.mapH === n) return;
  s.grid = generateTerrain({ ...sc, mapW: n, mapH: n }, s.seed);
}

/**
 * Unit-test sandboxes switch the roads-matter rule off (no entrance, so every building counts as connected): they test
 * one system at a time with buildings dropped on the map. Tests of the rule itself use createGame and real roads.
 */
export function legacyRoads(s: GameState): void {
  s.buildings = s.buildings.filter((b) => (s.grid.building[b.y * s.grid.w + b.x] ?? 0) === b.uid);
  for (const k of Object.keys(s.flags)) if (k.startsWith('road.entrance')) delete s.flags[k];
}

/** Game on the scenario's map but with all tiles replaced by `fill`, 2020 and lots of money. */
export function sandbox(
  fill: TileKindValue = TileKind.Land,
  opts: { year?: number; budget?: number; scenario?: ScenarioId } = {},
): GameState {
  const s = cloneState(createGame(opts.scenario ?? 'coal-coast', FIXTURE_SEED[opts.scenario ?? 'coal-coast']));
  useFixtureMap(s);
  s.grid.kind.fill(fill);
  s.grid.building.fill(0);
  legacyRoads(s);
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
  const base = createGame(opts.scenario ?? 'coal-coast', opts.seed ?? FIXTURE_SEED[opts.scenario ?? 'coal-coast']);
  const sc = getScenario(base.scenarioId);
  const s = cloneState(base);
  useFixtureMap(s);
  s.grid.kind.fill(fill);
  s.grid.elevation.fill(1);
  s.grid.building.fill(0);
  s.buildings = [];
  legacyRoads(s);
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
