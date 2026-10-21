# Carrying Capacity — Full Gameplay Design

Supersedes the Act structure details in DESIGN.md where they differ. Owner requirements: fun enough that students and adults *want* to play; 5+ scenarios, each a clear achievable goal in **1–2 hours**; implicitly builds **empathy and care** for people, creatures and the planet (school HPGE focus: social-emotional + intellectual — never labelled in-game).

## 1. Shape of a scenario (≈60–120 min)

| Phase | Time | Pace | What happens |
|---|---|---|---|
| Prologue | 2 min | cutscene-lite | Meet the place: camera fly-over, 3 resident voices introduce themselves |
| Act 1 Boom | 15–25 min | real-time years, report each decade (pause/1×/2×/4×, skip to end of decade) | Build the town to the present. Cheap = dirty. Graphs climb. Residents prosper, the bush and reef quietly decline |
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

## 7. Act 1 goals, upgrades and the cost ledger (Round 6, WP5)

Owner notes: Act 1 had little Environmental Sustainability and no money at stake in its choices, and the 1960 intro said "heal the valley" while the land was untouched.

**Act 1 goals.** Each scenario with an Act 1 has its own short goal list (`ScenarioDef.act1`, judged by `sim/act1goals.ts`). The start intro shows it in place of the Act 2 goals, a small Goals panel keeps it on screen through the boom, and the Act 2 goals stay hidden until the turning point. The intro says the real test comes later without listing it. Goals are judged on the state when Act 1 ends and written to `flags['a1.*']`, so Act 2 changes cannot undo them and old saves (no flags) simply show no badge.

| Scenario | Grow goals (by the end of Act 1) | Bonus: "grow without wrecking it" |
|---|---|---|
| Green Valley | 200 people, 120 of them in jobs, power for every building (by 2020) | Environment 60 or more |
| Coal Coast | 900 people, 800 jobs | Environment 33 or more |
| River Town | 350 people, 300 jobs, power | Environment 55 or more |
| Reef Island | 200 people, 180 jobs, power | Environment 55 or more |
| Red Dirt | 450 people, 400 jobs, power | Environment 52 or more |

The bonus earns a "Careful builder" badge on the report card. **Stars do not change** (that keeps unlocks and the star bands as they were). The turning point acknowledges a careful Act 1 ("You kept the valley in good shape, so healing it is easier"); no rule changes, because a healthier map really does start closer to the Act 2 Environment goals. Environment at the end of the boom is low in every scenario even for a good player (the Environment meter also counts warming), so the bonus thresholds sit between a scripted player who builds and walks away and one who uses upgrades and the evidence-backed card options. They were set from those scripted runs (see `tests/act1.test.ts`).

**Building upgrades** (`sim/upgrades.ts`, `{ type: 'upgrade', uid, id }`, Inspect panel). Act 1 only; stored on `PlacedBuilding.upgrades` (optional, so old saves load); the effect carries into Act 2.

| Upgrade | On | From | Cost | Effect | Income |
|---|---|---|---|---|---|
| Smoke scrubber | Factory | 1970 | $20k | air pollution -60%, **CO2 unchanged** | none |
| Creek buffer | Farm | 1980 | $8k | water pollution -60% | -$2k a decade (fenced strip of crop land) |
| Dust and sulphur filters | Coal power station | 1970 | $35k | air pollution -75%, **CO2 unchanged** | none |
| Liner and gas capture | Landfill | 1990 | $18k | soil and water pollution -70%, CO2 -40% | none |
| Dust suppression | Coal mine | 1970 | $12k | air (dust) -60%, soil and CO2 unchanged | none |

The point is the difference between local pollution and greenhouse gas. A smaller air number also shrinks the area the pollution reaches, so the saving is larger than the percentage suggests. Cleaning at the source costs less than cleaning up in Act 2.

**Green Valley Act 1 cards.** Money on both sides of every choice, evidence text, and a consequence you can see: the creek's colour (water pollution on the map), the bird and fish guide, a resident's line. Lasting effects use `incomePerDecade` (felt from the next decade report; a tenth a year in Act 2) and `flags['runoff.*']` (a steady stream of dirty water each decade). `cardGap: 10` and `cardsPerTurn: 2` let Green Valley offer a card nearly every decade.

| Year | Card | Options (money) |
|---|---|---|
| 1970s | Clear the hillside for a bigger farm? | Clear it (-$6k now, +$8k a decade, 7 bush tiles lost, mud in the creek) / Farm the gentle slope only (-$10k, +$4k a decade, 2 tiles lost; evidence) / Leave it (+$1k a decade) |
| 1980s | The fertiliser deal | Spread it thick (+$6k now, +$9k a decade, algae) / Test the soil (-$4k, +$5k a decade; evidence) / Say no |
| 1980s on | Where does the factory waste go? (existing; needs a factory) | Into the creek (+$10k now, +$6k a decade, dirty creek) / Settling pit (-$14k, +$2k a decade; evidence) |
| 1990s | A cheap tip or a proper one? | Tip by the creek (-$3k, +$2k a decade, leachate, methane) / Lined landfill (-$20k, +$4k a decade; evidence) |
| 2000s | A dry year: who gets the water? (no clean answer) | Pump the creek (+$14k now, -$2k a decade, fish die) / Restrictions (-$12k, +$3k a decade, platypus visitors) |
| 2010s | Solar panels are getting cheaper | Rebate for roofs (-$18k, +$7k a decade, CO2 down) / School and hall only (-$8k, +$3k) / Wait |

The card shows each option's money in plain words ("Costs $14k now. About $8k more income every decade."), for every scenario.

**Decade report ledger.** Beside the income, "what it cost": bush tiles lost (and left), creek health, air quality around homes, CO2 added, and a rough guide to bush birds and creek fish before and after. Birds and fish are not a census; they follow the bush and the creek's health (`sim/ledger.ts`), so Act 1 choices have a wildlife consequence before the Act 2 model starts.

**Hybrid time in Act 1.** Act 1 years tick in real time (about 6 seconds a year at 1x, on the same clock widget as Act 2: pause, 1x, 2x, 4x; Space pauses). A new game opens paused. Each year `advanceYear` (sim/game.ts) pays a tenth of the decade's income (jobs, mechanics income and card income, from the buildings that stand that year, so a building placed mid-decade pays from the next year) and moves the population a tenth of the way to the decade's target. At the tenth year the decade step runs (pollution, climate, meters, residents' moods, history, cards) and the clock auto-pauses on the decade report. "Skip to end of decade" (or Enter) fast-forwards the years that are left. `advanceDecade` is ten `advanceYear` calls and gives exactly the state it always did (tests/hybrid-time.test.ts), so scripted players and balance runs are unchanged. Mid-decade bookkeeping lives in `flags['dec.*']` (absent at a boundary, so old saves load); `state.year` stays the decade's first year and `displayYear(state)` is the clock's year. Building unlocks, cards, residents and the demand panel change per decade. Undo lasts until the next year ticks. Autosave runs every year.

**Play time.** Green Valley is estimated at about 35 minutes by `tests/helpers/playtime.ts` (six boom cards at 55 seconds each, up from one), so the scenario-select card says 28 to 38 minutes.

## 8. The learning layer (Round 6, WP8)

Owner request: students should see the environmental science behind the choices. Everything below is in both acts of all six scenarios, deterministic, and kept in `flags` or the optional `GameState.learn`, so old saves load unchanged. Facts and sources are in `docs/research/wp8-wp9-facts.md`.

**Land limits meter (`sim/capacity.ts`, `content/capacity.ts`, `ui/capacity.ts`).** A row in the demand-bar block: five pips (water, food and farmland, fish and timber, energy, CO2 and waste) and a one-line reading ("Overshoot: Energy, CO2 and waste"). Each line is what the town uses in a year against what the land renews: water against creek, wetland and bush catchment; food against farms and open land; the tighter of fish and timber against the creek, estuary, reef and bush; energy against renewable output; CO2 and waste against bush, regrowth, wetlands and sea. A ratio above 1 is overshoot (energy is judged over 1.25, because a grid that is nearly all renewable is fine). Click for the panel with the kid-friendly definitions, the five bars and the three stocks. Overshoot runs down three stocks in `flags` (`cc.flow`, `cc.fish`, `cc.soil`, 100 = untouched): at most 4 points a year, floor 40, and +1.5 a year back up under the line. A lower stock lowers what that line renews, and has three small knock-ons: a little dirt in a low creek (at most about 0.07 per decade), up to 1.2k a farm a decade lost to tired soil, and fewer fish in the ledger's fish guide. A city's water, food and fish come from outside its map, so those lines are shown but not counted, and do not run its own creek down. Per-place tuning is in `content/capacity.ts`. Calibration and the scripted-player results are recorded in `tests/capacity.test.ts`: every thoughtful run ends under the line on every line, idle runs end over on at least two lines, and a coal town goes over on CO2 and energy at the height of the boom. The ratios are in the history records (`cap`) and the graphs CSV.

**Water field kit (`sim/fieldkit.ts`, `content/waterkit.ts`, `ui/fieldkit.ts`).** "Test the creek" ($2k, once a decade in Act 1 and once a year in Act 2) reports dissolved oxygen, total nitrogen and phosphorus, turbidity, pH and conductivity against the NSW and ANZECC trigger values (coastal lowland values for Green Valley, Coal Coast, Reef Island and Net Zero City; Murray-Darling values for River Town and Red Dirt), plus a water bug survey with a SIGNAL2 score. The numbers are derived from the sim's water pollution, farm runoff, sewage outfalls, wetlands, lost bush, creek flow, soil contamination and (Red Dirt) the aquifer. Before skipping a decade the player may pick better, same or worse and write a line; the kit shows the prediction next to the result at the end of the decade (a free survey closes it if they did not test, or the next paid test does). Readings, predictions and results go in the graphs CSV as their own tables, and in the printable report.

**"Why did that happen?" (`content/causes.ts`, `sim/causes.ts`, `ui/causes.ts`).** Clicking a toast, an event-log line or a "Why..." link under the decade ledger opens a chain of three to five boxes for fish kills, algal blooms, smog, species loss, heat deaths, coral bleaching, floods, drought, erosion, bushfire, blackout, crown-of-thorns and storm surge. Boxes with a house mark show the player's own causes (their farms, outfalls, lost bush, warming, grid).

**Extras.** The card's "Who wins, who loses" shows residents, animals and future generations for every option (`content/winlose.ts`: derived from the option's preview and effects, with the Green Valley cards written by hand). The Field guide (`content/glossary.ts`, `ui/glossary.ts`) underlines each key term the first time it appears in a modal or toast, with a tooltip; the book button opens a menu with the guide, the water kit, the land limits and My household. My household (`content/household.ts`) links the town's numbers to five areas of the student's own life with three things to try each. The end screen has My household and Print my report buttons; the print view (`window.print`, print stylesheet in `ui/learn.css`) has the report card, the numbers, the water tests, big decisions, reflections, the letter and the ticked ideas. Reflections, the letter, ticks and terms met are saved with the game. The hidden costs of solar, wind and batteries (`content/hiddencosts.ts`) are on the build cards, in the Inspect panel and in a new circular-economy review ("Clean tech: the hidden costs"), balanced by what can be done about them.

**Layout.** The clock now sits in the HUD's centre column under the demand bars, and the Act 1 goals sit above the needs panel and Skip button in one right-hand column, so nothing overlaps at 1280x720, 1366x768, 1600x900 or 375x812. `tools/cdp-shots.mjs` takes the screenshots and checks for overlaps.
