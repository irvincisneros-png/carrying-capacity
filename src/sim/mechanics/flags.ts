/** Small helpers for scenario mechanics that keep their numbers in GameState.flags (saved and cloned for free). */
import type { GameState } from '../types';

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export function flag(s: GameState, key: string, dflt = 0): number {
  const v = s.flags[key];
  return typeof v === 'number' ? v : v === true ? 1 : dflt;
}

export function setFlag(s: GameState, key: string, v: number): void {
  s.flags[key] = Math.round(v * 1e6) / 1e6;
}

export function addFlag(s: GameState, key: string, d: number): void {
  setFlag(s, key, flag(s, key) + d);
}

/** Active-event test that does not need events.ts (keeps the mechanics free of import cycles). */
export function eventActive(s: GameState, type: string, seasonIndex: number): boolean {
  return s.a2.active.some((e) => e.type === type && e.endsAt > seasonIndex);
}

export function countOf(s: GameState, ...types: string[]): number {
  let n = 0;
  for (const b of s.buildings) if (types.includes(b.type)) n++;
  return n;
}

/** Chebyshev distance from a rect to a tile (0 inside). */
export function rectTileDist(b: { x: number; y: number; w: number; h: number }, x: number, y: number): number {
  const dx = Math.max(b.x - x, x - (b.x + b.w - 1), 0);
  const dy = Math.max(b.y - y, y - (b.y + b.h - 1), 0);
  return Math.max(dx, dy);
}
