# Zoning spec (Cities: Skylines-style, hybrid)

Owner-approved direction (2026-10-26). Homes, shops and offices, and light industry are **zoned** and grow by
themselves. Big environmental decisions stay as **placed buildings**. Build on branch `zoning` and never push to `main`
(pushes to `main` go live to students).

## Goals

1. **Fewer clicks.** The 64x64 and 72x72 maps should feel like a city builder: you drag zones and the town grows.
2. **The density lesson** (Year 9 Environmental Sustainability).
   - Low-density sprawl clears more bush, adds more road (which splits habitat), and makes commutes longer, so CO2 is higher.
   - Compact, higher-density zoning saves land, but needs transit, parks and power, and brings more urban heat in Net Zero City.
   - Students must be able to see this trade.
3. **A living town.** Demand bars drive growth, roads matter, and buildings appear with a short scaffold, then built, animation.

## What is zoned and what stays placed

| Zoned (painted, grows itself) | Placed (as now) |
|---|---|
| Residential: low, medium, high density | Farms, mines, factory, steelworks, port, landfill, outfall |
| Commercial: shops and offices | All power stations, batteries, hydro, rooftop solar (on homes) |
| Light industry: workshops, depots | Roads, rail, bridges, transit lines, carpark/highway |
| | Everything in Act 2 restoration, plus the data centre and community buildings |

Legacy `cottage`, `suburb` and `greensuburb`:
- Keep their definitions so old saves load.
- Remove `cottage` and `suburb` from the Act 1 build menu in new games.
- `greensuburb` (the Act 2 retrofit) becomes an **upgrade action on grown residential tiles**. Keep the placeable version only for old saves.

## Sim model (pure and deterministic, in `src/sim/zoning.ts`)

### Zones and growth

- **Zone state.**
  - Per tile: `g.zone[i]` is a Uint8 (0 none, 1 R-low, 2 R-med, 3 R-high, 4 commercial, 5 light industry), added to the grid with save migration (absent means 0).
  - A grown building is a normal `PlacedBuilding` with a new type per zone and density (`zres1`, `zres2`, `zres3`, `zcom`, `zind`). It has `grown: true` and is 1x1.
  - Existing economy, energy, pollution, road access, commute and ledger code then works unchanged.
- **Where you can zone.**
  - Land or Bush tiles with no building, within **2 tiles of a road tile** (Chebyshev distance).
  - Zoning Bush is allowed. The bush is cleared only when a building actually grows there; that is the sprawl cost, and it goes through the existing clearing path (land CO2, Environment).
  - Not on contaminated soil above 0.6, sacred or `needsConsultation` places, wetlands or water.
- **Zoning cost.** About $0.3k per tile, scaled by `budgetMult`. Dezoning is free. Dezoning a grown tile demolishes its building (with confirmation in the UI).
- **Growth.** It runs once per year, in Act 1 `advanceYear` and in the Act 2 year end.
  - Demand comes from `demandBars` / `computeDemand`: residential demand is jobs minus workers plus a small base; commercial demand is a share of the population; industry demand comes from the export base (factories, port, mines).
  - The number of tiles to grow per zone type this year is `min(cap, ceil(demand / per-tile capacity))`. The cap scales with map size, so a 64x64 map can grow about 8 tiles a year early on.
  - Which tiles grow is deterministic: road access first (`roadAccess` connected), then distance to the town centre (mean of connected buildings), then tile index. Ties are broken with `seasonRng(seed, yearIndex, salt)`, never `Math.random`.
  - A zoned tile grows only if it is road-connected, powered (once the grid year has passed) and has demand. Otherwise it records a **reason** for the UI: `no-road`, `no-power`, `no-demand`, `no-water` (Red Dirt) or `too-polluted` (soil, air above a threshold).
- **Building numbers per tile** (starting values; tune in the balance pass):

| Type | Housing | Jobs | Power | CO2 | Notes |
|---|---|---|---|---|---|
| R-low | 20 | 0 | -1 | 1 | 1 tile per 20 people: the most land per person |
| R-med | 50 | 0 | -2 | 2 | needs the era 1950+ |
| R-high | 120 | 1 | -4 | 4 | needs 1970+ and a road plus transit, or rail within 4 tiles, to grow past 50% fill; +heat in Net Zero City |
| Commercial | 0 | 15 | -2 | 3 | income bonus +10% per job versus the base job value |
| Light industry | 0 | 20 | -3 | 6 | local air pollution 0.5 |

- **Era variants.** The renderer chooses the variant; the sim stores only the type.
  - R-low: cottage before 1950, brick bungalow after.
  - R-med: semi-detached and townhouses.
  - R-high: walk-up flats from 1970, apartments from 2000.
  - The building record stores its `builtYear`.
- **Decline (light).** If a grown tile has no power or no road for 3 years in a row, it empties: it gives no housing or jobs and the model is shown boarded up. It recovers when the cause is fixed. There is no demolition by the sim.
- **Commute.** Raise the commute CO2 factor so it teaches. The aim: in Green Valley, an all-R-low sprawling town has visibly higher Transport CO2 (+15-25%) than a compact mixed one of the same population. Stay inside each scenario's balance bands.

### Act 2

- Zoning stays available in Act 2.
- New growth uses the same rules.
- "Retrofit homes" becomes an action on grown residential tiles, applied in a dragged area, with the effects of the current `greensuburb`.

### Net Zero City

- Its prebuilt city stays as placed buildings.
- New zoning adds growth around it.
- R-high adds a little to the city heat mechanic, and parks cancel it, using the existing heat module.

## UI and render

- **Zone tool.** A new build category "Zones" holds:
  - Homes (with a density picker: Low / Medium / High)
  - Shops and offices
  - Light industry
  - Dezone

  It drag-paints rectangles, reusing the drag-paint in `src/ui/app.ts`. The cost is shown live while dragging.
- **Zone overlay** while the tool is active: soft painterly tints, never harsh.
  - Green for residential, blue for commercial, ochre for industry.
  - Hatching for tiles that cannot grow.
  - Hovering a tile shows its reason ("Waiting for power", "No road reaches here", "No one needs more shops yet").
- **Growth feedback.**
  - A grow animation: a scaffold frame for about 1 s, then the building.
  - One calm line per year in the Log, e.g. "14 homes grew near the creek because jobs were waiting."
  - A Town needs drawer line for each blocked reason, with a Locate button.
- **Models.** These live in `src/render/models/`, in the approved painterly toon style B. Outlines are Off/Subtle only, never bold or black.
  - Each type has two or three variants, era-aware, facing the nearest road.
  - Instance through the existing batch so that 2,000+ grown tiles stay fast at Very low; check with `tools/perf-proxy/bench.mjs`.
- **Demand bars.** They now say what to zone: "Homes needed: zone more Residential".
- **Inspect panel** on a grown tile shows the zone, density, built year, people and jobs, the reason if it is blocked, and a density upgrade button. Upgrading costs a little, is allowed only if the era allows it, and swaps the building on the next growth tick.

## Teaching hooks

- **A "Land per person" stat** in Town needs and the decade ledger: hectares of cleared land per resident, plus road tiles per resident.
- **Two new cards across the scenarios with an Act 1.**
  - "A developer wants to subdivide the bushland on the ridge":
    - money now, sprawl later
    - or "build up near the station instead", which costs more but saves bush
  - "Residents oppose flats next door" (no clean answer): density versus local character.
  - Both cards need evidence text with sources. Use the existing schema; the "who wins, who loses" line is required.
- **Report card line** on the town's footprint: land per person and how it compares with a compact town.
- **Field guide terms:** urban sprawl, density, urban heat island.

## Tutorial (Green Valley)

Rewrite the Act 1 tutorial steps that place cottages so that they zone instead:
- "Zone some homes beside the road (drag)".
- "Watch them grow: press play".
- "Zone a few shops".
- The farm, factory, coal station and mine steps stay as placed buildings.
- Every step must latch, using the existing `latchTutorial`.

## Tests (write these first; the work is done when they pass)

- **Zoning rules:** zoning cost; the 2-tile road rule; tiles that cannot be zoned; dezoning a grown tile.
- **Growth determinism:** the same seed and actions give an identical state, and 10x `advanceYear` equals `advanceDecade`.
- **Growth gating and reasons:** no road, no power, no demand, era limits on density.
- **Sprawl lesson:** in Green Valley at the same population, an all-R-low town clears at least 30% more bush tiles and has higher transport CO2 than an R-med/high plus commercial town.
- **Decline:** a tile empties after 3 years without power and recovers when power returns.
- **Saves:** old saves (no `zone` array, legacy cottages) load and play; new saves round-trip.
- **Scripted players:** every scenario's thoughtful player now zones instead of placing homes, using a shared helper `zoneArea(state, rect, kind)` in `tests/helpers/zoning.ts`.
  - The thoughtful runs win on every event seed, and the idle runs lose.
  - Balance bands are re-banded only with a recorded reason.
  - Play-time estimates stay inside each scenario's `playMinutes` (`tests/helpers/playtime.ts`; zoning should *reduce* click counts).
- **Checks:** `npx tsc --noEmit -p .`, `npx vitest run` and `npx vite build` are all clean.

## Phases (commit and push to `zoning` after each; keep a draft PR updated)

1. **Core sim and Green Valley.**
   - `zoning.ts`: zone grid, zone action, growth, reasons, decline.
   - Residential and commercial.
   - Green Valley tutorial and scripted player.
   - Basic models and the zone tool and overlay.
   - Tests.
2. **All scenarios.**
   - Light industry, density upgrades, Act 2 zoning and retrofit-as-upgrade, Net Zero City heat hook.
   - All scripted players and the balance pass.
   - Performance check on 64x64 and 72x72.
3. **Teaching and polish.**
   - Land-per-person stat, the two cards, report card line, field guide terms, growth feedback lines, era variants, grow animation.
   - Screenshots of every scenario at 1366x768 and 375x812 in `docs/screens/zoning-*.png`.
   - Update `docs/GAMEPLAY.md` and `docs/HANDOVER.md`.

## Constraints

- **Read first:** `docs/HANDOVER.md`, `docs/GAMEPLAY.md` (authoritative), `docs/ART-DIRECTION.md`, `docs/plans/round6-owner-notes.md`.
- **Draft content stays gated.** Draft Aboriginal and Torres Strait Islander content stays behind `?draft` and keeps `needsConsultation`.
- **Text:** Australian English at a Year 9 reading level.
- **Sim:** pure and deterministic; new state goes in optional fields or `flags`.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **PR body** ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Never** push to `main`, merge the PR, or deploy.
