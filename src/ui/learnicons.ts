// Icons for the learning layer (WP8): scales, flask, book, house, printer. Same 32x32 flat style as icons.ts.
const S = (body: string): string =>
  `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${body}</svg>`;
const INK = '#3a2a22';
const o = `stroke="${INK}" stroke-width="1.4"`;

export const LEARN_ICONS = {
  scale: S(`<path d="M16 5 V26 M9 26 H23" ${o} fill="none"/><path d="M6 10 H26" ${o} fill="none"/><path d="M6 10 L3 18 Q6 21 9 18 Z" fill="#6f9a52" ${o}/><path d="M26 10 L23 18 Q26 21 29 18 Z" fill="#e0a52a" ${o}/><circle cx="16" cy="6" r="2" fill="#f2c230" ${o}/>`),
  flask: S(`<path d="M12 4 H20 M13 4 V12 L6 25 Q5 28 8 28 H24 Q27 28 26 25 L19 12 V4" fill="#e9f4f4" ${o}/><path d="M9.5 21 H22.5 L25 26 Q25.5 27.5 24 27.5 H8 Q6.5 27.5 7 26 Z" fill="#4fb3c0" ${o}/><circle cx="14" cy="23" r="1.2" fill="#fff"/><circle cx="18" cy="24.5" r="1" fill="#fff"/>`),
  book: S(`<path d="M5 7 Q11 5 16 8 Q21 5 27 7 V25 Q21 23 16 26 Q11 23 5 25 Z" fill="#fbf3e4" ${o}/><path d="M16 8 V26" ${o} fill="none"/><path d="M8 11 Q11 10 13 11.5 M8 15 Q11 14 13 15.5 M19 11.5 Q21 10 24 11 M19 15.5 Q21 14 24 15" stroke="#8a7868" stroke-width="1.2" fill="none"/>`),
  house: S(`<path d="M4 16 L16 5 L28 16 Z" fill="#c0583a" ${o}/><rect x="7" y="16" width="18" height="11" fill="#f1ead8" ${o}/><rect x="13.5" y="19" width="5" height="8" fill="#8a5a3a" ${o}/><rect x="9" y="18.5" width="3" height="3" fill="#9fd0d8" ${o}/>`),
  printer: S(`<rect x="9" y="4" width="14" height="8" fill="#fff" ${o}/><rect x="4" y="12" width="24" height="11" rx="2" fill="#9aa0a6" ${o}/><rect x="9" y="19" width="14" height="9" fill="#fff" ${o}/><path d="M12 22 H20 M12 25 H18" stroke="#8a7868" stroke-width="1.2"/>`),
  chain: S(`<rect x="3" y="12" width="8" height="8" rx="2" fill="#f2c230" ${o}/><rect x="21" y="12" width="8" height="8" rx="2" fill="#c0583a" ${o}/><path d="M11 16 H21 M18 13 L21 16 L18 19" ${o} fill="none"/>`),
  water: S(`<path d="M16 4 Q8 14 8 19 A8 8 0 0 0 24 19 Q24 14 16 4 Z" fill="#4fb3c0" ${o}/><path d="M12 19 A4 4 0 0 0 16 23" stroke="#fff" stroke-width="1.6" fill="none"/>`),
};
