import { stageFromHealth, fingerprint, bumpChangedChunks, bumpRect } from './restoration';
import { CLEAR_KT_PER_TILE } from './rules';
import { TileKind } from './types';
import type { GameState } from './types';
import { addPartnership } from './country';
import { placeDataCentre } from './datacentre';

export type TileScope = 'estuary' | 'river' | 'reef' | 'bush' | 'land' | 'beach' | 'sea' | 'all' | 'contaminated' | 'wetland';

/** A change to the map. `mult` scales the field, `add` is added afterwards (all fields stay >= 0, health <= 1). */
export interface TileEffect {
  op: 'water' | 'soil' | 'air' | 'health';
  scope: TileScope;
  mult?: number;
  add?: number;
}

/** What a choice, story beat or action does. Every field is optional. */
export interface Effects {
  /** One-off money (negative = cost). */
  budget?: number;
  /** Society nudge (kept inside -10..+10 across all dilemma choices). */
  society?: number;
  /** Yearly income change, accumulates (negative = a running cost). */
  incomePerYear?: number;
  /**
   * Lasting change to income per decade in Act 1 (thousands; negative = a running cost). Counts a tenth each year in
   * Act 2. Unlike `incomePerYear` (Act 2 only), the player feels this from the next decade report.
   */
  incomePerDecade?: number;
  /** Clear this many bush tiles (the ones nearest the town's farms first), with the clearing emissions. */
  clearBush?: number;
  /** Transient stress on the town (events-style, decays). */
  stress?: number;
  /** Resident id -> mood change (points). */
  mood?: Record<string, number>;
  flags?: Record<string, boolean | number>;
  /** Partnership with the local Aboriginal community. */
  partnership?: number;
  tiles?: readonly TileEffect[];
  /** One-off emissions (kt CO2-e) counted in the next year / decade. */
  emissionsKt?: number;
  /** Put a data centre on open land (Act 2 offer card). Does nothing if there is no room. */
  build?: 'datacentre';
}

const inScope = (kind: number, scope: TileScope, soil: number): boolean => {
  switch (scope) {
    case 'estuary': return kind === TileKind.Estuary;
    case 'river': return kind === TileKind.River;
    case 'reef': return kind === TileKind.Reef;
    case 'bush': return kind === TileKind.Bush;
    case 'land': return kind === TileKind.Land || kind === TileKind.Bush;
    case 'beach': return kind === TileKind.Beach;
    case 'sea': return kind === TileKind.Sea;
    case 'wetland': return kind === TileKind.Wetland;
    case 'contaminated': return soil > 0.5;
    case 'all': return true;
  }
};

export function applyTileEffect(s: GameState, fx: TileEffect): void {
  const g = s.grid;
  const before = fx.op === 'health' ? fingerprint(g) : null;
  for (let i = 0; i < g.kind.length; i++) {
    const kind = g.kind[i] ?? 0;
    if (!inScope(kind, fx.scope, g.soilContamination[i] ?? 0)) continue;
    const mult = fx.mult ?? 1;
    const add = fx.add ?? 0;
    if (fx.op === 'water') g.waterPollution[i] = Math.max(0, (g.waterPollution[i] ?? 0) * mult + add);
    else if (fx.op === 'soil') g.soilContamination[i] = Math.max(0, (g.soilContamination[i] ?? 0) * mult + add);
    else if (fx.op === 'air') g.airPollution[i] = Math.max(0, (g.airPollution[i] ?? 0) * mult + add);
    else if (s.phase === 'act2' && (g.building[i] ?? 0) === 0) {
      const h = Math.max(0, Math.min(1, (g.health[i] ?? 0) * mult + add));
      g.health[i] = h;
      g.stage[i] = stageFromHealth(h);
      if (kind === TileKind.Bush && (g.stage[i] ?? 0) <= 1) g.kind[i] = TileKind.Land;
      else if (kind === TileKind.Land && (g.stage[i] ?? 0) >= 3) g.kind[i] = TileKind.Bush;
    }
  }
  if (before) bumpChangedChunks(g, before);
}

/**
 * Clears up to `n` bush tiles, nearest to the town's farms first (or to any building, or the map centre), ties broken by
 * tile index so it is deterministic. Counts the clearing emissions like the Clear tool does.
 */
function clearBushNear(s: GameState, n: number): void {
  const g = s.grid;
  const anchors = s.buildings.filter((b) => b.type === 'farm');
  const pts = (anchors.length > 0 ? anchors : s.buildings).map((b) => [b.x + b.w / 2, b.y + b.h / 2] as const);
  if (pts.length === 0) pts.push([g.w / 2, g.h / 2]);
  const cand: { i: number; d: number }[] = [];
  for (let i = 0; i < g.kind.length; i++) {
    if (g.kind[i] !== TileKind.Bush || (g.building[i] ?? 0) !== 0) continue;
    const x = (i % g.w) + 0.5, y = Math.floor(i / g.w) + 0.5;
    let d = Infinity;
    for (const [px, py] of pts) d = Math.min(d, Math.hypot(px - x, py - y));
    cand.push({ i, d });
  }
  cand.sort((a, b) => a.d - b.d || a.i - b.i);
  const take = cand.slice(0, n);
  for (const c of take) {
    g.kind[c.i] = TileKind.Land;
    bumpRect(g, c.i % g.w, Math.floor(c.i / g.w), 1, 1);
  }
  s.pendingLandKt += take.length * CLEAR_KT_PER_TILE;
}

/** Applies effects in place to a state that the caller has already cloned. */
export function applyEffects(s: GameState, fx: Effects | undefined): void {
  if (!fx) return;
  if (fx.budget) s.budget += fx.budget;
  if (fx.society) s.dilemmas.adjust += fx.society;
  if (fx.incomePerYear) s.flags['income.adj'] = (typeof s.flags['income.adj'] === 'number' ? s.flags['income.adj'] : 0) + fx.incomePerYear;
  if (fx.incomePerDecade) s.flags['income.act1'] = (typeof s.flags['income.act1'] === 'number' ? s.flags['income.act1'] : 0) + fx.incomePerDecade;
  if (fx.clearBush) clearBushNear(s, fx.clearBush);
  if (fx.stress) s.a2.stress += fx.stress;
  if (fx.mood) {
    for (const id of Object.keys(fx.mood)) {
      const r = s.residents.list[id];
      if (r) r.mood = Math.max(0, Math.min(100, r.mood + (fx.mood[id] ?? 0)));
    }
  }
  if (fx.flags) for (const k of Object.keys(fx.flags)) s.flags[k] = fx.flags[k] as boolean | number;
  if (fx.partnership) addPartnership(s, fx.partnership);
  if (fx.tiles) for (const t of fx.tiles) applyTileEffect(s, t);
  if (fx.build === 'datacentre') placeDataCentre(s);
  // Act 1 has no negative land emissions to offset, so a saving there cannot dip below zero.
  if (fx.emissionsKt) s.pendingLandKt = s.phase === 'act1' ? Math.max(0, s.pendingLandKt + fx.emissionsKt) : s.pendingLandKt + fx.emissionsKt;
}

/**
 * Act 1: choices that leave a lasting source of dirty water (a bare hillside, a heavy fertiliser habit, a leaking tip)
 * set a flag 'runoff.<name>' = how much each creek tile gets every decade. Called after the pollution step of each decade.
 */
export function applyLingeringRunoff(s: GameState): void {
  let add = 0;
  for (const k of Object.keys(s.flags)) {
    if (!k.startsWith('runoff.')) continue;
    const v = s.flags[k];
    if (typeof v === 'number') add += v;
  }
  if (add <= 0) return;
  applyTileEffect(s, { op: 'water', scope: 'river', add });
}

/** A rough size for "how big a deal was this choice", for ranking decisions in the report. */
export function effectImpact(fx: Effects | undefined): number {
  if (!fx) return 0;
  let n = Math.abs(fx.budget ?? 0) / 10 + Math.abs(fx.society ?? 0) + Math.abs(fx.partnership ?? 0) / 2;
  n += Math.abs(fx.incomePerYear ?? 0) * 3 + Math.abs(fx.incomePerDecade ?? 0) / 3 + (fx.clearBush ?? 0) / 2 + Math.abs(fx.emissionsKt ?? 0) / 10 + (fx.tiles?.length ?? 0) * 2 + (fx.build ? 4 : 0);
  if (fx.mood) for (const k of Object.keys(fx.mood)) n += Math.abs(fx.mood[k] ?? 0) / 4;
  if (fx.flags) n += Object.keys(fx.flags).length;
  return Math.round(n * 10) / 10;
}
