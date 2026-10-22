// A few extra icons for the sidebar rail, in the same flat 32x32 style as icons.ts.
const S = (body: string): string =>
  `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${body}</svg>`;
const INK = '#3a2a22';
const o = `stroke="${INK}" stroke-width="1.4"`;

export const RAIL_ICONS = {
  sliders: S(`<path d="M6 9 H26 M6 16 H26 M6 23 H26" stroke="${INK}" stroke-width="2.2" fill="none"/><circle cx="12" cy="9" r="3.4" fill="#f2c230" ${o}/><circle cx="21" cy="16" r="3.4" fill="#5fb8c8" ${o}/><circle cx="10" cy="23" r="3.4" fill="#c0583a" ${o}/>`),
  satellite: S(`<rect x="12" y="12" width="8" height="8" rx="1.5" fill="#fbf3e4" ${o} transform="rotate(45 16 16)"/><rect x="2.5" y="6.5" width="9" height="5" rx="1" fill="#5fb8c8" ${o} transform="rotate(-45 7 9)"/><rect x="20.5" y="20.5" width="9" height="5" rx="1" fill="#5fb8c8" ${o} transform="rotate(-45 25 23)"/><path d="M8 25 Q8 29 12 29" fill="none" stroke="${INK}" stroke-width="1.6"/><path d="M6 22 Q6 31 15 31" fill="none" stroke="${INK}" stroke-width="1.2" opacity=".6"/>`),
  town: S(`<rect x="3" y="14" width="9" height="13" fill="#e9d9bb" ${o}/><rect x="11" y="8" width="10" height="19" fill="#f1ead8" ${o}/><rect x="20" y="16" width="9" height="11" fill="#e9d9bb" ${o}/><path d="M14 12 H18 M14 16 H18 M14 20 H18" stroke="#8a7868" stroke-width="1.4"/><path d="M3 27 H29" ${o}/>`),
  frame: S(`<path d="M5 12 V5 H12 M20 5 H27 V12 M27 20 V27 H20 M12 27 H5 V20" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="16" cy="16" r="3.2" fill="#f2c230" ${o}/>`),
  more: S(`<circle cx="7" cy="16" r="3" fill="currentColor"/><circle cx="16" cy="16" r="3" fill="currentColor"/><circle cx="25" cy="16" r="3" fill="currentColor"/>`),
  chevronRight: S(`<path d="M12 7 L21 16 L12 25" fill="none" stroke="currentColor" stroke-width="3"/>`),
  chevronLeft: S(`<path d="M20 7 L11 16 L20 25" fill="none" stroke="currentColor" stroke-width="3"/>`),
  menu: S(`<path d="M6 9 H26 M6 16 H26 M6 23 H26" stroke="currentColor" stroke-width="3" fill="none"/>`),
};
