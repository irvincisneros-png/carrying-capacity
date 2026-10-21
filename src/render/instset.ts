// Rebuildable InstancedMesh with per-instance birth animation that survives rebuilds (keyed slots), colour and a
// tier fraction (Low tier shows fewer instances). Rebuilds only allocate when capacity grows.
//
// ChunkedSet splits one species into spatial chunks (one InstSet per chunk) so each chunk is frustum-culled with a real
// bounding sphere, and far chunks can draw a thinned subset (distance LOD). Chunks share one KeyState so an instance
// keeps its birth time even if it is rewritten into another chunk, and a chunk stays out of the scene until its
// instances have been written (no half-initialised bushes).
import {
  Color, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Sphere, Vector3,
  type BufferGeometry, type Group, type Material,
} from 'three';

const _m = new Matrix4();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);
const _ax = new Vector3();
const _c = new Color();

/** Birth-time bookkeeping per instance key, shared by every chunk of one species. */
export class KeyState {
  birth: Float32Array;
  present: Uint8Array;
  nextPresent: Uint8Array;
  initial = true;
  now = 0;

  constructor(keySpace: number) {
    this.birth = new Float32Array(keySpace).fill(-100);
    this.present = new Uint8Array(keySpace);
    this.nextPresent = new Uint8Array(keySpace);
  }

  begin(): void {
    this.nextPresent.fill(0);
  }

  finish(): void {
    const tmp = this.present;
    this.present = this.nextPresent;
    this.nextPresent = tmp;
    this.initial = false;
  }
}

/** Number of thinning buckets: instances are ordered by a low-discrepancy rank so any prefix is an even thinning. */
const BUCKETS = 12;
const GOLD = 0.6180339887;
let _sm = new Float32Array(0);
let _sc = new Float32Array(0);
let _sa = new Float32Array(0);

export class InstSet {
  mesh: InstancedMesh;
  private anim: InstancedBufferAttribute;
  private count = 0;
  private keys: Int32Array;
  /** Instances up to the end of bucket b (after an LOD-ordered end()). */
  readonly bucketEnd = new Uint32Array(BUCKETS + 1);
  // bounds of the instance origins written since begin()
  private minX = Infinity; private maxX = -Infinity;
  private minY = Infinity; private maxY = -Infinity;
  private minZ = Infinity; private maxZ = -Infinity;
  private maxScale = 1;
  private readonly ks: KeyState;
  private readonly ownKeys: boolean;
  private sphere = new Sphere();

  constructor(
    geo: BufferGeometry,
    mat: Material,
    private capacity: number,
    keySpace: number | KeyState,
    readonly withColor: boolean,
    private cull = false,
  ) {
    this.ownKeys = typeof keySpace === 'number';
    this.ks = typeof keySpace === 'number' ? new KeyState(keySpace) : keySpace;
    this.keys = new Int32Array(capacity);
    this.mesh = this.make(geo, mat, capacity);
    this.anim = this.mesh.geometry.getAttribute('iAnim') as InstancedBufferAttribute;
  }

  get now(): number { return this.ks.now; }
  set now(v: number) { this.ks.now = v; }

  /** Instances written by the last end() (before any LOD thinning). */
  get written(): number { return this.count; }

  private make(geo: BufferGeometry, mat: Material, cap: number): InstancedMesh {
    const g = geo.clone();
    const anim = new InstancedBufferAttribute(new Float32Array(cap * 2), 2);
    g.setAttribute('iAnim', anim);
    const m = new InstancedMesh(g, mat, cap);
    if (this.withColor) m.instanceColor = new InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    m.count = 0;
    // whole-map sets are never culled; chunks get a real bounding sphere at end()
    m.frustumCulled = this.cull;
    return m;
  }

  setGeometry(geo: BufferGeometry): void {
    const old = this.mesh.geometry;
    const g = geo.clone();
    g.setAttribute('iAnim', this.anim);
    this.mesh.geometry = g;
    old.dispose();
    this.geoRadius = -1;
  }

  private geoRadius = -1;

  begin(): void {
    this.count = 0;
    this.minX = this.minY = this.minZ = Infinity;
    this.maxX = this.maxY = this.maxZ = -Infinity;
    this.maxScale = 1;
    if (this.ownKeys) this.ks.begin();
  }

  /** Add an instance. `key` identifies its slot so a returning instance keeps its birth time. */
  push(key: number, x: number, y: number, z: number, ry: number, s: number, sy = 1, tilt = 0, col?: Color | number): void {
    if (this.count >= this.capacity) this.grow();
    const i = this.count++;
    _q.setFromAxisAngle(_up, ry);
    if (tilt) {
      _ax.set(Math.cos(ry * 3.1), 0, Math.sin(ry * 2.3)).normalize();
      _q2.setFromAxisAngle(_ax, tilt);
      _q.premultiply(_q2);
    }
    _m.compose(_p.set(x, y, z), _q, _s.set(s, s * sy, s));
    this.mesh.setMatrixAt(i, _m);
    if (this.withColor && col !== undefined) {
      if (typeof col === 'number') _c.set(col);
      else _c.copy(col);
      this.mesh.setColorAt(i, _c);
    }
    const ks = this.ks;
    let b = ks.birth[key] ?? -100;
    if (!ks.present[key]) {
      b = ks.initial ? -100 : ks.now + ((key * 0.618) % 1) * 0.6;
      ks.birth[key] = b;
    }
    ks.nextPresent[key] = 1;
    this.keys[i] = key;
    const a = this.anim.array as Float32Array;
    a[i * 2] = b;
    a[i * 2 + 1] = (key * 0.37) % 1;
    if (x < this.minX) this.minX = x;
    if (x > this.maxX) this.maxX = x;
    if (y < this.minY) this.minY = y;
    if (y > this.maxY) this.maxY = y;
    if (z < this.minZ) this.minZ = z;
    if (z > this.maxZ) this.maxZ = z;
    const sc = s * Math.max(1, sy);
    if (sc > this.maxScale) this.maxScale = sc;
  }

  /** `lod`: order the instances by thinning rank (so drawing only a prefix is an even thinning) and record bucket ends. */
  end(lod = false): void {
    if (this.ownKeys) this.ks.finish();
    const n = this.count;
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (lod && n > 1) this.orderByRank(n);
    else this.bucketEnd.fill(n);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.anim.needsUpdate = true;
    if (n > 0 && this.cull) this.updateBounds();
  }

  /** Stable counting sort of the written instances into BUCKETS rank buckets (rank is a golden-ratio sequence of the key). */
  private orderByRank(n: number): void {
    const bucketOf = new Uint8Array(n);
    const counts = new Uint32Array(BUCKETS);
    for (let i = 0; i < n; i++) {
      const b = Math.min(BUCKETS - 1, Math.floor(((this.keys[i]! * GOLD) % 1) * BUCKETS));
      bucketOf[i] = b;
      counts[b]!++;
    }
    let acc = 0;
    const start = new Uint32Array(BUCKETS);
    this.bucketEnd[0] = 0;
    for (let b = 0; b < BUCKETS; b++) {
      start[b] = acc;
      acc += counts[b]!;
      this.bucketEnd[b + 1] = acc;
    }
    if (_sm.length < n * 16) _sm = new Float32Array(n * 16 * 2);
    if (_sc.length < n * 3) _sc = new Float32Array(n * 3 * 2);
    if (_sa.length < n * 2) _sa = new Float32Array(n * 2 * 2);
    const ma = this.mesh.instanceMatrix.array as Float32Array;
    const ca = this.mesh.instanceColor ? (this.mesh.instanceColor.array as Float32Array) : null;
    const aa = this.anim.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const j = start[bucketOf[i]!]!++;
      for (let k = 0; k < 16; k++) _sm[j * 16 + k] = ma[i * 16 + k]!;
      if (ca) for (let k = 0; k < 3; k++) _sc[j * 3 + k] = ca[i * 3 + k]!;
      _sa[j * 2] = aa[i * 2]!;
      _sa[j * 2 + 1] = aa[i * 2 + 1]!;
    }
    ma.set(_sm.subarray(0, n * 16));
    if (ca) ca.set(_sc.subarray(0, n * 3));
    aa.set(_sa.subarray(0, n * 2));
  }

  /** Real bounding sphere from the written origins (instead of a per-frame O(n) InstancedMesh.computeBoundingSphere). */
  private updateBounds(): void {
    if (this.geoRadius < 0) {
      const g = this.mesh.geometry;
      if (!g.boundingSphere) g.computeBoundingSphere();
      const bs = g.boundingSphere!;
      this.geoRadius = bs.center.length() + bs.radius;
    }
    const cx = (this.minX + this.maxX) / 2;
    const cy = (this.minY + this.maxY) / 2;
    const cz = (this.minZ + this.maxZ) / 2;
    const half = Math.hypot(this.maxX - this.minX, this.maxY - this.minY, this.maxZ - this.minZ) / 2;
    // + sway / grow-animation overshoot
    this.sphere.center.set(cx, cy, cz);
    this.sphere.radius = half + this.geoRadius * this.maxScale * 1.1 + 0.15;
    this.mesh.boundingSphere = this.sphere;
  }

  /** Number of instances to draw for a thinning fraction (needs end(true)). */
  countFor(frac: number): number {
    if (frac >= 1) return this.count;
    const b = Math.max(1, Math.min(BUCKETS, Math.ceil(frac * BUCKETS - 1e-6)));
    return this.bucketEnd[b]!;
  }

  /** Next rebuild treats everything as already grown (used after load / big jumps). */
  snapNext(): void {
    this.ks.initial = true;
  }

  private grow(): void {
    const cap = this.capacity * 2;
    const old = this.mesh;
    const m = this.make(old.geometry, old.material as Material, cap);
    (m.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array as Float32Array);
    if (old.instanceColor && m.instanceColor) (m.instanceColor.array as Float32Array).set(old.instanceColor.array as Float32Array);
    const na = m.geometry.getAttribute('iAnim') as InstancedBufferAttribute;
    (na.array as Float32Array).set(this.anim.array as Float32Array);
    const nk = new Int32Array(cap);
    nk.set(this.keys);
    this.keys = nk;
    m.castShadow = old.castShadow;
    m.receiveShadow = old.receiveShadow;
    m.customDepthMaterial = old.customDepthMaterial;
    m.renderOrder = old.renderOrder;
    m.name = old.name;
    m.visible = old.visible;
    old.parent?.add(m);
    old.parent?.remove(old);
    old.geometry.dispose();
    old.dispose();
    this.mesh = m;
    this.anim = na;
    this.capacity = cap;
  }
}

export interface ChunkedOpts {
  /** map size in tiles (world x in [-w/2, w/2], z in [-h/2, h/2]) */
  w: number;
  h: number;
  /** chunk edge in tiles */
  chunk: number;
  capacity: number;
  keySpace: number;
  withColor: boolean;
  cast: boolean;
  receive: boolean;
  depth?: Material;
  name: string;
}

/** One species split into spatial chunks: per-chunk frustum culling, distance LOD, chunk shown only once written. */
export class ChunkedSet {
  private chunks = new Map<number, { set: InstSet; added: boolean; cx: number; cz: number; lod: number }>();
  private readonly ks: KeyState;
  private nx: number;
  /** lod ordering on (Medium and below): needed for LOD thinning to be an even subset */
  lodOn = false;
  /** Focus (camera target) for distance LOD, world xz. */
  private fx = 0;
  private fz = 0;
  /** distances (tiles) from the focus beyond which a chunk draws half, then a third, of its instances; Infinity = full detail */
  private near = Infinity;
  private far = Infinity;
  private touched = new Set<number>();

  constructor(private geo: BufferGeometry, private mat: Material, private group: Group, private o: ChunkedOpts) {
    this.ks = new KeyState(o.keySpace);
    this.nx = Math.ceil(o.w / o.chunk);
  }

  get now(): number { return this.ks.now; }
  set now(v: number) { this.ks.now = v; }

  setGeometry(geo: BufferGeometry): void {
    this.geo = geo;
    for (const c of this.chunks.values()) c.set.setGeometry(geo);
  }

  begin(): void {
    this.ks.begin();
    this.touched.clear();
    for (const c of this.chunks.values()) c.set.begin();
  }

  push(key: number, x: number, y: number, z: number, ry: number, s: number, sy = 1, tilt = 0, col?: Color | number): void {
    const o = this.o;
    const ci = Math.max(0, Math.min(this.nx - 1, Math.floor((x + o.w / 2) / o.chunk)));
    const cj = Math.max(0, Math.min(Math.ceil(o.h / o.chunk) - 1, Math.floor((z + o.h / 2) / o.chunk)));
    const id = cj * this.nx + ci;
    let c = this.chunks.get(id);
    if (!c) {
      const set = new InstSet(this.geo, this.mat, 48, this.ks, o.withColor, true);
      set.mesh.castShadow = o.cast;
      set.mesh.receiveShadow = o.receive;
      if (o.depth) set.mesh.customDepthMaterial = o.depth;
      set.mesh.name = `${o.name}#${id}`;
      set.begin();
      c = { set, added: false, cx: -o.w / 2 + (ci + 0.5) * o.chunk, cz: -o.h / 2 + (cj + 0.5) * o.chunk, lod: 1 };
      this.chunks.set(id, c);
    }
    this.touched.add(id);
    c.set.push(key, x, y, z, ry, s, sy, tilt, col);
  }

  end(): void {
    this.ks.finish();
    for (const c of this.chunks.values()) {
      // a chunk nothing was pushed into this pass is emptied (begin() reset its count)
      c.set.end(this.lodOn);
      if (!c.added && c.set.written > 0) {
        // not shown until its instances are in place
        this.group.add(c.set.mesh);
        c.added = true;
      }
      this.applyLod(c);
    }
  }

  snapNext(): void {
    this.ks.initial = true;
  }

  /** Tier LOD radii (tiles). Infinity disables thinning. */
  setLod(near: number, far: number): void {
    this.near = near;
    this.far = far;
    this.lodOn = Number.isFinite(near);
    for (const c of this.chunks.values()) this.applyLod(c);
  }

  setFocus(x: number, z: number): void {
    this.fx = x;
    this.fz = z;
    for (const c of this.chunks.values()) this.applyLod(c);
  }

  private applyLod(c: { set: InstSet; cx: number; cz: number; lod: number }): void {
    if (!c.set.written) return;
    // distance to the chunk's nearest edge, so the chunk under the camera never thins
    const half = this.o.chunk / 2;
    const dx = Math.max(0, Math.abs(c.cx - this.fx) - half);
    const dz = Math.max(0, Math.abs(c.cz - this.fz) - half);
    const d = Math.hypot(dx, dz);
    const frac = !this.lodOn || d < this.near ? 1 : d < this.far ? 0.5 : 1 / 3;
    c.lod = frac;
    const n = c.set.countFor(frac);
    if (c.set.mesh.count !== n) c.set.mesh.count = n;
    c.set.mesh.visible = n > 0;
  }

  /** Dummy instance counts for material warm-up: every chunk-less species still has a hidden mesh in the scene. */
  get meshes(): InstancedMesh[] {
    return [...this.chunks.values()].map((c) => c.set.mesh);
  }
}
