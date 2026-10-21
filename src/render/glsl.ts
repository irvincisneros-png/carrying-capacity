// GLSL chunks injected into three's built-in toon material (style B "painterly toon").
// Ported from the style lab and generalised: the restoration / pollution state comes from a per-tile RGBA
// texture (uTile) that the renderer keeps in sync with the simulation grid:
//   r = vegetation vigour 0..1, g = soil contamination, b = water pollution, a = "actively restoring" pulse.

export const NOISE_GLSL = /* glsl */ `
float ccHash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float ccNoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  float a = ccHash(i), b = ccHash(i + vec2(1.0, 0.0)), c = ccHash(i + vec2(0.0, 1.0)), d = ccHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float ccFbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * ccNoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; } return s / 0.9375; }
float ccFbm3(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ s += a * ccNoise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; } return s / 0.875; }
`;

export const TILE_GLSL = /* glsl */ `
uniform sampler2D uTile;
uniform vec4 uMap; // w, h, 1/w, 1/h
uniform float uTime;
vec4 ccTile(vec2 xz){ return texture(uTile, clamp((xz + 0.5 * uMap.xy) * uMap.zw, 0.0, 1.0)); }
// Organic vegetation front: bilinear per-tile vigour perturbed by fbm.
float ccVeg(vec2 xz, float v){ return v + (ccFbm3(xz * 0.9) - 0.5) * 0.42; }
`;

export const VERT_PARS = /* glsl */ `
${NOISE_GLSL}
${TILE_GLSL}
varying vec3 vCcW;
varying vec3 vCcN;
varying float vCcG;
#ifdef CC_TERRAIN
attribute vec3 color2;
varying vec3 vCcC2;
#endif
#ifdef CC_SLAB
attribute float sdepth;
varying float vCcDepth;
#endif
#ifdef CC_SPH
attribute vec3 sphn;
uniform float uSph;
#endif
#ifdef CC_ANIM
attribute vec2 iAnim; // birth time, random seed
#endif
#ifdef CC_SMOKE
attribute vec4 iSmoke; // phase, speed, size, steam
uniform vec2 uWind;
varying float vCcSteam;
#endif
#ifdef CC_OUTLINE
attribute vec3 onrm;
uniform float uOutline;
#endif
float ccEaseBack(float t){ float c1 = 2.0; float c3 = c1 + 1.0; float u = t - 1.0; return 1.0 + c3 * u * u * u + c1 * u * u; }
`;

export const VERT_NORMAL = /* glsl */ `
#include <beginnormal_vertex>
#ifdef CC_SPH
objectNormal = normalize(mix(objectNormal, sphn, uSph));
#endif
`;

export const VERT_BEGIN = /* glsl */ `
#include <begin_vertex>
#if defined(USE_INSTANCING)
vec3 ccIP = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
#elif defined(USE_BATCHING)
vec3 ccIP = (modelMatrix * vec4(batchingMatrix[3].xyz, 1.0)).xyz;
#else
vec3 ccIP = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#endif
#ifdef CC_SWAY
float ccRnd = fract(sin(dot(ccIP.xz, vec2(12.9898, 78.233))) * 43758.5453);
#endif
float ccGrowV = 1.0;
#ifdef CC_ANIM
{
  float t = clamp((uTime - iAnim.x) / (0.9 + iAnim.y * 0.9), 0.0, 1.0);
  ccGrowV = t;
  transformed *= max(ccEaseBack(t), 0.0);
}
#endif
#ifdef CC_SWAY
{
  float hgt = max(transformed.y - CC_SWAY_Y0, 0.0);
  float ph = uTime * 1.3 + ccRnd * 6.2831 + ccIP.x * 0.35 + ccIP.z * 0.21;
  float gust = 0.6 + 0.4 * sin(uTime * 0.41 + ccIP.x * 0.12);
  float a = hgt * hgt * CC_SWAY_AMT * gust;
  transformed.x += sin(ph) * a;
  transformed.z += cos(ph * 0.83) * a * 0.6;
}
#endif
#ifdef CC_SMOKE
{
  float age = fract(uTime * iSmoke.y + iSmoke.x);
  float sz = (0.3 + age * 1.15) * (1.0 - smoothstep(0.7, 1.0, age) * 0.5) * smoothstep(0.0, 0.06, age) * iSmoke.z;
  transformed *= sz;
  vec2 drift = uWind * age * age * (0.9 + 0.4 * iSmoke.z);
  transformed += vec3(drift.x + sin(age * 7.0 + iSmoke.x * 30.0) * 0.08, age * (1.5 + 0.4 * iSmoke.z), drift.y + cos(age * 5.0 + iSmoke.x * 20.0) * 0.07);
  ccGrowV = age;
  vCcSteam = iSmoke.w;
}
#endif
#ifdef CC_OUTLINE
transformed += normalize(onrm) * uOutline;
#endif
`;

export const VERT_END = /* glsl */ `
#include <fog_vertex>
{
  vec4 ccWP = vec4(transformed, 1.0);
  vec3 ccNN = objectNormal;
#ifdef USE_INSTANCING
  ccWP = instanceMatrix * ccWP;
  ccNN = mat3(instanceMatrix) * ccNN;
#endif
#ifdef USE_BATCHING
  ccWP = batchingMatrix * ccWP;
  ccNN = mat3(batchingMatrix) * ccNN;
#endif
  ccWP = modelMatrix * ccWP;
  vCcW = ccWP.xyz;
  vCcN = normalize(mat3(modelMatrix) * ccNN);
  vCcG = ccGrowV;
#ifdef CC_TERRAIN
  vCcC2 = color2;
#endif
#ifdef CC_SLAB
  vCcDepth = sdepth;
#endif
}
`;

export const FRAG_PARS = /* glsl */ `
${NOISE_GLSL}
${TILE_GLSL}
varying vec3 vCcW;
varying vec3 vCcN;
varying float vCcG;
uniform float uHaze;
uniform vec3 uHazeCol;
uniform vec3 uFrontCol;
uniform float uFrontGlow;
uniform float uSat;
uniform vec3 uStrata[9];
uniform float uSlabTop;
#ifdef CC_TERRAIN
varying vec3 vCcC2;
uniform vec3 uPollA;
uniform vec3 uPollB;
uniform vec3 uPollC;
#endif
#ifdef CC_SLAB
varying float vCcDepth;
#endif
#ifdef CC_SMOKE
varying float vCcSteam;
#endif
#ifdef CC_BRUSH
uniform sampler2D uBrush;
uniform float uBrushAmt;
#endif
uniform vec3 uRimCol;
uniform float uRim;
#ifdef CC_GHOST
uniform vec3 uGhostCol;
#endif
vec3 ccStrata(vec3 p, float below, float surfY){
#ifdef CC_LITE
  // cheap strata (Very low / Low): one noise lookup, no wobble / deep-layer noise
  float w = sin(p.x * 0.33 + p.z * 0.27 + p.y * 0.9) * 0.14;
  float y = p.y + w;
  float b = y * 2.4;
  float ib = floor(b);
  float fb = fract(b);
  float r = ccHash(vec2(ib, 3.7));
  vec3 c = r < 0.38 ? uStrata[2] : (r < 0.66 ? uStrata[3] : (r < 0.84 ? uStrata[4] : uStrata[5]));
  float streak = ccNoise(vec2((p.x + p.z) * 3.0, y * 26.0));
  c *= 0.86 + 0.24 * streak;
  c *= 0.74 + 0.26 * smoothstep(0.0, 0.09, fb);
  c = mix(c, uStrata[6] * (0.8 + 0.4 * streak), 1.0 - smoothstep(0.1, 0.15, abs(y + 2.45)));
  c = mix(c, uStrata[7] * 0.9, smoothstep(-3.0, -3.5, y));
  if (below >= 0.0) {
    vec3 top = surfY > 0.02 ? uStrata[0] : uStrata[8];
    vec3 sub = surfY > 0.02 ? uStrata[1] : mix(uStrata[8], uStrata[2], 0.5);
    c = mix(c, sub * (0.9 + 0.2 * streak), 1.0 - smoothstep(0.4, 0.47, below));
    c = mix(c, top * (0.85 + 0.25 * streak), 1.0 - smoothstep(0.15, 0.2, below));
  }
  return c;
#else
  float w = (ccNoise(p.xz * 0.55 + vec2(p.y * 0.3)) - 0.5) * 0.3 + sin(p.x * 0.33 + p.z * 0.27) * 0.12;
  float y = p.y + w;
  float b = y * 2.4;
  float ib = floor(b);
  float fb = fract(b);
  float r = ccHash(vec2(ib, 3.7));
  vec3 c = r < 0.38 ? uStrata[2] : (r < 0.66 ? uStrata[3] : (r < 0.84 ? uStrata[4] : uStrata[5]));
  float streak = ccNoise(vec2((p.x + p.z) * 3.0, y * 26.0));
  c *= 0.86 + 0.24 * streak;
  c *= 0.74 + 0.26 * smoothstep(0.0, 0.09, fb);
  float coal = 1.0 - smoothstep(0.1, 0.15, abs(y + 2.45));
  c = mix(c, uStrata[6] * (0.8 + 0.4 * streak), coal);
  float deep = smoothstep(-3.0, -3.5, y);
  c = mix(c, uStrata[7] * (0.78 + 0.4 * ccNoise(p.xz * 2.0 + vec2(y * 3.0))), deep);
  if (below >= 0.0) {
    vec3 top = surfY > 0.02 ? uStrata[0] : uStrata[8];
    vec3 sub = surfY > 0.02 ? uStrata[1] : mix(uStrata[8], uStrata[2], 0.5);
    float wob = (ccNoise(p.xz * 3.0) - 0.5) * 0.08;
    c = mix(c, sub * (0.9 + 0.2 * streak), 1.0 - smoothstep(0.4, 0.47, below + wob));
    c = mix(c, top * (0.85 + 0.25 * streak), 1.0 - smoothstep(0.15, 0.2, below + wob));
  }
  return c;
#endif
}
`;

export const FRAG_COLOR = /* glsl */ `
#include <color_fragment>
vec4 ccT = ccTile(vCcW.xz);
#ifdef CC_TERRAIN
#ifdef CC_LITE
{
  // cheap ground (Very low / Low): one noise lookup per effect, strata only on steep faces, no sparkle / caustics
  float veg = ccT.r + (ccNoise(vCcW.xz * 0.9) - 0.5) * 0.42;
  float m = smoothstep(0.22, 0.62, veg);
  vec3 c = mix(vCcC2 * diffuse, diffuseColor.rgb, m);
  float n1 = ccNoise(vCcW.xz * 1.3 + 4.0);
  vec3 poll = mix(uPollA, uPollB, smoothstep(0.3, 0.7, n1));
  float soil = smoothstep(0.08, 0.7, ccT.g + (n1 - 0.5) * 0.25);
  c = mix(c, poll, soil * 0.85 * step(0.02, vCcW.y));
  float steep = smoothstep(0.42, 0.7, 1.0 - normalize(vCcN).y);
  if (steep > 0.01) c = mix(c, ccStrata(vCcW, -1.0, vCcW.y) * mix(0.85, 1.0, m), steep);
  float edge = 1.0 - smoothstep(0.0, 0.16, abs(veg - 0.42));
  c = mix(c, uFrontCol * 1.25, clamp(edge * ccT.a * uFrontGlow * (1.0 - steep), 0.0, 0.85) * step(0.0, vCcW.y));
  diffuseColor.rgb = c;
}
#else
{
  float veg = ccVeg(vCcW.xz, ccT.r);
  float m = smoothstep(0.22, 0.62, veg);
  vec3 lush = diffuseColor.rgb;
  vec3 bare = vCcC2 * diffuse;
  vec3 c = mix(bare, lush, m);
  // soil contamination: ochre / rust / slate stains with oily patches
  float n1 = ccFbm3(vCcW.xz * 1.3 + 4.0);
  vec3 poll = mix(uPollA, uPollB, smoothstep(0.35, 0.65, n1));
  poll = mix(poll, uPollC, smoothstep(0.62, 0.75, ccNoise(vCcW.xz * 2.7)) * 0.7);
  float soil = smoothstep(0.08, 0.7, ccT.g + (n1 - 0.5) * 0.25);
  c = mix(c, poll * (0.85 + 0.3 * ccNoise(vCcW.xz * 7.0)), soil * 0.85 * step(0.02, vCcW.y));
  float steep = smoothstep(0.42, 0.7, 1.0 - normalize(vCcN).y);
  c = mix(c, ccStrata(vCcW, -1.0, vCcW.y) * mix(0.85, 1.0, m), steep);
  // restoration shimmer: wattle-gold sparkles where vegetation is actively returning
  float edge = 1.0 - smoothstep(0.0, 0.16, abs(veg - 0.42));
  float sparkle = step(0.7, ccNoise(vCcW.xz * 9.0 + uTime * 0.7));
  c = mix(c, uFrontCol * (1.0 + sparkle * 0.7), clamp(edge * ccT.a * uFrontGlow * (1.0 - steep), 0.0, 0.85) * step(0.0, vCcW.y));
  // gentle caustics on submerged ground, stronger in clean water
  float under = smoothstep(0.0, -0.12, vCcW.y);
  vec2 q = vCcW.xz * 2.3;
  float k1 = ccNoise(q + vec2(uTime * 0.35, uTime * 0.21));
  float k2 = ccNoise(q * 1.3 - vec2(uTime * 0.27, -uTime * 0.3));
  float ca = pow(1.0 - abs(k1 - k2), 9.0);
  c += ca * 0.16 * under * (1.0 - smoothstep(0.1, 0.6, ccT.b)) * smoothstep(-1.6, -0.2, vCcW.y);
  diffuseColor.rgb = c;
}
#endif
#endif
#ifdef CC_SLAB
diffuseColor.rgb = ccStrata(vCcW, vCcDepth, vCcW.y + vCcDepth);
#endif
#ifdef CC_SMOKE
diffuseColor.rgb *= mix(0.7, 1.15, vCcG);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.95, 0.93), vCcSteam * 0.8);
diffuseColor.a *= (1.0 - smoothstep(0.3, 0.95, vCcG)) * smoothstep(0.0, 0.08, vCcG) * mix(1.0, 0.75, vCcSteam);
#endif
#if defined(CC_BRUSH) && !defined(CC_LITE)
{
  vec3 an = abs(normalize(vCcN));
  vec2 buv = an.y > max(an.x, an.z) ? vCcW.xz : (an.x > an.z ? vCcW.zy : vCcW.xy);
  vec3 br = texture(uBrush, buv * 0.42).rgb;
  diffuseColor.rgb *= mix(vec3(1.0), br * 2.0, uBrushAmt);
}
#endif
#ifndef CC_NOSMOG
{
  // era haze: global smog from CO2 + local soot near polluted ground
  float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  float h = clamp(uHaze * 0.32 + ccT.g * 0.12, 0.0, 0.5);
  diffuseColor.rgb = mix(diffuseColor.rgb, lum * uHazeCol * 1.7, h);
}
#endif
{
  float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = max(mix(vec3(lum), diffuseColor.rgb, uSat), 0.0);
}
#ifdef CC_GHOST
diffuseColor.rgb = mix(diffuseColor.rgb, uGhostCol, 0.55);
#endif
`;

export const FRAG_OPAQUE = /* glsl */ `
outgoingLight += uRimCol * uRim * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
#ifdef CC_GHOST
outgoingLight += uGhostCol * 0.25 * (0.6 + 0.4 * sin(uTime * 6.0));
#endif
#include <opaque_fragment>
`;
