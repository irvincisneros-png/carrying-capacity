// The sidebar rail: a slim vertical strip of icon buttons on the right edge. Each button opens ONE drawer beside the rail
// (opening another closes the first; click again, the X or Esc closes it). The drawers are the game's existing panels,
// re-hosted here: a panel keeps its own `.open` class and open() method, and the rail watches that class, so a panel
// opened from anywhere (a toast, the tutorial, a key) still behaves. On phones the rail is a "More" button and a bottom sheet.
import { anyBadge, type RailBadge, type RailId } from './badges';
import { h, svg } from './dom';
import { UI_ICONS } from './icons';
import { getPref, setPref } from './prefs';
import { RAIL_ICONS } from './railicons';

export interface RailItem {
  id: RailId;
  label: string;
  /** Short text shown beside the icon on screens 1200px wide and up. */
  short?: string;
  icon: string;
  /** Panels this button hosts (a button can have more than one, such as Goals for Act 1 and Act 2). Omit for a plain action. */
  panels?: HTMLElement[];
  /** Open the panel (or run the action). */
  run(): void;
  /** Called when the drawer opens (clear unread counters). */
  onOpen?(): void;
}

interface Entry { item: RailItem; btn: HTMLButtonElement; badge: HTMLElement; visible: boolean }

const PITCH = 46; // a button plus its gap, in px (the labelled wide layout uses a little more, see layout())

export class Rail {
  /** Mount this once: it holds the rail and the drawer host. */
  readonly el: HTMLElement;
  /** The phone "More" button (the rail is a bottom sheet there). */
  readonly more: HTMLButtonElement;
  private rail: HTMLElement;
  private host: HTMLElement;
  private toggleBtn: HTMLButtonElement;
  private moreDot: HTMLElement;
  private entries = new Map<RailId, Entry>();
  private current: RailId | null = null;
  private wasOpen = new WeakSet<HTMLElement>();
  private badges: Partial<Record<RailId, RailBadge>> = {};
  private collapsed = getPref('rail') === 'min';
  private sheet = false;
  onChange: ((open: RailId | null) => void) | null = null;

  constructor() {
    this.toggleBtn = h('button', { class: 'rbtn railtoggle', type: 'button', 'aria-label': 'Hide or show the side menu', 'aria-expanded': 'true', 'data-label': 'Menu', onclick: () => this.setCollapsed(!this.collapsed) },
      svg(RAIL_ICONS.menu), h('span', { class: 'rl' }, 'Menu'), h('i', { class: 'rbadge' }));
    this.rail = h('nav', { class: 'rail panel', 'aria-label': 'Game panels' }, this.toggleBtn);
    this.host = h('div', { class: 'railhost' });
    this.el = h('div', { class: 'railwrap' }, this.rail, this.host);
    this.moreDot = h('i', { class: 'rbadge' });
    this.more = h('button', { class: 'morebtn panel', type: 'button', 'aria-label': 'More: open the game panels', 'aria-expanded': 'false', onclick: () => this.setSheet(!this.sheet) }, svg(RAIL_ICONS.more), h('span', null, 'More'), this.moreDot);
    this.rail.classList.toggle('min', this.collapsed);
    this.toggleBtn.setAttribute('aria-expanded', String(!this.collapsed));
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this.layout()).observe(this.el);
      // The top bar keeps clear of the rail: publish the rail's width so the HUD row stops short of it.
      new ResizeObserver(() => {
        const phone = window.matchMedia('(max-width: 700px)').matches;
        document.documentElement.style.setProperty('--rail-w', phone ? '0px' : `${Math.round(this.rail.getBoundingClientRect().width)}px`);
      }).observe(this.rail);
    }
    window.addEventListener('resize', () => this.layout());
    // Tapping the map or anywhere outside closes the phone sheet.
    document.addEventListener('pointerdown', (e) => {
      if (!this.sheet) return;
      const t = e.target as Node;
      if (!this.rail.contains(t) && !this.more.contains(t)) this.setSheet(false);
    });
  }

  /** Add a button (and re-host its panels in the drawer area). */
  add(item: RailItem): void {
    const badge = h('i', { class: 'rbadge' });
    const btn = h('button', { class: 'rbtn', type: 'button', 'data-rail': item.id, 'data-label': item.label, 'aria-label': item.label, 'aria-pressed': 'false', onclick: () => this.press(item.id) },
      svg(item.icon), h('span', { class: 'rl' }, item.short ?? item.label), badge);
    this.rail.appendChild(btn);
    this.entries.set(item.id, { item, btn, badge, visible: true });
    for (const p of item.panels ?? []) this.hostPanel(p, item.id);
  }

  private hostPanel(p: HTMLElement, id: RailId): void {
    p.classList.add('drawer');
    p.setAttribute('data-drawer', id);
    const head = p.querySelector(':scope > .panel-head');
    if (head && !head.querySelector('.railx')) {
      head.appendChild(h('button', { class: 'railx', type: 'button', 'aria-label': 'Close this panel', onclick: () => p.classList.remove('open') }, svg(UI_ICONS.close)));
    }
    this.host.appendChild(p);
    new MutationObserver(() => this.panelChanged(p, id)).observe(p, { attributes: true, attributeFilter: ['class'] });
  }

  private panelChanged(p: HTMLElement, id: RailId): void {
    const open = p.classList.contains('open');
    if (open === this.wasOpen.has(p)) return;
    if (open) {
      this.wasOpen.add(p);
      // One drawer at a time.
      for (const e of this.entries.values()) for (const q of e.item.panels ?? []) if (q !== p) q.classList.remove('open');
      this.current = id;
      this.entries.get(id)?.item.onOpen?.();
      if (this.sheet) this.setSheet(false);
      setPref('drawer', id);
    } else {
      this.wasOpen.delete(p);
      if (this.current === id && !(this.entries.get(id)?.item.panels ?? []).some((q) => q.classList.contains('open'))) {
        this.current = null;
        setPref('drawer', null);
      }
    }
    this.refreshButtons();
    this.onChange?.(this.current);
  }

  private press(id: RailId): void {
    const e = this.entries.get(id);
    if (!e) return;
    if (e.item.panels?.length) { this.toggle(id); return; }
    e.item.run();
    if (this.sheet) this.setSheet(false);
  }

  /** Open a drawer, or close it when it is already open. */
  toggle(id: RailId): void {
    const e = this.entries.get(id);
    if (!e) return;
    if (this.current === id) { this.close(); return; }
    if (this.collapsed) this.setCollapsed(false);
    e.item.run();
  }

  /** Open a drawer (no-op when it is already the open one). */
  open(id: RailId): void {
    if (this.current !== id) this.toggle(id);
  }

  close(): void {
    for (const e of this.entries.values()) for (const p of e.item.panels ?? []) p.classList.remove('open');
  }

  get openId(): RailId | null { return this.current; }

  /** The button for a panel, for the tutorial's highlight. */
  button(id: RailId): HTMLElement | null {
    const e = this.entries.get(id);
    return e && e.visible && !this.collapsed ? e.btn : (e?.visible ? this.toggleBtn : null);
  }

  setVisible(id: RailId, visible: boolean): void {
    const e = this.entries.get(id);
    if (!e || e.visible === visible) return;
    e.visible = visible;
    e.btn.classList.toggle('hidden', !visible);
    if (!visible && this.current === id) this.close();
    this.layout();
  }

  isVisible(id: RailId): boolean { return this.entries.get(id)?.visible ?? false; }

  setBadges(b: Partial<Record<RailId, RailBadge>>): void {
    this.badges = b;
    for (const [id, e] of this.entries) {
      const x = b[id];
      // The open drawer needs no badge: the player is looking at it.
      const show = !!x && this.current !== id;
      e.btn.classList.toggle('has-badge', show);
      e.btn.classList.toggle('urgent', show && !!x?.urgent);
      e.badge.textContent = show && x && x.n > 0 ? String(x.n > 9 ? '9+' : x.n) : '';
      e.btn.classList.toggle('counted', show && !!x && x.n > 0);
      // Say what needs attention: hover text and screen readers ("Town needs: 2 buildings have no road").
      if (show && x) { e.btn.title = `${e.item.label}: ${x.note}`; e.btn.setAttribute('aria-label', `${e.item.label}: ${x.note}`); }
      else { e.btn.removeAttribute('title'); e.btn.setAttribute('aria-label', e.item.label); }
    }
    const any = anyBadge(Object.fromEntries(Object.entries(b).filter(([id]) => this.current !== id)) as Partial<Record<RailId, RailBadge>>);
    for (const el of [this.toggleBtn, this.more]) {
      el.classList.toggle('has-badge', any.any && (el === this.more || this.collapsed));
      el.classList.toggle('urgent', any.urgent && (el === this.more || this.collapsed));
    }
  }

  private refreshButtons(): void {
    for (const [id, e] of this.entries) {
      const on = this.current === id;
      e.btn.classList.toggle('on', on);
      e.btn.setAttribute('aria-pressed', String(on));
    }
    this.setBadges(this.badges);
    this.el.classList.toggle('has-drawer', this.current !== null);
  }

  setCollapsed(on: boolean): void {
    this.collapsed = on;
    setPref('rail', on ? 'min' : null);
    this.rail.classList.toggle('min', on);
    this.toggleBtn.setAttribute('aria-expanded', String(!on));
    if (on) this.close();
    this.setBadges(this.badges);
    this.layout();
  }

  closeSheet(): void { this.setSheet(false); }

  private setSheet(on: boolean): void {
    this.sheet = on;
    this.rail.classList.toggle('sheet-open', on);
    this.more.setAttribute('aria-expanded', String(on));
    this.more.classList.toggle('on', on);
    if (on) this.close();
  }

  /** Re-open the drawer the viewer had open last time, when its button is available. */
  restore(id: RailId | null = getPref('drawer') as RailId | null): void {
    if (id && this.entries.has(id) && this.isVisible(id) && this.current === null) this.entries.get(id)?.item.run();
  }

  /** Keep the rail inside the free height: more columns when the screen is short; short text labels when it is wide and everything fits in one column. */
  private layout(): void {
    const phone = window.matchMedia('(max-width: 700px)').matches;
    const n = Array.from(this.entries.values()).filter((e) => e.visible).length + 1;
    if (phone) { this.rail.style.removeProperty('--rail-rows'); this.rail.classList.remove('labels'); return; }
    const avail = this.el.clientHeight || window.innerHeight - 260;
    const fits = Math.floor((avail - 14) / PITCH);
    // 1200px and up: one column of icon + label (it scrolls on a short screen). Narrower: icons only, in as many columns as fit.
    const labels = !this.collapsed && window.innerWidth >= 1200;
    let rows = labels ? n : Math.max(4, Math.min(n, fits));
    if (!labels) rows = Math.ceil(n / Math.ceil(n / rows)); // balance the columns (no lone button in a second column)
    this.rail.style.setProperty('--rail-rows', String(this.collapsed ? 1 : rows));
    this.rail.classList.toggle('labels', labels);
  }
}
