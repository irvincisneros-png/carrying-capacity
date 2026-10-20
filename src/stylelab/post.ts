// Post-processing stacks per style + quality tier (pmndrs postprocessing + N8AO).
import {
  BlendFunction, BloomEffect, BrightnessContrastEffect, DepthOfFieldEffect, Effect, EffectAttribute, EffectComposer,
  EffectPass, HueSaturationEffect, KernelSize, RenderPass, SMAAEffect, SMAAPreset, TiltShiftEffect, ToneMappingEffect,
  ToneMappingMode, VignetteEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { Color, HalfFloatType, Uniform, type Camera, type Scene, type Vector3, type WebGLRenderer } from 'three';
import type { StyleId } from './styles';

export type Quality = 0 | 1 | 2; // Low / Med / High
export const QUALITY_NAMES = ['Low', 'Med', 'High'] as const;

/** Depth-discontinuity ink lines for the painterly style. */
class InkEdgeEffect extends Effect {
  constructor(strength = 0.7, color = new Color(0x3a2a22)) {
    super('InkEdgeEffect', /* glsl */ `
      uniform float uStrength;
      uniform vec3 uInk;
      float lz(vec2 uv){ return getViewZ(readDepth(uv)); }
      void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor){
        float z = getViewZ(depth);
        vec2 t = texelSize * 1.2;
        float zl = lz(uv - vec2(t.x, 0.0)), zr = lz(uv + vec2(t.x, 0.0));
        float zu = lz(uv + vec2(0.0, t.y)), zd = lz(uv - vec2(0.0, t.y));
        float lap = abs(zl + zr + zu + zd - 4.0 * z);
        float e = smoothstep(0.012, 0.04, lap / max(abs(z), 1.0));
        outputColor = vec4(mix(inputColor.rgb, inputColor.rgb * uInk, e * uStrength), inputColor.a);
      }
    `, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([['uStrength', new Uniform(strength)], ['uInk', new Uniform(color)]]),
    });
  }
}

export interface Pipeline {
  composer: EffectComposer;
  dof?: DepthOfFieldEffect;
  dispose(): void;
  setSize(w: number, h: number): void;
}

export function buildPipeline(renderer: WebGLRenderer, scene: Scene, camera: Camera, style: StyleId, q: Quality, focus: Vector3): Pipeline {
  const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType, depthBuffer: true, stencilBuffer: false });
  composer.addPass(new RenderPass(scene, camera));
  const W = renderer.domElement.width;
  const H = renderer.domElement.height;
  let dof: DepthOfFieldEffect | undefined;

  const ao = (intensity: number, radius: number, color: number) => {
    const p = new N8AOPostPass(scene, camera, W, H);
    p.configuration.aoRadius = radius;
    p.configuration.distanceFalloff = 0.6;
    p.configuration.intensity = intensity;
    p.configuration.color = new Color(color);
    p.configuration.halfRes = true;
    p.configuration.depthAwareUpsampling = true;
    p.setQualityMode(q === 2 ? 'Medium' : 'Performance');
    composer.addPass(p);
  };
  const smaa = () => composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: q === 2 ? SMAAPreset.HIGH : SMAAPreset.MEDIUM })));

  const fx: Effect[] = [];
  if (style === 0) {
    // A — low-poly diorama
    if (q >= 1) ao(2.6, 1.1, 0x2a1e18);
    if (q >= 1) smaa();
    if (q >= 1) fx.push(new BloomEffect({ intensity: 0.45, luminanceThreshold: 0.82, luminanceSmoothing: 0.2, mipmapBlur: true }));
    fx.push(new TiltShiftEffect({ offset: 0.0, rotation: 0, focusArea: 0.82, feather: 0.22, kernelSize: q === 0 ? KernelSize.SMALL : KernelSize.MEDIUM, resolutionScale: 0.5 }));
    fx.push(new HueSaturationEffect({ saturation: 0.08 }));
    fx.push(new VignetteEffect({ darkness: 0.38, offset: 0.32 }));
    fx.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
  } else if (style === 1) {
    // B — painterly toon
    if (q === 2) ao(1.6, 0.9, 0x3a2440);
    if (q >= 1) smaa();
    if (q >= 1) fx.push(new InkEdgeEffect(0.55));
    if (q >= 1) fx.push(new BloomEffect({ intensity: 0.65, luminanceThreshold: 0.75, luminanceSmoothing: 0.25, mipmapBlur: true }));
    fx.push(new HueSaturationEffect({ saturation: 0.12 }));
    fx.push(new BrightnessContrastEffect({ brightness: 0.02, contrast: 0.08 }));
    fx.push(new VignetteEffect({ darkness: 0.45, offset: 0.3 }));
    fx.push(new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }));
  } else if (style === 2) {
    // C — realistic miniature
    if (q >= 1) ao(3.2, 1.2, 0x16100c);
    if (q >= 1) smaa();
    if (q === 2) {
      dof = new DepthOfFieldEffect(camera, { worldFocusDistance: 40, worldFocusRange: 18, bokehScale: 2.6, resolutionScale: 0.5 });
      dof.target = focus;
      fx.push(dof);
    }
    fx.push(new TiltShiftEffect({ offset: 0.06, rotation: 0, focusArea: q === 2 ? 0.72 : 0.55, feather: 0.3, kernelSize: q === 0 ? KernelSize.SMALL : KernelSize.LARGE, resolutionScale: 0.5 }));
    if (q >= 1) fx.push(new BloomEffect({ intensity: 0.32, luminanceThreshold: 0.9, luminanceSmoothing: 0.15, mipmapBlur: true }));
    fx.push(new BrightnessContrastEffect({ brightness: 0.0, contrast: 0.06 }));
    fx.push(new VignetteEffect({ darkness: 0.5, offset: 0.28 }));
    fx.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
  } else {
    // D — clean isometric: SMAA only
    if (q >= 1) fx.push(new SMAAEffect({ preset: q === 2 ? SMAAPreset.HIGH : SMAAPreset.MEDIUM }));
  }
  if (fx.length) composer.addPass(new EffectPass(camera, ...fx));
  else composer.addPass(new EffectPass(camera));

  return {
    composer,
    dof,
    dispose: () => composer.dispose(),
    setSize: (w, h) => composer.setSize(w, h),
  };
}
