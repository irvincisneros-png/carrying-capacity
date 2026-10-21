import { describe, expect, it } from 'vitest';
import {
  applyAction, computeMeters, countKind, createGame, economySnapshot, generateTerrain, getScenario, roadAccess, SCENARIO_IDS, townFocus, TileKind,
} from '../src/sim';
import type { GameState, ScenarioId } from '../src/sim';
import { dilate } from '../src/sim/grid';
import { cityCentre } from '../src/sim/prebuilt';
import { MapGeo } from '../src/render/mapgeo';
import { biomeLook } from '../src/render/biome';
import { buildTerrain, TERRAIN_CHUNK } from '../src/render/terrain';
import { BRUSH_SPACING } from '../src/ui/toolbar';
import { act2Sandbox } from './helpers/fixtures';

/** Round 6 (WP6): the enlarged maps, and the things that were tied to the map's size. */
const SIZES: Record<ScenarioId, number> = {
  'green-valley': 32, 'coal-coast': 64, 'river-town': 64, 'red-dirt': 64, 'reef-island': 64, 'net-zero-city': 72,
};

describe('the enlarged maps', () => {
  it('have the sizes the plan asks for, square, with the pollution reference at the original area', () => {
    for (const id of SCENARIO_IDS) {
      const sc = getScenario(id);
      expect([sc.mapW, sc.mapH], id).toEqual([SIZES[id], SIZES[id]]);
      expect(createGame(id).grid.w, id).toBe(SIZES[id]);
    }
    expect(getScenario('green-valley').pollutionRefTiles).toBe(16 * 16);
    expect(getScenario('net-zero-city').pollutionRefTiles).toBe(48 * 48);
    for (const id of ['coal-coast', 'river-town', 'red-dirt', 'reef-island'] as const) expect(getScenario(id).pollutionRefTiles, id).toBe(32 * 32);
  });

  it('keep the mine pit and the reef a size the job and the money were set for', () => {
    const red = getScenario('red-dirt');
    const pit = countKind(generateTerrain(red, red.seed), TileKind.Pit);
    expect(pit).toBeGreaterThan(90);
    expect(pit).toBeLessThan(180);
    const reef = getScenario('reef-island');
    const reefTiles = countKind(generateTerrain(reef, reef.seed), TileKind.Reef);
    expect(reefTiles).toBeGreaterThan(300);
    expect(reefTiles).toBeLessThan(500);
  });

  it('give Net Zero City the same starting city on more land: the homes and jobs match the 48x48 city and every building is on the road', () => {
    const s = createGame('net-zero-city');
    const snap = economySnapshot(s);
    expect(snap.housing).toBeGreaterThan(4100);
    expect(snap.housing).toBeLessThan(4500);
    expect(snap.jobs).toBeGreaterThan(1500);
    expect(snap.jobs).toBeLessThan(1800);
    expect(roadAccess(s).unconnected).toEqual([]);
    const c = cityCentre(s);
    // the built-up area stays round the harbour: nothing is placed in the far corners of the hinterland
    const far = s.buildings.filter((b) => b.type !== 'road' && b.type !== 'farm' && Math.hypot(b.x - c.x, b.y - c.y) > 40);
    expect(far).toEqual([]);
  });

  it('measure the Environment meter\'s bush term against the original area, so the same clearing costs the same on a bigger map', () => {
    const small = createGame('coal-coast');
    const clearTiles = (s: GameState, n: number): GameState => {
      const g = s.grid;
      let done = 0;
      for (let i = 0; i < g.kind.length && done < n; i++) if (g.kind[i] === TileKind.Bush) { g.kind[i] = TileKind.Land; done++; }
      return s;
    };
    const base = computeMeters(small).environment;
    const hit = computeMeters(clearTiles(createGame('coal-coast'), 100)).environment;
    // 100 of about 1600 bush tiles is 6% on the map, but 25% of the bush the original 32x32 map had: it must show in the meter.
    expect(base - hit).toBeGreaterThan(4);
  });
});

describe('the camera and the town', () => {
  it('opens on the town: a point inside the map, near the water hub (or the city centre)', () => {
    for (const id of SCENARIO_IDS) {
      const s = createGame(id);
      const f = townFocus(s);
      expect(f.x, id).toBeGreaterThanOrEqual(0);
      expect(f.y, id).toBeGreaterThanOrEqual(0);
      expect(f.x, id).toBeLessThan(s.grid.w);
      expect(f.y, id).toBeLessThan(s.grid.h);
    }
    const city = createGame('net-zero-city');
    const c = cityCentre(city);
    expect(Math.hypot(townFocus(city).x - c.x, townFocus(city).y - c.y)).toBeLessThan(20);
  });
});

describe('dilate', () => {
  it('matches a brute-force square neighbourhood on random masks', () => {
    let seed = 12345;
    const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (const [w, h, r] of [[9, 7, 2], [20, 13, 3], [5, 5, 4], [16, 16, 0]] as const) {
      const mask = new Uint8Array(w * h);
      for (let i = 0; i < mask.length; i++) mask[i] = rnd() < 0.08 ? 1 : 0;
      const got = dilate(mask, w, h, r);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let any = 0;
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            const xx = x + dx, yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < w && yy < h && mask[yy * w + xx]) any = 1;
          }
          expect(got[y * w + x], `${w}x${h} r${r} at ${x},${y}`).toBe(any);
        }
      }
    }
  });
});

describe('terrain chunks', () => {
  it('cut the ground into pieces that share the surface: together they hold every triangle once, and each sphere covers its vertices', () => {
    const sc = getScenario('coal-coast');
    const s = createGame('coal-coast');
    const map = new MapGeo(s.grid, biomeLook(sc.biome), 2);
    const tb = buildTerrain(map);
    expect(tb.chunks.length).toBe(Math.ceil(s.grid.w / TERRAIN_CHUNK) * Math.ceil(s.grid.h / TERRAIN_CHUNK));
    let tris = 0;
    const seen = new Set<string>();
    const pos = tb.terrain.getAttribute('position');
    for (const g of tb.chunks) {
      const idx = g.index;
      expect(idx).not.toBeNull();
      tris += (idx?.count ?? 0) / 3;
      const sph = g.boundingSphere;
      expect(sph).not.toBeNull();
      for (let k = 0; k < (idx?.count ?? 0); k++) {
        const v = idx?.getX(k) ?? 0;
        const dx = pos.getX(v) - (sph?.center.x ?? 0), dy = pos.getY(v) - (sph?.center.y ?? 0), dz = pos.getZ(v) - (sph?.center.z ?? 0);
        expect(Math.hypot(dx, dy, dz)).toBeLessThanOrEqual((sph?.radius ?? 0) + 1e-6);
      }
      for (let k = 0; k < (idx?.count ?? 0); k += 3) seen.add(`${idx?.getX(k)}.${idx?.getX(k + 1)}.${idx?.getX(k + 2)}`);
      // the pieces share the vertex attributes of the whole surface
      expect(g.getAttribute('position')).toBe(tb.terrain.getAttribute('position'));
    }
    expect(tris).toBe((tb.terrain.index?.count ?? 0) / 3);
    expect(seen.size).toBe(tris);
  });
});

describe('co-management and burns reach a bounded patch', () => {
  it('co-manages the bush within reach of the click, not the whole connected hinterland', () => {
    const s = act2Sandbox(TileKind.Bush, { scenario: 'coal-coast' });
    s.budget = 1e6;
    s.country.unlocked.culturalBurning = true;
    const r = applyAction(s, { type: 'comanage', x: 16, y: 16 });
    expect(r.result.ok).toBe(true);
    const n = r.state.country.comanaged.length;
    expect(n).toBeGreaterThan(60);
    expect(n).toBeLessThan(0.6 * s.grid.w * s.grid.h);
  });
});

describe('brush buildings', () => {
  it('lists the buildings that drag-paint, with a spacing that keeps a stroke from piling them up', () => {
    expect(BRUSH_SPACING.nursery).toBeGreaterThanOrEqual(6);
    expect(BRUSH_SPACING.coralnursery).toBeGreaterThanOrEqual(5);
    expect(BRUSH_SPACING.wetland).toBeGreaterThanOrEqual(3);
    for (const id of ['cottage', 'rooftopsolar', 'parkland', 'seawall', 'wildlifecrossing'] as const) expect(BRUSH_SPACING[id]).toBe(1);
  });
});
