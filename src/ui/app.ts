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
import { Clock, EnergyPanel, ObjectivesPanel, hazIcon } from './act2';
import { clear, degC, fmt1, h, svg } from './dom';
import { showDilemma, SpeciesPanel, Voices } from './empathy';
import { beatChoice, dilemmaCard, reportCard, speciesList, storyLine } from './adapters';
import type { DilemmaCard } from './types';
import { GraphsPanel } from './graphs';
import { Hud } from './hud';
import { bIcon, UI_ICONS } from './icons';
import { closeAllModals, closeTopModal, floater, modalOpen, Tip, toast } from './modal';
import { showDecadeReport, showEnding, showIntro, showSettings, showTitle, showTurningPoint } from './screens';
import { Toolbar, type Tool } from './toolbar';
import { EVENT_NAMES } from '../content/act2';
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

  constructor(root: HTMLElement) {
    this.renderer = new GameRenderer(root);
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
      voices: () => this.voices.open(),
      species: () => this.species.open(),
    });
    this.toolbar = new Toolbar(this.tip);
    this.toolbar.onTool = (t) => this.onTool(t);
    this.graphs = new GraphsPanel();
    this.graphs.onClose = () => this.hud.graphsBtn.classList.remove('on');
    this.clock = new Clock((s) => { sfx('click'); this.game.setSpeed(s); });
    this.energy = new EnergyPanel();
    this.objectives = new ObjectivesPanel();
    this.voices = new Voices();
    this.voices.project = (tx, ty) => {
      const p = this.renderer.tileWorld(tx, ty);
      return this.renderer.project(p.x, p.y + 1.2, p.z);
    };
    this.voices.onNew = () => this.hud.voicesBtn.classList.remove('hidden');
    this.species = new SpeciesPanel();
    this.demand = h('div', { class: 'demand panel' });
    this.nextBtn = h('button', { class: 'btn primary nextbtn', onclick: () => this.nextDecade() }, svg(UI_ICONS.clock), 'Next decade');
    this.action = h('div', { class: 'action' }, this.demand, this.nextBtn);
    this.undoBtn = h('button', { class: 'btn small undo hidden', onclick: () => this.undo(), title: 'Undo last building (Ctrl+Z)' }, svg(UI_ICONS.undo), 'Undo');
    this.act2Buttons = h('div', { class: 'action hidden', style: 'bottom:150px' },
      h('button', { class: 'btn small', onclick: () => this.objectives.el.classList.toggle('open') }, svg(UI_ICONS.target), 'Goals'),
      h('button', { class: 'btn small', onclick: () => this.energy.el.classList.toggle('open') }, svg(UI_ICONS.bolt), 'Power'));
    this.logList = h('div');
    this.logDrawer = h('div', { class: 'drawer panel' }, h('div', { class: 'panel-head' }, h('h3', null, svg(UI_ICONS.log), 'Event log'), h('button', { class: 'btn small', onclick: () => this.logDrawer.classList.remove('open') }, 'Close')), this.logList);
    document.body.appendChild(this.logDrawer);
    this.inspectEl = h('div', { class: 'inspect panel hidden' });
    document.body.appendChild(this.inspectEl);
    this.ui.append(this.hud.el, this.toolbar.el, this.graphs.el, this.clock.el, this.energy.el, this.objectives.el, this.action, this.undoBtn, this.act2Buttons);
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
    }, GameController.savedSummary(), TEACHER);
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
    if (fresh) showIntro(s, () => {});
    else this.checkPhase(s);
  }

  private resetToTitle(): void {
    this.game.resetSave();
    const s = createGame('coal-coast');
    this.game.state = s;
    this.renderer.setWorld(s);
    this.showTitleScreen();
  }

  private nextDecade(): void {
    if (this.game.state.phase !== 'act1' || modalOpen()) return;
    sfx('decade');
    const r = this.game.nextDecade();
    if (!r) return;
    this.pendingPhase = true;
    showDecadeReport(r, () => {
      this.pendingPhase = false;
      this.checkPhase(this.game.state);
    });
  }

  private checkPhase(s: GameState): void {
    if (!this.playing) return;
    if (s.phase === 'turning-point') {
      showTurningPoint(s, () => {
        this.game.beginAct2();
        sfx('good');
        toast('Act 2 begins', 'Time now flows. Use the speed buttons or Space to pause and plan.', 'good', UI_ICONS.sprout);
      });
    } else if (s.phase === 'epilogue' || s.phase === 'failed') {
      this.game.setSpeed(0);
      const rig = this.renderer.rig;
      if (rig) rig.idleSpin = 0.06;
      showEnding(s, () => this.resetToTitle(), reportCard(s));
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
          if (!line.at) toast(line.speaker.name, line.text, 'info', UI_ICONS.speech, 8000);
        }
        const beat = beatChoice(s, e);
        if (beat) this.dilemmaQueue.push({ card: beat, kind: 'beat' });
        continue;
      }
      const bad = e.type === 'bushfire' || e.type === 'flood' || e.type === 'fish-kill' || e.type === 'blackout' || e.type === 'marine-heatwave';
      sfx('event');
      const name = (EVENT_NAMES as Record<string, string>)[e.type] ?? e.type;
      toast(name, degC(e.text), bad ? 'bad' : 'warn', hazIcon(e.type), 9000);
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
    const item = h('div', { class: 'log-item' }, svg(hazIcon(e.type)), h('div', null, h('small', null, `${e.year} · ${['summer', 'autumn', 'winter', 'spring'][e.season] ?? ''}`), degC(e.text)));
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
    this.voices.update();
    if (!modalOpen() && this.dilemmaQueue.length) this.pumpDilemmas();
    ambientTick(dt, Math.max(0, Math.min(1, s.meters.environment / 100)));
    if (this.debugEl) {
      const st = this.renderer.stats;
      this.debugEl.textContent = `${st.fps.toFixed(0)} fps  ${st.frameMs.toFixed(1)} ms (cpu ${st.cpuMs.toFixed(1)})\ncalls ${st.calls}  tris ${(st.triangles / 1000).toFixed(0)}k\ntier ${st.tier}${st.auto ? ' (auto)' : ''}  prog ${st.programs}  tex ${st.textures}\nyear ${yearFraction(s).toFixed(2)}`;
    }
  }

  private syncUi(s: GameState, force: boolean): void {
    if (!force && s.version === this.lastUiVersion) return;
    this.lastUiVersion = s.version;
    this.hud.update(s);
    this.toolbar.update(s);
    this.graphs.update(s);
    const act1 = s.phase === 'act1';
    const act2 = s.phase === 'act2';
    this.action.classList.toggle('hidden', !act1);
    this.nextBtn.disabled = !act1;
    if (act1) {
      const dem = this.demandText(s);
      this.demand.replaceChildren(h('b', null, `The ${s.year}s · the town needs`), dem);
      this.demand.classList.toggle('hidden', !dem);
    }
    this.undoBtn.classList.toggle('hidden', !this.game.canUndo());
    this.clock.el.classList.toggle('hidden', !act2);
    this.energy.el.classList.toggle('hidden', !act2);
    this.objectives.el.classList.toggle('hidden', !act2);
    this.act2Buttons.classList.toggle('hidden', !act2 || window.innerWidth > 700);
    if (s.year !== this.speciesYear) {
      this.speciesYear = s.year;
      const sp = speciesList(s);
      this.species.set(sp);
      this.hud.speciesBtn.classList.toggle('hidden', !sp.length || s.phase === 'act1');
    }
    if (act2) {
      this.clock.setSpeed(this.game.speed);
      this.energy.update(s);
      this.objectives.update(s);
    }
    this.refreshHover();
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
    const rig = this.renderer.rig;
    rig?.setLeftPans(t === null || t === 'inspect');
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
      else if (k === 'h') rig?.home(true);
      else if (k === ' ' && this.game.state.phase === 'act2') { e.preventDefault(); this.game.togglePause(); }
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
      if (b) this.tip.show(px, py, `<b>Demolish ${BUILDINGS[b.type].name}</b><br>Refund $${Math.floor(availability(s.scenarioId, b.type).cost * DEMOLISH_REFUND)}k`, '');
      else this.tip.hide();
      return;
    }
    if (t === 'clear') {
      const ok = s.grid.kind[hv.ty * s.grid.w + hv.tx] === TileKind.Bush;
      this.renderer.showCursor('clear', hv.tx, hv.ty, 0, ok);
      this.tip.show(px, py, ok ? `<b>Clear bush</b> · $${CLEAR_COST}k<br>Releases stored carbon as CO₂.` : 'Only bushland can be cleared', ok ? '' : 'bad');
      return;
    }
    const a = this.anchor(t, hv.tx, hv.ty);
    const chk = canPlace(s, t, a.x, a.y, this.rot);
    this.renderer.showCursor(t, a.x, a.y, this.rot, chk.ok);
    const def = BUILDINGS[t];
    if (chk.ok) this.tip.show(px, py, `<b>${def.name}</b> · $${chk.cost}k${chk.bushCleared ? `<br>Clears ${chk.bushCleared} bush tile${chk.bushCleared > 1 ? 's' : ''} (releases CO₂)` : ''}`, 'ok');
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
    const a = this.anchor(t, tx, ty);
    const r = this.game.dispatch({ type: 'place', building: t, x: a.x, y: a.y, rotation: this.rot });
    if (r.ok) {
      sfx('place');
      setTimeout(() => sfx('coin'), 90);
      floater(cx, cy - 20, `-$${r.spent}k`, 'cost');
      const big = Math.max(a.w, a.h);
      if (big >= 2) this.renderer.rig?.shake(0.03 * big);
      if (GREEN.has(t)) setTimeout(() => this.renderer.sparkle(a.x, a.y, a.w, a.h, t === 'nursery'), 450);
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
    this.inspectEl.replaceChildren(...rows, h('button', { class: 'linkbtn', onclick: () => this.inspectEl.classList.add('hidden') }, 'close'));
    this.inspectEl.classList.remove('hidden');
    const w = 280;
    this.inspectEl.style.left = `${Math.min(window.innerWidth - w - 10, Math.max(10, cx + 16))}px`;
    this.inspectEl.style.top = `${Math.min(window.innerHeight - this.inspectEl.offsetHeight - 10, Math.max(80, cy - 40))}px`;
    sfx('click');
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
        for (const t of [0, 1, 2, 3] as const) {
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
      setTier: (t: 0 | 1 | 2 | 3) => this.renderer.applyTier(t),
      render: () => this.renderer.frame(),
      start: (id: string) => { if (isScenarioId(id)) this.newGame(id); },
      speed: (sp: Speed) => this.game.setSpeed(sp),
    };
  }
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
