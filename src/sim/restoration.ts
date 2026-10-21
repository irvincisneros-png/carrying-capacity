import { STAGE_NAMES } from '../content/act2';
import { BUILDINGS } from './buildings';
import { reefHealth } from './climate';
import { SOIL_OK, SOIL_TOXIC, WATER_OK, WATER_TOXIC } from './pollution';
import { seasonRng, seasonWeather } from './season';
import { getScenario } from './scenarios';
import { dilate } from './grid';
import { chunkCount, chunkOf } from './terrain';
import { TileKind } from './types';
import type { GameState, Season, TileGrid } from './types';

export const STAGE_BARE = 0;
export const STAGE_PIONEER = 1;
export const STAGE_SHRUB = 2;
export const STAGE_WOODLAND = 3;

/** Health thresholds between stages. */
export const STAGE_AT = [0.12, 0.38, 0.66] as const;
/** Health below which a tile has no plants yet and needs a seed source. */
export const SEED_HEALTH = STAGE_AT[0];
/** Weeds cap a tile at the top of the pioneer stage. */
export const WEED_CAP = STAGE_AT[1] - 0.01;

export const GROWTH = {
  /** Health gained per season while seeding a bare tile with a full seed source. */
  seedRate: 0.04,
  /** Health gained per season once established (before stage / water / volunteer multipliers). */
  baseRate: 0.01,
  stageMult: [1, 1.2, 1, 0.5] as const,
  /** Seasonal rainfall index: summer, autumn, winter, spring. */
  rain: [0.85, 0.95, 1.0, 0.85] as const,
  droughtRain: 0.35,
  heatwaveGrowth: 0.85,
  weedGrowth: 0.3,
  /** Per-season invasion chance per weedy neighbour / for bare ground touching a building, at weedPressure 1. */
  weedSpread: 0.015,
  weedEdge: 0.01,
  dieback: 0.025,
  /** Natural spread: seed factor = base + perNeighbour * n for n healthy 4-neighbours. */
  naturalBase: 0.25,
  naturalPerNeighbour: 0.08,
  /** A neighbour must be at least this healthy to shed seed. */
  seedHealth: 0.4,
};

export const stageFromHealth = (h: number): number =>
  h < STAGE_AT[0] ? STAGE_BARE : h < STAGE_AT[1] ? STAGE_PIONEER : h < STAGE_AT[2] ? STAGE_SHRUB : STAGE_WOODLAND;

type Family = 'land' | 'estuary' | 'sea' | 'none';
const familyOf = (kind: number): Family =>
  kind === TileKind.Land || kind === TileKind.Bush || kind === TileKind.Beach
    ? 'land'
    : kind === TileKind.Estuary
      ? 'estuary'
      : kind === TileKind.Sea
        ? 'sea'
        : 'none';

/** Per-tick precomputed helpers (terrain kinds never change except Bush/Land, which are equivalent here). */
export interface RestoreCtx {
  /** 1 where open sea is shallow enough for seagrass (land / beach / estuary within 2 tiles). */
  shallow: Uint8Array;
  /** 1 within 3 tiles of river, estuary, sea. */
  nearWater: Uint8Array;
  /** 1 within a nursery's radius. */
  nursery: Uint8Array;
}

export function buildRestoreCtx(state: GameState): RestoreCtx {
  const g = state.grid;
  const n = g.w * g.h;
  const shallow = new Uint8Array(n);
  const nearWater = new Uint8Array(n);
  const nursery = new Uint8Array(n);
  // "Within 3 tiles of water" and "within 2 tiles of land" are square neighbourhoods, so two O(tiles) dilations replace the
  // 7x7 scan per tile this used to do every season.
  const waterMask = new Uint8Array(n);
  const landMask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const kk = g.kind[i];
    if (kk === TileKind.River || kk === TileKind.Estuary || kk === TileKind.Sea || kk === TileKind.Reef) waterMask[i] = 1;
    if (kk === TileKind.Land || kk === TileKind.Bush || kk === TileKind.Beach || kk === TileKind.Estuary) landMask[i] = 1;
  }
  nearWater.set(dilate(waterMask, g.w, g.h, 3));
  const landNear = dilate(landMask, g.w, g.h, 2);
  for (let i = 0; i < n; i++) if (g.kind[i] === TileKind.Sea && landNear[i] === 1) shallow[i] = 1;
  for (const b of state.buildings) {
    const r = BUILDINGS[b.type].nursery?.radius;
    if (r === undefined) continue;
    for (let y = Math.max(0, b.y - r); y <= Math.min(g.h - 1, b.y + b.h - 1 + r); y++) {
      const dy = Math.max(b.y - y, y - (b.y + b.h - 1), 0);
      for (let x = Math.max(0, b.x - r); x <= Math.min(g.w - 1, b.x + b.w - 1 + r); x++) {
        const dx = Math.max(b.x - x, x - (b.x + b.w - 1), 0);
        if (Math.hypot(dx, dy) <= r) nursery[y * g.w + x] = 1;
      }
    }
  }
  return { shallow, nearWater, nursery };
}

/** Whether a tile can host plants (kind is restorable, nothing built on it). */
export function isRestorable(g: TileGrid, i: number, ctx: RestoreCtx): boolean {
  if ((g.building[i] ?? 0) !== 0) return false;
  const k = g.kind[i] ?? 0;
  if (k === TileKind.Sea) return ctx.shallow[i] === 1;
  return familyOf(k) !== 'none';
}

/** Fill health / stage when Act 2 begins, from what Act 1 left behind. */
export function initRestoration(state: GameState): void {
  const g = state.grid;
  const ctx = buildRestoreCtx(state);
  for (let i = 0; i < g.kind.length; i++) {
    const k = g.kind[i];
    let h = 0;
    if ((g.building[i] ?? 0) === 0) {
      if (k === TileKind.Bush) h = 0.95;
      else if (k === TileKind.Beach) h = 0.35;
      else if (k === TileKind.Estuary) h = Math.max(0, 0.7 - 0.2 * (g.waterPollution[i] ?? 0));
      else if (k === TileKind.Sea && ctx.shallow[i] === 1) h = Math.max(0, 0.75 - 0.25 * (g.waterPollution[i] ?? 0));
      else if (k === TileKind.Reef) h = reefHealth(state.tempC, g.waterPollution[i] ?? 0);
    }
    g.health[i] = h;
    g.stage[i] = stageFromHealth(h);
    g.weed[i] = 0;
  }
}

export interface SuccessionStats {
  promoted: number;
}

const N4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** Active-event helper without importing events.ts (avoids a cycle). */
const isActive = (state: GameState, type: string, idx: number): boolean =>
  state.a2.active.some((e) => e.type === type && e.endsAt > idx);

/** One season of growth, spread, die-back and weed invasion. Mutates `state.grid`. */
export function stepSuccession(state: GameState, ctx: RestoreCtx, seasonIndex: number, season: Season): void {
  const g = state.grid;
  const sc = getScenario(state.scenarioId);
  const w = seasonWeather(state.seed, seasonIndex);
  const drought = isActive(state, 'drought', seasonIndex);
  const heat = isActive(state, 'heatwave', seasonIndex);
  const society = state.meters.society;
  const vol = society > 60 ? 1 + Math.min(1, (society - 60) / 40) * 0.4 : 1;
  const rain =
    GROWTH.rain[season] * sc.act2.rainfall * (0.5 + 0.5 * w.rain) * (drought ? GROWTH.droughtRain : 1) *
    (heat ? GROWTH.heatwaveGrowth : 1);
  const prevHealth = g.health.slice();
  const prevWeed = g.weed.slice();
  const rng = seasonRng(state.seed, seasonIndex, 777);

  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x;
      const kind = g.kind[i] ?? 0;
      if (kind === TileKind.Reef) continue;
      if (!isRestorable(g, i, ctx)) {
        // Built-over tiles hold nothing.
        if ((g.building[i] ?? 0) !== 0) {
          g.health[i] = 0;
          g.stage[i] = 0;
          g.weed[i] = 0;
        }
        continue;
      }
      const fam = familyOf(kind);
      const contaminant = fam === 'land' ? (g.soilContamination[i] ?? 0) : (g.waterPollution[i] ?? 0);
      const okTh = fam === 'land' ? SOIL_OK : WATER_OK;
      const toxicTh = fam === 'land' ? SOIL_TOXIC : WATER_TOXIC;
      let h = prevHealth[i] ?? 0;
      const weedy = (prevWeed[i] ?? 0) === 1;

      if (contaminant > toxicTh) {
        h = Math.max(0, h - GROWTH.dieback * Math.min(2, contaminant / toxicTh));
      } else if (contaminant <= okTh) {
        let rate: number;
        if (h < SEED_HEALTH) {
          let seed = 0;
          if (ctx.nursery[i] === 1) seed = 1;
          else {
            let n = 0;
            for (const [dx, dy] of N4) {
              const xx = x + dx, yy = y + dy;
              if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
              const j = yy * g.w + xx;
              if ((g.building[j] ?? 0) !== 0) continue;
              if (familyOf(g.kind[j] ?? 0) !== fam && !(fam === 'estuary' && g.kind[j] === TileKind.Sea)) continue;
              if ((prevHealth[j] ?? 0) >= GROWTH.seedHealth) n++;
            }
            if (n > 0) seed = GROWTH.naturalBase + GROWTH.naturalPerNeighbour * n;
          }
          rate = GROWTH.seedRate * seed;
        } else {
          rate = GROWTH.baseRate * GROWTH.stageMult[stageFromHealth(h)] ;
        }
        if (fam === 'land') rate *= rain * (0.85 + 0.3 * (ctx.nearWater[i] ?? 0));
        rate *= vol;
        if (weedy) rate *= GROWTH.weedGrowth;
        h = Math.min(1, h + rate);
      }
      if (weedy && h > WEED_CAP) h = WEED_CAP;
      g.health[i] = h;
      const st = stageFromHealth(h);
      g.stage[i] = st;
      if (kind === TileKind.Land && st === STAGE_WOODLAND) g.kind[i] = TileKind.Bush;
      else if (kind === TileKind.Bush && st <= STAGE_PIONEER) g.kind[i] = TileKind.Land;

      // Weeds invade untended bare / pioneer land edges.
      if (g.kind[i] === TileKind.Land && st <= STAGE_PIONEER) {
        const roll = rng.next();
        const tended = ctx.nursery[i] === 1;
        if (weedy) {
          const clear = (tended ? 0.3 : 0) + (society > 60 ? 0.04 + 0.1 * (vol - 1) : 0);
          g.weed[i] = roll < clear ? 0 : 1;
        } else if (!tended && sc.act2.weedPressure > 0) {
          let wn = 0, bn = 0;
          for (const [dx, dy] of N8) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
            const j = yy * g.w + xx;
            if ((prevWeed[j] ?? 0) === 1) wn++;
            if ((g.building[j] ?? 0) !== 0) bn++;
          }
          const p = sc.act2.weedPressure * (GROWTH.weedSpread * wn + (bn > 0 ? GROWTH.weedEdge : 0));
          if (roll < p) g.weed[i] = 1;
        }
      } else {
        g.weed[i] = 0;
      }
    }
  }
}

/** Coral nurseries lift the health coral can reach on reef tiles within 4 tiles (up to `stack` nurseries' worth). */
function nurseryBoost(state: GameState, per: number, stack: number): Float32Array {
  const g = state.grid;
  const out = new Float32Array(g.kind.length);
  for (const b of state.buildings) {
    if (b.type !== 'coralnursery') continue;
    for (let y = Math.max(0, b.y - 4); y <= Math.min(g.h - 1, b.y + b.h + 3); y++) {
      for (let x = Math.max(0, b.x - 4); x <= Math.min(g.w - 1, b.x + b.w + 3); x++) {
        const i = y * g.w + x;
        out[i] = Math.min(per * stack, (out[i] ?? 0) + per);
      }
    }
  }
  return out;
}

/** Reef water pollution at which coral gets none of the clean-water heat tolerance. */
export const CLEAN_REEF_WATER = 0.6;

/** Reef: coral health relaxes towards what temperature and local water quality allow; losses are quicker than recovery. */
export function stepReef(state: GameState): void {
  const g = state.grid;
  const reef = getScenario(state.scenarioId).act2.reef;
  const boost = reef ? nurseryBoost(state, reef.nurseryBoost, reef.nurseryStack ?? 2) : null;
  for (let i = 0; i < g.kind.length; i++) {
    if (g.kind[i] !== TileKind.Reef) continue;
    const wp = g.waterPollution[i] ?? 0;
    const tol = (reef?.tolerance ?? 0) + (reef?.cleanWaterTolerance ?? 0) * Math.max(0, 1 - wp / CLEAN_REEF_WATER);
    const target = Math.min(1, reefHealth(state.tempC, wp, tol) + (boost ? (boost[i] ?? 0) : 0));
    const h = g.health[i] ?? 0;
    const nh = h > target ? h - Math.min(h - target, 0.015) : h + Math.min(target - h, 0.02);
    g.health[i] = nh;
    g.stage[i] = stageFromHealth(nh);
  }
}

/**
 * Fire: burns `maxTiles` flammable tiles spreading from `origin`. Hot fires reset the stage to bare; cool fires knock
 * vegetation back by about a stage. Weeds burn. Returns the burnt tile indices.
 */
export function burnFrom(
  state: GameState, origin: number, maxTiles: number, hot: boolean, next: () => number,
): number[] {
  const g = state.grid;
  const burnt: number[] = [];
  const seen = new Set<number>([origin]);
  const queue = [origin];
  const spread = hot ? 0.8 : 0.55;
  for (let qi = 0; qi < queue.length && burnt.length < maxTiles; qi++) {
    const i = queue[qi] as number;
    const kind = g.kind[i];
    const flammable = (kind === TileKind.Land || kind === TileKind.Bush) && (g.building[i] ?? 0) === 0 && (g.stage[i] ?? 0) >= 1;
    if (!flammable) continue;
    burnt.push(i);
    const x = i % g.w, y = Math.floor(i / g.w);
    for (const [dx, dy] of N4) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
      const j = yy * g.w + xx;
      if (seen.has(j)) continue;
      seen.add(j);
      if (next() < spread) queue.push(j);
    }
  }
  for (const i of burnt) {
    const h = g.health[i] ?? 0;
    const nh = hot ? 0.03 : Math.max(0, h - 0.3);
    g.health[i] = nh;
    g.stage[i] = stageFromHealth(nh);
    g.weed[i] = 0;
    if (g.kind[i] === TileKind.Bush && g.stage[i] <= STAGE_PIONEER) g.kind[i] = TileKind.Land;
  }
  return burnt;
}

/** Cheap per-tile fingerprint of everything the renderer draws from the restoration layer. */
export function fingerprint(g: TileGrid): Uint32Array {
  const out = new Uint32Array(g.kind.length);
  for (let i = 0; i < out.length; i++) {
    out[i] =
      ((g.kind[i] ?? 0) & 15) |
      (((g.stage[i] ?? 0) & 3) << 4) |
      (((g.weed[i] ?? 0) & 1) << 6) |
      (Math.round((g.health[i] ?? 0) * 20) << 7) |
      ((g.building[i] ?? 0) << 14);
  }
  return out;
}

/** Bumps chunkVersion for every chunk where the fingerprint differs; returns the changed chunk indices. */
export function bumpChangedChunks(g: TileGrid, before: Uint32Array): number[] {
  const changed = new Set<number>();
  const now = fingerprint(g);
  for (let i = 0; i < now.length; i++) {
    if (now[i] !== before[i]) changed.add(chunkOf(g, i % g.w, Math.floor(i / g.w)));
  }
  const list = Array.from(changed).sort((a, b) => a - b);
  for (const c of list) g.chunkVersion[c] = ((g.chunkVersion[c] ?? 0) + 1) >>> 0;
  return list;
}

export function bumpRect(g: TileGrid, x: number, y: number, w: number, h: number): void {
  const seen = new Set<number>();
  for (const [px, py] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]] as const) {
    seen.add(chunkOf(g, px, py));
  }
  for (const c of seen) if (c < chunkCount(g.w, g.h)) g.chunkVersion[c] = ((g.chunkVersion[c] ?? 0) + 1) >>> 0;
}

/** Human-readable name of a tile's succession stage, e.g. "saltmarsh" for stage 2 on an estuary tile. */
export function stageLabel(kind: number, stage: number): string {
  const names =
    kind === TileKind.Beach ? STAGE_NAMES.beach
    : kind === TileKind.Estuary ? STAGE_NAMES.estuary
    : kind === TileKind.Sea ? STAGE_NAMES.sea
    : kind === TileKind.Reef ? STAGE_NAMES.reef
    : STAGE_NAMES.land;
  return names[Math.max(0, Math.min(3, stage))] ?? names[0];
}
