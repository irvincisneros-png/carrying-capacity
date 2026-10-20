// Prop placement: one merged static mesh for unique buildings + instanced sets for repeats.
import {
  BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute,
  InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, Quaternion, Shape, Vector3,
} from 'three';
import {
  BRIDGE, COALYARD, HALF, Kind, LIGHTHOUSE, PAD, ROADS, STOCKPILES, TOWN_HALL, TURBINES,
  headlandFactor, type World,
} from './world';
import { Parts, T, gableRoof, tint, type ColorLike, type PartOpts } from './geo';
import {
  banksiaGeo, coralGeo, cottageBodyGeo, cottageRoofGeo, eucalyptGeo, grassTreeGeo, mangroveGeo, puffGeo, rockGeo,
  rotorGeo, stockpileGeo, tuftGeo, wattleGeo,
} from './assets';
import { closestOnPolyline, fbm, mulberry32 } from './noise';
import type { MatSpec } from './materials';

export interface PropEntry {
  obj: Mesh;
  spec: MatSpec;
  cast: boolean;
  receive: boolean;
  /** geometry per quality tier [low, med, high] (optional) */
  lod?: [BufferGeometry, BufferGeometry, BufferGeometry];
  /** instance-count fraction per quality tier */
  frac?: [number, number, number];
  full?: number;
  /** only visible in some styles */
  styles?: number[];
}

export interface PropSet {
  entries: PropEntry[];
  rotors: InstancedMesh;
  rotorInfo: { pos: Vector3; yaw: number; speed: number; phase: number }[];
}

const SPEC = {
  static: { key: 'static', kind: 'prop', surf: true } as MatSpec,
  cottage: { key: 'cottage', kind: 'prop', surf: true } as MatSpec,
  tree: { key: 'tree', kind: 'foliage', grow: true, sway: [0.5, 0.045], sph: true, surf: true } as MatSpec,
  shrub: { key: 'shrub', kind: 'foliage', grow: true, sway: [0.05, 0.25], sph: true, surf: true } as MatSpec,
  grassTree: { key: 'grasstree', kind: 'foliage', grow: true, sway: [0.25, 0.35], sph: true, surf: true, side: DoubleSide } as MatSpec,
  tuft: { key: 'tuft', kind: 'foliage', grow: true, sph: true, surf: true } as MatSpec,
  mangrove: { key: 'mangrove', kind: 'foliage', grow: true, sway: [0.25, 0.12], sph: true, surf: true } as MatSpec,
  coral: { key: 'coral', kind: 'coral', surf: true, noSmog: true } as MatSpec,
  rock: { key: 'rock', kind: 'prop', surf: true } as MatSpec,
  rotor: { key: 'rotor', kind: 'prop', surf: true, noSmog: true } as MatSpec,
  smoke: { key: 'smoke', kind: 'smoke', surf: true, noSmog: true } as MatSpec,
  cloud: { key: 'cloud', kind: 'cloud', surf: true, noSmog: true } as MatSpec,
};

// ---------------------------------------------------------------- occupancy + spacing
class Occ {
  static R = 0.1;
  n = Math.round(24 / Occ.R) + 1;
  g = new Uint8Array(this.n * this.n);
  private idx(x: number, z: number): number {
    const i = Math.round((x + HALF) / Occ.R);
    const j = Math.round((z + HALF) / Occ.R);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
    return j * this.n + i;
  }
  mark(x: number, z: number, r: number): void {
    for (let dz = -r; dz <= r; dz += Occ.R) {
      for (let dx = -r; dx <= r; dx += Occ.R) {
        if (dx * dx + dz * dz > r * r) continue;
        const k = this.idx(x + dx, z + dz);
        if (k >= 0) this.g[k] = 1;
      }
    }
  }
  markLine(pts: ReadonlyArray<readonly [number, number]>, r: number): void {
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, az] = pts[s];
      const [bx, bz] = pts[s + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const n = Math.ceil(L / 0.08);
      for (let i = 0; i <= n; i++) this.mark(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n, r);
    }
  }
  markRect(r: { x0: number; x1: number; z0: number; z1: number }, pad = 0): void {
    for (let z = r.z0 - pad; z <= r.z1 + pad; z += Occ.R) for (let x = r.x0 - pad; x <= r.x1 + pad; x += Occ.R) {
      const k = this.idx(x, z);
      if (k >= 0) this.g[k] = 1;
    }
  }
  free(x: number, z: number): boolean {
    const k = this.idx(x, z);
    return k >= 0 && this.g[k] === 0;
  }
}

class Spacer {
  private m = new Map<number, [number, number][]>();
  constructor(private cell: number) {}
  private key(i: number, j: number) { return (i + 500) * 1000 + (j + 500); }
  ok(x: number, z: number, r: number): boolean {
    const ci = Math.floor(x / this.cell), cj = Math.floor(z / this.cell);
    const span = Math.ceil(r / this.cell);
    for (let i = ci - span; i <= ci + span; i++) for (let j = cj - span; j <= cj + span; j++) {
      const b = this.m.get(this.key(i, j));
      if (!b) continue;
      for (const [px, pz] of b) if ((px - x) ** 2 + (pz - z) ** 2 < r * r) return false;
    }
    return true;
  }
  add(x: number, z: number): void {
    const k = this.key(Math.floor(x / this.cell), Math.floor(z / this.cell));
    let b = this.m.get(k);
    if (!b) this.m.set(k, (b = []));
    b.push([x, z]);
  }
}

const CONVEYOR: [number, number, number][] = [
  // x, y, z (world)
  [-8.4, 0.95, 0.15], [-5.7, 1.3, 3.0], [-4.95, 1.15, 6.45], [-2.35, 1.0, 6.45],
];
const WHARF = { x0: -5.0, x1: -1.65, z: 6.45, w: 0.4, y: 0.3 };
const SHIP = { x: -2.95, z: 7.15 };

// ---------------------------------------------------------------- instancing helpers
const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);

interface Inst { x: number; y: number; z: number; ry: number; s: number; sy?: number; tilt?: number; col?: Color }

function shuffle<T>(a: T[], rnd: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeInstanced(geo: BufferGeometry, list: Inst[], withColor: boolean): InstancedMesh {
  const mesh = new InstancedMesh(geo, undefined, Math.max(1, list.length));
  list.forEach((it, i) => {
    _q.setFromAxisAngle(_up, it.ry);
    if (it.tilt) {
      const tq = new Quaternion().setFromAxisAngle(new Vector3(Math.cos(it.ry * 3.1), 0, Math.sin(it.ry * 2.3)).normalize(), it.tilt);
      _q.premultiply(tq);
    }
    _m.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.s, it.s * (it.sy ?? 1), it.s));
    mesh.setMatrixAt(i, _m);
    if (withColor) mesh.setColorAt(i, it.col ?? new Color(1, 1, 1));
  });
  mesh.count = list.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------- static unique structures
function buildStatic(w: World, occ: Occ, smoke: Vector3[]): BufferGeometry {
  const P = new Parts();
  const rnd = mulberry32(3);
  const gy = (x: number, z: number) => w.heightAt(x, z);
  const add = (g: BufferGeometry, c: ColorLike, o?: PartOpts) => P.add(g, c, o);
  const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: ColorLike, ry = 0, o?: PartOpts) =>
    add(T(new BoxGeometry(sx, sy, sz), x, y + sy / 2, z, 0, ry), c, o);
  const cyl = (x: number, y: number, z: number, rt: number, rb: number, h: number, c: ColorLike, seg = 12, o?: PartOpts) =>
    add(T(new CylinderGeometry(rt, rb, h, seg), x, y + h / 2, z), c, o);
  const beam = (a: Vector3, b: Vector3, sx: number, sy: number, c: ColorLike, o?: PartOpts) => {
    const d = b.clone().sub(a);
    const L = d.length();
    const hd = Math.hypot(d.x, d.z);
    const g = new BoxGeometry(sx, sy, L);
    T(g, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, -Math.atan2(d.y, hd), Math.atan2(d.x, d.z), 0);
    return add(g, c, o);
  };
  /** build in local space then place */
  const group = (x: number, y: number, z: number, ry: number, fn: (L: Parts) => void) => {
    const L = new Parts();
    fn(L);
    const g = L.merge();
    T(g, x, y, z, 0, ry);
    P.push(g);
  };
  const lbox = (L: Parts, x: number, y: number, z: number, sx: number, sy: number, sz: number, c: ColorLike, o?: PartOpts, ry = 0) =>
    L.add(T(new BoxGeometry(sx, sy, sz), x, y + sy / 2, z, 0, ry), c, o);

  const BRICK = 0x8a4a33, BRICK2 = 0x7a4232, ROOF = 0x7d8388, RUST = 0x8a5534, STEEL = 0x5f6468, CONC = 0x9d978c;
  const IRON = { rough: 0.45, metal: 0.6 };
  const RUSTY = { rough: 0.75, metal: 0.35 };

  // ---- sheds
  const shed = (x: number, z: number, wdt: number, dep: number, h: number, ry: number, wall: number, saw: boolean) => {
    const y = gy(x, z);
    group(x, y, z, ry, (L) => {
      lbox(L, 0, 0, 0, wdt, h, dep, wall, { ao: 0.75, rough: 0.9 });
      lbox(L, 0, h * 0.62, dep / 2 + 0.004, wdt * 0.92, h * 0.16, 0.01, 0x2d3236, { rough: 0.3 });
      lbox(L, 0, h * 0.62, -dep / 2 - 0.004, wdt * 0.92, h * 0.16, 0.01, 0x2d3236, { rough: 0.3 });
      // roller door
      lbox(L, -wdt * 0.32, 0, dep / 2 + 0.006, Math.min(0.3, wdt * 0.2), h * 0.55, 0.01, 0x6f747a, IRON);
      if (saw) {
        const n = Math.max(2, Math.round(wdt / 0.42));
        const tw = wdt / n;
        for (let i = 0; i < n; i++) {
          const g = gableRoof(dep, tw, tw * 0.55, 0.02, tw * 0.3);
          T(g, -wdt / 2 + tw * (i + 0.5), h, 0, 0, Math.PI / 2);
          const pg = L.add(g, ROOF, IRON);
          tint(pg, (_x, yy, _z, c) => { if (yy > h + tw * 0.4) c.multiplyScalar(0.8); });
        }
      } else {
        const g = gableRoof(wdt, dep, dep * 0.28, 0.05);
        T(g, 0, h, 0);
        const pg = L.add(g, ROOF, IRON);
        tint(pg, (xx, _y, zz, c) => { if (fbm(xx * 3 + x, zz * 3 + z, 2) > 0.62) c.lerp(new Color(0x8a5a3a), 0.6); });
      }
    });
    occ.markRect({ x0: x - wdt / 2, x1: x + wdt / 2, z0: z - dep / 2, z1: z + dep / 2 }, 0.2);
  };
  shed(-6.6, -6.1, 3.2, 1.25, 0.72, 0, BRICK, true);
  shed(-10.1, -5.4, 2.3, 1.0, 0.6, 0, BRICK2, false);
  shed(-6.4, -10.9, 2.2, 1.05, 0.66, 0, BRICK, false);
  shed(-8.3, -4.6, 4.6, 0.75, 0.48, 0, 0x6f6a62, true);
  shed(-5.3, -8.9, 0.9, 1.6, 0.55, 0, BRICK2, false);

  // ---- office (2 storey brick, flat roof) at gate
  {
    const x = -5.2, z = -4.6, y = gy(x, z);
    box(x, y, z, 0.9, 0.55, 0.5, 0xb36a48, 0, { ao: 0.8 });
    box(x, y + 0.55, z, 0.94, 0.04, 0.54, 0x5c5450);
    for (let i = 0; i < 4; i++) for (const yy of [0.14, 0.36]) box(x - 0.33 + i * 0.22, y + yy, z + 0.255, 0.12, 0.1, 0.01, 0x2d3a44, 0, { rough: 0.2 });
  }

  // ---- stacks
  const stack = (x: number, z: number, h: number, rb: number, rt: number, banded: boolean, col: number) => {
    const y = gy(x, z);
    box(x, y, z, rb * 2.6, 0.12, rb * 2.6, CONC);
    const s = add(T(new CylinderGeometry(rt, rb, h, 16, 4), x, y + 0.12 + h / 2, z), col, { rough: 0.85 });
    tint(s, (_x, yy, _z, c) => { const t = (yy - y) / h; c.multiplyScalar(0.85 + 0.25 * t); if (t > 0.88) c.multiplyScalar(0.55); });
    if (banded) {
      const top = y + 0.12 + h;
      for (let i = 0; i < 3; i++) {
        const yy = top - 0.36 + i * 0.12;
        const r = rt + (rb - rt) * ((top - yy) / h) + 0.006;
        cyl(x, yy, z, r, r, 0.1, i % 2 === 0 ? 0xb3392b : 0xebe6dc, 16);
      }
    }
    cyl(x, y + 0.12 + h - 0.02, z, rt * 1.18, rt * 1.08, 0.06, 0x3a3634, 16);
    smoke.push(new Vector3(x, y + 0.12 + h + 0.05, z));
    occ.mark(x, z, rb * 1.6);
  };
  stack(-10.7, -10.4, 3.5, 0.2, 0.12, true, 0x8a7d70);
  stack(-10.05, -10.75, 3.0, 0.18, 0.11, false, 0x7f4535);
  stack(-9.4, -10.5, 3.2, 0.19, 0.115, true, 0x8a7d70);
  stack(-5.5, -10.2, 2.4, 0.15, 0.1, false, 0x7f4535);

  // ---- blast furnace
  {
    const x = -8.2, z = -8.4, y = gy(x, z);
    box(x, y, z, 1.4, 0.1, 1.3, CONC);
    cyl(x, y + 0.1, z, 0.52, 0.56, 0.38, 0x4d4846, 16, RUSTY);
    const shaft = add(T(new CylinderGeometry(0.34, 0.5, 1.5, 16, 3), x, y + 0.48 + 0.75, z), 0x6e4a36, RUSTY);
    tint(shaft, (xx, yy, zz, c) => { if (fbm(xx * 6, zz * 6 + yy * 3, 2) > 0.6) c.multiplyScalar(0.7); });
    cyl(x, y + 1.98, z, 0.18, 0.34, 0.28, 0x5a3e30, 16, RUSTY);
    box(x, y + 2.26, z, 0.34, 0.26, 0.34, 0x7a5a3f, 0, RUSTY);
    box(x, y + 2.52, z, 0.18, 0.18, 0.18, 0x6a5040, 0, RUSTY);
    // truss frame
    for (const [dx, dz] of [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]]) {
      box(x + dx, y + 0.1, z + dz, 0.05, 2.3, 0.05, RUST, 0, RUSTY);
      for (const hh of [0.7, 1.4, 2.1]) {
        if (dx < 0) box(x, y + hh, z + dz, 1.24, 0.035, 0.035, RUST, 0, RUSTY);
        if (dz < 0) box(x + dx, y + hh, z, 0.035, 0.035, 1.24, RUST, 0, RUSTY);
      }
    }
    for (const hh of [0.7, 1.4, 2.1]) box(x, y + hh, z, 1.3, 0.02, 1.3, 0x4a4442, 0, RUSTY);
    // downcomers + dust catcher
    beam(new Vector3(x + 0.1, y + 2.3, z), new Vector3(x + 0.9, y + 1.5, z - 0.75), 0.1, 0.1, 0x6a5040, RUSTY);
    cyl(x + 0.95, y + 0.1, z - 0.8, 0.22, 0.22, 1.1, 0x6b6560, 12, RUSTY);
    add(T(new ConeGeometry(0.22, 0.25, 12), x + 0.95, y + 1.33, z - 0.8), 0x6b6560, RUSTY);
    // hot-blast stoves
    for (let i = 0; i < 3; i++) {
      const sx = x - 1.45, sz = z - 0.75 + i * 0.6;
      cyl(sx, y + 0.1, sz, 0.24, 0.25, 1.55, 0x5c5652, 14, RUSTY);
      add(T(new CylinderGeometry(0.24, 0.24, 0.24, 14, 1), sx, y + 1.65 + 0.12, sz).scale(1, 1, 1), 0x5c5652, RUSTY);
      add(T(new ConeGeometry(0.24, 0.22, 14), sx, y + 1.89 + 0.11, sz), 0x4f4a47, RUSTY);
      beam(new Vector3(sx, y + 1.2, sz), new Vector3(x - 0.5, y + 1.0, z), 0.06, 0.06, 0x6a5040, RUSTY);
    }
    // skip incline gallery
    beam(new Vector3(x + 2.1, y + 0.45, z - 1.6), new Vector3(x + 0.2, y + 2.4, z - 0.15), 0.14, 0.12, 0x7c5a3a, RUSTY);
    for (const t of [0.25, 0.55]) {
      const px = x + 2.1 + (0.2 - 2.1) * t, pz = z - 1.6 + (-0.15 + 1.6) * t, py = 0.45 + (2.4 - 0.45) * t;
      box(px, y, pz, 0.05, py - 0.05, 0.05, RUST, 0, RUSTY);
    }
    // cast house
    box(x + 0.4, y + 0.1, z + 0.95, 1.2, 0.42, 0.55, BRICK2, 0, { ao: 0.8 });
    const cr = gableRoof(1.2, 0.55, 0.16, 0.04);
    add(T(cr, x + 0.4, y + 0.52, z + 0.95), ROOF, IRON);
    smoke.push(new Vector3(x, y + 2.75, z));
    occ.mark(x, z, 1.9);
  }

  // ---- gas holder + tanks + pipe rack
  {
    const x = -5.6, z = -7.3, y = gy(x, z);
    cyl(x, y, z, 0.6, 0.6, 0.95, 0x6f7a6c, 24, { rough: 0.6, metal: 0.4 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      box(x + Math.cos(a) * 0.62, y, z + Math.sin(a) * 0.62, 0.03, 1.05, 0.03, 0x4f574d, a, RUSTY);
    }
    add(T(new CylinderGeometry(0.62, 0.62, 0.05, 24), x, y + 1.06, z), 0x4f574d, RUSTY);
    add(T(new ConeGeometry(0.6, 0.12, 24), x, y + 1.0, z), 0x6f7a6c, { rough: 0.6, metal: 0.4 });
    for (const [tx, tz] of [[-11.0, -7.4], [-11.0, -6.6], [-10.2, -7.0]]) {
      const ty = gy(tx, tz);
      cyl(tx, ty, tz, 0.32, 0.32, 0.42, 0xd8d3c8, 18, { rough: 0.5, metal: 0.3 });
      add(T(new ConeGeometry(0.32, 0.06, 18), tx, ty + 0.45, tz), 0xc8c2b6, { rough: 0.5, metal: 0.3 });
    }
    const py = gy(-8, -6.9) + 0.75;
    const pipe = new CylinderGeometry(0.045, 0.045, 5.2, 8);
    add(T(pipe, -8.0, py, -7.05, 0, 0, Math.PI / 2), 0x8c8d84, IRON);
    const pipe2 = new CylinderGeometry(0.03, 0.03, 5.2, 8);
    add(T(pipe2, -8.0, py + 0.08, -6.95, 0, 0, Math.PI / 2), 0x9a6a3c, IRON);
    for (let i = 0; i < 7; i++) box(-10.4 + i * 0.8, gy(-10.4 + i * 0.8, -7.0), -7.0, 0.04, py - gy(-10.4 + i * 0.8, -7.0), 0.22, STEEL, 0, RUSTY);
    occ.mark(x, z, 0.9);
  }

  // ---- coal stockpiles, stacker-reclaimer, conveyor
  STOCKPILES.forEach((s, i) => {
    const g = stockpileGeo(s.l, s.w, s.h, i * 7 + 1);
    T(g, s.x, gy(s.x, s.z) - 0.02, s.z, 0, s.r);
    P.push(g);
  });
  {
    const y = gy(-8.6, -0.45);
    box(-8.8, y, -0.45, 3.4, 0.03, 0.05, 0x3a3532, 0, IRON);
    box(-8.8, y, -0.33, 3.4, 0.03, 0.05, 0x3a3532, 0, IRON);
    box(-8.6, y + 0.03, -0.4, 0.32, 0.28, 0.3, 0xc49a3a, 0, RUSTY);
    beam(new Vector3(-8.6, y + 0.35, -0.4), new Vector3(-9.8, y + 0.62, -1.2), 0.07, 0.07, 0xc49a3a, RUSTY);
    beam(new Vector3(-8.6, y + 0.3, -0.4), new Vector3(-8.0, y + 0.22, -0.1), 0.12, 0.12, 0x4a4442, RUSTY);
  }
  const conv = CONVEYOR.map(([x, yy, z]) => new Vector3(x, yy, z));
  for (let i = 0; i < conv.length - 1; i++) {
    const a = conv[i], b = conv[i + 1];
    beam(a, b, 0.16, 0.13, 0x7d6a55, RUSTY);
    beam(a.clone().add(new Vector3(0, 0.085, 0)), b.clone().add(new Vector3(0, 0.085, 0)), 0.17, 0.035, 0x9a8c78, IRON);
    const L = a.distanceTo(b);
    const n = Math.floor(L / 0.85);
    for (let k = 1; k <= n; k++) {
      const p = a.clone().lerp(b, k / (n + 1));
      const ground = Math.max(gy(p.x, p.z), -0.5);
      const d = b.clone().sub(a).setY(0).normalize();
      const side = new Vector3(-d.z, 0, d.x).multiplyScalar(0.08);
      for (const sgn of [-1, 1]) {
        beam(new Vector3(p.x + side.x * sgn * 1.8, ground, p.z + side.z * sgn * 1.8), new Vector3(p.x + side.x * sgn, p.y - 0.07, p.z + side.z * sgn), 0.03, 0.03, RUST, RUSTY);
      }
    }
  }
  occ.markLine(CONVEYOR.map(([x, , z]) => [x, z] as const), 0.32);

  // ---- wharf + ship loader
  {
    const { x0, x1, z, w: ww, y } = WHARF;
    box((x0 + x1) / 2, y - 0.05, z, x1 - x0, 0.05, ww, 0x7b6a58, 0, { rough: 0.9 });
    for (let x = x0 + 0.15; x <= x1; x += 0.35) {
      for (const dz of [-ww / 2 + 0.03, ww / 2 - 0.03]) cyl(x, -0.6, z + dz, 0.025, 0.025, 0.87, 0x3e352c, 6);
    }
    const lx = -2.35;
    for (const [dx, dz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) box(lx + dx, y, z + dz, 0.03, 0.72, 0.03, RUST, 0, RUSTY);
    box(lx, y + 0.72, z, 0.36, 0.2, 0.36, 0xb07a3a, 0, RUSTY);
    beam(new Vector3(lx, y + 0.84, z), new Vector3(lx - 0.1, y + 0.6, z + 0.82), 0.07, 0.07, 0xb07a3a, RUSTY);
    occ.markRect({ x0, x1, z0: z - 0.4, z1: z + 0.4 }, 0.1);
  }
  // ship (bulk carrier) moored alongside
  {
    const L = new Parts();
    const sh = new Shape();
    sh.moveTo(-1.3, -0.25); sh.lineTo(0.95, -0.25); sh.quadraticCurveTo(1.32, -0.2, 1.38, 0); sh.quadraticCurveTo(1.32, 0.2, 0.95, 0.25);
    sh.lineTo(-1.3, 0.25); sh.quadraticCurveTo(-1.4, 0, -1.3, -0.25);
    const hull = new ExtrudeGeometry(sh, { depth: 0.36, bevelEnabled: false, curveSegments: 6 });
    hull.rotateX(-Math.PI / 2);
    hull.translate(0, -0.17, 0);
    const hg = L.add(hull, 0xffffff, { rough: 0.5, metal: 0.2 });
    tint(hg, (_x, y, _z, c) => {
      c.set(y < 0.0 ? 0x9c2f24 : y < 0.03 ? 0xe8e4dc : 0x1f2427);
    });
    lbox(L, -0.15, 0.19, 0, 2.3, 0.02, 0.44, 0x6e5038, { rough: 0.8, metal: 0.3 });
    for (let i = 0; i < 5; i++) lbox(L, -0.55 + i * 0.32, 0.21, 0, 0.24, 0.06, 0.3, 0x3d4b3c, { rough: 0.6, metal: 0.3 });
    lbox(L, -1.05, 0.21, 0, 0.34, 0.36, 0.42, 0xebe8e0, { ao: 0.85, rough: 0.5 });
    lbox(L, -1.0, 0.57, 0, 0.24, 0.1, 0.54, 0xf2efe8, { rough: 0.5 });
    lbox(L, -0.89, 0.6, 0, 0.012, 0.04, 0.5, 0x22303a, { rough: 0.1 });
    L.add(T(new CylinderGeometry(0.06, 0.07, 0.24, 10), -1.16, 0.67 + 0.12, 0), 0x1d1d1d);
    L.add(T(new CylinderGeometry(0.0605, 0.0605, 0.05, 10), -1.16, 0.84, 0), 0xb3392b);
    for (const cx of [-0.3, 0.35]) {
      L.add(T(new CylinderGeometry(0.02, 0.025, 0.36, 6), cx, 0.38, 0.16), 0xc9a43a, RUSTY);
      L.add(T(new BoxGeometry(0.02, 0.02, 0.5), cx, 0.52, 0.0, 0.5, 0.4), 0xc9a43a, RUSTY);
    }
    const g = L.merge();
    T(g, SHIP.x, 0, SHIP.z, 0, 0);
    P.push(g);
  }
  // old piles / dead stumps in the polluted estuary flats
  for (let i = 0; i < 14; i++) {
    const x = -4.6 + rnd() * 1.6, z = 8.0 + rnd() * 1.4;
    if (w.kindAt(x, z) === Kind.Land) continue;
    cyl(x, -0.35, z, 0.02, 0.026, 0.35 + 0.15 + rnd() * 0.2, 0x3a322a, 6);
  }

  // ---- bridge
  {
    const { x0, x1, z } = BRIDGE;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n;
      const ya = 0.38 + 0.14 * Math.sin((Math.PI * i) / n), yb = 0.38 + 0.14 * Math.sin((Math.PI * (i + 1)) / n);
      const a = new Vector3(xa, ya, z), b = new Vector3(xb, yb, z);
      beam(a, b, 0.42, 0.06, CONC, { rough: 0.85 });
      for (const dz of [-0.2, 0.2]) beam(a.clone().add(new Vector3(0, 0.07, dz)), b.clone().add(new Vector3(0, 0.07, dz)), 0.025, 0.05, 0xd8d4cc);
    }
    for (const t of [0.3, 0.7]) {
      const x = x0 + (x1 - x0) * t;
      box(x, -0.5, z, 0.12, 0.38 + 0.14 * Math.sin(Math.PI * t) + 0.5 - 0.03, 0.34, 0x8c877d);
    }
    occ.markRect({ x0: x0 - 0.3, x1: x1 + 0.3, z0: z - 0.35, z1: z + 0.35 });
  }

  // ---- town hall with clock tower (sandstone)
  {
    const { x, z } = TOWN_HALL;
    const y = gy(x, z);
    group(x, y, z, -0.12, (L) => {
      lbox(L, 0, 0, 0, 1.15, 0.08, 0.7, 0xb9a27c);
      lbox(L, 0, 0.08, 0, 1.1, 0.42, 0.6, 0xdcbf8f, { ao: 0.8 });
      for (let i = 0; i < 5; i++) lbox(L, -0.44 + i * 0.22, 0.22, 0.301, 0.09, 0.16, 0.01, 0x2d3a44, { rough: 0.2 });
      const r = gableRoof(1.1, 0.6, 0.2, 0.04);
      L.add(T(r, 0, 0.5, 0), 0xa5452f, { rough: 0.6 });
      lbox(L, 0, 0.08, 0.36, 0.28, 0.98, 0.26, 0xe3c899, { ao: 0.85 });
      lbox(L, 0, 0.88, 0.495, 0.13, 0.13, 0.01, 0xf6f1e6);
      lbox(L, 0, 1.06, 0.36, 0.32, 0.04, 0.3, 0xcdb086);
      L.add(T(new ConeGeometry(0.2, 0.32, 4), 0, 1.1 + 0.16, 0.36, 0, Math.PI / 4), 0x5f8a78, { rough: 0.5, metal: 0.4 });
      for (let i = 0; i < 4; i++) L.add(T(new CylinderGeometry(0.022, 0.022, 0.34, 8), -0.36 + i * 0.24, 0.08 + 0.17, 0.33), 0xf0e6d2);
    });
    occ.mark(x, z, 0.85);
  }

  // ---- lighthouse
  {
    const { x, z } = LIGHTHOUSE;
    const y = gy(x, z);
    cyl(x, y, z, 0.17, 0.19, 0.06, 0xcfc6b4);
    const body = add(T(new CylinderGeometry(0.075, 0.11, 0.66, 14), x, y + 0.06 + 0.33, z), 0xf4f2ea, { rough: 0.5 });
    tint(body, (_x, yy, _z, c) => { if (yy - y > 0.38 && yy - y < 0.5) c.set(0xb3392b); });
    cyl(x, y + 0.72, z, 0.12, 0.12, 0.025, 0x2b2b2b);
    cyl(x, y + 0.745, z, 0.06, 0.06, 0.1, 0xfff3c2, 12, { rough: 0.1 });
    add(T(new ConeGeometry(0.085, 0.1, 12), x, y + 0.845 + 0.05, z), 0xb3392b);
    occ.mark(x, z, 0.4);
  }

  // ---- wind turbine towers + nacelles
  // (rotors are a separate instanced mesh, returned via TURBINE_HUBS)
  TURBINE_HUBS.length = 0;
  TURBINES.forEach(([x, z], i) => {
    const y = gy(x, z);
    const yaw = Math.PI * 0.22 + (i - 1) * 0.12;
    const H = 3.0 + (i === 1 ? 0.2 : 0);
    cyl(x, y, z, 0.16, 0.18, 0.08, 0xc9c4b8);
    add(T(new CylinderGeometry(0.045, 0.085, H, 14), x, y + 0.08 + H / 2, z), 0xf2f3f0, { rough: 0.4 });
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const top = y + 0.08 + H;
    add(T(new BoxGeometry(0.13, 0.12, 0.36), x - fx * 0.06, top + 0.04, z - fz * 0.06, 0, yaw), 0xeef0ee, { rough: 0.4 });
    TURBINE_HUBS.push({ pos: new Vector3(x + fx * 0.15, top + 0.05, z + fz * 0.15), yaw });
    occ.mark(x, z, 0.35);
  });

  // ---- boardwalk through the restored mangroves
  {
    const pts: [number, number][] = [[0.6, 10.3], [1.6, 9.7], [2.6, 9.6], [3.4, 10.1]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = new Vector3(pts[i][0], 0, pts[i][1]);
      const b = new Vector3(pts[i + 1][0], 0, pts[i + 1][1]);
      a.y = Math.max(gy(a.x, a.z), 0) + 0.14;
      b.y = Math.max(gy(b.x, b.z), 0) + 0.14;
      beam(a, b, 0.2, 0.025, 0xa39072, { rough: 0.85 });
      const n = Math.ceil(a.distanceTo(b) / 0.3);
      for (let k = 0; k <= n; k++) {
        const p = a.clone().lerp(b, k / n);
        cyl(p.x, Math.min(gy(p.x, p.z), 0) - 0.1, p.z, 0.012, 0.012, p.y - Math.min(gy(p.x, p.z), 0) + 0.08, 0x6a5a48, 5);
      }
    }
    occ.markLine(pts, 0.18);
  }

  // ---- roads (draped ribbons with kerbs)
  for (const road of ROADS) {
    const samples: [number, number, number, number][] = [];
    for (let s = 0; s < road.length - 1; s++) {
      const [ax, az] = road[s];
      const [bx, bz] = road[s + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(L / 0.12));
      for (let i = s === 0 ? 0 : 1; i <= n; i++) {
        const t = i / n;
        samples.push([ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / L, (bz - az) / L]);
      }
    }
    const strip = (off0: number, off1: number, lift: number, color: number) => {
      const pos: number[] = [];
      for (let i = 0; i < samples.length - 1; i++) {
        const [x0, z0, dx0, dz0] = samples[i];
        const [x1, z1, dx1, dz1] = samples[i + 1];
        const nx0 = -dz0, nz0 = dx0, nx1 = -dz1, nz1 = dx1;
        const v = (x: number, z: number, nx: number, nz: number, o: number) => {
          const px = x + nx * o, pz = z + nz * o;
          return [px, Math.max(gy(px, pz), 0.05) + lift, pz];
        };
        const A = v(x0, z0, nx0, nz0, off0), B = v(x0, z0, nx0, nz0, off1), Cc = v(x1, z1, nx1, nz1, off1), D = v(x1, z1, nx1, nz1, off0);
        pos.push(...A, ...D, ...Cc, ...A, ...Cc, ...B);
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      // ensure up-facing
      const nrm = g.attributes.normal;
      if (nrm.count && nrm.getY(0) < 0) {
        for (let i = 0; i < pos.length; i += 9) {
          for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; }
        }
        g.setAttribute('position', new Float32BufferAttribute(pos, 3));
        g.computeVertexNormals();
      }
      P.add(g, color, { rough: 0.8 });
    };
    strip(-0.12, 0.12, 0.045, 0x4a4947);
    strip(0.12, 0.17, 0.05, 0xa8a296);
    strip(-0.17, -0.12, 0.05, 0xa8a296);
    occ.markLine(road, 0.3);
  }

  return P.merge();
}

const TURBINE_HUBS: { pos: Vector3; yaw: number }[] = [];

// ---------------------------------------------------------------- main entry
export function buildProps(w: World): PropSet {
  const rnd = mulberry32(2024);
  const occ = new Occ();
  occ.markRect(PAD, 0.15);
  occ.markRect(COALYARD, 0.1);
  const smoke: Vector3[] = [];
  const staticGeo = buildStatic(w, occ, smoke);
  const entries: PropEntry[] = [];
  entries.push({ obj: new Mesh(staticGeo), spec: SPEC.static, cast: true, receive: true });

  const landOK = (x: number, z: number) => w.kindAt(x, z) === Kind.Land;
  const slope = (x: number, z: number) =>
    Math.abs(w.heightAt(x + 0.15, z) - w.heightAt(x - 0.15, z)) + Math.abs(w.heightAt(x, z + 0.15) - w.heightAt(x, z - 0.15));
  const dW = (x: number, z: number) => Math.min(w.field(w.dSea, x, z), w.field(w.dEst, x, z));

  // ---- cottages
  const cot: Inst[] = [];
  const cotSp = new Spacer(0.5);
  const WALLS = [0xf1ead8, 0xe7e2d0, 0xd6e2e6, 0xe9d8b8, 0xf5f1e8, 0xd8e3cf, 0xecd3c4, 0xe4dccb];
  const ROOFS = [0x8f969b, 0xa3482f, 0x4f6e58, 0x7a5a45, 0xb7bcbe, 0x3f5a6b, 0x9a3c2c, 0x8f969b];
  const tryCottage = (x: number, z: number): boolean => {
    if (!landOK(x, z) || dW(x, z) < 0.65 || slope(x, z) > 0.25) return false;
    if (!occ.free(x, z) || !occ.free(x + 0.3, z) || !occ.free(x - 0.3, z) || !occ.free(x, z + 0.3) || !occ.free(x, z - 0.3)) return false;
    if (!cotSp.ok(x, z, 0.78)) return false;
    let best: [number, number, number, number, number] | null = null;
    for (const r of ROADS) {
      const c = closestOnPolyline(x, z, r);
      if (!best || c[4] < best[4]) best = c;
    }
    if (!best || best[4] > 1.15) return false;
    const fx = best[0] - x, fz = best[1] - z;
    // face the road: snap to road-perpendicular
    const ry = Math.atan2(fx, fz);
    cot.push({ x, y: w.heightAt(x, z), z, ry, s: 1.1 + rnd() * 0.18 });
    cotSp.add(x, z);
    return true;
  };
  for (let i = 0; i < 4000 && cot.length < 32; i++) {
    const x = -11.4 + rnd() * 9.2, z = -3.2 + rnd() * 14.8;
    tryCottage(x, z);
  }
  for (let i = 0; i < 2000 && cot.length < 40; i++) {
    const x = 0.3 + rnd() * 3.6, z = -4.6 + rnd() * 7.5;
    tryCottage(x, z);
  }
  for (const c of cot) occ.mark(c.x, c.z, 0.62);
  const walls = cot.map((c) => ({ ...c, col: new Color(WALLS[Math.floor(rnd() * WALLS.length)]) }));
  const roofs = cot.map((c) => ({ ...c, col: new Color(ROOFS[Math.floor(rnd() * ROOFS.length)]) }));
  entries.push({ obj: makeInstanced(cottageBodyGeo(), walls, true), spec: SPEC.cottage, cast: true, receive: true });
  entries.push({ obj: makeInstanced(cottageRoofGeo(), roofs, true), spec: SPEC.cottage, cast: true, receive: true });

  // ---- eucalypts
  const trees: Inst[] = [];
  const treeSp = new Spacer(0.5);
  for (let i = 0; i < 30000 && trees.length < 420; i++) {
    const x = -11.8 + rnd() * 23.6, z = -11.8 + rnd() * 23.6;
    if (!landOK(x, z) || !occ.free(x, z) || slope(x, z) > 0.32) continue;
    const dw = dW(x, z);
    if (dw < 0.35) continue;
    const hl = headlandFactor(x, z);
    const ds = w.field(w.dSea, x, z);
    if (ds < 1.3 && hl < 0.4) continue;
    let p = 0.8 * (0.55 + 0.6 * fbm(x * 0.25 + 3, z * 0.25, 3));
    if (hl > 0.5) p *= 0.55;
    if (x < -2.5 && z > -3.6) p *= 0.6;
    if (rnd() > p) continue;
    if (!treeSp.ok(x, z, 0.46)) continue;
    treeSp.add(x, z);
    const tint = new Color().setHSL(0.27 + (rnd() - 0.5) * 0.06, 0.2 + rnd() * 0.15, 0.5);
    tint.lerp(new Color(1, 1, 1), 0.72);
    trees.push({ x, y: w.heightAt(x, z) - 0.02, z, ry: rnd() * Math.PI * 2, s: 0.72 + rnd() * 0.36, tilt: (rnd() - 0.5) * 0.12, col: tint });
  }
  shuffle(trees, rnd);
  const tA = trees.filter((_, i) => i % 5 < 3);
  const tB = trees.filter((_, i) => i % 5 >= 3);
  const lodTree = (v: 0 | 1, seed: number): [BufferGeometry, BufferGeometry, BufferGeometry] => {
    const lo = eucalyptGeo(0, v, seed);
    const hi = eucalyptGeo(1, v, seed);
    return [lo, hi, hi];
  };
  const lA = lodTree(0, 3);
  const lB = lodTree(1, 8);
  entries.push({ obj: makeInstanced(lA[2], tA, true), spec: SPEC.tree, cast: true, receive: true, lod: lA, frac: [0.6, 0.85, 1], full: tA.length });
  entries.push({ obj: makeInstanced(lB[2], tB, true), spec: SPEC.tree, cast: true, receive: true, lod: lB, frac: [0.6, 0.85, 1], full: tB.length });

  // ---- mangroves
  const mang: Inst[] = [];
  const mSp = new Spacer(0.3);
  for (let i = 0; i < 20000 && mang.length < 120; i++) {
    const x = -5 + rnd() * 9.5, z = 2.5 + rnd() * 9.4;
    const k = w.kindAt(x, z);
    const h = w.heightAt(x, z);
    const de = w.field(w.dEst, x, z);
    let ok = false;
    if (k === Kind.Estuary && h > -0.34 && w.field(w.dLand, x, z) < 0.8) ok = true;
    if (k === Kind.Land && de < 0.55 && h < 0.3) ok = true;
    if (!ok) continue;
    if (x > -5.2 && x < -1.3 && z > 5.9 && z < 7.8) continue; // wharf + ship
    if (!occ.free(x, z) || !mSp.ok(x, z, 0.27)) continue;
    mSp.add(x, z);
    mang.push({ x, y: Math.max(h, -0.1), z, ry: rnd() * 6.28, s: 0.8 + rnd() * 0.45 });
  }
  shuffle(mang, rnd);
  const lM: [BufferGeometry, BufferGeometry, BufferGeometry] = [mangroveGeo(0), mangroveGeo(1), mangroveGeo(1)];
  entries.push({ obj: makeInstanced(lM[2], mang, false), spec: SPEC.mangrove, cast: true, receive: true, lod: lM, frac: [0.7, 1, 1], full: mang.length });

  // ---- shrubs: banksia, wattle, grass trees
  const shrubSp = new Spacer(0.25);
  const shrubOK = (x: number, z: number, beachOK: boolean) => {
    if (!landOK(x, z) || !occ.free(x, z) || slope(x, z) > 0.4) return false;
    if (dW(x, z) < 0.25) return false;
    const hl = headlandFactor(x, z);
    const ds = w.field(w.dSea, x, z);
    if (!beachOK && ds < 1.2 && hl < 0.4) return false;
    if (ds < 0.6 && hl < 0.4) return false;
    if (!treeSp.ok(x, z, 0.2)) return false;
    return shrubSp.ok(x, z, 0.22);
  };
  const scatter = (count: number, beachOK: boolean, bias: (x: number, z: number) => number, scale: [number, number]): Inst[] => {
    const out: Inst[] = [];
    for (let i = 0; i < 30000 && out.length < count; i++) {
      const x = -11.8 + rnd() * 23.6, z = -11.8 + rnd() * 23.6;
      if (rnd() > bias(x, z)) continue;
      if (!shrubOK(x, z, beachOK)) continue;
      shrubSp.add(x, z);
      out.push({ x, y: w.heightAt(x, z) - 0.01, z, ry: rnd() * 6.28, s: scale[0] + rnd() * (scale[1] - scale[0]) });
    }
    return shuffle(out, rnd);
  };
  const heathBias = (x: number, z: number) => 0.35 + 0.65 * headlandFactor(x, z);
  const bank = scatter(120, true, heathBias, [0.8, 1.3]);
  const wat = scatter(90, false, (x) => (x > -3 ? 0.9 : 0.5), [0.8, 1.35]);
  const gtr = scatter(60, true, (x, z) => 0.15 + 0.85 * headlandFactor(x, z), [0.8, 1.25]);
  const lBk: [BufferGeometry, BufferGeometry, BufferGeometry] = [banksiaGeo(0), banksiaGeo(1), banksiaGeo(1)];
  const lWt: [BufferGeometry, BufferGeometry, BufferGeometry] = [wattleGeo(0), wattleGeo(1), wattleGeo(1)];
  entries.push({ obj: makeInstanced(lBk[2], bank, false), spec: SPEC.shrub, cast: true, receive: true, lod: lBk, frac: [0.5, 1, 1], full: bank.length });
  entries.push({ obj: makeInstanced(lWt[2], wat, false), spec: SPEC.shrub, cast: true, receive: true, lod: lWt, frac: [0.5, 1, 1], full: wat.length });
  entries.push({ obj: makeInstanced(grassTreeGeo(), gtr, false), spec: SPEC.grassTree, cast: true, receive: true, frac: [0.5, 1, 1], full: gtr.length });

  // ---- grass / heath tufts
  const tufts: Inst[] = [];
  const tSp = new Spacer(0.15);
  const TUFT = [0x8aa05a, 0x9fae62, 0xc2b25e, 0x7d9a56, 0xb7a95a, 0x6f8c4a];
  for (let i = 0; i < 40000 && tufts.length < 1100; i++) {
    const x = -11.9 + rnd() * 23.8, z = -11.9 + rnd() * 23.8;
    if (!landOK(x, z) || !occ.free(x, z) || dW(x, z) < 0.15) continue;
    if (w.field(w.dSea, x, z) < 0.5 && headlandFactor(x, z) < 0.4) continue;
    if (!tSp.ok(x, z, 0.13)) continue;
    tSp.add(x, z);
    tufts.push({ x, y: w.heightAt(x, z) - 0.01, z, ry: rnd() * 6.28, s: 0.7 + rnd() * 0.8, col: new Color(TUFT[Math.floor(rnd() * TUFT.length)]) });
  }
  shuffle(tufts, rnd);
  entries.push({ obj: makeInstanced(tuftGeo(), tufts, true), spec: SPEC.tuft, cast: false, receive: true, frac: [0.4, 0.8, 1], full: tufts.length });

  // ---- coral reef
  const corals: Inst[] = [];
  const cSp = new Spacer(0.2);
  const CORAL = [0xe05a8a, 0x9b5bd1, 0xf08a3c, 0x3cc0b0, 0xf2c94c, 0xd6457a, 0x6fa8ff, 0xff7a5c];
  for (let i = 0; i < 30000 && corals.length < 300; i++) {
    const x = 3 + rnd() * 9, z = -2 + rnd() * 14;
    if (w.kindAt(x, z) !== Kind.Sea) continue;
    const h = w.heightAt(x, z);
    if (h < -0.62 || h > -0.24) continue;
    if (w.field(w.dLand, x, z) < 0.5) continue;
    if (!cSp.ok(x, z, 0.19)) continue;
    cSp.add(x, z);
    corals.push({ x, y: h - 0.02, z, ry: rnd() * 6.28, s: 0.8 + rnd() * 0.7, col: new Color(CORAL[Math.floor(rnd() * CORAL.length)]) });
  }
  shuffle(corals, rnd);
  entries.push({ obj: makeInstanced(coralGeo(), corals, true), spec: SPEC.coral, cast: false, receive: true, frac: [0.6, 1, 1], full: corals.length });

  // ---- rocks
  const rocks: Inst[] = [];
  const ROCK = [0xe0c49a, 0xcfa070, 0xe8d2a8, 0xbf8f62, 0xd6b486];
  const rk = () => new Color(ROCK[Math.floor(rnd() * ROCK.length)]);
  for (let i = 0; i < 20000 && rocks.length < 60; i++) {
    const x = 3 + rnd() * 9, z = -12 + rnd() * 13;
    if (headlandFactor(x, z) < 0.25 && w.kindAt(x, z) !== Kind.Sea) continue;
    const dl = w.field(w.dLand, x, z);
    const ds = w.field(w.dSea, x, z);
    const k = w.kindAt(x, z);
    if (!((k === Kind.Sea && dl < 0.45) || (k === Kind.Land && ds < 0.3))) continue;
    if (headlandFactor(x, z) < 0.2) continue;
    rocks.push({ x, y: w.heightAt(x, z) - 0.05, z, ry: rnd() * 6.28, s: 0.25 + rnd() * 0.35, sy: 0.9 + rnd() * 0.8, col: rk() });
  }
  for (const [x, z, s] of [[11.6, 0.6, 0.9], [11.0, -1.4, 0.65], [6.6, -1.6, 0.5], [11.5, 3.6, 0.55]] as const) {
    if (w.kindAt(x, z) !== Kind.Sea) continue;
    rocks.push({ x, y: w.heightAt(x, z) - 0.1, z, ry: rnd() * 6.28, s, sy: 1.6, col: rk() });
  }
  for (let i = 0; i < 4000 && rocks.length < 90; i++) {
    const x = 3 + rnd() * 9, z = -12 + rnd() * 10;
    if (headlandFactor(x, z) < 0.75 || !landOK(x, z) || !occ.free(x, z) || slope(x, z) > 0.2) continue;
    rocks.push({ x, y: w.heightAt(x, z) - 0.06, z, ry: rnd() * 6.28, s: 0.25 + rnd() * 0.25, sy: 0.35, col: rk() });
  }
  entries.push({ obj: makeInstanced(rockGeo(4), rocks, true), spec: SPEC.rock, cast: true, receive: true });

  // ---- smoke puffs
  const PUFFS = 16;
  const smokeList: Inst[] = [];
  const smokeAttr: number[] = [];
  smoke.forEach((p, e) => {
    for (let i = 0; i < PUFFS; i++) {
      smokeList.push({ x: p.x, y: p.y, z: p.z, ry: 0, s: 1 });
      smokeAttr.push(i / PUFFS + rnd() * 0.02 + e * 0.13, 0.085 + rnd() * 0.02);
    }
  });
  const smokeMesh = makeInstanced(puffGeo(0.22, 5, 0.7), smokeList, false);
  smokeMesh.geometry.setAttribute('smoke', new InstancedBufferAttribute(new Float32Array(smokeAttr), 2));
  // colour: sepia-grey
  tint(smokeMesh.geometry, (_x, _y, _z, c) => c.multiply(new Color(0xa69b8c)));
  entries.push({ obj: smokeMesh, spec: SPEC.smoke, cast: true, receive: false });

  // ---- floating cloud puffs around/below the slab
  const clouds: Inst[] = [];
  for (let c = 0; c < 16; c++) {
    const a = (c / 16) * Math.PI * 2 + rnd() * 0.3;
    const r = 24 + rnd() * 26;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    const cy = -9 + rnd() * 6 + (r > 40 ? 4 : 0);
    const n = 6 + Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) {
      clouds.push({ x: cx + (rnd() - 0.5) * 6, y: cy + rnd() * 1.2, z: cz + (rnd() - 0.5) * 4, ry: rnd() * 6.28, s: 1.2 + rnd() * 2.2, sy: 0.7 });
    }
  }
  entries.push({ obj: makeInstanced(puffGeo(1, 9, 0.72), clouds, false), spec: SPEC.cloud, cast: false, receive: false, styles: [0, 1] });

  // ---- turbine rotors
  const rotorInfo = TURBINE_HUBS.map((h, i) => ({ pos: h.pos, yaw: h.yaw, speed: 1.1 + i * 0.17, phase: i * 1.7 }));
  const rotors = makeInstanced(rotorGeo(), rotorInfo.map((r) => ({ x: r.pos.x, y: r.pos.y, z: r.pos.z, ry: r.yaw, s: 1 })), false);
  entries.push({ obj: rotors, spec: SPEC.rotor, cast: true, receive: false });

  return { entries, rotors, rotorInfo };
}
