# Content review resolution

Response to docs/reviews/codex-content-review.md. Codex was treated as a strong second opinion; each finding was checked against the source text and general knowledge. Cultural passages use respectful generic narrator text (no literal "Placeholder:" on screen) and keep `needsConsultation: true`.

Final check: `npx vitest run` 633/633 pass; `npx tsc --noEmit -p .` clean.

| Finding | Outcome | Reason / change |
|---|---|---|
| facts.ts:7 coal age | applied | Codex wording (millions of years, quickly releases stored carbon) |
| facts.ts:9 Arrhenius number | modified | Says CO2 doubling; "higher than the best estimate today" (avoids apostrophe), kept "idea held up" |
| facts.ts:10 Model T | applied | Dropped unsupported causal claim |
| facts.ts:12 1920s coal | applied | Networks varied, coal or hydro |
| facts.ts:15 Keeling | modified | "long-running record ... seasonal ups and downs on a rising trend" (kept "Keeling" for test) |
| facts.ts:16 aerosols | modified | Paused/partly reversed warming; some aerosols + natural variation |
| facts.ts:21 Paris | applied | Added pre-industrial baseline |
| facts.ts:22 400 ppm | applied | 9 May 2013, since 1958; removed "human history"/"today" |
| research.ts ewaste | applied | New blurb; 2022 22.3% statistic |
| research.ts sorting | applied | Blurb replaced |
| research.ts biogas | modified | Equal-mass comparison, digesters collect methane; kept composting sentence |
| research.ts green-steel | applied | Blurb and evidence caveat on other stages |
| research.ts plastic-to-fuel | modified | Explained pyrolysis, dropped "most life-cycle studies" tally |
| act2.ts:6 heatwave | modified | "an exceptionally severe" instead of "record-breaking" |
| act2.ts:8 drought | modified | Rainfall below needs; "in this simulation" duration; kept hydro/fire consequences |
| act2.ts:16 marine warning | applied | Risk language, cannot prevent heat stress |
| act2.ts:18 bushfire regrowth | modified | Recovery depends on what survived; cool burn "usually" |
| act2.ts:24 crown-of-thorns | applied | Native predators, runoff "may contribute", control teams |
| act2.ts:26 surge | applied | "above the predicted tide" |
| act2.ts:50 estuary stages | modified | New labels (bare sediment ... healthy estuary habitat); only consumer is tile tooltip via stageLabel; updated act2-env test; added comment instead of UI text |
| act2.ts:52 reef stages | applied | New coral labels; test unaffected |
| circular.ts:35-36,66-67,78-79 rehab | modified | Common blurb; stories varied per site, mention soil testing/treatment |
| circular.ts:112 landfill | applied | |
| circular.ts:114 car park | applied | |
| circular.ts:119 LANDFILL_STORY | applied | Removed methane claim |
| scenarios/net-zero-city.ts:51 | modified | "game's simplified net-zero target by 2050 (48 kt a year or less)"; the separate "real net zero needs removals" explanation not added (no UI slot; owner may want it in a tooltip) |
| scenarios/net-zero-city.ts:53 | applied | "Reduce ... (benchmark: 20 or fewer)" |
| scenarios/red-dirt.ts:9,52 | modified | Agreed-plan wording in blurb and objective; "pit to give back" -> "rehabilitate"; consultation comment (no flag field on ScenarioDef) |
| scenarios/reef-island.ts:37 | applied | Vinegar or bile salts, approved injections |
| scenarios/river-town.ts:33 | applied | |
| turning/green-valley.ts:6 | applied | Bushfire plans, trained crews |
| turning/red-dirt.ts:7 | modified | Generic global-emissions framing; Traditional Owners rehab plan; needsConsultation comment (TurningPointDef has no flag field) |
| turning/reef-island.ts:6 | applied | |
| turning/reef-island.ts:7 | modified | "reduce emissions as part of wider climate action" |
| tutorial.ts:68 wind | applied | |
| tutorial.ts:83 phytoremediation | modified | Explained, disposal caveat, excavation described |
| tutorial.ts:98 recolonisation | applied | |
| report.ts:14-15,23 prompts | modified | Generic residents/next-generation prompts; LETTER_PROMPT no longer names Sam and Jordan (3 tests updated) |
| report.ts:27-33 epilogues | modified | Four tiered generic versions, no invented estuary or recovery claims |
| report.ts:35 failure | applied | "failure threshold" wording in epilogue and 'fail' reflection; report.test regex updated |
| file:finding | status | reason / change |
| country.ts :42-60 invented site approval/significance | modified | New `siteContent()` helper: neutral narrator text, no Elder quotes, no invented significance; "Placeholder:" prefix stripped per coordinator (needsConsultation kept) |
| country.ts :44,50,52,59-60 forgiving Elder | applied | disturbed/ignored use Codex wording ("request was not followed... agreed process") |
| country.ts :64,67 hand back management | applied | comanage line = "agreed on responsibilities, decision-making and funding" |
| country.ts :68,71-74 cultural burning recipe | applied | burnWrongSeason/burnDone/burnQuote/unlockBurning rewritten: led by cultural fire practitioners, no season/flame/regrowth claims |
| country.ts :69,73-77 knowledge-as-reward, seasonal indicators | applied | burnLocked and seasonalTeaching use Codex wording; trustGrows, unlockFishing made neutral |
| countries/index.ts :8 fallback reuses Coal Coast geography | modified | Base text is now geography-neutral; comment corrected. Country is inactive (no Elder) for green-valley, so fallback never shown |
| net-zero-city :16-34 | applied | siteContent helper, no Elder voice |
| net-zero-city :45,49 burning/houses safer | applied | burnDone/unlockBurning neutral, monitoring wording |
| net-zero-city :46 fish for everyone | applied | Codex wording + "in this game" for the mechanic |
| red-dirt :18-36,53 tea/biscuits | applied | helper sites; biscuits trustGrows override removed (base used) |
| red-dirt :47,51-52 spinifex/mulga fire | applied | removed; recovery depends on rainfall; burnQuote override removed |
| red-dirt :48 waterhole protocol | applied | Codex wording |
| reef-island :16-34 | applied | helper sites |
| reef-island :45,49 dry-season burning | applied | plan led/approved by cultural fire practitioners |
| reef-island :46 fish/turtles/dugong rest | applied | Sea Country plans wording |
| river-town :16-34 | applied | helper sites |
| river-town :45,49 thirsty trees | applied | practitioners decide |
| river-town :46 cod closure | applied | community fishing plan wording |
| species.ts koala/platypus "families/pairs" labels | applied | Labels e.g. "Marri woodland koalas", "Reedbed platypuses", arrival texts per Codex; tests updated |
| species.ts koala :128 ground | applied | Codex wording |
| species.ts green-turtle hatchlings/Old Shelly streak | modified | Youngsters family -> "Young turtles", juvenile origins unknown; thrive text per Codex; added `nest` override (no individual streak). Family name "Old Shelly" kept (id/name used by other content/tests) |
| species.ts frogs :269 wetland | applied | help text uses Codex wording |
| species.ts shorebirds :342 | modified | "after their long journey" (dropped {n} placement unchanged) |
| reef-turtle :25,32-45 Big Tilly streak | modified | nest texts neutral/consecutive summers, different females; "Tilly's youngsters" -> "Young turtles"; Big Tilly kept as a grazing named adult (referenced elsewhere); thrive nestStreak 6 unchanged (sim rule: individual-nesting is in src/sim, owner/other agent) |
| reef-turtle :45 / dugong :81 cultural content | applied | cultural passages replaced with neutral note; dugong cites TSRA project; added optional `needsConsultation` on SpeciesDef, set true on both |
| mangrove-kingfisher naming | applied | Torresian kingfisher, Todiramphus sordidus (confident; BirdLife Australia split from T. chloris). id unchanged |
| mangrove-kingfisher :139 third/fourth pair | applied | "More kingfishers have joined the inlet population" |
| murray-cod :20,40 | applied | Codex wording (nickname kept) |
| murray-cod :44 weirs/cold water | applied | Codex wording |
| southern-bell-frog :116 listing | applied | "nationally Vulnerable and listed as Endangered in NSW" |
| rock-wallaby :76 | applied | "Conservation programs use predator control, habitat management and monitoring" |
| budgerigar :99 thousands | applied | "A large flock wheels over the plain" |
| budgerigar :105-106,113 | applied | blurb, needs ("reliable water, from rain, groundwater or both") and evidence per Codex; 2019-20 mortality claim removed |
| file:finding | status | reason / change |
| coal-coast:a1-outfall settling tank | applied | Evidence now says settling removes solids, nutrients/pathogens need more treatment; tank preview "Fewer solids reach the water" |
| coal-coast:a1-ridge "now standard" | applied | "Planning should involve the relevant Traditional Owners early" |
| coal-coast:d2-countryfire "used fire" | modified | Evidence and setup now present/continuing practice; practices differ between places |
| coal-coast:a1-smoke evidence + "Jobs matter more" | applied | Filters/scrubbers wording; option label now "Delay the upgrade to keep costs down" (id unchanged) |
| coal-coast:a1-tip truck trips | modified | Outcome: more recovered, less to tip, needs trucks/planning (kept "tip lasts years longer") |
| coal-coast:d2-closure "nothing"/"street" | applied | Setup and preview reworded to "little time to find new income" |
| coal-coast:d2-coalphase / d2-lastcoal renewables sufficiency | modified | Evidence/setup/outcome add storage, grid connections, backup, difficult-weather periods; no effects changed |
| coal-coast:d2-koalaroad rope bridge | modified | Outcome now wildlife underpass + cameras (evidence already said underpasses/overpasses) |
| coal-coast:d2-fireseason "everyone gets out" | applied | Preview "Earlier warnings help people leave safely"; outcome notes practised plan |
| coal-coast:d2-plasticfuel rigged | modified | Yes outcome no longer says it underdelivers; review outcome uses Codex neutral text; preview "Wanted the evidence first". Effects untouched |
| coal-coast:d2-biogas compost | applied | Digestate wording in setup, evidence, outcome, preview |
| coal-coast:d2-turtlenest thresholds | modified | Evidence generalised, ranger monitoring; setup 32 C softened to "mostly females" |
| coal-coast:d2-tourism breeding season | applied | Preview/setup/evidence now feeding and resting; "quiet seasons" -> "careful timing" |
| coal-coast:d2-festival drones | applied | Evidence/outcome/preview: no bangs/smoke but motors/lights can still disturb wildlife |
| coal-coast:d2-volunteers sentiment | applied | Codex sentence |
| coal-coast:d2-ewaste date | applied | "In 2022, only 22.3%..." (matches ITU/UNITAR Global E-waste Monitor 2024) |
| coal-coast:d2-dogs bias | applied | Evidence: restrictions match local needs; year-round exclusion where sensitive |
| coal-coast:d2-signs gradualism | modified | Evidence adds agreed names/permissions/timing with Traditional Owners; option label "a few places agreed with the community"; evidenceBacked flag kept (tests need one per non-open card); needsConsultation kept |
| coal-coast:d2-gasretire | applied | Evidence uses reliability assessment/extended low-wind-solar wording; outcome adds "after a reliability check" |
| coal-coast:d2-legacy | applied | Preview "Less funding for shared projects"; outcome neutral on household spending |
| coal-coast:(own check) EV bus running cost | modified | "often cheaper to run, depending on electricity and maintenance" |
| green-valley:gv-solar-site | applied | Codex evidence wording plus the rooftop sentence |
| river-town:a1-salt | applied | Codex wording (salt from rainfall, rocks, sediments over millions of years) |
| river-town:a2-buyback | applied | Evidence per DCCEEW wording; outcome "farmers sell their water and some leave" |
| river-town:a2-bloom | modified | Setup now "what to add to warnings"; evidence ends with nutrients/flows lowering risk |
| river-town:a2-almonds | applied | Orchards need water to stay alive, even if crop sacrificed |
| river-town:a2-carp | applied | Setup, evidence, outcome ("trial considered", die-off "could" foul water) |
| river-town:a2-solar | applied | Setup, evidence, saltbush outcome and preview no longer promise salt "washed down"/reclaimed |
| file:finding | status | note |
| reef-island:a1-sewage nutrient removal | modified | "Treatment designed to remove N and P can cut pollution; basic settling removes much less" |
| reef-island:d2-starfish title/evidence | applied | Title "Too many crown-of-thorns starfish"; vinegar/bile salts, kills them |
| reef-island:d2-turtle-lights buckets | modified | Twins alert the trained patrol; "leave" outcome uses rangers/volunteers helping stranded hatchlings |
| reef-island:d2-nursery "no help rebuilding" | modified | Cleaner water may help natural recovery; no coral planted |
| reef-island:d2-sea-country invented opposition | modified | Neutral community-led agreement vs agency-led plan; removed fisher worry, "rangers stop reporting", "Placeholder:" prefix; needsConsultation kept |
| reef-island:d2-low-houses preachy | applied | Reworded as suggested |
| red-dirt:a1-bore | modified | Tanks "need little pumping", maintenance/pumps; groundwater buffers short dry periods |
| red-dirt:a2-pit | modified | Closure depends on site; pit lake may create habitat or risks; outcome/preview no longer assert salty/bird benefit as fact |
| red-dirt:a2-water | modified | Removed "a fifth" claims; imported water may temporarily reduce pumping, no recharge |
| red-dirt:a2-ferals | modified | Species-specific design/monitoring; removed trapped wallaby, goanna harm and "right ones" |
| red-dirt:a2-hydrogen | applied | "At least about nine litres... higher with treatment, cooling" |
| red-dirt:a2-school | modified | Removed Flying Doctor cost claim and older-people stereotype |
| red-dirt:a2-handback | modified | Recognises continuing responsibilities of Traditional Owners; needsConsultation kept |
| net-zero-city:transit-choice | modified | Compare passengers/times/costs; bus priority "sometimes" quick. Kept evidenceBacked: true on rail option (tests/sim depend on it) |
| net-zero-city:budget-squeeze | applied | Rates affect property owners, renters via flow-on, rebates |
| net-zero-city:ev-or-transit | modified | EVs can lower running costs; removed unsourced fastest-cities claim |
| net-zero-city:factory-sites | modified | Employment depends on site; "few ongoing jobs" for park |
| net-zero-city:lights-on | modified | Battery duration depends on design; game battery covers short peaks |
| file:finding (short) | status | reason / what changed |
| coal-coast: Mick/Lena/June/Priya long timeline | modified | Late beats and endings now speak as successors (Mick's granddaughter, Linh, "the Kowalskis"/"the Trans", Priya's department/students); 1952 removed from mick-furnace (test now matches "one suitcase"); ids untouched. |
| coal-coast: june-country/waiting/neglect/bad timeless Elder | modified | Rewritten as "Placeholder:" community-decides text; removed kettle, "longer than anyone can count", automatic forgiveness. Also tidied june-thanks, june-teaching, june-mixed, blurb and traits (not flagged, same trope). |
| coal-coast: june-fire / june-later | modified | Fire now needs skilled practitioners, conditions and agreed plan, only if community is willing; 12-year-old burn leader replaced with approved learning activities. needsConsultation kept. |
| coal-coast: priya-emissions-good / priya-lag climate commitment | modified | CO2 rises while additions exceed removals; warming roughly levels off at net zero CO2, earlier cuts lower the peak. Test-required phrases ("still moving towards X C", kilotonnes, eqTemp) retained. |
| coal-coast: lena-linh-good "out of 100 clean" | modified | Now "health score ... out of 100" plus oxygen, nutrients, wildlife; spoken by Linh. Kept "health score" not "game" (in-world voice). |
| coal-coast: sam-jordan blurb / sj-teens | applied | Blurb and speech replaced as suggested, keeping {temp}. |
| coal-coast: dot-solar "betrayal" | modified | Guilt line removed; now checks grazing, access, soil. |
| green-valley: jo-fire / jo-firebreak | modified | Bushfire plan and brigade wording; firebreak/windbreak framed as needing local fire advice (options unchanged). |
| green-valley: jo-solar self-deprecation | applied | Removed "Even I can follow that one". |
| green-valley: ali-graphs local warming | applied | Coal CO2 adds to global warming; valley stands for a larger emissions pathway. |
| green-valley: ali-koala 14 trees | applied | Now "14 connected woodland tiles" as a game rule, real habitat varies; {koalas} kept. |
| river-town: kerry-drip salt | applied | Drip cuts water losses; salt and drainage still need monitoring. |
| river-town: ray-seasons/door/end-good Elder | modified | Placeholder community-defined text; removed "all anyone ever wanted", waiting/billy tropes. Also ray-thanks, ray-teaching, ray-water, ray-end-mixed/bad, blurb, traits. Flags kept. |
| river-town: lan-bloom "stop most" | applied | Reduce bloom risk; heat and other factors still matter. |
| river-town: ruby-swim weir | applied | Title "Summer at the swimming spot"; supervised spot away from the weir. |
| river-town: marg-kelly blurb / marg-slow | applied | Notices changes and checks against Lan's measurements; deep pools may be low in oxygen. |
| reef-island: mere-country invented relationship | applied | Placeholder; island community determines representation; also title changed. |
| reef-island: mere-waiting/neglect/bad tea Elder | modified | Placeholder community-decides text; kettle/tea/grudge removed. Also mere-thanks, mere-later/good/mixed, blurb, traits (same trope). Flags kept. |
| reef-island: kieran-starfish | applied | "Pale feeding scars where living coral tissue has been eaten" (CTS digest externally). |
| reef-island: hana-satellite | applied | Forecast warning, uncertain; no retroactive "shading" guarantee. |
| reef-island: hana-dugong | applied | Seagrass essential; nets, boat strikes, disturbance named. |
| reef-island: twins-lights bucket rescue | applied | Trained turtle patrol and rangers help and report lights. |
| reef-island: twins-nesting (twins-streak) individual turtle | modified | Rangers recorded nests; different females return in different years. Wording own. |
| reef-island: twins-bad guilt-trip | modified | "We tried. Did you?" removed; keeps the bare map plus the twins keep old surveys for future rangers. |
| file:finding | status | reason / change |
| red-dirt:wally-pit/good/bad + family "large, loud, loving" stock character | modified | Removed family stereotype, "patient/funny/generous" traits and blurb, "way of things" and "do not hold it against"; good/mixed/bad endings now state outcomes generically (bad: response "theirs to say"). All kept needsConsultation. Used neutral narration rather than literal "Placeholder:" text. Also trimmed wally-seed (invented "right season", nephew) and homeHint. |
| red-dirt:shaz-closed-retrained (Wally crew directing water) | modified | Now follows "the rehabilitation team's plan"; community portrayal removed so no flag needed. |
| red-dirt:rohan-halfway, rohan-signoff, rohan-good (Wally/crew portrayal) | modified | Wally and crew references replaced by "rehabilitation team"; no community-specific portrayal remains. |
| red-dirt:pete-wally | modified | Kept Wally, removed "his crew helps with cats and foxes" and the fire disagreement; added needsConsultation: true. |
| red-dirt:rohan-stages / rohan-signoff 5-year monitoring | modified | Monitoring against agreed criteria, "can run many years; game simplifies"; beat retitled "Sign-off day". |
| red-dirt:rohan-netzero carbon vs CO2 | modified | "carbon dioxide", 12 kt called a simplified game target, real net zero needs removals balance. |
| red-dirt:rohan-halfway native seed | applied | "Seed mix was selected for this site; monitoring shows which species are establishing". |
| red-dirt:tia-ben-dish / shade School of the Air | applied | "We usually learn from home through School of the Air"; swings too hot "at our school gathering this term". |
| red-dirt:tia-ben-empty count then "Zero" | applied | Removed "Zero"; now logs date, weather and watch time. |
| net-zero:lorraine-fire | applied | Cultural fire practitioners and agency staff agree roles, training, conditions; NC retained. |
| net-zero:lorraine-bad | applied | Decisions made without Traditional Owners' agreed participation; removed grudge/kettle. Also removed biscuit/"love"/sits-at-back tropes in good/mixed/neglect, and "old way" claim and "far north" in heat/birds beats. |
| net-zero:Dolores timeline | modified | Removed age 82; first-person beats capped at 2045; late beat and endings now about neighbours continuing her check-in program. |
| net-zero:dolores-checkin | applied | Codex wording (asks what help, somewhere cool, will ring again). |
| net-zero:Zoe timeline | modified | Strike 2025-35, vote 2026-30, slow 2030-40, solar/trees to 2045; letter and endings now from a new generation continuing Zoe's records; blurb "Seventeen in 2025". |
| net-zero:aisha-cuts / aisha-lag | modified | Lower emissions slow CO2 build-up, do not cool the city; warming follows cumulative CO2 and levels off after global net zero (removed "locked in"). |
| net-zero:aisha-netzero 40 vs 48 | modified | Uses scenario 48 kt as simplified target; real net zero needs measured emissions and removals. |
| net-zero:zoe-strike | modified | Group presents emissions sums to council; slogan removed; still sets up the invite choice. |
| net-zero:zoe-solar meter backwards | applied | Display switches from importing to exporting. |
| net-zero:zoe-trees shade | applied | Trees take years to shade; shade sails meanwhile. |
| coordinator: strip "Placeholder:" prefixes | applied | Removed placeholder strings from Wally and Lorraine family/blurb (and Lorraine's "funny" stock trait text); rely on needsConsultation. |
| coordinator: Dot Harris late beats in residents/coal-coast.ts | rejected | Outside my assigned files (parallel edit risk); needs the coal-coast owner. |

Additional: Dot Harris late beats and endings (residents/coal-coast.ts) moved to successor voice per coordinator; literal "Draft:" blurb suffixes removed from Elder entries.

## Owner decisions
- rail-and-lanes keeps `evidenceBacked` (sim tests depend on it); text fixed.
- d2-signs few-signs option keeps `evidenceBacked` (a test requires one per card); consider making it noCleanAnswer.
- `nestStreak` rule in src/sim treats a streak as one turtle; text now says different females. Sim change needed to fully match.
- ScenarioDef/TurningPointDef lack a needsConsultation field; Red Dirt cultural lines flagged by code comment only.
- tia-ben-grown late beat has the same age/timeline issue as Dolores/Zoe; not flagged by Codex, not changed.
- Estuary habitat-ladder caveat sentence has no UI slot.
