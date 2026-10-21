// Animated toon water surface, water cut-away wall and painted sky backdrop.
import { BackSide, Color, DoubleSide, PlaneGeometry, ShaderMaterial, SphereGeometry, Vector3, type IUniform, type Texture } from 'three';
import { NOISE_GLSL, TILE_GLSL } from './glsl';
import { LOOK } from './palette';
import type { MapGeo } from './mapgeo';

const SKY_FN = /* glsl */ `
uniform vec3 uSkyTop; uniform vec3 uSkyHorizon; uniform vec3 uSkyBottom; uniform vec3 uCloudCol;
uniform float uCloud; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uSunGlow;
uniform float uCamY;
#ifdef CC_LITE
// cheap sky (Very low / Low): a plain gradient, no cloud noise, no sun disc
vec3 skyColor(vec3 d, float time){
  float y = d.y;
  vec3 col = y >= 0.0 ? mix(uSkyHorizon, uSkyTop, pow(smoothstep(0.0, 0.75, y), 0.65)) : mix(uSkyHorizon, uSkyBottom, 1.0 - exp(y * 7.0));
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  return col + uSunCol * pow(sd, 12.0) * 0.25 * uSunGlow;
}
#else
vec3 skyColor(vec3 d, float time){
  float y = d.y;
  vec3 col;
  if (y >= 0.0) {
    col = mix(uSkyHorizon, uSkyTop, pow(smoothstep(0.0, 0.75, y), 0.65));
    vec2 cp = d.xz / (y + 0.12) * 1.3 + vec2(time * 0.01, 0.0);
    float c = ccFbm(cp);
    col = mix(col, uCloudCol, smoothstep(0.52, 0.78, c) * uCloud * smoothstep(0.0, 0.25, y) * 0.9);
  } else {
    // sea of clouds far below the floating slab
    float t = (-60.0 - uCamY) / min(y, -0.001);
    vec2 p = d.xz * t;
    float c1 = ccFbm(p * 0.012 + vec2(time * 0.004, 0.0));
    float c2 = ccFbm(p * 0.03 - vec2(0.0, time * 0.006));
    float puff = smoothstep(0.5, 0.62, c1 * 0.75 + c2 * 0.35);
    col = mix(uSkyBottom, uCloudCol * (0.85 + 0.25 * smoothstep(0.4, 0.8, c2)), puff);
    col = mix(col, uSkyHorizon, exp(-abs(y) * 7.0));
  }
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunCol * (pow(sd, 400.0) * 3.0 + pow(sd, 12.0) * 0.25) * uSunGlow;
  return col;
}
#endif
`;

export function skyUniforms(): Record<string, IUniform> {
  return {
    uSkyTop: { value: new Color(LOOK.sky.top) }, uSkyHorizon: { value: new Color(LOOK.sky.horizon) },
    uSkyBottom: { value: new Color(LOOK.sky.bottom) }, uCloudCol: { value: new Color(LOOK.sky.cloudCol) },
    uCloud: { value: LOOK.sky.cloud },
    uSunDir: { value: new Vector3(...LOOK.sun.dir).normalize() }, uSunCol: { value: new Color(LOOK.sun.color) },
    uSunGlow: { value: LOOK.sky.sunGlow },
    uCamY: { value: 20 },
  };
}

export function makeSky(skyU: Record<string, IUniform>, shared: Record<string, IUniform>, radius = 500): { geo: SphereGeometry; mat: ShaderMaterial } {
  const geo = new SphereGeometry(radius, 32, 16);
  const mat = new ShaderMaterial({
    uniforms: { ...shared, ...skyU },
    side: BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.99999; }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vDir;
      ${NOISE_GLSL}
      ${SKY_FN}
      void main(){ gl_FragColor = vec4(skyColor(normalize(vDir), uTime), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return { geo, mat };
}

export function waterUniforms(heightTex: Texture, map: MapGeo): Record<string, IUniform> {
  const W = LOOK.water;
  return {
    uHeightTex: { value: heightTex },
    uHMap: { value: new Vector3(map.w, map.h, 0) },
    uHSeg: { value: new Vector3(map.segX, map.segZ, 0) },
    uShallowR: { value: new Color(W.shallowR) }, uDeepR: { value: new Color(W.deepR) },
    uShallowP: { value: new Color(W.shallowP) }, uDeepP: { value: new Color(W.deepP) },
    uFoam: { value: W.foam }, uSpec: { value: W.spec }, uShine: { value: W.shine }, uRefl: { value: W.refl },
    uAmp: { value: W.amp }, uClarity: { value: W.clarity }, uLevel: { value: 0 },
  };
}

const WATER_COMMON = /* glsl */ `
uniform sampler2D uHeightTex;
uniform vec3 uHMap; uniform vec3 uHSeg;
uniform vec3 uShallowR; uniform vec3 uDeepR; uniform vec3 uShallowP; uniform vec3 uDeepP;
uniform float uFoam; uniform float uSpec; uniform float uShine; uniform float uRefl; uniform float uAmp; uniform float uClarity; uniform float uLevel;
float groundAt(vec2 xz){ vec2 uv = ((xz + 0.5 * uHMap.xy) / uHMap.xy * uHSeg.xy + 0.5) / (uHSeg.xy + 1.0); return texture(uHeightTex, uv).r * 3.0 - 2.0; }
float wav(vec2 p, float t){
  return sin(p.x * 1.7 + t * 1.3) * 0.5 + sin(p.y * 2.3 - t * 1.1 + p.x * 0.6) * 0.35 + sin((p.x + p.y) * 3.7 + t * 2.0) * 0.15;
}
// clean (1) vs polluted (0) water from the per-tile pollution channel
float cleanAt(vec2 xz){ float b = ccTile(xz).b + (ccFbm3(xz * 0.7) - 0.5) * 0.18; return 1.0 - smoothstep(0.12, 0.65, b); }
`;

export function makeWater(shared: Record<string, IUniform>, wu: Record<string, IUniform>, skyU: Record<string, IUniform>, map: MapGeo): { geo: PlaneGeometry; mat: ShaderMaterial } {
  const geo = new PlaneGeometry(map.w + 0.18, map.h + 0.18, Math.min(64, map.w * (map.res <= 2 ? 1 : 2)), Math.min(64, map.h * (map.res <= 2 ? 1 : 2)));
  geo.rotateX(-Math.PI / 2);
  const hx = (map.w / 2).toFixed(2);
  const hz = (map.h / 2).toFixed(2);
  const mat = new ShaderMaterial({
    uniforms: { ...shared, ...wu, ...skyU },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      ${NOISE_GLSL}
      ${TILE_GLSL}
      ${WATER_COMMON}
      varying vec3 vW;
      void main(){
        vec3 p = position;
        float edge = smoothstep(0.09, -0.4, max(abs(p.x) - ${hx}, abs(p.z) - ${hz}));
        p.y += wav(p.xz, uTime) * uAmp * edge;
        vec4 w = modelMatrix * vec4(p, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE_GLSL}
      ${TILE_GLSL}
      ${WATER_COMMON}
      ${SKY_FN}
      varying vec3 vW;
      void main(){
        vec2 xz = vW.xz;
        float ground = groundAt(xz);
        float depth = max(vW.y - ground, 0.0);
        if (ground > uLevel + 0.06) discard;
#ifdef CC_LITE
        // cheap water (Very low / Low): tint by depth and cleanliness, a soft sheen, a shoreline foam line.
        // No ripple normals, no sky reflection, no foam bands, no scum / sheen noise.
        float m = 1.0 - smoothstep(0.12, 0.65, ccTile(xz).b);
        float t = uTime;
        float absorb = mix(3.4, 1.55, m) / max(0.3, uClarity);
        float tt = 1.0 - exp(-depth * absorb);
        vec3 base = mix(mix(uShallowP, uShallowR, m), mix(uDeepP, uDeepR, m), tt);
        float alpha = mix(mix(0.8, 0.36, m), 0.96, tt);
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - max(V.y, 0.0), 5.0);
        vec3 col = base * 0.94 + uSkyHorizon * fres * 0.5 * uRefl * mix(0.25, 1.0, m);
        float fn = ccNoise(xz * 6.0 + vec2(t * 0.35, -t * 0.2));
        float shore = 1.0 - smoothstep(0.0, 0.08, depth);
        float foam = step(0.45, shore * smoothstep(0.25, 0.55, fn + shore * 0.45));
        col = mix(col, mix(vec3(0.62, 0.56, 0.44), vec3(1.0), m) * uFoam, foam * mix(0.6, 1.0, m));
        alpha = max(alpha, foam * mix(0.6, 1.0, m));
        gl_FragColor = vec4(col, alpha);
#else
        float m = cleanAt(xz);
        float t = uTime;
        float e = 0.06;
        float r0 = ccNoise(xz * 1.6 + vec2(t * 0.4, t * 0.25)) + ccNoise(xz * 3.1 - vec2(t * 0.3, -t * 0.4)) * 0.5;
        float rx = ccNoise((xz + vec2(e, 0.0)) * 1.6 + vec2(t * 0.4, t * 0.25)) + ccNoise((xz + vec2(e, 0.0)) * 3.1 - vec2(t * 0.3, -t * 0.4)) * 0.5;
        float rz = ccNoise((xz + vec2(0.0, e)) * 1.6 + vec2(t * 0.4, t * 0.25)) + ccNoise((xz + vec2(0.0, e)) * 3.1 - vec2(t * 0.3, -t * 0.4)) * 0.5;
        float wa = uAmp * 3.0 + 0.02;
        vec3 n = normalize(vec3((r0 - rx) * wa * 2.0, e, (r0 - rz) * wa * 2.0));
        if (n.y < 0.0) n = -n;
        vec3 V = normalize(cameraPosition - vW);
        float absorb = mix(3.4, 1.55, m) / max(0.3, uClarity);
        float tt = 1.0 - exp(-depth * absorb);
        vec3 base = mix(mix(uShallowP, uShallowR, m), mix(uDeepP, uDeepR, m), tt);
        float alpha = mix(mix(0.8, 0.36, m), 0.96, tt);
        float ndl = max(dot(n, normalize(uSunDir)), 0.0);
        vec3 col = base * (0.8 + 0.28 * ndl);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 refl = skyColor(reflect(-V, n), t);
        col = mix(col, refl, clamp(fres * uRefl * 1.6, 0.0, 0.7) * mix(0.25, 1.0, m));
        vec3 H = normalize(normalize(uSunDir) + V);
        float spec = pow(max(dot(n, H), 0.0), uShine) * uSpec;
        spec = smoothstep(0.17, 0.2, spec) * 0.35;
        col += uSunCol * spec * mix(0.1, 1.0, m);
        alpha = max(alpha, clamp(spec, 0.0, 1.0));
        float fn = ccNoise(xz * 7.0 + vec2(t * 0.35, -t * 0.2));
        float shore = 1.0 - smoothstep(0.0, 0.08, depth);
        float bandPhase = depth * 26.0 - t * 2.0 + ccNoise(xz * 1.7) * 5.0;
        float bands = smoothstep(0.9, 0.99, sin(bandPhase)) * (1.0 - smoothstep(0.04, 0.18, depth)) * smoothstep(0.3, 0.6, ccNoise(xz * 0.7 + t * 0.05));
        float foam = clamp(shore * smoothstep(0.25, 0.55, fn + shore * 0.45) + bands * 0.8 * smoothstep(0.35, 0.65, fn), 0.0, 1.0);
        foam = step(0.45, foam);
        float rim = smoothstep(-0.14, 0.06, max(abs(xz.x) - ${hx}, abs(xz.y) - ${hz})) * smoothstep(0.3, 0.7, fn + 0.2);
        foam = max(foam, rim * 0.8);
        vec3 foamCol = mix(vec3(0.62, 0.56, 0.44), vec3(1.0), m) * uFoam;
        col = mix(col, foamCol, foam * mix(0.6, 1.0, m));
        alpha = max(alpha, foam * mix(0.6, 1.0, m));
        // polluted water: brown murk + oily sheen; algal scum patches when very polluted
        float sheen = (1.0 - m) * smoothstep(0.6, 0.85, ccFbm3(xz * 0.6 + t * 0.03));
        col += sheen * 0.06 * vec3(0.5 + 0.5 * sin(xz.x * 0.8 + xz.y * 0.5 + vec3(0.0, 2.0, 4.0)));
        float scum = smoothstep(0.75, 1.0, 1.0 - m) * smoothstep(0.55, 0.7, ccFbm3(xz * 1.4 - t * 0.02));
        col = mix(col, vec3(0.42, 0.46, 0.22), scum * 0.6);
        // restoration shimmer on water that is cleaning up
        vec4 td = ccTile(xz);
        float sp = step(0.75, ccNoise(xz * 8.0 + t * 0.6));
        col = mix(col, vec3(0.8, 1.0, 0.9), td.a * 0.25 * sp);
        gl_FragColor = vec4(col, alpha);
#endif
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return { geo, mat };
}

export function makeWaterSideMat(shared: Record<string, IUniform>, wu: Record<string, IUniform>): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...shared, ...wu },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE_GLSL}
      ${TILE_GLSL}
      ${WATER_COMMON}
      varying vec3 vW;
      void main(){
        float m = cleanAt(vW.xz);
        float d = clamp(-vW.y / 1.6, 0.0, 1.0);
        vec3 top = mix(uShallowP, uShallowR, m);
        vec3 deep = mix(uDeepP, uDeepR, m) * 0.7;
        vec3 col = mix(top * 1.05, deep, pow(d, 0.7));
#ifndef CC_LITE
        float ca = ccNoise(vW.xz * 2.0 + vec2(vW.y * 3.0 + uTime * 0.3));
        col += m * 0.12 * pow(ca, 6.0) * (1.0 - d);
#endif
        float line = smoothstep(-0.05, -0.005, vW.y);
        col = mix(col, vec3(0.95, 1.0, 1.0) * mix(0.7, 1.0, m), line * 0.8);
        float a = mix(mix(0.9, 0.55, m), 0.92, d);
        gl_FragColor = vec4(col, max(a, line));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
