// Rebuildable InstancedMesh with per-instance birth animation that survives rebuilds (keyed slots), colour and a
// tier fraction (Low tier shows fewer instances). Rebuilds only allocate when capacity grows.
import { Color, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry, type Material } from 'three';

const _m = new Matrix4();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _up = new Vector3(0, 1, 0);
const _ax = new Vector3();
const _c = new Color();

export class InstSet {
  mesh: InstancedMesh;
  private anim: InstancedBufferAttribute;
  private count = 0;
  private birth: Float32Array;
  private present: Uint8Array;
  private nextPresent: Uint8Array;
  private initial = true;
  now = 0;

  constructor(
    geo: BufferGeometry,
    mat: Material,
    private capacity: number,
    keySpace: number,
    readonly withColor: boolean,
  ) {
    this.birth = new Float32Array(keySpace).fill(-100);
    this.present = new Uint8Array(keySpace);
    this.nextPresent = new Uint8Array(keySpace);
    this.mesh = this.make(geo, mat, capacity);
    this.anim = this.mesh.geometry.getAttribute('iAnim') as InstancedBufferAttribute;
  }

  private make(geo: BufferGeometry, mat: Material, cap: number): InstancedMesh {
    const g = geo.clone();
    const anim = new InstancedBufferAttribute(new Float32Array(cap * 2), 2);
    g.setAttribute('iAnim', anim);
    const m = new InstancedMesh(g, mat, cap);
    if (this.withColor) m.instanceColor = new InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    m.count = 0;
    m.frustumCulled = false;
    return m;
  }

  setGeometry(geo: BufferGeometry): void {
    const old = this.mesh.geometry;
    const g = geo.clone();
    g.setAttribute('iAnim', this.anim);
    this.mesh.geometry = g;
    old.dispose();
  }

  begin(): void {
    this.count = 0;
    this.nextPresent.fill(0);
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
    let b = this.birth[key] ?? -100;
    if (!this.present[key]) {
      b = this.initial ? -100 : this.now + ((key * 0.618) % 1) * 0.6;
      this.birth[key] = b;
    }
    this.nextPresent[key] = 1;
    const a = this.anim.array as Float32Array;
    a[i * 2] = b;
    a[i * 2 + 1] = (key * 0.37) % 1;
  }

  end(): void {
    const tmp = this.present;
    this.present = this.nextPresent;
    this.nextPresent = tmp;
    this.initial = false;
    this.mesh.count = this.count;
    this.mesh.visible = this.count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.anim.needsUpdate = true;
  }

  /** Next rebuild treats everything as already grown (used after load / big jumps). */
  snapNext(): void {
    this.initial = true;
  }

  private grow(): void {
    const cap = this.capacity * 2;
    const old = this.mesh;
    const m = this.make(old.geometry, old.material as Material, cap);
    (m.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array as Float32Array);
    if (old.instanceColor && m.instanceColor) (m.instanceColor.array as Float32Array).set(old.instanceColor.array as Float32Array);
    const na = m.geometry.getAttribute('iAnim') as InstancedBufferAttribute;
    (na.array as Float32Array).set(this.anim.array as Float32Array);
    m.castShadow = old.castShadow;
    m.receiveShadow = old.receiveShadow;
    m.customDepthMaterial = old.customDepthMaterial;
    m.renderOrder = old.renderOrder;
    m.name = old.name;
    old.parent?.add(m);
    old.parent?.remove(old);
    old.geometry.dispose();
    old.dispose();
    this.mesh = m;
    this.anim = na;
    this.capacity = cap;
  }
}
