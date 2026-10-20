// Style B "painterly toon" constants (sRGB hex). Tuned from the style lab, with the art-direction changes:
// calmer water sparkle (-60%), more depth tint, visible reef.

export const LOOK = {
  sat: 1.2,
  sph: 0.85,
  brush: 0.3,
  rim: 0.42,
  rimCol: 0xffd7a0,
  frontCol: 0xf4c43a,
  ink: 0x3a2a22,
  hazeCol: 0xb8976a,
  pollA: 0xa8854f, // ochre
  pollB: 0x8f5a36, // rust
  pollC: 0x6f6862, // slate
  sun: { color: 0xffd8a4, intensity: 2.7, dir: [-0.62, 0.58, -0.38] as [number, number, number] },
  hemi: { sky: 0xa9c4ff, ground: 0x7a5872, intensity: 1.35 },
  shadowRadius: 2,
  shadowStrength: 0.62,
  sky: { top: 0x6ea3df, horizon: 0xffd9b4, bottom: 0x8fb4de, cloud: 0.85, cloudCol: 0xfff3e2, sunGlow: 0.6 },
  /** Smoggy end of the sky grade (1950s-2020 industrial haze). */
  skySmog: { top: 0x8f9cab, horizon: 0xe2c49a, bottom: 0xa7a395, cloudCol: 0xe8dcc6 },
  water: {
    shallowR: 0x6fe3d0, deepR: 0x1689b0, shallowP: 0x7a6a46, deepP: 0x4a3d2a,
    foam: 1.05, spec: 0.2, shine: 140, refl: 0.16, amp: 0.018, clarity: 0.95,
  },
  strata: [0x553a28, 0xb4633a, 0xf0d29c, 0xe0964f, 0xb8573a, 0x948577, 0x2b2522, 0x6a5650, 0xeedaa6],
} as const;

/** Terrain base colours: lush (restored / healthy) and bare (degraded) per tile kind. */
export const GROUND = {
  grass: 0x7d9a52, grass2: 0x678a44, bushFloor: 0x5f7a3e, bushFloor2: 0x6e7f45, dryGold: 0xb9a45a,
  sand: 0xead6a4, sandWet: 0xd9c08a, dune: 0xc9c58a, sandstone: 0xd9c28e, sandstone2: 0xc99a62,
  bare: 0xa88f5a, bare2: 0x9a7d50, dirt: 0x8f6c46,
  seaSand: 0xdccf9f, deepBed: 0x8fa894, reefBed: 0xd6c08a, estMud: 0x9d8a62, estMud2: 0x7f7350, riverBed: 0xa59670,
} as const;
