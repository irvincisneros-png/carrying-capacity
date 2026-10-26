import { isBuildingId } from './buildings';
import { SAVE_VERSION, createGame } from './game';
import { isScenarioId } from './scenarios';
import { getScenario } from './scenarios';
import { EMISSION_CATEGORIES } from './types';
import { chunkCount, markSignificant } from './terrain';
import { enterTurningPoint } from './act2';
import { emptyAct2 } from './state';
import { emptyLayers, reconcileLayers } from './layers';
import { initCircular } from './circular';
import { initWildlife } from './wildlife';
import { ensureEntrance } from './roads';
import type {
  Act2State, GameState, GameStatus, HistoryRecord, Meters, Phase, PlacedBuilding, ScenarioId, SimEvent, TileGrid,
  TurningPoint,
} from './types';

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
  health: number[];
  stage: number[];
  weed: number[];
  chunkVersion: number[];
  significant: number[];
  zone?: number[];
  zoning?: number[];
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
    health: Array.from(g.health),
    stage: Array.from(g.stage),
    weed: Array.from(g.weed),
    chunkVersion: Array.from(g.chunkVersion),
    significant: Array.from(g.significant),
    zone: Array.from(g.zone),
    zoning: Array.from(g.zoning),
  };
  const out: SerialState = { ...state, grid };
  return JSON.stringify(out);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const finArr = (v: unknown, n: number): v is number[] => Array.isArray(v) && v.length === n && v.every(fin);
const meters = (v: unknown): v is Meters =>
  isObj(v) && fin(v.economy) && fin(v.society) && fin(v.environment);
const PHASES: readonly string[] = ['act1', 'turning-point', 'act2', 'epilogue', 'failed'];
const STATUSES: readonly string[] = ['playing', 'act1-complete', 'act2-complete', 'failed'];

function validEvent(e: unknown): boolean {
  return (
    isObj(e) && fin(e.id) && fin(e.year) && fin(e.season) && fin(e.seasonIndex) && fin(e.severity) &&
    typeof e.text === 'string' && typeof e.type === 'string'
  );
}

const recNums = (v: unknown): boolean => isObj(v) && Object.values(v).every(fin);
const strArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Light structural checks on the v3 layer state; anything off rejects the save. */
function validLayers(r: Record<string, unknown>): boolean {
  const res = r.residents, dil = r.dilemmas, wl = r.wildlife, co = r.country, ci = r.circular, sa = r.satellites;
  if (!isObj(res) || !isObj(res.list) || !recNums(res.fired) || !isObj(res.choices) || !strArr(res.pending)) return false;
  if (!recNums(res.actions) || !fin(res.nudge) || !fin(res.applied) || !recNums(res.peaks) || !Array.isArray(res.history)) return false;
  if (!Object.values(res.list).every((m) => isObj(m) && fin(m.mood) && fin(m.trend) && fin(m.lastBeatYear))) return false;
  if (!isObj(dil) || !recNums(dil.offered) || !strArr(dil.pending) || !Array.isArray(dil.decisions) || !fin(dil.adjust)) return false;
  if (!isObj(wl) || !isObj(wl.species) || typeof wl.initialised !== 'boolean' || !fin(wl.lastYear) || !fin(wl.roadKills)) return false;
  if (!Object.values(wl.species).every((x) => isObj(x) && fin(x.pop) && fin(x.peak) && fin(x.startPop) && isObj(x.families) && Array.isArray(x.history))) return false;
  if (!isObj(co) || !fin(co.partnership) || !Array.isArray(co.consulted) || !Array.isArray(co.disturbed) || !Array.isArray(co.comanaged)) return false;
  if (!Array.isArray(co.burns) || !Array.isArray(co.boosts) || !isObj(co.unlocked) || !Array.isArray(co.log) || !fin(co.lastGrowthYear)) return false;
  if (!isObj(ci) || !Array.isArray(ci.items) || typeof ci.unlocked !== 'boolean' || !strArr(ci.research) || !fin(ci.returnedBudget) || !fin(ci.disposalKt)) return false;
  if (!ci.items.every((it) => isObj(it) && typeof it.type === 'string' && isBuildingId(it.type) && fin(it.uid) && fin(it.x) && fin(it.y) && fin(it.w) && fin(it.h) && typeof it.status === 'string')) return false;
  if (!isObj(sa) || !isObj(sa.overlays) || !fin(sa.warningsGiven) || !fin(sa.mitigations) || !fin(sa.savedPct)) return false;
  return true;
}

function validA2(a: unknown): a is Act2State {
  if (!isObj(a)) return false;
  const nums = ['startYear', 'season', 'clockMicro', 'eqTempC', 'storageLevel', 'stress', 'stressSum', 'yearUnmetSum', 'yearSeasons', 'lastUnmetFrac', 'societyAdjust', 'nextEventId'];
  if (!nums.every((k) => fin(a[k]))) return false;
  if (![0, 1, 2, 3].includes(a.season as number)) return false;
  if (!isObj(a.yearEm) || !EMISSION_CATEGORIES.every((c) => fin((a.yearEm as Record<string, unknown>)[c]))) return false;
  if (!meters(a.zeroYears)) return false;
  if (!Array.isArray(a.active) || !a.active.every((e) => isObj(e) && typeof e.type === 'string' && fin(e.endsAt) && fin(e.severity))) return false;
  if (!isObj(a.lastEventIdx) || !Object.values(a.lastEventIdx).every(fin)) return false;
  if (!isObj(a.utilisation) || !Object.values(a.utilisation).every(fin)) return false;
  if (!Array.isArray(a.activeRemediation) || !a.activeRemediation.every(fin)) return false;
  if (!Array.isArray(a.yearly) || !a.yearly.every((y) => isObj(y) && fin(y.year) && fin(y.tempC) && fin(y.co2) && meters(y.meters))) return false;
  if (a.lastGrid !== null && !(isObj(a.lastGrid) && fin(a.lastGrid.unmetFrac) && fin(a.lastGrid.seasonIndex))) return false;
  if (a.outcome !== null && !(isObj(a.outcome) && typeof a.outcome.success === 'boolean' && Array.isArray(a.outcome.objectives))) return false;
  if (a.failure !== null && !(isObj(a.failure) && typeof a.failure.text === 'string' && fin(a.failure.year))) return false;
  return true;
}

/**
 * Returns null for anything that is not a valid save. Version 1 saves (Act 1 only) are migrated: the new Act 2
 * layers start empty, a finished Act 1 becomes the turning point.
 */
export function deserialize(text: string | null): GameState | null {
  if (!text) return null;
  try {
    const raw: unknown = JSON.parse(text);
    if (!isObj(raw)) return null;
    const ver = raw.saveVersion;
    if (ver !== 1 && ver !== 2 && ver !== 3 && ver !== SAVE_VERSION) return null;
    if (typeof raw.scenarioId !== 'string' || !isScenarioId(raw.scenarioId)) return null;
    const scenarioId: ScenarioId = raw.scenarioId;
    const sc = getScenario(scenarioId);
    const g = raw.grid;
    // A save keeps the map size it was made with (the scenarios have been enlarged since version 3 saves were written).
    if (!isObj(g) || !Number.isInteger(g.w) || !Number.isInteger(g.h)) return null;
    const mapW = g.w as number, mapH = g.h as number;
    if (mapW < 8 || mapH < 8 || mapW > 128 || mapH > 128) return null;
    const n = mapW * mapH;
    if (!finArr(g.kind, n) || !finArr(g.elevation, n) || !finArr(g.building, n)) return null;
    if (!finArr(g.airPollution, n) || !finArr(g.waterPollution, n) || !finArr(g.soilContamination, n)) return null;
    const nChunks = chunkCount(mapW, mapH);
    if (ver >= 2) {
      if (!finArr(g.health, n) || !finArr(g.stage, n) || !finArr(g.weed, n) || !finArr(g.chunkVersion, nChunks)) return null;
    }
    if (ver >= 3 && !finArr(g.significant, n)) return null;
    if (g.zone !== undefined && !finArr(g.zone, n)) return null;
    if (g.zoning !== undefined && (!finArr(g.zoning, n) || g.zoning.some((z) => !Number.isInteger(z) || z < 0 || z > 5))) return null;
    if (g.kind.some((k) => !Number.isInteger(k) || k < 0 || k > 9)) return null;
    if (!fin(raw.seed) || !fin(raw.year) || !fin(raw.budget) || !fin(raw.population) || !fin(raw.lastIncome)) return null;
    if (!fin(raw.nextUid) || !fin(raw.pendingLandKt) || !fin(raw.cumulativeKt) || !fin(raw.co2) || !fin(raw.tempC)) return null;
    if (!fin(raw.multiplier) || !fin(raw.initialBushTiles) || !fin(raw.version)) return null;
    if (typeof raw.status !== 'string' || !STATUSES.includes(raw.status)) return null;
    if (!meters(raw.meters)) return null;

    let phase: Phase;
    if (ver === 1) {
      if (raw.status !== 'playing' && raw.status !== 'act1-complete') return null;
      phase = raw.status === 'act1-complete' ? 'turning-point' : 'act1';
    } else {
      if (typeof raw.phase !== 'string' || !PHASES.includes(raw.phase)) return null;
      phase = raw.phase as Phase;
    }
    const act1Phase = phase === 'act1' || phase === 'turning-point';
    if (raw.year < sc.startYear) return null;
    if (act1Phase) {
      if (raw.year > sc.endYear || (raw.year - sc.startYear) % 10 !== 0) return null;
    } else if (raw.year < sc.endYear || raw.year > sc.act2.endYear) {
      return null;
    }
    if (!Array.isArray(raw.buildings) || !Array.isArray(raw.history)) return null;
    if (raw.history.length !== (Math.min(raw.year, sc.endYear) - sc.startYear) / 10 + 1) return null;

    const uids = new Set<number>();
    for (const b of raw.buildings as unknown[]) {
      if (!isObj(b) || typeof b.type !== 'string' || !isBuildingId(b.type)) return null;
      if (!fin(b.uid) || !fin(b.x) || !fin(b.y) || !fin(b.w) || !fin(b.h) || !fin(b.builtYear)) return null;
      if (![0, 1, 2, 3].includes(b.rotation as number)) return null;
      if (uids.has(b.uid) || b.uid < 1 || b.uid > 65535) return null;
      if (b.x < 0 || b.y < 0 || b.x + b.w > mapW || b.y + b.h > mapH) return null;
      uids.add(b.uid);
    }
    for (const u of g.building) if (u !== 0 && !uids.has(u)) return null;
    for (const h of raw.history as unknown[]) {
      if (!isObj(h) || !fin(h.year) || !fin(h.co2) || !fin(h.realCo2) || !fin(h.tempC) || !fin(h.realTempC)) return null;
      if (!fin(h.multiplier) || !fin(h.totalKt) || !fin(h.population) || !fin(h.budget) || !meters(h.meters)) return null;
      if (!isObj(h.emissionsKt) || !EMISSION_CATEGORIES.every((c) => fin((h.emissionsKt as Record<string, unknown>)[c]))) return null;
    }

    const grid: TileGrid = {
      w: mapW,
      h: mapH,
      kind: Uint8Array.from(g.kind),
      elevation: Uint8Array.from(g.elevation),
      building: Uint16Array.from(g.building),
      airPollution: Float32Array.from(g.airPollution),
      waterPollution: Float32Array.from(g.waterPollution),
      soilContamination: Float32Array.from(g.soilContamination),
      health: ver >= 2 ? Float32Array.from(g.health as number[]) : new Float32Array(n),
      stage: ver >= 2 ? Uint8Array.from(g.stage as number[]) : new Uint8Array(n),
      weed: ver >= 2 ? Uint8Array.from(g.weed as number[]) : new Uint8Array(n),
      chunkVersion: ver >= 2 ? Uint32Array.from(g.chunkVersion as number[]) : new Uint32Array(nChunks),
      significant: ver >= 3 ? Uint8Array.from(g.significant as number[]) : new Uint8Array(n),
      zone: g.zone !== undefined ? Uint8Array.from(g.zone as number[]) : new Uint8Array(n),
      // Saves from before zoning have no zones.
      zoning: g.zoning !== undefined ? Uint8Array.from(g.zoning as number[]) : new Uint8Array(n),
    };
    if (ver < 3) markSignificant(grid);

    let a2: Act2State = emptyAct2(sc.act2.startYear, raw.tempC);
    let flags: Record<string, boolean | number> = {};
    let events: SimEvent[] = [];
    let eventLog: SimEvent[] = [];
    let turningPoint: TurningPoint | null = null;
    if (ver >= 2) {
      if (!validA2(raw.a2)) return null;
      a2 = raw.a2;
      if (!isObj(raw.flags) || !Object.values(raw.flags).every((v) => typeof v === 'boolean' || fin(v))) return null;
      flags = raw.flags as Record<string, boolean | number>;
      if (!Array.isArray(raw.events) || !raw.events.every(validEvent)) return null;
      if (!Array.isArray(raw.eventLog) || !raw.eventLog.every(validEvent)) return null;
      events = raw.events as SimEvent[];
      eventLog = raw.eventLog as SimEvent[];
      if (raw.turningPoint !== null) {
        const t = raw.turningPoint;
        if (!isObj(t) || typeof t.title !== 'string' || typeof t.text !== 'string' || !isObj(t.stats)) return null;
      }
      turningPoint = raw.turningPoint as TurningPoint | null;
      if (phase !== 'act1' && turningPoint === null) return null;
    }
    const state: GameState = {
      saveVersion: SAVE_VERSION,
      scenarioId,
      seed: raw.seed,
      year: raw.year,
      status: raw.status as GameStatus,
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
      phase,
      a2,
      flags,
      events,
      eventLog,
      turningPoint,
      ...emptyLayers(scenarioId),
    };
    if (ver >= 3) {
      if (!validLayers(raw)) return null;
      state.residents = raw.residents as GameState['residents'];
      state.dilemmas = raw.dilemmas as GameState['dilemmas'];
      state.wildlife = raw.wildlife as GameState['wildlife'];
      state.country = raw.country as GameState['country'];
      state.circular = raw.circular as GameState['circular'];
      state.satellites = raw.satellites as GameState['satellites'];
    }
    if (isObj(raw.learn) && Array.isArray(raw.learn.kit) && Array.isArray(raw.learn.predictions) && isObj(raw.learn.reflections) && Array.isArray(raw.learn.household) && Array.isArray(raw.learn.terms)) {
      state.learn = { ...(raw.learn as unknown as NonNullable<GameState['learn']>), lastTest: fin(raw.learn.lastTest) ? raw.learn.lastTest : -1, letter: typeof raw.learn.letter === 'string' ? raw.learn.letter : '' };
    }
    if (ver === 1 && phase === 'turning-point') enterTurningPoint(state);
    if (ver < 3 && (phase === 'act2' || phase === 'epilogue' || phase === 'failed')) {
      // Migrating a game that is already in Act 2: legacy sites are the buildings from before the transition.
      initCircular(state, (b) => b.builtYear <= sc.endYear);
      initWildlife(state);
    }
    reconcileLayers(state);
    // Saves from before roads mattered have no entrance: give the town one (its buildings then need to connect to it).
    ensureEntrance(state);
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
