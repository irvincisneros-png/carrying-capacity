# Art Direction — decision (2026-10-20)

**Chosen: B "Painterly toon"**, with A's faceted geometry where it reads better and D's clarity for the UI.

The owner was happy with any direction and asked Claude to compare real in-engine renders (`docs/stylelab-shots/`) with the AI mockups (`docs/mockups/`) and pick the best balance of visuals and achievability.

## How close each real render gets to its mockup

| Style | Real render vs mockup | Perf (this Mac, High, 1600×900) | Verdict |
|---|---|---|---|
| A Low-poly diorama | ~50%. The palette and slab work. It's much sparser, the town is tiny, trees are generic blobs, and water sparkle is noisy | 60 fps, 70 draw calls | Solid, but looks "generic asset pack" |
| **B Painterly toon** | **~60%.** It gets the warm Terra Nil/Ghibli light and soft canopies, and the toon steps hide low polygon counts. It reads as a deliberate style, not a cheap one | 57–60 fps, 65 draw calls | **Best look per unit of effort; most forgiving on low-end hardware** |
| C Realistic miniature | ~35%. PBR without real textures and models looks plasticky; the tilt-shift helps. Closing the gap needs photogrammetry-grade assets we don't have | 60 fps, 81 draw calls | Highest risk, weakest result |
| D Clean isometric | ~55%. Clean and readable, but flatter and less inviting than its mockup | 60 fps, 36 draw calls | Cheapest; good fallback / Low tier look |

All four styles fall short of the mockups' **density** (the mockups have hundreds of buildings, boats, roads and props) and **asset detail**. That is the real gap, and it's closable in any style with better models and more props. B hides the remaining gap best, because a stylised look doesn't invite comparison with reality.

## Rules for the B look

- Toon ramp: 3–4 light steps, warm key light, cool sky fill, soft rim light. Brush-noise breakup on large surfaces.
- Foliage: clumpy canopies with spherised normals (soft blobs), white or grey eucalypt trunks, per-instance tint jitter, wind sway.
- Ink outlines on buildings only (not terrain), thin, on High and above.
- Palette: polluted = ochre / rust / slate / smog-sepia; restored = eucalypt sage, wattle gold, ocean teal, sandstone cream. The restoration front has a wattle-gold shimmer edge.
- Water: calmer than the style lab. Reduce sun sparkle by about 60%, more depth tint, a visible reef.
- Sky: painted gradient with soft cloud cards (not low-poly clouds), sea of clouds below the slab.
- Density targets: 3× the props of the style lab (fences, sheds, boats, cars, clotheslines, rail wagons, shrubs, rocks), all instanced.
- Camera default closer (like the stylelab B close shot); tilt-shift on Medium and above.

## Graphics tiers (auto-detected, user-overridable)

| Tier | Target hardware | Shadows | AO | Outlines | Tilt-shift | Foliage | DPR |
|---|---|---|---|---|---|---|---|
| Low | Chromebook / old laptop | none | none | none | none | 35% (simple trees) | 1.0 |
| Medium | Typical school laptop | 1024 soft | none | none | yes | 70% | ≤1.25 |
| High | Recent laptop / Mac | 2048 soft | N8AO half-res | yes | yes | 100% | ≤1.75 |
| Ultra | Gaming PC | 4096 | N8AO full | yes | yes + DOF | 130% + extra props + wispy smoke | ≤2 |

Auto-detect: start on Medium, sample 2 s; drop a tier if the average is below 45 fps, raise one if it's above 58 fps with less than 8 ms frame time (max one raise). Re-check after each tier change. The settings menu allows manual override, which is remembered per device in localStorage.
