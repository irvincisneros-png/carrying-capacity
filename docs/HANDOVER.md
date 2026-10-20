# Handover

State of Carrying Capacity as of 2026-10-21, for whoever picks it up next. Read `README.md` first for how to run it,
then `docs/GAMEPLAY.md` (the design) and `docs/reviews/qa-playthrough.md` (three rounds of play-testing).

## State of the project

- **Complete and playable end to end**: title, scenario select with unlocks and stars, six scenarios (tutorial plus
  five), Act 1 boom by decades, turning point, Act 2 by seasons to 2100, 2100 Report Card with reflections, autosave
  and continue, teacher guide (`teacher.html`).
- **Systems**: energy grid, climate model, pollution and remediation, succession and the restoration front,
  wildlife with named families, residents with story beats and moods, dilemma cards with evidence, Caring for Country
  (draft), satellites and early warnings, circular economy (repurpose / recycle / landfill and research), community
  projects (late-game money sink), scenario policies (water sharing, drought plan, starfish control, turtle lighting,
  water restrictions), scenario mechanics (river, reef, outback, city heat), graphs with CSV export.
- **Quality bar**: `npx vitest run` (about 670 tests including whole-scenario balance runs on four event seeds),
  `npx tsc --noEmit -p .` and `npx vite build` all clean. No console errors in the QA replays. 60 fps on the
  test machine with 4× CPU throttling.
- **Content status**: all Aboriginal and Torres Strait Islander content (Elders, place names, cultural burning,
  co-management, the Red Dirt rehabilitation partnership) is **draft placeholder text pending AECG / Local Aboriginal
  Land Council consultation**. It is flagged `needsConsultation` in the content files and noted on the teacher page.
  Do not remove that flag or the note until consultation has happened.

## Architecture

```
            content/ (words + tuning data)
                 │
   ┌─────────────▼──────────────┐
   │ sim/  pure, deterministic   │  createGame, applyAction(state, action) -> {state, result}
   │       state in, state out   │  Act 1: advanceDecade   Act 2: tick(state, dtYears)
   └─────────────┬──────────────┘
                 │ GameState (immutable per step; cloneState before mutating)
   ┌─────────────▼──────────────┐
   │ game/controller.ts          │  owns the state, Act 2 clock, autosave, undo, emits 'state' / 'simEvents'
   └──────┬───────────────┬─────┘
          │               │
   ┌──────▼─────┐   ┌─────▼──────┐
   │ render/    │   │ ui/        │  DOM panels read the state; actions go back through controller.dispatch
   │ three.js   │   │ HUD, panels│
   └────────────┘   └────────────┘
```

- **Determinism.** Everything random in Act 2 draws from `seasonRng(seed, seasonIndex, salt)`, so the same save plus
  the same actions gives the same game. `tick(1)` equals four `tick(0.25)`s. The controller relies on this to
  simulate the next season ahead in idle time.
- **Act 2 season step** (`sim/act2.ts processSeason`): events (pre) → grid → pollution, remediation, wetlands →
  emissions → events (post) → reef and succession → layers (residents, mechanics, Country, wildlife) → year end
  (economy, policy costs, climate, meters, objectives, fail / finish).
- **Layers** (`sim/layers.ts`) connect the empathy and transition systems to the season and year steps and to
  actions (`applyLayerAction`).
- **Scenario mechanics** (`sim/mechanics/index.ts`): a scenario lists the modules it uses; the engine calls
  `mechBegin / mechSeason / mechYear / mechIncome / mechPlaced / mechMetric` and never knows scenario names. Module
  state lives in `GameState.flags` (prefixed keys such as `w.` river, `r.` reef, `o.` outback, `c.` city).
- **Saves**: `sim/save.ts` serialises to `localStorage` key `cc.save.v1` (one slot). New fields should go in
  `flags` or be optional, so old saves keep loading; `tests/save.test.ts` and `tests/layers-save.test.ts` cover this.
- **Rendering**: the renderer diffs state by version and chunk; vegetation and ambient life rebuild on later frames
  (one per frame). Quality tiers in `render/quality.ts`.

## How to add a scenario

1. Add the id to `ScenarioId` in `src/sim/types.ts` and a `ScenarioDef` in `src/content/scenarios/<id>.ts`
   (terrain kind, years, budget, availability overrides, modifiers, policies, `act2` block with objectives and the
   turning point). Register it in `SCENARIOS` and `SCENARIO_IDS` (`src/sim/scenarios.ts`) and `UNLOCK_REQUIRES`
   (`src/sim/progress.ts`).
2. Terrain: reuse a generator in `src/sim/gen/` or add one and route it in `src/sim/terrain.ts`.
3. Content: residents (`content/residents/<id>.ts` + `index.ts`), dilemmas (`content/dilemmas/<id>.ts` + `index.ts`),
   turning point (`content/turning/<id>.ts`), extra species (`content/speciesExtra/`, `BONUS_SPECIES`), Country
   overrides (`content/countries/`, flagged `needsConsultation`).
4. A mechanic, if needed: a module in `sim/mechanics/` with its hooks wired in `mechanics/index.ts`, metric keys in
   `MECH_METRIC_KEYS`, and events in `mechanics/events.ts`.
5. UI: an icon in `SCEN_ICON` and the science voice in `SCIENCE_VOICE` (`ui/screens.ts`), goal hints in `HOW_TO`
   (`ui/act2.ts`), and the teacher notes in `src/teacher/main.ts` (`NOTES`, a TypeScript error reminds you).
6. Tests: a scripted thoughtful player and an idle player in `tests/helpers/`, then add the scenario to
   `tests/scenario-play.test.ts` and, if it has an Act 1, to `tests/balance-seeds.test.ts`. The thoughtful run must
   win on every seed, the idle run must not.

## Known issues

- **Content consultation** (above) is the blocker for public release.
- Act 2 money: Coal Coast and Reef Island still bank money in the last decades; community projects now give it a
  use (about $1.7M of rounds in all), but the scripted balance players do not use them, so their effect on balance is
  untested beyond unit tests.
- River Town's drought plan is reactive in the scripted player (switched on at the first declared drought). The
  plan's banking only helps when switched on before dry years; the teacher page and policy text say so.
- The Act 2 clock widget is not refreshed by the debug-only `__cc.game.debugTick` while paused (it catches up on the
  next real tick). Players never see this.
- `vite build` warns that the main chunk is over 900 kB (three.js + post-processing); it loads once and is cached.
- Phones work at 375 px but are cramped; a laptop is the intended device.
- Reflection answers and the letter are not saved or exported.

## Next steps

1. AECG / Local Aboriginal Land Council consultation on all `needsConsultation` content, then revise text and names.
2. Classroom pilot with one Year 9 class: watch where students get stuck (QA estimates are adult driver-based).
3. Optional: export the Report Card and reflections as a printable page or PDF for assessment.
4. Optional: let the scripted balance players fund community projects, and add a balance band for them.
5. Optional: code-split three.js post-processing to shrink the first load on slow school networks.

## Deployment

- `.github/workflows/deploy.yml` runs `npm ci`, `npm test`, `npm run build` and deploys `dist/` to GitHub Pages.
- It is **manual only** (`workflow_dispatch`; the `push` trigger is commented out), and the repository
  `irvincisneros-png/carrying-capacity` is **private**. GitHub Pages on a private repo needs a paid plan, and going
  public exposes the draft cultural content, so **the owner must approve making the repository public** (and ideally
  wait for consultation) before enabling the push trigger or running the workflow.
- `vite.config.ts` sets `base: '/carrying-capacity/'`, so the site expects to live at
  `https://<user>.github.io/carrying-capacity/`; `teacher.html` sits beside `index.html`.
