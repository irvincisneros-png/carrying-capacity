/**
 * Building blocks for the per-scenario scripted players ("thoughtful" and "idle"). Everything here works on any
 * scenario: answering story prompts, consulting the community, restoration, clean energy, and retiring fossil plants.
 */
import {
  applyAction, BUILDINGS, canPlace, CAST, getDilemma, TileKind, tick,
} from '../../src/sim';
import type { BuildingId, GameState } from '../../src/sim';
import { bestSpot, count, demolishAll, place, placeUpTo } from './act2play';
import { gridHoldsWithout } from './goodplay';

export type Plan = (s: GameState) => GameState;

export interface Picks {
  beats?: Record<string, string>;
  dilemmas?: Record<string, string>;
}

/** Answers every pending story question: the named pick if there is one, else the evidence-backed option, else the cheapest. */
/**
 * The scripted towns were tuned (margins and all) before the WP9 additions, so by default they pass on the innovation
 * timeline (the last, "do nothing" option, which changes nothing) and say no to the tech company. tests/innovations.test.ts
 * and tests/datacentre.test.ts switch the policy to play them.
 */
export const WP9_POLICY: { innovations: 'skip' | 'adopt'; datacentre: 'decline' | 'offered' | 'conditions' } = { innovations: 'skip', datacentre: 'decline' };
export function scriptedPick(id: string, options: readonly { id: string; evidenceBacked?: boolean }[]): string | undefined {
  if (id.startsWith('inn-')) return WP9_POLICY.innovations === 'skip' ? options[options.length - 1]?.id : options.find((o) => o.evidenceBacked)?.id;
  if (id === 'dc-offer') return ({ decline: 'dc-decline', offered: 'dc-offered', conditions: 'dc-conditions' } as const)[WP9_POLICY.datacentre];
  return undefined;
}

export function answerPrompts(state: GameState, picks: Picks = {}, maxCost = Infinity): GameState {
  let s = state;
  const cast = CAST[s.scenarioId] ?? [];
  for (const id of s.residents.pending.slice()) {
    const beat = cast.flatMap((r) => r.beats).find((b) => b.id === id);
    const opts = beat?.choice?.options ?? [];
    const order = [picks.beats?.[id], ...opts.map((o) => o.id)];
    for (const opt of order) {
      if (!opt) continue;
      const cost = -(opts.find((o) => o.id === opt)?.effects?.budget ?? 0);
      if (cost > maxCost) continue;
      const r = applyAction(s, { type: 'respond', beatId: id, optionId: opt });
      if (r.result.ok) { s = r.state; break; }
    }
  }
  for (const id of s.dilemmas.pending.slice()) {
    const d = getDilemma(s.scenarioId, id);
    if (!d) continue;
    // The scripted towns are tuned to a grid and a river without a data centre, so they say no to the tech company
    // (tests/datacentre.test.ts covers accepting it, as offered and with conditions).
    const pref = picks.dilemmas?.[id] ?? scriptedPick(d.id, d.options) ?? d.options.find((o) => o.evidenceBacked)?.id ?? d.options.slice().sort((a, b) => (b.effects.budget ?? 0) - (a.effects.budget ?? 0))[0]?.id;
    const order = [pref, ...d.options.map((o) => o.id)];
    for (const opt of order) {
      if (!opt) continue;
      const cost = -(d.options.find((o) => o.id === opt)?.effects.budget ?? 0);
      if (cost > maxCost) continue;
      const r = applyAction(s, { type: 'choose', dilemmaId: id, optionId: opt });
      if (r.result.ok) { s = r.state; break; }
    }
  }
  return s;
}

/** First tile of each significant-site cluster. */
export function siteTiles(s: GameState): { id: number; x: number; y: number }[] {
  const out = new Map<number, { id: number; x: number; y: number }>();
  const g = s.grid;
  for (let i = 0; i < g.significant.length; i++) {
    const id = g.significant[i] ?? 0;
    if (id > 0 && !out.has(id)) out.set(id, { id, x: i % g.w, y: Math.floor(i / g.w) });
  }
  return Array.from(out.values());
}

export function consultAll(state: GameState): GameState {
  let s = state;
  for (const t of siteTiles(s)) {
    const r = applyAction(s, { type: 'consult', x: t.x, y: t.y });
    if (r.result.ok) s = r.state;
  }
  return s;
}

/** Return up to `max` patches of bush to co-management. */
export function comanageBush(state: GameState, max: number): GameState {
  let s = state;
  const g = s.grid;
  const done = new Set(s.country.comanaged);
  let patches = 0;
  for (let i = 0; i < g.kind.length && patches < max; i++) {
    if (g.kind[i] !== TileKind.Bush || done.has(i) || (g.building[i] ?? 0) !== 0) continue;
    if (s.budget < 40) break;
    const r = applyAction(s, { type: 'comanage', x: i % g.w, y: Math.floor(i / g.w) });
    if (r.result.ok) {
      s = r.state;
      patches++;
      for (const t of s.country.comanaged) done.add(t);
    }
  }
  return s;
}

export function burnPatches(state: GameState): GameState {
  let s = state;
  if (!s.country.unlocked.culturalBurning) return s;
  if (s.a2.season === 0) s = tick(s, 0.25).state;
  if (s.a2.season !== 1 && s.a2.season !== 2) return s;
  const seen = new Set<number>();
  for (const i of s.country.comanaged) {
    if (seen.has(i)) continue;
    const r = applyAction(s, { type: 'burn', x: i % s.grid.w, y: Math.floor(i / s.grid.w) });
    if (r.result.ok) {
      s = r.state;
      for (const t of s.country.comanaged) seen.add(t);
    }
  }
  return s;
}

export function setPolicy(s: GameState, id: string, value: number): GameState {
  const r = applyAction(s, { type: 'policy', id, value });
  return r.result.ok ? r.state : s;
}

/** Distance-from-hub scoring for placement. */
export function nearTiles(s: GameState, kinds: readonly number[]): (x: number, y: number) => number {
  const g = s.grid;
  const pts: number[] = [];
  for (let i = 0; i < g.kind.length; i++) if (kinds.includes(g.kind[i] ?? -1)) pts.push(i);
  return (x, y) => {
    let best = 99;
    for (const i of pts) best = Math.min(best, Math.hypot(x - (i % g.w), y - Math.floor(i / g.w)));
    return -best;
  };
}

export const homesCount = (s: GameState): number => s.buildings.filter((b) => BUILDINGS[b.type].housing > 0).length;

/** Builds clean energy up to the wanted counts (cheapest first when money is short). */
export function buildEnergy(s0: GameState, want: [BuildingId, number, number?][], score: (id: BuildingId) => (x: number, y: number, w: number, h: number) => number = () => () => 0): GameState {
  let s = s0;
  for (const [id, n, from] of want) {
    if (s.year < (from ?? 0)) continue;
    s = placeUpTo(s, id, Math.max(0, n - count(s, id)), score(id));
  }
  return s;
}

/** Retire coal then gas, one plant at a time, only where the grid still holds without it. */
export function retireFossil(s0: GameState, opts: { circularSafe?: boolean } = {}): GameState {
  let s = s0;
  for (const type of ['coalpower', 'gaspower'] as const) {
    for (const b of s.buildings.filter((o) => o.type === type)) {
      if (!gridHoldsWithout(s, b.uid)) continue;
      if (opts.circularSafe && s.circular.unlocked) {
        const r = applyAction(s, { type: 'dispose', x: b.x, y: b.y, how: 'recycle' });
        if (r.result.ok) s = r.state;
      } else {
        s = applyAction(s, { type: 'demolish', x: b.x, y: b.y }).state;
      }
    }
  }
  return s;
}

/** Upgrade the sewage outfalls to treatment plants. */
export function treatSewage(s0: GameState): GameState {
  let s = s0;
  for (const b of s.buildings.filter((o) => o.type === 'outfall')) {
    const p = place(s, 'sewagetreatment', { x: b.x, y: b.y, rotation: 0 });
    if (p.ok) s = p.state;
  }
  return s;
}

export function playAct2(start: GameState, plan: Plan | null): GameState {
  let s = start;
  while (s.phase === 'act2') {
    if (plan) s = plan(s);
    s = tick(s, 1).state;
  }
  return s;
}

export { bestSpot, canPlace, count, demolishAll, place, placeUpTo };

// ---------------------------------------------------------------------------------------------------------
// Act 1 builders
// ---------------------------------------------------------------------------------------------------------

export interface QueueWant {
  id: BuildingId;
  /** Stop adding at this many in total. */
  max: number;
  prefer?: 'near' | 'far';
}

const jobsAndHousing = (s: GameState): { housing: number; jobs: number } => {
  let housing = 0, jobs = 0;
  for (const b of s.buildings) { housing += BUILDINGS[b.type].housing; jobs += BUILDINGS[b.type].jobs; }
  return { housing, jobs };
};

/**
 * Act 1 player that saves up: houses people first (housing >= jobs x ratio), then works down an ordered list, building the
 * first wanted building that is unlocked and not yet at its maximum. If it cannot afford it, it waits for the next decade
 * (so expensive, important buildings are not starved by cheap ones).
 */
export function queuePlan(queue: readonly QueueWant[], housingRatio = 1.0, maxPerDecade = 30, roadWeight?: number): Plan {
  // Wants that could not find a legal spot are dropped for good, so one impossible item never blocks the rest.
  const blocked = new Set<BuildingId>();
  return (state) => {
    let s = state;
    for (let n = 0; n < maxPerDecade; n++) {
      const { housing, jobs } = jobsAndHousing(s);
      let id: BuildingId | null = null;
      let prefer: 'near' | 'far' = 'near';
      if (housing < jobs * housingRatio || (jobs === 0 && housing < 20)) {
        id = isUnlockedHere(s, 'suburb') ? 'suburb' : 'cottage';
      } else {
        const want = queue.find((w) => !blocked.has(w.id) && isUnlockedHere(s, w.id) && count(s, w.id) < w.max);
        if (want) { id = want.id; prefer = want.prefer ?? 'near'; }
      }
      if (!id) break;
      if (s.budget < BUILDINGS[id].cost) break;
      const r = buildNear(s, id, prefer, roadWeight);
      if (r === 'funds') break; // the road to it costs more than is left: wait for next decade
      if (!r) {
        if (id === 'cottage' || id === 'suburb') break;
        blocked.add(id);
        continue;
      }
      s = r;
    }
    return s;
  };
}

function isUnlockedHere(s: GameState, id: BuildingId): boolean {
  const c = canPlace({ ...s, budget: 1e9 }, id, -1, -1);
  return c.code !== 'locked';
}

function buildNear(s: GameState, id: BuildingId, prefer: 'near' | 'far', roadWeight?: number): GameState | null | 'funds' {
  const hub = hubFor(s);
  const spot = bestSpot(s, id, (x, y) => (prefer === 'near' ? -1 : 1) * Math.hypot(x - hub.x, y - hub.y), [0, 1], roadWeight);
  const p = place(s, id, spot);
  if (!p.ok && p.needsFunds) return 'funds';
  return p.ok ? p.state : null;
}

import { hubOf } from './autoplay';
const hubFor = hubOf;

// ---------------------------------------------------------------------------------------------------------
// Circular economy and budgets
// ---------------------------------------------------------------------------------------------------------

import { disposalPlans, itemAt, REPURPOSE, RESEARCH_BY_ID } from '../../src/sim';

/** Deal with every old industrial site by the waste hierarchy: repurpose where it is affordable, otherwise recycle. Never landfill. */
export function disposeLegacy(state: GameState, opts: { reserve?: number; research?: string[]; skip?: readonly BuildingId[]; wait?: boolean } = {}): GameState {
  let s = state;
  if (!s.circular.unlocked) return s;
  const reserve = opts.reserve ?? 20;
  for (const id of opts.research ?? []) {
    if (s.circular.research.includes(id)) continue;
    if (s.budget < (RESEARCH_BY_ID[id]?.cost ?? 999) + reserve + 30) continue;
    const r = applyAction(s, { type: 'research', id });
    if (r.result.ok) s = r.state;
  }
  const todo = s.circular.items.filter((i) => (i.status === 'standing' || i.status === 'rubble') && !(opts.skip ?? []).includes(i.type));
  const cheap = ['rail', 'carpark', 'outfall'];
  todo.sort((a, b) => (cheap.includes(a.type) ? 0 : 1) - (cheap.includes(b.type) ? 0 : 1));
  for (const it of todo) {
    const cur = itemAt(s, it.x, it.y);
    if (!cur) continue;
    const plans = disposalPlans(s, cur);
    let done = false;
    if (!cheap.includes(cur.type)) {
      for (const o of REPURPOSE[cur.type] ?? []) {
        const p = plans.find((q) => q.how === 'repurpose' && q.id === o.id);
        if (!p || !p.ok || p.cost > s.budget - reserve) continue;
        const r = applyAction(s, { type: 'dispose', x: cur.x, y: cur.y, how: 'repurpose', into: o.id });
        if (r.result.ok) { s = r.state; done = true; break; }
      }
    }
    // Waiting for the money to repurpose is better than recycling away the jobs (cheap sites are always just recycled).
    if (!done && (!opts.wait || cheap.includes(cur.type))) {
      const r = applyAction(s, { type: 'dispose', x: cur.x, y: cur.y, how: 'recycle' });
      if (r.result.ok) s = r.state;
    }
  }
  return s;
}

/** The money a town would have spent on schools, roads and parades by now: caps the Act 1 leftover so Act 2 is not flush. */
export function capBudget(s: GameState, cap: number): GameState {
  return s.budget > cap ? { ...s, budget: cap } : s;
}

// ---------------------------------------------------------------------------------------------------------
// A grid planner
// ---------------------------------------------------------------------------------------------------------

import { balanceGrid } from '../../src/sim';

/** Worst day and night shortfall (as a fraction of demand) over the four seasons and three weather draws, with all fossil plants off. */
export function fossilFreeShortfall(s: GameState): { day: number; night: number; unmet: number } {
  const kept = s.buildings.filter((b) => b.type !== 'coalpower' && b.type !== 'gaspower');
  const probeBase: GameState = { ...s, buildings: kept };
  let day = 0, night = 0, unmet = 0;
  for (let k = 0; k < 4; k++) {
    const probe: GameState = { ...probeBase, a2: { ...probeBase.a2, season: k as 0 | 1 | 2 | 3 } };
    for (const off of [0, 1, 2]) {
      const r = balanceGrid(probe, (probe.year - 1850) * 4 + k + off * 40).report;
      day = Math.max(day, r.day.demand > 0 ? r.day.unmet / r.day.demand : 0);
      night = Math.max(night, r.night.demand > 0 ? r.night.unmet / r.night.demand : 0);
      unmet = Math.max(unmet, r.unmetFrac);
    }
  }
  return { day, night, unmet };
}

export interface GridPlan {
  /** Cheapest generation to add when the day is short, and storage when the night is. */
  gen: BuildingId;
  storage: BuildingId;
  /** Most purchases per call. */
  maxBuys: number;
  /** Never own more than this many of each. */
  maxGen?: number;
  maxStorage?: number;
  /** Keep this much money back. */
  reserve: number;
  genScore?: (x: number, y: number, w: number, h: number) => number;
}

/**
 * Builds clean capacity until the grid holds without its fossil plants (<= 1.5% unmet), then retires them one at a time.
 * Works for any scenario with fossil plants. Returns the new state.
 */
export function greenGridStep(state: GameState, plan: GridPlan): GameState {
  let s = state;
  const fossil = (): number => s.buildings.filter((b) => b.type === 'coalpower' || b.type === 'gaspower').length;
  if (fossil() === 0) return s;
  for (let n = 0; n < plan.maxBuys; n++) {
    const f = fossilFreeShortfall(s);
    if (f.unmet <= 0.012) break;
    // Generation first until the day is covered, then storage for the night.
    const storageHeavy = count(s, plan.storage) >= 2 * count(s, plan.gen) + 2;
    const id = f.day > 0.02 || storageHeavy ? plan.gen : plan.storage;
    if (count(s, id) >= (id === plan.gen ? plan.maxGen ?? 999 : plan.maxStorage ?? 999)) break;
    if (s.budget < BUILDINGS[id].cost + plan.reserve) break;
    const p = place(s, id, bestSpot(s, id, plan.genScore ?? (() => 0)));
    if (!p.ok) break;
    s = p.state;
  }
  return s;
}
