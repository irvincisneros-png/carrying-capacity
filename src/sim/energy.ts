import { BUILDINGS } from './buildings';
import { seasonIndexOf, seasonWeather } from './season';
import type { Weather } from './season';
import type { EnergySource, GameState, GridBlock, GridReport, Season } from './types';

/** Tonnes CO2 per MWh. Coal about twice gas; renewables carry a small life-cycle share. */
export const EMISSION_INTENSITY: Readonly<Record<EnergySource, number>> = {
  coal: 0.9,
  gas: 0.45,
  'rooftop-solar': 0.045,
  'solar-farm': 0.04,
  wind: 0.012,
  'offshore-wind': 0.012,
  hydro: 0.024,
  'pumped-hydro': 0,
  battery: 0,
  tidal: 0.015,
};

/**
 * Game scale: kt CO2 emitted by one power unit running flat out for one season at intensity 1 t/MWh.
 * Chosen so a 40-unit coal station at full output (40 * 0.9 * 0.104 * 4 = 15 kt/yr) matches the Act 1
 * figure of 150 kt per decade.
 */
export const KT_PER_UNIT_SEASON = 0.104;

export const COAL_AVAILABILITY = 0.95;
export const GAS_AVAILABILITY = 0.95;
/** Unmet share of the season's energy above which it counts as a blackout. */
export const BLACKOUT_THRESHOLD = 0.01;

/** Capacity factors by season (summer, autumn, winter, spring). */
export const CF = {
  solarDay: [0.78, 0.62, 0.48, 0.68],
  windDay: [0.3, 0.33, 0.42, 0.4],
  windNight: [0.34, 0.37, 0.46, 0.44],
  offshore: [0.46, 0.48, 0.55, 0.52],
  hydro: [0.45, 0.4, 0.55, 0.6],
  tidal: 0.38,
} as const;

/** Demand multipliers: summer air-conditioning and winter heating for homes. */
const HOMES_SEASON = [1.1, 0.92, 1.1, 0.92] as const;
const TRANSPORT_SEASON = [1.05, 0.97, 0.97, 1.0] as const;
/** [day, night] multipliers. Industry and transport work in the day, homes peak in the evening/night. */
const HOMES_BLOCK = [0.85, 1.15] as const;
const INDUSTRY_BLOCK = [1.12, 0.88] as const;
const TRANSPORT_BLOCK = [1.25, 0.75] as const;
const HEATWAVE_HOMES = 1.25;
const WARMING_SUMMER_AC = 0.04;

export interface SectorDemand {
  homes: number;
  industry: number;
  transport: number;
}

type Sector = keyof SectorDemand;

function sectorOf(type: keyof typeof BUILDINGS): Sector {
  const d = BUILDINGS[type];
  if (d.housing > 0) return 'homes';
  if (d.category === 'industry') return 'industry';
  return 'transport';
}

/** Nameplate demand by sector (power units) before any multipliers. */
export function baseDemand(state: GameState): SectorDemand {
  const out: SectorDemand = { homes: 0, industry: 0, transport: 0 };
  for (const b of state.buildings) {
    const d = BUILDINGS[b.type];
    if (d.power < 0) out[sectorOf(b.type)] -= d.power;
  }
  return out;
}

function hasActive(state: GameState, type: string, seasonIndex: number): boolean {
  return state.a2.active.some((e) => e.type === type && e.endsAt > seasonIndex);
}

/** Demand by sector for one block (0 day, 1 night) in a season. */
export function blockDemand(state: GameState, season: Season, block: 0 | 1, seasonIndex = seasonIndexOf(state)): SectorDemand {
  const base = baseDemand(state);
  let homes = base.homes * HOMES_SEASON[season] * HOMES_BLOCK[block];
  if (season === 0) homes *= 1 + WARMING_SUMMER_AC * Math.max(0, state.tempC);
  if (hasActive(state, 'heatwave', seasonIndex)) homes *= HEATWAVE_HOMES;
  return {
    homes,
    industry: base.industry * INDUSTRY_BLOCK[block],
    transport: base.transport * TRANSPORT_SEASON[season] * TRANSPORT_BLOCK[block],
  };
}

/** Installed nameplate capacity by source. */
export function installedCapacity(state: GameState): Partial<Record<EnergySource, number>> {
  const cap: Partial<Record<EnergySource, number>> = {};
  for (const b of state.buildings) {
    const e = BUILDINGS[b.type].energy;
    if (e) cap[e.source] = (cap[e.source] ?? 0) + e.capacity;
  }
  return cap;
}

const VARIABLE: readonly EnergySource[] = [
  'rooftop-solar', 'solar-farm', 'wind', 'offshore-wind', 'hydro', 'tidal',
];

function variableOutput(
  src: EnergySource, cap: number, season: Season, block: 0 | 1, w: Weather, drought: boolean,
): number {
  switch (src) {
    case 'solar-farm':
      return block === 0 ? cap * CF.solarDay[season] * w.cloud : 0;
    case 'rooftop-solar':
      return block === 0 ? cap * CF.solarDay[season] * w.cloud * 0.95 : 0;
    case 'wind':
      return cap * (block === 0 ? CF.windDay[season] : CF.windNight[season]) * w.wind;
    case 'offshore-wind':
      return cap * CF.offshore[season] * (0.5 + 0.5 * w.wind);
    case 'hydro':
      return cap * CF.hydro[season] * (drought ? 0.55 : 1) * (0.8 + 0.2 * w.rain);
    case 'tidal':
      return cap * CF.tidal;
    default:
      return 0;
  }
}

export interface GridResult {
  report: GridReport;
  storageLevel: number;
  /** Utilisation 0..1 of coal and gas plants, keyed by building uid. */
  utilisation: Record<string, number>;
}

const sum = (r: Partial<Record<EnergySource, number>>): number => {
  let t = 0;
  for (const k of Object.keys(r) as EnergySource[]) t += r[k] ?? 0;
  return t;
};

/**
 * Balances the grid for one season: variable renewables first, then storage, then coal, then gas.
 * Day and night are two equal blocks; storage carries energy from day to night.
 */
export function balanceGrid(state: GameState, seasonIndex = seasonIndexOf(state)): GridResult {
  const season = state.a2.season;
  const w = seasonWeather(state.seed, seasonIndex);
  const drought = hasActive(state, 'drought', seasonIndex);
  const cap = installedCapacity(state);

  const power = (cap.battery ?? 0) + (cap['pumped-hydro'] ?? 0);
  let effNum = 0;
  for (const b of state.buildings) {
    const e = BUILDINGS[b.type].energy;
    if (e && (e.source === 'battery' || e.source === 'pumped-hydro')) effNum += e.capacity * (e.efficiency ?? 0.85);
  }
  const eff = power > 0 ? effNum / power : 1;
  let level = Math.min(state.a2.storageLevel, power);

  const coalCap = (cap.coal ?? 0) * COAL_AVAILABILITY;
  const gasCap = (cap.gas ?? 0) * GAS_AVAILABILITY;

  const blocks: GridBlock[] = [];
  const dem = { homes: 0, industry: 0, transport: 0 };
  let coalGen = 0, gasGen = 0;
  const genSum: Partial<Record<EnergySource, number>> = {};

  for (const bl of [0, 1] as const) {
    const sd = blockDemand(state, season, bl, seasonIndex);
    dem.homes += sd.homes / 2;
    dem.industry += sd.industry / 2;
    dem.transport += sd.transport / 2;
    const D = sd.homes + sd.industry + sd.transport;
    const avail: Partial<Record<EnergySource, number>> = {};
    let V = 0;
    for (const src of VARIABLE) {
      const c = cap[src] ?? 0;
      if (c <= 0) continue;
      const o = variableOutput(src, c, season, bl, w, drought);
      avail[src] = o;
      V += o;
    }
    let charged = 0, discharged = 0, curtailed = 0, deficit = 0;
    let used = Math.min(V, D);
    if (V >= D) {
      const room = eff > 0 ? (power - level) / eff : 0;
      charged = Math.max(0, Math.min(V - D, power, room));
      level += charged * eff;
      curtailed = V - D - charged;
      used = D + charged;
    } else {
      deficit = D - V;
      discharged = Math.min(deficit, power, level);
      level -= discharged;
      deficit -= discharged;
    }
    const scale = V > 0 ? used / V : 0;
    const by: Partial<Record<EnergySource, number>> = {};
    for (const src of VARIABLE) {
      if (avail[src] !== undefined) by[src] = (avail[src] ?? 0) * scale;
    }
    if (discharged > 0 && power > 0) {
      for (const src of ['battery', 'pumped-hydro'] as const) {
        const c = cap[src] ?? 0;
        if (c > 0) by[src] = discharged * (c / power);
      }
    }
    const c1 = Math.min(deficit, coalCap);
    deficit -= c1;
    const g1 = Math.min(deficit, gasCap);
    deficit -= g1;
    if (c1 > 0) by.coal = c1;
    if (g1 > 0) by.gas = g1;
    coalGen += c1 / 2;
    gasGen += g1 / 2;
    for (const k of Object.keys(by) as EnergySource[]) genSum[k] = (genSum[k] ?? 0) + (by[k] ?? 0) / 2;
    const supply = sum(by);
    blocks.push({ demand: D, supply, unmet: Math.max(0, deficit), bySource: by, charged, discharged, curtailed });
  }
  const day = blocks[0] as GridBlock;
  const night = blocks[1] as GridBlock;
  const demandTotal = (day.demand + night.demand) / 2;
  const unmetFrac = day.demand + night.demand > 0 ? (day.unmet + night.unmet) / (day.demand + night.demand) : 0;

  let emissions = 0;
  for (const k of Object.keys(genSum) as EnergySource[]) emissions += (genSum[k] ?? 0) * EMISSION_INTENSITY[k] * KT_PER_UNIT_SEASON;
  const delivered = (day.supply + night.supply) / 2;
  const fossil = (genSum.coal ?? 0) + (genSum.gas ?? 0);
  const renewableShare = delivered > 0 ? Math.max(0, (delivered - fossil) / delivered) : 0;

  const utilisation: Record<string, number> = {};
  for (const b of state.buildings) {
    const e = BUILDINGS[b.type].energy;
    if (!e) continue;
    if (e.source === 'coal') utilisation[String(b.uid)] = (cap.coal ?? 0) > 0 ? coalGen / (cap.coal ?? 1) : 0;
    else if (e.source === 'gas') utilisation[String(b.uid)] = (cap.gas ?? 0) > 0 ? gasGen / (cap.gas ?? 1) : 0;
  }

  const report: GridReport = {
    year: state.year,
    season,
    seasonIndex,
    demand: dem,
    day,
    night,
    demandTotal,
    unmetFrac,
    capacity: cap,
    generation: genSum,
    emissionsKt: emissions,
    renewableShare,
    storageLevel: level,
    blackout: unmetFrac > BLACKOUT_THRESHOLD,
  };
  return { report, storageLevel: level, utilisation };
}
