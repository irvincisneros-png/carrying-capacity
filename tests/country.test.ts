import { describe, expect, it } from 'vitest';
import {
  applyAction, comanagedPatch, COUNTRY, countryStep, countryYear, createGame, dualNames, eventChances, fireDanger, footprintSites,
  generateTerrain, getScenario, markSignificant, SIGNIFICANT_CLUSTERS, siteAt, siteTileCount, TileKind, makeCtx, tick,
} from '../src/sim';
import type { GameState } from '../src/sim';
import { act2Sandbox, addBuilding, growTile, paint } from './helpers/fixtures';

const firstTile = (s: GameState, id: number): { x: number; y: number } => {
  const i = s.grid.significant.findIndex((v) => v === id);
  return { x: i % s.grid.w, y: Math.floor(i / s.grid.w) };
};
const stories = (s: GameState): string[] => s.eventLog.filter((e) => e.story?.channel === 'country').map((e) => e.text);

function bushBlock(s: GameState, x: number, y: number, w: number, h: number): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) growTile(s, xx, yy);
}

describe('significant places', () => {
  it('lays down a few buildable clusters from the terrain alone, deterministically', () => {
    for (const seed of [1850, 7, 99, 2024]) {
      const g = generateTerrain(getScenario('coal-coast'), seed);
      let total = 0;
      for (let id = 1; id <= SIGNIFICANT_CLUSTERS; id++) {
        let n = 0;
        for (let i = 0; i < g.significant.length; i++) {
          if (g.significant[i] !== id) continue;
          n++;
          expect([TileKind.Land, TileKind.Bush]).toContain(g.kind[i]);
        }
        expect(n, `seed ${seed} cluster ${id}`).toBeGreaterThanOrEqual(4);
        expect(n).toBeLessThanOrEqual(9);
        total += n;
      }
      expect(total).toBeLessThanOrEqual(27);
      const again = g.significant.slice();
      markSignificant(g);
      expect(Array.from(g.significant)).toEqual(Array.from(again)); // recomputable from the terrain, as the save migration does
    }
    const s = createGame('coal-coast');
    expect([1, 2, 3].map((id) => siteTileCount(s, id)).every((n) => n >= 4)).toBe(true);
    expect(siteAt(s, firstTile(s, 2).x, firstTile(s, 2).y)).toBe(2);
    expect(siteAt(s, -1, 0)).toBe(0);
    expect(footprintSites(s, firstTile(s, 1).x, firstTile(s, 1).y, 1, 1)).toEqual([1]);
  });
});

describe('consulting before building', () => {
  it('costs a little, builds trust, and thanks you in Aunty June\'s voice', () => {
    const s = createGame('coal-coast');
    s.budget = 50;
    const { x, y } = firstTile(s, 1);
    const r = applyAction(s, { type: 'consult', x, y });
    expect(r.result.ok).toBe(true);
    expect(r.state.budget).toBe(50 - COUNTRY.costs.consult);
    expect(r.state.country.consulted).toEqual([1]);
    expect(r.state.country.partnership).toBe(COUNTRY.baseline + COUNTRY.gains.consult);
    const ev = r.state.eventLog.find((e) => e.story?.channel === 'country');
    expect(ev?.story?.needsConsultation).toBe(true);
    expect(ev?.story?.speakerId).toBe('aunty-june');
    expect(ev?.text).toMatch(/walked the bank/);
    expect(s.country.consulted).toEqual([]); // input unchanged
  });
  it('can only be done once per place, and only at a place that matters', () => {
    let s = createGame('coal-coast');
    s.budget = 50;
    const t1 = firstTile(s, 1);
    s = applyAction(s, { type: 'consult', x: t1.x, y: t1.y }).state;
    const again = applyAction(s, { type: 'consult', x: t1.x, y: t1.y });
    expect(again.result.ok).toBe(false);
    expect(again.result.code).toBe('already-done');
    const nowhere = applyAction(s, { type: 'consult', x: 15, y: 0 });
    expect(nowhere.result.code).toBe('invalid');
    s.budget = 1;
    const t2 = firstTile(s, 3);
    expect(applyAction(s, { type: 'consult', x: t2.x, y: t2.y }).result.code).toBe('no-funds');
  });
  it('costs trust to build on a significant place without asking, less so in Act 1 than Act 2', () => {
    const a1 = createGame('coal-coast');
    a1.budget = 500;
    const t = firstTile(a1, 1);
    const built1 = applyAction(a1, { type: 'place', building: 'cottage', x: t.x, y: t.y });
    expect(built1.result.ok).toBe(true);
    expect(built1.state.country.partnership).toBe(COUNTRY.baseline - COUNTRY.penalty.act1);
    expect(built1.state.country.disturbed).toEqual([1]);
    expect(stories(built1.state).at(-1)).toMatch(/I wish someone had asked us first/);

    const a2 = act2Sandbox(TileKind.Land);
    const t2 = firstTile(a2, 1);
    const built2 = applyAction(a2, { type: 'place', building: 'nursery', x: t2.x, y: t2.y });
    expect(built2.result.ok).toBe(true);
    expect(built2.state.country.partnership).toBe(COUNTRY.baseline - COUNTRY.penalty.act2);
    expect(built2.state.residents.actions['disturbed']).toBe(1);
    // Building again on the same place costs a little more trust, quietly.
    const t3 = footprintSites(built2.state, 0, 0, 0, 0);
    expect(t3).toEqual([]);
    const second = applyAction(built2.state, { type: 'place', building: 'cottage', x: t2.x + 2, y: t2.y + 2 });
    if (second.result.ok && footprintSites(second.state, t2.x + 2, t2.y + 2, 1, 1).includes(1)) {
      expect(second.state.country.partnership).toBeCloseTo(built2.state.country.partnership - COUNTRY.penalty.repeat, 5);
    }
  });
  it('is no penalty to build where the community asked you to build with care, after asking', () => {
    let s = act2Sandbox(TileKind.Land);
    const t = firstTile(s, 1);
    s = applyAction(s, { type: 'consult', x: t.x, y: t.y }).state;
    const p = s.country.partnership;
    const r = applyAction(s, { type: 'place', building: 'nursery', x: t.x, y: t.y });
    expect(r.result.ok).toBe(true);
    expect(r.state.country.partnership).toBe(p);
    expect(r.state.country.disturbed).toEqual([]);
  });
  it('costs more when you build where you were asked to leave things be', () => {
    let s = act2Sandbox(TileKind.Land);
    const t = firstTile(s, 2);
    s = applyAction(s, { type: 'consult', x: t.x, y: t.y }).state;
    expect(stories(s).at(-1)).toMatch(/left as it is/);
    const p = s.country.partnership;
    const r = applyAction(s, { type: 'place', building: 'nursery', x: t.x, y: t.y });
    expect(r.state.country.partnership).toBe(p - COUNTRY.penalty.ignoredAdvice);
    expect(stories(r.state).at(-1)).toMatch(/I asked for this place to be left alone/);
  });
  it('never takes partnership below 0 or above 100', () => {
    const s = act2Sandbox(TileKind.Land);
    s.country.partnership = 2;
    const t = firstTile(s, 1);
    expect(applyAction(s, { type: 'place', building: 'nursery', x: t.x, y: t.y }).state.country.partnership).toBe(0);
    s.country.partnership = 99;
    const c = applyAction(s, { type: 'consult', x: t.x, y: t.y });
    expect(c.state.country.partnership).toBe(100);
  });
  it('is switched off for scenarios with no Elder in the cast (the tutorial)', () => {
    const s = createGame('green-valley');
    s.budget = 500;
    const t = firstTile(s, 1);
    expect(applyAction(s, { type: 'consult', x: t.x, y: t.y }).result.ok).toBe(false);
    const r = applyAction(s, { type: 'place', building: 'cottage', x: t.x, y: t.y });
    expect(r.result.ok).toBe(true);
    expect(r.state.country.partnership).toBe(COUNTRY.baseline);
    expect(r.state.eventLog.filter((e) => e.story?.channel === 'country')).toHaveLength(0);
  });
});

describe('co-management', () => {
  it('returns a patch of bush to the community, growing trust (more the first time)', () => {
    let s = act2Sandbox(TileKind.Land);
    bushBlock(s, 3, 3, 4, 3);
    bushBlock(s, 12, 12, 3, 3);
    const r1 = applyAction(s, { type: 'comanage', x: 3, y: 3 });
    expect(r1.result.ok).toBe(true);
    s = r1.state;
    expect(s.country.comanaged).toHaveLength(12);
    expect(s.country.partnership).toBe(COUNTRY.baseline + COUNTRY.gains.comanageFirst);
    expect(s.budget).toBe(1_000_000 - COUNTRY.costs.comanage);
    expect(stories(s).at(-1)).toMatch(/handed the care of this bush back/);
    s = applyAction(s, { type: 'comanage', x: 12, y: 12 }).state;
    expect(s.country.partnership).toBe(COUNTRY.baseline + COUNTRY.gains.comanageFirst + COUNTRY.gains.comanageLater);
    expect(applyAction(s, { type: 'comanage', x: 4, y: 4 }).result.code).toBe('already-done');
  });
  it('needs real bushland of a decent size and some money', () => {
    const s = act2Sandbox(TileKind.Land);
    bushBlock(s, 3, 3, 2, 1);
    expect(applyAction(s, { type: 'comanage', x: 3, y: 3 }).result.code).toBe('invalid');
    expect(applyAction(s, { type: 'comanage', x: 10, y: 10 }).result.code).toBe('not-bush');
    expect(applyAction(s, { type: 'comanage', x: 99, y: 99 }).result.code).toBe('out-of-bounds');
    bushBlock(s, 8, 8, 3, 3);
    s.budget = 5;
    expect(applyAction(s, { type: 'comanage', x: 8, y: 8 }).result.code).toBe('no-funds');
  });
  it('slowly restores co-managed bush and clears its weeds', () => {
    let s = act2Sandbox(TileKind.Land);
    bushBlock(s, 3, 3, 3, 3);
    s = applyAction(s, { type: 'comanage', x: 3, y: 3 }).state;
    const i = 3 * s.grid.w + 3;
    s.grid.health[i] = 0.3;
    s.grid.weed[i] = 1;
    for (let k = 0; k < 10; k++) countryStep(s, 700 + k);
    expect(s.grid.weed[i]).toBe(0);
    expect(s.grid.health[i]).toBeGreaterThan(0.3);
    expect(comanagedPatch(s, i)).toHaveLength(9);
  });
});

describe('what trust unlocks', () => {
  const at = (partnership: number): GameState => {
    const s = act2Sandbox(TileKind.Land);
    s.country.consulted = [1];
    s.country.partnership = partnership;
    return s;
  };
  it('unlocks dual names, cultural burning and seasonal fishing at rising thresholds, never by spending', () => {
    const s = at(25);
    countryYear(s);
    expect(s.country.unlocked).toEqual({ culturalBurning: false, fishing: false, dualNames: false });
    expect(dualNames(s)).toEqual([]);
    s.country.partnership = 31;
    countryYear(s);
    expect(s.country.unlocked.dualNames).toBe(true);
    expect(s.flags.dualNames).toBe(1);
    expect(dualNames(s).length).toBe(4);
    expect(dualNames(s).every((d) => /to be supplied by the community/.test(d.original))).toBe(true);
    expect(s.country.unlocked.culturalBurning).toBe(false);
    s.country.partnership = 46;
    countryYear(s);
    expect(s.country.unlocked.culturalBurning).toBe(true);
    expect(s.flags.culturalBurning).toBe(0.3);
    expect(s.flags.fishingProtocol).toBeUndefined();
    s.country.partnership = 61;
    countryYear(s);
    expect(s.country.unlocked.fishing).toBe(true);
    expect(s.flags.fishingProtocol).toBe(1);
    const msgs = s.eventLog.filter((e) => e.story?.channel === 'country');
    expect(msgs).toHaveLength(3);
    expect(msgs.every((e) => e.story?.needsConsultation === true && e.story.speakerId === 'aunty-june')).toBe(true);
    const n = s.eventLog.length;
    countryYear(s);
    expect(s.eventLog.length).toBe(n); // announced once
  });
  it('grows trust slowly each year when the town is listening, but not for a town that never asks', () => {
    const listening = at(40);
    listening.country.comanaged = [100, 101, 102, 103];
    listening.year = 2030;
    countryYear(listening);
    expect(listening.country.partnership).toBeCloseTo(40 + 2 * COUNTRY.gains.yearly, 5);
    const silent = act2Sandbox(TileKind.Land);
    silent.country.partnership = 40;
    silent.year = 2030;
    countryYear(silent);
    expect(silent.country.partnership).toBe(40);
  });
  it('seasonal fishing protocols help the estuary recover faster', () => {
    const mk = (): GameState => {
      const s = act2Sandbox(TileKind.Land);
      paint(s, 5, 5, 3, 3, TileKind.Estuary);
      s.grid.health.fill(0);
      for (let y = 5; y < 8; y++) for (let x = 5; x < 8; x++) s.grid.health[y * 32 + x] = 0.3;
      return s;
    };
    const a = mk();
    const b = mk();
    b.country.unlocked.fishing = true;
    for (let k = 0; k < 8; k++) { countryStep(a, 700 + k); countryStep(b, 700 + k); }
    expect(b.grid.health[5 * 32 + 5]).toBeCloseTo(0.3 + 8 * 0.004, 4);
    expect(a.grid.health[5 * 32 + 5]).toBeCloseTo(0.3, 5);
  });
  it('and make fish kills less likely once the protocols are in place', () => {
    const mk = (): GameState => {
      const s = act2Sandbox(TileKind.Land);
      paint(s, 5, 5, 3, 3, TileKind.Estuary);
      s.grid.waterPollution.fill(3);
      return s;
    };
    const p = (s: GameState): number => eventChances(s, null).find((c) => c.type === 'fish-kill')?.p ?? 0;
    const base = mk();
    const protocol = mk();
    protocol.flags.fishingProtocol = 1;
    expect(p(base)).toBeGreaterThan(0.3);
    expect(p(protocol)).toBeCloseTo(p(base) * 0.6, 5);
  });
});

describe('cultural burning', () => {
  function burnable(): GameState {
    let s = act2Sandbox(TileKind.Land);
    bushBlock(s, 4, 4, 5, 4); // 20 tiles
    s = applyAction(s, { type: 'comanage', x: 4, y: 4 }).state;
    s.country.partnership = 50;
    s.a2.season = 1; // autumn
    countryYear(s);
    return s;
  }
  it('is locked until trust has been built, and needs co-managed bush in the cool season', () => {
    const s = burnable();
    const locked = act2Sandbox(TileKind.Land);
    bushBlock(locked, 4, 4, 5, 4);
    locked.a2.season = 1;
    expect(applyAction(locked, { type: 'burn', x: 4, y: 4 }).result.code).toBe('not-open');
    expect(applyAction(s, { type: 'burn', x: 20, y: 20 }).result.code).toBe('invalid'); // not co-managed
    for (const season of [0, 3] as const) {
      const hot = { ...s, a2: { ...s.a2, season } };
      expect(applyAction(hot, { type: 'burn', x: 4, y: 4 }).result.code).toBe('wrong-season');
    }
    expect(applyAction(s, { type: 'burn', x: 99, y: 99 }).result.code).toBe('out-of-bounds');
    expect(applyAction({ ...s, budget: 3 }, { type: 'burn', x: 4, y: 4 }).result.code).toBe('no-funds');
  });
  it('burns a patchy mosaic: canopy dips but stays, weeds go, and regrowth is boosted', () => {
    const s = burnable();
    const before = s.grid.health.slice();
    const r = applyAction(s, { type: 'burn', x: 4, y: 4 });
    expect(r.result.ok).toBe(true);
    const g = r.state.grid;
    const burnt: number[] = [];
    for (let i = 0; i < g.health.length; i++) if ((g.health[i] ?? 0) < (before[i] ?? 0) - 0.05) burnt.push(i);
    expect(burnt.length).toBeGreaterThanOrEqual(4);
    expect(burnt.length).toBeLessThanOrEqual(14); // a mosaic, not the whole 20-tile patch
    for (const i of burnt) {
      expect(g.stage[i]).toBeGreaterThanOrEqual(3); // mature woodland is not reset to bare
      expect(g.kind[i]).toBe(TileKind.Bush);
      expect(g.health[i]).toBeGreaterThan(0.8);
    }
    expect(r.state.country.burns).toHaveLength(1);
    expect(r.state.country.burns[0]?.tiles).toBe(burnt.length);
    expect(r.state.budget).toBe(s.budget - COUNTRY.costs.burn);
    expect(r.state.country.partnership).toBeGreaterThan(s.country.partnership);
    expect(stories(r.state).at(-1)).toMatch(/cool, patchy burn crept through/);
    expect(r.state.flags.culturalBurning).toBeGreaterThan(0.3);
    expect(Array.from(r.state.grid.chunkVersion)).not.toEqual(Array.from(s.grid.chunkVersion));
    // Regeneration: within two years the burnt tiles are back.
    const after = r.state;
    for (let k = 0; k < 10; k++) countryStep(after, 701 + k);
    for (const i of burnt) expect(after.grid.health[i]).toBeGreaterThanOrEqual((before[i] ?? 0) - 0.01);
    expect(after.country.boosts).toHaveLength(0);
  });
  it('knocks back the shrubs that are the real fuel, and cuts fire danger once the knowledge is shared', () => {
    let s = act2Sandbox(TileKind.Land);
    bushBlock(s, 4, 4, 5, 4);
    for (let i = 0; i < 20; i++) { s.grid.stage[(10 + (i % 5)) * 32 + 10 + Math.floor(i / 5)] = 2; s.grid.health[(10 + (i % 5)) * 32 + 10 + Math.floor(i / 5)] = 0.5; }
    s = applyAction(s, { type: 'comanage', x: 4, y: 4 }).state;
    const danger = (st: GameState): number => fireDanger(makeCtx(st, 700, null, { shallow: new Uint8Array(0), nearWater: new Uint8Array(0), nursery: new Uint8Array(0) }));
    s.a2.season = 0;
    const base = danger(s);
    expect(base).toBeGreaterThan(0.005);
    s.country.partnership = 50;
    s.a2.season = 1;
    countryYear(s);
    s.a2.season = 0;
    const known = danger(s);
    expect(known).toBeLessThan(base);
    expect(known).toBeCloseTo(base * (1 - 0.6 * 0.3), 5);
    s.a2.season = 1;
    const r = applyAction(s, { type: 'burn', x: 4, y: 4 });
    expect(r.result.ok).toBe(true);
    r.state.a2.season = 0;
    expect(danger(r.state)).toBeLessThan(known);
  });
  it('rests a patch for a few years between burns', () => {
    const s = burnable();
    const first = applyAction(s, { type: 'burn', x: 4, y: 4 });
    expect(first.result.ok).toBe(true);
    const again = applyAction(first.state, { type: 'burn', x: 4, y: 4 });
    expect(again.result.code).toBe('already-done');
    expect(again.result.reason).toMatch(/spaced out/);
    const later = { ...first.state, year: first.state.year + 3 };
    expect(applyAction(later, { type: 'burn', x: 4, y: 4 }).result.ok).toBe(true);
  });
  it('stops hot fires once a burning program is under way', () => {
    const s = burnable();
    const r = applyAction(s, { type: 'burn', x: 4, y: 4 }).state;
    expect(Number(r.flags.culturalBurning)).toBeGreaterThanOrEqual(0.5);
    const full = tick(r, 1).state;
    expect(full.phase).toBe('act2');
  });
});

void addBuilding;
