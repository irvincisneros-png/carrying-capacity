// Per-tile RGBA texture driving terrain / water / restoration shading. Targets are recomputed from the sim grid
// when it changes; displayed values ease toward them so changes (pollution creeping, bush returning) animate.
//   r = vegetation vigour, g = soil contamination, b = water pollution, a = restoration pulse (Act 2 growth).
import { ClampToEdgeWrapping, DataTexture, LinearFilter, RGBAFormat, UnsignedByteType } from 'three';
import { reefHealth } from '../sim/climate';
import { TileKind, type GameState } from '../sim/types';

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export class TileData {
  readonly tex: DataTexture;
  readonly n: number;
  private data: Uint8Array;
  private target: Float32Array;
  private value: Float32Array;
  private lastVeg: Float32Array;
  private dirty = true;
  private settled = false;

  constructor(readonly w: number, readonly h: number) {
    this.n = w * h;
    this.data = new Uint8Array(this.n * 4);
    this.target = new Float32Array(this.n * 4);
    this.value = new Float32Array(this.n * 4);
    this.lastVeg = new Float32Array(this.n).fill(-1);
    this.tex = new DataTexture(this.data, w, h, RGBAFormat, UnsignedByteType);
    this.tex.magFilter = LinearFilter;
    this.tex.minFilter = LinearFilter;
    this.tex.wrapS = this.tex.wrapT = ClampToEdgeWrapping;
    this.tex.generateMipmaps = false;
    this.tex.needsUpdate = true;
  }

  /** Recompute targets from the simulation. `snap` jumps straight there (new game / load). */
  sync(s: GameState, snap: boolean): void {
    const g = s.grid;
    const act2 = s.phase === 'act2' || s.phase === 'epilogue' || s.phase === 'failed';
    const t = this.target;
    for (let i = 0; i < this.n; i++) {
      const k = g.kind[i] ?? 0;
      const built = (g.building[i] ?? 0) !== 0;
      const soil = g.soilContamination[i] ?? 0;
      const water = g.waterPollution[i] ?? 0;
      const health = g.health[i] ?? 0;
      let veg = 1;
      if (built) veg = 0.12;
      else if (k === TileKind.Land || k === TileKind.Bush) {
        if (act2) veg = k === TileKind.Bush ? Math.max(0.85, health) : 0.26 + 0.74 * health;
        else veg = k === TileKind.Bush ? 1 : 0.44;
        veg -= Math.min(0.3, soil * 0.18);
        if ((g.weed[i] ?? 0) === 1) veg = Math.min(veg, 0.35);
      } else if (k === TileKind.Beach) {
        veg = act2 ? 0.3 + 0.7 * health : 0.6;
      } else if (k === TileKind.Reef) {
        veg = act2 ? health : reefHealth(s.tempC, water);
      }
      const o = i * 4;
      t[o] = clamp01(veg);
      t[o + 1] = clamp01(soil / 1.6);
      t[o + 2] = clamp01(water / 2.2);
      const prev = this.lastVeg[i]!;
      if (act2 && !snap && prev >= 0 && t[o]! > prev + 0.0005) t[o + 3] = 1;
      this.lastVeg[i] = t[o]!;
    }
    if (snap) {
      this.value.set(t);
      for (let i = 0; i < this.n; i++) this.value[i * 4 + 3] = 0;
    }
    this.settled = false;
    this.dirty = true;
  }

  /** Ease displayed values toward targets. Returns true when the texture was re-uploaded. */
  update(dt: number): boolean {
    if (this.settled && !this.dirty) return false;
    const v = this.value;
    const t = this.target;
    const rate = dt * 0.45;
    let moving = false;
    for (let o = 0; o < v.length; o++) {
      const ch = o & 3;
      const cur = v[o]!;
      if (ch === 3) {
        // restoration pulse: rises fast, target decays back to 0 over ~4 s
        const tg = t[o]!;
        let nv = cur < tg ? Math.min(tg, cur + dt * 3) : Math.max(0, cur - dt * 0.25);
        if (tg > 0 && cur >= tg) t[o] = Math.max(0, tg - dt * 0.25);
        if (nv !== cur) { v[o] = nv; moving = true; }
        nv = v[o]!;
        continue;
      }
      const tg = t[o]!;
      if (cur !== tg) {
        v[o] = cur < tg ? Math.min(tg, cur + rate) : Math.max(tg, cur - rate);
        moving = true;
      }
    }
    if (moving || this.dirty) {
      const d = this.data;
      for (let o = 0; o < v.length; o++) d[o] = (v[o]! * 255 + 0.5) | 0;
      this.tex.needsUpdate = true;
    }
    this.dirty = false;
    this.settled = !moving;
    return moving;
  }

  /** Current displayed vegetation (0..1) of a tile. */
  veg(i: number): number {
    return this.value[i * 4] ?? 0;
  }
}
