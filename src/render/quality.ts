// Graphics tiers (docs/ART-DIRECTION.md) + FPS-based auto-detect with a remembered manual override.

export type Tier = 0 | 1 | 2 | 3;
export const TIER_NAMES = ['Low', 'Medium', 'High', 'Ultra'] as const;

export interface TierDef {
  name: string;
  shadows: number; // 0 = none, else shadow map size
  ao: 'none' | 'half' | 'full';
  outlines: boolean;
  tiltShift: boolean;
  dof: boolean;
  foliage: number;
  detail: 0 | 1;
  treeDetail: 0 | 1;
  dprMax: number;
  props: number;
  smoke: number;
}

export const TIERS: readonly TierDef[] = [
  { name: 'Low', shadows: 0, ao: 'none', outlines: false, tiltShift: false, dof: false, foliage: 0.35, detail: 0, treeDetail: 0, dprMax: 1, props: 0.6, smoke: 0.3 },
  { name: 'Medium', shadows: 1024, ao: 'none', outlines: false, tiltShift: true, dof: false, foliage: 0.7, detail: 1, treeDetail: 1, dprMax: 1.25, props: 0.85, smoke: 0.8 },
  { name: 'High', shadows: 2048, ao: 'half', outlines: true, tiltShift: true, dof: false, foliage: 1, detail: 1, treeDetail: 1, dprMax: 1.75, props: 1, smoke: 1 },
  { name: 'Ultra', shadows: 4096, ao: 'full', outlines: true, tiltShift: true, dof: true, foliage: 1.3, detail: 1, treeDetail: 1, dprMax: 2, props: 1.5, smoke: 1.5 },
];

const KEY = 'cc.graphics.v1';

export interface GraphicsPref {
  mode: 'auto' | 'manual';
  tier: Tier;
}

export function loadPref(): GraphicsPref {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<GraphicsPref>;
      if ((p.mode === 'auto' || p.mode === 'manual') && typeof p.tier === 'number' && p.tier >= 0 && p.tier <= 3) {
        return { mode: p.mode, tier: p.tier as Tier };
      }
    }
  } catch {
    /* ignore */
  }
  return { mode: 'auto', tier: 1 };
}

export function savePref(p: GraphicsPref): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/**
 * Auto-detect: start on Medium, sample 2 s; drop a tier if the average is below 45 fps, raise one if it is above
 * 58 fps with less than 8 ms frame time (at most one raise). Re-check after each tier change.
 */
export class AutoTier {
  private t = 0;
  private frames = 0;
  private cpu = 0;
  private raised = false;
  private warm = 0.6;
  done = false;

  constructor(private apply: (t: Tier) => void, private current: () => Tier) {}

  reset(): void {
    this.t = 0;
    this.frames = 0;
    this.cpu = 0;
    this.warm = 0.6;
  }

  /** Feed one frame. `hidden` frames (tab in background) are ignored. */
  frame(dt: number, cpuMs: number, hidden: boolean): void {
    if (this.done || hidden || dt > 0.25) return;
    if (this.warm > 0) {
      this.warm -= dt;
      return;
    }
    this.t += dt;
    this.frames++;
    this.cpu += cpuMs;
    if (this.t < 2) return;
    const fps = this.frames / this.t;
    const ms = this.cpu / this.frames;
    const cur = this.current();
    if (fps < 45 && cur > 0) {
      this.apply((cur - 1) as Tier);
      this.reset();
      return;
    }
    if (!this.raised && fps > 58 && ms < 8 && cur < 3) {
      this.raised = true;
      this.apply((cur + 1) as Tier);
      this.reset();
      return;
    }
    this.done = true;
  }
}
