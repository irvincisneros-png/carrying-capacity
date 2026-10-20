import { describe, expect, it } from 'vitest';
import { makeNoise2D, mulberry32 } from '../src/sim';

describe('rng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const sa = Array.from({ length: 20 }, () => a.next());
    const sb = Array.from({ length: 20 }, () => b.next());
    const sc = Array.from({ length: 20 }, () => c.next());
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
  });
  it('stays in [0,1) and int() is inclusive', () => {
    const r = mulberry32(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      seen.add(r.int(1, 3));
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });
  it('exposes resumable state', () => {
    const r = mulberry32(5);
    r.next();
    const resumed = mulberry32(r.state());
    expect(resumed.next()).toBe(r.next());
  });
  it('noise is smooth-ish, bounded and deterministic', () => {
    const n1 = makeNoise2D(mulberry32(1)), n2 = makeNoise2D(mulberry32(1));
    for (let i = 0; i < 100; i++) {
      const v = n1(i * 0.37, i * 0.11);
      expect(v).toBe(n2(i * 0.37, i * 0.11));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(n1(3.0, 3.0) - n1(3.01, 3.0))).toBeLessThan(0.05);
  });
});
