// The zoning parts of the Town needs drawer: "Land per person" (the sprawl lesson in numbers) and one line for each reason a zoned
// tile is waiting, with a Locate button. The words are pure functions of the game state so they can be tested; the class only draws them.
import { landPerPerson } from '../sim/ledger';
import { COUNCIL_FEE_EXPLAINER, REASON, familyOf, reasonTextFor, zoneBlockers } from '../sim/zoning';
import type { GameState } from '../sim/types';
import { UI_ICONS } from './icons';
import { fmtInt, h, svg } from './dom';

export interface LandRow { label: string; value: string; note?: string }
export interface LandStat {
  /** The town has people to measure (otherwise the block stays hidden). */
  show: boolean;
  rows: LandRow[];
  /** One plain-words line that says what the numbers mean. */
  lesson: string;
}

/** "Land per person": cleared land, road and the ground under homes for each resident, against a compact town. */
export function landStat(s: GameState): LandStat {
  const l = landPerPerson(s);
  if (l.people <= 0 || (l.clearedTiles <= 0 && l.roadTiles <= 0 && l.homeTiles <= 0)) return { show: false, rows: [], lesson: '' };
  const rows: LandRow[] = [
    { label: 'Cleared land', value: `${fmtInt(l.clearedM2)} m²`, note: 'bush cleared, for each resident' },
    { label: 'Road', value: `${fmtInt(l.roadM)} m`, note: 'of street for each resident' },
  ];
  if (l.homeTiles > 0) rows.push({ label: 'Ground under homes', value: `${fmtInt(l.homeM2)} m²`, note: `a compact town of townhouses needs about ${fmtInt(l.compactHomeM2)} m²` });
  const lesson = l.homeTiles <= 0 ? ''
    : l.ratio > 2.2 ? 'Your homes are spread out (low density, urban sprawl). That means more bush cleared, more street to build and mend, and longer drives.'
      : l.ratio > 1.4 ? 'A mix of home sizes. Townhouses and flats near the shops would save more land for each person.'
        : 'Compact: your homes use little land for each person, so more bush and more street are left for other things.';
  return { show: true, rows, lesson };
}

export interface BlockerLine { key: string; count: number; text: string; tiles: number[]; fee: boolean }

/** One line for each reason zoned tiles are waiting ("3 zoned tiles are waiting for power"), with a few tiles to Locate. */
export function blockerLines(s: GameState): BlockerLine[] {
  if (s.phase !== 'act1' && s.phase !== 'act2') return [];
  return zoneBlockers(s).map((b) => {
    const n = b.count;
    const unit = n === 1 ? '1 zoned tile' : `${n} zoned tiles`;
    return {
      key: `${b.code}:${familyOf(b.zone)}`,
      count: n,
      text: `${unit}. ${reasonTextFor(s, b.code, b.zone)}`,
      tiles: b.tiles,
      fee: b.code === REASON.noMoney,
    };
  });
}

/** The zoning block inside Town needs. `locate` pans the camera to a tile index. */
export class ZoneNeeds {
  readonly el: HTMLElement;
  private land: HTMLElement;
  private blocks: HTMLElement;
  private idx = new Map<string, number>();
  private sig = '';

  constructor(private locate: (tile: number) => void) {
    this.land = h('div', { class: 'landstat hidden', 'data-qa': 'land-per-person' });
    this.blocks = h('div', { class: 'zwait hidden', 'data-qa': 'zone-waiting' });
    this.el = h('div', { class: 'zoneneeds' }, this.land, this.blocks);
  }

  update(s: GameState): void {
    const live = s.phase === 'act1' || s.phase === 'act2';
    const stat = live ? landStat(s) : { show: false, rows: [] as LandRow[], lesson: '' };
    const lines = live ? blockerLines(s) : [];
    const sig = JSON.stringify([stat, lines.map((l) => [l.key, l.count, l.text])]);
    if (sig === this.sig) return;
    this.sig = sig;
    this.land.classList.toggle('hidden', !stat.show);
    this.land.replaceChildren(...(stat.show ? [
      h('h4', null, 'Land per person'),
      ...stat.rows.map((r) => h('div', { class: 'ls-row' }, h('span', null, r.label), h('b', null, r.value), r.note ? h('em', null, r.note) : null)),
      h('p', { class: 'muted ls-lesson' }, stat.lesson),
    ] : []));
    this.blocks.classList.toggle('hidden', lines.length === 0);
    this.blocks.replaceChildren(...(lines.length ? [
      h('h4', null, 'Zones waiting'),
      ...lines.map((l) => h('div', { class: 'zw-row', title: l.fee ? COUNCIL_FEE_EXPLAINER : undefined },
        h('span', null, l.text),
        h('button', { class: 'btn small', type: 'button', title: 'Pan the camera to one of these tiles', onclick: () => this.go(l) }, svg(UI_ICONS.target), 'Locate'))),
    ] : []));
  }

  private go(l: BlockerLine): void {
    if (!l.tiles.length) return;
    const n = ((this.idx.get(l.key) ?? -1) + 1) % l.tiles.length;
    this.idx.set(l.key, n);
    this.locate(l.tiles[n]!);
  }
}
