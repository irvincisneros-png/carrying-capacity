import { cloneState, createGame, TileKind } from '../../src/sim';
import type { GameState, ScenarioId, TileKindValue } from '../../src/sim';

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
