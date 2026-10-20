// GLSL snippets shared by all lab materials (injected into three's built-in shaders).

export const NOISE_GLSL = /* glsl */ `
float labHash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float labNoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  float a = labHash(i), b = labHash(i + vec2(1.0, 0.0)), c = labHash(i + vec2(0.0, 1.0)), d = labHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float labFbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * labNoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; } return s / 0.9375; }
float labFbm3(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ s += a * labNoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; } return s / 0.875; }
`;

export const HEALTH_GLSL = /* glsl */ `
uniform sampler2D uHealth;
uniform float uTime;
float labHealthRaw(vec2 xz){ return texture(uHealth, clamp((xz + 12.0) / 24.0, 0.0, 1.0)).r; }
// Organic restoration front: bilinear per-tile health perturbed by fbm.
float labFront(vec2 xz){ return labHealthRaw(xz) + (labFbm3(xz * 0.85) - 0.5) * 0.62; }
float labMaskF(float f){ return smoothstep(0.44, 0.56, f); }
`;

export const VERT_PARS = /* glsl */ `
${NOISE_GLSL}
${HEALTH_GLSL}
varying vec3 vLabW;
varying vec3 vLabN;
varying float vLabG;
#ifdef LAB_TERRAIN
attribute vec3 color2;
varying vec3 vLabC2;
#endif
#ifdef LAB_SLAB
attribute float sdepth;
varying float vLabDepth;
#endif
#ifdef LAB_SURF
attribute vec2 surf;
varying vec2 vLabSurf;
#endif
#ifdef LAB_SPH
attribute vec3 sphn;
uniform float uSph;
#endif
#ifdef LAB_SMOKE
attribute vec2 smoke;
#endif
float labEaseBack(float t){ float c1 = 2.2; float c3 = c1 + 1.0; float u = t - 1.0; return 1.0 + c3 * u * u * u + c1 * u * u; }
`;

export const VERT_NORMAL = /* glsl */ `
#include <beginnormal_vertex>
#ifdef LAB_SPH
objectNormal = normalize(mix(objectNormal, sphn, uSph));
#endif
`;

export const VERT_BEGIN = /* glsl */ `
#include <begin_vertex>
#ifdef USE_INSTANCING
vec3 labIP = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
#else
vec3 labIP = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#endif
float labRnd = fract(sin(dot(labIP.xz, vec2(12.9898, 78.233))) * 43758.5453);
float labGrowV = 1.0;
#ifdef LAB_GROW
{
  float f = labFront(labIP.xz);
  float g = clamp((f - 0.43 - labRnd * 0.24) / 0.14, 0.0, 1.0);
  labGrowV = g;
  transformed *= max(labEaseBack(g), 0.0);
}
#endif
#ifdef LAB_SWAY
{
  float hgt = max(transformed.y - LAB_SWAY_Y0, 0.0);
  float ph = uTime * 1.3 + labRnd * 6.2831 + labIP.x * 0.35 + labIP.z * 0.21;
  float gust = 0.6 + 0.4 * sin(uTime * 0.41 + labIP.x * 0.12);
  float a = hgt * hgt * LAB_SWAY_AMT * gust;
  transformed.x += sin(ph) * a;
  transformed.z += cos(ph * 0.83) * a * 0.6;
}
#endif
#ifdef LAB_SMOKE
{
  float age = fract(uTime * smoke.y + smoke.x);
  float poll = 1.0 - 0.92 * labMaskF(labFront(labIP.xz));
  float sz = (0.3 + age * 1.35) * (1.0 - smoothstep(0.72, 1.0, age)) * smoothstep(0.0, 0.05, age) * poll;
  transformed *= sz;
  transformed += vec3(age * 1.7 + sin(age * 7.0 + smoke.x * 30.0) * 0.12, age * 2.4 * (0.6 + 0.4 * poll), -age * 0.8 + cos(age * 5.0 + smoke.x * 20.0) * 0.1);
  labGrowV = age;
}
#endif
`;

export const VERT_END = /* glsl */ `
#include <fog_vertex>
{
  vec4 labWP = vec4(transformed, 1.0);
  vec3 labNN = objectNormal;
#ifdef USE_INSTANCING
  labWP = instanceMatrix * labWP;
  labNN = mat3(instanceMatrix) * labNN;
#endif
  labWP = modelMatrix * labWP;
  vLabW = labWP.xyz;
  vLabN = normalize(mat3(modelMatrix) * labNN);
  vLabG = labGrowV;
#ifdef LAB_TERRAIN
  vLabC2 = color2;
#endif
#ifdef LAB_SLAB
  vLabDepth = sdepth;
#endif
#ifdef LAB_SURF
  vLabSurf = surf;
#endif
}
`;

export const FRAG_PARS = /* glsl */ `
${NOISE_GLSL}
${HEALTH_GLSL}
varying vec3 vLabW;
varying vec3 vLabN;
varying float vLabG;
uniform float uSmog;
uniform vec3 uSmogCol;
uniform vec3 uFrontCol;
uniform float uFrontGlow;
uniform float uSat;
uniform vec3 uStrata[9];
#ifdef LAB_TERRAIN
varying vec3 vLabC2;
#endif
#ifdef LAB_SLAB
varying float vLabDepth;
#endif
#ifdef LAB_SURF
varying vec2 vLabSurf;
#endif
#ifdef LAB_BRUSH
uniform sampler2D uBrush;
uniform float uBrushAmt;
#endif
#ifdef LAB_RIM
uniform vec3 uRimCol;
uniform float uRim;
#endif
#ifdef LAB_BUMP
uniform float uBump;
#endif
#ifdef LAB_STD
uniform float uRoughVar;
#endif
vec3 labStrata(vec3 p, float below, float surfY){
  float w = (labNoise(p.xz * 0.55 + vec2(p.y * 0.3)) - 0.5) * 0.3 + sin(p.x * 0.33 + p.z * 0.27) * 0.12;
  float y = p.y + w;
  float b = y * 2.4;
  float ib = floor(b);
  float fb = fract(b);
  float r = labHash(vec2(ib, 3.7));
  vec3 c = r < 0.38 ? uStrata[2] : (r < 0.66 ? uStrata[3] : (r < 0.84 ? uStrata[4] : uStrata[5]));
  float streak = labNoise(vec2((p.x + p.z) * 3.0, y * 26.0));
  c *= 0.86 + 0.24 * streak;
  c *= 0.74 + 0.26 * smoothstep(0.0, 0.09, fb);
  float coal = 1.0 - smoothstep(0.1, 0.15, abs(y + 2.45));
  c = mix(c, uStrata[6] * (0.8 + 0.4 * streak), coal);
  float deep = smoothstep(-3.0, -3.5, y);
  c = mix(c, uStrata[7] * (0.78 + 0.4 * labNoise(p.xz * 2.0 + vec2(y * 3.0))), deep);
  if (below >= 0.0) {
    vec3 top = surfY > 0.02 ? uStrata[0] : uStrata[8];
    vec3 sub = surfY > 0.02 ? uStrata[1] : mix(uStrata[8], uStrata[2], 0.5);
    float wob = (labNoise(p.xz * 3.0) - 0.5) * 0.08;
    c = mix(c, sub * (0.9 + 0.2 * streak), 1.0 - smoothstep(0.4, 0.47, below + wob));
    c = mix(c, top * (0.85 + 0.25 * streak), 1.0 - smoothstep(0.15, 0.2, below + wob));
  }
  return c;
}
`;

export const FRAG_COLOR = /* glsl */ `
#include <color_fragment>
float labF = labFront(vLabW.xz);
float labM = labMaskF(labF);
#ifdef LAB_TERRAIN
{
  vec3 restored = diffuseColor.rgb;
  vec3 polluted = vLabC2 * diffuse;
  vec3 c = mix(polluted, restored, labM);
  float steep = smoothstep(0.4, 0.68, 1.0 - normalize(vLabN).y);
  c = mix(c, labStrata(vLabW, -1.0, vLabW.y) * mix(0.8, 1.0, labM), steep);
  float edge = 1.0 - smoothstep(0.0, 0.075, abs(labF - 0.5));
  float sparkle = step(0.72, labNoise(vLabW.xz * 9.0 + uTime * 0.6));
  c = mix(c, uFrontCol * (1.0 + sparkle * 0.6), edge * uFrontGlow * (1.0 - steep) * step(0.0, vLabW.y));
#ifdef LAB_CAUSTIC
  float under = smoothstep(0.0, -0.12, vLabW.y);
  vec2 q = vLabW.xz * 2.3;
  float n1 = labNoise(q + vec2(uTime * 0.35, uTime * 0.21));
  float n2 = labNoise(q * 1.3 - vec2(uTime * 0.27, -uTime * 0.3));
  float ca = pow(1.0 - abs(n1 - n2), 9.0);
  c += ca * 0.45 * under * labM * smoothstep(-1.5, -0.2, vLabW.y);
#endif
  diffuseColor.rgb = c;
}
#endif
#ifdef LAB_SLAB
diffuseColor.rgb = labStrata(vLabW, vLabDepth, vLabW.y + vLabDepth) * mix(0.82, 1.0, labM);
#endif
#ifdef LAB_CORAL
diffuseColor.rgb = mix(vec3(0.82, 0.8, 0.74), diffuseColor.rgb, labM);
#endif
#ifdef LAB_SMOKE
diffuseColor.rgb *= mix(0.5, 1.2, vLabG);
#endif
#ifdef LAB_BRUSH
{
  vec3 an = abs(normalize(vLabN));
  vec2 buv = an.y > max(an.x, an.z) ? vLabW.xz : (an.x > an.z ? vLabW.zy : vLabW.xy);
  vec3 br = texture(uBrush, buv * 0.42).rgb;
  diffuseColor.rgb *= mix(vec3(1.0), br * 2.0, uBrushAmt);
}
#endif
#ifndef LAB_NOSMOG
{
  float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(diffuseColor.rgb, lum * uSmogCol * 1.7, (1.0 - labM) * uSmog);
}
#endif
{
  float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = max(mix(vec3(lum), diffuseColor.rgb, uSat), 0.0);
#ifdef LAB_GRADE_D
  diffuseColor.rgb *= 0.84 + 0.26 * smoothstep(-1.5, 3.0, vLabW.y);
#endif
}
`;

export const FRAG_ROUGH = /* glsl */ `
#include <metalnessmap_fragment>
#ifdef LAB_SURF
roughnessFactor = clamp(vLabSurf.x + (labNoise(vLabW.xz * 7.0 + vLabW.y * 4.0) - 0.5) * uRoughVar, 0.04, 1.0);
metalnessFactor = vLabSurf.y;
#else
roughnessFactor = clamp(roughnessFactor + (labNoise(vLabW.xz * 5.0 + vLabW.y * 3.0) - 0.5) * uRoughVar, 0.04, 1.0);
#endif
#ifdef LAB_TERRAIN
roughnessFactor *= mix(0.35, 1.0, smoothstep(0.02, 0.3, vLabW.y));
#endif
`;

export const FRAG_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
#ifdef LAB_BUMP
{
  float hgt = (labNoise(vLabW.xz * 9.0 + vec2(vLabW.y * 3.0)) * 0.6 + labNoise(vLabW.xz * 23.0 - vec2(vLabW.y * 5.0, 0.0)) * 0.4) * uBump;
  vec3 dpdx = dFdx(-vViewPosition);
  vec3 dpdy = dFdy(-vViewPosition);
  float dhx = dFdx(hgt);
  float dhy = dFdy(hgt);
  vec3 r1 = cross(dpdy, normal);
  vec3 r2 = cross(normal, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  normal = normalize(abs(det) * normal - grad);
}
#endif
`;

export const FRAG_OPAQUE = /* glsl */ `
#ifdef LAB_RIM
outgoingLight += uRimCol * uRim * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
#endif
#include <opaque_fragment>
`;
