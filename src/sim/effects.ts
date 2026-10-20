import { stageFromHealth, fingerprint, bumpChangedChunks } from './restoration';
import { TileKind } from './types';
import type { GameState } from './types';
import { addPartnership } from './country';

export type TileScope = 'estuary' | 'river' | 'reef' | 'bush' | 'land' | 'beach' | 'sea' | 'all' | 'contaminated';

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

/** Applies effects in place to a state that the caller has already cloned. */
export function applyEffects(s: GameState, fx: Effects | undefined): void {
  if (!fx) return;
  if (fx.budget) s.budget += fx.budget;
  if (fx.society) s.dilemmas.adjust += fx.society;
  if (fx.incomePerYear) s.flags['income.adj'] = (typeof s.flags['income.adj'] === 'number' ? s.flags['income.adj'] : 0) + fx.incomePerYear;
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
  if (fx.emissionsKt) s.pendingLandKt += fx.emissionsKt;
}

/** A rough size for "how big a deal was this choice", for ranking decisions in the report. */
export function effectImpact(fx: Effects | undefined): number {
  if (!fx) return 0;
  let n = Math.abs(fx.budget ?? 0) / 10 + Math.abs(fx.society ?? 0) + Math.abs(fx.partnership ?? 0) / 2;
  n += Math.abs(fx.incomePerYear ?? 0) * 3 + Math.abs(fx.emissionsKt ?? 0) / 10 + (fx.tiles?.length ?? 0) * 2;
  if (fx.mood) for (const k of Object.keys(fx.mood)) n += Math.abs(fx.mood[k] ?? 0) / 4;
  if (fx.flags) n += Object.keys(fx.flags).length;
  return Math.round(n * 10) / 10;
}
