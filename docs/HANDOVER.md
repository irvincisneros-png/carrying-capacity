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
  water restrictions), scenario mechanics (river, reef, outback, city heat), graphs with CSV export, and the learning layer (land limits meter, water field kit with predictions, cause chains, field guide, who wins and loses, My household, printable report; see GAMEPLAY.md section 9).
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

## Zoning (the town grows itself; phases 1 to 3)

Spec: `docs/plans/zoning-spec.md`; rules for players and teachers: `docs/GAMEPLAY.md` section 2c. Branch `zoning`, draft PR #1; **never merge or push to `main`** until the owner says so.

- **Sim** (`src/sim/zoning.ts`, pure and deterministic). `grid.zoning` is a Uint8 per tile (0 none, 1 R-low, 2 R-med, 3 R-high, 4 shops and offices, 5 light industry; absent in old saves, migrated in `save.ts`). A grown building is an ordinary 1x1 `PlacedBuilding` (`zres1`, `zres2`, `zres3`, `zcom`, `zind`) with `grown: true`, `builtYear`, and `blocked` / `empty` for the decline rule, so economy, grid, pollution, road access, commuting and the ledger need no special cases. Actions: `zone` (rectangle, with `zonePlan` for the live cost) and `retrofit`. `growZones(s, year)` runs from Act 1 `advanceYear` and the Act 2 year end: decline, density swaps, then growth by family (road access, then distance to the town centre, then `seasonRng`). `zoneReasons` (one reason per zoned tile, cached by version) and `zoneBlockers` feed the hover text and the Town needs drawer; `reasonTextFor` adds the council fee and the budget to "Waiting for money". `growthLine` writes the yearly Log sentence (a `story` event on the `growth` channel, kept out of Town voices). `fillFn` (`zonefill.ts`) halves high-rise homes without transit. `COMMUTE_KT` and `COMMUTE_OVERHEAD` (in `roads.ts`) make sprawl visible in transport CO2.
- **Land per person** (`sim/ledger.ts`): `landPerPerson`, `decadeCost` (adds `clearedM2` / `roadM` before and after, optional so old saves still show a ledger), `footprintOf` (`sim/report.ts`, the report card line). UI: `ui/townzones.ts` (the Land per person block and the "Zones waiting" lines with Locate, drawn in the Town needs drawer), two rows in `ledgerView` (`ui/act1.ts`), a footprint row in the report card (`ui/adapters.ts`).
- **Cards**: `content/dilemmas/zoning.ts` makes both cards per scenario from one factory (`PLACES` holds the speakers, place names and station cost; Red Dirt's is cheaper because its scripted town is tight). They sit at the end of each scenario's deck in `content/dilemmas/index.ts`.
- **UI**: `ui/zonemenu.ts` (pure words for the overlay, tooltips, drag cost and the Inspect panel), `ui/toolbar.ts` (Zones tab and density picker), `app.ts` (drag-paint, overlay codes, `locateTile`), `render/overlay.ts` (the soft wash, stopped at the waterline).
- **Render**: models for the five grown types are in `render/models/buildings.ts` (`ZONED_BUILDERS`, `modelVariant`: era bit from `builtYear`, mirror bit from the uid; `liteZone` is the 14 to 22 triangle version used on Very low; `buildScaffold` is the scaffold frame). `render/zonechunks.ts` merges settled grown buildings into one `Mesh` per 16x16 tile chunk (frustum-culled, rebuilt only when its chunk changes), and `render/buildings.ts` keeps buildings that are still growing (scaffold and pop, about a second; none on Very low) or being demolished in the animated batch. `render/roadmarkers.ts` draws every "no road" token with one instanced mesh (they were one Sprite, so one draw call, each).
- **Perf probes** in `tools/perf-proxy/bench.mjs`: `ZONES=n` adds n grown tiles (`ZTYPE=cottage` swaps the type), `CALLS=1` lists draw calls by object, `PROFILE=1` prints a CPU profile, `EVAL=js` runs a snippet, `HIDE=name,...` hides scene objects, `PANSPEED` sets the game speed while panning, and every run reports CPU time per frame for the renderer and GPU processes (`cpuPerFrameMs`), which stays steadier than fps when the machine is busy. Use your own preview port (`npx vite preview --host 127.0.0.1 --port <free port>`): other worktrees may already hold 8462.
- **Screenshots**: `node tools/zoning-shots.mjs all zoning` (server `npx vite --port 8480`, `BASE=http://localhost:8480/carrying-capacity/`) takes every scenario at 1366x768 and 375x812 with a zoned and grown town, the Land per person drawer and both cards, into `docs/screens/zoning-*.png`; `game` and `models` modes make the phase 1 shots.
- **Tests**: `zoning.test.ts`, `zoning-phase1.test.ts`, `zoning-phase2.test.ts`, `zoning-water.test.ts`, `zoning-phase3.test.ts` (land per person, the cards, the Log line, the fee text, glossary, era variants). Scripted players: `tests/helpers/zoning.ts`.

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

## Innovations and the data centre (WP9)

Extra cards live outside the regular decks: `inn-*` (Act 1 timeline, `content/innovations.ts`) and `dc-offer` (`content/dilemmas/datacentre.ts`), each with a scheduler in `sim/innovations.ts` (`offerInnovations` at the Act 1 decade turn, `offerDataCentre` at the Act 2 year end) that does not touch the regular cards' gap or per-decade count. `getDilemma` finds them; `dilemmasFor` does not list them. To add an innovation, add a card to `INNOVATION_CARDS` (last option "do nothing", `effects: {}`) and check `tests/innovations.test.ts`. The data centre is placed by the `build: 'datacentre'` card effect and read by `sim/energy.ts` (flat load), `mechanics/river.ts` (cooling water), `mechanics/outback.ts` (aquifer) and `mechanics/heatCore.ts` (heat). Scripted test players skip innovations and decline the data centre unless `WP9_POLICY` (tests/helpers/scen.ts) says otherwise. The scripted full-game runs are chaotic at the margin (a few dollars in Act 1 can move a layout and flip a goal), so after any change to card costs run the whole suite, not just the new tests.

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
- **Carrying capacity meter (WP8a)**: its per-tile renewals (river, wetland, bush, open land, fish, sea) are scaled by
  `landReachTiles / area` (`ScenarioDef.landReachTiles`, never above 1, set to the map sizes the meter was calibrated on: 40x40
  coal, river and red, 44x44 reef, 48x48 city, 340 tiles for the valley), so a town draws on the land within its reach and a
  64x64 map does not make overshoot impossible. **Field kit (WP8b)**: the water it samples is the river or estuary within 12
  tiles of a building, the bush lost is measured against `landReachTiles`, and soil/health are local. Coal Coast's river
  now runs beyond the town and reads healthy all game, so the field-kit test samples the estuary.
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
forgiveness ordering allows two more passing variants than the hard scenarios; Reef Island goal text (tourism 55). Script
changes (not bands): Red Dirt's thoughtful run now builds 2 reservoirs and switches town water restrictions to level 1
(its aquifer ended at 37.8 with the data centre accepted on conditions, the goal is 40); the city run co-manages up to 100
tiles and has 16 batteries and 6 transit lines as before; Coal Coast's field-kit test samples the estuary; the entrance and
cut-off-pocket tests moved to the new maps' coordinates (Green Valley's pocket is at (4,30)).
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

## Bridges and entrance roads (round 7)

The Road tool over a **River** tile builds a bridge ($6k a tile, at most 3 tiles of water, straight, open ground at both
ends; rules and messages in `src/sim/bridges.ts`, placement in `canPlace`). It is a `road` building on a River tile, so
`roadAccess`, the commute search, traffic, demolish and saves need no new type; the wildlife road buffer ignores road tiles on
water. `roadRoute` plans bridges (direction-aware Dijkstra `routeWithBridges`, a bridge tile weighs 8) only when cheaper than the
dry way round; `roadUnreachable` treats bridgeable river as land. Net Zero City keeps its old two entrances and dry roads
(`bridgesOn`). Renderer: `roadnet.ts` grades a deck between the banks (`Deck`, `BRIDGE_CAMBER`), `roadmesh.ts` `bridge()` draws
deck, parapets, pier and abutments (Very low: deck and abutments only), `MapGeo.driveAt` gives traffic the deck height.

**Entrance roads** now run to the open tile nearest the town site that is at least `ENTRANCE_CLEARANCE` (2) tiles from water, so
they never stop at the water's edge; land across a bridgeable creek is one region (one entrance, a pre-built bridge where the
site is across). Green Valley uses `entranceHint` (north edge, site south of the creek): the start shows the bridge.
`tools/dumpmap.ts <id> --game` prints roads (`+`), bridges (`#`) and entrances (`E`); `tools/bridge-shots.mjs` takes the screenshots.

**Re-bands (round 7, all reasoned in the test comments):** `DIRTY_ROADS` 1.5 -> 1 (dirty Coal Coast start 1.17 C, was 1.26),
dirty worst-case and tuning warming floors 1.25/1.2 -> 1.15, idle blackout floor 0.02 -> 0.005, "late" Act 2 delay 20 -> 25 years,
Reef thoughtful starfish control 1 -> 2 (seed 11 coral 47.6 -> 50.6), River Town idle farms < 50, Reef idle homes no longer
asserted lost, Reef no longer asserted stricter than River Town in `difficulty.test.ts` (its scripted island town is smaller and
forgives every version). Thoughtful runs still win on all seeds; idle still loses. Also fixed: `roadRoute` started routes from rail sidings for
buildings a siding cannot serve.

## In-game HUD (declutter pass, 2026-10-23)

Student feedback was "the window seems cluttered", so the HUD is now minimal and everything else is behind a sidebar rail.

- **Always on screen**: top-left bar (year, budget, people), a slim meter strip (Environment / Society / Economy as small bars; the number shows on hover, focus or tap, and for a moment when a meter moves by 2 or more), the clock (pause / play / 2x / 4x, with "Skip to end of decade" inside it in Act 1), the build tabs and cards, and Undo (on the tab row, only when there is something to undo). `ui/hud.ts`, `ui/act2.ts` (`Clock`).
- **Sidebar rail** (`ui/rail.ts`, `ui/rail.css`): icon buttons on the right edge (labels on hover, short text labels when the screen is wide and everything fits in one column; a second column when it is short; a menu button folds the whole rail). Each button opens ONE drawer beside the rail; click again, the X or Esc closes it (Esc closes a drawer before it drops the build tool). The drawers are the existing panels, re-hosted: `Rail.add({ id, panels: [el], run })` moves the panel element into `.railhost`, adds `.drawer` and an X, and watches the panel's `.open` class (so a panel opened from anywhere, such as `species.open()` or a toast, still closes the others and lights its button). To add a panel: build it with a `.panel-head`, register it in `App.buildRail()`, give it a `RailId` in `ui/badges.ts`, and add visibility in `App.updateRail()`.
- **Drawers**: Goals (Act 1 or Act 2), Town needs (demand text, bars, "N buildings have no road" + Locate, land limits, scenario readouts), Power grid, Town voices, Wildlife, Policies, Innovations and projects, Satellites, Caring for Country (still only where `countryActive`), Water field kit, Field guide, Graphs (also holds CO2 / warming, the weather-vs-climate line and the hazard chances), Event log. Plain actions: My household, Frame the map (F), Settings and help.
- **Badges and nudges**: `ui/badges.ts` (`computeRailBadges`, pure, tested in `tests/badges.test.ts`) decides which buttons get a dot or count and which pulse (urgent need, buildings with no road, a goal missed or at risk, power short, drought plan off, satellite warning, unread voices / terms / log). Act 1 goals only count as "at risk" in the last two decades (they all start at risk). The one-line "the town needs ..." message is a dismissible chip inside the clock panel, only while a need is urgent or buildings have no road.
- **Guide** (`TutorialOverlay` in `ui/scenario.ts`): a "Guide · step N of M" pill. Step 1 opens expanded and stays open until it is done; each later step opens for 6.5 s then folds to the pill; the pill pulses softly when a step is blocked. The tutorial highlight now points at the rail button (the More button on phones).
- **Toasts** (`ui/modal.ts`): two at most, bottom-left above the toolbar, capped at 5 to 7.5 s, duplicates replaced. Resident remarks no longer toast (they go to Town voices and the badge); the decade "The 2030s" toast is gone (the year is in the top bar and the numbers are in Graphs).
- **Phones (<= 700 px)**: the rail is a bottom-right More button and a bottom sheet of labelled buttons; drawers are bottom sheets.
- **Remembered per viewer** (`ui/prefs.ts`, localStorage `cc.ui.*`, always in try/catch): the last open drawer (`drawer`), the guide's pill state (`guide`), the rail folded (`rail`).
- **CSS**: `ui/rail.css` overrides the old fixed-position rules in `styles.css` / `learn.css` (those rules for `.rightcol`, `.act2btns`, `.learn-menu`, `.hud-right` are now dead and can be deleted). `--dock-h` and `--hud-bottom` are set from the toolbar and top bar heights (`App.watchLayout`) so toasts, the rail and the guide always clear them.
- **Checks**: `node tools/declutter-shots.mjs <prefix> --check` (server: `npx vite --port 8478`) takes the before/after shots and checks panel bounding boxes at 1280x720, 1366x768, 1600x900, 1920x1080 and 375x812, with toasts and with every drawer open. Shots are in `docs/screens/declutter-*.png`. `tools/cdp-shots.mjs` (WP8) still uses the old Learn menu and HUD selectors and needs updating before reuse.

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
- The water kit readings are a model tuned to sit near the NSW / ANZECC trigger values, not real measurements; the figures flagged as uncertain in `docs/research/wp8-wp9-facts.md` are worded cautiously in the game. Confirm the ANZG 2018 tables before the text goes to print.
- The land limits constants (`CAP` in `sim/capacity.ts`, `content/capacity.ts`) were tuned on the scripted players on the maps as they were; after a map is resized, re-run `tests/capacity.test.ts` and re-tune (the thoughtful runs must end under the line, the idle runs over it).

## Next steps

1. AECG / Local Aboriginal Land Council consultation on all `needsConsultation` content, then revise text and names.
2. Classroom pilot with one Year 9 class: watch where students get stuck (QA estimates are adult driver-based).
3. Done in Round 6 (WP8): the report, reflections and household choices print from the end screen. Remaining idea: a teacher view that collects them from a class.
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
