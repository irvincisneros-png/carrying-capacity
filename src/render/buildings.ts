// Every placed building as a batched instance of its procedural model (one draw call for all buildings plus one for
// their ink outlines), autotiled roads / rail, place + demolish pop animations, turbine rotors, smoke emitters.
import { Color, Euler, InstancedMesh, Matrix4, Quaternion, Vector3, type Group } from 'three';
import { BUILDINGS } from '../sim/buildings';
import { TileKind, type BuildingId, type GameState, type PlacedBuilding } from '../sim/types';
import { Batch, prepBatchGeo } from './batch';
import type { MapGeo } from './mapgeo';
import type { MatLib } from './materials';
import { SUBURB_STREET_TOP, ZONED_IDS, buildBuildingModel, modelVariant, rotorGeo, wheelGeo, type BuildingModel } from './models/buildings';
import { RoadMesh } from './roadmesh';
import { ZoneChunks } from './zonechunks';
import { ASPHALT_LIFT, gradeRoads, type RoadPin, type RoadTile } from './roadnet';

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
  /** Model variant (grown zone buildings: era and mirror, see modelVariant) */
  variant: number;
  ids: number[];
  /** connection mask for road / rail */
  mask: number;
  dirt: boolean;
  x: number; y: number; z: number; yaw: number;
  b: PlacedBuilding;
  /** Brick suburb: street mouths as (suburb tile index * 4 + direction a road enters from), see STREETS */
  mouths?: Set<number>;
  /** Grown zone buildings settle into a merged chunk mesh (see zonechunks.ts); until then (growing, demolishing) they are batch instances. */
  chunked?: boolean;
  tint?: Color;
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

const ZONED: ReadonlySet<BuildingId> = new Set<BuildingId>(ZONED_IDS);

/** Grown zone buildings face the nearest road (one or two tiles away, straight along an axis), else keep their rotation. */
function roadFacing(s: GameState, b: PlacedBuilding, typeOf: ReadonlyMap<number, BuildingId>): number | null {
  const g = s.grid;
  for (const reach of [1, 2]) {
    for (const [dx, dz] of DIRS) {
      const x = b.x + dx * reach, y = b.y + dz * reach;
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
      const u = g.building[y * g.w + x] ?? 0;
      if (u !== 0 && typeOf.get(u) === 'road') return Math.atan2(dx, dz);
    }
  }
  return null;
}

const SUBURBS: ReadonlySet<BuildingId> = new Set<BuildingId>(['suburb', 'greensuburb']);
/**
 * The brick suburb's street runs along local x through the centre of the footprint's second tile row, so it can be
 * turned four ways. Each entry: model yaw, then the street's two mouths as [road tile offset, suburb tile offset,
 * direction (DIRS index) from the road tile into the suburb] relative to the footprint's top-left tile.
 */
const STREETS: { yaw: number; ends: [number, number, number, number, number][] }[] = [
  { yaw: 0, ends: [[2, 1, 1, 1, 3], [-1, 1, 0, 1, 1]] },
  { yaw: Math.PI, ends: [[2, 0, 1, 0, 3], [-1, 0, 0, 0, 1]] },
  { yaw: Math.PI / 2, ends: [[1, -1, 1, 0, 0], [1, 2, 1, 1, 2]] },
  { yaw: -Math.PI / 2, ends: [[0, -1, 0, 0, 0], [0, 2, 0, 1, 2]] },
];
const angDiff = (a: number, b: number): number => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();

export class BuildingLayer {
  batch: Batch;
  /** Settled grown zone buildings, merged per chunk. */
  private zc: ZoneChunks;
  private prepped = new Map<string, import('three').BufferGeometry>();
  private recs = new Map<number, Rec>();
  private anims: Anim[] = [];
  private models = new Map<string, BuildingModel>();
  private detail: 0 | 1 = 1;
  private cull = 0;
  /** All roads / rail: draped ribbon meshes per chunk of tiles, graded into the terrain (see roadnet.ts). */
  readonly roads: RoadMesh;
  private roadSig = -1;
  private roadsStale = true;
  /** Called when grading the roads changed the terrain heights (the renderer refreshes the terrain mesh). */
  onTerrain: (() => void) | null = null;
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
    this.zc = this.makeChunks();
    this.roads = new RoadMesh(map, lib.get({ key: 'building', kind: 'prop' }), group);
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

  private makeChunks(): ZoneChunks {
    return new ZoneChunks(this.group, this.lib.get({ key: 'building', kind: 'prop' }), this.lib.outlineMat);
  }

  setDetail(detail: 0 | 1, s: GameState | null, cull = 0): void {
    if (detail === this.detail && cull === this.cull) return;
    this.detail = detail;
    this.cull = cull;
    this.roads.hi = detail === 1 && cull === 0;
    this.roadsStale = true;
    this.models.clear();
    this.group.remove(this.batch.mesh);
    if (this.batch.outline) this.group.remove(this.batch.outline);
    this.batch.dispose();
    this.batch = this.makeBatch();
    this.zc.dispose();
    this.zc = this.makeChunks();
    for (const g of this.prepped.values()) g.dispose();
    this.prepped.clear();
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
    this.zc.setOutlines(on);
  }

  model(type: BuildingId, variant = 0): BuildingModel | null {
    if (type === 'road' || type === 'rail') return null;
    const key = `${type}:${variant}:${this.detail}:${this.cull}`;
    let m = this.models.get(key);
    if (!m) {
      m = buildBuildingModel(type, this.detail, this.cull, variant);
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
    const typeOf = new Map<number, BuildingId>();
    for (const b of s.buildings) typeOf.set(b.uid, b.type);
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
        const variant = ZONED.has(b.type) ? modelVariant(b.type, b.builtYear, b.uid) : 0;
        if (ZONED.has(b.type)) {
          const face = roadFacing(s, b, typeOf);
          if (face !== null) p.yaw = face;
        }
        rec = { uid: b.uid, type: b.type, variant, ids: [], mask: -1, dirt: dirtEra, x: p.x, y: p.y, z: p.z, yaw: p.yaw, b };
        this.recs.set(b.uid, rec);
        if (b.type !== 'road' && b.type !== 'rail') {
          const model = this.model(b.type, rec.variant)!;
          const lift = INDUSTRIAL.has(b.type) ? 1.32 : 1.12;
          _c.setRGB(lift - ((b.uid * 0.37) % 1) * 0.06, lift - ((b.uid * 0.53) % 1) * 0.05, lift - ((b.uid * 0.71) % 1) * 0.07);
          rec.tint = _c.clone();
          if (ZONED.has(b.type) && this.initial) {
            this.toChunk(rec);
          } else {
          const gid = this.gid(`${b.type}:${rec.variant}:${this.detail}:${this.cull}`, () => model.geo);
          this.compose(rec, this.initial ? 1 : 0.001, this.initial ? 1 : 0.001);
          rec.ids.push(this.batch.add(gid, _m, rec.tint));
          }
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
    // Brick suburbs turn their street toward an adjacent player road (a render-side choice; the sim footprint is square)
    const pins: RoadPin[] = [];
    for (const rec of this.recs.values()) if (SUBURBS.has(rec.type)) this.orientSuburb(rec, (tx, ty) => isType(tx, ty, 'road'), pins, g.w);
    // roads / rail autotile
    const tiles: RoadTile[] = [];
    let sig = 17;
    for (const rec of this.recs.values()) {
      if (rec.type !== 'road' && rec.type !== 'rail') continue;
      const bx = rec.b.x;
      const by = rec.b.y;
      let mask = 0;
      DIRS.forEach(([dx, dy], i) => {
        const nx = bx + dx;
        const ny = by + dy;
        if (rec.type === 'road') {
          if (isType(nx, ny, 'road')) mask |= 1 << i;
          else if (this.map.inBounds(nx, ny)) {
            // a brick suburb's street mouth joins the road
            const nrec = this.recs.get(g.building[ny * g.w + nx] ?? 0);
            if (nrec?.mouths?.has((ny * g.w + nx) * 4 + i)) mask |= 1 << i;
          }
        } else if (isType(nx, ny, RAIL_LINKS)) mask |= 1 << i;
      });
      if (rec.type === 'rail') {
        if (mask === 0) mask = 0b0101;
        else if (mask === 1 || mask === 4) mask = 0b0101;
        else if (mask === 2 || mask === 8) mask = 0b1010;
      }
      const bridge = rec.type === 'road' && g.kind[by * g.w + bx] === TileKind.River;
      let bridgeMask = 0;
      if (rec.type === 'road' && !bridge) {
        DIRS.forEach(([dx, dy], i) => {
          const nx = bx + dx, ny = by + dy;
          if (this.map.inBounds(nx, ny) && g.kind[ny * g.w + nx] === TileKind.River && isType(nx, ny, 'road')) bridgeMask |= 1 << i;
        });
      }
      const dirt = rec.type === 'road' && dirtEra && !bridge;
      rec.mask = mask;
      rec.dirt = dirt;
      tiles.push({ tx: bx, ty: by, fam: rec.type, mask, dirt, ...(bridge ? { bridge } : {}), ...(bridgeMask ? { bridgeMask } : {}) });
      sig = Math.imul(sig ^ (rec.uid * 31 + mask * 7 + (dirt ? 1 : 0) + (rec.type === 'rail' ? 64 : 0) + (bridge ? 128 : 0) + bridgeMask * 256), 16777619);
    }
    for (const p of pins) sig = Math.imul(sig ^ (p.tx * 131 + p.ty * 17 + p.dir + Math.round(p.y * 1000) * 3), 16777619);
    sig = Math.imul(sig ^ tiles.length, 16777619);
    if (sig !== this.roadSig || this.roadsStale) {
      this.roadSig = sig;
      this.roadsStale = false;
      this.regradeRoads(tiles, pins);
    }
    this.initial = false;
    this.zc.rebuild();
    this.rebuildRotorsAndEmitters(s);
  }

  /** Prepped (batch-ready) geometry for a model, cached per detail level. */
  private preppedGeo(rec: Rec): import('three').BufferGeometry {
    const key = `${rec.type}:${rec.variant}:${this.detail}:${this.cull}`;
    let g = this.prepped.get(key);
    if (!g) {
      g = prepBatchGeo(this.model(rec.type, rec.variant)!.geo);
      this.prepped.set(key, g);
    }
    return g;
  }

  /** A settled grown building joins its chunk's merged mesh (and leaves the animated batch). */
  private toChunk(rec: Rec): void {
    this.compose(rec, 1, 1);
    this.zc.set(rec.uid, rec.b.x, rec.b.y, this.preppedGeo(rec), _m, rec.tint ?? _c.setRGB(1.12, 1.12, 1.12));
    rec.chunked = true;
  }

  /** A grown building about to be demolished leaves its chunk and becomes a batch instance again, so it can shrink away. */
  private toBatch(rec: Rec): void {
    this.zc.remove(rec.uid);
    rec.chunked = false;
    const gid = this.gid(`${rec.type}:${rec.variant}:${this.detail}:${this.cull}`, () => this.model(rec.type, rec.variant)!.geo);
    this.compose(rec, 1, 1);
    rec.ids.push(this.batch.add(gid, _m, rec.tint));
  }

  /** Mark the baked roads stale (terrain was rebuilt under them): the next sync regrades and redraws them. */
  markRoadsStale(): void {
    this.roadsStale = true;
  }

  /** Grade the terrain under the roads, tell the renderer if its heights moved, then redraw the ribbons on top. */
  private regradeRoads(tiles: RoadTile[], pins: RoadPin[]): void {
    const { segs, heights, decks } = gradeRoads(this.map, tiles, pins);
    const moved = this.map.carve(segs);
    this.map.setDecks(decks);
    if (moved) this.onTerrain?.();
    this.roads.rebuild(tiles, heights);
  }

  /**
   * Choose which way the suburb's street faces: toward an adjacent road if there is one (most road tiles meeting a
   * street mouth wins; ties keep the player's rotation, then the current facing), else the player's rotation.
   * Records the street mouths for the road autotile and pins road edges that meet a mouth to the street's height.
   */
  private orientSuburb(rec: Rec, isRoad: (tx: number, ty: number) => boolean, pins: RoadPin[], gridW: number): void {
    const b = rec.b;
    const own = -b.rotation * (Math.PI / 2);
    let best = STREETS[0]!;
    let bestScore = -1;
    for (const c of STREETS) {
      let score = c.ends.reduce((n, e) => n + (isRoad(b.x + e[0], b.y + e[1]) ? 1 : 0), 0) * 4;
      if (score > 0) score += (angDiff(c.yaw, own) < 0.01 ? 2 : 0) + (angDiff(c.yaw, rec.yaw) < 0.01 ? 1 : 0);
      else score = angDiff(c.yaw, own) < 0.01 ? 0 : -1;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (angDiff(best.yaw, rec.yaw) > 0.01) {
      rec.yaw = best.yaw;
      if (rec.ids.length && !this.anims.some((a) => a.rec === rec)) {
        this.compose(rec, 1, 1);
        for (const id of rec.ids) this.batch.set(id, _m);
      }
    }
    const mouths = new Set<number>();
    const top = rec.y + SUBURB_STREET_TOP * BSCALE_Y - ASPHALT_LIFT;
    for (const [rx, ry, sx, sy, dir] of best.ends) {
      mouths.add((((b.y + sy) * gridW) + b.x + sx) * 4 + dir);
      if (isRoad(b.x + rx, b.y + ry)) pins.push({ tx: b.x + rx, ty: b.y + ry, dir, y: top });
    }
    rec.mouths = mouths;
  }

  private removeRec(rec: Rec, animate: boolean): void {
    this.recs.delete(rec.uid);
    if (rec.type === 'road' || rec.type === 'rail') {
      this.roadsStale = true;
      return;
    }
    if (rec.chunked) {
      if (animate) this.toBatch(rec);
      else { this.zc.remove(rec.uid); rec.chunked = false; }
    }
    if (animate) {
      this.anims.push({ rec, t: 1, dir: -1 });
      const m = this.model(rec.type, rec.variant);
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
      const m = this.model(rec.type, rec.variant);
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
      this.compose(rec, Math.max(0.001, sxz), Math.max(0.001, sy));
      for (const id of rec.ids) this.batch.set(id, _m);
      if ((a.dir > 0 && a.t >= 1) || (a.dir < 0 && a.t <= 0)) {
        if (a.dir < 0) {
          for (const id of rec.ids) this.batch.remove(id);
          rec.ids.length = 0;
        } else {
          if (ZONED.has(rec.type) && this.recs.get(rec.uid) === rec) {
            for (const id of rec.ids) this.batch.remove(id);
            rec.ids.length = 0;
            this.toChunk(rec);
          }
          const m = this.model(rec.type, rec.variant);
          this.onPop?.(rec.x, rec.y, rec.z, Math.max(rec.b.w, rec.b.h) * 0.55 + (m ? m.height * 0.08 : 0), false);
        }
        this.anims.splice(i, 1);
      }
    }
    this.zc.rebuild();
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
