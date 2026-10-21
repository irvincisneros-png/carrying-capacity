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

**Play time.** Green Valley is estimated at about 35 minutes by `tests/helpers/playtime.ts` (six boom cards at 55 seconds each, up from one), so the scenario-select card says 28 to 38 minutes.
