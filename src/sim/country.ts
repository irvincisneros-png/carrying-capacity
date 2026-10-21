/**
 * Caring for Country: partnership with the local Aboriginal community, grown by respect and never purchased.
 * All player-facing text lives in content/country.ts and is flagged needsConsultation.
 */
import { COUNTRY_BY_SCENARIO } from '../content/countries';
import { COUNTRY } from '../content/country';
import type { CountryContent } from '../content/country';
import { stageFromHealth, WEED_CAP } from './restoration';
import { hash32, seasonIndexOf } from './season';
import { castFor, elderOf } from './residents';
import { emitStory } from './story';
import { cloneState } from './state';
import { TileKind } from './types';
import type { CountryState } from './layerTypes';
import type { ActionFailCode, ActionResult, GameState, PlacedBuilding } from './types';
import { WATER_TOXIC } from './pollution';

/** Caring for Country is written for scenarios whose cast includes the local Elder (placeholder scenarios have none yet). */
export function countryActive(s: GameState): boolean {
  return elderOf(s.scenarioId) !== undefined;
}

/** The Country content for a scenario: shared numbers, with the scenario's own places, lines and sites where it has them. */
export function countryFor(scenario: GameState['scenarioId']): CountryContent {
  const ov = COUNTRY_BY_SCENARIO[scenario];
  const base = COUNTRY as unknown as CountryContent;
  if (!ov) return base;
  return {
    ...base,
    sites: ov.sites ?? base.sites,
    places: ov.places ?? base.places,
    lines: { ...base.lines, ...ov.lines },
  };
}

export function initCountry(): CountryState {
  return {
    partnership: COUNTRY.baseline,
    consulted: [],
    disturbed: [],
    comanaged: [],
    burns: [],
    boosts: [],
    unlocked: { culturalBurning: false, fishing: false, dualNames: false },
    lastGrowthYear: 0,
    log: [],
  };
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
function say(s: GameState, text: string, tone: 'warm' | 'concern' | 'joy' | 'neutral' = 'warm', ref?: string): void {
  const elder = elderOf(s.scenarioId);
  const who = elder ? { speakerId: elder.id, speaker: elder.name, portrait: elder.portrait } : {};
  emitStory(s, text, { channel: 'country', ...who, tone, needsConsultation: true, ...(ref ? { ref } : {}) });
}

export function addPartnership(s: GameState, delta: number, why = ''): void {
  const before = s.country.partnership;
  s.country.partnership = clamp(before + delta, 0, 100);
  const applied = s.country.partnership - before;
  if (applied !== 0 && why) {
    s.country.log.push({ year: s.year, text: why, delta: Math.round(applied * 10) / 10 });
    if (s.country.log.length > 60) s.country.log.splice(0, s.country.log.length - 60);
  }
}

const fail = (state: GameState, code: ActionFailCode, reason: string): { state: GameState; result: ActionResult } => ({
  state, result: { ok: false, code, reason },
});

/** Site cluster id on a tile (0 = not significant). */
export function siteAt(s: GameState, x: number, y: number): number {
  const g = s.grid;
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return 0;
  return g.significant[y * g.w + x] ?? 0;
}

export function siteTileCount(s: GameState, id: number): number {
  let n = 0;
  for (let i = 0; i < s.grid.significant.length; i++) if (s.grid.significant[i] === id) n++;
  return n;
}

/** Ids of the significant sites under a footprint. */
export function footprintSites(s: GameState, x: number, y: number, w: number, h: number): number[] {
  const out = new Set<number>();
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    const id = siteAt(s, xx, yy);
    if (id > 0) out.add(id);
  }
  return Array.from(out).sort((a, b) => a - b);
}

const bump = (s: GameState, key: string): void => {
  s.residents.actions[key] = (s.residents.actions[key] ?? 0) + 1;
};

export function consult(state: GameState, x: number, y: number): { state: GameState; result: ActionResult } {
  const C = countryFor(state.scenarioId);
  if (!countryActive(state)) return fail(state, 'not-open', 'There is no local community partnership in this scenario yet');
  const id = siteAt(state, x, y);
  if (id === 0) return fail(state, 'invalid', 'This is not one of the places the community has asked to be consulted about');
  if (state.country.consulted.includes(id)) return fail(state, 'already-done', 'You have already talked with the community about this place');
  const cost = C.costs.consult;
  if (state.budget < cost) return fail(state, 'no-funds', `Not enough money: a community meeting costs ${cost}`);
  const site = C.sites[id];
  const s = cloneState(state);
  s.budget -= cost;
  s.country.consulted.push(id);
  s.country.consulted.sort((a, b) => a - b);
  // Having asked first before anything was built is better than an apology afterwards.
  const protect = site?.guidance === 'protect';
  addPartnership(s, protect ? C.gains.consultProtect : C.gains.consult, 'Asked the community before building');
  bump(s, 'consulted');
  if (site) say(s, site.consulted.text, 'warm', `site.${id}`);
  s.version = state.version + 1;
  return { state: s, result: { ok: true, spent: cost } };
}

/** Called after a building is placed. Building on a significant place without asking costs trust. */
export function notePlacement(s: GameState, b: PlacedBuilding): void {
  if (!countryActive(s)) return;
  const C = countryFor(s.scenarioId);
  const ids = footprintSites(s, b.x, b.y, b.w, b.h);
  const pen = s.phase === 'act2' ? C.penalty.act2 : C.penalty.act1;
  for (const id of ids) {
    const site = C.sites[id];
    const consulted = s.country.consulted.includes(id);
    const already = s.country.disturbed.includes(id);
    if (consulted && site?.guidance === 'care') continue; // asked first, advice was "build with care"
    if (already) {
      addPartnership(s, -C.penalty.repeat, 'Built on a significant place again');
      continue;
    }
    s.country.disturbed.push(id);
    s.country.disturbed.sort((a, c) => a - c);
    if (consulted && site?.guidance === 'protect') {
      addPartnership(s, -C.penalty.ignoredAdvice, 'Built where the community asked you to leave it be');
      if (site) say(s, site.ignored.text, 'concern', `site.${id}`);
    } else {
      addPartnership(s, -pen, 'Built on a significant place without asking');
      if (site) say(s, site.disturbed.text, 'concern', `site.${id}`);
    }
    bump(s, 'disturbed');
  }
}

// ---------------------------------------------------------------------------------------------------------
// Co-management and cool burning
// ---------------------------------------------------------------------------------------------------------

const N4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * How far (tiles) one co-management or cool-burn action reaches from the tile clicked. A patch is the connected bush within
 * this reach, so on a big map one click still means "this stretch of bush" and not the whole connected hinterland (a cool
 * burn burns a share of its patch and releases CO2, so its size has to be bounded by the action, not by the map).
 */
export const CARE_REACH = 5;

const withinReach = (g: { w: number }, start: number): ((i: number) => boolean) => {
  const sx = start % g.w, sy = Math.floor(start / g.w);
  return (i) => Math.hypot((i % g.w) - sx, Math.floor(i / g.w) - sy) <= CARE_REACH;
};

/** 4-connected flood fill over tiles accepted by `ok`, starting from tile index `start`. */
function flood(s: GameState, start: number, ok: (i: number) => boolean): number[] {
  const g = s.grid;
  if (!ok(start)) return [];
  const seen = new Set<number>([start]);
  const queue = [start];
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi] as number;
    const x = i % g.w, y = Math.floor(i / g.w);
    for (const [dx, dy] of N4) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
      const j = yy * g.w + xx;
      if (seen.has(j) || !ok(j)) continue;
      seen.add(j);
      queue.push(j);
    }
  }
  return Array.from(seen).sort((a, b) => a - b);
}

const MIN_PATCH = 4;

export function comanage(state: GameState, x: number, y: number): { state: GameState; result: ActionResult } {
  const C = countryFor(state.scenarioId);
  if (!countryActive(state)) return fail(state, 'not-open', 'There is no local community partnership in this scenario yet');
  const g = state.grid;
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return fail(state, 'out-of-bounds', "That isn't on the map");
  const start = y * g.w + x;
  const near = withinReach(g, start);
  const isBush = (i: number): boolean => g.kind[i] === TileKind.Bush && (g.building[i] ?? 0) === 0 && near(i);
  if (!(g.kind[start] === TileKind.Bush && (g.building[start] ?? 0) === 0)) return fail(state, 'not-bush', 'Only bushland can be returned to co-management');
  const patch = flood(state, start, isBush);
  if (patch.length < MIN_PATCH) return fail(state, 'invalid', C.lines.comanageSmall.text);
  const have = new Set(state.country.comanaged);
  const fresh = patch.filter((i) => !have.has(i));
  if (fresh.length === 0) return fail(state, 'already-done', 'This bush is already looked after together with the community');
  const cost = C.costs.comanage;
  if (state.budget < cost) return fail(state, 'no-funds', `Not enough money: setting up co-management costs ${cost}`);
  const s = cloneState(state);
  s.budget -= cost;
  const first = s.country.comanaged.length === 0;
  s.country.comanaged = Array.from(new Set([...s.country.comanaged, ...patch])).sort((a, b) => a - b);
  addPartnership(s, first ? C.gains.comanageFirst : C.gains.comanageLater, 'Returned the care of bushland to the community');
  bump(s, 'comanaged');
  say(s, C.lines.comanage.text, 'joy', 'comanage');
  s.version = state.version + 1;
  return { state: s, result: { ok: true, spent: cost } };
}

/** The co-managed patch (connected through co-managed tiles) that contains tile `start`. */
export function comanagedPatch(s: GameState, start: number): number[] {
  const set = new Set(s.country.comanaged);
  const g = s.grid;
  const near = withinReach(g, start);
  return flood(s, start, (i) => set.has(i) && (g.building[i] ?? 0) === 0 && (g.kind[i] === TileKind.Bush || g.kind[i] === TileKind.Land) && near(i));
}

export function burn(state: GameState, x: number, y: number): { state: GameState; result: ActionResult } {
  const C = countryFor(state.scenarioId);
  const g = state.grid;
  if (state.phase !== 'act2') return fail(state, 'not-open', C.lines.burnLocked.text);
  if (!state.country.unlocked.culturalBurning) return fail(state, 'not-open', C.lines.burnLocked.text);
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return fail(state, 'out-of-bounds', "That isn't on the map");
  if (state.a2.season !== 1 && state.a2.season !== 2) return fail(state, 'wrong-season', C.lines.burnWrongSeason.text);
  const start = y * g.w + x;
  const patch = comanagedPatch(state, start);
  if (patch.length === 0) return fail(state, 'invalid', C.lines.burnNeedsCoMgmt.text);
  const anchor = patch[0] as number;
  const inPatch = new Set(patch);
  if (state.country.burns.some((b) => (b.patch === anchor || inPatch.has(b.patch)) && b.year > state.year - 3)) {
    return fail(state, 'already-done', C.lines.burnTooSoon.text);
  }
  const cost = C.costs.burn;
  if (state.budget < cost) return fail(state, 'no-funds', `Not enough money: a cool burn costs ${cost}`);
  const picked = patch.filter((i) => (g.stage[i] ?? 0) >= 1 && hash32(state.seed, i, state.year) % 100 < C.mosaicShare * 100);
  if (picked.length === 0) return fail(state, 'invalid', 'Nothing here would carry a cool burn yet: the bush needs more growth');
  const s = cloneState(state);
  const idx = seasonIndexOf(s);
  const gg = s.grid;
  for (const i of picked) {
    const st = gg.stage[i] ?? 0;
    // Mature woodland only dips (the canopy survives); lower growth, which is the real fuel, is knocked back further.
    const dip = st >= 3 ? 0.1 : st === 2 ? 0.22 : 0.1;
    const h = Math.max(0.02, (gg.health[i] ?? 0) - dip);
    gg.health[i] = h;
    gg.stage[i] = stageFromHealth(h);
    gg.weed[i] = 0;
    gg.airPollution[i] = (gg.airPollution[i] ?? 0) + 0.15;
    if (gg.kind[i] === TileKind.Bush && (gg.stage[i] ?? 0) <= 1) gg.kind[i] = TileKind.Land;
  }
  s.budget -= cost;
  s.pendingLandKt += picked.length * 0.2;
  s.country.burns.push({ year: s.year, tiles: picked.length, patch: anchor });
  s.country.boosts.push({ until: idx + 8, tiles: picked });
  addPartnership(s, C.gains.burn, 'Led a cool burn together');
  bump(s, 'burned');
  say(s, C.lines.burnDone(picked.length).text, 'joy', 'burn');
  s.version = state.version + 1;
  // Bump chunk versions for the changed tiles.
  for (const i of picked) {
    const cx = Math.floor((i % gg.w) / 8), cy = Math.floor(Math.floor(i / gg.w) / 8);
    const c = cy * Math.ceil(gg.w / 8) + cx;
    gg.chunkVersion[c] = ((gg.chunkVersion[c] ?? 0) + 1) >>> 0;
  }
  refreshBurningFlag(s);
  return { state: s, result: { ok: true, spent: cost } };
}

/** flags.culturalBurning: 0 until the knowledge is shared, 0.3 once it is, up to 1 with an active burning programme. */
export function refreshBurningFlag(s: GameState): void {
  const C = countryFor(s.scenarioId);
  if (!s.country.unlocked.culturalBurning) { s.flags.culturalBurning = 0; return; }
  const recent = s.country.burns.filter((b) => b.year > s.year - 4).reduce((n, b) => n + b.tiles, 0);
  const target = Math.max(1, s.country.comanaged.length * C.mosaicShare);
  s.flags.culturalBurning = Math.round(clamp(0.3 + 0.7 * (recent / target), 0.3, 1) * 100) / 100;
}

// ---------------------------------------------------------------------------------------------------------
// Time: seasons and years
// ---------------------------------------------------------------------------------------------------------

/** One Act 2 season: regeneration boosts after burns, co-managed bush, seasonal fishing protocols. */
export function countryStep(s: GameState, idx: number): void {
  const g = s.grid;
  const grow = (i: number, dh: number): void => {
    if ((g.building[i] ?? 0) !== 0) return;
    const h = Math.min(1, (g.health[i] ?? 0) + dh);
    g.health[i] = h;
    const st = stageFromHealth(h);
    g.stage[i] = st;
    if (g.kind[i] === TileKind.Land && st >= 3) g.kind[i] = TileKind.Bush;
    else if (g.kind[i] === TileKind.Bush && st <= 1) g.kind[i] = TileKind.Land;
  };
  if (s.country.boosts.length > 0) {
    for (const b of s.country.boosts) for (const i of b.tiles) if ((g.health[i] ?? 0) > 0) grow(i, 0.012);
    s.country.boosts = s.country.boosts.filter((b) => b.until > idx);
  }
  for (const i of s.country.comanaged) {
    if ((g.building[i] ?? 0) !== 0 || (g.health[i] ?? 0) <= 0) continue;
    if (g.weed[i] === 1) { g.weed[i] = 0; if ((g.health[i] ?? 0) > WEED_CAP) g.health[i] = WEED_CAP; }
    grow(i, 0.002);
  }
  if (s.country.unlocked.fishing) {
    for (let i = 0; i < g.kind.length; i++) {
      if (g.kind[i] === TileKind.Estuary && (g.building[i] ?? 0) === 0 && (g.waterPollution[i] ?? 0) < WATER_TOXIC) grow(i, 0.004);
    }
  }
}

/** Year end: slow trust growth, unlock thresholds, the burning flag. */
export function countryYear(s: GameState): void {
  if (!countryActive(s)) return;
  const C = countryFor(s.scenarioId);
  const c = s.country;
  if (c.lastGrowthYear !== s.year) {
    c.lastGrowthYear = s.year;
    const warm = (c.consulted.length > 0 ? 1 : 0) + (c.comanaged.length > 0 ? 1 : 0) + (c.burns.some((b) => b.year > s.year - 3) ? 1 : 0);
    if (warm > 0 && c.disturbed.length <= c.consulted.length + 1) addPartnership(s, C.gains.yearly * warm);
  }
  const p = c.partnership;
  if (!c.unlocked.dualNames && p >= C.thresholds.dualNames) {
    c.unlocked.dualNames = true;
    s.flags.dualNames = 1;
    say(s, C.lines.unlockDualNames.text, 'warm', 'unlock.dualNames');
  }
  if (!c.unlocked.culturalBurning && p >= C.thresholds.culturalBurning) {
    c.unlocked.culturalBurning = true;
    say(s, C.lines.unlockBurning.text, 'warm', 'unlock.culturalBurning');
  }
  if (!c.unlocked.fishing && p >= C.thresholds.fishing) {
    c.unlocked.fishing = true;
    s.flags.fishingProtocol = 1;
    say(s, C.lines.unlockFishing.text, 'joy', 'unlock.fishing');
  }
  refreshBurningFlag(s);
}

/** Dual names the town signs show once unlocked (originals stay placeholders until the community supplies them). */
export function dualNames(s: GameState): { id: string; english: string; original: string }[] {
  if (!s.country.unlocked.dualNames) return [];
  return countryFor(s.scenarioId).places.map((p) => ({ id: p.id, english: p.english, original: p.original.text }));
}
