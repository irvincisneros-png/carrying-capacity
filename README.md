# Carrying Capacity

A browser game for Year 9 Science (NSW Science 7–10, 2023 syllabus, Environmental sustainability). Students grow
a town through the industrial boom (Act 1), see the climate and pollution consequences in their own graphs, then
lead the transition to 2100 (Act 2) while keeping people and wildlife safe.

- Play: `index.html` (the game). Teachers: `teacher.html` (lesson plans, syllabus map, scenario notes, limitations).
- Stack: Vite + TypeScript (strict) + Three.js + `postprocessing` / N8AO, plain DOM UI, Vitest. No backend; saves
  live in the browser's `localStorage`.

## Run, build, test

```sh
npm install
npm run dev          # http://127.0.0.1:5173/carrying-capacity/
npm test             # vitest run (about 670 tests, ~40 s; the balance suites play whole scenarios)
npx tsc --noEmit -p .
npm run build        # tsc + vite build -> dist/ (index.html, teacher.html, stylelab.html)
npm run preview      # serves dist/ at /carrying-capacity/
```

URL switches: `?teacher` unlocks every scenario for that visit, `?debug` shows the FPS / draw-call meter,
`?seed=N` starts new games on a different map and weather (balance is tuned on the default seeds).

## Structure

```
index.html, teacher.html, stylelab.html   Vite entries (stylelab is the art-direction lab, not shipped to students)
src/
  sim/        Pure TypeScript simulation: no DOM or three.js imports, deterministic, fully unit-tested
    game.ts       createGame, applyAction (Act 1 decades), placement
    act2.ts       Act 2 clock: tick() runs whole seasons; year end, carry-over / Transition Fund, fail and finish
    energy.ts     grid balance per season (day / night blocks, storage, coal and gas dispatch)
    pollution.ts  air / water / soil fields, remediation, wetlands
    restoration.ts succession (bare -> pioneer -> shrub -> woodland), reef recovery
    events.ts     weather and hazard events (odds rise with warming)
    climate.ts    CO2 and temperature model (see content/simplified.ts)
    layers.ts     empathy / Country / circular / satellites / policies wired into the season and year steps
    mechanics/    scenario-specific modules (river, reef, outback, city, heat) behind one dispatcher
    objectives.ts, report.ts, outlook.ts, projects.ts, progress.ts, save.ts
    gen/          terrain generators per scenario kind
  content/    All words and tuning data: scenarios, residents, dilemmas, species, research, projects, turning points,
              Country (draft, pending consultation), simplified notes, tutorial
  render/     three.js diorama: terrain, water, vegetation, buildings, ambient life, smoke, overlays, quality tiers
  ui/         DOM HUD, panels, modals, graphs (canvas), toolbar, empathy layer, screens
  game/       controller: owns GameState, runs the Act 2 clock, autosave, undo, events to the UI
  teacher/    teacher.html script and print-friendly styles
  audio/      synthesised sound effects
tests/        Vitest suites; tests/helpers holds the scripted players used by the balance tests
docs/         design (DESIGN, GAMEPLAY, PLAN), QA reports (docs/reviews), screenshots (docs/screens), HANDOVER.md
```

## Scenarios

| Scenario | Difficulty | Years | Play time | Goal (by the end year) |
|---|---|---|---|---|
| Green Valley | Tutorial | 1960–2040 | 20–30 min | Guided: clean power, heal the valley, an animal returns, old sites reused |
| Coal Coast | Easy | 1850–2100 | 70–100 min | Warming ≤ 1.8 °C, estuary ≥ 60 (10-year mean), Society ≥ 50, every Act 1 site repurposed or recycled |
| River Town | Medium | 1880–2100 | 75–110 min | River ≥ 60 (10-year mean), no town water failures after 2040, farms ≥ 50 |
| Reef Island | Hard | 1900–2100 | 70–105 min | Coral ≥ 50 (5-year mean), no homes lost, tourism ≥ 45 |
| Red Dirt | Hard | 1890–2100 | 75–110 min | Net zero by 2060, mine rehabilitated with the Traditional Owners, aquifer ≥ 40, no water failures |
| Net Zero City | Expert | 2025–2100 | 85–120 min | Net zero (48 kt) by 2050, Society ≥ 60 every year, ≤ 20 heat deaths |

Stars: one for the goals, two with the bonus, three when every resident's story also ends well. Unlock order:
Green Valley → Coal Coast → River Town and Reef Island → Red Dirt → Net Zero City.

## Performance targets

- ≥ 30 fps on school Chromebooks, 60 fps target; quality tiers Very low / Low / Medium / High / Ultra with Auto (drops a tier
  when the 2-second average is under 45 fps; starts on Very low on a software renderer). Measured on a SwiftShader proxy in
  docs/reviews/perf-chromebook-proxy.md.
- ≤ 150 draw calls (instancing for repeated meshes); shadows none at Low, 1024 at Medium; pixel ratio capped at 0.6 (Very low), 1 (Low) and 1.25 (Medium).
- The sim runs off the render loop: the next Act 2 season is simulated ahead in idle time and heavy layer rebuilds
  are spread over frames. Measured (headless Chrome, 4× CPU throttle, Net Zero City at 4× speed): 60 fps average,
  worst frame about 33 ms, none over 50 ms.

## Deployment

`.github/workflows/deploy.yml` runs `npm ci`, `npm test` and `npm run build`, then publishes `dist/` to GitHub Pages
on every push to `main` (and on manual dispatch). The owner approved going live on 2026-10-21 (commit 1f5244d) and the
repository is public, so **anything pushed to `main` goes live**. See `docs/HANDOVER.md` for the content caveat.
