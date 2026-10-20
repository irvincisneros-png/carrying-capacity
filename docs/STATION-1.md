# Station 1 — Engine + Act 1 "Boom" emissions loop

Read `docs/DESIGN.md` first (whole-game design). This file is the build spec for Station 1 only. Concept art target: `docs/concept/act1-boom.png` (and `act2-restored.png` for where the art is heading).

Syllabus focus: 4.2.2 (climate trends), 4.2.4 (enhanced greenhouse effect), 4.2.6 (industrialisation ↔ temperature), plus groundwork for 4.1.1 (three pillars).

## Outcome

A student opens the page, sees a polished floating diorama of a coastal NSW landscape in 1850, builds a town decade by decade to the present, and watches CO₂ and global temperature climb on live graphs that they caused. At 2020 the act ends on a "Present Day" summary with their graphs beside the real-world record.

## Stack (fixed)

- Vite + TypeScript (strict) + Three.js (latest stable `three` from npm) + `postprocessing` (pmndrs) + Vitest.
- No UI framework: plain DOM + CSS for HUD/panels. Graphs drawn on `<canvas>` by hand (no chart lib).
- `vite.config.ts` `base: '/carrying-capacity/'`. Copy `.github/workflows/deploy.yml` pattern from `../equilibrium-lost/.github/workflows/deploy.yml` (npm ci → test → build → Pages).
- Scripts: `dev`, `build` (`tsc --noEmit && vite build`), `test` (`vitest run`), `preview`.

## Architecture

```
src/
  main.ts                 bootstraps renderer, sim, UI
  sim/                    PURE TS, no three/DOM imports, fully unit-tested
    types.ts              Tile, Building, GameState, DecadeReport
    terrain.ts            seeded map generation (deterministic from seed)
    buildings.ts          building catalogue (data, see table)
    rules.ts              placement validation
    economy.ts            per-decade budget/jobs/housing/power/meters
    climate.ts            CO2 + temperature model (see formulas)
    realData.ts           historical CO2 + temperature table (see below)
    game.ts               reducer: applyAction(state, action) -> state; advanceDecade(state)
    save.ts               serialise/deserialise to localStorage (versioned, try/catch)
  render/
    scene.ts              renderer, camera, lights, post-processing, quality tiers
    terrainMesh.ts        diorama slab + cut-away strata sides + water
    buildingMeshes.ts     procedural low-poly building models (InstancedMesh per type)
    props.ts              trees, smoke particles, birds
    atmosphere.ts         sky/haze/LUT driven by CO2 + local pollution
    picking.ts            tile hover/select via raycast on a grid plane
  ui/
    hud.ts                top bar: year, budget, meters, "Next decade" button
    buildMenu.ts          bottom toolbar of buildings with cost/tooltip
    graphs.ts             CO2 + temperature canvas graphs with real-data overlay
    events.ts             decade report toast/modal
    summary.ts            "Present Day" end screen
    teacherNotes.ts       collapsible "The science" panel per graph
tests/                    vitest for every sim/ module
```

The sim is the single source of truth; render and UI read state and dispatch actions. Same pattern as `../equilibrium-lost` (pure engines, unit-tested).

## Map

- 32×32 square tile grid, seeded generation (default seed fixed so every class sees the same map; `?seed=` param overrides).
- Tile kinds: `sea`, `beach`, `estuary` (river mouth), `river`, `land`, `bush` (eucalypt woodland, initial), `rock` (sandstone headland/escarpment), plus `elevation` 0–3.
- Layout: sea along the east edge with a reef patch offshore; a river meandering from west to an estuary; sandstone escarpment along the west; bushland covering ~60% of land at start.
- Building on `bush` clears it (counts as land clearing → small one-off CO₂ release and Environment hit).

## Building catalogue (Act 1)

Units are game units; keep them in `buildings.ts` as data. `co2` is kt CO₂ per decade of operation. `unlock` = first decade available.

| id | name | size | cost | jobs | housing | power (+gen/−use) | co2 | localPollution | unlock | placement |
|---|---|---|---|---|---|---|---|---|---|---|
| cottage | Weatherboard cottages | 1×1 | 10 | 0 | 20 | −1 | 1 | 0 | 1850 | land/bush |
| farm | Farm | 2×2 | 15 | 10 | 0 | 0 | 4 | 1 (runoff) | 1850 | land/bush, not rock |
| road | Road | 1×1 | 2 | 0 | 0 | 0 | 0 | 0 | 1850 | land/bush |
| coalmine | Coal mine | 2×2 | 40 | 40 | 0 | −2 | 20 | 2 | 1850 | adjacent to rock |
| rail | Rail siding | 1×1 | 5 | 2 | 0 | 0 | 1 | 0 | 1860 | land |
| port | Port & coal loader | 2×2 | 60 | 30 | 0 | −2 | 10 | 2 | 1870 | touching sea |
| steelworks | Steelworks | 3×3 | 120 | 150 | 0 | −10 | 120 | 5 | 1910 | land, near port (≤6 tiles) |
| coalpower | Coal power station | 2×2 | 100 | 40 | 0 | +40 | 150 | 4 | 1920 | land, within 3 tiles of river/estuary (cooling water) |
| factory | Factory | 2×2 | 50 | 60 | 0 | −5 | 25 | 3 | 1900 | land |
| suburb | Brick suburb | 2×2 | 30 | 0 | 120 | −4 | 6 | 0 | 1950 | land/bush |
| carpark | Highway & cars | 1×3 | 25 | 5 | 0 | 0 | 30 | 2 | 1950 | land |
| landfill | Landfill | 2×2 | 10 | 5 | 0 | 0 | 15 (methane, CO₂-e) | 3 | 1900 | land |
| outfall | Sewage outfall | 1×1 | 5 | 0 | 0 | 0 | 0 | 3 (water) | 1880 | touching sea/estuary |

Steam/coal-fired buildings before power stations need no grid power (power column only binds once `coalpower` unlocks in 1920; before that, negative power is ignored). After 1920, a power deficit cuts Economy.

## Decade loop

- Start 1850, budget 100. `Next decade` advances 10 years until 2020 (18 decades). Player can place/demolish any time within a decade.
- Each decade: income = jobs × 0.5 (filled jobs only: filled = min(jobs, population)); population grows toward housing (+50% of gap per decade); demand banner states what the town needs this decade (e.g. "250 new workers' homes", "power for the factories") generated from current shortfalls.
- Meters 0–100:
  - Economy: filled jobs vs population, budget trend, power balance.
  - Society: housing for population, unemployment, local pollution near housing (pollution within 3 tiles of cottages/suburbs).
  - Environment: remaining bush %, local pollution total, reef health (drops with water pollution and temperature).
  Exact weights live in `economy.ts` with tests; tune so a "build everything dirty" run ends ~Economy 80 / Society 55 / Environment 15, and a cautious run ends ~Economy 45 / Environment 45. No game-over in Act 1 (Act 2 handles failure); meters only inform.
- Decade report modal: what changed (emissions this decade, ppm, °C), one "Did you know?" fact tied to the year (e.g. 1890s Arrhenius greenhouse calculation, 1958 Keeling curve begins at Mauna Loa, 1988 IPCC formed). Keep facts accurate; list them in `src/content/facts.ts`.

## Climate model (`climate.ts`)

Honest simplification: the town stands in for "the industrialising world".

- Reference town: a scripted "typical" build (define it in `climate.ts` as cumulative emissions per decade that match real history shape). `m(decade) = clamp(playerCumulative / referenceCumulative, 0.4, 1.6)` (for 1850 when both ≈0, m = 1).
- `CO2(year) = 280 + (realCO2(year) − 280) × m`
- `T(year) = 1.8 × log2(CO2 / 280)` (°C above pre-industrial; 1.8 ≈ transient climate response — note in teacher panel).
- Real data table (decadal values, `realData.ts`; mark source + "approximate decadal averages"):
  - CO₂ ppm: 1850 285, 1860 286, 1870 288, 1880 291, 1890 294, 1900 296, 1910 300, 1920 303, 1930 307, 1940 311, 1950 311, 1960 317, 1970 326, 1980 339, 1990 354, 2000 369, 2010 390, 2020 413 (Law Dome ice core to 1958, Mauna Loa after; NOAA/CSIRO).
  - Temperature anomaly vs 1850–1900, °C: 1850 0.0, 1860 0.0, 1870 0.0, 1880 −0.05, 1890 −0.1, 1900 0.0, 1910 −0.15, 1920 0.0, 1930 0.1, 1940 0.25, 1950 0.1, 1960 0.15, 1970 0.2, 1980 0.35, 1990 0.55, 2000 0.75, 2010 0.95, 2020 1.2 (HadCRUT5/NASA GISTEMP, approximate).
- Tests: with m = 1 the model CO₂ equals real CO₂ every decade; T(413 ppm) ≈ 1.0 °C ± 0.05; m clamps.

## Graphs (`graphs.ts`)

- Panel on the right (collapsible; becomes a bottom sheet under 700px width).
- Graph 1: CO₂ (ppm) vs year. Graph 2: temperature anomaly (°C) vs year. Solid line = your world; dashed grey = real record. Axes labelled with units, years 1850–2020 fixed x range.
- Graph 3: your town's emissions per decade (kt CO₂) as bars, coloured by source category (power, industry, transport, land clearing, waste).
- Hover shows values. "Download CSV" button exports year, your CO₂, real CO₂, your °C, real °C, emissions by source — for 4.2.2 data-analysis tasks.
- "The science" toggle under each graph: 2–4 sentence Year-9-level explanation (enhanced greenhouse effect; why temperature lags; that this model is simplified and how).

## Rendering — visual quality bar (important)

Target: the concept art. Stylised low-poly **floating diorama** with soft painterly shading, tilt-shift, looks like a crafted miniature — NOT flat primitive boxes.

- Slab: the 32×32 map sits on a thick slab whose four cut faces show layered strata (topsoil, clay, sandstone bands, darker coal seam) via vertex colours/gradient; slight bevel on top edges; floats over a soft gradient background with a subtle drop shadow.
- Terrain: per-tile heights with smoothed vertex normals, vertex-colour noise for variation; sea is an animated shader plane (gentle waves, depth tint, foam at beach, reef visible as a lighter patch whose colour lerps healthy coral → bleached white with temperature/water pollution).
- Buildings: procedural low-poly models with bevelled edges and distinct silhouettes (pitched corrugated roofs on cottages, sawtooth factory roofs, tapered smoking stacks, conveyor + loader at port, headframe at coal mine, cooling-pond at power station). One `InstancedMesh` per model part; place/demolish with a quick scale-pop animation.
- Eucalypts: instanced, white/grey trunk + 3–5 olive-blue canopy blobs, per-instance scale/rotation/tint jitter, gentle wind sway in the vertex shader.
- Smoke: instanced billboard puffs rising from stacks/chimneys, density proportional to emissions.
- Atmosphere: sky gradient + fog + a colour-grade (simple LUT or tint uniform) that shifts from clear 1850 toward sepia/smog-yellow as local pollution and CO₂ rise; sun is warm, soft shadows (one directional shadow map, PCF soft).
- Post-processing (pmndrs, single `EffectPass` where possible): tone mapping (ACES/AgX), SMAA, mild bloom (water glints, furnace glow), vignette, tilt-shift blur. N8AO optional on High.
- Camera: orbit around the slab, isometric-ish 3/4 default, clamped zoom and pitch, rotate in 90° steps with Q/E plus free drag; touch: one-finger pan, two-finger pinch/rotate.
- Quality tiers: Low (no shadows, no AO, no tilt-shift, DPR 1), Medium (default; shadows 1024, tilt-shift), High (2048 shadows, N8AO, DPR up to 2). Auto-pick from a quick FPS sample in the first 2 s; manual override in settings. Must hold 30 fps on a school Chromebook at Medium/Low.
- Hover highlight tile outline; placement ghost shows valid (teal) / invalid (red) with the reason in a tooltip (e.g. "Power stations need cooling water within 3 tiles").

## UI

- Clean, modern, readable at Year 9: top HUD (year, budget, population, three meters as labelled bars), bottom build toolbar with icons + name + cost, locked buildings greyed with unlock year.
- Font: system UI stack or one Google Font (e.g. Nunito/Inter). Accessible contrast; all controls keyboard-reachable.
- Intro card (skippable): "It's 1850. Your job: grow this coastal town into a thriving city. Watch what happens to the air."
- Acknowledgement of Country line on the intro card (generic, unnamed Country, per DESIGN §6).
- Works at 375px wide (toolbar scrolls horizontally, graphs become a bottom sheet).
- Save/continue via localStorage (versioned key `cc.save.v1`), reset button.

## Present Day summary (end of Act 1)

- Full-screen card over a slow orbit of the player's town.
- Their CO₂ and temperature graphs with the real record; three meters; top 3 emission sources pie/bar.
- Three reflection prompts (copyable text): "Which buildings caused most of your emissions?", "How does your temperature curve compare with the real one?", "What would you change if you did it again?"
- Button "Continue to Act 2" disabled with label "Coming soon — Station 3".

## Tests (minimum)

- climate: m = 1 reproduces real CO₂; temperature mapping; clamps.
- rules: every placement constraint in the table, including size/overlap/out-of-bounds.
- economy: population growth, filled jobs, power deficit only after 1920, meter ranges 0–100.
- game: placing, demolishing (refund 25%), advancing decades to 2020 then act-complete; deterministic terrain for a seed.
- save: round-trip; corrupted save falls back to new game.

## Done when

- `npm test` and `npm run build` pass.
- Dev server shows the diorama matching the concept art's mood; a full 1850→2020 run is playable in ~10–15 minutes; graphs, CSV export, decade reports and summary all work; no console errors.
- `docs/HANDOVER.md` written: what was built, how to run, known gaps, next steps (Station 2).
