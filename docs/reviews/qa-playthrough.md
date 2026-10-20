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
