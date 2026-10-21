/**
 * The carrying capacity meter (Round 6, WP8a).
 *
 * Carrying capacity: how much a place can supply every year, for as long as it likes, without running itself down.
 * Overshoot: using more than that. This module reads the town and the land and sets what the town USES each year
 * against what the land RENEWS, for five things: water, food from farmland, timber and fish, energy, and the CO2 and
 * waste the land and sea can absorb. It is pure (no randomness, no DOM) and cheap, so the HUD can call it every frame.
 *
 * Overshoot has a modest, deterministic effect on three stocks kept in `flags` (so old saves load, with every stock
 * at 100): creek flow (`cc.flow`), fish (`cc.fish`) and soil fertility (`cc.soil`). Each year a stock falls if the
 * lines that feed it are over the line, and recovers slowly when they are not. A lower stock then lowers what that
 * line renews (a thin creek supplies less, tired soil grows less), which is how overshoot snowballs. The knock-ons to
 * the rest of the sim are small on purpose: a little extra dirt in a low creek, a small cut to income from tired
 * soil, and fewer fish in the rough fish guide.
 *
 * Units are "capacity units" a year, invented for the game: they only mean something against each other.
 */
import { capProfile } from '../content/capacity';
import { BUILDINGS } from './buildings';
import { applyTileEffect } from './effects';
import { economySnapshot, GRID_YEAR } from './economy';
import { commuteStats, workingBuildings } from './roads';
import { getScenario } from './scenarios';
import { co2Of } from './upgrades';
import { TileKind } from './types';
import type { BuildingId, GameState } from './types';

export type CapId = 'water' | 'food' | 'harvest' | 'energy' | 'carbon';
export type CapStatus = 'ok' | 'tight' | 'over';

export interface CapLine {
  id: CapId;
  label: string;
  /** What the town uses in a year, and what the land renews (or absorbs), in capacity units (kt CO2 for carbon). */
  use: number;
  renew: number;
  /** use / renew, capped at 3. Above 1 is overshoot (energy is judged a little more gently, see CAP.energyOver). */
  ratio: number;
  status: CapStatus;
  /** True where the place gets this from outside its map (a city's water and food): shown, but not counted as overshoot here. */
  external?: boolean;
  /** Plain-English reading for the tooltip and panel, with the biggest cause named. */
  note: string;
  /** What the line is made of (for the panel). */
  parts: string;
}

export interface CapStocks {
  /** 0..100, 100 = the creek runs as the land would make it run. */
  flow: number;
  fish: number;
  soil: number;
}

export interface CapacityReport {
  lines: CapLine[];
  /** The line furthest over (or closest to) the line. */
  worst: CapLine;
  /** How many lines are over. */
  over: number;
  status: CapStatus;
  stocks: CapStocks;
}

/** Tuning. Calibrated against the scripted players (tests/capacity.test.ts records the results). */
export const CAP = {
  // water
  waterPerPerson: 0.5,
  waterFarm: 14,
  waterDripFarm: 7,
  waterIndustry: { factory: 10, steelworks: 22, coalpower: 18, coalmine: 6, gaspower: 4, resort: 10, port: 4 } as Partial<Record<BuildingId, number>>,
  waterRiver: 6,
  waterWetland: 4,
  waterEstuary: 3,
  waterBush: 0.6,
  waterLand: 0.15,
  waterReservoir: 25,
  waterBuiltWetland: 8,
  waterRecycled: 12,
  waterRegrown: 0.6,
  // food
  foodPerPerson: 0.2,
  foodFarm: 12,
  foodDripFarm: 18,
  foodLand: 0.5,
  foodBush: 0.15,
  // timber and fish
  woodPerPerson: 0.1,
  woodPerBuilding: 0.15,
  woodBush: 0.35,
  fishPerPerson: 0.15,
  fishRiver: 1.6,
  fishEstuary: 2.4,
  fishReef: 1.4,
  fishSea: 0.15,
  // carbon: kt CO2 a year absorbed
  sinkBush: 0.15,
  sinkRegrown: 0.1,
  sinkWetland: 0.18,
  sinkBuiltWetland: 0.3,
  sinkSea: 0.004,
  // thresholds
  tight: 0.85,
  /** Energy is judged on how much of the demand renewables cover, so "over" starts a little above full cover. */
  energyOver: 1.25,
  // stocks: yearly change at overshoot, and recovery
  fall: 2,
  fallMax: 4,
  recover: 1.5,
  floor: 40,
  /** The most a stock at its floor can cut what a line renews. */
  stockCut: 0.5,
};

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const r1 = (v: number): number => Math.round(v * 10) / 10;
const num = (s: GameState, k: string, d: number): number => (typeof s.flags[k] === 'number' ? (s.flags[k] as number) : d);

export function capStocks(s: GameState): CapStocks {
  return { flow: clamp(num(s, 'cc.flow', 100), 0, 100), fish: clamp(num(s, 'cc.fish', 100), 0, 100), soil: clamp(num(s, 'cc.soil', 100), 0, 100) };
}

const stockFactor = (stock: number): number => 1 - CAP.stockCut * (1 - clamp(stock, 0, 100) / 100);

/** Land productivity by the look of the place: dry country grows and holds less than a wet valley. */
const BIOME_LAND: Record<string, number> = { temperate: 1, valley: 1.1, 'inland-river': 1, tropical: 0.9, arid: 0.5, urban: 0.7 };

interface Counts {
  kind: Record<number, number>;
  /** Land tiles with nothing built on them (grass, scrub and paddock), bush excluded. */
  openLand: number;
  /** Health-weighted regrowth (Act 2 restoration) on open land. */
  regrown: number;
  /** Mean water pollution over creek and estuary tiles. */
  creekDirt: number;
  n: Record<string, number>;
}

function count(s: GameState): Counts {
  const g = s.grid;
  const kind: Record<number, number> = {};
  let openLand = 0, regrown = 0, dirt = 0, waterN = 0;
  for (let i = 0; i < g.kind.length; i++) {
    const k = g.kind[i] ?? 0;
    kind[k] = (kind[k] ?? 0) + 1;
    if (k === TileKind.Land && (g.building[i] ?? 0) === 0) {
      openLand++;
      if ((g.stage[i] ?? 0) >= 1) regrown += g.health[i] ?? 0;
    }
    if (k === TileKind.River || k === TileKind.Estuary) { dirt += g.waterPollution[i] ?? 0; waterN++; }
  }
  const n: Record<string, number> = {};
  for (const b of workingBuildings(s)) n[b.type] = (n[b.type] ?? 0) + 1;
  return { kind, openLand, regrown, creekDirt: waterN > 0 ? dirt / waterN : 0, n };
}

function statusOf(ratio: number, over = 1): CapStatus {
  return ratio > over ? 'over' : ratio > CAP.tight * over ? 'tight' : 'ok';
}

/** Kilotonnes of CO2-e the town adds in a year right now (a tenth of the decade's figure in Act 1). */
export function yearlyEmissionsKt(s: GameState): number {
  const last = s.a2?.yearly?.[s.a2.yearly.length - 1];
  if (s.phase !== 'act1' && last) return last.totalKt;
  let kt = 0;
  for (const b of workingBuildings(s)) kt += co2Of(b);
  let commute = 0;
  try { commute = commuteStats(s).ktPerDecade; } catch { commute = 0; }
  return (kt + commute) / 10;
}

export function capacityReport(s: GameState): CapacityReport {
  const c = count(s);
  const st = capStocks(s);
  const prof = capProfile(s.scenarioId);
  const land = BIOME_LAND[getScenario(s.scenarioId).biome ?? 'temperate'] ?? 1;
  const pop = s.population;
  const n = (id: BuildingId): number => c.n[id] ?? 0;
  const kinds = (k: number): number => c.kind[k] ?? 0;
  const hasBush = kinds(TileKind.Bush) > 0 || s.initialBushTiles > 0;

  // ---- water
  let waterUse = pop * CAP.waterPerPerson + n('farm') * CAP.waterFarm + n('dripfarm') * CAP.waterDripFarm;
  for (const [id, w] of Object.entries(CAP.waterIndustry)) waterUse += (c.n[id] ?? 0) * (w ?? 0);
  const waterRenew = prof.water * stockFactor(st.flow) * (
    kinds(TileKind.River) * CAP.waterRiver + kinds(TileKind.Wetland) * CAP.waterWetland + kinds(TileKind.Estuary) * CAP.waterEstuary
    + kinds(TileKind.Bush) * CAP.waterBush + c.openLand * CAP.waterLand + c.regrown * CAP.waterRegrown
    + n('reservoir') * CAP.waterReservoir + n('wetland') * CAP.waterBuiltWetland + n('sewagetreatment') * CAP.waterRecycled);
  let waterRatio = waterRenew > 0 ? waterUse / waterRenew : 3;
  let waterNoteExtra = '';
  const takePct = s.phase === 'act1' ? null : getScenario(s.scenarioId).mechanics?.includes('river') ? Math.round(clamp(num(s, 'w.envAvg', 0.9), 0, 1) * 100) : null;
  if (takePct !== null) {
    // River Town: the river is judged on the share of its flow left in it (65% or less is overshoot).
    const take = (100 - takePct) / 35;
    if (take > waterRatio) { waterRatio = take; waterNoteExtra = ` Only ${takePct}% of the river's flow is staying in the river.`; }
  }

  // ---- food
  const foodUse = pop * CAP.foodPerPerson;
  const foodRenew = prof.food * land * stockFactor(st.soil) * (n('farm') * CAP.foodFarm + n('dripfarm') * CAP.foodDripFarm + c.openLand * CAP.foodLand + kinds(TileKind.Bush) * CAP.foodBush);

  // ---- timber and fish: the tighter of the two is the line
  const woodUse = pop * CAP.woodPerPerson + s.buildings.length * CAP.woodPerBuilding;
  const woodRenew = prof.harvest * land * kinds(TileKind.Bush) * CAP.woodBush * stockFactor(st.soil);
  const fishUse = pop * CAP.fishPerPerson;
  const fishRenew = prof.harvest * stockFactor(st.fish) * (
    (kinds(TileKind.River) * CAP.fishRiver + kinds(TileKind.Estuary) * CAP.fishEstuary) * (1 - clamp(c.creekDirt / 1.8, 0, 1))
    + kinds(TileKind.Reef) * CAP.fishReef + kinds(TileKind.Sea) * CAP.fishSea);
  const woodRatio = hasBush ? woodUse / Math.max(0.5, woodRenew) : 0;
  const fishRatio = fishUse / Math.max(0.5, fishRenew);
  const harvestIsFish = fishRatio >= woodRatio;

  // ---- energy: what the sun, wind, water and tides renew against what the town draws
  let eUse = 0, eRenew = 0;
  const gr = s.phase === 'act2' ? s.a2.lastGrid : null;
  if (gr) {
    eUse = gr.demandTotal;
    for (const [src, v] of Object.entries(gr.generation)) {
      if (src !== 'coal' && src !== 'gas' && src !== 'battery') eRenew += v ?? 0;
    }
  } else {
    eUse = s.year >= GRID_YEAR ? economySnapshot(s).powerDemand : 0;
    for (const b of workingBuildings(s)) {
      const e = BUILDINGS[b.type].energy;
      if (e && e.source !== 'coal' && e.source !== 'gas' && e.source !== 'battery') eRenew += e.capacity * 0.35;
    }
  }

  // ---- carbon and waste
  const carbonRenew = prof.carbon * (kinds(TileKind.Bush) * CAP.sinkBush + c.regrown * CAP.sinkRegrown + (kinds(TileKind.Wetland) + kinds(TileKind.Estuary)) * CAP.sinkWetland
    + n('wetland') * CAP.sinkBuiltWetland + (kinds(TileKind.Sea) + kinds(TileKind.Reef) + kinds(TileKind.Beach)) * CAP.sinkSea);
  const carbonUse = yearlyEmissionsKt(s);

  const mk = (id: CapId, label: string, use: number, renew: number, over: number, note: string, parts: string, ratioOverride?: number): CapLine => {
    const raw = ratioOverride ?? (renew > 0 ? use / renew : use > 0 ? 3 : 0);
    const ratio = clamp(raw, 0, 3);
    const external = prof.external?.includes(id) ? true : undefined;
    return { id, label, use: r1(use), renew: r1(renew), ratio: Math.round(ratio * 100) / 100, status: statusOf(ratio, over), ...(external ? { external, note: `${note} This city gets it from far outside the map.` } : { note }), parts };
  };

  const waterTop = pop * CAP.waterPerPerson >= n('farm') * CAP.waterFarm + n('dripfarm') * CAP.waterDripFarm ? 'homes and businesses' : 'irrigated farms';
  const water = mk('water', 'Water', waterUse, waterRenew, 1,
    (waterRatio > 1 ? `The town takes more water than the creek, rain and bushland refill. Biggest user: ${waterTop}.` : 'The creek and the bushland refill what the town takes.') + waterNoteExtra,
    'Used by homes, farms and factories. Renewed by rain running down the creek, wetlands and bushland that soaks it up.', waterRatio);
  const food = mk('food', 'Food and farmland', foodUse, foodRenew, 1,
    foodUse > foodRenew ? 'The town eats more than its farms and paddocks can grow without wearing the soil out.' : 'Farmland and paddocks can grow enough for the people here.',
    'Used by everyone who lives here. Renewed by farms and open land, and only as well as the soil can grow it.');
  const harvest = mk('harvest', harvestIsFish ? 'Fish and timber' : 'Timber and fish', harvestIsFish ? fishUse : woodUse, harvestIsFish ? fishRenew : woodRenew, 1,
    harvestIsFish
      ? (fishRatio > 1 ? 'More fish are caught than the creek, estuary and sea grow back. Dirty water cuts the fish supply too.' : 'The fish are being caught about as fast as they breed.')
      : (woodRatio > 1 ? 'More timber is used than the bush grows back.' : 'The bush grows back the timber the town uses.'),
    'Fish are renewed by breeding in clean creeks, estuaries and reefs. Timber is renewed by bush regrowth. The tighter of the two is shown.');
  const energy = mk('energy', 'Energy', eUse, eRenew, CAP.energyOver,
    eUse <= 0 ? 'No electricity grid yet.' : eRenew * CAP.energyOver >= eUse ? 'Sun, wind and water cover almost all of the town\'s power.'
      : 'Most power comes from coal and gas. Fossil fuels took millions of years to form and do not renew, so burning them draws down a stock.',
    'Used by homes, industry and transport. Only sun, wind, flowing water and tides renew every year.');
  const carbon = mk('carbon', 'CO₂ and waste', carbonUse, carbonRenew, 1,
    carbonUse > carbonRenew ? 'The town adds more CO₂ and waste than the bush, wetlands and sea can absorb, so it builds up in the air.' : 'Plants and the sea absorb what the town adds.',
    'Added by power, industry, transport, land clearing and rubbish. Absorbed by bushland, regrowth, wetlands and the sea.');

  const lines = [water, food, harvest, energy, carbon];
  const score = (l: CapLine): number => l.ratio / (l.id === 'energy' ? CAP.energyOver : 1);
  const local = lines.filter((l) => !l.external);
  const worst = local.reduce((a, b) => (score(b) > score(a) ? b : a), local[0]!);
  const over = local.filter((l) => l.status === 'over').length;
  return { lines, worst, over, status: worst.status, stocks: st };
}

// ---------------------------------------------------------------- yearly step (mutates a state the caller already cloned)

/** How far each stock falls this year (0 = it recovers). Only the stocks this place's overshoot can reach fall. */
function falls(s: GameState, lines: CapLine[]): CapStocks {
  const by = Object.fromEntries(lines.map((l) => [l.id, l])) as Record<CapId, CapLine>;
  const draws = capProfile(s.scenarioId).draws;
  const over = (l: CapLine): number => (l.ratio > 1 && !l.external ? Math.min(CAP.fallMax, CAP.fall * (l.ratio - 1) / 0.25) : 0);
  return {
    flow: draws.flow ? over(by.water) : 0,
    // Fish suffer from over-fishing, and from a sea that takes in far more CO2 than it can absorb.
    fish: draws.fish ? over(by.harvest) + (by.carbon.ratio > 1.5 ? 0.5 : 0) : 0,
    soil: draws.soil ? over(by.food) + over(by.harvest) * 0.5 : 0,
  };
}

/**
 * One year of the capacity model: stocks fall where the lines that feed them are over the line and recover where they
 * are not, then the small knock-ons are applied to the map. Call once a year in both acts.
 */
export function stepCapacity(s: GameState): void {
  const rep = capacityReport(s);
  const f = falls(s, rep.lines);
  const st = rep.stocks;
  const move = (v: number, fall: number): number => clamp(fall > 0 ? v - fall : v + CAP.recover, CAP.floor, 100);
  s.flags['cc.flow'] = r1(move(st.flow, f.flow));
  s.flags['cc.fish'] = r1(move(st.fish, f.fish));
  s.flags['cc.soil'] = r1(move(st.soil, f.soil));
}

/**
 * The map's share of the knock-ons, applied once per decade (Act 1) or per year (Act 2): a low creek carries its dirt
 * with less water to dilute it. `years` is how many years this call stands for.
 */
export function applyCapacityToMap(s: GameState, years: number): void {
  const flow = capStocks(s).flow;
  if (flow >= 100) return;
  const add = ((100 - flow) / 100) * 0.12 * (years / 10);
  if (add > 0.0005) applyTileEffect(s, { op: 'water', scope: 'river', add });
}

/** Income lost to tired soil, per decade (zero or negative). */
export function capacityIncomePerDecade(s: GameState): number {
  const soil = capStocks(s).soil;
  if (soil >= 100) return 0;
  const farms = workingBuildings(s).filter((b) => b.type === 'farm' || b.type === 'dripfarm').length;
  return -Math.round(farms * 1.2 * (100 - soil) / 100 * 10) / 10;
}

/** Fish guide multiplier for the ledger (1 = untouched). */
export function fishStockFactor(s: GameState): number {
  return 0.4 + 0.6 * capStocks(s).fish / 100;
}

/** The five ratios, x100 and rounded, in line order (for history records, graphs and the CSV export). */
export function capSummary(s: GameState): number[] {
  return capacityReport(s).lines.map((l) => Math.round(l.ratio * 100));
}
export const CAP_COLUMNS: readonly CapId[] = ['water', 'food', 'harvest', 'energy', 'carbon'];

/** Land limits as CSV rows for the graphs export: one row per decade (Act 1) or year (Act 2), ratios as a percentage of what the land renews. */
export function capCSV(s: GameState): string {
  const rows: string[] = [];
  const seen = new Set<number>();
  for (const r of [...s.history, ...(s.a2?.yearly ?? [])]) {
    if (!r.cap || seen.has(r.year)) continue;
    seen.add(r.year);
    rows.push([r.year, ...r.cap].join(','));
  }
  if (rows.length === 0) return '';
  return ['', 'Land limits (use as a percentage of what the land renews; over 100 is overshoot, energy is judged over 125)', ['year', 'water_pct', 'food_pct', 'harvest_pct', 'energy_pct', 'carbon_pct'].join(','), ...rows].join('\n') + '\n';
}
