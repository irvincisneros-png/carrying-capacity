/**
 * Data centres (Round 6 WP9). A tech company offers one as a dilemma card (content/dilemmas/datacentre.ts); accepting it
 * places the building itself. The card's choices set three flags that shape the impacts:
 *   dc.cool   0 = evaporative cooling (thirsty), 1 = recycled water, 2 = air cooling (no water, a little more power)
 *   dc.ppa    1 = the company's own new solar, wind and batteries cover about half its load
 *   dc.heat   1 = waste heat goes to a pool or homes through a heat pump
 * The numbers are game-scale, not megawatts. The real ones (AEMO ESOO 2026, Amazon, NSW framework) are in the card text.
 */
import { BUILDINGS } from './buildings';
import { bumpRect } from './restoration';
import { workingBuildings } from './roads';
import { TileKind } from './types';
import type { GameState, PlacedBuilding } from './types';

export const DC = {
  /** Electricity per building, in game power units (a brick suburb is 4, a factory 5). Flat day and night. */
  power: BUILDINGS.datacentre.power,
  /** Share of the load the company's own PPA wind, solar and batteries cover. */
  ppaCover: 0.5,
  /** Power multiplier by cooling kind: evaporative 0.95, recycled water 1, air cooling 1.1. */
  coolPower: [0.95, 1, 1.1] as readonly number[],
  /** River Town: flow units drawn per season (farms need about 0.6 each, more in summer). Evaporative, recycled, air. */
  riverDraw: [0.9, 0.06, 0.03] as readonly number[],
  /** Seasonal shape for cooling water: summer, autumn, winter, spring. */
  riverSeason: [1.3, 0.9, 0.7, 1.0] as readonly number[],
  /** Red Dirt: aquifer-fed water per season, in the same units as a bore's output. */
  aquiferDraw: [0.3, 0.04, 0.015] as readonly number[],
  /** Net Zero City: extra heat-health risk per data centre, and the part left once the waste heat is put to use. */
  heatRisk: 0.07,
  heatKept: 0.15,
} as const;

const flagNum = (s: GameState, k: string, d = 0): number => {
  const v = s.flags[k];
  return typeof v === 'number' ? v : v === true ? 1 : d;
};

export const dataCentres = (s: GameState): PlacedBuilding[] => s.buildings.filter((b) => b.type === 'datacentre');
export const dataCentreCount = (s: GameState): number => dataCentres(s).length;

/** 0 evaporative, 1 recycled water, 2 air cooling. */
export function dcCooling(s: GameState): 0 | 1 | 2 {
  const v = Math.round(flagNum(s, 'dc.cool'));
  return v === 1 ? 1 : v === 2 ? 2 : 0;
}

/** Steady electricity demand (power units) from data centres: the same every hour of the day. */
export function dcLoad(s: GameState): number {
  const n = dataCentreCount(s);
  if (n === 0) return 0;
  const ppa = flagNum(s, 'dc.ppa') >= 1 ? 1 - DC.ppaCover : 1;
  return n * -DC.power * (DC.coolPower[dcCooling(s)] ?? 1) * ppa;
}

/** River Town cooling water drawn from the river in a season (flow units). */
export function dcRiverDraw(s: GameState, season: number): number {
  return dataCentreCount(s) * (DC.riverDraw[dcCooling(s)] ?? 0) * (DC.riverSeason[season] ?? 1);
}

/** Red Dirt cooling water pumped from the aquifer in a season (bore output units). */
export function dcAquiferDraw(s: GameState): number {
  return dataCentreCount(s) * (DC.aquiferDraw[dcCooling(s)] ?? 0);
}

/** Multiplier on heat-health risk in a city: a data centre's waste heat adds a little, unless it is put to use. */
export function dcHeatFactor(s: GameState): number {
  const n = dataCentreCount(s);
  if (n === 0) return 1;
  return 1 + n * DC.heatRisk * (flagNum(s, 'dc.heat') >= 1 ? DC.heatKept : 1);
}

/**
 * Puts a data centre on open land at the edge of the built-up area, a few tiles from homes where it can. Returns
 * false if there is no room (the card's other effects still happen). Deterministic: ties go to the lower tile index.
 * Edits the state in place, so the caller must already have cloned it.
 */
export function placeDataCentre(s: GameState): boolean {
  const def = BUILDINGS.datacentre;
  const g = s.grid;
  const w = def.w, h = def.h;
  const industry = s.buildings.filter((b) => BUILDINGS[b.type].housing === 0 && b.type !== 'road' && b.type !== 'datacentre');
  const homes = s.buildings.filter((b) => BUILDINGS[b.type].housing > 0);
  const dist = (b: PlacedBuilding, x: number, y: number): number =>
    Math.max(b.x - (x + w - 1), x - (b.x + b.w - 1), b.y - (y + h - 1), y - (b.y + b.h - 1));
  let best = -1, bestScore = Infinity;
  for (let y = 1; y + h <= g.h - 1; y++) {
    for (let x = 1; x + w <= g.w - 1; x++) {
      let ok = true;
      for (let yy = y; yy < y + h && ok; yy++) {
        for (let xx = x; xx < x + w; xx++) {
          const i = yy * g.w + xx;
          if (g.kind[i] !== TileKind.Land || (g.building[i] ?? 0) !== 0 || (g.significant[i] ?? 0) > 0 || (g.zone[i] ?? 0) > 0) { ok = false; break; }
        }
      }
      if (!ok) continue;
      const nearHome = homes.reduce((m, b) => Math.min(m, dist(b, x, y)), 99);
      const nearAny = s.buildings.reduce((m, b) => Math.min(m, dist(b, x, y)), 99);
      const nearInd = industry.reduce((m, b) => Math.min(m, dist(b, x, y)), 99);
      // Prefer sites a few tiles from homes and close to the town's power and industry.
      const score = (nearHome < 2 ? 100 : Math.max(0, nearHome - 4) * 2) + Math.min(nearAny, 30) * 0.5 + Math.min(nearInd, 30) * 0.3;
      if (score < bestScore) { bestScore = score; best = y * g.w + x; }
    }
  }
  if (best < 0) return false;
  const x = best % g.w, y = Math.floor(best / g.w);
  const used = new Set(s.buildings.map((b) => b.uid));
  let uid = s.nextUid;
  for (let n = 0; n < 65535; n++) {
    if (uid > 65535) uid = 1;
    if (!used.has(uid)) break;
    uid++;
  }
  s.nextUid = uid + 1;
  s.buildings.push({ uid, type: 'datacentre', x, y, rotation: 0, w, h, builtYear: s.year });
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = yy * g.w + xx;
      g.building[i] = uid; g.health[i] = 0; g.stage[i] = 0; g.weed[i] = 0;
    }
  }
  bumpRect(g, x, y, w, h);
  return true;
}

/**
 * Yearly lease and rates paid by the company while its data centre stands and works (flag dc.lease, set by the card). Nothing
 * stays once the building is demolished.
 */
export function dcLeaseIncome(s: GameState): number {
  if (!workingBuildings(s).some((b) => b.type === 'datacentre')) return 0;
  return flagNum(s, 'dc.lease');
}
