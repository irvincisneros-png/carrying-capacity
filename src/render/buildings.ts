// Every placed building as a batched instance of its procedural model (one draw call for all buildings plus one for
// their ink outlines), autotiled roads / rail, place + demolish pop animations, turbine rotors, smoke emitters.
import { BufferAttribute, BufferGeometry, Color, Euler, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3, type Group } from 'three';
import { BUILDINGS } from '../sim/buildings';
import { TileKind, type BuildingId, type GameState, type PlacedBuilding } from '../sim/types';
import { Batch, prepBatchGeo } from './batch';
import type { MapGeo } from './mapgeo';
import type { MatLib } from './materials';
import { buildBuildingModel, rotorGeo, wheelGeo, type BuildingModel } from './models/buildings';
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
const EDGE_PIECES: ReadonlySet<BuildingId> = new Set<BuildingId>(['seawall', 'fishway', 'road', 'rail', 'wildlifecrossing']);
const SMALL_BOOST = 1.14;
const RAIL_LINKS: ReadonlySet<BuildingId> = new Set<BuildingId>(['rail', 'port', 'coalmine', 'steelworks', 'coalpower']);

/**
 * 1x1 edge pieces face the water whatever the build rotation: a seawall's sea face (+X in the model) turns to the
 * nearest sea / reef / estuary tile, and a fishway's flow (+Z) runs to the lower river tile below the weir.
 */
function autoYaw(s: GameState, b: PlacedBuilding): number | null {
  if (b.type !== 'seawall' && b.type !== 'fishway') return null;
  const g = s.grid;
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= g.w || y >= g.h ? -1 : y * g.w + x);
  // DIRS order: +z, +x, -z, -x; yaw that turns model +X to (dx, dz) is atan2(-dz, dx); model +Z to (dx, dz) is atan2(dx, dz).
  let best: [number, number] | null = null;
  let bestScore = -Infinity;
  for (const [dx, dz] of DIRS) {
    const i = at(b.x + dx, b.y + dz);
    if (i < 0) continue;
    const k = g.kind[i];
    let sc = -Infinity;
    if (b.type === 'seawall' && (k === TileKind.Sea || k === TileKind.Reef || k === TileKind.Estuary)) sc = 1;
    if (b.type === 'fishway' && k === TileKind.River) sc = -(g.elevation[i] ?? 0);
    if (sc > bestScore) { bestScore = sc; best = [dx, dz]; }
  }
  if (!best || bestScore === -Infinity) return null;
  return b.type === 'seawall' ? Math.atan2(-best[1], best[0]) : Math.atan2(best[0], best[1]);
}

const ROAD_W = 0.42;
const C_ASPHALT = new Color(0x5a5653);
const C_DIRT = new Color(0x9d7d55);
const C_BALLAST = new Color(0x8a8079);
const C_RAIL = new Color(0x9aa0a6);
const C_LINE = new Color(0xece4c6);
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
  private cull = 0;
  /** Very low: all roads / rail as one draped mesh (one draw call instead of hundreds of batch instances). */
  private roadMesh: Mesh | null = null;
  private roadsDirty = false;
  private initial = true;
  rotors: InstancedMesh;
  /** Windmill pump wheels (farm, bore): same spin machinery as the turbine rotors, own model. Static on Very low. */
  wheels: InstancedMesh;
  private rotorInfo: { x: number; y: number; z: number; yaw: number; scale: number; speed: number; phase: number; wheel: boolean }[] = [];
  readonly emitters: Emitter[] = [];
  /** Wind multiplier for rotor speed (Act 2 weather). */
  wind = 1;
  /** Called when a building finishes appearing / starts disappearing (for dust puffs etc.). */
  onPop: ((x: number, y: number, z: number, size: number, demolish: boolean) => void) | null = null;

  constructor(private map: MapGeo, private lib: MatLib, private group: Group) {
    this.batch = this.makeBatch();
    const rotorMat = lib.get({ key: 'rotor', kind: 'prop', noSmog: true });
    this.rotors = new InstancedMesh(prepBatchGeo(rotorGeo(1)), rotorMat, 128);
    this.rotors.count = 0;
    this.rotors.castShadow = true;
    this.rotors.frustumCulled = false;
    this.rotors.name = 'rotors';
    group.add(this.rotors);
    this.wheels = new InstancedMesh(prepBatchGeo(wheelGeo(1)), rotorMat, 128);
    this.wheels.count = 0;
    this.wheels.castShadow = true;
    this.wheels.frustumCulled = false;
    this.wheels.name = 'wheels';
    group.add(this.wheels);
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

  setDetail(detail: 0 | 1, s: GameState | null, cull = 0): void {
    if (detail === this.detail && cull === this.cull) return;
    this.detail = detail;
    this.cull = cull;
    if (this.roadMesh) {
      this.group.remove(this.roadMesh);
      this.roadMesh.geometry.dispose();
      this.roadMesh = null;
    }
    this.roadsDirty = true;
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
    const oldW = this.wheels.geometry;
    this.wheels.geometry = prepBatchGeo(wheelGeo(detail));
    oldW.dispose();
  }

  setOutlines(on: boolean): void {
    if (this.batch.outline) this.batch.outline.visible = on;
  }

  model(type: BuildingId): BuildingModel | null {
    if (type === 'road' || type === 'rail') return null;
    const key = `${type}:${this.detail}:${this.cull}`;
    let m = this.models.get(key);
    if (!m) {
      m = buildBuildingModel(type, this.detail, this.cull);
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
    // Single-tile buildings (cottages, rooftop solar, parks...) get a little extra size so they still read when the
    // whole map is in view; edge pieces that must line up with neighbours (seawall, fishway) keep the tile size.
    const small = rec.b.w === 1 && rec.b.h === 1 && !EDGE_PIECES.has(rec.type) ? SMALL_BOOST : 1;
    _m.compose(_p.set(rec.x, rec.y, rec.z), _q, _s.set(scaleXZ * BSCALE_XZ * small, scaleY * BSCALE_Y * small, scaleXZ * BSCALE_XZ * small));
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
        const auto = autoYaw(s, b);
        if (auto !== null) p.yaw = auto;
        rec = { uid: b.uid, type: b.type, ids: [], mask: -1, dirt: dirtEra, x: p.x, y: p.y, z: p.z, yaw: p.yaw, b };
        this.recs.set(b.uid, rec);
        if (b.type !== 'road' && b.type !== 'rail') {
          const model = this.model(b.type)!;
          const gid = this.gid(`${b.type}:${this.detail}:${this.cull}`, () => model.geo);
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
      if (this.cull > 0) {
        // Very low: every road / rail tile is baked into one draped mesh below instead of 1-5 batch instances each
        rec.mask = mask;
        rec.dirt = dirt;
        this.roadsDirty = true;
        continue;
      }
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
    if (this.cull > 0 && this.roadsDirty) this.rebuildRoadMesh();
    this.initial = false;
    this.rebuildRotorsAndEmitters(s);
  }

  /** Bake every road / rail tile into a single flat mesh draped over the terrain (Very low only). */
  private rebuildRoadMesh(): void {
    this.roadsDirty = false;
    const pos: number[] = [];
    const col: number[] = [];
    const map = this.map;
    const H = 0.035;
    const piece = (corners: [number, number][], lift: number, c: Color): void => {
      const v = corners.map(([x, z]) => [x, Math.max(map.heightAt(x, z), 0.02) + H + lift, z] as const);
      for (const i of [0, 1, 2, 0, 2, 3]) {
        pos.push(v[i]![0], v[i]![1], v[i]![2]);
        col.push(c.r, c.g, c.b);
      }
    };
    // strip from distance a to b along (dx, dz) from (cx, cz), `w` wide, offset sideways by `o`
    const strip = (cx: number, cz: number, dx: number, dz: number, a: number, b: number, w: number, o: number, lift: number, c: Color): void => {
      const px = -dz, pz = dx;
      const l = o - w / 2, r = o + w / 2;
      piece([[cx + dx * a + px * l, cz + dz * a + pz * l], [cx + dx * a + px * r, cz + dz * a + pz * r], [cx + dx * b + px * r, cz + dz * b + pz * r], [cx + dx * b + px * l, cz + dz * b + pz * l]], lift, c);
    };
    for (const rec of this.recs.values()) {
      if ((rec.type !== 'road' && rec.type !== 'rail') || rec.mask < 0) continue;
      const cx = this.map.cx(rec.b.x);
      const cz = this.map.cz(rec.b.y);
      const rail = rec.type === 'rail';
      const w = rail ? 0.3 : rec.dirt ? ROAD_W - 0.02 : ROAD_W;
      const base = rail ? C_BALLAST : rec.dirt ? C_DIRT : C_ASPHALT;
      strip(cx, cz, 0, 1, -w / 2, w / 2, w, 0, 0, base);
      DIRS.forEach(([dx, dz], i) => {
        if (!(rec.mask & (1 << i))) return;
        strip(cx, cz, dx, dz, w / 2 - 0.001, 0.5, w, 0, 0, base);
        if (rail) for (const o of [-0.07, 0.07]) strip(cx, cz, dx, dz, 0, 0.5, 0.025, o, 0.006, C_RAIL);
        else if (!rec.dirt) strip(cx, cz, dx, dz, w / 2, 0.5, 0.025, 0, 0.004, C_LINE);
      });
    }
    const n = pos.length / 3;
    if (!this.roadMesh) {
      const mesh = new Mesh(new BufferGeometry(), this.lib.get({ key: 'building', kind: 'prop' }));
      mesh.name = 'roads';
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.roadMesh = mesh;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
    const nrm = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) nrm[i * 3 + 1] = 1;
    g.setAttribute('normal', new BufferAttribute(nrm, 3));
    this.roadMesh.geometry.dispose();
    this.roadMesh.geometry = g;
    this.roadMesh.visible = n > 0;
  }

  private removeRec(rec: Rec, animate: boolean): void {
    this.recs.delete(rec.uid);
    if (this.cull > 0 && (rec.type === 'road' || rec.type === 'rail')) this.roadsDirty = true;
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
        const wheel = r.kind === 'wheel';
        this.rotorInfo.push({ x, y: rec.y + r.y * BSCALE_Y, z, yaw: r.yaw + rec.yaw, scale: r.scale * (wheel ? BSCALE_XZ : 1), speed: (wheel ? 0.8 : 1.0) + ((rec.uid * 0.37 + i * 0.21) % 1) * 0.5, phase: rec.uid * 1.7 + i, wheel });
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
    const nw = this.rotorInfo.filter((r) => r.wheel).length;
    this.rotors.count = this.rotorInfo.length - nw;
    this.rotors.visible = this.rotors.count > 0;
    this.wheels.count = nw;
    this.wheels.visible = nw > 0;
    this.growRotors();
  }

  /** Instance capacity for rotors / wheels (rebuilt as new InstancedMeshes when a huge wind or farm field outgrows it). */
  private growRotors(): void {
    for (const key of ['rotors', 'wheels'] as const) {
      const m = this[key];
      if (m.count <= m.instanceMatrix.count) continue;
      const cap = Math.max(m.count, m.instanceMatrix.count * 2);
      const nm = new InstancedMesh(m.geometry, m.material, cap);
      nm.count = m.count;
      nm.castShadow = true;
      nm.frustumCulled = false;
      nm.name = m.name;
      this.group.add(nm);
      this.group.remove(m);
      this[key] = nm;
    }
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
    // rotors (turbines) and pump wheels (windmills): spin speed follows the Act 2 wind multiplier, a gentle constant in Act 1
    const n = this.rotorInfo.length;
    let ri = 0;
    let wi = 0;
    for (let i = 0; i < n; i++) {
      const r = this.rotorInfo[i]!;
      _e.set(0, r.yaw, -(time * r.speed * this.wind * (r.wheel ? 1.1 : 1.6) + r.phase), 'YXZ');
      _q.setFromEuler(_e);
      _m.compose(_p.set(r.x, r.y, r.z), _q, _s.set(r.scale, r.scale, r.scale));
      if (r.wheel) this.wheels.setMatrixAt(wi++, _m);
      else this.rotors.setMatrixAt(ri++, _m);
    }
    if (ri) this.rotors.instanceMatrix.needsUpdate = true;
    if (wi) this.wheels.instanceMatrix.needsUpdate = true;
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
