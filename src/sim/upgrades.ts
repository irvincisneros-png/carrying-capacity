/**
 * Building upgrades (Act 1): a one-off cost to fit a cleaner part to a building you already own. Each one has a
 * price, sometimes a change in income, and a clear environmental effect. They teach two things at once:
 *  - local pollution (smoke, dust, runoff) is a different problem from greenhouse gas (CO2): a smoke scrubber
 *    cleans the air your neighbours breathe but does not cut the CO2 the factory makes;
 *  - cleaning at the source usually costs less than cleaning up afterwards.
 *
 * Upgrades are stored on the building record (PlacedBuilding.upgrades, optional so older saves load), applied
 * through applyAction({ type: 'upgrade' }), and read wherever a building's pollution profile or CO2 is used.
 * Everything here is deterministic: no randomness, no clock.
 */
import { BUILDINGS } from './buildings';
import type { PollutionProfile } from './buildings';
import { cloneState } from './state';
import type { ActionResult, BuildingId, GameState, PlacedBuilding } from './types';

export type UpgradeId = 'scrubber' | 'creekbuffer' | 'filters' | 'lining' | 'dust';

export interface UpgradeDef {
  id: UpgradeId;
  building: BuildingId;
  name: string;
  /** Money (thousands) to fit it. */
  cost: number;
  /** First year it is on the market. */
  unlock: number;
  /** Change to income per decade (thousands). Negative = a running cost or lost output. */
  incomePerDecade: number;
  /** Multipliers on the building's pollution profile (1 = unchanged). */
  air?: number;
  water?: number;
  soil?: number;
  /** Multiplier on the building's CO2. Left out where the upgrade does NOT touch greenhouse gas on purpose. */
  co2?: number;
  /** Multiplier on the electricity the building uses. */
  power?: number;
  /** What it does, in numbers. */
  effect: string;
  /** What it teaches. */
  teach: string;
}

export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'scrubber', building: 'factory', name: 'Smoke scrubber', cost: 20, unlock: 1970, incomePerDecade: 0, air: 0.4,
    effect: 'Air pollution from this factory down 60%. CO2 unchanged.',
    teach: 'A scrubber catches soot and sulphur in the smoke, so the air in town gets cleaner. It does not touch carbon dioxide: burning fuel still makes the same CO2. Local pollution and greenhouse gas are different problems.',
  },
  {
    id: 'creekbuffer', building: 'farm', name: 'Creek buffer', cost: 8, unlock: 1980, incomePerDecade: -2, water: 0.4,
    effect: 'Fertiliser and dirt reaching the creek down 60%. Costs about $2k less income each decade (a strip of crop land is fenced off).',
    teach: 'A fenced strip of native trees and grasses between the paddock and the creek slows runoff and soaks up fertiliser, so less washes downstream. You give up a little farm land to protect the water.',
  },
  {
    id: 'filters', building: 'coalpower', name: 'Dust and sulphur filters', cost: 35, unlock: 1970, incomePerDecade: 0, air: 0.25,
    effect: 'Air pollution from this power station down 75%. CO2 unchanged.',
    teach: 'Filters stop ash and sulphur dioxide leaving the chimney, which cuts smog and acid rain. Burning coal still makes the same CO2, so this does nothing for climate change.',
  },
  {
    id: 'lining', building: 'landfill', name: 'Liner and gas capture', cost: 18, unlock: 1990, incomePerDecade: 0, water: 0.3, soil: 0.3, co2: 0.6,
    effect: 'Soil and water pollution from this tip down 70%, and CO2 down 40%.',
    teach: 'A clay and plastic liner stops liquid from the rubbish leaking into soil and the creek. Pipes collect the methane (a strong greenhouse gas) from rotting waste so it can be burned for power or flared, which turns it into much weaker CO2.',
  },
  {
    id: 'dust', building: 'coalmine', name: 'Dust suppression', cost: 12, unlock: 1970, incomePerDecade: 0, air: 0.4,
    effect: 'Dust from this mine down 60%. Soil contamination and CO2 unchanged.',
    teach: 'Water sprays on stockpiles and haul roads keep coal dust out of the air. The mine still leaves contaminated ground to clean up later.',
  },
];

/**
 * Retrofitted homes (Act 2): insulation, heat pumps, rooftop panels and cool roofs, the effect the old "Retrofitted homes"
 * building had (half the electricity, a quarter of the CO2). Fitted by the Retrofit homes area action on grown homes and old
 * cottages (sim/zoning.ts), not from the Inspect panel, so it is not in UPGRADES.
 */
export const RETROFIT: UpgradeDef = {
  id: 'retrofit' as UpgradeId, building: 'zres1', name: 'Retrofitted homes', cost: 0, unlock: 2025, incomePerDecade: 0, co2: 0.25, power: 0.5,
  effect: 'Electricity used by these homes halved, and their CO2 cut by three quarters.',
  teach: 'Most homes that will stand in 2050 are already built. Fixing the ones we have (insulation, heat pumps, solar panels, pale roofs) cuts energy use and keeps people safer in a heatwave.',
};

export const UPGRADE_BY_ID: Readonly<Record<string, UpgradeDef>> = Object.fromEntries([...UPGRADES, RETROFIT].map((u) => [u.id, u]));

export function upgradesFor(type: BuildingId): readonly UpgradeDef[] {
  return UPGRADES.filter((u) => u.building === type);
}

export function hasUpgrade(b: PlacedBuilding, id: string): boolean {
  return b.upgrades?.includes(id) === true;
}

/** The building's local pollution after its upgrades. */
export function pollutesOf(b: PlacedBuilding): PollutionProfile {
  const base = BUILDINGS[b.type].pollutes;
  if (!b.upgrades || b.upgrades.length === 0) return base;
  let air = base.air ?? 0, water = base.water ?? 0, soil = base.soil ?? 0;
  for (const id of b.upgrades) {
    const u = UPGRADE_BY_ID[id];
    if (!u) continue;
    air *= u.air ?? 1;
    water *= u.water ?? 1;
    soil *= u.soil ?? 1;
  }
  return { air, water, soil };
}

/** kt CO2-e per decade after upgrades. */
export function co2Of(b: PlacedBuilding): number {
  // An empty (declined) grown building is boarded up: nobody there, nothing burned.
  if (b.empty) return 0;
  let co2 = BUILDINGS[b.type].co2;
  if (b.upgrades) for (const id of b.upgrades) co2 *= UPGRADE_BY_ID[id]?.co2 ?? 1;
  return co2;
}

/** Power after upgrades: generation as built, use cut by any upgrade that saves electricity (negative = uses power). */
export function powerOf(b: PlacedBuilding): number {
  const p = BUILDINGS[b.type].power;
  if (p >= 0 || !b.upgrades) return p;
  let m = 1;
  for (const id of b.upgrades) m *= UPGRADE_BY_ID[id]?.power ?? 1;
  return p * m;
}

/**
 * Money per decade that comes from choices rather than jobs: upgrade running costs, and the lasting income changes
 * that Act 1 dilemma cards leave behind (flags['income.act1']). In Act 2 a tenth of it is counted each year.
 */
export function choiceIncomePerDecade(s: GameState): number {
  let n = typeof s.flags['income.act1'] === 'number' ? s.flags['income.act1'] : 0;
  for (const b of s.buildings) {
    if (b.upgrades) for (const id of b.upgrades) n += UPGRADE_BY_ID[id]?.incomePerDecade ?? 0;
  }
  return n;
}

export type UpgradeState = 'fitted' | 'available' | 'locked' | 'no-funds' | 'closed';

export interface UpgradeOption {
  def: UpgradeDef;
  state: UpgradeState;
  /** Why it cannot be fitted right now (for a tooltip). */
  reason?: string;
}

/** The upgrades that suit this building, and whether each can be fitted now. */
export function upgradeOptions(s: GameState, b: PlacedBuilding): UpgradeOption[] {
  return upgradesFor(b.type).map((def): UpgradeOption => {
    if (hasUpgrade(b, def.id)) return { def, state: 'fitted' };
    if (s.phase !== 'act1') return { def, state: 'closed', reason: 'Upgrades are fitted during the boom, before the transition starts' };
    if (s.year < def.unlock) return { def, state: 'locked', reason: `Not on the market until ${def.unlock}` };
    if (s.budget < def.cost) return { def, state: 'no-funds', reason: `Not enough money: this costs $${def.cost}k` };
    return { def, state: 'available' };
  });
}

export function applyUpgrade(state: GameState, uid: number, id: string): { state: GameState; result: ActionResult } {
  const fail = (code: NonNullable<ActionResult['code']>, reason: string): { state: GameState; result: ActionResult } => ({
    state, result: { ok: false, code, reason },
  });
  const def = UPGRADE_BY_ID[id];
  if (!def) return fail('invalid', 'Unknown upgrade');
  const b = state.buildings.find((o) => o.uid === uid);
  if (!b) return fail('nothing-here', 'There is no such building');
  if (b.type !== def.building) return fail('invalid', `${def.name} does not fit this building`);
  if (hasUpgrade(b, id)) return fail('already-done', 'Already fitted');
  if (state.phase !== 'act1') return fail('not-open', 'Upgrades are fitted during the boom, before the transition starts');
  if (state.year < def.unlock) return fail('not-open', `${def.name} is not on the market until ${def.unlock}`);
  if (state.budget < def.cost) return fail('no-funds', `Not enough money: this costs ${def.cost}`);
  const next = cloneState(state);
  next.buildings = next.buildings.map((o) => (o.uid === uid ? { ...o, upgrades: [...(o.upgrades ?? []), id] } : o));
  next.budget -= def.cost;
  // The same counter residents.noteAction keeps (not imported: residents depends on conditions, which depends on this file).
  next.residents.actions[`upgraded.${id}`] = (next.residents.actions[`upgraded.${id}`] ?? 0) + 1;
  next.version = state.version + 1;
  return { state: next, result: { ok: true, spent: def.cost } };
}
