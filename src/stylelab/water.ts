// Animated water surface + water cut-away wall + sky backdrop shaders.
import { BackSide, Color, DoubleSide, PlaneGeometry, ShaderMaterial, SphereGeometry, Vector3, type IUniform, type Texture } from 'three';
import { HEALTH_GLSL, NOISE_GLSL } from './glsl';
import { SEG, VERTS } from './world';
import type { StyleDef } from './styles';

const SKY_FN = /* glsl */ `
uniform vec3 uSkyTop; uniform vec3 uSkyHorizon; uniform vec3 uSkyBottom; uniform vec3 uCloudCol; uniform vec3 uLandCol;
uniform float uSkyMode; uniform float uCloud; uniform float uIslands; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uSunGlow;
uniform float uCamY;
vec3 skyColor(vec3 d, float time){
  float y = d.y;
  vec3 col;
  if (uSkyMode > 1.5) {
    // flat stylised gradient
    col = y > 0.0 ? mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.7, y)) : mix(uSkyHorizon, uSkyBottom, smoothstep(0.0, -0.6, y));
    return col;
  }
  if (y >= 0.0) {
    col = mix(uSkyHorizon, uSkyTop, pow(smoothstep(0.0, 0.75, y), 0.65));
    vec2 cp = d.xz / (y + 0.12) * 1.3 + vec2(time * 0.01, 0.0);
    float c = labFbm(cp);
    col = mix(col, uCloudCol, smoothstep(0.52, 0.78, c) * uCloud * smoothstep(0.0, 0.25, y) * 0.9);
  } else {
    float t = (-60.0 - uCamY) / min(y, -0.001);
    vec2 p = d.xz * t;
    if (uSkyMode < 0.5) {
      // distant ocean far below with a hazy coastline
      float w = labFbm(p * 0.03 + vec2(time * 0.02, 0.0));
      col = uSkyBottom * (0.85 + 0.3 * w);
      float lf = labFbm(p * 0.0025 + vec2(3.0, 1.0)); float far = smoothstep(140.0, 260.0, length(p)); float land = smoothstep(0.7, 0.72, lf) * far * uIslands;
      vec3 lc = mix(uLandCol, uLandCol * 1.25 + vec3(0.08, 0.06, 0.0), labNoise(p * 0.02));
      float beach = smoothstep(0.69, 0.7, lf) - land;
      col = mix(col, vec3(0.9, 0.85, 0.7), clamp(beach, 0.0, 1.0) * uIslands * far * 0.6);
      col = mix(col, lc, land);
    } else {
      // sea of clouds
      float c1 = labFbm(p * 0.012 + vec2(time * 0.004, 0.0));
      float c2 = labFbm(p * 0.03 - vec2(0.0, time * 0.006));
      float puff = smoothstep(0.5, 0.62, c1 * 0.75 + c2 * 0.35);
      col = mix(uSkyBottom, uCloudCol * (0.85 + 0.25 * smoothstep(0.4, 0.8, c2)), puff);
    }
    col = mix(col, uSkyHorizon, exp(-abs(y) * 7.0));
  }
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunCol * (pow(sd, 400.0) * 3.0 + pow(sd, 12.0) * 0.25) * uSunGlow;
  return col;
}
`;

export function skyUniforms(): Record<string, IUniform> {
  return {
    uSkyTop: { value: new Color() }, uSkyHorizon: { value: new Color() }, uSkyBottom: { value: new Color() },
    uCloudCol: { value: new Color() }, uLandCol: { value: new Color() },
    uSkyMode: { value: 0 }, uCloud: { value: 0 }, uIslands: { value: 0 },
    uSunDir: { value: new Vector3(0, 1, 0) }, uSunCol: { value: new Color(1, 1, 1) }, uSunGlow: { value: 0 },
    uCamY: { value: 20 },
  };
}

export function applySkyStyle(u: Record<string, IUniform>, s: StyleDef, sunDir: Vector3): void {
  (u.uSkyTop.value as Color).set(s.sky.top);
  (u.uSkyHorizon.value as Color).set(s.sky.horizon);
  (u.uSkyBottom.value as Color).set(s.sky.bottom);
  (u.uCloudCol.value as Color).set(s.sky.cloudCol);
  (u.uLandCol.value as Color).set(s.sky.land);
  u.uSkyMode.value = s.sky.mode;
  u.uCloud.value = s.sky.cloud;
  u.uIslands.value = s.sky.islands;
  (u.uSunDir.value as Vector3).copy(sunDir);
  (u.uSunCol.value as Color).set(s.sun.color);
  u.uSunGlow.value = s.sky.sunGlow;
}

export function makeSky(skyU: Record<string, IUniform>, shared: Record<string, IUniform>, radius = 500): { geo: SphereGeometry; mat: ShaderMaterial } {
  const geo = new SphereGeometry(radius, 48, 24);
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
      void main(){ gl_FragColor = vec4(skyColor(normalize(vDir), uTime), 1.0); }
    `,
  });
  return { geo, mat };
}

export function waterUniforms(heightTex: Texture): Record<string, IUniform> {
  return {
    uHeightTex: { value: heightTex },
    uLook: { value: 0 },
    uShallowR: { value: new Color() }, uDeepR: { value: new Color() }, uShallowP: { value: new Color() }, uDeepP: { value: new Color() },
    uFoam: { value: 1 }, uSpec: { value: 1 }, uShine: { value: 60 }, uRefl: { value: 0.3 }, uAmp: { value: 0.03 }, uClarity: { value: 1 },
  };
}

export function applyWaterStyle(u: Record<string, IUniform>, s: StyleDef): void {
  u.uLook.value = s.water.look;
  (u.uShallowR.value as Color).set(s.water.shallowR);
  (u.uDeepR.value as Color).set(s.water.deepR);
  (u.uShallowP.value as Color).set(s.water.shallowP);
  (u.uDeepP.value as Color).set(s.water.deepP);
  u.uFoam.value = s.water.foam;
  u.uSpec.value = s.water.spec;
  u.uShine.value = s.water.shine;
  u.uRefl.value = s.water.refl;
  u.uAmp.value = s.water.amp;
  u.uClarity.value = s.water.clarity;
}

const WATER_COMMON = /* glsl */ `
uniform sampler2D uHeightTex;
uniform float uLook; uniform vec3 uShallowR; uniform vec3 uDeepR; uniform vec3 uShallowP; uniform vec3 uDeepP;
uniform float uFoam; uniform float uSpec; uniform float uShine; uniform float uRefl; uniform float uAmp; uniform float uClarity;
float groundAt(vec2 xz){ vec2 uv = ((xz + 12.0) / 24.0 * ${SEG.toFixed(1)} + 0.5) / ${VERTS.toFixed(1)}; return texture(uHeightTex, uv).r * 3.0 - 2.0; }
float wav(vec2 p, float t){
  return sin(p.x * 1.7 + t * 1.3) * 0.5 + sin(p.y * 2.3 - t * 1.1 + p.x * 0.6) * 0.35 + sin((p.x + p.y) * 3.7 + t * 2.0) * 0.15;
}
`;

export function makeWater(shared: Record<string, IUniform>, wu: Record<string, IUniform>, skyU: Record<string, IUniform>): { geo: PlaneGeometry; mat: ShaderMaterial } {
  const geo = new PlaneGeometry(24 + 0.18, 24 + 0.18, 96, 96);
  geo.rotateX(-Math.PI / 2);
  const mat = new ShaderMaterial({
    uniforms: { ...shared, ...wu, ...skyU },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime;
      ${WATER_COMMON}
      varying vec3 vW;
      void main(){
        vec3 p = position;
        float edge = smoothstep(12.09, 11.6, max(abs(p.x), abs(p.z)));
        p.y += wav(p.xz, uTime) * uAmp * edge;
        vec4 w = modelMatrix * vec4(p, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      ${NOISE_GLSL}
      ${HEALTH_GLSL}
      ${WATER_COMMON}
      ${SKY_FN}
      varying vec3 vW;
      void main(){
        vec2 xz = vW.xz;
        float ground = groundAt(xz);
        float depth = max(vW.y - ground, 0.0);
        if (ground > 0.06) discard;
        float f = labFront(xz);
        float m = labMaskF(f);
        float t = uTime;
        // normals: analytic waves + noise ripples
        float e = 0.06;
        float r0 = labNoise(xz * 1.6 + vec2(t * 0.4, t * 0.25)) + labNoise(xz * 3.1 - vec2(t * 0.3, -t * 0.4)) * 0.5;
        float rx = labNoise((xz + vec2(e, 0.0)) * 1.6 + vec2(t * 0.4, t * 0.25)) + labNoise((xz + vec2(e, 0.0)) * 3.1 - vec2(t * 0.3, -t * 0.4)) * 0.5;
        float rz = labNoise((xz + vec2(0.0, e)) * 1.6 + vec2(t * 0.4, t * 0.25)) + labNoise((xz + vec2(0.0, e)) * 3.1 - vec2(t * 0.3, -t * 0.4)) * 0.5;
        float wa = uAmp * 3.0 + 0.02;
        vec3 n = normalize(vec3((r0 - rx) * wa * 2.0, e, (r0 - rz) * wa * 2.0));
        if (uLook < 0.5) n = normalize(mix(normalize(cross(dFdx(vW), dFdy(vW))), n, 0.5));
        if (n.y < 0.0) n = -n;
        vec3 V = normalize(cameraPosition - vW);
        float clar = mix(0.25, uClarity, m);
        float absorb = mix(3.2, 1.9, m);
        float tt = 1.0 - exp(-depth * absorb);
        vec3 base = mix(mix(uShallowP, uShallowR, m), mix(uDeepP, uDeepR, m), tt);
        float alpha = mix(mix(0.72, 0.42, m), 0.97, tt);
        float ndl = max(dot(n, normalize(uSunDir)), 0.0);
        vec3 col = base * (0.78 + 0.3 * ndl);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 refl = skyColor(reflect(-V, n) * vec3(1.0, 1.0, 1.0), t);
        col = mix(col, refl, clamp(fres * uRefl * 1.6, 0.0, 0.85) * mix(0.25, 1.0, m));
        vec3 H = normalize(normalize(uSunDir) + V);
        float spec = pow(max(dot(n, H), 0.0), uShine) * uSpec;
        if (uLook > 0.5 && uLook < 1.5) spec = smoothstep(0.6, 0.7, spec) * 0.8 * uSpec;
        col += uSunCol * spec * mix(0.12, 1.0, m);
        alpha = max(alpha, clamp(spec, 0.0, 1.0));
        // shore foam + incoming wave bands
        float fn = labNoise(xz * 7.0 + vec2(t * 0.35, -t * 0.2));
        float shore = 1.0 - smoothstep(0.0, 0.09, depth);
        float bandPhase = depth * 26.0 - t * 2.2 + labNoise(xz * 1.7) * 5.0;
        float bands = smoothstep(0.9, 0.99, sin(bandPhase)) * (1.0 - smoothstep(0.04, 0.2, depth)) * smoothstep(0.3, 0.6, labNoise(xz * 0.7 + t * 0.05));
        float foam = clamp(shore * smoothstep(0.25, 0.55, fn + shore * 0.45) + bands * 0.85 * smoothstep(0.35, 0.65, fn), 0.0, 1.0);
        if (uLook > 0.5) foam = step(0.45, foam);
        // wall-edge surf where the sea meets the slab rim
        float rim = smoothstep(11.86, 12.06, max(abs(xz.x), abs(xz.y))) * smoothstep(0.3, 0.7, fn + 0.2);
        foam = max(foam, rim * 0.8);
        vec3 foamCol = mix(vec3(0.5, 0.45, 0.36), vec3(1.0), m) * uFoam;
        col = mix(col, foamCol, foam * mix(0.55, 1.0, m));
        alpha = max(alpha, foam * mix(0.55, 1.0, m));
        // polluted water: oily sheen
        float sheen = (1.0 - m) * smoothstep(0.6, 0.85, labFbm3(xz * 0.6 + t * 0.03));
        col += sheen * 0.05 * vec3(0.5 + 0.5 * sin(xz.x * 0.8 + xz.y * 0.5 + vec3(0.0, 2.0, 4.0)));
        // restoration front shimmer on water
        float edgeF = 1.0 - smoothstep(0.0, 0.08, abs(f - 0.5));
        col = mix(col, vec3(0.75, 1.0, 0.9), edgeF * 0.25);
        if (uLook > 2.5) { col = mix(base, foamCol, foam); alpha = mix(alpha, 1.0, 0.25); }
        gl_FragColor = vec4(col, alpha);
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
      ${HEALTH_GLSL}
      ${WATER_COMMON}
      varying vec3 vW;
      void main(){
        float m = labMaskF(labFront(vW.xz));
        float d = clamp(-vW.y / 1.6, 0.0, 1.0);
        vec3 top = mix(uShallowP, uShallowR, m);
        vec3 deep = mix(uDeepP, uDeepR, m) * 0.7;
        vec3 col = mix(top * 1.05, deep, pow(d, 0.7));
        float ca = labNoise(vW.xz * 2.0 + vec2(vW.y * 3.0 + uTime * 0.3)) ;
        col += m * 0.12 * pow(ca, 6.0) * (1.0 - d);
        float line = smoothstep(-0.05, -0.005, vW.y);
        col = mix(col, vec3(0.95, 1.0, 1.0) * mix(0.7, 1.0, m), line * 0.8);
        float a = mix(mix(0.9, 0.55, m), 0.92, d);
        gl_FragColor = vec4(col, max(a, line));
      }
    `,
  });
}
