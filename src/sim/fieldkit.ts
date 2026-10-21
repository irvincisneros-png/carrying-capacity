/**
 * The water-quality field kit (Round 6, WP8b): a Waterwatch-style test of the creek, river or estuary.
 *
 * Everything is worked out from the map and the town, so the same game always gives the same readings:
 *  - nutrients (nitrogen and phosphorus) come from the dirty water already on the map, the town's farm runoff, sewage
 *    outfalls, less what wetlands and treatment plants catch;
 *  - turbidity comes from dirty water, lost bush on the catchment, and a thin creek (low flow);
 *  - dissolved oxygen falls with nutrients (algae die and rot), mud, warmth and low flow, and shoots above 100% by day in
 *    a mildly rich, algae-rich creek;
 *  - pH is pulled down by soil contamination (mine and industry waste);
 *  - conductivity (salt) rises with low flow, irrigation farms and, in Red Dirt, a fallen aquifer.
 * The water bugs follow overall health: sensitive bugs vanish first and tolerant ones boom, and the SIGNAL2 score is the
 * abundance-weighted mean of their grades.
 *
 * The numbers are not real measurements. They are tuned so the readings sit near the NSW / ANZECC trigger values for a
 * healthy creek and cross them when the sim says the water is in trouble.
 */
import { BUGS, REGION, TRIGGERS } from '../content/waterkit';
import type { Triggers } from '../content/waterkit';
import { capStocks } from './capacity';
import type { KitBug, KitIndicator, KitPrediction, KitReading, KitSite, LearnAction, LearnState, Trend, Verdict } from './learnTypes';
import { emptyLearn } from './learnTypes';
import { dilate } from './grid';
import { meanHealth } from './metrics';
import { mechMetric } from './mechanics';
import { workingBuildings } from './roads';
import { hash32 } from './season';
import { getScenario } from './scenarios';
import { cloneState } from './state';
import { TileKind } from './types';
import type { ActionResult, GameState } from './types';

/** Money for one test, in thousands. */
export const KIT_COST = 2;
/** Bug score change that counts as better or worse rather than the same. */
export const TREND_BAND = 0.4;
const KEEP_READINGS = 60;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const r1 = (v: number): number => Math.round(v * 10) / 10;

export function learnOf(s: GameState): LearnState {
  return s.learn ?? emptyLearn();
}

/** Which water bodies this map has. */
export function kitSites(s: GameState): KitSite[] {
  const g = s.grid;
  let river = 0, est = 0;
  for (let i = 0; i < g.kind.length; i++) {
    const k = g.kind[i];
    if (k === TileKind.River || k === TileKind.Wetland) river++;
    else if (k === TileKind.Estuary) est++;
  }
  const out: KitSite[] = [];
  if (river > 0) out.push('river');
  if (est > 0) out.push('estuary');
  return out;
}

/** What the sampled water is called on this map ("creek" in Green Valley). */
export function siteName(s: GameState, site: KitSite): string {
  if (site === 'estuary') return 'estuary';
  return s.scenarioId === 'green-valley' ? 'creek' : s.scenarioId === 'red-dirt' ? 'river and waterholes' : 'river';
}

export function testPeriod(s: GameState): number {
  return s.year;
}

export function canTest(s: GameState): { ok: boolean; reason?: string } {
  if (s.phase !== 'act1' && s.phase !== 'act2') return { ok: false, reason: 'The kit is only used while the town is running.' };
  if (kitSites(s).length === 0) return { ok: false, reason: 'There is no water here to test.' };
  if (learnOf(s).lastTest === testPeriod(s)) return { ok: false, reason: s.phase === 'act1' ? 'You have already tested this decade. Come back next decade.' : 'You have already tested this year. Come back next year.' };
  if (s.budget < KIT_COST) return { ok: false, reason: `A test costs $${KIT_COST}k.` };
  return { ok: true };
}

interface Inputs {
  tiles: number;
  poll: number;
  runoff: number;
  nutr: number;
  sed: number;
  flowLow: number;
  soilC: number;
  salt: number;
}

/** How far (tiles) from a building the kit's catchment reaches: the readings are of the water and land beside the town, not of a big map's far reaches. */
const KIT_REACH = 12;

/** 1 for every tile within KIT_REACH of a building (roads aside), or null before anything is built. */
function townReach(s: GameState): Uint8Array | null {
  const g = s.grid;
  const mask = new Uint8Array(g.kind.length);
  let any = false;
  for (const b of s.buildings) {
    if (b.type === 'road') continue;
    any = true;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) mask[y * g.w + x] = 1;
  }
  return any ? dilate(mask, g.w, g.h, KIT_REACH) : null;
}

function inputs(s: GameState, site: KitSite): Inputs {
  const g = s.grid;
  const reach = townReach(s);
  let idx: number[] = [];
  for (let i = 0; i < g.kind.length; i++) {
    const k = g.kind[i];
    if (site === 'estuary' ? k === TileKind.Estuary : k === TileKind.River || k === TileKind.Wetland) idx.push(i);
  }
  if (reach) {
    const near = idx.filter((i) => reach[i] === 1);
    if (near.length > 0) idx = near;
  }
  let poll = 0, soilC = 0;
  for (const i of idx) {
    poll += g.waterPollution[i] ?? 0;
    // Contamination on the bank beside the water: the mean over the 8 neighbours.
    const x = i % g.w, y = Math.floor(i / g.w);
    let sc = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
      sc += g.soilContamination[yy * g.w + xx] ?? 0;
      n++;
    }
    soilC += sc / Math.max(1, n);
  }
  const m = Math.max(1, idx.length);
  poll /= m;
  soilC /= m;
  let runoff = 0;
  for (const k of Object.keys(s.flags)) {
    if (k.startsWith('runoff.') && typeof s.flags[k] === 'number') runoff += s.flags[k] as number;
  }
  let farms = 0, filters = 0, outfalls = 0;
  for (const b of workingBuildings(s)) {
    if (b.type === 'farm') farms += 1;
    else if (b.type === 'dripfarm') farms += 0.6;
    else if (b.type === 'wetland') filters += 1;
    else if (b.type === 'sewagetreatment') filters += 1.5;
    else if (b.type === 'outfall') outfalls += 1;
  }
  let bush = 0;
  for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === TileKind.Bush) bush++;
  // The share of bush lost is measured against the bush of the area the kit was calibrated on (a bigger map has far more bush for
  // the same town to clear), like the Environment meter's.
  const area = g.w * g.h;
  const refShare = Math.min(1, (getScenario(s.scenarioId).landReachTiles ?? area) / area);
  const bushLost = s.initialBushTiles > 0 ? clamp01((1 - bush / s.initialBushTiles) / refShare) : 0;
  let hSum = 0, hN = 0;
  for (let i = 0; i < g.kind.length; i++) {
    const k = g.kind[i];
    if ((k === TileKind.Land || k === TileKind.Bush || k === TileKind.Beach || k === TileKind.Estuary) && (!reach || reach[i] === 1)) { hSum += g.health[i] ?? 0; hN++; }
  }
  const localHealth = hN > 0 ? hSum / hN : meanHealth(s);
  const flowLow = (100 - capStocks(s).flow) / 100;
  const nutr = clamp01((poll * 0.7 + runoff * 4 + farms * 0.03 + outfalls * 0.1 - filters * 0.05) / 1.6);
  const sed = clamp01(poll * 0.4 + bushLost * 0.5 + runoff * 3 + flowLow * 0.2 - localHealth * 0.5);
  const aquifer = getScenario(s.scenarioId).mechanics?.includes('outback') ? mechMetric(s, 'aquifer') : null;
  const salt = (REGION[s.scenarioId] === 'inland' ? 700 : 320) + 700 * flowLow + farms * (REGION[s.scenarioId] === 'inland' ? 60 : 25) + nutr * 200 + (aquifer !== null ? 900 * (1 - clamp01(aquifer / 100)) : 0);
  return { tiles: idx.length, poll, runoff, nutr, sed, flowLow, soilC, salt };
}

const verdictOf = (v: number, lo: number | null, hi: number | null): Verdict => (hi !== null && v > hi ? 'high' : lo !== null && v < lo ? 'low' : 'ok');

/** Take a reading. `year` is the calendar year printed on it; the numbers depend on the map, with a small fixed wobble from the year. */
export function sampleWater(s: GameState, site: KitSite, auto = false): KitReading {
  const inp = inputs(s, site);
  const tr: Triggers = TRIGGERS[REGION[s.scenarioId]];
  const wob = (salt: number, amp: number): number => ((hash32(s.seed, s.year, salt) % 2001) / 1000 - 1) * amp;
  const bump = Math.max(0, 1 - Math.abs(inp.nutr - 0.45) / 0.2);
  const heat = Math.max(0, s.tempC);
  const doPct = clamp(98 - 62 * inp.nutr - 14 * inp.sed - 4 * heat - 10 * inp.flowLow + 14 * bump + wob(1, 1.5), 18, 118);
  const tn = Math.max(60, 160 + 1250 * inp.nutr + wob(2, 12));
  const tp = Math.max(4, 10 + 120 * inp.nutr + 25 * inp.sed + wob(3, 1.5));
  const turb = Math.max(1, 4 + 90 * inp.sed + wob(4, 1.2));
  const ph = clamp((REGION[s.scenarioId] === 'inland' ? 7.8 : 7.4) - 1.3 * clamp01(inp.soilC / 1.6) - 0.5 * clamp01(inp.poll / 1.8) + 0.4 * bump + wob(5, 0.05), 3.8, 9.2);
  const ec = Math.max(60, inp.salt + wob(6, 25));
  const tidal = site === 'estuary';
  const ind = (id: KitIndicator['id'], label: string, value: number, unit: string, trigger: string, lo: number | null, hi: number | null, judge = true): KitIndicator =>
    ({ id, label, value: id === 'ph' ? Math.round(value * 10) / 10 : Math.round(value), unit, trigger, lo, hi, verdict: judge ? verdictOf(value, lo, hi) : 'ok' });
  const indicators: KitIndicator[] = [
    ind('do', 'Dissolved oxygen', doPct, '% saturation', `${tr.doLo} to ${tr.doHi}% saturation`, tr.doLo, tr.doHi),
    ind('tn', 'Total nitrogen', tn, 'ug/L', `${tr.tn} ug/L or less`, null, tr.tn),
    ind('tp', 'Total phosphorus', tp, 'ug/L', `${tr.tp} ug/L or less`, null, tr.tp),
    ind('turb', 'Turbidity', turb, 'NTU', `${tr.turbLo} to ${tr.turbHi} NTU`, null, tr.turbHi),
    ind('ph', 'pH', ph, '', `${tr.phLo} to ${tr.phHi}`, tr.phLo, tr.phHi),
    tidal
      ? { id: 'ec', label: 'Conductivity', value: Math.round(ec * 12 + 30000), unit: 'uS/cm', trigger: 'Tidal: not judged', lo: null, hi: null, verdict: 'ok' }
      : ind('ec', 'Conductivity (salt)', ec, 'uS/cm', `${tr.ecLo} to ${tr.ecHi} uS/cm`, tr.ecLo, tr.ecHi),
  ];

  // Overall health 0..100 from how far each reading is from its trigger.
  const doStress = clamp01((tr.doLo - doPct) / 50) + clamp01((doPct - tr.doHi) / 40) * 0.4;
  const phStress = clamp01((tr.phLo - ph) / 2) + clamp01((ph - tr.phHi) / 2);
  const ecStress = tidal ? 0 : clamp01((ec - tr.ecHi) / 2000);
  const health = Math.round(100 * (1 - clamp01(0.42 * inp.nutr + 0.28 * inp.sed + 0.15 * clamp01(doStress) + 0.1 * clamp01(phStress) + 0.05 * ecStress)));
  const H = health / 100;

  const bugs: KitBug[] = BUGS.map((b) => {
    const thr = Math.max(0, (b.grade - 2) * 0.085);
    const sens = clamp01((H - thr) / (1 - thr));
    const tol = (10 - b.grade) / 9;
    const boom = b.grade <= 3 ? tol * (1 - H) * 1.8 : 0;
    const jitter = (hash32(s.seed, 40 + b.grade, b.base) % 3) - 1;
    const count = Math.max(0, Math.round(b.base * (Math.pow(sens, 0.8) + boom)) + (sens > 0.05 || boom > 0.2 ? jitter : 0));
    return { id: b.id, name: b.name, grade: b.grade, count };
  });
  let sg = 0, sc = 0;
  for (const b of bugs) { sg += b.grade * b.count; sc += b.count; }
  const signal = sc > 0 ? r1(sg / sc) : 0;
  return { year: s.year, act: s.phase === 'act1' ? 1 : 2, site, ...(auto ? { auto: true } : {}), indicators, bugs, signal, health, tiles: inp.tiles };
}

/** The SIGNAL band for a score. */
export function signalBand(score: number): { label: string; tone: 'good' | 'mild' | 'poor' | 'bad'; text: string } {
  if (score >= 6) return { label: 'Healthy', tone: 'good', text: 'Many sensitive bugs. The stream is in good shape.' };
  if (score >= 5) return { label: 'Mild pollution', tone: 'mild', text: 'Some sensitive bugs are missing. Something is stressing the stream.' };
  if (score >= 4) return { label: 'Moderate pollution', tone: 'poor', text: 'Mostly tolerant bugs. The stream is clearly stressed.' };
  return { label: 'Severe pollution', tone: 'bad', text: 'Only the toughest bugs are left.' };
}

export function trendOf(base: number, now: number): Trend {
  return now - base >= TREND_BAND ? 'better' : base - now >= TREND_BAND ? 'worse' : 'same';
}

/** The creek's current bug score and health, without spending anything (used as the baseline for a prediction). */
export function currentCreek(s: GameState): { signal: number; health: number; site: KitSite } | null {
  const sites = kitSites(s);
  const site = sites[0];
  if (!site) return null;
  const r = sampleWater(s, site, true);
  return { signal: r.signal, health: r.health, site };
}

export function openPrediction(s: GameState): KitPrediction | null {
  const p = learnOf(s).predictions;
  const last = p[p.length - 1];
  return last && last.resolvedYear === undefined ? last : null;
}

/** Closes any prediction whose time is up with a free survey (mutates a state the caller already cloned). */
export function stepLearn(s: GameState): void {
  const L = s.learn;
  if (!L) return;
  const open = L.predictions[L.predictions.length - 1];
  if (!open || open.resolvedYear !== undefined) return;
  const due = s.phase === 'act1' ? s.year > open.year : s.year >= open.year + 10 || s.phase !== 'act2';
  if (!due) return;
  closePrediction(s, L, open, false);
}

function closePrediction(s: GameState, L: LearnState, p: KitPrediction, fromTest: boolean, reading?: KitReading): void {
  const site = reading?.site ?? kitSites(s)[0];
  if (!site) return;
  const r = reading ?? sampleWater(s, site, true);
  if (!fromTest) L.kit = [...L.kit, r].slice(-KEEP_READINGS);
  p.resolvedYear = s.year;
  p.resultSignal = r.signal;
  p.resultHealth = r.health;
  p.actual = trendOf(p.baseSignal, r.signal);
}

function fail(state: GameState, code: NonNullable<ActionResult['code']>, reason: string): { state: GameState; result: ActionResult } {
  return { state, result: { ok: false, code, reason } };
}

/** Applies a learning action. Works in any phase (reflections are written at the end of the game). */
export function applyLearn(state: GameState, a: LearnAction): { state: GameState; result: ActionResult } {
  const next = cloneState(state);
  const L: LearnState = next.learn ?? emptyLearn();
  next.learn = L;
  switch (a.op) {
    case 'test': {
      const can = canTest(state);
      if (!can.ok) return fail(state, state.budget < KIT_COST ? 'no-funds' : 'already-done', can.reason ?? 'Not now');
      const sites = kitSites(state);
      const site = a.site && sites.includes(a.site) ? a.site : sites[0]!;
      const reading = sampleWater(state, site);
      L.kit = [...L.kit, reading].slice(-KEEP_READINGS);
      L.lastTest = testPeriod(state);
      next.budget -= KIT_COST;
      const open = openPrediction(next);
      if (open && state.year > open.year) closePrediction(next, L, open, true, reading);
      next.version = state.version + 1;
      return { state: next, result: { ok: true, spent: KIT_COST } };
    }
    case 'predict': {
      if (state.phase !== 'act1' && state.phase !== 'act2') return fail(state, 'not-open', 'Predictions are made while the town is running.');
      const cur = currentCreek(state);
      if (!cur) return fail(state, 'nothing-here', 'There is no water here to predict.');
      const text = (a.text ?? '').trim().slice(0, 140);
      if (!a.choice && !text) return fail(state, 'invalid', 'Pick better, same or worse, or write a line.');
      const open = openPrediction(next);
      if (open && open.year === state.year) {
        open.choice = a.choice ?? open.choice;
        open.text = text || open.text;
      } else {
        L.predictions = [...L.predictions, { year: state.year, baseSignal: cur.signal, baseHealth: cur.health, ...(a.choice ? { choice: a.choice } : {}), ...(text ? { text } : {}) }].slice(-30);
      }
      next.version = state.version + 1;
      return { state: next, result: { ok: true } };
    }
    case 'reflect': {
      L.reflections = { ...L.reflections, [a.key.slice(0, 200)]: a.text.slice(0, 1200) };
      next.version = state.version + 1;
      return { state: next, result: { ok: true } };
    }
    case 'letter': {
      L.letter = a.text.slice(0, 3000);
      next.version = state.version + 1;
      return { state: next, result: { ok: true } };
    }
    case 'household': {
      const set = new Set(L.household);
      if (a.on) set.add(a.id); else set.delete(a.id);
      L.household = Array.from(set);
      next.version = state.version + 1;
      return { state: next, result: { ok: true } };
    }
    case 'term': {
      if (L.terms.includes(a.id)) return { state, result: { ok: true } };
      L.terms = [...L.terms, a.id];
      next.version = state.version + 1;
      return { state: next, result: { ok: true } };
    }
  }
}

/** Kit readings as CSV rows for the graphs export. */
export function kitCSV(s: GameState): string {
  const L = s.learn;
  if (!L || L.kit.length === 0) return '';
  const head = ['year', 'site', 'source', 'do_pct_sat', 'total_n_ug_l', 'total_p_ug_l', 'turbidity_ntu', 'ph', 'conductivity_us_cm', 'signal2_score', 'health_0_100', 'prediction', 'prediction_text', 'actual'];
  const rows = L.kit.map((r) => {
    const v = (id: string): string => String(r.indicators.find((i) => i.id === id)?.value ?? '');
    const p = L.predictions.find((x) => x.resolvedYear !== undefined && x.resolvedYear === r.year);
    const q = (t: string): string => `"${t.replace(/"/g, '""')}"`;
    return [r.year, r.site, r.auto ? 'free survey' : 'test', v('do'), v('tn'), v('tp'), v('turb'), v('ph'), v('ec'), r.signal, r.health, p?.choice ?? '', p?.text ? q(p.text) : '', p?.actual ?? ''].join(',');
  });
  return ['', 'Water field kit readings', head.join(','), ...rows].join('\n') + '\n';
}
