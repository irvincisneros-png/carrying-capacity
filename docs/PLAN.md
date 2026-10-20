# Carrying Capacity — Full Game Plan

Goal: a complete, browser-playable game for Year 9 Environmental Sustainability with multiple scenarios across difficulty levels, running ≥30 fps (target 60) on school laptops/Chromebooks. Art style is chosen by the owner from `docs/mockups/` before the render layer is finalised.

## Build workflow

- Claude builds (Opus + Sonnet sub-agents). Codex only reviews, play-tests and generates images.
- Every station: `npm test` + `npm run build` pass, browser-verified (screenshots, FPS check, no console errors), committed.

## Stations

| # | Station | Syllabus | Contents |
|---|---|---|---|
| 1 | Engine + Act 1 Boom | 4.2.2, 4.2.4, 4.2.6 | Grid sim, decade loop, CO₂/temp graphs, CSV, summary |
| 2 | Art pass (chosen style) + perf | — | Final render layer, quality tiers, FPS meter, 60 fps budget |
| 3 | Climate HUD | 4.2.1, 4.2.3 | Weather ticker vs climate line; greenhouse "atmosphere lens" overlay |
| 4 | Act 2 Clean tier | 4.2.5, 4.4.1 | Renewables with siting rules, remediation with time lag, pollution plumes |
| 5 | Act 2 Restore tier | 4.3.1–4.3.4, 4.4.2 | Biomes + succession, animals/corridors, climate events, satellites, Caring for Country (cultural burns) |
| 6 | Act 2 Circular tier | 4.4.3–4.4.5, 4.5.1, 4.1 | Waste hierarchy recycling of every building, recycling innovations tree, 2100 Report Card |
| 7 | Scenarios + difficulty | all | Scenario select, 6 scenarios, difficulty modifiers, win/lose, star ratings |
| 8 | Polish + teacher | — | Tutorial, audio, teacher page (dot-point map, answer guide), accessibility, 375px |

## Scenarios

| Scenario | Difficulty | Setting | Focus | Win condition |
|---|---|---|---|---|
| Green Valley | Tutorial | Small inland valley, 16×16 | Guided build → clean → restore | Complete guided steps |
| Coal Coast | Easy | Illawarra-style coast (default map) | Full Act 1 → Act 2 | ≤1.8 °C by 2100, all meters ≥40, all dirty buildings recycled |
| River Town | Medium | Murray–Darling inland town | Water cycle, drought, irrigation, salinity, wetlands | River health ≥60, no town water failures after 2040 |
| Reef Island | Hard | Tropical island near a reef | Sea-level rise, bleaching, mangroves, tourism economy | Reef health ≥50 at 2100, no flooded homes |
| Red Dirt | Hard | Outback mining town | Solar/storage, scarce water, heatwaves, mine rehab | Net-zero by 2060, mine site fully rehabilitated |
| Net Zero City | Expert | Big coastal city, starts in 2025 | Tight budget, fast emissions cuts, many crises | Net-zero by 2050, Society ≥60 throughout |

Difficulty modifiers (data-driven per scenario): starting budget, event frequency/severity, climate sensitivity in the game model, remediation time, hint level, meter failure thresholds. Stars: 1 = win, 2 = win + bonus goal, 3 = win + bonus + under time/budget.

## Performance budget (Station 2 enforces)

- ≤150 draw calls; instancing for all repeated meshes; one texture atlas; merged post pass.
- Shadow map 1024 at Medium, none at Low; DPR clamp 1.5 Medium.
- Adaptive quality: drop a tier if 2 s average <45 fps; FPS meter behind `?debug`.
- Sim runs off the render loop (decade/tick events), no per-frame allocation.

## Owner requirements (2026-10-20)

- A game students and adults *want* to play — not a worksheet. At least 4–5 scenarios, each with a clear, achievable end goal taking **1–2 hours** of play.
- School focus: HPGE, social-emotional and intellectual domains. Don't label it, but design for **empathy and care for the environment/planet**: named residents with stories who react to decisions (steelworker, fisher, farmer, Elder, kids), animals players grow attached to, consequences felt by people and creatures, reflective moments at scenario end. Intellectual: real trade-offs, data, systems thinking, no single right answer.
- Graphics options: Low / Medium / High / Ultra with auto-detect from measured FPS; ≥30 fps on Chromebooks, 60 fps target.
- Art direction: Claude picks the best balance of visuals vs achievability after comparing real in-engine style-lab screenshots with the mockups.
