// Smoke / steam plumes: instanced puffs animated entirely in the vertex shader (no per-frame CPU work).
// Puff count per stack follows its emissions; the tier scales density (Ultra adds wispy extra puffs).
import { Color, InstancedBufferAttribute, InstancedMesh, Matrix4, type Group } from 'three';
import type { Emitter } from './buildings';
import type { MatLib } from './materials';
import { tint } from './geo';
import { puffGeo } from './vegassets';
import { mulberry32 } from './noise';

const _m = new Matrix4();

export class Smoke {
  mesh: InstancedMesh;
  private attr: InstancedBufferAttribute;
  private cap: number;
  density = 1;

  constructor(lib: MatLib, group: Group, cap = 1600) {
    this.cap = cap;
    const geo = puffGeo(0.13, 5, 0.85);
    tint(geo, (_x, _y, _z, c) => c.multiply(new Color(0xa69b8c)));
    this.attr = new InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    geo.setAttribute('iSmoke', this.attr);
    const spec = { key: 'smoke', kind: 'smoke' as const, noSmog: true, transparent: true };
    this.mesh = new InstancedMesh(geo, lib.get(spec), cap);
    this.mesh.customDepthMaterial = lib.depth(spec);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.renderOrder = 3;
    this.mesh.name = 'smoke';
    group.add(this.mesh);
  }

  rebuild(emitters: readonly Emitter[]): void {
    const rnd = mulberry32(17);
    const a = this.attr.array as Float32Array;
    let n = 0;
    for (let e = 0; e < emitters.length; e++) {
      const em = emitters[e]!;
      const puffs = Math.round((4 + 7 * Math.min(1.4, em.strength)) * this.density * (0.6 + 0.4 * Math.min(1.5, em.size)));
      for (let i = 0; i < puffs && n < this.cap; i++) {
        _m.makeTranslation(em.x, em.y, em.z);
        this.mesh.setMatrixAt(n, _m);
        a[n * 4] = i / puffs + rnd() * 0.03 + e * 0.13;
        a[n * 4 + 1] = 0.075 + rnd() * 0.03;
        a[n * 4 + 2] = Math.min(1.15, Math.max(0.4, em.size * (0.5 + 0.35 * Math.min(1.4, em.strength))));
        a[n * 4 + 3] = em.steam;
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.attr.needsUpdate = true;
  }
}
