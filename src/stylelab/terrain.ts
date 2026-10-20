// Terrain surface, cut-away slab walls (strata) and water-side "glass" wall.
import { BufferGeometry, Color, DataTexture, Float32BufferAttribute, LinearFilter, RedFormat, UnsignedByteType, ClampToEdgeWrapping } from 'three';
import { CELL, HALF, Kind, SEG, VERTS, PAD, COALYARD, STOCKPILES, headlandFactor, rectMask, type World } from './world';
import { fbm, hash2, smoothstep, vnoise } from './noise';

const C = (h: number) => new Color(h);

const R = {
  grass: C(0x7d9a52), grass2: C(0x678a44), dryGold: C(0xb9a45a), heath: C(0x8f9e60), sandstone: C(0xd9c28e),
  sand: C(0xead6a4), bankR: C(0x75834c), lawn: C(0x86a654), brownfieldR: C(0x8c9566),
  seaSand: C(0xdccf9f), estSand: C(0xb9a97a), reefBed: C(0xc4b487), deepBed: C(0x9fae94),
};
const P = {
  ochre: C(0xa88f5a), dirt: C(0x8f6c46), slate: C(0x77706a), rust: C(0x9a5832), dryKhaki: C(0xa39467),
  sand: C(0xb0a083), mud: C(0x55473a), pad: C(0x8e8374), oil: C(0x3e3832), coal: C(0x302c28), silt: C(0x5c4f3f),
};

function mixInto(out: Color, c: Color, t: number): void {
  if (t <= 0) return;
  out.lerp(c, Math.min(1, t));
}

function terrainColours(w: World, k: number, x: number, z: number, h: number, rest: Color, poll: Color): void {
  const kind = w.kind[k];
  const n1 = fbm(x * 0.45 + 11, z * 0.45 + 3, 3);
  const n2 = fbm(x * 1.3 - 4, z * 1.3 + 8, 3);
  const n3 = vnoise(x * 3.1, z * 3.1);
  if (kind !== Kind.Land) {
    if (kind === Kind.Sea) {
      rest.copy(R.seaSand).lerp(R.deepBed, smoothstep(-0.3, -1.4, h));
      const reef = smoothstep(-0.55, -0.38, h) * smoothstep(1.2, 2.6, w.dLand[k]);
      mixInto(rest, R.reefBed, reef * 0.8);
    } else {
      rest.copy(R.estSand).lerp(R.bankR, smoothstep(-0.4, -0.15, h) * 0.3);
    }
    rest.multiplyScalar(0.9 + 0.2 * n3);
    poll.copy(P.silt).multiplyScalar(0.85 + 0.25 * n2);
    return;
  }
  const hl = headlandFactor(x, z);
  const ds = w.dSea[k];
  const de = w.dEst[k];
  // ---- restored ----
  rest.copy(R.grass).lerp(R.grass2, smoothstep(0.35, 0.65, n1));
  mixInto(rest, R.dryGold, smoothstep(0.58, 0.75, n2) * 0.75);
  mixInto(rest, R.heath, hl);
  mixInto(rest, R.sandstone, hl * smoothstep(0.62, 0.72, n2));
  const town = smoothstep(-2.4, -3.6, x) * smoothstep(-4.2, -3.2, z);
  mixInto(rest, R.lawn, town * 0.5);
  const pad = rectMask(x, z, PAD, 0.6);
  const yard = rectMask(x, z, COALYARD, 0.6);
  mixInto(rest, R.brownfieldR, Math.max(pad, yard) * 0.7);
  const beach = (1 - smoothstep(0.5, 1.25, ds + (n3 - 0.5) * 0.4)) * (1 - smoothstep(0.3, 0.6, hl)) * (1 - smoothstep(0.3, 0.6, h));
  mixInto(rest, R.sand, beach);
  const bank = 1 - smoothstep(0.1, 0.45, de);
  mixInto(rest, R.bankR, bank * 0.8);
  rest.multiplyScalar(0.92 + 0.16 * n3);

  // ---- polluted ----
  poll.copy(P.ochre).lerp(P.dirt, smoothstep(0.4, 0.7, n1));
  mixInto(poll, P.slate, smoothstep(0.62, 0.78, n2) * 0.7);
  mixInto(poll, P.dryKhaki, hl);
  mixInto(poll, P.rust, smoothstep(0.55, 0.8, n2) * (1 - smoothstep(0, 3.5, Math.hypot(x - -8, z - -7.5))) * 0.6);
  mixInto(poll, P.pad, pad * 0.85);
  mixInto(poll, P.oil, pad * smoothstep(0.66, 0.72, n1) * 0.7);
  mixInto(poll, P.rust, pad * smoothstep(0.6, 0.66, n2) * 0.5);
  let coal = 0;
  for (const s of STOCKPILES) coal = Math.max(coal, 1 - smoothstep(0.6, 2.2, Math.hypot((x - s.x) / (s.l * 0.5 + 0.2), (z - s.z) / (s.w * 0.5 + 0.2))));
  mixInto(poll, P.coal, Math.max(coal, yard * 0.55));
  mixInto(poll, P.sand, beach);
  mixInto(poll, P.mud, bank * 0.9);
  poll.multiplyScalar(0.9 + 0.2 * n3);
}

export interface TerrainBuild {
  terrain: BufferGeometry;
  slab: BufferGeometry;
  waterSide: BufferGeometry;
  heightTex: DataTexture;
}

const BOTTOM = -3.7;
const BASE = -4.35;
const LIP = 0.08;
const INSET = 0.7;

export function buildTerrain(w: World): TerrainBuild {
  const n = VERTS;
  const pos = new Float32Array(n * n * 3);
  const colA = new Float32Array(n * n * 3);
  const colB = new Float32Array(n * n * 3);
  const rest = new Color();
  const poll = new Color();
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      let x = -HALF + i * CELL;
      let z = -HALF + j * CELL;
      const h = w.heights[k];
      terrainColours(w, k, x, z, h, rest, poll);
      // low-poly irregularity: jitter interior vertices
      if (i > 0 && i < SEG && j > 0 && j < SEG) {
        x += (hash2(i, j) - 0.5) * CELL * 0.45;
        z += (hash2(j + 91, i + 13) - 0.5) * CELL * 0.45;
      }
      pos[k * 3] = x;
      pos[k * 3 + 1] = h;
      pos[k * 3 + 2] = z;
      colA[k * 3] = rest.r; colA[k * 3 + 1] = rest.g; colA[k * 3 + 2] = rest.b;
      colB[k * 3] = poll.r; colB[k * 3 + 1] = poll.g; colB[k * 3 + 2] = poll.b;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < SEG; j++) {
    for (let i = 0; i < SEG; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      if ((i + j) % 2 === 0) idx.push(a, c, b, b, c, d);
      else idx.push(a, c, d, a, d, b);
    }
  }
  const terrain = new BufferGeometry();
  terrain.setAttribute('position', new Float32BufferAttribute(pos, 3));
  terrain.setAttribute('color', new Float32BufferAttribute(colA, 3));
  terrain.setAttribute('color2', new Float32BufferAttribute(colB, 3));
  terrain.setIndex(idx);
  terrain.computeVertexNormals();
  terrain.computeBoundingSphere();

  // ---- slab walls (perimeter) ----
  const sp: number[] = [];
  const sd: number[] = [];
  const wp: number[] = [];
  // edge walk: each edge as list of [x, z, outX, outZ, h]
  type EP = { x: number; z: number; ox: number; oz: number; h: number };
  const edges: EP[][] = [];
  const mk = (i: number, j: number, ox: number, oz: number): EP => {
    // corners get diagonal offset
    const cx = i === 0 ? -1 : i === SEG ? 1 : 0;
    const cz = j === 0 ? -1 : j === SEG ? 1 : 0;
    const fx = cx !== 0 && cz !== 0 ? cx : ox;
    const fz = cx !== 0 && cz !== 0 ? cz : oz;
    return { x: -HALF + i * CELL, z: -HALF + j * CELL, ox: fx, oz: fz, h: w.heights[j * n + i] };
  };
  const north: EP[] = [], south: EP[] = [], west: EP[] = [], east: EP[] = [];
  // walk direction chosen so triangles wind outward
  for (let i = 0; i <= SEG; i++) north.push(mk(i, 0, 0, -1));
  for (let i = 0; i <= SEG; i++) south.push(mk(SEG - i, SEG, 0, 1));
  for (let j = 0; j <= SEG; j++) west.push(mk(0, SEG - j, -1, 0));
  for (let j = 0; j <= SEG; j++) east.push(mk(SEG, j, 1, 0));
  edges.push(north, south, west, east);
  const bottomY = (x: number, z: number) => BOTTOM + (vnoise(x * 0.9 + 3, z * 0.9 - 2) - 0.5) * 0.5;
  for (const e of edges) {
    for (let s = 0; s < e.length - 1; s++) {
      const a = e[s];
      const b = e[s + 1];
      // rows: 0 top edge, 1 lip, 2 bottom of wall, 3 inset base
      const row = (p: EP) => {
        const top = p.h;
        const by = Math.min(bottomY(p.x, p.z), top - 0.6);
        return [
          [p.x, top, p.z, 0],
          [p.x + p.ox * LIP, top - 0.1, p.z + p.oz * LIP, 0.1],
          [p.x + p.ox * LIP, by, p.z + p.oz * LIP, top - by],
          [p.x - p.ox * INSET, BASE, p.z - p.oz * INSET, top - BASE],
        ];
      };
      const ra = row(a);
      const rb = row(b);
      for (let r = 0; r < 3; r++) {
        const v = [ra[r], rb[r], rb[r + 1], ra[r], rb[r + 1], ra[r + 1]];
        for (const q of v) {
          sp.push(q[0], q[1], q[2]);
          sd.push(q[3]);
        }
      }
      // water glass where both ends are underwater
      if (a.h < -0.02 && b.h < -0.02) {
        const off = LIP + 0.012;
        const A0 = [a.x + a.ox * off, a.h - 0.1, a.z + a.oz * off];
        const B0 = [b.x + b.ox * off, b.h - 0.1, b.z + b.oz * off];
        const A1 = [a.x + a.ox * off, 0, a.z + a.oz * off];
        const B1 = [b.x + b.ox * off, 0, b.z + b.oz * off];
        wp.push(...A1, ...B1, ...B0, ...A1, ...B0, ...A0);
      }
    }
  }
  // bottom cap
  const b0 = -HALF + INSET;
  const b1 = HALF - INSET;
  const bc = [[b0, BASE, b0], [b1, BASE, b0], [b1, BASE, b1], [b0, BASE, b1]];
  for (const q of [bc[0], bc[1], bc[2], bc[0], bc[2], bc[3]]) {
    sp.push(q[0], q[1], q[2]);
    sd.push(9);
  }
  const slab = new BufferGeometry();
  slab.setAttribute('position', new Float32BufferAttribute(sp, 3));
  slab.setAttribute('sdepth', new Float32BufferAttribute(sd, 1));
  const white = new Float32Array((sp.length / 3) * 3).fill(1);
  slab.setAttribute('color', new Float32BufferAttribute(white, 3));
  slab.computeVertexNormals();
  slab.computeBoundingSphere();

  const waterSide = new BufferGeometry();
  waterSide.setAttribute('position', new Float32BufferAttribute(wp, 3));
  waterSide.computeVertexNormals();
  waterSide.computeBoundingSphere();

  // ---- height texture for water depth (y in [-2, 1] -> [0, 255]) ----
  const ht = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) ht[k] = Math.max(0, Math.min(255, Math.round(((w.heights[k] + 2) / 3) * 255)));
  const heightTex = new DataTexture(ht, n, n, RedFormat, UnsignedByteType);
  heightTex.magFilter = LinearFilter;
  heightTex.minFilter = LinearFilter;
  heightTex.wrapS = heightTex.wrapT = ClampToEdgeWrapping;
  heightTex.needsUpdate = true;

  return { terrain, slab, waterSide, heightTex };
}
