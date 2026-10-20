/**
 * Circular tier (waste hierarchy). Every legacy Act 1 building must be dealt with: repurposed (best), deconstructed
 * and recycled, or sent to landfill (worst: emissions, local pollution, a penalty in the report). Opens in Act 2
 * once the town has gone clean or reached 2050. Recycling research lives in content/research.ts.
 */
import { LANDFILL_STORY, LEGACY_TYPES, RECYCLE_STORY, REPURPOSE } from '../content/circular';
import type { RepurposeOption } from '../content/circular';
import { RESEARCH_BY_ID } from '../content/research';
import { BUILDINGS } from './buildings';
import { estuaryHealth } from './metrics';
import { availability } from './rules';
import { bumpRect, stageFromHealth } from './restoration';
import { cloneState } from './state';
import { emitStory } from './story';
import { TileKind } from './types';
import type { CircularItem, CircularState } from './layerTypes';
import type { Action, ActionFailCode, ActionResult, BuildingId, GameState, PlacedBuilding } from './types';
import { renewablePct } from './conditions';
import { noteAction } from './residents';

export const CIRCULAR_UNLOCK_YEAR = 2050;
export const RECYCLE_REFUND = 0.5;
export const LANDFILL_REFUND = 0.25;
export const REHAB_MAX_SOIL = 0.75;

export function emptyCircular(): CircularState {
  return { items: [], unlocked: false, unlockedYear: null, unlockReason: null, research: [], returnedBudget: 0, disposalKt: 0 };
}

/** Snapshots the legacy buildings standing when Act 2 begins. */
export function initCircular(s: GameState, include: (b: PlacedBuilding) => boolean = () => true): void {
  const c = emptyCircular();
  c.research = s.circular.research.slice();
  for (const b of s.buildings) {
    if (!LEGACY_TYPES.includes(b.type) || !include(b)) continue;
    c.items.push({ uid: b.uid, type: b.type, x: b.x, y: b.y, w: b.w, h: b.h, status: 'standing', year: null, into: null });
  }
  s.circular = c;
}

// ---------------------------------------------------------------------------------------------------------
// Research modifiers
// ---------------------------------------------------------------------------------------------------------

export interface CircularMods {
  refund: number;
  emissions: number;
  repurposeCost: number;
  waste: number;
}

export function circularMods(s: GameState): CircularMods {
  const m: CircularMods = { refund: 1, emissions: 1, repurposeCost: 1, waste: 1 };
  for (const id of s.circular.research) {
    const e = RESEARCH_BY_ID[id]?.effects;
    if (!e) continue;
    m.refund += e.recycleRefund ?? 0;
    m.emissions *= e.recycleEmissions ?? 1;
    m.repurposeCost *= e.repurposeCost ?? 1;
    m.waste *= e.wasteEmissions ?? 1;
  }
  return m;
}

/** Multiplier on the waste sector's yearly emissions (food-waste compost and biogas). */
export function wasteEmissionsMult(s: GameState): number {
  return circularMods(s).waste;
}

// ---------------------------------------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------------------------------------

export function itemAt(s: GameState, x: number, y: number): CircularItem | undefined {
  return s.circular.items.find((it) => (it.status === 'standing' || it.status === 'rubble') && x >= it.x && x < it.x + it.w && y >= it.y && y < it.y + it.h);
}

/** % of legacy buildings repurposed or recycled (the main objective's metric). 100 when there are none. */
export function legacyPercent(s: GameState): number {
  const n = s.circular.items.length;
  if (n === 0) return 100;
  const done = s.circular.items.filter((i) => i.status === 'repurposed' || i.status === 'recycled').length;
  return Math.round((done / n) * 100);
}

/** Publishes flags['metric.act1Repurposed'] once the tier is open (until then the objective stays pending). */
export function publishCircularMetric(s: GameState): void {
  if (s.circular.unlocked) s.flags['metric.act1Repurposed'] = legacyPercent(s);
}

export function counts(s: GameState): Record<CircularItem['status'], number> {
  const c = { standing: 0, rubble: 0, repurposed: 0, recycled: 0, landfilled: 0 };
  for (const it of s.circular.items) c[it.status]++;
  return c;
}

export function optionsFor(s: GameState, type: BuildingId): readonly RepurposeOption[] {
  return REPURPOSE[type] ?? [];
}

/**
 * The choice to put to the player when they click an old industrial site once the tier is open: repurpose (one plan per
 * option), recycle or landfill. Null before the tier opens, or when nothing legacy stands there. A plain 'demolish'
 * action on such a site is treated as the landfill option, so UIs should route clicks here instead.
 */
export function disposalChoice(s: GameState, x: number, y: number): { item: CircularItem; plans: DisposalPlan[] } | null {
  if (!s.circular.unlocked || s.phase !== 'act2') return null;
  const item = itemAt(s, x, y);
  return item ? { item, plans: disposalPlans(s, item) } : null;
}

export interface DisposalPlan {
  how: 'repurpose' | 'recycle' | 'landfill';
  id: string;
  label: string;
  /** Money spent (positive) or returned (negative). */
  cost: number;
  emissionsKt: number;
  ok: boolean;
  reason?: string;
  note: string;
}

const tiles = (it: CircularItem): number => it.w * it.h;

function siteSoil(s: GameState, it: CircularItem): number {
  const g = s.grid;
  let sum = 0, n = 0;
  for (let y = Math.max(0, it.y - 1); y <= Math.min(g.h - 1, it.y + it.h); y++) {
    for (let x = Math.max(0, it.x - 1); x <= Math.min(g.w - 1, it.x + it.w); x++) { sum += g.soilContamination[y * g.w + x] ?? 0; n++; }
  }
  return n > 0 ? sum / n : 0;
}

/** What each way of dealing with a site would cost / return, for the choice UI. */
export function disposalPlans(s: GameState, it: CircularItem): DisposalPlan[] {
  const m = circularMods(s);
  const def = BUILDINGS[it.type];
  const orig = availability(s.scenarioId, it.type).cost;
  const plans: DisposalPlan[] = [];
  for (const o of optionsFor(s, it.type)) {
    let ok = true;
    let reason: string | undefined;
    if (o.requires && !s.circular.research.includes(o.requires)) {
      ok = false;
      reason = `Needs the research "${RESEARCH_BY_ID[o.requires]?.name ?? o.requires}" first`;
    } else if (o.into === 'rehab' && siteSoil(s, it) > REHAB_MAX_SOIL) {
      ok = false;
      reason = 'The soil here is still too contaminated for bush. Clean it up first (excavation or a phytoremediation garden).';
    }
    plans.push({
      how: 'repurpose', id: o.id, label: o.label, cost: Math.round(o.cost * m.repurposeCost), emissionsKt: Math.round(tiles(it) * 2 * 10) / 10,
      ok, ...(reason ? { reason } : {}), note: o.blurb,
    });
  }
  plans.push({
    how: 'recycle', id: 'recycle', label: 'Deconstruct and recycle', cost: -Math.max(3, Math.round(orig * RECYCLE_REFUND * m.refund)),
    emissionsKt: Math.round(tiles(it) * 1.5 * m.emissions * 10) / 10, ok: true,
    note: 'Take it apart carefully and sell the materials. Returns money and keeps materials in use, with a little emissions from the work.',
  });
  plans.push({
    how: 'landfill', id: 'landfill', label: 'Demolish to landfill', cost: -Math.floor(orig * LANDFILL_REFUND),
    emissionsKt: Math.round((tiles(it) * 8 + def.co2 * 0.15) * 10) / 10, ok: true,
    note: 'Cheapest and quickest, but wastes materials, adds emissions and local pollution, and costs the town its reputation for doing things right.',
  });
  return plans;
}

// ---------------------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------------------

const fail = (state: GameState, code: ActionFailCode, reason: string): { state: GameState; result: ActionResult } => ({
  state, result: { ok: false, code, reason },
});

function freeUid(s: GameState): number {
  const used = new Set(s.buildings.map((b) => b.uid));
  let uid = s.nextUid;
  for (let n = 0; n < 65535; n++) {
    if (uid > 65535) uid = 1;
    if (!used.has(uid)) { s.nextUid = uid + 1; return uid; }
    uid++;
  }
  throw new Error('Too many buildings');
}

function clearFootprint(s: GameState, it: CircularItem): void {
  const g = s.grid;
  const b = s.buildings.find((o) => o.uid === it.uid);
  if (b) {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) g.building[y * g.w + x] = 0;
    s.buildings = s.buildings.filter((o) => o.uid !== b.uid);
  }
  bumpRect(g, it.x, it.y, it.w, it.h);
}

function rehabTiles(s: GameState, it: CircularItem): void {
  const g = s.grid;
  for (let y = it.y; y < it.y + it.h; y++) for (let x = it.x; x < it.x + it.w; x++) {
    const i = y * g.w + x;
    if ((g.building[i] ?? 0) !== 0) continue;
    g.kind[i] = TileKind.Land;
    g.health[i] = 0.03;
    g.stage[i] = stageFromHealth(0.03);
    g.weed[i] = 0;
  }
}

function addSoil(s: GameState, it: CircularItem, amount: number): void {
  const g = s.grid;
  for (let y = Math.max(0, it.y - 2); y <= Math.min(g.h - 1, it.y + it.h + 1); y++) {
    for (let x = Math.max(0, it.x - 2); x <= Math.min(g.w - 1, it.x + it.w + 1); x++) {
      g.soilContamination[y * g.w + x] = (g.soilContamination[y * g.w + x] ?? 0) + amount;
    }
  }
}

export function dispose(
  state: GameState, action: Extract<Action, { type: 'dispose' }>,
): { state: GameState; result: ActionResult } {
  if (state.phase !== 'act2') return fail(state, 'not-open', 'Deciding what to do with the old industrial sites is part of the transition');
  if (!state.circular.unlocked) {
    return fail(state, 'not-open', `The circular economy opens up in ${CIRCULAR_UNLOCK_YEAR}, or once the town runs on clean power and the estuary is healthy`);
  }
  const item = itemAt(state, action.x, action.y);
  if (!item) return fail(state, 'nothing-here', 'There is no old industrial site here to deal with');
  const plans = disposalPlans(state, item);
  const plan = action.how === 'repurpose'
    ? plans.find((p) => p.how === 'repurpose' && p.id === action.into)
    : plans.find((p) => p.how === action.how);
  if (!plan) return fail(state, 'invalid', 'That is not an option for this site');
  if (!plan.ok) return fail(state, 'bad-terrain', plan.reason ?? 'Cannot do that here');
  if (plan.cost > 0 && state.budget < plan.cost) return fail(state, 'no-funds', `Not enough money: this costs ${plan.cost}`);

  const s = cloneState(state);
  const it = s.circular.items.find((x) => x.uid === item.uid) as CircularItem;
  clearFootprint(s, it);
  s.budget -= plan.cost;
  s.pendingLandKt += plan.emissionsKt;
  s.circular.disposalKt += plan.emissionsKt;
  if (plan.cost < 0) s.circular.returnedBudget += -plan.cost;
  it.year = s.year;

  if (action.how === 'repurpose') {
    const opt = optionsFor(s, it.type).find((o) => o.id === action.into) as RepurposeOption;
    if (opt.into === 'rehab') {
      rehabTiles(s, it);
    } else {
      const nd = BUILDINGS[opt.into];
      const uid = freeUid(s);
      const pb: PlacedBuilding = { uid, type: opt.into, x: it.x, y: it.y, rotation: 0, w: nd.w, h: nd.h, builtYear: s.year };
      s.buildings.push(pb);
      const g = s.grid;
      for (let y = it.y; y < it.y + it.h; y++) for (let x = it.x; x < it.x + it.w; x++) {
        const i = y * g.w + x;
        const inside = x < it.x + nd.w && y < it.y + nd.h;
        if (inside) g.building[i] = uid;
        else { g.building[i] = 0; g.health[i] = 0.03; g.stage[i] = 0; }
        g.weed[i] = 0;
        if (g.kind[i] === TileKind.Bush) g.kind[i] = TileKind.Land;
      }
    }
    it.status = 'repurposed';
    it.into = opt.into;
    emitStory(s, opt.story, { channel: 'circular', ref: `${it.type}:${opt.id}`, tone: 'joy' }, 0.5);
    noteAction(s, `repurposed.${it.type}`);
    noteAction(s, `repurposed.${opt.id}`);
  } else if (action.how === 'recycle') {
    it.status = 'recycled';
    emitStory(s, RECYCLE_STORY[it.type] ?? 'The site was carefully deconstructed and its materials recovered.', { channel: 'circular', ref: `${it.type}:recycle`, tone: 'warm' }, 0.4);
    noteAction(s, `recycled.${it.type}`);
  } else {
    it.status = 'landfilled';
    addSoil(s, it, 1.2);
    s.dilemmas.adjust -= 1.5;
    emitStory(s, LANDFILL_STORY, { channel: 'circular', ref: `${it.type}:landfill`, tone: 'concern' }, 0.6);
    noteAction(s, `landfilled.${it.type}`);
  }
  noteAction(s, `demolished.${it.type}`);
  publishCircularMetric(s);
  s.version = state.version + 1;
  return { state: s, result: { ok: true, ...(plan.cost > 0 ? { spent: plan.cost } : { refund: -plan.cost }) } };
}

/** The player demolished a building by the plain action. Legacy sites become rubble (or, once the tier is open, landfill). */
export function onDemolished(s: GameState, b: PlacedBuilding): void {
  const it = s.circular.items.find((x) => x.uid === b.uid && x.status === 'standing');
  if (!it) return;
  it.year = s.year;
  if (!s.circular.unlocked) {
    it.status = 'rubble';
    return;
  }
  it.status = 'landfilled';
  const def = BUILDINGS[it.type];
  const kt = Math.round((tiles(it) * 8 + def.co2 * 0.15) * 10) / 10;
  s.pendingLandKt += kt;
  s.circular.disposalKt += kt;
  addSoil(s, it, 1.2);
  s.dilemmas.adjust -= 1.5;
  emitStory(s, LANDFILL_STORY, { channel: 'circular', ref: `${it.type}:landfill`, tone: 'concern' }, 0.6);
  publishCircularMetric(s);
}

/** A building was replaced in place (sewage treatment on an outfall): that counts as repurposing the legacy site. */
export function onReplaced(s: GameState, old: PlacedBuilding, into: BuildingId): void {
  const it = s.circular.items.find((x) => x.uid === old.uid && x.status === 'standing');
  if (!it) return;
  it.status = 'repurposed';
  it.into = into;
  it.year = s.year;
  publishCircularMetric(s);
}

// ---------------------------------------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------------------------------------

export function canResearch(s: GameState, id: string): { ok: boolean; reason?: string } {
  const r = RESEARCH_BY_ID[id];
  if (!r) return { ok: false, reason: 'Unknown research' };
  if (!s.circular.unlocked) return { ok: false, reason: 'Recycling research opens with the circular economy' };
  if (s.circular.research.includes(id)) return { ok: false, reason: 'Already researched' };
  for (const q of r.requires ?? []) if (!s.circular.research.includes(q)) return { ok: false, reason: `Needs ${RESEARCH_BY_ID[q]?.name ?? q} first` };
  if (s.budget < r.cost) return { ok: false, reason: `Not enough money: this costs ${r.cost}` };
  return { ok: true };
}

export function research(state: GameState, id: string): { state: GameState; result: ActionResult } {
  if (state.phase !== 'act2') return fail(state, 'not-open', 'Research happens during the transition');
  const chk = canResearch(state, id);
  const r = RESEARCH_BY_ID[id];
  if (!chk.ok || !r) return fail(state, state.budget < (r?.cost ?? 0) && state.circular.unlocked ? 'no-funds' : 'not-open', chk.reason ?? 'Cannot research that');
  const s = cloneState(state);
  s.budget -= r.cost;
  s.circular.research.push(id);
  if (r.effects.society) s.dilemmas.adjust += r.effects.society;
  if (r.effects.flags) for (const k of Object.keys(r.effects.flags)) s.flags[k] = r.effects.flags[k] as number;
  emitStory(s, `${r.name}: ${r.blurb}`, { channel: 'research', ref: id, tone: r.kind === 'critique' ? 'neutral' : 'joy' }, 0.4);
  noteAction(s, `researched.${id}`);
  s.version = state.version + 1;
  return { state: s, result: { ok: true, spent: r.cost } };
}

// ---------------------------------------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------------------------------------

export function isCleanTier(s: GameState): boolean {
  return renewablePct(s) >= 80 && estuaryHealth(s) >= 60;
}

/** Year end: opens the tier when 2050 arrives or the Clean objectives are met. */
export function circularYear(s: GameState): void {
  if (!s.circular.unlocked) {
    const reason = s.year >= CIRCULAR_UNLOCK_YEAR ? 'year' : isCleanTier(s) ? 'clean' : null;
    if (reason) {
      s.circular.unlocked = true;
      s.circular.unlockedYear = s.year;
      s.circular.unlockReason = reason;
      s.flags['tier.circular'] = 1;
      const waiting = s.circular.items.filter((i) => i.status === 'standing' || i.status === 'rubble').length;
      emitStory(s, reason === 'clean'
        ? `The town runs on clean power and the estuary is recovering. Now comes the next step: what to do with the old industrial sites. ${waiting} are waiting. Repurpose is best, recycling is next, landfill is last.`
        : `It is ${s.year}. The old industrial sites can no longer be ignored: ${waiting} are waiting. The waste hierarchy says repurpose first, then recycle, and landfill only as a last resort.`,
      { channel: 'circular', ref: 'tier.unlocked', tone: 'neutral', speakerId: 'priya-shah', speaker: 'Priya Shah', portrait: 'priya-shah' }, 0.5);
    }
  }
  publishCircularMetric(s);
}

