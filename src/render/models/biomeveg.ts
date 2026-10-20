// Biome vegetation (tropical, river, outback, wetland, city). Built like vegassets.eucalyptGeo: Parts(true) so every part
// carries `sphn`, canopy blobs get spherised normals (setSph) for the soft foliage shading. Origins at ground level.
import { BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, SphereGeometry, Vector3 } from 'three';
import { Parts, T, blob, setSph, taperTube, tint } from '../geo';
import { mulberry32, vnoise } from '../noise';

const V = (x: number, y: number, z: number) => new Vector3(x, y, z);
const _c = new Color();

/** Leaf/blade strips: each strip is a polyline (centre points) with half-widths; emitted double-sided. */
function strips(list: { pts: Vector3[]; w: number[]; side: Vector3; c0: number; c1: number; fold?: number }[]): BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const a = new Color(), b = new Color();
  const push = (p: Vector3[], cs: Color[]) => {
    // front
    for (let i = 0; i < 3; i++) { pos.push(p[i].x, p[i].y, p[i].z); col.push(cs[i].r, cs[i].g, cs[i].b); }
    // back (reverse winding)
    for (const i of [0, 2, 1]) { pos.push(p[i].x, p[i].y, p[i].z); col.push(cs[i].r, cs[i].g, cs[i].b); }
  };
  for (const s of list) {
    a.set(s.c0);
    b.set(s.c1);
    const n = s.pts.length;
    const L: Vector3[] = [], R: Vector3[] = [], C: Color[] = [];
    for (let i = 0; i < n; i++) {
      const fold = V(0, -(s.fold ?? 0) * s.w[i], 0);
      L.push(s.pts[i].clone().addScaledVector(s.side, s.w[i]).add(fold));
      R.push(s.pts[i].clone().addScaledVector(s.side, -s.w[i]).add(fold));
      C.push(a.clone().lerp(b, i / (n - 1)));
    }
    for (let i = 0; i < n - 1; i++) {
      // two halves meeting at the midrib (gives a slight V fold)
      push([s.pts[i], L[i], L[i + 1]], [C[i], C[i], C[i + 1]]);
      push([s.pts[i], L[i + 1], s.pts[i + 1]], [C[i], C[i + 1], C[i + 1]]);
      push([s.pts[i], s.pts[i + 1], R[i + 1]], [C[i], C[i + 1], C[i + 1]]);
      push([s.pts[i], R[i + 1], R[i]], [C[i], C[i + 1], C[i]]);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function mottle(g: BufferGeometry, dark: number, base: number, foot = 0.14): BufferGeometry {
  const d = new Color(dark), f = new Color(base);
  return tint(g, (x, y, z, c) => {
    if (vnoise(x * 30 + y * 9, z * 30 - y * 12) > 0.6) c.multiply(d);
    if (y < foot) c.lerp(f, 1 - y / foot);
  });
}

// ---------------------------------------------------------------- coconut palm
export function palmGeo(detail: 0 | 1, variant: 0 | 1): BufferGeometry {
  const P = new Parts(true);
  const H = variant === 0 ? 1.25 : 0.95;
  const lean = variant === 0 ? 0.16 : 0.3;
  const trunkPts = [V(0, 0, 0), V(lean * 0.25, H * 0.35, 0.01), V(lean * 0.65, H * 0.7, 0.02), V(lean, H, 0.0)];
  const trunk = P.add(taperTube(trunkPts, 0.05, 0.032, detail ? 7 : 5, detail ? 8 : 5), 0xa08a6a, { rough: 0.85 });
  // ring scars
  tint(trunk, (_x, y, _z, c) => {
    if (Math.floor(y * 26) % 2) c.multiplyScalar(0.84);
    if (y < 0.1) c.lerp(_c.set(0x6a5644), 1 - y / 0.1);
  });
  const crown = V(lean, H + 0.02, 0);
  const nf = detail ? 9 : 6;
  const seg = detail ? 5 : 3;
  const fronds: Parameters<typeof strips>[0] = [];
  const rnd = mulberry32(variant ? 31 : 17);
  for (let i = 0; i < nf; i++) {
    const a = (i / nf) * Math.PI * 2 + rnd() * 0.3;
    const dir = V(Math.cos(a), 0, Math.sin(a));
    const len = 0.55 + rnd() * 0.15;
    const up = 0.18 + rnd() * 0.12;
    const pts: Vector3[] = [], w: number[] = [];
    for (let s = 0; s <= seg; s++) {
      const t = s / seg;
      // rises then droops
      const y = up * Math.sin(t * Math.PI * 0.75) - t * t * 0.42;
      pts.push(crown.clone().addScaledVector(dir, t * len).add(V(0, y, 0)));
      w.push(0.11 * Math.sin(Math.min(1, t * 1.3 + 0.08) * Math.PI) + 0.008);
    }
    fronds.push({ pts, w, side: V(-dir.z, 0, dir.x), c0: 0x5a7f34, c1: i % 2 ? 0x9ab04a : 0x86a040, fold: 0.35 });
  }
  const fg = strips(fronds);
  setSph(fg, crown.x, crown.y - 0.15, crown.z);
  P.add(fg, 0xffffff, { rough: 0.7 });
  const nuts = detail ? 4 : 2;
  for (let i = 0; i < nuts; i++) {
    const a = (i / nuts) * Math.PI * 2 + 0.4;
    const g = T(new SphereGeometry(0.035, detail ? 6 : 4, detail ? 4 : 3), crown.x + Math.cos(a) * 0.04, crown.y - 0.05, crown.z + Math.sin(a) * 0.04);
    P.add(g, 0x6a5a2a, { rough: 0.7 });
  }
  return P.merge();
}

// ---------------------------------------------------------------- river red gum
const REDGUM = [0x8a9a7a, 0x7a8e6a, 0x9aa88a, 0x6f8462, 0x8d9f80];
export function redGumGeo(detail: 0 | 1, variant: 0 | 1): BufferGeometry {
  const rnd = mulberry32(variant ? 57 : 41);
  const P = new Parts(true);
  const H = variant === 0 ? 0.7 : 0.55;
  const lean = variant === 0 ? 0.12 : 0.22;
  const trunk = P.add(taperTube([V(0, 0, 0), V(lean * 0.4, H * 0.4, 0.02), V(lean, H, 0.04)], 0.12, 0.06, detail ? 8 : 5, detail ? 5 : 3), 0xe8e0d0, { rough: 0.75 });
  mottle(trunk, 0xb0a08a, 0x6a5644, 0.16);
  const blobs: [number, number, number, number][] = [];
  const nb = 3;
  for (let b = 0; b < nb; b++) {
    const a = (b / nb) * Math.PI * 2 + rnd() * 0.6 + 0.3;
    const spread = 0.48 + rnd() * 0.18;
    const start = V(lean, H * 0.95, 0.04);
    const end = V(lean + Math.cos(a) * spread, H + 0.28 + rnd() * 0.18, Math.sin(a) * spread);
    const mid = start.clone().lerp(end, 0.5).add(V(Math.cos(a) * 0.08, 0.1, Math.sin(a) * 0.08));
    const br = P.add(taperTube([start, mid, end], 0.055, 0.02, detail ? 5 : 4, detail ? 4 : 2), 0xe8e0d0, { rough: 0.75 });
    mottle(br, 0xb0a08a, 0x6a5644, 0.0);
    blobs.push([end.x, end.y + 0.06, end.z, 0.24 + rnd() * 0.06]);
    if (detail) blobs.push([(end.x + lean) / 2 + (rnd() - 0.5) * 0.1, end.y + 0.12, end.z / 2, 0.2 + rnd() * 0.05]);
  }
  blobs.push([lean, H + 0.5, 0.04, 0.26]);
  let cx = 0, cy = 0, cz = 0;
  for (const b of blobs) { cx += b[0]; cy += b[1]; cz += b[2]; }
  cx /= blobs.length; cy /= blobs.length; cz /= blobs.length;
  blobs.forEach((b, i) => {
    const g = T(blob(b[3], detail, 400 + variant * 20 + i, 0.4, 0.55), b[0], b[1], b[2], 0, 0, 0, 1.25, 1, 1.25);
    setSph(g, cx, cy - 0.1, cz);
    P.add(g, REDGUM[i % REDGUM.length], { ao: 0.55, rough: 0.8 });
  });
  return P.merge();
}

// ---------------------------------------------------------------- mulga (outback acacia)
export function mulgaGeo(detail: 0 | 1): BufferGeometry {
  const rnd = mulberry32(73);
  const P = new Parts(true);
  const stems = detail ? 3 : 2;
  const tops: Vector3[] = [];
  for (let i = 0; i < stems; i++) {
    const a = (i / stems) * Math.PI * 2 + 0.3;
    const top = V(Math.cos(a) * 0.14, 0.42 + rnd() * 0.08, Math.sin(a) * 0.14);
    const s = P.add(taperTube([V(Math.cos(a) * 0.02, 0, Math.sin(a) * 0.02), V(Math.cos(a) * 0.07, 0.22, Math.sin(a) * 0.07), top], 0.022, 0.01, 5, detail ? 3 : 2), 0x6a5040, { rough: 0.9 });
    void s;
    tops.push(top);
  }
  const cols = [0x8a9a8a, 0x7d8f86, 0x95a596, 0x84948a];
  const blobs: [number, number, number, number][] = tops.map((t) => [t.x, t.y + 0.07, t.z, 0.16 + rnd() * 0.04]);
  blobs.push([0, 0.58, 0, 0.17]);
  blobs.forEach((b, i) => {
    const g = T(blob(b[3], detail, 700 + i, 0.4, 0.55), b[0], b[1], b[2], 0, 0, 0, 1.2, 1, 1.2);
    setSph(g, 0, 0.45, 0);
    P.add(g, cols[i % cols.length], { ao: 0.55, rough: 0.85 });
  });
  return P.merge();
}

// ---------------------------------------------------------------- spinifex hummock
export function spinifexGeo(): BufferGeometry {
  const rnd = mulberry32(91);
  const P = new Parts(true);
  const base = T(blob(0.16, 1, 92, 0.3, 0.38), 0, 0.02, 0, 0, 0, 0, 1.15, 1, 1.15);
  setSph(base, 0, 0, 0);
  P.add(base, 0xb89a4a, { ao: 0.6, rough: 0.95 });
  const blades: Parameters<typeof strips>[0] = [];
  const N = 30;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rnd() * 0.25;
    const r0 = 0.08 + rnd() * 0.1;
    const dir = V(Math.cos(a), 0, Math.sin(a));
    const root = V(dir.x * r0, 0.05, dir.z * r0);
    const tip = root.clone().addScaledVector(dir, 0.08 + rnd() * 0.06).add(V(0, 0.12 + rnd() * 0.08, 0));
    blades.push({ pts: [root, tip], w: [0.012, 0.0], side: V(-dir.z, 0, dir.x), c0: 0xb8963e, c1: 0xe8d27a });
  }
  const bg = strips(blades);
  setSph(bg, 0, 0, 0);
  P.add(bg, 0xffffff, { rough: 0.9 });
  return P.merge();
}

// ---------------------------------------------------------------- saltbush
export function saltbushGeo(): BufferGeometry {
  const P = new Parts(true);
  const cols = [0xa8b0a0, 0x9aa596, 0xb5bcad, 0x96a090];
  const parts: [number, number, number, number][] = [[0, 0.09, 0, 0.12], [0.1, 0.07, 0.04, 0.09], [-0.08, 0.07, 0.06, 0.09], [0.02, 0.07, -0.1, 0.09]];
  parts.forEach(([x, y, z, r], i) => {
    const g = T(blob(r, 1, 810 + i, 0.45, 0.7), x, y, z);
    setSph(g, 0, 0.05, 0);
    P.add(g, cols[i], { ao: 0.6, rough: 0.9 });
  });
  return P.merge();
}

// ---------------------------------------------------------------- reeds + bulrushes
export function reedsGeo(): BufferGeometry {
  const rnd = mulberry32(121);
  const P = new Parts(true);
  const blades: Parameters<typeof strips>[0] = [];
  const N = 16;
  const heads: Vector3[] = [];
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 0.13;
    const root = V(Math.cos(a) * r, 0, Math.sin(a) * r);
    const h = 0.28 + rnd() * 0.24;
    const bend = V((rnd() - 0.5) * 0.12, 0, (rnd() - 0.5) * 0.12);
    const mid = root.clone().add(V(bend.x * 0.3, h * 0.55, bend.z * 0.3));
    const tip = root.clone().add(V(bend.x, h, bend.z));
    const side = V(Math.cos(a + 1.3), 0, Math.sin(a + 1.3));
    blades.push({ pts: [root, mid, tip], w: [0.012, 0.009, 0.0], side, c0: 0x5f7a38, c1: i % 3 ? 0x9aac58 : 0xb8b06a });
    if (i % 8 === 0) heads.push(root.clone().add(V(bend.x * 0.6, h * 0.82, bend.z * 0.6)));
  }
  const bg = strips(blades);
  setSph(bg, 0, 0.1, 0);
  P.add(bg, 0xffffff, { rough: 0.8 });
  for (const h of heads) {
    P.add(T(new CylinderGeometry(0.014, 0.014, 0.07, 5), h.x, h.y, h.z), 0x6a4a2a, { rough: 0.9 });
    P.add(T(new CylinderGeometry(0.003, 0.003, 0.05, 3), h.x, h.y + 0.055, h.z), 0x7a8a48);
  }
  return P.merge();
}

// ---------------------------------------------------------------- city street tree
export function streetTreeGeo(detail: 0 | 1): BufferGeometry {
  const P = new Parts(true);
  const trunk = P.add(taperTube([V(0, 0, 0), V(0.01, 0.25, 0), V(0, 0.48, 0.01)], 0.04, 0.026, detail ? 6 : 4, detail ? 3 : 2), 0x7a6a5a, { rough: 0.85 });
  tint(trunk, (_x, y, _z, c) => { if (y < 0.06) c.lerp(_c.set(0x4a3a30), 1 - y / 0.06); });
  const blobs: [number, number, number, number, number][] = [
    [0, 0.72, 0, 0.3, 0x6aa84a], [0.13, 0.62, 0.08, 0.2, 0x7cb85a], [-0.12, 0.64, -0.06, 0.2, 0x5f9a44], [0.02, 0.88, -0.03, 0.18, 0x86c060],
  ];
  const use = blobs.slice(0, 3);
  use.forEach(([x, y, z, r, c], i) => {
    const g = T(blob(r, detail, 900 + i, 0.25, 0.85), x, y, z);
    setSph(g, 0, 0.72, 0);
    P.add(g, c, { ao: 0.6, rough: 0.8 });
  });
  return P.merge();
}
