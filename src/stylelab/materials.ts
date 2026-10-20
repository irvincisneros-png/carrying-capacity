// Material library: one material per (style, spec) built from three's stock materials
// with shared GLSL injected via onBeforeCompile. Geometry is shared between styles.
import {
  Color, DataTexture, DoubleSide, FrontSide, Material, MeshDepthMaterial, MeshLambertMaterial,
  MeshStandardMaterial, MeshToonMaterial, NearestFilter, RGBADepthPacking, RGBAFormat, Side,
  Texture, CanvasTexture, RepeatWrapping, LinearMipmapLinearFilter, LinearFilter, type IUniform,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { FRAG_COLOR, FRAG_NORMAL, FRAG_OPAQUE, FRAG_PARS, FRAG_ROUGH, VERT_BEGIN, VERT_END, VERT_NORMAL, VERT_PARS } from './glsl';
import { STYLES, type StyleDef, type StyleId } from './styles';
import { mulberry32 } from './noise';

export type MatKind = 'terrain' | 'slab' | 'prop' | 'foliage' | 'coral' | 'smoke' | 'cloud';

export interface MatSpec {
  key: string;
  kind: MatKind;
  grow?: boolean;
  sway?: [number, number]; // [y0, amount]
  sph?: boolean;
  surf?: boolean;
  noSmog?: boolean;
  side?: Side;
  roughness?: number;
}

export interface SharedUniforms {
  uTime: IUniform<number>;
  uHealth: IUniform<Texture>;
}

function col(hex: number): Color {
  return new Color(hex);
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

interface StyleUniforms {
  [k: string]: IUniform;
}

export class MatLib {
  private cache = new Map<string, Material>();
  private depthCache = new Map<string, Material>();
  private styleU: StyleUniforms[];
  private toonRamp = makeToonRamp();
  readonly brush = makeBrushTexture();

  constructor(private shared: SharedUniforms) {
    this.styleU = STYLES.map((s) => this.makeStyleUniforms(s));
  }

  private makeStyleUniforms(s: StyleDef): StyleUniforms {
    return {
      uSmog: { value: s.smog },
      uSmogCol: { value: col(s.smogCol) },
      uFrontCol: { value: col(s.frontCol) },
      uFrontGlow: { value: s.frontGlow },
      uSat: { value: s.sat },
      uStrata: { value: s.strata.map(col) },
      uSph: { value: s.sph },
      uBrush: { value: this.brush },
      uBrushAmt: { value: s.brush },
      uRimCol: { value: col(s.rimCol) },
      uRim: { value: s.rim },
      uBump: { value: s.bump },
      uRoughVar: { value: s.roughVar },
    };
  }

  /** All materials created so far (for needsUpdate on shadow toggles). */
  all(): Material[] {
    return [...this.cache.values(), ...this.depthCache.values()];
  }

  get(styleId: StyleId, spec: MatSpec): Material {
    const ck = `${styleId}:${spec.key}`;
    const hit = this.cache.get(ck);
    if (hit) return hit;
    const s = STYLES[styleId];
    const side = spec.side ?? FrontSide;
    let m: MeshStandardMaterial | MeshToonMaterial | MeshLambertMaterial;
    const rough = spec.roughness ?? (spec.kind === 'foliage' ? 0.75 : 0.88);
    if (s.base === 'standard-flat') {
      m = new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: rough, metalness: 0, side });
    } else if (s.base === 'standard') {
      m = new MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: 0, side, envMapIntensity: s.envIntensity });
    } else if (s.base === 'toon') {
      m = new MeshToonMaterial({ vertexColors: true, gradientMap: this.toonRamp, side });
    } else {
      m = new MeshLambertMaterial({ vertexColors: true, flatShading: true, side });
    }
    if (spec.kind === 'cloud') {
      if (m instanceof MeshStandardMaterial) m.roughness = 1;
    }
    const defines: Record<string, string> = {};
    const isStd = m instanceof MeshStandardMaterial;
    if (isStd) defines.LAB_STD = '';
    if (spec.kind === 'terrain') defines.LAB_TERRAIN = '';
    if (spec.kind === 'slab') defines.LAB_SLAB = '';
    if (spec.kind === 'coral') defines.LAB_CORAL = '';
    if (spec.kind === 'smoke') defines.LAB_SMOKE = '';
    if (spec.grow) defines.LAB_GROW = '';
    if (spec.sway) {
      defines.LAB_SWAY = '';
      defines.LAB_SWAY_Y0 = spec.sway[0].toFixed(3);
      defines.LAB_SWAY_AMT = spec.sway[1].toFixed(4);
    }
    if (spec.sph && s.sph > 0) defines.LAB_SPH = '';
    if (spec.surf) defines.LAB_SURF = '';
    if (spec.noSmog || spec.kind === 'cloud') defines.LAB_NOSMOG = '';
    if (s.brush > 0 && spec.kind !== 'cloud') defines.LAB_BRUSH = '';
    if (s.rim > 0) defines.LAB_RIM = '';
    if (s.bump > 0 && (spec.kind === 'terrain' || spec.kind === 'slab' || spec.kind === 'prop')) defines.LAB_BUMP = '';
    if (s.caustic) defines.LAB_CAUSTIC = '';
    if (s.base === 'lambert') defines.LAB_GRADE_D = '';
    m.defines = defines;
    const su = this.styleU[styleId];
    const shared = this.shared;
    m.onBeforeCompile = (sh: WebGLProgramParametersWithUniforms) => {
      Object.assign(sh.uniforms, shared, su);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
        .replace('#include <beginnormal_vertex>', VERT_NORMAL)
        .replace('#include <begin_vertex>', VERT_BEGIN)
        .replace('#include <fog_vertex>', VERT_END);
      let fs = sh.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
        .replace('#include <color_fragment>', FRAG_COLOR)
        .replace('#include <normal_fragment_maps>', FRAG_NORMAL)
        .replace('#include <opaque_fragment>', FRAG_OPAQUE);
      if (isStd) fs = fs.replace('#include <metalnessmap_fragment>', FRAG_ROUGH);
      sh.fragmentShader = fs;
    };
    m.customProgramCacheKey = () => `lab|${s.base}|${spec.key}|${Object.keys(defines).join(',')}`;
    m.name = `${s.key}:${spec.key}`;
    this.cache.set(ck, m);
    return m;
  }

  /** Shadow-pass material matching the vertex animation (grow / sway / smoke) of a spec. */
  depth(spec: MatSpec): Material | undefined {
    if (!spec.grow && !spec.sway && spec.kind !== 'smoke') return undefined;
    const hit = this.depthCache.get(spec.key);
    if (hit) return hit;
    const m = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, side: spec.side === DoubleSide ? DoubleSide : FrontSide });
    const defines: Record<string, string> = { LAB_DEPTH: '' };
    if (spec.grow) defines.LAB_GROW = '';
    if (spec.kind === 'smoke') defines.LAB_SMOKE = '';
    if (spec.sway) {
      defines.LAB_SWAY = '';
      defines.LAB_SWAY_Y0 = spec.sway[0].toFixed(3);
      defines.LAB_SWAY_AMT = spec.sway[1].toFixed(4);
    }
    m.defines = defines;
    const shared = this.shared;
    m.onBeforeCompile = (sh: WebGLProgramParametersWithUniforms) => {
      Object.assign(sh.uniforms, shared);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
        .replace('#include <begin_vertex>', VERT_BEGIN);
    };
    m.customProgramCacheKey = () => `labdepth|${spec.key}|${Object.keys(defines).join(',')}`;
    this.depthCache.set(spec.key, m);
    return m;
  }

}
