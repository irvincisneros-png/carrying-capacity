# Handover

State of Carrying Capacity as of 2026-10-21, for whoever picks it up next. Read `README.md` first for how to run it,
then `docs/GAMEPLAY.md` (the design) and `docs/reviews/qa-playthrough.md` (three rounds of play-testing).

## State of the project

- **Complete and playable end to end**: title, scenario select with unlocks and stars, six scenarios (tutorial plus
  five), Act 1 boom by decades, turning point, Act 2 by seasons to 2100, 2100 Report Card with reflections, autosave
  and continue, teacher guide (`teacher.html`).
- **Systems**: energy grid, climate model, pollution and remediation, succession and the restoration front,
  wildlife with named families, residents with story beats and moods, dilemma cards with evidence, Caring for Country
  (draft), satellites and early warnings, circular economy (repurpose / recycle / landfill and research), community
  projects (late-game money sink), scenario policies (water sharing, drought plan, starfish control, turtle lighting,
  water restrictions), scenario mechanics (river, reef, outback, city heat), graphs with CSV export.
- **Quality bar**: `npx vitest run` (about 670 tests including whole-scenario balance runs on four event seeds),
  `npx tsc --noEmit -p .` and `npx vite build` all clean. No console errors in the QA replays. 60 fps on the
  test machine with 4× CPU throttling.
- **Content status**: all Aboriginal and Torres Strait Islander content (Elders, place names, cultural burning,
  co-management, the Red Dirt rehabilitation partnership) is **draft placeholder text pending AECG / Local Aboriginal
  Land Council consultation**. It is flagged `needsConsultation` in the content files and noted on the teacher page.
  Do not remove that flag or the note until consultation has happened.

## Architecture

```
            content/ (words + tuning data)
                 │
   ┌─────────────▼──────────────┐
   │ sim/  pure, deterministic   │  createGame, applyAction(state, action) -> {state, result}
   │       state in, state out   │  Act 1: advanceYear (advanceDecade = 10)  Act 2: tick(state, dtYears)
   └─────────────┬──────────────┘
                 │ GameState (immutable per step; cloneState before mutating)
   ┌─────────────▼──────────────┐
   │ game/controller.ts          │  owns the state, Act 2 clock, autosave, undo, emits 'state' / 'simEvents'
   └──────┬───────────────┬─────┘
          │               │
   ┌──────▼─────┐   ┌─────▼──────┐
   │ render/    │   │ ui/        │  DOM panels read the state; actions go back through controller.dispatch
   │ three.js   │   │ HUD, panels│
   └────────────┘   └────────────┘
```

- **Determinism.** Everything random in Act 2 draws from `seasonRng(seed, seasonIndex, salt)`, so the same save plus
  the same actions gives the same game. `tick(1)` equals four `tick(0.25)`s. The controller relies on this to
  simulate the next season ahead in idle time.
- **Act 2 season step** (`sim/act2.ts processSeason`): events (pre) → grid → pollution, remediation, wetlands →
  emissions → events (post) → reef and succession → layers (residents, mechanics, Country, wildlife) → year end
  (economy, policy costs, climate, meters, objectives, fail / finish).
- **Layers** (`sim/layers.ts`) connect the empathy and transition systems to the season and year steps and to
  actions (`applyLayerAction`).
- **Scenario mechanics** (`sim/mechanics/index.ts`): a scenario lists the modules it uses; the engine calls
  `mechBegin / mechSeason / mechYear / mechIncome / mechPlaced / mechMetric` and never knows scenario names. Module
  state lives in `GameState.flags` (prefixed keys such as `w.` river, `r.` reef, `o.` outback, `c.` city).
- **Saves**: `sim/save.ts` serialises to `localStorage` key `cc.save.v1` (one slot). New fields should go in
  `flags` or be optional, so old saves keep loading; `tests/save.test.ts` and `tests/layers-save.test.ts` cover this.
- **Rendering**: the renderer diffs state by version and chunk; vegetation and ambient life rebuild on later frames
  (one per frame). Quality tiers in `render/quality.ts`.

## How to add a scenario

1. Add the id to `ScenarioId` in `src/sim/types.ts` and a `ScenarioDef` in `src/content/scenarios/<id>.ts`
   (terrain kind, years, budget, availability overrides, modifiers, policies, `act2` block with objectives and the
   turning point). Register it in `SCENARIOS` and `SCENARIO_IDS` (`src/sim/scenarios.ts`) and `UNLOCK_REQUIRES`
   (`src/sim/progress.ts`).
2. Terrain: reuse a generator in `src/sim/gen/` or add one and route it in `src/sim/terrain.ts`.
3. Content: residents (`content/residents/<id>.ts` + `index.ts`), dilemmas (`content/dilemmas/<id>.ts` + `index.ts`),
   turning point (`content/turning/<id>.ts`), extra species (`content/speciesExtra/`, `BONUS_SPECIES`), Country
   overrides (`content/countries/`, flagged `needsConsultation`).
4. A mechanic, if needed: a module in `sim/mechanics/` with its hooks wired in `mechanics/index.ts`, metric keys in
   `MECH_METRIC_KEYS`, and events in `mechanics/events.ts`.
5. UI: an icon in `SCEN_ICON` and the science voice in `SCIENCE_VOICE` (`ui/screens.ts`), goal hints in `HOW_TO`
   (`ui/act2.ts`), and the teacher notes in `src/teacher/main.ts` (`NOTES`, a TypeScript error reminds you).
6. Tests: a scripted thoughtful player and an idle player in `tests/helpers/`, then add the scenario to
   `tests/scenario-play.test.ts` and, if it has an Act 1, to `tests/balance-seeds.test.ts`. The thoughtful run must
   win on every seed, the idle run must not.

## Map sizes (enlarged again 2026-10-22, round 6 WP6)

Green Valley 32x32 (was 20, originally 16), Coal Coast, River Town, Red Dirt and Reef Island 64x64 (were 40, 40, 40 and 44,
originally 32), Net Zero City 72x72 (was 48). Tile counts for the renderer: 1024 (valley), 4096 (coal, river, red, reef),
5184 (city, the largest). All terrain generators size their features from the map (`s = min(w, h) / original`), so a
scenario can be resized by changing `mapW` / `mapH`; `tools/dumpmap.ts <id>` prints a generated map as text.

**How the generators grew.** Coal Coast, River Town, Red Dirt and Reef Island scale with `s` as before (s = 2 now). River
Town keeps the river's wave count at about 2.2 (more waves made the middle reach a straight, thick column). The Red Dirt pit
grows at 0.75 of the linear scale, about 128 tiles in all (89 at 40x40), and any stray tiles of its noisy edge are handed
back to the plain so each pit is one piece. Reef Island's island keeps its share of the map (land about 4x the original
32x32 island) and the reef is about 415 tiles. **Net Zero City** scales its harbour, ranges, river and wetlands by
`s = 1.5` but the built-up city does not grow: `prebuilt.ts` has the same ring of blocks (`radius` 17.5) and a new
`homes` cap (4240) on suburbs and cottages, so the start is the 48x48 city (about 4300 homes, 1640 jobs, every building on
a road, the same emissions), with a ring of hinterland (bush, open land, the river) round it for the player to spread into.

**Map-tied quantities, and what was done about each** (a cash-limited town is the same size on any map, so anything
measured as a share of the map or of the river had to be re-anchored to the original size):

- `pollutionRefTiles` (coal, river, red, reef 1024, valley 256, city 2304): the Environment meter's pollution term.
- Environment's **bush term** is now measured against the bush of the reference area (`economy.ts`: the share lost is
  divided by `ref / area`), so clearing 100 tiles costs the same Environment on 64x64 as on 32x32. Without it the dirty
  Coal Coast run ended Environment about 42 instead of 19.
- River Town: `meanRiverWaterPollution` is the river's pollution total over `RIVER_REF_TILES` (140) instead of the mean
  times the area growth (that overstated it: the river grows more slowly than the area, and floods pollute every river tile);
  the bank-clearing share in `riverHealth` is scaled by the river's length the same way.
- Cool burns and co-management reach `CARE_REACH` (9 tiles) round the clicked tile (`country.ts`). One click used to mean
  "the whole connected patch of bush"; on a big map that is the whole hinterland, a cool burn burns a share of its patch and
  releases 0.2 kt a tile, and Net Zero City's line is 48 kt a year. The scripted city player co-manages up to 100 tiles.
- Reef Island: reef heat tolerance and nursery boost raised (`nurseryBoost` 0.14 -> 0.3: a nursery reaches about 80 of 415
  reef tiles), turtle `maxWater` 0.6 -> 0.45 and the tourism goal 45 -> 55 (the bigger beach and wildlife hold an idle
  island's tourism index at 47 and its beach water at 0.54, so the idle run met two goals it must miss).
- Wildlife habitat minima (patch sizes, tile counts) are absolute and stay: a bigger map just has more habitat. Fire and
  weed spread are per tile and per neighbour, so they scale themselves; satellites, roads and entrance roads needed nothing
  (the entrance is a free road from the map edge to the town, however long).
- Scripted players: Act 2 restoration counts (`tests/helpers/mapscale.ts`) barely matter on Coal Coast (natural spread from
  the bush covers the land: 10, 15, 25 or 40 nurseries end at the same meanHealth, 0.75 to 0.78). River Town's thoughtful
  run still plants 3 riparian nurseries; Red Dirt places as many nurseries as the pit needs; Reef Island 6 coral nurseries.
  `DIRTY_ROADS` 1 -> 1.5 (the longer roads of the 64x64 coast made the dirty run too clean to be the "worst case").

**Re-bands (all recorded in the test comments):** Coal Coast good play 3 -> 5 short-power years, Red Dirt 3 -> 4; idle River
Town farm viability < 45 (was 40); idle runs need 3 (coal), 4 (river, red) bad resident endings (were 4, 5, 5);
the idle Coal Coast ending lets Priya and Sam and Jordan read `mixed`; the idle town loses 3 animals, not 4; the city's
forgiveness ordering allows two more passing variants than the hard scenarios; Reef Island goal text (tourism 55).
Thoughtful runs still win on every seed (River Town 61.9 to 95 river health, Reef Island 51 to 76) and idle still loses.

**Play time** (`tests/helpers/playtime.ts`, thoughtful run): valley 35, coal 114, river 93, red 99, reef 89, city 97
minutes against the declared bands (28-38, 100-115, 80-110, 80-110, 75-105, 85-120): all inside. The map-size term of the
estimator (half a minute a decade for every extra 1024 tiles) is now 11 to 15 minutes of panning and reading; the brush
tools below take clicks away, but the estimator does not count the clicks it saves, so it stays as an allowance.

**Camera.** The home view no longer frames the whole slab: `CameraRig.home` frames `FRAME_HALF` (22) tiles round the town
(`townFocus` in `sim/roads.ts`: the city centre, the centre of the non-road buildings, or the water hub on a fresh map),
the scale a 40x40 map had. The home button and `F` toggle between that and the whole map, `H` goes back to the town. Pan
limits are the map (plus a tile); max zoom is 2.6 x the map size. The title screen backdrop is the Coal Coast estuary at
the same framing.

**Render and performance.** The terrain is cut into 16x16 tile meshes sharing one set of vertex arrays (`buildTerrain`
returns `chunks`; the whole surface stays for the overlay and the grid and is the one edits are written to), so the camera
culls the ground it cannot see (little gain at the default view, which still sees most of a 64x64 map; it pays when zoomed in).
The lite tiers draw a map over 48 tiles one terrain step coarser (`terrainResFor` in `mapgeo.ts`: Very low 1 segment a tile,
Low 2), which is what keeps Very low's frame time within 0 to 16% of the old maps' on the proxy. Shadows (Medium and up) cover a 34-unit window that follows the camera on maps bigger than
that, so the shadow map keeps its detail. `GameRenderer.debugTris()` / `__cc.tris()` give the triangles the camera sees per
scene-object name. Season cost: `ripFraction` and `buildRestoreCtx` scanned a 5x5 / 7x7 neighbourhood of every tile each
season (about half of River Town's 23 ms); `dilate` in `sim/grid.ts` does the same in O(tiles) and a season now takes
0.6 to 5.2 ms on every scenario (2.2 to 23 ms before). Proxy numbers are in `docs/reviews/perf-chromebook-proxy.md`.

**Brush tools** (`BRUSH_SPACING` in `ui/toolbar.ts`, `paintStep` in `ui/app.ts`): hold the mouse and sweep to place a row
of cottages, rooftop solar, street trees, seawall or wildlife crossings (every tile), or native plant nurseries (7 tiles
apart), coral nurseries (6), wetlands and phytoremediation beds (4) along the stroke. Rehabilitation (Red Dirt),
co-management and cool burns already act on a whole patch per click. Touch still places one piece per tap.

**Saves.** Still version 4; a save keeps the grid it was made on (a 40x40 Coal Coast save loads and plays on this build,
checked for all six scenarios at their old sizes). The camera frames a loaded game on its town.

## Known issues

- **Content consultation** (above) is still outstanding now that the game is public.
- Act 2 money: Coal Coast and Reef Island still bank money in the last decades; community projects now give it a
  use (about $1.7M of rounds in all), but the scripted balance players do not use them, so their effect on balance is
  untested beyond unit tests.
- River Town's drought plan is reactive in the scripted player (switched on at the first declared drought). The
  plan's banking only helps when switched on before dry years; the teacher page and policy text say so.
- The Act 2 clock widget is not refreshed by the debug-only `__cc.game.debugTick` while paused (it catches up on the
  next real tick). Players never see this.
- `vite build` warns that the main chunk is over 900 kB (three.js + post-processing); it loads once and is cached.
- Phones work at 375 px but are cramped; a laptop is the intended device.
- Reflection answers and the letter are not saved or exported.

## Next steps

1. AECG / Local Aboriginal Land Council consultation on all `needsConsultation` content, then revise text and names.
2. Classroom pilot with one Year 9 class: watch where students get stuck (QA estimates are adult driver-based).
3. Optional: export the Report Card and reflections as a printable page or PDF for assessment.
4. Optional: let the scripted balance players fund community projects, and add a balance band for them.
5. Optional: code-split three.js post-processing to shrink the first load on slow school networks.

## Deployment

- `.github/workflows/deploy.yml` runs `npm ci`, `npm test`, `npm run build` and deploys `dist/` to GitHub Pages on
  every push to `main` and on manual dispatch. `vitest.config.ts` gives the scripted playthroughs a 60 s timeout for
  slower CI runners.
- The owner approved going live on 2026-10-21 (commit 1f5244d switched the push trigger on) and the repository
  `irvincisneros-png/carrying-capacity` is public. **Pushing to `main` publishes to students**, so run the three
  checks first and keep work-in-progress on a branch.
- The Aboriginal and Torres Strait Islander content is still a draft pending consultation (see above); the teacher page
  says so, and it should stay flagged until the consultation is done.
- `vite.config.ts` sets `base: '/carrying-capacity/'`, so the site lives at
  `https://irvincisneros-png.github.io/carrying-capacity/`; `teacher.html` sits beside `index.html`.
