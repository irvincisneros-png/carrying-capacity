// Moving-life models: tiny painterly figures (a few dozen triangles each), a bus, a horse cart, a cyclist, a tractor.
// All face +X with the origin at ground centre, like the parked car in ambient.ts.
import type { BufferGeometry } from 'three';
import { GLASS, Kit, MATTE, PAINT } from './ambient';

export type TrafficId = 'bus' | 'cart' | 'cyclist' | 'tractor' | 'person0' | 'person1' | 'person2' | 'person3';
export const PERSON_IDS: readonly TrafficId[] = ['person0', 'person1', 'person2', 'person3'];

const SHIRT = [0xc9573f, 0x3f6fa5, 0xe3c25a, 0x5f9a6b];
const PANTS = [0x3a4660, 0x5a4a3c, 0x2f3a4a, 0x6a5a4a];
const HAIR = [0x2b2018, 0x6b4a2a, 0xc9a45a, 0x1a1a1a];
const SKIN = [0xe2b48f, 0xb98260, 0x8a5a3c, 0xf0c8a4];
const TYRE = 0x1f1f22, DARK_GLASS = 0x26323c, TIMBER = 0x8a6a4a, TIMBER_L = 0xb08a5e;

function person(k: Kit, v: number): void {
  k.box(0, 0, -0.011, 0.014, 0.04, 0.015, PANTS[v]!, MATTE);
  k.box(0, 0, 0.011, 0.014, 0.04, 0.015, PANTS[v]!, MATTE);
  k.box(0, 0.04, 0, 0.024, 0.042, 0.04, SHIRT[v]!, PAINT);
  if (k.hi) {
    k.box(0, 0.045, -0.026, 0.012, 0.03, 0.01, SHIRT[v]!, PAINT);
    k.box(0, 0.045, 0.026, 0.012, 0.03, 0.01, SHIRT[v]!, PAINT);
  }
  k.sph(0.002, 0.1, 0, 0.0185, SKIN[v]!, 7, 1, 1, 1, MATTE);
  k.sph(-0.002, 0.105, 0, 0.02, HAIR[v]!, 7, 1, 0.8, 1, MATTE, true);
}

function cyclist(k: Kit): void {
  for (const x of [-0.05, 0.05]) k.cylZ(x, 0.022, 0, 0.022, 0.006, TYRE, 10, MATTE);
  k.beam([-0.05, 0.022, 0], [0, 0.05, 0], 0.005, 0.005, 0xc23b2e, PAINT);
  k.beam([0, 0.05, 0], [0.05, 0.022, 0], 0.005, 0.005, 0xc23b2e, PAINT);
  k.beam([-0.05, 0.022, 0], [0.04, 0.052, 0], 0.005, 0.005, 0xc23b2e, PAINT);
  k.rbox(0.0, 0.075, 0, 0.022, 0.044, 0.034, 0x3f6fa5, 0, 0, -0.35, PAINT);
  k.beam([-0.006, 0.054, 0], [0.012, 0.024, 0], 0.01, 0.01, PANTS[0]!, MATTE);
  k.sph(0.018, 0.108, 0, 0.0175, SKIN[0]!, 7, 1, 1, 1, MATTE);
  k.sph(0.016, 0.113, 0, 0.0195, 0xe8e2d0, 7, 1, 0.8, 1, MATTE, true);
}

function bus(k: Kit): void {
  const wr = 0.026;
  k.box(0, 0.014, 0, 0.4, 0.075, 0.11, 0x3d7a4e, PAINT);
  k.box(0, 0.089, 0, 0.39, 0.012, 0.108, 0xe8e2d0, PAINT);
  k.box(0, 0.05, 0, 0.36, 0.028, 0.112, DARK_GLASS, GLASS);
  k.box(0.2, 0.05, 0, 0.004, 0.034, 0.1, DARK_GLASS, GLASS);
  for (const x of [-0.12, 0.12]) for (const z of [-0.05, 0.05]) k.cylZ(x, wr, z, wr, 0.02, TYRE, 8, MATTE);
  if (k.hi) {
    for (const z of [-0.035, 0.035]) k.box(0.201, 0.03, z, 0.004, 0.012, 0.018, 0xfff3c2, GLASS);
    k.box(0, 0.101, 0, 0.1, 0.008, 0.07, 0xd8d4c4, MATTE);
  }
}

function cart(k: Kit): void {
  // a horse (front, +x) pulling a small timber cart
  k.box(-0.07, 0.03, 0, 0.16, 0.012, 0.09, TIMBER, MATTE);
  k.box(-0.07, 0.042, -0.045, 0.16, 0.03, 0.008, TIMBER_L, MATTE);
  k.box(-0.07, 0.042, 0.045, 0.16, 0.03, 0.008, TIMBER_L, MATTE);
  for (const z of [-0.052, 0.052]) k.cylZ(-0.07, 0.026, z, 0.026, 0.008, TIMBER, 8, MATTE);
  k.box(0.07, 0.036, 0, 0.1, 0.05, 0.04, 0x8a6a4a, MATTE);
  k.rbox(0.13, 0.082, 0, 0.04, 0.034, 0.03, 0x8a6a4a, 0, 0, -0.6, MATTE);
  k.box(0.15, 0.09, 0, 0.034, 0.022, 0.026, 0x7a5a3c, MATTE);
  for (const x of [0.04, 0.1]) for (const z of [-0.012, 0.012]) k.box(x, 0, z, 0.01, 0.036, 0.01, 0x5a4230, MATTE);
  k.beam([0.0, 0.036, -0.02], [-0.04, 0.034, -0.045], 0.005, 0.005, TIMBER, MATTE);
  k.beam([0.0, 0.036, 0.02], [-0.04, 0.034, 0.045], 0.005, 0.005, TIMBER, MATTE);
}

function tractor(k: Kit): void {
  k.box(0.01, 0.04, 0, 0.12, 0.05, 0.06, 0x3d7a4e, PAINT);
  k.box(-0.04, 0.09, 0, 0.05, 0.05, 0.05, 0x2f5f40, PAINT);
  k.box(-0.04, 0.14, 0, 0.056, 0.006, 0.056, 0xe8e2d0, PAINT);
  k.box(-0.015, 0.094, 0, 0.004, 0.036, 0.046, DARK_GLASS, GLASS);
  for (const z of [-0.042, 0.042]) k.cylZ(-0.04, 0.035, z, 0.035, 0.022, TYRE, 9, MATTE);
  for (const z of [-0.036, 0.036]) k.cylZ(0.06, 0.022, z, 0.022, 0.016, TYRE, 8, MATTE);
  k.cylX(0.07, 0.085, 0, 0.007, 0.02, 0x333333, 6, MATTE);
}

export function buildTraffic(id: TrafficId, detail: 0 | 1): BufferGeometry {
  const k = new Kit(detail);
  switch (id) {
    case 'bus': bus(k); break;
    case 'cart': cart(k); break;
    case 'cyclist': cyclist(k); break;
    case 'tractor': tractor(k); break;
    default: person(k, Number(id.slice(6)) | 0);
  }
  return k.merge();
}
