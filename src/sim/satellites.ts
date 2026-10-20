/**
 * Satellites: a ground station plus overlay subscriptions (sea-surface temperature, sea level, forest cover,
 * fire fuel / scars). With the sea-surface overlay, a marine heatwave gives one season's warning before it
 * lands, and the player can act ({type:'mitigate'}) to cut runoff and shrink the coral damage.
 */
import { BUILDINGS } from './buildings';
import { cloneState } from './state';
import { emitStory } from './story';
import { TileKind } from './types';
import type { MarineWarning, SatelliteState } from './layerTypes';
import type { ActionFailCode, ActionResult, GameState, SatelliteOverlay } from './types';
import { noteAction } from './residents';

export const SATELLITE_OVERLAYS: readonly SatelliteOverlay[] = ['sst', 'sealevel', 'forest', 'fire'];

export const OVERLAY_INFO: Readonly<Record<SatelliteOverlay, { name: string; cost: number; blurb: string }>> = {
  sst: {
    name: 'Sea-surface temperature', cost: 30,
    blurb: 'Satellites measure how warm the top of the ocean is. Warm patches that stay for weeks can bleach coral, and the data gives a few weeks\' warning.',
  },
  sealevel: {
    name: 'Sea level', cost: 25,
    blurb: 'Radar satellites measure the height of the sea surface to within centimetres, showing which low-lying streets will be flooded first.',
  },
  forest: {
    name: 'Forest cover', cost: 20,
    blurb: 'Images taken every few days show where bush is thick, thinning or growing back, so restoration can be checked from space.',
  },
  fire: {
    name: 'Fire fuel and scars', cost: 30,
    blurb: 'Satellites map how much dry fuel is on the ground and where fires have burnt, so crews know where the next fire could be worst.',
  },
};

export const MITIGATION = { cost: 20, runoffMult: 0.8, lossMult: 0.45 };

export function emptySatellites(): SatelliteState {
  return {
    overlays: { sst: false, sealevel: false, forest: false, fire: false },
    warning: null, warningsGiven: 0, mitigations: 0, savedPct: 0,
  };
}

const fail = (state: GameState, code: ActionFailCode, reason: string): { state: GameState; result: ActionResult } => ({
  state, result: { ok: false, code, reason },
});

export function hasOverlay(s: GameState, o: SatelliteOverlay): boolean {
  return s.satellites.overlays[o] === true;
}

export function hasGroundStation(s: GameState): boolean {
  return s.buildings.some((b) => BUILDINGS[b.type].groundStation === true);
}

export function subscribe(state: GameState, overlay: SatelliteOverlay): { state: GameState; result: ActionResult } {
  const info = OVERLAY_INFO[overlay];
  if (!info) return fail(state, 'invalid', 'Unknown overlay');
  if (state.phase !== 'act2') return fail(state, 'not-open', 'Satellite data is part of the transition');
  if (hasOverlay(state, overlay)) return fail(state, 'already-done', 'You already have this overlay');
  if (!hasGroundStation(state)) return fail(state, 'not-open', 'Build a satellite ground station first so the data has somewhere to land');
  if (state.budget < info.cost) return fail(state, 'no-funds', `Not enough money: this costs ${info.cost}`);
  const s = cloneState(state);
  s.budget -= info.cost;
  s.satellites.overlays[overlay] = true;
  s.flags[`sat.${overlay}`] = true;
  noteAction(s, `subscribed.${overlay}`);
  emitStory(s, `${info.name} overlay switched on. ${info.blurb}`, { channel: 'satellite', ref: overlay, tone: 'neutral' }, 0.3);
  s.version = state.version + 1;
  return { state: s, result: { ok: true, spent: info.cost } };
}

/** Cut runoff before a warned marine heatwave arrives: less pollution on the water, and the coral copes better. */
export function mitigate(state: GameState): { state: GameState; result: ActionResult } {
  const w = state.satellites.warning;
  if (!w) return fail(state, 'not-open', 'There is no early warning to act on');
  if (w.mitigated) return fail(state, 'already-done', 'You have already acted on this warning');
  if (state.budget < MITIGATION.cost) return fail(state, 'no-funds', `Not enough money: this costs ${MITIGATION.cost}`);
  const s = cloneState(state);
  s.budget -= MITIGATION.cost;
  const g = s.grid;
  for (let i = 0; i < g.kind.length; i++) {
    const k = g.kind[i];
    if (k === TileKind.Reef || k === TileKind.Sea || k === TileKind.Estuary || k === TileKind.River) {
      g.waterPollution[i] = (g.waterPollution[i] ?? 0) * MITIGATION.runoffMult;
    }
  }
  (s.satellites.warning as MarineWarning).mitigated = true;
  s.satellites.mitigations++;
  noteAction(s, 'mitigated');
  emitStory(s, 'Crews cleared drains, covered bare ground and held back sewage overflow to cut the runoff reaching the reef before the hot water arrives.', {
    channel: 'satellite', ref: 'mitigate', tone: 'warm',
  }, 0.4);
  s.version = state.version + 1;
  return { state: s, result: { ok: true, spent: MITIGATION.cost } };
}

/** Per-tile data (0..1) for an overlay, for the renderer. Works whether or not it has been bought; the UI gates it. */
export function overlayData(s: GameState, overlay: SatelliteOverlay): Float32Array {
  const g = s.grid;
  const out = new Float32Array(g.kind.length);
  const hot = s.satellites.warning ? 0.25 : 0;
  for (let i = 0; i < out.length; i++) {
    const k = g.kind[i];
    const x = i % g.w;
    switch (overlay) {
      case 'sst':
        if (k === TileKind.Sea || k === TileKind.Reef) {
          out[i] = Math.min(1, Math.max(0, 0.15 + s.tempC / 3.2 + hot + (x / g.w) * 0.1 + 0.05 * (g.waterPollution[i] ?? 0)));
        }
        break;
      case 'sealevel': {
        if (k === TileKind.Land || k === TileKind.Beach || k === TileKind.Estuary || k === TileKind.Bush) {
          const low = Math.max(0, 2 - (g.elevation[i] ?? 0)) / 2;
          out[i] = Math.min(1, low * (0.35 + 0.25 * Math.max(0, s.tempC)));
        }
        break;
      }
      case 'forest':
        if (k === TileKind.Land || k === TileKind.Bush || k === TileKind.Beach || k === TileKind.Estuary) out[i] = g.health[i] ?? 0;
        break;
      case 'fire':
        if ((k === TileKind.Land || k === TileKind.Bush) && (g.building[i] ?? 0) === 0) out[i] = Math.min(1, ((g.stage[i] ?? 0) / 3) * (1 - 0.5 * Math.min(1, Number(s.flags.culturalBurning ?? 0))));
        break;
    }
  }
  return out;
}
