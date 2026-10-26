// The zone tool's words and picture, as pure functions of the game state (no DOM), so they can be tested:
// which tiles the soft overlay paints, what the tooltip says over a tile or a dragged rectangle, and whether
// the placeable cottage and brick suburb still belong in the build menu.
import { REASON, reasonText, ZONE_NAME, zonePlan, zoneProblem, zoneReasons, zoneTileCost } from '../sim/zoning';
import type { ZoneKind } from '../sim/zoning';
import type { BuildingId, GameState } from '../sim/types';

/** Homes are zoned now. The placeable cottage and brick suburb stay in the menu only for a saved town that already has some. */
export function legacyHomeHidden(s: GameState, id: BuildingId): boolean {
  if (id !== 'cottage' && id !== 'suburb') return false;
  return !s.buildings.some((b) => b.type === 'cottage' || b.type === 'suburb');
}

/**
 * Per tile for the zone overlay: 0 nothing, 1 homes, 2 shops and offices, 3 light industry; +3 when the tile cannot grow yet
 * (hatched: no road, no power, no one needs more, polluted, or an emptied building). Grown tiles and tiles ready to grow are solid.
 */
export function zoneOverlayCodes(s: GameState): Uint8Array {
  const g = s.grid;
  const reasons = zoneReasons(s);
  const codes = new Uint8Array(g.w * g.h);
  for (let i = 0; i < codes.length; i++) {
    const z = g.zoning[i] ?? 0;
    if (z === 0) continue;
    const fam = z <= 3 ? 1 : z === 4 ? 2 : 3;
    const r = reasons[i] ?? 0;
    const grown = (g.building[i] ?? 0) !== 0 && r !== REASON.empty;
    codes[i] = grown || r === REASON.ready ? fam : fam + 3;
  }
  return codes;
}

export interface ZoneInfo {
  html: string;
  tone: 'ok' | 'bad' | '';
  /** Can the zone go here (the cursor turns green, or red)? */
  ok: boolean;
}

const money = (n: number): string => String(Math.round(n * 10) / 10);

/** What to say over one tile while a zone tool is active: why a zoned tile is waiting, or whether this tile can take the zone. */
export function zoneTileInfo(s: GameState, tx: number, ty: number, kind: number): ZoneInfo {
  const g = s.grid;
  const i = ty * g.w + tx;
  const z = g.zoning[i] ?? 0;
  if (z > 0) {
    const code = zoneReasons(s)[i] ?? 0;
    const grown = (g.building[i] ?? 0) !== 0 && code !== REASON.empty;
    const why = grown ? 'Grown and working.' : reasonText(code, z);
    return { html: `<b>${ZONE_NAME[z as ZoneKind]}</b>${why ? `<br>${why}` : ''}`, tone: grown || code === REASON.ready ? 'ok' : '', ok: true };
  }
  const why = kind === 0 ? 'Nothing is zoned here' : zoneProblem(s, tx, ty, kind);
  if (why) return { html: why, tone: 'bad', ok: false };
  return { html: `<b>${ZONE_NAME[kind as ZoneKind]}</b> · $${money(zoneTileCost(s))}k a tile<br>Click, or hold and drag a box`, tone: 'ok', ok: true };
}

/** What to say while a rectangle is being dragged: the live cost, the tiles it covers and anything it would knock down. */
export function zoneDragInfo(s: GameState, rect: { x: number; y: number; w: number; h: number }, kind: number): ZoneInfo {
  const plan = zonePlan(s, rect.x, rect.y, rect.w, rect.h, kind);
  if (!plan.ok) return { html: plan.reason ?? 'Cannot zone here', tone: 'bad', ok: false };
  const n = plan.tiles.length;
  const tiles = `${n} tile${n > 1 ? 's' : ''}`;
  if (kind === 0) {
    const d = plan.demolish;
    return { html: `<b>Remove the zone</b> · ${tiles}${d ? `<br><b>${d} grown building${d > 1 ? 's' : ''} will be knocked down</b>` : ''}`, tone: d ? 'bad' : 'ok', ok: true };
  }
  const skip = plan.skipped > 0 ? `<br>${plan.skipped} tile${plan.skipped > 1 ? 's' : ''} here cannot take it and will be skipped` : '';
  return { html: `<b>Zone ${ZONE_NAME[kind as ZoneKind].toLowerCase()}</b> · ${tiles} · <b>$${money(plan.cost)}k</b>${skip}`, tone: 'ok', ok: true };
}
