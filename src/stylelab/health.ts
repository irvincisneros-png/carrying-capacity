// Per-tile restoration health (24x24 DataTexture). A front sweeps east -> west as t goes 0 -> 1.
import { ClampToEdgeWrapping, DataTexture, LinearFilter, RedFormat, UnsignedByteType } from 'three';
import { TILES } from './world';
import { fbm, hash2 } from './noise';

export class Health {
  readonly tex: DataTexture;
  private data = new Uint8Array(TILES * TILES);
  private value = new Float32Array(TILES * TILES);
  private target = new Float32Array(TILES * TILES);
  private offset = new Float32Array(TILES * TILES);
  t = 0.5;

  constructor() {
    for (let j = 0; j < TILES; j++) {
      for (let i = 0; i < TILES; i++) {
        const z = -11.5 + j;
        // wavy front + per-tile jitter so it advances in organic lobes
        this.offset[j * TILES + i] = (fbm(z * 0.18 + 4, i * 0.05, 3) - 0.5) * 5 + (hash2(i, j) - 0.5) * 1.6;
      }
    }
    this.tex = new DataTexture(this.data, TILES, TILES, RedFormat, UnsignedByteType);
    this.tex.magFilter = LinearFilter;
    this.tex.minFilter = LinearFilter;
    this.tex.wrapS = this.tex.wrapT = ClampToEdgeWrapping;
    this.tex.generateMipmaps = false;
    this.setRestore(0.5, true);
  }

  private computeTargets(): void {
    const front = 16 - this.t * 32; // x position of the front
    for (let j = 0; j < TILES; j++) {
      for (let i = 0; i < TILES; i++) {
        const k = j * TILES + i;
        const x = -11.5 + i + this.offset[k];
        this.target[k] = x > front ? 1 : 0;
      }
    }
  }

  setRestore(t: number, snap = false): void {
    this.t = Math.min(1, Math.max(0, t));
    this.computeTargets();
    if (snap) {
      this.value.set(this.target);
      this.upload();
    }
  }

  /** Ease tile values toward their targets; returns true if the texture changed. */
  update(dt: number): boolean {
    let changed = false;
    const rate = dt * 1.1;
    for (let k = 0; k < this.value.length; k++) {
      const v = this.value[k];
      const tg = this.target[k];
      if (v !== tg) {
        const nv = v < tg ? Math.min(tg, v + rate) : Math.max(tg, v - rate * 1.6);
        this.value[k] = nv;
        changed = true;
      }
    }
    if (changed) this.upload();
    return changed;
  }

  private upload(): void {
    for (let k = 0; k < this.value.length; k++) this.data[k] = Math.round(this.value[k] * 255);
    this.tex.needsUpdate = true;
  }
}
