// Act 2 layer panels wired to the sim's empathy / transition systems: Caring for Country (partnership, unlocks,
// dual names, consult / co-manage / cool burn), the circular tier (legacy-site disposal chooser, research tree)
// and satellites (overlays + early warning). All copy marked needsConsultation stays visibly flagged.
import {
  COUNTRY, OVERLAY_INFO, RESEARCH, SATELLITE_OVERLAYS, canResearch, countryActive, dualNames, hasGroundStation,
  disposalChoice, legacyPercent, type DisposalPlan, type GameState, type SatelliteOverlay,
} from '../sim';
import { BUILDINGS } from '../sim/buildings';
import { clear, h, svg } from './dom';
import { bIcon, UI_ICONS } from './icons';
import { openModal } from './modal';
import { sfx } from '../audio/sfx';

const DRAFT = h('span', { class: 'badge tutorial', title: 'Placeholder text: to be reviewed with the local Aboriginal community before release' }, 'draft');

function drawer(title: string, icon: string): { el: HTMLElement; body: HTMLElement } {
  const body = h('div');
  const el = h('div', { class: 'drawer panel' },
    h('div', { class: 'panel-head' }, h('h3', null, svg(icon), title), h('button', { class: 'btn small', onclick: () => el.classList.remove('open') }, 'Close')),
    body);
  document.body.appendChild(el);
  return { el, body };
}

// ---------------------------------------------------------------- Country
export class CountryPanel {
  el: HTMLElement;
  private body: HTMLElement;
  constructor(private onTool: (t: 'comanage' | 'burn') => void) {
    const d = drawer('Caring for Country', UI_ICONS.sprout);
    this.el = d.el;
    this.body = d.body;
  }

  open(s: GameState): void {
    this.render(s);
    this.el.classList.add('open');
  }

  render(s: GameState): void {
    clear(this.body);
    if (!countryActive(s)) {
      this.body.appendChild(h('p', { class: 'muted' }, 'This place does not have a community partnership in the game yet.'));
      return;
    }
    const c = s.country;
    const th = COUNTRY.thresholds;
    const unlock = (label: string, at: number, on: boolean): HTMLElement =>
      h('div', { class: 'obj' }, svg(on ? UI_ICONS.check : UI_ICONS.lock), h('div', { style: 'flex:1' }, h('div', { class: 'lab' }, label), h('div', { class: 'val' }, on ? 'Offered by the community' : `Grows with trust (${at}+)`)));
    this.body.append(
      h('p', { style: 'font-size:13px' }, 'Partnership with the local Aboriginal community grows through respect: asking before building on places that matter, and sharing care of the bush. It can never be bought. ', DRAFT.cloneNode(true)),
      h('div', { class: 'graph-title' }, 'Partnership', h('span', null, `${Math.round(c.partnership)}/100`)),
      h('div', { class: 'meter-bar' }, h('i', { style: `width:${c.partnership}%;background:linear-gradient(90deg,#c9a26a,#8a5a3a)` })),
      unlock('Dual place names on town signs', th.dualNames, c.unlocked.dualNames),
      unlock('Cultural (cool) burning on co-managed bush', th.culturalBurning, c.unlocked.culturalBurning),
      unlock('Seasonal fishing protocols', th.fishing, c.unlocked.fishing),
      h('div', { class: 'stat-grid' },
        h('div', { class: 'stat' }, h('small', null, 'Places consulted'), h('b', null, String(c.consulted.length))),
        h('div', { class: 'stat' }, h('small', null, 'Bush co-managed'), h('b', null, `${c.comanaged.length} tiles`)),
        h('div', { class: 'stat' }, h('small', null, 'Cool burns'), h('b', null, String(c.burns.length)))),
      h('div', { class: 'modal-actions', style: 'justify-content:flex-start' },
        h('button', { class: 'btn small green', disabled: s.phase !== 'act2', onclick: () => { this.el.classList.remove('open'); this.onTool('comanage'); } }, svg(UI_ICONS.sprout), 'Co-manage bush'),
        h('button', { class: 'btn small', disabled: !c.unlocked.culturalBurning || s.phase !== 'act2', title: 'Autumn or winter only', onclick: () => { this.el.classList.remove('open'); this.onTool('burn'); } }, svg(UI_ICONS.fire), 'Cool burn')),
      h('p', { class: 'muted', style: 'font-size:12px' }, 'Ochre stone rings on the map mark places the community has asked to be consulted about. Inspect one to talk with them first.'),
    );
    const names = dualNames(s);
    if (names.length) {
      this.body.appendChild(h('h3', { style: 'margin-top:10px;font-size:15px' }, 'Place names'));
      for (const n of names) this.body.appendChild(h('div', { class: 'kv' }, h('span', null, n.english), h('b', null, n.original)));
    }
    if (c.log.length) {
      this.body.appendChild(h('h3', { style: 'margin-top:10px;font-size:15px' }, 'What has happened'));
      for (const l of c.log.slice(-10).reverse()) this.body.appendChild(h('div', { class: 'log-item' }, h('div', null, h('small', null, `${l.year} · ${l.delta > 0 ? '+' : ''}${l.delta}`), l.text)));
    }
  }
}

/** Short description of a significant site (placeholder content). */
export function siteName(id: number): string {
  const site = (COUNTRY.sites as Record<number, { name?: { text: string } }>)[id];
  return site?.name?.text ?? 'A place that matters to the local community';
}

// ---------------------------------------------------------------- research
export class ResearchPanel {
  el: HTMLElement;
  private body: HTMLElement;
  constructor(private buy: (id: string) => void) {
    const d = drawer('Recycling innovations', UI_ICONS.sprout);
    this.el = d.el;
    this.body = d.body;
  }
  open(s: GameState): void {
    this.render(s);
    this.el.classList.add('open');
  }
  render(s: GameState): void {
    clear(this.body);
    this.body.appendChild(h('p', { style: 'font-size:13px' }, s.circular.unlocked
      ? `Old sites dealt with: ${Math.round(legacyPercent(s))}%. Research makes repurposing and recycling cheaper and cleaner - and some ideas don't work as well as they sound.`
      : 'Opens with the circular economy (clean power and a healthy estuary, or 2050).'));
    for (const r of RESEARCH) {
      const done = s.circular.research.includes(r.id);
      const chk = canResearch(s, r.id);
      const ev = h('div', { class: 'science hidden' }, h('p', null, r.evidence));
      this.body.appendChild(h('div', { class: 'dil-opt', style: 'margin-top:8px' },
        h('h4', null, h('span', null, r.name, r.kind === 'critique' ? h('span', { class: 'badge medium', style: 'margin-left:6px' }, 'critique') : null), h('span', { class: 'muted' }, done ? 'done' : `$${r.cost}k`)),
        h('p', { style: 'margin:0 0 6px;font-size:13px' }, r.blurb),
        h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
          h('button', { class: 'btn small teal', onclick: () => ev.classList.toggle('hidden') }, 'What does the evidence say?'),
          done ? null : h('button', { class: 'btn small primary', disabled: !chk.ok, title: chk.reason ?? '', onclick: () => { this.buy(r.id); this.render(this.lastState ?? s); } }, 'Research')),
        !done && !chk.ok && chk.reason ? h('div', { class: 'muted', style: 'font-size:12px;margin-top:4px' }, chk.reason) : null,
        ev));
    }
    this.lastState = s;
  }
  lastState: GameState | null = null;
}

// ---------------------------------------------------------------- satellites
export class SatellitePanel {
  el: HTMLElement;
  private body: HTMLElement;
  active: SatelliteOverlay | null = null;
  constructor(private subscribe: (o: SatelliteOverlay) => void, private show: (o: SatelliteOverlay | null) => void) {
    const d = drawer('Satellites', UI_ICONS.target);
    this.el = d.el;
    this.body = d.body;
  }
  open(s: GameState): void {
    this.render(s);
    this.el.classList.add('open');
  }
  render(s: GameState): void {
    clear(this.body);
    const gs = hasGroundStation(s);
    this.body.appendChild(h('p', { style: 'font-size:13px' }, gs
      ? 'Your ground station downloads data from Earth-observation satellites. Subscribe to a data layer, then view it on the map.'
      : 'Build a Satellite ground station (Restore tab) to receive satellite data.'));
    for (const o of SATELLITE_OVERLAYS) {
      const info = OVERLAY_INFO[o];
      const owned = s.satellites.overlays[o];
      this.body.appendChild(h('div', { class: 'dil-opt', style: 'margin-top:8px' },
        h('h4', null, h('span', null, info.name), h('span', { class: 'muted' }, owned ? 'subscribed' : `$${info.cost}k`)),
        h('p', { style: 'margin:0 0 6px;font-size:13px' }, info.blurb),
        owned
          ? h('button', { class: `btn small ${this.active === o ? 'primary' : ''}`, onclick: () => { this.active = this.active === o ? null : o; this.show(this.active); this.render(s); } }, this.active === o ? 'Hide on map' : 'Show on map')
          : h('button', { class: 'btn small teal', disabled: !gs || s.budget < info.cost, onclick: () => this.subscribe(o) }, 'Subscribe')));
    }
  }
}

// ---------------------------------------------------------------- legacy site chooser
export function showDisposal(s: GameState, x: number, y: number, choose: (plan: DisposalPlan) => void, warning = ''): boolean {
  const ch = disposalChoice(s, x, y);
  if (!ch) return false;
  const def = BUILDINGS[ch.item.type];
  const m = openModal([
    h('div', { class: 'kicker' }, 'Old site, new life?'),
    h('h2', { style: 'display:flex;gap:10px;align-items:center' }, svg(bIcon(ch.item.type)), def.name),
    h('p', null, 'Every Act 1 building has to be dealt with. The waste hierarchy says: reuse first, recycle next, landfill last.'),
    warning ? h('p', { style: 'font-weight:800;color:#b5651d' }, warning) : null,
    h('div', { class: 'dil-opts' }, ...ch.plans.map((p) => h('button', {
      class: 'dil-opt', disabled: !p.ok,
      onclick: () => { if (!p.ok) return; sfx('click'); m.close(); choose(p); },
    },
    h('h4', null, h('span', null, p.how === 'repurpose' ? '♻ ' : p.how === 'recycle' ? '⚙ ' : '🗑 ', p.label), h('span', { class: 'muted' }, p.cost >= 0 ? `$${p.cost}k` : `+$${-p.cost}k back`)),
    h('p', { style: 'margin:0 0 6px;font-size:13px' }, p.note),
    h('div', { class: 'impacts' },
      h('span', { class: `impact ${p.how === 'landfill' ? 'n2' : p.how === 'recycle' ? 'p1' : 'p2'}` }, p.how === 'landfill' ? '▼▼ waste' : p.how === 'recycle' ? '▲ materials reused' : /bush|rehab/i.test(p.id + p.label) ? '▲▲ land returned to nature' : '▲▲ building reused'),
      h('span', { class: 'impact z' }, `${p.emissionsKt} kt CO₂`)),
    !p.ok && p.reason ? h('div', { class: 'muted', style: 'font-size:12px;margin-top:6px;color:#c0483a' }, p.reason) : null)))
  ]);
  return true;
}
