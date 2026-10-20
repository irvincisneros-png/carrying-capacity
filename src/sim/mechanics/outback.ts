/** Red Dirt hooks: the water budget, and the yearly sign-off of rehabilitated mine ground. */
import { getScenario } from '../scenarios';
import { seasonWeather } from '../season';
import { emitStory } from '../story';
import { TileKind } from '../types';
import type { GameState } from '../types';
import { addFlag, clamp, clamp01, eventActive, flag, setFlag } from './flags';
import {
  boreCount, minesOpen, OUTBACK, siteTiles, storageCapacity, townWaterDemand,
} from './outbackCore';
import { policyValue } from '../policyCore';

export function outbackBegin(s: GameState): void {
  setFlag(s, 'o.aq', OUTBACK.startAquifer);
  setFlag(s, 'o.wh', 0.6);
  setFlag(s, 'o.store', storageCapacity(s) * 0.5);
}

export function outbackSeason(s: GameState, idx: number): void {
  const season = s.a2.season;
  const sc = getScenario(s.scenarioId);
  const w = seasonWeather(s.seed, idx);
  const drought = eventActive(s, 'drought', idx);
  const rainIdx = (w.rain * sc.act2.rainfall) / 0.6 * (drought ? 0.3 : 1);
  const wh = clamp01(0.7 * flag(s, 'o.wh', 0.6) + 0.3 * clamp01(rainIdx * 0.8));
  setFlag(s, 'o.wh', wh);
  let aq = flag(s, 'o.aq', OUTBACK.startAquifer) + OUTBACK.recharge * rainIdx * (drought ? 0.6 : 1);
  const restrict = policyValue(s, 'water.restrict');
  const dem = townWaterDemand(s, season, restrict);
  const cap = storageCapacity(s);
  let store = Math.min(cap, flag(s, 'o.store', cap * 0.5)) * 0.96;
  const holeSupply = OUTBACK.waterholeSupply * wh;
  let need = dem;
  const fromHole = Math.min(need, holeSupply);
  need -= fromHole;
  store = Math.min(cap, store + Math.max(0, holeSupply - fromHole));
  const fromStore = Math.min(need, store);
  store -= fromStore;
  need -= fromStore;
  const boreCap = aq > 0 ? boreCount(s) * OUTBACK.boreSupply : 0;
  const fromBore = Math.min(need, boreCap);
  need -= fromBore;
  aq = clamp(aq - fromBore * OUTBACK.drawPerUnit, 0, 100);
  setFlag(s, 'o.aq', aq);
  setFlag(s, 'o.store', store);
  setFlag(s, 'o.demand', dem);
  setFlag(s, 'o.short', dem > 0 ? need / dem : 0);
  const fail = dem > 0 && dem - need < dem * OUTBACK.failBelow;
  if (restrict > 0) s.a2.stress += 1.2 * restrict;
  if (fail) {
    if (s.year >= OUTBACK.failFromYear) addFlag(s, 'o.waterFail', 1);
    addFlag(s, 'o.waterFailAll', 1);
    s.a2.stress += 7;
    if (flag(s, 'o.lastFailSeason', -9) < idx - 2) {
      emitStory(s, `Water emergency: the waterhole is down to mud and the bores cannot keep up. The town is on tanker water, schools are asking children to bring bottles, and the mine has been told to cut its use.`, {
        channel: 'town', tone: 'concern',
      }, 0.75);
    }
    setFlag(s, 'o.lastFailSeason', idx);
  }
}

/** Year end: seeded mine ground that has grown well for long enough is signed off with the Traditional Owners. */
export function outbackYear(s: GameState): void {
  const g = s.grid;
  const partnership = s.country.partnership;
  let newly = 0;
  for (let i = 0; i < g.zone.length; i++) {
    const z = g.zone[i] ?? 0;
    if (z < 100 || z >= OUTBACK.signedZone) continue;
    const seededYear = 2000 + (z - 100);
    if (s.year - seededYear < OUTBACK.monitorYears) continue;
    if (g.kind[i] === TileKind.Pit) continue;
    const ok = (g.stage[i] ?? 0) >= 1 && (g.health[i] ?? 0) >= OUTBACK.signoffHealth && g.weed[i] === 0 && (g.soilContamination[i] ?? 0) <= 0.5;
    if (ok && partnership >= OUTBACK.signoffPartnership) {
      g.zone[i] = OUTBACK.signedZone;
      newly++;
    }
  }
  if (newly > 0) {
    emitStory(s, `Monitoring found ${newly} more ${newly === 1 ? 'tile' : 'tiles'} of the old mine ground growing well, with the soil safe and weeds under control. Traditional Owners and the rehabilitation crew signed ${newly === 1 ? 'it' : 'them'} off together.`, {
      channel: 'country', tone: 'joy', needsConsultation: true,
    }, 0.5);
  }
  if (minesOpen(s) === 0) {
    setFlag(s, 'o.mineClosedYear', flag(s, 'o.mineClosedYear', s.year));
    // Every mine posts a bond so the ground can be put right. When the last mine closes, the bond is released to the town.
    const total = siteTiles(s).total;
    if (flag(s, 'o.bond') === 0 && total > 0) {
      const bond = Math.round(total * OUTBACK.bondPerTile);
      s.budget += bond;
      setFlag(s, 'o.bond', bond);
      emitStory(s, `The last mine has closed, and its rehabilitation bond of ${bond} has been released to the town. It is set aside for putting the ground right: reshape, topsoil, seed, monitor.`, {
        channel: 'town', tone: 'neutral',
      }, 0.6);
    }
  }
}
