import { describe, expect, it } from 'vitest';
import {
  advanceDecade, applyAction, clearSave, createGame, deserialize, loadFromStorage, SAVE_KEY, SAVE_VERSION,
  saveToStorage, serialize,
} from '../src/sim';
import type { StorageLike } from '../src/sim';
import { buildN } from './helpers/autoplay';

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function playedGame() {
  let s = createGame('coal-coast');
  s = buildN(s, 'cottage', 3).state;
  s = buildN(s, 'coalmine', 1).state;
  for (let i = 0; i < 4; i++) {
    s = advanceDecade(s).state;
    s = buildN(s, 'cottage', 2).state;
  }
  return s;
}

describe('save / load', () => {
  it('round-trips a played game exactly', () => {
    const s = playedGame();
    const back = deserialize(serialize(s));
    expect(back).not.toBeNull();
    expect(serialize(back as NonNullable<typeof back>)).toBe(serialize(s));
    expect(back?.grid.kind).toBeInstanceOf(Uint8Array);
    expect(back?.grid.building).toBeInstanceOf(Uint16Array);
    expect(back?.grid.airPollution).toBeInstanceOf(Float32Array);
    expect(Array.from(back?.grid.airPollution ?? [])).toEqual(Array.from(s.grid.airPollution));
    expect(back?.year).toBe(s.year);
    expect(back?.history).toEqual(s.history);
  });
  it('a loaded game keeps playing identically', () => {
    const s = playedGame();
    const back = deserialize(serialize(s)) as NonNullable<ReturnType<typeof deserialize>>;
    const a = advanceDecade(s).state;
    const b = advanceDecade(back).state;
    expect(JSON.stringify(a.history)).toBe(JSON.stringify(b.history));
    const x = applyAction(back, { type: 'demolish', x: s.buildings[0]?.x ?? 0, y: s.buildings[0]?.y ?? 0 });
    expect(x.result.ok).toBe(true);
  });
  it('is versioned', () => {
    expect(SAVE_KEY).toBe('cc.save.v1');
    const raw = JSON.parse(serialize(createGame('coal-coast'))) as Record<string, unknown>;
    expect(raw.saveVersion).toBe(SAVE_VERSION);
    raw.saveVersion = SAVE_VERSION + 1;
    expect(deserialize(JSON.stringify(raw))).toBeNull();
    raw.saveVersion = 0;
    expect(deserialize(JSON.stringify(raw))).toBeNull();
  });
  it.each([
    ['null', null],
    ['empty', ''],
    ['not json', '{oops'],
    ['array', '[]'],
    ['number', '42'],
    ['empty object', '{}'],
  ])('rejects %s', (_n, text) => {
    expect(deserialize(text)).toBeNull();
  });
  it('rejects structurally corrupted saves', () => {
    interface Raw {
      grid: { kind: number[]; building: number[] };
      year: number;
      budget: unknown;
      scenarioId: unknown;
      buildings: { type: unknown; x: number }[];
      history: unknown[];
      status: unknown;
      meters: unknown;
    }
    const text = serialize(playedGame());
    const corrupt = (mut: (o: Raw) => void): string => {
      const o = JSON.parse(text) as Raw;
      mut(o);
      return JSON.stringify(o);
    };
    expect(deserialize(corrupt((o) => { o.grid.kind.pop(); }))).toBeNull();
    expect(deserialize(corrupt((o) => { o.grid.kind[5] = 99; }))).toBeNull();
    expect(deserialize(corrupt((o) => { o.year = 1855; }))).toBeNull();
    expect(deserialize(corrupt((o) => { o.year = 2500; }))).toBeNull();
    expect(deserialize(corrupt((o) => { o.budget = 'lots'; }))).toBeNull();
    expect(deserialize(corrupt((o) => { o.scenarioId = 'atlantis'; }))).toBeNull();
    expect(deserialize(corrupt((o) => { (o.buildings[0] as { type: unknown }).type = 'mansion'; }))).toBeNull();
    expect(deserialize(corrupt((o) => { (o.buildings[0] as { x: number }).x = 99; }))).toBeNull();
    expect(deserialize(corrupt((o) => { o.history.pop(); }))).toBeNull();
    expect(deserialize(corrupt((o) => { o.grid.building[0] = 60000; }))).toBeNull();
    expect(deserialize(corrupt((o) => { o.status = 'won'; }))).toBeNull();
    expect(deserialize(corrupt((o) => { o.meters = null; }))).toBeNull();
  });
  it('a corrupted save in storage falls back to a fresh new game', () => {
    const st = memoryStorage();
    st.setItem(SAVE_KEY, '{"saveVersion":1,"broken":true}');
    const s = loadFromStorage(st, 'coal-coast');
    expect(s.year).toBe(1850);
    expect(s.buildings).toHaveLength(0);
    expect(s.budget).toBe(100);
  });
  it('missing storage / throwing storage falls back to a new game and saving reports failure', () => {
    expect(loadFromStorage(null).year).toBe(1850);
    const bad: StorageLike = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('denied'); },
    };
    expect(loadFromStorage(bad).year).toBe(1850);
    expect(saveToStorage(bad, createGame('coal-coast'))).toBe(false);
    expect(() => clearSave(bad)).not.toThrow();
  });
  it('saves to and restores from storage, and clearSave resets', () => {
    const st = memoryStorage();
    const s = playedGame();
    expect(saveToStorage(st, s)).toBe(true);
    expect(st.data.has(SAVE_KEY)).toBe(true);
    const back = loadFromStorage(st);
    expect(back.year).toBe(s.year);
    expect(back.buildings).toHaveLength(s.buildings.length);
    clearSave(st);
    expect(loadFromStorage(st).year).toBe(1850);
  });
  it('saves every scenario', () => {
    for (const id of ['coal-coast', 'green-valley', 'river-town', 'reef-island', 'red-dirt', 'net-zero-city'] as const) {
      const s = createGame(id);
      expect(deserialize(serialize(s))?.scenarioId).toBe(id);
    }
  });
});
