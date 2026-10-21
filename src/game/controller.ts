// Client game controller: owns the GameState, dispatches actions to the pure sim, runs the Act 2 clock,
// autosaves, keeps an undo snapshot, and broadcasts changes / events to the renderer and UI.
import {
  advanceDecade, applyAction, consumeEvents, createGame, loadFromStorage, MICRO, saveToStorage, startAct2, tick,
  type Action, type TickResult, type ActionResult, type DecadeReport, type GameState, type ScenarioId, type SimEvent,
} from '../sim';
import { SAVE_KEY, deserialize } from '../sim/save';

export type Speed = 0 | 1 | 2 | 4;
/** Real seconds per in-game year at 1x (docs/GAMEPLAY.md: 15 s). */
export const SECONDS_PER_YEAR = 15;

export interface GameEvents {
  state: (s: GameState, prev: GameState | null) => void;
  /** A fresh world (new game / load) - renderer should rebuild & snap. */
  reset: (s: GameState) => void;
  action: (a: Action, r: ActionResult, s: GameState) => void;
  decade: (r: DecadeReport, s: GameState) => void;
  simEvents: (e: SimEvent[], s: GameState) => void;
  phase: (phase: GameState['phase'], s: GameState) => void;
  speed: (sp: Speed) => void;
  saved: () => void;
  year: (year: number, s: GameState) => void;
}

type Handler<K extends keyof GameEvents> = GameEvents[K];

export class GameController {
  state: GameState;
  speed: Speed = 1;
  private prevSpeed: Speed = 1;
  private undoState: GameState | null = null;
  private handlers: Partial<Record<keyof GameEvents, unknown[]>> = {};
  private saveTimer = 0;
  private lastSavedYear = -1;
  /** Real seconds accumulated but not yet handed to tick() (keeps tick calls >= 1/60 year apart). */
  private clockAcc = 0;
  /**
   * The next season, simulated ahead of time in idle time (the sim is deterministic), keyed on the state it started
   * from. When the clock crosses into that season the result is used instead of simulating it inside the frame, so
   * a season tick no longer costs a long frame. Any action makes a new grid / version, so a stale result is unused.
   */
  private pre: { grid: GameState['grid']; version: number; res: TickResult } | null = null;
  private preQueued = false;

  constructor(initial: GameState) {
    this.state = initial;
  }

  on<K extends keyof GameEvents>(k: K, h: Handler<K>): void {
    const list = (this.handlers[k] ??= []) as unknown[];
    list.push(h);
  }

  private emit<K extends keyof GameEvents>(k: K, ...args: Parameters<GameEvents[K]>): void {
    const list = this.handlers[k] as unknown as ((...a: Parameters<GameEvents[K]>) => void)[] | undefined;
    if (!list) return;
    for (const h of list) {
      try {
        h(...args);
      } catch (e) {
        console.error(`[cc] ${String(k)} handler failed`, e);
      }
    }
  }

  private set(s: GameState): void {
    const prev = this.state;
    this.state = s;
    if (prev.phase !== s.phase) this.emit('phase', s.phase, s);
    if (prev.year !== s.year) this.emit('year', s.year, s);
    this.emit('state', s, prev);
  }

  // ---------------------------------------------------------------- lifecycle
  static hasSave(): boolean {
    try {
      return deserialize(localStorage.getItem(SAVE_KEY)) !== null;
    } catch {
      return false;
    }
  }

  static savedSummary(): { scenarioId: ScenarioId; year: number; phase: GameState['phase'] } | null {
    try {
      const s = deserialize(localStorage.getItem(SAVE_KEY));
      return s ? { scenarioId: s.scenarioId, year: s.year, phase: s.phase } : null;
    } catch {
      return null;
    }
  }

  newGame(id: ScenarioId, seed?: number): void {
    this.undoState = null;
    this.state = createGame(id, seed);
    this.speed = 1;
    this.lastSavedYear = this.state.year;
    this.emit('reset', this.state);
    this.emit('phase', this.state.phase, this.state);
    this.save();
  }

  loadSaved(): boolean {
    let ls: Storage | null = null;
    try { ls = localStorage; } catch { ls = null; }
    const s = loadFromStorage(ls);
    this.undoState = null;
    this.state = s;
    this.speed = s.phase === 'act2' ? 1 : 0;
    this.lastSavedYear = s.year;
    this.emit('reset', s);
    this.emit('phase', s.phase, s);
    return true;
  }

  save(): void {
    try {
      if (saveToStorage(localStorage, this.state)) this.emit('saved');
    } catch {
      /* storage unavailable */
    }
  }

  resetSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }

  // ---------------------------------------------------------------- actions
  dispatch(a: Action): ActionResult {
    const before = this.state;
    const { state, result } = applyAction(this.state, a);
    if (result.ok) {
      if (a.type === 'place') this.undoState = before;
      else this.undoState = null;
      this.set(state);
      this.scheduleSave();
    }
    this.emit('action', a, result, this.state);
    return result;
  }

  canUndo(): boolean {
    return this.undoState !== null;
  }

  undo(): boolean {
    if (!this.undoState) return false;
    const s = this.undoState;
    this.undoState = null;
    // keep version monotonic so renderers notice
    const restored = { ...s, version: this.state.version + 1 };
    this.set(restored);
    this.scheduleSave();
    return true;
  }

  nextDecade(): DecadeReport | null {
    const { state, report } = advanceDecade(this.state);
    if (!report) return null;
    this.undoState = null;
    this.set(state);
    this.flushEvents();
    this.emit('decade', report, state);
    this.save();
    return report;
  }

  beginAct2(): void {
    if (this.state.phase !== 'turning-point') return;
    const s = startAct2(this.state);
    this.undoState = null;
    // A town with no power station opens paused: the first job is to build the gas stations that keep the lights on.
    this.speed = s.flags['a2.stopgap'] ? 0 : 1;
    this.set(s);
    this.flushEvents();
    this.emit('speed', this.speed);
    this.save();
  }

  /** Resolve a dilemma card through the sim's 'choose' action (falls back to recording a flag). */
  resolveDilemma(cardId: string, optionId: string): void {
    const { state, result } = applyAction(this.state, { type: 'choose', dilemmaId: cardId, optionId } as unknown as Action);
    if (result.ok) {
      this.set(state);
      this.flushEvents();
      this.save();
      return;
    }
    this.set({ ...this.state, flags: { ...this.state.flags, [`dilemma.${cardId}`]: 1 }, version: this.state.version + 1 });
  }

  // ---------------------------------------------------------------- Act 2 clock
  setSpeed(sp: Speed): void {
    if (sp !== 0) this.prevSpeed = sp;
    this.speed = sp;
    this.emit('speed', sp);
  }

  togglePause(): void {
    this.setSpeed(this.speed === 0 ? this.prevSpeed || 1 : 0);
  }

  /** Called every animation frame with real seconds elapsed. */
  update(dtReal: number, blocked: boolean): void {
    if (this.state.phase !== 'act2' || this.speed === 0 || blocked) return;
    this.clockAcc += Math.min(dtReal, 0.25) * this.speed;
    if (this.clockAcc < 1 / 60) return;
    const dtYears = this.clockAcc / SECONDS_PER_YEAR;
    this.clockAcc = 0;
    const r = this.tickAhead(dtYears);
    this.queuePrecompute();
    if (r.state === this.state) return;
    this.set(r.state);
    if (r.seasons > 0) {
      this.flushEvents();
      if (this.state.phase !== 'act2') this.save();
      else if (this.state.year !== this.lastSavedYear) {
        // Yearly autosave in idle time, off the frame that simulated the season.
        this.lastSavedYear = this.state.year;
        const ric = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
        if (ric) ric(() => this.save(), { timeout: 1500 });
        else this.save();
      }
    }
  }

  /** tick(), but a single season boundary uses the season simulated ahead in idle time when it still applies. */
  private tickAhead(dtYears: number): TickResult {
    const st = this.state;
    const total = st.a2.clockMicro + Math.round(dtYears * 4 * MICRO);
    const p = this.pre;
    if (p && total >= MICRO && total < 2 * MICRO && p.grid === st.grid && p.version === st.version) {
      this.pre = null;
      const res = p.res.state;
      return { ...p.res, state: res.phase === 'act2' ? { ...res, a2: { ...res.a2, clockMicro: total - MICRO } } : res };
    }
    return tick(st, dtYears);
  }

  private queuePrecompute(): void {
    const st = this.state;
    if (this.preQueued || st.phase !== 'act2' || this.speed === 0) return;
    if (this.pre && this.pre.grid === st.grid && this.pre.version === st.version) return;
    this.preQueued = true;
    const run = (): void => {
      this.preQueued = false;
      const cur = this.state;
      if (cur.phase !== 'act2' || (this.pre && this.pre.grid === cur.grid && this.pre.version === cur.version)) return;
      const res = tick({ ...cur, a2: { ...cur.a2, clockMicro: 0 } }, 0.25);
      this.pre = { grid: cur.grid, version: cur.version, res };
    };
    const ric = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(run, { timeout: 2000 });
    else window.setTimeout(run, 0);
  }

  /** Debug / tests: jump the Act 2 clock forward. */
  debugTick(years: number): void {
    for (let i = 0; i < years * 4 && this.state.phase === 'act2'; i++) {
      const r = tick(this.state, 0.25);
      this.set(r.state);
      this.flushEvents();
    }
  }

  private flushEvents(): void {
    if (!this.state.events || this.state.events.length === 0) return;
    const { state, events } = consumeEvents(this.state);
    this.state = state;
    if (events.length) this.emit('simEvents', events, state);
  }

  private scheduleSave(): void {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.save(), 1500);
  }
}
