# Carrying Capacity — Design Brief (working title)

Year 9 Environmental Sustainability (NSW Science 7–10, 2023 syllabus, focus area 4). A two-act browser game: **Act 1 "Boom"** builds an industrial NSW coastal town 1850 → present and lets students cause the damage; **Act 2 "Restore"** is a Terra Nil-style restoration where the town must keep running while the land, reef and air recover, ending with every unsustainable building recycled.

Drafted 2026-10-20 from research on Terra Nil mechanics and art direction (sources at end).

## 1. Syllabus coverage

| Dot point | Where it lives |
|---|---|
| 4.1.1 principles/goals of sustainability | Three meters: Environment / Society / Economy; any at 0 ends the run |
| 4.1.2 propose valid solutions | Act 2 crisis cards, scored on evidence |
| 4.2.1 climate vs weather | Daily weather ticker vs 30-year climate line on HUD |
| 4.2.2 climate trends | Exportable graphs (temp, rainfall, sea level) |
| 4.2.3 natural greenhouse effect | "Atmosphere lens" overlay — IR in/out, trapped fraction |
| 4.2.4 enhanced greenhouse effect | CO₂ ↔ temperature graph driven by player emissions |
| 4.2.5 emission-reduction methods | Energy cards with real advantages/limitations and siting rules |
| 4.2.6 industrialisation ↔ temperature | Act 1 timeline: the student's own industrial build-out produces the curve |
| 4.3.1–4.3.3 climate change impacts | Events: sea-level flooding, longer fire seasons, coral bleaching, drought on water cycle |
| 4.3.4 satellites | Buy a satellite to unlock ocean-temp / sea-level / forest / ice overlays |
| 4.4.1 pollution causes/implications | Air, water, plastic pollution plumes from sources |
| 4.4.2 Aboriginal sustainable practices | Caring for Country: cultural burning, seasonal harvest protocols, led by Custodian characters (needs AECG consultation — see §6) |
| 4.4.3–4.4.5 reduce/reuse/recycle, processes, innovations | Act 2 endgame: every building recycled/repurposed via waste hierarchy; research tree of real recycling innovations |
| 4.5.1 human activity ↔ one pollution concern | "2100 Report Card" export = in-context write-up |

## 2. Act 1 — Boom (≈10–15 min)

- Time advances by decade (1850 → 2025). Each decade the player gets a budget and demands (jobs, housing, power).
- Builds: coal mine, rail siding, steelworks, coal power, port, cottages, roads, farms, landfill, sewage outfall.
- Cheapest options are always the dirty ones — the choice is "deliberately easy" so the damage feels earned.
- Live graphs: CO₂ (ppm), global temp anomaly, local pollution. Data is plotted from the player's town *plus* a scaled real-world background curve so the shape matches real data.
- Act ends at "present day": a cutscene-free freeze frame showing the town, a smoggy sky, a bleached reef, and the student's own graphs.

## 3. Act 2 — Restore (Terra Nil–style, ≈20–30 min)

Structure mirrors Terra Nil's three tiers:

1. **Clean** — replace dirty power, remediate polluted land and estuary, cut emissions below a target.
2. **Restore** — rebuild biomes: coastal heath, eucalypt woodland, wetland, mangroves, reef recovery. Animals return when habitat thresholds are met.
3. **Circular** — recycle or repurpose every Act 1 building through the waste hierarchy; the town must still meet Society/Economy minimums.

### Mechanics taken from Terra Nil

- **Effect-on-placement buildings with visible range** (scrubber → soil, irrigator → green). Range circles and tile previews before placing.
- **Siting rules for energy**: wind on ridges/headlands, solar on cleared roofs/land, hydro needs a river drop, tidal on the coast. Teaches 4.2.5 limitations.
- **Currency earned per tile restored** ("leaves"), so good placement pays back.
- **Sequenced succession**: soil → pioneer grasses → heath/woodland.
- **Fire as ecological process**: cool cultural burns create mosaic patches that reduce wildfire risk and trigger banksia/eucalypt regeneration.
- **Habitat thresholds + corridors** for animals (wildlife bridge = corridor). Australian species: koala, sugar glider, glossy black-cockatoo, green turtle, frogs, shorebirds.
- **Leave-no-trace endgame**: unlock "complete" only when every Act 1 building is recycled/repurposed.

### Fixes for Terra Nil abstractions that would mislead students

| Terra Nil | Ours |
|---|---|
| Instant toxin scrubbing | Remediation takes several in-game years; phytoremediation option is slower but cheaper |
| Map-wide climate gauge a few buildings can push | Global climate is *driven by emissions* and lags (committed warming); local actions change local conditions only |
| No failure | Restoration can fail: drought kills plantings, weeds invade, unmanaged fire burns hot |
| No time / seasons | Seasons and years; wet/dry seasons affect growth and fire risk |
| Made-up conversions | Any simplification gets a "Simplified!" card explaining the real science |

## 4. Art direction

**Stylised low-poly floating diorama with tilt-shift**, borrowing painterly touches from Terra Nil.

- Map is a floating slab with a cut-away soil/rock face (shows pollution and soil layers).
- Palette: Act 1 = ochre/rust/slate, sepia → smog-yellow sky by decade (per-era LUT). Restored = eucalypt sage, wattle gold, ocean teal, sandstone cream.
- Restoration spreads via a per-tile health texture sampled in the terrain shader, with a noise threshold for an organic edge; instanced trees grow in with scale animation.
- Australian hero assets: eucalypts (white trunks, open olive-blue canopy), banksia, grass-trees, sandstone platforms, Norfolk pines, mangroves, reef; steelworks stacks, coal loader, weatherboard cottages.
- Juice: soft bloom on water/flowers, wind sway, particle birds, a quiet score that builds as the land recovers, an "Appreciate" fly-over at the end.
- Cultural burns look distinct from wildfire: low flame, pale smoke, small mosaic patches, black char, green shoots after.

## 5. Tech

- Three.js (WebGL2), Vite, TypeScript, static deploy to GitHub Pages, saves in `localStorage`. Pure-TS simulation engine (unit-tested) separate from rendering, like Equilibrium Lost.
- Square tile grid, `InstancedMesh` everywhere, one gradient atlas; pmndrs postprocessing in one merged pass (tone mapping, bloom, vignette, LUT, tilt-shift); N8AO optional on a "high quality" toggle.
- Target 30+ fps on school Chromebooks.
- Assets: CC0 kits (KayKit City Builder Bits + Forest, Quaternius Stylized Nature / Downtown City, Kenney), recoloured to the palette; custom models for Australian hero assets only. AI images for concept boards, not production meshes.

## 6. Aboriginal content — rules

- Do not imitate dot painting or invent "Aboriginal-style" symbols.
- Consult the local AECG / Local Aboriginal Land Council before shipping 4.4.2 content; commission or licence Aboriginal artists and voices, credited and paid.
- Until consultation: fictional town on unnamed Country, Acknowledgement of Country screen, Custodian characters lead burns (not a player "fire tool").

## 7. Build order (stations)

1. **Station 1 — engine + Act 1 emissions loop** (4.2.2–4.2.6): grid, build menu, decade timer, CO₂/temperature graphs, smog LUT.
2. **Station 2 — greenhouse lens + weather vs climate HUD** (4.2.1, 4.2.3).
3. **Station 3 — Act 2 Clean tier**: energy swap with siting rules, remediation with time lag (4.2.5, 4.4.1).
4. **Station 4 — Restore tier**: biomes, succession, animals, cultural burns, satellites (4.3, 4.4.2).
5. **Station 5 — Circular tier + 2100 Report Card** (4.4.3–4.4.5, 4.5.1, 4.1).

## Sources

- Terra Nil: [Wikipedia](https://en.wikipedia.org/wiki/Terra_Nil), [Steam](https://store.steampowered.com/app/1593030/Terra_Nil/), [Game Developer — recycling mechanic](https://www.gamedeveloper.com/design/why-a-recycling-mechanic-saved-terra-nil-s-climate-cleanup-mechanics), [GWO interview](https://gameworldobserver.com/2022/09/30/terra-nil-free-lives-interview-reverse-city-builder-studio-ghibli), [Shacknews review](https://shacknews.com/article/134777/terra-nil-review-nature-appreciation), [Terra Nil Fandom wiki](https://terranil.fandom.com/)
- Art/tech: [pmndrs postprocessing](https://github.com/pmndrs/postprocessing), [N8AO](https://github.com/N8python/n8ao), [KayKit City Builder Bits](https://kaylousberg.itch.io/city-builder-bits), [Quaternius FAQ (CC0)](https://quaternius.com/faq.html), [Kenney (CC0)](https://kenney.nl/support), [Poly Haven licence](https://polyhaven.com/license), [Townscaper](https://www.gamedeveloper.com/blogs/how-townscaper-works-a-story-four-games-in-the-making)
- Cultural: [ORIC — cool burning](https://www.oric.gov.au/spotlight/cool-burning-country-and-community), [Creative Australia First Nations protocols](https://creative.gov.au/investment-and-development/protocols-and-resources/protocols-for-using-first-nations-cultural-and-intellectual-property-in-the-arts/), [NSW Curriculum — Aboriginal Education](https://curriculum.nsw.edu.au/about-the-curriculum/aboriginal-education)
