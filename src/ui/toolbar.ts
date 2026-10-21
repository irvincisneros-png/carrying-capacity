// Bottom build dock: category tabs + building cards (icon, name, cost, unlock year), tools (inspect, demolish,
// clear bush), hover tooltips with the building's numbers.
import { BUILDINGS, BUILDING_IDS } from '../sim/buildings';
import { availability } from '../sim/rules';
import { getScenario } from '../sim/scenarios';
import { cutPerBuild } from '../sim/outlook';
import type { BuildingId, GameState } from '../sim/types';
import { hideDraft, NEUTRAL_COMMUNITY } from './draft';
import { clear, h, svg } from './dom';
import { bIcon, UI_ICONS } from './icons';
import type { Tip } from './modal';
import { sfx } from '../audio/sfx';

/**
 * Buildings that drag-paint (hold the mouse and sweep). The number is the spacing in tiles between pieces in one stroke: 1 means
 * every tile (street trees, rooftop panels, homes, seawall, crossings); more means the pieces that do their work over a distance
 * (a native plant nursery reaches 5 tiles, a coral nursery 4, a wetland and a phytoremediation bed filter what is beside them).
 */
export const BRUSH_SPACING: Partial<Record<BuildingId, number>> = {
  cottage: 1, rooftopsolar: 1, parkland: 1, seawall: 1, wildlifecrossing: 1,
  nursery: 7, coralnursery: 6, wetland: 4, phytoremediation: 4,
};

export type UtilTool = 'demolish' | 'clear' | 'inspect' | 'comanage' | 'burn' | 'dispose' | 'rehab';
export type Tool = BuildingId | UtilTool | null;
export const UTIL_TOOLS: readonly string[] = ['demolish', 'clear', 'inspect', 'comanage', 'burn', 'dispose', 'rehab'];

interface Cat { id: string; name: string; icon: string; ids: BuildingId[] }

const CATS: Cat[] = [
  { id: 'homes', name: 'Homes', icon: UI_ICONS.people, ids: ['cottage', 'suburb', 'rooftopsolar', 'greensuburb'] },
  { id: 'work', name: 'Industry', icon: bIcon('factory'), ids: ['farm', 'dripfarm', 'coalmine', 'factory', 'steelworks', 'resort'] },
  { id: 'move', name: 'Transport', icon: bIcon('road'), ids: ['road', 'rail', 'port', 'carpark', 'transitline'] },
  { id: 'energy', name: 'Energy', icon: UI_ICONS.bolt, ids: ['coalpower', 'gaspower', 'solarfarm', 'windfarm', 'offshorewind', 'hydro', 'pumpedhydro', 'battery', 'tidal'] },
  { id: 'waste', name: 'Waste & water', icon: bIcon('landfill'), ids: ['landfill', 'outfall', 'sewagetreatment', 'reservoir', 'bore', 'seawall', 'fishway'] },
  { id: 'restore', name: 'Restore', icon: UI_ICONS.sprout, ids: ['nursery', 'phytoremediation', 'wetland', 'excavation', 'wildlifecrossing', 'coralnursery', 'parkland', 'coolingcentre', 'groundstation'] },
];

const POWER_LABEL = (p: number, energy: boolean): string => (energy ? `+${p} power` : p < 0 ? `uses ${-p} power` : '');

export class Toolbar {
  el: HTMLElement;
  private tabsEl: HTMLElement;
  private toolsEl: HTMLElement;
  private cat = 'homes';
  tool: Tool = null;
  private cards = new Map<string, HTMLButtonElement>();
  private state: GameState | null = null;
  private sig = '';
  private seen = new Set<string>();
  onTool: ((t: Tool) => void) | null = null;
  countryOn: ((s: GameState) => boolean) | null = null;

  constructor(private tip: Tip) {
    this.tabsEl = h('div', { class: 'tabs panel', role: 'tablist' });
    this.toolsEl = h('div', { class: 'tools panel' });
    this.el = h('div', { class: 'dock' }, this.tabsEl, this.toolsEl);
    this.toolsEl.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        this.toolsEl.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });
  }

  private visibleIds(s: GameState): BuildingId[] {
    const phase = s.phase === 'act2' ? 'act2' : 'act1';
    const sc = getScenario(s.scenarioId);
    return BUILDING_IDS.filter((id) => {
      const d = BUILDINGS[id];
      if (d.phases && !d.phases.includes(phase)) return false;
      if ((d as { repurposeOnly?: boolean }).repurposeOnly) return false;
      if (availability(s.scenarioId, id).disabled) return false;
      if (d.requiresFeature && !sc.act2.features[d.requiresFeature]) return false;
      return true;
    });
  }

  update(s: GameState): void {
    this.state = s;
    const ids = this.visibleIds(s);
    const cats = CATS.filter((c) => c.ids.some((id) => ids.includes(id)));
    if (!cats.some((c) => c.id === this.cat)) this.cat = cats[0]?.id ?? 'homes';
    const sig = `${s.phase}|${this.cat}|${ids.join(',')}|${s.circular?.unlocked}|${s.country?.unlocked.culturalBurning}`;
    if (sig !== this.sig) {
      this.sig = sig;
      clear(this.tabsEl);
      for (const c of cats) {
        const start = getScenario(s.scenarioId).startYear;
        const newOnes = c.ids.some((id) => ids.includes(id) && availability(s.scenarioId, id).unlock > start && s.year >= availability(s.scenarioId, id).unlock && !this.seen.has(id));
        this.tabsEl.appendChild(h('button', {
          class: `tab ${c.id === this.cat ? 'on' : ''}`, role: 'tab', 'aria-selected': c.id === this.cat ? 'true' : 'false',
          onclick: () => { sfx('click'); this.cat = c.id; this.sig = ''; if (this.state) this.update(this.state); },
        }, svg(c.icon), h('span', { class: 't' }, c.name), newOnes && c.id !== this.cat ? h('span', { class: 'badge hard', style: 'padding:2px 5px;font-size:9px' }, 'new') : null));
      }
      clear(this.toolsEl);
      this.cards.clear();
      const cat = cats.find((c) => c.id === this.cat);
      let n = 1;
      for (const id of cat?.ids ?? []) {
        if (!ids.includes(id)) continue;
        const d = BUILDINGS[id];
        const av0 = availability(s.scenarioId, id);
        const label = av0.name ?? d.name;
        const card = h('button', { class: 'tool', 'aria-label': label, onclick: () => this.select(this.tool === id ? null : id) },
          h('span', { class: 'key' }, String(n++)),
          svg(bIcon(id)), h('span', { class: 'nm' }, label !== d.name ? label : shortName(id)), h('span', { class: 'cost' }, '$0'));
        card.addEventListener('pointerenter', () => this.showTip(id, card));
        card.addEventListener('pointerleave', () => this.tip.hide());
        card.addEventListener('focus', () => this.showTip(id, card));
        card.addEventListener('blur', () => this.tip.hide());
        this.cards.set(id, card);
        this.toolsEl.appendChild(card);
      }
      // utility tools
      const util = (key: UtilTool, label: string, icon: string, hint: string): void => {
        const b = h('button', { class: 'tool util', 'aria-label': label, onclick: () => this.select(this.tool === key ? null : key) }, svg(icon), h('span', { class: 'nm' }, label));
        b.addEventListener('pointerenter', () => { const r = b.getBoundingClientRect(); this.tip.show(r.left + r.width / 2, r.top, `<b>${label}</b><br>${hint}`); });
        b.addEventListener('pointerleave', () => this.tip.hide());
        this.cards.set(key, b);
        this.toolsEl.appendChild(b);
      };
      util('inspect', 'Inspect', UI_ICONS.info, 'Click a tile to see what is there. Shortcut: <kbd>I</kbd>');
      util('demolish', 'Demolish', UI_ICONS.demolish, 'Knock a building down (refunds 25%). Shortcut: <kbd>X</kbd>');
      if (s.phase === 'act2' && (getScenario(s.scenarioId).mechanics ?? []).includes('outback')) util('rehab', 'Rehab mine', UI_ICONS.sprout, 'Rehabilitate the old mine pit in three steps: reshape, topsoil, seed the pit' + (hideDraft() ? ' (with the local community).' : ' with the Traditional Owners.'));
      if (s.phase === 'act2' && s.circular?.unlocked) util('dispose', 'Old sites', UI_ICONS.demolish, 'Choose a future for an old Act 1 building: repurpose, recycle or landfill. Shortcut: <kbd>O</kbd>');
      if (s.phase === 'act2' && this.countryOn?.(s)) util('comanage', 'Co-manage', UI_ICONS.sprout, hideDraft() ? NEUTRAL_COMMUNITY + '.' : 'Return a patch of bushland to shared care with the Traditional Owners.');
      if (s.phase === 'act2' && s.country?.unlocked.culturalBurning) util('burn', hideDraft() ? 'Planned burn' : 'Cool burn', UI_ICONS.fire, hideDraft() ? NEUTRAL_COMMUNITY + '.' : 'A small, cool mosaic burn on co-managed bush (autumn or winter). Cuts wildfire risk and helps regrowth.');
      if (s.phase === 'act1') util('clear', 'Clear bush', UI_ICONS.axe, 'Clear bushland for building ($1 per tile, releases CO₂). Placing a building on bush clears it automatically.');
    }
    // per-frame-cheap refresh of costs / locks
    for (const [id, card] of this.cards) {
      if (UTIL_TOOLS.includes(id)) {
        card.classList.toggle('sel', this.tool === id);
        continue;
      }
      const av = availability(s.scenarioId, id as BuildingId);
      const locked = s.year < av.unlock;
      const cost = card.querySelector('.cost') as HTMLElement;
      cost.textContent = locked ? `🔒 ${av.unlock}` : `$${av.cost}k`;
      card.classList.toggle('locked', locked);
      card.classList.toggle('poor', !locked && s.budget < av.cost);
      card.classList.toggle('sel', this.tool === id);
      if (!locked && !this.seen.has(id) && s.history.length > 1 && av.unlock > getScenario(s.scenarioId).startYear) {
        if (!card.querySelector('.new')) card.appendChild(h('span', { class: 'new' }, 'NEW'));
      }
    }
  }

  select(t: Tool): void {
    if (t && !UTIL_TOOLS.includes(t) && this.state) {
      const av = availability(this.state.scenarioId, t as BuildingId);
      if (this.state.year < av.unlock) {
        sfx('error');
        return;
      }
      this.seen.add(t);
      this.cards.get(t)?.querySelector('.new')?.remove();
    }
    sfx('click');
    this.tool = t;
    if (this.state) this.update(this.state);
    this.onTool?.(t);
  }

  /** Tutorial: the element to highlight for a building or tool (switching to its tab if it is in another one). */
  elementFor(key: string): HTMLElement | null {
    const card = this.cards.get(key);
    if (card) return card;
    const s = this.state;
    if (!s) return null;
    const cat = CATS.find((c) => c.ids.includes(key as BuildingId));
    if (!cat) return null;
    return [...this.tabsEl.querySelectorAll('.tab')].find((t) => t.textContent?.includes(cat.name)) as HTMLElement | null ?? null;
  }

  /** Number-key selection within the current tab. */
  selectIndex(i: number): void {
    const keys = [...this.cards.keys()].filter((k) => !UTIL_TOOLS.includes(k));
    const k = keys[i];
    if (k) this.select(this.tool === k ? null : (k as Tool));
  }

  private showTip(id: BuildingId, card: HTMLElement): void {
    const s = this.state;
    if (!s) return;
    const d = BUILDINGS[id];
    const av = availability(s.scenarioId, id);
    const r = card.getBoundingClientRect();
    const facts: string[] = [];
    if (d.housing) facts.push(`🏠 ${d.housing} homes`);
    if (d.jobs) facts.push(`👷 ${d.jobs} jobs`);
    const pw = POWER_LABEL(d.power, !!d.energy);
    if (pw) facts.push(`⚡ ${pw}`);
    if (d.co2 > 0) facts.push(`☁️ ${d.co2} kt CO₂/decade`);
    if (d.localPollution > 0) facts.push(`⚠️ pollution ${d.localPollution}`);
    if (d.energy && d.energy.source !== 'coal' && d.energy.source !== 'gas') facts.push('🌱 low-carbon');
    let value = '';
    try {
      const c = cutPerBuild(s, id, av.cost);
      if (c) value = `<div class="row"><span>📉 cuts about ${c.kt} kt CO₂ a year · <b>$${c.perKt}k per kt</b> (lower is better value)</span></div>`;
    } catch { /* no estimate */ }
    const where = d.placement.nearTerrain?.reason ?? d.placement.nearBuilding?.reason ?? d.placement.exposed?.reason ?? d.placement.drop?.reason ?? d.placement.cableTo?.reason ?? (d.replaces ? `Build on top of a ${BUILDINGS[d.replaces].name}` : '');
    const size = `${d.w}×${d.h}${d.w !== d.h ? ' (R to rotate)' : ''}`;
    this.tip.show(r.left + r.width / 2, r.top,
      `<b>${av.name ?? d.name}</b> · $${av.cost}k · ${size}<br>${av.blurb ?? d.blurb}` +
      `<div class="row">${facts.map((f) => `<span>${f}</span>`).join('')}</div>` +
      value +
      (where ? `<div class="row"><span>📍 ${where}</span></div>` : '') +
      (id in BRUSH_SPACING ? `<div class="row"><span>🖌 Hold and drag to place ${(BRUSH_SPACING[id] ?? 1) > 1 ? `several, about ${BRUSH_SPACING[id]} tiles apart` : 'a row'}</span></div>` : '') +
      (s.year < av.unlock ? `<div class="row"><span>🔒 Unlocks in ${av.unlock}</span></div>` : ''));
  }
}

function shortName(id: BuildingId): string {
  const map: Partial<Record<BuildingId, string>> = {
    cottage: 'Cottages', coalmine: 'Coal mine', rail: 'Rail', port: 'Port & loader', outfall: 'Sewage outfall', coalpower: 'Coal power',
    suburb: 'Brick suburb', carpark: 'Highway', gaspower: 'Gas power', rooftopsolar: 'Rooftop solar', solarfarm: 'Solar farm',
    windfarm: 'Wind turbines', offshorewind: 'Offshore wind', hydro: 'Hydro dam', pumpedhydro: 'Pumped hydro', battery: 'Battery',
    tidal: 'Tidal', phytoremediation: 'Phyto garden', excavation: 'Excavation', wetland: 'Wetland', sewagetreatment: 'Sewage plant',
    nursery: 'Plant nursery', reservoir: 'Water storage', dripfarm: 'Drip farm', coolingcentre: 'Cooling centre',
    transitline: 'Light rail', greensuburb: 'Retrofit homes', parkland: 'Pocket park', coralnursery: 'Coral nursery',
    wildlifecrossing: 'Wildlife crossing', groundstation: 'Ground station',
  };
  return map[id] ?? BUILDINGS[id].name;
}
