/**
 * The "what it cost" ledger: how the land changed over a decade, to sit beside the money the decade earned.
 * Everything is read from the tile grid, so it is deterministic and costs nothing to keep.
 *
 * Birds and fish are a rough guide, not a census: bush birds follow the bush that is left (and thin out where the
 * air is smoky), and creek fish follow the creek's health. They give the dilemma cards something to point at in
 * Act 1, before the Act 2 wildlife model (which needs restored habitat) starts.
 */
import { BUILDINGS } from './buildings';
import { fishStockFactor } from './capacity';
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
    fish: Math.round(water * 0.6 * (creek / 100) * fishStockFactor(s)),
  };
}

/** One map tile stands for about one hectare (100 m by 100 m = 10,000 square metres) of land. */
export const TILE_M2 = 10_000;
/** A tile is about 100 m across, so a road tile is about 100 m of street. */
export const TILE_M = 100;

/**
 * How much land a town takes for the people in it. "Cleared" is bush that has gone (to homes, streets, farms, mines: anything
 * built on or cleared), counted from the bush the map started with. Home land is the ground under homes only, for the compact
 * comparison on the report card. All read from the grid, so it is deterministic.
 */
export interface LandPerPerson {
  people: number;
  clearedTiles: number;
  roadTiles: number;
  homeTiles: number;
  /** Square metres of cleared land per resident (0 when nobody lives here yet). */
  clearedM2: number;
  /** Metres of road per resident. */
  roadM: number;
  /** Square metres of ground under homes per resident. */
  homeM2: number;
  /** The same for a compact town of medium-density homes (townhouses, 50 people a tile). */
  compactHomeM2: number;
  /** homeM2 over compactHomeM2: 1 is as compact as medium density, 2 is twice the land. */
  ratio: number;
}

/** People housed per tile of medium-density homes: the "compact town" yardstick. */
export const COMPACT_PEOPLE_PER_TILE = BUILDINGS.zres2.housing;

export function landPerPerson(s: GameState): LandPerPerson {
  const g = s.grid;
  let bush = 0;
  for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === TileKind.Bush) bush++;
  const clearedTiles = Math.max(0, s.initialBushTiles - bush);
  let roadTiles = 0, homeTiles = 0;
  for (const b of s.buildings) {
    const d = BUILDINGS[b.type];
    if (d.network === 'road') roadTiles += b.w * b.h;
    else if (d.housing > 0 && b.type !== 'rooftopsolar') homeTiles += b.w * b.h;
  }
  const people = Math.max(0, s.population);
  const per = (tiles: number, unit: number): number => (people > 0 ? Math.round((tiles * unit) / people) : 0);
  const compactHomeM2 = Math.round(TILE_M2 / COMPACT_PEOPLE_PER_TILE);
  const homeM2 = per(homeTiles, TILE_M2);
  return {
    people, clearedTiles, roadTiles, homeTiles,
    clearedM2: per(clearedTiles, TILE_M2), roadM: per(roadTiles, TILE_M), homeM2, compactHomeM2,
    ratio: people > 0 && homeTiles > 0 ? Math.round((homeM2 / compactHomeM2) * 10) / 10 : 0,
  };
}

export const creekHealth = (s: GameState): number => landSnapshot(s).creek;

/** Road tiles on the map (the street length behind "road per person"). */
export function roadTileCount(s: GameState): number {
  let n = 0;
  for (const b of s.buildings) if (BUILDINGS[b.type].network === 'road') n += b.w * b.h;
  return n;
}

/** The cost of the decade that took the game from `prev` to `next`. `start` is the people and road tiles when the decade began. */
export function decadeCost(prev: GameState, next: GameState, co2Kt: number, before?: LandSnapshot, start?: { people: number; roadTiles: number }): DecadeCost {
  const a = before ?? landSnapshot(prev), b = landSnapshot(next);
  const cost: DecadeCost = {
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
  // Land per person: cleared land and street per resident, at the start and the end of the decade.
  const now = landPerPerson(next);
  cost.clearedM2After = now.clearedM2;
  cost.roadMAfter = now.roadM;
  const people0 = start?.people ?? prev.population;
  if (people0 > 0) {
    cost.clearedM2Before = Math.round((Math.max(0, next.initialBushTiles - a.bush) * TILE_M2) / people0);
    cost.roadMBefore = Math.round(((start?.roadTiles ?? roadTileCount(prev)) * TILE_M) / people0);
  }
  return cost;
}
