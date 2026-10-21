/**
 * Pre-built starting towns. Net Zero City begins in 2025 with a finished, dense city: a harbour CBD, a road grid with
 * suburbs, an industrial district with a port, coal and gas power stations, highways and the pollution they have left.
 * Everything here is deterministic from the grid, so the same seed always gives the same city.
 */
import { BUILDINGS, footprintFor } from './buildings';
import { canPlace } from './rules';
import { hash32 } from './season';
import { updatePollution } from './pollution';
import { TileKind } from './types';
import type { BuildingId, GameState, PlacedBuilding, Rotation } from './types';

/** Zone ids written to grid.zone for the city. */
export const CITY_ZONE = { none: 0, cbd: 1, suburb: 2, industry: 3, port: 4 } as const;

const ROAD_SPACING = 7;
/** Year the prebuilt buildings count as built in (so they are legacy sites for the circular tier). */
const BUILT_YEAR = 1995;

export interface CityPlan {
  centre: { x: number; y: number };
}

function tryPlace(s: GameState, type: BuildingId, x: number, y: number, rot: Rotation = 0): boolean {
  const def = BUILDINGS[type];
  const probe: GameState = { ...s, phase: def.phases?.includes('act2') && !def.phases.includes('act1') ? 'act2' : 'act1', year: 2025, budget: 1e9, status: 'playing' };
  if (!canPlace(probe, type, x, y, rot).ok) return false;
  const { w, h } = footprintFor(def, rot);
  const g = s.grid;
  const uid = s.nextUid++;
  const b: PlacedBuilding = { uid, type, x, y, rotation: rot, w, h, builtYear: BUILT_YEAR };
  s.buildings.push(b);
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = yy * g.w + xx;
      g.building[i] = uid;
      if (g.kind[i] === TileKind.Bush) g.kind[i] = TileKind.Land;
    }
  }
  return true;
}

const open = (s: GameState, x: number, y: number): boolean => {
  const g = s.grid;
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return false;
  const i = y * g.w + x;
  return (g.kind[i] === TileKind.Land || g.kind[i] === TileKind.Bush) && g.building[i] === 0 && (g.elevation[i] ?? 0) <= 2;
};

/** Finds the first open spot for a building, scanning outwards from a target. */
function placeNear(s: GameState, type: BuildingId, tx: number, ty: number, maxR = 14, rot: Rotation = 0): boolean {
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (tryPlace(s, type, Math.round(tx + dx), Math.round(ty + dy), rot)) return true;
      }
    }
  }
  return false;
}

/** The harbour: the sea tile nearest the middle of the east shore, and the CBD centre just inland of it. */
export function cityCentre(s: GameState): { x: number; y: number } {
  const g = s.grid;
  const mid = Math.round(g.h / 2);
  for (let x = g.w - 1; x >= 0; x--) {
    const k = g.kind[mid * g.w + x];
    if (k !== TileKind.Sea && k !== TileKind.Beach) return { x: Math.max(8, x - 2), y: mid + 3 };
  }
  return { x: Math.round(g.w * 0.55), y: mid + 3 };
}

export interface CityMix {
  coal: number;
  gas: number;
  factories: number;
  steelworks: number;
  ports: number;
  highways: number;
  landfills: number;
  outfalls: number;
  farms: number;
  rails: number;
  /** Radius (tiles) of the built-up area. */
  radius: number;
  /** People the starting homes house (suburbs and cottages stop once they do). The map is bigger than the city, so ground does not limit it. */
  homes: number;
}

export const DEFAULT_CITY_MIX: CityMix = {
  coal: 5, gas: 4, factories: 18, steelworks: 1, ports: 2, highways: 7, landfills: 1, outfalls: 1, farms: 3, rails: 8, radius: 17.5, homes: 4240,
};

export function buildCity(s: GameState, mix: CityMix = DEFAULT_CITY_MIX): void {
  const g = s.grid;
  const c = cityCentre(s);
  const rngAt = (x: number, y: number, salt: number): number => (hash32(s.seed, x, y, salt) % 1000) / 1000;
  const dist = (x: number, y: number): number => Math.hypot((x - c.x) * 0.85, y - c.y);
  const inCity = (x: number, y: number): boolean => open(s, x, y) && dist(x, y) < mix.radius + (rngAt(x, y, 1) - 0.5) * 5;
  const industry = { x: c.x - 3, y: c.y + 12 };
  const isIndustry = (x: number, y: number): boolean => Math.hypot(x - industry.x, (y - industry.y) * 1.1) < 9 && y > c.y + 4;

  // 1. Power, ports and heavy industry first, so they get the harbour and river edges.
  for (let n = 0; n < mix.ports; n++) placeNear(s, 'port', c.x + 4 + n * 4, c.y + 9 + n * 3, 14);
  for (let n = 0; n < mix.steelworks; n++) placeNear(s, 'steelworks', industry.x, industry.y + 1, 12);
  // Coal on the river / estuary (cooling water), spread along it west of the CBD; gas near the same water.
  const water: { x: number; y: number }[] = [];
  for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === TileKind.River || g.kind[i] === TileKind.Estuary) water.push({ x: i % g.w, y: Math.floor(i / g.w) });
  const waterEast = water.filter((p) => p.x > c.x - 18 && p.x < c.x + 2).sort((a, b) => a.x - b.x || a.y - b.y);
  for (let n = 0; n < mix.coal; n++) {
    const p = waterEast[Math.min(waterEast.length - 1, Math.floor((n + 0.5) * waterEast.length / Math.max(1, mix.coal + mix.gas)))];
    if (p) placeNear(s, 'coalpower', p.x, p.y + (n % 2 === 0 ? 4 : -4), 6);
  }
  for (let n = 0; n < mix.gas; n++) {
    const p = waterEast[Math.min(waterEast.length - 1, waterEast.length - 1 - n * 3)];
    if (p) placeNear(s, 'gaspower', p.x, p.y - 4, 8);
  }
  for (let n = 0; n < mix.outfalls; n++) {
    const p = water[Math.floor(((n + 1) * water.length) / (mix.outfalls + 1))];
    if (p) placeNear(s, 'outfall', p.x, p.y, 3);
  }

  // 2. Road grid through the built-up area (roads only where a road can run: open land).
  const roadsX = (x: number): boolean => ((x - c.x) % ROAD_SPACING + ROAD_SPACING) % ROAD_SPACING === 0;
  const roadsY = (y: number): boolean => ((y - c.y) % ROAD_SPACING + ROAD_SPACING) % ROAD_SPACING === 0;
  const roadTiles: number[] = [];
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if ((roadsX(x) || roadsY(y)) && inCity(x, y)) roadTiles.push(y * g.w + x);
    }
  }
  // Highways: long straight 1x3 pieces along the main spokes.
  let hw = 0;
  for (const rowOffset of [0, 1, -1, 2, -2, 3, -3, 4]) {
    if (hw >= mix.highways) break;
    const y = c.y + rowOffset * ROAD_SPACING;
    for (let x = c.x - 20; x < c.x + 2 && hw < mix.highways; x += 8) {
      if (tryPlace(s, 'carpark', x, y - 1, 1) || tryPlace(s, 'carpark', x, y, 0)) hw++;
    }
  }
  for (const i of roadTiles) tryPlace(s, 'road', i % g.w, Math.floor(i / g.w));

  // 3. Blocks: suburbs (2x2) in a pattern that leaves 1-tile gaps (street trees, pocket parks), factories near the harbour.
  const blocks: { x: number; y: number }[] = [];
  const x0 = c.x - ROAD_SPACING * Math.ceil(c.x / ROAD_SPACING);
  const y0 = c.y - ROAD_SPACING * Math.ceil(c.y / ROAD_SPACING);
  for (let by = y0; by < g.h; by += ROAD_SPACING) {
    for (let bx = x0; bx < g.w; bx += ROAD_SPACING) blocks.push({ x: bx + 1, y: by + 1 });
  }
  let factories = 0;
  let housed = 0;
  blocks.sort((a, b) => dist(a.x + 3, a.y + 3) - dist(b.x + 3, b.y + 3));
  for (const b of blocks) {
    const mid = { x: b.x + 3, y: b.y + 3 };
    if (!inCity(mid.x, mid.y)) continue;
    const ind = isIndustry(mid.x, mid.y);
    const cbd = dist(mid.x, mid.y) < 8;
    for (let q = 0; q < 4; q++) {
      const px = b.x + (q % 2) * 3, py = b.y + Math.floor(q / 2) * 3;
      if ((ind || (cbd && q % 2 === 0)) && factories < mix.factories && tryPlace(s, 'factory', px, py)) { factories++; continue; }
      if (ind) continue;
      if (housed >= mix.homes) continue;
      if (tryPlace(s, 'suburb', px, py)) housed += BUILDINGS.suburb.housing;
      else {
        // Leftover ground: terraces.
        if (tryPlace(s, 'cottage', px, py)) housed += BUILDINGS.cottage.housing;
        if (tryPlace(s, 'cottage', px + 1, py)) housed += BUILDINGS.cottage.housing;
      }
    }
  }
  // Any factories still to place go on open industrial ground.
  while (factories < mix.factories && placeNear(s, 'factory', industry.x, industry.y, 14)) factories++;
  // Rail sidings serve the port and industry; landfill and farms on the edges.
  for (let n = 0; n < mix.rails; n++) placeNear(s, 'rail', industry.x + n - mix.rails / 2, industry.y - 4, 8);
  for (let n = 0; n < mix.landfills; n++) placeNear(s, 'landfill', c.x - 18, c.y + 15, 14);
  for (let n = 0; n < mix.farms; n++) placeNear(s, 'farm', c.x - 17 + n * 4, 3, 12);
  // A stormwater wetland beside the estuary.
  const est = water.find((p) => g.kind[p.y * g.w + p.x] === TileKind.Estuary);
  if (est) placeNear(s, 'wetland', est.x - 1, est.y - 3, 8);

  // 4. Zones.
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x;
      const k = g.kind[i];
      if (k !== TileKind.Land && k !== TileKind.Bush) continue;
      if (isIndustry(x, y)) g.zone[i] = CITY_ZONE.industry;
      else if (dist(x, y) < 8) g.zone[i] = CITY_ZONE.cbd;
      else if (dist(x, y) < mix.radius + 3) g.zone[i] = CITY_ZONE.suburb;
    }
  }
  for (const b of s.buildings) {
    if (b.type === 'port') for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) g.zone[y * g.w + x] = CITY_ZONE.port;
  }
  // 5. Years of pollution have built up (the city already treats most of its sewage and scrubs its stacks a little).
  for (let k = 0; k < 3; k++) updatePollution(g, s.buildings);
  for (let i = 0; i < g.waterPollution.length; i++) {
    g.waterPollution[i] = (g.waterPollution[i] ?? 0) * 0.6;
    g.airPollution[i] = (g.airPollution[i] ?? 0) * 0.8;
  }
}
