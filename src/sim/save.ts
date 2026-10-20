import { isBuildingId } from './buildings';
import { SAVE_VERSION, createGame } from './game';
import { isScenarioId } from './scenarios';
import { getScenario } from './scenarios';
import { EMISSION_CATEGORIES } from './types';
import type { GameState, HistoryRecord, Meters, PlacedBuilding, ScenarioId, TileGrid } from './types';

export const SAVE_KEY = 'cc.save.v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface SerialGrid {
  w: number;
  h: number;
  kind: number[];
  elevation: number[];
  building: number[];
  airPollution: number[];
  waterPollution: number[];
  soilContamination: number[];
}
type SerialState = Omit<GameState, 'grid'> & { grid: SerialGrid };

export function serialize(state: GameState): string {
  const g = state.grid;
  const grid: SerialGrid = {
    w: g.w,
    h: g.h,
    kind: Array.from(g.kind),
    elevation: Array.from(g.elevation),
    building: Array.from(g.building),
    airPollution: Array.from(g.airPollution),
    waterPollution: Array.from(g.waterPollution),
    soilContamination: Array.from(g.soilContamination),
  };
  const out: SerialState = { ...state, grid };
  return JSON.stringify(out);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const finArr = (v: unknown, n: number): v is number[] => Array.isArray(v) && v.length === n && v.every(fin);
const meters = (v: unknown): v is Meters =>
  isObj(v) && fin(v.economy) && fin(v.society) && fin(v.environment);

/** Returns null for anything that is not a valid current-version save. */
export function deserialize(text: string | null): GameState | null {
  if (!text) return null;
  try {
    const raw: unknown = JSON.parse(text);
    if (!isObj(raw)) return null;
    // Future: migrate older saveVersion values here. Unknown/newer versions are rejected.
    if (raw.saveVersion !== SAVE_VERSION) return null;
    if (typeof raw.scenarioId !== 'string' || !isScenarioId(raw.scenarioId)) return null;
    const scenarioId: ScenarioId = raw.scenarioId;
    const sc = getScenario(scenarioId);
    const g = raw.grid;
    if (!isObj(g) || g.w !== sc.mapW || g.h !== sc.mapH) return null;
    const n = sc.mapW * sc.mapH;
    if (!finArr(g.kind, n) || !finArr(g.elevation, n) || !finArr(g.building, n)) return null;
    if (!finArr(g.airPollution, n) || !finArr(g.waterPollution, n) || !finArr(g.soilContamination, n)) return null;
    if (g.kind.some((k) => !Number.isInteger(k) || k < 0 || k > 7)) return null;
    if (!fin(raw.seed) || !fin(raw.year) || !fin(raw.budget) || !fin(raw.population) || !fin(raw.lastIncome)) return null;
    if (!fin(raw.nextUid) || !fin(raw.pendingLandKt) || !fin(raw.cumulativeKt) || !fin(raw.co2) || !fin(raw.tempC)) return null;
    if (!fin(raw.multiplier) || !fin(raw.initialBushTiles) || !fin(raw.version)) return null;
    if (raw.status !== 'playing' && raw.status !== 'act1-complete') return null;
    if (!meters(raw.meters)) return null;
    if (raw.year < sc.startYear || raw.year > sc.endYear || (raw.year - sc.startYear) % 10 !== 0) return null;
    if (!Array.isArray(raw.buildings) || !Array.isArray(raw.history)) return null;
    if (raw.history.length !== (raw.year - sc.startYear) / 10 + 1) return null;

    const uids = new Set<number>();
    for (const b of raw.buildings as unknown[]) {
      if (!isObj(b) || typeof b.type !== 'string' || !isBuildingId(b.type)) return null;
      if (!fin(b.uid) || !fin(b.x) || !fin(b.y) || !fin(b.w) || !fin(b.h) || !fin(b.builtYear)) return null;
      if (![0, 1, 2, 3].includes(b.rotation as number)) return null;
      if (uids.has(b.uid) || b.uid < 1 || b.uid > 65535) return null;
      if (b.x < 0 || b.y < 0 || b.x + b.w > sc.mapW || b.y + b.h > sc.mapH) return null;
      uids.add(b.uid);
    }
    for (const u of g.building) if (u !== 0 && !uids.has(u)) return null;
    for (const h of raw.history as unknown[]) {
      if (!isObj(h) || !fin(h.year) || !fin(h.co2) || !fin(h.realCo2) || !fin(h.tempC) || !fin(h.realTempC)) return null;
      if (!fin(h.multiplier) || !fin(h.totalKt) || !fin(h.population) || !fin(h.budget) || !meters(h.meters)) return null;
      if (!isObj(h.emissionsKt) || !EMISSION_CATEGORIES.every((c) => fin((h.emissionsKt as Record<string, unknown>)[c]))) return null;
    }

    const grid: TileGrid = {
      w: g.w,
      h: g.h,
      kind: Uint8Array.from(g.kind),
      elevation: Uint8Array.from(g.elevation),
      building: Uint16Array.from(g.building),
      airPollution: Float32Array.from(g.airPollution),
      waterPollution: Float32Array.from(g.waterPollution),
      soilContamination: Float32Array.from(g.soilContamination),
    };
    const state: GameState = {
      saveVersion: SAVE_VERSION,
      scenarioId,
      seed: raw.seed,
      year: raw.year,
      status: raw.status,
      budget: raw.budget,
      population: raw.population,
      lastIncome: raw.lastIncome,
      grid,
      buildings: raw.buildings as PlacedBuilding[],
      nextUid: raw.nextUid,
      pendingLandKt: raw.pendingLandKt,
      cumulativeKt: raw.cumulativeKt,
      co2: raw.co2,
      tempC: raw.tempC,
      multiplier: raw.multiplier,
      meters: raw.meters,
      history: raw.history as HistoryRecord[],
      initialBushTiles: raw.initialBushTiles,
      version: raw.version,
    };
    return state;
  } catch {
    return null;
  }
}

export function saveToStorage(storage: StorageLike, state: GameState): boolean {
  try {
    storage.setItem(SAVE_KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

/** Loads a save; a missing/corrupt/old save falls back to a fresh game. */
export function loadFromStorage(
  storage: StorageLike | null | undefined,
  fallbackScenario: ScenarioId = 'coal-coast',
  seed?: number,
): GameState {
  try {
    const loaded = deserialize(storage ? storage.getItem(SAVE_KEY) : null);
    if (loaded) return loaded;
  } catch {
    /* fall through */
  }
  return createGame(fallbackScenario, seed);
}

export function clearSave(storage: StorageLike): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
