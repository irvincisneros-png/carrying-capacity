// Small instanced ambient props + the shared model-building kit used by buildings.ts.
// Every prop is ONE merged, non-indexed BufferGeometry (position, normal, color, surf) with its origin at ground centre.
import {
  BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, ExtrudeGeometry, LatheGeometry, PlaneGeometry,
  Shape, SphereGeometry, Vector2, Vector3,
} from 'three';
import { Parts, T, blob, gableRoof, hipRoof, tris, type ColorLike, type PartOpts } from '../geo';
import { vnoise } from '../noise';

export type V3 = [number, number, number];

// ------------------------------------------------------------------ surface presets
export const IRON: PartOpts = { rough: 0.45, metal: 0.55 };
export const RUSTY: PartOpts = { rough: 0.75, metal: 0.35 };
export const GLASS: PartOpts = { rough: 0.15, metal: 0.1 };
export const PAINT: PartOpts = { rough: 0.5, metal: 0.1 };
export const MATTE: PartOpts = { rough: 0.95 };
export const WALL: PartOpts = { ao: 0.8, rough: 0.85 };

/** Ground level on top of the pads every model stands on. */
export const G = 0.02;

const _c = new Color();
const _a = new Vector3();
const _b = new Vector3();
const _n = new Vector3();

/** Per-triangle recolour (geometry must already be painted & non-indexed). Callback gets the triangle centroid + face normal and
 *  returns undefined (keep), a number (multiply), or a Color/hex (replace, keeps the vertex AO ratio-free). */
export function facets(
  g: BufferGeometry,
  fn: (cx: number, cy: number, cz: number, nx: number, ny: number, nz: number, tri: number) => number | ColorLike | undefined,
): BufferGeometry {
  const p = g.attributes.position;
  const col = g.attributes.color;
  for (let t = 0; t + 2 < p.count; t += 3) {
    const cx = (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3;
    const cy = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3;
    const cz = (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3;
    _a.set(p.getX(t + 1) - p.getX(t), p.getY(t + 1) - p.getY(t), p.getZ(t + 1) - p.getZ(t));
    _b.set(p.getX(t + 2) - p.getX(t), p.getY(t + 2) - p.getY(t), p.getZ(t + 2) - p.getZ(t));
    _n.crossVectors(_a, _b).normalize();
    const r = fn(cx, cy, cz, _n.x, _n.y, _n.z, t / 3);
    if (r === undefined) continue;
    for (let k = 0; k < 3; k++) {
      if (typeof r === 'number' && !(r > 1.5 || r === 0)) {
        // small numbers are multipliers (hex colours are always > 1.5 unless pure black 0)
        col.setXYZ(t + k, col.getX(t + k) * r, col.getY(t + k) * r, col.getZ(t + k) * r);
      } else {
        _c.set(r as ColorLike);
        col.setXYZ(t + k, _c.r, _c.g, _c.b);
      }
    }
  }
  col.needsUpdate = true;
  return g;
}

/** Triangles from raw positions, each one flipped if needed so its normal faces up (+Y). */
export function upTris(pos: number[]): BufferGeometry {
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i + 3] - pos[i], az = pos[i + 5] - pos[i + 2];
    const bx = pos[i + 6] - pos[i], bz = pos[i + 8] - pos[i + 2];
    if (az * bx - ax * bz < 0) {
      for (let k = 0; k < 3; k++) {
        const t = pos[i + 3 + k];
        pos[i + 3 + k] = pos[i + 6 + k];
        pos[i + 6 + k] = t;
      }
    }
  }
  return tris(pos);
}

/** Flat, upward-facing ribbon along a polyline (in XZ) at height y. */
export function ribbon(pts: [number, number][], w: number, y: number): BufferGeometry {
  const pos: number[] = [];
  const side = (i: number): [number, number] => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const L = Math.hypot(dx, dz) || 1;
    return [(-dz / L) * w * 0.5, (dx / L) * w * 0.5];
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const s0 = side(i), s1 = side(i + 1);
    const a = pts[i], b = pts[i + 1];
    const A = [a[0] + s0[0], y, a[1] + s0[1]], B = [a[0] - s0[0], y, a[1] - s0[1]];
    const C = [b[0] - s1[0], y, b[1] - s1[1]], D = [b[0] + s1[0], y, b[1] + s1[1]];
    pos.push(...A, ...B, ...C, ...A, ...C, ...D);
  }
  return upTris(pos);
}

/** Smooth closed curve sample for a noisy blob outline (pond, mound footprint). */
export function blobShape(rx: number, rz: number, seed: number, n: number, amt = 0.25): Shape {
  const s = new Shape();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (vnoise(Math.cos(a) * 1.7 + seed * 5.1, Math.sin(a) * 1.7 - seed * 2.3) - 0.5) * 2 * amt;
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * rz * k;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

export interface KitStack { x: number; y: number; z: number; size: number; steam: number }
export interface KitRotor { x: number; y: number; z: number; yaw: number; scale: number }

const CANOPY = [0x7b956a, 0x687f4c, 0x8ea08e, 0x5b7448, 0x78905c, 0x93a580];

/** Model-building kit: a Parts list plus terse primitive helpers. y arguments are the BOTTOM of the part unless noted. */
export class Kit {
  P = new Parts();
  stacks: KitStack[] = [];
  rotors: KitRotor[] = [];
  constructor(readonly d: 0 | 1) {}
  get hi(): boolean {
    return this.d === 1;
  }
  /** radial segment count for the current detail */
  seg(n: number): number {
    return this.d ? n : Math.max(4, Math.round(n * 0.55));
  }
  add(g: BufferGeometry, c: ColorLike, o?: PartOpts): BufferGeometry {
    return this.P.add(g, c, o);
  }
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, c: ColorLike, o?: PartOpts, ry = 0): BufferGeometry {
    return this.add(T(new BoxGeometry(sx, sy, sz), x, y + sy / 2, z, 0, ry), c, o);
  }
  /** box with segment counts (for facet patterns), y = bottom */
  sbox(x: number, y: number, z: number, sx: number, sy: number, sz: number, nx: number, ny: number, nz: number, c: ColorLike, o?: PartOpts, ry = 0): BufferGeometry {
    return this.add(T(new BoxGeometry(sx, sy, sz, nx, ny, nz), x, y + sy / 2, z, 0, ry), c, o);
  }
  /** centred box with full rotation */
  rbox(x: number, y: number, z: number, sx: number, sy: number, sz: number, c: ColorLike, rx: number, ry: number, rz: number, o?: PartOpts): BufferGeometry {
    return this.add(T(new BoxGeometry(sx, sy, sz), x, y, z, rx, ry, rz), c, o);
  }
  cyl(x: number, y: number, z: number, rt: number, rb: number, h: number, c: ColorLike, seg = 10, o?: PartOpts, hs = 1, open = false): BufferGeometry {
    return this.add(T(new CylinderGeometry(rt, rb, h, this.seg(seg), hs, open), x, y + h / 2, z), c, o);
  }
  /** horizontal cylinder along X, centred */
  cylX(x: number, y: number, z: number, r: number, len: number, c: ColorLike, seg = 8, o?: PartOpts): BufferGeometry {
    return this.add(T(new CylinderGeometry(r, r, len, this.seg(seg)), x, y, z, 0, 0, Math.PI / 2), c, o);
  }
  /** horizontal cylinder along Z, centred */
  cylZ(x: number, y: number, z: number, r: number, len: number, c: ColorLike, seg = 8, o?: PartOpts): BufferGeometry {
    return this.add(T(new CylinderGeometry(r, r, len, this.seg(seg)), x, y, z, Math.PI / 2, 0, 0), c, o);
  }
  cone(x: number, y: number, z: number, r: number, h: number, c: ColorLike, seg = 10, o?: PartOpts): BufferGeometry {
    return this.add(T(new ConeGeometry(r, h, this.seg(seg)), x, y + h / 2, z), c, o);
  }
  sph(x: number, y: number, z: number, r: number, c: ColorLike, seg = 10, sx = 1, sy = 1, sz = 1, o?: PartOpts, half = false): BufferGeometry {
    const g = new SphereGeometry(r, this.seg(seg), Math.max(3, Math.round(this.seg(seg) * (half ? 0.4 : 0.7))), 0, Math.PI * 2, 0, half ? Math.PI / 2 : Math.PI);
    return this.add(T(g, x, y, z, 0, 0, 0, sx, sy, sz), c, o);
  }
  /** square-section beam from a to b */
  beam(a: V3, b: V3, sx: number, sy: number, c: ColorLike, o?: PartOpts): BufferGeometry {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const L = Math.hypot(dx, dy, dz);
    const hd = Math.hypot(dx, dz);
    const g = new BoxGeometry(sx, sy, L);
    T(g, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, -Math.atan2(dy, hd), Math.atan2(dx, dz), 0);
    return this.add(g, c, o);
  }
  /** round pipe from a to b */
  pipe(a: V3, b: V3, r: number, c: ColorLike, seg = 6, o?: PartOpts): BufferGeometry {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const L = Math.hypot(dx, dy, dz);
    const hd = Math.hypot(dx, dz);
    const g = new CylinderGeometry(r, r, L, this.seg(seg), 1, true);
    g.rotateX(Math.PI / 2);
    T(g, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, -Math.atan2(dy, hd), Math.atan2(dx, dz), 0);
    return this.add(g, c, o);
  }
  /** gable roof, eaves at y, ridge along local x (ry rotates) */
  gable(x: number, y: number, z: number, w: number, d: number, h: number, c: ColorLike, o: PartOpts = IRON, ry = 0, ov = 0.03): BufferGeometry {
    return this.add(T(gableRoof(w, d, h, ov), x, y, z, 0, ry), c, o);
  }
  hip(x: number, y: number, z: number, w: number, d: number, h: number, c: ColorLike, o: PartOpts = IRON, ry = 0, ov = 0.03): BufferGeometry {
    return this.add(T(hipRoof(w, d, h, ov), x, y, z, 0, ry), c, o);
  }
  /** surface of revolution from [radius, y] profile (bottom→top), y offset added */
  lathe(x: number, y: number, z: number, prof: [number, number][], c: ColorLike, seg = 12, o?: PartOpts): BufferGeometry {
    const g = new LatheGeometry(prof.map(([r, h]) => new Vector2(r, h)), this.seg(seg));
    return this.add(T(g, x, y, z), c, o);
  }
  blobAt(x: number, y: number, z: number, r: number, seed: number, c: ColorLike, amt = 0.3, sy = 1, det = 0, o?: PartOpts, sx = 1, sz = sx): BufferGeometry {
    return this.add(T(blob(r, det, seed, amt, sy), x, y, z, 0, 0, 0, sx, 1, sz), c, o);
  }
  /** vertical quad centred at (x,y,z) facing +z / -z / +x / -x */
  quad(x: number, y: number, z: number, w: number, h: number, face: '+z' | '-z' | '+x' | '-x', c: ColorLike, o: PartOpts = GLASS): BufferGeometry {
    const ry = face === '+z' ? 0 : face === '-z' ? Math.PI : face === '+x' ? Math.PI / 2 : -Math.PI / 2;
    return this.add(T(new PlaneGeometry(w, h), x, y, z, 0, ry), c, o);
  }
  /** window row on a wall face; `plane` = face coordinate; windows spread between a0..a1 along the face */
  wins(face: '+z' | '-z' | '+x' | '-x', plane: number, y: number, a0: number, a1: number, n: number, w: number, h: number, c: ColorLike = 0x2b3a46, frame?: ColorLike): void {
    const off = face === '+z' || face === '+x' ? 0.003 : -0.003;
    for (let i = 0; i < n; i++) {
      const a = a0 + ((i + 0.5) * (a1 - a0)) / n;
      const along = face === '+z' || face === '-z';
      const px = along ? a : plane + off, pz = along ? plane + off : a;
      if (frame !== undefined && this.hi) {
        this.quad(px, y, pz, w + 0.016, h + 0.016, face, frame, PAINT);
        const o2 = off * 1.7;
        this.quad(along ? a : plane + o2, y, along ? plane + o2 : a, w, h, face, c);
      } else this.quad(px, y, pz, w, h, face, c);
    }
  }
  /** flat horizontal quad (top face) centred at x,z at height y */
  flat(x: number, y: number, z: number, w: number, d: number, c: ColorLike, o?: PartOpts, ry = 0): BufferGeometry {
    return this.add(T(new PlaneGeometry(w, d), x, y, z, -Math.PI / 2, ry, 0), c, o);
  }
  /** flat shape (XY outline) laid on the ground at height y */
  shape(s: Shape, x: number, y: number, z: number, c: ColorLike, o?: PartOpts, segs = 6): BufferGeometry {
    const g = new ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: false, curveSegments: segs });
    g.rotateX(-Math.PI / 2);
    return this.add(T(g, x, y - 0.01, z), c, o);
  }
  /** eucalypt-ish tree: pale trunk + clumpy canopy */
  tree(x: number, z: number, s: number, seed: number, y = G, cols: readonly number[] = CANOPY): void {
    const H = 0.2 * s;
    this.cyl(x, y, z, 0.012 * s, 0.022 * s, H, seed % 3 === 0 ? 0xd9d2c2 : 0xeee8dc, 5, { rough: 0.7 });
    const n = this.hi ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = seed * 1.7 + (i / n) * Math.PI * 2;
      const r = (0.085 + ((seed * 7 + i * 3) % 5) * 0.008) * s;
      this.blobAt(x + Math.cos(a) * 0.055 * s, y + H + 0.02 * s + (i % 2) * 0.05 * s, z + Math.sin(a) * 0.055 * s, r, seed * 13 + i, cols[(seed + i * 2) % cols.length], 0.4, 0.78, this.hi && s >= 0.9 ? 1 : 0, { ao: 0.6, rough: 0.8 });
    }
    if (this.hi) this.blobAt(x, y + H + 0.1 * s, z, 0.08 * s, seed * 17, cols[(seed + 5) % cols.length], 0.4, 0.8, 0, { ao: 0.7, rough: 0.8 });
  }
  /** a chimney stack: tapered lathe with optional red/white bands near the top. Registers a smoke Stack. */
  chimney(x: number, y: number, z: number, h: number, rb: number, rt: number, col: ColorLike, size: number, steam: number, banded = false, seg = 10): void {
    const fr = banded ? [0, 0.72, 0.8, 0.88, 0.95, 1] : [0, 0.93, 1];
    const prof: [number, number][] = fr.map((f) => [rb + (rt - rb) * f, f * h]);
    const g = this.lathe(x, y, z, prof, col, seg, { rough: 0.85, ao: 0.7 });
    facets(g, (_x, cy) => {
      const f = (cy - y) / h;
      if (banded && f > 0.72 && f < 0.95) {
        const band = Math.floor((f - 0.72) / 0.08);
        return band % 2 === 0 ? 0xb3392b : 0xefe9de;
      }
      if (f > 0.93) return 0x3a3432;
      return undefined;
    });
    // lip + dark throat
    this.cyl(x, y + h - 0.012, z, rt * 1.22, rt * 1.12, 0.035, 0x3a3634, seg);
    this.cyl(x, y + h - 0.01, z, rt * 0.95, rt * 0.95, 0.04, 0x151414, seg, MATTE);
    if (this.hi) this.cyl(x, y, z, rb * 1.35, rb * 1.45, 0.06, 0x8e877c, seg);
    this.stacks.push({ x, y: y + h + 0.03, z, size, steam });
  }
  /** build in local space, then place (scale s, yaw ry). Stacks/rotors are carried along. */
  group(x: number, y: number, z: number, ry: number, fn: (k: Kit) => void, s = 1): void {
    const k = new Kit(this.d);
    fn(k);
    if (!k.P.list.length) return;
    const g = k.P.merge();
    T(g, x, y, z, 0, ry, 0, s, s, s);
    this.P.push(g);
    const c = Math.cos(ry), sn = Math.sin(ry);
    for (const st of k.stacks) {
      const lx = st.x * s, lz = st.z * s;
      this.stacks.push({ ...st, x: x + lx * c + lz * sn, y: y + st.y * s, z: z - lx * sn + lz * c, size: st.size * s });
    }
    for (const r of k.rotors) {
      const lx = r.x * s, lz = r.z * s;
      this.rotors.push({ ...r, x: x + lx * c + lz * sn, y: y + r.y * s, z: z - lx * sn + lz * c, yaw: r.yaw + ry, scale: r.scale * s });
    }
  }
  /** add a pre-built geometry (e.g. an ambient prop), tinted by c (multiplies its vertex colours) */
  put(g: BufferGeometry, x: number, y: number, z: number, ry: number, c: ColorLike = 0xffffff, s = 1): void {
    T(g, x, y, z, 0, ry, 0, s, s, s);
    this.add(g, c, PAINT);
  }
  merge(): BufferGeometry {
    return this.P.merge();
  }
}

// ------------------------------------------------------------------ ambient props
export type AmbientId =
  | 'fence' | 'shed' | 'clothesline' | 'watertank' | 'car' | 'truck' | 'boat' | 'wagon' | 'haybale' | 'cow' | 'sheep'
  | 'streetlight' | 'bin' | 'crate' | 'kayak' | 'picnic';

export const AMBIENT_IDS: readonly AmbientId[] = [
  'fence', 'shed', 'clothesline', 'watertank', 'car', 'truck', 'boat', 'wagon', 'haybale', 'cow', 'sheep',
  'streetlight', 'bin', 'crate', 'kayak', 'picnic',
];

const TIMBER = 0x8a6a4a, TIMBER_L = 0xb08a5e, TYRE = 0x1f1f22, DARK_GLASS = 0x26323c, BODY = 0xf2f2f0;

function car(k: Kit): void {
  // along +X, 0.22 long; wheels r .022
  const wr = 0.022;
  k.box(0, 0.014, 0, 0.22, 0.042, 0.1, BODY, PAINT);
  // bonnet / boot slope
  if (k.hi) {
    k.rbox(0.085, 0.058, 0, 0.05, 0.012, 0.096, BODY, 0, 0, -0.18, PAINT);
    k.rbox(-0.09, 0.058, 0, 0.04, 0.012, 0.096, BODY, 0, 0, 0.2, PAINT);
  }
  k.box(-0.012, 0.056, 0, 0.12, 0.04, 0.088, DARK_GLASS, GLASS);
  k.box(-0.014, 0.094, 0, 0.11, 0.012, 0.09, BODY, PAINT);
  for (const x of [-0.07, 0.07]) for (const z of [-0.046, 0.046]) k.cylZ(x, wr, z, wr, 0.018, TYRE, 8, MATTE);
  if (k.hi) {
    for (const z of [-0.032, 0.032]) {
      k.box(0.111, 0.034, z, 0.004, 0.012, 0.018, 0xfff3c2, GLASS);
      k.box(-0.111, 0.034, z, 0.004, 0.012, 0.018, 0x8a1a1a, GLASS);
    }
  }
}

function truck(k: Kit): void {
  const wr = 0.026;
  // chassis
  k.box(0, 0.024, 0, 0.32, 0.018, 0.1, 0x2a2a2c, MATTE);
  // cab at +x
  k.box(0.125, 0.03, 0, 0.075, 0.09, 0.11, BODY, PAINT);
  k.quad(0.1626, 0.095, 0, 0.098, 0.03, '+x', DARK_GLASS);
  if (k.hi) for (const z of [-0.0556, 0.0556]) k.quad(0.135, 0.095, z, 0.04, 0.028, z > 0 ? '+z' : '-z', DARK_GLASS);
  k.box(0.165, 0.03, 0, 0.012, 0.03, 0.1, 0x3a3a3c, MATTE);
  // cargo box
  k.sbox(-0.045, 0.042, 0, 0.23, 0.11, 0.115, 6, 1, 1, BODY, { ao: 0.85, rough: 0.6 });
  for (const x of [-0.12, -0.075, 0.115]) for (const z of [-0.05, 0.05]) k.cylZ(x, wr, z, wr, 0.02, TYRE, 8, MATTE);
  if (k.hi) {
    k.box(0.163, 0.04, -0.035, 0.004, 0.014, 0.02, 0xfff3c2, GLASS);
    k.box(0.163, 0.04, 0.035, 0.004, 0.014, 0.02, 0xfff3c2, GLASS);
  }
}

function boat(k: Kit): void {
  // small timber trawler, ~0.45 long along +X, waterline y=0, keel below
  const s = new Shape();
  s.moveTo(-0.2, -0.06);
  s.lineTo(0.1, -0.065);
  s.quadraticCurveTo(0.22, -0.045, 0.25, 0);
  s.quadraticCurveTo(0.22, 0.045, 0.1, 0.065);
  s.lineTo(-0.2, 0.06);
  s.quadraticCurveTo(-0.215, 0, -0.2, -0.06);
  const hull = new ExtrudeGeometry(s, { depth: 0.11, bevelEnabled: false, curveSegments: k.hi ? 5 : 3 });
  hull.rotateX(-Math.PI / 2);
  hull.translate(0, -0.06, 0);
  // V the bottom + spring the sheer at the bow
  const p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < 0) p.setXYZ(i, x * 0.92, y, z * 0.35);
    else p.setXYZ(i, x, y + Math.max(0, x - 0.05) * 0.18, z);
  }
  hull.computeVertexNormals();
  const hg = k.add(hull, BODY, PAINT);
  facets(hg, (_x, cy, _z, _nx, ny) => {
    if (ny > 0.7) return 0xb08a5e; // deck
    if (cy < -0.02) return 0x9c3a2c; // antifoul
    if (cy > 0.035) return 0x3a4a52; // gunwale stripe
    return undefined;
  });
  // wheelhouse
  k.box(-0.06, 0.05, 0, 0.1, 0.075, 0.08, BODY, { ao: 0.85, rough: 0.5 });
  k.quad(-0.0095, 0.105, 0, 0.07, 0.022, '+x', DARK_GLASS);
  if (k.hi) for (const z of [-0.0405, 0.0405]) k.quad(-0.06, 0.105, z, 0.07, 0.02, z > 0 ? '+z' : '-z', DARK_GLASS);
  k.box(-0.06, 0.125, 0, 0.115, 0.012, 0.09, 0x3a4a52, PAINT);
  // mast, outrigger booms, net drum
  k.cyl(0.04, 0.05, 0, 0.005, 0.007, 0.22, 0xe8e2d4, 5);
  k.beam([0.04, 0.24, 0], [0.04, 0.12, 0.17], 0.006, 0.006, 0xe8e2d4);
  k.beam([0.04, 0.24, 0], [0.04, 0.12, -0.17], 0.006, 0.006, 0xe8e2d4);
  if (k.hi) {
    k.beam([0.04, 0.27, 0], [0.24, 0.05, 0], 0.003, 0.003, 0x3a3a3a);
    k.beam([0.04, 0.27, 0], [-0.2, 0.06, 0], 0.003, 0.003, 0x3a3a3a);
    k.cyl(-0.06, 0.137, 0.02, 0.008, 0.008, 0.03, 0x3a3a3a, 5);
  }
  k.cylZ(-0.16, 0.07, 0, 0.022, 0.08, 0x3d6b5a, 8, MATTE);
  k.box(0.13, 0.05, 0, 0.04, 0.03, 0.05, 0xd9a43a, PAINT);
}

function wagon(k: Kit): void {
  // open coal hopper wagon on two bogies, along +X, rail top y=0
  const wr = 0.022;
  for (const bx of [-0.115, 0.115]) {
    k.box(bx, 0.016, 0, 0.1, 0.022, 0.085, 0x2e2b29, RUSTY);
    if (k.hi) {
      for (const x of [bx - 0.03, bx + 0.03]) for (const z of [-0.036, 0.036]) k.cylZ(x, wr, z, wr, 0.012, 0x2a2826, 6, IRON);
    } else for (const z of [-0.036, 0.036]) k.box(bx, 0.002, z, 0.09, 0.04, 0.012, 0x2a2826, IRON);
  }
  k.box(0, 0.038, 0, 0.36, 0.014, 0.09, 0x2e2b29, RUSTY);
  // hopper chutes
  for (const x of [-0.07, 0.07]) k.rbox(x, 0.06, 0, 0.09, 0.05, 0.095, BODY, 0, 0, 0, RUSTY);
  // body with side ribs
  const b = k.sbox(0, 0.07, 0, 0.34, 0.08, 0.12, 8, 1, 1, BODY, { ao: 0.8, rough: 0.7, metal: 0.3 });
  facets(b, (cx, _y, _z, _nx, ny) => (Math.abs(ny) < 0.5 && Math.floor((cx + 0.17) / 0.0425) % 2 === 0 ? 0.86 : undefined));
  k.box(0, 0.15, 0, 0.35, 0.008, 0.125, BODY, RUSTY);
  // coal load (lumpy)
  const coal = new BoxGeometry(0.32, 0.03, 0.105, k.hi ? 5 : 2, 1, 2);
  const cp = coal.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    if (cp.getY(i) > 0) {
      const x = cp.getX(i), z = cp.getZ(i);
      const edge = Math.min(1, (0.16 - Math.abs(x)) / 0.05) * Math.min(1, (0.052 - Math.abs(z)) / 0.02);
      cp.setY(i, 0.015 + edge * (0.012 + vnoise(x * 40, z * 40) * 0.016));
    }
  }
  coal.computeVertexNormals();
  k.add(T(coal, 0, 0.142, 0), 0x2a2725, MATTE);
}

function cow(k: Kit): void {
  // chunky Hereford, ~0.14 long along +X
  const RED = 0x8a4a2e, WHITE = 0xf0ebe0;
  k.box(-0.005, 0.04, 0, 0.1, 0.055, 0.058, RED, { ao: 0.85 });
  if (k.hi) k.box(0.0, 0.035, 0, 0.06, 0.012, 0.045, WHITE);
  k.box(0.065, 0.06, 0, 0.042, 0.04, 0.042, WHITE);
  k.box(0.088, 0.06, 0, 0.012, 0.022, 0.034, 0xd9a59a);
  for (const z of [-0.027, 0.027]) k.box(0.06, 0.09, z, 0.012, 0.01, 0.02, RED);
  if (k.hi) for (const z of [-0.018, 0.018]) k.box(0.07, 0.1, z, 0.006, 0.012, 0.006, 0xe8dcc0);
  for (const x of [-0.04, 0.03]) for (const z of [-0.018, 0.018]) k.box(x, 0, z, 0.016, 0.042, 0.016, RED);
  if (k.hi) k.beam([-0.055, 0.09, 0], [-0.07, 0.04, 0], 0.006, 0.006, RED);
}

function sheep(k: Kit): void {
  // fluffy merino ~0.09 long along +X
  k.blobAt(-0.005, 0.048, 0, 0.034, 7, 0xeee6d2, 0.25, 0.85, k.hi ? 1 : 0, { ao: 0.75, rough: 0.95 }, 1.3, 1.0);
  k.box(0.04, 0.042, 0, 0.022, 0.026, 0.02, 0x3a3230);
  for (const z of [-0.013, 0.013]) k.box(0.035, 0.06, z * 1.3, 0.006, 0.006, 0.012, 0x3a3230);
  for (const x of [-0.025, 0.02]) for (const z of [-0.012, 0.012]) k.box(x, 0, z, 0.008, 0.03, 0.008, 0x3a3230);
}

function fence(k: Kit): void {
  const C = 0x8f7458;
  for (const x of [-0.49, 0, 0.49]) k.box(x, -0.02, 0, 0.022, 0.14, 0.022, 0x7a5f45, MATTE);
  for (const y of [0.05, 0.095]) k.box(0, y, 0, 1.0, 0.014, 0.01, C, MATTE);
}

function shed(k: Kit): void {
  const w = k.sbox(0, 0, 0, 0.142, 0.09, 0.112, k.hi ? 8 : 1, 1, 1, 0x7f9a83, { ao: 0.8, rough: 0.5, metal: 0.4 });
  facets(w, (cx, _y, cz, nx) => (Math.floor((Math.abs(nx) > 0.5 ? cz : cx) * 57 + 10) % 2 ? 0.9 : undefined));
  k.quad(0, 0.04, 0.0571, 0.05, 0.075, '+z', 0x5b6e5f, PAINT);
  k.gable(0, 0.09, 0, 0.14, 0.11, 0.045, 0xa7aeb0, IRON, 0, 0.012);
}

function clothesline(k: Kit): void {
  // Hills hoist
  const M = 0xc8ccc8;
  k.cyl(0, 0, 0, 0.005, 0.006, 0.26, M, 5, IRON);
  const R = 0.11, H = 0.25;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    k.beam([0, H - 0.04, 0], [Math.cos(a) * R, H, Math.sin(a) * R], 0.005, 0.005, M, IRON);
  }
  for (const r of k.hi ? [0.06, 0.1] : [0.09]) {
    const pts: V3[] = [0, 1, 2, 3].map((i) => {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      return [Math.cos(a) * r, H - 0.04 + (r / R) * 0.04, Math.sin(a) * r];
    });
    for (let i = 0; i < 4; i++) k.beam(pts[i], pts[(i + 1) % 4], 0.0025, 0.0025, 0xeeeeee);
  }
  const cl = [0xd9534f, 0x5b8fc9, 0xf2f2ea, 0xe8c547, 0x6fae7a];
  const n = k.hi ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const r = 0.1;
    const t = (i + 0.5) / n;
    const x = -r * 0.7 + t * r * 1.4;
    k.box(x, H - 0.065, r * 0.707, 0.026, 0.035, 0.003, cl[i % cl.length], MATTE);
  }
}

function watertank(k: Kit): void {
  k.box(0, 0, 0, 0.15, 0.025, 0.15, 0x8a8278, MATTE);
  const t = k.cyl(0, 0.025, 0, 0.07, 0.07, 0.12, 0xb7bdbd, 12, IRON, k.hi ? 6 : 1);
  facets(t, (_x, cy, _z, _nx, ny) => (Math.abs(ny) < 0.5 && Math.floor((cy - 0.025) / 0.02) % 2 ? 0.86 : undefined));
  k.cone(0, 0.145, 0, 0.074, 0.03, 0xa7adad, 12, IRON);
  if (k.hi) k.cyl(0.05, 0.03, 0.055, 0.006, 0.006, 0.02, 0x6f7a7a, 4);
}

function streetlight(k: Kit): void {
  k.cyl(0, 0, 0, 0.006, 0.009, 0.32, 0x7d8285, 6, IRON);
  k.beam([0, 0.31, 0], [0.07, 0.33, 0], 0.008, 0.008, 0x7d8285, IRON);
  k.box(0.075, 0.315, 0, 0.04, 0.014, 0.022, 0x5f6466, IRON);
  k.box(0.075, 0.311, 0, 0.032, 0.005, 0.016, 0xfff0b8, GLASS);
}

function bin(k: Kit): void {
  k.box(0, 0.004, 0, 0.042, 0.055, 0.044, 0x3f6b48, PAINT);
  k.box(0, 0.059, 0.001, 0.046, 0.007, 0.048, 0xe0b53a, PAINT);
  if (k.hi) for (const z of [-0.016, 0.016]) k.cylX(-0.02, 0.008, z, 0.008, 0.008, TYRE, 6);
}

function crate(k: Kit): void {
  const g = k.sbox(0, 0, 0, 0.08, 0.07, 0.08, 1, k.hi ? 4 : 2, 1, 0xc29a62, { ao: 0.8, rough: 0.9 });
  facets(g, (_x, cy, _z, _nx, ny) => (Math.abs(ny) < 0.5 && Math.floor(cy / 0.0175) % 2 ? 0.86 : undefined));
  if (k.hi) {
    k.rbox(0, 0.035, 0.0405, 0.1, 0.01, 0.003, 0x9a7a4a, 0, 0, 0.72);
    k.rbox(0.0405, 0.035, 0, 0.003, 0.01, 0.1, 0x9a7a4a, 0.72, 0, 0);
  }
}

function kayak(k: Kit): void {
  const s = new Shape();
  s.moveTo(-0.1, 0);
  s.quadraticCurveTo(0, -0.03, 0.1, 0);
  s.quadraticCurveTo(0, 0.03, -0.1, 0);
  const hull = new ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: false, curveSegments: k.hi ? 5 : 3 });
  hull.rotateX(-Math.PI / 2);
  hull.translate(0, -0.01, 0);
  const p = hull.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setZ(i, p.getZ(i) * 0.4);
  hull.computeVertexNormals();
  k.add(hull, BODY, PAINT);
  k.box(0, 0.008, 0, 0.04, 0.006, 0.022, 0x2a2a2a, MATTE);
  // paddler
  k.box(0, 0.012, 0, 0.018, 0.03, 0.02, 0x3d7fb5, MATTE);
  k.sph(0, 0.052, 0, 0.011, 0xe0b090, 6);
  k.beam([0.005, 0.035, -0.05], [-0.005, 0.03, 0.05], 0.004, 0.004, 0x333333);
  if (k.hi) for (const z of [-0.05, 0.05]) k.box(0.002, 0.026, z, 0.012, 0.016, 0.004, 0xe0b53a);
}

function picnic(k: Kit): void {
  k.box(0, 0.055, 0, 0.13, 0.01, 0.07, TIMBER_L, MATTE);
  for (const z of [-0.06, 0.06]) k.box(0, 0.032, z, 0.13, 0.008, 0.03, TIMBER_L, MATTE);
  for (const x of [-0.05, 0.05]) {
    k.rbox(x, 0.03, 0, 0.012, 0.075, 0.012, TIMBER, 0.6, 0, 0, MATTE);
    k.rbox(x, 0.03, 0, 0.012, 0.075, 0.012, TIMBER, -0.6, 0, 0, MATTE);
  }
  if (k.hi) {
    k.cyl(0.0, 0.065, 0, 0.003, 0.003, 0.12, 0xdddddd, 4);
    k.cone(0.0, 0.17, 0, 0.08, 0.035, 0xd9534f, 8, MATTE);
  }
}

function haybale(k: Kit): void {
  const g = k.add(T(new CylinderGeometry(0.04, 0.04, 0.06, k.seg(10)), 0, 0.04, 0, Math.PI / 2, 0, 0), 0xd9b45a, { rough: 0.95, ao: 0.75 });
  facets(g, (_x, _y, _z, _nx, _ny, nz) => (Math.abs(nz) > 0.5 ? 0xe6cd86 : undefined));
}

export function buildAmbient(id: AmbientId, detail: 0 | 1): BufferGeometry {
  const k = new Kit(detail);
  switch (id) {
    case 'fence': fence(k); break;
    case 'shed': shed(k); break;
    case 'clothesline': clothesline(k); break;
    case 'watertank': watertank(k); break;
    case 'car': car(k); break;
    case 'truck': truck(k); break;
    case 'boat': boat(k); break;
    case 'wagon': wagon(k); break;
    case 'haybale': haybale(k); break;
    case 'cow': cow(k); break;
    case 'sheep': sheep(k); break;
    case 'streetlight': streetlight(k); break;
    case 'bin': bin(k); break;
    case 'crate': crate(k); break;
    case 'kayak': kayak(k); break;
    case 'picnic': picnic(k); break;
  }
  return k.merge();
}
