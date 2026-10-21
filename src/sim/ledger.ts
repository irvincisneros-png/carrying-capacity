/**
 * The "what it cost" ledger: how the land changed over a decade, to sit beside the money the decade earned.
 * Everything is read from the tile grid, so it is deterministic and costs nothing to keep.
 *
 * Birds and fish are a rough guide, not a census: bush birds follow the bush that is left (and thin out where the
 * air is smoky), and creek fish follow the creek's health. They give the dilemma cards something to point at in
 * Act 1, before the Act 2 wildlife model (which needs restored habitat) starts.
 */
import { measureTiles } from './economy';
import { WATER_TOXIC } from './pollution';
import { TileKind } from './types';
import type { DecadeCost, GameState } from './types';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export interface LandSnapshot {
  bush: number;
  creek: number;
  air: number;
  birds: number;
  fish: number;
}

export function landSnapshot(s: GameState): LandSnapshot {
  const g = s.grid;
  let bush = 0, bushAir = 0, water = 0, waterPoll = 0;
  for (let i = 0; i < g.kind.length; i++) {
    const k = g.kind[i];
    if (k === TileKind.Bush) { bush++; bushAir += g.airPollution[i] ?? 0; }
    else if (k === TileKind.River || k === TileKind.Estuary) { water++; waterPoll += g.waterPollution[i] ?? 0; }
  }
  const creek = water > 0 ? Math.round(100 * (1 - clamp01(waterPoll / water / WATER_TOXIC))) : 100;
  const meanAir = bush > 0 ? bushAir / bush : 0;
  return {
    bush,
    creek,
    air: Math.round((1 - clamp01(measureTiles(s).housingAir / 9)) * 100),
    birds: Math.round(bush * 1.6 * (1 - 0.4 * clamp01(meanAir))),
    fish: Math.round(water * 0.6 * (creek / 100)),
  };
}

export const creekHealth = (s: GameState): number => landSnapshot(s).creek;

/** The cost of the decade that took the game from `prev` to `next`. */
export function decadeCost(prev: GameState, next: GameState, co2Kt: number): DecadeCost {
  const a = landSnapshot(prev), b = landSnapshot(next);
  return {
    bushLost: Math.max(0, a.bush - b.bush),
    bushLeft: b.bush,
    creekBefore: a.creek,
    creekAfter: b.creek,
    airBefore: a.air,
    airAfter: b.air,
    co2Kt: Math.round(co2Kt),
    birdsBefore: a.birds,
    birdsAfter: b.birds,
    fishBefore: a.fish,
    fishAfter: b.fish,
  };
}
