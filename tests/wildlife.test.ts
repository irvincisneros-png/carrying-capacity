import { describe, expect, it } from 'vitest';
import {
  speciesFor,
  applyAction, canPlace, census, evaluateHabitat, habitatMask, initWildlife, isThriving, noteHeat, objectiveStatus, patchesOf,
  publishWildlifeMetric, roadExposure, SPECIES_BY_ID, speciesStatus, TileKind, tick, wildlifeSummer, wildlifeYear, woodlandMask,
} from '../src/sim';
import type { GameState, SpeciesDef } from '../src/sim';
import { act2Sandbox, addBuilding, fillField, growTile, paint } from './helpers/fixtures';

const def = (id: string): SpeciesDef => SPECIES_BY_ID[id] as SpeciesDef;

function wood(s: GameState, x: number, y: number, w: number, h: number): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) growTile(s, xx, yy);
}

/** Two 4x4 woodlands with a road between them. */
function splitWoods(): GameState {
  const s = act2Sandbox(TileKind.Land);
  wood(s, 2, 2, 4, 4);
  wood(s, 7, 2, 4, 4);
  for (let y = 2; y < 6; y++) addBuilding(s, 'road', 6, y);
  return s;
}

const events = (s: GameState, ref: string): string[] => s.eventLog.filter((e) => e.story?.channel === 'wildlife' && e.story.ref === ref).map((e) => e.text);

describe('patches, corridors and crossings', () => {
  it('finds mature woodland and joins it into patches (4-connected)', () => {
    const s = act2Sandbox(TileKind.Land);
    wood(s, 2, 2, 5, 3);
    wood(s, 12, 12, 2, 2);
    s.grid.health[2 * s.grid.w + 2] = 0.5; // too young to count
    const mask = woodlandMask(s, 0.7);
    expect(mask.reduce((n, v) => n + v, 0)).toBe(18);
    const ps = patchesOf(s, mask);
    expect(ps.map((p) => p.size)).toEqual([14, 4]);
  });
  it('lets a road split a woodland in two, and a wildlife crossing join it again', () => {
    const s = splitWoods();
    const mask = woodlandMask(s, 0.7);
    expect(patchesOf(s, mask).map((p) => p.size)).toEqual([16, 16]);
    const r = applyAction(s, { type: 'place', building: 'wildlifecrossing', x: 6, y: 3 });
    expect(r.result.ok).toBe(true);
    expect(r.state.buildings.filter((b) => b.type === 'road')).toHaveLength(3); // the crossing replaced one road tile
    expect(patchesOf(r.state, woodlandMask(r.state, 0.7)).map((p) => p.size)).toEqual([32]);
  });
  it('also breaks corridors with industry, and lets a crossing be built only on a road', () => {
    const s = act2Sandbox(TileKind.Land);
    wood(s, 2, 2, 4, 4);
    wood(s, 7, 2, 4, 4);
    addBuilding(s, 'factory', 6, 2); // 2x2: occupies x 6-7, y 2-3 (and one woodland column)
    expect(patchesOf(s, woodlandMask(s, 0.7)).length).toBeGreaterThanOrEqual(1);
    const chk = canPlace(s, 'wildlifecrossing', 1, 1);
    expect(chk.ok).toBe(false);
    expect(chk.code).toBe('needs-nearby-building');
    expect(chk.reason).toMatch(/Road/);
    const road = splitWoods();
    expect(canPlace(road, 'wildlifecrossing', 6, 3).ok).toBe(true);
    expect(canPlace(road, 'wildlifecrossing', 6, 3).cost).toBe(30);
  });
  it('measures how much woodland edge sits on a road with no crossing nearby', () => {
    const s = splitWoods();
    const tiles = Array.from(woodlandMask(s, 0.7)).flatMap((v, i) => (v === 1 ? [i] : []));
    const exposed = roadExposure(s, tiles);
    expect(exposed).toBe(8); // the two columns beside the road
    const withCrossing = applyAction(s, { type: 'place', building: 'wildlifecrossing', x: 6, y: 3 }).state;
    expect(roadExposure(withCrossing, tiles)).toBe(0);
  });
});

describe('habitat evaluation', () => {
  it('koala: needs one connected woodland patch of 14+ tiles, scaled by size', () => {
    const small = act2Sandbox(TileKind.Land);
    wood(small, 2, 2, 3, 4); // 12
    const e1 = evaluateHabitat(small, def('koala'));
    expect(e1.suitable).toBe(false);
    expect(e1.limiting).toMatch(/biggest connected woodland is 12 tiles; it needs 14/);
    const big = act2Sandbox(TileKind.Land);
    wood(big, 2, 2, 5, 4); // 20
    const e2 = evaluateHabitat(big, def('koala'));
    expect(e2.suitable).toBe(true);
    expect(e2.capacity).toBe(6);
    expect(e2.quality).toBeGreaterThan(e1.quality);
    expect(habitatMask(big, 'koala').reduce((n, v) => n + v, 0)).toBe(20);
  });
  it('koala: two woodlands that are each big enough both count; cut by a road they are less safe', () => {
    const s = splitWoods();
    const split = evaluateHabitat(s, def('koala'));
    expect(split.suitable).toBe(true);
    expect(split.extra.patches).toBe(2);
    expect(split.extra.exposedFrac).toBeCloseTo(0.25, 5);
    expect(split.limiting).toMatch(/Roads cut through 25% of the woodland edge/);
    const joined = applyAction(s, { type: 'place', building: 'wildlifecrossing', x: 6, y: 3 }).state;
    const j = evaluateHabitat(joined, def('koala'));
    expect(j.extra.patches).toBe(1);
    expect(j.extra.exposedFrac).toBe(0);
    expect(j.quality).toBeGreaterThan(split.quality);
  });
  it('koala: polluted air over the woodland makes it unsuitable', () => {
    const s = act2Sandbox(TileKind.Land);
    wood(s, 2, 2, 5, 4);
    s.grid.airPollution.fill(3);
    const e = evaluateHabitat(s, def('koala'));
    expect(e.suitable).toBe(false);
    expect(e.limiting).toMatch(/Air pollution/);
  });
  it('glossy black-cockatoo: needs coastal she-oak regrowth and a patch of old woodland', () => {
    const s = act2Sandbox(TileKind.Land);
    paint(s, 0, 0, 1, 32, TileKind.Beach);
    // Shrub-stage coast, two tiles deep: 20 tiles.
    for (let y = 0; y < 10; y++) for (let x = 1; x < 3; x++) { s.grid.health[y * s.grid.w + x] = 0.5; s.grid.stage[y * s.grid.w + x] = 2; }
    const noHollows = evaluateHabitat(s, def('black-cockatoo'));
    expect(noHollows.suitable).toBe(false);
    expect(noHollows.limiting).toMatch(/nest hollows/);
    wood(s, 10, 10, 3, 3);
    const ok = evaluateHabitat(s, def('black-cockatoo'));
    expect(ok.suitable).toBe(true);
    expect(ok.capacity).toBe(10);
  });
  it('green turtle: seagrass, clean water and a dark beach, with amber lights helping', () => {
    const s = act2Sandbox(TileKind.Land);
    paint(s, 10, 0, 1, 32, TileKind.Beach);
    paint(s, 11, 0, 3, 32, TileKind.Sea);
    for (let y = 0; y < 32; y++) for (let x = 11; x < 13; x++) { s.grid.health[y * s.grid.w + x] = 0.6; s.grid.stage[y * s.grid.w + x] = 2; }
    const clear = evaluateHabitat(s, def('green-turtle'));
    expect(clear.suitable).toBe(true);
    expect(clear.extra.nestOk).toBe(1);
    expect(clear.extra.darkFrac).toBe(1);
    // Homes along the beach light it up.
    for (let y = 0; y < 32; y += 3) addBuilding(s, 'cottage', 8, y);
    const lit = evaluateHabitat(s, def('green-turtle'));
    expect(lit.extra.darkFrac).toBeLessThan(0.4);
    expect(lit.extra.nestOk).toBe(0);
    expect(lit.limiting).toMatch(/of the beach is dark at night/);
    s.flags['turtle.lights'] = 2; // lights out in nesting season
    expect(evaluateHabitat(s, def('green-turtle')).extra.darkFrac).toBeGreaterThan(lit.extra.darkFrac);
    // Polluted water keeps her away altogether.
    const dirty = act2Sandbox(TileKind.Land);
    paint(dirty, 10, 0, 1, 32, TileKind.Beach);
    paint(dirty, 11, 0, 3, 32, TileKind.Sea);
    for (let y = 0; y < 32; y++) { dirty.grid.health[y * 32 + 11] = 0.6; dirty.grid.waterPollution[y * 32 + 11] = 2; }
    expect(evaluateHabitat(dirty, def('green-turtle')).suitable).toBe(false);
  });
  it('platypus: clean river, bank plants, and no drought', () => {
    const s = act2Sandbox(TileKind.Land);
    paint(s, 5, 0, 1, 32, TileKind.River);
    for (let y = 0; y < 8; y++) for (const x of [4, 6]) { s.grid.health[y * 32 + x] = 0.5; s.grid.stage[y * 32 + x] = 2; }
    expect(evaluateHabitat(s, def('platypus')).suitable).toBe(true);
    s.grid.waterPollution.fill(1);
    expect(evaluateHabitat(s, def('platypus')).limiting).toMatch(/River water is too polluted/);
    s.grid.waterPollution.fill(0);
    s.a2.active.push({ type: 'drought', endsAt: 99999, severity: 1 });
    const dry = evaluateHabitat(s, def('platypus'));
    expect(dry.suitable).toBe(false);
    expect(dry.limiting).toMatch(/drought/);
  });
  it('frogs: need a stormwater wetland with clean water around it', () => {
    const s = act2Sandbox(TileKind.Land);
    expect(evaluateHabitat(s, def('frogs')).limiting).toMatch(/Build a stormwater wetland/);
    addBuilding(s, 'wetland', 5, 5);
    const ok = evaluateHabitat(s, def('frogs'));
    expect(ok.suitable).toBe(true);
    expect(ok.capacity).toBe(22);
    fillField(s, s.grid.waterPollution, 0, 0, 32, 32, 2);
    expect(evaluateHabitat(s, def('frogs')).suitable).toBe(false);
  });
  it('flying-fox: a big healthy woodland roost near water', () => {
    const s = act2Sandbox(TileKind.Land);
    wood(s, 5, 5, 4, 4);
    expect(evaluateHabitat(s, def('flying-fox')).suitable).toBe(false); // no water within 5 tiles
    paint(s, 3, 0, 1, 32, TileKind.River);
    const ok = evaluateHabitat(s, def('flying-fox'));
    expect(ok.suitable).toBe(true);
    expect(ok.capacity).toBe(16 * 14);
  });
  it('shorebirds: quiet estuary mudflats and healthy water', () => {
    const s = act2Sandbox(TileKind.Land);
    paint(s, 10, 10, 3, 3, TileKind.Estuary);
    expect(evaluateHabitat(s, def('shorebirds')).suitable).toBe(true);
    addBuilding(s, 'cottage', 9, 10);
    addBuilding(s, 'cottage', 9, 11);
    addBuilding(s, 'cottage', 9, 12);
    addBuilding(s, 'cottage', 13, 10);
    const noisy = evaluateHabitat(s, def('shorebirds'));
    expect(noisy.extra.quiet).toBeLessThan(9);
    s.grid.waterPollution.fill(3);
    expect(evaluateHabitat(s, def('shorebirds')).limiting).toMatch(/Estuary water health/);
  });
});

describe('populations, families and events', () => {
  it('starts with remnants and names the families that are present', () => {
    const s = act2Sandbox(TileKind.Land);
    wood(s, 2, 2, 5, 4);
    initWildlife(s);
    expect(s.wildlife.initialised).toBe(true);
    expect(s.wildlife.species.koala?.pop).toBe(6);
    expect(s.wildlife.species.koala?.families['marri']).toBe(true);
    expect(s.wildlife.species.koala?.families['wattle-gully']).toBe(false);
    expect(s.wildlife.species.platypus?.pop).toBe(0);
    expect(s.wildlife.species['green-turtle']?.families['old-shelly']).toBe(true);
    expect(census(s).find((c) => c.id === 'koala')?.families).toEqual(['Marri woodland koalas']);
  });
  it('welcomes an arrival after the habitat has been suitable for a few years, with a warm event', () => {
    const s = act2Sandbox(TileKind.Land);
    wood(s, 2, 2, 5, 4);
    initWildlife(s);
    (s.wildlife.species.koala as { pop: number }).pop = 0;
    s.wildlife.species.koala = { ...(s.wildlife.species.koala as NonNullable<typeof s.wildlife.species.koala>), pop: 0, goodYears: 0 };
    for (let y = 0; y < 2; y++) { s.year++; wildlifeYear(s); }
    expect(s.wildlife.species.koala?.pop).toBe(0);
    s.year++;
    wildlifeYear(s);
    expect(s.wildlife.species.koala?.pop).toBe(4);
    const msgs = events(s, 'koala');
    expect(msgs.some((m) => /Koalas have found the woodland again: 4 arrived/.test(m))).toBe(true);
    expect(msgs.some((m) => m.includes('Koalas are back in the Marri woodland'))).toBe(true);
    expect(s.wildlife.species.koala?.arrivedYear).toBe(s.year);
  });
  it('grows towards capacity when habitat is good and declines, then is lost, when it is not', () => {
    const s = act2Sandbox(TileKind.Land);
    wood(s, 2, 2, 6, 5); // 30 tiles -> capacity 9
    initWildlife(s);
    for (let y = 0; y < 30; y++) { s.year++; wildlifeYear(s); }
    expect(s.wildlife.species.koala?.pop).toBe(9);
    expect(s.wildlife.species.koala?.peak).toBe(9);
    expect(s.wildlife.species.koala?.families['wattle-gully']).toBe(true);
    // Take the trees away.
    s.grid.kind.fill(TileKind.Land);
    s.grid.stage.fill(0);
    s.grid.health.fill(0.05);
    let last = 9;
    for (let y = 0; y < 12; y++) {
      s.year++;
      wildlifeYear(s);
      const p = s.wildlife.species.koala?.pop ?? 0;
      expect(p).toBeLessThanOrEqual(last);
      last = p;
    }
    expect(last).toBe(0);
    expect(s.wildlife.species.koala?.lostYear).not.toBeNull();
    expect(events(s, 'koala').some((m) => /last koala has left/.test(m))).toBe(true);
    expect(events(s, 'koala').some((m) => /Marri woodland koalas have gone/.test(m))).toBe(true);
    expect(speciesStatus(s, def('koala'))).toBe('gone');
  });
  it('kills koalas on roads with no crossing, far fewer with fencing, none with a crossing', () => {
    const run = (mutate: (s: GameState) => void): { pop: number; kills: number } => {
      const s = splitWoods();
      mutate(s);
      initWildlife(s);
      (s.wildlife.species.koala as { pop: number }).pop = 24;
      for (let y = 0; y < 3; y++) { s.year++; wildlifeYear(s); }
      return { pop: s.wildlife.species.koala?.pop ?? 0, kills: s.wildlife.roadKills };
    };
    const bare = run(() => undefined);
    const fenced = run((s) => { s.flags['koala.roadSafe'] = 1; });
    const crossed = run((s) => { addBuilding(s, 'wildlifecrossing', 6, 3); });
    expect(bare.kills).toBeGreaterThan(0);
    expect(fenced.kills).toBeLessThan(bare.kills);
    expect(crossed.kills).toBe(0);
    expect(crossed.pop).toBeGreaterThanOrEqual(bare.pop);
    const s = splitWoods();
    initWildlife(s);
    (s.wildlife.species.koala as { pop: number }).pop = 24;
    for (let y = 0; y < 3; y++) { s.year++; wildlifeYear(s); }
    expect(events(s, 'koala').some((m) => /killed on the road/.test(m))).toBe(true);
  });
  it('has Old Shelly nest each summer if the beach is clean, seagrass healthy and the beach dark', () => {
    const s = act2Sandbox(TileKind.Land);
    paint(s, 10, 0, 1, 32, TileKind.Beach);
    paint(s, 11, 0, 3, 32, TileKind.Sea);
    for (let y = 0; y < 32; y++) for (let x = 11; x < 13; x++) { s.grid.health[y * 32 + x] = 0.6; s.grid.stage[y * 32 + x] = 2; }
    initWildlife(s);
    for (let y = 0; y < 3; y++) { s.year++; wildlifeSummer(s); }
    const rt = s.wildlife.species['green-turtle'];
    expect(rt?.nests).toBe(3);
    expect(rt?.nestStreak).toBe(3);
    expect(rt?.lastNestYear).toBe(s.year);
    const msgs = events(s, 'green-turtle');
    expect(msgs[0]).toMatch(/A green turtle came ashore at night and laid \d+ eggs/);
    expect(msgs.some((m) => /3 summers in a row/.test(m))).toBe(true);
    // Lights come on along the beach: the streak breaks, and Shelly stays away with a reason.
    for (let y = 0; y < 32; y += 3) addBuilding(s, 'cottage', 8, y);
    s.year++;
    wildlifeSummer(s);
    expect(s.wildlife.species['green-turtle']?.nestStreak).toBe(0);
    expect(events(s, 'green-turtle').at(-1)).toMatch(/No turtle came ashore to nest this summer.*dark at night/);
  });
  it('kills flying-foxes in heatwaves, less so with shade, and never goes below zero', () => {
    const base = (): GameState => {
      const s = act2Sandbox(TileKind.Land);
      wood(s, 5, 5, 4, 4);
      paint(s, 3, 0, 1, 32, TileKind.River);
      initWildlife(s);
      (s.wildlife.species['flying-fox'] as { pop: number }).pop = 200;
      return s;
    };
    const calm = base();
    calm.year++;
    wildlifeYear(calm);
    const hot = base();
    noteHeat(hot, 1.2);
    hot.year++;
    wildlifeYear(hot);
    const shaded = base();
    shaded.flags['wildlife.shade'] = 1;
    noteHeat(shaded, 1.2);
    shaded.year++;
    wildlifeYear(shaded);
    const p = (s: GameState): number => s.wildlife.species['flying-fox']?.pop ?? 0;
    expect(p(hot)).toBeLessThan(p(calm) - 40);
    expect(p(shaded)).toBeGreaterThan(p(hot));
    expect(p(shaded)).toBeLessThan(p(calm));
    expect(events(hot, 'flying-fox').some((m) => /heatwave killed about \d+ animals/.test(m))).toBe(true);
    expect(hot.wildlife.species['flying-fox']?.heatStress).toBe(0); // reset after the year
    const apocalypse = base();
    noteHeat(apocalypse, 50);
    apocalypse.year++;
    wildlifeYear(apocalypse);
    expect(p(apocalypse)).toBeGreaterThanOrEqual(0);
  });
  it('publishes the wildlife bonus metric when koalas and turtles are both thriving', () => {
    const s = act2Sandbox(TileKind.Land);
    initWildlife(s);
    expect(s.flags['metric.wildlifeThriving']).toBe(0);
    const koala = s.wildlife.species.koala as NonNullable<typeof s.wildlife.species.koala>;
    const turtle = s.wildlife.species['green-turtle'] as NonNullable<typeof s.wildlife.species['green-turtle']>;
    koala.pop = 20;
    turtle.pop = 4;
    turtle.nestStreak = 2;
    publishWildlifeMetric(s);
    expect(s.flags['metric.wildlifeThriving']).toBe(0); // turtle has not nested three summers running
    turtle.nestStreak = 3;
    publishWildlifeMetric(s);
    expect(s.flags['metric.wildlifeThriving']).toBe(1);
    expect(isThriving(koala, def('koala'))).toBe(true);
    expect(objectiveStatus(s).find((o) => o.id === 'wildlife')?.status).toBe('on-track');
    expect(speciesStatus(s, def('koala'))).toBe('thriving');
  });
  it('gives every scenario its own species list', () => {
    expect(speciesFor('green-valley').map((x) => x.id)).toEqual(['koala', 'frogs']);
    expect(speciesFor('river-town').map((x) => x.id)).toEqual(['platypus', 'murray-cod', 'superb-parrot', 'southern-bell-frog']);
    expect(speciesFor('reef-island').map((x) => x.id)).toEqual(['reef-turtle', 'dugong', 'reef-fish', 'mangrove-kingfisher']);
    expect(speciesFor('red-dirt').map((x) => x.id)).toEqual(['bilby', 'rock-wallaby', 'budgerigar']);
    expect(speciesFor('net-zero-city').map((x) => x.id)).toEqual(['flying-fox', 'shorebirds', 'powerful-owl']);
  });
  it('is reproducible and does not change when the clock is split differently', () => {
    const a = act2Sandbox(TileKind.Land);
    wood(a, 2, 2, 6, 5);
    const x = tick(tick(a, 4).state, 6).state;
    const y = tick(a, 10).state;
    expect(JSON.stringify(x.wildlife)).toBe(JSON.stringify(y.wildlife));
    expect(x.wildlife.species.koala?.history.length).toBeGreaterThan(5);
  });
});
