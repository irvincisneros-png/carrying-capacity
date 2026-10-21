// App shell: wires the renderer, the game controller and every UI component together, and handles input
// (pointer / touch / keyboard) for building, demolishing and inspecting.
import { BUILDINGS, footprintFor } from '../sim/buildings';
import { createGame, currentDemand } from '../sim/game';
import { estuaryHealth } from '../sim/metrics';
import { buildingAt, canPlace, CLEAR_COST, DEMOLISH_REFUND, availability } from '../sim/rules';
import { stageLabel } from '../sim/restoration';
import { yearFraction } from '../sim/season';
import { isScenarioId } from '../sim/scenarios';
import { TILE_KIND_NAMES, TileKind, type BuildingId, type GameState, type Rotation, type ScenarioId, type SimEvent } from '../sim/types';
import { GameController, type Speed } from '../game/controller';
import { GameRenderer } from '../render/renderer';
import { ambientTick, sfx, unlockAudio } from '../audio/sfx';
import { Clock, EnergyPanel, ObjectivesPanel, hazIcon, type ShowMeKind } from './act2';
import { clear, degC, fmt1, h, svg } from './dom';
import { showDilemma, SpeciesPanel, Voices } from './empathy';
import { beatChoice, dilemmaCard, reportCard, speciesList, storyLine } from './adapters';
import { hideDraft, installDraftBanner, NEUTRAL_COMMUNITY } from './draft';
import { CountryPanel, ResearchPanel, SatellitePanel, showDisposal, siteName } from './layers';
import { PolicyPanel, Readouts, TutorialOverlay } from './scenario';
import { loadProgressSafe } from './screens';
import type { DilemmaCard } from './types';
import { GraphsPanel } from './graphs';
import { Hud } from './hud';
import { bIcon, UI_ICONS } from './icons';
import { closeAllModals, closeTopModal, floater, modalOpen, Tip, toast } from './modal';
import { Act1GoalsPanel, upgradeBlock } from './act1';
import { showDecadeReport, showEnding, showIntro, showSettings, showTitle, showTurningPoint } from './screens';
import { Toolbar, type Tool } from './toolbar';
import { EVENT_NAMES } from '../content/act2';
import { HIDDEN_COSTS } from '../content/hiddencosts';
import { learnOf } from '../sim/fieldkit';
import { openCapacityPanel } from './capacity';
import { chainOpener, openCauseChain } from './causes';
import { FieldKitPanel, latestPredictionView, promptPrediction } from './fieldkit';
import { FieldGuide, glossarySeen, onGlossaryNew, setGlossarySeen } from './glossary';
import { openPrintReport, showHousehold } from './household';
import { LEARN_ICONS } from './learnicons';
import * as SIM from '../sim';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const TEACHER = params.has('teacher');

const GREEN: ReadonlySet<BuildingId> = new Set<BuildingId>(['rooftopsolar', 'solarfarm', 'windfarm', 'offshorewind', 'hydro', 'pumpedhydro', 'battery', 'tidal', 'phytoremediation', 'wetland', 'sewagetreatment', 'nursery']);

export class App {
  renderer: GameRenderer;
  game: GameController;
  hud: Hud;
  toolbar: Toolbar;
  graphs: GraphsPanel;
  clock: Clock;
  energy: EnergyPanel;
  objectives: ObjectivesPanel;
  act1Goals: Act1GoalsPanel;
  voices: Voices;
  species: SpeciesPanel;
  tip: Tip;
  private ui: HTMLElement;
  private title: HTMLElement | null = null;
  private action: HTMLElement;
  private demand: HTMLElement;
  private nextBtn: HTMLButtonElement;
  private undoBtn: HTMLButtonElement;
  private logDrawer: HTMLElement;
  private logList: HTMLElement;
  private inspectEl: HTMLElement;
  private debugEl: HTMLElement | null = null;
  private rot: Rotation = 0;
  private hover: { tx: number; ty: number } | null = null;
  private down: { x: number; y: number; button: number; moved: boolean; painted: Set<number> } | null = null;
  private playing = false;
  private lastUiVersion = -1;
  private pendingPhase = false;
  private dilemmaQueue: { card: DilemmaCard; kind: 'dilemma' | 'beat' }[] = [];
  private act2Buttons: HTMLElement;
  private speciesYear = -1;
  readouts = new Readouts();
  policies = new PolicyPanel();
  tutorial: TutorialOverlay;
  private policyBtn: HTMLButtonElement;
  private resultRecorded = false;
  country: CountryPanel;
  research: ResearchPanel;
  sats: SatellitePanel;
  private layerBtns: Record<'country' | 'research' | 'sats', HTMLButtonElement>;
  private warnEl: HTMLElement;
  private droughtEl: HTMLElement;
  private droughtDismissed = -1;
  private projectNudge = '';
  private overlayFn: ((s: GameState) => ArrayLike<number>) | null = null;
  private overlayRamp: import('../render/overlay').Ramp = 'heat';
  kit: FieldKitPanel;
  guide: FieldGuide;
  private learnMenu: HTMLElement;
  private rightCol: HTMLElement;
  private lastPredPrompt = -1;

  constructor(root: HTMLElement) {
    this.renderer = new GameRenderer(root);
    installDraftBanner();
    // backdrop world for the title screen: the saved game if any, else Coal Coast
    let initial: GameState;
    const sum = GameController.savedSummary();
    initial = createGame(sum?.scenarioId ?? 'coal-coast');
    this.game = new GameController(initial);
    if (sum) this.game.loadSaved();
    initial = this.game.state;
    this.renderer.setWorld(initial);
    this.tip = new Tip();

    this.ui = h('div', { class: 'ui hidden' });
    document.body.appendChild(this.ui);
    this.hud = new Hud({
      graphs: () => this.toggleGraphs(),
      settings: () => showSettings(this.renderer, () => this.resetToTitle()),
      log: () => this.openLog(),
      voices: () => { this.loadVoices(); this.voices.open(); },
      species: () => this.species.open(),
      capacity: () => { sfx('click'); openCapacityPanel(this.game.state); },
      learn: () => this.toggleLearnMenu(),
    });
    this.toolbar = new Toolbar(this.tip);
    this.toolbar.onTool = (t) => this.onTool(t);
    this.graphs = new GraphsPanel();
    this.graphs.onClose = () => this.hud.graphsBtn.classList.remove('on');
    this.clock = new Clock((s) => { sfx('click'); this.game.setSpeed(s); });
    this.energy = new EnergyPanel();
    this.objectives = new ObjectivesPanel();
    this.act1Goals = new Act1GoalsPanel();
    this.objectives.onShowMe = (k) => this.showMe(k);
    this.voices = new Voices();
    this.voices.project = (tx, ty) => {
      const p = this.renderer.tileWorld(tx, ty);
      return this.renderer.project(p.x, p.y + 1.2, p.z);
    };
    this.voices.onNew = () => this.hud.voicesBtn.classList.remove('hidden');
    this.species = new SpeciesPanel();
    this.species.onHabitat = (id) => this.setOverlay(id ? (st) => SIM.habitatMask(st, id) : null, 'habitat');
    this.country = new CountryPanel((t) => this.toolbar.select(t));
    this.research = new ResearchPanel((id) => {
      const r = this.game.dispatch({ type: 'research', id });
      if (r.ok) { sfx('good'); toast('Research complete', SIM.RESEARCH_BY_ID[id]?.name ?? id, 'good', UI_ICONS.sprout, 3500); }
      else { sfx('error'); toast('Not yet', degC(r.reason ?? ''), 'warn', UI_ICONS.info, 4000); }
      this.research.render(this.game.state);
    }, (id) => {
      const r = this.game.dispatch({ type: 'project', id });
      if (r.ok) { sfx('good'); toast('Project funded', SIM.PROJECTS_BY_ID[id]?.name ?? id, 'good', UI_ICONS.sprout, 3500); }
      else { sfx('error'); toast('Not yet', degC(r.reason ?? ''), 'warn', UI_ICONS.info, 4000); }
      this.research.render(this.game.state);
    });
    this.sats = new SatellitePanel((o) => {
      const r = this.game.dispatch({ type: 'subscribe', overlay: o });
      if (r.ok) sfx('good'); else { sfx('error'); toast('Not yet', degC(r.reason ?? ''), 'warn', UI_ICONS.info, 4000); }
      this.sats.render(this.game.state);
    }, (o) => this.setOverlay(o ? (st) => SIM.overlayData(st, o) : null, o === 'forest' ? 'forest' : o === 'sealevel' ? 'flood' : o === 'fire' ? 'fire' : 'heat'));
    this.toolbar.countryOn = (st) => { try { return SIM.countryActive(st); } catch { return false; } };
    const lb = (title: string, icon: string, fn: () => void): HTMLButtonElement => h('button', { class: 'iconbtn hidden', title, 'aria-label': title, onclick: fn }, svg(icon));
    this.layerBtns = {
      country: lb('Caring for Country', UI_ICONS.sprout, () => this.country.open(this.game.state)),
      research: lb('Recycling innovations and community projects', UI_ICONS.rotate, () => this.research.open(this.game.state)),
      sats: lb('Satellites', UI_ICONS.target, () => this.sats.open(this.game.state)),
    };
    this.hud.el.querySelector('.hud-right')?.prepend(this.layerBtns.country, this.layerBtns.research, this.layerBtns.sats);
    this.policies.onChange = (id, value) => {
      const r = this.game.dispatch({ type: 'policy', id, value } as unknown as SIM.Action);
      if (!r.ok) toast('Not possible', degC(r.reason ?? ''), 'warn', UI_ICONS.info, 4000);
    };
    this.policyBtn = h('button', { class: 'iconbtn hidden', title: 'Town policies', 'aria-label': 'Town policies', onclick: () => this.policies.open(this.game.state) }, svg(UI_ICONS.gear));
    this.policyBtn.innerHTML = '';
    this.policyBtn.appendChild(svg('<svg viewBox="0 0 32 32"><path d="M6 9 H26 M6 16 H26 M6 23 H26" stroke="#3a2a22" stroke-width="2.4"/><circle cx="12" cy="9" r="3.4" fill="#f2c230" stroke="#3a2a22" stroke-width="1.4"/><circle cx="21" cy="16" r="3.4" fill="#5fb8c8" stroke="#3a2a22" stroke-width="1.4"/><circle cx="10" cy="23" r="3.4" fill="#c0583a" stroke="#3a2a22" stroke-width="1.4"/></svg>'));
    this.hud.el.querySelector('.hud-right')?.prepend(this.policyBtn);
    this.tutorial = new TutorialOverlay({
      find: (key) => this.tutorialTarget(key),
      tile: (x, y) => this.renderer.markTile(x, y),
      clearTile: () => this.renderer.markTile(null),
      onComplete: () => this.tutorialDone(),
    });
    const frame = h('button', { class: 'iconbtn', title: 'Frame the whole map (F)', 'aria-label': 'Frame the whole map', onclick: () => { sfx('click'); this.renderer.rig?.home(true); } }, svg(UI_ICONS.home));
    this.hud.el.querySelector('.hud-right')?.append(frame);
    this.warnEl = h('div', { class: 'toast panel bad hidden', style: 'position:fixed;top:140px;left:50%;transform:translateX(-50%);z-index:44;width:min(420px, calc(100vw - 24px))' });
    document.body.appendChild(this.warnEl);
    this.droughtEl = h('div', { class: 'toast panel bad hidden', role: 'alert', style: 'position:fixed;top:140px;left:50%;transform:translateX(-50%);z-index:44;width:min(440px, calc(100vw - 24px))' });
    document.body.appendChild(this.droughtEl);
    this.kit = new FieldKitPanel();
    this.kit.onTest = (site) => {
      const r = this.game.dispatch({ type: 'learn', op: 'test', site } as SIM.Action);
      if (r.ok) { sfx('good'); floater(window.innerWidth / 2, 120, `-$${r.spent}k`, 'cost'); } else { sfx('error'); toast('Not now', degC(r.reason ?? ''), 'warn', UI_ICONS.info, 4000); }
      this.kit.render(this.game.state);
    };
    this.kit.onPredict = (choice, text) => {
      const r = this.game.dispatch({ type: 'learn', op: 'predict', choice, text } as SIM.Action);
      if (r.ok) sfx('good'); else { sfx('error'); toast('Not yet', degC(r.reason ?? ''), 'warn', UI_ICONS.info, 4000); }
      this.kit.render(this.game.state);
    };
    this.guide = new FieldGuide();
    onGlossaryNew((id) => { this.game.dispatch({ type: 'learn', op: 'term', id } as SIM.Action); if (this.guide.el.classList.contains('open')) this.guide.render(); });
    this.learnMenu = h('div', { class: 'learn-menu panel hidden', role: 'menu' },
      this.menuItem(LEARN_ICONS.water, 'Water field kit', 'Test the creek and predict', () => this.kit.open(this.game.state)),
      this.menuItem(LEARN_ICONS.scale, 'Land limits', 'Use and renewal', () => openCapacityPanel(this.game.state)),
      this.menuItem(LEARN_ICONS.book, 'Field guide', 'Words from the game', () => this.guide.open()),
      this.menuItem(LEARN_ICONS.house, 'My household', 'Link the town to home', () => this.openHousehold()));
    document.body.appendChild(this.learnMenu);
    this.demand = h('div', { class: 'demand panel' });
    this.nextBtn = h('button', { class: 'btn primary nextbtn', onclick: () => this.nextDecade() }, svg(UI_ICONS.clock), 'Skip to end of decade');
    this.action = h('div', { class: 'action' }, this.demand, this.nextBtn);
    this.undoBtn = h('button', { class: 'btn small undo hidden', onclick: () => this.undo(), title: 'Undo last building (Ctrl+Z)' }, svg(UI_ICONS.undo), 'Undo');
    this.act2Buttons = h('div', { class: 'action act2btns hidden' },
      h('button', { class: 'btn small', onclick: () => this.objectives.el.classList.toggle('open') }, svg(UI_ICONS.target), 'Goals'),
      h('button', { class: 'btn small', onclick: () => this.energy.el.classList.toggle('open') }, svg(UI_ICONS.bolt), 'Power'));
    this.logList = h('div');
    this.logDrawer = h('div', { class: 'drawer panel' }, h('div', { class: 'panel-head' }, h('h3', null, svg(UI_ICONS.log), 'Event log'), h('button', { class: 'btn small', onclick: () => this.logDrawer.classList.remove('open') }, 'Close')), this.logList);
    document.body.appendChild(this.logDrawer);
    this.inspectEl = h('div', { class: 'inspect panel hidden' });
    document.body.appendChild(this.inspectEl);
    // The clock sits in the HUD's centre column and the Act 1 goals sit above the needs panel in one right-hand column, so nothing overlaps (any screen size).
    this.hud.el.querySelector('.hud-center')?.append(this.clock.el);
    this.rightCol = h('div', { class: 'rightcol' }, this.act1Goals.el, this.action);
    this.ui.append(this.hud.el, this.readouts.el, this.tutorial.el, this.toolbar.el, this.graphs.el, this.energy.el, this.objectives.el, this.rightCol, this.undoBtn, this.act2Buttons);
    if (DEBUG) {
      this.debugEl = h('div', { class: 'debug' });
      document.body.appendChild(this.debugEl);
    }

    this.wireGame();
    this.wireInput();
    this.renderer.onFrame = (dt) => this.frame(dt);
    this.renderer.start();
    this.showTitleScreen();
    this.exposeDebug();
  }

  // ---------------------------------------------------------------- flow
  private showTitleScreen(): void {
    this.playing = false;
    this.ui.classList.add('hidden');
    this.renderer.hideCursor();
    const rig = this.renderer.rig;
    if (rig) rig.idleSpin = 0.05;
    this.title?.remove();
    this.title = showTitle({
      continueGame: () => this.startPlaying(false),
      newGame: (id) => this.newGame(id),
      settings: () => showSettings(this.renderer, GameController.hasSave() ? () => this.resetToTitle() : null),
      skipTutorial: () => {
        const p = SIM.skipTutorial(loadProgressSafe());
        try { SIM.saveProgress(localStorage, p); } catch { /* ignore */ }
        return p;
      },
    }, GameController.savedSummary(), TEACHER, loadProgressSafe());
    document.body.appendChild(this.title);
  }

  private newGame(id: ScenarioId): void {
    const seedP = params.get('seed');
    const seed = seedP && /^\d+$/.test(seedP) ? Number(seedP) : undefined;
    this.game.newGame(id, seed);
    this.startPlaying(true);
  }

  private startPlaying(fresh: boolean): void {
    unlockAudio();
    this.title?.remove();
    this.title = null;
    this.playing = true;
    this.ui.classList.remove('hidden');
    const rig = this.renderer.rig;
    if (rig) {
      rig.idleSpin = 0;
      rig.home(true);
    }
    const s = this.game.state;
    this.syncUi(s, true);
    this.resultRecorded = false;
    if (fresh) {
      const act2Start = s.phase === 'act2';
      if (act2Start) this.game.setSpeed(0);
      showIntro(s, () => {
        if (act2Start && s.turningPoint) showTurningPoint(this.game.state, () => { this.game.setSpeed(1); sfx('good'); }, true);
        else if (act2Start) this.game.setSpeed(1);
      });
    } else this.checkPhase(s);
  }

  private resetToTitle(): void {
    this.game.resetSave();
    const s = createGame('coal-coast');
    this.game.state = s;
    this.renderer.setWorld(s);
    this.showTitleScreen();
  }

  /** "Skip to end of decade": fast-forwards the years that are left, then shows the report. */
  private nextDecade(): void {
    if (this.game.state.phase !== 'act1' || modalOpen()) return;
    const s = this.game.state;
    // Once a decade, before time jumps, offer a one-line prediction about the creek (it is checked at the end of the decade).
    if (this.lastPredPrompt !== s.year) {
      this.lastPredPrompt = s.year;
      if (promptPrediction(s, (choice, text) => { this.game.dispatch({ type: 'learn', op: 'predict', choice, text } as SIM.Action); }, () => this.skipDecade())) return;
    }
    this.skipDecade();
  }

  private skipDecade(): void {
    const r = this.game.nextDecade();
    if (!r) return;
    this.showReport(r);
  }

  // ---------------------------------------------------------------- learning layer
  private menuItem(icon: string, title: string, sub: string, go: () => void): HTMLElement {
    return h('button', { class: 'learn-item', role: 'menuitem', onclick: () => { this.learnMenu.classList.add('hidden'); this.hud.learnBtn.classList.remove('on'); sfx('click'); go(); } },
      svg(icon), h('span', null, h('b', null, title), h('small', null, sub)));
  }

  private toggleLearnMenu(): void {
    const open = this.learnMenu.classList.contains('hidden');
    this.learnMenu.classList.toggle('hidden', !open);
    this.hud.learnBtn.classList.toggle('on', open);
    if (open) {
      const r = this.hud.learnBtn.getBoundingClientRect();
      this.learnMenu.style.top = `${Math.round(r.bottom + 8)}px`;
      this.learnMenu.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`;
    }
    sfx('click');
  }

  private saveReflection(key: string, text: string): void {
    this.game.dispatch(key === 'letter' ? { type: 'learn', op: 'letter', text } as SIM.Action : { type: 'learn', op: 'reflect', key, text } as SIM.Action);
  }

  private openHousehold(): void {
    showHousehold(this.game.state, {
      tick: (id, on) => { this.game.dispatch({ type: 'learn', op: 'household', id, on } as SIM.Action); },
      openPrint: () => openPrintReport(this.game.state, reportCard(this.game.state)),
    });
  }

  private showReport(r: SIM.DecadeReport): void {
    sfx('decade');
    this.pendingPhase = true;
    const s = this.game.state;
    const last = learnOf(s).predictions[learnOf(s).predictions.length - 1];
    const pred = last && last.resolvedYear !== undefined && last.resolvedYear === s.year ? latestPredictionView(s) : null;
    showDecadeReport(r, () => {
      this.pendingPhase = false;
      this.checkPhase(this.game.state);
    }, { node: pred, onWhy: (key, what) => openCauseChain(this.game.state, key, what) });
  }

  private checkPhase(s: GameState): void {
    if (!this.playing) return;
    if (s.phase === 'turning-point') {
      showTurningPoint(s, () => {
        this.game.beginAct2();
        sfx('good');
        if (this.game.state.flags['a2.stopgap']) toast('Act 2 begins, paused', 'The town has no power. Build gas stations first (Energy), then press play.', 'warn', UI_ICONS.warn, 9000);
        else toast('Act 2 begins', 'Time now flows. Use the speed buttons or Space to pause and plan.', 'good', UI_ICONS.sprout);
      }, false, (k, t) => this.saveReflection(k, t));
    } else if (s.phase === 'epilogue' || s.phase === 'failed') {
      this.game.setSpeed(0);
      const rig = this.renderer.rig;
      if (rig) rig.idleSpin = 0.06;
      const rc = reportCard(s);
      let note = '';
      let next: { label: string; go: () => void } | null = null;
      if (!this.resultRecorded) {
        this.resultRecorded = true;
        try {
          const stars = (s.phase === 'failed' ? 0 : rc?.stars ?? (s.a2.outcome?.success ? 1 : 0)) as SIM.Stars;
          const { progress, newlyUnlocked } = SIM.recordResult(loadProgressSafe(), s.scenarioId, stars);
          SIM.saveProgress(localStorage, progress);
          if (newlyUnlocked.length) note = newlyUnlocked.map((id) => SIM.getScenario(id).name).join(' and ');
        } catch { /* storage unavailable */ }
      }
      const prog = loadProgressSafe();
      const order = SIM.SCENARIO_IDS;
      const nextId = SIM.unlockedScenarios(prog, TEACHER).find((id) => id !== s.scenarioId && !SIM.starsOf(prog, id)) ?? null;
      if (nextId && s.phase !== 'failed') next = { label: `Next: ${SIM.getScenario(nextId).name}`, go: () => { closeAllModals(); this.newGame(nextId); } };
      else if (s.phase === 'failed') next = { label: 'Try again', go: () => { closeAllModals(); this.newGame(s.scenarioId); } };
      void order;
      showEnding(s, () => { closeAllModals(); this.resetToTitle(); }, rc, next, note, {
        save: (k, t) => this.saveReflection(k, t),
        household: () => this.openHousehold(),
        print: () => openPrintReport(this.game.state, reportCard(this.game.state)),
      });
    }
  }

  private undo(): void {
    if (this.game.undo()) {
      sfx('demolish');
      toast('Undone', 'The last building was removed and refunded in full.', 'info', UI_ICONS.undo, 2500);
    }
  }

  // ---------------------------------------------------------------- game events
  private wireGame(): void {
    const g = this.game;
    g.on('reset', (s) => {
      setGlossarySeen(learnOf(s).terms);
      this.renderer.setWorld(s);
      this.renderer.setState(s, true);
      this.lastUiVersion = -1;
      clear(this.logList);
      this.voices.feed = [];
      this.syncUi(s, true);
    });
    g.on('state', (s) => this.renderer.setState(s));
    g.on('phase', (p, s) => {
      this.syncUi(s, true);
      if (p === 'act2') this.toolbar.select(null);
      if (!this.pendingPhase && (p === 'epilogue' || p === 'failed')) this.checkPhase(s);
    });
    g.on('speed', (sp) => this.clock.setSpeed(sp));
    g.on('decadeEnd', (r) => this.showReport(r));
    g.on('simEvents', (evs) => this.onSimEvents(evs));
    g.on('year', (y, s) => {
      if (s.phase === 'act2' && y % 10 === 0) toast(`The ${y}s`, `CO₂ ${s.co2.toFixed(0)} ppm · warming +${fmt1(s.tempC)} °C`, 'info', UI_ICONS.calendar, 4000);
    });
  }

  private onSimEvents(evs: SimEvent[]): void {
    const s = this.game.state;
    for (const e of evs) {
      this.log(e);
      if (e.type === 'story') {
        const card = dilemmaCard(s, e);
        if (card) { this.dilemmaQueue.push({ card, kind: 'dilemma' }); continue; }
        if (s.phase === 'turning-point') continue; // told on the turning-point card
        const line = storyLine(s, e);
        if (line) {
          this.voices.say(line);
          if (!line.at) toast(line.speaker.name, line.text, 'info', UI_ICONS.speech, 8000, chainOpener(() => this.game.state, e) ?? undefined);
        }
        const beat = beatChoice(s, e);
        if (beat) this.dilemmaQueue.push({ card: beat, kind: 'beat' });
        continue;
      }
      const bad = e.type === 'bushfire' || e.type === 'flood' || e.type === 'fish-kill' || e.type === 'blackout' || e.type === 'marine-heatwave';
      sfx('event');
      const name = (EVENT_NAMES as Record<string, string>)[e.type] ?? e.type;
      toast(name, degC(e.text), bad ? 'bad' : 'warn', hazIcon(e.type), 9000, chainOpener(() => this.game.state, e) ?? undefined);
      this.renderer.eventFx(e);
    }
    this.pumpDilemmas();
  }

  private pumpDilemmas(): void {
    if (modalOpen() || !this.dilemmaQueue.length || this.pendingPhase || !this.playing) return;
    const { card, kind } = this.dilemmaQueue.shift()!;
    const wasSpeed = this.game.speed;
    if (this.game.state.phase === 'act2') this.game.setSpeed(0);
    showDilemma(card, (opt) => {
      if (kind === 'dilemma') this.game.resolveDilemma(String(card.id), opt);
      else this.game.dispatch({ type: 'respond', beatId: String(card.id), optionId: opt } as unknown as SIM.Action);
      sfx('good');
      if (this.game.state.phase === 'act2') this.game.setSpeed(wasSpeed || 1);
      setTimeout(() => this.pumpDilemmas(), 400);
    });
  }

  private log(e: SimEvent): void {
    if (e.type === 'story' && hideDraft() && (e as unknown as { story?: { needsConsultation?: boolean } }).story?.needsConsultation) return;
    const open = chainOpener(() => this.game.state, e);
    const item = h('div', { class: `log-item${open ? ' why' : ''}`, ...(open ? { role: 'button', tabindex: 0, title: 'Why did that happen? Click to see' } : {}) }, svg(hazIcon(e.type)), h('div', null, h('small', null, `${e.year} · ${['summer', 'autumn', 'winter', 'spring'][e.season] ?? ''}`), degC(e.text), open ? h('em', { class: 'why-hint' }, 'Why did that happen?') : null));
    if (open) item.addEventListener('click', open);
    this.logList.prepend(item);
    while (this.logList.children.length > 150) this.logList.lastElementChild?.remove();
  }

  private openLog(): void {
    if (!this.logList.children.length) {
      for (const e of this.game.state.eventLog.slice(-60)) this.log(e);
      if (!this.logList.children.length) this.logList.appendChild(h('p', { class: 'muted' }, 'Nothing has happened yet. Events like heatwaves, floods and bushfires will be listed here.'));
    }
    this.logDrawer.classList.add('open');
  }

  private loadVoices(): void {
    if (this.voices.feed.length) return;
    try {
      const s = this.game.state;
      for (const e of SIM.townVoices(s, 40)) {
        const l = storyLine(s, e);
        if (l) this.voices.feed.push({ ...l, at: undefined });
      }
    } catch { /* ignore */ }
  }

  private toggleGraphs(): void {
    this.graphs.toggle();
    this.graphs.update(this.game.state);
    this.hud.graphsBtn.classList.toggle('on', this.graphs.open);
    sfx('click');
  }

  // ---------------------------------------------------------------- per-frame
  private frame(dt: number): void {
    const s0 = this.game.state;
    this.game.update(dt, modalOpen() || !this.playing);
    const s = this.game.state;
    if (s.version !== this.lastUiVersion || s !== s0) this.syncUi(s, false);
    if (s.phase === 'act2') this.clock.update(s, (s.a2.clockMicro ?? 0) / 1_000_000);
    else if (s.phase === 'act1') this.clock.updateAct1(s, this.game.act1YearFrac);
    this.voices.update();
    if (!modalOpen() && this.dilemmaQueue.length) this.pumpDilemmas();
    ambientTick(dt, Math.max(0, Math.min(1, s.meters.environment / 100)));
    if (this.debugEl) {
      const st = this.renderer.stats;
      this.debugEl.textContent = `${st.fps.toFixed(0)} fps  ${st.frameMs.toFixed(1)} ms (cpu ${st.cpuMs.toFixed(1)})\ncalls ${st.calls}  tris ${(st.triangles / 1000).toFixed(0)}k\ntier ${st.tier}${st.auto ? ' (auto)' : ''}  prog ${st.programs}  tex ${st.textures}\nyear ${yearFraction(s).toFixed(2)}`;
    }
  }

  private noRoadEl: HTMLElement | null = null;
  private noRoadText: HTMLElement | null = null;
  private noRoadList: number[] = [];
  private noRoadIdx = -1;

  /** The "N buildings have no road" line in the demand-bar block, with a button that pans the camera to the next one. */
  private updateNoRoad(s: GameState): void {
    let list: number[] = [];
    if (s.phase === 'act1' || s.phase === 'act2') {
      try { const a = SIM.roadAccess(s); list = a.enforced ? [...a.unconnected] : []; } catch { list = []; }
    }
    this.noRoadList = list;
    if (!this.noRoadEl) {
      this.noRoadText = h('span', { style: 'flex:1' });
      this.noRoadEl = h('div', { style: 'display:flex;align-items:center;gap:8px;width:100%' },
        svg(bIcon('road')), this.noRoadText,
        h('button', { class: 'btn small', type: 'button', title: 'Pan the camera to a building with no road', onclick: () => this.locateNoRoad() }, svg(UI_ICONS.target), 'Locate'));
    }
    if (this.noRoadText) this.noRoadText.textContent = `${list.length} building${list.length === 1 ? ' has' : 's have'} no road`;
    this.hud.demand.setSlot(list.length ? this.noRoadEl : null);
  }

  private locateNoRoad(): void {
    const s = this.game.state;
    const list = this.noRoadList;
    if (!list.length) return;
    this.noRoadIdx = (this.noRoadIdx + 1) % list.length;
    const b = s.buildings.find((x) => x.uid === list[this.noRoadIdx]);
    if (!b) return;
    const p = this.renderer.tileWorld(b.x, b.y, b.w, b.h);
    this.renderer.rig?.focus(p.x, p.z, 22);
    this.renderer.sparkle(b.x, b.y, b.w, b.h, false);
  }

  /** One line for the placement tip: does this spot touch a road that is joined to the entrance? */
  private roadNote(s: GameState, bt: BuildingId, a: { x: number; y: number; w: number; h: number }): string {
    let acc: ReturnType<typeof SIM.roadAccess>;
    try { acc = SIM.roadAccess(s); } catch { return ''; }
    if (!acc.enforced) return '';
    const def = BUILDINGS[bt];
    const g = s.grid;
    let road = false, rail = false;
    const look = (x: number, y: number): void => {
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
      const r = acc.reached[y * g.w + x] ?? 0;
      if (r === 1) road = true;
      else if (r === 2) rail = true;
    };
    for (let k = 0; k < a.w; k++) { look(a.x + k, a.y - 1); look(a.x + k, a.y + a.h); }
    for (let k = 0; k < a.h; k++) { look(a.x - 1, a.y + k); look(a.x + a.w, a.y + k); }
    if (def.network === 'road') {
      const entrance = acc.entrances.includes(a.y * g.w + a.x);
      return road || entrance ? '<br>Joins the road from the edge of the map.' : '<br><b>Not joined to the road from the edge yet.</b> Start from the road or build beside it.';
    }
    if (def.needsRoad === false || def.network) return '';
    return road || (rail && def.railServed === true)
      ? '<br>A connected road touches this spot.'
      : '<br><b>No connected road touches this spot.</b> It will not work until a road reaches it.';
  }

  private syncUi(s: GameState, force: boolean): void {
    if (!force && s.version === this.lastUiVersion) return;
    this.lastUiVersion = s.version;
    this.hud.update(s);
    this.kit.refresh(s);
    this.updateNoRoad(s);
    this.toolbar.update(s);
    this.graphs.update(s);
    const act1 = s.phase === 'act1';
    const act2 = s.phase === 'act2';
    this.action.classList.toggle('hidden', !act1);
    this.nextBtn.disabled = !act1;
    if (act1) {
      const dem = this.demandText(s);
      this.demand.replaceChildren(h('b', null, `The ${Math.floor(s.year / 10) * 10}s · the town needs`), dem);
      this.demand.classList.toggle('hidden', !dem);
    }
    this.undoBtn.classList.toggle('hidden', !this.game.canUndo() || (s.phase !== 'act1' && s.phase !== 'act2'));
    this.clock.el.classList.toggle('hidden', !act2 && !act1);
    this.clock.el.classList.toggle('act1', act1);
    this.energy.el.classList.toggle('hidden', !act2);
    this.objectives.el.classList.toggle('hidden', !act2);
    this.act1Goals.update(s);
    this.act2Buttons.classList.toggle('hidden', !act2 || window.innerWidth > 700);
    const a2 = s.phase === 'act2' || s.phase === 'epilogue';
    try {
      this.layerBtns.country.classList.toggle('hidden', !a2 || !SIM.countryActive(s));
      this.layerBtns.research.classList.toggle('hidden', !a2);
      this.layerBtns.sats.classList.toggle('hidden', !a2);
      const w = s.satellites?.warning;
      const show = s.phase === 'act2' && !!w && !w.mitigated && s.satellites.overlays.sst;
      this.warnEl.classList.toggle('hidden', !show);
      if (show && !this.warnEl.childElementCount) {
        this.warnEl.append(svg(UI_ICONS.coral), h('div', null, h('b', null, 'Satellite warning: marine heatwave coming'),
          h('p', null, 'Sea-surface temperatures are building offshore. Cutting runoff now gives the reef a better chance.'),
          h('button', { class: 'btn small teal', onclick: () => { const r = this.game.dispatch({ type: 'mitigate' }); if (r.ok) { sfx('good'); this.warnEl.replaceChildren(); } else toast('Not possible', degC(r.reason ?? ''), 'warn'); } }, `Cut runoff now ($${SIM.MITIGATION.cost}k)`)));
      } else if (!show) this.warnEl.replaceChildren();
      this.syncDroughtWarning(s, show);
      // Money piling up late in the game: point at the community projects once per scenario run.
      if (s.phase === 'act2' && s.budget >= 400 && SIM.projectsOpen(s) && SIM.projectsFunded(s) === 0 && this.projectNudge !== s.scenarioId) {
        this.projectNudge = s.scenarioId;
        toast('Savings in the bank', 'Community projects can put them to work: adopt a habitat, climate aid for a neighbouring town, cool refuges, junior rangers. Open Innovations and projects (the circular-arrows button).', 'good', UI_ICONS.sprout, 7000);
      }
    } catch { /* layer state missing in old saves */ }
    if (this.overlayFn) this.renderer.setOverlay(this.overlayFn(s), this.overlayRamp);
    this.readouts.update(s);
    this.policyBtn.classList.toggle('hidden', !this.policies.has(s) || s.phase === 'turning-point');
    if (this.policies.el.classList.contains('open')) this.policies.render(s);
    this.tutorial.update(s, this.playing);
    if (s.year !== this.speciesYear) {
      this.speciesYear = s.year;
      const sp = speciesList(s);
      this.species.set(sp);
      this.hud.speciesBtn.classList.toggle('hidden', !sp.length || s.phase === 'act1');
      if (s.phase !== 'act1') this.hud.voicesBtn.classList.remove('hidden');
    }
    if (act1) this.clock.setSpeed(this.game.speed);
    if (act2) {
      this.clock.setSpeed(this.game.speed);
      this.energy.update(s);
      this.objectives.update(s);
    }
    this.refreshHover();
  }

  /** River Town: when a drought is declared and the drought plan is off, say so and offer the plan in one click. */
  private syncDroughtWarning(s: GameState, satBusy: boolean): void {
    const idx = SIM.seasonIndexOf(s);
    const d = s.phase === 'act2' ? s.a2.active.find((e) => e.type === 'drought' && e.endsAt > idx) : undefined;
    const has = SIM.policiesFor(s.scenarioId).some((p) => p.id === 'drought.plan');
    const show = !satBusy && has && !!d && SIM.policyValue(s, 'drought.plan') < 1 && this.droughtDismissed !== d.endsAt;
    this.droughtEl.classList.toggle('hidden', !show);
    if (!show) { this.droughtEl.replaceChildren(); return; }
    if (this.droughtEl.childElementCount) return;
    const cost = SIM.policyDef(s.scenarioId, 'drought.plan')?.costPerYear;
    const yearly = Array.isArray(cost) ? cost[1] ?? 0 : 0;
    this.droughtEl.append(svg(UI_ICONS.warn), h('div', null, h('b', null, 'Drought declared'),
      h('p', null, 'River flows are dropping fast. A drought plan brings in town water restrictions, has farmers irrigate only their best paddocks, and keeps the river its own share. Switched on early, it also banks wet-season water for the farms.'),
      h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
        h('button', { class: 'btn small teal', onclick: () => { const r = this.game.dispatch({ type: 'policy', id: 'drought.plan', value: 1 }); if (r.ok) { sfx('good'); toast('Drought plan on', `Restrictions start now. It costs $${yearly}k a year; switch it off any time in Town policies.`, 'good'); } else toast('Not possible', r.reason ?? '', 'warn'); } }, `Start the drought plan ($${yearly}k a year)`),
        h('button', { class: 'btn small', onclick: () => { this.droughtDismissed = d?.endsAt ?? -1; this.droughtEl.replaceChildren(); this.droughtEl.classList.add('hidden'); } }, 'Not now'))));
  }

  private setOverlay(fn: ((s: GameState) => ArrayLike<number>) | null, ramp: import('../render/overlay').Ramp): void {
    if (ramp !== 'attention') this.attn = null;
    this.overlayFn = fn;
    this.overlayRamp = ramp;
    this.renderer.setOverlay(fn ? fn(this.game.state) : null, ramp);
  }

  /** Amber pulsing highlight on the tiles a goal still needs (rehab: while the tool is active; legacy / rehab: after Show me). */
  private attn: { kind: 'rehab' | 'legacy'; mode: 'tool' | 'timed' } | null = null;
  private attnTimer = 0;
  private attnFocus = -1;
  private showMeIdx: Record<string, number> = {};

  private attentionMask(kind: 'rehab' | 'legacy', all: boolean): (s: GameState) => ArrayLike<number> {
    return (s) => {
      const g = s.grid;
      const out = new Float32Array(g.w * g.h);
      if (kind === 'legacy') {
        for (const it of s.circular?.items ?? []) {
          if (it.status !== 'standing' && it.status !== 'rubble') continue;
          // The footprint and a one-tile ring round it (the building itself hides the ground under it); the one the camera is on is brightest.
          const v = it.uid === this.attnFocus ? 1 : 0.3;
          for (let y = it.y - 1; y <= it.y + it.h; y++) for (let x = it.x - 1; x <= it.x + it.w; x++) if (x >= 0 && y >= 0 && x < g.w && y < g.h) out[y * g.w + x] = Math.max(out[y * g.w + x] ?? 0, v);
        }
        return out;
      }
      const w = SIM.rehabWatch(s);
      for (const i of w.stuck) out[i] = 1;
      if (all || w.stuck.length === 0) for (const i of w.pit) out[i] = all ? 0.45 : 0.8;
      return out;
    };
  }

  private setAttention(kind: 'rehab' | 'legacy' | null, mode: 'tool' | 'timed' = 'timed', all = mode === 'tool'): void {
    window.clearTimeout(this.attnTimer);
    if (!kind) {
      if (this.attn) this.setOverlay(null, 'heat');
      this.attn = null;
      return;
    }
    this.attn = { kind, mode };
    this.setOverlay(this.attentionMask(kind, all), 'attention');
    if (mode === 'timed') {
      this.attnTimer = window.setTimeout(() => { if (this.attn?.mode === 'timed') this.setAttention(null); }, 12000);
    }
  }

  /** Goal row "Show me": highlight what is left and fly the camera to the next place, cycling on each press. */
  private showMe(kind: ShowMeKind): void {
    const s = this.game.state;
    let spots: { x: number; y: number; label: string; uid?: number }[] = [];
    try {
      if (kind === 'legacy') {
        spots = (s.circular?.items ?? []).filter((it) => it.status === 'standing' || it.status === 'rubble')
          .sort((a, b) => (a.status === b.status ? 0 : a.status === 'rubble' ? -1 : 1))
          .map((it) => ({ uid: it.uid, x: it.x + Math.floor(it.w / 2), y: it.y + Math.floor(it.h / 2), label: `${BUILDINGS[it.type].name} (${it.status === 'rubble' ? 'closed, rubble' : 'still standing'}): use the Old sites tool` }));
      } else {
        const w = SIM.rehabWatch(s);
        spots = w.patches.length
          ? w.patches.map((p) => ({ x: p.x, y: p.y, label: `A seeded patch of ${p.n} tiles with no seed source: build a native plant nursery within ${w.reach} tiles` }))
          : w.pit.slice(0, 1).map((i) => ({ x: i % s.grid.w, y: Math.floor(i / s.grid.w), label: 'Open mine ground: use Rehab mine' }));
      }
    } catch { spots = []; }
    if (!spots.length) { toast('Nothing left here', 'Every one of these is already dealt with.', 'good', UI_ICONS.check, 3500); return; }
    const n = (this.showMeIdx[kind] ?? -1) + 1;
    const idx = n % spots.length;
    this.showMeIdx[kind] = idx;
    const sp = spots[idx] as { x: number; y: number; label: string; uid?: number };
    this.attnFocus = sp.uid ?? -1;
    this.setAttention(kind, 'timed', false);
    const p = this.renderer.tileWorld(sp.x, sp.y);
    this.renderer.rig?.focus(p.x, p.z, 26);
    toast(`${kind === 'legacy' ? 'Old site' : 'Rehab'} ${idx + 1} of ${spots.length}`, sp.label, 'info', UI_ICONS.target, 6000);
  }

  private demandText(s: GameState): string {
    try {
      return currentDemand(s).text;
    } catch {
      return '';
    }
  }

  // ---------------------------------------------------------------- input
  private onTool(t: Tool): void {
    // Rehab tool: light up the mine-site tiles that still need work, and the seeded patches no nursery reaches.
    if (t === 'rehab') this.setAttention('rehab', 'tool');
    else if (this.attn?.mode === 'tool') this.setAttention(null);
    const rig = this.renderer.rig;
    rig?.setLeftPans(t === null || t === 'inspect');
    this.renderer.setGrid(t !== null && t !== 'inspect');
    this.inspectEl.classList.add('hidden');
    this.refreshHover();
  }

  private wireInput(): void {
    const cv = this.renderer.renderer.domElement;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointermove', (e) => {
      if (!this.playing) return;
      if (this.down) {
        if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) this.down.moved = true;
      }
      const p = this.renderer.pick(e.clientX, e.clientY);
      this.hover = p ? { tx: p.tx, ty: p.ty } : null;
      // drag-paint roads / rail
      const t = this.toolbar.tool;
      if (this.down && this.down.button === 0 && e.pointerType === 'mouse' && (t === 'road' || t === 'rail' || t === 'demolish' || t === 'clear') && p) {
        const k = p.ty * 1000 + p.tx;
        if (!this.down.painted.has(k)) {
          this.down.painted.add(k);
          this.act(p.tx, p.ty, e.clientX, e.clientY, true);
        }
      }
      this.refreshHover(e.clientX, e.clientY);
    });
    cv.addEventListener('pointerleave', () => {
      this.hover = null;
      this.renderer.hideCursor();
      this.tip.hide();
    });
    cv.addEventListener('pointerdown', (e) => {
      if (!this.playing) return;
      unlockAudio();
      this.down = { x: e.clientX, y: e.clientY, button: e.button, moved: false, painted: new Set() };
      const t = this.toolbar.tool;
      if (e.button === 0 && e.pointerType === 'mouse' && (t === 'road' || t === 'rail' || t === 'demolish' || t === 'clear')) {
        const p = this.renderer.pick(e.clientX, e.clientY);
        if (p) {
          this.down.painted.add(p.ty * 1000 + p.tx);
          this.act(p.tx, p.ty, e.clientX, e.clientY, false);
        }
      }
    });
    window.addEventListener('pointerup', (e) => {
      const d = this.down;
      this.down = null;
      if (!d || !this.playing || e.target !== cv) return;
      if (d.moved) return;
      if (d.button === 2) {
        if (this.toolbar.tool) this.toolbar.select(null);
        return;
      }
      if (d.button !== 0) return;
      if (d.painted.size) return; // already handled on pointerdown
      const p = this.renderer.pick(e.clientX, e.clientY);
      if (!p) return;
      this.act(p.tx, p.ty, e.clientX, e.clientY, false);
    });
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      const rig = this.renderer.rig;
      if (e.key === 'Escape') {
        if (closeTopModal()) return;
        this.logDrawer.classList.remove('open');
        this.voices.drawer.classList.remove('open');
        this.species.drawer.classList.remove('open');
        // Country, research, satellites and policies are drawers too: Escape closes whichever is open.
        document.querySelectorAll('.drawer.open').forEach((d) => d.classList.remove('open'));
        this.inspectEl.classList.add('hidden');
        this.toolbar.select(null);
        return;
      }
      if (!this.playing || modalOpen()) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); this.undo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) rig?.setKey(e.code, true);
      else if (k === 'q') rig?.turn(1);
      else if (k === 'e') rig?.turn(-1);
      else if (k === 'r') { this.rot = ((this.rot + 1) % 4) as Rotation; sfx('tick'); this.refreshHover(); }
      else if (k === 'x') this.toolbar.select(this.toolbar.tool === 'demolish' ? null : 'demolish');
      else if (k === 'i') this.toolbar.select(this.toolbar.tool === 'inspect' ? null : 'inspect');
      else if (k === 'g') this.toggleGraphs();
      else if (k === 'h' || k === 'f') rig?.home(true);
      else if (k === ' ' && (this.game.state.phase === 'act2' || this.game.state.phase === 'act1') && !modalOpen()) { e.preventDefault(); this.game.togglePause(); }
      else if (k === 'enter' && this.game.state.phase === 'act1') this.nextDecade();
      else if (/^[1-9]$/.test(k)) this.toolbar.selectIndex(Number(k) - 1);
    });
    window.addEventListener('keyup', (e) => this.renderer.rig?.setKey(e.code, false));
    window.addEventListener('blur', () => { for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) this.renderer.rig?.setKey(c, false); });
    window.addEventListener('resize', () => this.syncUi(this.game.state, true));
  }

  /** Anchor so the footprint is centred on the hovered tile. */
  private anchor(tool: BuildingId, tx: number, ty: number): { x: number; y: number; w: number; h: number } {
    const fp = footprintFor(BUILDINGS[tool], this.rot);
    return { x: tx - Math.floor((fp.w - 1) / 2), y: ty - Math.floor((fp.h - 1) / 2), w: fp.w, h: fp.h };
  }

  private lastPointer = { x: 0, y: 0 };

  private refreshHover(cx?: number, cy?: number): void {
    if (cx !== undefined && cy !== undefined) this.lastPointer = { x: cx, y: cy };
    const hv = this.hover;
    const s = this.game.state;
    if (!hv || !this.playing || modalOpen()) {
      this.renderer.hideCursor();
      this.tip.hide();
      return;
    }
    const t = this.toolbar.tool;
    const px = this.lastPointer.x;
    const py = this.lastPointer.y;
    if (t === null || t === 'inspect') {
      const b = buildingAt(s, hv.tx, hv.ty);
      this.renderer.showCursor(t, hv.tx, hv.ty, 0, true, b ? { x: b.x, y: b.y, w: b.w, h: b.h } : undefined);
      this.tip.hide();
      return;
    }
    if (t === 'demolish') {
      const b = buildingAt(s, hv.tx, hv.ty);
      this.renderer.showCursor('demolish', hv.tx, hv.ty, 0, !!b, b ? { x: b.x, y: b.y, w: b.w, h: b.h } : undefined);
      let legacy = false;
      try { legacy = !!b && s.phase === 'act2' && SIM.itemAt(s, hv.tx, hv.ty)?.status === 'standing'; } catch { legacy = false; }
      const nm = availability(s.scenarioId, b?.type ?? 'road').name ?? (b ? BUILDINGS[b.type].name : '');
      if (b && legacy) this.tip.show(px, py, `<b>Demolish ${nm}</b><br>${s.circular?.unlocked ? 'This old site would go to landfill (the worst choice). Use the <b>Old sites</b> tool to repurpose or recycle it.' : 'It closes now and is left as rubble; once the circular economy opens you can still recycle what is left.'}`, s.circular?.unlocked ? 'bad' : '');
      else if (b) this.tip.show(px, py, `<b>Demolish ${nm}</b><br>Refund $${Math.floor(availability(s.scenarioId, b.type).cost * DEMOLISH_REFUND)}k`, '');
      if (b) { const pw = powerLossWarning(s, b.type, b.uid); if (pw) this.tip.show(px, py, `${this.tip.el.innerHTML}<br><b>${pw}</b>`, pw.startsWith('✓') ? '' : 'bad'); }
      else this.tip.hide();
      return;
    }
    if (t === 'dispose') {
      const it = SIM.itemAt(s, hv.tx, hv.ty);
      const live = it && it.status === 'standing' ? it : undefined;
      this.renderer.showCursor('demolish', hv.tx, hv.ty, 0, !!live, live ? { x: live.x, y: live.y, w: live.w, h: live.h } : undefined);
      const pw = live ? powerLossWarning(s, live.type, live.uid) : '';
      this.tip.show(px, py, live ? `<b>${BUILDINGS[live.type].name}</b><br>Click to choose its future${pw ? `<br><b>${pw}</b>` : ''}` : 'Point at an old Act 1 building', live && (!pw || pw.startsWith('✓')) ? 'ok' : 'bad');
      return;
    }
    if (t === 'rehab') {
      let plan: ReturnType<typeof SIM.rehabPlan> = null;
      try { plan = SIM.rehabPlan(s, hv.tx, hv.ty); } catch { plan = null; }
      this.renderer.showCursor('inspect', hv.tx, hv.ty, 0, !!plan && !plan.reason, { x: hv.tx, y: hv.ty, w: 1, h: 1 });
      if (!plan) this.tip.show(px, py, 'Point at the open mine pit (orange-red ground)', 'bad');
      else {
        const near = plan.stage === 2 && plan.nurseryTiles !== undefined
          ? (plan.nurseryTiles >= plan.tiles ? '<br>A nursery reaches all of this patch: good.' : `<br><b>${plan.tiles - plan.nurseryTiles} of ${plan.tiles} tiles are more than ${plan.reach} tiles from a native plant nursery.</b> Seed will not grow there: build a nursery beside them first.`)
          : '';
        this.tip.show(px, py, `<b>${plan.name}</b> · ${plan.tiles} tiles · $${plan.cost}k${plan.reason ? `<br>${degC(plan.reason)}` : '<br>Click to start this step'}${plan.reason ? '' : near}`, plan.reason || near.includes('<b>') ? 'bad' : 'ok');
      }
      return;
    }
    if (t === 'comanage' || t === 'burn') {
      const k = s.grid.kind[hv.ty * s.grid.w + hv.tx];
      const ok = (k === TileKind.Bush || k === TileKind.Land) && !buildingAt(s, hv.tx, hv.ty);
      this.renderer.showCursor('inspect', hv.tx, hv.ty, 0, ok, { x: hv.tx, y: hv.ty, w: 1, h: 1 });
      this.tip.show(px, py, t === 'comanage' ? (hideDraft() ? `<b>Co-manage this bush</b> · $15k<br>${NEUTRAL_COMMUNITY}` : '<b>Co-manage this bush</b> · $15k<br>Shared care with the Traditional Owners') : (hideDraft() ? `<b>Planned burn</b> · $12k<br>${NEUTRAL_COMMUNITY}` : '<b>Cool burn</b> · $12k<br>Co-managed bush, autumn or winter'), ok ? 'ok' : 'bad');
      return;
    }
    if (t === 'clear') {
      const ok = s.grid.kind[hv.ty * s.grid.w + hv.tx] === TileKind.Bush;
      this.renderer.showCursor('clear', hv.tx, hv.ty, 0, ok);
      this.tip.show(px, py, ok ? `<b>Clear bush</b> · $${CLEAR_COST}k<br>Releases stored carbon as CO₂.` : 'Only bushland can be cleared', ok ? '' : 'bad');
      return;
    }
    const bt = t as BuildingId;
    const a = this.anchor(bt, hv.tx, hv.ty);
    const chk = canPlace(s, bt, a.x, a.y, this.rot);
    this.renderer.showCursor(bt, a.x, a.y, this.rot, chk.ok);
    const def = BUILDINGS[bt];
    let sites: number[] = [];
    try { sites = SIM.countryActive(s) ? SIM.footprintSites(s, a.x, a.y, a.w, a.h).filter((id) => !s.country.consulted.includes(id)) : []; } catch { sites = []; }
    const siteWarn = sites.length ? '<br><b>⚠ A place that matters to the local community.</b> Inspect it and talk with them first.' : '';
    let reach = '';
    if (bt === 'coralnursery') {
      // Nurseries replant the coral within about 4 tiles: say how much reef this spot would reach.
      let n = 0;
      const g = s.grid;
      for (let y = Math.max(0, a.y - 4); y <= Math.min(g.h - 1, a.y + a.h + 3); y++) {
        for (let x = Math.max(0, a.x - 4); x <= Math.min(g.w - 1, a.x + a.w + 3); x++) if (g.kind[y * g.w + x] === TileKind.Reef) n++;
      }
      reach = `<br>Replants ${n} reef tile${n === 1 ? '' : 's'} nearby${n < 20 ? ' (try a spot closer to the reef)' : ''}`;
    }
    const roadNote = chk.ok ? this.roadNote(s, bt, a) : '';
    if (chk.ok) this.tip.show(px, py, `<b>${def.name}</b> · $${chk.cost}k${roadNote}${chk.bushCleared ? `<br>Clears ${chk.bushCleared} bush tile${chk.bushCleared > 1 ? 's' : ''} (releases CO₂)` : ''}${reach}${siteWarn}`, 'ok');
    else this.tip.show(px, py, degC(chk.reason ?? 'Cannot build here'), 'bad');
  }

  /** Perform the active tool at a tile. */
  private act(tx: number, ty: number, cx: number, cy: number, painting: boolean): void {
    const t = this.toolbar.tool;
    const s = this.game.state;
    if (t === null || t === 'inspect') {
      this.inspect(tx, ty, cx, cy);
      return;
    }
    if (t === 'demolish') {
      const b = buildingAt(s, tx, ty);
      if (!b) { if (!painting) sfx('error'); return; }
      const r = this.game.dispatch({ type: 'demolish', x: tx, y: ty });
      if (r.ok) {
        sfx('demolish');
        this.renderer.rig?.shake(0.05 + Math.max(b.w, b.h) * 0.02);
        if (r.refund) floater(cx, cy - 20, `+$${r.refund}k`, 'good');
      }
      return;
    }
    if (t === 'dispose') {
      this.openDisposal(tx, ty);
      return;
    }
    if (t === 'rehab') {
      const r = this.game.dispatch({ type: 'rehab', x: tx, y: ty } as unknown as SIM.Action);
      if (r.ok) {
        sfx('good');
        this.renderer.dust(tx, ty, 2, 2);
        setTimeout(() => this.renderer.sparkle(tx, ty, 2, 2, true), 400);
        if (r.spent) floater(cx, cy - 20, `-$${r.spent}k`, 'cost');
      } else {
        sfx('error');
        floater(cx, cy - 30, degC(r.reason ?? ''), 'bad');
      }
      return;
    }
    if (t === 'comanage' || t === 'burn') {
      const r = this.game.dispatch({ type: t, x: tx, y: ty });
      if (r.ok) {
        sfx('good');
        this.renderer.sparkle(tx, ty, 1, 1, t === 'burn');
        if (r.spent) floater(cx, cy - 20, `-$${r.spent}k`, 'cost');
      } else {
        sfx('error');
        floater(cx, cy - 30, degC(r.reason ?? ''), 'bad');
      }
      return;
    }
    if (t === 'clear') {
      const r = this.game.dispatch({ type: 'clear', x: tx, y: ty });
      if (r.ok) {
        sfx('demolish');
        this.renderer.dust(tx, ty);
        floater(cx, cy - 20, `-$${r.spent}k`, 'cost');
      } else if (!painting) {
        sfx('error');
        floater(cx, cy - 30, degC(r.reason ?? ''), 'bad');
      }
      return;
    }
    const bt = t as BuildingId;
    const a = this.anchor(bt, tx, ty);
    const r = this.game.dispatch({ type: 'place', building: bt, x: a.x, y: a.y, rotation: this.rot });
    if (r.ok) {
      sfx('place');
      setTimeout(() => sfx('coin'), 90);
      floater(cx, cy - 20, `-$${r.spent}k`, 'cost');
      const big = Math.max(a.w, a.h);
      if (big >= 2) this.renderer.rig?.shake(0.03 * big);
      if (GREEN.has(bt)) setTimeout(() => this.renderer.sparkle(a.x, a.y, a.w, a.h, bt === 'nursery'), 450);
    } else if (!painting) {
      sfx('error');
      floater(cx, cy - 30, degC(r.reason ?? 'Cannot build here'), 'bad');
    }
  }

  private inspect(tx: number, ty: number, cx: number, cy: number): void {
    const s = this.game.state;
    const g = s.grid;
    const i = ty * g.w + tx;
    const b = buildingAt(s, tx, ty);
    const kind = g.kind[i] ?? 0;
    const act2 = s.phase === 'act2' || s.phase === 'epilogue';
    const kv = (k: string, v: string): HTMLElement => h('div', { class: 'kv' }, h('span', null, k), h('b', null, v));
    const lvl = (v: number): string => (v < 0.2 ? 'clean' : v < 0.6 ? 'low' : v < 1.2 ? 'moderate' : v < 2 ? 'high' : 'severe');
    const rows: HTMLElement[] = [];
    if (b) {
      const d = BUILDINGS[b.type];
      rows.push(h('h3', null, svg(bIcon(b.type)), d.name));
      rows.push(h('p', { style: 'margin:4px 0 8px' }, d.blurb));
      try {
        const ra = SIM.roadAccess(s);
        if (ra.enforced && ra.unconnected.includes(b.uid)) rows.push(h('div', { class: 'fact', style: 'margin:0 0 8px' }, h('p', null, h('b', null, 'Not connected to the road in — it does nothing until a road reaches it.'))));
      } catch { /* old state */ }
      try {
        if (d.housing > 0 && (getScenarioMech(s) ?? []).includes('reef') && SIM.wouldFlood(s, b, SIM.DESIGN_SURGE_M)) {
          rows.push(h('div', { class: 'fact', style: 'margin:0 0 8px;color:#b5651d' }, h('p', null, h('b', null, '⚠ Low ground. '), 'A storm surge could flood these homes. Demolish and rebuild them on raised or high ground, or grow mangroves in front.')));
        }
      } catch { /* not an island */ }
      if (d.jobs) rows.push(kv('Jobs', String(d.jobs)));
      if (d.housing) rows.push(kv('Homes for', `${d.housing} people`));
      if (d.energy) rows.push(kv('Generates', `${d.energy.capacity} power`));
      else if (d.power < 0) rows.push(kv('Uses power', String(-d.power)));
      if (d.co2) rows.push(kv('Emissions', `${d.co2} kt CO₂ / decade`));
      rows.push(kv('Built', String(b.builtYear)));
      const u = s.a2?.utilisation?.[String(b.uid)];
      if (act2 && u !== undefined) rows.push(kv('Running at', `${Math.round(u * 100)}%`));
    } else {
      rows.push(h('h3', null, svg(kind === TileKind.Bush ? UI_ICONS.leaf : kind === TileKind.Sea || kind === TileKind.Reef || kind === TileKind.Estuary || kind === TileKind.River ? UI_ICONS.wave : UI_ICONS.info), capital(TILE_KIND_NAMES[kind as 0])));
      if (act2 && kind !== TileKind.Rock && kind !== TileKind.River) rows.push(kv('Growing', `${stageLabel(kind, g.stage[i] ?? 0)} (${Math.round((g.health[i] ?? 0) * 100)}%)`));
      if (g.weed[i]) rows.push(kv('Weeds', 'invading - a nursery crew can help'));
      if (kind === TileKind.Estuary) rows.push(kv('Estuary health', `${Math.round(estuaryHealth(s))}/100`));
    }
    rows.push(kv('Air pollution', lvl(g.airPollution[i] ?? 0)));
    rows.push(kv('Water pollution', lvl(g.waterPollution[i] ?? 0)));
    rows.push(kv('Soil contamination', lvl(g.soilContamination[i] ?? 0)));
    rows.push(kv('Height', ['sea level', 'low', 'raised', 'high'][g.elevation[i] ?? 0] ?? '?'));
    const site = g.significant?.[i] ?? 0;
    if (site > 0 && SIM.countryActive(s)) {
      const asked = s.country.consulted.includes(site);
      const pub = hideDraft();
      rows.push(h('div', { class: 'fact', style: 'margin-top:8px' }, h('p', null, h('b', null, pub ? 'A place to ask the community about' : siteName(site)), h('br'),
        asked ? 'You have talked with the community about this place.' : pub ? `${NEUTRAL_COMMUNITY}. Consult before anything is built here.` : `${SIM.elderOf(s.scenarioId)?.name ?? 'The local Elder'} has asked to be consulted before anything is built here.`)));
      if (!asked) rows.push(h('button', { class: 'btn small green', style: 'margin-top:6px', onclick: () => {
        const r = this.game.dispatch({ type: 'consult', x: tx, y: ty });
        if (r.ok) { sfx('good'); this.renderer.sparkle(tx, ty, 1, 1, true); this.inspectEl.classList.add('hidden'); }
        else { sfx('error'); toast('Not yet', degC(r.reason ?? ''), 'warn', UI_ICONS.info, 4000); }
      } }, svg(UI_ICONS.speech), 'Talk with the community first ($3k)'));
    }
    if (b) {
      const ub = upgradeBlock(s, b, (id) => {
        const r = this.game.dispatch({ type: 'upgrade', uid: b.uid, id });
        if (r.ok) {
          sfx('good');
          floater(cx, cy - 20, `-$${r.spent}k`, 'cost');
          this.renderer.sparkle(b.x, b.y, b.w, b.h, false);
          this.inspect(tx, ty, cx, cy);
        } else { sfx('error'); toast('Not yet', degC(r.reason ?? ''), 'warn', UI_ICONS.info, 4000); }
      });
      if (ub) rows.push(ub);
      const hc = HIDDEN_COSTS[b.type];
      if (hc) rows.push(h('details', { class: 'hidden-cost-box', 'data-qa': 'hidden-cost' }, h('summary', null, 'Hidden costs of this clean tech'), h('p', null, hc.long), h('p', null, h('b', null, 'The balance: '), hc.balance)));
    }
    if (b && s.phase === 'act2') {
      const it = SIM.itemAt(s, tx, ty);
      if (it && it.status === 'standing') {
        rows.push(h('button', { class: 'btn small teal', style: 'margin-top:6px', disabled: !s.circular.unlocked, title: s.circular.unlocked ? '' : 'Opens with the circular economy', onclick: () => this.openDisposal(tx, ty) }, svg(UI_ICONS.demolish), s.circular.unlocked ? 'Choose its future' : 'Old site: decide later'));
      }
    }
    this.inspectEl.replaceChildren(...rows, h('button', { class: 'linkbtn', onclick: () => this.inspectEl.classList.add('hidden') }, 'close'));
    this.inspectEl.classList.remove('hidden');
    const w = 280;
    this.inspectEl.style.left = `${Math.min(window.innerWidth - w - 10, Math.max(10, cx + 16))}px`;
    this.inspectEl.style.top = `${Math.min(window.innerHeight - this.inspectEl.offsetHeight - 10, Math.max(80, cy - 40))}px`;
    sfx('click');
  }

  /** Tutorial highlight key -> element. */
  private tutorialTarget(key: string): HTMLElement | null {
    const [kind, name = ''] = key.split(':');
    if (kind === 'build' || kind === 'tool') return this.toolbar.elementFor(name);
    if (kind === 'button') {
      switch (name) {
        case 'next-decade': return this.nextBtn;
        case 'start-transition': return document.querySelector('[data-tut="start-transition"]');
        case 'play': case 'speed': return this.clock.el.querySelector('.speeds');
        case 'objectives': return this.objectives.el;
        case 'animals': return this.hud.speciesBtn.classList.contains('hidden') ? null : this.hud.speciesBtn;
        default: return null;
      }
    }
    if (kind === 'panel') {
      if (name === 'graphs') return this.hud.graphsBtn;
      if (name === 'grid') return this.energy.el;
      if (name === 'voices') return this.hud.voicesBtn;
    }
    return null;
  }

  private tutorialDone(): void {
    sfx('good');
    for (let i = 0; i < 4; i++) setTimeout(() => {
      const s = this.game.state;
      this.renderer.sparkle(Math.floor(s.grid.w * Math.random()), Math.floor(s.grid.h * Math.random()), 3, 3, true);
    }, i * 250);
    try {
      // Finishing the steps opens Coal Coast; the tutorial's stars come from its report card, like every scenario.
      const { progress } = SIM.completeTutorial(loadProgressSafe());
      SIM.saveProgress(localStorage, progress);
    } catch { /* ignore */ }
    toast('Tutorial complete!', 'Coal Coast is unlocked. Read your report card, then head on to Coal Coast.', 'good', UI_ICONS.star, 9000);
  }

  private openDisposal(tx: number, ty: number): void {
    let warn = '';
    try { const it = SIM.itemAt(this.game.state, tx, ty); warn = it ? powerLossWarning(this.game.state, it.type, it.uid) : ''; } catch { warn = ''; }
    try { warn = [warn, netZeroBudgetNote(this.game.state)].filter(Boolean).join(' '); } catch { /* no net-zero line here */ }
    const ok = showDisposal(this.game.state, tx, ty, (plan) => {
      const r = this.game.dispatch({ type: 'dispose', x: tx, y: ty, how: plan.how, into: plan.how === 'repurpose' ? plan.id : undefined });
      if (r.ok) {
        sfx(plan.how === 'landfill' ? 'demolish' : 'good');
        this.renderer.dust(tx, ty, 2, 2);
        if (plan.how !== 'landfill') setTimeout(() => this.renderer.sparkle(tx, ty, 2, 2, plan.how === 'repurpose'), 500);
      } else {
        sfx('error');
        toast('Not possible', degC(r.reason ?? ''), 'warn', UI_ICONS.info, 5000);
      }
    }, warn);
    if (!ok) { sfx('error'); toast('Nothing to decide here', 'Choose an old Act 1 building that is still standing.', 'info', UI_ICONS.info, 3000); }
    this.inspectEl.classList.add('hidden');
  }

  private exposeDebug(): void {
    (window as unknown as { __cc: unknown }).__cc = {
      app: this,
      sim: SIM,
      /** Build a scripted Act 1 town up to `untilYear` (testing / screenshots). */
      demoTown: (untilYear = 2010) => {
        const g = this.game;
        if (!this.playing) this.newGame('coal-coast');
        closeAllModals();
        const plan: [BuildingId, number][][] = [
          [['cottage', 5], ['farm', 2], ['coalmine', 1], ['road', 8]], [['cottage', 3], ['rail', 5], ['farm', 1]], [['port', 1], ['cottage', 3], ['outfall', 1]],
          [['cottage', 4], ['coalmine', 1], ['road', 4]], [['cottage', 3], ['farm', 1]], [['factory', 1], ['landfill', 1], ['cottage', 3]],
          [['steelworks', 1], ['cottage', 3], ['road', 4]], [['coalpower', 1], ['cottage', 4], ['farm', 2]], [['factory', 1], ['cottage', 3]], [['coalpower', 1], ['suburb', 2], ['carpark', 1]],
          [['suburb', 2], ['factory', 1]], [['suburb', 2], ['coalpower', 1]], [['suburb', 1]], [['suburb', 1]], [['suburb', 1]], [['suburb', 1]], [['suburb', 1]],
        ];
        const auto = (t: BuildingId, n: number): void => {
          let placed = 0;
          const st = (): GameState => g.state;
          const from = t === 'port' || t === 'outfall' ? 16 : 5;
          for (let y = 0; y < st().grid.h && placed < n; y++) for (let x = from; x < st().grid.w && placed < n; x++) {
            if (SIM.canPlace(st(), t, x, y, 0).ok && g.dispatch({ type: 'place', building: t, x, y, rotation: 0 }).ok) placed++;
          }
        };
        for (const step of plan) {
          if (g.state.phase !== 'act1' || g.state.year >= untilYear) break;
          g.state.budget = Math.max(g.state.budget, 600);
          for (const [t, n] of step) auto(t, n);
          SIM.connectAllFree(g.state); // the scripted town's roads must reach everything (roads matter)
          g.nextDecade();
        }
        closeAllModals();
        this.dilemmaQueue.length = 0;
        document.querySelectorAll('.bubble').forEach((b) => b.remove());
        return g.state.year;
      },
      demoAct2: (years = 10) => {
        const dbg = (window as unknown as { __cc: { demoTown: (y: number) => number } }).__cc;
        if (this.game.state.phase === 'act1') dbg.demoTown(2030);
        closeAllModals();
        if (this.game.state.phase === 'turning-point') {
          this.game.beginAct2();
          const g = this.game;
          g.state.budget = Math.max(g.state.budget, 2000);
          const cc = (window as unknown as { __cc: { autoPlace: (t: BuildingId, n: number, r?: number, f?: number) => number } }).__cc;
          for (const [t, n] of [['solarfarm', 3], ['windfarm', 3], ['battery', 3], ['nursery', 2], ['wetland', 2], ['phytoremediation', 2], ['rooftopsolar', 4], ['gaspower', 1]] as [BuildingId, number][]) cc.autoPlace(t, n, 0, 3);
        }
        this.game.debugTick(years);
        closeAllModals();
        this.dilemmaQueue.length = 0;
        return `${this.game.state.phase} ${this.game.state.year}`;
      },
      /** Measure fps / draw calls / triangles per tier (real rAF timing; the page must be visible). */
      bench: async (secs = 3) => {
        const out: Record<string, unknown>[] = [];
        for (const t of [0, 1, 2, 3, 4] as const) {
          this.renderer.applyTier(t);
          await new Promise((r) => setTimeout(r, 1200));
          let n = 0;
          let maxCalls = 0;
          let maxTris = 0;
          const t0 = performance.now();
          await new Promise<void>((res) => {
            const step = (): void => {
              n++;
              maxCalls = Math.max(maxCalls, this.renderer.stats.calls);
              maxTris = Math.max(maxTris, this.renderer.stats.triangles);
              if (performance.now() - t0 < secs * 1000) requestAnimationFrame(step);
              else res();
            };
            requestAnimationFrame(step);
          });
          const dt = (performance.now() - t0) / 1000;
          out.push({ tier: t, fps: Math.round((n / dt) * 10) / 10, calls: maxCalls, tris: maxTris, cpuMs: Math.round(this.renderer.stats.cpuMs * 10) / 10, dpr: this.renderer.renderer.getPixelRatio() });
        }
        return out;
      },
      /** Debug: skip the rest of Act 1 (no building) and begin Act 2. */
      skipToAct2: () => {
        closeAllModals();
        for (let i = 0; i < 30 && this.game.state.phase === 'act1'; i++) this.game.nextDecade();
        closeAllModals();
        this.dilemmaQueue.length = 0;
        if (this.game.state.phase === 'turning-point') this.game.beginAct2();
        closeAllModals();
        this.dilemmaQueue.length = 0;
        this.game.setSpeed(0);
        return `${this.game.state.phase} ${this.game.state.year}`;
      },
      closeModals: () => { closeAllModals(); this.dilemmaQueue.length = 0; },
      /** Place `type` at the first valid anchor (scan order), for testing. */
      autoPlace: (type: BuildingId, n = 1, rot: Rotation = 0, from = 0) => {
        let placed = 0;
        const st = () => this.game.state;
        for (let y = 0; y < st().grid.h && placed < n; y++) for (let x = from; x < st().grid.w && placed < n; x++) {
          if (SIM.canPlace(st(), type, x, y, rot).ok && this.game.dispatch({ type: 'place', building: type, x, y, rotation: rot }).ok) placed++;
        }
        return placed;
      },
      game: this.game,
      renderer: this.renderer,
      stats: () => this.renderer.debugInfo(),
      setTier: (t: 0 | 1 | 2 | 3 | 4) => this.renderer.applyTier(t),
      render: () => this.renderer.frame(),
      start: (id: string) => { if (isScenarioId(id)) this.newGame(id); },
      speed: (sp: Speed) => this.game.setSpeed(sp),
    };
  }
}

/**
 * If this power station went, would the town run short? Simulates a year of grid dispatch without it (other coal and
 * gas plants ramp up to cover if they can, batteries charge from spare daytime power). Returns a warning line, or ''
 * when it is safe.
 */
const plwCache = { key: '', val: '' };
export function powerLossWarning(s: GameState, type: BuildingId, uid?: number): string {
  const key = `${s.version}|${s.year}|${s.a2?.season}|${type}|${uid ?? ''}`;
  if (plwCache.key === key) return plwCache.val;
  const val = powerLossWarningUncached(s, type, uid);
  plwCache.key = key;
  plwCache.val = val;
  return val;
}

function powerLossWarningUncached(s: GameState, type: BuildingId, uid?: number): string {
  const d = BUILDINGS[type];
  if (!d.energy || s.phase !== 'act2' || !s.a2?.lastGrid) return '';
  const gone = uid ?? s.buildings.find((b) => b.type === type)?.uid;
  if (gone === undefined) return '';
  const fossil = type === 'coalpower' || type === 'gaspower';
  const { worst, when, spareByDay, nightGap } = SIM.gridShortfall(s, s.buildings.filter((b) => b.uid !== gone));
  if (worst <= 0.01) return fossil ? '✓ The grid holds without it, by day and night in every season: safe to retire now.' : '';
  // Say which fix: batteries only move spare daytime power into the night, so with little to spare they can't help.
  const fix = when === 'at night'
    ? spareByDay < nightGap
      ? `There is only about ${Math.round(spareByDay)} spare by day to charge batteries and the night needs about ${Math.round(nightGap)} more: add more solar first (it makes the spare power), or wind (it keeps turning after dark), then batteries to carry the spare into the night.`
      : 'There is spare power by day: add batteries to carry it into the night.'
    : 'Add more solar or wind.';
  let recipe = '';
  if (fossil) {
    try {
      const rp = SIM.retirePlan(s, gone);
      if (rp && !rp.safe && !rp.open) recipe = ` Roughly ${rp.roof > 0 ? `${rp.roof} more rooftop solar` : ''}${rp.roof > 0 && rp.battery > 0 ? ' and ' : ''}${rp.battery > 0 ? `${rp.battery} more batteries` : ''} (about $${rp.cost}k) would let you retire it.`;
    } catch { recipe = ''; }
  }
  return `⚠ Without it the town would be about ${Math.round(worst * 100)}% short of power ${when} in some seasons: expect blackouts. ${fix}${recipe}`;
}

/**
 * Net-zero scenarios: taking a site apart adds one-off emissions to this year's total. Say how close this year
 * already is to the line, so the player spreads the work out instead of tipping a net-zero year over.
 */
export function netZeroBudgetNote(s: GameState): string {
  const limit = SIM.getScenario(s.scenarioId).act2.netZeroKt;
  const last = s.a2?.yearly?.[s.a2.yearly.length - 1];
  if (limit === undefined || !last || s.phase !== 'act2') return '';
  // The town's ongoing level: the lowest of the last three years (one-off work only ever adds to a year).
  const ongoing = Math.min(...s.a2.yearly.slice(-3).map((y) => y.totalKt));
  const thisYear = ongoing + (s.pendingLandKt ?? 0);
  // Only worth saying once the town is actually at the line: far above it, one-off work changes nothing.
  if (ongoing > limit || thisYear + 6 <= limit) return '';
  return `Net-zero line: this year is already at about ${Math.round(thisYear)} of ${limit} kt. Taking a site apart adds its CO₂ to this year, so spread the work over several years.`;
}

function getScenarioMech(s: GameState): readonly string[] | undefined {
  return SIM.getScenario(s.scenarioId).mechanics;
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
