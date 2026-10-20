// Terrain surface, cut-away slab walls (strata) and water-side "glass" wall, sized to the map.
import {
  BufferGeometry, ClampToEdgeWrapping, Color, DataTexture, Float32BufferAttribute, LinearFilter, RedFormat, UnsignedByteType,
} from 'three';
import { TileKind } from '../sim/types';
import { MapGeo } from './mapgeo';
import { fbm, hash2, smoothstep, vnoise } from './noise';
import { ZONE_GROUND, type BiomeLook, type GroundSet } from './biome';

const C = (h: number): Color => new Color(h);
type GC = Record<keyof GroundSet, Color>;
const cache = new Map<string, GC>();
function groundColours(look: BiomeLook): GC {
  let g = cache.get(look.id);
  if (!g) {
    g = Object.fromEntries(Object.entries(look.ground).map(([k, v]) => [k, C(v)])) as GC;
    cache.set(look.id, g);
  }
  return g;
}
const DUNE = C(0xc9c58a);
const ZONES: Record<number, Color> = Object.fromEntries(Object.entries(ZONE_GROUND).map(([k, v]) => [Number(k), C(v)]));
const SEEDED = C(0x9a8a4e);
const SIGNED = C(0xa8955a);

const _a = new Color();
const _b = new Color();

/** Lush + bare colours for one tile kind at a world point. */
function kindColours(G: GC, look: BiomeLook, kind: number, stage: number, zone: number, x: number, z: number, h: number, lush: Color, bare: Color): void {
  const n1 = fbm(x * 0.45 + 11, z * 0.45 + 3, 3);
  const n2 = fbm(x * 1.3 - 4, z * 1.3 + 8, 3);
  switch (kind) {
    case TileKind.Sea:
    case TileKind.Reef: {
      lush.copy(G.seaBed).lerp(G.deepBed, smoothstep(-0.3, -1.3, h));
      if (kind === TileKind.Reef) lush.lerp(G.reefBed, 0.75);
      bare.copy(lush).lerp(G.estMud2, 0.35);
      return;
    }
    case TileKind.Estuary:
      lush.copy(G.estMud).lerp(G.estMud2, smoothstep(0.4, 0.7, n1));
      bare.copy(G.estMud2).multiplyScalar(0.9);
      return;
    case TileKind.River:
      if (look.dryCreeks) {
        lush.copy(G.creekBed).lerp(G.sand, smoothstep(0.4, 0.7, n2) * 0.5);
        bare.copy(lush);
        return;
      }
      lush.copy(G.riverBed);
      bare.copy(G.estMud2);
      return;
    case TileKind.Wetland:
      lush.copy(G.wetlandBed).lerp(G.estMud, smoothstep(0.4, 0.7, n1) * 0.5);
      bare.copy(G.estMud2);
      return;
    case TileKind.Pit: {
      const base = stage <= 0 ? G.pit : stage === 1 ? G.pitReshaped : G.topsoil;
      lush.copy(base).lerp(stage <= 0 ? G.pit2 : base, smoothstep(0.4, 0.7, n2));
      bare.copy(lush);
      return;
    }
    case TileKind.Beach:
      lush.copy(G.sand).lerp(G.sandWet, smoothstep(0.2, 0.0, h));
      lush.lerp(DUNE, smoothstep(0.6, 0.75, n2) * 0.5);
      bare.copy(G.sand).lerp(G.sandWet, smoothstep(0.2, 0.0, h) * 0.6);
      return;
    case TileKind.Rock:
      lush.copy(G.rock).lerp(G.rock2, smoothstep(0.45, 0.7, n2));
      lush.lerp(G.grass2, smoothstep(0.62, 0.75, n1) * (look.id === 'arid' ? 0.1 : 0.45));
      bare.copy(G.rock).lerp(G.rock2, smoothstep(0.45, 0.7, n2));
      return;
    default:
      lush.copy(G.grass).lerp(G.grass2, smoothstep(0.35, 0.65, n1));
      lush.lerp(G.dry, smoothstep(0.6, 0.78, n2) * 0.6);
      bare.copy(G.bare).lerp(G.bare2, smoothstep(0.4, 0.7, n1));
      bare.lerp(G.dirt, smoothstep(0.62, 0.78, n2) * 0.6);
      bare.lerp(G.dry, smoothstep(0.3, 0.5, n2) * 0.35);
      if (zone > 0 && ZONES[zone] && look.id === 'urban') {
        const zc = ZONES[zone]!;
        lush.lerp(zc, zone === 2 ? 0.35 : 0.75);
        bare.lerp(zc, zone === 2 ? 0.5 : 0.85);
      } else if (zone === 1 && look.id === 'arid') {
        lush.copy(G.pitReshaped).lerp(G.dirt, 0.3);
        bare.copy(lush);
      } else if (zone >= 100 && look.id === 'arid') {
        // rehabilitated mine ground: honeycomb of young seedlings, then signed off
        lush.lerp(zone >= 250 ? SIGNED : SEEDED, 0.35);
      }
  }
}

export interface TerrainBuild {
  terrain: BufferGeometry;
  slab: BufferGeometry;
  waterSide: BufferGeometry;
  heightTex: DataTexture;
}

const BOTTOM = -3.8;
const BASE = -4.5;
const LIP = 0.08;
const INSET = 0.8;

export function buildTerrain(map: MapGeo): TerrainBuild {
  const { vx, vz, w: W, h: H } = map;
  const RES = map.res;
  const pos = new Float32Array(vx * vz * 3);
  const colA = new Float32Array(vx * vz * 3);
  const colB = new Float32Array(vx * vz * 3);
  const lush = new Color();
  const bare = new Color();
  const look = map.look;
  const GC = groundColours(look);
  const wp = { x: 0, z: 0 };
  for (let j = 0; j < vz; j++) {
    for (let i = 0; i < vx; i++) {
      const k = j * vx + i;
      let x = -W / 2 + i / RES;
      let z = -H / 2 + j / RES;
      const h = map.heights[k]!;
      // colour: plateau blend of the 4 nearest tile colours at the warped point
      map.warp(x, z, wp);
      const u = Math.max(0, Math.min(W - 1, wp.x + W / 2 - 0.5));
      const v = Math.max(0, Math.min(H - 1, wp.z + H / 2 - 0.5));
      const i0 = Math.min(W - 2, Math.floor(u));
      const j0 = Math.min(H - 2, Math.floor(v));
      const fu = smoothstep(0.25, 0.75, u - i0);
      const fv = smoothstep(0.25, 0.75, v - j0);
      lush.setRGB(0, 0, 0);
      bare.setRGB(0, 0, 0);
      const corners: [number, number, number][] = [
        [i0, j0, (1 - fu) * (1 - fv)], [i0 + 1, j0, fu * (1 - fv)], [i0, j0 + 1, (1 - fu) * fv], [i0 + 1, j0 + 1, fu * fv],
      ];
      for (const [ti, tj, wgt] of corners) {
        if (wgt <= 0) continue;
        const ti2 = tj * W + ti;
        kindColours(GC, look, map.kinds[ti2] ?? TileKind.Land, map.stages[ti2] ?? 0, map.zones[ti2] ?? 0, x, z, h, _a, _b);
        lush.r += _a.r * wgt; lush.g += _a.g * wgt; lush.b += _a.b * wgt;
        bare.r += _b.r * wgt; bare.g += _b.g * wgt; bare.b += _b.b * wgt;
      }
      // wet sand band right at the waterline
      const wet = 1 - smoothstep(0.0, 0.1, Math.abs(h - 0.02));
      lush.lerp(GC.sandWet, wet * 0.5);
      bare.lerp(GC.sandWet, wet * 0.4);
      const n3 = 0.92 + 0.16 * vnoise(x * 3.1, z * 3.1);
      lush.multiplyScalar(n3);
      bare.multiplyScalar(n3);
      if (i > 0 && i < map.segX && j > 0 && j < map.segZ) {
        x += (hash2(i, j) - 0.5) * (0.45 / RES);
        z += (hash2(j + 91, i + 13) - 0.5) * (0.45 / RES);
      }
      pos[k * 3] = x;
      pos[k * 3 + 1] = h;
      pos[k * 3 + 2] = z;
      colA[k * 3] = lush.r; colA[k * 3 + 1] = lush.g; colA[k * 3 + 2] = lush.b;
      colB[k * 3] = bare.r; colB[k * 3 + 1] = bare.g; colB[k * 3 + 2] = bare.b;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < map.segZ; j++) {
    for (let i = 0; i < map.segX; i++) {
      const a = j * vx + i, b = a + 1, c = a + vx, d = c + 1;
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

  // ---- slab walls (perimeter)
  const sp: number[] = [];
  const sd: number[] = [];
  const wpos: number[] = [];
  type EP = { x: number; z: number; ox: number; oz: number; h: number };
  const mk = (i: number, j: number, ox: number, oz: number): EP => {
    const cx = i === 0 ? -1 : i === map.segX ? 1 : 0;
    const cz = j === 0 ? -1 : j === map.segZ ? 1 : 0;
    const fx = cx !== 0 && cz !== 0 ? cx : ox;
    const fz = cx !== 0 && cz !== 0 ? cz : oz;
    return { x: -W / 2 + i / RES, z: -H / 2 + j / RES, ox: fx, oz: fz, h: map.heights[j * vx + i]! };
  };
  const north: EP[] = [], south: EP[] = [], west: EP[] = [], east: EP[] = [];
  for (let i = 0; i <= map.segX; i++) north.push(mk(i, 0, 0, -1));
  for (let i = 0; i <= map.segX; i++) south.push(mk(map.segX - i, map.segZ, 0, 1));
  for (let j = 0; j <= map.segZ; j++) west.push(mk(0, map.segZ - j, -1, 0));
  for (let j = 0; j <= map.segZ; j++) east.push(mk(map.segX, j, 1, 0));
  const bottomY = (x: number, z: number): number => BOTTOM + (vnoise(x * 0.9 + 3, z * 0.9 - 2) - 0.5) * 0.6;
  for (const e of [north, south, west, east]) {
    for (let s = 0; s < e.length - 1; s++) {
      const a = e[s]!;
      const b = e[s + 1]!;
      const row = (p: EP): number[][] => {
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
        for (const q of [ra[r]!, rb[r]!, rb[r + 1]!, ra[r]!, rb[r + 1]!, ra[r + 1]!]) {
          sp.push(q[0]!, q[1]!, q[2]!);
          sd.push(q[3]!);
        }
      }
      if (a.h < -0.02 && b.h < -0.02) {
        const off = LIP + 0.012;
        const A0 = [a.x + a.ox * off, a.h - 0.1, a.z + a.oz * off];
        const B0 = [b.x + b.ox * off, b.h - 0.1, b.z + b.oz * off];
        const A1 = [a.x + a.ox * off, 0, a.z + a.oz * off];
        const B1 = [b.x + b.ox * off, 0, b.z + b.oz * off];
        wpos.push(...A1, ...B1, ...B0, ...A1, ...B0, ...A0);
      }
    }
  }
  const bx0 = -W / 2 + INSET, bx1 = W / 2 - INSET, bz0 = -H / 2 + INSET, bz1 = H / 2 - INSET;
  const bc = [[bx0, BASE, bz0], [bx1, BASE, bz0], [bx1, BASE, bz1], [bx0, BASE, bz1]];
  for (const q of [bc[0]!, bc[1]!, bc[2]!, bc[0]!, bc[2]!, bc[3]!]) {
    sp.push(q[0]!, q[1]!, q[2]!);
    sd.push(9);
  }
  const slab = new BufferGeometry();
  slab.setAttribute('position', new Float32BufferAttribute(sp, 3));
  slab.setAttribute('sdepth', new Float32BufferAttribute(sd, 1));
  slab.setAttribute('color', new Float32BufferAttribute(new Float32Array(sp.length).fill(1), 3));
  slab.computeVertexNormals();
  slab.computeBoundingSphere();

  const waterSide = new BufferGeometry();
  waterSide.setAttribute('position', new Float32BufferAttribute(wpos, 3));
  waterSide.computeVertexNormals();
  waterSide.computeBoundingSphere();

  // ---- height texture for water depth (y in [-2, 1] -> [0, 255])
  const ht = new Uint8Array(vx * vz);
  for (let k = 0; k < vx * vz; k++) ht[k] = Math.max(0, Math.min(255, Math.round(((map.heights[k]! + 2) / 3) * 255)));
  const heightTex = new DataTexture(ht, vx, vz, RedFormat, UnsignedByteType);
  heightTex.magFilter = LinearFilter;
  heightTex.minFilter = LinearFilter;
  heightTex.wrapS = heightTex.wrapT = ClampToEdgeWrapping;
  heightTex.needsUpdate = true;
  return { terrain, slab, waterSide, heightTex };
}
