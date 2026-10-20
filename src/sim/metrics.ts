import { TileKind } from './types';
import type { GameState } from './types';

/** Mean estuary water pollution at which estuary water health reaches 0. */
export const ESTUARY_BAD = 2.0;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Mean water pollution over estuary tiles (0 when the map has none). */
export function estuaryPollution(state: GameState): number {
  const g = state.grid;
  let s = 0, n = 0;
  for (let i = 0; i < g.kind.length; i++) {
    if (g.kind[i] === TileKind.Estuary) { s += g.waterPollution[i] ?? 0; n++; }
  }
  return n > 0 ? s / n : 0;
}

/** Estuary water health 0..100 (100 = clean). */
export function estuaryHealth(state: GameState): number {
  return Math.round(100 * (1 - clamp01(estuaryPollution(state) / ESTUARY_BAD)) * 10) / 10;
}

/** Mean vegetation health (0..1) over all land, beach and estuary tiles; built-over tiles count as 0. */
export function meanHealth(state: GameState): number {
  const g = state.grid;
  let s = 0, n = 0;
  for (let i = 0; i < g.kind.length; i++) {
    const k = g.kind[i];
    if (k === TileKind.Land || k === TileKind.Bush || k === TileKind.Beach || k === TileKind.Estuary) {
      s += g.health[i] ?? 0;
      n++;
    }
  }
  return n > 0 ? s / n : 0;
}

/** Mean coral health (0..1); 1 when the map has no reef so scenarios without one are not penalised. */
export function meanReefHealth(state: GameState): number {
  const g = state.grid;
  let s = 0, n = 0;
  for (let i = 0; i < g.kind.length; i++) {
    if (g.kind[i] === TileKind.Reef) { s += g.health[i] ?? 0; n++; }
  }
  return n > 0 ? s / n : 1;
}

export function hasReef(state: GameState): boolean {
  return state.grid.kind.includes(TileKind.Reef);
}

/** Number of tiles at or above a succession stage (land / beach / estuary / shallow sea, not reef). */
export function tilesAtStage(state: GameState, minStage: number): number {
  const g = state.grid;
  let n = 0;
  for (let i = 0; i < g.kind.length; i++) {
    if (g.kind[i] !== TileKind.Reef && (g.stage[i] ?? 0) >= minStage && (g.health[i] ?? 0) > 0) n++;
  }
  return n;
}

export function weedCount(state: GameState): number {
  let n = 0;
  for (let i = 0; i < state.grid.weed.length; i++) if (state.grid.weed[i] === 1) n++;
  return n;
}
