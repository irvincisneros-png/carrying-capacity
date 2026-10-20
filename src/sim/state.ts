import { cloneGrid } from './terrain';
import type { Act2State, EmissionsBySource, GameState } from './types';

export const emptyEmissions = (): EmissionsBySource => ({ power: 0, industry: 0, transport: 0, land: 0, waste: 0 });

export function emptyAct2(startYear: number, eqTempC = 0): Act2State {
  return {
    startYear,
    season: 0,
    clockMicro: 0,
    eqTempC,
    storageLevel: 0,
    stress: 0,
    stressSum: 0,
    yearEm: emptyEmissions(),
    yearUnmetSum: 0,
    yearSeasons: 0,
    lastUnmetFrac: 0,
    zeroYears: { economy: 0, society: 0, environment: 0 },
    societyAdjust: 0,
    active: [],
    lastEventIdx: {},
    nextEventId: 1,
    lastGrid: null,
    utilisation: {},
    activeRemediation: [],
    yearly: [],
    outcome: null,
    failure: null,
  };
}

export function cloneAct2(a: Act2State): Act2State {
  return {
    ...a,
    yearEm: { ...a.yearEm },
    zeroYears: { ...a.zeroYears },
    active: a.active.slice(),
    lastEventIdx: { ...a.lastEventIdx },
    utilisation: { ...a.utilisation },
    activeRemediation: a.activeRemediation.slice(),
    yearly: a.yearly.slice(),
  };
}

/** Structural copy: typed arrays copied, building / event / history records shared (treated as immutable). */
export function cloneState(s: GameState): GameState {
  return {
    ...s,
    grid: cloneGrid(s.grid),
    buildings: s.buildings.slice(),
    meters: { ...s.meters },
    history: s.history.slice(),
    a2: cloneAct2(s.a2),
    flags: { ...s.flags },
    events: s.events.slice(),
    eventLog: s.eventLog.slice(),
  };
}
