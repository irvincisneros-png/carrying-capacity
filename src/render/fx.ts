// One-shot particle bursts (dust when building / demolishing, leaves when clearing bush, sparkles for green builds).
// Fixed pool, CPU-animated only while particles are alive; zero allocations per frame.
import { Color, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3, type Group } from 'three';
import type { MatLib } from './materials';
import { puffGeo } from './vegassets';

const N = 220;
const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();

export class Fx {
  mesh: InstancedMesh;
  private px = new Float32Array(N);
  private py = new Float32Array(N);
  private pz = new Float32Array(N);
  private vx = new Float32Array(N);
  private vy = new Float32Array(N);
  private vz = new Float32Array(N);
  private age = new Float32Array(N).fill(1);
  private life = new Float32Array(N).fill(1);
  private size = new Float32Array(N);
  private grav = new Float32Array(N);
  private next = 0;
  private alive = 0;

  constructor(lib: MatLib, group: Group) {
    const geo = puffGeo(0.12, 3, 0.85);
    const spec = { key: 'fx', kind: 'prop' as const, noSmog: true };
    this.mesh = new InstancedMesh(geo, lib.get(spec), N);
    this.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(N * 3).fill(1), 3);
    this.mesh.frustumCulled = false;
    this.mesh.count = N;
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < N; i++) this.mesh.setMatrixAt(i, _m);
    this.mesh.name = 'fx';
    this.mesh.visible = false;
    group.add(this.mesh);
  }

  private spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, col: number, grav: number): void {
    const i = this.next;
    this.next = (this.next + 1) % N;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.age[i] = 0;
    this.life[i] = life;
    this.size[i] = size;
    this.grav[i] = grav;
    this.mesh.setColorAt(i, _c.set(col));
    this.alive = Math.max(this.alive, 1);
    this.mesh.visible = true;
  }

  /** Ring of dust rolling out from a footprint. */
  dust(x: number, y: number, z: number, radius: number, demolish: boolean): void {
    const n = Math.round(10 + radius * 10);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.4;
      const sp = 0.9 + Math.random() * 1.1;
      const col = demolish ? (Math.random() < 0.5 ? 0x9b8b78 : 0x7d7064) : Math.random() < 0.5 ? 0xd8c6a2 : 0xc4ae86;
      this.spawn(x + Math.cos(a) * radius * 0.7, y + 0.05, z + Math.sin(a) * radius * 0.7, Math.cos(a) * sp, 0.4 + Math.random() * 0.8, Math.sin(a) * sp,
        0.7 + Math.random() * 0.5, (0.7 + Math.random() * 0.8) * (0.6 + radius * 0.4), col, -0.6);
    }
    if (demolish) {
      for (let k = 0; k < 8; k++) {
        this.spawn(x + (Math.random() - 0.5) * radius, y + 0.2, z + (Math.random() - 0.5) * radius, (Math.random() - 0.5) * 2, 1.5 + Math.random() * 1.5, (Math.random() - 0.5) * 2,
          0.9, 0.35, 0x6a5a4c, -5);
      }
    }
  }

  /** Green confetti / sparkles (restoration builds, objectives met). */
  sparkle(x: number, y: number, z: number, radius: number, gold = false): void {
    for (let k = 0; k < 18; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const col = gold ? (Math.random() < 0.5 ? 0xf4c43a : 0xfff0a0) : Math.random() < 0.5 ? 0x9fdc6a : 0xf4d24a;
      this.spawn(x + Math.cos(a) * r, y + 0.2, z + Math.sin(a) * r, Math.cos(a) * 0.3, 1.6 + Math.random() * 1.4, Math.sin(a) * 0.3, 1.1, 0.28, col, -2.2);
    }
  }

  update(dt: number): void {
    if (!this.alive) return;
    let any = 0;
    for (let i = 0; i < N; i++) {
      const life = this.life[i]!;
      let age = this.age[i]!;
      if (age >= life) continue;
      age += dt;
      this.age[i] = age;
      const t = Math.min(1, age / life);
      if (t >= 1) {
        _m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, _m);
        any = 1;
        continue;
      }
      const drag = Math.exp(-dt * 3);
      this.vx[i] = this.vx[i]! * drag;
      this.vz[i] = this.vz[i]! * drag;
      this.vy[i] = this.vy[i]! * Math.exp(-dt * 1.5) + this.grav[i]! * dt;
      this.px[i] = this.px[i]! + this.vx[i]! * dt;
      this.py[i] = this.py[i]! + this.vy[i]! * dt;
      this.pz[i] = this.pz[i]! + this.vz[i]! * dt;
      const s = this.size[i]! * Math.sin(Math.min(1, t * 3) * Math.PI * 0.5) * (1 - t * t);
      _m.compose(_p.set(this.px[i]!, this.py[i]!, this.pz[i]!), _q, _s.set(s, s, s));
      this.mesh.setMatrixAt(i, _m);
      any = 1;
    }
    this.alive = any;
    if (!any) this.mesh.visible = false;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
