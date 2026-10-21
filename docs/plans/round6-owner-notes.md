# Round 6: owner's Green Valley notes (2026-10-21)

The owner played Green Valley and gave these notes. Each work package (WP) below answers one or more of them.
GAMEPLAY.md stays the authoritative design; update it where a WP changes a rule.

## The notes

1. Some bushes show black spots before they finish loading.
2. The map should be much larger. Render detail only for what is on screen.
3. The town feels sparse: houses and roads, but no people going about their lives.
4. Roads do nothing: no moving cars, and nothing has to be connected.
5. Roads look odd going up and down hills.
6. Do I have to press Next decade to make money? (A question only. No change unless the owner asks.)
7. Could the farm windmills turn?
8. The Brick suburb has its own road strip, which does not line up with the roads I build.
9. I only learn what the town needs from pop-ups.
10. Act 1 has little Environmental Sustainability. There is one creek-pollution card, and choices carry no money stakes.
11. The 1960 intro says "heal the valley" while the land is untouched, which is a contradiction.

## Hard constraints (all WPs)

- Art style B "painterly toon" is approved. Building outlines stay Off or Subtle, never bold or black.
- The draft Aboriginal and Torres Strait Islander content stays gated behind `?draft`.
- The sim stays pure and deterministic. New state goes in `flags` or optional fields so old saves keep loading (save version bump only if unavoidable, with a migration and test).
- The graphics tiers (Very low to Ultra) must all still work. Very low must not get slower.
- `npx vitest run`, `npx tsc --noEmit -p .` and `npx vite build` must be clean. Balance tests may be re-banded only with a recorded reason in the test comment.
- Australian English, Year 9 reading level for any player-facing text.
- Commit on your branch with clear messages. Do not push.

## WP1: Renderer — visible-area detail, loading, roads on slopes, windmills, suburb street (notes 1, 2-render, 5, 7, 8)

- **Chunked vegetation with culling.** Split the vegetation `InstancedMesh` sets into spatial chunks (for example 8x8 or 16x16 tiles) so each chunk is frustum-culled (set real bounding spheres; remove `frustumCulled=false` where chunked). Add distance LOD: chunks far from the camera target draw a thinned subset (for example every second instance) on Low and below, full on High and above. Do the same for the baked road mesh if it is large. Aim: a 72x72 map at Medium costs no more per frame than today's 48x48.
- **No black spots.** Warm up every vegetation and building material at load (`renderer.compileAsync(scene, camera)` or an equivalent pre-compile with one dummy instance per species), and do not show a vegetation chunk until its instances are written. Confirm by reloading Green Valley several times at High.
- **Roads on slopes.** Roads must read as graded roads, not ramps that break at the tile edge. Preferred approach: flatten and smooth the terrain under road tiles (a gentle grade between neighbouring road tiles, blended into the surrounding terrain) and drape road pieces per vertex with enough segments to follow it, with no gaps between the hub and the arms. Check on the Green Valley hills and the Coal Coast escarpment.
- **Farm and bore windmills turn.** Split the windmill wheel into a rotor entry like the wind turbines (`q.rotors`) so it spins with the Act 2 wind multiplier (a gentle steady speed in Act 1). On Very low, keep it static.
- **Suburb street lines up.** The Brick suburb (and `greensuburb`, which reuses it) gets a flat street, with no sine wobble. On placement the model orients its street toward an adjacent player road if there is one (render-side choice from neighbours; do not change the sim footprint). The street meets the tile edge at the same width and height as a player road, and the road autotile treats that edge as connected, so a player road running into the suburb joins its street.

Files: `src/render/**` only (plus `src/sim/types.ts` constants only if needed). WP2 later adds moving traffic in `src/render`. Leave a clean hook for a per-frame ambient update.

## WP3: Roads matter (note 4, sim side)

- **Road access.** A building works only if a tile edge-adjacent to its footprint is a road (or rail siding for mines and industry) that belongs to the road network connected to the town's **entrance**. The entrance is a road tile on the map edge that every scenario starts with (add one where missing, on Land, toward the likely town site; prebuilt towns already have roads).
- Unconnected buildings: homes house no one, workplaces fill no jobs, power stations supply nothing, and money and pollution follow from that. Exempt: roads, rail, nature and restoration items, wildlife crossings, offshore and water buildings, rooftop solar (it sits on homes), and anything whose description already says it needs no road. Put the exemption on the building def (`needsRoad: false`) rather than a hard-coded list.
- Compute connectivity once per state change (flood-fill from the entrance over road and rail tiles) and cache it by `version`. It must be cheap on a 72x72 map.
- Expose `roadAccess(state)` in the sim: the set of connected buildings by uid, plus the list of unconnected ones. The UI will show a "no road" marker and a demand warning from it (WP4).
- **Commute emissions (small, for teaching).** Each decade (Act 1) and year (Act 2), transport CO2 = population x the mean road distance from homes to the nearest jobs (BFS over the road graph, capped) x a small factor. Calibrate it so the scripted players' cumulative emissions stay within about 5 percent of today's (reduce cottage and suburb `co2` to compensate if needed). Buses, rail and bike paths (where they exist) cut it. Report it as its own row wherever emissions by source are listed.
- **Tutorial.** The Green Valley "Build 2 roads" step becomes "Connect your homes and farm to the road from the edge of the valley". Its check uses `roadAccess`.
- **Scripted players and tests.** Every scripted player in `tests/helpers/` must now connect what it builds. Add one shared helper, `connectToEntrance(state, uid)`, that lays the shortest road path. Add tests: unconnected buildings give nothing, connecting them restores them, connectivity across a broken road, entrance present in every scenario, and an old save without entrance roads still loads (add the entrance on load if missing). All balance bands keep passing.

Files: `src/sim/**`, `src/content/**` (building defs, tutorial), `tests/**`. Do not touch `src/render` or `src/ui` beyond the tutorial text.

## WP5: Act 1 sustainability with money at stake, and goals that make sense (notes 10, 11)

- **Act 1 goals.** Each scenario's Act 1 gets its own short goal list, shown in the 1960 (start) intro instead of the Act 2 goals. For Green Valley: "Grow the valley to N people with jobs and power by 2020" and "Grow without wrecking it: keep Environment at 60 or more" (bonus). Act 2 goals are hidden until the turning point (where they are already explained). The Act 1 bonus earns a star on the final report card, or a visible badge if the star count must stay the same. The intro text says the real test comes later without listing those goals.
- **Healing goals respect a careful Act 1.** Where an Act 2 objective is "Environment >= X", a player who kept the valley healthy in Act 1 starts closer to it. This needs no rule change, but say so on the turning point: "You kept the valley in good shape, so healing it is easier."
- **Building upgrades (all scenarios).** Add an upgrade option in the Inspect panel for selected Act 1 buildings. Each upgrade has a cost, sometimes an income change, and a clear environmental effect:
  - Factory: smoke scrubber. Cuts air pollution 60 percent and does **not** cut CO2. Teach the difference between local pollution and greenhouse gas.
  - Farm: creek buffer of fenced native trees. Cuts water pollution and erosion, with slightly lower income.
  - Coal power station: dust and sulphur filters. Cuts air pollution, not CO2.
  - Landfill: lined cells and gas capture. Cuts soil and water pollution and some CO2.
  - Coal mine: dust suppression. Cuts air pollution.
  Store upgrades on the building record as an optional field, or in `flags` keyed by uid.
- **More Act 1 cards for Green Valley (about one per decade, 1960s to 2010s), each with real money on both sides and evidence.** Suggested set (keep the existing factory-waste card):
  - Clear the hillside for a bigger farm: income up, bush lost, erosion into the creek.
  - Fertiliser deal: farm income up, algal bloom risk in the creek.
  - Cheap tip by the creek versus a proper lined landfill.
  - Dry year: pump the creek for the farms, or water restrictions and keep a flow for the platypus and fish.
  - Solar is getting cheaper: an early rooftop rebate costs now and saves later.
  Each card's consequence must be **visible** (creek colour, fish and bird counts, a resident's line).
- **Decade report "what it cost" ledger.** Next to money earned, show the decade's environmental change: bush lost, creek health, air quality, CO2 added, wildlife counts. Students should see the trade they made.
- Check the other five scenarios' Act 1 decks still schedule correctly. The upgrades apply to them automatically.

Files: `src/content/**`, `src/sim/**` (upgrade effects, Act 1 goal evaluation), `src/ui/**` (Inspect panel upgrades, intro goal list, decade-report ledger), `tests/**`. Coordinate with WP3: WP3 owns road and connectivity code, so do not edit `economy.ts` road logic. Keep upgrade and goal code in new files (`src/sim/upgrades.ts`, `src/sim/act1goals.ts`) where possible.

## Later (after WP1, WP3 and WP5 merge)

- **WP2 moving traffic and people.** Cars drive along the connected road network between homes and workplaces; pedestrians walk near homes, shops and parks; cyclists appear on bike paths. Counts scale with population, jobs and quality tier, all in one instanced mesh with a per-frame update. Era-aware vehicles.
- **WP4 demand bars.** A persistent HUD block: Homes, Jobs, Power (and Water where used) as small bars, plus "N buildings have no road" with a locate button. Replaces the need to read pop-ups.
- **WP6 larger maps.** Green Valley 32x32, Coal Coast, River Town, Red Dirt and Reef Island 64x64, Net Zero City 72x72, using the existing `s = min(w,h)/original` scaling. Re-check the scripted players, the play-time estimates and the Act 2 click counts (add brush tools where restoration needs many clicks).

## Note 6: should time run continuously, as in Cities: Skylines?

This was a question; the answer was given to the owner in chat. No change is planned unless the owner asks for one.
