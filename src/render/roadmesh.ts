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
const C_DECK = new Color(0x7a6f60);
const C_PIER = new Color(0x6d6559);
const C_ABUT = new Color(0x8c8375);
const C_RAILING = new Color(0xcfc6b4);
const C_POST = new Color(0xa89e8c);
/** Where the riverbed is (piers and abutments go down to here) and how deep the deck slab is. */
const BED = -0.34;
const SLAB = 0.09;

const KERB_LIFT = ASPHALT_LIFT - 0.012;
const LINE_LIFT = ASPHALT_LIFT + 0.006;

/** Growing vertex buffers for one chunk. */
class Buf {
  pos: number[] = [];
  nrm: number[] = [];
  col: number[] = [];
  /** Quad (a, b, c, d in order round the face) with the normal pointing away from `from` (the solid's centre). */
  quad(a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[], col: Color, from: readonly number[]): void {
    const ux = b[0]! - a[0]!, uy = b[1]! - a[1]!, uz = b[2]! - a[2]!;
    const vx = c[0]! - a[0]!, vy = c[1]! - a[1]!, vz = c[2]! - a[2]!;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (a[0]! + c[0]!) / 2 - from[0]!, my = (a[1]! + c[1]!) / 2 - from[1]!, mz = (a[2]! + c[2]!) / 2 - from[2]!;
    if (nx * mx + ny * my + nz * mz >= 0) { this.tri(a, b, c, col, false); this.tri(a, c, d, col, false); }
    else { this.tri(a, c, b, col, false); this.tri(a, d, c, col, false); }
  }

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

  /** When set, ribbons take their height from this instead of the terrain (bridge decks and the arms that meet them). */
  private hov: ((x: number, z: number) => number) | null = null;
  private heights: Map<number, number> = new Map();

  private h(x: number, z: number, lift: number): number {
    if (this.hov) return this.hov(x, z) + lift;
    return Math.max(this.map.heightAt(x, z), 0.02) + lift;
  }

  /** Rebuild every chunk that holds road or rail (chunks that lost all their tiles are removed). */
  rebuild(tiles: RoadTile[], heights: Map<number, number> = new Map()): void {
    this.heights = heights;
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
      else if (t.bridge) this.bridge(B, t);
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
      this.hov = null;
      if ((t.bridgeMask ?? 0) & (1 << i)) {
        // the arm that meets a bridge deck holds the level of the road and the deck instead of following the bank down
        const hc = this.heights.get(t.ty * this.map.w + t.tx);
        const hn = this.heights.get((t.ty + dz) * this.map.w + t.tx + dx);
        if (hc !== undefined && hn !== undefined) {
          const e = (hc + hn) / 2;
          this.hov = (x, z) => hc + (e - hc) * Math.max(0, Math.min(1, ((x - cx) * dx + (z - cz) * dz) / 0.5));
        }
      }
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
    this.hov = null;
  }

  /**
   * A bridge tile: asphalt on a deck that runs level between the banks (Map.deckAt), with parapets, a pier in the water and,
   * at each end that meets land, an abutment that fills the gap between the deck and the sloping bank. Very low keeps only the
   * deck and the road surface.
   */
  private bridge(B: Buf, t: RoadTile): void {
    const key = t.ty * this.map.w + t.tx;
    const cx = this.map.cx(t.tx);
    const cz = this.map.cz(t.ty);
    const hc = this.heights.get(key);
    const nearTop = (dx: number, dz: number): number => {
      const j = this.heights.get((t.ty + dz) * this.map.w + t.tx + dx);
      return j ?? Math.max(0.06, this.map.baseHeightAt(cx + dx, cz + dz));
    };
    // axis: the way the deck runs (matches the grading), as unit vector (dx, dz) from the - end to the + end
    const deck = this.map.deckOn(t.tx, t.ty);
    if (!deck || hc === undefined) return;
    const dx = deck.ax === 0 ? 1 : 0, dz = deck.ax === 0 ? 0 : 1;
    const px = -dz, pz = dx;
    const yd = (x: number, z: number): number => this.map.deckAt(x, z) ?? hc;
    const at = (s: number, o: number): [number, number] => [cx + dx * s + px * o, cz + dz * s + pz * o];
    const steps = this.hi ? 4 : 2;
    this.hov = yd;
    // road surface, same colours as the street
    this.strip(B, cx, cz, dx, dz, -0.5, 0.5, KERB_W, 0, KERB_LIFT, C_KERB, steps);
    this.strip(B, cx, cz, dx, dz, -0.5, 0.5, ROAD_W, 0, ASPHALT_LIFT, C_ASPHALT, steps);
    this.strip(B, cx, cz, dx, dz, -0.5, 0.5, 0.025, 0, LINE_LIFT, C_LINE, steps);
    this.hov = null;
    // solid pieces: a box along the deck from s0 to s1 with half-width hw, top = deck + lift(s), bottom = fn
    const prism = (s0: number, s1: number, hw: number, top: (s: number) => number, bot: (s: number) => number, col: Color, topCol: Color = col): void => {
      const P = (s: number, o: number, y: number): number[] => { const [x, z] = at(s, o); return [x, y, z]; };
      const mid = [...at((s0 + s1) / 2, 0)] as number[];
      const c = [mid[0]!, (top((s0 + s1) / 2) + bot((s0 + s1) / 2)) / 2, mid[1]!];
      B.quad(P(s0, -hw, top(s0)), P(s1, -hw, top(s1)), P(s1, hw, top(s1)), P(s0, hw, top(s0)), topCol, c);
      B.quad(P(s0, -hw, bot(s0)), P(s1, -hw, bot(s1)), P(s1, -hw, top(s1)), P(s0, -hw, top(s0)), col, c);
      B.quad(P(s0, hw, bot(s0)), P(s1, hw, bot(s1)), P(s1, hw, top(s1)), P(s0, hw, top(s0)), col, c);
      B.quad(P(s0, -hw, bot(s0)), P(s0, hw, bot(s0)), P(s0, hw, top(s0)), P(s0, -hw, top(s0)), col, c);
      B.quad(P(s1, -hw, bot(s1)), P(s1, hw, bot(s1)), P(s1, hw, top(s1)), P(s1, -hw, top(s1)), col, c);
    };
    const deckTop = (s: number): number => { const [x, z] = at(s, 0); return yd(x, z); };
    // slab under the asphalt (the sides of it are what you see from the water)
    for (const [a, b] of [[-0.5, 0], [0, 0.5]] as const) {
      prism(a, b, KERB_W / 2 + 0.02, (s) => deckTop(s) + KERB_LIFT - 0.004, (s) => deckTop(s) + KERB_LIFT - SLAB, C_DECK, C_DECK);
    }
    // parapets along both edges
    for (const o of [-1, 1]) {
      for (const [a, b] of [[-0.5, 0], [0, 0.5]] as const) {
        const hwid = 0.018;
        const lat = o * (KERB_W / 2 + 0.004);
        const sub = (s0: number, s1: number, top: (s: number) => number, bot: (s: number) => number, col: Color): void => {
          const P = (s: number, off: number, y: number): number[] => { const [x, z] = at(s, lat + off); return [x, y, z]; };
          const m = (s0 + s1) / 2;
          const c = [...at(m, lat), (top(m) + bot(m)) / 2] as number[];
          const cc = [c[0]!, c[2]!, c[1]!];
          B.quad(P(s0, -hwid, top(s0)), P(s1, -hwid, top(s1)), P(s1, hwid, top(s1)), P(s0, hwid, top(s0)), col, cc);
          B.quad(P(s0, -hwid, bot(s0)), P(s1, -hwid, bot(s1)), P(s1, -hwid, top(s1)), P(s0, -hwid, top(s0)), col, cc);
          B.quad(P(s0, hwid, bot(s0)), P(s1, hwid, bot(s1)), P(s1, hwid, top(s1)), P(s0, hwid, top(s0)), col, cc);
          B.quad(P(s0, -hwid, bot(s0)), P(s0, hwid, bot(s0)), P(s0, hwid, top(s0)), P(s0, -hwid, top(s0)), col, cc);
          B.quad(P(s1, -hwid, bot(s1)), P(s1, hwid, bot(s1)), P(s1, hwid, top(s1)), P(s1, -hwid, top(s1)), col, cc);
        };
        sub(a, b, (s) => deckTop(s) + ASPHALT_LIFT + 0.09, (s) => deckTop(s) + KERB_LIFT, C_RAILING);
      }
      // a post at each end and in the middle
      if (this.hi) {
        for (const s of [-0.49, 0, 0.49]) {
          const lat = o * (KERB_W / 2 + 0.004);
          const [x, z] = at(s, lat);
          const base = yd(x, z) + KERB_LIFT;
          const hw2 = 0.03;
          const top = base + 0.14;
          const Q = (a: number, b: number, y: number): number[] => { const [qx, qz] = at(s + a, lat + b); return [qx, y, qz]; };
          const c = [x, (base + top) / 2, z];
          B.quad(Q(-hw2, -hw2, top), Q(hw2, -hw2, top), Q(hw2, hw2, top), Q(-hw2, hw2, top), C_POST, c);
          B.quad(Q(-hw2, -hw2, base), Q(hw2, -hw2, base), Q(hw2, -hw2, top), Q(-hw2, -hw2, top), C_POST, c);
          B.quad(Q(-hw2, hw2, base), Q(hw2, hw2, base), Q(hw2, hw2, top), Q(-hw2, hw2, top), C_POST, c);
          B.quad(Q(-hw2, -hw2, base), Q(-hw2, hw2, base), Q(-hw2, hw2, top), Q(-hw2, -hw2, top), C_POST, c);
          B.quad(Q(hw2, -hw2, base), Q(hw2, hw2, base), Q(hw2, hw2, top), Q(hw2, -hw2, top), C_POST, c);
        }
      }
    }
    // abutments where the deck meets land: a block from the deck edge into the bank tile, under the road arm
    for (const sgn of [-1, 1]) {
      const nxt = nearTop(dx * sgn, dz * sgn);
      const key2 = (t.ty + dz * sgn) * this.map.w + t.tx + dx * sgn;
      if (this.map.deckAt(cx + dx * sgn * 0.75, cz + dz * sgn * 0.75) !== null) continue; // the next tile is also deck
      if (this.map.kinds[key2] === 3) continue;
      const edgeY = deckTop(0.5 * sgn);
      const top = (s: number): number => edgeY + (nxt - edgeY) * Math.max(0, Math.min(1, (Math.abs(s) - 0.5) / 0.5)) - 0.004;
      const [a, b] = sgn > 0 ? [0.5, 1.0] : [-1.0, -0.5];
      prism(a, b, KERB_W / 2 + 0.01, top, () => BED, C_ABUT, C_ABUT);
    }
    if (!this.hi) return;
    // pier: two columns and a cap, standing on the riverbed
    const capTop = deckTop(0) + KERB_LIFT - SLAB;
    for (const o of [-0.16, 0.16]) {
      const hwc = 0.045;
      const Q = (a: number, b: number, y: number): number[] => { const [qx, qz] = at(a, o + b); return [qx, y, qz]; };
      const c = [...at(0, o)] as number[];
      const cm = [c[0]!, (BED + capTop) / 2, c[1]!];
      B.quad(Q(-hwc, -hwc, BED), Q(hwc, -hwc, BED), Q(hwc, -hwc, capTop), Q(-hwc, -hwc, capTop), C_PIER, cm);
      B.quad(Q(-hwc, hwc, BED), Q(hwc, hwc, BED), Q(hwc, hwc, capTop), Q(-hwc, hwc, capTop), C_PIER, cm);
      B.quad(Q(-hwc, -hwc, BED), Q(-hwc, hwc, BED), Q(-hwc, hwc, capTop), Q(-hwc, -hwc, capTop), C_PIER, cm);
      B.quad(Q(hwc, -hwc, BED), Q(hwc, hwc, BED), Q(hwc, hwc, capTop), Q(hwc, -hwc, capTop), C_PIER, cm);
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
