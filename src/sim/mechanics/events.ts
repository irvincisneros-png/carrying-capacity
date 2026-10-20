/**
 * Events that belong to one scenario. They only import the pure model files, so events.ts can include them without
 * an import cycle (hooks that emit story live in river.ts, reef.ts and so on).
 */
import { EVENT_TEXT } from '../../content/act2';
import type { EventCtx, EventDef } from '../events';
import { BUILDINGS } from '../buildings';
import { stageFromHealth } from '../restoration';
import { TileKind } from '../types';
import { clamp, clamp01, eventActive, flag, setFlag } from './flags';
import { cotsChance, seaRiseM, surgeHeightM, wouldFlood, wouldFloodBare } from './reefCore';
import { meanRiverWaterPollution, RIVER } from './riverCore';

const warm = (k: number, t: number): number => 1 + k * Math.max(0, t);

const algalBloom: EventDef = {
  type: 'algal-bloom', name: 'Blue-green algae bloom', stage: 'post', scenarios: ['river-town'],
  chance: (c: EventCtx) => {
    const s = c.state;
    const base = [0.28, 0.1, 0, 0.07][c.season] ?? 0;
    const nutrients = clamp01(meanRiverWaterPollution(s) / 0.9);
    const still = clamp01(1.3 - flag(s, 'w.envRatio', 1));
    const heat = 0.5 + 0.25 * clamp(s.tempC, 0, 2) + (eventActive(s, 'heatwave', c.idx) ? 0.4 : 0);
    return clamp(base * RIVER.bloomK * (0.15 + nutrients) * (0.2 + still) * heat * c.mult, 0, 0.7);
  },
  fire: (c, rng) => {
    const s = c.state;
    const sev = (0.5 + rng.next() * 0.8) * (0.7 + 0.3 * c.mult);
    setFlag(s, 'w.damage', clamp01(flag(s, 'w.damage') + 0.28 + 0.2 * sev));
    setFlag(s, 'w.blooms', flag(s, 'w.blooms') + 1);
    const cost = Math.min(s.budget, Math.round(6 + 8 * sev));
    s.budget -= cost;
    s.a2.stress += 4 + 4 * sev;
    return { severity: sev, text: EVENT_TEXT.algalBloom(sev), data: { cost } };
  },
};

const crownOfThorns: EventDef = {
  type: 'crown-of-thorns', name: 'Crown-of-thorns outbreak', stage: 'post', scenarios: ['reef-island'],
  chance: (c) => cotsChance(c.state, c.season) * Math.min(1.5, c.mult),
  fire: (c, rng) => {
    const s = c.state;
    const g = s.grid;
    const sev = (0.5 + rng.next() * 0.8) * (0.7 + 0.3 * c.mult);
    let before = 0, after = 0, n = 0;
    for (let i = 0; i < g.kind.length; i++) {
      if (g.kind[i] !== TileKind.Reef) continue;
      const loss = clamp(0.06 + 0.07 * sev, 0, 0.3);
      before += g.health[i] ?? 0;
      g.health[i] = (g.health[i] ?? 0) * (1 - loss);
      g.stage[i] = stageFromHealth(g.health[i] ?? 0);
      after += g.health[i] ?? 0;
      n++;
    }
    const pct = before > 0 ? Math.round((1 - after / before) * 100) : 0;
    setFlag(s, 'r.cots', 3);
    setFlag(s, 'r.outbreaks', flag(s, 'r.outbreaks') + 1);
    s.a2.stress += clamp(pct / 3, 1, 12);
    return { severity: sev, text: EVENT_TEXT.crownOfThorns(pct), data: { reefTiles: n, healthLostPct: pct } };
  },
};

/** Years at the start of Act 2 when a surge floods low homes without destroying them. */
export const SURGE_GRACE_YEARS = 2;

const stormSurge: EventDef = {
  type: 'storm-surge', name: 'Storm surge', stage: 'post', scenarios: ['reef-island'],
  chance: (c) => {
    const base = [0.04, 0.045, 0.007, 0.012][c.season] ?? 0;
    return clamp(base * warm(0.5, c.warming) * c.mult, 0, 0.9);
  },
  fire: (c, rng) => {
    const s = c.state;
    const g = s.grid;
    const sev = (0.5 + rng.next() * 0.8) * (0.7 + 0.3 * c.mult);
    const surge = surgeHeightM(sev);
    const damage = Math.min(s.budget, Math.round(10 + 30 * sev));
    s.budget -= damage;
    for (let i = 0; i < g.kind.length; i++) {
      const k = g.kind[i];
      if (k === TileKind.Reef || k === TileKind.Estuary || k === TileKind.Sea) g.waterPollution[i] = (g.waterPollution[i] ?? 0) + 0.07 * sev;
    }
    const homes = s.buildings.filter((b) => BUILDINGS[b.type].housing > 0);
    const saved = homes.filter((b) => wouldFloodBare(s, b, surge) && !wouldFlood(s, b, surge)).length;
    const flooded = homes.filter((b) => wouldFlood(s, b, surge)).sort((a, b) => a.uid - b.uid);
    // The first few years of Act 2 are a warning shot: low homes flood but can be repaired, giving the player time to
    // move people to higher ground before the goal starts counting losses.
    const grace = s.year < s.a2.startYear + SURGE_GRACE_YEARS;
    const warned = grace ? flooded.length : 0;
    const lostHomes = grace ? [] : flooded.slice(0, 2);
    for (const v of lostHomes) {
      for (let y = v.y; y < v.y + v.h; y++) for (let x = v.x; x < v.x + v.w; x++) g.building[y * g.w + x] = 0;
    }
    if (lostHomes.length > 0) {
      const gone = new Set(lostHomes.map((v) => v.uid));
      s.buildings = s.buildings.filter((b) => !gone.has(b.uid));
    }
    const lost = lostHomes.length;
    setFlag(s, 'r.homesLost', flag(s, 'r.homesLost') + lost);
    setFlag(s, 'r.surges', flag(s, 'r.surges') + 1);
    s.a2.stress += clamp(5 * sev + 6 * lost, 1, 30);
    return {
      severity: sev, text: EVENT_TEXT.stormSurge(surge + seaRiseM(s), damage, lost, saved, warned),
      data: { damage, homesLost: lost, surgeCm: Math.round(surge * 100) },
    };
  },
};

export const MECH_EVENTS: readonly EventDef[] = [algalBloom, crownOfThorns, stormSurge];
