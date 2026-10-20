# QA playthrough: every scenario through the real UI

Played in headless Chrome against `vite preview`, driving the game with real mouse clicks and key presses (CDP
`Input.dispatchMouseEvent`) on build buttons, map tiles, dilemma options, policy sliders and tools. Read-only page
queries were used to find valid tiles and to read the UI text; no sim-mutating helpers were used. Act 2 was mostly
run at 4× with pauses to plan. Driver: `scratchpad/drv.mjs` (persistent CDP server).

"Real minutes" is an estimate of a Year 9 student's pace (reading every card, pausing to plan), not my driver time.

## Green Valley (tutorial)

- **Result:** ★★★ (4 of 4 goals, frogs bonus, both residents' arcs good). First attempt (before fixes): 0 stars.
- **Time:** in-game 1960–2040 (6 decades of Act 1, 15 years of Act 2). Real: about 25–35 minutes for a student.

### Bugs found and fixed

| # | Bug | Fix |
|---|---|---|
| 1 | Every dilemma card opened **twice**: the outcome story re-opened the same card (choosing again silently failed). | `fix(ui)` 1bc2f00: outcome now shown as a "What happened next" toast |
| 2 | "Island resort", "Cooling centre" etc. offered in Green Valley (every scenario-specific building showed everywhere). | `fix(sim,content)` 157696a: buildings limited to the scenarios whose mechanics use them |
| 3 | Demand banner read "what will your town build next?." | 157696a |
| 4 | Turning point used Coal Coast's Dr Priya Shah and "Estuary health" in every scenario. | 1bc2f00: per-scenario science voice and water label |
| 5 | Goals panel titled "Goals for 2100" in a 2040 scenario; pending goal said "Comes with a later update (circular)". | 1bc2f00 |
| 6 | Tutorial step "Retire the coal" pointed at **Demolish**, which sends the station to landfill and undercuts the recycle goal. Following it also caused 4 years of 20–26% blackouts: Society fell 81 → 0 and the town was one year from failing. | 157696a/1bc2f00: step now points at Old sites, shows a live "Not yet: clean power covers only N% at night" / "ready" line; Demolish and Old sites hover (and the disposal chooser) warn when removing a power station would cause blackouts |
| 7 | Tutorial "Make a frog pond" **softlock**: no open ground left beside the creek, and Act 2 has no Clear tool (error message pointed at a tool that doesn't exist). | `fix(sim)` 7c67e4f: wetlands may go into bush in Act 2; other buildings say the bush is protected |
| 8 | "Build a shallow stormwater wetland" dilemma option didn't build anything, so the player thought the frog pond was done. | 7c67e4f: option says "Plan…", outcome tells you to place one |
| 9 | Solar-site dilemma talked about "the old landfill" when none was built; circular unlock said "the estuary is recovering" in a creek valley. | 157696a |
| 10 | Report card titled "2100 Report Card" for a 2040 ending; boolean goals read "Ended at 0 / 1"; Undo button stayed visible on the report. | 1bc2f00 |
| 11 | Tutorial-complete toast said "through to 2000". | 1bc2f00 |
| 12 | Resident mood trend could be `-0`, which doesn't survive a save (save round-trip test flaked). | 7c67e4f |

### Balance notes

- "Heal the valley: Environment 70" was missed (64.9) by a player who did every guided step plus more: old air
  pollution decays only 50% per decade in Act 2, so the coal station's smoke lingers for decades after it closes.
  Target set to 65 (scripted tutorial run still clears 70). A global fix (air clearing within a season or two) is
  more realistic but shifts Coal Coast's thoughtful run under its estuary target; logged as a follow-up.
- Each goal row now has a one-line "how to move this" hint, and the frogs bonus shows "frog: 22 of 40" rather
  than "0 / 1", which is what told me a second wetland was needed.

### Fun notes

- Good: the decade report and the "Look what you built" graph comparison land well; Jo and Ali's epilogues are
  warm; frogs arriving in the new wetland is a real moment.
- Flat: 2030–2040 had no cards at all; at 4× nothing happens for ~2 minutes.

## Coal Coast (easy)

- **Result:** ★★ (4 of 4 goals, koalas and turtles thriving; third star missed because Dot Harris's arc ended
  "mixed"). Warming 1.5 °C, estuary 92, Society 95, every Act 1 site repurposed or recycled by 2027.
- **Time:** in-game 1850–2100 (17 decades + 75 years). Real: about 75–95 minutes for a student (Act 1 ≈ 20–25 min,
  Act 2 ≈ 50–70 min with pauses).

### Bugs found and fixed

| # | Bug | Fix |
|---|---|---|
| 1 | The win conditions were only revealed at the 2020 turning point; for the first 20+ minutes the player has no idea what they're working towards. | `fix(sim,ui)` e43893c: the intro card lists the goals and the bonus |
| 2 | Escape didn't close the Caring for Country / research / satellite / policy drawers. | e43893c |
| 3 | Green turtle sat at population 1 for 15 summers on a perfect beach, so "thriving" (3 turtles) never came; panel read "nesting 15 of 3 summers". The streak was already "any female", but the population only grew by 7% of one animal a year. | e43893c: each nesting summer has a chance a new female joins (`wildlife.ts`), panel reads "1 (needs 3), nesting 15 summers in a row (needs 3)" |
| 4 | Turning point read "Estuary health 100/100" while the story said the estuary had gone silver with dead fish (the stat on other maps was always 100: no estuary tiles). | `fix(sim,ui)` b239278: shows river health / aquifer / Environment per place |

### Balance notes

- Act 1 money runs away: $2.2M in the bank by 2020 and $2.1M left at 2100. Act 2 is never budget-constrained here,
  so money stops meaning anything. Fine for the "easy" scenario, but it removes tension. (Not changed: tests encode
  the Coal Coast thoughtful run; worth a deliberate tuning pass.)
- Only 5 dilemma cards across 17 decades of Act 1; Act 2 has a steady 2–3 per decade.
- Some cards list the same group as both helped and hurt ("▲ Town ▼ Town", "▲ Planet ▼ Planet"), e.g. "Buy back
  the homes closest to the bush", "Backyard compost workshops only", "Train volunteers". Content to tidy.

### Fun notes

- Good: repurposing the coal loader into a wind-turbine port and the steelworks into a museum are lovely beats, as
  are the epilogues (Linh tagging bream from her mum's boat, "Yes, there are still turtles").
- Flat: once the grid is clean and the sites are dealt with (by about 2030), the remaining 70 years are mostly
  watching and answering cards.

## River Town (medium)

- **Result:** ★★★ (river 65.6, no tap failures, farms 85, platypus thriving, every resident arc good).
- **Time:** in-game 1880–2100. Real: about 75–100 minutes for a student.

### Bugs found and fixed

| # | Bug | Fix |
|---|---|---|
| 1 | Inland river floods were announced as "Storm surge: …" (and named "Flood / storm surge"). | `fix(sim,ui)` b239278 |
| 2 | Turning point "Creek and river health 100/100" while "the river stops"; now shows River health (89). | same commit |

### Balance notes

- Comfortable: river health ended 65.6 against a 60 target. The water-sharing sliders, drip farms, a fishway and
  riparian nurseries were enough. Money again piles up ($1.2M unspent).
- Repeating cards: "Who gets the water?" came four times, "Green water at the weir" three times. A student may
  find the repeats tedious; consider varying the text on repeats.

### Fun notes

- Good: the policy sliders with plain-English consequences are the clearest "trade-off" moment in the game; the
  managed flood card with Uncle Ray, and the platypus coming back, feel earned.

## Reef Island (hard)

- **Result:** ★ on the third attempt (coral 58.1, no homes lost, tourism 76). Attempts 1 and 2 scored 0 stars
  (coral 41.6 and 45.5). Turtle bonus missed (beach too lit on a small island).
- **Time:** in-game 1900–2100. Real: about 80–105 minutes per attempt for a student.

### Bugs found and fixed

| # | Bug | Fix |
|---|---|---|
| 1 | **Early economy softlock**: after cottages, a farm and roads, the player had $49k in 1920 against a $100k diesel station and a $60k port, with Economy collapsing from the power shortfall. | `fix(balance)` dc344c7: start budget 80 → 140, island diesel station $70k |
| 2 | "Port & coal loader: ships coal around the world" on an island with no coal. | same: "Harbour and jetty" |
| 3 | **Unfair goal failure**: two homes were lost to a storm surge in 2027, two years into Act 2, with nothing telling the player which homes were at risk. The "no homes lost" goal was failed before any reasonable chance to act. | `fix(reef)` f60d87c: "Homes at risk" readout + goal-row note + inspect warning; the first two years of surges flood but don't destroy homes ("move people to higher ground") |
| 4 | Turtle panel said "only 26% of the beach is dark" but not what lights it. | f60d87c: names the cause and range; habitat view shows the dark sand |
| 5 | Coral nurseries placed in corners helped almost no reef; nothing said they only reach ~4 tiles. | `fix(reef)` ea48649: placement tip "Replants N reef tiles nearby" |
| 6 | Turning point showed "Reef health 0/100" (metric not initialised until Act 2). | uses Environment |

### Balance notes

- The coral goal is knife-edge and depends mostly on warming (reef target ≈ 1 − 0.7·(T − 0.45)/1.5), which is
  largely set by Act 1. A player who builds the full resort boom in Act 1 is close to locked out of the main goal.
  Winning needed: fewer resorts in Act 1, diesel retired in 2027, cull at level 2, eight well-placed nurseries,
  and ~37 satellite warnings acted on.
- The turtle bonus conflicts with the island's size: a ground station, resorts and homes all light the beach,
  and there is little land more than 2–3 tiles from sand.
- The tight reef margin tests (`margin < 0.15`, "city is tightest") are sensitive to tiny Act 1 changes (start
  budget 120 → margin 0.18, 150 → 0.03, 160 → −0.04). Worth replacing with a multi-seed band.

### Fun notes

- Good: the satellite warning banner with a one-click "cut runoff" response feels like real early-warning science;
  Big Tilly and the kids' lines are charming.
- Flat: losing the reef slowly over 40 years with $3M in the bank and nothing left to spend it on is frustrating.

## Red Dirt (hard)

- **Result:** ★★★ on the second attempt (net zero from 2036, mine site 100% signed off, aquifer 100, no tap
  failures, 100% renewable grid). First attempt: 0 stars (aquifer 23, rehab stuck at 93%, net zero "reset" to 2064).
  The second run's ending was first scored 0★ by the old net-zero rule and re-scored ★★★ after the fix below
  (same save).
- **Time:** in-game 1890–2100. Real: about 80–110 minutes for a student.
- **Rehab sequence verified:** close the mines → Rehab mine on the pit: reshape ($120k, 50 tiles) → topsoil ($80k)
  → seed with the Traditional Owners ($50k), then the small second pit (8 tiles). The pit visibly flattens and is
  replaced by topsoiled ground; patches are signed off after 5 years of growth (needs nurseries beside them).
  Partnership reached 80–100 through consultation and co-management.

### Bugs found and fixed

| # | Bug | Fix |
|---|---|---|
| 1 | Real players carried millions into Act 2 while the Red Dirt balance tests cap the carry-over at $350k, so the tested trade-offs never applied in the game. | `fix(balance)` 55b5795: `act2.carryOverCap` with a turning-point line |
| 2 | Aquifer hint told players to "cap mine water in Town policies" — no such lever exists. The aquifer slid 80 → 11 by 2037 with no warning until too late. | `fix(red-dirt)` ca9207f: correct hint (mines drink the most), readouts show ▲/▼ per year, the goal row says "falling 5 a year, below 40 in about 4 years" while there's still time; trend fix 5633068 |
| 3 | Rehab sat at 7% for 20 years: nothing said seeded ground needs a nursery beside it. | ca9207f: hint explains nurseries and the 5-year sign-off |
| 4 | **Permanent block**: a nursery built on seeded mine-site ground kept four tiles at zero growth forever; rehab stuck at 93% and the goal could never be met. | `fix(red-dirt)` fc399b8: building on the rehabilitating site is refused with a reason |
| 5 | **Unfair net-zero reset**: net zero held from 2036 (4–6 kt vs 12 kt line) until repurposing the old coal station (the *best* waste-hierarchy choice) added 8 kt of one-off work in 2063 → 12.5 kt, resetting "reached" to 2064 and failing the scenario. | `fix(sim)` b053784: one isolated spike between two years under the line, averaging under it, no longer resets the hold |
| 6 | Demolish tooltip said "Coal mine" (scenario calls it Open-cut mine) and discouraged closing before the circular economy. | ca9207f |
| 7 | Tia and Ben were Year 5 kids from 2000 yet asked about the school playground in the 2070s and were "grown, at uni" in their sixties. | `fix(content)` 761103d: childhood beats 2020s–2040s, "grown" 2046–2070, the empty-waterhole beat told by them as parents (successor voice); River Town's twins likewise |
| 8 | Ending header said "You met 3 of 4 goals" next to four A grades (stale stored outcome). | de18f5c: ending header uses the same evaluation as the card |

### Balance notes

- With the cap, Act 2 money is genuinely tight (good): the reshape/topsoil/seed sequence waits on income, and the
  rehabilitation bond then releases money.
- The water goal is unforgiving: three open mines drain about 5 aquifer points a year and it refills by under 1,
  so the aquifer is effectively decided by when the mines close. The new trend warning makes that visible.

### Fun notes

- Good: the rehab sequence is the most satisfying "repair" mechanic in the game; Shaz driving topsoil back to the
  pit is a lovely epilogue.

## Net Zero City (expert)

- **Result:** not won (0 stars in three attempts). Best: Society ≥ 60 every year (min 65), heat deaths 8 (target
  ≤ 20), but net zero reached in 2053/2058 instead of by 2050.
- **Time:** in-game 2025–2100. Real: about 90–120 minutes for a student.
- Why I missed: attempt 1 repurposed six factories in one year after reaching the line (two years over → reset to
  2058); attempts 2–3 left the 31 brick suburbs un-retrofitted until the late 2040s because nothing pointed at
  retrofits (the generic hint talked about mines and factories). The scripted thoughtful run (retrofits 3/year
  from 2025, 130 rooftops, transit early) wins, so it is achievable; I didn't find that order from the UI alone.

### Bugs found and fixed

| # | Bug | Fix |
|---|---|---|
| 1 | Pocket park "wouldn't place": aiming street trees at a road or house gave only "Something is already built here". 720 valid tiles exist (open ground beside streets). | `fix(ui)` b50d58d: specific reason ("needs an empty tile beside the streets and homes") |
| 2 | Disposing several sites in one year near the line silently tipped net zero over. | b50d58d + 8dd4d23: the disposal chooser shows "this year is already at about N of 48 kt; spread the work out" once the town is at the line |
| 3 | No hint mentioned retrofits/transit for the city's remaining emissions. | c8520c0: scenario-specific net-zero hints |
| 4 | City blocks read as dark masses at whole-map zoom (ink outlines kept constant screen width). | eb4438a: outline width capped in world units |

### Balance notes

- "Tight budget" is only tight until ~2040; by 2070 the city had $2–4M unspent. The "under budget" bonus
  (≤ $2,500k by 2050) was missed at $3,111–3,225k.
- Expert difficulty is mostly about *order of operations*, which the UI only partly teaches. A turning-point line
  listing the city's emission sources by sector (from the Graphs) would help.

## Cross-cutting checks

### Performance (headless Chrome, Apple GPU, CDP `Emulation.setCPUThrottlingRate`)

| Scene | Tier | CPU throttle | Game speed | Avg fps | p99 frame | Worst frame |
|---|---|---|---|---|---|---|
| Net Zero City 2025 (48×48, 214 roads, 35 suburbs) | Low | 1× / 4× | paused | 60 / 60 | – | – |
| Net Zero City | Medium | 4× | paused | 60 | 18 ms | – |
| Net Zero City | Low | 4× / 6× | 4× | 59.7 / 60 | 19–20 ms | 34–75 ms (season tick) |
| Coal Coast 2035 (built town) | Low / Medium | 4× | 4× | 59.8 / 60 | 18 ms | 23–55 ms |

All well above the 30 fps floor. The only hitch is a single 50–75 ms frame when a season is simulated under 4–6×
throttling (sim runs on the main thread); not optimised further.

### Layout (1280×720, 1366×768, 1600×900, 375×812)

- Fixed (`fix(ui)` f6edbe7): at 1280–1500 px the Act 2 HUD pushed log/graphs/settings/frame off-screen; the
  power-grid panel sat under the dock on short screens; at 375 px the tab row overflowed left (Homes unreachable),
  HUD buttons overflowed right, hazard chips spilled out of the clock and Goals/Power covered the tabs.
  Automated off-screen scan now reports nothing at 1280, 1366 and 1600; 375 px only scrolls the build-card row
  (intended).

### Save / continue

- Reloaded mid-game seven times (Act 1, Act 2, and at the epilogue) and used "Continue": state, clock, panels and
  the report card all came back. A finished game re-scores on load with current rules.

### Progress / unlock chain

- Green Valley → unlocked Coal Coast; Coal Coast → "Unlocked: River Town and Reef Island"; Red Dirt opened after
  River Town; Net Zero City opened after Red Dirt. The ending's "Next: …" button starts the next unplayed
  scenario. Note: the tutorial records a star on completion even when its report card shows 0 stars.

### Console

- No console errors or uncaught exceptions in any run (the driver captures `Runtime.exceptionThrown`, console
  errors/warnings and log errors).

### Rendering polish done

- Reef ring calmer (two related coral hues per tile, fewer instances). Seawalls and fishways auto-face the water.
  Single-tile buildings drawn 14% larger. City outlines (above).

## Remaining issues, ranked

1. **Net Zero City order-of-operations**: I couldn't win it from the UI in three tries (net zero 2053). Hints now
   name retrofits/transit, but the game never shows the sector breakdown at the moment it matters (consider a
   "what's left" card when the grid hits 100% renewable).
2. **Act 1 money runs away** in Coal Coast, River Town and Reef Island ($2–3M carried into Act 2), so Act 2 money
   decisions are free there. Red Dirt now caps carry-over; the others need the same with retuned tests.
3. **Reef Island coral goal is decided mostly by Act 1 warming** and its balance tests are knife-edge (margin
   flips sign with a $10k change in start budget). Needs a multi-seed band and maybe more Act 2 agency.
4. **Old air pollution lingers ~50% per decade** after a source closes (smoke shouldn't last decades). A fix that
   clears a building's plume when it's removed is easy but shifts Coal Coast's estuary result under its 60 target
   in the thoughtful test run; needs a deliberate retune.
5. Turtle bonus on Reef Island conflicts with the island's size (everything lights the beach).
6. Repeating dilemma cards ("Who gets the water?" ×4) and a few cards listing the same group as helped and hurt.
7. Speech bubbles can overlap each other on the map; toasts briefly slide in from beyond the right edge.
8. A one-frame 50–75 ms hitch on season ticks under heavy CPU throttling.

## Round 2: balance and teaching pass (2026-10-21)

Same method as round 1 (headless Chrome against `vite preview`, real mouse clicks on build cards, map tiles, card
options, policy sliders, the Old sites chooser and the satellite "Cut runoff now" banner; read-only page queries to
find valid tiles). Act 2 run at 4× with the clock paused for every decision. "Real minutes" is again a Year 9
estimate, not driver time (driver time: 11–16 minutes per Act 2).

### What changed before the replays

| Issue (round 1 rank) | Change | Commit |
|---|---|---|
| 2. Act 1 money runaway | Coal Coast $900k / River Town $500k / Reef Island $450k carried into Act 2; part of the surplus becomes a Transition Fund paid yearly over 20–25 years (e.g. "$1.3M ... pays $63k a year for 20 years"), explained on the turning point and in the budget tooltip. Multi-seed bands in `tests/balance-seeds.test.ts`. | 32243cf |
| 1. Net Zero City order of operations | Goals panel: "Your emissions by source" at today's buildings, biggest lever highlighted, "On current plan: net zero about 2047 (target 2050)" recomputed on every build, a ticked suggested order; same list on the intro card. Power-loss warning now simulates a year without the plant (other plants ramp up) and says when the night, not the batteries, is the problem. | f65d71a, 4b25c1b |
| 3. Reef goal decided by Act 1 warming | Act 1 boom nudges warming (climateInfluence 0.6); clean water gives coral heat tolerance; nurseries stack ×3 ($4k/yr upkeep); satellite-warned heatwaves and starfish patrols do more; coral judged on a 5-year mean. Same clean-energy plan without the local work: 1 of 4 seeds wins (was 3 of 4). | 27cd81f |
| 4. Lingering air pollution | Act 2 air half-life one year; Green Valley heal target back to 70. | 025ce5b |
| 5–7. Smaller | Turtle lighting tied to the beach (2 tiles) plus a "Turtle-friendly lighting" lever; recurring cards max 3 offers, titled "(again)" with what was chosen last time; one "▲▼ Town: mixed" chip instead of "▲ Town ▼ Town"; overlapping speech bubbles lift above each other; finishing the tutorial steps opens Coal Coast without recording a star; estuary goal on a 10-year mean (see Coal Coast); Elder named per scenario on significant places. | 2fe7dba, a1026e9 |

### Net Zero City (expert)

- **Result:** ★ (3 of 3 goals): net zero reached 2047 and held, Society never under 64.5, 13 heat deaths. Bonus missed
  (spent $3,163k by 2050). Aunty Lorraine's arc ended badly (I never consulted her), Dolores mixed.
- **Time:** in-game 2025–2100. Real: about 90–120 minutes for a student.
- **How the panel steered the run:** intro card listed power 83 kt, factories 57 kt (wait for Old sites in 2032),
  traffic 24, homes 22. The projection read 2062 in 2029 ("12 years late"), which pushed money into power; 2044 once
  the factories became recycling plants in 2032–2036; 2047 once coal went.
- **First attempt (before 4b25c1b): net zero 2051, 0★.** The old warning said a coal plant couldn't go ("16% short
  at night") although four gas plants had spare capacity, and the lever said "rooftop solar and batteries" when the
  rooftops had run out and there was no spare daytime power to charge the batteries. Both fixed; the second attempt
  followed the new text (wind for the night, retire coal with gas as the bridge) and won.

### Reef Island (hard)

- **Result:** ★★ (coral 56.8 as a 5-year mean, no homes lost, tourism 73.6, turtles thriving: 15 green turtles).
  Third star missed: Kieran Walsh's arc mixed. Money was genuinely tight (lowest $13k), 37 satellite warnings acted on,
  six coral nurseries placed by their "Replants N reef tiles" tip, starfish control and turtle lighting at level 1,
  two low homes rebuilt on raised ground in 2026.
- **First attempt: 0★** because my driver ignored the "Homes at risk: 1" readout and a home was lost in 2027 (the
  readout, goal-row note and two grace years were all there; the miss was mine). The same run kept the coral at 51.3
  even with the diesel station never retired and no warnings acted on, thanks to sewage treatment, nurseries and
  starfish control.
- **Time:** in-game 1900–2100. Real: about 80–105 minutes for a student.

### Coal Coast (easy)

- **Result:** ★★★ (warming 1.6 °C, estuary 68.8 as a 10-year mean, Society 91, every Act 1 site repurposed or recycled
  by 2043, koalas 35 and green turtles 11 thriving, all six residents' arcs good).
- **Played under the 5-year rule first: 0★.** The estuary sat at 82–88 from 2049 to 2093, then four floods, two hot
  fires and a fish kill in 2093–2098 dragged the 5-year mean to 58 with every other goal met. The goal now averages ten
  years (a1026e9) and the same save re-scored ★★★ on load.
- **Money:** the $900k start plus a $63k-a-year fund were spent down to $30–160k every year until about 2050; after
  everything was built the bank grew again to $1.15M by 2100.
- **Time:** in-game 1850–2100. Real: about 75–95 minutes for a student.

### Checks

- `npx vitest run` 656 tests, `npx tsc --noEmit -p .` clean, `npx vite build` clean. No console errors or exceptions
  in any replay.
- Turning point shows the Transition Fund paragraph with real numbers; bubbles from neighbouring homes stack (checked
  with two residents speaking a tile apart).

### Remaining issues, ranked (round 2)

1. **Late-game surplus:** once every site is dealt with (about 2050 on Coal Coast, 2040s on Reef Island) income piles
   up again ($1.15M at 2100 on Coal Coast) with nothing left to buy. A late sink (restoration projects, adaptation)
   or a falling Act 2 income would keep the second half meaningful.
2. **River Town wins 3 of 4 event seeds:** seed 47's long drought leaves the river at 52–58 and farms under 40 even
   with the adaptive water-sharing player. Real players may hit this; a drought-year hint about the environmental share
   would help.
3. **Net Zero City Society margin is thin in storm years:** two event clusters (2038–2039) dropped Society from 92 to
   65; the "60 every year" goal has ~5 points of slack. The under-budget bonus ($2,500k by 2050) is out of reach for a
   UI player who follows the panel (spent $3,163k).
4. **The Goals panel covers part of the city at 1600×900** now that it holds the emissions breakdown (fold it with
   "hide"); at 375 px it lives in the Goals sheet and was not re-checked this round.
5. Reef Island Act 1 has a flat stretch (1920–1950: nothing affordable to build while saving for the diesel station).
6. Report card grades a species that was never present (Coal Coast platypus "D, 0 animals, started with 0").
7. Carried over: toasts slide in from beyond the right edge; one 50–75 ms frame on season ticks under heavy CPU
   throttling.

## Round 3: final polish and regression (2026-10-21)

### What changed

| Round 2 issue | Change | Commit |
|---|---|---|
| 1. Late-game surplus | Community projects (Innovations and projects drawer, open with the circular tier): Adopt a habitat (plants weedy ground beside bush), Climate aid for a neighbouring town (60 kt off the world total per round), Cool refuges, Junior rangers. 2–3 rounds each at ×1.5 cost, about $1.7M in all; one nudge when savings pass $400k; a Report Card line. | 6c3876d |
| 2. River Town seed 47 | Drought plan policy ($4k/yr): banks half the flow above the river's own share in normal seasons; in a declared drought, town restrictions (−20%), deficit irrigation (−30%), an environmental-flow floor and banked water to the farms. A "Drought declared" banner offers it in one click. River goal judged on a 10-year mean (like the estuary). Careful scripted player now 4/4 seeds; the same player ignoring the warning still loses seed 47. | cdcdad7 |
| 3. Net Zero City bonus and slack | Build tooltips show "cuts about N kt a year · $X per kt" at today's town (light rail $22/kt, retrofits $25/kt, solar farm $58/kt; batteries show nothing until there is spare solar). Bonus threshold $2,500k → $2,800k (scripted plan spends $2,627k; lean plan $2,185k; round-2 UI run $3,163k without the hints). City storms/heatwaves drag Society ×0.9 (worst scripted year 68 → 70); difficulty ordering unchanged. | d620f57 |
| 4. Goals panel covers the city | Lever text and suggested order fold away (closed by default, remembered), four biggest sources only, compact rows for goals that are fine. At 1600×900 the Net Zero City panel ends above the build bar. Bubbles never lift over the HUD (they sit side by side); phones keep two toasts; warning banners use the full phone width. | 4530a72, bd1f42a |
| 5. Reef Island 1920–1950 | "An airstrip for the war" card (1935–1955, fires 1940): clean-up condition +$30k, no condition +$45k with fuel in the lagoon, or a small depot +$12k. Makes the diesel station affordable in the 1940s. | 223b289 |
| 6. Never-present species graded D | Census carries `seen`; the Report Card shows "–, never recorded here this game" and the species panel says "not here yet". | 753a7d8 |
| 7. Toasts and season hitch | Toasts animate the individual `translate` property from 16 px (never from off-screen; centred banners no longer jump). The controller simulates the next season in idle time and uses it at the boundary; vegetation and ambient-life rebuilds run on later frames; yearly autosave in idle time. | 21cb0fc |
| Teacher page | `teacher.html` (title screen "For teachers") and in-game Settings → Simplified!. | 1156b7f |
| Docs | `README.md`, `docs/HANDOVER.md`. | cb740d4 |

The title-screen layout and the turning-point estuary note are in the final commit of the round.

### Performance (headless Chrome, 4× CPU throttle, Net Zero City at 4× speed, 20 s, Low tier)

| | Avg | p99 | Worst | Frames > 33 ms | Frames > 50 ms |
|---|---|---|---|---|---|
| Before (round 2 build) | 17.0 ms | 16.8 ms | 100 ms | 10 | 5 |
| After | 16.7 ms | 16.8 ms | 33 ms | 3–5 | 0 |
| After, 6× throttle | 16.9 ms | 16.8 ms | 50 ms | 12 | 0 |

### Regression via the real UI (1600×900)

- **Green Valley, complete**: title → New game → Green Valley → every guide step by clicking build cards, map tiles,
  Clear bush, Next decade, dilemma options (after opening "What does the evidence say?"), the Old sites chooser and
  the speed buttons. Epilogue 2040, 4 of 4 goals (100% renewable, Environment 92, koalas 24, old sites 67%); bonus
  missed because the driver built one wetland (the guide asks for a second). "Next: Coal Coast" offered.
- **Coal Coast to the turning point**: from "Next: Coal Coast", Act 1 1850–2020 by clicking build cards and tiles
  (always the first dilemma option, i.e. the cheap dirty one), consulting the significant places with Inspect →
  Talk. Turning point showed the Transition Fund paragraph ($1.7M boom → $900k + $25k a year for 20 years). Then
  six clean builds and Act 2 to 2031 (three dilemmas answered).
  - Found: this town built away from the water, so the "fish kill" turning point showed estuary 100/100 under a
    story about runoff. Added a line when the estuary reads 80+: "your town kept most of its sewage and runoff away
    from the estuary... this time the heat did the damage".
- **Mid-game screenshots** of River Town, Reef Island, Red Dirt and Net Zero City come from scripted thoughtful-player
  saves (2045 / 2038) loaded through the title screen's Continue and run for a few seconds; they were not played by
  hand this round.
- Drought banner: forced a River Town drought, clicked "Start the drought plan": plan on, banner gone, toast shown.
- Panel sweep at 1280×720 and 375×812 (River Town and Net Zero City, Act 2): every HUD button's panel opened; nothing
  off-screen except rows inside scrollable drawers.
- `teacher.html` at 1280 and 375 (no horizontal scroll), printed to PDF (18 A4 pages).
- No console errors or uncaught exceptions in any of the above.

Screens: `docs/screens/final-*.png` (title, scenario select, Green Valley mid-game and end, Coal Coast Act 2 and
turning point, River Town, Reef Island, Red Dirt, Net Zero City, Simplified!, teacher page).

### Checks

`npx vitest run` 668 tests (38 files), `npx tsc --noEmit -p .` clean, `npx vite build` clean (main chunk size warning
only, as before).

### Remaining issues

1. Community projects are unit-tested but the scripted balance players never fund them, so there is no balance band
   for a player who spends late money on climate aid (−0.02 °C per three rounds in Coal Coast: small by design).
2. The drought plan is reactive in the scripted player; banking only pays off if a player turns it on before dry
   years. The policy text and teacher page say so, but no hint fires before the first drought.
3. Goals panel at 1280×720 still scrolls inside itself in Net Zero City (it no longer covers the map).
4. Debug-only: `__cc.game.debugTick` while paused leaves the clock widget showing the old year until the next tick.
5. Aboriginal and Torres Strait Islander content remains draft pending consultation (the repository went public
   during this round, commit 1f5244d, so it is now live).
