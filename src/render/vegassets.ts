// Vegetation, reef and rock assets (ported from the style lab). Origins at ground level.
import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Vector3, SphereGeometry } from 'three';
import { Parts, T, blob, hipRoof, setSph, taperTube, tint, paint } from './geo';
import { mulberry32, vnoise } from './noise';

const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

// ---------------------------------------------------------------- cottages
export function cottageBodyGeo(): BufferGeometry {
  const P = new Parts();
  P.add(T(new BoxGeometry(0.6, 0.07, 0.48), 0, 0.035, 0), 0x5e544a, { rough: 0.9 });
  P.add(T(new BoxGeometry(0.54, 0.3, 0.42), 0, 0.22, -0.02), 0xffffff, { ao: 0.84, rough: 0.8 });
  for (const y of [0.12, 0.17, 0.22, 0.27, 0.32]) P.add(T(new BoxGeometry(0.546, 0.006, 0.426), 0, y, -0.02), 0xd9d3c6);
  P.add(T(new BoxGeometry(0.58, 0.03, 0.15), 0, 0.085, 0.265), 0x8a7560);
  for (const x of [-0.27, -0.09, 0.09, 0.27]) P.add(T(new BoxGeometry(0.018, 0.2, 0.018), x, 0.2, 0.33), 0xffffff);
  P.add(T(new BoxGeometry(0.58, 0.015, 0.01), 0, 0.15, 0.335), 0xffffff);
  P.add(T(new BoxGeometry(0.075, 0.15, 0.01), 0, 0.17, 0.193), 0x6b3a2a);
  for (const x of [-0.16, 0.16]) {
    P.add(T(new BoxGeometry(0.11, 0.11, 0.008), x, 0.22, 0.194), 0xf6f3ec);
    P.add(T(new BoxGeometry(0.084, 0.084, 0.01), x, 0.22, 0.198), 0x2b3a46, { rough: 0.15 });
  }
  for (const sx of [-1, 1]) {
    P.add(T(new BoxGeometry(0.008, 0.11, 0.12), sx * 0.272, 0.22, -0.05), 0xf6f3ec);
    P.add(T(new BoxGeometry(0.01, 0.084, 0.094), sx * 0.274, 0.22, -0.05), 0x2b3a46, { rough: 0.15 });
  }
  P.add(T(new BoxGeometry(0.07, 0.32, 0.07), 0.17, 0.47, -0.1), 0x9a5038);
  P.add(T(new BoxGeometry(0.086, 0.025, 0.086), 0.17, 0.64, -0.1), 0x7a3f2c);
  return P.merge();
}

export function cottageRoofGeo(): BufferGeometry {
  const P = new Parts();
  P.add(T(hipRoof(0.54, 0.42, 0.2, 0.05), 0, 0.37, -0.02), 0xffffff, { rough: 0.42, metal: 0.55 });
  P.add(T(new BoxGeometry(0.62, 0.012, 0.2), 0, 0.3, 0.29, 0.3), 0xf2f2f2, { rough: 0.42, metal: 0.55 });
  return P.merge();
}

// ---------------------------------------------------------------- eucalypts
const CANOPY = [0x7b956a, 0x687f4c, 0x8ea08e, 0x5b7448, 0x78905c, 0x93a580];

export function eucalyptGeo(detail: number, variant: 0 | 1, seed: number): BufferGeometry {
  const rnd = mulberry32(seed);
  const P = new Parts(true);
  const H = variant === 0 ? 1.05 : 0.62;
  const main = [V(0, 0, 0), V(0.04, H * 0.35, 0.02), V(-0.035, H * 0.7, 0.03), V(0.02, H, 0)];
  const cheap = detail < 0; // Very low: slimmer trunk / branches, one blob per branch
  const trunk = P.add(taperTube(main, variant === 0 ? 0.075 : 0.062, 0.038, cheap ? 4 : 7, cheap ? 3 : 6), 0xf5f1e7, { rough: 0.7 });
  const mottle = (g: BufferGeometry) =>
    tint(g, (x, y, z, c) => {
      const n = vnoise(x * 30 + y * 9, z * 30 - y * 12);
      if (n > 0.62) c.multiply(new Color(0xb9b3a4));
      if (y < 0.14) c.lerp(new Color(0x6a5644), 1 - y / 0.14);
    });
  mottle(trunk);
  const n = 3;
  const blobs: [number, number, number, number][] = [];
  let topY = 0;
  for (let b = 0; b < n; b++) {
    const a = (b / n) * Math.PI * 2 + rnd() * 0.7;
    const spread = variant === 0 ? 0.4 + rnd() * 0.2 : 0.26 + rnd() * 0.1;
    const rise = variant === 0 ? 0.42 + rnd() * 0.28 : 0.26 + rnd() * 0.12;
    const start = V(0.02 * 0.9, H * (0.8 + rnd() * 0.16), 0);
    const end = V(Math.cos(a) * spread, H + rise, Math.sin(a) * spread);
    const mid = start.clone().lerp(end, 0.5).add(V(Math.cos(a) * 0.05, 0.08, Math.sin(a) * 0.05));
    const br = P.add(taperTube([start, mid, end], variant === 0 ? 0.04 : 0.034, 0.014, cheap ? 3 : 5, cheap ? 2 : 4), 0xf5f1e7, { rough: 0.7 });
    mottle(br);
    const k = cheap ? 1 : 2;
    for (let i = 0; i < k; i++) {
      const r = variant === 0 ? 0.2 + rnd() * 0.09 : 0.18 + rnd() * 0.07;
      blobs.push([end.x + (rnd() - 0.5) * 0.24, end.y + 0.04 + rnd() * 0.12, end.z + (rnd() - 0.5) * 0.24, r]);
    }
    topY = Math.max(topY, end.y);
  }
  blobs.push([0.02, topY + 0.14, 0, variant === 0 ? 0.25 : 0.22]);
  if (variant === 1 && !cheap) blobs.push([(rnd() - 0.5) * 0.2, topY - 0.02, (rnd() - 0.5) * 0.2, 0.2]);
  let cx = 0, cy = 0, cz = 0;
  for (const b of blobs) { cx += b[0]; cy += b[1]; cz += b[2]; }
  cx /= blobs.length; cy /= blobs.length; cz /= blobs.length;
  blobs.forEach((b, i) => {
    const g = T(blob(b[3] * (cheap ? 1.3 : 1), Math.max(0, detail), seed * 13 + i, 0.4, 0.72), b[0], b[1], b[2]);
    setSph(g, cx, cy - 0.05, cz);
    P.add(g, CANOPY[(seed + i * 3) % CANOPY.length], { ao: 0.55, rough: 0.8 });
  });
  return P.merge();
}

// ---------------------------------------------------------------- mangrove
export function mangroveGeo(detail: number): BufferGeometry {
  const rnd = mulberry32(42);
  const P = new Parts(true);
  P.add(taperTube([V(0, 0.08, 0), V(0.02, 0.22, 0), V(0, 0.34, 0.01)], 0.032, 0.02, 5, 3), 0x6b5a48);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.4;
    const r = 0.15 + rnd() * 0.06;
    P.add(taperTube([V(0, 0.18, 0), V(Math.cos(a) * r * 0.5, 0.17, Math.sin(a) * r * 0.5), V(Math.cos(a) * r, -0.06, Math.sin(a) * r)], 0.011, 0.008, 4, 4), 0x8a7860);
  }
  const cols = [0x3f6b3c, 0x4a7840, 0x365e33, 0x55813f];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rnd();
    const g = T(blob(0.17 + rnd() * 0.06, detail, 300 + i, 0.4, 0.62), Math.cos(a) * 0.12, 0.36 + rnd() * 0.08, Math.sin(a) * 0.12);
    setSph(g, 0, 0.36, 0);
    P.add(g, cols[i], { ao: 0.55, rough: 0.5 });
  }
  return P.merge();
}

// ---------------------------------------------------------------- shrubs
export function banksiaGeo(detail: number): BufferGeometry {
  const rnd = mulberry32(11);
  const P = new Parts(true);
  const cols = [0x4c6a38, 0x5a7840, 0x456233];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const g = T(blob(0.11 + rnd() * 0.03, Math.max(0, detail), 500 + i, 0.45, 0.85), Math.cos(a) * 0.07, 0.11 + rnd() * 0.05, Math.sin(a) * 0.07);
    setSph(g, 0, 0.1, 0);
    P.add(g, cols[i], { ao: 0.55 });
  }
  const fl = [0xe0892a, 0xd9a43a, 0xc9682a];
  for (let i = 0; i < (detail < 0 ? 0 : 6); i++) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.5;
    const r = 0.1 + rnd() * 0.04;
    P.add(T(new CylinderGeometry(0.022, 0.028, 0.1, 6), Math.cos(a) * r, 0.2 + rnd() * 0.06, Math.sin(a) * r, Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5), fl[i % 3], { rough: 0.9 });
  }
  return P.merge();
}

export function wattleGeo(detail: number): BufferGeometry {
  const rnd = mulberry32(23);
  const P = new Parts(true);
  const cols = [0xe3b72e, 0xd9a925, 0xeac64a, 0xd8ab2c];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rnd();
    const g = T(blob(0.1 + rnd() * 0.04, detail, 600 + i, 0.5, 0.85), Math.cos(a) * 0.08, 0.14 + rnd() * 0.1, Math.sin(a) * 0.08);
    setSph(g, 0, 0.15, 0);
    P.add(g, cols[i], { ao: 0.6 });
  }
  const g = T(blob(0.09, detail, 640, 0.4, 0.8), 0.02, 0.07, -0.05);
  setSph(g, 0, 0.15, 0);
  P.add(g, 0x7f8a3e, { ao: 0.6 });
  return P.merge();
}

export function grassTreeGeo(): BufferGeometry {
  const rnd = mulberry32(5);
  const P = new Parts(true);
  P.add(T(new CylinderGeometry(0.045, 0.06, 0.26, 6), 0, 0.13, 0), 0x2a221d, { rough: 0.95 });
  const pos: number[] = [];
  const col: number[] = [];
  const base = new Color(0x5f7030);
  const tip = new Color(0xc2bf62);
  const N = 30;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2 + rnd() * 0.3;
    const el = -0.7 + rnd() * 1.9;
    const len = 0.22 + rnd() * 0.1;
    const tx = Math.cos(th) * Math.cos(el) * len;
    const ty = 0.26 + Math.sin(el) * len * 0.8 - (el < 0.2 ? 0.05 : 0);
    const tz = Math.sin(th) * Math.cos(el) * len;
    const w = 0.012;
    const px = -Math.sin(th) * w, pz = Math.cos(th) * w;
    const A = [px, 0.27, pz], B = [-px, 0.27, -pz], Cc = [tx, ty, tz];
    pos.push(...A, ...B, ...Cc, ...B, ...A, ...Cc);
    for (let k = 0; k < 2; k++) col.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  setSph(g, 0, 0.2, 0);
  P.add(g, 0xffffff, { rough: 0.7 });
  P.add(T(new CylinderGeometry(0.009, 0.014, 0.42, 5), 0, 0.47, 0), 0x5b4630);
  P.add(T(new CylinderGeometry(0.02, 0.02, 0.2, 6), 0, 0.58, 0), 0x8a7a4a);
  return P.merge();
}

export function tuftGeo(): BufferGeometry {
  const P = new Parts(true);
  P.add(blob(0.075, 0, 77, 0.5, 0.55), 0xffffff, { ao: 0.6 });
  return P.merge();
}

// ---------------------------------------------------------------- reef + rocks
export function coralGeo(): BufferGeometry {
  const rnd = mulberry32(99);
  const P = new Parts();
  // branching staghorn
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    const tilt = 0.3 + rnd() * 0.5;
    P.add(T(new ConeGeometry(0.018, 0.18 + rnd() * 0.08, 5), -0.08 + Math.cos(a) * 0.04, 0.09, Math.sin(a) * 0.04, Math.sin(a) * tilt, 0, -Math.cos(a) * tilt), 0xffffff, { rough: 0.7 });
  }
  // brain / boulder
  P.add(T(blob(0.1, 1, 9, 0.35, 0.65), 0.1, 0.03, 0.04), 0xe8d8b8, { ao: 0.6 });
  // plate
  P.add(T(new CylinderGeometry(0.13, 0.1, 0.022, 9), 0.02, 0.1, -0.12, 0.2, 0, 0.15), 0xd8e8f0);
  // fan
  P.add(T(new SphereGeometry(0.11, 8, 6), -0.02, 0.12, 0.13, 0, 0.6, 0, 0.18, 1, 1), 0xf0d0f0);
  return P.merge();
}

export function rockGeo(seed: number): BufferGeometry {
  const P = new Parts();
  const g = P.add(blob(0.5, 1, seed, 0.6, 0.62), 0xffffff, { rough: 0.9 });
  tint(g, (_x, y, _z, c) => {
    const band = Math.floor((y + 1) * 8) % 3;
    c.multiply(new Color(band === 0 ? 0xf2e2c0 : band === 1 ? 0xe0b884 : 0xcf9a6a));
    if (y < -0.1) c.multiplyScalar(0.75);
  });
  return P.merge();
}

export function puffGeo(r: number, seed: number, ao: number): BufferGeometry {
  const P = new Parts();
  P.add(blob(r, 1, seed, 0.3, 0.85), 0xffffff, { ao });
  return P.merge();
}

// ---------------------------------------------------------------- turbine rotor
export function rotorGeo(): BufferGeometry {
  const P = new Parts();
  P.add(T(new SphereGeometry(0.06, 10, 8), 0, 0, 0, 0, 0, 0, 1, 1, 1.3), 0xf2f3f0, { rough: 0.35 });
  P.add(T(new ConeGeometry(0.055, 0.1, 10), 0, 0, 0.1, Math.PI / 2), 0xf2f3f0, { rough: 0.35 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const blade = new CylinderGeometry(0.008, 0.042, 1.3, 6);
    T(blade, 0, 0.7, 0, 0, 0.25, 0, 1, 1, 0.32);
    T(blade, 0, 0, 0.02, 0, 0, a);
    P.add(blade, 0xf4f5f2, { rough: 0.35 });
  }
  return P.merge();
}

// ---------------------------------------------------------------- stockpile
export function stockpileGeo(l: number, w: number, h: number, seed: number): BufferGeometry {
  const g = new SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = vnoise(x * 3 + seed, z * 3 - seed) - 0.5;
    const ridge = Math.pow(Math.max(0, 1 - Math.abs(z)), 0.5);
    p.setXYZ(i, x * (l / 2) * (1 + n * 0.12), Math.max(0, y * h * (0.75 + 0.25 * ridge) * (1 + n * 0.35)), z * (w / 2) * (1 + n * 0.12));
  }
  g.computeVertexNormals();
  const out = paint(g, 0x2b2825, { rough: 0.95 });
  tint(out, (x, y, z, c) => {
    const n = vnoise(x * 9, z * 9 + y * 4);
    c.multiplyScalar(0.8 + 0.5 * n * (0.4 + y / h));
  });
  return out;
}

// ---------------------------------------------------------------- seagrass (underwater meadow clump)
export function seagrassGeo(): BufferGeometry {
  const rnd = mulberry32(31);
  const pos: number[] = [];
  const col: number[] = [];
  const base = new Color(0x2f6b3a);
  const tip = new Color(0x7fb35a);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * 0.12;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 0.18 + rnd() * 0.16;
    const lean = (rnd() - 0.5) * 0.12;
    const w = 0.014;
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    const A = [x + px, 0, z + pz], B = [x - px, 0, z - pz], Ct = [x + lean, h, z + lean * 0.5];
    pos.push(...A, ...B, ...Ct, ...B, ...A, ...Ct);
    for (let k = 0; k < 2; k++) col.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  setSph(g, 0, 0.0, 0);
  const P = new Parts(true);
  P.add(g, 0xffffff, { rough: 0.7 });
  return P.merge();
}

// ---------------------------------------------------------------- saltmarsh (low succulent mounds)
export function saltmarshGeo(): BufferGeometry {
  const rnd = mulberry32(57);
  const P = new Parts(true);
  const cols = [0x8a7a3a, 0x9c5a3e, 0x6f7f3e, 0xa86a48];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rnd();
    const g = T(blob(0.07 + rnd() * 0.03, 0, 700 + i, 0.5, 0.45), Math.cos(a) * 0.09, 0.02, Math.sin(a) * 0.09);
    setSph(g, 0, 0.0, 0);
    P.add(g, cols[i % cols.length]!, { ao: 0.7 });
  }
  return P.merge();
}

// ---------------------------------------------------------------- dead stump (burnt / cleared land)
export function stumpGeo(): BufferGeometry {
  const P = new Parts();
  P.add(T(new CylinderGeometry(0.035, 0.05, 0.12, 6), 0, 0.06, 0), 0x4a3b30, { rough: 0.95 });
  P.add(T(new CylinderGeometry(0.01, 0.022, 0.16, 5), 0.02, 0.18, 0, 0, 0, -0.5), 0x3a2f28, { rough: 0.95 });
  return P.merge();
}
