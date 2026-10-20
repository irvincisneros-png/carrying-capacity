// Per-style art direction parameters. Colours are sRGB hex.

export type StyleId = 0 | 1 | 2 | 3;
export type MaterialBase = 'standard-flat' | 'toon' | 'standard' | 'lambert';

export interface StyleDef {
  id: StyleId;
  key: 'A' | 'B' | 'C' | 'D';
  name: string;
  base: MaterialBase;
  sat: number;
  smog: number;
  smogCol: number;
  frontGlow: number;
  frontCol: number;
  sph: number;
  brush: number;
  rim: number;
  rimCol: number;
  bump: number;
  roughVar: number;
  caustic: boolean;
  sun: { color: number; intensity: number; dir: [number, number, number] };
  hemi: { sky: number; ground: number; intensity: number };
  envIntensity: number;
  shadowRadius: number;
  shadowStrength: number;
  sky: { mode: 0 | 1 | 2; top: number; horizon: number; bottom: number; cloud: number; cloudCol: number; sunGlow: number; islands: number; land: number };
  water: {
    look: 0 | 1 | 2 | 3;
    shallowR: number; deepR: number; shallowP: number; deepP: number;
    foam: number; spec: number; shine: number; refl: number; amp: number; clarity: number;
  };
  clouds3d: boolean;
  cloudCol: number;
  ortho: boolean;
  fov: number;
  strata: number[];
}

const STRATA = [0x4a3426, 0xa65a33, 0xe3c793, 0xcf8a4c, 0xa9533a, 0x8a8073, 0x231f1d, 0x5f5048, 0xdfcc9c];

export const STYLES: StyleDef[] = [
  {
    id: 0, key: 'A', name: 'Low-poly diorama', base: 'standard-flat',
    sat: 1.1, smog: 0.26, smogCol: 0xb59a6e, frontGlow: 0.55, frontCol: 0xf2c230,
    sph: 0, brush: 0, rim: 0, rimCol: 0xffffff, bump: 0, roughVar: 0.1, caustic: true,
    sun: { color: 0xfff0d2, intensity: 3.1, dir: [-0.55, 0.78, -0.3] },
    hemi: { sky: 0xc4ddf2, ground: 0x8a6a48, intensity: 1.15 },
    envIntensity: 0, shadowRadius: 4, shadowStrength: 0.8,
    sky: { mode: 0, top: 0x5c9fdb, horizon: 0xd6e9f2, bottom: 0x2c7cab, cloud: 0.45, cloudCol: 0xffffff, sunGlow: 0.35, islands: 1, land: 0x7f9a62 },
    water: { look: 0, shallowR: 0x67e3cf, deepR: 0x168db0, shallowP: 0x6e6142, deepP: 0x3f3626, foam: 1.0, spec: 0.35, shine: 90, refl: 0.35, amp: 0.03, clarity: 1.0 },
    clouds3d: true, cloudCol: 0xffffff, ortho: false, fov: 30,
    strata: STRATA,
  },
  {
    id: 1, key: 'B', name: 'Painterly toon', base: 'toon',
    sat: 1.2, smog: 0.24, smogCol: 0xb8976a, frontGlow: 0.7, frontCol: 0xf4c43a,
    sph: 0.85, brush: 0.34, rim: 0.42, rimCol: 0xffd7a0, bump: 0, roughVar: 0, caustic: true,
    sun: { color: 0xffd8a4, intensity: 2.7, dir: [-0.62, 0.58, -0.38] },
    hemi: { sky: 0xa9c4ff, ground: 0x7a5872, intensity: 1.35 },
    envIntensity: 0, shadowRadius: 2, shadowStrength: 0.65,
    sky: { mode: 1, top: 0x6ea3df, horizon: 0xffd9b4, bottom: 0x8fb4de, cloud: 0.85, cloudCol: 0xfff3e2, sunGlow: 0.6, islands: 0, land: 0x8a9a6a },
    water: { look: 1, shallowR: 0x74ecd6, deepR: 0x1f9cbc, shallowP: 0x7a6a46, deepP: 0x4a3d2a, foam: 1.1, spec: 0.5, shine: 120, refl: 0.2, amp: 0.02, clarity: 0.9 },
    clouds3d: true, cloudCol: 0xfff1e0, ortho: false, fov: 32,
    strata: [0x553a28, 0xb4633a, 0xf0d29c, 0xe0964f, 0xb8573a, 0x948577, 0x2b2522, 0x6a5650, 0xeedaa6],
  },
  {
    id: 2, key: 'C', name: 'Realistic miniature', base: 'standard',
    sat: 0.98, smog: 0.32, smogCol: 0xa8916c, frontGlow: 0.35, frontCol: 0xe8b830,
    sph: 0.45, brush: 0, rim: 0, rimCol: 0xffffff, bump: 0.012, roughVar: 0.35, caustic: true,
    sun: { color: 0xfff1dc, intensity: 3.6, dir: [-0.5, 0.66, -0.42] },
    hemi: { sky: 0xbcd6ee, ground: 0x6b5640, intensity: 0.25 },
    envIntensity: 0.95, shadowRadius: 3, shadowStrength: 0.9,
    sky: { mode: 0, top: 0x3b7cc2, horizon: 0xd0e2ec, bottom: 0x1d5e8e, cloud: 0.3, cloudCol: 0xffffff, sunGlow: 0.5, islands: 1, land: 0x6f8a52 },
    water: { look: 2, shallowR: 0x4cc9bf, deepR: 0x0c5d86, shallowP: 0x655638, deepP: 0x352c1f, foam: 0.95, spec: 0.55, shine: 300, refl: 0.6, amp: 0.02, clarity: 1.0 },
    clouds3d: false, cloudCol: 0xffffff, ortho: false, fov: 36,
    strata: [0x3e2c20, 0x9a5230, 0xdcc08c, 0xc78446, 0x9f4c34, 0x847a6e, 0x1d1a18, 0x564840, 0xd8c596],
  },
  {
    id: 3, key: 'D', name: 'Clean isometric', base: 'lambert',
    sat: 1.25, smog: 0.12, smogCol: 0xc0a77a, frontGlow: 0.6, frontCol: 0xffcc33,
    sph: 0.5, brush: 0, rim: 0, rimCol: 0xffffff, bump: 0, roughVar: 0, caustic: false,
    sun: { color: 0xffffff, intensity: 1.7, dir: [-0.42, 0.84, -0.34] },
    hemi: { sky: 0xeef4ff, ground: 0xb4a48c, intensity: 2.3 },
    envIntensity: 0, shadowRadius: 1, shadowStrength: 0.45,
    sky: { mode: 2, top: 0xa8dcef, horizon: 0xeaf6f5, bottom: 0x8fcbdf, cloud: 0, cloudCol: 0xffffff, sunGlow: 0, islands: 0, land: 0x9ab872 },
    water: { look: 3, shallowR: 0x56d8c8, deepR: 0x2793b8, shallowP: 0x857348, deepP: 0x5a4a32, foam: 1.0, spec: 0, shine: 1, refl: 0, amp: 0.0, clarity: 0.85 },
    clouds3d: false, cloudCol: 0xffffff, ortho: true, fov: 30,
    strata: [0x5a3e2c, 0xc06a3a, 0xf2d6a0, 0xe8994f, 0xc2603f, 0x9c8f82, 0x2e2826, 0x75625a, 0xf2deae],
  },
];
