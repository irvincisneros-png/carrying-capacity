import { describe, expect, it } from 'vitest';
import {
  addFreeRoad, applyAction, cloneState, createGame, REASON, TileKind, tutorialStatus, tutorialStepsFor, ZONE, ZONE_NAME, zoneReasons,
} from '../src/sim';
import type { GameState } from '../src/sim';
import { BUILDINGS } from '../src/sim/buildings';
import { ZONED_IDS, ZONED_VARIANTS, buildBuildingModel, modelVariant } from '../src/render/models/buildings';
import { legacyHomeHidden, zoneDragInfo, zoneOverlayCodes, zoneTileInfo } from '../src/ui/zonemenu';
import { addBuilding } from './helpers/fixtures';
import { followTutorial } from './helpers/valley';
import { keepZoned, zoneArea } from './helpers/zoning';

/** An open 32 x 32 field with a street along row 10 (as in zoning.test.ts), plenty of money. */
function field(year = 1960): GameState {
  const s = cloneState(createGame('green-valley'));
  const g = s.grid;
  g.kind.fill(TileKind.Land);
  g.elevation.fill(1);
  g.building.fill(0);
  g.zoning.fill(0);
  g.zone.fill(0);
  g.significant.fill(0);
  g.airPollution.fill(0);
  g.waterPollution.fill(0);
  g.soilContamination.fill(0);
  s.buildings = [];
  s.nextUid = 1;
  for (const k of Object.keys(s.flags)) if (k.startsWith('road.entrance')) delete s.flags[k];
  s.year = year;
  s.budget = 5000;
  s.population = 0;
  for (let x = 0; x <= 19; x++) addFreeRoad(s, 10 * g.w + x);
  s.flags['road.entrance'] = 10 * g.w;
  return s;
}

describe('the Green Valley scripted player zones instead of placing homes', () => {
  const run = followTutorial();
  it('never places a cottage or suburb, and grows homes and shops from zones', () => {
    const types = new Set(run.end.buildings.map((b) => b.type));
    expect(types.has('cottage')).toBe(false);
    expect(types.has('suburb')).toBe(false);
    expect(run.end.buildings.filter((b) => b.grown && b.type.startsWith('zres')).length).toBeGreaterThanOrEqual(5);
    expect(run.end.buildings.filter((b) => b.type === 'zcom').length).toBeGreaterThanOrEqual(1);
    expect(run.end.residents.actions['zoned.res']).toBeGreaterThan(0);
    expect(run.end.residents.actions['zoned.com']).toBeGreaterThan(0);
  });
  it('latches every tutorial step through latchTutorial', () => {
    // The last step (reaching the epilogue) is a phase, not an action, so it is read live; every other step is latched.
    for (const st of tutorialStepsFor('green-valley')) if (st.id !== 'finish') expect(run.end.flags[`tut.done.${st.id}`], st.id).toBe(true);
    expect(tutorialStatus(run.end).completed).toBe(true);
  });
  it('zones before it places a farm: the first four steps are homes, shops, farm and roads', () => {
    expect(run.log.slice(0, 5)).toEqual(['homes', 'shops', 'farm', 'roads', 'clear']);
  });
});

describe('the build menu', () => {
  it('leaves the cottage and brick suburb out of a new game, and keeps them for a saved town that has them', () => {
    const s = createGame('green-valley');
    expect(legacyHomeHidden(s, 'cottage')).toBe(true);
    expect(legacyHomeHidden(s, 'suburb')).toBe(true);
    expect(legacyHomeHidden(s, 'farm')).toBe(false);
    const old = cloneState(s);
    addBuilding(old, 'cottage', 4, 4);
    expect(legacyHomeHidden(old, 'cottage')).toBe(false);
    expect(legacyHomeHidden(old, 'suburb')).toBe(false);
    // The definitions stay, so old saves load.
    expect(BUILDINGS.cottage.housing).toBeGreaterThan(0);
    expect(BUILDINGS.suburb.housing).toBeGreaterThan(0);
  });
});

describe('the zone overlay and its words', () => {
  it('paints each family of zone, and hatches tiles that cannot grow yet', () => {
    let s = field();
    s = zoneArea(s, { x: 2, y: 8, w: 4, h: 1 }, ZONE.rlow);
    s = zoneArea(s, { x: 8, y: 11, w: 2, h: 1 }, ZONE.com);
    s = zoneArea(s, { x: 12, y: 8, w: 2, h: 1 }, ZONE.ind);
    const at = (c: Uint8Array, x: number, y: number): number => c[y * s.grid.w + x] ?? 0;
    const c = zoneOverlayCodes(s);
    expect(at(c, 0, 0)).toBe(0);
    // Nothing has grown and nothing is needed yet beyond a base: tiles are ready (solid) or waiting (hatched), never unzoned.
    expect([1, 4]).toContain(at(c, 2, 8));
    expect([2, 5]).toContain(at(c, 8, 11));
    expect([3, 6]).toContain(at(c, 12, 8));
    // A zone with no road within reach is hatched.
    const lonely = cloneState(s);
    lonely.grid.zoning[25 * lonely.grid.w + 25] = ZONE.rlow;
    expect(at(zoneOverlayCodes(lonely), 25, 25)).toBe(4);
    // A grown building is solid.
    const grown = cloneState(s);
    addBuilding(grown, 'zres1', 2, 8);
    grown.buildings[grown.buildings.length - 1]!.grown = true;
    expect(at(zoneOverlayCodes(grown), 2, 8)).toBe(1);
  });

  it('says why a zoned tile is waiting: no road, no power, no demand', () => {
    const s = field();
    const lonely = cloneState(s);
    lonely.grid.zoning[25 * lonely.grid.w + 25] = ZONE.rlow;
    expect(zoneTileInfo(lonely, 25, 25, ZONE.rlow).html).toMatch(/road/i);
    // Plenty of homes already (no jobs): the next home has no demand.
    let town = zoneArea(s, { x: 2, y: 8, w: 8, h: 1 }, ZONE.rlow);
    for (let i = 0; i < 4; i++) town = applyAction(town, { type: 'zone', x: 2, y: 8, w: 8, h: 1, zone: ZONE.rlow }).state;
    const codes = zoneReasons(town);
    expect(codes[8 * town.grid.w + 2]).not.toBe(REASON.noRoad);
    const need = zoneTileInfo(town, 3, 8, ZONE.rlow);
    expect(need.html).toContain(ZONE_NAME[ZONE.rlow]);
    // Power: a lot of factories and no power station once the grid is running.
    let p = field(1960);
    for (const x of [6, 9, 12, 15]) addBuilding(p, 'factory', x, 11);
    p = zoneArea(p, { x: 0, y: 8, w: 18, h: 2 }, ZONE.rlow);
    let lack = 0;
    const rp = zoneReasons(p);
    for (let i = 0; i < rp.length; i++) if (rp[i] === REASON.noPower) lack++;
    expect(lack).toBeGreaterThan(0);
  });

  it('shows a live cost while a rectangle is dragged, and a reason when it cannot be zoned', () => {
    const s = field();
    const ok = zoneDragInfo(s, { x: 2, y: 8, w: 5, h: 2 }, ZONE.rlow);
    expect(ok.ok).toBe(true);
    expect(ok.html).toMatch(/10 tiles/);
    expect(ok.html).toMatch(/\$[\d.]+k/);
    // A box beyond the road reaches only the tiles within 2 tiles of it: the rest are skipped.
    const part = zoneDragInfo(s, { x: 3, y: 5, w: 2, h: 5 }, ZONE.com);
    expect(part.ok).toBe(true);
    expect(part.html).toMatch(/skipped/);
    const bad = zoneDragInfo(s, { x: 3, y: 0, w: 3, h: 2 }, ZONE.rlow);
    expect(bad.ok).toBe(false);
    expect(bad.html).toMatch(/road/i);
    // Era: medium homes can't be zoned before 1950.
    expect(zoneTileInfo(field(1900), 4, 9, ZONE.rmed).html).toMatch(/1950/);
    // Dezone warns about what grown buildings it will knock down.
    let g = field();
    g = zoneArea(g, { x: 3, y: 8, w: 1, h: 1 }, ZONE.rlow);
    addBuilding(g, 'zres1', 3, 8);
    g.buildings[g.buildings.length - 1]!.grown = true;
    expect(zoneDragInfo(g, { x: 3, y: 8, w: 1, h: 1 }, ZONE.none).html).toMatch(/knocked down/);
    expect(zoneTileInfo(s, 4, 4, ZONE.none).tone).toBe('bad');
  });

  it('keepZoned and zoneArea agree with the drag: the cost shown is the cost paid', () => {
    const s = field();
    const info = zoneDragInfo(s, { x: 2, y: 8, w: 5, h: 2 }, ZONE.rmed);
    const r = applyAction(s, { type: 'zone', x: 2, y: 8, w: 5, h: 2, zone: ZONE.rmed });
    expect(info.html).toContain(`$${Math.round((r.result.spent ?? 0) * 10) / 10}k`);
    expect(keepZoned(s, ZONE.rlow, 4) === s).toBe(false);
  });
});

describe('models for grown buildings', () => {
  it('chooses a variant from the era and a stable mirror from the uid', () => {
    expect(modelVariant('zres1', 1940, 3) & 1).toBe(0);
    expect(modelVariant('zres1', 1960, 3) & 1).toBe(1);
    expect(modelVariant('zres3', 1990, 3) & 1).toBe(0);
    expect(modelVariant('zres3', 2010, 3) & 1).toBe(1);
    expect(modelVariant('zcom', 1960, 9)).toBe(modelVariant('zcom', 1960, 9));
    const mirrors = new Set(Array.from({ length: 40 }, (_, i) => modelVariant('zres2', 1960, i + 1) >> 1));
    expect(mirrors.size).toBe(2);
    expect(modelVariant('zind', 2030, 5) & 1).toBe(0);
  });

  it('builds every zoned model and variant at both detail levels, sitting on the tile and within the height budget', () => {
    for (const id of ZONED_IDS) {
      for (let v = 0; v < ZONED_VARIANTS; v++) {
        const hi = buildBuildingModel(id as 'zres1', 1, 0, v);
        const lo = buildBuildingModel(id as 'zres1', 0, 0, v);
        const tris = (hi.geo.index ? hi.geo.index.count : hi.geo.attributes.position!.count) / 3;
        const trisLo = (lo.geo.index ? lo.geo.index.count : lo.geo.attributes.position!.count) / 3;
        expect(tris, `${id} v${v}`).toBeGreaterThan(40);
        expect(tris, `${id} v${v}`).toBeLessThan(4500);
        expect(trisLo, `${id} v${v} low`).toBeLessThanOrEqual(tris);
        expect(hi.height, `${id} v${v}`).toBeGreaterThan(0.1);
        expect(hi.height, `${id} v${v}`).toBeLessThan(1.1);
        hi.geo.computeBoundingBox();
        const bb = hi.geo.boundingBox!;
        // One tile: nothing sticks out past the edges by more than a roof overhang.
        expect(bb.max.x - bb.min.x, `${id} v${v} width`).toBeLessThan(1.12);
        expect(bb.max.z - bb.min.z, `${id} v${v} depth`).toBeLessThan(1.12);
        expect(hi.stacks, id).toHaveLength(0);
      }
    }
  });
});
