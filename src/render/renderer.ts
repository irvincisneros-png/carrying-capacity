// GameRenderer: builds the diorama for a scenario's map and keeps it in sync with the simulation state.
// Owns the WebGL renderer, scene, lights, layers, post-processing, graphics tiers and the frame loop.
import {
  ConeGeometry, DoubleSide, MeshBasicMaterial, RingGeometry,
  Color, DirectionalLight, Group, HemisphereLight, Mesh, NoToneMapping, PCFShadowMap, Scene, SRGBColorSpace, Vector3,
  WebGLRenderer, type BufferGeometry, type IUniform, type ShaderMaterial,
} from 'three';
import { BUILDINGS, footprintFor } from '../sim/buildings';
import { meanHealth } from '../sim/metrics';
import { TileKind, type BuildingId, type GameState, type Rotation, type SimEvent } from '../sim/types';
import { AmbientLayer } from './ambient';
import { prepBatchGeo } from './batch';
import { BuildingLayer } from './buildings';
import { CameraRig } from './camera';
import { makeClouds } from './clouds';
import { Cursor, type CursorMode, type PickResult } from './cursor';
import { Fx } from './fx';
import { Parts } from './geo';
import { MapGeo, resFor, terrainSignature } from './mapgeo';
import { biomeLook, type BiomeLook } from './biome';
import { getScenario } from '../sim/scenarios';
import { seaRiseM } from '../sim/mechanics';
import { MatLib, type SharedUniforms } from './materials';
import { LOOK } from './palette';
import { buildPipeline, type Pipeline } from './post';
import { AutoTier, loadPref, savePref, softwareRenderer, START_TIER, TIERS, type GraphicsPref, type OutlineMode, type Tier } from './quality';
import { dirtArmGeo, dirtHubGeo, railArmGeo, railHubGeo, roadArmGeo, roadHubGeo } from './roadgeo';
import { Smoke } from './smoke';
import { Overlay, makeGrid, type Ramp } from './overlay';
import { buildTerrain } from './terrain';
import { TileData } from './tiledata';
import { Vegetation } from './vegetation';
import { makeSky, makeWater, makeWaterSideMat, skyUniforms, waterUniforms } from './water';
import { T } from './geo';

export interface RenderStats {
  fps: number;
  frameMs: number;
  cpuMs: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  tier: string;
  auto: boolean;
}

interface World {
  key: string;
  map: MapGeo;
  group: Group;
  tiles: TileData;
  veg: Vegetation;
  bld: BuildingLayer;
  amb: AmbientLayer;
  smoke: Smoke;
  fx: Fx;
  cursor: Cursor;
  rig: CameraRig;
  overlay: Overlay;
  grid: Mesh;
  terrainMesh: Mesh;
  slabMesh: Mesh;
  waterMesh: Mesh;
  waterSide: Mesh;
  heightTex: import('three').DataTexture;
  wu: Record<string, IUniform>;
  sig: number;
  seaLevel: boolean;
  level: number;
  dispose(): void;
}

const _c1 = new Color();
const _c2 = new Color();
const _v = new Vector3();

export class GameRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly shared: SharedUniforms;
  readonly lib: MatLib;
  private sun: DirectionalLight;
  private hemi: HemisphereLight;
  private skyU: Record<string, IUniform>;
  private skyMesh: Mesh;
  private clouds: ReturnType<typeof makeClouds>;
  private world: World | null = null;
  private pipeline: Pipeline | null = null;
  tier: Tier = START_TIER;
  pref: GraphicsPref;
  private auto: AutoTier;
  private softwareGpu = false;
  /** Sky / water shaders that switch to their cheap variant on the lite tiers. */
  private liteMats = new Set<ShaderMaterial>();
  private liteOn = false;
  private state: GameState | null = null;
  private lastVersion = -1;
  /** Heavy layer rebuilds queued by setState, run one per frame (see setState). */
  private deferred = new Map<string, () => void>();
  private stateThisFrame = false;
  /** True while the shader programs of a freshly built world / tier compile; no frame is drawn until they are ready. */
  private warming = false;
  private warmToken = 0;
  private last = performance.now();
  private running = false;
  readonly stats: RenderStats = { fps: 0, frameMs: 0, cpuMs: 0, calls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0, tier: 'Medium', auto: true };
  private fAcc = 0;
  private fN = 0;
  private cpuAcc = 0;
  private haze = 0;
  private hazeT = 0;
  private clean = 0;
  private cleanT = 0;
  private ghostGeos = new Map<string, BufferGeometry>();
  /** Per-frame callback for the UI (after render). */
  onFrame: ((dt: number) => void) | null = null;
  onTierChange: ((t: Tier, auto: boolean) => void) | null = null;
  private pendingFires: { x: number; z: number; until: number }[] = [];
  private levelT = 0;
  look: BiomeLook = biomeLook(undefined);

  constructor(readonly container: HTMLElement) {
    const r = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
    r.outputColorSpace = SRGBColorSpace;
    r.toneMapping = NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = PCFShadowMap;
    r.info.autoReset = false;
    r.domElement.className = 'cc-canvas';
    container.appendChild(r.domElement);
    this.renderer = r;
    this.shared = {
      uTime: { value: 0 },
      uTile: { value: null as unknown as import('three').Texture },
      uMap: { value: { x: 32, y: 32, z: 1 / 32, w: 1 / 32 } },
      uHaze: { value: 0 },
      uHazeCol: { value: new Color(LOOK.hazeCol) },
      uFrontGlow: { value: 0.8 },
      uWind: { value: { x: 0.9, y: -0.35 } },
    };
    this.lib = new MatLib(this.shared);
    // lights
    this.sun = new DirectionalLight(LOOK.sun.color, LOOK.sun.intensity);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = LOOK.shadowRadius;
    this.sun.shadow.intensity = LOOK.shadowStrength;
    this.hemi = new HemisphereLight(LOOK.hemi.sky, LOOK.hemi.ground, LOOK.hemi.intensity);
    this.scene.add(this.sun, this.sun.target, this.hemi);
    // sky + clouds
    this.skyU = skyUniforms();
    const sky = makeSky(this.skyU, this.shared as unknown as Record<string, IUniform>, 600);
    this.liteMats.add(sky.mat);
    this.skyMesh = new Mesh(sky.geo, sky.mat);
    this.skyMesh.renderOrder = -10;
    this.skyMesh.frustumCulled = false;
    this.scene.add(this.skyMesh);
    this.clouds = makeClouds(this.shared as unknown as Record<string, IUniform>, 32);
    this.scene.add(this.clouds.mesh);

    this.pref = loadPref();
    // CPU rasteriser (SwiftShader / llvmpipe): skip the sampling climb and start on the lowest tier
    // (?nosniff turns the sniff off, to test the sampling climb as a real GPU would see it)
    this.softwareGpu = !/[?&]nosniff\b/.test(location.search) && softwareRenderer(r.getContext());
    this.tier = this.pref.mode === 'manual' ? this.pref.tier : this.softwareGpu ? 0 : START_TIER;
    this.auto = new AutoTier((t) => this.applyTier(t, true), () => this.tier);
    window.addEventListener('resize', () => this.resize());
  }

  get rig(): CameraRig | null {
    return this.world?.rig ?? null;
  }

  get map(): MapGeo | null {
    return this.world?.map ?? null;
  }

  // ------------------------------------------------------------------ world
  /** Build (or rebuild) the diorama for the state's map. */
  setWorld(s: GameState): void {
    const terrainRes = TIERS[this.tier]!.terrainRes;
    const key = `${s.scenarioId}:${s.seed}:${s.grid.w}x${s.grid.h}:${terrainRes}`;
    if (this.world && this.world.key === key) {
      this.setState(s, true);
      return;
    }
    const prevCam = this.world?.rig;
    this.world?.dispose();
    this.state = s;
    this.levelT = 0;
    if (this.marker) this.marker.visible = false;
    const group = new Group();
    group.name = 'world';
    const look = biomeLook(getScenario(s.scenarioId).biome);
    this.look = look;
    this.lib.setPoll(look.poll);
    this.sun.color.set(look.sunColor);
    const map = new MapGeo(s.grid, look, terrainRes);
    const tb = buildTerrain(map);
    const tiles = new TileData(s.grid.w, s.grid.h);
    this.shared.uTile.value = tiles.tex;
    this.shared.uMap.value = { x: s.grid.w, y: s.grid.h, z: 1 / s.grid.w, w: 1 / s.grid.h };
    const terrain = new Mesh(tb.terrain, this.lib.get({ key: 'terrain', kind: 'terrain' }));
    terrain.receiveShadow = true;
    terrain.castShadow = true;
    terrain.name = 'terrain';
    const slab = new Mesh(tb.slab, this.lib.get({ key: 'slab', kind: 'slab' }));
    slab.castShadow = true;
    slab.name = 'slab';
    group.add(terrain, slab);
    const wu = waterUniforms(tb.heightTex, map);
    (wu.uShallowR!.value as Color).set(look.water.shallowR);
    (wu.uDeepR!.value as Color).set(look.water.deepR);
    (wu.uShallowP!.value as Color).set(look.water.shallowP);
    (wu.uDeepP!.value as Color).set(look.water.deepP);
    wu.uClarity!.value = look.water.clarity;
    const water = makeWater(this.shared as unknown as Record<string, IUniform>, wu, this.skyU, map);
    const waterMesh = new Mesh(water.geo, water.mat);
    waterMesh.renderOrder = 2;
    waterMesh.name = 'water';
    const waterSideMat = makeWaterSideMat(this.shared as unknown as Record<string, IUniform>, wu);
    for (const m of [...this.liteMats]) if (m !== this.skyMesh.material) this.liteMats.delete(m);
    this.liteMats.add(water.mat);
    this.liteMats.add(waterSideMat);
    this.setLiteWater(this.liteOn, true);
    const waterSide = new Mesh(tb.waterSide, waterSideMat);
    waterSide.renderOrder = 3;
    group.add(waterMesh, waterSide);
    const veg = new Vegetation(map, this.lib, group);
    const bld = new BuildingLayer(map, this.lib, group);
    const amb = new AmbientLayer(map, this.lib, group);
    const smoke = new Smoke(this.lib, group);
    const fx = new Fx(this.lib, group);
    const cursor = new Cursor(map, this.lib.get({ key: 'ghost', kind: 'ghost', transparent: true }));
    const overlay = new Overlay(tb.terrain, s.grid.w, s.grid.h, this.shared as unknown as Record<string, IUniform>);
    group.add(overlay.mesh);
    const gridMesh = makeGrid(tb.terrain, this.shared as unknown as Record<string, IUniform>);
    group.add(gridMesh);
    group.add(cursor.group);
    bld.onPop = (x, y, z, size, demolish) => fx.dust(x, y, z, size, demolish);
    const rig = new CameraRig(this.renderer.domElement, s.grid.w, s.grid.h);
    if (prevCam && this.world && this.world.map.w === s.grid.w && this.world.map.h === s.grid.h) {
      // same map rebuilt at another terrain resolution (a graphics tier change): keep the player's view
      rig.camera.position.copy(prevCam.camera.position);
      rig.controls.target.copy(prevCam.controls.target);
      rig.controls.update();
    }
    prevCam?.controls.dispose();
    this.scene.add(group);
    // shadow camera covers the slab
    const half = Math.max(s.grid.w, s.grid.h) * 0.5 + 3;
    const sc = this.sun.shadow.camera;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
    sc.near = 5; sc.far = half * 5;
    sc.updateProjectionMatrix();
    _v.set(...LOOK.sun.dir).normalize();
    this.sun.position.copy(_v).multiplyScalar(half * 2.4);
    this.sun.target.position.set(0, 0, 0);
    this.scene.remove(this.clouds.mesh);
    this.clouds = makeClouds(this.shared as unknown as Record<string, IUniform>, Math.max(s.grid.w, s.grid.h));
    this.scene.add(this.clouds.mesh);
    this.clouds.setFraction(TIERS[this.tier]!.clouds);
    this.world = {
      key, map, group, tiles, veg, bld, amb, smoke, fx, cursor, rig, overlay, grid: gridMesh, terrainMesh: terrain, slabMesh: slab, waterMesh, waterSide, heightTex: tb.heightTex, wu,
      sig: terrainSignature(s.grid), seaLevel: (getScenario(s.scenarioId).mechanics ?? []).includes('reef'), level: 0,
      dispose: () => {
        this.scene.remove(group);
        group.traverse((o) => {
          const m = o as Mesh;
          if (m.geometry) m.geometry.dispose();
        });
        bld.batch.dispose();
        amb.batch.dispose();
        tb.heightTex.dispose();
        tiles.tex.dispose();
        water.mat.dispose();
      },
    };
    this.lastVersion = -1;
    this.applyTierToWorld();
    this.resize();
    this.rebuildPipeline();
    this.setState(s, true);
    this.warmUp();
  }

  /**
   * Compile every material's shader program (one hidden probe per vegetation species is in the scene, so even species
   * with no instances yet are covered) before the first frame of a world or tier is drawn. Without this the first
   * frames meet programs that are still compiling and bushes flash black. A 4 s cap keeps a stuck driver from
   * freezing the picture.
   */
  private warmUp(): void {
    const w = this.world;
    if (!w) return;
    const token = ++this.warmToken;
    this.warming = true;
    const done = (): void => {
      clearTimeout(timer);
      if (token === this.warmToken) this.warming = false;
    };
    const timer = setTimeout(done, 4000);
    try {
      this.renderer.compileAsync(this.scene, w.rig.camera).then(done, done);
    } catch {
      done();
    }
  }

  /** New state from the controller. `snap` skips easing / grow animations (new game, load). */
  setState(s: GameState, snap = false): void {
    this.state = s;
    const w = this.world;
    if (!w) return;
    if (!snap && s.version === this.lastVersion) return;
    this.lastVersion = s.version;
    const sig = terrainSignature(s.grid);
    if (sig !== w.sig) this.rebuildTerrain(s, sig);
    w.tiles.sync(s, snap);
    w.bld.sync(s);
    w.smoke.rebuild(w.bld.emitters);
    if (snap) {
      this.deferred.clear();
      w.veg.snapNext();
      w.veg.rebuild(s, this.shared.uTime.value);
      w.amb.sync(s);
    } else {
      // Vegetation and the ambient life are the heavy rebuilds: run them on later frames, one per frame, so a season
      // tick (sim + these) never lands in a single frame. Later states replace earlier queued ones.
      this.deferred.set('veg', () => { const st = this.state; if (st) w.veg.rebuild(st, this.shared.uTime.value); });
      this.deferred.set('amb', () => { const st = this.state; if (st) w.amb.sync(st); });
      this.stateThisFrame = true;
    }
    this.updateAtmosphereTargets(s);
    if (w.seaLevel) this.levelT = this.seaLevelWorld(s);
    if (snap) {
      w.level = this.levelT;
      this.haze = this.hazeT;
      this.clean = this.cleanT;
    }
    // wind from Act 2 weather (deterministic per season)
    const a2 = s.a2;
    w.bld.wind = a2?.lastGrid ? 0.8 + (((a2.lastGrid.seasonIndex * 0.618) % 1) * 0.6) : 1;
  }

  /** Terrain changed shape (mine pits reshaped, zones seeded): rebuild the surface in place. */
  private rebuildTerrain(s: GameState, sig: number): void {
    const w = this.world;
    if (!w) return;
    w.sig = sig;
    w.map.update(s.grid);
    const tb = buildTerrain(w.map);
    const oldT = w.terrainMesh.geometry;
    w.terrainMesh.geometry = tb.terrain;
    w.overlay.mesh.geometry = tb.terrain;
    w.grid.geometry = tb.terrain;
    oldT.dispose();
    w.slabMesh.geometry.dispose();
    w.slabMesh.geometry = tb.slab;
    w.waterSide.geometry.dispose();
    w.waterSide.geometry = tb.waterSide;
    (w.heightTex.image.data as Uint8Array).set(tb.heightTex.image.data as Uint8Array);
    w.heightTex.needsUpdate = true;
    tb.heightTex.dispose();
  }

  /** Metres of sea-level rise -> world height (sim tile heights 0 / 0.9 / 1.8 / 4.0 m map onto our terraces). */
  private seaLevelWorld(s: GameState): number {
    let m = 0;
    try { m = seaRiseM(s); } catch { m = 0; }
    const pts: [number, number][] = [[0, 0], [0.9, 0.34], [1.8, 0.7], [4, 1.55]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, ya] = pts[i]!;
      const [b, yb] = pts[i + 1]!;
      if (m <= b) return ya + ((m - a) / (b - a)) * (yb - ya);
    }
    return 1.55;
  }

  private updateAtmosphereTargets(s: GameState): void {
    const g = s.grid;
    let air = 0;
    let n = 0;
    for (let i = 0; i < g.kind.length; i++) {
      const k = g.kind[i];
      if (k === TileKind.Land || k === TileKind.Bush || k === TileKind.Beach) { air += g.airPollution[i] ?? 0; n++; }
    }
    const airMean = n ? air / n : 0;
    const co2 = Math.max(0, (s.co2 - 290) / 140);
    this.hazeT = Math.max(0, Math.min(1, co2 * 0.55 + airMean * 0.9));
    const act2 = s.phase === 'act2' || s.phase === 'epilogue' || s.phase === 'failed';
    this.cleanT = act2 ? Math.max(0, Math.min(1, (meanHealth(s) - 0.35) * 2)) : 0;
    if (act2) this.hazeT *= 1 - this.cleanT * 0.6;
  }

  /** Visual reactions to sim events. */
  eventFx(e: SimEvent): void {
    const w = this.world;
    if (!w) return;
    const at = e.at;
    const x = at ? w.map.cx(at.x) : 0;
    const z = at ? w.map.cz(at.y) : 0;
    if (e.type === 'bushfire' && at) {
      w.fx.sparkle(x, w.map.heightAt(x, z), z, 1.5, true);
      this.pendingFires.push({ x, z, until: this.shared.uTime.value + 10 });
      this.refreshFireSmoke();
      w.rig.shake(0.06);
    } else if (e.type === 'flood' || e.type === 'heatwave' || e.type === 'marine-heatwave') {
      w.rig.shake(0.05);
    }
  }

  private refreshFireSmoke(): void {
    const w = this.world;
    if (!w) return;
    const em = [...w.bld.emitters];
    for (const f of this.pendingFires) em.push({ x: f.x, y: w.map.heightAt(f.x, f.z) + 0.3, z: f.z, size: 1.8, steam: 0, strength: 1.4 });
    w.smoke.rebuild(em);
  }

  // ------------------------------------------------------------------ tools / cursor
  pick(clientX: number, clientY: number): PickResult | null {
    const w = this.world;
    if (!w) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    return w.cursor.pick(w.rig.camera, nx, ny);
  }

  /** Project a world point to client pixels. */
  project(x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
    const w = this.world;
    if (!w) return { x: 0, y: 0, visible: false };
    _v.set(x, y, z).project(w.rig.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((_v.x + 1) / 2) * rect.width, y: rect.top + ((1 - _v.y) / 2) * rect.height, visible: _v.z < 1 };
  }

  /** Centre of a tile footprint in world space (top surface). */
  tileWorld(tx: number, ty: number, w = 1, h = 1): { x: number; y: number; z: number } {
    const m = this.world?.map;
    if (!m) return { x: 0, y: 0, z: 0 };
    const x = tx + w / 2 - m.w / 2;
    const z = ty + h / 2 - m.h / 2;
    return { x, y: Math.max(m.heightAt(x, z), 0), z };
  }

  private ghostGeo(id: BuildingId): BufferGeometry | null {
    const w = this.world;
    if (!w) return null;
    const key = `${id}:${TIERS[this.tier]!.detail}`;
    let g = this.ghostGeos.get(key);
    if (!g) {
      if (id === 'road' || id === 'rail') {
        const P = new Parts();
        const hub = id === 'rail' ? railHubGeo() : this.state && this.state.year < 1920 ? dirtHubGeo() : roadHubGeo();
        const arm = id === 'rail' ? railArmGeo : this.state && this.state.year < 1920 ? dirtArmGeo : roadArmGeo;
        P.push(hub);
        P.push(arm());
        P.push(T(arm(), 0, 0, 0, 0, Math.PI));
        g = prepBatchGeo(P.merge());
      } else {
        const m = w.bld.model(id);
        if (!m) return null;
        g = m.geo;
      }
      this.ghostGeos.set(key, g);
    }
    return g;
  }

  /** Show the cursor for the active tool at a tile. */
  showCursor(tool: BuildingId | 'demolish' | 'clear' | 'inspect' | null, tx: number, ty: number, rot: Rotation, ok: boolean, rect?: { x: number; y: number; w: number; h: number }): void {
    const w = this.world;
    if (!w) return;
    if (!tool || tool === 'inspect') {
      const r = rect ?? { x: tx, y: ty, w: 1, h: 1 };
      w.cursor.showRect(r.x, r.y, r.w, r.h, tool === 'inspect' && rect ? 'info' : 'hover');
      w.cursor.hideGhost();
      w.cursor.hideRing();
      return;
    }
    if (tool === 'demolish' || tool === 'clear') {
      const r = rect ?? { x: tx, y: ty, w: 1, h: 1 };
      const mode: CursorMode = ok ? 'demolish' : 'bad';
      w.cursor.showRect(r.x, r.y, r.w, r.h, mode);
      w.cursor.hideGhost();
      w.cursor.hideRing();
      return;
    }
    const def = BUILDINGS[tool];
    const fp = footprintFor(def, rot);
    w.cursor.showRect(tx, ty, fp.w, fp.h, ok ? 'ok' : 'bad');
    const g = this.ghostGeo(tool);
    w.cursor.setGhostGeometry(g);
    w.cursor.ghostScale = tool === 'road' || tool === 'rail' ? [1, 1] : [1.08, 1.35];
    const water = tool === 'offshorewind' || tool === 'tidal';
    const x = tx + fp.w / 2 - w.map.w / 2;
    const z = ty + fp.h / 2 - w.map.h / 2;
    const y = tool === 'road' || tool === 'rail' ? w.map.heightAt(x, z) + 0.03 : w.map.padHeight(tx, ty, fp.w, fp.h, water);
    w.cursor.showGhost(x, y, z, -rot * (Math.PI / 2), ok, this.lib.ghostCol);
    const radius = def.nursery?.radius ?? def.remediation?.radius ?? (def.localPollution >= 2 ? Math.min(6, 1 + Math.ceil(def.localPollution)) : 0);
    if (radius > 0) w.cursor.showRing(x, z, radius + Math.max(fp.w, fp.h) / 2);
    else w.cursor.hideRing();
  }

  private marker: Group | null = null;
  private markerAt: { x: number; y: number } | null = null;

  /** Guide marker (tutorial): pulsing gold ring + bobbing arrow over a tile; null hides it. */
  markTile(tx: number | null, ty = 0): void {
    const w = this.world;
    if (!w) return;
    if (tx === null) {
      if (this.marker) this.marker.visible = false;
      this.markerAt = null;
      return;
    }
    if (!this.marker) {
      const g = new Group();
      const ringMat = new MeshBasicMaterial({ color: 0xffc83a, transparent: true, opacity: 0.85, depthTest: false, toneMapped: false, side: DoubleSide });
      const ring = new Mesh(new RingGeometry(0.5, 0.62, 40), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 9;
      const arrow = new Mesh(new ConeGeometry(0.18, 0.4, 12), new MeshBasicMaterial({ color: 0xffc83a, depthTest: false, toneMapped: false }));
      arrow.rotation.x = Math.PI;
      arrow.position.y = 1.4;
      arrow.renderOrder = 9;
      arrow.name = 'arrow';
      g.add(ring, arrow);
      g.name = 'marker';
      this.marker = g;
      this.scene.add(g);
    }
    this.markerAt = { x: tx, y: ty };
    const p = this.tileWorld(tx, ty);
    this.marker.position.set(p.x, p.y + 0.05, p.z);
    this.marker.visible = true;
  }

  /** Tile grid while a build tool is active. */
  setGrid(on: boolean): void {
    if (this.world) this.world.grid.visible = on;
  }

  /** Show a per-tile data layer (0..1 values) over the map, or hide it with null. */
  setOverlay(values: ArrayLike<number> | null, ramp: Ramp = 'heat'): void {
    this.world?.overlay.set(values, ramp);
  }

  hideCursor(): void {
    this.world?.cursor.hide();
  }

  sparkle(tx: number, ty: number, w = 1, h = 1, gold = false): void {
    const wd = this.world;
    if (!wd) return;
    const p = this.tileWorld(tx, ty, w, h);
    wd.fx.sparkle(p.x, p.y, p.z, Math.max(w, h) * 0.6, gold);
  }

  dust(tx: number, ty: number, w = 1, h = 1): void {
    const wd = this.world;
    if (!wd) return;
    const p = this.tileWorld(tx, ty, w, h);
    wd.fx.dust(p.x, p.y, p.z, Math.max(w, h) * 0.5, true);
  }

  // ------------------------------------------------------------------ tiers
  applyTier(t: Tier, fromAuto = false): void {
    this.tier = t;
    if (!fromAuto) {
      this.pref = { ...this.pref, mode: 'manual', tier: t };
      savePref(this.pref);
    }
    this.applyTierToWorld();
    this.resize();
    this.rebuildPipeline();
    this.onTierChange?.(t, this.pref.mode === 'auto');
  }

  /** Building outlines: Off / Subtle (remembered; Low tier never draws them). */
  setOutlineMode(m: OutlineMode): void {
    this.pref = { ...this.pref, outlines: m };
    savePref(this.pref);
    this.world?.bld.setOutlines(TIERS[this.tier]!.outlines && m === 'subtle');
  }

  setAuto(): void {
    this.pref = { ...this.pref, mode: 'auto', tier: this.tier };
    savePref(this.pref);
    this.auto = new AutoTier((t) => this.applyTier(t, true), () => this.tier);
    this.applyTier(this.softwareGpu ? 0 : START_TIER, true);
  }

  private setLiteWater(on: boolean, force = false): void {
    if (this.liteOn === on && !force) return;
    this.liteOn = on;
    for (const m of this.liteMats) {
      if (on) m.defines.CC_LITE = '';
      else delete m.defines.CC_LITE;
      m.needsUpdate = true;
    }
  }

  private applyTierToWorld(): void {
    const d = TIERS[this.tier]!;
    const shadows = d.shadows > 0;
    if (this.renderer.shadowMap.enabled !== shadows) {
      this.renderer.shadowMap.enabled = shadows;
      for (const m of this.lib.all()) m.needsUpdate = true;
    }
    this.sun.castShadow = shadows;
    if (shadows && this.sun.shadow.mapSize.x !== d.shadows) {
      this.sun.shadow.mapSize.set(d.shadows, d.shadows);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    if (this.world && this.state && this.world.map.res !== (d.terrainRes > 0 ? d.terrainRes : resFor(this.world.map.w, this.world.map.h))) {
      // terrain resolution is baked into the map: rebuild the diorama (setWorld calls back here once the res matches)
      this.setWorld(this.state);
      return;
    }
    if (this.lib.lite !== d.lite) this.lib.setLite(d.lite);
    this.skyMesh.renderOrder = d.lite ? 100 : -10; // cheap tiers draw the sky last so covered pixels are rejected early
    this.setLiteWater(d.lite);
    this.clouds.setFraction(d.clouds);
    const w = this.world;
    if (w) {
      w.veg.setTier(d.foliage, d.treeDetail);
      w.veg.setLod(d.vegLod[0], d.vegLod[1]);
      w.bld.setDetail(d.detail, this.state, d.partCull);
      w.bld.setOutlines(d.outlines && this.pref.outlines === 'subtle');
      w.amb.setDetail(d.detail);
      w.amb.density = d.props * (w.map.w > 40 && this.tier <= 1 ? 0.5 : 1);
      w.smoke.density = d.smoke;
      this.ghostGeos.clear();
      if (this.state) {
        w.veg.snapNext();
        this.lastVersion = -1;
        this.setState(this.state, false);
      }
      this.warmUp();
    }
    this.stats.tier = d.name;
    this.stats.auto = this.pref.mode === 'auto';
  }

  private rebuildPipeline(): void {
    const w = this.world;
    if (!w) return;
    this.pipeline?.dispose();
    this.pipeline = buildPipeline(this.renderer, this.scene, w.rig.camera, this.tier, w.rig.controls.target);
    this.pipeline.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  resize(): void {
    const wdt = Math.max(1, this.container.clientWidth);
    const hgt = Math.max(1, this.container.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[this.tier]!.dprMax);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(wdt, hgt);
    this.world?.rig.resize(wdt, hgt);
    this.pipeline?.setSize(wdt, hgt);
  }

  // ------------------------------------------------------------------ loop
  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = (now: number): void => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      this.frame(now);
    };
    requestAnimationFrame(loop);
  }

  /** Render one frame now (useful when the page is hidden and rAF is paused). */
  frame(now = performance.now()): void {
    const w = this.world;
    if (!w || !this.pipeline) return;
    if (!this.stateThisFrame && this.deferred.size) {
      const [key, job] = this.deferred.entries().next().value as [string, () => void];
      this.deferred.delete(key);
      job();
    }
    this.stateThisFrame = false;
    if (this.warming) {
      this.last = now;
      return;
    }
    const rawDt = Math.max(0, (now - this.last) / 1000);
    const dt = Math.min(0.1, rawDt);
    this.last = now;
    const c0 = performance.now();
    this.shared.uTime.value += dt;
    const time = this.shared.uTime.value;
    w.rig.update(dt);
    w.veg.setFocus(w.rig.controls.target.x, w.rig.controls.target.z);
    w.tiles.update(dt);
    w.bld.update(dt, time);
    w.fx.update(dt);
    w.cursor.update(dt);
    w.overlay.update(dt);
    if (this.marker?.visible) {
      const k = 1 + 0.15 * Math.sin(time * 5);
      this.marker.children[0]!.scale.set(k, k, k);
      this.marker.children[1]!.position.y = 1.3 + 0.18 * Math.sin(time * 3);
    }
    if (this.pendingFires.length && this.pendingFires[0]!.until < time) {
      this.pendingFires = this.pendingFires.filter((f) => f.until >= time);
      this.refreshFireSmoke();
    }
    // atmosphere easing
    const k = 1 - Math.exp(-dt * 1.5);
    this.haze += (this.hazeT - this.haze) * k;
    this.clean += (this.cleanT - this.clean) * k;
    this.shared.uHaze.value = this.haze;
    if (w.seaLevel) {
      w.level += (this.levelT - w.level) * Math.min(1, dt * 0.8);
      w.waterMesh.position.y = w.level;
      w.wu.uLevel!.value = w.level;
    }
    _c1.set(this.look.sky.top); _c2.set(LOOK.skySmog.top);
    (this.skyU.uSkyTop!.value as Color).copy(_c1).lerp(_c2, this.haze * 0.85);
    _c1.set(this.look.sky.horizon); _c2.set(LOOK.skySmog.horizon);
    (this.skyU.uSkyHorizon!.value as Color).copy(_c1).lerp(_c2, this.haze * 0.85);
    _c1.set(this.look.sky.bottom); _c2.set(LOOK.skySmog.bottom);
    (this.skyU.uSkyBottom!.value as Color).copy(_c1).lerp(_c2, this.haze * 0.8);
    _c1.set(LOOK.sky.cloudCol); _c2.set(LOOK.skySmog.cloudCol);
    (this.skyU.uCloudCol!.value as Color).copy(_c1).lerp(_c2, this.haze * 0.8);
    (this.clouds.uniforms.uTint!.value as Color).copy(this.skyU.uCloudCol!.value as Color);
    this.pipeline.grade.smog = this.haze;
    this.pipeline.grade.clean = this.clean;
    this.sun.intensity = LOOK.sun.intensity * (1 - this.haze * 0.12);
    this.skyMesh.position.copy(w.rig.camera.position);
    this.lib.setOutlineZoom(w.rig.camera.position.distanceTo(w.rig.controls.target), Math.max(w.map.w, w.map.h));
    this.skyU.uCamY!.value = w.rig.camera.position.y;

    this.renderer.info.reset();
    this.pipeline.render(dt);
    const cpu = performance.now() - c0;
    this.onFrame?.(dt);
    // stats
    this.fAcc += dt;
    this.fN++;
    this.cpuAcc += cpu;
    const info = this.renderer.info;
    this.stats.calls = info.render.calls;
    this.stats.triangles = info.render.triangles;
    this.stats.geometries = info.memory.geometries;
    this.stats.textures = info.memory.textures;
    this.stats.programs = info.programs?.length ?? 0;
    if (this.fAcc >= 0.5) {
      this.stats.fps = this.fN / this.fAcc;
      this.stats.frameMs = (this.fAcc * 1000) / this.fN;
      this.stats.cpuMs = this.cpuAcc / this.fN;
      this.fAcc = 0;
      this.fN = 0;
      this.cpuAcc = 0;
    }
    this.auto.frame(rawDt, cpu, document.hidden, this.pref.mode === 'manual');
  }

  /** Debug: count visible draw objects per frame category. */
  debugInfo(): Record<string, unknown> {
    const out: Record<string, number> = {};
    this.scene.traverse((o) => {
      if ((o as Mesh).isMesh && o.visible) out[o.name || o.type] = (out[o.name || o.type] ?? 0) + 1;
    });
    return { ...this.stats, objects: out };
  }
}
