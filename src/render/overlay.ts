// Map data overlays (satellite layers, wildlife habitat): a per-tile value texture painted over the terrain
// with a colour ramp, drawn on a copy of the terrain surface lifted slightly (and clamped to water level).
import { ClampToEdgeWrapping, DataTexture, LinearFilter, Mesh, NearestFilter, RedFormat, ShaderMaterial, UnsignedByteType, type BufferGeometry, type IUniform } from 'three';

export type Ramp = 'heat' | 'forest' | 'flood' | 'fire' | 'habitat' | 'attention' | 'zones';
const RAMP_ID: Record<Ramp, number> = { heat: 0, forest: 1, flood: 2, fire: 3, habitat: 4, attention: 5, zones: 6 };

/**
 * Zone overlay codes (the value of a tile is code * 16 / 255): 1 homes, 2 shops and offices, 3 light industry (soft washes of green,
 * blue and ochre), 4 to 6 the same but hatched, for zoned tiles that cannot grow yet.
 */
export const ZONE_OVERLAY_SCALE = 16 / 255;

export class Overlay {
  mesh: Mesh;
  private tex: DataTexture;
  private data: Uint8Array;
  private mat: ShaderMaterial;

  constructor(terrainGeo: BufferGeometry, private w: number, private h: number, shared: Record<string, IUniform>, nearest = false) {
    this.data = new Uint8Array(w * h);
    this.tex = new DataTexture(this.data, w, h, RedFormat, UnsignedByteType);
    this.tex.magFilter = nearest ? NearestFilter : LinearFilter;
    this.tex.minFilter = nearest ? NearestFilter : LinearFilter;
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
          float a;
          if (uRamp > 5.5) {
            // Zones: a soft painted wash (green homes, blue shops, ochre industry); a diagonal hatch where nothing can grow yet.
            float code = floor(v * 255.0 / 16.0 + 0.5);
            float hatched = code > 3.5 ? 1.0 : 0.0;
            float fam = code - 3.0 * hatched;
            c = fam < 1.5 ? vec3(0.42, 0.74, 0.38) : (fam < 2.5 ? vec3(0.36, 0.58, 0.86) : vec3(0.88, 0.66, 0.28));
            float wash = 0.62 + 0.1 * sin(vW.x * 3.1 + vW.z * 2.3) * sin(vW.z * 2.7 - vW.x * 1.9);
            float band = smoothstep(0.36, 0.5, abs(fract((vW.x + vW.z) * 2.5) - 0.5));
            a = (hatched > 0.5 ? mix(0.2, 0.62, band) : wash) * uAlpha;
            // a soft darker edge on every zoned tile, so a painted patch reads as a patch
            vec2 f = abs(fract(vW.xz + 0.5 * uMap.xy) - 0.5);
            float e = smoothstep(0.4, 0.5, max(f.x, f.y));
            c = mix(c, c * 0.62, e * 0.7 + hatched * band * 0.25);
            a = mix(a, min(1.0, a + 0.22 * uAlpha), e);
          } else {
          if (uRamp < 0.5) c = mix(mix(vec3(0.2,0.45,0.9), vec3(1.0,0.85,0.2), smoothstep(0.0,0.5,v)), vec3(0.9,0.15,0.1), smoothstep(0.5,1.0,v));
          else if (uRamp < 1.5) c = mix(vec3(0.85,0.7,0.35), vec3(0.1,0.6,0.25), v);
          else if (uRamp < 2.5) c = vec3(0.15,0.35,0.95);
          else if (uRamp < 3.5) c = mix(vec3(1.0,0.85,0.3), vec3(0.85,0.15,0.05), v);
          else if (uRamp < 4.5) c = vec3(0.2,0.9,0.75);
          else c = vec3(1.0,0.62,0.08);
          float stripe = 0.85 + 0.15 * step(0.5, fract((vW.x + vW.z) * 2.0));
          a = (uRamp > 1.5 && uRamp < 2.5 ? v : 0.45 + 0.4 * v) * stripe * uAlpha;
          if (uRamp > 3.5) a = (uRamp > 4.5 ? 0.35 + 0.35 * v : 0.45) * uAlpha * (0.75 + 0.25 * sin(uTime * 4.0));
          }
          gl_FragColor = vec4(c, a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
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

/** Subtle tile grid draped on the land, shown only while a build tool is active. */
export function makeGrid(terrainGeo: BufferGeometry, shared: Record<string, IUniform>): Mesh {
  const mat = new ShaderMaterial({
    uniforms: { uMap: shared.uMap!, uAlpha: { value: 0.13 } },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main(){ vec3 p = position; p.y += 0.012; vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
    `,
    fragmentShader: /* glsl */ `
      uniform vec4 uMap; uniform float uAlpha;
      varying vec3 vW;
      void main(){
        if (vW.y < 0.02) discard;
        vec2 t = vW.xz + 0.5 * uMap.xy;
        vec2 f = abs(fract(t) - 0.5);
        vec2 fw = fwidth(t) * 1.2;
        float l = max(smoothstep(0.5 - fw.x * 1.5, 0.5, f.x), smoothstep(0.5 - fw.y * 1.5, 0.5, f.y));
        if (l < 0.01) discard;
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.88), l * uAlpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
      }
    `,
  });
  const m = new Mesh(terrainGeo, mat);
  m.renderOrder = 5;
  m.visible = false;
  m.name = 'grid';
  return m;
}
