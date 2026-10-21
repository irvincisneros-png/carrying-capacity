// Roads and rail baked into draped ribbon meshes, one mesh per chunk of tiles (frustum-culled). Every vertex of
// every piece takes its height from the same terrain sample (MapGeo.heightAt, which already has the graded road
// corridor blended in), so the hub and the arms of neighbouring tiles share edge vertices exactly: no gaps or
// breaks on slopes, and the surface follows the grade in several steps per half tile.
import { BufferAttribute, BufferGeometry, Color, Mesh, type Group, type Material } from 'three';
import type { MapGeo } from './mapgeo';
import { ASPHALT_LIFT, DIRS, type RoadTile } from './roadnet';

export const ROAD_W = 0.42; // carriageway width (the asphalt)
const KERB_W = ROAD_W + 0.1;
const DIRT_W = ROAD_W - 0.02;
const VERGE_W = ROAD_W + 0.06;
const RAIL_BED = 0.3;

const C_ASPHALT = new Color(0x5a5653);
const C_KERB = new Color(0xc4bdb0);
const C_LINE = new Color(0xece4c6);
const C_DIRT = new Color(0x9d7d55);
const C_DIRT2 = new Color(0x87683f);
const C_VERGE = new Color(0x8e9a58);
const C_BALLAST = new Color(0x8a8079);
const C_SLEEPER = new Color(0x5a4232);
const C_RAIL = new Color(0x9aa0a6);
const C_POLE = new Color(0x55595c);

const KERB_LIFT = ASPHALT_LIFT - 0.012;
const LINE_LIFT = ASPHALT_LIFT + 0.006;

/** Growing vertex buffers for one chunk. */
class Buf {
  pos: number[] = [];
  nrm: number[] = [];
  col: number[] = [];
  /** Triangle; `up` = ground ribbons (flat +y normal), otherwise the face normal. */
  tri(a: readonly number[], b: readonly number[], c: readonly number[], col: Color, up = true): void {
    this.pos.push(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!, c[0]!, c[1]!, c[2]!);
    let nx = 0, ny = 1, nz = 0;
    if (!up) {
      const ux = b[0]! - a[0]!, uy = b[1]! - a[1]!, uz = b[2]! - a[2]!;
      const vx = c[0]! - a[0]!, vy = c[1]! - a[1]!, vz = c[2]! - a[2]!;
      nx = uy * vz - uz * vy;
      ny = uz * vx - ux * vz;
      nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
    }
    for (let i = 0; i < 3; i++) {
      this.nrm.push(nx, ny, nz);
      this.col.push(col.r, col.g, col.b);
    }
  }
}

export class RoadMesh {
  private meshes = new Map<number, Mesh>();
  /** hi: lamp posts and finer ribbons (Very low turns this off) */
  hi = true;

  constructor(private map: MapGeo, private mat: Material, private group: Group, private chunk = Math.max(10, Math.ceil(Math.max(map.w, map.h) / 3))) {}

  private h(x: number, z: number, lift: number): number {
    return Math.max(this.map.heightAt(x, z), 0.02) + lift;
  }

  /** Rebuild every chunk that holds road or rail (chunks that lost all their tiles are removed). */
  rebuild(tiles: RoadTile[]): void {
    const by = new Map<number, RoadTile[]>();
    const cw = Math.ceil(this.map.w / this.chunk);
    for (const t of tiles) {
      const id = Math.floor(t.ty / this.chunk) * cw + Math.floor(t.tx / this.chunk);
      const l = by.get(id);
      if (l) l.push(t);
      else by.set(id, [t]);
    }
    for (const [id, m] of [...this.meshes]) {
      if (by.has(id)) continue;
      this.group.remove(m);
      m.geometry.dispose();
      this.meshes.delete(id);
    }
    for (const [id, list] of by) {
      const g = this.build(list);
      let m = this.meshes.get(id);
      if (!m) {
        m = new Mesh(g, this.mat);
        m.name = `roads#${id}`;
        m.receiveShadow = true;
        this.group.add(m);
        this.meshes.set(id, m);
      } else {
        m.geometry.dispose();
        m.geometry = g;
      }
    }
  }

  dispose(): void {
    for (const m of this.meshes.values()) {
      this.group.remove(m);
      m.geometry.dispose();
    }
    this.meshes.clear();
  }

  private build(tiles: RoadTile[]): BufferGeometry {
    const B = new Buf();
    for (const t of tiles) {
      if (t.fam === 'rail') this.rail(B, t);
      else this.road(B, t);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(B.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(B.nrm), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(B.col), 3));
    g.computeBoundingSphere();
    return g;
  }

  // ---- ribbon helpers
  /** Quad between two rings (each: left and right vertex xz), draped at `lift`; wound to face up. */
  private band(B: Buf, a: [number, number, number, number], b: [number, number, number, number], lift: number, col: Color): void {
    const v = (x: number, z: number): number[] => [x, this.h(x, z, lift), z];
    const al = v(a[0], a[1]);
    const ar = v(a[2], a[3]);
    const bl = v(b[0], b[1]);
    const br = v(b[2], b[3]);
    // orient: (al, bl, ar) must face +y
    const cross = (bl[2]! - al[2]!) * (ar[0]! - al[0]!) - (bl[0]! - al[0]!) * (ar[2]! - al[2]!);
    if (cross >= 0) {
      B.tri(al, bl, ar, col);
      B.tri(ar, bl, br, col);
    } else {
      B.tri(al, ar, bl, col);
      B.tri(ar, br, bl, col);
    }
  }

  /** A strip of width `w` (centred `o` to the side) from distance s0 to s1 along (dx, dz) from (cx, cz), in `steps` pieces. */
  private strip(B: Buf, cx: number, cz: number, dx: number, dz: number, s0: number, s1: number, w: number, o: number, lift: number, col: Color, steps: number): void {
    const px = -dz;
    const pz = dx;
    const l = o - w / 2;
    const r = o + w / 2;
    let prev: [number, number, number, number] | null = null;
    for (let i = 0; i <= steps; i++) {
      const s = s0 + ((s1 - s0) * i) / steps;
      const ring: [number, number, number, number] = [cx + dx * s + px * l, cz + dz * s + pz * l, cx + dx * s + px * r, cz + dz * s + pz * r];
      if (prev) this.band(B, prev, ring, lift, col);
      prev = ring;
    }
  }

  /** Square patch of half-size `hs` centred on the tile (subdivided so it follows the ground too). */
  private patch(B: Buf, cx: number, cz: number, hs: number, lift: number, col: Color): void {
    this.strip(B, cx, cz, 1, 0, -hs, hs, hs * 2, 0, lift, col, 1);
  }

  private post(B: Buf, x: number, z: number, y: number, hgt: number, col: Color): void {
    const hw = 0.007;
    const top = y + hgt;
    const c = (dx: number, dz: number): number[] => [x + dx, top, z + dz];
    const f = (dx: number, dz: number): number[] => [x + dx, y, z + dz];
    // four thin sides + a lamp head slab
    const sides: [number, number, number, number][] = [[-hw, -hw, hw, -hw], [hw, -hw, hw, hw], [hw, hw, -hw, hw], [-hw, hw, -hw, -hw]];
    for (const [ax, az, bx, bz] of sides) {
      B.tri(f(ax, az), f(bx, bz), c(bx, bz), col, false);
      B.tri(f(ax, az), c(bx, bz), c(ax, az), col, false);
    }
    const hx = 0.04;
    const hz = 0.012;
    const t = top + 0.012;
    const q = (dx: number, dz: number): number[] => [x + dx, t, z + dz];
    B.tri(q(-hx, -hz), q(-hx, hz), q(hx, -hz), col);
    B.tri(q(hx, -hz), q(-hx, hz), q(hx, hz), col);
  }

  private road(B: Buf, t: RoadTile): void {
    const cx = this.map.cx(t.tx);
    const cz = this.map.cz(t.ty);
    const dirt = t.dirt;
    const w = dirt ? DIRT_W : ROAD_W;
    const kw = dirt ? VERGE_W : KERB_W;
    const steps = this.hi ? 4 : 2;
    const kerbCol = dirt ? C_VERGE : C_KERB;
    const baseCol = dirt ? C_DIRT : C_ASPHALT;
    const kLift = dirt ? ASPHALT_LIFT - 0.014 : KERB_LIFT;
    this.patch(B, cx, cz, kw / 2, kLift, kerbCol);
    this.patch(B, cx, cz, w / 2, ASPHALT_LIFT, baseCol);
    for (let i = 0; i < 4; i++) {
      if (!(t.mask & (1 << i))) continue;
      const [dx, dz] = DIRS[i]!;
      this.strip(B, cx, cz, dx, dz, kw / 2, 0.5, kw, 0, kLift, kerbCol, steps);
      this.strip(B, cx, cz, dx, dz, w / 2, 0.5, w, 0, ASPHALT_LIFT, baseCol, steps);
      if (dirt) {
        for (const o of [-0.1, 0.1]) this.strip(B, cx, cz, dx, dz, w / 2, 0.5, 0.05, o, ASPHALT_LIFT + 0.004, C_DIRT2, steps);
      } else {
        this.strip(B, cx, cz, dx, dz, w / 2, 0.5, 0.025, 0, LINE_LIFT, C_LINE, steps);
        if (this.hi) {
          // streetlight on one kerb, half way along the arm
          const s = (0.5 + w / 2) / 2;
          const px = -dz;
          const pz = dx;
          const o = w / 2 + 0.03;
          const x = cx + dx * s + px * o;
          const z = cz + dz * s + pz * o;
          this.post(B, x, z, this.h(x, z, ASPHALT_LIFT), 0.2, C_POLE);
        }
      }
    }
  }

  private rail(B: Buf, t: RoadTile): void {
    const cx = this.map.cx(t.tx);
    const cz = this.map.cz(t.ty);
    const steps = this.hi ? 4 : 2;
    const lift = ASPHALT_LIFT - 0.01;
    this.patch(B, cx, cz, 0.17, lift, C_BALLAST);
    for (let i = 0; i < 4; i++) {
      if (!(t.mask & (1 << i))) continue;
      const [dx, dz] = DIRS[i]!;
      this.strip(B, cx, cz, dx, dz, 0.17, 0.5, RAIL_BED, 0, lift, C_BALLAST, steps);
      if (this.hi) for (let k = 0; k < 4; k++) {
        const s = 0.06 + k * 0.125 + 0.17 * 0.5;
        this.strip(B, cx, cz, dx, dz, s - 0.025, s + 0.025, 0.26, 0, lift + 0.01, C_SLEEPER, 1);
      }
      for (const o of [-0.07, 0.07]) this.strip(B, cx, cz, dx, dz, 0, 0.5, 0.025, o, lift + 0.024, C_RAIL, steps);
    }
    if (t.mask === 0) for (const o of [-0.07, 0.07]) this.strip(B, cx, cz, 0, 1, -0.17, 0.17, 0.025, o, lift + 0.024, C_RAIL, 2);
  }
}
