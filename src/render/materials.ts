// Material library for the painterly-toon look. Every material is a stock MeshToonMaterial with the shared GLSL
// chunks injected via onBeforeCompile, so three's lighting / shadows keep working.
import {
  BackSide, CanvasTexture, Color, DataTexture, DoubleSide, FrontSide, LinearFilter, LinearMipmapLinearFilter, Material,
  MeshDepthMaterial, MeshToonMaterial, NearestFilter, RGBADepthPacking, RGBAFormat, RepeatWrapping, ShaderMaterial,
  type IUniform, type Side, type Texture, type WebGLProgramParametersWithUniforms,
} from 'three';
import { FRAG_COLOR, FRAG_OPAQUE, FRAG_PARS, VERT_BEGIN, VERT_END, VERT_NORMAL, VERT_PARS } from './glsl';
import { mulberry32 } from './noise';
import { LOOK } from './palette';

export type MatKind = 'terrain' | 'slab' | 'prop' | 'foliage' | 'coral' | 'smoke' | 'ghost';

export interface MatSpec {
  key: string;
  kind: MatKind;
  /** per-instance birth animation (iAnim attribute) */
  anim?: boolean;
  sway?: [number, number];
  sph?: boolean;
  noSmog?: boolean;
  side?: Side;
  transparent?: boolean;
}

export interface SharedUniforms {
  uTime: IUniform<number>;
  uTile: IUniform<Texture>;
  uMap: IUniform<{ x: number; y: number; z: number; w: number }>;
  uHaze: IUniform<number>;
  uHazeCol: IUniform<Color>;
  uFrontGlow: IUniform<number>;
  uWind: IUniform<{ x: number; y: number }>;
  [k: string]: IUniform;
}

export function makeToonRamp(): DataTexture {
  const vals = [92, 150, 212, 255];
  const data = new Uint8Array(vals.length * 4);
  vals.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const t = new DataTexture(data, vals.length, 1, RGBAFormat);
  t.minFilter = NearestFilter;
  t.magFilter = NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** Procedural painterly brush-stroke texture (neutral grey = no change). */
export function makeBrushTexture(): Texture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, S, S);
  const rnd = mulberry32(7);
  g.lineCap = 'round';
  for (let i = 0; i < 1500; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const a = -0.5 + (rnd() - 0.5) * 0.9;
    const len = 8 + rnd() * 26;
    const w = 2.5 + rnd() * 6;
    const l = 96 + rnd() * 70;
    const warm = (rnd() - 0.5) * 18;
    g.strokeStyle = `rgba(${(l + warm) | 0},${l | 0},${(l - warm) | 0},0.32)`;
    g.lineWidth = w;
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        g.beginPath();
        g.moveTo(x + ox, y + oy);
        g.quadraticCurveTo(x + ox + Math.cos(a) * len * 0.5 + 3, y + oy + Math.sin(a) * len * 0.5 - 2, x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
        g.stroke();
      }
    }
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = 4;
  return t;
}

export class MatLib {
  private cache = new Map<string, Material>();
  private depthCache = new Map<string, Material>();
  private styleU: Record<string, IUniform>;
  private toonRamp = makeToonRamp();
  readonly brush = makeBrushTexture();
  readonly ghostCol = new Color(0x5fe39a);
  outlineMat: ShaderMaterial;

  constructor(readonly shared: SharedUniforms) {
    this.styleU = {
      uFrontCol: { value: new Color(LOOK.frontCol) },
      uSat: { value: LOOK.sat },
      uStrata: { value: LOOK.strata.map((h) => new Color(h)) },
      uSph: { value: LOOK.sph },
      uBrush: { value: this.brush },
      uBrushAmt: { value: LOOK.brush },
      uRimCol: { value: new Color(LOOK.rimCol) },
      uRim: { value: LOOK.rim },
      uPollA: { value: new Color(LOOK.pollA) },
      uPollB: { value: new Color(LOOK.pollB) },
      uPollC: { value: new Color(LOOK.pollC) },
      uGhostCol: { value: this.ghostCol },
    };
    this.outlineMat = new ShaderMaterial({
      // Subtle outlines: about half the old width (0.0021), a tight world-unit cap, and a zoom fade (uFade, set per frame
      // from the camera distance) so a whole-map view carries no ink at all. Colour is the model's own vertex colour
      // darkened and slightly desaturated, so no near-black ink anywhere.
      uniforms: { uOutline: { value: 0.00105 }, uFade: { value: 1 } },
      side: BackSide,
      vertexColors: true,
      vertexShader: /* glsl */ `
        #include <common>
        #include <batching_pars_vertex>
        attribute vec3 onrm;
        uniform float uOutline;
        uniform float uFade;
        varying vec3 vInk;
        void main(){
          float lum = dot(color, vec3(0.299, 0.587, 0.114));
          vInk = mix(vec3(lum), color, 0.8) * 0.55;
          #include <batching_vertex>
          vec4 w = vec4(position, 1.0);
          vec3 n = normalize(onrm);
          #ifdef USE_BATCHING
          w = batchingMatrix * w;
          n = normalize(mat3(batchingMatrix) * n);
          #endif
          #ifdef USE_INSTANCING
          w = instanceMatrix * w;
          n = normalize(mat3(instanceMatrix) * n);
          #endif
          w = modelMatrix * w;
          float d = distance(cameraPosition, w.xyz);
          // Constant screen width up close, but capped in world units so that zoomed out over a whole city the ink
          // doesn't swallow small houses and turn every block dark.
          w.xyz += n * min(uOutline * d, 0.02) * uFade;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vInk;
        void main(){ gl_FragColor = vec4(vInk, 1.0); }
      `,
    });
  }

  /** Fade the outline out as the camera pulls back: full up to 0.8 map spans, gone by 2 spans (whole-map zoom). */
  setOutlineZoom(dist: number, span: number): void {
    const t = Math.min(1, Math.max(0, (dist / span - 0.8) / 1.2));
    this.outlineMat.uniforms.uFade!.value = 1 - t * t * (3 - 2 * t);
  }

  /** Biome: colours used for contaminated ground (salt crust inland, ochre/rust on the coast). */
  setPoll(cols: readonly [number, number, number]): void {
    (this.styleU.uPollA!.value as Color).set(cols[0]);
    (this.styleU.uPollB!.value as Color).set(cols[1]);
    (this.styleU.uPollC!.value as Color).set(cols[2]);
  }

  all(): Material[] {
    return [...this.cache.values(), ...this.depthCache.values()];
  }

  get(spec: MatSpec): Material {
    const hit = this.cache.get(spec.key);
    if (hit) return hit;
    const side = spec.side ?? FrontSide;
    const m = new MeshToonMaterial({ vertexColors: true, gradientMap: this.toonRamp, side });
    if (spec.transparent) {
      m.transparent = true;
      m.opacity = spec.kind === 'smoke' ? 0.7 : 0.62;
      m.depthWrite = false;
    }
    const defines: Record<string, string> = {};
    if (spec.kind === 'terrain') defines.CC_TERRAIN = '';
    if (spec.kind === 'slab') defines.CC_SLAB = '';
    if (spec.kind === 'smoke') defines.CC_SMOKE = '';
    if (spec.kind === 'ghost') defines.CC_GHOST = '';
    if (spec.anim) defines.CC_ANIM = '';
    if (spec.sway) {
      defines.CC_SWAY = '';
      defines.CC_SWAY_Y0 = spec.sway[0].toFixed(3);
      defines.CC_SWAY_AMT = spec.sway[1].toFixed(4);
    }
    if (spec.sph) defines.CC_SPH = '';
    if (spec.noSmog || spec.kind === 'smoke' || spec.kind === 'ghost') defines.CC_NOSMOG = '';
    if (spec.kind !== 'smoke' && spec.kind !== 'ghost') defines.CC_BRUSH = '';
    m.defines = defines;
    const su = this.styleU;
    const shared = this.shared;
    m.onBeforeCompile = (sh: WebGLProgramParametersWithUniforms) => {
      Object.assign(sh.uniforms, shared, su);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
        .replace('#include <beginnormal_vertex>', VERT_NORMAL)
        .replace('#include <begin_vertex>', VERT_BEGIN)
        .replace('#include <fog_vertex>', VERT_END);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
        .replace('#include <color_fragment>', FRAG_COLOR)
        .replace('#include <opaque_fragment>', FRAG_OPAQUE);
    };
    m.customProgramCacheKey = () => `cc|${spec.key}|${Object.keys(defines).join(',')}`;
    m.name = `cc:${spec.key}`;
    this.cache.set(spec.key, m);
    return m;
  }

  /** Shadow-pass material matching the vertex animation (grow / sway / smoke) of a spec. */
  depth(spec: MatSpec): Material | undefined {
    if (!spec.anim && !spec.sway && spec.kind !== 'smoke') return undefined;
    const hit = this.depthCache.get(spec.key);
    if (hit) return hit;
    const m = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: spec.side === DoubleSide ? DoubleSide : FrontSide });
    const defines: Record<string, string> = {};
    if (spec.anim) defines.CC_ANIM = '';
    if (spec.kind === 'smoke') defines.CC_SMOKE = '';
    if (spec.sway) {
      defines.CC_SWAY = '';
      defines.CC_SWAY_Y0 = spec.sway[0].toFixed(3);
      defines.CC_SWAY_AMT = spec.sway[1].toFixed(4);
    }
    m.defines = defines;
    const shared = this.shared;
    m.onBeforeCompile = (sh: WebGLProgramParametersWithUniforms) => {
      Object.assign(sh.uniforms, shared);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
        .replace('#include <begin_vertex>', VERT_BEGIN);
    };
    m.customProgramCacheKey = () => `ccdepth|${spec.key}|${Object.keys(defines).join(',')}`;
    this.depthCache.set(spec.key, m);
    return m;
  }

  dispose(): void {
    for (const m of this.all()) m.dispose();
    this.outlineMat.dispose();
  }
}

export { DoubleSide };
