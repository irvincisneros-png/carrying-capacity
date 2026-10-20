/**
 * Wildlife: species with habitat requirements evaluated each year against the map (tile stage / health / kind,
 * pollution, patch connectivity with road barriers and crossings, buffers), populations that follow, and named
 * animal families whose arrivals and losses are announced. Content lives in content/species.ts.
 */
import { BONUS_SPECIES, SPECIES_BY_ID, speciesFor } from '../content/species';
import type { FamilyDef, HabitatSpec, SpeciesDef } from '../content/species';
import { BUILDINGS } from './buildings';
import { renderText } from './conditions';
import { estuaryHealth } from './metrics';
import { hash32, seasonIndexOf } from './season';
import { emitStory } from './story';
import { TileKind } from './types';
import type { SpeciesRuntime, WildlifeState } from './layerTypes';
import type { BuildingId, GameState } from './types';

const N4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const BARRIERS: readonly BuildingId[] = ['road', 'carpark', 'rail'];
/** Buildings that do not show lights at night. */
const DARK_OK: readonly BuildingId[] = [
  'nursery', 'wetland', 'phytoremediation', 'excavation', 'wildlifecrossing', 'solarfarm', 'rooftopsolar', 'windfarm',
  'offshorewind', 'tidal', 'sewagetreatment', 'solarlandfill',
];

export function emptySpecies(startPop = 0): SpeciesRuntime {
  return {
    pop: startPop, peak: startPop, startPop, quality: 0, capacity: 0, goodYears: 0, badYears: 0, limiting: '',
    heatStress: 0, nests: 0, nestStreak: 0, lastNestYear: -1, lostYear: null, arrivedYear: null, families: {}, history: [],
  };
}

export function emptyWildlife(): WildlifeState {
  return { species: {}, initialised: false, lastYear: 0, roadKills: 0 };
}

export interface HabitatEval {
  suitable: boolean;
  /** 0..1, how good the habitat is relative to what the species needs. */
  quality: number;
  /** Animals the habitat can carry. */
  capacity: number;
  limiting: string;
  /** Extra numbers (largest patch, dark beach fraction, ...). */
  extra: Record<string, number>;
  /** 1 on tiles that count as habitat (only when requested). */
  mask?: Uint8Array;
}

// ---------------------------------------------------------------------------------------------------------
// Patches and corridors
// ---------------------------------------------------------------------------------------------------------

export interface Patch {
  /** Habitat tiles only (crossing tiles join patches but are not counted). */
  tiles: number[];
  size: number;
}

/** Woodland that counts as koala / roost habitat: mature, healthy, unbuilt bush. */
export function woodlandMask(s: GameState, minHealth: number): Uint8Array {
  const g = s.grid;
  const m = new Uint8Array(g.kind.length);
  for (let i = 0; i < m.length; i++) {
    if (g.kind[i] === TileKind.Bush && (g.stage[i] ?? 0) >= 3 && (g.building[i] ?? 0) === 0 && (g.health[i] ?? 0) >= minHealth) m[i] = 1;
  }
  return m;
}

/** uid -> true for crossing tiles. */
function crossingTiles(s: GameState): Set<number> {
  const out = new Set<number>();
  for (const b of s.buildings) {
    if (!BUILDINGS[b.type].crossing) continue;
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) out.add(y * s.grid.w + x);
  }
  return out;
}

/**
 * Connected patches of habitat. 4-connected; wildlife crossings are passable, so two woodlands separated by a road
 * join only where a crossing has been built on that road. Sorted largest first.
 */
export function patchesOf(s: GameState, mask: Uint8Array): Patch[] {
  const g = s.grid;
  const cross = crossingTiles(s);
  const seen = new Uint8Array(mask.length);
  const out: Patch[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1 || seen[start] === 1) continue;
    const tiles: number[] = [];
    const queue = [start];
    seen[start] = 1;
    for (let qi = 0; qi < queue.length; qi++) {
      const i = queue[qi] as number;
      if (mask[i] === 1) tiles.push(i);
      const x = i % g.w, y = Math.floor(i / g.w);
      for (const [dx, dy] of N4) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
        const j = yy * g.w + xx;
        if (seen[j] === 1) continue;
        if (mask[j] === 1 || cross.has(j)) {
          seen[j] = 1;
          queue.push(j);
        }
      }
    }
    out.push({ tiles, size: tiles.length });
  }
  return out.filter((p) => p.size > 0).sort((a, b) => b.size - a.size || (a.tiles[0] ?? 0) - (b.tiles[0] ?? 0));
}

/** Habitat tiles beside a road / rail barrier with no wildlife crossing within 4 tiles. */
export function roadExposure(s: GameState, tiles: readonly number[]): number {
  const g = s.grid;
  const barrier = new Set<number>();
  const cross: number[] = [];
  for (const b of s.buildings) {
    const idxs: number[] = [];
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) idxs.push(y * g.w + x);
    if (BARRIERS.includes(b.type)) for (const i of idxs) barrier.add(i);
    if (BUILDINGS[b.type].crossing) cross.push(...idxs);
  }
  if (barrier.size === 0) return 0;
  let n = 0;
  for (const i of tiles) {
    const x = i % g.w, y = Math.floor(i / g.w);
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < g.w && yy < g.h && barrier.has(yy * g.w + xx)) { near = true; break; }
    }
    if (!near) continue;
    const protectedByCrossing = cross.some((c) => Math.max(Math.abs((c % g.w) - x), Math.abs(Math.floor(c / g.w) - Math.floor(i / g.w))) <= 4);
    if (!protectedByCrossing) n++;
  }
  return n;
}

function meanOver(field: Float32Array, idxs: readonly number[]): number {
  if (idxs.length === 0) return 0;
  let t = 0;
  for (const i of idxs) t += field[i] ?? 0;
  return t / idxs.length;
}

function isDrought(s: GameState): boolean {
  if (s.phase !== 'act2') return false;
  const idx = seasonIndexOf(s);
  return s.a2.active.some((e) => e.type === 'drought' && e.endsAt > idx);
}

/** Tiles within Chebyshev distance `d` of any tile accepted by `test`. */
function within(s: GameState, d: number, test: (i: number) => boolean): Uint8Array {
  const g = s.grid;
  const out = new Uint8Array(g.kind.length);
  for (let i = 0; i < out.length; i++) {
    if (!test(i)) continue;
    const x = i % g.w, y = Math.floor(i / g.w);
    for (let yy = Math.max(0, y - d); yy <= Math.min(g.h - 1, y + d); yy++) {
      for (let xx = Math.max(0, x - d); xx <= Math.min(g.w - 1, x + d); xx++) out[yy * g.w + xx] = 1;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Habitat evaluation
// ---------------------------------------------------------------------------------------------------------

type Spec<K extends HabitatSpec['kind']> = Extract<HabitatSpec, { kind: K }>;

function evalWoodland(s: GameState, h: Spec<'woodland-patch'>, wantMask: boolean): HabitatEval {
  const mask = woodlandMask(s, h.minHealth);
  const patches = patchesOf(s, mask);
  const big = patches.filter((p) => p.size >= h.minPatch);
  const largest = patches[0]?.size ?? 0;
  const tiles = big.flatMap((p) => p.tiles);
  const air = meanOver(s.grid.airPollution, tiles);
  const exposed = h.roadBuffer ? roadExposure(s, tiles) : 0;
  const exposedFrac = tiles.length > 0 ? exposed / tiles.length : 0;
  const frag = big.length > 1 ? Math.max(0.6, 1 - 0.15 * (big.length - 1)) : 1;
  const capacity = Math.floor(tiles.length * h.perTile * frag);
  let limiting = '';
  let suitable = big.length > 0;
  if (!suitable) limiting = `The biggest connected woodland is ${largest} tiles; it needs ${h.minPatch}.`;
  else if (air > h.maxAir) { suitable = false; limiting = 'Air pollution over the woodland is too high.'; }
  else if (exposedFrac > 0.2) limiting = `Roads cut through ${Math.round(exposedFrac * 100)}% of the woodland edge with no wildlife crossing.`;
  return {
    suitable, capacity, limiting,
    quality: clamp(largest / (h.minPatch * 2), 0, 1) * (1 - 0.5 * clamp(exposedFrac, 0, 1)),
    extra: { largest, patches: big.length, exposedFrac, woodland: mask.reduce((n, v) => n + v, 0) },
    ...(wantMask ? { mask } : {}),
  };
}

function evalSheOak(s: GameState, h: Spec<'she-oak'>, wantMask: boolean): HabitatEval {
  const g = s.grid;
  const nearBeach = within(s, h.coastDist, (i) => g.kind[i] === TileKind.Beach);
  const mask = new Uint8Array(g.kind.length);
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    const k = g.kind[i];
    if ((k === TileKind.Land || k === TileKind.Bush || k === TileKind.Beach) && (g.building[i] ?? 0) === 0 && (g.stage[i] ?? 0) >= 2 && nearBeach[i] === 1) {
      mask[i] = 1;
      n++;
    }
  }
  const wood = patchesOf(s, woodlandMask(s, 0.75));
  const hollow = wood[0]?.size ?? 0;
  const suitable = n >= h.minTiles && hollow >= h.hollowPatch;
  const limiting = n < h.minTiles
    ? `Only ${n} tiles of coastal she-oak and heath have grown back; it needs ${h.minTiles}.`
    : hollow < h.hollowPatch ? `There is no old woodland patch (${hollow} tiles, needs ${h.hollowPatch}) for nest hollows.` : '';
  return {
    suitable, capacity: Math.floor(n * h.perTile), limiting,
    quality: clamp(Math.min(n / h.minTiles, hollow / h.hollowPatch) / 1.5, 0, 1),
    extra: { shrubTiles: n, hollowPatch: hollow },
    ...(wantMask ? { mask } : {}),
  };
}

/** Lit buildings: homes, workplaces, roads and ports show lights at night. */
function isLit(type: BuildingId): boolean {
  if (DARK_OK.includes(type)) return false;
  const d = BUILDINGS[type];
  return d.housing > 0 || d.power < 0 || BARRIERS.includes(type) || type === 'port';
}

function evalBeach(s: GameState, h: Spec<'nesting-beach'>, wantMask: boolean): HabitatEval {
  const g = s.grid;
  const seagrass: number[] = [];
  const beach: number[] = [];
  const nearBeachWater: number[] = [];
  for (let i = 0; i < g.kind.length; i++) {
    const k = g.kind[i];
    if (k === TileKind.Sea && (g.health[i] ?? 0) >= 0.45) seagrass.push(i);
    if (k === TileKind.Beach) beach.push(i);
  }
  const x0 = (i: number): number => i % g.w;
  const y0 = (i: number): number => Math.floor(i / g.w);
  for (const i of beach) {
    for (const [dx, dy] of N4) {
      const xx = x0(i) + dx, yy = y0(i) + dy;
      if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
      const j = yy * g.w + xx;
      if (g.kind[j] === TileKind.Sea || g.kind[j] === TileKind.Reef) nearBeachWater.push(j);
    }
  }
  const water = meanOver(g.waterPollution, nearBeachWater);
  // Amber lights (1) or lights-out in nesting season (2) pull the lit zone in.
  const lightFix = typeof s.flags['turtle.lights'] === 'number' ? s.flags['turtle.lights'] : 0;
  const lit = within(s, Math.max(1, h.darkDist - lightFix), (i) => {
    const uid = g.building[i] ?? 0;
    if (uid === 0) return false;
    const b = s.buildings.find((o) => o.uid === uid);
    return b ? isLit(b.type) : false;
  });
  const dark = beach.filter((i) => lit[i] !== 1);
  const darkFrac = beach.length > 0 ? dark.length / beach.length : 0;
  const waterOk = water <= h.maxWater;
  const suitable = seagrass.length >= h.minSeagrass && waterOk;
  const limiting = seagrass.length < h.minSeagrass
    ? `Only ${seagrass.length} tiles of healthy seagrass; it needs ${h.minSeagrass}.`
    : !waterOk ? 'The water by the beach is too polluted.'
      : darkFrac < h.minDarkFrac ? `Only ${Math.round(darkFrac * 100)}% of the beach is dark at night; it needs ${Math.round(h.minDarkFrac * 100)}%.` : '';
  const mask = new Uint8Array(g.kind.length);
  if (wantMask) for (const i of seagrass) mask[i] = 1;
  return {
    suitable, capacity: Math.floor(seagrass.length * h.perTile), limiting,
    quality: clamp(Math.min(seagrass.length / (h.minSeagrass * 2), darkFrac / (h.minDarkFrac * 1.5), 1), 0, 1) * (waterOk ? 1 : 0.4),
    extra: { seagrass: seagrass.length, darkFrac, beachWater: water, nestOk: suitable && darkFrac >= h.minDarkFrac ? 1 : 0 },
    ...(wantMask ? { mask } : {}),
  };
}

function evalRiver(s: GameState, h: Spec<'clean-river'>, wantMask: boolean): HabitatEval {
  const g = s.grid;
  const river: number[] = [];
  for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === TileKind.River) river.push(i);
  const water = meanOver(g.waterPollution, river);
  const nearRiver = within(s, 2, (i) => g.kind[i] === TileKind.River);
  const mask = new Uint8Array(g.kind.length);
  let bank = 0;
  for (let i = 0; i < mask.length; i++) {
    const k = g.kind[i];
    if ((k === TileKind.Land || k === TileKind.Bush) && (g.building[i] ?? 0) === 0 && (g.stage[i] ?? 0) >= 2 && nearRiver[i] === 1) { mask[i] = 1; bank++; }
  }
  const dry = isDrought(s);
  const suitable = river.length > 0 && water <= h.maxWater && bank >= h.minRiparian && !dry;
  const limiting = dry ? 'A drought has the river running thin.'
    : water > h.maxWater ? 'River water is too polluted.'
      : bank < h.minRiparian ? `Only ${bank} tiles of riverbank plants; it needs ${h.minRiparian}.` : '';
  return {
    suitable, capacity: Math.floor(bank * h.perTile), limiting,
    quality: clamp((1 - water / (h.maxWater * 2)) * Math.min(1, bank / (h.minRiparian * 1.5)), 0, 1) * (dry ? 0.5 : 1),
    extra: { bank, riverWater: water },
    ...(wantMask ? { mask } : {}),
  };
}

function evalWetland(s: GameState, h: Spec<'wetland'>, wantMask: boolean): HabitatEval {
  const g = s.grid;
  let good = 0, total = 0;
  const mask = new Uint8Array(g.kind.length);
  for (const b of s.buildings) {
    if (!BUILDINGS[b.type].wetland) continue;
    total++;
    const idxs: number[] = [];
    for (let y = Math.max(0, b.y - 2); y <= Math.min(g.h - 1, b.y + b.h + 1); y++) for (let x = Math.max(0, b.x - 2); x <= Math.min(g.w - 1, b.x + b.w + 1); x++) idxs.push(y * g.w + x);
    const water = meanOver(g.waterPollution, idxs);
    if (water <= h.maxWater) {
      good++;
      if (wantMask) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) mask[y * g.w + x] = 1;
    }
  }
  let marsh = 0;
  for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === TileKind.Estuary && (g.stage[i] ?? 0) >= 2 && (g.waterPollution[i] ?? 0) <= h.maxWater) marsh++;
  const suitable = good >= h.minWetlands;
  const limiting = total === 0 ? 'There are no wetlands yet. Build a stormwater wetland.' : good < h.minWetlands ? 'The water around the wetlands is too polluted for frogs.' : '';
  return {
    suitable, capacity: Math.floor(good * h.perWetland + marsh * 1.5), limiting,
    quality: clamp(good / (h.minWetlands * 3), 0, 1),
    extra: { wetlands: total, cleanWetlands: good, saltmarsh: marsh },
    ...(wantMask ? { mask } : {}),
  };
}

function evalRoost(s: GameState, h: Spec<'roost'>, wantMask: boolean): HabitatEval {
  const g = s.grid;
  const mask = woodlandMask(s, 0.8);
  const water = within(s, h.waterDist, (i) => g.kind[i] === TileKind.River || g.kind[i] === TileKind.Estuary || g.kind[i] === TileKind.Sea);
  const patches = patchesOf(s, mask).filter((p) => p.tiles.some((i) => water[i] === 1));
  const largest = patches[0]?.size ?? 0;
  const tiles = patches.filter((p) => p.size >= h.minPatch).flatMap((p) => p.tiles);
  const suitable = tiles.length > 0;
  return {
    suitable, capacity: Math.floor(tiles.length * h.perTile),
    limiting: suitable ? '' : `The largest healthy woodland near water is ${largest} tiles; it needs ${h.minPatch}.`,
    quality: clamp(largest / (h.minPatch * 2), 0, 1),
    extra: { largest },
    ...(wantMask ? { mask } : {}),
  };
}

function evalMudflat(s: GameState, h: Spec<'mudflat'>, wantMask: boolean): HabitatEval {
  const g = s.grid;
  const built = within(s, h.quietDist, (i) => {
    const uid = g.building[i] ?? 0;
    if (uid === 0) return false;
    const b = s.buildings.find((o) => o.uid === uid);
    return b ? !DARK_OK.includes(b.type) : false;
  });
  const mask = new Uint8Array(g.kind.length);
  let quiet = 0;
  for (let i = 0; i < mask.length; i++) {
    if (g.kind[i] === TileKind.Estuary && (g.building[i] ?? 0) === 0 && built[i] !== 1) { mask[i] = 1; quiet++; }
  }
  const est = estuaryHealth(s);
  const suitable = quiet >= h.minTiles && est >= h.minEstuary;
  return {
    suitable, capacity: Math.floor(quiet * h.perTile * (est / 100)),
    limiting: quiet < h.minTiles ? `Only ${quiet} quiet mudflat tiles; it needs ${h.minTiles}.` : est < h.minEstuary ? `Estuary water health is ${est}; it needs ${h.minEstuary}.` : '',
    quality: clamp(Math.min(quiet / (h.minTiles * 2), est / (h.minEstuary * 1.5)), 0, 1),
    extra: { quiet, estuary: est },
    ...(wantMask ? { mask } : {}),
  };
}

export function evaluateHabitat(s: GameState, def: SpeciesDef, wantMask = false): HabitatEval {
  const h = def.habitat;
  switch (h.kind) {
    case 'woodland-patch': return evalWoodland(s, h, wantMask);
    case 'she-oak': return evalSheOak(s, h, wantMask);
    case 'nesting-beach': return evalBeach(s, h, wantMask);
    case 'clean-river': return evalRiver(s, h, wantMask);
    case 'wetland': return evalWetland(s, h, wantMask);
    case 'roost': return evalRoost(s, h, wantMask);
    case 'mudflat': return evalMudflat(s, h, wantMask);
  }
}

/** Tiles that currently count as a species' habitat, for map overlays. */
export function habitatMask(s: GameState, speciesId: string): Uint8Array {
  const def = SPECIES_BY_ID[speciesId];
  return (def ? evaluateHabitat(s, def, true).mask : undefined) ?? new Uint8Array(s.grid.kind.length);
}

// ---------------------------------------------------------------------------------------------------------
// Populations
// ---------------------------------------------------------------------------------------------------------

function say(s: GameState, text: string, ref: string, tone: 'warm' | 'joy' | 'loss' | 'concern' = 'warm'): void {
  emitStory(s, text, { channel: 'wildlife', ref, tone });
}

function familyEvents(s: GameState, def: SpeciesDef, rt: SpeciesRuntime, announce: boolean): void {
  for (const f of def.families) {
    const present = rt.pop >= f.minPop;
    const was = rt.families[f.id] === true;
    if (present && !was && announce) say(s, f.arrive, def.id, 'joy');
    else if (!present && was && announce) say(s, f.lost, def.id, 'loss');
    rt.families[f.id] = present;
  }
}

export function isThriving(rt: SpeciesRuntime | undefined, def: SpeciesDef): boolean {
  if (!rt) return false;
  if (rt.pop < def.thrive.pop) return false;
  if (def.thrive.nestStreak !== undefined && rt.nestStreak < def.thrive.nestStreak) return false;
  return true;
}

/** Publishes flags['metric.wildlifeThriving'] (1 when every bonus species is thriving). */
export function publishWildlifeMetric(s: GameState): void {
  const ids = BONUS_SPECIES[s.scenarioId];
  if (!ids) return;
  const ok = ids.every((id) => {
    const def = SPECIES_BY_ID[id];
    return def ? isThriving(s.wildlife.species[id], def) : false;
  });
  s.flags['metric.wildlifeThriving'] = ok ? 1 : 0;
}

/** Sets up the census when Act 2 begins (or when an older save is migrated mid-Act 2). */
export function initWildlife(s: GameState): void {
  const w = emptyWildlife();
  for (const def of speciesFor(s.scenarioId)) {
    const rt = emptySpecies(def.startPop);
    const ev = evaluateHabitat(s, def);
    rt.quality = ev.quality;
    rt.capacity = ev.capacity;
    rt.limiting = ev.limiting;
    rt.goodYears = ev.suitable ? 1 : 0;
    if (def.startPop > 0) rt.arrivedYear = s.year;
    familyEvents(s, def, rt, false);
    rt.history.push({ year: s.year, pop: rt.pop });
    w.species[def.id] = rt;
  }
  w.initialised = true;
  w.lastYear = s.year;
  s.wildlife = w;
  publishWildlifeMetric(s);
}

/** Heat events stress the heat-sensitive species. Called with the heatwave events raised this season. */
export function noteHeat(s: GameState, severity: number): void {
  for (const def of speciesFor(s.scenarioId)) {
    if (!def.heatSensitive) continue;
    const rt = s.wildlife.species[def.id];
    if (rt) rt.heatStress += severity;
  }
}

/** Fractional growth as a whole number of animals, deterministic. */
function stochasticRound(x: number, h: number): number {
  const f = Math.floor(x);
  return f + ((h % 1000) / 1000 < x - f ? 1 : 0);
}

/** One year: evaluate habitat, move populations, announce arrivals and losses. */
export function wildlifeYear(s: GameState): void {
  const w = s.wildlife;
  if (!w.initialised) initWildlife(s);
  const defs = speciesFor(s.scenarioId);
  defs.forEach((def, di) => {
    const rt = w.species[def.id] ?? (w.species[def.id] = emptySpecies(0));
    const ev = evaluateHabitat(s, def);
    rt.quality = ev.quality;
    rt.capacity = ev.capacity;
    rt.limiting = ev.limiting;
    if (ev.suitable) { rt.goodYears++; rt.badYears = 0; } else { rt.badYears++; rt.goodYears = 0; }
    const h = hash32(s.seed, s.year, di + 4001);
    const before = rt.pop;

    if (rt.pop > 0) {
      // Koalas hit on roads where woodland edge meets road without a crossing.
      if (def.habitat.kind === 'woodland-patch') {
        const exposed = ev.extra.exposedFrac ?? 0;
        if (exposed > 0.05) {
          const fl = (k: string): number => (typeof s.flags[k] === 'number' ? (s.flags[k] as number) : 0);
          const safety = Math.max(0.15, 1 - 0.65 * Math.min(1, fl('koala.roadSafe')) - 0.25 * Math.min(1, fl('koala.slow')));
          const kills = Math.min(rt.pop, stochasticRound(rt.pop * 0.2 * Math.min(1, exposed * 2) * safety, h));
          if (kills > 0) {
            rt.pop -= kills;
            w.roadKills += kills;
            if (w.roadKills === kills || w.roadKills % 5 < kills) {
              say(s, `A koala was killed on the road this year. A wildlife crossing where the road meets the woodland would help.`, def.id, 'loss');
            }
          }
        }
      }
      if (def.heatSensitive && rt.heatStress > 0) {
        const shade = typeof s.flags['wildlife.shade'] === 'number' || s.flags['wildlife.shade'] === true ? 0.6 : 1;
        const die = clamp(0.28 * rt.heatStress * (1 + 0.3 * Math.max(0, s.tempC - 1)) * shade, 0, 0.7);
        const lost = Math.floor(rt.pop * die);
        if (lost > 0) {
          rt.pop -= lost;
          if (die >= 0.1) say(s, `A heatwave killed about ${lost} animals in the roost. Shade and cooler summers would save more next time.`, def.id, 'loss');
        }
      }
      if (ev.suitable) {
        if (rt.pop < ev.capacity) {
          const rate = def.growth * (def.thrive.nestStreak !== undefined && rt.nestStreak < 1 ? 0.2 : 1);
          rt.pop = Math.min(ev.capacity, rt.pop + stochasticRound(rt.pop * rate, h));
        } else if (rt.pop > ev.capacity) {
          rt.pop = Math.max(ev.capacity, Math.floor(rt.pop * 0.9));
        }
      } else {
        rt.pop = Math.floor(rt.pop * (1 - def.decline) - (rt.pop > 0 && rt.pop * def.decline < 1 ? 0.5 : 0));
        if (rt.pop < 1) rt.pop = 0;
      }
      if (before > 0 && rt.pop === 0) {
        rt.lostYear = s.year;
        say(s, renderText(def.text.lost, { n: '0' }), def.id, 'loss');
      }
    } else if (ev.suitable && rt.goodYears >= def.arriveAfter) {
      rt.pop = Math.max(1, Math.min(def.founders, Math.max(ev.capacity, 1)));
      rt.arrivedYear = s.year;
      say(s, renderText(def.text.arrive, { n: String(rt.pop) }), def.id, 'joy');
    }
    const wasThriving = rt.peak >= def.thrive.pop;
    rt.peak = Math.max(rt.peak, rt.pop);
    rt.heatStress = 0;
    familyEvents(s, def, rt, true);
    if (!wasThriving && rt.pop >= def.thrive.pop && def.thrive.nestStreak === undefined) {
      say(s, renderText(def.text.thrive, { n: String(rt.pop) }), def.id, 'joy');
    }
    rt.history.push({ year: s.year, pop: rt.pop });
    if (rt.history.length > 120) rt.history.splice(0, rt.history.length - 120);
  });
  w.lastYear = s.year;
  publishWildlifeMetric(s);
}

/** Each summer: does a turtle come ashore to nest? */
export function wildlifeSummer(s: GameState): void {
  for (const def of speciesFor(s.scenarioId)) {
    if (def.habitat.kind !== 'nesting-beach') continue;
    const rt = s.wildlife.species[def.id];
    if (!rt || rt.pop < 1) continue;
    const ev = evaluateHabitat(s, def);
    const ok = ev.extra.nestOk === 1;
    const h = hash32(s.seed, s.year, 9090);
    if (ok) {
      rt.nests++;
      rt.nestStreak++;
      rt.lastNestYear = s.year;
      const eggs = 95 + (h % 40);
      const hatch = Math.round(eggs * 0.8);
      say(s, rt.nestStreak === 1
        ? `Old Shelly came ashore at night and laid ${eggs} eggs in the warm sand. Volunteers marked the nest and watched over it.`
        : rt.nestStreak === def.thrive.nestStreak
          ? `Old Shelly has now nested ${rt.nestStreak} summers in a row: ${eggs} eggs. About ${hatch} hatchlings are expected to scramble to the sea.`
          : `Old Shelly nested again this summer: ${eggs} eggs on the dark end of the beach.`, def.id, 'joy');
    } else {
      const broke = rt.nestStreak > 0;
      rt.nestStreak = 0;
      if (broke || s.year % 6 === 0) {
        say(s, `Old Shelly did not come ashore this summer. ${ev.limiting || 'Something about the beach is not right.'}`, def.id, 'concern');
      }
    }
  }
  publishWildlifeMetric(s);
}

// ---------------------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------------------

export type SpeciesStatus = 'thriving' | 'present' | 'struggling' | 'gone';

export interface CensusEntry {
  id: string;
  name: string;
  icon: string;
  start: number;
  pop: number;
  peak: number;
  status: SpeciesStatus;
  /** Named families currently present. */
  families: string[];
  limiting: string;
}

export function speciesStatus(s: GameState, def: SpeciesDef): SpeciesStatus {
  const rt = s.wildlife.species[def.id];
  if (!rt || rt.pop <= 0) return 'gone';
  if (isThriving(rt, def)) return 'thriving';
  return rt.badYears > 0 ? 'struggling' : 'present';
}

export function census(s: GameState): CensusEntry[] {
  return speciesFor(s.scenarioId).map((def): CensusEntry => {
    const rt = s.wildlife.species[def.id] ?? emptySpecies(0);
    const fam = (def.families as readonly FamilyDef[]).filter((f) => rt.families[f.id] === true).map((f) => f.name);
    return {
      id: def.id, name: def.name, icon: def.icon, start: rt.startPop, pop: rt.pop, peak: rt.peak,
      status: speciesStatus(s, def), families: fam, limiting: rt.limiting,
    };
  });
}
