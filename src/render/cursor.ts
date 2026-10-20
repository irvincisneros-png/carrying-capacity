// Picking (ray vs heightfield, allocation-free), hover footprint outline draped on the terrain, placement ghost
// tinted valid / invalid, and an effect-radius ring for buildings with an area of influence.
import {
  AdditiveBlending, BufferAttribute, DoubleSide, BufferGeometry, Color, Group, Mesh, MeshBasicMaterial, Raycaster, Vector2, Vector3,
  type BufferGeometry as BG, type Camera, type Material,
} from 'three';
import type { MapGeo } from './mapgeo';

export interface PickResult {
  tx: number;
  ty: number;
  x: number;
  y: number;
  z: number;
}

const MAX_SEG = 64;

export type CursorMode = 'hover' | 'ok' | 'bad' | 'demolish' | 'info';
const COLS: Record<CursorMode, number> = { hover: 0xfff6dc, ok: 0x5fe39a, bad: 0xff5a4a, demolish: 0xff8a3a, info: 0x8fd4ff };

export class Cursor {
  readonly group = new Group();
  private ray = new Raycaster();
  private ndc = new Vector2();
  private p = new Vector3();
  private border: Mesh;
  private fill: Mesh;
  private ring: Mesh;
  private ghost: Mesh;
  private bPos: Float32Array;
  private fPos: Float32Array;
  private rPos: Float32Array;
  private borderMat: MeshBasicMaterial;
  private fillMat: MeshBasicMaterial;
  private ringMat: MeshBasicMaterial;
  private col = new Color();
  private pulse = 0;
  ghostScale: [number, number] = [1.08, 1.35];

  constructor(private map: MapGeo, ghostMat: Material) {
    this.bPos = new Float32Array(MAX_SEG * 6 * 3);
    this.fPos = new Float32Array(12 * 12 * 6 * 3);
    this.rPos = new Float32Array(96 * 6 * 3);
    const mk = (arr: Float32Array, mat: Material): Mesh => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(arr, 3));
      g.setDrawRange(0, 0);
      const m = new Mesh(g, mat);
      m.frustumCulled = false;
      m.renderOrder = 5;
      this.group.add(m);
      return m;
    };
    this.borderMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false, toneMapped: false, side: DoubleSide });
    this.fillMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false, side: DoubleSide });
    this.ringMat = new MeshBasicMaterial({ color: 0x8fd4ff, transparent: true, opacity: 0.55, depthWrite: false, blending: AdditiveBlending, toneMapped: false, side: DoubleSide });
    this.border = mk(this.bPos, this.borderMat);
    this.fill = mk(this.fPos, this.fillMat);
    this.ring = mk(this.rPos, this.ringMat);
    this.ghost = new Mesh(new BufferGeometry(), ghostMat);
    this.ghost.visible = false;
    this.ghost.renderOrder = 4;
    this.group.add(this.ghost);
  }

  /** Ray-march the heightfield from the camera through a screen point (NDC). */
  pick(cam: Camera, nx: number, ny: number): PickResult | null {
    this.ndc.set(nx, ny);
    this.ray.setFromCamera(this.ndc, cam);
    const o = this.ray.ray.origin;
    const d = this.ray.ray.direction;
    const map = this.map;
    // intersect with the slab's bounding box first (top region y in [-2, 2.5])
    let t0 = 0;
    let t1 = 400;
    const bx = map.w / 2;
    const bz = map.h / 2;
    const slab = (lo: number, hi: number, oo: number, dd: number): boolean => {
      if (Math.abs(dd) < 1e-6) return oo >= lo && oo <= hi;
      let a = (lo - oo) / dd;
      let b = (hi - oo) / dd;
      if (a > b) { const tmp = a; a = b; b = tmp; }
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      return t0 <= t1;
    };
    if (!slab(-bx, bx, o.x, d.x) || !slab(-2, 2.5, o.y, d.y) || !slab(-bz, bz, o.z, d.z)) return null;
    const step = 0.08;
    let prevT = t0;
    let hit = -1;
    for (let t = t0; t <= t1; t += step) {
      const x = o.x + d.x * t;
      const y = o.y + d.y * t;
      const z = o.z + d.z * t;
      const gy = Math.max(map.heightAt(x, z), 0);
      if (y <= gy) {
        // refine
        let lo = prevT;
        let hi = t;
        for (let k = 0; k < 8; k++) {
          const m = (lo + hi) / 2;
          const mx = o.x + d.x * m;
          const mz = o.z + d.z * m;
          if (o.y + d.y * m <= Math.max(map.heightAt(mx, mz), 0)) hi = m;
          else lo = m;
        }
        hit = hi;
        break;
      }
      prevT = t;
    }
    if (hit < 0) return null;
    this.p.copy(d).multiplyScalar(hit).add(o);
    const tx = map.tileX(this.p.x);
    const ty = map.tileY(this.p.z);
    if (!map.inBounds(tx, ty)) return null;
    return { tx, ty, x: this.p.x, y: this.p.y, z: this.p.z };
  }

  private surf(x: number, z: number): number {
    return Math.max(this.map.heightAt(x, z), 0) + 0.035;
  }

  /** Show the footprint outline (tile rect) in a mode colour. */
  showRect(tx: number, ty: number, w: number, h: number, mode: CursorMode): void {
    const map = this.map;
    const x0 = tx - map.w / 2;
    const z0 = ty - map.h / 2;
    const x1 = x0 + w;
    const z1 = z0 + h;
    const th = 0.055;
    let n = 0;
    const B = this.bPos;
    const seg = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number): void => {
      const steps = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) * 4));
      for (let s = 0; s < steps && n < MAX_SEG; s++) {
        const t0 = s / steps;
        const t1 = (s + 1) / steps;
        const px = ax + (bx - ax) * t0, pz = az + (bz - az) * t0;
        const qx = ax + (bx - ax) * t1, qz = az + (bz - az) * t1;
        const py = this.surf(px, pz), qy = this.surf(qx, qz);
        const o = n * 18;
        B[o] = px; B[o + 1] = py; B[o + 2] = pz;
        B[o + 3] = qx; B[o + 4] = qy; B[o + 5] = qz;
        B[o + 6] = qx + nx * th; B[o + 7] = qy; B[o + 8] = qz + nz * th;
        B[o + 9] = px; B[o + 10] = py; B[o + 11] = pz;
        B[o + 12] = qx + nx * th; B[o + 13] = qy; B[o + 14] = qz + nz * th;
        B[o + 15] = px + nx * th; B[o + 16] = py; B[o + 17] = pz + nz * th;
        n++;
      }
    };
    seg(x0, z0, x1, z0, 0, 1);
    seg(x1, z0, x1, z1, -1, 0);
    seg(x1, z1, x0, z1, 0, -1);
    seg(x0, z1, x0, z0, 1, 0);
    this.border.geometry.setDrawRange(0, n * 6);
    (this.border.geometry.attributes.position as BufferAttribute).needsUpdate = true;
    // fill: draped grid, 3 cells per tile
    const F = this.fPos;
    const cw = Math.min(12, w * 3);
    const ch = Math.min(12, h * 3);
    let f = 0;
    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const ax = x0 + (i / cw) * w, bx = x0 + ((i + 1) / cw) * w;
        const az = z0 + (j / ch) * h, bz = z0 + ((j + 1) / ch) * h;
        const o = f * 18;
        const ya = this.surf(ax, az), yb = this.surf(bx, az), yc = this.surf(bx, bz), yd = this.surf(ax, bz);
        F[o] = ax; F[o + 1] = ya; F[o + 2] = az;
        F[o + 3] = ax; F[o + 4] = yd; F[o + 5] = bz;
        F[o + 6] = bx; F[o + 7] = yc; F[o + 8] = bz;
        F[o + 9] = ax; F[o + 10] = ya; F[o + 11] = az;
        F[o + 12] = bx; F[o + 13] = yc; F[o + 14] = bz;
        F[o + 15] = bx; F[o + 16] = yb; F[o + 17] = az;
        f++;
      }
    }
    this.fill.geometry.setDrawRange(0, f * 6);
    (this.fill.geometry.attributes.position as BufferAttribute).needsUpdate = true;
    this.col.set(COLS[mode]);
    this.borderMat.color.copy(this.col);
    this.fillMat.color.copy(this.col);
    this.fillMat.opacity = mode === 'hover' ? 0.12 : 0.26;
    this.border.visible = true;
    this.fill.visible = true;
  }

  /** Radius ring (tiles) around a footprint centre. */
  showRing(cx: number, cz: number, radius: number): void {
    const R = this.rPos;
    const N = 96;
    const th = 0.07;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2;
      const a1 = ((i + 1) / N) * Math.PI * 2;
      const px = cx + Math.cos(a0) * radius, pz = cz + Math.sin(a0) * radius;
      const qx = cx + Math.cos(a1) * radius, qz = cz + Math.sin(a1) * radius;
      const ix = cx + Math.cos(a0) * (radius - th), iz = cz + Math.sin(a0) * (radius - th);
      const jx = cx + Math.cos(a1) * (radius - th), jz = cz + Math.sin(a1) * (radius - th);
      const py = this.surf(px, pz), qy = this.surf(qx, qz);
      const o = i * 18;
      R[o] = px; R[o + 1] = py; R[o + 2] = pz;
      R[o + 3] = jx; R[o + 4] = qy; R[o + 5] = jz;
      R[o + 6] = qx; R[o + 7] = qy; R[o + 8] = qz;
      R[o + 9] = px; R[o + 10] = py; R[o + 11] = pz;
      R[o + 12] = ix; R[o + 13] = py; R[o + 14] = iz;
      R[o + 15] = jx; R[o + 16] = qy; R[o + 17] = jz;
    }
    this.ring.geometry.setDrawRange(0, N * 6);
    (this.ring.geometry.attributes.position as BufferAttribute).needsUpdate = true;
    this.ring.visible = true;
  }

  hideRing(): void {
    this.ring.visible = false;
  }

  hide(): void {
    this.border.visible = false;
    this.fill.visible = false;
    this.ring.visible = false;
    this.ghost.visible = false;
  }

  setGhostGeometry(g: BG | null): void {
    if (!g) {
      this.ghost.visible = false;
      return;
    }
    this.ghost.geometry = g;
  }

  showGhost(x: number, y: number, z: number, yaw: number, ok: boolean, ghostCol: Color): void {
    this.ghost.position.set(x, y + 0.02, z);
    this.ghost.rotation.set(0, yaw, 0);
    this.ghost.scale.set(this.ghostScale[0], this.ghostScale[1], this.ghostScale[0]);
    ghostCol.set(ok ? 0x5fe39a : 0xff5a4a);
    this.ghost.visible = true;
  }

  hideGhost(): void {
    this.ghost.visible = false;
  }

  update(dt: number): void {
    this.pulse += dt;
    this.borderMat.opacity = 0.75 + 0.2 * Math.sin(this.pulse * 6);
  }
}
