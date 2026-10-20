// Map data overlays (satellite layers, wildlife habitat): a per-tile value texture painted over the terrain
// with a colour ramp, drawn on a copy of the terrain surface lifted slightly (and clamped to water level).
import { ClampToEdgeWrapping, DataTexture, LinearFilter, Mesh, RedFormat, ShaderMaterial, UnsignedByteType, type BufferGeometry, type IUniform } from 'three';

export type Ramp = 'heat' | 'forest' | 'flood' | 'fire' | 'habitat';
const RAMP_ID: Record<Ramp, number> = { heat: 0, forest: 1, flood: 2, fire: 3, habitat: 4 };

export class Overlay {
  mesh: Mesh;
  private tex: DataTexture;
  private data: Uint8Array;
  private mat: ShaderMaterial;

  constructor(terrainGeo: BufferGeometry, private w: number, private h: number, shared: Record<string, IUniform>) {
    this.data = new Uint8Array(w * h);
    this.tex = new DataTexture(this.data, w, h, RedFormat, UnsignedByteType);
    this.tex.magFilter = LinearFilter;
    this.tex.minFilter = LinearFilter;
    this.tex.wrapS = this.tex.wrapT = ClampToEdgeWrapping;
    this.tex.needsUpdate = true;
    this.mat = new ShaderMaterial({
      uniforms: { uOv: { value: this.tex }, uRamp: { value: 0 }, uMap: shared.uMap!, uTime: shared.uTime!, uAlpha: { value: 0 } },
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main(){ vec3 p = position; p.y = max(p.y, 0.0) + 0.03; vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uOv; uniform float uRamp; uniform vec4 uMap; uniform float uTime; uniform float uAlpha;
        varying vec3 vW;
        void main(){
          float v = texture2D(uOv, clamp((vW.xz + 0.5 * uMap.xy) * uMap.zw, 0.0, 1.0)).r;
          if (v < 0.02) discard;
          vec3 c;
          if (uRamp < 0.5) c = mix(mix(vec3(0.2,0.45,0.9), vec3(1.0,0.85,0.2), smoothstep(0.0,0.5,v)), vec3(0.9,0.15,0.1), smoothstep(0.5,1.0,v));
          else if (uRamp < 1.5) c = mix(vec3(0.85,0.7,0.35), vec3(0.1,0.6,0.25), v);
          else if (uRamp < 2.5) c = vec3(0.15,0.35,0.95);
          else if (uRamp < 3.5) c = mix(vec3(1.0,0.85,0.3), vec3(0.85,0.15,0.05), v);
          else c = vec3(0.2,0.9,0.75);
          float stripe = 0.85 + 0.15 * step(0.5, fract((vW.x + vW.z) * 2.0));
          float a = (uRamp > 1.5 && uRamp < 2.5 ? v : 0.45 + 0.4 * v) * stripe * uAlpha;
          if (uRamp > 3.5) a = 0.45 * uAlpha * (0.8 + 0.2 * sin(uTime * 3.0));
          gl_FragColor = vec4(c, a);
        }
      `,
    });
    this.mesh = new Mesh(terrainGeo, this.mat);
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
    this.mesh.name = 'overlay';
  }

  set(values: ArrayLike<number> | null, ramp: Ramp = 'heat'): void {
    if (!values) {
      this.mesh.visible = false;
      return;
    }
    const n = Math.min(values.length, this.w * this.h);
    for (let i = 0; i < n; i++) this.data[i] = Math.max(0, Math.min(255, Math.round((values[i] ?? 0) * 255)));
    this.tex.needsUpdate = true;
    this.mat.uniforms.uRamp!.value = RAMP_ID[ramp];
    this.mesh.visible = true;
  }

  update(dt: number): void {
    const u = this.mat.uniforms.uAlpha!;
    u.value = this.mesh.visible ? Math.min(1, u.value + dt * 3) : 0;
  }
}
