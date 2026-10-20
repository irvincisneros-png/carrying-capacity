// Geometry helpers (ported from the style lab): coloured parts merged into single static / instanced geometries.
import {
  BufferGeometry, Color, Float32BufferAttribute, Matrix4, Euler, Quaternion, Vector3,
  IcosahedronGeometry, CatmullRomCurve3, TubeGeometry,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { vnoise } from './noise';

export type ColorLike = number | Color;

export interface PartOpts {
  rough?: number;
  metal?: number;
  /** multiply colour by lerp(bottomMul,1, normalized height) for cheap baked AO */
  ao?: number;
}

const _c = new Color();
const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _v = new Vector3();
const _s = new Vector3();

export function toColor(c: ColorLike): Color {
  return c instanceof Color ? c.clone() : new Color(c);
}

export function jitterColor(c: ColorLike, rnd: () => number, amt = 0.08): Color {
  const k = toColor(c);
  const hsl = { h: 0, s: 0, l: 0 };
  k.getHSL(hsl);
  k.setHSL(hsl.h + (rnd() - 0.5) * amt * 0.25, Math.min(1, Math.max(0, hsl.s + (rnd() - 0.5) * amt)), Math.min(1, Math.max(0, hsl.l + (rnd() - 0.5) * amt)));
  return k;
}

/** Translate / rotate / scale a geometry in place. */
export function T(g: BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): BufferGeometry {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
  g.applyMatrix4(_m);
  return g;
}

/** Make geometry non-indexed, strip uvs, add flat colour + surf attributes. */
export function paint(g: BufferGeometry, color: ColorLike, o: PartOpts = {}): BufferGeometry {
  let ng = g.index ? g.toNonIndexed() : g;
  if (ng !== g) g.dispose();
  for (const name of Object.keys(ng.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'color' && name !== 'sphn') ng.deleteAttribute(name);
  }
  if (!ng.attributes.normal) ng.computeVertexNormals();
  const n = ng.attributes.position.count;
  const base = toColor(color);
  const pos = ng.attributes.position;
  const cols = new Float32Array(n * 3);
  let y0 = Infinity;
  let y1 = -Infinity;
  if (o.ao !== undefined) {
    for (let i = 0; i < n; i++) {
      const y = pos.getY(i);
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const existing = ng.attributes.color;
  for (let i = 0; i < n; i++) {
    if (existing) _c.setRGB(existing.getX(i), existing.getY(i), existing.getZ(i)).multiply(base);
    else _c.copy(base);
    if (o.ao !== undefined && y1 > y0) {
      const t = (pos.getY(i) - y0) / (y1 - y0);
      _c.multiplyScalar(o.ao + (1 - o.ao) * Math.sqrt(t));
    }
    cols[i * 3] = _c.r;
    cols[i * 3 + 1] = _c.g;
    cols[i * 3 + 2] = _c.b;
  }
  ng.setAttribute('color', new Float32BufferAttribute(cols, 3));
  const surf = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    surf[i * 2] = o.rough ?? 0.85;
    surf[i * 2 + 1] = o.metal ?? 0;
  }
  ng.setAttribute('surf', new Float32BufferAttribute(surf, 2));
  return ng;
}

/** Per-vertex colour modulation by a callback (x,y,z) -> multiplier colour. */
export function tint(g: BufferGeometry, fn: (x: number, y: number, z: number, c: Color) => void): BufferGeometry {
  const p = g.attributes.position;
  const c = g.attributes.color;
  for (let i = 0; i < p.count; i++) {
    _c.setRGB(c.getX(i), c.getY(i), c.getZ(i));
    fn(p.getX(i), p.getY(i), p.getZ(i), _c);
    c.setXYZ(i, _c.r, _c.g, _c.b);
  }
  c.needsUpdate = true;
  return g;
}

export class Parts {
  list: BufferGeometry[] = [];
  constructor(private withSph = false) {}
  add(g: BufferGeometry, color: ColorLike, o?: PartOpts): BufferGeometry {
    const p = paint(g, color, o);
    if (this.withSph && !p.attributes.sphn) p.setAttribute('sphn', p.attributes.normal.clone());
    this.list.push(p);
    return p;
  }
  push(p: BufferGeometry): void {
    if (this.withSph && !p.attributes.sphn) p.setAttribute('sphn', p.attributes.normal.clone());
    this.list.push(p);
  }
  merge(): BufferGeometry {
    const g = mergeGeometries(this.list, false);
    if (!g) throw new Error('merge failed');
    for (const p of this.list) p.dispose();
    this.list = [];
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Build a geometry from raw triangle positions (flat normals). */
export function tris(pos: number[]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function quad(out: number[], a: number[], b: number[], c: number[], d: number[]): void {
  out.push(...a, ...b, ...c, ...a, ...c, ...d);
}

/** Pitched (gable) roof, ridge along x, centred at origin, eaves at y=0. */
export function gableRoof(w: number, d: number, h: number, o = 0.04, ridgeZ = 0): BufferGeometry {
  const x0 = -w / 2 - o, x1 = w / 2 + o, z0 = -d / 2 - o, z1 = d / 2 + o;
  const p: number[] = [];
  quad(p, [x0, 0, z1], [x1, 0, z1], [x1, h, ridgeZ], [x0, h, ridgeZ]);
  quad(p, [x1, 0, z0], [x0, 0, z0], [x0, h, ridgeZ], [x1, h, ridgeZ]);
  p.push(x0, 0, z0, x0, 0, z1, x0, h, ridgeZ);
  p.push(x1, 0, z1, x1, 0, z0, x1, h, ridgeZ);
  // underside
  quad(p, [x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]);
  return tris(p);
}

/** Hipped roof (ridge along x). */
export function hipRoof(w: number, d: number, h: number, o = 0.04): BufferGeometry {
  const x0 = -w / 2 - o, x1 = w / 2 + o, z0 = -d / 2 - o, z1 = d / 2 + o;
  const inset = Math.min((d + 2 * o) / 2, (w + 2 * o) / 2 - 0.01);
  const r0 = x0 + inset, r1 = x1 - inset;
  const p: number[] = [];
  quad(p, [x0, 0, z1], [x1, 0, z1], [r1, h, 0], [r0, h, 0]);
  quad(p, [x1, 0, z0], [x0, 0, z0], [r0, h, 0], [r1, h, 0]);
  p.push(x0, 0, z0, x0, 0, z1, r0, h, 0);
  p.push(x1, 0, z1, x1, 0, z0, r1, h, 0);
  quad(p, [x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]);
  return tris(p);
}

/** Smooth, noise-displaced blob (indexed->smooth normals then flattened later by paint()). */
export function blob(r: number, detail: number, seed: number, amt = 0.28, sy = 1): BufferGeometry {
  let g: BufferGeometry = new IcosahedronGeometry(r, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    _v.set(p.getX(i), p.getY(i), p.getZ(i));
    const n = vnoise(_v.x * 4.1 / r * 0.25 + seed * 3.7 + _v.z * 2.3, _v.y * 4.3 / r * 0.25 - _v.z * 1.7 + seed);
    _v.multiplyScalar(1 + (n - 0.5) * amt);
    _v.y *= sy;
    p.setXYZ(i, _v.x, _v.y, _v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Tube along a curve with radius tapering r0 -> r1. */
export function taperTube(points: Vector3[], r0: number, r1: number, radial = 6, tubular = 6): BufferGeometry {
  const curve = new CatmullRomCurve3(points);
  const g = new TubeGeometry(curve, tubular, 1, radial, false);
  const p = g.attributes.position;
  const ring = radial + 1;
  const ctr = new Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, ctr);
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j < ring; j++) {
      const k = i * ring + j;
      _v.set(p.getX(k), p.getY(k), p.getZ(k)).sub(ctr).multiplyScalar(r).add(ctr);
      p.setXYZ(k, _v.x, _v.y, _v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Set spherised normals (for soft canopy shading) relative to a centre. */
export function setSph(g: BufferGeometry, cx: number, cy: number, cz: number): BufferGeometry {
  const p = g.attributes.position;
  const a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    _v.set(p.getX(i) - cx, p.getY(i) - cy, p.getZ(i) - cz).normalize();
    a[i * 3] = _v.x;
    a[i * 3 + 1] = _v.y;
    a[i * 3 + 2] = _v.z;
  }
  g.setAttribute('sphn', new Float32BufferAttribute(a, 3));
  return g;
}
