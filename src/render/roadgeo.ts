// Autotiled road / rail pieces: a hub at the tile centre plus an "arm" from the centre to the +Z tile edge,
// rotated per connected neighbour. Dirt tracks before 1920, sealed roads after.
import { BoxGeometry, BufferGeometry, CylinderGeometry, PlaneGeometry } from 'three';
import { Parts, T } from './geo';

const ASPHALT = 0x5a5653;
const KERB = 0xc4bdb0;
const LINE = 0xece4c6;
const DIRT = 0x9d7d55;
const DIRT2 = 0x87683f;
const VERGE = 0x8e9a58;
const BALLAST = 0x8a8079;
const SLEEPER = 0x5a4232;
const RAIL = 0x9aa0a6;

const RW = 0.42; // carriageway width

/** Flat top-face quad (2 triangles) at height y: the Very low stand-in for a road / rail slab. */
function flat(w: number, d: number, x: number, y: number, z: number): BufferGeometry {
  return T(new PlaneGeometry(w, d), x, y, z, -Math.PI / 2, 0, 0);
}

export function roadHubGeo(cheap = false): BufferGeometry {
  const P = new Parts();
  if (cheap) {
    P.add(flat(RW + 0.1, RW + 0.1, 0, 0.017, 0), KERB);
    P.add(flat(RW, RW, 0, 0.021, 0), ASPHALT, { rough: 0.8 });
    return P.merge();
  }
  P.add(T(new BoxGeometry(RW + 0.1, 0.1, RW + 0.1), 0, -0.035, 0), KERB);
  P.add(T(new BoxGeometry(RW, 0.1, RW), 0, -0.03, 0), ASPHALT, { rough: 0.8 });
  return P.merge();
}

export function roadArmGeo(cheap = false): BufferGeometry {
  const P = new Parts();
  const L = 0.5 - RW / 2;
  const z0 = RW / 2 + L / 2;
  if (cheap) {
    P.add(flat(RW + 0.1, L + 0.02, 0, 0.017, z0), KERB);
    P.add(flat(RW, L + 0.02, 0, 0.021, z0), ASPHALT, { rough: 0.8 });
    return P.merge();
  }
  P.add(T(new BoxGeometry(RW + 0.1, 0.1, L + 0.02), 0, -0.035, z0), KERB);
  P.add(T(new BoxGeometry(RW, 0.1, L + 0.02), 0, -0.03, z0), ASPHALT, { rough: 0.8 });
  P.add(T(new BoxGeometry(0.025, 0.004, L * 0.55), 0, 0.022, z0), LINE);
  // streetlight on one kerb
  P.add(T(new CylinderGeometry(0.008, 0.01, 0.2, 5), RW / 2 + 0.03, 0.1, z0), 0x55595c);
  P.add(T(new BoxGeometry(0.06, 0.012, 0.02), RW / 2 + 0.005, 0.2, z0), 0x55595c);
  return P.merge();
}

export function dirtHubGeo(cheap = false): BufferGeometry {
  const P = new Parts();
  if (cheap) {
    P.add(flat(RW + 0.06, RW + 0.06, 0, 0.007, 0), VERGE);
    P.add(flat(RW - 0.02, RW - 0.02, 0, 0.011, 0), DIRT, { rough: 1 });
    return P.merge();
  }
  P.add(T(new BoxGeometry(RW + 0.06, 0.08, RW + 0.06), 0, -0.035, 0), VERGE);
  P.add(T(new BoxGeometry(RW - 0.02, 0.08, RW - 0.02), 0, -0.03, 0), DIRT, { rough: 1 });
  return P.merge();
}

export function dirtArmGeo(cheap = false): BufferGeometry {
  const P = new Parts();
  const L = 0.5 - RW / 2;
  const z0 = RW / 2 + L / 2;
  if (cheap) {
    P.add(flat(RW + 0.06, L + 0.02, 0, 0.007, z0), VERGE);
    P.add(flat(RW - 0.02, L + 0.02, 0, 0.011, z0), DIRT, { rough: 1 });
    return P.merge();
  }
  P.add(T(new BoxGeometry(RW + 0.06, 0.08, L + 0.02), 0, -0.035, z0), VERGE);
  P.add(T(new BoxGeometry(RW - 0.02, 0.08, L + 0.02), 0, -0.03, z0), DIRT, { rough: 1 });
  for (const x of [-0.1, 0.1]) P.add(T(new BoxGeometry(0.05, 0.004, L + 0.02), x, 0.012, z0), DIRT2);
  return P.merge();
}

export function railHubGeo(cheap = false): BufferGeometry {
  const P = new Parts();
  if (cheap) {
    P.add(flat(0.34, 0.34, 0, 0.021, 0), BALLAST, { rough: 1 });
    return P.merge();
  }
  P.add(T(new BoxGeometry(0.34, 0.1, 0.34), 0, -0.03, 0), BALLAST, { rough: 1 });
  return P.merge();
}

export function railArmGeo(cheap = false): BufferGeometry {
  const P = new Parts();
  const L = 0.5;
  if (cheap) {
    P.add(flat(0.3, L + 0.02, 0, 0.021, L / 2), BALLAST, { rough: 1 });
    for (const x of [-0.07, 0.07]) P.add(flat(0.02, L + 0.02, x, 0.023, L / 2), RAIL, { rough: 0.35 });
    return P.merge();
  }
  P.add(T(new BoxGeometry(0.3, 0.1, L + 0.02), 0, -0.03, L / 2), BALLAST, { rough: 1 });
  for (let i = 0; i < 4; i++) P.add(T(new BoxGeometry(0.26, 0.02, 0.05), 0, 0.03, 0.06 + i * 0.125), SLEEPER);
  for (const x of [-0.07, 0.07]) P.add(T(new BoxGeometry(0.018, 0.022, L + 0.02), x, 0.05, L / 2), RAIL, { rough: 0.35, metal: 0.6 });
  return P.merge();
}
