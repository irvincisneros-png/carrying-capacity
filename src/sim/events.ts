import { EVENT_TEXT } from '../content/act2';
import { BUILDINGS } from './buildings';
import { estuaryPollution, hasReef } from './metrics';
import { MECH_EVENTS } from './mechanics/events';
import { burnFrom, stageFromHealth } from './restoration';
import type { RestoreCtx } from './restoration';
import { seasonRng } from './season';
import { getScenario } from './scenarios';
import { SEASON_NAMES, TileKind } from './types';
import type { EventType, GameState, GridReport, ScenarioId, Season, SimEvent } from './types';
import type { Rng } from './rng';

export const EVENT_LOG_CAP = 800;
/** Share of the normal coral loss that remains after acting on a satellite warning. */
export const MITIGATED_LOSS = 0.45;
export const EVENT_QUEUE_CAP = 200;

export interface EventCtx {
  state: GameState;
  idx: number;
  season: Season;
  /** Current warming above pre-industrial (C). */
  warming: number;
  /** Scenario event frequency / severity multiplier. */
  mult: number;
  grid: GridReport | null;
  rctx: RestoreCtx;
}

export interface FiredEvent {
  severity: number;
  text: string;
  at?: { x: number; y: number };
  data?: Record<string, number>;
}

export interface EventDef {
  type: EventType;
  name: string;
  /** pre-grid events change demand / supply for the season; post-grid events react to its result. */
  stage: 'pre' | 'post';
  chance(c: EventCtx): number;
  fire(c: EventCtx, rng: Rng): FiredEvent | null;
  /** Only these scenarios roll this event (default: all). */
  scenarios?: readonly ScenarioId[];
  /** These scenarios never roll it (they have their own version). */
  excludeScenarios?: readonly ScenarioId[];
}

/** Does this event apply to the scenario at all? */
export function eventApplies(def: EventDef, scenario: ScenarioId): boolean {
  if (def.scenarios && !def.scenarios.includes(scenario)) return false;
  if (def.excludeScenarios && def.excludeScenarios.includes(scenario)) return false;
  return true;
}

/** Scenario multiplier on one event type's chance (Act2Def.eventMult), 1 by default. */
export function eventTypeMult(state: GameState, type: EventType): number {
  return getScenario(state.scenarioId).act2.eventMult?.[type] ?? 1;
}

const warm = (k: number, t: number): number => 1 + k * Math.max(0, t);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export const isActive = (state: GameState, type: EventType, idx: number): boolean =>
  state.a2.active.some((e) => e.type === type && e.endsAt > idx);

function flammableTiles(state: GameState): number[] {
  const g = state.grid;
  const out: number[] = [];
  for (let i = 0; i < g.kind.length; i++) {
    const k = g.kind[i];
    if ((k === TileKind.Land || k === TileKind.Bush) && (g.building[i] ?? 0) === 0 && (g.stage[i] ?? 0) >= 1) out.push(i);
  }
  return out;
}

const flagNum = (state: GameState, key: string): number => {
  const v = state.flags[key];
  return typeof v === 'number' ? v : v === true ? 1 : 0;
};

/** Bushfire ignition chance this season (exposed so the UI can show fire danger). */
export function fireDanger(c: EventCtx): number {
  const sc = getScenario(c.state.scenarioId);
  const base = [0.03, 0.003, 0, 0.01][c.season] ?? 0;
  const fuel = clamp(flammableTiles(c.state).filter((i) => (c.state.grid.stage[i] ?? 0) >= 2).length / 25, 0, 1);
  const dry = isActive(c.state, 'drought', c.idx) ? 2.5 : 1;
  const hot = isActive(c.state, 'heatwave', c.idx) ? 1.8 : 1;
  const burning = 1 - 0.6 * clamp(flagNum(c.state, 'culturalBurning'), 0, 1);
  const prep = 1 - 0.2 * clamp(flagNum(c.state, 'fire.prep'), 0, 1) - 0.1 * clamp(flagNum(c.state, 'fire.buyback'), 0, 1);
  return clamp(base * warm(1.1, c.warming) * c.mult * sc.act2.fireProneness * fuel * dry * hot * burning * prep, 0, 0.9);
}

const BASE_EVENTS: readonly EventDef[] = [
  {
    type: 'heatwave', name: 'Heatwave', stage: 'pre',
    chance: (c) => {
      if (isActive(c.state, 'heatwave', c.idx)) return 0;
      const base = [0.1, 0.005, 0, 0.03][c.season] ?? 0;
      return clamp(base * warm(0.9, c.warming) * c.mult, 0, 0.9);
    },
    fire: (c, rng) => {
      const sev = (0.5 + rng.next() * 0.8) * (0.7 + 0.3 * c.mult);
      c.state.a2.active.push({ type: 'heatwave', endsAt: c.idx + 1, severity: sev });
      c.state.a2.stress += 4 * sev;
      const peak = Math.round(38 + 4 * sev + 1.5 * c.warming);
      return { severity: sev, text: EVENT_TEXT.heatwave(sev, peak), data: { peakC: peak } };
    },
  },
  {
    type: 'drought', name: 'Drought', stage: 'pre',
    chance: (c) => {
      if (isActive(c.state, 'drought', c.idx)) return 0;
      const base = [0.012, 0.012, 0.012, 0.012][c.season] ?? 0;
      return clamp((base / getScenario(c.state.scenarioId).act2.rainfall) * warm(0.9, c.warming) * c.mult, 0, 0.9);
    },
    fire: (c, rng) => {
      const sev = (0.5 + rng.next() * 0.8) * (0.7 + 0.3 * c.mult);
      const seasons = Math.max(3, Math.round((4 + rng.next() * 6) * sev));
      c.state.a2.active.push({ type: 'drought', endsAt: c.idx + seasons, severity: sev });
      c.state.a2.stress += 2 * sev;
      return { severity: sev, text: EVENT_TEXT.drought(seasons), data: { seasons } };
    },
  },
  {
    type: 'blackout', name: 'Blackout', stage: 'post',
    chance: (c) => (c.grid && c.grid.blackout ? 1 : 0),
    fire: (c) => {
      const g = c.grid;
      if (!g) return null;
      const sev = clamp(g.unmetFrac * 5, 0.1, 1.5);
      c.state.a2.stress += clamp(g.unmetFrac * 120, 1, 40);
      const pct = Math.round(g.unmetFrac * 100);
      return { severity: sev, text: EVENT_TEXT.blackout(SEASON_NAMES[c.season] ?? 'summer', pct), data: { unmetPct: pct } };
    },
  },
  {
    type: 'bushfire', name: 'Bushfire', stage: 'post',
    chance: (c) => fireDanger(c),
    fire: (c, rng) => {
      const cand = flammableTiles(c.state);
      if (cand.length === 0) return null;
      const origin = cand[Math.floor(rng.next() * cand.length)] as number;
      const sev = (0.5 + rng.next() * 0.8) * (0.7 + 0.3 * c.mult);
      const dry = isActive(c.state, 'drought', c.idx) || isActive(c.state, 'heatwave', c.idx);
      const hot = (dry || sev > 0.9) && flagNum(c.state, 'culturalBurning') < 0.5;
      const max = Math.round((6 + 40 * sev) * (dry ? 1.3 : 1));
      const burnt = burnFrom(c.state, origin, max, hot, () => rng.next());
      const g = c.state.grid;
      // Count homes near the burnt ground.
      let homes = 0;
      const burntSet = new Set(burnt);
      for (const b of c.state.buildings) {
        if (BUILDINGS[b.type].housing <= 0) continue;
        let near = false;
        for (let y = b.y - 2; y <= b.y + b.h + 1 && !near; y++) {
          for (let x = b.x - 2; x <= b.x + b.w + 1; x++) {
            if (x >= 0 && y >= 0 && x < g.w && y < g.h && burntSet.has(y * g.w + x)) { near = true; break; }
          }
        }
        if (near) homes++;
      }
      for (const i of burnt) g.airPollution[i] = (g.airPollution[i] ?? 0) + 1.5;
      c.state.a2.stress += clamp(6 * sev * Math.min(2, burnt.length / 20) + homes * 2, 1, 30);
      return {
        severity: sev,
        text: EVENT_TEXT.bushfire(burnt.length, hot, homes),
        at: { x: origin % g.w, y: Math.floor(origin / g.w) },
        data: { tilesBurnt: burnt.length, hot: hot ? 1 : 0, homesThreatened: homes },
      };
    },
  },
  {
    type: 'flood', name: 'Flood / storm surge', stage: 'post', excludeScenarios: ['reef-island'],
    chance: (c) => {
      const base = [0.03, 0.04, 0.01, 0.01][c.season] ?? 0;
      return clamp(base * warm(0.6, c.warming) * c.mult, 0, 0.9);
    },
    fire: (c, rng) => {
      const sev = (0.5 + rng.next() * 0.8) * (0.7 + 0.3 * c.mult);
      const g = c.state.grid;
      const surge = rng.next() < 0.5;
      const damage = Math.min(c.state.budget, Math.round(15 + 45 * sev));
      c.state.budget -= damage;
      // Runoff pulse down the river and into the estuary, stronger where the soil is contaminated.
      for (let i = 0; i < g.kind.length; i++) {
        const k = g.kind[i];
        if (k === TileKind.River || k === TileKind.Estuary) {
          g.waterPollution[i] = (g.waterPollution[i] ?? 0) + 0.25 * sev + 0.12 * Math.min(4, g.soilContamination[i] ?? 0);
        }
        if ((k === TileKind.Beach || k === TileKind.Estuary) && (g.building[i] ?? 0) === 0) {
          g.health[i] = Math.max(0, (g.health[i] ?? 0) - 0.12 * sev);
          g.stage[i] = stageFromHealth(g.health[i] ?? 0);
        }
      }
      // Low-lying homes within 2 tiles of the sea / estuary can be lost in a severe event.
      let lost = 0;
      if (sev > 0.9 || surge && sev > 0.75) {
        const exposed = c.state.buildings.filter((b) => {
          if (BUILDINGS[b.type].housing <= 0) return false;
          for (let y = b.y - 2; y <= b.y + b.h + 1; y++) {
            for (let x = b.x - 2; x <= b.x + b.w + 1; x++) {
              if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
              const k = g.kind[y * g.w + x];
              if ((k === TileKind.Sea || k === TileKind.Estuary || k === TileKind.Reef) && (g.elevation[b.y * g.w + b.x] ?? 9) <= 1) return true;
            }
          }
          return false;
        });
        const victim = exposed.length > 0 ? exposed[Math.floor(rng.next() * exposed.length)] : undefined;
        if (victim) {
          for (let y = victim.y; y < victim.y + victim.h; y++) for (let x = victim.x; x < victim.x + victim.w; x++) g.building[y * g.w + x] = 0;
          c.state.buildings = c.state.buildings.filter((b) => b.uid !== victim.uid);
          lost = 1;
        }
      }
      c.state.a2.stress += clamp(6 * sev + 6 * lost, 1, 30);
      return { severity: sev, text: EVENT_TEXT.flood(surge, damage, lost), data: { damage, homesLost: lost, surge: surge ? 1 : 0 } };
    },
  },
  {
    type: 'marine-heatwave', name: 'Marine heatwave', stage: 'post',
    chance: (c) => {
      const w = c.state.satellites.warning;
      if (w && w.arrivesAt === c.idx) return 1;
      if (w && w.arrivesAt > c.idx) return 0;
      if (!hasReef(c.state) || c.state.tempC < 0.5) return 0;
      const base = [0.04, 0.01, 0, 0][c.season] ?? 0;
      return clamp(base * warm(1.6, c.warming) * c.mult, 0, 0.9);
    },
    fire: (c, rng) => {
      const sat = c.state.satellites;
      const due = sat.warning !== null && sat.warning.arrivesAt === c.idx;
      const rolled = (0.5 + rng.next() * 0.8) * (0.7 + 0.3 * c.mult);
      if (!due && sat.overlays.sst) {
        // Satellites see the hot water coming: warn one season ahead, and let the player act.
        sat.warning = { arrivesAt: c.idx + 1, severity: rolled, warnedYear: c.state.year, mitigated: false };
        sat.warningsGiven++;
        emit(c.state, {
          type: 'story', year: c.state.year, season: c.season, seasonIndex: c.idx, severity: 0.8,
          text: EVENT_TEXT.marineWarning(),
          story: { channel: 'satellite', ref: 'marine-heatwave-warning', tone: 'concern', warning: { kind: 'marine-heatwave', arrivesSeasonIndex: c.idx + 1 } },
        });
        return null;
      }
      const sev = due && sat.warning ? sat.warning.severity : rolled;
      const mitigated = due && sat.warning?.mitigated === true;
      if (due) sat.warning = null;
      const g = c.state.grid;
      const heat = clamp(c.state.tempC / 1.2, 0.3, 1.6);
      let before = 0, after = 0, n = 0;
      for (let i = 0; i < g.kind.length; i++) {
        if (g.kind[i] !== TileKind.Reef) continue;
        const dirt = 1 + 0.15 * Math.min(4, g.waterPollution[i] ?? 0);
        const loss = clamp(0.12 * sev * heat * dirt, 0, 0.6) * (mitigated ? MITIGATED_LOSS : 1);
        before += g.health[i] ?? 0;
        g.health[i] = (g.health[i] ?? 0) * (1 - loss);
        g.stage[i] = stageFromHealth(g.health[i] ?? 0);
        after += g.health[i] ?? 0;
        n++;
      }
      const pct = before > 0 ? Math.round((1 - after / before) * 100) : 0;
      if (mitigated) sat.savedPct += Math.round((pct * (1 - MITIGATED_LOSS)) / MITIGATED_LOSS);
      c.state.a2.stress += clamp(pct / 4, 1, 15);
      return {
        severity: sev,
        text: EVENT_TEXT.marineHeatwave(pct) + (mitigated ? ' Acting on the satellite warning saved a lot of coral.' : ''),
        data: { reefTiles: n, healthLostPct: pct, warned: due ? 1 : 0, mitigated: mitigated ? 1 : 0 },
      };
    },
  },
  {
    type: 'fish-kill', name: 'Fish kill', stage: 'post',
    chance: (c) => {
      const last = c.state.a2.lastEventIdx['fish-kill'];
      if (last !== undefined && c.idx - last < 4) return 0;
      const idx = fishKillIndex(c);
      return idx >= FISH_KILL_THRESHOLD ? clamp(0.4 + (idx - FISH_KILL_THRESHOLD) * 0.5, 0, 0.9) * Math.min(1.5, c.mult) * (1 - 0.4 * clamp(flagNum(c.state, 'fishingProtocol'), 0, 1)) : 0;
    },
    fire: (c) => {
      const g = c.state.grid;
      let tiles = 0;
      for (let i = 0; i < g.kind.length; i++) {
        if (g.kind[i] === TileKind.Estuary || g.kind[i] === TileKind.River) {
          g.health[i] = Math.max(0, (g.health[i] ?? 0) - 0.15);
          g.stage[i] = stageFromHealth(g.health[i] ?? 0);
          tiles++;
        }
      }
      c.state.a2.stress += 8;
      return { severity: clamp(fishKillIndex(c) / FISH_KILL_THRESHOLD, 0.5, 1.5), text: EVENT_TEXT.fishKill(tiles), data: { tiles } };
    },
  },
];

export const EVENTS: readonly EventDef[] = [...BASE_EVENTS, ...MECH_EVENTS];

/** Estuary pollution times a heat factor: summer, heatwaves and a warmer world all raise it. */
export const FISH_KILL_THRESHOLD = 1.2;
export function fishKillIndex(c: EventCtx): number {
  const seasonal = [1, 0.35, 0.1, 0.6][c.season] ?? 0.35;
  const heat = seasonal + (isActive(c.state, 'heatwave', c.idx) ? 0.4 : 0) + 0.2 * Math.max(0, c.warming);
  return estuaryPollution(c.state) * (0.6 + 0.4 * heat) * (1 + 0.2 * Math.max(0, c.warming - 1));
}

export function makeCtx(state: GameState, idx: number, grid: GridReport | null, rctx: RestoreCtx): EventCtx {
  return {
    state, idx, season: state.a2.season, warming: state.tempC,
    mult: getScenario(state.scenarioId).modifiers.eventSeverity, grid, rctx,
  };
}

/** Probability of each event type in the current season (no rolls, no side effects). For hazard HUDs and tests. */
export function eventChances(state: GameState, grid: GridReport | null = state.a2.lastGrid): { type: EventType; p: number }[] {
  const idx = (state.year - getScenario(state.scenarioId).startYear) * 4 + state.a2.season;
  const rctx: RestoreCtx = { shallow: new Uint8Array(0), nearWater: new Uint8Array(0), nursery: new Uint8Array(0) };
  const c = makeCtx(state, idx, grid, rctx);
  return EVENTS.filter((e) => eventApplies(e, state.scenarioId)).map((e) => ({ type: e.type, p: Math.min(1, e.chance(c) * eventTypeMult(state, e.type)) }));
}

export function emit(state: GameState, e: Omit<SimEvent, 'id'>): SimEvent {
  const ev: SimEvent = { ...e, id: state.a2.nextEventId++ };
  state.eventLog.push(ev);
  state.events.push(ev);
  if (state.eventLog.length > EVENT_LOG_CAP) state.eventLog.splice(0, state.eventLog.length - EVENT_LOG_CAP);
  if (state.events.length > EVENT_QUEUE_CAP) state.events.splice(0, state.events.length - EVENT_QUEUE_CAP);
  return ev;
}

/** Rolls every event of one stage for the season. Deterministic: each event has its own stream per season. */
export function rollEvents(c: EventCtx, stage: 'pre' | 'post'): SimEvent[] {
  const out: SimEvent[] = [];
  EVENTS.forEach((def, di) => {
    if (def.stage !== stage || !eventApplies(def, c.state.scenarioId)) return;
    const rng = seasonRng(c.state.seed, c.idx, 100 + di);
    const roll = rng.next();
    if (roll >= def.chance(c) * eventTypeMult(c.state, def.type)) return;
    const fired = def.fire(c, rng);
    if (!fired) return;
    c.state.a2.lastEventIdx[def.type] = c.idx;
    out.push(emit(c.state, {
      type: def.type, year: c.state.year, season: c.season, seasonIndex: c.idx,
      severity: fired.severity, text: fired.text, at: fired.at, data: fired.data,
    }));
  });
  return out;
}

/** Hand the unconsumed events to the caller and clear the queue (returns a new state). */
export function consumeEvents(state: GameState): { state: GameState; events: SimEvent[] } {
  const events = state.events;
  return { state: { ...state, events: [] }, events };
}
