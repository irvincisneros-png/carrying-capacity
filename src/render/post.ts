// Post-processing per graphics tier (pmndrs postprocessing + N8AO), plus an era colour grade.
import {
  BlendFunction, BloomEffect, BrightnessContrastEffect, DepthOfFieldEffect, Effect, EffectComposer, EffectPass,
  HueSaturationEffect, KernelSize, RenderPass, SMAAEffect, SMAAPreset, TiltShiftEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { Color, HalfFloatType, NeutralToneMapping, NoToneMapping, Uniform, Vector3, type Camera, type Scene, type WebGLRenderer } from 'three';
import { TIERS, type Tier } from './quality';

/** Era grade: sepia smog for the industrial decades, crisp teal-gold for a restored world. */
export class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', /* glsl */ `
      uniform float uSmog;
      uniform float uClean;
      uniform vec3 uSmogTint;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        vec3 c = inputColor.rgb;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        vec3 sepia = l * uSmogTint * 1.25;
        c = mix(c, sepia, uSmog * 0.32);
        c *= 1.0 - uSmog * 0.06;
        // restored: a touch more saturation and a gentle lift in the shadows
        c = mix(vec3(l), c, 1.0 + uClean * 0.12);
        c += uClean * 0.015 * vec3(0.2, 0.5, 0.45) * (1.0 - l);
        outputColor = vec4(c, inputColor.a);
      }
    `, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uSmog', new Uniform(0)],
        ['uClean', new Uniform(0)],
        ['uSmogTint', new Uniform(new Color(0xd8b88a))],
      ]),
    });
  }
  set smog(v: number) { this.uniforms.get('uSmog')!.value = v; }
  set clean(v: number) { this.uniforms.get('uClean')!.value = v; }
}

export interface Pipeline {
  /** Null on tiers that render straight to the canvas (Very low). */
  composer: EffectComposer | null;
  render(dt: number): void;
  grade: GradeEffect;
  dof?: DepthOfFieldEffect;
  dispose(): void;
  setSize(w: number, h: number): void;
}

export function buildPipeline(renderer: WebGLRenderer, scene: Scene, camera: Camera, tier: Tier, focus: Vector3): Pipeline {
  const direct = TIERS[tier]!.direct;
  renderer.toneMapping = direct ? NeutralToneMapping : NoToneMapping;
  if (direct) {
    // Potato path: no composer, no half-float targets, no full-screen passes. The scene is drawn into the (reduced
    // resolution) canvas with three's own neutral tone mapper; the era grade lives in the materials' haze instead.
    return {
      composer: null,
      grade: new GradeEffect(),
      render: () => renderer.render(scene, camera),
      dispose: () => undefined,
      setSize: () => undefined,
    };
  }
  const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType, depthBuffer: true, stencilBuffer: false, multisampling: 0 });
  composer.addPass(new RenderPass(scene, camera));
  const W = renderer.domElement.width;
  const H = renderer.domElement.height;
  let dof: DepthOfFieldEffect | undefined;
  if (tier >= 3) {
    const p = new N8AOPostPass(scene, camera, W, H);
    p.configuration.aoRadius = 0.9;
    p.configuration.distanceFalloff = 0.6;
    p.configuration.intensity = 1.6;
    p.configuration.color = new Color(0x3a2440);
    p.configuration.halfRes = tier === 3;
    p.setQualityMode(tier === 4 ? 'Medium' : 'Performance');
    // transparency-aware AO re-renders the scene; our only transparent surface is water, so skip it
    p.configuration.transparencyAware = false;
    if (tier === 3) {
      p.configuration.depthAwareUpsampling = false;
      p.configuration.aoSamples = 6;
      p.configuration.denoiseIterations = 1;
    }
    composer.addPass(p);
  }
  if (tier >= 2) composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: tier >= 3 ? SMAAPreset.HIGH : SMAAPreset.MEDIUM })));
  const grade = new GradeEffect();
  const fx: Effect[] = [];
  if (tier === 4) {
    dof = new DepthOfFieldEffect(camera, { worldFocusDistance: 40, worldFocusRange: 26, bokehScale: 1.8, resolutionScale: 0.5 });
    dof.target = focus;
    fx.push(dof);
  }
  if (tier >= 2) {
    fx.push(new TiltShiftEffect({ offset: 0.04, rotation: 0, focusArea: 0.78, feather: 0.3, kernelSize: tier >= 3 ? KernelSize.MEDIUM : KernelSize.SMALL, resolutionScale: 0.5 }));
    fx.push(new BloomEffect({ intensity: 0.55, luminanceThreshold: 0.78, luminanceSmoothing: 0.25, mipmapBlur: true, levels: tier >= 3 ? 6 : 4 }));
  }
  fx.push(grade);
  fx.push(new HueSaturationEffect({ saturation: 0.1 }));
  fx.push(new BrightnessContrastEffect({ brightness: 0.02, contrast: 0.08 }));
  fx.push(new VignetteEffect({ darkness: 0.42, offset: 0.3 }));
  fx.push(new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }));
  composer.addPass(new EffectPass(camera, ...fx));
  return {
    composer,
    grade,
    dof,
    render: (dt) => composer.render(dt),
    dispose: () => composer.dispose(),
    setSize: (w, h) => composer.setSize(w, h),
  };
}
