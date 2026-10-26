import { describe, expect, it } from 'vitest';
import {
  addFreeRoad, advanceYear, applyAction, TileKind, BUILDINGS, buildReportCard, choose, cloneState, COUNCIL_FEE_EXPLAINER, createGame, growFee, decadeCost, dilemmasFor, footprintOf, getScenario, growthLine,
  landPerPerson, offerAct1, reasonTextFor, REASON, SCENARIO_IDS, townVoices, wordCount, zoneBlockers, ZONE,
} from '../src/sim';
import type { GameState, ScenarioId } from '../src/sim';
import { GLOSS_BY_ID } from '../src/content/glossary';
import { modelVariant, buildBuildingModel, ZONED_IDS, ZONED_VARIANTS } from '../src/render/models/buildings';
import { blockerLines, landStat } from '../src/ui/townzones';
import { zoneTileInfo } from '../src/ui/zonemenu';
import { addBuilding } from './helpers/fixtures';
import { grow } from './helpers/sprawl';
import { zoneArea } from './helpers/zoning';

const ACT1 = SCENARIO_IDS.filter((id) => getScenario(id).act1 !== undefined);

/** A town with this many grown homes on cleared land, so the zoning cards can be offered. */
function withHomes(id: ScenarioId, n: number, year = 1990): GameState {
  const s = cloneState(createGame(id));
  s.year = year;
  const g = s.grid;
  let placed = 0;
  for (let i = 0; i < g.kind.length && placed < n; i++) {
    if ((g.building[i] ?? 0) !== 0 || g.kind[i] !== 4) continue;
    const b = addBuilding(s, 'zres1', i % g.w, Math.floor(i / g.w));
    b.grown = true;
    placed++;
  }
  expect(placed).toBe(n);
  return s;
}

describe('land per person', () => {
  const sprawl = grow(false), compact = grow(true);

  it('is cleared land and street per resident, from the grid', () => {
    const l = landPerPerson(sprawl.s);
    expect(l.people).toBe(sprawl.s.population);
    expect(l.clearedTiles).toBeGreaterThan(0);
    expect(l.roadTiles).toBeGreaterThan(30);
    expect(l.clearedM2).toBe(Math.round((l.clearedTiles * 10000) / l.people));
    expect(l.roadM).toBe(Math.round((l.roadTiles * 100) / l.people));
    expect(landPerPerson({ ...sprawl.s, population: 0 }).clearedM2).toBe(0);
  });

  it('is higher for a sprawling town than for a compact one: more cleared land, more street, more ground under each home', () => {
    const a = landPerPerson(sprawl.s), b = landPerPerson(compact.s);
    expect(a.people).toBeGreaterThan(0);
    expect(b.people).toBeGreaterThan(0);
    expect(a.homeM2).toBeGreaterThan(b.homeM2 * 1.4);
    expect(a.roadM).toBeGreaterThan(b.roadM);
    expect(a.ratio).toBeGreaterThan(b.ratio);
  });

  it('shows in Town needs only once people live there, and its words match the numbers', () => {
    const empty = cloneState(createGame('green-valley'));
    expect(landStat(empty).show).toBe(false);
    const a = landStat(sprawl.s), b = landStat(compact.s);
    expect(a.show).toBe(true);
    expect(a.rows.map((r) => r.label)).toEqual(['Cleared land', 'Road', 'Ground under homes']);
    expect(a.rows[0]!.value).toMatch(/ m²$/);
    expect(a.rows[1]!.value).toMatch(/ m$/);
    expect(a.lesson).toMatch(/spread out|sprawl/i);
    expect(b.lesson).not.toMatch(/sprawl/i);
  });

  it('joins the decade ledger: the decade cost carries land and street per resident, before and after', () => {
    let s = cloneState(sprawl.s);
    const start = cloneState(s);
    for (let i = 0; i < 10; i++) s = advanceYear(s).state;
    const c = decadeCost(start, s, 0, undefined, { people: start.population, roadTiles: landPerPerson(start).roadTiles });
    expect(c.clearedM2After).toBe(landPerPerson(s).clearedM2);
    expect(c.roadMAfter).toBe(landPerPerson(s).roadM);
    expect(c.clearedM2Before).toBeGreaterThanOrEqual(0);
    expect(c.roadMBefore).toBeGreaterThan(0);
  });

  it('is on the report card as a footprint line that compares with a compact town', () => {
    const a = footprintOf(sprawl.s)!, b = footprintOf(compact.s)!;
    expect(a).not.toBeNull();
    expect(a.line).toMatch(/compact town/);
    expect(a.line).toMatch(/m² for each person/);
    expect('ABCD'.indexOf(a.grade)).toBeGreaterThan('ABCD'.indexOf(b.grade));
    expect(footprintOf(cloneState(createGame('green-valley')))).toBeNull();
    expect(buildReportCard(sprawl.s).footprint?.line).toBe(a.line);
  });
});

describe('the two zoning cards', () => {
  it('are in every scenario that has an Act 1, and in no other', () => {
    for (const id of SCENARIO_IDS) {
      const ids = dilemmasFor(id).map((d) => d.id);
      expect(ids.includes(`${id}-sprawl`), id).toBe(ACT1.includes(id));
      expect(ids.includes(`${id}-flats`), id).toBe(ACT1.includes(id));
    }
  });

  for (const id of ACT1) {
    const sprawl = dilemmasFor(id).find((d) => d.id === `${id}-sprawl`)!;
    const flats = dilemmasFor(id).find((d) => d.id === `${id}-flats`)!;

    it(`${id}: the sprawl card is money now against bush later, with a build-up alternative that costs more and the evidence behind it`, () => {
      expect(sprawl.title).toMatch(/Subdivide/);
      expect(sprawl.setup).toMatch(/subdivide the bushland/);
      const yes = sprawl.options.find((o) => o.id === 'subdivide')!, up = sprawl.options.find((o) => o.id === 'station')!;
      expect((yes.effects.budget ?? 0)).toBeGreaterThan(0);
      expect((yes.effects.clearBush ?? 0)).toBeGreaterThan(0);
      expect((up.effects.budget ?? 0)).toBeLessThan(0);
      expect(up.effects.clearBush ?? 0).toBe(0);
      expect(up.evidenceBacked).toBe(true);
      expect(yes.evidenceBacked).toBeFalsy();
      expect(sprawl.evidence).toMatch(/Newman and Kenworthy/);
      expect(sprawl.evidence).toMatch(/Trubka/);
      expect(sprawl.evidence).toMatch(/urban sprawl/);
      // Who wins and who loses: every option names both.
      for (const o of sprawl.options) { expect(o.preview.helps.length).toBeGreaterThan(0); expect(o.preview.hurts.length).toBeGreaterThan(0); }
    });

    it(`${id}: the flats card has no clean answer, no evidence-backed option, and names who wins and loses`, () => {
      expect(flats.title).toBe('Residents oppose flats next door');
      expect(flats.noCleanAnswer).toBe(true);
      expect(flats.options.some((o) => o.evidenceBacked)).toBe(false);
      expect(flats.options.length).toBe(3);
      for (const o of flats.options) { expect(o.preview.helps.length, o.id).toBeGreaterThan(0); expect(o.preview.hurts.length, o.id).toBeGreaterThan(0); }
      expect(flats.evidence).toMatch(/Newman and Kenworthy/);
      expect(flats.evidence).toMatch(/urban heat island/);
      expect(wordCount(flats.evidence)).toBeLessThanOrEqual(90);
    });

    it(`${id}: both cards wait for a few grown homes, then come up in their years`, () => {
      const quiet = cloneState(createGame(id));
      quiet.year = 1990;
      for (const d of dilemmasFor(id)) if (d.phase === 'act1' && !d.id.endsWith('-sprawl') && !d.id.endsWith('-flats')) quiet.dilemmas.offered[d.id] = 1900;
      offerAct1(quiet);
      expect(quiet.dilemmas.pending, 'no homes yet').toEqual([]);
      const town = withHomes(id, 7, 1990);
      for (const d of dilemmasFor(id)) if (d.phase === 'act1' && !d.id.endsWith('-sprawl') && !d.id.endsWith('-flats')) town.dilemmas.offered[d.id] = 1900;
      offerAct1(town);
      expect(town.dilemmas.pending).toEqual([`${id}-sprawl`]);
      const later = withHomes(id, 9, 2010);
      for (const d of dilemmasFor(id)) if (d.phase === 'act1' && d.id !== `${id}-flats`) later.dilemmas.offered[d.id] = 1900;
      offerAct1(later);
      expect(later.dilemmas.pending).toEqual([`${id}-flats`]);
    });

    it(`${id}: subdividing clears bush and adds sprawl CO2; building up near the station keeps the bush`, () => {
      const mk = (opt: string): GameState => {
        const s = withHomes(id, 9, 1990);
        s.budget = 200;
        s.dilemmas.offered[sprawl.id] = 1990;
        s.dilemmas.pending.push(sprawl.id);
        return choose(s, sprawl.id, opt).state;
      };
      const bush = (s: GameState): number => s.grid.kind.reduce((n, k) => n + (k === 5 ? 1 : 0), 0);
      const base = bush(withHomes(id, 9, 1990));
      const yes = mk('subdivide'), up = mk('station');
      if (base > 0) expect(bush(yes)).toBeLessThan(bush(up));
      expect(up.budget).toBeLessThan(yes.budget);
      expect(yes.flags['sprawl.ridge']).toBe(1);
      expect(up.flags['sprawl.compact']).toBe(1);
      expect(up.dilemmas.decisions.at(-1)?.evidenceBacked).toBe(true);
    });
  }
});

describe('the yearly growth line in the Log', () => {
  function grownYear(): { before: GameState; after: GameState } {
    const { s } = grow(true);
    const before = cloneState(s);
    return { before, after: advanceYear(s).state };
  }

  it('is one calm sentence a year, about what grew and why, kept out of Town voices', () => {
    // Open land, a street, jobs and power, and a strip of low-density homes: the first years of growth.
    let s = cloneState(createGame('green-valley'));
    const g = s.grid;
    g.kind.fill(TileKind.Land);
    g.elevation.fill(1);
    g.building.fill(0); g.zoning.fill(0); g.zone.fill(0); g.significant.fill(0);
    g.airPollution.fill(0); g.waterPollution.fill(0); g.soilContamination.fill(0);
    s.buildings = []; s.nextUid = 1;
    for (const k of Object.keys(s.flags)) if (k.startsWith('road.entrance')) delete s.flags[k];
    s.year = 1960; s.budget = 5000; s.population = 0;
    for (let x = 0; x <= 19; x++) addFreeRoad(s, 10 * g.w + x);
    s.flags['road.entrance'] = 10 * g.w;
    for (const x of [4, 7]) addBuilding(s, 'factory', x, 11);
    addBuilding(s, 'coalpower', 14, 11);
    s = zoneArea(s, { x: 0, y: 8, w: 12, h: 2 }, ZONE.rlow);
    let line = '';
    for (let i = 0; i < 12 && !line; i++) {
      const n = s.eventLog.length;
      s = advanceYear(s).state;
      line = s.eventLog.slice(n).find((e) => e.story?.channel === 'growth')?.text ?? '';
    }
    expect(line, 'a year with growth has a line').not.toBe('');
    {
      expect(line).toMatch(/^\d+ (home|homes|shop|shops|workshop|workshops) grew (near|along) .+ (because jobs were waiting|because more people had moved in|to serve the factories and the port)\./);
      expect(townVoices(s, 50).some((e) => e.story?.channel === 'growth')).toBe(false);
      expect(wordCount(line)).toBeLessThanOrEqual(40);
    }
  });

  it('says the reason in plain words for each kind of building', () => {
    const { s } = grow(true);
    const mk = (type: 'zres1' | 'zcom' | 'zind', n: number) => Array.from({ length: n }, (_, k) => ({ uid: 9000 + k, type, x: 8 + k, y: 14, rotation: 0 as const, w: 1, h: 1, builtYear: 1970, grown: true }));
    expect(growthLine(s, mk('zres1', 14))).toMatch(/^14 homes grew .* because jobs were waiting\.$/);
    expect(growthLine(s, mk('zres1', 1))).toMatch(/^1 home grew /);
    expect(growthLine(s, mk('zcom', 3))).toMatch(/^3 shops grew .* because more people had moved in\.$/);
    expect(growthLine(s, mk('zind', 2))).toMatch(/^2 workshops grew .* to serve the factories and the port\.$/);
  });

  it('is deterministic: the same actions give the same lines', () => {
    const a = grownYear().after, b = grownYear().after;
    expect(a.eventLog.map((e) => e.text)).toEqual(b.eventLog.map((e) => e.text));
  });
});

describe('blocked reasons and the council fee', () => {
  it('explains "Waiting for money" with the fee and the budget, in the hover text and in Town needs', () => {
    let { s } = grow(false);
    s = cloneState(s);
    s = zoneArea(s, { x: 7, y: 12, w: 6, h: 2 }, ZONE.rlow);
    s.budget = 0.1;
    // Jobs without homes, so demand is there: the only thing missing is the council's money.
    const text = reasonTextFor(s, REASON.noMoney, ZONE.rlow);
    expect(text).toMatch(/Waiting for money/);
    expect(text).toContain(`$${Math.round(growFee(s, 'zres1') * 10) / 10}k`);
    expect(text).toMatch(/street, pipes and wires/);
    expect(text).toMatch(/budget has \$0\.1k/);
    expect(COUNCIL_FEE_EXPLAINER).toMatch(/council pays/);
    // Other reasons keep their plain text.
    expect(reasonTextFor(s, REASON.noPower, ZONE.rlow)).toMatch(/Waiting for power/);
  });

  it('lists one Town needs line for each reason a zoned tile is waiting, with tiles to Locate', () => {
    let s = cloneState(grow(false).s);
    s = zoneArea(s, { x: 7, y: 12, w: 6, h: 2 }, ZONE.rlow);
    s.budget = 0;
    const lines = blockerLines(s);
    const blockers = zoneBlockers(s);
    expect(lines.length).toBe(blockers.length);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.text).toMatch(/^\d+ zoned tiles?\. /);
      expect(l.tiles.length).toBeGreaterThan(0);
      expect(l.tiles.length).toBeLessThanOrEqual(l.count);
    }
    // The hover over a waiting tile uses the same words.
    const first = blockers[0]!;
    const i = first.tiles[0]!;
    const info = zoneTileInfo(s, i % s.grid.w, Math.floor(i / s.grid.w), 0);
    expect(info.html).toContain(reasonTextFor(s, first.code, first.zone).split(':')[0]!);
  });
});

describe('field guide and teacher notes', () => {
  it('has urban sprawl, density and urban heat island, in plain words', () => {
    for (const id of ['urban-sprawl', 'density', 'urban-heat-island']) {
      const t = GLOSS_BY_ID[id]!;
      expect(t, id).toBeTruthy();
      expect(wordCount(t.def)).toBeLessThanOrEqual(45);
    }
    expect(new RegExp(GLOSS_BY_ID['urban-sprawl']!.match, 'i').test('urban sprawl')).toBe(true);
    expect(new RegExp(GLOSS_BY_ID['density']!.match, 'i').test('Low density homes')).toBe(true);
    expect(new RegExp(GLOSS_BY_ID['urban-heat-island']!.match, 'i').test('the urban heat island')).toBe(true);
  });
});

describe('era variants of grown buildings', () => {
  it('pick the older look before the era change and the newer one after, with a mirrored twin of each', () => {
    const cut: Record<string, number> = { zres1: 1950, zres2: 1990, zres3: 2000, zcom: 1980 };
    for (const [type, year] of Object.entries(cut)) {
      const before = modelVariant(type as never, year - 1, 7), after = modelVariant(type as never, year, 7);
      expect(before & 1, `${type} before ${year}`).toBe(0);
      expect(after & 1, `${type} from ${year}`).toBe(1);
    }
    // Light industry has no era change; the mirror bit comes from the uid.
    expect(modelVariant('zind', 1900, 3) & 1).toBe(0);
    expect(modelVariant('zind', 2020, 3) & 1).toBe(0);
    const mirrors = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((u) => modelVariant('zres1', 1960, u) & 2));
    expect(mirrors.size).toBe(2);
  });

  it('build for every type, variant and quality tier, and Very low is far lighter than the full model', () => {
    for (const id of ZONED_IDS) {
      for (let v = 0; v < ZONED_VARIANTS; v++) {
        const full = buildBuildingModel(id as never, 1, 0, v), lite = buildBuildingModel(id as never, 0, 0.35, v);
        const tris = (m: ReturnType<typeof buildBuildingModel>): number => (m.geo.index ? m.geo.index.count : m.geo.attributes.position!.count) / 3;
        expect(tris(lite), `${id}:${v} lite`).toBeGreaterThan(8);
        expect(tris(lite), `${id}:${v} lite`).toBeLessThanOrEqual(24);
        expect(tris(full), `${id}:${v} full`).toBeGreaterThan(tris(lite) * 5);
      }
    }
  });

  it('give every grown type a building definition so the economy, grid and road code see them', () => {
    for (const id of ZONED_IDS) expect(BUILDINGS[id].name.length).toBeGreaterThan(3);
    expect(applyAction).toBeTypeOf('function');
  });
});
