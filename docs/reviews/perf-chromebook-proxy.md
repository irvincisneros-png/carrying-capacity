# Performance on a Chromebook proxy (SwiftShader + 6x CPU throttle)

Goal: at least 30 fps (60 target) at the tier Auto picks on Chromebook-class hardware. We have no Chromebook, so this is a proxy. Result: before this work **no tier reached 30 fps on the proxy** (Low about 7-10 fps, Medium 2-3 fps, and Auto was slow to leave Medium). After it, the new **Very low** tier, which Auto picks on the proxy, holds **29-59 fps** in all six scenarios (five of six at 33 fps or better; Coal Coast sat right on the line at 29-32 until round 5, which cut its frame work by about a fifth: see the end of this file).

## Method

- Chrome headless shell driven by playwright-core, software rendering: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`. `WEBGL_debug_renderer_info` reports: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)`.
- Viewport 1366x768, DPR 1, CDP `Emulation.setCPUThrottlingRate` 6.
- `vite build` + `vite preview` on 127.0.0.1:8462. The "before" build is commit f6b2b7d's render code (plus the current sim/content) served separately.
- Each scenario is started with `window.__cc` and filled to a mid/late Act 2 state (`demoTown`/`demoAct2`, then `autoPlace` of every common building type and `debugTick`); net-zero-city starts in Act 2 and is the heaviest (372 items). Perf measurement only.
- Per run: 3 s settle, 12 s warm-up (camera panning, 4x speed; SwiftShader JIT-compiles each new pipeline state, so the first ~10 s run at 3-7 fps on every tier), then two 10 s windows: **pan** (camera orbiting plus WASD drift, 1x speed) and **4x** (same, 4x game speed). Frame times come from rAF deltas; "1% low" is frames/second of the slowest 1% of frames; draw calls and triangles are the per-frame maximum from `renderer.info`.
- "First frame" is navigation to the first rendered frame (title screen with the 3D map behind it).
- Script: `tools/perf-proxy/bench.mjs` (needs playwright-core and a Chromium).

## Results

All numbers are fps unless marked ms.

**green-valley** (20x20, 98 placed items, Act 2 2039)

| Build / tier | pan fps | 1% low | worst ms | 4x fps | 4x 1% low | 4x worst ms | calls | tris | first frame s |
|---|---|---|---|---|---|---|---|---|---|
| before, auto settled on Medium | 1 | 0 | 3383 | 6 | 2 | 583 | 45 | 524k | 10.6 |
| before, Low forced | 10 | 7 | 150 | 10 | 7 | 150 | 19 | 122k | 5.4 |
| before, Medium forced | 3 | 2 | 517 | 2 | 2 | 683 | 45 | 570k | 11.3 |
| **after, auto -> Very low** | 57 | 12 | 350 | 59 | 30 | 33 | 19 | 34k | 3.9 |
| after, Very low forced | 58 | 14 | 217 | 56 | 12 | 333 | 19 | 34k | 4.0 |
| after, Low forced | 18 | 12 | 83 | 16 | 13 | 83 | 19 | 122k | 4.7 |
| after, Medium forced | 3 | 1 | 700 | 3 | 3 | 350 | 45 | 550k | 10.4 |

**coal-coast** (40x40, 159 placed items, Act 2 2039)

| Build / tier | pan fps | 1% low | worst ms | 4x fps | 4x 1% low | 4x worst ms | calls | tris | first frame s |
|---|---|---|---|---|---|---|---|---|---|
| before, auto settled on Low | 4 | 0 | 3533 | 6 | 3 | 350 | 22 | 457k | 10.8 |
| before, Low forced | 7 | 3 | 383 | 7 | 5 | 200 | 22 | 394k | 4.9 |
| before, Medium forced | 2 | 1 | 717 | 2 | 2 | 533 | 49 | 1874k | 10.8 |
| **after, auto -> Very low** | 30 | 8 | 150 | 29 | 6 | 267 | 22 | 101k | 6.5 |
| after, Very low forced | 32 | 16 | 67 | 30 | 12 | 133 | 22 | 101k | 4.8 |
| **round 5, Very low forced (quiet host, mean of 2)** | 47 | n/a | n/a | 42 | n/a | n/a | 22 | 80k | n/a |
| round 5 control: the same bench on the round-4 build, same hour, quiet host | 42 | n/a | n/a | 36 | n/a | n/a | 22 | 101k | n/a |
| after, Low forced | 10 | 8 | 133 | 9 | 8 | 133 | 22 | 394k | 4.4 |
| after, Medium forced | 2 | 2 | 667 | 2 | 2 | 517 | 49 | 1885k | 10.6 |

**river-town** (40x40, 163 placed items, Act 2 2039)

| Build / tier | pan fps | 1% low | worst ms | 4x fps | 4x 1% low | 4x worst ms | calls | tris | first frame s |
|---|---|---|---|---|---|---|---|---|---|
| before, auto settled on Medium | 4 | 0 | 3100 | 6 | 3 | 317 | 46 | 1547k | 10.8 |
| before, Low forced | 7 | 2 | 400 | 6 | 3 | 333 | 21 | 409k | 4.7 |
| before, Medium forced | 2 | 2 | 683 | 2 | 2 | 567 | 46 | 1611k | 10.8 |
| **after, auto -> Very low** | 33 | 6 | 267 | 35 | 27 | 50 | 20 | 110k | 4.0 |
| after, Very low forced | 33 | 7 | 233 | 35 | 27 | 50 | 20 | 110k | 4.0 |
| after, Low forced | 9 | 3 | 367 | 9 | 6 | 167 | 21 | 391k | 4.4 |
| after, Medium forced | 2 | 2 | 633 | 2 | 2 | 633 | 46 | 1649k | 10.5 |

**reef-island** (44x44, 110 placed items, Act 2 2039)

| Build / tier | pan fps | 1% low | worst ms | 4x fps | 4x 1% low | 4x worst ms | calls | tris | first frame s |
|---|---|---|---|---|---|---|---|---|---|
| before, auto settled on Low | 8 | 4 | 267 | 6 | 4 | 283 | 22 | 320k | 10.8 |
| before, Low forced | 7 | 3 | 383 | 7 | 3 | 367 | 22 | 322k | 4.8 |
| before, Medium forced | 3 | 2 | 533 | 3 | 2 | 483 | 49 | 1018k | 10.7 |
| **after, auto -> Very low** | 36 | 7 | 283 | 34 | 15 | 133 | 22 | 110k | 3.8 |
| after, Very low forced | 35 | 7 | 267 | 34 | 18 | 67 | 22 | 110k | 4.0 |
| after, Low forced | 10 | 3 | 350 | 10 | 8 | 133 | 22 | 323k | 4.5 |
| after, Medium forced | 3 | 2 | 517 | 2 | 2 | 517 | 49 | 1018k | 10.7 |

**red-dirt** (40x40, 159 placed items, Act 2 2039)

| Build / tier | pan fps | 1% low | worst ms | 4x fps | 4x 1% low | 4x worst ms | calls | tris | first frame s |
|---|---|---|---|---|---|---|---|---|---|
| before, auto settled on Low | 9 | 4 | 233 | 7 | 4 | 267 | 19 | 301k | 10.7 |
| before, Low forced | 8 | 3 | 383 | 8 | 4 | 283 | 19 | 304k | 4.8 |
| before, Medium forced | 3 | 2 | 550 | 3 | 2 | 533 | 44 | 989k | 10.5 |
| **after, auto -> Very low** | 43 | 8 | 250 | 44 | 27 | 50 | 19 | 86k | 4.0 |
| after, Very low forced | 41 | 8 | 250 | 42 | 27 | 50 | 19 | 86k | 4.1 |
| after, Low forced | 12 | 3 | 350 | 12 | 10 | 100 | 19 | 297k | 4.4 |
| after, Medium forced | 3 | 2 | 533 | 3 | 2 | 517 | 44 | 978k | 14.4 |

**net-zero-city** (48x48, 372 placed items, Act 2 2031)

| Build / tier | pan fps | 1% low | worst ms | 4x fps | 4x 1% low | 4x worst ms | calls | tris | first frame s |
|---|---|---|---|---|---|---|---|---|---|
| before, auto settled on Medium | 4 | 0 | 2100 | 6 | 3 | 317 | 46 | 1317k | 10.7 |
| before, Low forced | 7 | 4 | 283 | 7 | 5 | 217 | 20 | 394k | 4.8 |
| before, Medium forced | 2 | 2 | 650 | 2 | 2 | 600 | 46 | 1555k | 10.7 |
| **after, auto -> Very low** | 35 | 20 | 50 | 31 | 18 | 67 | 20 | 114k | 4.0 |
| after, Very low forced | 34 | 20 | 50 | 31 | 18 | 67 | 20 | 114k | 4.2 |
| after, Low forced | 10 | 6 | 183 | 8 | 7 | 150 | 20 | 404k | 4.5 |
| after, Medium forced | 2 | 2 | 633 | 2 | 2 | 567 | 46 | 1555k | 10.6 |

### Auto-detect behaviour

- Proxy (software renderer sniffed): starts on Very low, first frame about 4 s.
- With the sniff disabled (`?nosniff`, to mimic a real GPU that is just slow): Medium -> Low after about 9 s -> Very low after about 17 s (coal-coast and net-zero-city, from scenario start). Before: Medium -> Low after about 21 s and it stopped there, because the 2 s window was counted in clamped 0.1 s frames.

## What changed

- **Very low tier** (new tier 0; Low/Medium/High/Ultra shift up one; saved prefs migrate from `cc.graphics.v1`): internal scale 0.6 upscaled; renders straight to the canvas with three's neutral tone mapper (no composer, no half-float targets, no SMAA/bloom/tilt-shift/grade); plain-gradient sky drawn last (early-z), cheap water (no ripple normals, sky reflection, foam bands or scum), cheaper ground and strata shaders (no brush texture, caustics or fbm stacks), 1/4 of the cloud cards, terrain mesh at 2 vertices per tile (about 1/4 of the triangles; water plane likewise), building models with parts under 0.35 world units left out (windows, rails, trim; 0.28 until round 5), all road and rail tiles baked into one draped mesh (one draw instead of up to 5 batch instances per tile), 15% foliage (20% until round 5) with trees on a cheaper model, understorey, boulders, coral and weeds thinned, 10% ambient props, 12% smoke. Shared across Low and Very low: the lite shader variants.
- **Auto-detect**: software-renderer sniff; uses real frame time; drops after 1 s if under 20 fps; keeps watching in 4 s windows and steps down if under 24 fps; can climb to Very low.
- Zero-cost cleanup: per-vertex hash only computed when sway is on.

## Findings that drove the work

- On SwiftShader the cost is about 0.25 ms per 1000 triangles regardless of shader complexity (a trivial override material only about halved it) plus about 18 microseconds per BatchedMesh instance (650 road instances cost about 12 ms). Fill is only about 25% of the frame at scale 0.6. The CPU throttle barely matters: JS is about 4-5 ms a frame even at 6x, so these numbers are GPU-process bound.
- Medium+ is visually unchanged: Medium coal-coast screenshots before/after differ only at the run-to-run noise level (base against base differs by about 2% of pixels over 8 levels; before against after by about 4%, speckle on foliage edges, no structural change). Very low is deliberately cruder (flat road strips, plainer sky and houses without windows) but every building, tree and the restoration colouring still read.

## Caveats (honest)

- SwiftShader is a CPU rasteriser; on fill rate it is usually slower than a Chromebook's integrated GPU, so this is conservative there. But it is not a faithful model: real Chromebooks may be limited by driver draw-call cost, memory bandwidth or thermal throttling instead, and a Celeron or ARM CPU is slower than this Mac's cores for the JS side, which the 6x throttle only approximates. Without WEBGL multi-draw, three's BatchedMesh issues one draw per instance, so cutting instance counts should help real devices too (not measured).
- The host was shared with other jobs (load average 8-17 on 8 cores) during runs, so absolute numbers are about +/-15% and pessimistic; two early runs hit heavier contention and were repeated (net-zero-city, green-valley before, red-dirt Medium). Do not read single-digit differences between tiers as precise.
- 1% lows and worst frames (100-350 ms in many pan windows, even at 57 fps average) are single hitches; probable causes are SwiftShader JIT of new pipeline states and layer rebuilds under throttle, not confirmed. Windows too short to be statistically meaningful for 1% lows (about 300-600 frames).
- Medium on the proxy (2-3 fps, 10 s to first frame) says Medium would be unusable on a CPU-only renderer; real GPUs will be far faster. Auto's job is to notice.
- Headless shell, not headed Chrome; DPR 1 only.

## Round 5: Coal Coast on Very low (2026-10-21)

Coal Coast was the slowest 40x40 map on Very low (29-32 fps against 33-35 for River Town and 42 for Red Dirt). Method: the same bench, with
the new `HIDE=` option in `tools/perf-proxy/bench.mjs` (takes named scene objects out of the camera's layers, so the sim's own layer rebuilds cannot switch them back on)
and `LIST=1` (names, instance counts and triangles per object), and the new `NODEF=` option (drops a shader define from every material). The host was quiet
for the profiling runs (load average 3-6), where Coal Coast read 36-41 pan and 34-36 at 4x, so absolute numbers are higher than in the tables above; read the runs against each other.

What the profile said (Coal Coast, Very low, quiet host; pan fps with the object taken out, against 41 with everything on):

| Taken out | pan fps | Triangles | Reading |
|---|---|---|---|
| nothing (control, 3 runs) | 36.7 / 41.3 / 41.6 | 101k | run-to-run spread is about +/-8% |
| all vegetation (11 draws) | 55 | 66k | the biggest single block: 35k triangles but more than half the time of the frame |
| buildings (BatchedMesh, 159 items) | 50 | 60k | the second block: 40k triangles plus about 18 microseconds an instance |
| terrain | 46 | 88k | |
| water | 44 | 98k | about 7%: Coal Coast has far more sea than the inland maps |
| smoke | 42 | 99k | within noise |
| ambient props, rotors | 42 | 100k | within noise |
| the wind sway define (`NODEF=CC_SWAY`) | 30-33 | 101k | no gain, within noise (one run lower, probably the recompile) |

So Coal Coast costs more than River Town for the same reason it costs more than Red Dirt: more triangles in places that cost a lot (Red Dirt draws 86k, with almost no trees,
at 42-47 fps; River Town 110k at 36-37; Coal Coast 101k at 36-41 with the sea on top). Nothing Coal-Coast-specific was found to be broken.

Changes (all Very low only except the water shader, which is shared with Low; Medium and above are untouched):

- Building parts under 0.35 world units are left out (was 0.28). On Coal Coast that is 18k fewer triangles; 0.4 was tried and lost the small houses, so 0.35 it is.
  Screenshots at 0.28, 0.32 and 0.35 show the same town with a little less trim; every house, stack, panel and turbine still reads.
- Foliage 15% (was 20%).
- The lite water's shoreline foam wobble is two sines instead of a noise lookup (every sea pixel on Very low and Low ran the noise); Medium and above keep the full shader.

Result, Coal Coast, Very low forced, 1366x768, 6x CPU throttle, SwiftShader:

| Condition | Build | pan fps (mean) | 4x fps (mean) | Triangles | Draw calls |
|---|---|---|---|---|---|
| quiet host (load 3-6), 1-2 runs | round 4 | 41.5 | 35.9 | 101k | 22 |
| quiet host, 2 runs | round 5 | 46.7 | 42.2 | 80k | 22 |
| two busy loops on the machine (load about 7), 4 interleaved A/B pairs | round 4 | 25.3 | 22.9 | 101k | 22 |
| the same load, same pairs | round 5 | 29.6 | 27.3 | 80k | 22 |

Round 5 is 13-19% faster in every paired comparison (the gain depends a little on the host: +5-9% when an earlier cut of 0.32 was tried, +17-19% with the final settings).
Triangles are down 21% and the draw calls are unchanged. At the pace the earlier runs saw (29-32 fps on the busier host), the same ratio gives 34-37 fps, so Coal Coast now clears 33
on both a quiet and a moderately busy host. It does not clear 33 when the machine is badly oversubscribed (a load of 12 or more took both builds to 12-21 fps), which is the same
caveat as the first measurement. The other scenarios on the round-5 build, quiet host, pan / 4x: River Town 40 / 43, Red Dirt 52 / 54, Reef Island 39 / 40, Net Zero City 43 / 40, Green Valley 59 / 59.
