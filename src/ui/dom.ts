// Tiny DOM helpers (no framework).

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | null | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === 'class') el.className = String(v);
      else if (k === 'html') el.innerHTML = String(v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: Element, children: (Child | Child[])[]): void {
  for (const c of children) {
    if (Array.isArray(c)) append(el, c);
    else if (c === null || c === undefined || c === false) continue;
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

export function svg(markup: string, cls = 'ic'): HTMLElement {
  const s = document.createElement('span');
  s.className = cls;
  s.innerHTML = markup;
  return s;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export const fmtMoney = (n: number): string => `$${Math.round(n).toLocaleString('en-AU')}k`;
export const fmtInt = (n: number): string => Math.round(n).toLocaleString('en-AU');
export const fmt1 = (n: number): string => (Math.round(n * 10) / 10).toFixed(1);
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Strip the trailing ASCII "C" in sim text like "1.8 C" -> "1.8 °C". */
export const degC = (t: string): string => t.replace(/(\d)\s?C\b/g, '$1 °C').replace(/CO2/g, 'CO₂');

export function download(name: string, text: string, type = 'text/csv'): void {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

/** Animate a number in an element. */
export function tweenNumber(el: HTMLElement, from: number, to: number, fmt: (n: number) => string, ms = 600): void {
  const t0 = performance.now();
  const step = (now: number): void => {
    const t = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function bump(el: Element, cls = 'bump'): void {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(cls);
}
