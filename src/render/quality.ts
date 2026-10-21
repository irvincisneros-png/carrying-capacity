// Graphics tiers (docs/ART-DIRECTION.md) + FPS-based auto-detect with a remembered manual override.

export type Tier = 0 | 1 | 2 | 3 | 4;
export const TIER_NAMES = ['Very low', 'Low', 'Medium', 'High', 'Ultra'] as const;
/** The tier auto-detect starts on (Medium); software renderers start on Very low (see softwareRenderer). */
export const START_TIER: Tier = 2;

export interface TierDef {
  name: string;
  shadows: number; // 0 = none, else shadow map size
  ao: 'none' | 'half' | 'full';
  outlines: boolean;
  tiltShift: boolean;
  dof: boolean;
  foliage: number;
  detail: 0 | 1;
  treeDetail: -1 | 0 | 1;
  dprMax: number;
  props: number;
  smoke: number;
  /** Cheaper fragment shaders (terrain / slab / sky / water): no fbm noise, no caustics, no brush texture, no sky reflection. */
  lite: boolean;
  /** Render straight to the canvas with the built-in tone mapper instead of through the post-processing composer. */
  direct: boolean;
  /** Fraction of the cloud cards drawn. */
  clouds: number;
  /** Terrain vertices per tile edge (0 = the map's default: 4, or 3 on big maps). Fewer = far fewer triangles. */
  terrainRes: number;
  /** Building parts whose largest bounding-box edge is below this (world units) are left out of the models. */
  partCull: number;
}

export const TIERS: readonly TierDef[] = [
  { name: 'Very low', shadows: 0, ao: 'none', outlines: false, tiltShift: false, dof: false, foliage: 0.2, detail: 0, treeDetail: -1, dprMax: 0.6, props: 0.1, smoke: 0.12, lite: true, direct: true, clouds: 0.25, terrainRes: 2, partCull: 0.28 },
  { name: 'Low', shadows: 0, ao: 'none', outlines: false, tiltShift: false, dof: false, foliage: 0.35, detail: 0, treeDetail: 0, dprMax: 1, props: 0.6, smoke: 0.3, lite: true, direct: false, clouds: 0.5, terrainRes: 0, partCull: 0 },
  { name: 'Medium', shadows: 1024, ao: 'none', outlines: false, tiltShift: true, dof: false, foliage: 0.7, detail: 1, treeDetail: 1, dprMax: 1.25, props: 0.85, smoke: 0.8, lite: false, direct: false, clouds: 1, terrainRes: 0, partCull: 0 },
  { name: 'High', shadows: 2048, ao: 'half', outlines: true, tiltShift: true, dof: false, foliage: 1, detail: 1, treeDetail: 1, dprMax: 1.75, props: 1, smoke: 1, lite: false, direct: false, clouds: 1, terrainRes: 0, partCull: 0 },
  { name: 'Ultra', shadows: 4096, ao: 'full', outlines: true, tiltShift: true, dof: true, foliage: 1.3, detail: 1, treeDetail: 1, dprMax: 2, props: 1.5, smoke: 1.5, lite: false, direct: false, clouds: 1, terrainRes: 0, partCull: 0 },
];

const KEY = 'cc.graphics.v2';
const KEY_V1 = 'cc.graphics.v1'; // before 'Very low' existed: tier indices were one lower

export type OutlineMode = 'off' | 'subtle';

export interface GraphicsPref {
  mode: 'auto' | 'manual';
  tier: Tier;
  /** Building outlines (only drawn on tiers that support them; Low never draws them). */
  outlines: OutlineMode;
}

export function loadPref(): GraphicsPref {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<GraphicsPref>;
      if ((p.mode === 'auto' || p.mode === 'manual') && typeof p.tier === 'number' && p.tier >= 0 && p.tier <= 4) {
        return { mode: p.mode, tier: p.tier as Tier, outlines: p.outlines === 'off' ? 'off' : 'subtle' };
      }
    }
    const old = localStorage.getItem(KEY_V1);
    if (old) {
      const p = JSON.parse(old) as Partial<GraphicsPref>;
      if ((p.mode === 'auto' || p.mode === 'manual') && typeof p.tier === 'number' && p.tier >= 0 && p.tier <= 3) {
        return { mode: p.mode, tier: (p.tier + 1) as Tier, outlines: p.outlines === 'off' ? 'off' : 'subtle' };
      }
    }
  } catch {
    /* ignore */
  }
  return { mode: 'auto', tier: START_TIER, outlines: 'subtle' };
}

/** True when WebGL is running on a CPU rasteriser (SwiftShader / llvmpipe / "Basic Render Driver"): start on Very low. */
export function softwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch {
    return false;
  }
}

export function savePref(p: GraphicsPref): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/**
 * Auto-detect: start on Medium (Very low when WebGL is a software rasteriser), sample the real frame rate; drop a tier
 * if it is below 45 fps over 2 s (below 20 fps over 1 s - no point waiting on a slideshow), raise one if it is above
 * 58 fps with less than 8 ms frame time (at most one raise). Re-check after each tier change. Once settled it keeps
 * watching in 4 s windows and steps down again if the game drifts below 24 fps (a bigger town, a slow patch).
 */
export class AutoTier {
  private t = 0;
  private frames = 0;
  private cpu = 0;
  private raised = false;
  private warm = 0.6;
  private watching = false;
  done = false;

  constructor(private apply: (t: Tier) => void, private current: () => Tier) {}

  reset(): void {
    this.t = 0;
    this.frames = 0;
    this.cpu = 0;
    this.warm = 0.6;
    this.watching = false;
  }

  /** Feed one frame (real seconds since the last one). `hidden` frames (tab in background) are ignored. */
  frame(dt: number, cpuMs: number, hidden: boolean, manual = false): void {
    if (manual || hidden || dt > 1.5) return;
    if (this.done && !this.watching) return;
    if (this.warm > 0) {
      this.warm -= dt;
      return;
    }
    this.t += dt;
    this.frames++;
    this.cpu += cpuMs;
    const fps = this.frames / this.t;
    const cur = this.current();
    if (this.watching) {
      if (this.t < 4) return;
      if (fps < 24 && cur > 0) {
        this.apply((cur - 1) as Tier);
        this.reset();
        this.watching = true;
        this.done = true;
        this.warm = 1.5;
        return;
      }
      this.t = 0;
      this.frames = 0;
      this.cpu = 0;
      return;
    }
    if (this.t < 1) return;
    if (fps < 20 && cur > 0 && this.frames >= 3) {
      this.apply((cur - 1) as Tier);
      this.reset();
      return;
    }
    if (this.t < 2) return;
    const ms = this.cpu / this.frames;
    if (fps < 45 && cur > 0) {
      this.apply((cur - 1) as Tier);
      this.reset();
      return;
    }
    if (!this.raised && fps > 58 && ms < 8 && cur < 4) {
      this.raised = true;
      this.apply((cur + 1) as Tier);
      this.reset();
      return;
    }
    this.done = true;
    this.watching = true;
    this.t = 0;
    this.frames = 0;
    this.cpu = 0;
  }
}
