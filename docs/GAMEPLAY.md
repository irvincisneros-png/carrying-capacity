# Carrying Capacity — Full Gameplay Design

Supersedes the Act structure details in DESIGN.md where they differ. Owner requirements: fun enough that students and adults *want* to play; 5+ scenarios, each a clear achievable goal in **1–2 hours**; implicitly builds **empathy and care** for people, creatures and the planet (school HPGE focus: social-emotional + intellectual — never labelled in-game).

## 1. Shape of a scenario (≈60–120 min)

| Phase | Time | Pace | What happens |
|---|---|---|---|
| Prologue | 2 min | cutscene-lite | Meet the place: camera fly-over, 3 resident voices introduce themselves |
| Act 1 Boom | 15–25 min | decade turns | Build the town to the present. Cheap = dirty. Graphs climb. Residents prosper, the bush and reef quietly decline |
| Turning point | 3 min | story beat | A crisis lands (fish kill, bushfire, flood) that a resident is personally hurt by; the scientist character shows *your* graphs. Act 2 objectives appear |
| Act 2 Transition | 40–80 min | real-time years (pause/1×/2×/4×) | Clean → Restore → Circular tiers, Terra Nil-style, while keeping people OK. Events, choices, animals return |
| Epilogue | 5 min | reflection | 2100 Report Card, resident epilogues (where each person ended up), animal census, "Appreciate" fly-over, reflection prompts |

Act 2 time: 1 in-game year = 15 s at 1× (≈19 min for 2025→2100 at 1×; players pause and plan, so 40–80 min real). Autosave every year.

## 2. Core systems (Act 2)

**Energy grid.** Demand (homes, industry, transport) vs supply each season. Sources with real traits: coal (cheap, 0.9 t CO₂/MWh), gas (flexible, half the CO₂), solar (day only, rooftops or farms), wind (variable, needs ridge/headland/offshore), hydro/pumped hydro (needs elevation drop), battery (shifts solar to night), tidal (scenario-specific). Blackout if supply < demand in peak season → Society hit + resident complaints. Teaches 4.2.5 advantages/limits by consequence, not text.

**Climate.** Town stands in for the world; global CO₂ follows emissions relative to a reference pathway (Station 1 model). Warming lags emissions (committed warming) so early action matters. Climate drives event probabilities: heatwave, bushfire weather, drought, marine heatwave (bleaching), storm surge × sea level.

**Pollution & remediation.** Per-tile air/water/soil fields (sim already has them). Remediation sites clean soil over *years* (phytoremediation cheap+slow; excavation fast+expensive+trucks emissions). Stormwater wetlands filter runoff. Fish kills when estuary water pollution + heat cross thresholds.

**Restoration & succession.** Tile health 0→1 grows through stages: bare → pioneer grasses → shrubs/heath → woodland (or mangrove/saltmarsh/seagrass by tile kind). Needs clean soil, water, seeds (nursery range or adjacency to healthy tiles — natural spread). Drought slows, weeds invade untended edges, hot fire resets. Volunteers (Society-linked) speed planting. The spreading restoration front is the signature visual.

**Wildlife.** Species with habitat needs (tile counts, connectivity, buffer from roads/industry): koala (eucalypt woodland ≥N, corridors), glossy black-cockatoo (she-oak), green turtle (clean beach + healthy seagrass + dark beach at night), little penguin or shorebirds (scenario), platypus (clean river), frogs (wetlands), flying-fox (heat-sensitive — heatwave die-offs). Populations shown as named families. Roads cause koala deaths unless underpasses/bridges built (corridor mechanic).

**Caring for Country.** Partnership with the local Aboriginal community via the Elder character: unlocks cultural burning (mosaic cool burns that cut wildfire risk and boost regeneration), seasonal harvest protocols for fisheries, firestick knowledge events, dual naming of places. Partnership grows through respectful choices (consulting before building on significant sites, returning land management) — never purchasable. **Content needs AECG/Local Aboriginal Land Council consultation before release; placeholder text flagged.**

**Circular economy (endgame tier).** Every Act 1 building must be dealt with via the waste hierarchy: *repurpose* (steelworks → green-steel plant or museum + makerspace; coal loader → wind-turbine port; landfill → solar farm), *deconstruct & recycle* (materials return budget), *landfill* (worst, emissions + stars penalty). Recycling innovations research tree (4.4.5): e-waste recovery, tyre-to-road, plastic-to-fuel critique, green steel (hydrogen DRI), compost from food waste.

**Satellites.** Purchase unlocks overlays: sea-surface temperature, sea level, forest cover, ice/fire scars. Some threats (marine heatwave building offshore) are invisible without them → early warning (4.3.4).

**Weather vs climate HUD.** Daily weather icon + season; separate 30-year climate trend line (4.2.1). Greenhouse "atmosphere lens" overlay (4.2.3).

## 2b. Roads matter (Round 6)

**The rule.** Every scenario starts with an **entrance road**: one road tile on the edge of the map, on open land and away from the shore, with a country road already running in from it to where the town will grow (the open tile nearest the creek, estuary or river; Net Zero City's finished road grid is joined to it). A river or the sea that cuts a big stretch of land off from the rest gets an entrance of its own, because there are no bridges. A building **works only if a tile edge-adjacent to it is a road that is joined, tile by tile, to an entrance.** Mines, ports, steelworks, factories and coal power stations also accept a **rail siding** that is joined to the entrance (rail carries coal and goods, not commuters). The entrance road cannot be demolished. Taking out a road, or a rail siding a building was relying on, cuts off everything that needed it until it is joined up again.

**Unconnected buildings give nothing.** Homes house no one, workplaces fill no jobs, power stations supply no power and use none, and a building that is not running adds no emissions and no local pollution. Money, Society and Environment follow from that. `roadAccess(state)` lists the connected and unconnected buildings (cached by `version`, one flood fill over the road tiles) so the interface can mark them "no road" and warn about them (planned demand bars, WP4).

**Exempt** (the building def says `needsRoad: false`): roads, rail sidings, highways (they come with their own ramps), wildlife crossings, light rail (it has its own right-of-way), nature and restoration items (phytoremediation gardens, stormwater wetlands, nurseries, coral nurseries, parkland), offshore wind and tidal turbines, fishways, seawalls, sewage outfalls and treatment plants (a plant replaces an outfall on the shore) and water bores. **Rooftop solar** needs no road of its own but works only while a working home is beside it. Everything else needs a road.

**Roads and the land.** A road costs $1 a tile. In Act 1 it may cross bush (the bush is cleared, as for any building). In Act 2 bushland is protected, with one exception: **a road may still cut through regrown bush**, so a cleared site beyond the bush can be joined to the town; that bush is lost and releases CO2 like any clearing. Routes the interface or a script plans prefer open ground, and go round places of cultural significance and Red Dirt's mine site if they can.

**Commuting.** Each decade (Act 1) and each year (Act 2, a tenth of the decade figure) the town adds a small transport emission: population x the mean road distance from working homes to the nearest workplace (a breadth-first search over the connected road network, each commute capped at 24 tiles) x 0.0012 kt per person-tile. A compact town with homes near jobs emits less; each light-rail line cuts it by 12 percent, up to 60 percent. It is part of the Transport total and is also reported on its own: `commuteKt` and `commuteTiles` in decade reports, `commuteKt` in history and year records, and a "Commuting" row in the emissions-by-source list (Net Zero City's goals panel). For the scripted players it comes to 0.1 to 0.5 percent of their cumulative emissions (Coal Coast cautious: 9 kt of 3,691; Net Zero City: 31 kt of 15,213), well inside the 5 percent allowed, so cottage and suburb CO2 were left as they were.

**Old saves** have no entrance, so one is added on load (with its country road). The town's buildings then need roads like any other, and the town works again as soon as they are joined to it.

## 3. Empathy layer — people and creatures you care about

**Residents (5–7 per scenario), recurring across decades as families:** each has a portrait, name, family, job, home tile, mood (0–100) and a short story arc with 3–5 beats triggered by player actions/events. Examples for Coal Coast:
- **Mick Kowalski**, steelworker, Polish migrant family since 1950s. Fears losing his job if the steelworks closes. Arc resolves well if the player funds a transition program (green steel / wind port jobs), badly if closed abruptly.
- **Lena Tran**, fisher. Her catch tracks estuary health; fish kill is her crisis. Her daughter becomes a marine scientist in the good ending.
- **Aunty June** (placeholder name pending consultation), Elder. Teaches cultural burning and seasonal knowledge when trust is built; her family's story spans the whole timeline.
- **Priya Shah**, climate scientist at the local uni; explains graphs (the "science voice").
- **Sam & Jordan**, kids who grow up across Act 2; their questions/letters are the reflection hook ("Will there still be turtles when I'm old?").
- **Dot Harris**, dairy farmer; drought and runoff trade-offs.

**Mechanics:** resident moods feed Society; speech bubbles on the map; a "Town Voices" feed; decisions show who is helped/hurt *before* you confirm (perspective-taking preview). No villains — every resident is reasonable from where they stand.

**Creatures:** named animal families (e.g. the koala "Marri family", turtle "Old Shelly" who returns each nesting season if the beach is OK). Their fortunes are visible, mourned when lost, celebrated when they return. Census in epilogue.

**Dilemma cards** (2–3 per in-game decade in Act 2): short scenario, 2–3 options, each with trade-offs across people/planet/economy and a "What does the evidence say?" button. Evidence-based choices are rewarded but some dilemmas have no clean answer (intellectual + ethical reasoning).

**Reflection moments:** at the turning point and epilogue — 1–2 open prompts (shown, not graded), optional "letter to Sam & Jordan" text box exported in the report.

## 4. Scenarios (main five + tutorial)

| # | Scenario | Difficulty | Setting & hook | Main goal (all by 2100 unless stated) | Bonus star |
|---|---|---|---|---|---|
| 0 | Green Valley | Tutorial (20–30 min) | Small inland valley | Learn build, energy, restore, recycle with guided steps | — |
| 1 | Coal Coast | Easy | Illawarra-style steel & coal town | Warming ≤1.8 °C · estuary healthy · every Act 1 building repurposed/recycled · Society ≥50 | Koalas & turtles thriving |
| 2 | River Town | Medium | Murray–Darling irrigation town | River health ≥60 · no town water failures after 2040 · farms still viable | Platypus returns |
| 3 | Reef Island | Hard | Tropical island town, reef tourism | Reef health ≥50 · no homes lost to sea · tourism economy survives | Turtles nesting every season |
| 4 | Red Dirt | Hard | Outback mining town | Net zero by 2060 · mine site fully rehabilitated on Country with Traditional Owners · water secure | 100% renewable grid |
| 5 | Net Zero City | Expert | Big coastal city, starts 2025 (no Act 1) | Net zero by 2050 · Society ≥60 every year · heat deaths prevented | Under budget |

Difficulty knobs (data-driven): budget, event frequency/severity, climate sensitivity, remediation years, weed/fire pressure, hint level, fail thresholds. **Fail state:** any meter at 0 for 3 consecutive years, or warming > scenario cap → "the town couldn't hold on" ending with what went wrong; restart from any autosave decade.

Stars: ★ goal met, ★★ + bonus, ★★★ + all residents' arcs resolved well.

Unlock order: Tutorial → Coal Coast → (River Town | Reef Island) → Red Dirt → Net Zero City. Teacher mode unlocks all.

## 5. Fun checklist (design guardrails)

- Every action gives immediate visual juice (pop, spread, birds, sound).
- Clear next objective always on screen; never stuck without a hint (hint level per difficulty).
- Meaningful choice > busywork: few building types per tier, each with a distinct role.
- Surprise and delight: rare events (whale migration, aurora-like algae glow, festival), residents' life moments (weddings, kids graduating).
- Speed controls + pause; undo for the last placement.
- Satisfying finale: Appreciate fly-over of the restored land with music swell.

## 6. Build order (replaces PLAN stations 2–8)

1. Art direction pick (style lab) → render layer for the map, buildings, trees, water, slab, restoration front, quality tiers Low/Med/High/Ultra.
2. Act 1 playable end-to-end in browser (HUD, build menu, graphs, decade reports, summary).
3. Act 2 core: real-time clock, energy grid, pollution/remediation, succession/restoration, events.
4. Empathy layer: residents, moods, dialogue/stories, dilemma cards, Town Voices.
5. Wildlife + Caring for Country + satellites + weather/climate HUD + greenhouse lens.
6. Circular tier + research tree + 2100 Report Card + epilogue.
7. Scenarios 0–5 content, terrain generators, balance passes (scripted playthrough tests per scenario).
8. Polish: audio, tutorial, title/scenario select, teacher page, accessibility, 375px, perf pass, Codex play-test review.
