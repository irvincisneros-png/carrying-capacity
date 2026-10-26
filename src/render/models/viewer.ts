// Dev-only model viewer: every building (and ambient prop) on a ground plane, toon-shaded like the game.
// Query params: ?only=<id>[,<id>]  ?cam=close  ?detail=0  ?stats=1  ?ambient=0  ?labels=0  ?yaw=<deg>
import {
  AmbientLight, BoxGeometry, DoubleSide, BufferGeometry, Color, DataTexture, DirectionalLight, Float32BufferAttribute, HemisphereLight,
  LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshToonMaterial, NearestFilter, PCFSoftShadowMap, PerspectiveCamera,
  PlaneGeometry, RedFormat, Scene, SphereGeometry, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BUILDINGS } from '../../sim/buildings';
import { MODEL_IDS, ZONED_IDS, ZONED_VARIANTS, buildBuildingModel, rotorGeo, wheelGeo, type ModelId } from './buildings';
import { AMBIENT_IDS, buildAmbient, type AmbientId } from './ambient';
import { mulgaGeo, palmGeo, redGumGeo, reedsGeo, saltbushGeo, spinifexGeo, streetTreeGeo } from './biomeveg';

const q = new URLSearchParams(location.search);
const only = q.get('only')?.split(',').filter(Boolean) ?? null;
const close = q.get('cam') === 'close';
const detail = (q.get('detail') === '0' ? 0 : 1) as 0 | 1;
const showAmbient = q.get('ambient') !== '0' && !only;
const showLabels = q.get('labels') !== '0';
const camYaw = (Number(q.get('yaw') ?? '0') * Math.PI) / 180;
if (q.get('stats') === '1') document.body.classList.add('showstats');

const WATER_IDS = new Set(['offshorewind', 'tidal', 'coralnursery']);
const SEA_EAST = new Set(['port', 'outfall', 'windport', 'seawall']);

const app = document.getElementById('app')!;
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new Scene();
scene.background = new Color(0x8fc0e0);

const ramp = new DataTexture(new Uint8Array([92, 150, 212, 255]), 4, 1, RedFormat);
ramp.minFilter = ramp.magFilter = NearestFilter;
ramp.needsUpdate = true;
const mat = new MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
const waterMat = new MeshToonMaterial({ color: 0x3d9ab0, transparent: true, opacity: 0.55, gradientMap: ramp, depthWrite: false });

scene.add(new HemisphereLight(0xa9c4ff, 0x7a5872, 1.35));
scene.add(new AmbientLight(0xffffff, 0.05));
const sun = new DirectionalLight(0xffd8a4, 2.7);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// ---------------------------------------------------------------- layout
interface Item { id: string; w: number; h: number; kind: 'b' | 'a'; v?: number }
const items: Item[] = [];
const ids = (only ?? MODEL_IDS) as string[];
for (const id of ids) {
  if ((MODEL_IDS as string[]).includes(id)) {
    const d = BUILDINGS[id as ModelId];
    // Grown zone buildings have era and mirror variants: show all four.
    if (ZONED_IDS.includes(id as ModelId)) for (let v = 0; v < ZONED_VARIANTS; v++) items.push({ id, w: d.w, h: d.h, kind: 'b', v });
    else items.push({ id, w: d.w, h: d.h, kind: 'b' });
  } else if ((AMBIENT_IDS as string[]).includes(id)) items.push({ id, w: 1, h: 1, kind: 'a' });
}
const ROW_W = Number(q.get('row') ?? (only ? 9 : 26));
const placed: { it: Item; x: number; z: number }[] = [];
let cx = 0, cz = 0, rowH = 0;
for (const it of items) {
  const cw = it.w + (SEA_EAST.has(it.id) ? 2.2 : 1.3);
  if (cx + cw > ROW_W && cx > 0) {
    cx = 0;
    cz += rowH + 1.6;
    rowH = 0;
  }
  placed.push({ it, x: cx + it.w / 2, z: cz + it.h / 2 });
  cx += cw;
  rowH = Math.max(rowH, it.h);
}
let maxX = 0, maxZ = 0;
for (const p of placed) {
  maxX = Math.max(maxX, p.x + p.it.w / 2 + (SEA_EAST.has(p.it.id) ? 1 : 0));
  maxZ = Math.max(maxZ, p.z + p.it.h / 2);
}
// ambient row
const ambPlaced: { id: AmbientId; x: number; z: number }[] = [];
if (showAmbient) {
  const z = maxZ + 1.2;
  AMBIENT_IDS.forEach((id, i) => ambPlaced.push({ id, x: 0.4 + i * 0.75, z }));
  maxZ = z + 0.5;
  maxX = Math.max(maxX, 0.4 + AMBIENT_IDS.length * 0.75);
}
const VEG: [string, (d: 0 | 1) => BufferGeometry][] = [
  ['palmA', (d) => palmGeo(d, 0)], ['palmB', (d) => palmGeo(d, 1)], ['redGumA', (d) => redGumGeo(d, 0)], ['redGumB', (d) => redGumGeo(d, 1)],
  ['mulga', (d) => mulgaGeo(d)], ['spinifex', () => spinifexGeo()], ['saltbush', () => saltbushGeo()], ['reeds', () => reedsGeo()], ['streetTree', (d) => streetTreeGeo(d)],
];
const showVeg = q.get('veg') === '1' || (!only && q.get('veg') !== '0');
const vegPlaced: { id: string; fn: (d: 0 | 1) => BufferGeometry; x: number; z: number }[] = [];
if (showVeg) {
  const z = maxZ + 1.4;
  VEG.forEach(([id, fn], i) => vegPlaced.push({ id, fn, x: 0.6 + i * 1.5, z }));
  maxZ = z + 0.8;
  maxX = Math.max(maxX, 0.6 + VEG.length * 1.5);
}
const ctr = new Vector3(maxX / 2, 0, maxZ / 2);

// ground
const ground = new Mesh(new PlaneGeometry(maxX + 8, maxZ + 8), new MeshToonMaterial({ color: 0xb9a878, gradientMap: ramp }));
ground.rotation.x = -Math.PI / 2;
ground.position.set(ctr.x, -0.3, ctr.z);
ground.receiveShadow = true;
scene.add(ground);

const labels: { el: HTMLDivElement; pos: Vector3 }[] = [];
const stats: string[] = [];
const rotor = rotorGeo(detail);
const wheel = wheelGeo(detail);
const triCount = (g: BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const outlineMat = new LineBasicMaterial({ color: 0x7a3a2a });

function footprintLines(x: number, z: number, w: number, h: number): LineSegments {
  const y = 0.03;
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - h / 2, z1 = z + h / 2;
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0], 3));
  return new LineSegments(g, outlineMat);
}

for (const { it, x, z } of placed) {
  if (it.kind !== 'b') continue;
  const id = it.id as ModelId;
  const t0 = performance.now();
  const m1 = buildBuildingModel(id, 1, 0, it.v ?? 0);
  const m0 = buildBuildingModel(id, 0, 0, it.v ?? 0);
  const ms = performance.now() - t0;
  const m = detail ? m1 : m0;
  stats.push(`${id.padEnd(17)} ${String(Math.round(triCount(m1.geo))).padStart(5)} / ${String(Math.round(triCount(m0.geo))).padStart(5)} tris  h=${m.height.toFixed(2)}  stacks=${m.stacks.length} rotors=${m.rotors.length}  ${ms.toFixed(1)}ms`);
  const mesh = new Mesh(m.geo, mat);
  mesh.position.set(x, 0, z);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  scene.add(footprintLines(x, z, it.w, it.h));
  if (WATER_IDS.has(id)) {
    const wb = new Mesh(new BoxGeometry(it.w + 0.6, 1.6, it.h + 0.6), waterMat);
    wb.position.set(x, -0.8, z);
    scene.add(wb);
  }
  if (SEA_EAST.has(id)) {
    const wb = new Mesh(new BoxGeometry(1.4, 1.5, it.h + 0.8), waterMat);
    wb.position.set(x + it.w / 2 + 0.7, -0.06 - 0.75, z);
    scene.add(wb);
  }
  for (const r of m.rotors) {
    const rm = new Mesh(r.kind === 'wheel' ? wheel : rotor, mat);
    rm.position.set(x + r.x, r.y, z + r.z);
    rm.rotation.set(0, r.yaw, 0.4 + r.x, 'YXZ');
    rm.scale.setScalar(r.scale);
    rm.castShadow = true;
    scene.add(rm);
  }
  for (const s of m.stacks) {
    const pm = new Mesh(new SphereGeometry(0.06 * s.size, 8, 6), new MeshBasicMaterial({ color: new Color(0x3a3634).lerp(new Color(0xf4f4f0), s.steam) }));
    pm.position.set(x + s.x, s.y + 0.06 * s.size, z + s.z);
    scene.add(pm);
  }
  if (showLabels) {
    const el = document.createElement('div');
    el.className = 'lbl';
    el.textContent = it.v === undefined ? id : `${id} v${it.v}`;
    document.body.appendChild(el);
    labels.push({ el, pos: new Vector3(x, m.height + 0.15, z) });
  }
}
for (const a of ambPlaced) {
  const g1 = buildAmbient(a.id, 1), g0 = buildAmbient(a.id, 0);
  stats.push(`~${a.id.padEnd(16)} ${String(Math.round(triCount(g1))).padStart(5)} / ${String(Math.round(triCount(g0))).padStart(5)} tris`);
  const tintC = ['car', 'truck', 'boat', 'kayak', 'wagon'].includes(a.id) ? new Color(0xd9534f) : null;
  const mesh = new Mesh(detail ? g1 : g0, tintC ? new MeshToonMaterial({ vertexColors: true, gradientMap: ramp, color: tintC }) : mat);
  mesh.position.set(a.x, 0, a.z);
  mesh.scale.setScalar(2.5);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  if (showLabels) {
    const el = document.createElement('div');
    el.className = 'lbl';
    el.textContent = a.id;
    document.body.appendChild(el);
    labels.push({ el, pos: new Vector3(a.x, 0.75, a.z) });
  }
}
for (const v of vegPlaced) {
  const g1 = v.fn(1), g0 = v.fn(0);
  stats.push(`*${v.id.padEnd(16)} ${String(Math.round(triCount(g1))).padStart(5)} / ${String(Math.round(triCount(g0))).padStart(5)} tris`);
  const mesh = new Mesh(detail ? g1 : g0, new MeshToonMaterial({ vertexColors: true, gradientMap: ramp, side: DoubleSide }));
  mesh.position.set(v.x, 0, v.z);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  if (showLabels) {
    const el = document.createElement('div');
    el.className = 'lbl';
    el.textContent = v.id;
    document.body.appendChild(el);
    labels.push({ el, pos: new Vector3(v.x, 1.7, v.z) });
  }
}
document.getElementById('stats')!.textContent = `detail ${detail}  (tris d1 / d0)\n` + stats.join('\n');
console.log(stats.join('\n'));
(window as unknown as { __stats: string[] }).__stats = stats;

// ---------------------------------------------------------------- camera + light
const span = Math.max(maxX, maxZ);
const camera = new PerspectiveCamera(close ? 35 : 30, innerWidth / innerHeight, 0.05, 400);
const dist = Number(q.get('dist') ?? 0) || (close ? Math.max(2.6, span * 0.95) : span * 1.5);
const el = close ? 0.62 : 0.9;
camera.position.set(ctr.x + Math.sin(camYaw) * Math.cos(el) * dist, Math.sin(el) * dist, ctr.z + Math.cos(camYaw) * Math.cos(el) * dist);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(ctr).setY(close ? 0.3 : 0);
controls.update();
const ld = new Vector3(-0.62, 0.58, -0.38).normalize();
sun.position.copy(ctr).addScaledVector(ld, span + 20);
sun.target.position.copy(ctr);
const sc = sun.shadow.camera;
sc.left = sc.bottom = -span * 0.8 - 2;
sc.right = sc.top = span * 0.8 + 2;
sc.near = 1;
sc.far = span * 3 + 60;
sc.updateProjectionMatrix();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
const v = new Vector3();
function frame(): void {
  controls.update();
  renderer.render(scene, camera);
  for (const l of labels) {
    v.copy(l.pos).project(camera);
    l.el.style.left = `${((v.x + 1) / 2) * innerWidth}px`;
    l.el.style.top = `${((1 - v.y) / 2) * innerHeight}px`;
    l.el.style.display = v.z < 1 ? '' : 'none';
  }
  requestAnimationFrame(frame);
}
frame();
