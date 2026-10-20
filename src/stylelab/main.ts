// Style Lab entry: one procedural diorama, four art directions, live perf instrumentation.
import {
  CanvasTexture, Color, DirectionalLight, HemisphereLight, Matrix4, Mesh, NoToneMapping,
  OrthographicCamera, PCFShadowMap, PerspectiveCamera, PMREMGenerator, Quaternion, Scene, SRGBColorSpace, Spherical,
  Texture, Vector3, WebGLRenderer, type IUniform,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildWorld } from './world';
import { buildTerrain } from './terrain';
import { Health } from './health';
import { MatLib, type MatSpec, type SharedUniforms } from './materials';
import { buildProps } from './props';
import { applySkyStyle, applyWaterStyle, makeSky, makeWater, makeWaterSideMat, skyUniforms, waterUniforms } from './water';
import { STYLES, type StyleId } from './styles';
import { buildPipeline, QUALITY_NAMES, type Pipeline, type Quality } from './post';
import { createHud } from './hud';

// ---------------------------------------------------------------- renderer
const app = document.getElementById('app')!;
const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
renderer.info.autoReset = false;
app.appendChild(renderer.domElement);

const scene = new Scene();
const health = new Health();
const shared: SharedUniforms = { uTime: { value: 0 }, uHealth: { value: health.tex } };
const sharedU = shared as unknown as Record<string, IUniform>;
const lib = new MatLib(shared);

// ---------------------------------------------------------------- world + geometry
const t0 = performance.now();
const world = buildWorld();
const tb = buildTerrain(world);
const props = buildProps(world);
const buildMs = performance.now() - t0;

interface Reg { mesh: Mesh; spec: MatSpec; styles?: number[] }
const reg: Reg[] = [];
function register(mesh: Mesh, spec: MatSpec, cast: boolean, receive: boolean, styles?: number[]): void {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  scene.add(mesh);
  reg.push({ mesh, spec, styles });
}
register(new Mesh(tb.terrain), { key: 'terrain', kind: 'terrain' }, true, true);
register(new Mesh(tb.slab), { key: 'slab', kind: 'slab', roughness: 0.95 }, true, false);
for (const e of props.entries) register(e.obj, e.spec, e.cast, e.receive, e.styles);

// water + sky
const skyU = skyUniforms();
const wu = waterUniforms(tb.heightTex);
const water = makeWater(sharedU, wu, skyU);
const waterMesh = new Mesh(water.geo, water.mat);
waterMesh.renderOrder = 2;
scene.add(waterMesh);
const waterSide = new Mesh(tb.waterSide, makeWaterSideMat(sharedU, wu));
waterSide.renderOrder = 3;
scene.add(waterSide);
const sky = makeSky(skyU, sharedU, 500);
const skyMesh = new Mesh(sky.geo, sky.mat);
skyMesh.renderOrder = -10;
skyMesh.frustumCulled = false;
scene.add(skyMesh);

// lights
const sun = new DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.camera.left = -18;
sun.shadow.camera.right = 18;
sun.shadow.camera.top = 18;
sun.shadow.camera.bottom = -18;
sun.shadow.camera.near = 5;
sun.shadow.camera.far = 90;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.025;
scene.add(sun, sun.target);
const hemi = new HemisphereLight(0xffffff, 0x444444, 1);
scene.add(hemi);

// environment map for the realistic style (generated sky, no network)
function makeEnv(): Texture {
  const envScene = new Scene();
  const eu = skyUniforms();
  const s = STYLES[2];
  const d = new Vector3(...s.sun.dir).normalize();
  applySkyStyle(eu, s, d);
  eu.uCamY.value = 30;
  const e = makeSky(eu, sharedU, 50);
  envScene.add(new Mesh(e.geo, e.mat));
  const pm = new PMREMGenerator(renderer);
  const rt = pm.fromScene(envScene, 0.02, 0.1, 200);
  pm.dispose();
  e.geo.dispose();
  e.mat.dispose();
  return rt.texture;
}
const envTex = makeEnv();

function gradientBg(top: number, bottom: number): Texture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, `#${new Color(top).getHexString()}`);
  gr.addColorStop(1, `#${new Color(bottom).getHexString()}`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
const isoBg = gradientBg(0xcfeaf3, 0x8fc6d8);

// ---------------------------------------------------------------- cameras + controls
const persp = new PerspectiveCamera(30, 1, 0.5, 2000);
const ortho = new OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
const TARGET = new Vector3(0, -0.8, 0.8);
const DEFAULT_SPH = new Spherical(48, 0.88, 0.6);
persp.position.setFromSpherical(DEFAULT_SPH).add(TARGET);
persp.lookAt(TARGET);
const ISO_SPH = new Spherical(120, Math.acos(1 / Math.sqrt(3)), Math.PI / 4);
ortho.position.setFromSpherical(ISO_SPH).add(TARGET);
ortho.zoom = 1;
let camera: PerspectiveCamera | OrthographicCamera = persp;
const controls = new OrbitControls(persp as PerspectiveCamera | OrthographicCamera, renderer.domElement);
controls.target.copy(TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minPolarAngle = 0.42;
controls.maxPolarAngle = 1.22;
controls.minAzimuthAngle = 0.6 - 1.3;
controls.maxAzimuthAngle = 0.6 + 1.3;
controls.minDistance = 14;
controls.maxDistance = 95;
controls.minZoom = 0.6;
controls.maxZoom = 3.5;
controls.screenSpacePanning = true;
controls.addEventListener('change', () => {
  const t = controls.target;
  t.x = Math.max(-8, Math.min(8, t.x));
  t.z = Math.max(-8, Math.min(8, t.z));
  t.y = Math.max(-2.5, Math.min(2.5, t.y));
});
const perspView = { pos: persp.position.clone(), target: TARGET.clone() };
const orthoView = { pos: ortho.position.clone(), target: TARGET.clone() };

function resizeOrtho(): void {
  const a = window.innerWidth / window.innerHeight;
  const hh = Math.max(12.5, 18.5 / a);
  ortho.top = hh;
  ortho.bottom = -hh;
  ortho.left = -hh * a;
  ortho.right = hh * a;
  ortho.updateProjectionMatrix();
}

// ---------------------------------------------------------------- state
let style: StyleId = 0;
let quality: Quality = 1;
let pipeline: Pipeline | null = null;

function applyQuality(q: Quality): void {
  quality = q;
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(q === 0 ? 1 : q === 1 ? Math.min(dpr, 1.5) : Math.min(dpr, 2));
  const shadows = q >= 1;
  if (renderer.shadowMap.enabled !== shadows) {
    renderer.shadowMap.enabled = shadows;
    for (const m of lib.all()) m.needsUpdate = true;
  }
  const ms = q === 2 ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== ms) {
    sun.shadow.mapSize.set(ms, ms);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
  for (const e of props.entries) {
    if (e.lod) e.obj.geometry = e.lod[q];
    if (e.frac && e.full !== undefined && 'count' in e.obj) (e.obj as unknown as { count: number }).count = Math.max(1, Math.floor(e.full * e.frac[q]));
  }
  resize();
  rebuildPipeline();
  hud.setQuality(q);
}

function rebuildPipeline(): void {
  pipeline?.dispose();
  pipeline = buildPipeline(renderer, scene, camera, style, quality, controls.target);
  pipeline.setSize(window.innerWidth, window.innerHeight);
}

function applyStyle(id: StyleId): void {
  const prev = STYLES[style];
  const s = STYLES[id];
  // camera swap / framing
  if (s.ortho !== prev.ortho || id === style) {
    if (camera === persp) { perspView.pos.copy(persp.position); perspView.target.copy(controls.target); }
    else { orthoView.pos.copy(ortho.position); orthoView.target.copy(controls.target); }
    camera = s.ortho ? ortho : persp;
    const v = s.ortho ? orthoView : perspView;
    camera.position.copy(v.pos);
    controls.object = camera;
    controls.target.copy(v.target);
  }
  if (!s.ortho) {
    const old = id === style ? persp.fov : prev.ortho ? persp.fov : prev.fov;
    const off = persp.position.clone().sub(controls.target);
    off.multiplyScalar(Math.tan((old * Math.PI) / 360) / Math.tan((s.fov * Math.PI) / 360));
    persp.position.copy(controls.target).add(off);
    persp.fov = s.fov;
    persp.updateProjectionMatrix();
  }
  controls.update();
  style = id;
  for (const r of reg) {
    r.mesh.material = lib.get(id, r.spec);
    r.mesh.customDepthMaterial = lib.depth(r.spec);
    r.mesh.visible = !r.styles || r.styles.includes(id);
  }
  // lights
  const dir = new Vector3(...s.sun.dir).normalize();
  sun.color.set(s.sun.color);
  sun.intensity = s.sun.intensity;
  sun.position.copy(dir).multiplyScalar(45);
  sun.target.position.set(0, 0, 0);
  sun.shadow.radius = s.shadowRadius;
  sun.shadow.intensity = s.shadowStrength;
  hemi.color.set(s.hemi.sky);
  hemi.groundColor.set(s.hemi.ground);
  hemi.intensity = s.hemi.intensity;
  scene.environment = s.envIntensity > 0 ? envTex : null;
  applySkyStyle(skyU, s, dir);
  applyWaterStyle(wu, s);
  skyMesh.visible = s.sky.mode !== 2;
  scene.background = s.sky.mode === 2 ? isoBg : null;
  rebuildPipeline();
  hud.setStyle(id);
}

// ---------------------------------------------------------------- loop + stats
const stats = { fps: 0, frameMs: 0, cpuMs: 0, calls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0 };
let frames = 0;
let acc = 0;
let cpuAcc = 0;
let last = performance.now();
let playing = false;
let restoreT = 0.5;
const rotM = new Matrix4();
const rotQ = new Quaternion();
const rotQ2 = new Quaternion();
const AXIS_Y = new Vector3(0, 1, 0);
const AXIS_Z = new Vector3(0, 0, 1);
const ONE = new Vector3(1, 1, 1);

function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const c0 = performance.now();
  shared.uTime.value += dt;
  const time = shared.uTime.value;

  if (playing) {
    restoreT = Math.min(1, restoreT + dt / 12);
    health.setRestore(restoreT);
    hud.setRestore(restoreT);
    if (restoreT >= 1) { playing = false; hud.setPlaying(false); }
  }
  health.update(dt);

  props.rotorInfo.forEach((r, i) => {
    rotQ.setFromAxisAngle(AXIS_Y, r.yaw);
    rotQ2.setFromAxisAngle(AXIS_Z, -(time * r.speed + r.phase));
    rotQ.multiply(rotQ2);
    rotM.compose(r.pos, rotQ, ONE);
    props.rotors.setMatrixAt(i, rotM);
  });
  props.rotors.instanceMatrix.needsUpdate = true;

  controls.update();
  skyMesh.position.copy(camera.position);
  skyU.uCamY.value = camera.position.y;

  renderer.info.reset();
  pipeline!.composer.render(dt);
  const cpu = performance.now() - c0;

  frames++;
  acc += dt;
  cpuAcc += cpu;
  stats.calls = renderer.info.render.calls;
  stats.triangles = renderer.info.render.triangles;
  stats.geometries = renderer.info.memory.geometries;
  stats.textures = renderer.info.memory.textures;
  stats.programs = renderer.info.programs?.length ?? 0;
  if (acc >= 1) {
    stats.fps = frames / acc;
    stats.frameMs = (acc * 1000) / frames;
    stats.cpuMs = cpuAcc / frames;
    frames = 0;
    acc = 0;
    cpuAcc = 0;
    hud.update({ ...stats, quality: QUALITY_NAMES[quality] });
  }
}

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  persp.aspect = w / h;
  persp.updateProjectionMatrix();
  resizeOrtho();
  pipeline?.setSize(w, h);
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- HUD + input
const hud = createHud({
  onStyle: (i) => applyStyle(i),
  onQuality: (q) => applyQuality(q),
  onRestore: (t) => { restoreT = t; playing = false; hud.setPlaying(false); health.setRestore(t); },
  onPlay: () => {
    playing = !playing;
    if (playing && restoreT >= 1) { restoreT = 0; health.setRestore(0, true); }
    hud.setPlaying(playing);
  },
});

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
  if (e.key >= '1' && e.key <= '4') applyStyle((Number(e.key) - 1) as StyleId);
  else if (e.key === 'q' || e.key === 'Q') applyQuality(((quality + 1) % 3) as Quality);
  else if (e.key === 'h' || e.key === 'H') hud.toggle();
  else if (e.key === ' ') { e.preventDefault(); hud.play(); }
});

// ---------------------------------------------------------------- automation API
function parseStyle(i: number | string): StyleId {
  if (typeof i === 'string') {
    const k = 'ABCD'.indexOf(i.toUpperCase());
    if (k >= 0) return k as StyleId;
    i = Number(i);
  }
  return Math.max(0, Math.min(3, Math.round(i))) as StyleId;
}
function parseQuality(q: number | string): Quality {
  if (typeof q === 'string') {
    const k = ['low', 'med', 'high'].indexOf(q.toLowerCase().slice(0, q.toLowerCase().startsWith('med') ? 3 : q.length));
    if (k >= 0) return k as Quality;
    q = Number(q);
  }
  return Math.max(0, Math.min(2, Math.round(q))) as Quality;
}
declare global {
  interface Window { __lab: unknown }
}
window.__lab = {
  /** 0..3 or 'A'..'D' */
  setStyle: (i: number | string) => applyStyle(parseStyle(i)),
  /** 0..2 or 'low'|'med'|'high' */
  setQuality: (q: number | string) => applyQuality(parseQuality(q)),
  /** 0..1; snaps instantly unless animate=true */
  setRestore: (t: number, animate = false) => {
    restoreT = Math.max(0, Math.min(1, t));
    playing = false;
    health.setRestore(restoreT, !animate);
    hud.setRestore(restoreT);
  },
  stats: () => ({ ...stats, style: STYLES[style].key, styleName: STYLES[style].name, quality: QUALITY_NAMES[quality], restore: restoreT, buildMs }),
  hud: (show: boolean) => hud.show(show),
  /** place the orbit camera: radius, polar (rad from vertical), azimuth (rad), optional target */
  orbit: (r: number, polar: number, azimuth: number, tx = TARGET.x, ty = TARGET.y, tz = TARGET.z) => {
    controls.target.set(tx, ty, tz);
    camera.position.setFromSpherical(new Spherical(r, polar, azimuth)).add(controls.target);
    controls.update();
  },
  renderer,
  scene,
};

// ---------------------------------------------------------------- go
resize();
applyStyle(0);
applyQuality(window.innerWidth < 900 ? 0 : 1);
hud.setRestore(restoreT);
requestAnimationFrame(frame);
