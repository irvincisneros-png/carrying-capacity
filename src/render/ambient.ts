// Ambient life and clutter around what the player builds: paddocks with cows and hay around farms, sheds and
// clotheslines by homes, cars on roads (era-aware), coal wagons on rail, boats at the port and on the estuary,
// industrial clutter, kayaks and picnics on restored shores. All in one batched draw call.
import { Color, Matrix4, Quaternion, Vector3, type Group } from 'three';
import { estuaryHealth } from '../sim/metrics';
import { TileKind, type BuildingId, type GameState } from '../sim/types';
import { Batch, prepBatchGeo } from './batch';
import type { MapGeo } from './mapgeo';
import type { MatLib } from './materials';
import { buildAmbient, type AmbientId } from './models/ambient';
import { hash2 } from './noise';
import { Parts, T, blob } from './geo';
import { BoxGeometry, type BufferGeometry } from 'three';

/** Low ring of sandstone stones with an ochre band: marks a place the community asked to be consulted about. */
function markerGeo(): BufferGeometry {
  const P = new Parts();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const g = T(blob(0.035 + (i % 3) * 0.008, 0, 900 + i, 0.4, 0.8), Math.cos(a) * 0.16, 0.02, Math.sin(a) * 0.16);
    P.add(g, i % 2 ? 0xd9b47a : 0xb5623a, { ao: 0.7 });
  }
  P.add(T(new BoxGeometry(0.05, 0.004, 0.05), 0, 0.002, 0), 0xb5623a);
  return P.merge();
}

const CAR_COLS = [0xc23b2e, 0x2f5f9a, 0xe8e2d0, 0x3d7a4e, 0xe0b23a, 0x6a6e74, 0x8a3a5a, 0x1f2a36];
const BOAT_COLS = [0xf2efe6, 0xc23b2e, 0x2f6f9a, 0xe8c24a];
const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);
const _c = new Color();

const HOMES: ReadonlySet<BuildingId> = new Set<BuildingId>(['cottage', 'suburb', 'rooftopsolar']);
const INDUSTRY: ReadonlySet<BuildingId> = new Set<BuildingId>(['factory', 'steelworks', 'coalpower', 'coalmine', 'landfill', 'gaspower', 'excavation']);

export class AmbientLayer {
  batch: Batch;
  private ids: number[] = [];
  private detail: 0 | 1 = 1;
  private sig = '';
  density = 1;

  constructor(private map: MapGeo, private lib: MatLib, private group: Group) {
    this.batch = this.make();
  }

  private make(): Batch {
    const b = new Batch(this.lib.get({ key: 'ambient', kind: 'prop' }), null, 512, 60_000);
    b.mesh.castShadow = true;
    b.mesh.receiveShadow = true;
    b.mesh.name = 'ambient';
    this.group.add(b.mesh);
    return b;
  }

  /**
   * Per-frame hook for moving life (traffic, pedestrians). Nothing moves yet: the cars and wagons placed by sync()
   * are static. A later layer drives its own instanced meshes from here (called once a frame with the clock in seconds).
   */
  update(_dt: number, _time: number): void {}

  setDetail(detail: 0 | 1): void {
    if (detail === this.detail) return;
    this.detail = detail;
    this.group.remove(this.batch.mesh);
    this.batch.dispose();
    this.batch = this.make();
    this.ids.length = 0;
    this.sig = '';
  }

  private putGeo(key: string, make: () => BufferGeometry, x: number, y: number, z: number, yaw: number, s = 1, col?: number): void {
    const gid = this.batch.geo(key, () => prepBatchGeo(make()));
    _q.setFromAxisAngle(_up, yaw);
    _m.compose(_p.set(x, y, z), _q, _s.set(s, s, s));
    this.ids.push(this.batch.add(gid, _m, col !== undefined ? _c.set(col) : undefined));
  }

  private put(id: AmbientId, x: number, y: number, z: number, yaw: number, s = 1, col?: number): void {
    const gid = this.batch.geo(`${id}:${this.detail}`, () => prepBatchGeo(buildAmbient(id, this.detail)));
    _q.setFromAxisAngle(_up, yaw);
    _m.compose(_p.set(x, y, z), _q, _s.set(s, s, s));
    this.ids.push(this.batch.add(gid, _m, col !== undefined ? _c.set(col) : undefined));
  }

  sync(s: GameState): void {
    const g = s.grid;
    const est = Math.round(estuaryHealth(s) / 10);
    const act2 = s.phase === 'act2' || s.phase === 'epilogue' || s.phase === 'failed';
    const era = s.year < 1925 ? 0 : s.year < 1950 ? 1 : 2;
    const consulted = (s as { country?: { consulted?: number[] } }).country?.consulted ?? [];
    const sig = `${s.buildings.length}:${s.nextUid}:${era}:${est}:${act2 ? s.year : 0}:${this.density}:${consulted.length}`;
    if (sig === this.sig) return;
    this.sig = sig;
    for (const id of this.ids) this.batch.remove(id);
    this.ids.length = 0;

    const map = this.map;
    const W = g.w;
    const typeAt = new Map<number, BuildingId>();
    for (const b of s.buildings) typeAt.set(b.uid, b.type);
    const tAt = (tx: number, ty: number): BuildingId | null => {
      if (!map.inBounds(tx, ty)) return null;
      const u = g.building[ty * W + tx] ?? 0;
      return u ? typeAt.get(u) ?? null : null;
    };
    const free = (tx: number, ty: number): boolean => {
      if (!map.inBounds(tx, ty)) return false;
      const i = ty * W + tx;
      const k = g.kind[i];
      return (g.building[i] ?? 0) === 0 && (k === TileKind.Land);
    };
    const near = (tx: number, ty: number, set: ReadonlySet<BuildingId> | BuildingId, r = 1): boolean => {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (!dx && !dy) continue;
        const t = tAt(tx + dx, ty + dy);
        if (t && (typeof set === 'string' ? t === set : set.has(t))) return true;
      }
      return false;
    };
    const dens = this.density;
    const yawQ = (h: number): number => Math.floor(h * 4) * (Math.PI / 2);

    for (let ty = 0; ty < g.h; ty++) {
      for (let tx = 0; tx < W; tx++) {
        const i = ty * W + tx;
        const k = g.kind[i] ?? 0;
        const r = (n: number): number => hash2(i * 7 + n, 977);
        const cx = map.cx(tx);
        const cz = map.cz(ty);
        const own = tAt(tx, ty);
        const sig = (g as { significant?: Uint8Array }).significant?.[i] ?? 0;
        if (sig > 0 && !own && r(90) < 0.55) {
          const mx = cx + (r(91) - 0.5) * 0.4;
          const mz = cz + (r(92) - 0.5) * 0.4;
          this.putGeo('marker', markerGeo, mx, map.heightAt(mx, mz) - 0.005, mz, r(93) * 6.28, consulted.includes(sig) ? 1.15 : 1, consulted.includes(sig) ? 0xffffff : 0xe8d0c0);
        }
        // ---- roads: cars + trucks
        if (own === 'road' && era > 0) {
          const p = (era === 1 ? 0.18 : 0.42) * dens + (near(tx, ty, HOMES, 1) ? 0.15 : 0);
          if (r(1) < p) {
            const along = r(2) < 0.5;
            const off = (r(3) - 0.5) * 0.5;
            const lane = r(4) < 0.5 ? -0.1 : 0.1;
            const x = cx + (along ? lane : off);
            const z = cz + (along ? off : lane);
            const truck = near(tx, ty, INDUSTRY, 2) && r(5) < 0.5;
            this.put(truck ? 'truck' : 'car', x, map.heightAt(cx, cz) + 0.045, z, (along ? 0 : Math.PI / 2) + (lane > 0 ? Math.PI : 0) + Math.PI / 2, 1, CAR_COLS[(r(6) * CAR_COLS.length) | 0]);
          }
          continue;
        }
        // ---- rail: coal wagons in strings
        if (own === 'rail' && r(1) < 0.45 * dens && !act2) {
          const ns = tAt(tx, ty - 1) === 'rail' || tAt(tx, ty + 1) === 'rail';
          for (const o of [-0.2, 0.2]) {
            this.put('wagon', cx + (ns ? 0 : o), map.heightAt(cx, cz) + 0.09, cz + (ns ? o : 0), ns ? Math.PI / 2 : 0, 1, 0x5a4a3e);
          }
          continue;
        }
        if (own) continue;
        // ---- free land next to things
        if (free(tx, ty)) {
          const y = (x: number, z: number): number => map.heightAt(x, z);
          if (near(tx, ty, 'farm', 1) && r(10) < 0.85 * dens) {
            // paddock: fence on two sides, animals, hay
            for (let f = 0; f < 4; f++) {
              const fx = cx - 0.375 + f * 0.25;
              if (r(11) < 0.5) this.put('fence', fx, y(fx, cz - 0.46), cz - 0.46, 0, 0.25);
              this.put('fence', cx - 0.46, y(cx - 0.46, fx - cx + cz), fx - cx + cz, Math.PI / 2, 0.25);
            }
            const sheep = r(12) < 0.4;
            const n = 2 + ((r(13) * 3) | 0);
            for (let a = 0; a < n; a++) {
              const ax = cx + (hash2(i, a * 3 + 1) - 0.5) * 0.7;
              const az = cz + (hash2(i, a * 3 + 2) - 0.5) * 0.7;
              this.put(sheep ? 'sheep' : 'cow', ax, y(ax, az), az, hash2(i, a * 3 + 3) * 6.28, 1.15);
            }
            if (r(14) < 0.5) this.put('haybale', cx + 0.25, y(cx + 0.25, cz + 0.25), cz + 0.25, r(15) * 3, 1.1);
            continue;
          }
          if (near(tx, ty, HOMES, 1) && r(20) < 0.55 * dens) {
            const pick = r(21);
            const ox = (r(22) - 0.5) * 0.4;
            const oz = (r(23) - 0.5) * 0.4;
            if (pick < 0.3) this.put('shed', cx + ox, y(cx + ox, cz + oz), cz + oz, yawQ(r(24)), 1.1);
            else if (pick < 0.6) this.put('clothesline', cx + ox, y(cx + ox, cz + oz), cz + oz, r(24) * 3, 1.2);
            else if (pick < 0.8) this.put('watertank', cx + ox, y(cx + ox, cz + oz), cz + oz, 0, 1.1);
            else if (act2) this.put('picnic', cx + ox, y(cx + ox, cz + oz), cz + oz, r(24) * 3, 1.2);
            else this.put('bin', cx + ox, y(cx + ox, cz + oz), cz + oz, 0, 1.2);
            if (r(25) < 0.6) {
              for (let f = 0; f < 4; f++) {
                const fx = cx - 0.375 + f * 0.25;
                this.put('fence', fx, y(fx, cz + 0.46), cz + 0.46, 0, 0.25);
              }
            }
            continue;
          }
          if (near(tx, ty, INDUSTRY, 1) && r(30) < 0.5 * dens) {
            const n = 1 + ((r(31) * 3) | 0);
            for (let a = 0; a < n; a++) {
              const ax = cx + (hash2(i, a + 40) - 0.5) * 0.6;
              const az = cz + (hash2(i, a + 50) - 0.5) * 0.6;
              this.put(hash2(i, a + 60) < 0.6 ? 'crate' : 'bin', ax, y(ax, az), az, yawQ(hash2(i, a + 70)), 1.2);
            }
            if (r(32) < 0.35 && era > 0) this.put('truck', cx, y(cx, cz) + 0.01, cz, yawQ(r(33)), 1, CAR_COLS[(r(34) * CAR_COLS.length) | 0]);
          }
          continue;
        }
        // ---- water: boats at the port, fishing boats / kayaks on the estuary
        if (k === TileKind.Sea && near(tx, ty, 'port', 2) && r(40) < 0.35 * dens) {
          this.put('boat', cx + (r(41) - 0.5) * 0.4, 0, cz + (r(42) - 0.5) * 0.4, r(43) * 6.28, 1.3, BOAT_COLS[(r(44) * BOAT_COLS.length) | 0]);
          continue;
        }
        if (k === TileKind.Estuary || k === TileKind.River) {
          const clean = est / 10;
          if (k === TileKind.Estuary && r(50) < 0.22 * dens * (0.3 + clean)) {
            this.put('boat', cx + (r(51) - 0.5) * 0.4, 0, cz + (r(52) - 0.5) * 0.4, r(53) * 6.28, 0.85, BOAT_COLS[(r(54) * BOAT_COLS.length) | 0]);
          } else if (act2 && clean > 0.55 && r(55) < 0.25 * dens) {
            this.put('kayak', cx + (r(56) - 0.5) * 0.4, 0, cz + (r(57) - 0.5) * 0.4, r(58) * 6.28, 1.2, BOAT_COLS[(r(59) * BOAT_COLS.length) | 0]);
          }
          continue;
        }
        if (k === TileKind.Beach && act2 && (g.stage[i] ?? 0) >= 2 && r(60) < 0.2 * dens) {
          const x = cx + (r(61) - 0.5) * 0.4;
          const z = cz + (r(62) - 0.5) * 0.4;
          if (map.heightAt(x, z) > 0.03) this.put(r(63) < 0.5 ? 'picnic' : 'kayak', x, map.heightAt(x, z), z, r(64) * 6.28, 1.2, BOAT_COLS[(r(65) * BOAT_COLS.length) | 0]);
        }
      }
    }
  }
}
