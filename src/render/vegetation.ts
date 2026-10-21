// Instanced vegetation, reef and rocks driven by the simulation grid (stage-aware in Act 2).
import { Color, DoubleSide, type Group, type BufferGeometry } from 'three';
import { reefHealth } from '../sim/climate';
import { TileKind, type GameState } from '../sim/types';
import { ChunkedSet, InstSet } from './instset';
import type { MapGeo } from './mapgeo';
import type { MatLib, MatSpec } from './materials';
import { hash2 } from './noise';
import { mulgaGeo, palmGeo, redGumGeo, reedsGeo, saltbushGeo, spinifexGeo, streetTreeGeo } from './models/biomeveg';
import {
  banksiaGeo, coralGeo, eucalyptGeo, grassTreeGeo, mangroveGeo, rockGeo, saltmarshGeo, seagrassGeo, tuftGeo, wattleGeo,
} from './vegassets';

const SPEC: Record<string, MatSpec> = {
  tree: { key: 'tree', kind: 'foliage', anim: true, sway: [0.5, 0.045], sph: true },
  shrub: { key: 'shrub', kind: 'foliage', anim: true, sway: [0.05, 0.25], sph: true },
  grassTree: { key: 'grasstree', kind: 'foliage', anim: true, sway: [0.25, 0.35], sph: true, side: DoubleSide },
  tuft: { key: 'tuft', kind: 'foliage', anim: true, sph: true },
  mangrove: { key: 'mangrove', kind: 'foliage', anim: true, sway: [0.25, 0.12], sph: true },
  seagrass: { key: 'seagrass', kind: 'foliage', anim: true, sway: [0.0, 1.6], sph: true, side: DoubleSide, noSmog: true },
  coral: { key: 'coral', kind: 'coral', anim: true, noSmog: true },
  rock: { key: 'rock', kind: 'prop' },
  palm: { key: 'palm', kind: 'foliage', anim: true, sway: [0.6, 0.06], sph: true, side: DoubleSide },
};

const TUFT_GREEN = [0x8aa05a, 0x9fae62, 0x7d9a56, 0x6f8c4a];
const TUFT_DRY = [0xc2b25e, 0xb7a95a, 0xa9a05c, 0xcdb873];
const TUFT_DUNE = [0xb9b878, 0xa8b070, 0xc8c38a];
const SALT = [0xc7b0a0, 0xd4a29a, 0xb8c094];
// A calmer, mostly warm reef palette (ART-DIRECTION: 'a visible reef', not confetti): fewer, related hues.
const CORAL = [0xd9707e, 0xe0895a, 0xc9a24f, 0x6fb3a3, 0xd27a6a, 0xb98aa8];
const REEF_WATER = new Color(0x5fa9a3);
const ROCK = [0xe0c49a, 0xcfa070, 0xe8d2a8, 0xbf8f62, 0xd6b486];
const BLEACHED = new Color(0xeee8dc);
const DEAD = new Color(0x8f8576);

const _c = new Color();
const _c2 = new Color();

/** Slot offsets inside a tile, roughly spread so instances overlap less. */
const SLOT4: [number, number][] = [[-0.22, -0.2], [0.24, -0.1], [-0.08, 0.25], [0.22, 0.28]];
const SLOT6: [number, number][] = [[-0.3, -0.28], [0.05, -0.32], [0.32, -0.05], [-0.28, 0.12], [0.02, 0.3], [0.3, 0.32]];

/** Chunk edge in tiles: keeps the number of chunk draws small on small maps, culls usefully on big ones. */
const chunkFor = (w: number, h: number): number => (Math.max(w, h) >= 56 ? 16 : Math.max(w, h) > 24 ? 12 : 10);

export class Vegetation {
  private sets: Record<string, ChunkedSet> = {};
  /** One hidden instance per species so the shader programs can be compiled before any chunk exists (see warm-up). */
  private probes: InstSet[] = [];
  private frac = 1;
  private detail: -1 | 0 | 1 = 1;
  /** Understorey (shrubs, wattle, grass trees) thins faster than the trees on the cheapest tier. */
  private understorey = 1;
  readonly group: Group;

  constructor(private map: MapGeo, private lib: MatLib, group: Group) {
    this.group = group;
    const n = map.w * map.h;
    const add = (name: string, geo: BufferGeometry, spec: MatSpec, cap: number, slots: number, color: boolean, cast: boolean): void => {
      const mat = lib.get(spec);
      const dm = lib.depth(spec);
      const s = new ChunkedSet(geo, mat, group, {
        w: map.w, h: map.h, chunk: chunkFor(map.w, map.h), capacity: cap, keySpace: n * slots, withColor: color, cast, receive: true, depth: dm, name: `veg:${name}`,
      });
      this.sets[name] = s;
      const probe = new InstSet(geo, mat, 1, 1, color);
      probe.mesh.castShadow = cast;
      probe.mesh.receiveShadow = true;
      if (dm) probe.mesh.customDepthMaterial = dm;
      probe.mesh.visible = false;
      probe.mesh.name = `veg:probe:${name}`;
      group.add(probe.mesh);
      this.probes.push(probe);
    };
    add('eucA', eucalyptGeo(1, 0, 3), SPEC.tree!, 1200, 4, true, true);
    add('eucB', eucalyptGeo(1, 1, 8), SPEC.tree!, 800, 4, true, true);
    add('shrub', banksiaGeo(1), SPEC.shrub!, 800, 4, true, true);
    add('wattle', wattleGeo(1), SPEC.shrub!, 600, 3, true, true);
    add('tuft', tuftGeo(), SPEC.tuft!, 3000, 8, true, false);
    add('grassTree', grassTreeGeo(), SPEC.grassTree!, 300, 2, false, true);
    add('mangrove', mangroveGeo(1), SPEC.mangrove!, 400, 4, false, true);
    add('salt', saltmarshGeo(), SPEC.tuft!, 400, 4, true, false);
    add('seagrass', seagrassGeo(), SPEC.seagrass!, 800, 4, false, false);
    add('coral', coralGeo(), SPEC.coral!, 800, 6, true, false);
    add('rock', rockGeo(4), SPEC.rock!, 400, 3, true, true);
    // biome vegetation (only the sets a biome uses get instances; empty sets are not drawn)
    const tr = map.look.trees;
    if (tr === 'tropical') { add('palmA', palmGeo(1, 0), SPEC.palm!, 400, 4, true, true); add('palmB', palmGeo(1, 1), SPEC.palm!, 300, 4, true, true); }
    if (tr === 'redgum' || tr === 'arid') { add('redgum', redGumGeo(1, 0), SPEC.tree!, 400, 4, true, true); add('redgumB', redGumGeo(1, 1), SPEC.tree!, 300, 4, true, true); }
    if (tr === 'redgum' || tr === 'arid') { add('mulga', mulgaGeo(1), SPEC.shrub!, 500, 4, true, true); add('saltbush', saltbushGeo(), SPEC.tuft!, 800, 4, true, false); }
    if (tr === 'arid') add('spinifex', spinifexGeo(), SPEC.tuft!, 1500, 8, true, false);
    if (tr === 'urban') add('street', streetTreeGeo(1), SPEC.tree!, 800, 4, true, true);
    add('reeds', reedsGeo(), SPEC.grassTree!, 400, 4, false, false);
  }

  /** Graphics tier: foliage fraction and model detail. */
  setTier(frac: number, treeDetail: -1 | 0 | 1): void {
    this.frac = frac;
    this.understorey = frac < 0.3 ? 0.3 : 1;
    if (treeDetail !== this.detail) {
      this.detail = treeDetail;
      const detail = Math.max(0, treeDetail) as 0 | 1;
      this.sets.eucA!.setGeometry(eucalyptGeo(treeDetail, 0, 3));
      this.sets.eucB!.setGeometry(eucalyptGeo(treeDetail, 1, 8));
      this.sets.shrub!.setGeometry(banksiaGeo(treeDetail));
      this.sets.wattle!.setGeometry(wattleGeo(detail));
      this.sets.mangrove!.setGeometry(mangroveGeo(detail));
      this.sets.palmA?.setGeometry(palmGeo(detail, 0));
      this.sets.palmB?.setGeometry(palmGeo(detail, 1));
      this.sets.redgum?.setGeometry(redGumGeo(detail, 0));
      this.sets.redgumB?.setGeometry(redGumGeo(detail, 1));
      this.sets.mulga?.setGeometry(mulgaGeo(detail));
      this.sets.street?.setGeometry(streetTreeGeo(detail));
    }
  }

  snapNext(): void {
    for (const s of Object.values(this.sets)) s.snapNext();
  }

  /**
   * Distance LOD for the lower tiers: chunks further than `near` tiles from the camera target draw half of their
   * instances, beyond `far` a third. Infinity (High and Ultra) draws everything.
   */
  setLod(near: number, far: number): void {
    for (const s of Object.values(this.sets)) s.setLod(near, far);
  }

  /** Per-frame: camera target in world xz (the LOD focus). Cheap: a handful of chunk checks, only when it moved. */
  private fx = NaN;
  private fz = NaN;
  setFocus(x: number, z: number): void {
    if (Math.abs(x - this.fx) < 0.4 && Math.abs(z - this.fz) < 0.4) return;
    this.fx = x;
    this.fz = z;
    for (const s of Object.values(this.sets)) s.setFocus(x, z);
  }

  rebuild(s: GameState, now: number): void {
    const S = this.sets;
    for (const set of Object.values(S)) {
      set.now = now;
      set.begin();
    }
    const g = s.grid;
    const map = this.map;
    const W = g.w;
    const act2 = s.phase === 'act2' || s.phase === 'epilogue' || s.phase === 'failed';
    const ff = this.frac;
    const us = this.understorey;
    const keep = (t: number, slot: number, salt: number): boolean => hash2(t * 7 + slot, salt) < ff;
    // distance (world units) from a point to the nearest built tile in the 5x5 neighbourhood: trees keep clear of
    // buildings and roads so nothing the player builds is hidden under a canopy
    const clearance = (x: number, z: number): number => {
      const tx0 = map.tileX(x), ty0 = map.tileY(z);
      let best = 9;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = tx0 + dx, yy = ty0 + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= g.h) continue;
        if ((g.building[yy * W + xx] ?? 0) === 0) continue;
        const x0 = xx - W / 2, z0 = yy - g.h / 2;
        const ddx = Math.max(x0 - x, 0, x - (x0 + 1));
        const ddz = Math.max(z0 - z, 0, z - (z0 + 1));
        best = Math.min(best, Math.hypot(ddx, ddz));
      }
      return best;
    };
    const kindNear = (tx: number, ty: number, r: number, kinds: number[]): boolean => {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const xx = tx + dx, yy = ty + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= g.h) continue;
        if (kinds.includes(g.kind[yy * W + xx] ?? -1)) return true;
      }
      return false;
    };
    const waterside = (tx: number, ty: number): boolean => kindNear(tx, ty, 2, [TileKind.River, TileKind.Wetland]);
    const coastal = (tx: number, ty: number): boolean => kindNear(tx, ty, 2, [TileKind.Beach, TileKind.Sea]);
    // tiles close to the estuary / river stay as open grassy flats (a natural first town site)
    const nearWater = (tx: number, ty: number): boolean => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = tx + dx, yy = ty + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= g.h) continue;
        const kk = g.kind[yy * W + xx];
        if (kk === TileKind.Estuary) return true;
      }
      return false;
    };
    for (let ty = 0; ty < g.h; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const t = ty * W + tx;
        if ((g.building[t] ?? 0) !== 0) continue;
        const k = g.kind[t] ?? 0;
        const cx = map.cx(tx);
        const cz = map.cz(ty);
        const r = (slot: number, salt: number): number => hash2(t * 13 + slot * 101, salt);
        const pos = (slots: [number, number][], slot: number, jit: number): [number, number] => {
          const o = slots[slot % slots.length]!;
          return [cx + o[0] + (r(slot, 1) - 0.5) * jit, cz + o[1] + (r(slot, 2) - 0.5) * jit];
        };
        const water = g.waterPollution[t] ?? 0;
        const stage = g.stage[t] ?? 0;
        const health = g.health[t] ?? 0;
        // ---- land
        if (k === TileKind.Land || k === TileKind.Bush) {
          let trees = 0, shrubs = 0, tufts = 0, weeds = 0;
          let young = 1;
          let dry = false;
          if (!act2) {
            if (k === TileKind.Bush) {
              // open woodland: 1-2 trees with grassy gaps, near the estuary mostly open flats
              const open = nearWater(tx, ty);
              trees = open ? (r(9, 5) < 0.3 ? 1 : 0) : r(9, 6) < 0.35 ? 1 : 2;
              shrubs = 1; tufts = 2;
            }
            else { tufts = 2; dry = true; if (r(9, 3) < 0.07) trees = 1; }
          } else if ((g.weed[t] ?? 0) === 1) {
            weeds = 3; tufts = 1; dry = true;
          } else {
            const st = k === TileKind.Bush ? Math.max(stage, 3) : stage;
            if (st === 0) { if (r(9, 4) < 0.25) tufts = 1; dry = true; }
            else if (st === 1) { tufts = 4; }
            else if (st === 2) { shrubs = 2; tufts = 2; trees = health > 0.55 ? 1 : 0; young = 0.55; }
            else { trees = r(9, 6) < 0.35 ? 1 : 2; shrubs = 1; tufts = 2; young = Math.min(1, 0.6 + (health - 0.66) * 1.4); }
          }
          for (let i = 0; i < trees + (ff > 1 && trees >= 2 ? 1 : 0); i++) {
            if (!keep(t, i, 11) && !(trees === 1 && i === 0 && ff >= 0.35)) continue;
            const [x, z] = pos(SLOT4, i, 0.18);
            const cl = clearance(x, z);
            if (cl < 0.6) continue;
            if (r(i, 98) > map.look.treeDensity && !waterside(tx, ty)) continue;
            const near = Math.min(1, cl / 1.6);
            const big = r(i, 5) < 0.62;
            let set = big ? S.eucA! : S.eucB!;
            const tr = map.look.trees;
            if (tr === 'tropical') set = coastal(tx, ty) || r(i, 12) < 0.35 ? (big ? S.palmA! : S.palmB!) : S.eucB!;
            else if (tr === 'redgum') set = waterside(tx, ty) ? (big ? S.redgum! : S.redgumB!) : S.mulga!;
            else if (tr === 'arid') set = waterside(tx, ty) ? S.redgum! : S.mulga!;
            else if (tr === 'urban') set = S.street!;
            _c.setHSL(0.27 + (r(i, 6) - 0.5) * 0.06, 0.2 + r(i, 7) * 0.15, 0.5).lerp(_c2.setRGB(1, 1, 1), 0.72);
            set.push(t * 4 + i, x, map.heightAt(x, z) - 0.02, z, r(i, 8) * 6.28, (0.5 + r(i, 9) * 0.32) * young * (0.7 + 0.3 * near), 0.8 + r(i, 11) * 0.5, (r(i, 10) - 0.5) * 0.12, _c);
          }
          for (let i = 0; i < shrubs; i++) {
            if (!keep(t, i + 4, 12) || (us < 1 && hash2(t * 5 + i, 912) > us)) continue;
            const [x, z] = pos(SLOT6, i + 2, 0.25);
            if (clearance(x, z) < 0.25) continue;
            const sc = 0.85 + r(i, 13) * 0.45;
            if (S.saltbush) S.saltbush.push(t * 4 + i, x, map.heightAt(x, z) - 0.01, z, r(i, 15) * 6.28, sc, 1, 0, 0xffffff);
            else if (r(i, 14) < 0.5) S.wattle!.push(t * 3 + (i % 3), x, map.heightAt(x, z) - 0.01, z, r(i, 15) * 6.28, sc, 1, 0, 0xffffff);
            else S.shrub!.push(t * 4 + i, x, map.heightAt(x, z) - 0.01, z, r(i, 15) * 6.28, sc, 1, 0, 0xffffff);
          }
          for (let i = 0; i < weeds; i++) {
            if (us < 1 && r(i, 16) > us) continue;
            const [x, z] = pos(SLOT6, i, 0.3);
            S.shrub!.push(t * 4 + 2 + (i % 2), x, map.heightAt(x, z) - 0.01, z, r(i, 16) * 6.28, 0.9 + r(i, 17) * 0.5, 0.8, 0, 0xc49ab8);
          }
          for (let i = 0; i < tufts * 2; i++) {
            if (!keep(t, i + 8, 18) || (us < 1 && hash2(t * 11 + i, 913) > us)) continue;
            const [x, z] = pos(SLOT6, i + 3, 0.3);
            const pal = dry ? TUFT_DRY : TUFT_GREEN;
            if (S.spinifex && (i > 1 || r(i, 97) < 0.35)) continue;
            if (S.spinifex) S.spinifex.push(t * 8 + i, x, map.heightAt(x, z) - 0.01, z, r(i, 19) * 6.28, 0.6 + r(i, 20) * 0.6, 1, 0, 0xffffff);
            else S.tuft!.push(t * 8 + i, x, map.heightAt(x, z) - 0.01, z, r(i, 19) * 6.28, 0.7 + r(i, 20) * 0.8, 1, 0, pal[(r(i, 21) * pal.length) | 0]!);
          }
          if (k === TileKind.Bush && (g.elevation[t] ?? 0) >= 2 && r(0, 22) < 0.35 * us) {
            const [x, z] = pos(SLOT6, 4, 0.2);
            S.grassTree!.push(t * 2, x, map.heightAt(x, z) - 0.01, z, r(0, 23) * 6.28, 0.9 + r(0, 24) * 0.3);
          }
          continue;
        }
        // ---- billabongs / swamps / waterholes: reed beds round the edge
        if (k === TileKind.Wetland) {
          for (let i = 0; i < 3; i++) {
            if (ff < 0.3 && !keep(t, i + 5, 70)) continue;
            const [x, z] = pos(SLOT4, i, 0.5);
            const y = map.heightAt(x, z);
            S.reeds!.push(t * 4 + i, x, Math.max(y, -0.05), z, r(i, 70) * 6.28, 0.9 + r(i, 71) * 0.6);
          }
          continue;
        }
        // ---- beach dunes
        if (k === TileKind.Beach) {
          if (map.look.trees === 'tropical' && S.palmA && r(0, 72) < 0.45 && clearance(cx, cz) > 0.6) {
            const [x, z] = pos(SLOT4, 1, 0.3);
            const y = map.heightAt(x, z);
            if (y > 0.04) S.palmA.push(t * 4, x, y - 0.02, z, r(0, 73) * 6.28, 0.6 + r(0, 74) * 0.3, 0.9 + r(0, 75) * 0.4, (r(0, 76) - 0.5) * 0.3, 0xffffff);
          }
          const n = act2 ? (stage >= 1 ? 2 + stage : 0) : r(0, 30) < 0.5 ? 2 : 0;
          for (let i = 0; i < n; i++) {
            if (!keep(t, i + 8, 31)) continue;
            const [x, z] = pos(SLOT6, i, 0.3);
            const y = map.heightAt(x, z);
            if (y < 0.03) continue;
            S.tuft!.push(t * 8 + i, x, y - 0.01, z, r(i, 32) * 6.28, 0.6 + r(i, 33) * 0.6, 0.8, 0, TUFT_DUNE[(r(i, 34) * TUFT_DUNE.length) | 0]!);
          }
          if (act2 && stage >= 2) {
            const [x, z] = pos(SLOT6, 5, 0.2);
            const y = map.heightAt(x, z);
            if (y > 0.03) S.shrub!.push(t * 4, x, y - 0.01, z, r(1, 35) * 6.28, 0.8, 0.8, 0, 0xffffff);
          }
          continue;
        }
        // ---- sandstone
        if (k === TileKind.Rock) {
          const n = 1 + (r(0, 40) < 0.5 ? 1 : 0);
          for (let i = 0; i < n; i++) {
            if (ff < 0.3 && !keep(t, i + 3, 41)) continue; // Very low: thin the boulders too
            const [x, z] = pos(SLOT4, i, 0.3);
            S.rock!.push(t * 3 + i, x, map.heightAt(x, z) - 0.07, z, r(i, 41) * 6.28, 0.22 + r(i, 42) * 0.3, 0.45 + r(i, 43) * 0.5, 0, ROCK[(r(i, 44) * ROCK.length) | 0]!);
          }
          if (r(0, 45) < 0.45 * us && keep(t, 1, 46)) {
            const [x, z] = pos(SLOT4, 2, 0.2);
            S.grassTree!.push(t * 2 + 1, x, map.heightAt(x, z) - 0.01, z, r(0, 47) * 6.28, 0.85 + r(0, 48) * 0.35);
          }
          if (r(0, 49) < 0.35 && keep(t, 2, 50)) {
            const [x, z] = pos(SLOT4, 3, 0.2);
            S.shrub!.push(t * 4 + 3, x, map.heightAt(x, z) - 0.01, z, r(0, 51) * 6.28, 0.8, 1, 0, 0xffffff);
          }
          continue;
        }
        // ---- estuary: mangroves + saltmarsh
        if (k === TileKind.Estuary) {
          let st: number;
          if (act2) st = stage;
          else {
            const p = Math.max(0, 0.9 - 0.5 * water);
            st = p >= 0.65 ? 3 : p >= 0.4 ? 2 : p >= 0.2 ? 1 : 0;
          }
          const mang = st >= 3 ? 3 : st >= 2 ? 1 : 0;
          const salt = st >= 1 ? (st >= 2 ? 3 : 1) : 0;
          for (let i = 0; i < mang; i++) {
            if (!keep(t, i, 52)) continue;
            const [x, z] = pos(SLOT4, i, 0.25);
            S.mangrove!.push(t * 4 + i, x, Math.max(map.heightAt(x, z), -0.14), z, r(i, 53) * 6.28, (0.8 + r(i, 54) * 0.45) * (st >= 3 ? 1 : 0.7));
          }
          for (let i = 0; i < salt; i++) {
            if (us < 1 && r(i, 58) > us) continue;
            const [x, z] = pos(SLOT6, i + 2, 0.3);
            S.salt!.push(t * 4 + i, x, Math.max(map.heightAt(x, z), -0.03), z, r(i, 55) * 6.28, 0.9 + r(i, 56) * 0.6, 1, 0, SALT[(r(i, 57) * SALT.length) | 0]!);
          }
          continue;
        }
        // ---- shallow sea: seagrass meadows
        if (k === TileKind.Sea) {
          if ((map.seaDist[t] ?? 9) > 2.5) continue;
          let st: number;
          if (act2) st = stage;
          else {
            const p = Math.max(0, 0.85 - 0.35 * water);
            st = p >= 0.6 ? 2 : p >= 0.35 ? 1 : 0;
          }
          const n = st === 0 ? 0 : st === 1 ? 1 : st === 2 ? 3 : 4;
          for (let i = 0; i < n; i++) {
            if (!keep(t, i, 58)) continue;
            const [x, z] = pos(SLOT4, i, 0.35);
            S.seagrass!.push(t * 4 + i, x, map.heightAt(x, z), z, r(i, 59) * 6.28, 0.9 + r(i, 60) * 0.7);
          }
          continue;
        }
        // ---- reef: coral coloured by health
        if (k === TileKind.Reef) {
          const h = act2 ? health : reefHealth(s.tempC, water);
          for (let i = 0; i < 2; i++) {
            if (i === 1 && r(i, 96) < 0.45) continue;
            if (ff < 0.3 && (i === 1 || r(i, 95) < 0.55)) continue;
            const [x, z] = pos(SLOT6, i * 2 + (t % 2), 0.3);
            _c.set(CORAL[(r(i, 61) * CORAL.length) | 0]!).lerp(REEF_WATER, 0.12);
            if (h < 0.15) _c.lerp(DEAD, 0.85);
            else _c.lerp(BLEACHED, Math.max(0, Math.min(1, (0.75 - h) / 0.6)));
            S.coral!.push(t * 6 + i, x, map.heightAt(x, z) - 0.02, z, r(i, 62) * 6.28, 0.9 + r(i, 63) * 0.7, 1, 0, _c);
          }
        }
      }
    }
    for (const set of Object.values(S)) set.end();
  }
}
