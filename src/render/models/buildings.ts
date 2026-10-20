// Procedural building models (style B "painterly toon"): one merged, vertex-coloured BufferGeometry per building.
// Conventions: 1 unit = 1 tile; origin = footprint centre; y = 0 = ground (tile top) or water surface for sea buildings;
// at rotation 0 the footprint spans x ∈ [−w/2, w/2], z ∈ [−h/2, h/2]; +Z is the front. Sea-facing buildings face +X.
import {
  BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, LatheGeometry, Shape,
  SphereGeometry, TorusGeometry, Vector2, Vector3,
} from 'three';
import type { BuildingId } from '../../sim/types';
import { BUILDINGS } from '../../sim/buildings';
import { T, blob, taperTube, type ColorLike } from '../geo';
import { mulberry32, vnoise } from '../noise';
import {
  G, GLASS, IRON, Kit, MATTE, PAINT, RUSTY, WALL, blobShape, buildAmbient, facets, ribbon, type V3,
} from './ambient';
import { mulgaGeo, palmGeo, saltbushGeo, spinifexGeo, streetTreeGeo } from './biomeveg';

export interface Rotor { x: number; y: number; z: number; /** facing yaw (rad) about +Y; rotor disc normal = (sin yaw, 0, cos yaw) */ yaw: number; /** blade length scale (1 = 1.3 units blade) */ scale: number }
export interface Stack { x: number; y: number; z: number; /** relative plume size 0.3..2 */ size: number; /** 0 = dark coal smoke, 1 = white steam */ steam: number }
export interface BuildingModel { geo: BufferGeometry; stacks: Stack[]; rotors: Rotor[]; /** world height of tallest point, for label/tooltip anchoring */ height: number }

export type ModelId = Exclude<BuildingId, 'road' | 'rail'>;

// ------------------------------------------------------------------ palette
const BRICK = 0x9a4f36, BRICK2 = 0x7d4330, BRICK_L = 0xb8714e, RUST = 0x8a5534, RUST2 = 0x6e4a36, STEEL = 0x5f6468;
const CONC = 0xa7a194, CONC_L = 0xc9c3b6, CONC_D = 0x7f796f, ROOF = 0x8d949a, ROOF_RED = 0xa5452f, ROOF_GRN = 0x5f7f6a;
const TIMBER = 0x8a6a4a, TIMBER_L = 0xb08a5e, LAWN = 0x86a35a, LAWN2 = 0x7a9850, DIRT = 0x8f6c46, GRAVEL = 0xb3a993;
const COAL = 0x2b2825, WHITE = 0xf3f0e8, CREAM = 0xeee4cf, GLASSC = 0x2b3a46, SKYGLASS = 0x8fb3c4;
const PV = 0x22385e, PV2 = 0x2c4a78, TEAL = 0x3f9a96, SAGE = 0x9fb08a, WATTLE = 0xe3b72e, SAND = 0xdcc79a;
const WATER = 0x4f9a9c, WATER_D = 0x3d8590, ASPHALT = 0x55565a, YELLOW = 0xe3b02a, SANDSTONE = 0xd9c28e;

// ------------------------------------------------------------------ shared helpers
/** Ground pad covering the footprint, from y=-0.3 up to `top`; sides darkened. */
function pad(k: Kit, w: number, h: number, col: ColorLike, inset = 0.02, top = G, x = 0, z = 0): void {
  const g = k.box(x, -0.3, z, w - inset * 2, 0.3 + top, h - inset * 2, col, MATTE);
  facets(g, (_x, _y, _z, _nx, ny) => (ny < 0.5 ? 0.72 : undefined));
}

/** Triangulated planar polygons; each face is fanned and oriented to its given outward normal. */
function polys(faces: { p: V3[]; n: V3 }[]): BufferGeometry {
  const pos: number[] = [];
  for (const f of faces) {
    for (let i = 1; i < f.p.length - 1; i++) {
      const a = f.p[0], b = f.p[i], c = f.p[i + 1];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * f.n[0] + ny * f.n[1] + nz * f.n[2] >= 0) pos.push(...a, ...b, ...c);
      else pos.push(...a, ...c, ...b);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** Sawtooth roof over w (x) × d (z) at height y; teeth step along z, glazed vertical faces look toward +z. */
function sawtooth(k: Kit, x: number, y: number, z: number, w: number, d: number, n: number, h: number, roofCol: ColorLike, glass: ColorLike = SKYGLASS): void {
  const t = d / n;
  const x0 = x - w / 2 - 0.02, x1 = x + w / 2 + 0.02;
  const roof: { p: V3[]; n: V3 }[] = [];
  const gl: { p: V3[]; n: V3 }[] = [];
  for (let i = 0; i < n; i++) {
    const z0 = z - d / 2 + i * t, z1 = z0 + t;
    roof.push({ p: [[x0, y, z0], [x1, y, z0], [x1, y + h, z1], [x0, y + h, z1]], n: [0, 1, -0.5] });
    roof.push({ p: [[x0, y, z0], [x0, y, z1], [x0, y + h, z1]], n: [-1, 0, 0] });
    roof.push({ p: [[x1, y, z0], [x1, y, z1], [x1, y + h, z1]], n: [1, 0, 0] });
    gl.push({ p: [[x0, y + h, z1], [x1, y + h, z1], [x1, y, z1], [x0, y, z1]], n: [0, 0, 1] });
  }
  k.add(polys(roof), roofCol, IRON);
  const g = k.add(polys(gl), glass, GLASS);
  // mullions: alternate glazing panes slightly darker
  if (k.hi) facets(g, (cx) => (Math.floor((cx - x0) / 0.07) % 2 ? 0.85 : undefined));
}

/** Lumpy coal/ore stockpile, long axis along x. */
function stockpile(k: Kit, x: number, z: number, l: number, w: number, h: number, seed: number, col: ColorLike = COAL, ry = 0): void {
  const g = new SphereGeometry(1, k.hi ? 14 : 9, k.hi ? 6 : 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
    const n = vnoise(px * 3 + seed, pz * 3 - seed) - 0.5;
    const ridge = Math.pow(Math.max(0, 1 - Math.abs(pz)), 0.5);
    p.setXYZ(i, px * (l / 2) * (1 + n * 0.12), Math.max(0, py * h * (0.75 + 0.25 * ridge) * (1 + n * 0.35)), pz * (w / 2) * (1 + n * 0.12));
  }
  g.computeVertexNormals();
  T(g, x, G - 0.01, z, 0, ry);
  const out = k.add(g, col, MATTE);
  facets(out, (cx, cy, cz) => 0.78 + 0.45 * vnoise(cx * 9 + seed, cz * 9 + cy * 4) * (0.4 + (cy - G) / h));
}

/** Weatherboard cottage, local origin at ground centre, front (+z) verandah. */
function cottage(k: Kit, wall: ColorLike, roof: ColorLike, trim: ColorLike, chimneyX: number, smoke: boolean, W = 0.3, D = 0.24): void {
  const B = 0.03, H = 0.17;
  k.box(0, 0, 0, W + 0.02, B, D + 0.02, 0x6e5e4e, MATTE);
  const w = k.sbox(0, B, 0, W, H, D, 1, k.hi ? 7 : 1, 1, wall, WALL);
  if (k.hi) facets(w, (_x, cy, _z, _nx, ny) => (Math.abs(ny) < 0.5 && Math.floor((cy - B) / (H / 7)) % 2 ? 0.9 : undefined));
  // front windows + door
  for (const sx of [-1, 1]) k.wins('+z', D / 2, B + 0.095, sx * 0.085 - 0.03, sx * 0.085 + 0.03, 1, 0.05, 0.065, GLASSC, WHITE);
  k.quad(0, B + 0.055, D / 2 + 0.003, 0.042, 0.105, '+z', trim, PAINT);
  k.wins('+x', W / 2, B + 0.095, -0.05, 0.03, 1, 0.05, 0.06, GLASSC, WHITE);
  k.wins('-x', -W / 2, B + 0.095, -0.05, 0.03, 1, 0.05, 0.06, GLASSC, WHITE);
  // roof
  const r = k.hip(0, B + H, 0, W, D, 0.12, roof, IRON, 0, 0.03);
  if (k.hi) facets(r, (cx, cy, cz) => (vnoise(cx * 30 + chimneyX * 9, cz * 30 + cy * 20) > 0.72 ? 0.85 : undefined));
  // verandah: floor, striped bullnose roof, posts
  k.box(0, 0, D / 2 + 0.055, W + 0.02, B + 0.006, 0.1, 0x8a7560, MATTE);
  const vr = k.add(T(new BoxGeometry(W + 0.03, 0.012, 0.125, k.hi ? 9 : 1, 1, 1), 0, B + H - 0.012, D / 2 + 0.065, 0.24, 0, 0), roof, IRON);
  if (k.hi) facets(vr, (cx) => (Math.floor((cx + W) / ((W + 0.03) / 9)) % 2 ? trim : undefined));
  for (const px of [-W / 2, 0, W / 2]) k.box(px, B, D / 2 + 0.115, 0.012, H - 0.04, 0.012, WHITE, PAINT);
  if (k.hi) k.box(0, B + 0.045, D / 2 + 0.115, W, 0.008, 0.006, WHITE, PAINT);
  // chimney
  k.box(chimneyX, B, -0.05, 0.045, H + 0.15, 0.045, 0x9a5038, WALL);
  k.box(chimneyX, B + H + 0.15, -0.05, 0.056, 0.018, 0.056, 0x7a3f2c);
  if (smoke) k.stacks.push({ x: chimneyX, y: B + H + 0.168 + 0.03, z: -0.05, size: 0.3, steam: 0.6 });
}

/** Brick-veneer suburban house (1960s-80s), front +z. */
function brickHome(k: Kit, wall: ColorLike, roof: ColorLike, seed: number): void {
  const W = 0.3, D = 0.2, H = 0.115;
  k.box(0, 0, 0, W + 0.01, 0.015, D + 0.01, CONC_D, MATTE);
  const w = k.sbox(0, 0.015, 0, W, H, D, 1, k.hi ? 5 : 1, 1, wall, WALL);
  if (k.hi) facets(w, (cx, cy, cz) => (vnoise(cx * 90 + seed, cy * 140 + cz * 90) > 0.68 ? 0.88 : undefined));
  k.wins('+z', D / 2, 0.075, -0.13, 0.0, 1, 0.09, 0.05, 0x34485a, 0xe8e2d4);
  k.wins('+z', D / 2, 0.075, 0.03, 0.13, 1, 0.05, 0.05, 0x34485a, 0xe8e2d4);
  k.quad(0.01, 0.06, D / 2 + 0.003, 0.03, 0.08, '+z', 0x6b4a2e, PAINT);
  k.wins('-z', -D / 2, 0.075, -0.1, 0.1, 2, 0.05, 0.045, 0x34485a);
  k.hip(0, 0.015 + H, 0, W, D, 0.085, roof, { rough: 0.7 }, 0, 0.03);
  // garage / carport on the side
  const gx = seed % 2 ? W / 2 + 0.055 : -W / 2 - 0.055;
  k.box(gx, 0.015, 0.0, 0.1, 0.09, D - 0.02, wall, WALL);
  k.quad(gx, 0.05, (D - 0.02) / 2 + 0.003, 0.08, 0.07, '+z', 0xd9d4c8, PAINT);
  k.box(gx, 0.105, 0.0, 0.12, 0.012, D, roof, { rough: 0.7 });
}

/** Lattice transmission pylon. */
function pylon(k: Kit, x: number, z: number, h: number, ry = 0): void {
  k.group(x, G, z, ry, (q) => {
    const b = 0.09, t = 0.025;
    const legs: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [sx, sz] of legs) q.beam([sx * b, 0, sz * b], [sx * t, h, sz * t], 0.012, 0.012, 0x8d9296, IRON);
    if (q.hi) {
      for (let i = 0; i < 3; i++) {
        const y0 = (i / 3) * h * 0.8, y1 = ((i + 1) / 3) * h * 0.8;
        const r0 = b + (t - b) * (y0 / h), r1 = b + (t - b) * (y1 / h);
        q.beam([-r0, y0, r0], [r1, y1, r1], 0.006, 0.006, 0x8d9296, IRON);
        q.beam([r0, y0, -r0], [-r1, y1, -r1], 0.006, 0.006, 0x8d9296, IRON);
        q.beam([r0, y0, r0], [r1, y1, -r1], 0.006, 0.006, 0x8d9296, IRON);
        q.beam([-r0, y0, -r0], [-r1, y1, r1], 0.006, 0.006, 0x8d9296, IRON);
      }
    }
    for (const [yy, ww] of [[h * 0.72, 0.36], [h * 0.88, 0.26]] as [number, number][]) {
      q.box(0, yy, 0, ww, 0.016, 0.02, 0x8d9296, IRON);
      for (const sx of [-1, 1]) q.cyl(sx * ww * 0.45, yy - 0.05, 0, 0.007, 0.007, 0.05, 0xd8d4c8, 4, GLASS);
    }
  });
}

/** Low fence of posts + rails around a rectangle (gaps where gate). */
function fenceRect(k: Kit, x0: number, z0: number, x1: number, z1: number, col: ColorLike, h = 0.07, step = 0.16, wire = false): void {
  const runs: [number, number, number, number][] = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]];
  for (const [ax, az, bx, bz] of runs) {
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(L / step));
    if (k.hi) for (let i = 0; i < n; i++) {
      const t = i / n;
      k.box(ax + (bx - ax) * t, G, az + (bz - az) * t, 0.014, h, 0.014, col, MATTE);
    }
    for (const yy of wire ? [h * 0.95] : [h * 0.45, h * 0.85]) k.beam([ax, G + yy, az], [bx, G + yy, bz], wire ? 0.004 : 0.008, wire ? 0.004 : 0.01, col, MATTE);
  }
}

/** Wind turbine tower + nacelle (rotor returned separately). Local yaw: rotor faces (sin yaw, 0, cos yaw). */
function turbine(k: Kit, x: number, y: number, z: number, hub: number, yaw: number, scale: number, rb = 0.075, rt = 0.042): void {
  k.group(x, y, z, yaw, (q) => {
    q.lathe(0, 0, 0, [[rb, 0], [(rb + rt) / 2 + 0.005, hub * 0.5], [rt, hub - 0.02]], 0xf2f3f0, 12, { rough: 0.4 });
    const nac = q.add(T(new BoxGeometry(0.1, 0.1, 0.3, 1, 1, 2), 0, hub + 0.035, -0.05), 0xeef0ee, { rough: 0.4 });
    facets(nac, (_x, cy) => (cy < hub + 0.0 ? 0.92 : undefined));
    q.sph(0, hub + 0.035, 0.1, 0.05, 0xeef0ee, 8, 1, 1, 0.6, { rough: 0.4 });
    if (q.hi) q.box(0, hub + 0.085, -0.15, 0.02, 0.03, 0.02, 0xd8d8d8);
    q.rotors.push({ x: 0, y: hub + 0.035, z: 0.14, yaw: 0, scale });
  });
}

/** Moored bulk carrier, length along local x (bow +x), waterline y ≈ -0.1, hull bottom at -0.45. */
function bulkCarrier(k: Kit): void {
  const sh = new Shape();
  sh.moveTo(-0.82, -0.15); sh.lineTo(0.55, -0.15); sh.quadraticCurveTo(0.82, -0.12, 0.86, 0);
  sh.quadraticCurveTo(0.82, 0.12, 0.55, 0.15); sh.lineTo(-0.82, 0.15); sh.quadraticCurveTo(-0.86, 0, -0.82, -0.15);
  const hull = new ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: false, curveSegments: k.hi ? 6 : 3 });
  hull.rotateX(-Math.PI / 2);
  hull.translate(0, -0.45, 0);
  const hg = k.add(hull, 0xffffff, { rough: 0.5, metal: 0.2 });
  facets(hg, (_x, cy, _z, _nx, ny) => (ny > 0.7 ? 0x6e5038 : cy < -0.14 ? 0x9c2f24 : cy < -0.1 ? 0xe8e4dc : 0x26343a));
  const n = k.hi ? 6 : 4;
  for (let i = 0; i < n; i++) k.box(-0.42 + (i * 1.12) / (n - 1), 0.15, 0, 0.13, 0.04, 0.2, 0x3d4b3c, PAINT);
  // accommodation + bridge + funnel
  k.box(-0.68, 0.15, 0, 0.2, 0.22, 0.26, 0xebe8e0, { ao: 0.85, rough: 0.5 });
  k.box(-0.66, 0.37, 0, 0.15, 0.06, 0.34, 0xf2efe8, PAINT);
  k.quad(-0.5835, 0.4, 0, 0.32, 0.025, '+x', GLASSC);
  if (k.hi) for (let i = 0; i < 3; i++) k.quad(-0.68, 0.2 + i * 0.06, 0.1305, 0.16, 0.018, '+z', GLASSC);
  k.cyl(-0.76, 0.37, 0, 0.04, 0.05, 0.14, 0x1d1d1d, 8);
  k.cyl(-0.76, 0.46, 0, 0.0405, 0.0405, 0.03, 0xb3392b, 8);
  // deck cranes
  if (k.hi) for (const cx of [-0.2, 0.25]) {
    k.cyl(cx, 0.15, 0.06, 0.012, 0.016, 0.2, 0xc9a43a, 6, RUSTY);
    k.beam([cx, 0.33, 0.06], [cx + 0.18, 0.24, 0.0], 0.012, 0.012, 0xc9a43a, RUSTY);
  }
  k.box(0.74, 0.15, 0, 0.12, 0.03, 0.14, 0x6e5038);
}

/** Excavator (yellow), local front +x, arm reaching forward/down to (reach, dig). */
function excavator(k: Kit, reach: number, dig: number): void {
  for (const z of [-0.045, 0.045]) k.box(0, 0, z, 0.16, 0.035, 0.03, 0x2a2a2a, MATTE);
  k.box(0, 0.035, 0, 0.13, 0.012, 0.09, 0x3a3a3a);
  k.box(-0.015, 0.047, 0, 0.13, 0.05, 0.1, YELLOW, PAINT);
  k.box(0.02, 0.097, -0.025, 0.05, 0.05, 0.045, YELLOW, PAINT);
  k.quad(0.0455, 0.122, -0.025, 0.038, 0.035, '+x', GLASSC);
  k.box(-0.07, 0.097, 0.02, 0.02, 0.02, 0.06, 0x3a3a3a);
  const sh: V3 = [0.05, 0.08, 0.025], el: V3 = [0.05 + reach * 0.55, 0.2, 0.025], tip: V3 = [0.05 + reach, dig, 0.025];
  k.beam(sh, el, 0.025, 0.03, YELLOW, PAINT);
  k.beam(el, tip, 0.018, 0.022, YELLOW, PAINT);
  k.box(tip[0], tip[1] - 0.02, 0.025, 0.04, 0.035, 0.04, 0x4a4a4a, IRON);
  k.cyl(-0.06, 0.097, -0.03, 0.005, 0.005, 0.04, 0x222222, 4);
  k.stacks.push({ x: -0.06, y: 0.137 + 0.03, z: -0.03, size: 0.3, steam: 0 });
}

function sunflower(k: Kit, x: number, z: number, h: number, ry: number): void {
  k.box(x, G, z, 0.008, h, 0.008, 0x5f8a3a, MATTE);
  if (k.hi) k.rbox(x + 0.012, G + h * 0.55, z, 0.03, 0.004, 0.02, 0x6f9a40, 0, ry, 0.4, MATTE);
  k.add(T(new CylinderGeometry(0.03, 0.03, 0.008, k.seg(8)), x, G + h, z + 0.006, 1.2, ry, 0), WATTLE, MATTE);
  k.add(T(new CylinderGeometry(0.016, 0.016, 0.012, k.seg(6)), x, G + h + 0.002, z + 0.009, 1.2, ry, 0), 0x5a3a20, MATTE);
}

function reedClump(k: Kit, x: number, z: number, seed: number, n: number): void {
  const rnd = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 0.06;
    const h = 0.1 + rnd() * 0.1;
    const g = new ConeGeometryLite(0.009, h);
    T(g, x + Math.cos(a) * r, G + h / 2, z + Math.sin(a) * r, (rnd() - 0.5) * 0.3, 0, (rnd() - 0.5) * 0.3);
    k.add(g, i % 3 === 0 ? 0x9aa84a : i % 3 === 1 ? 0x6f8a3a : 0x7f9a46, MATTE);
    if (k.hi && i % 4 === 0) k.cyl(x + Math.cos(a) * r, G + h * 0.7, z + Math.sin(a) * r, 0.006, 0.006, 0.03, 0x6a4a2a, 4, MATTE);
  }
}
class ConeGeometryLite extends ConeGeometry {
  constructor(r: number, h: number) {
    super(r, h, 3, 1, true);
  }
}

function hillBox(k: Kit, w: number, d: number, nx: number, nz: number, hf: (x: number, z: number) => number, col: (x: number, y: number, z: number, ny: number) => ColorLike | undefined, x = 0, z = 0): void {
  const g = new BoxGeometry(w, 1, d, nx, 6, nz);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i) + x, pz = p.getZ(i) + z;
    const t = p.getY(i) + 0.5;
    p.setY(i, -0.3 + t * (hf(px, pz) + 0.3));
  }
  g.computeVertexNormals();
  T(g, x, 0, z);
  const out = k.add(g, 0xffffff, MATTE);
  facets(out, (cx, cy, cz, _nx, ny) => col(cx, cy, cz, ny));
}

/** height of a lathe profile [r, y] (r descending) at radius r */
function profH(prof: [number, number][], r: number): number {
  for (let i = 0; i < prof.length - 1; i++) {
    const [r0, y0] = prof[i], [r1, y1] = prof[i + 1];
    if (r <= r0 && r >= r1) return y0 + ((r0 - r) / Math.max(1e-6, r0 - r1)) * (y1 - y0);
  }
  return r > prof[0][0] ? 0 : prof[prof.length - 1][1];
}

// ================================================================== models

function mCottage(k: Kit): void {
  pad(k, 1, 1, LAWN);
  // gravel paths + front strip
  k.flat(-0.22, G + 0.002, 0.33, 0.06, 0.2, GRAVEL);
  k.flat(0.22, G + 0.002, 0.36, 0.06, 0.14, GRAVEL);
  k.group(-0.22, G, -0.1, 0, (q) => cottage(q, CREAM, ROOF, 0x3f6b4f, -0.1, true));
  k.group(0.22, G, -0.04, 0, (q) => cottage(q, 0xd9c48f, ROOF_RED, 0x8a3a2a, 0.1, false, 0.28, 0.22));
  // picket fence along the front with gates
  const fz = 0.44;
  for (const [a, b] of [[-0.46, -0.27], [-0.17, 0.17], [0.27, 0.46]] as [number, number][]) {
    k.box((a + b) / 2, G + 0.035, fz, b - a, 0.01, 0.008, WHITE, PAINT);
    if (k.hi) {
      const n = Math.round((b - a) / 0.05);
      for (let i = 0; i <= n; i++) k.box(a + ((b - a) * i) / n, G, fz, 0.011, 0.06, 0.008, WHITE, PAINT);
    } else k.box((a + b) / 2, G, fz, b - a, 0.05, 0.006, 0xe8e4da, PAINT);
  }
  // side fence between yards
  k.beam([0, G + 0.05, 0.44], [0, G + 0.05, -0.44], 0.008, 0.05, 0x9a8a72, MATTE);
  // rainwater tank, dunny, tree, garden
  k.put(buildAmbient('watertank', k.d), -0.41, G, -0.36, 0, 0xffffff, 0.75);
  k.box(0.36, G, -0.4, 0.07, 0.11, 0.07, 0x8a9a7a, WALL);
  k.gable(0.36, G + 0.11, -0.4, 0.07, 0.07, 0.03, ROOF, IRON, Math.PI / 2, 0.01);
  k.tree(0.4, 0.2, 0.85, 3);
  if (k.hi) {
    k.blobAt(-0.42, G + 0.03, 0.3, 0.05, 41, 0x6f8a4a, 0.4, 0.7);
    k.blobAt(-0.05, G + 0.03, 0.34, 0.04, 42, 0xd98a9a, 0.4, 0.7);
  }
}

function mFarm(k: Kit): void {
  pad(k, 2, 2, 0x9caa5e);
  // ploughed field (front-left): furrows of soil + crop rows
  const fx0 = -0.92, fx1 = 0.12, fz0 = 0.05, fz1 = 0.92;
  k.box((fx0 + fx1) / 2, G, (fz0 + fz1) / 2, fx1 - fx0, 0.01, fz1 - fz0, 0x7a5a3c, MATTE);
  const rows = k.hi ? 11 : 7;
  for (let i = 0; i < rows; i++) {
    const z = fz0 + ((i + 0.5) * (fz1 - fz0)) / rows;
    const g = k.add(T(new CylinderGeometry(0.03, 0.03, fx1 - fx0 - 0.04, 3, 1), (fx0 + fx1) / 2, G + 0.005, z, 0, 0, Math.PI / 2), i % 2 ? 0x8a6a46 : 0x7f9f45, MATTE);
    if (i % 2 === 0 && k.hi) facets(g, (cx, cy, cz) => (vnoise(cx * 20, cz * 20 + cy) > 0.6 ? 1.15 : undefined));
  }
  // wheat paddock (front-right) with stripes
  const wf = k.sbox(0.55, G, 0.62, 0.75, 0.03, 0.55, 1, 1, k.hi ? 8 : 3, 0xd9b45a, MATTE);
  facets(wf, (_x, _y, cz) => (Math.floor((cz - 0.345) / (0.55 / 8)) % 2 ? 0.92 : undefined));
  for (let i = 0; i < (k.hi ? 3 : 2); i++) k.put(buildAmbient('haybale', k.d), 0.35 + i * 0.16, G + 0.03, 0.18 + (i % 2) * 0.06, 0.3 * i);
  // homestead with wrap-around verandah
  k.group(-0.48, G, -0.5, 0, (q) => {
    q.box(0, 0, 0, 0.5, 0.03, 0.4, 0x6e5e4e, MATTE);
    const w = q.sbox(0, 0.03, 0, 0.38, 0.2, 0.28, 1, q.hi ? 8 : 1, 1, CREAM, WALL);
    if (q.hi) facets(w, (_x, cy, _z, _nx, ny) => (Math.abs(ny) < 0.5 && Math.floor((cy - 0.03) / 0.025) % 2 ? 0.9 : undefined));
    q.wins('+z', 0.14, 0.13, -0.17, 0.17, 3, 0.05, 0.075, GLASSC, WHITE);
    q.wins('+x', 0.19, 0.13, -0.1, 0.1, 2, 0.05, 0.07, GLASSC, WHITE);
    q.hip(0, 0.23, 0, 0.38, 0.28, 0.16, ROOF_RED, IRON, 0, 0.02);
    const vr = q.add(T(new BoxGeometry(0.52, 0.01, 0.42), 0, 0.205, 0), 0xe8e0cc, IRON);
    facets(vr, (_x, _y, _z, _nx, ny) => (ny < -0.5 ? 0.7 : undefined));
    q.hip(0, 0.2, 0, 0.5, 0.4, 0.05, ROOF_RED, IRON, 0, 0.0);
    for (const [px, pz] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2], [0, 0.2], [-0.125, 0.2], [0.125, 0.2]]) q.box(px, 0.03, pz, 0.014, 0.17, 0.014, WHITE, PAINT);
    q.box(0.13, 0.03, -0.08, 0.05, 0.32, 0.05, 0x9a5038, WALL);
    q.box(0.13, 0.35, -0.08, 0.06, 0.02, 0.06, 0x7a3f2c);
    q.stacks.push({ x: 0.13, y: 0.4, z: -0.08, size: 0.3, steam: 0.6 });
  });
  // red barn + lean-to
  k.group(0.48, G, -0.52, 0, (q) => {
    const w = q.sbox(0, 0, 0, 0.46, 0.26, 0.34, q.hi ? 12 : 1, 1, 1, 0xa8402e, { ao: 0.75, rough: 0.8 });
    if (q.hi) facets(w, (cx, _y, cz, nx) => (Math.floor((Math.abs(nx) > 0.5 ? cz : cx) * 26 + 30) % 2 ? 0.9 : undefined));
    q.quad(0, 0.1, 0.1703, 0.15, 0.2, '+z', 0x6e2a20, PAINT);
    if (q.hi) {
      q.beam([-0.075, 0.0, 0.172], [0.075, 0.2, 0.172], 0.012, 0.004, WHITE);
      q.beam([0.075, 0.0, 0.172], [-0.075, 0.2, 0.172], 0.012, 0.004, WHITE);
      q.box(0, 0.2, 0.172, 0.16, 0.012, 0.004, WHITE);
    }
    q.gable(0, 0.26, 0, 0.34, 0.46, 0.15, ROOF, IRON, Math.PI / 2, 0.035);
    q.rbox(-0.3, 0.17, 0, 0.16, 0.012, 0.36, ROOF, 0, 0, 0.3, IRON);
    q.box(-0.3, 0, -0.165, 0.14, 0.17, 0.012, TIMBER, MATTE);
    for (const pz of [-0.17, 0.17]) q.box(-0.37, 0, pz, 0.014, 0.13, 0.014, TIMBER, MATTE);
  });
  // windmill water pump + tank + trough
  k.group(-0.05, G, -0.1, 0.5, (q) => {
    const H = 0.78;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) q.beam([sx * 0.07, 0, sz * 0.07], [sx * 0.018, H, sz * 0.018], 0.01, 0.01, 0xb8b8b0, IRON);
    if (q.hi) for (const yy of [0.2, 0.42, 0.62]) {
      const r = 0.07 + (0.018 - 0.07) * (yy / H);
      q.box(0, yy, r, r * 2, 0.006, 0.006, 0xb8b8b0, IRON);
      q.box(r, yy, 0, 0.006, 0.006, r * 2, 0xb8b8b0, IRON);
    }
    q.box(0, H, 0, 0.05, 0.03, 0.08, 0x9a9a92, IRON);
    const wheel = q.add(T(new CylinderGeometry(0.15, 0.15, 0.012, q.seg(16)), 0, H + 0.02, 0.06, Math.PI / 2, 0, 0), 0xe8e6de, IRON);
    facets(wheel, (cx, cy) => (Math.floor(((Math.atan2(cy - H - 0.02, cx) + Math.PI) / (Math.PI * 2)) * 16) % 2 ? 0x9aa0a0 : undefined));
    q.cyl(0, H + 0.02, 0.07, 0.03, 0.03, 0.012, 0x6f7575, 8);
    q.rbox(0, H + 0.03, -0.14, 0.006, 0.08, 0.14, 0xd8d4c8, 0, 0, 0, IRON);
  });
  k.put(buildAmbient('watertank', k.d), 0.18, G, -0.05, 0, 0xffffff, 1.1);
  k.box(0.02, G, 0.0, 0.16, 0.03, 0.05, 0x8a9090, IRON);
  k.flat(0.02, G + 0.028, 0.0, 0.14, 0.035, WATER);
  // dirt track house→barn→road
  k.add(ribbon([[-0.48, -0.25], [-0.2, -0.22], [0.25, -0.28], [0.48, -0.32]], 0.07, G + 0.003), DIRT, MATTE);
  k.add(ribbon([[0.2, -0.27], [0.2, 0.02], [0.18, 0.3], [0.17, 0.98]], 0.07, G + 0.003), DIRT, MATTE);
  // fences around the paddocks
  fenceRect(k, fx0 - 0.03, fz0 - 0.03, fx1 + 0.03, fz1 + 0.04, 0x8f7458, 0.06, 0.18);
  fenceRect(k, 0.16, 0.33, 0.95, 0.92, 0x8f7458, 0.06, 0.18);
  // cows + windbreak trees
  k.put(buildAmbient('cow', k.d), 0.55, G, 0.08, 0.6);
  k.put(buildAmbient('cow', k.d), 0.78, G, 0.14, -2.4);
  for (let i = 0; i < (k.hi ? 4 : 2); i++) k.tree(-0.85 + i * 0.22, -0.88, 0.9 + (i % 2) * 0.15, 10 + i);
  k.tree(0.88, -0.1, 1.0, 21);
}

function mCoalmine(k: Kit): void {
  pad(k, 2, 2, 0x6a5e50);
  // hillside with mine portal (back-left)
  const hill = k.add(T(blob(0.7, k.hi ? 2 : 1, 5, 0.25, 0.55), -0.45, -0.12, -0.55, 0, 0, 0, 1.25, 1, 0.75), 0x8a7a50, { rough: 0.9 });
  facets(hill, (cx, cy, cz, _nx, ny) => (ny > 0.6 ? (vnoise(cx * 7, cz * 7) > 0.5 ? 0x6f7f45 : 0x7d8a4a) : cy < 0.12 ? 0x8a6a46 : 0xa58a5a));
  if (k.hi) for (let i = 0; i < 4; i++) k.tree(-1.0 + i * 0.3, -0.8 + (i % 2) * 0.12, 0.8, 30 + i, 0.2 + (i % 2) * 0.03);
  // portal
  k.group(-0.45, G, -0.04, 0, (q) => {
    q.box(0, 0, -0.08, 0.34, 0.26, 0.18, CONC, WALL);
    q.quad(0, 0.09, 0.0105, 0.14, 0.17, '+z', 0x0e0c0b, MATTE);
    for (const sx of [-1, 1]) q.box(sx * 0.08, 0, 0.012, 0.025, 0.2, 0.025, TIMBER, MATTE);
    q.box(0, 0.19, 0.012, 0.2, 0.03, 0.03, TIMBER, MATTE);
    if (q.hi) q.box(0, 0.26, -0.08, 0.36, 0.02, 0.2, CONC_D);
  });
  // tramway from portal to tipple
  k.add(ribbon([[-0.45, 0.0], [-0.45, 0.3], [-0.3, 0.45], [-0.05, 0.48]], 0.1, G + 0.004), 0x4a3f36, MATTE);
  for (const off of [-0.025, 0.025]) k.add(ribbon([[-0.45 + off, 0.0], [-0.45 + off, 0.3], [-0.3 + off * 0.7, 0.45 + off * 0.7], [-0.05, 0.48 + off]], 0.008, G + 0.01), 0x8a8a8a, IRON);
  for (const [sx, sz, ry] of [[-0.45, 0.12, 0], [-0.42, 0.32, 0.5]] as [number, number, number][]) {
    k.group(sx, G + 0.012, sz, ry, (q) => {
      q.box(0, 0.015, 0, 0.07, 0.04, 0.1, 0x5a5048, RUSTY);
      q.blobAt(0, 0.055, 0, 0.035, 9, COAL, 0.4, 0.5);
      for (const z of [-0.035, 0.035]) q.cylX(0, 0.012, z, 0.012, 0.075, 0x2a2826, 6);
    });
  }
  // tipple / screening shed on stilts with chute
  k.group(0.02, G, 0.45, 0, (q) => {
    for (const [x, z] of [[-0.1, -0.08], [0.1, -0.08], [-0.1, 0.08], [0.1, 0.08]]) q.box(x, 0, z, 0.02, 0.22, 0.02, TIMBER, MATTE);
    const w = q.sbox(0, 0.22, 0, 0.26, 0.16, 0.2, q.hi ? 8 : 1, 1, 1, 0x7a6450, WALL);
    if (q.hi) facets(w, (cx, _y, cz, nx) => (Math.floor((Math.abs(nx) > 0.5 ? cz : cx) * 30 + 20) % 2 ? 0.88 : undefined));
    q.gable(0, 0.38, 0, 0.26, 0.2, 0.08, ROOF, IRON);
    q.beam([0.13, 0.26, 0], [0.32, 0.12, 0.02], 0.05, 0.04, RUST2, RUSTY);
  });
  stockpile(k, 0.52, 0.55, 0.85, 0.55, 0.32, 3);
  // headframe
  k.group(0.3, G, -0.2, 0, (q) => {
    const H = 1.25, b = 0.17, t = 0.07;
    const C = 0x7a4a32;
    q.box(0, 0, 0, 0.42, 0.04, 0.42, CONC, MATTE);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) q.beam([sx * b, 0.04, sz * b], [sx * t, H, sz * t], 0.03, 0.03, C, RUSTY);
    const lv = q.hi ? [0.25, 0.5, 0.75, 1.0] : [0.4, 0.8];
    for (const yy of lv) {
      const r = b + (t - b) * (yy / H);
      q.box(0, yy, r, r * 2, 0.018, 0.018, C, RUSTY);
      q.box(0, yy, -r, r * 2, 0.018, 0.018, C, RUSTY);
      q.box(r, yy, 0, 0.018, 0.018, r * 2, C, RUSTY);
      q.box(-r, yy, 0, 0.018, 0.018, r * 2, C, RUSTY);
    }
    if (q.hi) for (let i = 0; i < 3; i++) {
      const y0 = 0.25 * (i + 0.0) + 0.04, y1 = 0.25 * (i + 1) + 0.04;
      const r0 = b + (t - b) * (y0 / H), r1 = b + (t - b) * (y1 / H);
      q.beam([-r0, y0, r0], [r1, y1, r1], 0.01, 0.01, C, RUSTY);
      q.beam([r0, y0, -r0], [-r1, y1, -r1], 0.01, 0.01, C, RUSTY);
    }
    // raking back legs toward the engine house
    q.beam([0.42, 0.04, -0.12], [t, H - 0.05, -t], 0.03, 0.03, C, RUSTY);
    q.beam([0.42, 0.04, 0.12], [t, H - 0.05, t], 0.03, 0.03, C, RUSTY);
    q.box(0, H, 0, 0.2, 0.025, 0.2, 0x5a4a40, RUSTY);
    // sheave wheels
    for (const z of [-0.05, 0.05]) {
      const tor = q.hi ? new TorusGeometry(0.1, 0.012, 4, 14) : new CylinderGeometry(0.1, 0.1, 0.012, 8).rotateX(Math.PI / 2);
      q.add(T(tor, 0, H + 0.1, z), 0x3a3634, IRON);
      if (q.hi) {
        q.box(0, H + 0.1 - 0.1, z, 0.008, 0.2, 0.008, 0x3a3634, IRON);
        q.rbox(0, H + 0.1, z, 0.2, 0.008, 0.008, 0x3a3634, 0, 0, 0, IRON);
      }
    }
    q.box(0, H + 0.02, 0, 0.04, 0.08, 0.16, 0x5a4a40, RUSTY);
    // cables to the winding engine
    for (const z of [-0.05, 0.05]) q.beam([0.08, H + 0.15, z], [0.42, 0.3, -0.38 + z], 0.004, 0.004, 0x222222);
  });
  // winding-engine house + chimney
  k.group(0.72, G, -0.62, 0, (q) => {
    q.box(0, 0, 0, 0.44, 0.03, 0.32, CONC_D, MATTE);
    q.box(0, 0.03, 0, 0.4, 0.28, 0.28, BRICK, WALL);
    q.wins('-x', -0.2, 0.18, -0.1, 0.1, 2, 0.04, 0.12, GLASSC, 0xd8cbb0);
    q.wins('+z', 0.14, 0.18, -0.15, 0.15, 3, 0.045, 0.12, GLASSC, 0xd8cbb0);
    q.gable(0, 0.31, 0, 0.4, 0.28, 0.12, ROOF, IRON, 0, 0.03);
    q.chimney(0.2, 0.0, -0.17, 0.95, 0.06, 0.04, BRICK2, 0.8, 0.15, false, 8);
  });
  // bath house / lamp room
  k.group(-0.75, G, 0.62, 0, (q) => {
    q.box(0, 0, 0, 0.3, 0.16, 0.2, 0xcdb994, WALL);
    q.wins('+z', 0.1, 0.1, -0.12, 0.12, 3, 0.04, 0.05, GLASSC);
    q.gable(0, 0.16, 0, 0.3, 0.2, 0.08, ROOF_RED, IRON);
  });
  if (k.hi) {
    k.put(buildAmbient('crate', 1), -0.18, G, 0.75, 0.3);
    k.put(buildAmbient('crate', 1), -0.1, G, 0.8, 0.9);
    stockpile(k, 0.85, 0.12, 0.25, 0.22, 0.12, 9, 0x6a6058);
  }
}

function mPort(k: Kit): void {
  pad(k, 2, 2, 0x8f877a);
  // concrete quay edge along +x
  k.box(0.94, -0.3, 0, 0.1, 0.36, 1.96, CONC, MATTE);
  if (k.hi) for (let i = 0; i < 9; i++) k.blobAt(1.0, -0.12, -0.9 + i * 0.22, 0.07, 60 + i, 0x7f776a, 0.4, 0.7);
  // coal stockpiles + stacker-reclaimer on its rails
  stockpile(k, -0.42, -0.55, 0.95, 0.4, 0.3, 11);
  stockpile(k, -0.42, 0.25, 0.95, 0.42, 0.32, 12);
  for (const z of [-0.2, -0.13]) k.box(-0.42, G, z, 1.1, 0.012, 0.014, 0x3a3532, IRON);
  k.group(-0.25, G, -0.165, 0, (q) => {
    q.box(0, 0.01, 0, 0.16, 0.12, 0.12, YELLOW, RUSTY);
    q.box(0, 0.13, 0, 0.06, 0.12, 0.06, YELLOW, RUSTY);
    q.beam([0, 0.24, 0], [-0.35, 0.22, -0.32], 0.035, 0.035, YELLOW, RUSTY);
    q.beam([0, 0.24, 0], [0.2, 0.32, 0.05], 0.03, 0.03, 0x4a4442, RUSTY);
    if (q.hi) q.cylX(-0.35, 0.22, -0.32, 0.04, 0.03, 0x3a3532, 8);
  });
  // rail unloading + wagons along the back
  k.box(-0.2, G, -0.92, 1.4, 0.012, 0.1, 0x4a3f36, MATTE);
  for (let i = 0; i < (k.hi ? 3 : 2); i++) k.put(buildAmbient('wagon', k.d), -0.75 + i * 0.38, G + 0.012, -0.92, 0, 0x7a5a48);
  k.group(0.25, G, -0.88, 0, (q) => {
    q.box(0, 0, 0, 0.3, 0.22, 0.2, 0x8a7a64, WALL);
    q.gable(0, 0.22, 0, 0.3, 0.2, 0.07, ROOF, IRON);
  });
  // transfer tower + conveyor gallery out along the jetty
  const cz = -0.165, cy = 0.46;
  k.group(0.35, G, cz, 0, (q) => {
    q.box(0, 0, 0, 0.18, 0.56, 0.18, 0x9a7a52, WALL);
    q.gable(0, 0.56, 0, 0.18, 0.18, 0.06, ROOF, IRON);
  });
  k.beam([-0.25, 0.28, -0.1], [0.27, cy, cz], 0.08, 0.07, 0x7d6a55, RUSTY);
  k.beam([0.44, cy, cz], [1.36, cy, cz], 0.09, 0.075, 0x7d6a55, RUSTY);
  k.beam([0.44, cy + 0.045, cz], [1.36, cy + 0.045, cz], 0.1, 0.02, 0x9a8c78, IRON);
  for (const x of [0.62, 0.86, 1.1]) {
    const yb = x < 0.95 ? G : 0.1;
    for (const s of [-1, 1]) k.beam([x, yb, cz + s * 0.06], [x, cy - 0.04, cz + s * 0.03], 0.02, 0.02, RUST, RUSTY);
  }
  // jetty + T-head berth on piles (piles reach y=-1.6)
  const deckY = 0.1;
  k.box(1.14, deckY - 0.04, cz, 0.4, 0.04, 0.16, 0x7b6a58, MATTE);
  k.box(1.36, deckY - 0.05, 0, 0.16, 0.05, 1.7, 0x8a7a66, MATTE);
  const piles: [number, number][] = [];
  for (const x of [0.98, 1.18]) piles.push([x, cz - 0.06], [x, cz + 0.06]);
  for (let z = -0.8; z <= 0.81; z += k.hi ? 0.2 : 0.4) piles.push([1.31, z], [1.41, z]);
  for (const [x, z] of piles) k.cyl(x, -1.6, z, 0.018, 0.022, 1.6 + deckY - 0.05, 0x4a4038, 6, MATTE);
  if (k.hi) for (let z = -0.8; z <= 0.81; z += 0.4) k.cyl(1.44, deckY, z, 0.012, 0.012, 0.025, 0x2a2a2a, 5);
  // ship loader (travelling gantry with boom over the ship)
  k.group(1.36, deckY, 0.12, 0, (q) => {
    for (const [dx, dz] of [[-0.05, -0.08], [0.05, -0.08], [-0.05, 0.08], [0.05, 0.08]]) q.box(dx, 0, dz, 0.02, 0.5, 0.02, 0xc0823a, RUSTY);
    q.box(0, 0.5, 0, 0.16, 0.14, 0.22, 0xd29544, RUSTY);
    q.box(-0.03, 0.64, 0.05, 0.08, 0.06, 0.06, 0xd8d4c8, PAINT);
    q.beam([0, 0.6, 0], [0.32, 0.55, 0], 0.06, 0.05, 0xd29544, RUSTY);
    q.beam([0.32, 0.55, 0], [0.32, 0.3, 0], 0.035, 0.035, 0x6a5a48, RUSTY);
    q.beam([-0.02, 0.72, 0], [0.28, 0.58, 0], 0.008, 0.008, 0x3a3a3a);
    q.beam([-0.02, 0.72, 0], [-0.02, 0.6, 0], 0.02, 0.02, 0xc0823a, RUSTY);
  });
  // bulk carrier alongside (outside the footprint, sea side)
  k.group(1.63, 0, 0.02, -Math.PI / 2, (q) => bulkCarrier(q));
  // tug
  // admin + light tower
  k.group(0.6, G, 0.62, 0, (q) => {
    q.box(0, 0, 0, 0.36, 0.2, 0.22, 0xcdb994, WALL);
    q.wins('+z', 0.11, 0.12, -0.15, 0.15, 4, 0.045, 0.06, GLASSC);
    q.hip(0, 0.2, 0, 0.36, 0.22, 0.08, ROOF_RED, IRON);
  });
  k.cyl(0.2, G, 0.8, 0.012, 0.016, 0.7, 0x8d9296, 6, IRON);
  k.box(0.2, G + 0.7, 0.8, 0.1, 0.04, 0.03, 0xfff0b8, GLASS);
}

function mOutfall(k: Kit): void {
  pad(k, 1, 1, 0xb8a47c);
  // rocks + scrub
  for (let i = 0; i < (k.hi ? 7 : 3); i++) k.blobAt(0.3 + (i % 3) * 0.08, G - 0.02, -0.38 + i * 0.12, 0.06 + (i % 2) * 0.02, 70 + i, 0x8a7a64, 0.45, 0.6);
  k.tree(-0.38, -0.36, 0.7, 7, G, [0x7f8a4a, 0x6f7a44, 0x8a9050]);
  // pump shed
  k.group(-0.25, G, -0.08, 0, (q) => {
    q.box(0, 0, 0, 0.32, 0.03, 0.26, CONC_D, MATTE);
    q.box(0, 0.03, 0, 0.28, 0.17, 0.22, BRICK_L, WALL);
    q.quad(0, 0.09, 0.1135, 0.07, 0.11, '+z', 0x4f5a54, PAINT);
    q.wins('-x', -0.14, 0.14, -0.05, 0.05, 1, 0.05, 0.04, GLASSC);
    q.gable(0, 0.2, 0, 0.28, 0.22, 0.08, ROOF, IRON);
    q.cyl(0.09, 0.2, -0.06, 0.012, 0.012, 0.16, 0x7d8285, 5, IRON);
    q.cone(0.09, 0.36, -0.06, 0.025, 0.025, 0x7d8285, 6, IRON);
  });
  // the pipe: big concrete pipe sloping out to the headwall and past the edge
  const a: V3 = [-0.1, 0.09, 0.12], b: V3 = [0.62, -0.02, 0.12];
  k.pipe(a, b, 0.07, 0xa8a296, 10, MATTE);
  if (k.hi) for (const t of [0.2, 0.45, 0.7, 0.95]) {
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    k.cylX(x, y, 0.12, 0.078, 0.025, 0x948e82, 10);
  }
  for (const t of [0.35, 0.75]) {
    const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    k.box(x, -0.3, 0.12, 0.06, y + 0.3 - 0.04, 0.12, CONC_D, MATTE);
  }
  // headwall with dark mouth + stain
  k.box(0.66, -0.3, 0.12, 0.08, 0.42, 0.3, CONC, WALL);
  k.cylX(0.705, -0.02, 0.12, 0.062, 0.01, 0x1a1612, 10);
  k.quad(0.7015, -0.12, 0.12, 0.12, 0.12, '+x', 0x5a4a2e, MATTE);
  // brown plume slab on the water (assumed sea surface ~ y -0.06 just past the edge)
  const pl = blobShape(0.32, 0.22, 3, k.hi ? 16 : 9, 0.3);
  const pg = k.shape(pl, 0.88, -0.055, 0.12, 0x8a6a3e, { rough: 0.3 });
  facets(pg, (cx, _y, cz) => (Math.hypot(cx - 0.8, cz - 0.12) < 0.14 ? 0x7a5a32 : vnoise(cx * 12, cz * 12) > 0.6 ? 0x9a7a4a : undefined));
  if (k.hi) {
    k.box(0.1, G, 0.38, 0.012, 0.16, 0.012, 0x6a6a6a);
    k.box(0.1, G + 0.12, 0.385, 0.13, 0.07, 0.006, 0xe8e2d4, PAINT);
    k.quad(0.1, G + 0.155, 0.3885, 0.11, 0.025, '+z', 0xb3392b, PAINT);
  }
}

function mLandfill(k: Kit): void {
  pad(k, 2, 2, 0x7d6a50);
  const rnd = mulberry32(17);
  const specks = [0xe8e4da, 0x5b7fb0, 0xb5493a, 0xd9b84a, 0x4a7a5a, 0xd8d0c0, 0x8a8a90];
  const muds = [0x7a6a52, 0x6b5d48, 0x8a7a5a, 0x5f5444, 0x837055];
  const mprof: [number, number][] = [[0.88, 0], [0.78, 0.13], [0.66, 0.15], [0.56, 0.28], [0.44, 0.3], [0.34, 0.41], [0.0, 0.44]];
  const mx = -0.1, mz = -0.1;
  const mound = new LatheGeometry(mprof.map(([r, y]) => new Vector2(r, y)), k.hi ? 22 : 12);
  const mp = mound.attributes.position;
  for (let i = 0; i < mp.count; i++) {
    const x = mp.getX(i), y = mp.getY(i), z = mp.getZ(i);
    const n = vnoise(x * 4 + 3, z * 4 - 1) - 0.5;
    mp.setXYZ(i, x * (1 + n * 0.16), y > 0.01 ? y + n * 0.04 : y, z * (1 + n * 0.16) * 0.9);
  }
  mound.computeVertexNormals();
  const mg = k.add(T(mound, mx, G - 0.01, mz), 0xffffff, MATTE);
  facets(mg, (_x, _y, _z, _nx, ny) => {
    const r = rnd();
    if (ny < 0.85 && r < 0.05) return specks[Math.floor(rnd() * specks.length)];
    return muds[Math.floor(rnd() * muds.length)];
  });
  // scattered rubbish on the terraces (bags, cartons, scrap)
  const nDeb = k.hi ? 46 : 14;
  for (let i = 0; i < nDeb; i++) {
    const a = rnd() * Math.PI * 2, r = 0.1 + rnd() * 0.72;
    const x = mx + Math.cos(a) * r, z = mz + Math.sin(a) * r * 0.9;
    const y = G + profH(mprof, r) - 0.01;
    const sz = 0.018 + rnd() * 0.026;
    const c = specks[Math.floor(rnd() * specks.length)];
    if (i % 3 === 0) k.blobAt(x, y + sz * 0.4, z, sz * 0.7, 900 + i, c, 0.4, 0.7);
    else k.rbox(x, y + sz * 0.3, z, sz, sz * 0.6, sz * 0.8, c, rnd() * 0.5, rnd() * 3, rnd() * 0.5, MATTE);
  }
  // compactor on the top tier, tip truck on the ramp
  k.group(-0.18, G + 0.43, -0.12, 0.6, (q) => {
    q.box(0, 0.03, 0, 0.14, 0.05, 0.08, YELLOW, PAINT);
    q.box(-0.02, 0.08, 0, 0.05, 0.05, 0.06, YELLOW, PAINT);
    q.quad(0.0055, 0.105, 0, 0.04, 0.03, '+x', GLASSC);
    for (const x of [-0.05, 0.05]) {
      q.cylZ(x, 0.03, 0, 0.03, 0.1, 0x6a6a6a, 8, IRON);
    }
    q.box(0.09, 0.0, 0, 0.02, 0.06, 0.11, 0x4a4a4a, IRON);
  });
  k.put(buildAmbient('truck', k.d), 0.45, 0.16, 0.38, 0.5, 0xd8c8a0);
  k.add(ribbon([[0.95, 0.85], [0.55, 0.6], [0.3, 0.42], [0.05, 0.3]], 0.12, G + 0.005), 0x8a7a64, MATTE);
  // leachate pond
  k.shape(blobShape(0.2, 0.13, 4, k.hi ? 14 : 8), 0.65, G + 0.004, -0.65, 0x6a7a4a, { rough: 0.3 });
  // methane flare stack
  k.group(0.78, G, -0.3, 0, (q) => {
    q.box(0, 0, 0, 0.1, 0.03, 0.1, CONC, MATTE);
    q.cyl(0, 0.03, 0, 0.022, 0.026, 0.52, 0x8a8f92, 8, IRON);
    q.cyl(0, 0.55, 0, 0.034, 0.03, 0.06, 0x5a5a5a, 8, IRON);
    q.cone(0, 0.61, 0, 0.022, 0.05, 0xff9a3a, 6, { rough: 1 });
    q.stacks.push({ x: 0, y: 0.69, z: 0, size: 0.4, steam: 0.25 });
    q.pipe([0, 0.05, 0], [-0.3, 0.05, 0.1], 0.012, 0xd9b84a, 5, IRON);
  });
  // gatehouse + weighbridge
  k.group(-0.72, G, 0.78, 0, (q) => {
    q.box(0, 0, 0, 0.18, 0.13, 0.14, 0xd8cdb4, WALL);
    q.wins('+z', 0.07, 0.08, -0.06, 0.06, 2, 0.04, 0.04, GLASSC);
    q.box(0, 0.13, 0, 0.21, 0.012, 0.17, ROOF_GRN, IRON);
    q.box(0.25, 0, 0.0, 0.26, 0.012, 0.12, CONC_D, IRON);
  });
  fenceRect(k, -0.96, -0.96, 0.96, 0.96, 0x9a9a92, 0.09, 0.2, true);
  if (k.hi) for (let i = 0; i < 4; i++) {
    const x = -0.4 + i * 0.18, z = -0.3 + (i % 2) * 0.2, y = 0.62 + (i % 3) * 0.08;
    k.rbox(x, y, z, 0.05, 0.006, 0.012, 0xf4f2ea, 0, i, 0.2, MATTE);
  }
}

function mFactory(k: Kit): void {
  pad(k, 2, 2, 0x9a9184);
  // main hall with sawtooth roof
  k.group(-0.2, G, -0.22, 0, (q) => {
    const W = 1.3, D = 1.05, H = 0.38;
    const w = q.sbox(0, 0, 0, W, H, D, q.hi ? 13 : 1, 1, 1, BRICK, WALL);
    if (q.hi) facets(w, (cx, _y, cz, nx) => (Math.floor((Math.abs(nx) > 0.5 ? cz : cx) * 10 + 20) % 2 ? undefined : 0.9));
    q.wins('+z', D / 2, 0.22, -W / 2, W / 2, q.hi ? 8 : 4, 0.08, 0.13, 0x3a4a54, 0x8a3a28);
    q.wins('-x', -W / 2, 0.22, -D / 2, D / 2, q.hi ? 6 : 3, 0.08, 0.13, 0x3a4a54, 0x8a3a28);
    q.box(0, H, 0, W + 0.02, 0.025, D + 0.02, 0x7d4330);
    sawtooth(q, 0, H + 0.025, 0, W, D, 5, 0.13, ROOF);
    // roof vents
    if (q.hi) for (const x of [-0.4, 0.0, 0.4]) q.cyl(x, H + 0.08, -0.1, 0.025, 0.025, 0.08, 0x8d949a, 6, IRON);
  });
  // two-storey office with art-deco parapet across the front
  k.group(-0.3, G, 0.6, 0, (q) => {
    q.box(0, 0, 0, 1.0, 0.36, 0.26, 0xc98a5a, WALL);
    q.wins('+z', 0.13, 0.1, -0.48, 0.48, q.hi ? 8 : 5, 0.07, 0.08, GLASSC, 0xe8dcc0);
    q.wins('+z', 0.13, 0.25, -0.48, 0.48, q.hi ? 8 : 5, 0.07, 0.08, GLASSC, 0xe8dcc0);
    q.box(0, 0.36, 0, 1.02, 0.05, 0.28, 0xe8dcc0, PAINT);
    q.box(0, 0.41, 0.1, 0.36, 0.06, 0.04, 0xe8dcc0, PAINT);
    q.quad(0, 0.44, 0.1205, 0.3, 0.025, '+z', 0x3f6b4f, PAINT);
    q.quad(0, 0.06, 0.1305, 0.1, 0.11, '+z', 0x4a3a2e, PAINT);
  });
  // tall brick chimney
  k.chimney(0.72, G, -0.62, 1.7, 0.1, 0.06, BRICK2, 1.0, 0.1, false, 10);
  // water tower
  k.group(0.72, G, 0.15, 0, (q) => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) q.beam([sx * 0.1, 0, sz * 0.1], [sx * 0.07, 0.55, sz * 0.07], 0.018, 0.018, STEEL, IRON);
    if (q.hi) {
      q.beam([-0.09, 0.1, 0.09], [0.075, 0.4, 0.075], 0.008, 0.008, STEEL, IRON);
      q.beam([0.09, 0.1, 0.09], [-0.075, 0.4, 0.075], 0.008, 0.008, STEEL, IRON);
    }
    const t = q.cyl(0, 0.55, 0, 0.13, 0.13, 0.18, 0x7f8a8c, 12, IRON, q.hi ? 4 : 1);
    facets(t, (_x, cy, _z, _nx, ny) => (Math.abs(ny) < 0.5 && Math.floor((cy - 0.55) / 0.045) % 2 ? 0.9 : undefined));
    q.cone(0, 0.73, 0, 0.14, 0.07, 0x6f7a7c, 12, IRON);
  });
  // loading dock on the east side + truck
  k.box(0.53, G, -0.3, 0.12, 0.06, 0.6, CONC, MATTE);
  for (const z of [-0.45, -0.15]) k.quad(0.4535, G + 0.15, z, 0.16, 0.18, '+x', 0x8d949a, IRON);
  k.box(0.53, G + 0.27, -0.3, 0.14, 0.012, 0.64, ROOF, IRON);
  k.put(buildAmbient('truck', k.d), 0.82, G, -0.3, Math.PI, 0xb3392b);
  if (k.hi) {
    k.put(buildAmbient('crate', 1), 0.52, G + 0.06, -0.55, 0.2);
    k.put(buildAmbient('crate', 1), 0.53, G + 0.06, 0.05, 0.8);
  }
  k.tree(-0.85, 0.88, 0.8, 4);
  k.tree(0.85, 0.85, 0.75, 5);
}

function mSteelworks(k: Kit): void {
  pad(k, 3, 3, 0x8a8378);
  const hi = k.hi;
  // rail line across the front of the furnace
  k.box(0.0, G, 0.3, 2.9, 0.01, 0.1, 0x4a3f36, MATTE);
  for (const z of [0.28, 0.32]) k.box(0, G + 0.01, z, 2.9, 0.008, 0.008, 0x8a8a8a, IRON);
  // torpedo ladle car
  k.group(-0.75, G + 0.02, 0.3, 0, (q) => {
    q.add(T(new SphereGeometry(0.06, q.seg(10), 6), 0, 0.07, 0, 0, 0, 0, 2.6, 1, 1), 0x4d4846, RUSTY);
    q.box(0, 0.0, 0, 0.3, 0.03, 0.08, 0x2e2b29, RUSTY);
    q.cyl(0, 0.12, 0, 0.02, 0.025, 0.02, 0xff8a2a, 6, { rough: 1 });
  });
  // ---- blast furnace
  const fx = -0.25, fz = -0.4;
  k.group(fx, G, fz, 0, (q) => {
    q.box(0, 0, 0, 0.75, 0.08, 0.7, CONC_D, MATTE);
    q.cyl(0, 0.08, 0, 0.3, 0.33, 0.26, 0x4d4846, 14, RUSTY);
    const shaft = q.lathe(0, 0.34, 0, [[0.32, 0], [0.34, 0.2], [0.28, 0.85], [0.18, 1.05]], 0x6e4a36, 14, RUSTY);
    facets(shaft, (cx, cy, cz) => (vnoise(cx * 14 + cy * 4, cz * 14) > 0.62 ? 0.72 : undefined));
    if (hi) q.add(T(new TorusGeometry(0.36, 0.035, 5, 16), 0, 0.42, 0, Math.PI / 2, 0, 0), 0x5a3e30, RUSTY);
    q.box(0, 1.39, 0, 0.3, 0.2, 0.3, 0x7a5a3f, RUSTY);
    q.box(0, 1.59, 0, 0.17, 0.16, 0.17, 0x6a5040, RUSTY);
    q.gable(0, 1.75, 0, 0.19, 0.19, 0.06, 0x5a4a40, RUSTY);
    // uptakes
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) q.pipe([sx * 0.1, 1.35, sz * 0.1], [sx * 0.07, 1.9, sz * 0.07], 0.03, 0x6a5040, 6, RUSTY);
    q.box(0, 1.9, 0, 0.2, 0.05, 0.2, 0x5a4a40, RUSTY);
    // truss frame + platforms
    for (const [dx, dz] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) q.box(dx, 0.08, dz, 0.045, 1.55, 0.045, RUST, RUSTY);
    for (const hh of hi ? [0.55, 1.05, 1.55] : [0.8, 1.55]) {
      q.box(0, hh, 0, 0.9, 0.025, 0.9, 0x4a4442, RUSTY);
      if (hi) {
        q.beam([-0.42, hh - 0.45, 0.42], [0.42, hh, 0.42], 0.018, 0.018, RUST, RUSTY);
        q.beam([0.42, hh - 0.45, -0.42], [0.42, hh, 0.42], 0.018, 0.018, RUST, RUSTY);
      }
    }
    // cast house in front with glowing tap hole
    q.box(0.05, 0.08, 0.5, 0.62, 0.3, 0.32, BRICK2, WALL);
    q.gable(0.05, 0.38, 0.5, 0.62, 0.32, 0.1, ROOF, IRON);
    q.quad(0.05, 0.18, 0.6635, 0.16, 0.16, '+z', 0xff9a3a, { rough: 1 });
    if (hi) q.quad(0.05, 0.14, 0.665, 0.1, 0.06, '+z', 0xffe08a, { rough: 1 });
  });
  // hot-blast stoves
  for (let i = 0; i < 3; i++) {
    const sx = -1.05, sz = -0.95 + i * 0.36;
    k.cyl(sx, G, sz, 0.15, 0.16, 1.05, 0x5c5652, 12, RUSTY);
    k.sph(sx, G + 1.05, sz, 0.15, 0x4f4a47, 12, 1, 0.8, 1, RUSTY, true);
    if (hi) k.cyl(sx, G + 0.25, sz, 0.155, 0.165, 0.03, 0x3a3634, 12, RUSTY);
    k.pipe([sx + 0.1, 0.62, sz], [fx - 0.3, 0.5, fz + (sz - fz) * 0.4], 0.035, 0x6a5040, 6, RUSTY);
  }
  k.chimney(-1.32, G, -0.6, 1.9, 0.07, 0.05, 0x8a7d70, 1.2, 0.1, true, 10);
  // downcomer + dust catcher
  k.pipe([fx + 0.1, 1.92, fz], [0.25, 1.0, -0.95], 0.05, 0x6a5040, 6, RUSTY);
  k.cyl(0.25, G, -0.95, 0.13, 0.13, 0.75, 0x6b6560, 12, RUSTY);
  k.add(T(new CylinderGeometry(0.13, 0.04, 0.22, k.seg(12)), 0.25, G + 0.86, -0.95), 0x6b6560, RUSTY);
  for (const [dx, dz] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) k.box(0.25 + dx, G, -0.95 + dz, 0.025, 0.2, 0.025, RUST, RUSTY);
  // skip incline from the stockhouse to the furnace top
  k.group(0.55, G, 0.12, 0, (q) => {
    q.box(0, 0, 0, 0.42, 0.18, 0.22, 0x8a7a64, WALL);
    q.gable(0, 0.18, 0, 0.42, 0.22, 0.07, ROOF, IRON);
  });
  k.beam([0.4, 0.2, 0.1], [fx + 0.12, 1.85, fz + 0.05], 0.09, 0.08, 0x7c5a3a, RUSTY);
  for (const t of [0.25, 0.55]) {
    const px = 0.4 + (fx + 0.12 - 0.4) * t, pz = 0.1 + (fz + 0.05 - 0.1) * t, py = 0.2 + (1.85 - 0.2) * t;
    k.box(px, G, pz, 0.035, py - G - 0.04, 0.035, RUST, RUSTY);
  }
  // coke ovens battery with door stripes + larry car
  k.group(0.82, G, -0.5, 0, (q) => {
    q.box(0, 0, 0, 1.0, 0.05, 0.36, CONC_D, MATTE);
    const b = q.sbox(0, 0.05, 0, 0.92, 0.28, 0.28, q.hi ? 18 : 6, 1, 1, BRICK2, WALL);
    facets(b, (cx, _y, _z, _nx, _ny, nz) => (Math.abs(nz) > 0.5 && Math.floor((cx + 0.46) / (0.92 / (q.hi ? 18 : 6))) % 2 ? 0x3a3432 : undefined));
    q.box(0, 0.33, 0, 0.96, 0.03, 0.3, 0x5a5048);
    q.box(0.1, 0.36, 0, 0.14, 0.08, 0.2, 0x8a7a52, RUSTY);
    for (const x of [-0.3, 0.0, 0.3]) q.cyl(x, 0.36, -0.06, 0.02, 0.02, 0.06, 0x4a4442, 6);
  });
  // quench tower (white steam)
  k.group(1.3, G, -0.08, 0, (q) => {
    q.box(0, 0, 0, 0.2, 0.55, 0.2, 0xa59d90, WALL);
    q.box(0, 0.55, 0, 0.14, 0.18, 0.14, 0x8f877a, WALL);
    q.stacks.push({ x: 0, y: 0.76, z: 0, size: 1.2, steam: 1 });
  });
  // stacks along the back (banded red/white)
  k.chimney(0.5, G, -1.22, 2.5, 0.1, 0.065, 0x8a7d70, 1.6, 0.1, true, 10);
  k.chimney(0.85, G, -1.25, 2.85, 0.11, 0.07, 0x8a7d70, 2.0, 0.05, true, 10);
  k.chimney(1.2, G, -1.2, 2.3, 0.09, 0.06, BRICK2, 1.4, 0.15, false, 10);
  // rolling mill shed (sawtooth) along the front
  k.group(-0.4, G, 0.92, 0, (q) => {
    const W = 1.95, D = 0.82, H = 0.36;
    const w = q.sbox(0, 0, 0, W, H, D, q.hi ? 16 : 1, 1, 1, 0x8a5a44, WALL);
    if (q.hi) facets(w, (cx, _y, cz, nx) => (Math.floor((Math.abs(nx) > 0.5 ? cz : cx) * 8 + 30) % 2 ? 0.88 : undefined));
    q.wins('+z', D / 2, 0.24, -W / 2, W / 2, q.hi ? 10 : 5, 0.1, 0.1, 0x3a4a54);
    q.quad(0.6, 0.11, D / 2 + 0.004, 0.18, 0.2, '+z', 0x5a5f62, IRON);
    q.quad(-0.98, 0.11, 0, 0.18, 0.2, '-x', 0xffa04a, { rough: 1 });
    q.box(0, H, 0, W + 0.02, 0.02, D + 0.02, 0x5a4a40);
    sawtooth(q, 0, H + 0.02, 0, W, D, 4, 0.14, 0x7d8388);
  });
  // gas holder
  k.group(1.05, G, 0.85, 0, (q) => {
    q.cyl(0, 0, 0, 0.3, 0.3, 0.62, 0x6f7a6c, 18, { rough: 0.6, metal: 0.4 });
    q.add(T(new SphereGeometry(0.3, q.seg(18), 4, 0, Math.PI * 2, 0, 0.6), 0, 0.62 - 0.3 * Math.cos(0.6), 0), 0x66705f, { rough: 0.6, metal: 0.4 });
    const n = q.hi ? 10 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      q.box(Math.cos(a) * 0.315, 0, Math.sin(a) * 0.315, 0.03, 0.72, 0.03, 0x4f574d, RUSTY);
    }
    q.add(T(new TorusGeometry(0.315, 0.012, 3, q.seg(18)), 0, 0.72, 0, Math.PI / 2, 0, 0), 0x4f574d, RUSTY);
    if (q.hi) q.add(T(new TorusGeometry(0.315, 0.01, 3, 18), 0, 0.36, 0, Math.PI / 2, 0, 0), 0x4f574d, RUSTY);
  });
  // gas main on a pipe rack: furnace → gas holder
  const py = 0.62;
  k.pipe([-0.0, py, 0.12], [1.05, py, 0.12], 0.04, 0x8c8d84, 6, IRON);
  k.pipe([1.05, py, 0.12], [1.05, py, 0.55], 0.04, 0x8c8d84, 6, IRON);
  k.pipe([-0.05, py + 0.08, 0.14], [0.9, py + 0.08, 0.14], 0.025, 0x9a6a3c, 6, IRON);
  for (const x of [0.2, 0.75]) k.box(x, G, 0.13, 0.03, py - G - 0.03, 0.18, STEEL, RUSTY);
  // ore + coal piles
  stockpile(k, 1.15, 0.28, 0.5, 0.3, 0.2, 21, 0x9a4a30);
}

function mCoalpower(k: Kit): void {
  pad(k, 2, 2, 0x8f8a80);
  // boiler house (tall) + turbine hall (front)
  k.group(-0.28, G, -0.4, 0, (q) => {
    const W = 0.78, D = 0.52, H = 0.95;
    const w = q.sbox(0, 0, 0, W, H, D, q.hi ? 9 : 1, 1, 1, 0xa39886, WALL);
    if (q.hi) facets(w, (cx, _y, _cz, _nx, _ny, nz) => (Math.abs(nz) > 0.5 && Math.floor((cx + W / 2) / (W / 9)) % 2 ? 0.9 : undefined));
    for (const x of [-0.27, -0.09, 0.09, 0.27]) q.quad(x, 0.55, D / 2 + 0.003, 0.05, 0.7, '+z', 0x3a4a54, GLASS);
    q.wins('-x', -W / 2, 0.55, -0.2, 0.2, 2, 0.05, 0.7, 0x3a4a54);
    q.box(0, H, 0, W + 0.03, 0.04, D + 0.03, 0x7f776a);
    if (q.hi) for (const x of [-0.2, 0.2]) q.box(x, H + 0.04, 0, 0.12, 0.08, 0.3, 0x8f877a);
  });
  k.group(-0.28, G, 0.1, 0, (q) => {
    const W = 1.0, D = 0.42, H = 0.48;
    q.box(0, 0, 0, W, H, D, 0xb8ac96, WALL);
    q.wins('+z', D / 2, 0.3, -W / 2, W / 2, q.hi ? 8 : 4, 0.07, 0.2, 0x3a4a54);
    q.wins('-x', -W / 2, 0.3, -D / 2, D / 2, 2, 0.07, 0.2, 0x3a4a54);
    q.gable(0, H, 0, W, D, 0.08, ROOF, IRON);
    q.box(0.0, 0, D / 2 + 0.003, 1.0, 0.04, 0.01, 0x6a6258);
  });
  // two tall concrete stacks
  k.chimney(0.42, G, -0.72, 2.45, 0.11, 0.075, 0x9a948a, 1.9, 0.1, false, 12);
  k.chimney(0.75, G, -0.62, 2.3, 0.105, 0.07, 0x9a948a, 1.7, 0.1, false, 12);
  // flue ducts to the stacks
  k.box(0.27, G + 0.25, -0.67, 0.42, 0.14, 0.12, 0x6a6258, RUSTY);
  // hyperboloid cooling tower
  k.group(0.55, G, 0.32, 0, (q) => {
    const prof: [number, number][] = [[0.36, 0], [0.31, 0.25], [0.255, 0.55], [0.25, 0.7], [0.27, 0.92]];
    const t = q.lathe(0, 0, 0, prof, 0xd8d2c4, 18, { rough: 0.9, ao: 0.75 });
    facets(t, (_x, cy) => (cy > 0.86 ? 0xa8a296 : undefined));
    q.cyl(0, 0.85, 0, 0.262, 0.262, 0.04, 0x3a3836, 18, MATTE);
    if (q.hi) for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      q.beam([Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36], [Math.cos(a + 0.2) * 0.34, 0.07, Math.sin(a + 0.2) * 0.34], 0.015, 0.015, 0xb8b2a4);
    }
    q.stacks.push({ x: 0, y: 0.95, z: 0, size: 1.4, steam: 1 });
  });
  // cooling pond
  k.box(-0.52, G, 0.68, 0.8, 0.03, 0.46, CONC, MATTE);
  k.flat(-0.52, G + 0.031, 0.68, 0.74, 0.4, WATER);
  if (k.hi) k.pipe([-0.52, G + 0.02, 0.45], [-0.52, G + 0.02, 0.31], 0.025, 0x7d8285, 6, IRON);
  // coal bunker conveyor from a small stockpile
  stockpile(k, -0.82, -0.85, 0.3, 0.25, 0.14, 31);
  k.beam([-0.82, 0.1, -0.78], [-0.55, 0.9, -0.5], 0.06, 0.05, 0x7d6a55, RUSTY);
  // switchyard
  k.box(0.6, G, 0.86, 0.7, 0.008, 0.2, GRAVEL, MATTE);
  for (const x of [0.4, 0.6, 0.8]) {
    k.box(x, G, 0.85, 0.07, 0.07, 0.06, 0x5a6a5c, IRON);
    if (k.hi) for (const dx of [-0.02, 0.02]) k.cyl(x + dx, G + 0.07, 0.85, 0.006, 0.006, 0.05, 0xd8d4c8, 4);
  }
  pylon(k, 0.92, -0.05, 0.85);
}

function mSuburb(k: Kit): void {
  suburbScene(k, false);
}

function mCarpark(k: Kit): void {
  pad(k, 1, 3, 0x7d8a5a, 0.0);
  const zA = -1.5, zB = 1.5;
  // highway (two carriageways, 2 lanes each) + grassy median with guard rail
  for (const [x0, x1] of [[-0.48, -0.26], [-0.2, 0.02]] as [number, number][]) {
    k.box((x0 + x1) / 2, G - 0.012, 0, x1 - x0, 0.016, zB - zA, ASPHALT, MATTE);
    for (const x of [x0 + 0.01, x1 - 0.01]) k.flat(x, G + 0.0045, 0, 0.006, zB - zA - 0.02, 0xece6d6, MATTE);
    const xm = (x0 + x1) / 2;
    const n = k.hi ? 14 : 8;
    for (let i = 0; i < n; i++) k.flat(xm, G + 0.0045, zA + ((i + 0.5) * (zB - zA)) / n, 0.006, 0.09, 0xf2ecdc, MATTE);
  }
  k.box(-0.23, G - 0.01, 0, 0.06, 0.02, 3, 0x6f8a4a, MATTE);
  k.box(-0.23, G + 0.02, 0, 0.008, 0.016, 3, 0xb8bcbc, IRON);
  if (k.hi) for (let i = 0; i < 10; i++) k.box(-0.23, G, -1.4 + i * 0.31, 0.01, 0.03, 0.01, 0x8a8e8e, IRON);
  // traffic
  const traffic: [number, number, number, number][] = [
    [-0.425, -1.05, -Math.PI / 2, 0xb3392b], [-0.315, 0.2, -Math.PI / 2, 0xe8e4da], [-0.425, 1.1, -Math.PI / 2, 0x3d6fa5],
    [-0.145, -0.5, Math.PI / 2, 0xd9a43a], [-0.035, 0.75, Math.PI / 2, 0x4a7a5a],
  ];
  for (const [x, z, ry, c] of traffic) k.put(buildAmbient('car', k.d), x, G + 0.004, z, ry, c, 0.85);
  k.put(buildAmbient('truck', k.d), -0.035, G + 0.004, -1.0, Math.PI / 2, 0xe8e4da, 0.85);
  // car park
  k.box(0.26, G - 0.012, -0.2, 0.42, 0.016, 2.3, 0x67686c, MATTE);
  for (let i = 0; i <= 8; i++) {
    const z = -1.2 + i * 0.25;
    k.flat(0.17, G + 0.0045, z, 0.13, 0.006, 0xf2ecdc, MATTE);
    k.flat(0.37, G + 0.0045, z, 0.13, 0.006, 0xf2ecdc, MATTE);
  }
  const cols = [0xb3392b, 0x3d6fa5, 0xe8e4da, 0x4a7a5a, 0xd9a43a, 0x5a5a5a, 0x8a3a6a];
  const bays = k.hi ? [0, 1, 3, 4, 6, 7, 2, 5] : [0, 3, 6];
  bays.forEach((b, i) => {
    const side = i % 2 ? 0.37 : 0.17;
    k.put(buildAmbient('car', k.d), side, G + 0.004, -1.075 + b * 0.25, side > 0.3 ? Math.PI : 0, cols[i % cols.length], 0.85);
  });
  // drive-in takeaway shop + sign
  k.group(0.27, G, 1.15, 0, (q) => {
    q.box(0, 0, 0, 0.34, 0.15, 0.28, 0xeee4cf, WALL);
    q.wins('-x', -0.17, 0.08, -0.1, 0.1, 2, 0.08, 0.07, GLASSC);
    const r = q.sbox(0, 0.15, 0, 0.4, 0.025, 0.34, q.hi ? 8 : 1, 1, 1, 0xd9534f, PAINT);
    if (q.hi) facets(r, (cx, _y, _z, _nx, ny) => (Math.abs(ny) < 0.5 && Math.floor((cx + 0.2) / 0.05) % 2 ? WHITE : undefined));
    q.cyl(-0.12, 0.175, 0.1, 0.008, 0.008, 0.2, 0x8a8e8e, 5);
    q.box(-0.12, 0.33, 0.1, 0.12, 0.08, 0.02, 0xe3b02a, PAINT);
  });
  // billboard on posts
  k.group(0.3, G, -1.32, -0.5, (q) => {
    for (const x of [-0.12, 0.12]) q.box(x, 0, 0, 0.02, 0.36, 0.02, 0x5a5a5a, IRON);
    q.box(0, 0.36, -0.01, 0.4, 0.2, 0.02, 0x3a3a3a);
    q.quad(0, 0.46, 0.0005, 0.37, 0.17, '+z', 0xf2e6c8, PAINT);
    q.quad(-0.08, 0.46, 0.0015, 0.16, 0.14, '+z', 0xd9534f, PAINT);
    q.quad(0.1, 0.49, 0.0015, 0.13, 0.03, '+z', 0x2a3a5a, PAINT);
    q.quad(0.1, 0.43, 0.0015, 0.1, 0.02, '+z', 0x2a3a5a, PAINT);
  });
  for (const z of [-0.6, 0.4]) k.put(buildAmbient('streetlight', k.d), 0.03, G, z, 0);
  k.tree(0.42, 0.62, 0.6, 77);
}

function mGaspower(k: Kit): void {
  pad(k, 2, 2, 0xb3ad9f);
  const CLAD = 0xd6dcdc;
  // turbine hall (ribbed cladding, low barrel roof)
  k.group(-0.22, G, -0.12, 0, (q) => {
    const W = 1.05, D = 0.56, H = 0.42;
    const w = q.sbox(0, 0, 0, W, H, D, q.hi ? 26 : 1, 1, q.hi ? 14 : 1, CLAD, WALL);
    if (q.hi) facets(w, (cx, _y, cz, nx) => (Math.floor((Math.abs(nx) > 0.5 ? cz : cx) * 25 + 40) % 2 ? 0.93 : undefined));
    q.box(0, 0.3, D / 2 + 0.002, W, 0.04, 0.004, TEAL, PAINT);
    q.quad(-0.3, 0.13, D / 2 + 0.004, 0.2, 0.24, '+z', 0xa8b0b2, IRON);
    q.wins('+z', D / 2, 0.38, 0.0, 0.5, 4, 0.08, 0.03, 0x3a5a6a);
    const roof = new CylinderGeometry(0.5, 0.5, W + 0.04, q.seg(14), 1, false, -0.55, 1.1);
    const rg = q.add(T(roof, 0, H - 0.5 * Math.cos(0.55), 0, 0, 0, Math.PI / 2, 1, 1, 0.58 / (2 * 0.5 * Math.sin(0.55))), 0xb9c2c4, IRON);
    facets(rg, (_x, _y, _z, _nx, ny) => (ny < 0 ? 0.6 : undefined));
  });
  // air intake filter house (louvres)
  k.group(-0.98 + 0.16, G, -0.6, 0, (q) => {
    const f = q.sbox(0, 0.3, 0, 0.26, 0.28, 0.3, 1, q.hi ? 7 : 1, 1, 0xb8c0c2, IRON);
    if (q.hi) facets(f, (_x, cy, _z, _nx, ny) => (Math.abs(ny) < 0.5 && Math.floor((cy - 0.3) / 0.04) % 2 ? 0.75 : undefined));
    for (const [x, z] of [[-0.1, -0.12], [0.1, -0.12], [-0.1, 0.12], [0.1, 0.12]]) q.box(x, 0, z, 0.02, 0.3, 0.02, STEEL, IRON);
    q.beam([0.13, 0.4, 0], [0.4, 0.3, 0.15], 0.1, 0.1, 0xa8b0b2, IRON);
  });
  // HRSG + slim steel stack
  k.group(0.55, G, -0.45, 0, (q) => {
    q.box(0, 0, 0, 0.32, 0.6, 0.5, 0xc4ccce, WALL);
    q.box(0, 0.6, 0, 0.34, 0.03, 0.52, 0x9aa4a6, IRON);
    q.box(0, 0.25, 0.25, 0.34, 0.03, 0.01, TEAL, PAINT);
    q.beam([-0.3, 0.25, 0.1], [-0.16, 0.3, 0.1], 0.15, 0.15, 0xb0b8ba, IRON);
    q.chimney(0.0, 0.63, -0.12, 0.72, 0.075, 0.065, 0xc9cfd0, 0.8, 0.7, false, 10);
    if (q.hi) q.box(-0.17, 0.63, -0.15, 0.03, 0.4, 0.03, 0x9aa4a6, IRON);
  });
  // gas pipeline (yellow) on sleepers from the edge + metering skid
  const gy = G + 0.06;
  k.pipe([-0.98, gy, 0.42], [0.1, gy, 0.42], 0.025, 0xe0b830, 6, PAINT);
  k.pipe([0.1, gy, 0.42], [0.1, gy, 0.18], 0.025, 0xe0b830, 6, PAINT);
  for (let x = -0.9; x < 0.1; x += k.hi ? 0.18 : 0.36) k.box(x, G, 0.42, 0.03, 0.04, 0.08, CONC_D, MATTE);
  k.box(-0.55, G, 0.55, 0.24, 0.1, 0.14, 0xe0b830, PAINT);
  // storage tanks
  for (const [x, z] of [[0.55, 0.45], [0.82, 0.68]]) {
    k.cyl(x, G, z, 0.14, 0.14, 0.24, WHITE, 14, PAINT);
    k.sph(x, G + 0.24, z, 0.14, 0xe8e6de, 14, 1, 0.35, 1, PAINT, true);
    if (k.hi) k.cyl(x, G + 0.14, z, 0.142, 0.142, 0.02, TEAL, 14, PAINT);
  }
  // transformer + fence
  k.box(0.6, G, 0.05, 0.14, 0.12, 0.1, 0x6a7a6c, IRON);
  if (k.hi) for (const dx of [-0.04, 0, 0.04]) k.cyl(0.6 + dx, G + 0.12, 0.05, 0.007, 0.007, 0.06, 0xd8d4c8, 4);
  fenceRect(k, -0.96, -0.96, 0.96, 0.96, 0x9a9e9a, 0.08, 0.2, true);
  k.tree(-0.82, 0.82, 0.7, 88, G, [0x7b956a, 0x93a580]);
}

function mRooftopsolar(k: Kit): void {
  pad(k, 1, 1, LAWN);
  k.group(-0.05, G, -0.06, 0, (q) => {
    const W = 0.56, D = 0.38, H = 0.2;
    q.box(0, 0, 0, W + 0.02, 0.02, D + 0.02, CONC_L, MATTE);
    q.box(-0.06, 0.02, 0, W - 0.12, H, D, 0xf2efe8, WALL);
    const tc = q.sbox(W / 2 - 0.06, 0.02, 0, 0.12, H, D, 1, 1, q.hi ? 10 : 1, 0xb0784e, WALL);
    if (q.hi) facets(tc, (_x, _y, cz, nx) => (Math.abs(nx) > 0.5 && Math.floor((cz + D / 2) / (D / 10)) % 2 ? 0.88 : undefined));
    q.quad(-0.06, 0.1, D / 2 + 0.003, 0.26, 0.12, '+z', 0x3a5a6a, GLASS);
    q.quad(W / 2 - 0.06, 0.08, D / 2 + 0.003, 0.05, 0.11, '+z', 0x3a3a3a, PAINT);
    q.wins('-x', -W / 2 + 0.06, 0.12, -0.08, 0.08, 1, 0.08, 0.07, 0x3a5a6a);
    // skillion roof rising to the back, panels on it
    const rx = 0.24;
    q.rbox(0, H + 0.06, 0.0, W + 0.08, 0.02, D + 0.1, 0xb9c0c2, rx, 0, 0, IRON);
    const pv = q.add(T(new BoxGeometry(W - 0.06, 0.012, D - 0.04, q.hi ? 6 : 2, 1, q.hi ? 3 : 1), 0, H + 0.08, 0.0, rx, 0, 0), PV, { rough: 0.2, metal: 0.4 });
    facets(pv, (cx, _y, cz, _nx, ny) => (ny > 0.5 ? ((Math.floor((cx + (W - 0.06) / 2) / ((W - 0.06) / 6)) + Math.floor((cz / Math.cos(rx) + (D - 0.04) / 2) / ((D - 0.04) / 3))) % 2 ? PV2 : undefined) : 0x6a7a8a));
    q.rbox(0, H + 0.08 + Math.sin(rx) * (D / 2 - 0.02) + 0.007, -(D / 2 - 0.025) * Math.cos(rx), W - 0.06, 0.006, 0.012, 0xc8dcec, rx, 0, 0, GLASS);
    // wall battery
    q.box(-W / 2 + 0.035, 0.05, -0.08, 0.012, 0.08, 0.06, WHITE, PAINT);
    q.box(-W / 2 + 0.039, 0.07, -0.08, 0.008, 0.01, 0.04, TEAL, PAINT);
  });
  // carport with EV
  k.group(0.36, G, 0.2, 0, (q) => {
    for (const [x, z] of [[-0.09, -0.12], [0.09, -0.12], [-0.09, 0.12], [0.09, 0.12]]) q.box(x, 0, z, 0.012, 0.15, 0.012, 0x6a6a6a, IRON);
    const r = q.add(T(new BoxGeometry(0.22, 0.012, 0.3, 2, 1, 2), 0, 0.155, 0), PV, { rough: 0.2, metal: 0.4 });
    facets(r, (_x, _y, _z, _nx, ny) => (ny < 0.5 ? 0x8a8e90 : undefined));
    q.box(0, 0, 0, 0.18, 0.004, 0.3, CONC_L, MATTE);
  });
  k.put(buildAmbient('car', k.d), 0.36, G + 0.004, 0.2, Math.PI / 2, TEAL, 0.85);
  k.put(buildAmbient('watertank', k.d), -0.4, G, -0.36, 0, 0xffffff, 0.8);
  k.flat(0.36, G + 0.002, 0.42, 0.2, 0.14, 0xc8c0b0, MATTE);
  // native garden
  k.blobAt(-0.38, G + 0.03, 0.3, 0.055, 91, 0x7f8a4a, 0.4, 0.7);
  k.blobAt(-0.25, G + 0.025, 0.38, 0.045, 92, WATTLE, 0.4, 0.7);
  k.tree(0.38, -0.36, 0.75, 93, G, [0x7b956a, 0x93a580, 0x8ea08e]);
  if (k.hi) {
    k.blobAt(-0.1, G + 0.02, 0.38, 0.04, 94, 0x9fb08a, 0.4, 0.7);
    k.blobAt(0.1, G + 0.02, 0.4, 0.035, 95, 0xc9682a, 0.4, 0.7);
  }
}

function mSolarfarm(k: Kit): void {
  pad(k, 2, 2, 0x9fae6a);
  // gravel tracks
  k.flat(0, G + 0.002, 0.88, 1.9, 0.1, GRAVEL, MATTE);
  k.flat(-0.9, G + 0.002, 0, 0.08, 1.9, GRAVEL, MATTE);
  const rows = [-0.72, -0.4, -0.08, 0.24, 0.56];
  const tilt = 0.42;
  const L = 1.6, Dp = 0.18;
  for (const z of rows) {
    const y = G + 0.13;
    const pv = k.add(T(new BoxGeometry(L, 0.014, Dp, k.hi ? 12 : 4, 1, 2), 0.06, y, z, tilt, 0, 0), PV, { rough: 0.2, metal: 0.4 });
    facets(pv, (cx, _y, cz, _nx, ny) => {
      if (ny < 0.3) return 0x7a8a96;
      const c = Math.floor((cx - (0.06 - L / 2)) / (L / 12)) + (cz > z ? 1 : 0);
      return c % 2 ? PV2 : undefined;
    });
    // catch-light along the upper (back) edge
    k.rbox(0.06, y + Math.sin(tilt) * Dp * 0.5 + 0.008, z - Math.cos(tilt) * Dp * 0.5, L, 0.006, 0.012, 0xc8dcec, tilt, 0, 0, GLASS);
    const posts = k.hi ? [-0.7, -0.25, 0.25, 0.7] : [-0.6, 0.6];
    for (const px of posts) {
      k.box(px + 0.06, G, z - 0.05, 0.016, 0.16, 0.016, 0x8a8e90, IRON);
      k.box(px + 0.06, G, z + 0.05, 0.016, 0.1, 0.016, 0x8a8e90, IRON);
    }
  }
  // inverter station
  k.group(0.65, G, 0.88, 0, (q) => {
    q.box(0, 0, 0, 0.28, 0.12, 0.1, WHITE, WALL);
    q.box(0, 0.075, 0.0505, 0.28, 0.02, 0.002, TEAL, PAINT);
    if (q.hi) for (const x of [-0.08, 0.0, 0.08]) q.quad(x, 0.05, 0.0515, 0.05, 0.05, '+z', 0xc8cccc, IRON);
    q.box(-0.22, 0, 0, 0.1, 0.1, 0.09, 0x6a7a6c, IRON);
  });
  // sheep
  const sheep = buildAmbient('sheep', k.d);
  const spots: [number, number, number][] = k.hi ? [[-0.5, -0.55, 0.3], [0.3, -0.2, 2.6], [-0.1, 0.14, 1.2], [0.6, 0.47, -0.8], [-0.62, 0.48, 0.1]] : [[-0.5, -0.55, 0.3], [0.3, -0.2, 2.6]];
  for (const [x, z, ry] of spots) k.put(sheep.clone(), x, G, z, ry);
  sheep.dispose();
  fenceRect(k, -0.97, -0.97, 0.97, 0.97, 0x9a9e9a, 0.07, 0.24, true);
}

function mWindfarm(k: Kit): void {
  pad(k, 1, 2, 0x8fa860);
  k.add(ribbon([[-0.05, -1.0], [0.08, -0.6], [-0.08, -0.15], [0.06, 0.3], [-0.06, 0.7], [0.0, 1.0]], 0.09, G + 0.003), GRAVEL, MATTE);
  const yaw = 0.3;
  for (const [z, hub] of [[-0.5, 3.2], [0.5, 3.1]] as [number, number][]) {
    k.cyl(0, G, z, 0.16, 0.18, 0.05, 0xc9c4b8, 8, MATTE);
    turbine(k, 0, G + 0.05, z, hub - 0.05 - G, yaw, 1);
    if (k.hi) k.box(0.13, G, z + 0.12, 0.06, 0.07, 0.05, 0xe8e6de, WALL);
  }
  if (k.hi) for (let i = 0; i < 3; i++) k.blobAt(-0.32 + i * 0.3, G + 0.01, -0.85 + i * 0.85, 0.05, 140 + i, 0x7f9a50, 0.4, 0.6);
  k.put(buildAmbient('sheep', k.d), -0.25, G, 0.1, 0.4);
  k.put(buildAmbient('sheep', k.d), 0.28, G, -0.1, 2.2);
}

function mOffshorewind(k: Kit): void {
  const yaw = 0.3;
  const sites: [number, number, number][] = [[-0.5, -0.65, 3.6], [0.48, -0.05, 3.5], [-0.38, 0.66, 3.65]];
  for (const [x, z, hub] of sites) {
    k.cyl(x, -1.6, z, 0.09, 0.1, 1.55, 0x4a4a4a, 10, RUSTY);
    const tp = k.cyl(x, -0.05, z, 0.1, 0.1, 0.32, 0xe8c02a, 10, PAINT);
    facets(tp, (_x, cy) => (cy < 0.02 ? 0x5a6a3a : undefined));
    k.cyl(x, 0.24, z, 0.17, 0.17, 0.025, 0x8a8e90, 10, IRON);
    if (k.hi) {
      k.box(x + 0.13, 0.265, z, 0.04, 0.04, 0.04, 0x8a8e90, IRON);
      k.box(x, -0.15, z + 0.11, 0.03, 0.4, 0.02, 0xe8c02a, PAINT);
    }
    turbine(k, x, 0.265, z, hub - 0.265, yaw, 1.1, 0.08, 0.045);
  }
  // offshore substation on a jacket
  k.group(0.55, 0, 0.72, 0, (q) => {
    for (const [dx, dz] of [[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]]) {
      q.beam([dx * 1.3, -1.6, dz * 1.3], [dx, 0.3, dz], 0.035, 0.035, 0xe8c02a, PAINT);
    }
    if (q.hi) for (const yy of [-0.9, -0.3]) {
      q.box(0, yy, -0.13, 0.32, 0.02, 0.02, 0xe8c02a, PAINT);
      q.box(0, yy, 0.13, 0.32, 0.02, 0.02, 0xe8c02a, PAINT);
    }
    q.box(0, 0.3, 0, 0.42, 0.03, 0.36, 0x6a6e70, IRON);
    q.box(-0.03, 0.33, 0, 0.32, 0.2, 0.3, WHITE, WALL);
    q.box(-0.03, 0.43, 0.1505, 0.32, 0.025, 0.002, TEAL, PAINT);
    q.box(0.12, 0.53, -0.02, 0.15, 0.015, 0.15, 0x5a5e60, IRON);
    if (q.hi) q.flat(0.12, 0.547, -0.02, 0.1, 0.1, 0xe8c02a, PAINT);
    q.box(-0.12, 0.53, 0.05, 0.05, 0.06, 0.05, 0x8a8e90, IRON);
  });
  // seabed export cable
  if (k.hi) {
    const pts: V3[] = [[-0.5, -1.55, -0.65], [0.48, -1.55, -0.05], [0.55, -1.55, 0.72], [-0.38, -1.55, 0.66], [-1.0, -1.55, 0.9]];
    for (let i = 0; i < pts.length - 1; i++) k.pipe(pts[i], pts[i + 1], 0.015, 0x2a2a2a, 4, MATTE);
  }
}

function mHydro(k: Kit): void {
  pad(k, 2, 2, 0x8a8a6a);
  const cz = 1.15, R = 1.4, T0 = 0.13; // arch centre (downstream), inner radius, thickness
  const crest = 0.68;
  const archZ = (x: number) => cz - Math.sqrt(R * R - x * x);
  // reservoir basin: solid fill behind the arch, water on top
  const s = new Shape();
  s.moveTo(-0.97, 0.97);
  s.lineTo(0.97, 0.97);
  const n = k.hi ? 12 : 6;
  for (let i = 0; i <= n; i++) {
    const x = 0.97 - (i / n) * 1.94;
    s.lineTo(x, -(archZ(x) - 0.02));
  }
  s.closePath();
  const basin = new ExtrudeGeometry(s, { depth: 0.9, bevelEnabled: false });
  basin.rotateX(-Math.PI / 2);
  basin.translate(0, -0.3, 0);
  const bg = k.add(basin, 0xffffff, MATTE);
  facets(bg, (cx, _y, cz2, _nx, ny) => (ny > 0.5 ? (vnoise(cx * 6, cz2 * 6) > 0.62 ? WATER : WATER_D) : (Math.floor((_y + 0.3) / 0.15) % 2 ? SANDSTONE : 0xc99a62)));
  // valley rims (rock + bush) along the back and sides
  const rimC = [0xc9a26a, 0xb88a5a, 0xd9b884];
  const rim: [number, number][] = [];
  for (let i = 0; i < (k.hi ? 9 : 5); i++) rim.push([-0.9 + (i * 1.8) / (k.hi ? 8 : 4), -0.92]);
  for (const sx of [-0.92, 0.92]) for (const z of k.hi ? [-0.6, -0.25, 0.1, 0.5, 0.85] : [-0.5, 0.2, 0.8]) rim.push([sx, z]);
  rim.forEach(([x, z], i) => {
    const y = z > archZ(x) ? 0.35 : 0.62;
    const r = k.add(T(blob(0.16, 1, 150 + i, 0.4, 0.75), x, y, z), rimC[i % 3], MATTE);
    facets(r, (_x, _y, _z, _nx, ny) => (ny > 0.7 ? (i % 2 ? 0x6f8a4a : 0x7f9a50) : undefined));
  });
  // arch dam wall (annulus sector) + crest road + parapets
  const a0 = Math.asin(0.97 / (R + T0));
  const ring = new Shape();
  const segs = k.hi ? 14 : 7;
  const arc = (r: number, a: number): [number, number] => [Math.sin(a) * r, -(cz - Math.cos(a) * r)];
  for (let i = 0; i <= segs; i++) {
    const [px, py] = arc(R + T0, -a0 + (i / segs) * 2 * a0);
    if (i === 0) ring.moveTo(px, py);
    else ring.lineTo(px, py);
  }
  for (let i = segs; i >= 0; i--) ring.lineTo(...arc(R, -a0 + (i / segs) * 2 * a0));
  ring.closePath();
  const wall = new ExtrudeGeometry(ring, { depth: crest + 0.3, bevelEnabled: false });
  wall.rotateX(-Math.PI / 2);
  wall.translate(0, -0.3, 0);
  const wg = k.add(wall, 0xd8d2c4, { rough: 0.9, ao: 0.7 });
  facets(wg, (cx, cy, _z, _nx, ny) => (ny > 0.5 ? 0xbab4a6 : cy < 0.1 ? 0.85 : vnoise(cx * 10, cy * 8) > 0.7 ? 0.92 : undefined));
  // spillway: stepped chute on the downstream face with whitewater
  const sx = 0.42;
  const top: V3 = [sx, crest - 0.04, archZ(sx) + T0 * 0.4], toe: V3 = [sx, G + 0.02, archZ(sx) + 0.5];
  const ch = k.add(T(new BoxGeometry(0.22, 0.03, Math.hypot(toe[1] - top[1], toe[2] - top[2]), 1, 1, k.hi ? 6 : 2), sx, (top[1] + toe[1]) / 2, (top[2] + toe[2]) / 2, Math.atan2(top[1] - toe[1], toe[2] - top[2]), 0, 0), 0xeef6f4, GLASS);
  if (k.hi) facets(ch, (_x, cy) => (Math.floor(cy * 18) % 2 ? 0xd0e8e4 : undefined));
  for (const s2 of [-1, 1]) k.beam([sx + s2 * 0.13, top[1] + 0.03, top[2]], [sx + s2 * 0.13, toe[1] + 0.03, toe[2]], 0.04, 0.08, 0xc8c2b4, MATTE);
  k.shape(blobShape(0.2, 0.14, 8, 10), sx, G + 0.004, archZ(sx) + 0.48, 0xd8eeea, GLASS);
  // penstocks + powerhouse at the toe
  for (const px of [-0.28, -0.08]) k.pipe([px, 0.3, archZ(px) + 0.06], [px, 0.1, 0.46], 0.04, 0x6f7a7c, 8, IRON);
  k.group(-0.18, G, 0.58, 0, (q) => {
    q.box(0, 0, 0, 0.5, 0.2, 0.24, 0xcfc8b8, WALL);
    q.wins('+z', 0.12, 0.12, -0.22, 0.22, 4, 0.06, 0.08, GLASSC);
    q.box(0, 0.2, 0, 0.53, 0.025, 0.27, 0x5f7f7a, IRON);
    q.box(0.15, 0.225, 0.0, 0.12, 0.05, 0.1, 0x8a9a96, IRON);
  });
  // tailrace channel to the front edge
  k.add(ribbon([[-0.18, 0.72], [-0.1, 0.82], [0.05, 0.98]], 0.22, G + 0.004), WATER, GLASS);
  k.add(ribbon([[sx, archZ(sx) + 0.6], [0.3, 0.8], [0.12, 0.92]], 0.12, G + 0.004), WATER, GLASS);
  pylon(k, 0.75, 0.6, 0.85);
  k.tree(-0.75, 0.55, 0.8, 161);
  k.tree(0.7, 0.2, 0.7, 162);
}

function mPumpedhydro(k: Kit): void {
  const W = 3, D = 2;
  const hf = (x: number, z: number) => {
    const t = Math.min(1, Math.max(0, (x + 0.45) / 1.1));
    const s = t * t * (3 - 2 * t);
    return G + 0.82 * (1 - s) + (vnoise(x * 2.5 + 3, z * 2.5) - 0.5) * 0.08 * (1 - Math.abs(2 * s - 1)) * 2;
  };
  hillBox(k, W - 0.04, D - 0.04, k.hi ? 18 : 9, k.hi ? 10 : 5, hf, (cx, cy, cz, ny) => {
    if (ny < 0.2) return [0xc99a62, SANDSTONE, 0xb4633a, 0xe0b884, 0x948577][Math.floor((cy + 0.3) / 0.12) % 5];
    if (ny < 0.8) return vnoise(cx * 5, cz * 5) > 0.5 ? 0xc9a26a : 0xb8945e;
    return vnoise(cx * 4 + 1, cz * 4) > 0.55 ? 0x7f9a50 : 0x8fa860;
  });
  // upper reservoir: lined oval basin on the plateau
  const bx = -0.98, bz = -0.1, top = hf(-1.0, 0) + 0.0;
  k.group(bx, top, bz, 0, (q) => {
    const rim = q.lathe(0, -0.02, 0, [[0.5, 0], [0.5, 0.07], [0.46, 0.08], [0.4, 0.0]], 0xcfc8b8, 20, MATTE);
    facets(rim, (_x, cy) => (cy > 0.06 ? 0xe0dacc : undefined));
    q.add(T(new CylinderGeometry(0.44, 0.44, 0.02, q.seg(20)), 0, 0.03, 0), WATER, GLASS);
    if (q.hi) q.box(0.42, 0.06, 0.0, 0.14, 0.06, 0.1, CONC, WALL);
  }, 1);
  // squash the basin to an oval by building it again? (kept round; plateau is wide enough)
  // penstock down the slope, with anchor blocks
  const pts: V3[] = [];
  const N = k.hi ? 10 : 5;
  for (let i = 0; i <= N; i++) {
    const x = -0.52 + (i / N) * 1.32;
    const z = -0.05 + (i / N) * 0.35;
    pts.push([x, hf(x, z) + 0.05, z]);
  }
  for (let i = 0; i < pts.length - 1; i++) k.pipe(pts[i], pts[i + 1], 0.045, 0x6f7a7c, 8, IRON);
  for (let i = 1; i < pts.length - 1; i += k.hi ? 2 : 2) k.box(pts[i][0], pts[i][1] - 0.08, pts[i][2], 0.1, 0.09, 0.12, CONC, MATTE);
  // powerhouse (modern sandstone + teal) and tailrace pond
  k.group(0.98, G, 0.35, 0, (q) => {
    q.box(0, 0, 0, 0.5, 0.24, 0.34, 0xe0d2b0, WALL);
    q.quad(0, 0.13, 0.1705, 0.42, 0.12, '+z', 0x3a5a6a, GLASS);
    q.box(0, 0.24, 0, 0.56, 0.03, 0.4, TEAL, IRON);
    q.box(-0.1, 0.27, 0, 0.18, 0.06, 0.18, 0xd0c4a4, WALL);
  });
  k.shape(blobShape(0.32, 0.18, 12, k.hi ? 14 : 8), 0.98, G + 0.006, 0.75, WATER, GLASS);
  k.box(0.98, G, 0.75, 0.68, 0.005, 0.4, 0xb8a47c, MATTE);
  pylon(k, 1.25, -0.6, 1.1);
  pylon(k, 0.55, -0.75, 0.95);
  if (k.hi) for (let i = 0; i < 4; i++) k.tree(-1.35 + i * 0.25, -0.85 + (i % 2) * 0.1, 0.8, 170 + i, hf(-1.35 + i * 0.25, -0.85));
  k.tree(1.3, 0.85, 0.75, 175);
  k.tree(0.3, 0.75, 0.7, 176, hf(0.3, 0.75));
}

function mBattery(k: Kit): void {
  pad(k, 1, 2, 0xc9c3b6);
  const rowsZ = k.hi ? [-0.72, -0.4, -0.08, 0.24] : [-0.72, -0.24, 0.24];
  for (const z of rowsZ) {
    for (const x of [-0.2, 0.2]) {
      k.group(x, G, z, 0, (q) => {
        q.box(0, 0, 0, 0.32, 0.015, 0.2, CONC, MATTE);
        const b = q.sbox(0, 0.015, 0, 0.3, 0.14, 0.17, q.hi ? 10 : 1, 1, 1, WHITE, { ao: 0.85, rough: 0.5 });
        if (q.hi) facets(b, (cx, cy, _z, _nx, _ny, nz) => (Math.abs(nz) > 0.5 && cy > 0.04 && cy < 0.12 && Math.floor((cx + 0.15) / 0.03) % 2 ? 0x9aa4a6 : undefined));
        q.box(0, 0.1, 0.0855, 0.3, 0.012, 0.002, TEAL, PAINT);
        q.box(0, 0.155, 0, 0.3, 0.012, 0.17, 0xdcdedc, PAINT);
        if (q.hi) q.box(0.11, 0.167, 0, 0.06, 0.02, 0.08, 0xb8bcbc, IRON);
      });
    }
  }
  // inverter/transformer skids + control room
  k.box(0, G, 0.55, 0.22, 0.1, 0.12, 0x6a7a6c, IRON);
  if (k.hi) for (const dx of [-0.06, 0, 0.06]) k.cyl(dx, G + 0.1, 0.55, 0.007, 0.007, 0.05, 0xd8d4c8, 4);
  k.group(-0.22, G, 0.78, 0, (q) => {
    q.box(0, 0, 0, 0.26, 0.13, 0.14, 0xe0d2b0, WALL);
    q.wins('+z', 0.07, 0.08, -0.08, 0.08, 2, 0.05, 0.04, GLASSC);
    q.box(0, 0.13, 0, 0.29, 0.015, 0.17, TEAL, IRON);
  });
  k.box(0.25, G, 0.75, 0.04, 0.2, 0.04, 0x8a8e90, IRON);
  fenceRect(k, -0.46, -0.96, 0.46, 0.96, 0x8a8e90, 0.1, 0.16, true);
  if (k.hi) for (const z of [-0.96, 0.96]) k.box(0, G + 0.1, z, 0.92, 0.008, 0.008, 0x8a8e90, IRON);
}

function mTidal(k: Kit): void {
  // underwater turbines (faint), seabed tripods
  const FAINT = 0x8fb0a8;
  const sites: [number, number][] = [[-0.5, -0.45], [0.5, -0.4], [0.0, 0.45]];
  for (const [x, z] of sites) {
    k.group(x, 0, z, 0, (q) => {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        q.beam([Math.cos(a) * 0.22, -1.6, Math.sin(a) * 0.22], [0, -0.95, 0], 0.035, 0.035, 0x6f8a84, RUSTY);
      }
      q.cyl(0, -1.0, 0, 0.04, 0.05, 0.2, 0x6f8a84, 8);
      q.cylX(0, -0.8, 0, 0.06, 0.32, FAINT, 10);
      q.sph(0.16, -0.8, 0, 0.06, FAINT, 8, 1.3, 1, 1);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        q.add(T(new BoxGeometry(0.012, 0.32, 0.05), 0.2, -0.8 + Math.cos(a) * 0.18, Math.sin(a) * 0.18, a, 0, 0), FAINT);
      }
    });
  }
  // surface: control platform with navigation light
  k.group(0.0, 0, -0.02, 0, (q) => {
    for (const [dx, dz] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) q.cyl(dx, -1.6, dz, 0.025, 0.03, 1.75, 0x4a4a4a, 6, RUSTY);
    q.box(0, 0.12, 0, 0.32, 0.03, 0.32, 0xe8c02a, PAINT);
    q.box(-0.04, 0.15, 0, 0.18, 0.12, 0.16, WHITE, WALL);
    q.box(-0.04, 0.27, 0, 0.2, 0.015, 0.18, TEAL, PAINT);
    q.cyl(0.1, 0.15, 0.08, 0.008, 0.008, 0.3, 0x3a3a3a, 5);
    q.cyl(0.1, 0.45, 0.08, 0.02, 0.02, 0.03, 0xfff0b0, 6, GLASS);
    if (q.hi) q.box(0.1, 0.15, -0.08, 0.06, 0.04, 0.06, 0x8a8e90, IRON);
  });
  // cardinal marker buoys
  for (const [x, z] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]] as [number, number][]) {
    k.cyl(x, -0.06, z, 0.045, 0.06, 0.1, 0xe8c02a, 8, PAINT);
    const t = k.cyl(x, 0.04, z, 0.012, 0.012, 0.12, 0x2a2a2a, 5);
    facets(t, (_x, cy) => (cy > 0.1 ? 0xe8c02a : undefined));
    k.cone(x, 0.16, z, 0.03, 0.04, 0x2a2a2a, 6);
  }
  // seabed cable to the shore side (−x)
  k.pipe([0, -1.55, -0.02], [-0.98, -1.55, 0.2], 0.015, 0x2a2a2a, 4, MATTE);
  if (k.hi) for (const [x, z] of sites) k.pipe([x, -1.55, z], [0, -1.55, -0.02], 0.012, 0x2a2a2a, 4, MATTE);
}

function mPhyto(k: Kit): void {
  pad(k, 2, 2, 0x8a7458);
  k.add(ribbon([[-0.95, 0.02], [0.95, 0.02]], 0.12, G + 0.003), GRAVEL, MATTE);
  k.add(ribbon([[0.0, -0.95], [0.0, 0.95]], 0.1, G + 0.003), GRAVEL, MATTE);
  const beds: [number, number, boolean][] = [[-0.5, -0.32, true], [0.5, -0.32, true], [-0.5, 0.38, false], [0.5, 0.38, true]];
  const rnd = mulberry32(5);
  beds.forEach(([x, z, sun], bi) => {
    k.box(x, G, z, 0.8, 0.07, 0.48, TIMBER, MATTE);
    const soil = k.box(x, G + 0.07, z, 0.74, 0.006, 0.42, 0x4a3a2c, MATTE);
    facets(soil, () => 0x4a3a2c);
    if (sun) {
      const n = k.hi ? 10 : 4;
      for (let i = 0; i < n; i++) {
        const px = x - 0.3 + ((i % 5) + 0.5) * 0.12 + (rnd() - 0.5) * 0.03;
        const pz = z - 0.1 + Math.floor(i / 5) * 0.2 + (rnd() - 0.5) * 0.03;
        sunflower(k, px, pz, 0.14 + rnd() * 0.08 + 0.07, (rnd() - 0.5) * 0.6);
      }
    } else {
      // indian mustard: low green mounds with yellow flowers
      for (let i = 0; i < (k.hi ? 8 : 4); i++) {
        const px = x - 0.28 + (i % 4) * 0.19, pz = z - 0.1 + Math.floor(i / 4) * 0.2;
        k.blobAt(px, G + 0.1, pz, 0.05, 200 + bi * 10 + i, 0x6f9a40, 0.4, 0.7);
        k.blobAt(px + 0.01, G + 0.135, pz, 0.03, 300 + i, 0xe8c840, 0.5, 0.6);
      }
    }
  });
  // poplars along the back, willow at front-right
  for (let i = 0; i < (k.hi ? 5 : 3); i++) {
    const x = -0.8 + i * (k.hi ? 0.4 : 0.8);
    k.cyl(x, G, -0.86, 0.012, 0.018, 0.12, 0xb8ad98, 5);
    k.blobAt(x, G + 0.32, -0.86, 0.09, 210 + i, i % 2 ? 0x7f9a50 : 0x6f8a44, 0.3, 2.6, 0, { ao: 0.6 });
  }
  k.cyl(0.82, G, 0.82, 0.016, 0.022, 0.18, 0x8a7a64, 5);
  k.blobAt(0.82, G + 0.2, 0.82, 0.16, 220, 0x9fb070, 0.35, 0.8, k.hi ? 1 : 0, { ao: 0.55 }, 1, 1);
  if (k.hi) for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.blobAt(0.82 + Math.cos(a) * 0.13, G + 0.11, 0.82 + Math.sin(a) * 0.13, 0.06, 230 + i, 0x8fa860, 0.3, 1.6, 0, { ao: 0.6 });
  }
  // sign board + hose reel + wheelbarrow
  k.group(-0.82, G, 0.84, 0.3, (q) => {
    for (const x of [-0.08, 0.08]) q.box(x, 0, 0, 0.015, 0.2, 0.015, TIMBER, MATTE);
    q.box(0, 0.12, 0.005, 0.22, 0.12, 0.012, 0x3f6b4f, PAINT);
    q.quad(0, 0.19, 0.0115, 0.18, 0.025, '+z', WATTLE, PAINT);
    if (q.hi) q.quad(0, 0.145, 0.0115, 0.16, 0.04, '+z', 0xe8e2d0, PAINT);
  });
  k.cyl(0.15, G, -0.05, 0.008, 0.008, 0.08, 0x6a6a6a, 4);
  k.add(T(new CylinderGeometry(0.035, 0.035, 0.025, k.seg(10)), 0.15, G + 0.07, -0.05, Math.PI / 2, 0, 0), 0x3f8a4a, PAINT);
  if (k.hi) {
    k.group(-0.12, G, 0.1, 0.8, (q) => {
      q.box(0, 0.03, 0, 0.09, 0.035, 0.06, 0x3f6b8a, PAINT);
      q.cylZ(0.055, 0.015, 0, 0.015, 0.012, 0x222222, 6);
      for (const z of [-0.025, 0.025]) q.beam([0.04, 0.03, z], [-0.1, 0.045, z * 1.3], 0.006, 0.006, TIMBER);
    });
  }
}

function mExcavation(k: Kit): void {
  // pad with a terraced pit (x ∈ [-0.75,0.25], z ∈ [-0.55,0.45])
  const px0 = -0.75, px1 = 0.25, pz0 = -0.55, pz1 = 0.45;
  const LAY = [0x6a5038, 0xb4633a, 0xd9b884, 0x5a5048];
  const frame = (x0: number, z0: number, x1: number, z1: number, X0: number, Z0: number, X1: number, Z1: number, y0: number, y1: number, col: number) => {
    // ring of 4 boxes between outer (X) and inner (x) rectangles
    const parts: [number, number, number, number][] = [[X0, Z0, X1, z0], [X0, z1, X1, Z1], [X0, z0, x0, z1], [x1, z0, X1, z1]];
    for (const [a, b, c, d] of parts) {
      if (c - a < 0.001 || d - b < 0.001) continue;
      const g = k.sbox((a + c) / 2, y0, (b + d) / 2, c - a, y1 - y0, d - b, 1, k.hi ? 3 : 1, 1, col, MATTE);
      facets(g, (_x, cy, _z, _nx, ny) => (ny > 0.5 ? undefined : LAY[Math.min(3, Math.max(0, Math.floor((G - cy) / 0.07)))]));
    }
  };
  frame(px0, pz0, px1, pz1, -0.98, -0.98, 0.98, 0.98, -0.3, G, 0x9a8a6a);
  frame(px0 + 0.1, pz0 + 0.1, px1 - 0.1, pz1 - 0.1, px0, pz0, px1, pz1, -0.3, -0.06, 0xb4633a);
  frame(px0 + 0.2, pz0 + 0.2, px1 - 0.2, pz1 - 0.2, px0 + 0.1, pz0 + 0.1, px1 - 0.1, pz1 - 0.1, -0.3, -0.14, 0xd9b884);
  const fl = k.box((px0 + px1) / 2, -0.3, (pz0 + pz1) / 2, px1 - px0 - 0.4, 0.08, pz1 - pz0 - 0.4, 0x3f3a36, MATTE);
  facets(fl, (cx, _y, cz) => (vnoise(cx * 12, cz * 12) > 0.6 ? 0x2e2a28 : undefined));
  k.flat(-0.3, -0.218, -0.02, 0.16, 0.12, 0x5a6a5a, GLASS);
  // excavator on the rim, reaching into the pit
  k.group(0.45, G, -0.05, Math.PI, (q) => excavator(q, 0.32, -0.12));
  // dump truck with dark soil
  k.group(0.55, G, 0.6, 0.4, (q) => {
    for (const x of [-0.08, 0.08]) for (const z of [-0.06, 0.06]) q.cylZ(x, 0.035, z, 0.035, 0.03, 0x2a2a2a, 8, MATTE);
    q.box(0, 0.04, 0, 0.26, 0.03, 0.12, 0x3a3a3a);
    q.box(0.1, 0.07, 0, 0.07, 0.08, 0.11, YELLOW, PAINT);
    q.quad(0.1355, 0.12, 0, 0.09, 0.03, '+x', GLASSC);
    q.box(-0.04, 0.07, 0, 0.17, 0.07, 0.13, YELLOW, PAINT);
    q.blobAt(-0.04, 0.14, 0, 0.065, 401, 0x3a332e, 0.4, 0.45, 0, MATTE, 1.3, 1);
  });
  // contaminated stockpile, partly tarped
  stockpile(k, -0.45, 0.75, 0.75, 0.32, 0.2, 41, 0x3f3833);
  k.rbox(-0.7, G + 0.08, 0.75, 0.3, 0.012, 0.36, 0x3a3e44, 0, 0, 0.5, { rough: 0.4 });
  // orange barriers along the pit edge
  const nb = k.hi ? 7 : 4;
  for (let i = 0; i < nb; i++) {
    const x = px0 + ((i + 0.5) * (px1 - px0)) / nb;
    const b = k.sbox(x, G, pz1 + 0.05, 0.11, 0.06, 0.035, 1, k.hi ? 3 : 1, 1, 0xe8792a, PAINT);
    if (k.hi) facets(b, (_x, cy, _z, _nx, ny) => (Math.abs(ny) < 0.5 && cy > G + 0.02 && cy < G + 0.04 ? WHITE : undefined));
  }
  for (let i = 0; i < (k.hi ? 5 : 3); i++) {
    const z = pz0 + ((i + 0.5) * (pz1 - pz0)) / (k.hi ? 5 : 3);
    k.box(px0 - 0.06, G, z, 0.035, 0.06, 0.13, 0xe8792a, PAINT);
  }
  // site office + wash bay
  k.group(0.6, G, -0.72, 0, (q) => {
    q.box(0, 0, 0, 0.34, 0.14, 0.16, WHITE, WALL);
    q.wins('+z', 0.08, 0.08, -0.14, 0.14, 3, 0.05, 0.04, GLASSC);
    q.box(0, 0.14, 0, 0.36, 0.012, 0.18, 0x9aa4a6, IRON);
  });
  k.box(-0.85, G, -0.75, 0.2, 0.012, 0.3, CONC, MATTE);
}

function mWetland(k: Kit): void {
  pad(k, 2, 2, 0x86a35a);
  const ponds: [number, number, number, number, number][] = [[-0.38, -0.3, 0.55, 0.45, 1], [0.48, 0.32, 0.42, 0.4, 2], [0.5, -0.58, 0.3, 0.2, 3]];
  for (const [x, z, rx, rz, s] of ponds) {
    k.shape(blobShape(rx + 0.06, rz + 0.06, s, k.hi ? 18 : 10, 0.2), x, G + 0.003, z, 0xa89a6a, MATTE);
    const w = k.shape(blobShape(rx, rz, s, k.hi ? 18 : 10, 0.2), x, G + 0.006, z, WATER, GLASS);
    facets(w, (cx, _y, cz) => (vnoise(cx * 5 + s, cz * 5) > 0.6 ? 0x5aa8a4 : undefined));
  }
  // reeds around the margins
  const clumps: [number, number][] = [[-0.85, -0.55], [-0.78, -0.1], [-0.55, 0.12], [-0.1, -0.68], [0.05, -0.2], [0.1, 0.25], [0.2, 0.65], [0.82, 0.05], [0.85, 0.7], [0.3, -0.75], [0.78, -0.42]];
  clumps.slice(0, k.hi ? clumps.length : 7).forEach(([x, z], i) => reedClump(k, x, z, 500 + i, k.hi ? 16 : 8));
  // lily pads
  if (k.hi) for (let i = 0; i < 6; i++) k.cyl(-0.45 + (i % 3) * 0.14, G + 0.007, -0.35 + Math.floor(i / 3) * 0.16, 0.025, 0.025, 0.004, 0x5f8a40, 7);
  // boardwalk across the big pond
  const bw: [number, number][] = [[-0.95, 0.55], [-0.5, 0.35], [-0.25, 0.0], [0.05, -0.12], [0.3, -0.05]];
  const y = G + 0.05;
  k.add(ribbon(bw, 0.1, y), 0xa39072, MATTE);
  k.add(ribbon(bw, 0.1, y - 0.012), 0x7a6a52, MATTE);
  for (let i = 0; i < bw.length; i++) {
    const [x, z] = bw[i];
    for (const s of [-1, 1]) k.box(x + s * 0.04, G - 0.02, z + s * 0.03, 0.015, 0.075 + (k.hi ? 0.06 : 0), 0.015, 0x6a5a48, MATTE);
  }
  if (k.hi) for (let i = 0; i < bw.length - 1; i++) {
    const [ax, az] = bw[i], [bx, bz] = bw[i + 1];
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
    const ox = (-dz / L) * 0.048, oz = (dx / L) * 0.048;
    k.beam([ax + ox, y + 0.05, az + oz], [bx + ox, y + 0.05, bz + oz], 0.008, 0.008, 0x8a7a5a, MATTE);
  }
  // heron
  k.group(0.35, G + 0.006, 0.18, -0.6, (q) => {
    for (const z of [-0.008, 0.008]) q.box(0, 0, z, 0.005, 0.07, 0.005, 0x4a4a42);
    q.sph(0, 0.09, 0, 0.03, 0xd8dcd8, 8, 1.4, 0.8, 0.9);
    q.add(taperTube([new Vector3(0.03, 0.1, 0), new Vector3(0.045, 0.14, 0), new Vector3(0.04, 0.17, 0)], 0.009, 0.007, 5, 3), 0xe8ece8);
    q.sph(0.045, 0.172, 0, 0.012, 0xe8ece8, 6);
    q.cone(0.07, 0.165, 0, 0.004, 0.035, 0xd9a43a, 4).rotateZ(0);
    q.add(T(new CylinderGeometry(0.0, 0.005, 0.035, 4), 0.07, 0.17, 0, 0, 0, -Math.PI / 2), 0xd9a43a);
  });
  // bird hide + interpretive sign
  k.group(0.82, G, -0.82, -0.5, (q) => {
    q.box(0, 0, 0, 0.2, 0.13, 0.14, 0x8a7458, WALL);
    q.quad(0, 0.09, 0.0705, 0.15, 0.025, '+z', 0x1a1612, MATTE);
    q.rbox(0, 0.15, 0, 0.24, 0.015, 0.2, ROOF_GRN, 0.15, 0, 0, IRON);
  });
  k.group(-0.75, G, 0.82, 0.4, (q) => {
    q.box(0, 0, 0, 0.015, 0.12, 0.015, TIMBER, MATTE);
    q.rbox(0, 0.13, 0, 0.16, 0.1, 0.012, 0x3f6b4f, -0.4, 0, 0, PAINT);
  });
  k.tree(-0.85, -0.85, 0.85, 181, G, [0x7b956a, 0x93a580, 0x8ea08e]);
  k.tree(0.85, 0.35, 0.75, 182, G, [0x7b956a, 0x8ea08e]);
}

function mSewage(k: Kit): void {
  pad(k, 1, 1, CONC_L);
  const clar = (x: number, z: number, r: number, ang: number) => {
    k.group(x, G, z, ang, (q) => {
      const rim = q.lathe(0, 0, 0, [[r, 0], [r, 0.08], [r - 0.02, 0.08], [r - 0.02, 0.05]], 0xd8d2c4, 18, { rough: 0.85, ao: 0.8 });
      facets(rim, (_x, cy) => (cy > 0.075 ? 0xe8e2d4 : undefined));
      const w = q.add(T(new CylinderGeometry(r - 0.02, r - 0.02, 0.01, q.seg(18)), 0, 0.055, 0), 0x6aa8a0, GLASS);
      facets(w, (cx, _y, cz) => (Math.hypot(cx - x, cz - z) < r * 0.35 ? 0x5a9890 : undefined));
      q.cyl(0, 0.05, 0, 0.03, 0.03, 0.06, 0xb8bcbc, 8, IRON);
      q.box(r * 0.5, 0.09, 0, r, 0.02, 0.035, 0x5f8a7a, IRON);
      if (q.hi) {
        q.box(r * 0.5, 0.11, 0.015, r, 0.015, 0.004, 0xe8c02a, PAINT);
        q.box(r * 0.5, 0.11, -0.015, r, 0.015, 0.004, 0xe8c02a, PAINT);
      }
      q.box(r - 0.02, 0.06, 0, 0.03, 0.05, 0.05, 0x4a5a54, IRON);
    });
  };
  clar(-0.22, -0.2, 0.21, 0.4);
  clar(0.22, 0.2, 0.2, 2.3);
  // aeration tank with bubbles
  k.box(-0.22, G, 0.27, 0.38, 0.06, 0.28, 0xd0cabc, WALL);
  const aer = k.add(T(new BoxGeometry(0.34, 0.01, 0.24, k.hi ? 8 : 3, 1, k.hi ? 6 : 2), -0.22, G + 0.055, 0.27), 0x7ab0a6, GLASS);
  facets(aer, (cx, _y, cz) => (vnoise(cx * 40, cz * 40) > 0.55 ? 0xc8e4dc : undefined));
  // building (clean upgrade: sandstone + teal roof)
  k.group(0.25, G, -0.25, 0, (q) => {
    q.box(0, 0, 0, 0.3, 0.16, 0.22, 0xe0d2b0, WALL);
    q.quad(0, 0.09, 0.1105, 0.2, 0.06, '+z', 0x3a5a6a, GLASS);
    q.box(0, 0.16, 0, 0.33, 0.02, 0.25, TEAL, IRON);
    if (q.hi) q.flat(0, 0.182, 0, 0.24, 0.18, PV, { rough: 0.2, metal: 0.4 });
  });
  k.pipe([-0.03, G + 0.04, 0.27], [0.06, G + 0.04, 0.2], 0.018, 0x5f8a7a, 6, IRON);
  k.tree(0.38, 0.4, 0.55, 191, G, [0x7b956a, 0x93a580]);
  if (k.hi) k.blobAt(-0.42, G + 0.02, -0.42, 0.04, 192, WATTLE, 0.4, 0.7);
}

function mNursery(k: Kit): void {
  pad(k, 2, 2, 0x9a8a6a);
  k.flat(0, G + 0.002, 0.08, 1.9, 0.1, GRAVEL, MATTE);
  // arched greenhouse
  k.group(-0.4, G, -0.48, 0, (q) => {
    const L = 1.0, R = 0.28;
    q.box(0, 0, 0, L + 0.04, 0.04, 2 * R + 0.04, CONC_L, MATTE);
    const gh = new CylinderGeometry(R, R, L, q.seg(12), 1, true, -Math.PI / 2, Math.PI);
    T(gh, 0, 0.04, 0, 0, 0, Math.PI / 2);
    const g = q.add(gh, 0xe8f0ec, GLASS);
    if (q.hi) facets(g, (_x, cy) => (Math.floor(cy * 40) % 3 === 0 ? 0xcfdcd8 : undefined));
    const nr = q.hi ? 6 : 3;
    for (let i = 0; i <= nr; i++) q.add(T(new TorusGeometry(R + 0.004, 0.006, 3, q.seg(12), Math.PI), -L / 2 + (i * L) / nr, 0.04, 0, 0, Math.PI / 2, 0), WHITE, PAINT);
    for (const sx of [-1, 1]) {
      const end = new CylinderGeometry(R, R, 0.01, q.seg(12), 1, false, 0, Math.PI);
      T(end, sx * L / 2, 0.04, 0, 0, 0, Math.PI / 2);
      q.add(end, 0xdfeae6, GLASS);
    }
    q.quad(L / 2 + 0.008, 0.1, 0, 0.1, 0.12, '+x', 0x9ab0a8, GLASS);
    // seedlings visible through
    q.box(0, 0.04, 0, L - 0.1, 0.03, 0.3, 0x5f8a40, MATTE);
  });
  // shade-cloth house
  k.group(0.55, G, -0.45, 0, (q) => {
    for (const [x, z] of [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.25], [0.3, 0.25], [0, -0.25], [0, 0.25]]) q.box(x, 0, z, 0.016, 0.24, 0.016, 0x8a8e90, IRON);
    const sc = q.add(T(new BoxGeometry(0.66, 0.008, 0.56), 0, 0.24, 0), 0x3f4a42, { rough: 0.9 });
    facets(sc, (_x, _y, _z, _nx, ny) => (ny < 0 ? 0x2a302c : undefined));
    q.box(0, 0.03, 0, 0.5, 0.05, 0.4, 0x7a9a50, MATTE);
  });
  // benches of seedling trays (checker of greens)
  const benchZ = k.hi ? [0.3, 0.52, 0.74] : [0.35, 0.7];
  for (const z of benchZ) {
    k.box(-0.42, G, z, 0.95, 0.06, 0.14, 0x8a8e90, IRON);
    const tr = k.add(T(new BoxGeometry(0.9, 0.02, 0.12, k.hi ? 12 : 4, 1, 2), -0.42, G + 0.07, z), 0x5f8a40, MATTE);
    facets(tr, (cx, _y, cz, _nx, ny) => (ny > 0.5 ? ((Math.floor((cx + 0.87) / 0.075) + (cz > z ? 1 : 0)) % 2 ? 0x7fa850 : undefined) : 0x3a3a3a));
  }
  // tube-stock trees in pots
  const pots = k.hi ? 8 : 4;
  for (let i = 0; i < pots; i++) {
    const x = 0.25 + (i % 4) * 0.16, z = 0.35 + Math.floor(i / 4) * 0.25;
    k.cyl(x, G, z, 0.03, 0.025, 0.05, 0x3a3a3a, 6);
    k.blobAt(x, G + 0.1, z, 0.045, 600 + i, i % 3 === 0 ? WATTLE : i % 3 === 1 ? 0x7f9a50 : SAGE, 0.4, 1.2);
  }
  k.put(buildAmbient('watertank', k.d), 0.85, G, -0.85, 0);
  // wheelbarrow + sign
  k.group(0.0, G, 0.18, 0.4, (q) => {
    q.box(0, 0.03, 0, 0.09, 0.035, 0.06, 0x5f8a7a, PAINT);
    q.cylZ(0.055, 0.015, 0, 0.015, 0.012, 0x222222, 6);
    for (const z of [-0.025, 0.025]) q.beam([0.04, 0.03, z], [-0.1, 0.045, z * 1.3], 0.006, 0.006, TIMBER);
  });
  k.group(0.82, G, 0.88, -0.3, (q) => {
    for (const x of [-0.08, 0.08]) q.box(x, 0, 0, 0.015, 0.18, 0.015, TIMBER, MATTE);
    q.box(0, 0.1, 0.005, 0.22, 0.1, 0.012, 0xe8e2d0, PAINT);
    q.quad(0, 0.16, 0.0115, 0.18, 0.022, '+z', 0x3f6b4f, PAINT);
    q.quad(-0.05, 0.125, 0.0115, 0.05, 0.03, '+z', WATTLE, PAINT);
  });
  k.blobAt(-0.88, G + 0.04, 0.85, 0.07, 620, WATTLE, 0.4, 0.8);
}


// ================================================================== Act 2 extras: wildlife, satellites, circular tier

/** Parabolic dish antenna on a pedestal; local yaw ry, tilt from vertical toward +z. */
function dish(k: Kit, x: number, z: number, R: number, tilt: number, ry: number, h: number): void {
  k.group(x, G, z, ry, (q) => {
    q.cyl(0, 0, 0, R * 0.32, R * 0.4, 0.05, CONC, 10, MATTE);
    q.cyl(0, 0.05, 0, R * 0.16, R * 0.22, h - 0.05, 0xe8e6de, 10, PAINT);
    q.box(0, h - 0.02, 0, R * 0.5, R * 0.22, R * 0.3, 0xd8d6ce, PAINT);
    const f = R * 0.55;
    const n = q.hi ? 6 : 3;
    const prof: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const r = Math.max(0.002, (R * i) / n);
      prof.push([r, (r * r) / (4 * f)]);
    }
    const yc = h + R * 0.2;
    const lift = (g: BufferGeometry) => T(g, 0, yc, 0, tilt, 0, 0);
    const outer = q.add(lift(new LatheGeometry(prof.map(([r, y]) => new Vector2(r, y)), q.seg(18))), 0xc9ccc8, PAINT);
    const inner = q.add(lift(new LatheGeometry(prof.slice().reverse().map(([r, y]) => new Vector2(r, y + 0.002)), q.seg(18))), 0xf4f3ee, PAINT);
    void outer;
    void inner;
    q.add(lift(new TorusGeometry(R, 0.012, 3, q.seg(18)).rotateX(Math.PI / 2).translate(0, (R * R) / (4 * f), 0)), 0xb8bab6, IRON);
    // feed tripod to the focus
    const rot = (px: number, py: number, pz: number): V3 => [px, yc + py * Math.cos(tilt) - pz * Math.sin(tilt), py * Math.sin(tilt) + pz * Math.cos(tilt)];
    const focus = rot(0, f, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const rr = R * 0.92;
      q.beam(rot(Math.cos(a) * rr, (rr * rr) / (4 * f), Math.sin(a) * rr), focus, 0.008, 0.008, 0xd8d6ce, IRON);
    }
    q.add(T(new CylinderGeometry(0.025, 0.035, 0.06, q.seg(8)), focus[0], focus[1], focus[2], tilt, 0, 0), 0x8a8e90, IRON);
  });
}

/** Wind-turbine blade lying along +x from (x,y,z), length L. */
function blade(k: Kit, x: number, y: number, z: number, L: number, ry = 0): void {
  const g = new CylinderGeometry(0.01, 0.042, L, k.seg(6));
  T(g, 0, L / 2, 0);
  T(g, 0, 0, 0, 0, 0, 0, 1, 1, 0.38);
  T(g, x, y, z, 0, ry, -Math.PI / 2);
  k.add(g, 0xf4f5f2, { rough: 0.35 });
  k.add(T(new CylinderGeometry(0.045, 0.045, 0.05, k.seg(8)), x, y, z, 0, ry, -Math.PI / 2), 0xd8dad6, IRON);
}

function mWildlifecrossing(k: Kit): void {
  // built with the road along X, then turned so the road runs along Z (edge-to-edge like a road tile)
  k.group(0, 0, 0, Math.PI / 2, (q) => wildlifeX(q));
}
function wildlifeX(k: Kit): void {
  pad(k, 1, 1, 0x7a9450);
  // road through the tile along local X
  k.box(0, G - 0.012, 0, 1.0, 0.016, 0.32, ASPHALT, MATTE);
  for (let i = 0; i < 4; i++) k.flat(-0.375 + i * 0.25, G + 0.0045, 0, 0.12, 0.008, 0xf2ecdc, MATTE);
  for (const z of [-0.15, 0.15]) k.flat(0, G + 0.0045, z, 1.0, 0.006, 0xece6d6, MATTE);
  // culvert underpass headwalls with dark mouths
  for (const s of [-1, 1]) {
    k.box(-0.28, G - 0.05, s * 0.2, 0.2, 0.09, 0.05, CONC, WALL);
    k.quad(-0.28, G - 0.0, s * 0.2 + s * 0.0255, 0.12, 0.07, s > 0 ? '+z' : '-z', 0x14110e, MATTE);
  }
  // rope bridge for gliders/possums between two tall poles
  const H = 0.46;
  for (const s of [-1, 1]) {
    k.cyl(0.22, G, s * 0.3, 0.014, 0.02, H + 0.08, 0x7a5f45, 6, MATTE);
    k.beam([0.22, G + H + 0.06, s * 0.3], [0.32, G, s * 0.42], 0.004, 0.004, 0x3a3a3a);
  }
  for (const dy of [0, 0.03]) k.beam([0.22, G + H + dy, -0.3], [0.22, G + H - 0.04 + dy, 0], 0.006, 0.006, 0xb8a47c);
  for (const dy of [0, 0.03]) k.beam([0.22, G + H - 0.04 + dy, 0], [0.22, G + H + dy, 0.3], 0.006, 0.006, 0xb8a47c);
  if (k.hi) for (let i = 1; i < 10; i++) {
    const t = i / 10, zz = -0.3 + t * 0.6, sag = 0.04 * (1 - Math.abs(2 * t - 1));
    k.box(0.22, G + H - sag, zz, 0.05, 0.004, 0.008, 0x9a8a62);
  }
  // fauna fences along both verges, funnel shrubs
  for (const s of [-1, 1]) {
    k.beam([-0.48, G + 0.06, s * 0.2], [-0.4, G + 0.06, s * 0.2], 0.004, 0.06, 0x5f7a5a);
    k.beam([-0.16, G + 0.06, s * 0.2], [0.48, G + 0.06, s * 0.2], 0.004, 0.06, 0x5f7a5a);
  }
  const shrubs: [number, number, number][] = [[-0.42, -0.36, 0x6f8a44], [-0.12, -0.4, 0x7f9a50], [0.4, -0.38, WATTLE], [-0.38, 0.38, 0x7f9a50], [-0.1, 0.42, 0x6f8a44], [0.42, 0.36, 0x8ea08e]];
  shrubs.forEach(([x, z, c], i) => k.blobAt(x, G + 0.04, z, 0.06, 700 + i, c, 0.4, 0.75, k.hi ? 1 : 0));
  k.tree(0.4, -0.3, 0.75, 711, G, [0x7b956a, 0x8ea08e]);
  k.tree(0.06, 0.34, 0.7, 712, G, [0x6f8a4a, 0x7b956a]);
  // yellow diamond wildlife sign
  k.box(-0.1, G, -0.22, 0.01, 0.12, 0.01, 0x8a8e90, IRON);
  k.add(T(new BoxGeometry(0.07, 0.07, 0.006), -0.1, G + 0.14, -0.218, 0, 0, Math.PI / 4), 0xe8c02a, PAINT);
  k.add(T(new BoxGeometry(0.03, 0.025, 0.002), -0.1, G + 0.14, -0.214), 0x2a2a2a);
}

function mGroundstation(k: Kit): void {
  pad(k, 2, 2, 0xb3a993);
  k.flat(0.1, G + 0.002, 0.35, 1.6, 0.1, CONC_L, MATTE);
  dish(k, -0.45, -0.3, 0.42, 0.75, 0.5, 0.42);
  dish(k, 0.5, -0.5, 0.3, 0.95, -0.3, 0.32);
  dish(k, 0.75, 0.15, 0.16, 0.6, 0.9, 0.18);
  k.group(-0.15, G, 0.62, 0, (q) => {
    q.box(0, 0, 0, 0.62, 0.2, 0.3, WHITE, WALL);
    q.box(0, 0.12, 0.1505, 0.62, 0.02, 0.002, TEAL, PAINT);
    q.wins('+z', 0.15, 0.07, -0.28, 0.1, 4, 0.06, 0.06, 0x3a5a6a);
    q.quad(0.2, 0.07, 0.153, 0.08, 0.12, '+z', 0x5a6a6a, PAINT);
    q.box(0, 0.2, 0, 0.66, 0.02, 0.34, 0xd8dcdc, IRON);
    const pv = q.add(T(new BoxGeometry(0.5, 0.012, 0.24, q.hi ? 6 : 2, 1, 2), 0, 0.24, 0, 0.2, 0, 0), PV, { rough: 0.2, metal: 0.4 });
    facets(pv, (cx, _y, cz, _nx, ny) => (ny > 0.5 ? ((Math.floor((cx + 0.25) / (0.5 / 6)) + (cz > 0 ? 1 : 0)) % 2 ? PV2 : undefined) : 0x7a8a96));
    q.cyl(0.26, 0.22, -0.08, 0.008, 0.008, 0.4, 0x8a8e90, 5, IRON);
    q.box(0.26, 0.5, -0.08, 0.08, 0.008, 0.008, 0x8a8e90, IRON);
  });
  fenceRect(k, -0.96, -0.96, 0.96, 0.96, 0x9a9e9a, 0.08, 0.22, true);
  k.tree(-0.85, 0.85, 0.75, 721, G, [0x7b956a, 0x93a580]);
  k.tree(0.85, 0.85, 0.65, 722, G, [0x8ea08e, 0x7b956a]);
}

function mGreensteel(k: Kit): void {
  pad(k, 3, 3, 0xa8a196);
  const CLAD = 0xdfe4e2;
  // hydrogen DRI shaft furnace tower
  k.group(-0.45, G, -0.5, 0, (q) => {
    q.box(0, 0, 0, 0.7, 0.06, 0.7, CONC, MATTE);
    q.cyl(0, 0.06, 0, 0.26, 0.28, 1.5, CLAD, 14, { rough: 0.5, ao: 0.75 }, q.hi ? 5 : 1);
    q.cyl(0, 0.9, 0, 0.27, 0.27, 0.05, TEAL, 14, PAINT);
    for (const [dx, dz] of [[-0.33, -0.33], [0.33, -0.33], [-0.33, 0.33], [0.33, 0.33]]) q.box(dx, 0.06, dz, 0.035, 1.7, 0.035, 0x7d8a8c, IRON);
    for (const hh of q.hi ? [0.5, 1.0, 1.5] : [0.75, 1.5]) q.box(0, hh, 0, 0.72, 0.02, 0.72, 0x8a9496, IRON);
    q.box(0, 1.56, 0, 0.3, 0.2, 0.3, 0xc8d0d0, WALL);
    q.cyl(0.08, 1.76, 0.06, 0.05, 0.05, 0.22, 0xe8eaea, 10, PAINT);
    q.stacks.push({ x: 0.08, y: 2.01, z: 0.06, size: 1.2, steam: 1 });
    q.beam([0.3, 0.3, 0.2], [0.85, 0.55, 0.55], 0.08, 0.07, 0x9aa4a6, IRON);
  });
  // electric arc furnace hall (front) with solar roof
  k.group(-0.4, G, 0.82, 0, (q) => {
    const W = 1.95, D = 0.9, H = 0.5;
    const w = q.sbox(0, 0, 0, W, H, D, q.hi ? 30 : 1, 1, 1, CLAD, WALL);
    if (q.hi) facets(w, (cx, _y, _z, _nx, _ny, nz) => (Math.abs(nz) > 0.5 && Math.floor((cx + W / 2) / (W / 30)) % 2 ? 0.93 : undefined));
    q.box(0, 0.36, D / 2 + 0.002, W, 0.05, 0.004, TEAL, PAINT);
    q.wins('+z', D / 2, 0.44, -W / 2, W / 2, q.hi ? 10 : 5, 0.12, 0.04, 0x3a5a6a);
    q.quad(0.55, 0.16, D / 2 + 0.004, 0.22, 0.26, '+z', 0xa8b0b2, IRON);
    q.quad(-0.98 - 0.003, 0.14, 0.1, 0.16, 0.18, '-x', 0xffb050, { rough: 1 });
    q.gable(0, H, 0, W, D, 0.14, 0xb9c2c4, IRON, 0, 0.03);
    const slope = Math.atan2(0.14, D / 2 + 0.03);
    const pv = q.add(T(new BoxGeometry(W - 0.15, 0.012, D / 2 - 0.08, q.hi ? 14 : 4, 1, 2), 0, H + 0.075, D / 4 + 0.01, slope, 0, 0), PV, { rough: 0.2, metal: 0.4 });
    facets(pv, (cx, _y, cz, _nx, ny) => (ny > 0.5 ? ((Math.floor((cx + (W - 0.15) / 2) / ((W - 0.15) / 14)) + (cz > D / 4 + 0.01 ? 1 : 0)) % 2 ? PV2 : undefined) : 0x7a8a96));
  });
  // electrolyser hall + rooftop units
  k.group(0.8, G, -0.6, 0, (q) => {
    q.box(0, 0, 0, 1.0, 0.32, 0.55, WHITE, WALL);
    q.box(0, 0.22, 0.2755, 1.0, 0.04, 0.002, TEAL, PAINT);
    q.wins('+z', 0.275, 0.12, -0.45, 0.45, q.hi ? 6 : 3, 0.08, 0.1, 0x3a5a6a);
    q.box(0, 0.32, 0, 1.02, 0.02, 0.57, 0xc8d0d0, IRON);
    for (let i = 0; i < (q.hi ? 5 : 3); i++) {
      const x = -0.4 + (i * 0.8) / (q.hi ? 4 : 2);
      q.box(x, 0.34, 0, 0.12, 0.08, 0.3, 0xd8dcdc, IRON);
      if (q.hi) q.cyl(x, 0.42, 0, 0.04, 0.04, 0.02, 0x5a6a6a, 8, IRON);
    }
  });
  // hydrogen storage spheres
  for (const [x, z] of [[0.75, 0.05], [1.15, 0.05], [0.95, 0.4]] as [number, number][]) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      k.box(x + Math.cos(a) * 0.12, G, z + Math.sin(a) * 0.12, 0.022, 0.18, 0.022, 0x8a9496, IRON);
    }
    k.sph(x, G + 0.3, z, 0.17, 0xf2f3f0, 14, 1, 1, 1, PAINT);
    if (k.hi) k.add(T(new TorusGeometry(0.171, 0.008, 3, 14), x, G + 0.3, z, Math.PI / 2, 0, 0), TEAL, PAINT);
  }
  // heritage stack kept (no smoke), pipe rack, pylon bringing renewable power
  {
    const fr = [0, 0.72, 0.8, 0.88, 0.95, 1];
    const h = 2.2, rb = 0.1, rt = 0.065;
    const g = k.lathe(-1.25, G, -1.2, fr.map((f) => [rb + (rt - rb) * f, f * h] as [number, number]), 0x8a7d70, 10, { rough: 0.85, ao: 0.7 });
    facets(g, (_x, cy) => {
      const f = (cy - G) / h;
      if (f > 0.72 && f < 0.95) return Math.floor((f - 0.72) / 0.08) % 2 === 0 ? 0xb3392b : 0xefe9de;
      return undefined;
    });
    k.cyl(-1.25, G + h - 0.012, -1.2, rt * 1.22, rt * 1.12, 0.035, 0x5a5654, 10);
    k.cyl(-1.25, G, -1.2, rb * 1.4, rb * 1.5, 0.06, 0x8e877c, 10);
  }
  k.pipe([-0.15, 0.5, -0.25], [0.3, 0.5, -0.25], 0.03, 0x5f8a7a, 6, IRON);
  k.pipe([0.3, 0.5, -0.25], [0.3, 0.5, 0.2], 0.03, 0x5f8a7a, 6, IRON);
  for (const x of [0.0, 0.3]) k.box(x, G, -0.25, 0.03, 0.48, 0.03, STEEL, IRON);
  pylon(k, 1.25, -1.2, 1.1);
  stockpile(k, -1.05, -0.05, 0.5, 0.3, 0.18, 61, 0x6a4a3a);
  k.tree(1.3, 1.3, 0.8, 731);
  k.tree(0.95, 1.25, 0.7, 732);
  k.tree(-1.3, 0.2, 0.75, 733);
}

function mMakerspace(k: Kit): void {
  pad(k, 2, 2, 0xb8ae9a);
  // the old blast furnace as a rusted monument (scaled down), with a tree pushing through
  k.group(-0.45, G, -0.45, 0, (q) => {
    q.box(0, 0, 0, 0.6, 0.05, 0.6, CONC_D, MATTE);
    q.cyl(0, 0.05, 0, 0.2, 0.22, 0.16, 0x5a4a40, 12, RUSTY);
    const sh = q.lathe(0, 0.21, 0, [[0.21, 0], [0.22, 0.12], [0.18, 0.55], [0.12, 0.7]], 0x8a5534, 12, RUSTY);
    facets(sh, (cx, cy, cz) => (vnoise(cx * 18 + cy * 5, cz * 18) > 0.58 ? 0x6e4a36 : undefined));
    q.box(0, 0.91, 0, 0.18, 0.12, 0.18, 0x7a5a3f, RUSTY);
    for (const [dx, dz] of [[-0.27, -0.27], [0.27, -0.27], [-0.27, 0.27], [0.27, 0.27]]) q.box(dx, 0.05, dz, 0.03, 1.0, 0.03, RUST, RUSTY);
    for (const hh of [0.45, 1.0]) q.box(0, hh, 0, 0.58, 0.018, 0.58, 0x5a4a40, RUSTY);
    q.beam([0.3, 0.05, 0.3], [0.05, 0.95, 0.05], 0.06, 0.05, 0x7c5a3a, RUSTY);
  });
  k.blobAt(-0.12, G + 0.55, -0.66, 0.13, 741, 0x7f9a50, 0.4, 0.8);
  // converted sawtooth shed: brick, big glass doors, mural band
  k.group(0.42, G, -0.1, 0, (q) => {
    const W = 0.95, D = 0.85, H = 0.32;
    q.box(0, 0, 0, W, H, D, BRICK, WALL);
    q.quad(0, 0.12, D / 2 + 0.003, 0.5, 0.22, '+z', 0x3a5a6a, GLASS);
    if (q.hi) for (const x of [-0.125, 0, 0.125]) q.box(x, 0.0, D / 2 + 0.004, 0.012, 0.23, 0.006, 0x3a3a3a, IRON);
    q.quad(-0.4755 - 0.003, 0.16, 0, 0.6, 0.12, '-x', 0xe0b84a, PAINT);
    if (q.hi) {
      q.quad(-0.4795, 0.16, -0.15, 0.14, 0.1, '-x', 0x3f9a96, PAINT);
      q.quad(-0.4795, 0.16, 0.12, 0.16, 0.08, '-x', 0xd9534f, PAINT);
    }
    q.box(0, H, 0, W + 0.02, 0.02, D + 0.02, 0x7d4330);
    sawtooth(q, 0, H + 0.02, 0, W, D, 4, 0.12, ROOF);
    q.flat(0, H + 0.13, 0, 0.001, 0.001, ROOF);
  });
  // plaza with picnic tables, a ladle sculpture, trees, bunting
  k.box(-0.15, G, 0.62, 1.6, 0.006, 0.55, 0xd6cdb8, MATTE);
  k.put(buildAmbient('picnic', k.d), -0.6, G + 0.006, 0.6, 0.2);
  k.put(buildAmbient('picnic', k.d), 0.05, G + 0.006, 0.75, -0.3);
  k.group(-0.25, G + 0.006, 0.5, 0.4, (q) => {
    q.box(0, 0, 0, 0.16, 0.04, 0.12, CONC, MATTE);
    q.add(T(new CylinderGeometry(0.08, 0.06, 0.12, q.seg(10)), 0, 0.12, 0, 0.3, 0, 0), 0x6e4a36, RUSTY);
  });
  for (const [x, z, s] of [[-0.85, 0.85, 0.8], [0.6, 0.82, 0.75], [0.88, 0.45, 0.7]] as [number, number, number][]) k.tree(x, z, s, Math.round(750 + x * 10));
  if (k.hi) {
    const cols = [0xd9534f, 0xe0b84a, 0x3f9a96, 0x5b7fb0];
    for (let i = 0; i < 8; i++) {
      const t = i / 8;
      k.add(T(new ConeGeometry(0.018, 0.03, 3), -0.15 + t * 0.6, G + 0.36 - 0.05 * Math.sin(Math.PI * t), 0.36, Math.PI, 0, 0), cols[i % 4], MATTE);
    }
    k.beam([-0.16, G + 0.38, 0.36], [0.46, G + 0.38, 0.36], 0.003, 0.003, 0x3a3a3a);
  }
  // old rail line kept in the paving
  k.box(-0.15, G + 0.006, 0.28, 1.6, 0.006, 0.02, 0x8a8a8a, IRON);
}

function mWindport(k: Kit): void {
  pad(k, 2, 2, 0x9a9488);
  k.box(0.94, -0.3, 0, 0.1, 0.36, 1.96, CONC, MATTE);
  // laydown yard: blades on stands, tower sections, nacelles
  for (let i = 0; i < 3; i++) {
    const z = -0.75 + i * 0.16;
    for (const x of [-0.75, -0.05]) k.box(x, G, z, 0.04, 0.05, 0.08, 0x8a8e90, IRON);
    blade(k, -0.85, G + 0.08, z, 1.25, 0);
  }
  for (let i = 0; i < 2; i++) {
    const z = 0.0 + i * 0.22;
    k.cylX(-0.4, G + 0.09, z, 0.085, 0.75, 0xf2f3f0, 12, { rough: 0.4 });
    if (k.hi) k.cylX(-0.4 - 0.376, G + 0.09, z, 0.075, 0.004, 0x5a5e60, 12);
  }
  for (const x of [-0.75, -0.45]) {
    k.box(x, G, 0.62, 0.2, 0.12, 0.13, 0xeef0ee, { rough: 0.4, ao: 0.85 });
    k.box(x, G + 0.06, 0.6855, 0.2, 0.012, 0.002, TEAL, PAINT);
  }
  // crawler crane with lattice boom
  k.group(0.35, G, 0.1, -0.4, (q) => {
    for (const z of [-0.09, 0.09]) q.box(0, 0, z, 0.32, 0.05, 0.06, 0x2a2a2a, MATTE);
    q.box(0, 0.05, 0, 0.24, 0.1, 0.18, 0xe0a030, PAINT);
    q.box(0.08, 0.15, 0.05, 0.08, 0.07, 0.07, 0xe0a030, PAINT);
    q.box(-0.1, 0.15, 0, 0.1, 0.08, 0.16, 0x5a5e60, IRON);
    const base: V3 = [0.1, 0.17, 0], tip: V3 = [0.55, 1.35, 0];
    for (const s of [-1, 1]) q.beam([base[0], base[1], s * 0.04], [tip[0], tip[1], s * 0.015], 0.018, 0.018, 0xe0a030, PAINT);
    if (q.hi) for (let i = 1; i < 8; i++) {
      const t = i / 8;
      const p: V3 = [base[0] + (tip[0] - base[0]) * t, base[1] + (tip[1] - base[1]) * t, 0];
      q.box(p[0], p[1], 0, 0.012, 0.012, 0.08 - t * 0.05, 0xc08a28, PAINT);
    }
    q.beam([-0.12, 0.25, 0], [tip[0], tip[1] + 0.03, 0], 0.005, 0.005, 0x3a3a3a);
    q.beam([tip[0], tip[1], 0], [tip[0], 0.55, 0], 0.004, 0.004, 0x3a3a3a);
    q.box(tip[0], 0.5, 0, 0.04, 0.05, 0.04, 0xe8c02a, PAINT);
  });
  // quay + jack-up installation vessel loaded with blades and towers
  k.box(1.36, 0.05, 0, 0.16, 0.05, 1.7, 0x8a7a66, MATTE);
  for (let z = -0.8; z <= 0.81; z += k.hi ? 0.2 : 0.4) for (const x of [1.31, 1.41]) k.cyl(x, -1.6, z, 0.018, 0.022, 1.65, 0x4a4038, 6, MATTE);
  k.group(1.68, 0, 0.0, 0, (q) => {
    const hull = q.sbox(0, -0.25, 0, 0.42, 0.35, 1.5, 1, 3, 1, 0xffffff, { rough: 0.5, metal: 0.2 });
    facets(hull, (_x, cy, _z, _nx, ny) => (ny > 0.7 ? 0x6a6e70 : cy < -0.12 ? 0x9c2f24 : cy < -0.08 ? 0xe8e4dc : 0x2f4a6a));
    for (const [x, z] of [[-0.17, -0.68], [0.17, -0.68], [-0.17, 0.68], [0.17, 0.68]]) {
      const lg = q.sbox(x, -1.6, z, 0.07, 2.6, 0.07, 1, q.hi ? 10 : 1, 1, 0xe8c02a, PAINT);
      if (q.hi) facets(lg, (_x, cy) => (Math.floor(cy / 0.26) % 2 ? 0xc8a022 : undefined));
    }
    q.box(0, 0.1, -0.55, 0.38, 0.2, 0.22, WHITE, WALL);
    q.quad(0, 0.24, -0.4395, 0.32, 0.04, '+z', 0x3a5a6a, GLASS);
    q.box(0, 0.3, -0.55, 0.12, 0.012, 0.12, 0x5a5e60, IRON);
    for (let i = 0; i < 3; i++) blade(q, -0.14 + i * 0.1, 0.13, 0.62, 1.15, Math.PI / 2);
    for (const x of [-0.1, 0.1]) q.cyl(x, 0.1, 0.05, 0.07, 0.07, 0.5, 0xf2f3f0, 10, { rough: 0.4 });
  });
  // office
  k.group(0.5, G, 0.75, 0, (q) => {
    q.box(0, 0, 0, 0.36, 0.18, 0.2, 0xe0d2b0, WALL);
    q.wins('+z', 0.1, 0.1, -0.15, 0.15, 3, 0.06, 0.06, 0x3a5a6a);
    q.box(0, 0.18, 0, 0.39, 0.02, 0.23, TEAL, IRON);
  });
}

function mSolarlandfill(k: Kit): void {
  pad(k, 2, 2, 0x8a7d60);
  // capped, grassed mound with terraces
  const prof: [number, number][] = [[0.95, 0], [0.85, 0.1], [0.72, 0.12], [0.6, 0.24], [0.45, 0.26], [0.32, 0.36], [0.0, 0.38]];
  const cx0 = -0.05, cz0 = -0.05;
  const m = k.add(T(new LatheGeometry(prof.map(([r, y]) => new Vector2(r, y)), k.seg(20)), cx0, G - 0.01, cz0), 0xffffff, MATTE);
  facets(m, (cx, _y, cz, _nx, ny) => (ny > 0.9 ? (vnoise(cx * 6, cz * 6) > 0.5 ? 0x8aa860 : 0x7f9a55) : 0x9aa86a));
  // panel rows on ballast frames (facing +z), sitting on the cap
  const tilt = 0.4;
  for (const dz of [0.6, 0.36, 0.13, -0.12, -0.38, -0.62]) {
    const half = Math.sqrt(Math.max(0, 0.85 * 0.85 - dz * dz)) * 0.85;
    if (half < 0.15) continue;
    const L = half * 2;
    const nSeg = Math.max(1, Math.round(L / 0.36));
    const sl = L / nSeg;
    for (let j = 0; j < nSeg; j++) {
      const px = -L / 2 + (j + 0.5) * sl;
      const yb = G + Math.min(profH(prof, Math.hypot(px - sl * 0.45, dz)), profH(prof, Math.hypot(px + sl * 0.45, dz)), profH(prof, Math.hypot(px, Math.abs(dz) + 0.06))) - 0.01;
      const n = k.hi ? 3 : 1;
      const pv = k.add(T(new BoxGeometry(sl - 0.03, 0.012, 0.13, n, 1, 1), cx0 + px, yb + 0.06, cz0 + dz, tilt, 0, 0), PV, { rough: 0.2, metal: 0.4 });
      facets(pv, (qx, _y, _z, _nx, ny) => (ny > 0.5 ? (Math.floor((qx - cx0 - px + sl / 2) / ((sl - 0.03) / n)) % 2 ? PV2 : undefined) : 0x7a8a96));
      k.box(cx0 + px, yb - 0.02, cz0 + dz, sl - 0.1, 0.06, 0.06, CONC, MATTE);
    }
  }
  // gas flare (landfill gas still captured) + monitoring wells
  k.group(0.8, G, -0.75, 0, (q) => {
    q.box(0, 0, 0, 0.1, 0.03, 0.1, CONC, MATTE);
    q.cyl(0, 0.03, 0, 0.02, 0.024, 0.36, 0x8a8f92, 8, IRON);
    q.cyl(0, 0.39, 0, 0.03, 0.028, 0.05, 0x5a5a5a, 8, IRON);
    q.stacks.push({ x: 0, y: 0.47, z: 0, size: 0.3, steam: 0.5 });
  });
  for (const [x, z] of [[-0.7, -0.6], [0.55, -0.45], [-0.4, 0.75]] as [number, number][]) k.cyl(x, G, z, 0.012, 0.012, 0.07, WHITE, 5, PAINT);
  k.group(-0.75, G, 0.85, 0, (q) => {
    q.box(0, 0, 0, 0.26, 0.11, 0.1, WHITE, WALL);
    q.box(0, 0.07, 0.0505, 0.26, 0.02, 0.002, TEAL, PAINT);
  });
  fenceRect(k, -0.96, -0.96, 0.96, 0.96, 0x9a9e9a, 0.08, 0.24, true);
  k.put(buildAmbient('sheep', k.d), 0.55, G + 0.03, 0.75, 1.0);
  k.put(buildAmbient('sheep', k.d), 0.75, G + 0.03, 0.55, 2.4);
}

function mBatteryhub(k: Kit): void {
  pad(k, 2, 2, 0xb3ad9f);
  // the old turbine hall shell kept (brick, gable), now the control centre
  k.group(-0.4, G, -0.55, 0, (q) => {
    q.box(0, 0, 0, 0.95, 0.42, 0.6, 0xb08060, WALL);
    q.wins('+z', 0.3, 0.26, -0.45, 0.45, q.hi ? 7 : 4, 0.07, 0.22, 0x3a5a6a, 0xe0d2b0);
    q.wins('-x', -0.475, 0.26, -0.25, 0.25, 3, 0.07, 0.22, 0x3a5a6a);
    q.gable(0, 0.42, 0, 0.95, 0.6, 0.12, 0x8d949a, IRON);
    const pv = q.add(T(new BoxGeometry(0.85, 0.01, 0.26, q.hi ? 8 : 2, 1, 1), 0, 0.485, 0.15, Math.atan2(0.12, 0.33), 0, 0), PV, { rough: 0.2, metal: 0.4 });
    facets(pv, (cx, _y, _z, _nx, ny) => (ny > 0.5 ? (Math.floor((cx + 0.425) / (0.85 / 8)) % 2 ? PV2 : undefined) : 0x7a8a96));
  });
  // stumps of the demolished stacks (heritage bases)
  for (const x of [0.4, 0.72]) k.cyl(x, G, -0.75, 0.11, 0.12, 0.14, 0x9a948a, 12, WALL);
  // battery containers where the cooling tower stood
  for (let r = 0; r < (k.hi ? 3 : 2); r++) for (let c = 0; c < 3; c++) {
    k.group(-0.05 + c * 0.34, G, 0.05 + r * 0.24, 0, (q) => {
      q.box(0, 0, 0, 0.3, 0.015, 0.18, CONC, MATTE);
      const b = q.sbox(0, 0.015, 0, 0.28, 0.13, 0.15, q.hi ? 8 : 1, 1, 1, WHITE, { ao: 0.85, rough: 0.5 });
      if (q.hi) facets(b, (cx, cy, _z, _nx, _ny, nz) => (Math.abs(nz) > 0.5 && cy > 0.04 && cy < 0.11 && Math.floor((cx + 0.14) / 0.035) % 2 ? 0x9aa4a6 : undefined));
      q.box(0, 0.09, 0.0755, 0.28, 0.012, 0.002, TEAL, PAINT);
      q.box(0, 0.145, 0, 0.28, 0.01, 0.15, 0xdcdedc, PAINT);
    });
  }
  // cooling pond kept as a wetland edge
  k.box(-0.6, G, 0.55, 0.62, 0.025, 0.55, CONC, MATTE);
  k.flat(-0.6, G + 0.026, 0.55, 0.56, 0.49, WATER);
  reedClump(k, -0.82, 0.35, 761, 6);
  reedClump(k, -0.4, 0.75, 762, 6);
  // switchyard + grid connection
  k.box(0.6, G, 0.85, 0.6, 0.008, 0.18, GRAVEL, MATTE);
  for (const x of [0.45, 0.75]) k.box(x, G, 0.85, 0.08, 0.08, 0.07, 0x5a6a5c, IRON);
  pylon(k, 0.88, -0.35, 0.9);
  fenceRect(k, -0.96, -0.96, 0.96, 0.96, 0x9a9e9a, 0.08, 0.22, true);
}

function mCommunityhub(k: Kit): void {
  pad(k, 2, 2, 0xd6cdb8);
  // brick shell of the old power station with big new glazing and a green roof
  k.group(-0.25, G, -0.35, 0, (q) => {
    const W = 1.15, D = 0.7, H = 0.5;
    q.box(0, 0, 0, W, H, D, 0xb07050, WALL);
    q.quad(-0.15, 0.2, D / 2 + 0.003, 0.7, 0.34, '+z', 0x3a5a6a, GLASS);
    if (q.hi) for (const x of [-0.45, -0.27, -0.09, 0.09, 0.15]) q.box(x + 0.0, 0.03, D / 2 + 0.004, 0.012, 0.34, 0.006, 0x3a3a3a, IRON);
    q.wins('+z', D / 2, 0.25, 0.27, 0.53, 2, 0.08, 0.3, 0x3a5a6a, 0xe0d2b0);
    q.wins('-x', -W / 2, 0.25, -0.25, 0.25, 3, 0.08, 0.3, 0x3a5a6a, 0xe0d2b0);
    q.box(0, H, 0, W + 0.03, 0.04, D + 0.03, 0x8a5a44);
    const gr = q.add(T(blob(0.5, q.hi ? 1 : 0, 771, 0.35, 0.12), -0.1, H + 0.05, 0.05, 0, 0, 0, 1.0, 1, 0.6), 0x7f9a50, MATTE);
    facets(gr, (cx, cy, cz) => (cy < H + 0.035 ? 0x6a5a48 : vnoise(cx * 12, cz * 12) > 0.6 ? 0x9aa84a : undefined));
    for (let i = 0; i < (q.hi ? 4 : 2); i++) q.blobAt(-0.4 + i * 0.22, H + 0.1, -0.05 + (i % 2) * 0.12, 0.06, 772 + i, i % 2 ? WATTLE : 0x6f8a44, 0.4, 0.8);
    q.box(0.42, H + 0.04, 0.0, 0.2, 0.012, 0.55, PV, { rough: 0.2, metal: 0.4 });
  });
  // stack cut down to a lookout tower with a viewing deck
  k.group(0.65, G, -0.6, 0, (q) => {
    q.lathe(0, 0, 0, [[0.12, 0], [0.1, 0.75], [0.095, 0.8]], 0x9a8a78, 12, WALL);
    q.cyl(0, 0.8, 0, 0.17, 0.17, 0.025, 0x5a6a6a, 12, IRON);
    if (q.hi) for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      q.box(Math.cos(a) * 0.16, 0.825, Math.sin(a) * 0.16, 0.008, 0.06, 0.008, 0x5a6a6a, IRON);
    }
    q.add(T(new TorusGeometry(0.16, 0.006, 3, q.seg(16)), 0, 0.885, 0, Math.PI / 2, 0, 0), 0x5a6a6a, IRON);
  });
  // plaza: trees, benches, playground, sign
  for (const [x, z, s] of [[-0.8, 0.45, 0.8], [0.2, 0.75, 0.75], [0.85, 0.2, 0.8], [-0.35, 0.85, 0.65]] as [number, number, number][]) {
    k.cyl(x, G, z, 0.09, 0.09, 0.03, 0x8a7a64, 10, MATTE);
    k.tree(x, z, s, Math.round(780 + x * 10 + z * 3), G + 0.03);
  }
  k.put(buildAmbient('picnic', k.d), -0.3, G, 0.4, 0.3);
  k.group(0.55, G, 0.55, 0.3, (q) => {
    q.box(0, 0, 0, 0.36, 0.006, 0.28, 0xd9a43a, MATTE);
    for (const x of [-0.1, 0.1]) q.box(x, 0, -0.06, 0.015, 0.16, 0.015, 0xd9534f, PAINT);
    q.box(0, 0.16, -0.06, 0.24, 0.015, 0.015, 0xd9534f, PAINT);
    q.box(0.0, 0.0, 0.06, 0.06, 0.1, 0.06, 0x3f9a96, PAINT);
    q.rbox(0.08, 0.07, 0.08, 0.14, 0.01, 0.05, 0xe8c02a, 0, 0, -0.5, PAINT);
  });
  k.group(-0.75, G, 0.88, 0.2, (q) => {
    for (const x of [-0.08, 0.08]) q.box(x, 0, 0, 0.015, 0.14, 0.015, TIMBER, MATTE);
    q.box(0, 0.1, 0.005, 0.22, 0.08, 0.012, TEAL, PAINT);
    q.quad(0, 0.14, 0.0115, 0.16, 0.02, '+z', WHITE, PAINT);
  });
}

function mRecycler(k: Kit): void {
  pad(k, 2, 2, 0xa8a196);
  const CLAD = 0x7fa89a;
  // main sorting shed
  k.group(-0.25, G, -0.35, 0, (q) => {
    const W = 1.2, D = 0.8, H = 0.45;
    const w = q.sbox(0, 0, 0, W, H, D, q.hi ? 24 : 1, 1, q.hi ? 16 : 1, CLAD, WALL);
    if (q.hi) facets(w, (cx, _y, cz, nx) => (Math.floor((Math.abs(nx) > 0.5 ? cz : cx) * 20 + 40) % 2 ? 0.92 : undefined));
    q.box(0, 0.33, D / 2 + 0.002, W, 0.04, 0.004, WHITE, PAINT);
    for (const x of [-0.35, 0.05]) q.quad(x, 0.13, D / 2 + 0.004, 0.22, 0.26, '+z', 0x9ab0aa, IRON);
    q.gable(0, H, 0, W, D, 0.12, 0xb9c2c4, IRON, 0, 0.03);
    const slope = Math.atan2(0.12, D / 2 + 0.03);
    const pv = q.add(T(new BoxGeometry(W - 0.1, 0.012, D / 2 - 0.08, q.hi ? 10 : 3, 1, 1), 0, H + 0.065, D / 4 + 0.01, slope, 0, 0), PV, { rough: 0.2, metal: 0.4 });
    facets(pv, (cx, _y, _z, _nx, ny) => (ny > 0.5 ? (Math.floor((cx + (W - 0.1) / 2) / ((W - 0.1) / 10)) % 2 ? PV2 : undefined) : 0x7a8a96));
  });
  // infeed conveyor + hopper
  k.box(0.65, G, -0.55, 0.22, 0.14, 0.2, 0x5a6a6a, IRON);
  k.beam([0.6, 0.18, -0.55], [0.36, 0.42, -0.45], 0.08, 0.05, 0x5f8a7a, IRON);
  k.box(0.65, G + 0.14, -0.55, 0.26, 0.04, 0.24, 0x3f6b5a, IRON);
  // bales of sorted material
  const bales: [number, number][] = [[0.15, 0.3], [0.32, 0.3], [0.49, 0.3], [0.15, 0.47], [0.32, 0.47], [0.49, 0.47], [0.75, 0.3], [0.75, 0.47]];
  const mats = [0x5b7fb0, 0xb8bcc0, 0x4a8a5a, 0xa8865a, 0xd9534f];
  const rnd = mulberry32(81);
  bales.slice(0, k.hi ? bales.length : 4).forEach(([x, z], i) => {
    const c = mats[i % mats.length];
    const b = k.sbox(x, G, z, 0.14, 0.11, 0.14, 1, k.hi ? 3 : 1, 1, c, { rough: 0.9, ao: 0.8 });
    if (k.hi) facets(b, () => (rnd() > 0.5 ? 0.85 : 1.08));
    if (k.hi && i % 3 === 0) k.sbox(x, G + 0.11, z, 0.14, 0.11, 0.14, 1, 1, 1, mats[(i + 2) % mats.length], { rough: 0.9, ao: 0.8 });
  });
  // skip bins + truck + sign
  for (const [x, z, c] of [[-0.7, 0.4, 0x3f6b8a], [-0.45, 0.42, 0xe0a030], [-0.2, 0.44, 0x4a8a5a]] as [number, number, number][]) {
    k.add(T(new CylinderGeometry(0.1, 0.075, 0.18, 4, 1), x, G + 0.045, z, Math.PI / 2, Math.PI / 4, 0, 1, 1, 0.55), c, PAINT);
  }
  k.put(buildAmbient('truck', k.d), 0.2, G, 0.82, 0, 0x4a8a5a);
  k.group(-0.8, G, 0.85, 0.2, (q) => {
    for (const x of [-0.08, 0.08]) q.box(x, 0, 0, 0.015, 0.14, 0.015, 0x8a8e90, IRON);
    q.box(0, 0.1, 0.005, 0.22, 0.08, 0.012, 0x4a8a5a, PAINT);
    q.quad(0, 0.14, 0.0115, 0.04, 0.04, '+z', WHITE, PAINT);
  });
  fenceRect(k, -0.96, -0.96, 0.96, 0.96, 0x9a9e9a, 0.08, 0.24, true);
}


// ================================================================== Round 2: water, climate adaptation, biomes

/** Add a biome vegetation geometry (strips its foliage-shader `sphn` so it merges with building parts). */
function veg(k: Kit, g: BufferGeometry, x: number, y: number, z: number, s = 1, ry = 0): void {
  g.deleteAttribute('sphn');
  k.put(g, x, y, z, ry, 0xffffff, s);
}

/** Aussie windmill water pump (Southern Cross style), local origin at ground. */
function windmill(q: Kit, H: number): void {
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) q.beam([sx * 0.07, 0, sz * 0.07], [sx * 0.018, H, sz * 0.018], 0.01, 0.01, 0xb8b8b0, IRON);
  if (q.hi) for (const yy of [H * 0.26, H * 0.54, H * 0.8]) {
    const r = 0.07 + (0.018 - 0.07) * (yy / H);
    q.box(0, yy, r, r * 2, 0.006, 0.006, 0xb8b8b0, IRON);
    q.box(r, yy, 0, 0.006, 0.006, r * 2, 0xb8b8b0, IRON);
  }
  q.box(0, H, 0, 0.05, 0.03, 0.08, 0x9a9a92, IRON);
  const wheel = q.add(T(new CylinderGeometry(0.15, 0.15, 0.012, q.seg(16)), 0, H + 0.02, 0.06, Math.PI / 2, 0, 0), 0xe8e6de, IRON);
  facets(wheel, (cx, cy) => (Math.floor(((Math.atan2(cy - H - 0.02, cx) + Math.PI) / (Math.PI * 2)) * 16) % 2 ? 0x9aa0a0 : undefined));
  q.cyl(0, H + 0.02, 0.07, 0.03, 0.03, 0.012, 0x6f7575, 8);
  q.rbox(0, H + 0.03, -0.14, 0.006, 0.08, 0.14, 0xd8d4c8, 0, 0, 0, IRON);
}

/** Corrugated steel tank on a timber stand. */
function standTank(k: Kit, x: number, z: number, r: number, h: number, standH: number): void {
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.box(x + sx * r * 0.7, G, z + sz * r * 0.7, 0.025, standH, 0.025, TIMBER, MATTE);
  k.box(x, G + standH, z, r * 2.1, 0.02, r * 2.1, TIMBER, MATTE);
  const t = k.cyl(x, G + standH + 0.02, z, r, r, h, 0xb7bdbd, 10, IRON, k.hi ? 4 : 1);
  facets(t, (_x, cy, _z, _nx, ny) => (Math.abs(ny) < 0.5 && Math.floor((cy - standH) / (h / 4)) % 2 ? 0.86 : undefined));
  k.cone(x, G + standH + 0.02 + h, z, r * 1.05, r * 0.4, 0xa7adad, 12, IRON);
}

/** Double-sided triangle (shade sails). */
function sail(k: Kit, a: V3, b: V3, c: V3, col: ColorLike): void {
  k.add(polys([{ p: [a, b, c], n: [0, 1, 0] }, { p: [a, b, c], n: [0, -1, 0] }]), col, MATTE);
}

function mReservoir(k: Kit): void {
  pad(k, 2, 2, LAWN);
  const cx = 0.05, cz = -0.08;
  // earth embankment ring: grassy outer batter, gravel crest road, concrete-lined inner face
  const prof: [number, number][] = [[0.88, 0], [0.74, 0.26], [0.66, 0.26], [0.5, 0.06]];
  const emb = k.add(T(new LatheGeometry(prof.map(([r, y]) => new Vector2(r, y)), k.seg(24)), cx, G - 0.01, cz, 0, 0, 0, 1, 1, 0.92), 0xffffff, MATTE);
  facets(emb, (x, y, z, nx, ny, nz) => {
    if (ny > 0.95) return GRAVEL;
    const out = nx * (x - cx) + nz * (z - cz) > 0;
    return out ? (vnoise(x * 6, z * 6) > 0.5 ? 0x86a35a : 0x7a9850) : 0xbcb6a8;
  });
  k.add(T(new CylinderGeometry(0.6, 0.6, 0.02, k.seg(24)), cx, G + 0.18, cz, 0, 0, 0, 1, 1, 0.92), WATER, GLASS);
  // intake tower in the water + access footbridge from the crest
  k.cyl(cx + 0.18, G, cz - 0.05, 0.07, 0.08, 0.36, CONC_L, 10, WALL);
  k.cyl(cx + 0.18, G + 0.36, cz - 0.05, 0.085, 0.085, 0.02, 0x5f7f7a, 10, IRON);
  k.beam([cx + 0.18, G + 0.37, cz - 0.05], [cx + 0.68, G + 0.27, cz - 0.05], 0.04, 0.015, 0x8a8e90, IRON);
  if (k.hi) for (const s of [-1, 1]) k.beam([cx + 0.24, G + 0.42, cz - 0.05 + s * 0.02], [cx + 0.68, G + 0.32, cz - 0.05 + s * 0.02], 0.004, 0.004, 0xe8c02a);
  // inlet pipe from the river (comes in from the -x edge) over the embankment
  k.pipe([-0.98, G + 0.05, 0.62], [-0.55, G + 0.05, 0.62], 0.035, 0x6f7a7c, 8, IRON);
  k.pipe([-0.55, G + 0.05, 0.62], [-0.55, G + 0.28, 0.3], 0.035, 0x6f7a7c, 8, IRON);
  k.pipe([-0.55, G + 0.28, 0.3], [-0.42, G + 0.2, 0.16], 0.035, 0x6f7a7c, 8, IRON);
  for (const z of [0.62]) for (const x of [-0.85, -0.65]) k.box(x, G, z, 0.06, 0.04, 0.06, CONC, MATTE);
  // valve house at the front with outlet main
  k.group(0.55, G, 0.78, 0, (q) => {
    q.box(0, 0, 0, 0.3, 0.17, 0.2, BRICK_L, WALL);
    q.quad(0, 0.07, 0.1005 + 0.002, 0.06, 0.11, '+z', 0x3f6b8a, PAINT);
    q.wins('-x', -0.15, 0.11, -0.05, 0.05, 1, 0.05, 0.04, GLASSC);
    q.hip(0, 0.17, 0, 0.3, 0.2, 0.07, ROOF_GRN, IRON);
  });
  k.pipe([0.35, G + 0.05, 0.78], [-0.98, G + 0.05, 0.9], 0.03, 0x3f6b8a, 6, IRON);
  if (k.hi) k.cyl(0.25, G + 0.02, 0.8, 0.03, 0.03, 0.06, 0xb3392b, 6, PAINT);
  fenceRect(k, -0.96, -0.96, 0.96, 0.96, 0x9a9e9a, 0.08, 0.24, true);
  k.tree(-0.85, -0.85, 0.85, 801);
  k.tree(0.86, -0.82, 0.75, 802);
}

function mDripfarm(k: Kit): void {
  pad(k, 2, 2, 0x8a6e4a);
  // neat raised crop beds with black drip lines
  const x0 = -0.92, x1 = 0.4;
  const rows = k.hi ? 9 : 6;
  for (let i = 0; i < rows; i++) {
    const z = -0.88 + ((i + 0.5) * 1.76) / rows;
    k.box((x0 + x1) / 2, G, z, x1 - x0, 0.03, 0.1, 0x6a4f34, MATTE);
    const crop = k.sbox((x0 + x1) / 2, G + 0.03, z, x1 - x0 - 0.04, 0.035, 0.07, k.hi ? 14 : 4, 1, 1, 0x6fa040, MATTE);
    facets(crop, (cx, _y, _z, _nx, ny) => (ny > 0.5 && Math.floor((cx - x0) / ((x1 - x0) / 14)) % 2 ? 0x82b04c : undefined));
    for (const s of [-1, 1]) k.box((x0 + x1) / 2, G + 0.03, z + s * 0.042, x1 - x0, 0.008, 0.008, 0x1e1e1e, { rough: 0.4 });
  }
  // header main + soil-moisture sensor posts with tiny panels
  k.pipe([x1 + 0.03, G + 0.02, -0.9], [x1 + 0.03, G + 0.02, 0.9], 0.018, 0x2a2a2a, 5, MATTE);
  for (const [x, z] of [[-0.6, -0.5], [-0.2, 0.1], [0.15, 0.62], [-0.7, 0.45]] as [number, number][]) {
    k.box(x, G + 0.03, z, 0.012, 0.12, 0.012, WHITE, PAINT);
    k.rbox(x, G + 0.16, z, 0.04, 0.005, 0.03, PV, 0.5, 0, 0, GLASS);
  }
  // solar pump: array on a frame + pump box + header tank
  k.group(0.72, G, -0.55, 0, (q) => {
    const pv = q.add(T(new BoxGeometry(0.42, 0.012, 0.22, q.hi ? 4 : 1, 1, 2), 0, 0.16, 0, 0.45, 0, 0), PV, { rough: 0.2, metal: 0.4 });
    facets(pv, (cx, _y, cz, _nx, ny) => (ny > 0.5 ? ((Math.floor((cx + 0.21) / 0.105) + (cz > 0 ? 1 : 0)) % 2 ? PV2 : undefined) : 0x7a8a96));
    for (const x of [-0.17, 0.17]) {
      q.box(x, 0, -0.06, 0.016, 0.21, 0.016, 0x8a8e90, IRON);
      q.box(x, 0, 0.06, 0.016, 0.12, 0.016, 0x8a8e90, IRON);
    }
    q.box(0, 0, 0.22, 0.12, 0.09, 0.08, 0x3f6b8a, PAINT);
  });
  k.put(buildAmbient('watertank', k.d), 0.82, G, -0.08, 0, 0xffffff, 1.2);
  // tidy colorbond shed
  k.group(0.68, G, 0.48, 0, (q) => {
    q.box(0, 0, 0, 0.42, 0.22, 0.32, 0x5f7f6a, { ao: 0.8, rough: 0.5, metal: 0.4 });
    q.quad(0, 0.09, 0.1605, 0.2, 0.17, '+z', 0xc8ccc8, IRON);
    q.gable(0, 0.22, 0, 0.42, 0.32, 0.08, 0xd8dcd8, IRON);
    q.rbox(0, 0.32, 0.07, 0.34, 0.01, 0.14, PV, Math.atan2(0.08, 0.19), 0, 0, GLASS);
  });
  k.put(buildAmbient('truck', k.d), 0.65, G, 0.85, 0, 0xe8e4da, 0.8);
  k.tree(0.9, 0.12, 0.75, 811);
}

function mFishway(k: Kit): void {
  // River tile at a weir. y = 0 is the crest / upstream water level; flow runs toward +Z (the lower river tile).
  const crestZ = 0.18, dropY = -0.3;
  // weir wall across the river, footing down into the bed
  k.box(0, -0.7, crestZ, 1.0, 0.72, 0.1, CONC, WALL);
  // stepped downstream face (water sheets over the left part)
  for (let i = 0; i < 3; i++) {
    const y = -0.1 - i * 0.1, z = crestZ + 0.08 + i * 0.08;
    k.box(-0.13, -0.7, z, 0.74, 0.7 + y, 0.08, CONC_L, MATTE);
    k.box(-0.15, y, z, 0.68, 0.012, 0.081, 0xeef6f4, GLASS);
    k.quad(-0.15, y - 0.05, z + 0.041, 0.68, 0.1, '+z', 0xd8eeea, GLASS);
  }
  // overflow sheet on the crest + upstream water skin
  k.box(-0.15, 0.005, crestZ, 0.68, 0.01, 0.1, 0xd8eeea, GLASS);
  k.flat(-0.15, -0.004, -0.17, 0.68, 0.6, WATER, GLASS);
  // vertical-slot fishway along the +x bank: stepped pools descending downstream
  const fx0 = 0.22, fx1 = 0.47, n = k.hi ? 6 : 4;
  const za = -0.45, zb = 0.5;
  for (const x of [fx0, fx1]) k.box(x, -0.7, (za + zb) / 2, 0.035, 0.76, zb - za, CONC, WALL);
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const z0 = za + (zb - za) * t0, z1 = za + (zb - za) * t1;
    const wy = -0.02 + (dropY + 0.02) * (i / (n - 1));
    k.box((fx0 + fx1) / 2, -0.7, (z0 + z1) / 2, fx1 - fx0 - 0.035, 0.7 + wy - 0.06, z1 - z0, CONC_D, MATTE);
    k.flat((fx0 + fx1) / 2, wy, (z0 + z1) / 2, fx1 - fx0 - 0.04, z1 - z0, i % 2 ? WATER : 0x5aa8a4, GLASS);
    if (i < n - 1) {
      // baffle with a vertical slot near the inner wall
      const bw = fx1 - fx0 - 0.035;
      const slot = 0.035;
      k.box(fx0 + 0.0175 + (bw - slot) / 2 + slot, wy - 0.08, z1, bw - slot, 0.14, 0.02, CONC_L, MATTE);
      k.quad(fx0 + 0.0175 + slot / 2, wy - 0.01, z1 + 0.011, slot, 0.05, '+z', 0xd8eeea, GLASS);
    }
  }
  // handrail along the outer wall + walkway on the weir crest
  const hy = 0.06 + 0.1;
  for (let i = 0; i <= (k.hi ? 6 : 3); i++) {
    const z = za + ((zb - za) * i) / (k.hi ? 6 : 3);
    k.box(fx1, 0.06, z, 0.01, 0.1, 0.01, 0xe8c02a, PAINT);
  }
  k.beam([fx1, hy, za], [fx1, hy, zb], 0.008, 0.008, 0xe8c02a, PAINT);
  k.box(0.0, 0.0, crestZ - 0.07, 1.0, 0.04, 0.05, CONC_L, MATTE);
  // abutments at the banks
  for (const x of [-0.48]) k.box(x, -0.7, crestZ, 0.06, 0.86, 0.3, CONC, WALL);
  if (k.hi) for (let i = 0; i < 3; i++) k.blobAt(-0.4 + i * 0.12, dropY - 0.02, 0.45, 0.05, 820 + i, 0x8a8478, 0.4, 0.6);
}

function mSeawall(k: Kit): void {
  // landward pad only (x < 0.14); the seaward strip is the stepped wall itself
  const lp = k.box(-0.18, -0.3, 0, 0.64, 0.3 + G, 0.98, 0xd9c99a, MATTE);
  facets(lp, (_x, _y, _z, _nx, ny) => (ny < 0.5 ? 0.72 : undefined));
  // promenade: paved path + lawn strip behind
  k.box(-0.32, G, 0, 0.3, 0.01, 0.98, LAWN, MATTE);
  const path = k.sbox(-0.02, G, 0, 0.3, 0.012, 0.98, 1, 1, k.hi ? 10 : 1, 0xd6cdb8, MATTE);
  facets(path, (_x, _y, cz, _nx, ny) => (ny > 0.5 && Math.floor((cz + 0.49) / 0.098) % 2 ? 0.93 : undefined));
  // stepped concrete wall down to the sea (+x)
  const steps: [number, number][] = [[0.18, -0.04], [0.28, -0.14], [0.38, -0.24]];
  for (const [x, y] of steps) k.box(x, -0.5, 0, 0.1, 0.5 + y, 0.98, CONC_L, { ao: 0.75 });
  k.box(0.14, G, 0, 0.03, 0.06, 0.98, CONC, WALL);
  // rock armour at the toe
  const n = k.hi ? 9 : 5;
  for (let i = 0; i < n; i++) k.blobAt(0.46 + (i % 2) * 0.04, -0.3, -0.45 + (i * 0.9) / (n - 1), 0.07 + (i % 3) * 0.012, 830 + i, [0x8a8478, 0x9a9288, 0x7a746a][i % 3], 0.45, 0.65);
  // railing, benches, lamp, a pine
  for (let i = 0; i <= (k.hi ? 6 : 3); i++) k.box(0.12, G + 0.01, -0.45 + (i * 0.9) / (k.hi ? 6 : 3), 0.01, 0.09, 0.01, 0x5f8a7a, IRON);
  k.beam([0.12, G + 0.1, -0.46], [0.12, G + 0.1, 0.46], 0.008, 0.008, 0x5f8a7a, IRON);
  for (const z of [-0.25, 0.3]) {
    k.box(-0.18, G + 0.03, z, 0.05, 0.01, 0.14, TIMBER_L, MATTE);
    k.box(-0.2, G + 0.04, z, 0.01, 0.04, 0.14, TIMBER_L, MATTE);
    for (const dz of [-0.05, 0.05]) k.box(-0.18, G, z + dz, 0.04, 0.03, 0.01, 0x5a5a5a, IRON);
  }
  k.put(buildAmbient('streetlight', k.d), -0.17, G, 0.02, Math.PI);
  k.tree(-0.36, -0.38, 0.75, 840, G, [0x5f7a48, 0x6f8a50]);
  if (k.hi) k.put(buildAmbient('bin', 1), -0.2, G, 0.45, 0);
}

function thatchHut(k: Kit, w: number, d: number, h: number): void {
  // timber hut on stilts with a steep thatched hip roof
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.box(sx * (w / 2 - 0.02), 0, sz * (d / 2 - 0.02), 0.02, 0.06, 0.02, TIMBER, MATTE);
  k.box(0, 0.06, 0, w + 0.06, 0.015, d + 0.08, TIMBER_L, MATTE);
  k.box(0, 0.075, 0, w, h, d, 0xd8b884, WALL);
  k.quad(0, 0.075 + h * 0.45, d / 2 + 0.003, w * 0.5, h * 0.7, '+z', 0x6a4a2e, PAINT);
  const r = k.hip(0, 0.075 + h, 0, w, d, h * 1.3, 0xc9a060, { rough: 0.95 }, 0, 0.06);
  facets(r, (_x, cy) => (Math.floor(cy * 70) % 2 ? 0.86 : undefined));
}

function mResort(k: Kit): void {
  pad(k, 2, 2, 0xb8c070);
  k.box(0, G, 0.62, 1.96, 0.005, 0.7, SAND, MATTE);
  // main lodge
  k.group(-0.45, G, -0.48, 0, (q) => thatchHut(q, 0.6, 0.4, 0.16));
  // bungalows
  for (const [x, z, ry] of [[0.35, -0.62, 0.2], [0.78, -0.3, -0.3], [0.8, 0.22, -0.6], [-0.85, 0.15, 0.4]] as [number, number, number][]) k.group(x, G, z, ry, (q) => thatchHut(q, 0.24, 0.22, 0.1));
  // freeform pool + timber deck
  k.shape(blobShape(0.36, 0.2, 21, k.hi ? 16 : 9, 0.15), -0.05, G + 0.01, 0.12, TIMBER_L, MATTE);
  const pool = k.shape(blobShape(0.3, 0.15, 21, k.hi ? 16 : 9, 0.15), -0.05, G + 0.013, 0.12, 0x56c8d0, GLASS);
  facets(pool, (cx, _y, cz) => (vnoise(cx * 10, cz * 10) > 0.6 ? 0x7ad8dc : undefined));
  // umbrellas + loungers on the sand
  const ucol = [0xd9534f, 0xe8c547, 0x3f9a96, 0xf2f2ea];
  for (let i = 0; i < (k.hi ? 4 : 2); i++) {
    const x = -0.65 + i * 0.42, z = 0.7;
    k.cyl(x, G, z, 0.004, 0.004, 0.13, 0xe8e4da, 4);
    k.cone(x, G + 0.12, z, 0.08, 0.035, ucol[i], 8, MATTE);
    k.rbox(x + 0.07, G + 0.025, z + 0.03, 0.11, 0.01, 0.04, 0xf2f2ea, 0, 0.3, 0.15, MATTE);
  }
  // boardwalk path lodge→beach
  k.add(ribbon([[-0.45, -0.25], [-0.35, -0.05], [-0.4, 0.3], [-0.3, 0.55]], 0.07, G + 0.006), TIMBER_L, MATTE);
  // palms
  const palms: [number, number, number, number][] = [[-0.82, -0.82, 0.9, 0.3], [0.05, -0.85, 0.75, 2.1], [0.55, 0.62, 0.85, 4.2], [-0.92, 0.62, 0.8, 1.0], [0.38, 0.05, 0.7, 5.2]];
  palms.slice(0, k.hi ? 5 : 3).forEach(([x, z, s, ry], i) => veg(k, palmGeo(k.d, (i % 2) as 0 | 1), x, G, z, s * 0.55, ry));
}

function mCoralnursery(k: Kit): void {
  // Sea tiles: y = 0 is the water surface. PVC "coral trees" hang mid-water, tethered to the seabed.
  const CORAL = [0xf08a7a, 0xe8b04a, 0xb48ad8, 0x6ad0c0, 0xf2a0c8, 0xe86a5a];
  const rnd = mulberry32(851);
  const trees: [number, number][] = k.hi ? [[-0.55, -0.5], [0.0, -0.55], [0.55, -0.45], [-0.5, 0.1], [0.05, 0.05], [0.55, 0.15]] : [[-0.5, -0.45], [0.4, -0.4], [-0.3, 0.15], [0.45, 0.2]];
  for (const [x, z] of trees) {
    k.pipe([x, -1.6, z], [x, -0.42, z], 0.004, 0x3a3a3a, 3, MATTE);
    k.cyl(x, -1.62, z, 0.05, 0.06, 0.05, CONC_D, 6, MATTE);
    k.cyl(x, -0.45, z, 0.008, 0.008, 0.37, 0xf2f2ea, 5, PAINT);
    k.sph(x, -0.06, z, 0.035, 0xe8c02a, 8, 1, 1, 1, PAINT);
    for (const y of [-0.38, -0.26, -0.14]) {
      const a = rnd() * Math.PI;
      for (const s of [-1, 1]) {
        const ex = x + Math.cos(a) * 0.12 * s, ez = z + Math.sin(a) * 0.12 * s;
        k.beam([x, y, z], [ex, y, ez], 0.008, 0.008, 0xf2f2ea, PAINT);
        for (let j = 0; j < (k.hi ? 2 : 1); j++) {
          const t = 0.45 + j * 0.45;
          k.blobAt(x + (ex - x) * t, y - 0.03, z + (ez - z) * t, 0.022, 860 + Math.floor(rnd() * 100), CORAL[Math.floor(rnd() * CORAL.length)], 0.5, 0.9);
        }
      }
    }
  }
  // marker buoys at the corners
  for (const [x, z] of [[-0.88, -0.88], [0.88, -0.88], [-0.88, 0.88], [0.88, 0.88]] as [number, number][]) {
    k.sph(x, 0.0, z, 0.05, 0xe8c02a, 8, 1, 0.8, 1, PAINT);
    k.cyl(x, 0.03, z, 0.006, 0.006, 0.09, 0x2a2a2a, 4);
    k.box(x, 0.12, z, 0.03, 0.03, 0.004, 0xe8c02a, PAINT);
    k.pipe([x, -1.6, z], [x, -0.03, z], 0.003, 0x3a3a3a, 3, MATTE);
  }
  // dive boat on a mooring
  k.put(buildAmbient('boat', k.d), -0.1, 0, 0.68, 0.15, 0xe8f0ee, 1.1);
  k.sph(0.35, 0.0, 0.7, 0.03, 0xd9534f, 6, 1, 0.8, 1, PAINT);
  k.beam([0.35, 0.01, 0.7], [0.17, 0.03, 0.7], 0.003, 0.003, 0x3a3a3a);
  if (k.hi) {
    k.box(-0.12, 0.1, 0.62, 0.04, 0.012, 0.012, 0xd9534f, PAINT);
    k.box(-0.12, 0.1, 0.6, 0.006, 0.05, 0.006, 0xe8e4da);
  }
}

function mBore(k: Kit): void {
  pad(k, 1, 1, 0xb5653a);
  const p = k.box(0, G, 0, 0.9, 0.003, 0.9, 0xb5653a, MATTE);
  void p;
  k.group(-0.22, G, -0.2, 0.6, (q) => windmill(q, 0.62));
  k.box(-0.22, G, -0.2, 0.12, 0.03, 0.12, CONC, MATTE);
  // small solar pump head next to the bore
  k.group(-0.25, G, 0.18, 0.2, (q) => {
    q.rbox(0, 0.13, 0, 0.18, 0.01, 0.12, PV, 0.5, 0, 0, GLASS);
    q.box(-0.06, 0, 0.03, 0.016, 0.12, 0.016, 0x8a8e90, IRON);
    q.box(0.06, 0, 0.03, 0.016, 0.12, 0.016, 0x8a8e90, IRON);
    q.box(0.0, 0, -0.08, 0.05, 0.05, 0.05, 0x3f6b8a, PAINT);
  });
  standTank(k, 0.22, -0.2, 0.13, 0.17, 0.2);
  void saltbushGeo;
  k.pipe([-0.15, G + 0.03, -0.2], [0.22, G + 0.03, -0.2], 0.012, 0x6f7a7c, 5, IRON);
  // trough + overflow mud
  k.shape(blobShape(0.2, 0.12, 31, k.hi ? 12 : 7, 0.25), 0.2, G + 0.004, 0.25, 0x7a4a2e, MATTE);
  k.box(0.22, G, 0.22, 0.32, 0.05, 0.08, 0x8a9090, IRON);
  k.flat(0.22, G + 0.048, 0.22, 0.29, 0.06, WATER, GLASS);
  k.pipe([0.22, G + 0.2, -0.1], [0.22, G + 0.06, 0.2], 0.01, 0x6f7a7c, 5, IRON);
  // outback flora
  veg(k, mulgaGeo(0), 0.36, G, -0.38, 0.45, 0.4);
  veg(k, spinifexGeo(), -0.38, G, 0.38, 0.6, 0);
  k.put(buildAmbient('cow', k.d), 0.0, G, 0.32, 2.6);
}

function mCoolingcentre(k: Kit): void {
  pad(k, 2, 2, 0xd6cdb8);
  // hall: timber + glazing, cool white roof with deep eaves
  k.group(-0.3, G, -0.45, 0, (q) => {
    const W = 1.0, D = 0.6, H = 0.28;
    const w = q.sbox(0, 0, 0, W, H, D, q.hi ? 20 : 1, 1, 1, 0xc08a5a, WALL);
    if (q.hi) facets(w, (cx, _y, _z, _nx, _ny, nz) => (Math.abs(nz) > 0.5 && Math.floor((cx + W / 2) / (W / 20)) % 2 ? 0.9 : undefined));
    q.quad(0.05, 0.13, D / 2 + 0.003, 0.7, 0.2, '+z', 0x3a5a6a, GLASS);
    if (q.hi) for (const x of [-0.25, -0.05, 0.15, 0.35]) q.box(x, 0, D / 2 + 0.004, 0.012, 0.23, 0.006, 0x3a3a3a, IRON);
    q.wins('-x', -W / 2, 0.15, -0.2, 0.2, 2, 0.1, 0.14, 0x3a5a6a);
    q.gable(0, H, 0, W, D, 0.1, 0xf4f3ee, { rough: 0.5 }, 0, 0.1);
    q.box(0.38, H + 0.1, -0.05, 0.05, 0.04, 0.05, 0xb8bcbc, IRON);
  });
  // shade sails over the plaza
  const sails: [V3, V3, V3, number][] = [
    [[-0.85, 0.36, 0.12], [0.1, 0.28, 0.12], [-0.4, 0.33, 0.62], 0xf2efe6],
    [[0.1, 0.28, 0.12], [0.85, 0.38, 0.2], [0.45, 0.3, 0.7], 0x3f9a96],
    [[-0.4, 0.33, 0.62], [0.45, 0.3, 0.7], [0.0, 0.36, 0.9], 0xe0b84a],
  ];
  const masts = new Set<string>();
  for (const [a, b, c, col] of sails) {
    sail(k, a, b, c, col);
    for (const p of [a, b, c]) {
      const key = p.join(',');
      if (masts.has(key)) continue;
      masts.add(key);
      k.box(p[0], G, p[2], 0.022, p[1] + 0.03 - G, 0.022, 0x6a6e70, IRON);
    }
  }
  // misting fans
  for (const [x, z] of [[-0.55, 0.3], [0.5, 0.42]] as [number, number][]) {
    k.cyl(x, G, z, 0.008, 0.01, 0.2, 0x8a8e90, 5, IRON);
    k.add(T(new CylinderGeometry(0.05, 0.05, 0.025, k.seg(10)), x, G + 0.21, z + 0.02, 1.2, 0, 0), 0xe8ecec, PAINT);
    k.blobAt(x, G + 0.19, z + 0.12, 0.05, 870 + Math.round(x * 10), 0xeef6f8, 0.4, 0.6, 0, { rough: 0.2 });
  }
  // trees, benches, water fountain, sign
  for (const [x, z, s] of [[0.75, -0.6, 0.85], [-0.88, 0.85, 0.8], [0.88, 0.82, 0.75]] as [number, number, number][]) veg(k, streetTreeGeo(k.d), x, G, z, s * 0.55);
  k.put(buildAmbient('picnic', k.d), -0.2, G, 0.4, 0.2);
  k.put(buildAmbient('picnic', k.d), 0.25, G, 0.55, -0.4);
  k.cyl(0.15, G, 0.2, 0.025, 0.03, 0.09, 0x5f8a7a, 8, PAINT);
  k.group(-0.82, G, 0.5, 0.3, (q) => {
    for (const x of [-0.08, 0.08]) q.box(x, 0, 0, 0.015, 0.16, 0.015, TIMBER, MATTE);
    q.box(0, 0.11, 0.005, 0.22, 0.08, 0.012, TEAL, PAINT);
    q.quad(0, 0.15, 0.0115, 0.16, 0.02, '+z', WHITE, PAINT);
  });
}

function mTransitline(k: Kit): void {
  pad(k, 1, 3, 0x86a35a, 0.0);
  const L = 3;
  // red bus lane + general lane (west), light-rail on a green track bed (centre-east), stop platform (east)
  k.box(-0.38, G - 0.012, 0, 0.2, 0.016, L, 0xa8453a, MATTE);
  k.box(-0.17, G - 0.012, 0, 0.2, 0.016, L, ASPHALT, MATTE);
  for (let i = 0; i < 4; i++) k.flat(-0.38, G + 0.0045, -1.2 + i * 0.8, 0.1, 0.05, 0xf2ecdc, MATTE);
  for (let i = 0; i < (k.hi ? 12 : 6); i++) k.flat(-0.275, G + 0.0045, -1.375 + i * (2.75 / ((k.hi ? 12 : 6) - 1)), 0.006, 0.09, 0xf2ecdc, MATTE);
  k.box(-0.06, G - 0.005, 0, 0.03, 0.02, L, CONC_L, MATTE);
  k.box(0.13, G - 0.01, 0, 0.3, 0.016, L, 0x6f9a48, MATTE);
  for (const x of [0.07, 0.19]) for (const s of [-1, 1]) k.box(x + s * 0.025, G + 0.006, 0, 0.008, 0.008, L, 0x8a8a8a, IRON);
  k.box(0.38, G - 0.005, 0, 0.2, 0.04, L, 0xd6cdb8, MATTE);
  // overhead wire poles + catenary
  const np = k.hi ? 5 : 3;
  for (let i = 0; i < np; i++) {
    const z = -1.35 + (i * 2.7) / (np - 1);
    k.cyl(0.0, G, z, 0.01, 0.013, 0.42, 0x6a6e70, 6, IRON);
    k.box(0.07, G + 0.39, z, 0.15, 0.01, 0.01, 0x6a6e70, IRON);
  }
  for (const x of [0.07, 0.19]) k.beam([x - (x > 0.1 ? 0.0 : 0), G + 0.38, -1.48], [x, G + 0.38, 1.48], 0.003, 0.003, 0x2a2a2a);
  // tram (3 sections) on the east track
  k.group(0.07, G + 0.014, 0.1, 0, (q) => {
    const segs = [-0.34, 0, 0.34];
    segs.forEach((z, i) => {
      q.box(0, 0.0, z, 0.1, 0.12, 0.32, 0xf2f3f0, { ao: 0.85, rough: 0.4 });
      q.box(0, 0.015, z, 0.102, 0.025, 0.32, TEAL, PAINT);
      for (const s of [-1, 1]) q.quad(s * 0.0515, 0.08, z, 0.28, 0.04, s > 0 ? '+x' : '-x', 0x2a3a46);
      q.box(0, 0.12, z, 0.08, 0.015, 0.26, 0xd8dcdc, IRON);
      if (i === 1) {
        q.beam([0, 0.135, z - 0.04], [0, 0.36, z], 0.006, 0.006, 0x3a3a3a);
        q.box(0, 0.355, z, 0.06, 0.006, 0.01, 0x3a3a3a);
      }
    });
    q.quad(0, 0.08, 0.5105, 0.08, 0.05, '+z', 0x2a3a46);
    q.quad(0, 0.08, -0.5105, 0.08, 0.05, '-z', 0x2a3a46);
  });
  // tram stop shelter
  k.group(0.38, G + 0.035, -0.6, 0, (q) => {
    q.box(0.06, 0, 0, 0.01, 0.16, 0.32, 0x8fb3c4, GLASS);
    for (const z of [-0.15, 0.15]) q.box(0.06, 0, z, 0.012, 0.17, 0.012, 0x5a5e60, IRON);
    q.rbox(0.0, 0.18, 0, 0.16, 0.012, 0.36, TEAL, 0, 0, -0.15, PAINT);
    q.box(0.03, 0.03, 0, 0.04, 0.01, 0.22, TIMBER_L, MATTE);
    q.box(-0.06, 0, 0.2, 0.01, 0.2, 0.01, 0x5a5e60, IRON);
    q.box(-0.06, 0.2, 0.2, 0.012, 0.04, 0.05, 0x3f9a96, PAINT);
  });
  // a bus and a car
  k.group(-0.38, G + 0.004, 0.7, 0, (q) => {
    q.box(0, 0.025, 0, 0.11, 0.1, 0.36, 0x3f9a96, { ao: 0.85, rough: 0.5 });
    for (const s of [-1, 1]) q.quad(s * 0.0555, 0.09, 0, 0.3, 0.04, s > 0 ? '+x' : '-x', 0x2a3a46);
    q.quad(0, 0.09, 0.1805, 0.09, 0.05, '+z', 0x2a3a46);
    q.box(0, 0.125, 0, 0.1, 0.012, 0.3, 0xe8ecec, PAINT);
    for (const z of [-0.12, 0.12]) for (const s of [-1, 1]) q.cylX(s * 0.05, 0.024, z, 0.024, 0.016, 0x1f1f22, 8);
  });
  k.put(buildAmbient('car', k.d), -0.17, G + 0.004, -0.8, Math.PI / 2, 0xd9a43a, 0.85);
  k.put(buildAmbient('car', k.d), -0.17, G + 0.004, 0.9, Math.PI / 2, 0xe8e4da, 0.85);
  for (const z of [-1.2, 0.2, 1.25]) veg(k, streetTreeGeo(k.d), 0.42, G + 0.035, z, 0.42);
}

/** Shared brick-suburb layout; `green` = retrofitted (cool roofs, PV, heat pumps, more trees). */
function suburbScene(k: Kit, green: boolean): void {
  pad(k, 2, 2, green ? LAWN : LAWN2);
  const road: [number, number][] = [];
  const N = k.hi ? 12 : 7;
  const rz = (x: number) => 0.06 * Math.sin(x * 2.4);
  for (let i = 0; i <= N; i++) {
    const x = -0.98 + (i / N) * 1.96;
    road.push([x, rz(x)]);
  }
  k.add(ribbon(road, 0.34, G + 0.003), 0xd6cdb8, MATTE);
  k.add(ribbon(road, 0.24, G + 0.006), ASPHALT, MATTE);
  if (k.hi) k.add(ribbon(road, 0.25, G + 0.0055), 0xb8b0a0, MATTE);
  const walls = [0xc98a5a, 0xa65a3c, 0xd9c4a0, 0x8a5a44, 0xc4a27a];
  const roofs = green ? [0xe4e1da, 0xcfd6d4, 0xdcd8cc] : [0xb5583a, 0x6e4a3e, 0x8b8e8f];
  const sites: [number, number, number][] = [
    [-0.7, -0.45, 0], [-0.22, -0.48, 0], [0.26, -0.5, 0], [0.72, -0.47, 0],
    [-0.62, 0.5, Math.PI], [0.0, 0.52, Math.PI], [0.6, 0.48, Math.PI],
  ];
  sites.forEach(([x, z, ry], i) => {
    const zz = z + rz(x);
    k.group(x, G, zz, ry, (q) => {
      brickHome(q, walls[i % walls.length], roofs[i % roofs.length], i);
      const gx = i % 2 ? 0.205 : -0.205;
      q.flat(gx, 0.004, 0.2, 0.08, 0.18, 0xc8c0b0, MATTE);
      if (green) {
        // PV on both main roof slopes (front + back) so it reads from any side, heat pump by the wall
        const slope = Math.atan2(0.085, 0.13);
        for (const s of [1]) {
          const pv = q.add(T(new BoxGeometry(0.2, 0.008, 0.08, q.hi ? 2 : 1, 1, 1), 0, 0.13 + 0.042 + 0.006, s * 0.062, s * slope, 0, 0), PV, { rough: 0.2, metal: 0.4 });
          facets(pv, (cx, _y, _z, _nx, ny) => (Math.abs(ny) > 0.5 && Math.floor((cx + 0.1) / 0.1) % 2 ? PV2 : undefined));
        }
        q.box(-gx * 0.85, 0, -0.06, 0.05, 0.045, 0.03, WHITE, PAINT);
        if (q.hi) q.quad(-gx * 0.85, 0.022, -0.0445, 0.026, 0.026, '-z', 0x5a5e60, IRON);
      }
      if (q.hi) {
        q.box(0, 0, -0.36, 0.46, 0.05, 0.012, 0x9a9488, MATTE);
        for (const sx of [-1, 1]) q.box(sx * 0.23, 0, -0.24, 0.012, 0.05, 0.24, 0x9a9488, MATTE);
      }
    });
    if (i % 3 !== 2) k.put(buildAmbient('car', k.d), x + (i % 2 ? 0.205 : -0.205) * Math.cos(ry), G + 0.004, zz + (ry ? -0.22 : 0.22), Math.PI / 2, green ? [TEAL, 0xe8e4da, 0x3d6fa5][i % 3] : [0xb3392b, 0x3d6fa5, 0xe8e4da, 0x4a7a5a, 0xd9a43a][i % 5], 0.85);
  });
  k.put(buildAmbient('clothesline', k.d), -0.62, G, 0.82, 0.4);
  k.put(buildAmbient('clothesline', k.d), 0.26, G, -0.82, 0.2);
  k.box(0.05, G - 0.005, 0.8, 0.18, 0.012, 0.1, 0xe8e4da, MATTE);
  k.flat(0.05, G + 0.008, 0.8, 0.15, 0.075, 0x5ac0d0, GLASS);
  if (k.hi) k.put(buildAmbient('shed', 1), 0.68, G, 0.84, 0);
  for (const [x, z, s] of [[-0.92, -0.85, 0.9], [-0.45, -0.88, 0.75], [0.62, -0.86, 0.8], [0.92, 0.82, 0.9], [-0.3, 0.86, 0.7]] as [number, number, number][]) k.tree(x, z, green ? Math.min(s, 0.85) : s, Math.round(x * 10 + z * 7 + 50));
  if (green) {
    // street trees all along both verges
    const xs = k.hi ? [-0.85, -0.45, -0.05, 0.38, 0.8] : [-0.6, 0.0, 0.6];
    for (const x of xs) for (const s of [-1, 1]) veg(k, streetTreeGeo(0), x + s * 0.05, G, rz(x) + s * 0.185, 0.38, x * 3);
  } else if (k.hi) for (const x of [-0.45, 0.48]) k.tree(x, rz(x) - 0.2, 0.55, 60 + Math.round(x * 10), G, [0x6f8a4a, 0x7f9a56]);
}

function mGreensuburb(k: Kit): void {
  suburbScene(k, true);
}

function mParkland(k: Kit): void {
  pad(k, 1, 1, 0x86a35a);
  k.add(ribbon([[-0.5, 0.3], [-0.15, 0.12], [0.15, 0.05], [0.5, -0.15]], 0.08, G + 0.004), 0xd6cdb8, MATTE);
  const trees: [number, number, number][] = [[-0.3, -0.28, 0.55], [0.3, -0.36, 0.5], [0.3, 0.32, 0.48]];
  trees.forEach(([x, z, s], i) => veg(k, streetTreeGeo(k.d), x, G, z, s, i * 1.7));
  // bench + bin + bubbler
  k.box(-0.08, G + 0.03, 0.25, 0.14, 0.01, 0.05, TIMBER_L, MATTE);
  k.box(-0.08, G + 0.04, 0.275, 0.14, 0.04, 0.008, TIMBER_L, MATTE);
  for (const dx of [-0.05, 0.05]) k.box(-0.08 + dx, G, 0.25, 0.01, 0.03, 0.04, 0x5a5a5a, IRON);
  k.put(buildAmbient('bin', k.d), 0.06, G, 0.27, 0);
  k.cyl(0.08, G, -0.05, 0.015, 0.02, 0.07, 0x5f8a7a, 6, PAINT);
  // playground on soft-fall
  k.group(-0.28, G, 0.05, 0.3, (q) => {
    q.shape(blobShape(0.16, 0.12, 41, q.hi ? 12 : 7, 0.15), 0, 0.005, 0, 0xc98a5a, MATTE);
    q.box(-0.05, 0, -0.03, 0.06, 0.12, 0.06, 0xe8c02a, PAINT);
    q.rbox(0.04, 0.07, -0.03, 0.14, 0.01, 0.05, 0x3f9a96, 0, 0, -0.6, PAINT);
    for (const x of [-0.1, 0.06]) q.box(x, 0, 0.07, 0.01, 0.12, 0.01, 0xd9534f, PAINT);
    q.box(-0.02, 0.12, 0.07, 0.17, 0.01, 0.01, 0xd9534f, PAINT);
    if (q.hi) q.box(-0.02, 0.04, 0.07, 0.04, 0.006, 0.02, 0x2a2a2a);
  });
}

// ------------------------------------------------------------------ public API
const BUILDERS: Partial<Record<ModelId, (k: Kit) => void>> = {
  cottage: mCottage,
  farm: mFarm,
  coalmine: mCoalmine,
  port: mPort,
  outfall: mOutfall,
  landfill: mLandfill,
  factory: mFactory,
  steelworks: mSteelworks,
  coalpower: mCoalpower,
  suburb: mSuburb,
  carpark: mCarpark,
  gaspower: mGaspower,
  rooftopsolar: mRooftopsolar,
  solarfarm: mSolarfarm,
  windfarm: mWindfarm,
  offshorewind: mOffshorewind,
  hydro: mHydro,
  pumpedhydro: mPumpedhydro,
  battery: mBattery,
  tidal: mTidal,
  phytoremediation: mPhyto,
  excavation: mExcavation,
  wetland: mWetland,
  sewagetreatment: mSewage,
  nursery: mNursery,
  wildlifecrossing: mWildlifecrossing,
  groundstation: mGroundstation,
  greensteel: mGreensteel,
  makerspace: mMakerspace,
  windport: mWindport,
  solarlandfill: mSolarlandfill,
  batteryhub: mBatteryhub,
  communityhub: mCommunityhub,
  recycler: mRecycler,
  reservoir: mReservoir,
  dripfarm: mDripfarm,
  fishway: mFishway,
  seawall: mSeawall,
  resort: mResort,
  coralnursery: mCoralnursery,
  bore: mBore,
  coolingcentre: mCoolingcentre,
  transitline: mTransitline,
  greensuburb: mGreensuburb,
  parkland: mParkland,
};

export const MODEL_IDS = Object.keys(BUILDERS) as ModelId[];

/** Placeholder for building ids added to the catalogue before a crafted model exists: pad + hall + roof. */
function genericModel(k: Kit, id: ModelId): void {
  const def = (BUILDINGS as Record<string, { w: number; h: number; category?: string } | undefined>)[id];
  const w = def?.w ?? 1;
  const d = def?.h ?? 1;
  k.box(0, -0.3, 0, w - 0.08, 0.32, d - 0.08, 0xa8a090);
  const bw = Math.max(0.5, w * 0.62);
  const bd = Math.max(0.4, d * 0.5);
  k.box(0, 0.02, 0, bw, 0.34, bd, def?.category === 'power' ? 0xe8ece6 : 0xd9c4a0, { ao: 0.8 });
  k.box(0, 0.36, 0, bw + 0.06, 0.06, bd + 0.06, 0x6f8a8c);
  k.box(-bw * 0.2, 0.08, bd / 2 + 0.005, 0.12, 0.18, 0.01, 0x2b3a46);
}

export function buildBuildingModel(id: ModelId, detail: 0 | 1): BuildingModel {
  const k = new Kit(detail);
  const build = BUILDERS[id];
  if (build) build(k);
  else genericModel(k, id);
  const geo = k.merge();
  geo.computeBoundingBox();
  let height = geo.boundingBox ? geo.boundingBox.max.y : 0;
  for (const s of k.stacks) height = Math.max(height, s.y - 0.03);
  for (const r of k.rotors) height = Math.max(height, r.y + 1.35 * r.scale);
  return { geo, stacks: k.stacks.map((s) => ({ ...s })), rotors: k.rotors.map((r) => ({ ...r })), height };
}

/** 3-blade turbine rotor: hub at origin, blades in the local XY plane (disc normal +Z), blade length ≈1.3 at scale 1. */
export function rotorGeo(detail: 0 | 1): BufferGeometry {
  const k = new Kit(detail);
  k.sph(0, 0, 0, 0.06, 0xf2f3f0, 10, 1, 1, 1.3, { rough: 0.35 });
  k.add(T(new CylinderGeometry(0, 0.055, 0.1, k.seg(10)), 0, 0, 0.1, Math.PI / 2, 0, 0), 0xf2f3f0, { rough: 0.35 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const blade = new CylinderGeometry(0.008, 0.042, 1.3, detail ? 6 : 4);
    T(blade, 0, 0.7, 0, 0, 0.25, 0, 1, 1, 0.32);
    T(blade, 0, 0, 0.02, 0, 0, a);
    const g = k.add(blade, 0xf4f5f2, { rough: 0.35 });
    // red tip marking
    if (detail) facets(g, (cx, cy) => (Math.hypot(cx, cy) > 1.2 ? 0xc9483a : undefined));
  }
  return k.merge();
}
