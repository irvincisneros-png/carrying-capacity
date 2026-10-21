/**
 * Net-zero outlook (pure reads): where this year's emissions come from, which source is the biggest lever right
 * now, and when the town reaches its net-zero line at the pace it is cutting. Recomputed from the buildings that
 * stand today, so it moves the moment the player builds, retrofits or retires something.
 */
import { BUILDINGS } from './buildings';
import { circularMods, wasteEmissionsMult } from './circular';
import { REPURPOSE } from '../content/circular';
import { balanceGrid } from './energy';
import { mechEmissionFactor } from './mechanics';
import { assumeRoads, commuteStats, workingBuildings } from './roads';
import { availability } from './rules';
import { co2Of } from './upgrades';
import { getScenario } from './scenarios';
import { seasonIndexOf } from './season';
import type { BuildingId, GameState, Season } from './types';

export type SourceKey = 'coal' | 'gas' | 'homes' | 'industry' | 'mines' | 'traffic' | 'commute' | 'waste' | 'farms' | 'other';

export interface SourceRow {
  key: SourceKey;
  label: string;
  /** A few words for the narrow Goals panel. */
  short: string;
  /** kt CO2-e a year at today's buildings. */
  kt: number;
  /** Buildings behind it. */
  n: number;
  /** What brings it down, in one line. */
  lever: string;
  /** Set when the fix is not open yet (e.g. 'Old sites opens in 2032'). */
  waitsFor?: string;
}

export interface OrderStep {
  text: string;
  done: boolean;
}

export interface NetZeroOutlook {
  /** The net-zero line (kt a year) and the year it must be reached by. */
  line: number;
  byYear: number;
  /** This year's emissions if nothing changes (kt). */
  nowKt: number;
  rows: SourceRow[];
  /** The biggest source that can be cut now (not waiting on a later tier). */
  lever: SourceRow | null;
  /** kt a year the town must cut, on average, from now to make the deadline. */
  need: number;
  /** kt a year the town has cut on average over the last few years (counting what was just built), or null early on. */
  pace: number | null;
  /** Year the line is reached at that pace, or null (no pace yet / not falling). */
  projected: number | null;
  /** True once this year's buildings put the town at or under the line. */
  atLine: boolean;
  order: OrderStep[];
  /** The next fossil plant to retire (coal before gas) and whether the grid already holds without it. */
  retire: RetirePlan | null;
  /** The cheapest cuts per $ right now (lowest $k per kt a year first), the same figure the build cards show. */
  value: ValueRow[];
}

export interface ValueRow {
  label: string;
  /** kt a year one more of it cuts, and $k per kt. */
  kt: number;
  perKt: number;
  cost: number;
}

export interface RetirePlan {
  type: BuildingId;
  uid: number;
  /** True when the four seasons, day and night, are covered without the plant. */
  safe: boolean;
  /** When not safe: about how much to build first, and what it costs ($k). */
  roof: number;
  battery: number;
  cost: number;
  /** The recipe could not be found within a sensible number of buildings. */
  open: boolean;
}

/** Worst shortfall (share of that block's demand) over the four seasons for a set of buildings, and what is behind it. */
export function gridShortfall(s: GameState, buildings: readonly GameState['buildings'][number][]): { worst: number; when: 'by day' | 'at night' | ''; spareByDay: number; nightGap: number } {
  const without: GameState = assumeRoads({ ...s, buildings: buildings.slice() });
  const base = seasonIndexOf(s) - s.a2.season;
  let worst = 0, when: 'by day' | 'at night' | '' = '', spareByDay = 0, nightGap = 0;
  for (let k = 0; k < 4; k++) {
    const probe: GameState = { ...without, a2: { ...without.a2, season: k as Season } };
    const r = balanceGrid(probe, base + k).report;
    for (const [lbl, b] of [['by day', r.day], ['at night', r.night]] as const) {
      const short = b.demand > 0 ? b.unmet / b.demand : 0;
      if (short > worst) {
        worst = short; when = lbl;
        // Daytime power beyond demand: what is stored (batteries already built) plus what is wasted for want of storage.
        spareByDay = Math.max(0, r.day.charged + r.day.curtailed);
        nightGap = r.night.unmet;
      }
    }
  }
  return { worst, when, spareByDay, nightGap };
}

const BLACKOUT_SHARE = 0.01;

/**
 * What it takes to retire a fossil plant (the next one: coal first, then gas, or the one with `uid`): safe already, or
 * roughly how many rooftop solar panels and grid batteries to build first. Solar first until there is spare daytime power,
 * then batteries to carry it into the night (the same rule the demolish tooltip gives).
 */
export function retirePlan(s: GameState, uid?: number): RetirePlan | null {
  if (s.phase !== 'act2' || !s.a2?.lastGrid) return null;
  const plants = [...s.buildings.filter((b) => b.type === 'coalpower'), ...s.buildings.filter((b) => b.type === 'gaspower')];
  const target = uid !== undefined ? plants.find((b) => b.uid === uid) : plants[0];
  if (!target) return null;
  const rest = s.buildings.filter((b) => b.uid !== target.uid);
  let cur = gridShortfall(s, rest);
  if (cur.worst <= BLACKOUT_SHARE) return { type: target.type, uid: target.uid, safe: true, roof: 0, battery: 0, cost: 0, open: false };
  const roofCost = availability(s.scenarioId, 'rooftopsolar').cost;
  const batCost = availability(s.scenarioId, 'battery').cost;
  const extra: GameState['buildings'] = [];
  let roof = 0, battery = 0;
  const mk = (type: BuildingId): GameState['buildings'][number] => ({ uid: -1, type, x: 0, y: 0, rotation: 0, w: BUILDINGS[type].w, h: BUILDINGS[type].h, builtYear: s.year });
  for (let i = 0; i < 90 && cur.worst > BLACKOUT_SHARE; i++) {
    // Try both a batch of rooftop solar and one battery; keep whichever closes more of the gap (solar when they tie:
    // a battery with no spare daytime power to store does nothing).
    const solar = [...extra]; for (let k = 0; k < 5; k++) solar.push(mk('rooftopsolar'));
    const withSolar = gridShortfall(s, [...rest, ...solar]);
    const stored = [...extra, mk('battery')];
    const withBattery = gridShortfall(s, [...rest, ...stored]);
    if (withBattery.worst < withSolar.worst - 1e-6) { extra.splice(0, extra.length, ...stored); battery++; cur = withBattery; } else { extra.splice(0, extra.length, ...solar); roof += 5; cur = withSolar; }
  }
  return { type: target.type, uid: target.uid, safe: false, roof, battery, cost: roof * roofCost + battery * batCost, open: cur.worst > BLACKOUT_SHARE };
}

const GROUP: Partial<Record<BuildingId, SourceKey>> = {
  suburb: 'homes', cottage: 'homes', greensuburb: 'homes',
  factory: 'industry', steelworks: 'industry', greensteel: 'industry',
  coalmine: 'mines',
  carpark: 'traffic', road: 'traffic', rail: 'traffic', port: 'traffic', excavation: 'traffic', transitline: 'traffic', windport: 'traffic',
  landfill: 'waste', recycler: 'waste', sewagetreatment: 'waste', outfall: 'waste',
  farm: 'farms', dripfarm: 'farms',
};

/** kt a year from each source, at today's buildings (power from a year of grid dispatch with today's capacity). */
export function emissionSources(s: GameState): SourceRow[] {
  const sc = getScenario(s.scenarioId);
  const sum: Record<SourceKey, { kt: number; n: number }> = {
    coal: { kt: 0, n: 0 }, gas: { kt: 0, n: 0 }, homes: { kt: 0, n: 0 }, industry: { kt: 0, n: 0 }, mines: { kt: 0, n: 0 },
    traffic: { kt: 0, n: 0 }, commute: { kt: 0, n: 0 }, waste: { kt: 0, n: 0 }, farms: { kt: 0, n: 0 }, other: { kt: 0, n: 0 },
  };
  const wasteK = s.phase === 'act2' ? wasteEmissionsMult(s) : 1;
  const cm = commuteStats(s);
  sum.commute.kt = cm.ktPerDecade / 10;
  let oldHomes = 0;
  for (const b of workingBuildings(s)) {
    const def = BUILDINGS[b.type];
    if (b.type === 'coalpower') { sum.coal.n++; continue; }
    if (b.type === 'gaspower') { sum.gas.n++; continue; }
    if (def.category === 'power' || def.co2 <= 0) continue;
    const key = GROUP[b.type] ?? 'other';
    const kt = (co2Of(b) / 10) * mechEmissionFactor(s, b) * (def.category === 'waste' ? wasteK : 1);
    sum[key].kt += kt;
    if (b.type === 'suburb') oldHomes++;
    if (key !== 'homes') sum[key].n++;
  }
  sum.homes.n = oldHomes;
  // A year of grid dispatch with what is built today, split between coal and gas by what they generate.
  if (sum.coal.n + sum.gas.n > 0) {
    const base = seasonIndexOf(s) - s.a2.season;
    // One row for both: solar displaces gas before coal (gas is the peaker), so split rows would hide the effect.
    let total = 0;
    for (let k = 0; k < 4; k++) {
      const probe: GameState = { ...s, a2: { ...s.a2, season: k as Season } };
      total += balanceGrid(probe, base + k).report.emissionsKt;
    }
    sum.coal.kt = total;
  }
  const circularOpen = s.circular.unlocked;
  const circularYear = sc.act2.circularYear ?? 2050;
  const rows: SourceRow[] = [];
  const SHORT: Record<SourceKey, string> = {
    coal: 'Power stations', gas: 'Gas power', homes: oldHomes > 0 ? `Homes (${oldHomes} old)` : 'Homes', industry: 'Factories',
    mines: 'Mines', traffic: 'Traffic', commute: 'Commuting', waste: 'Waste', farms: 'Farms', other: 'Other',
  };
  const add = (key: SourceKey, label: string, lever: string, waitsFor?: string): void => {
    const v = sum[key];
    if (v.kt < 0.05) return;
    rows.push({ key, label, short: SHORT[key], kt: Math.round(v.kt * 10) / 10, n: v.n, lever, ...(waitsFor ? { waitsFor } : {}) });
  };
  const plants = sum.coal.n + sum.gas.n;
  add('coal', `${sum.coal.n > 0 && sum.gas.n > 0 ? 'Coal and gas' : sum.coal.n > 0 ? 'Coal' : 'Gas'} power (${plants} station${plants === 1 ? '' : 's'})`,
    'Build clean power that covers the night too: solar by day, batteries to carry spare daytime power into the evening, and wind (offshore from 2040) that keeps turning after dark. When the Power panel shows no coal or gas at night, retire the plants with Old sites, one at a time.');
  add('homes', `Homes${oldHomes > 0 ? ` (${oldHomes} brick suburbs not retrofitted)` : ''}`,
    oldHomes > 0 ? 'Retrofit each brick suburb (build Green retrofit on it): insulation, heat pumps, solar. It takes years at a few a year: start early.' : 'Already retrofitted: little left here.');
  add('industry', 'Factories and steelworks',
    'Turn them into recycling plants or green steel with Old sites. Save up: it costs more than a building.',
    circularOpen ? undefined : `Old sites opens around ${circularYear}`);
  add('mines', 'Mines', 'Close the mines (Old sites) once the town has other jobs.');
  add('traffic', 'Traffic and freight', 'Transit lines move people out of cars: each line serves about 900 people.');
  add('commute', 'Commuting to work', 'Keep homes close to jobs along short roads, and build light rail: each line cuts commuting emissions by about an eighth.');
  add('waste', 'Waste', 'Recycling research and composting (Old sites) cut landfill gas.');
  add('farms', 'Farms and land', 'Small: efficient farms and restored bush help a little.');
  add('other', 'Everything else', 'Small sources spread across the town.');
  return rows.sort((a, b) => b.kt - a.kt);
}

const NZ_KEY = 'nz.';
const NZ_KEEP = 6;

/**
 * Called at each Act 2 year end in scenarios with a net-zero line: remembers the buildings' yearly emissions (without
 * one-off spikes such as taking a power station apart) for the last few years, so the pace is not thrown by a spike.
 */
export function recordOutlook(s: GameState): void {
  if (getScenario(s.scenarioId).act2.netZeroKt === undefined) return;
  const kt = emissionSources(s).reduce((a, r) => a + r.kt, 0);
  s.flags[`${NZ_KEY}${s.year}`] = Math.round(kt * 10) / 10;
  const old = `${NZ_KEY}${s.year - NZ_KEEP}`;
  if (old in s.flags) delete s.flags[old];
}

/** Linear-fit slope (kt per year, positive = falling) of the last few years' building emissions, ending with `nowKt`. */
function cuttingPace(s: GameState, nowKt: number, n = 5): number | null {
  const pts: { x: number; v: number }[] = [];
  for (let y = s.year - n + 1; y < s.year; y++) {
    const v = s.flags[`${NZ_KEY}${y}`];
    if (typeof v === 'number') pts.push({ x: y, v });
  }
  if (pts.length < 2) return null;
  pts.push({ x: s.year, v: nowKt });
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const mv = pts.reduce((a, p) => a + p.v, 0) / pts.length;
  let num = 0, den = 0;
  for (const p of pts) { num += (p.x - mx) * (p.v - mv); den += (p.x - mx) ** 2; }
  return den > 0 ? -num / den : null;
}

/** The best-value ways to cut emissions at today's buildings: clean-power builds, retrofits, transit, and (once open) turning a factory into a recycling plant. */
export function bestValue(s: GameState, max = 4): ValueRow[] {
  const rows: ValueRow[] = [];
  const total = (st: GameState): number => emissionSources(assumeRoads(st)).reduce((a, r) => a + r.kt, 0);
  for (const id of ['transitline', 'greensuburb', 'rooftopsolar', 'solarfarm', 'windfarm', 'offshorewind'] as const) {
    const av = availability(s.scenarioId, id);
    if (av.disabled || BUILDINGS[id].unlock > s.year) continue;
    const c = cutPerBuild(s, id, av.cost);
    if (c) rows.push({ label: av.name ?? BUILDINGS[id].name, kt: c.kt, perKt: c.perKt, cost: av.cost });
  }
  if (s.circular.unlocked) {
    const item = s.circular.items.find((i) => i.type === 'factory' && i.status === 'standing');
    const opt = REPURPOSE.factory?.find((o) => o.into === 'recycler');
    const k = item ? s.buildings.findIndex((b) => b.uid === item.uid) : -1;
    if (item && opt && k >= 0) {
      const buildings = s.buildings.slice();
      buildings[k] = { ...(buildings[k] as GameState['buildings'][number]), type: 'recycler' };
      const kt = total(s) - total({ ...s, buildings });
      const cost = Math.round(opt.cost * circularMods(s).repurposeCost);
      if (kt >= 0.05) rows.push({ label: 'Factory into a recycling plant (Old sites)', kt: Math.round(kt * 10) / 10, perKt: Math.round(cost / kt), cost });
    }
  }
  return rows.sort((a, b) => a.perKt - b.perKt).slice(0, max);
}

export function netZeroOutlook(s: GameState): NetZeroOutlook | null {
  const sc = getScenario(s.scenarioId);
  const line = sc.act2.netZeroKt;
  const obj = sc.act2.objectives.find((o) => o.metric === 'netZeroYear');
  if (line === undefined || !obj || s.phase === 'act1') return null;
  const rows = emissionSources(s);
  const nowKt = Math.round(rows.reduce((a, r) => a + r.kt, 0) * 10) / 10;
  const byYear = obj.target;
  const yearsLeft = Math.max(1, byYear - s.year);
  const need = Math.max(0, (nowKt - line) / yearsLeft);
  const atLine = nowKt <= line;
  const p = cuttingPace(s, nowKt);
  const pace = p === null ? null : Math.round(p * 10) / 10;
  const projected = atLine ? s.year : pace !== null && pace > 0.2 ? s.year + Math.ceil((nowKt - line) / pace) : null;
  const lever = rows.find((r) => !r.waitsFor && r.kt >= 1 && !(r.key === 'homes' && !/not retrofitted/.test(r.label))) ?? null;
  const has = (k: SourceKey): SourceRow | undefined => rows.find((r) => r.key === k);
  const transit = s.buildings.filter((b) => b.type === 'transitline').length;
  const oldHomes = has('homes')?.label.includes('not retrofitted') ?? false;
  const order: OrderStep[] = [
    { text: 'Clean power first: solar, wind and batteries until the night is covered, then retire coal and gas', done: !s.buildings.some((b) => b.type === 'coalpower' || b.type === 'gaspower') },
  ];
  if (oldHomes || (has('traffic')?.kt ?? 0) >= 3) {
    order.push({
      text: 'Start the slow ones early, a few each year: retrofit the brick suburbs and build transit lines',
      done: !oldHomes && (has('traffic')?.kt ?? 0) < 6 && transit > 0,
    });
  }
  if (has('industry') || s.buildings.some((b) => b.type === 'factory' || b.type === 'steelworks')) {
    order.push({
      text: s.circular.unlocked ? 'Turn the factories into recycling plants (Old sites), one or two a year so no single year spikes'
        : `When Old sites opens (around ${sc.act2.circularYear ?? 2050}), turn the factories into recycling plants: save up for it`,
      done: !has('industry'),
    });
  }
  if (has('mines')) order.push({ text: 'Close the mines (Old sites) as soon as the town has other jobs', done: false });
  let retire: RetirePlan | null = null;
  try { retire = s.phase === 'act2' ? retirePlan(s) : null; } catch { retire = null; }
  let value: ValueRow[] = [];
  try { value = s.phase === 'act2' && !atLine ? bestValue(s) : []; } catch { value = []; }
  return { line, byYear, nowKt, rows, lever, need: Math.round(need * 10) / 10, pace, projected, atLine, order, retire, value };
}

/**
 * Cost-effectiveness of one more building of a type, at today's buildings: kt a year it would cut and $k per kt.
 * Only in scenarios with a net-zero line, in Act 2. A retrofit (a type that `replaces` another) swaps the first
 * building it would replace. Null when it cuts nothing measurable (parks, cooling centres) or cannot be placed.
 */
export function cutPerBuild(s: GameState, type: BuildingId, cost: number): { kt: number; perKt: number } | null {
  if (getScenario(s.scenarioId).act2.netZeroKt === undefined || s.phase !== 'act2') return null;
  const def = BUILDINGS[type];
  let buildings = s.buildings;
  if (def.replaces) {
    const k = s.buildings.findIndex((b) => b.type === def.replaces);
    if (k < 0) return null;
    buildings = s.buildings.slice();
    const old = buildings[k] as (typeof buildings)[number];
    buildings[k] = { ...old, type };
  } else {
    buildings = [...s.buildings, { uid: -1, type, x: 0, y: 0, rotation: 0, w: def.w, h: def.h, builtYear: s.year }];
  }
  const total = (st: GameState): number => emissionSources(assumeRoads(st)).reduce((a, r) => a + r.kt, 0);
  const kt = total(s) - total({ ...s, buildings });
  if (!(kt >= 0.05)) return null;
  return { kt: Math.round(kt * 10) / 10, perKt: Math.round(cost / kt) };
}
