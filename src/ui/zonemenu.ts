// The zone tool's words and picture, as pure functions of the game state (no DOM), so they can be tested:
// which tiles the soft overlay paints, what the tooltip says over a tile or a dragged rectangle, and whether
// the placeable cottage and brick suburb still belong in the build menu.
import { BUILDINGS } from '../sim/buildings';
import { DENSITY_UPGRADE_COST, familyOf, REASON, reasonText, retrofitPlan, zonableKind, ZONE_NAME, ZONE_UNLOCK, zoneOfType, zonePlan, zoneProblem, zoneReasons, zoneTileCost } from '../sim/zoning';
import type { ZoneKind } from '../sim/zoning';
import type { BuildingId, GameState, PlacedBuilding } from '../sim/types';

/** zoneKind() of the Retrofit homes area tool (Act 2). */
export const RETROFIT = -1;

/** Homes are zoned now. The placeable cottage and brick suburb stay in the menu only for a saved town that already has some. */
export function legacyHomeHidden(s: GameState, id: BuildingId): boolean {
  // Retrofitting is an area action on grown homes now: the placeable Retrofitted homes stay only for a saved town that has them.
  if (id === 'greensuburb') return s.flags.zoning === 1 && !s.buildings.some((b) => b.type === 'greensuburb');
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
    // Water, wetland, beach and rock never show a zone (a tile that was flooded after it was zoned, or an odd save).
    if (!zonableKind(g.kind[i] ?? 0)) continue;
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
  if (kind === RETROFIT) return retrofitInfo(s, { x: tx, y: ty, w: 1, h: 1 });
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
  if (kind === RETROFIT) return retrofitInfo(s, rect);
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

/** The tooltip for the Retrofit homes tool over a tile or a dragged rectangle. */
export function retrofitInfo(s: GameState, rect: { x: number; y: number; w: number; h: number }): ZoneInfo {
  const plan = retrofitPlan(s, rect.x, rect.y, rect.w, rect.h);
  if (!plan.ok) return { html: plan.reason ?? 'Nothing to retrofit here', tone: 'bad', ok: false };
  const n = plan.uids.length;
  return { html: `<b>Retrofit ${n} home${n > 1 ? 's' : ''}</b> · <b>$${money(plan.cost)}k</b><br>Half the electricity, a quarter of the CO₂`, tone: 'ok', ok: true };
}

export interface ZoneInspect {
  /** Label and value rows for the Inspect panel. */
  rows: { k: string; v: string }[];
  /** Why this tile is waiting or declined, in plain words (empty when it is fine). */
  note: string;
  /** The next density up, if this is a home: the zone, what it costs ($k) and why it cannot be done yet (empty when it can). */
  upgrade: { zone: 2 | 3; label: string; cost: number; why: string } | null;
  /** A density upgrade has been paid for and swaps at the next growth tick. */
  pending: string;
}

/** What the Inspect panel says about a grown building: zone, density, built year, people and jobs, why it is blocked, and the density upgrade. */
export function inspectZone(s: GameState, b: PlacedBuilding): ZoneInspect | null {
  if (!b.grown) return null;
  const g = s.grid;
  const i = b.y * g.w + b.x;
  const z = zoneOfType(b.type);
  const d = BUILDINGS[b.type];
  const reason = zoneReasons(s)[i] ?? 0;
  const rows: { k: string; v: string }[] = [{ k: 'Zone', v: ZONE_NAME[z] }];
  const house = Math.round(d.housing * (b.empty ? 0 : 1));
  if (d.housing > 0) rows.push({ k: 'Homes for', v: b.empty ? 'nobody right now' : `up to ${house} people` });
  if (d.jobs > 0) rows.push({ k: 'Jobs', v: b.empty ? 'none right now' : String(d.jobs) });
  rows.push({ k: 'Built', v: String(b.builtYear) });
  if (b.upgrades?.includes('retrofit')) rows.push({ k: 'Retrofitted', v: 'half the electricity, a quarter of the CO₂' });
  const note = reason === REASON.empty ? reasonText(reason, z) : '';
  let upgrade: ZoneInspect['upgrade'] = null;
  let pending = '';
  const wanted = g.zoning[i] ?? z;
  if (familyOf(z) === 'res' && z < 3) {
    const to = (z + 1) as 2 | 3;
    const plan = zonePlan({ ...s, budget: 1e9 }, b.x, b.y, 1, 1, to);
    const unlocked = s.year >= ZONE_UNLOCK[to];
    upgrade = {
      zone: to,
      label: to === 2 ? 'Medium density (townhouses, 50 people)' : 'High density (flats, 120 people)',
      cost: plan.ok ? plan.cost : DENSITY_UPGRADE_COST,
      why: unlocked ? (plan.ok ? (s.budget < plan.cost ? `Not enough money: this costs ${money(plan.cost)}` : '') : plan.reason ?? '') : `${ZONE_NAME[to]} can be zoned from ${ZONE_UNLOCK[to]}`,
    };
    if (wanted > z) pending = `Upgrading to ${ZONE_NAME[wanted as 2 | 3].toLowerCase()}: it changes at the next growth tick.`;
  }
  return { rows, note, upgrade, pending };
}
