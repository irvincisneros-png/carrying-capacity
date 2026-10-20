// Every placed building as a batched instance of its procedural model (one draw call for all buildings plus one for
// their ink outlines), autotiled roads / rail, place + demolish pop animations, turbine rotors, smoke emitters.
import { Color, Euler, InstancedMesh, Matrix4, Quaternion, Vector3, type Group } from 'three';
import { BUILDINGS } from '../sim/buildings';
import { TileKind, type BuildingId, type GameState, type PlacedBuilding } from '../sim/types';
import { Batch, prepBatchGeo } from './batch';
import type { MapGeo } from './mapgeo';
import type { MatLib } from './materials';
import { buildBuildingModel, rotorGeo, type BuildingModel } from './models/buildings';
import { dirtArmGeo, dirtHubGeo, railArmGeo, railHubGeo, roadArmGeo, roadHubGeo } from './roadgeo';

export interface Emitter {
  x: number; y: number; z: number;
  size: number;
  steam: number;
  /** 0..~1.6 emission strength */
  strength: number;
}

interface Rec {
  uid: number;
  type: BuildingId;
  ids: number[];
  /** connection mask for road / rail */
  mask: number;
  dirt: boolean;
  x: number; y: number; z: number; yaw: number;
  b: PlacedBuilding;
}

interface Anim {
  rec: Rec;
  t: number;
  dir: 1 | -1;
}

const WATER_BUILDINGS: ReadonlySet<BuildingId> = new Set<BuildingId>(['offshorewind', 'tidal']);
const DIRS: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // +z(S), +x(E), -z(N), -x(W)
/** Buildings are drawn a little taller than modelled so they read clearly above the woodland. */
export const BSCALE_XZ = 1.08;
export const BSCALE_Y = 1.35;
const INDUSTRIAL: ReadonlySet<BuildingId> = new Set<BuildingId>(['steelworks', 'factory', 'coalpower', 'coalmine', 'port', 'landfill', 'gaspower', 'greensteel', 'recycler', 'windport']);
const RAIL_LINKS: ReadonlySet<BuildingId> = new Set<BuildingId>(['rail', 'port', 'coalmine', 'steelworks', 'coalpower']);

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();

export class BuildingLayer {
  batch: Batch;
  private recs = new Map<number, Rec>();
  private anims: Anim[] = [];
  private models = new Map<string, BuildingModel>();
  private detail: 0 | 1 = 1;
  private initial = true;
  rotors: InstancedMesh;
  private rotorInfo: { x: number; y: number; z: number; yaw: number; scale: number; speed: number; phase: number }[] = [];
  readonly emitters: Emitter[] = [];
  /** Wind multiplier for rotor speed (Act 2 weather). */
  wind = 1;
  /** Called when a building finishes appearing / starts disappearing (for dust puffs etc.). */
  onPop: ((x: number, y: number, z: number, size: number, demolish: boolean) => void) | null = null;

  constructor(private map: MapGeo, private lib: MatLib, private group: Group) {
    this.batch = this.makeBatch();
    this.rotors = new InstancedMesh(prepBatchGeo(rotorGeo(1)), lib.get({ key: 'rotor', kind: 'prop', noSmog: true }), 64);
    this.rotors.count = 0;
    this.rotors.castShadow = true;
    this.rotors.frustumCulled = false;
    group.add(this.rotors);
  }

  private makeBatch(): Batch {
    const b = new Batch(this.lib.get({ key: 'building', kind: 'prop' }), this.lib.outlineMat, 512, 300_000);
    b.mesh.castShadow = true;
    b.mesh.receiveShadow = true;
    b.mesh.name = 'buildings';
    if (b.outline) b.outline.name = 'outlines';
    this.group.add(b.mesh);
    if (b.outline) this.group.add(b.outline);
    return b;
  }

  setDetail(detail: 0 | 1, s: GameState | null): void {
    if (detail === this.detail) return;
    this.detail = detail;
    this.models.clear();
    this.group.remove(this.batch.mesh);
    if (this.batch.outline) this.group.remove(this.batch.outline);
    this.batch.dispose();
    this.batch = this.makeBatch();
    this.recs.clear();
    this.anims.length = 0;
    this.initial = true;
    if (s) this.sync(s);
    const old = this.rotors.geometry;
    this.rotors.geometry = prepBatchGeo(rotorGeo(detail));
    old.dispose();
  }

  setOutlines(on: boolean): void {
    if (this.batch.outline) this.batch.outline.visible = on;
  }

  model(type: BuildingId): BuildingModel | null {
    if (type === 'road' || type === 'rail') return null;
    const key = `${type}:${this.detail}`;
    let m = this.models.get(key);
    if (!m) {
      m = buildBuildingModel(type, this.detail);
      this.models.set(key, m);
    }
    return m;
  }

  private gid(key: string, make: () => import('three').BufferGeometry): number {
    return this.batch.geo(key, () => prepBatchGeo(make()));
  }

  /** World transform origin for a building. */
  place(b: PlacedBuilding): { x: number; y: number; z: number; yaw: number } {
    const x = b.x + b.w / 2 - this.map.w / 2;
    const z = b.y + b.h / 2 - this.map.h / 2;
    const y = this.map.padHeight(b.x, b.y, b.w, b.h, WATER_BUILDINGS.has(b.type));
    return { x, y, z, yaw: -b.rotation * (Math.PI / 2) };
  }

  private compose(rec: Rec, scaleXZ: number, scaleY: number): void {
    _q.setFromAxisAngle(_p.set(0, 1, 0), rec.yaw);
    _m.compose(_p.set(rec.x, rec.y, rec.z), _q, _s.set(scaleXZ * BSCALE_XZ, scaleY * BSCALE_Y, scaleXZ * BSCALE_XZ));
  }

  sync(s: GameState): void {
    const seen = new Set<number>();
    const g = s.grid;
    const isType = (tx: number, ty: number, set: ReadonlySet<BuildingId> | BuildingId): boolean => {
      if (!this.map.inBounds(tx, ty)) return false;
      const uid = g.building[ty * g.w + tx] ?? 0;
      if (!uid) return false;
      const r = this.recs.get(uid);
      const type = r ? r.type : s.buildings.find((bb) => bb.uid === uid)?.type;
      if (!type) return false;
      return typeof set === 'string' ? type === set : set.has(type);
    };
    const dirtEra = s.year < 1920;
    for (const b of s.buildings) {
      seen.add(b.uid);
      let rec = this.recs.get(b.uid);
      if (rec && (rec.type !== b.type || rec.b.x !== b.x || rec.b.y !== b.y || rec.b.rotation !== b.rotation)) {
        this.removeRec(rec, false);
        rec = undefined;
      }
      if (!rec) {
        const p = this.place(b);
        rec = { uid: b.uid, type: b.type, ids: [], mask: -1, dirt: dirtEra, x: p.x, y: p.y, z: p.z, yaw: p.yaw, b };
        this.recs.set(b.uid, rec);
        if (b.type !== 'road' && b.type !== 'rail') {
          const model = this.model(b.type)!;
          const gid = this.gid(`${b.type}:${this.detail}`, () => model.geo);
          this.compose(rec, this.initial ? 1 : 0.001, this.initial ? 1 : 0.001);
          const lift = INDUSTRIAL.has(b.type) ? 1.32 : 1.12;
          _c.setRGB(lift - ((b.uid * 0.37) % 1) * 0.06, lift - ((b.uid * 0.53) % 1) * 0.05, lift - ((b.uid * 0.71) % 1) * 0.07);
          rec.ids.push(this.batch.add(gid, _m, _c));
          if (!this.initial) {
            this.anims.push({ rec, t: 0, dir: 1 });
            this.onPop?.(rec.x, rec.y, rec.z, Math.max(b.w, b.h) * 0.45, false);
          }
        }
      }
      rec.b = b;
    }
    // removed
    for (const rec of [...this.recs.values()]) if (!seen.has(rec.uid)) this.removeRec(rec, !this.initial);
    // roads / rail autotile
    for (const rec of this.recs.values()) {
      if (rec.type !== 'road' && rec.type !== 'rail') continue;
      const bx = rec.b.x;
      const by = rec.b.y;
      let mask = 0;
      DIRS.forEach(([dx, dy], i) => {
        if (rec.type === 'road' ? isType(bx + dx, by + dy, 'road') : isType(bx + dx, by + dy, RAIL_LINKS)) mask |= 1 << i;
      });
      if (rec.type === 'rail') {
        if (mask === 0) mask = 0b0101;
        else if (mask === 1 || mask === 4) mask = 0b0101;
        else if (mask === 2 || mask === 8) mask = 0b1010;
      }
      const dirt = rec.type === 'road' && dirtEra;
      if (mask === rec.mask && dirt === rec.dirt) continue;
      const fresh = rec.mask === -1;
      for (const id of rec.ids) this.batch.remove(id);
      rec.ids.length = 0;
      rec.mask = mask;
      rec.dirt = dirt;
      const hubKey = rec.type === 'rail' ? 'railHub' : dirt ? 'dirtHub' : 'roadHub';
      const armKey = rec.type === 'rail' ? 'railArm' : dirt ? 'dirtArm' : 'roadArm';
      const hubG = this.gid(hubKey, rec.type === 'rail' ? railHubGeo : dirt ? dirtHubGeo : roadHubGeo);
      const armG = this.gid(armKey, rec.type === 'rail' ? railArmGeo : dirt ? dirtArmGeo : roadArmGeo);
      const cx = this.map.cx(bx);
      const cz = this.map.cz(by);
      const cy = this.map.heightAt(cx, cz) + 0.03;
      rec.x = cx; rec.y = cy; rec.z = cz; rec.yaw = 0;
      const sc = fresh && !this.initial ? 0.001 : 1;
      _q.identity();
      _m.compose(_p.set(cx, cy, cz), _q, _s.set(sc, sc, sc));
      rec.ids.push(this.batch.add(hubG, _m));
      DIRS.forEach(([dx, dy], i) => {
        if (!(mask & (1 << i))) return;
        const ex = cx + dx * 0.5;
        const ez = cz + dy * 0.5;
        const ey = Math.max(this.map.heightAt(ex, ez), 0.02) + 0.03;
        const pitch = -Math.atan2(ey - cy, 0.5);
        const yaw = Math.atan2(dx, dy);
        _e.set(pitch, yaw, 0, 'YXZ');
        _q.setFromEuler(_e);
        _m.compose(_p.set(cx, cy, cz), _q, _s.set(sc, sc, sc));
        rec.ids.push(this.batch.add(armG, _m));
      });
      // road / rail pieces carry their own per-piece matrices; the pop anim rescales the hub only via re-sync
      if (fresh && !this.initial) this.anims.push({ rec, t: 0, dir: 1 });
    }
    this.initial = false;
    this.rebuildRotorsAndEmitters(s);
  }

  private removeRec(rec: Rec, animate: boolean): void {
    this.recs.delete(rec.uid);
    if (animate && rec.type !== 'road' && rec.type !== 'rail') {
      this.anims.push({ rec, t: 1, dir: -1 });
      const m = this.model(rec.type);
      this.onPop?.(rec.x, rec.y, rec.z, Math.max(rec.b.w, rec.b.h) * 0.6 + (m ? m.height * 0.1 : 0), true);
      return;
    }
    if (animate) this.onPop?.(rec.x, rec.y, rec.z, 0.5, true);
    for (const id of rec.ids) this.batch.remove(id);
    rec.ids.length = 0;
  }

  private rebuildRotorsAndEmitters(s: GameState): void {
    this.rotorInfo.length = 0;
    this.emitters.length = 0;
    const act2 = s.phase === 'act2' || s.phase === 'epilogue' || s.phase === 'failed';
    const util = s.a2?.utilisation ?? {};
    const activeRem = new Set(s.a2?.activeRemediation ?? []);
    for (const rec of this.recs.values()) {
      const m = this.model(rec.type);
      if (!m) continue;
      const cos = Math.cos(rec.yaw);
      const sin = Math.sin(rec.yaw);
      const tx = (lx: number, lz: number): [number, number] => [rec.x + lx * cos + lz * sin, rec.z - lx * sin + lz * cos];
      m.rotors.forEach((r, i) => {
        const [x, z] = tx(r.x, r.z);
        this.rotorInfo.push({ x, y: rec.y + r.y * BSCALE_Y, z, yaw: r.yaw + rec.yaw, scale: r.scale, speed: 1.0 + ((rec.uid * 0.37 + i * 0.21) % 1) * 0.5, phase: rec.uid * 1.7 + i });
      });
      const def = BUILDINGS[rec.type];
      let strength = def.co2 > 0 ? Math.min(1.6, Math.max(0.25, def.co2 / 50)) : 0.3;
      if (act2 && def.energy && (def.energy.source === 'coal' || def.energy.source === 'gas')) strength *= util[String(rec.uid)] ?? 0.6;
      if (def.remediation?.method === 'excavate' && act2 && !activeRem.has(rec.uid)) strength = 0;
      if (rec.type === 'cottage' && s.year >= 1960) strength *= 0.3;
      if (strength <= 0.02) continue;
      for (const st of m.stacks) {
        const [x, z] = tx(st.x, st.z);
        this.emitters.push({ x, y: rec.y + st.y * BSCALE_Y, z, size: st.size, steam: st.steam, strength });
      }
    }
    this.rotors.count = this.rotorInfo.length;
    this.rotors.visible = this.rotorInfo.length > 0;
  }

  /** Per-frame: pop animations + rotor spin. No allocations. */
  update(dt: number, time: number): void {
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i]!;
      a.t += (a.dir * dt) / (a.dir > 0 ? 0.55 : 0.28);
      const t = Math.max(0, Math.min(1, a.t));
      let sxz: number;
      let sy: number;
      if (a.dir > 0) {
        // squash & stretch overshoot
        const e = easeOutBack(t);
        sy = e * (1 + 0.18 * Math.sin(t * Math.PI));
        sxz = e * (1 - 0.08 * Math.sin(t * Math.PI));
      } else {
        sy = t * t;
        sxz = 0.6 + 0.4 * t;
      }
      const rec = a.rec;
      if (rec.type === 'road' || rec.type === 'rail') {
        // hub + arms: rescale each about the tile centre (rebuild their transforms)
        this.rescalePieces(rec, Math.max(0.001, sxz));
      } else {
        this.compose(rec, Math.max(0.001, sxz), Math.max(0.001, sy));
        for (const id of rec.ids) this.batch.set(id, _m);
      }
      if ((a.dir > 0 && a.t >= 1) || (a.dir < 0 && a.t <= 0)) {
        if (a.dir < 0) {
          for (const id of rec.ids) this.batch.remove(id);
          rec.ids.length = 0;
        } else if (rec.type !== 'road' && rec.type !== 'rail') {
          const m = this.model(rec.type);
          this.onPop?.(rec.x, rec.y, rec.z, Math.max(rec.b.w, rec.b.h) * 0.55 + (m ? m.height * 0.08 : 0), false);
        }
        this.anims.splice(i, 1);
      }
    }
    // rotors
    const n = this.rotorInfo.length;
    for (let i = 0; i < n; i++) {
      const r = this.rotorInfo[i]!;
      _e.set(0, r.yaw, -(time * r.speed * this.wind * 1.6 + r.phase), 'YXZ');
      _q.setFromEuler(_e);
      _m.compose(_p.set(r.x, r.y, r.z), _q, _s.set(r.scale, r.scale, r.scale));
      this.rotors.setMatrixAt(i, _m);
    }
    if (n) this.rotors.instanceMatrix.needsUpdate = true;
  }

  private rescalePieces(rec: Rec, sc: number): void {
    const mask = rec.mask;
    let k = 0;
    _q.identity();
    _m.compose(_p.set(rec.x, rec.y, rec.z), _q, _s.set(sc, sc, sc));
    const hub = rec.ids[k++];
    if (hub !== undefined) this.batch.set(hub, _m);
    for (let i = 0; i < 4; i++) {
      if (!(mask & (1 << i))) continue;
      const d = DIRS[i]!;
      const ex = rec.x + d[0] * 0.5;
      const ez = rec.z + d[1] * 0.5;
      const ey = Math.max(this.map.heightAt(ex, ez), 0.02) + 0.03;
      _e.set(-Math.atan2(ey - rec.y, 0.5), Math.atan2(d[0], d[1]), 0, 'YXZ');
      _q.setFromEuler(_e);
      _m.compose(_p.set(rec.x, rec.y, rec.z), _q, _s.set(sc, sc, sc));
      const id = rec.ids[k++];
      if (id !== undefined) this.batch.set(id, _m);
    }
  }

  /** Is anything animating (so the caller keeps rendering)? */
  get busy(): boolean {
    return this.anims.length > 0;
  }

  /** Tiles where the outfall / port etc. touch water (for ambient boats). */
  recsOf(type: BuildingId): PlacedBuilding[] {
    const out: PlacedBuilding[] = [];
    for (const r of this.recs.values()) if (r.type === type) out.push(r.b);
    return out;
  }
}

function easeOutBack(t: number): number {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export { TileKind };
