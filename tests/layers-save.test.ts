import { describe, expect, it } from 'vitest';
import {
  advanceDecade, applyAction, cloneState, createGame, deserialize, markSignificant, SAVE_VERSION, serialize, startAct2, tick,
} from '../src/sim';
import type { GameState } from '../src/sim';
import { runScript } from './helpers/autoplay';
import { act1Respectful, fullPlayPlan, RESPECTFUL_WANTS } from './helpers/fullplay';
import { CAREFUL_ROADS, DIRTY_WANTS, greedyPlan } from './helpers/scripts';

type Raw = Record<string, unknown> & { grid: Record<string, unknown> };

const act1 = runScript(createGame('coal-coast'), act1Respectful(greedyPlan(RESPECTFUL_WANTS, 1.0, 30, CAREFUL_ROADS))).state;
const dirtyAct1 = runScript(createGame('coal-coast'), greedyPlan(DIRTY_WANTS, 1.0)).state;

function midAct2(): GameState {
  let s = startAct2(act1);
  const plan = fullPlayPlan();
  while (s.phase === 'act2' && s.year < 2070) {
    s = plan(s);
    s = tick(s, 1).state;
  }
  // Make sure the circular layer has some research in it, whatever the scripted town could afford along the way.
  if (s.circular.research.length === 0 && s.circular.unlocked) s = applyAction({ ...s, budget: s.budget + 500 }, { type: 'research', id: 'ewaste' }).state;
  return s;
}
const mid = midAct2();

const asV2 = (s: GameState): string => {
  const o = JSON.parse(serialize(s)) as Raw;
  for (const k of ['residents', 'dilemmas', 'wildlife', 'country', 'circular', 'satellites']) delete o[k];
  delete o.grid.significant;
  o.saveVersion = 2;
  return JSON.stringify(o);
};

describe('save version 4', () => {
  it('is version 4 (3 and older still load)', () => {
    expect(SAVE_VERSION).toBe(4);
    expect((JSON.parse(serialize(createGame('coal-coast'))) as { saveVersion: number }).saveVersion).toBe(4);
  });
  it('round-trips every layer exactly, mid-Act 2', () => {
    // The state really has something in every layer.
    expect(mid.year).toBeGreaterThanOrEqual(2070);
    expect(Object.keys(mid.residents.fired).length).toBeGreaterThan(10);
    expect(mid.dilemmas.decisions.length).toBeGreaterThan(5);
    expect(mid.country.consulted.length).toBe(3);
    expect(mid.country.comanaged.length).toBeGreaterThan(0);
    expect(mid.circular.items.some((i) => i.status !== 'standing')).toBe(true);
    expect(mid.circular.research.length).toBeGreaterThan(0);
    expect(Object.keys(mid.wildlife.species)).toHaveLength(7);
    expect(mid.satellites.overlays.sst).toBe(true);
    const text = serialize(mid);
    const back = deserialize(text);
    expect(back).not.toBeNull();
    expect(serialize(back as GameState)).toBe(text);
    expect(back?.grid.significant).toBeInstanceOf(Uint8Array);
    expect(Array.from(back?.grid.significant ?? [])).toEqual(Array.from(mid.grid.significant));
    expect(back?.wildlife).toEqual(mid.wildlife);
    expect(back?.country).toEqual(mid.country);
    expect(back?.circular).toEqual(mid.circular);
    expect(back?.dilemmas).toEqual(mid.dilemmas);
    expect(back?.residents).toEqual(mid.residents);
  });
  it('keeps simulating identically after a load', () => {
    const back = deserialize(serialize(mid)) as GameState;
    expect(serialize(tick(back, 6).state)).toBe(serialize(tick(mid, 6).state));
  });
  it('round-trips Act 1, the turning point and the epilogue', () => {
    expect(act1.phase).toBe('turning-point');
    for (const s of [createGame('coal-coast'), act1, tick(startAct2(act1), 80).state]) {
      const text = serialize(s);
      expect(serialize(deserialize(text) as GameState)).toBe(text);
    }
  });
  it('rejects corrupted layer data', () => {
    const o = JSON.parse(serialize(mid)) as Raw & { residents: Record<string, unknown>; circular: { items: Record<string, unknown>[] }; country: Record<string, unknown> };
    const bad = (mut: (x: typeof o) => void): string => {
      const c = JSON.parse(JSON.stringify(o)) as typeof o;
      mut(c);
      return JSON.stringify(c);
    };
    expect(deserialize(bad((c) => { delete (c as Record<string, unknown>).residents; }))).toBeNull();
    expect(deserialize(bad((c) => { c.residents.pending = 'x'; }))).toBeNull();
    expect(deserialize(bad((c) => { c.country.partnership = 'high'; }))).toBeNull();
    expect(deserialize(bad((c) => { (c.grid.significant as number[]).pop(); }))).toBeNull();
    expect(deserialize(bad((c) => { c.circular.items[0] = { ...(c.circular.items[0] as Record<string, unknown>), type: 'dragon' }; }))).toBeNull();
    expect(deserialize(bad((c) => { delete (c as Record<string, unknown>).wildlife; }))).toBeNull();
    expect(deserialize(serialize(mid))).not.toBeNull();
  });
});

describe('migrating older saves', () => {
  it('migrates a version 2 game in Act 1: layers start fresh, significant places are recomputed', () => {
    let s = createGame('coal-coast');
    s = advanceDecade(s).state;
    s = advanceDecade(s).state;
    const back = deserialize(asV2(s));
    expect(back).not.toBeNull();
    expect(back?.saveVersion).toBe(SAVE_VERSION);
    expect(back?.phase).toBe('act1');
    expect(back?.year).toBe(1870);
    expect(Object.keys(back?.residents.list ?? {})).toHaveLength(6);
    expect(back?.residents.fired).toEqual({});
    expect(back?.country.partnership).toBe(20);
    expect(back?.circular.items).toHaveLength(0);
    const sig = s.grid.significant.slice();
    markSignificant(s.grid);
    expect(Array.from(back?.grid.significant ?? [])).toEqual(Array.from(sig));
    // And it plays on.
    const next = advanceDecade(back as GameState).state;
    expect(next.year).toBe(1880);
  });
  it('migrates a version 2 game that is already in Act 2: legacy sites and the census are rebuilt', () => {
    const early = tick(startAct2(dirtyAct1), 3).state;
    const back = deserialize(asV2(early));
    expect(back).not.toBeNull();
    expect(back?.phase).toBe('act2');
    expect(back?.circular.items.length).toBe(early.circular.items.length);
    expect(back?.circular.items.length).toBeGreaterThan(10);
    expect(back?.circular.items.every((i) => ['coalmine', 'rail', 'port', 'steelworks', 'coalpower', 'factory', 'landfill', 'carpark', 'outfall'].includes(i.type))).toBe(true);
    expect(back?.wildlife.initialised).toBe(true);
    expect(Object.keys(back?.wildlife.species ?? {})).toHaveLength(7);
    expect(back?.year).toBe(early.year);
    const cont = tick(back as GameState, 3).state;
    expect(cont.year).toBe(early.year + 3);
    expect(cont.residents.history.length).toBeGreaterThan(0);
    // A later version 2 save only keeps the legacy sites still standing.
    const late = deserialize(asV2(mid));
    expect(late?.circular.items.length).toBeLessThan(early.circular.items.length);
    expect(late?.phase).toBe('act2');
  });
  it('migrates a version 2 turning point and then Act 2 can start', () => {
    const back = deserialize(asV2(act1));
    expect(back?.phase).toBe('turning-point');
    const started = startAct2(back as GameState);
    expect(started.phase).toBe('act2');
    expect(started.circular.items.length).toBeGreaterThan(10);
    expect(started.wildlife.initialised).toBe(true);
  });
});

describe('purity', () => {
  it('actions and ticks never mutate the layer state of the state they were given', () => {
    const s = cloneState(mid);
    const before = serialize(s);
    const poked = cloneState(s);
    poked.residents.list['lena-tran'] = { mood: 1, trend: 0, lastBeatYear: 0 };
    poked.country.partnership = 1;
    poked.circular.items.length = 0;
    poked.wildlife.species.koala = { ...(poked.wildlife.species.koala as NonNullable<typeof poked.wildlife.species.koala>), pop: 999 };
    expect(serialize(s)).toBe(before);
    tick(s, 3);
    applyAction(s, { type: 'consult', x: 0, y: 0 });
    expect(serialize(s)).toBe(before);
  });
});
