// Soft painted cloud cards floating around and below the slab (camera-facing instanced quads, one draw call).
import {
  CanvasTexture, Color, InstancedBufferAttribute, InstancedBufferGeometry, LinearFilter, Mesh, PlaneGeometry,
  ShaderMaterial, SRGBColorSpace, type IUniform,
} from 'three';
import { mulberry32 } from './noise';

function cloudTexture(): CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S / 2;
  const g = c.getContext('2d')!;
  const rnd = mulberry32(42);
  // several stacked soft blobs, lit from the top-left, flat-ish bottom
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < 26; i++) {
      const x = S * (0.18 + rnd() * 0.64);
      const base = S / 2 * 0.72;
      const r = S * (0.06 + rnd() * 0.12) * (1 - Math.abs(x / S - 0.5) * 1.1);
      const y = base - r * (0.5 + rnd() * 0.6);
      const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
      if (pass === 0) {
        gr.addColorStop(0, 'rgba(222,214,224,0.9)');
        gr.addColorStop(1, 'rgba(222,214,224,0)');
      } else {
        gr.addColorStop(0, 'rgba(255,255,255,0.95)');
        gr.addColorStop(0.6, 'rgba(255,250,244,0.55)');
        gr.addColorStop(1, 'rgba(255,250,244,0)');
      }
      g.fillStyle = gr;
      g.beginPath();
      g.arc(pass === 0 ? x + r * 0.15 : x, pass === 0 ? y + r * 0.2 : y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  return t;
}

export function makeClouds(shared: Record<string, IUniform>, mapSize: number): { mesh: Mesh; uniforms: Record<string, IUniform> } {
  const base = new PlaneGeometry(1, 0.5);
  const geo = new InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.setAttribute('uv', base.getAttribute('uv'));
  const rnd = mulberry32(9);
  const N = 30;
  const off = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rnd() * 0.25;
    const ring = i % 3;
    const r = mapSize * (0.95 + ring * 0.55 + rnd() * 0.35);
    off[i * 4] = Math.cos(a) * r;
    off[i * 4 + 1] = ring === 0 ? -7 - rnd() * 4 : -4 + rnd() * 10 - ring * 3;
    off[i * 4 + 2] = Math.sin(a) * r;
    off[i * 4 + 3] = mapSize * (0.45 + rnd() * 0.45) * (ring === 2 ? 1.6 : 1);
  }
  geo.setAttribute('iCloud', new InstancedBufferAttribute(off, 4));
  geo.instanceCount = N;
  const uniforms: Record<string, IUniform> = {
    uCloudTex: { value: cloudTexture() },
    uTint: { value: new Color(0xfff3e2) },
    uShade: { value: new Color(0xb8b0c8) },
  };
  const mat = new ShaderMaterial({
    uniforms: { ...shared, ...uniforms },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec4 iCloud;
      uniform float uTime;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec3 c = iCloud.xyz;
        c.x += sin(uTime * 0.03 + iCloud.z * 0.1) * 1.5;
        vec4 mv = viewMatrix * vec4(c, 1.0);
        mv.xy += position.xy * iCloud.w;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uCloudTex;
      uniform vec3 uTint;
      uniform vec3 uShade;
      varying vec2 vUv;
      void main(){
        vec4 t = texture2D(uCloudTex, vUv);
        vec3 col = mix(uShade, uTint, smoothstep(0.75, 0.98, max(t.r, t.b)));
        gl_FragColor = vec4(col, t.a * 0.92);
        if (gl_FragColor.a < 0.01) discard;
      }
    `,
  });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -5;
  mesh.name = 'clouds';
  return { mesh, uniforms };
}
