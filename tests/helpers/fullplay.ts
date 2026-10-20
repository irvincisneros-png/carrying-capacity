/**
 * A scripted "thoughtful player" for the whole of Coal Coast: respectful of Country from the start, answers every
 * story prompt and dilemma card with the evidence-backed option where there is one, runs the Act 2 clean-up,
 * restoration, satellites and circular economy. Used to show a run that reaches three stars.
 */
import {
  applyAction, BUILDINGS, canPlace, getDilemma, SPECIES_BY_ID, tick, TileKind, CAST, LEGACY_TYPES, REPURPOSE, disposalPlans,
  itemAt, RESEARCH_BY_ID,
} from '../../src/sim';
import type { Action, GameState } from '../../src/sim';
import { goodPlayPlan } from './goodplay';
import type { BuildingId } from '../../src/sim';

type Plan = (s: GameState) => GameState;

/** An Act 1 that still builds the town's steel and coal heritage (so there is a legacy to deal with), steelworks first. */
export const RESPECTFUL_WANTS: { id: BuildingId; max: number; prefer?: 'near' | 'far' }[] = [
  { id: 'coalmine', max: 3 },
  { id: 'farm', max: 5 },
  { id: 'port', max: 2 },
  { id: 'rail', max: 3 },
  { id: 'outfall', max: 2 },
  { id: 'coalpower', max: 2 },
  { id: 'steelworks', max: 3 },
  { id: 'factory', max: 4 },
  { id: 'landfill', max: 2 },
  { id: 'carpark', max: 3 },
];

/** Beat choices a thoughtful player makes. */
export const BEAT_PICKS: Record<string, string> = {
  'mick-dust': 'filters',
  'lena-slick': 'sewage',
  'june-fire': 'together',
  'sj-turtles': 'honest',
  'dot-runoff': 'fence',
  'dot-drought': 'resilience',
  'dot-solar': 'lease',
};

/** Dilemma options where no option is flagged as evidence-backed. */
export const DILEMMA_PICKS: Record<string, string> = {
  'a1-strike': 'mediate',
  'd2-festival': 'picnic',
  'd2-newcomers': 'some',
  'd2-heritage': 'trail',
  'd2-legacy': 'bush',
  'd2-heat': 'trees',
  'd2-hydrogen': 'storage',
  'd2-solarsite': 'paddock',
  'd2-closure': 'transition',
  'd2-lastcoal': 'retire',
  'd2-moorings': 'moorings',
  'd2-seawall': 'living',
  'd2-fishing': 'pause',
};

export function answerPrompts(state: GameState, maxCost = Infinity): GameState {
  let s = state;
  for (const id of s.residents.pending.slice()) {
    const beat = CAST['coal-coast']?.flatMap((r) => r.beats).find((b) => b.id === id);
    const order = [BEAT_PICKS[id], ...(beat?.choice?.options.map((o) => o.id) ?? [])];
    for (const opt of order) {
      if (!opt) continue;
      const cost = -(beat?.choice?.options.find((o) => o.id === opt)?.effects?.budget ?? 0);
      if (cost > maxCost) continue;
      const r = applyAction(s, { type: 'respond', beatId: id, optionId: opt });
      if (r.result.ok) { s = r.state; break; }
    }
  }
  for (const id of s.dilemmas.pending.slice()) {
    const d = getDilemma(s.scenarioId, id);
    if (!d) continue;
    const pref = DILEMMA_PICKS[id] ?? d.options.find((o) => o.evidenceBacked)?.id ?? d.options[0]?.id;
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

/** Act 1 wrapper: consult the community before anything is built, then answer prompts; `inner` builds the town. */
export function act1Respectful(inner: Plan): Plan {
  return (state) => inner(answerPrompts(consultAll(state), 25));
}

function comanageBush(state: GameState, max: number): GameState {
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

function burnPatches(state: GameState): GameState {
  let s = state;
  if (!s.country.unlocked.culturalBurning) return s;
  if (s.a2.season === 0) s = tick(s, 0.25).state; // wait for the cool season, once; the offset stays
  if (s.a2.season !== 1 && s.a2.season !== 2) return s;
  const seen = new Set<number>();
  for (const i of s.country.comanaged) {
    if (seen.has(i)) continue;
    const r = applyAction(s, { type: 'burn', x: i % s.grid.w, y: Math.floor(i / s.grid.w) });
    if (r.result.ok) {
      s = r.state;
      // Mark the whole burnt patch as handled this year.
      for (const t of s.country.comanaged) seen.add(t);
    }
  }
  return s;
}

function satellites(state: GameState): GameState {
  let s = state;
  if (s.satellites.warning && !s.satellites.warning.mitigated) {
    const r = applyAction(s, { type: 'mitigate' });
    if (r.result.ok) s = r.state;
  }
  if (!s.buildings.some((b) => b.type === 'groundstation') && s.budget > 90 && s.year >= 2028) {
    for (let y = 0; y < s.grid.h; y++) for (let x = 0; x < s.grid.w; x++) {
      if (s.buildings.some((b) => b.type === 'groundstation')) break;
      if (canPlace(s, 'groundstation', x, y).ok) {
        const r = applyAction(s, { type: 'place', building: 'groundstation', x, y });
        if (r.result.ok) s = r.state;
      }
    }
  }
  for (const o of ['sst', 'forest'] as const) {
    if (!s.satellites.overlays[o] && s.buildings.some((b) => b.type === 'groundstation') && s.budget > 70) {
      const r = applyAction(s, { type: 'subscribe', overlay: o });
      if (r.result.ok) s = r.state;
    }
  }
  return s;
}

const RESEARCH_ORDER = ['green-steel', 'plastic-to-fuel', 'construction-reuse', 'biogas', 'ewaste', 'sorting', 'tyre-road', 'battery-recycling'];

function circular(state: GameState): GameState {
  let s = state;
  if (!s.circular.unlocked) return s;
  for (const id of RESEARCH_ORDER) {
    if (s.circular.research.includes(id)) continue;
    const need = (RESEARCH_BY_ID[id]?.cost ?? 999) + (id === 'green-steel' ? 15 : 60);
    if (s.budget < need) { if (id === 'green-steel') break; continue; }
    const r = applyAction(s, { type: 'research', id });
    if (r.result.ok) s = r.state;
  }
  const todo = s.circular.items.filter((i) => i.status === 'standing' || i.status === 'rubble');
  // Cheap, funding-friendly recycling first, then the best repurposing the budget allows.
  const order = (t: string): number => (['rail', 'carpark', 'outfall'].includes(t) ? 0 : t === 'steelworks' ? 3 : 2);
  todo.sort((a, b) => order(a.type) - order(b.type));
  for (const it of todo) {
    const cur = itemAt(s, it.x, it.y);
    if (!cur) continue;
    const plans = disposalPlans(s, cur);
    const want = REPURPOSE[cur.type] ?? [];
    let done = false;
    if (!['rail', 'carpark', 'outfall'].includes(cur.type)) {
      for (const o of want) {
        const p = plans.find((q) => q.how === 'repurpose' && q.id === o.id);
        if (!p || !p.ok || p.cost > s.budget - 20) continue;
        const r = applyAction(s, { type: 'dispose', x: cur.x, y: cur.y, how: 'repurpose', into: o.id });
        if (r.result.ok) { s = r.state; done = true; break; }
      }
    }
    if (!done) {
      const r = applyAction(s, { type: 'dispose', x: cur.x, y: cur.y, how: 'recycle' });
      if (r.result.ok) s = r.state;
    }
  }
  return s;
}

/** Extra stormwater wetlands beside the estuary, where they filter flood runoff before it reaches the water. */
function moreWetlands(state: GameState, target: number): GameState {
  let s = state;
  const have = s.buildings.filter((b) => b.type === 'wetland').length;
  for (let n = have; n < target && s.budget >= BUILDINGS.wetland.cost + 15; n++) {
    let best: { x: number; y: number; d: number } | null = null;
    for (let y = 0; y < s.grid.h; y++) for (let x = 0; x < s.grid.w; x++) {
      if (!canPlace(s, 'wetland', x, y).ok) continue;
      let d = 99;
      for (let yy = 0; yy < s.grid.h; yy++) for (let xx = 0; xx < s.grid.w; xx++) {
        if (s.grid.kind[yy * s.grid.w + xx] === TileKind.Estuary) d = Math.min(d, Math.hypot(x - xx, y - yy));
      }
      if (!best || d < best.d) best = { x, y, d };
    }
    if (!best) break;
    const r = applyAction(s, { type: 'place', building: 'wetland', x: best.x, y: best.y });
    if (!r.result.ok) break;
    s = r.state;
  }
  return s;
}

/** The Act 2 plan: respectful, evidence-minded, and thorough. */
export function fullPlayPlan(): Plan {
  const base = goodPlayPlan({ holdSteel: true, circularSafe: true });
  return (state) => {
    let s = answerPrompts(state);
    s = consultAll(s);
    s = comanageBush(s, 3);
    s = burnPatches(s);
    s = satellites(s);
    s = base(s);
    s = moreWetlands(s, s.year >= 2085 ? 16 : 11);
    s = circular(s);
    return s;
  };
}

export function playAct2(start: GameState, plan: Plan | null): GameState {
  let s = start;
  while (s.phase === 'act2') {
    if (plan) s = plan(s);
    s = tick(s, 1).state;
  }
  return s;
}

export { BUILDINGS, LEGACY_TYPES, SPECIES_BY_ID };
export type { Action };
