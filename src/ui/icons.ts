// Hand-made SVG icons (32x32, flat colour with a soft ink outline) for buildings and UI.
import type { BuildingId } from '../sim/types';

const S = (body: string, vb = '0 0 32 32'): string =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${body}</svg>`;
const INK = '#3a2a22';
const o = `stroke="${INK}" stroke-width="1.4"`;

export const BUILDING_ICONS: Partial<Record<BuildingId, string>> = {
  cottage: S(`<path d="M5 16 L12 10 L19 16 Z" fill="#a3482f" ${o}/><rect x="6.5" y="16" width="11" height="9" fill="#f1ead8" ${o}/><rect x="10.5" y="19.5" width="3" height="5.5" fill="#6b3a2a"/><path d="M15 17 L22 11 L29 17 Z" fill="#8f969b" ${o}/><rect x="16.5" y="17" width="11" height="8" fill="#d6e2e6" ${o}/><rect x="19" y="19" width="3" height="3" fill="#2b3a46"/><rect x="24" y="8" width="2.4" height="5" fill="#9a5038" ${o}/>`),
  farm: S(`<path d="M3 26 L29 26 L26 18 L6 18 Z" fill="#9c7a3e" ${o}/><path d="M7 20 L25 20 M6 23 L27 23" stroke="#c9a85a" stroke-width="1.5"/><path d="M14 18 L14 10 L19 6 L24 10 L24 18 Z" fill="#b8402c" ${o}/><rect x="17.5" y="12" width="3" height="6" fill="#f1ead8"/><path d="M8 18 L8 8 M5 9 L11 9 M8 6 L8 12" stroke="${INK}" stroke-width="1.2"/>`),
  road: S(`<rect x="4" y="11" width="24" height="10" rx="1" fill="#5a5653" ${o}/><path d="M7 16 H11 M14 16 H18 M21 16 H25" stroke="#ece4c6" stroke-width="1.6"/>`),
  coalmine: S(`<path d="M6 27 L11 9 L16 27" fill="none" ${o}/><path d="M8 20 L14 20" ${o}/><circle cx="11" cy="9" r="3" fill="#c49a3a" ${o}/><rect x="16" y="16" width="10" height="11" fill="#8a4a33" ${o}/><rect x="22" y="9" width="2.5" height="7" fill="#7a3f2c" ${o}/><path d="M3 27 Q8 22 13 27 Z" fill="#2b2825" ${o}/>`),
  rail: S(`<path d="M10 4 L8 28 M22 4 L24 28" stroke="#9aa0a6" stroke-width="2.2"/><path d="M7 8 H25 M7 13 H25 M6.5 18 H25.5 M6 23 H26" stroke="#5a4232" stroke-width="2.2"/>`),
  port: S(`<path d="M2 24 Q8 21 16 24 T30 24 V29 H2 Z" fill="#2f8f9d"/><path d="M4 17 L22 17 L20 22 L6 22 Z" fill="#9c2f24" ${o}/><rect x="8" y="13" width="5" height="4" fill="#ebe8e0" ${o}/><path d="M24 26 L24 6 L30 6 M24 10 L16 10" fill="none" ${o}/><path d="M16 10 L16 13" ${o}/>`),
  outfall: S(`<path d="M2 25 Q9 22 16 25 T30 25 V29 H2 Z" fill="#7a8a5a"/><rect x="3" y="14" width="10" height="7" fill="#9d978c" ${o}/><path d="M13 17 H22" stroke="#6d6a64" stroke-width="3.2"/><circle cx="25" cy="21" r="3.5" fill="#8a7a4a" opacity=".8"/>`),
  landfill: S(`<path d="M3 26 Q9 12 16 14 Q23 11 29 26 Z" fill="#8f7a5a" ${o}/><circle cx="11" cy="20" r="1.6" fill="#c0583a"/><circle cx="18" cy="18" r="1.4" fill="#3d6fb0"/><circle cx="22" cy="22" r="1.5" fill="#e8e2d0"/><path d="M24 14 V5" ${o}/><path d="M24 5 Q22 3 24 1 Q26 3 24 5" fill="#f2a23a"/>`),
  factory: S(`<path d="M3 27 V15 L9 11 V15 L15 11 V15 L21 11 V27 Z" fill="#a35a3e" ${o}/><rect x="22" y="5" width="4" height="22" fill="#7f4535" ${o}/><rect x="6" y="19" width="3" height="3" fill="#2b3a46"/><rect x="12" y="19" width="3" height="3" fill="#2b3a46"/><circle cx="26" cy="3.5" r="2" fill="#bdb3a6"/>`),
  steelworks: S(`<rect x="3" y="17" width="12" height="10" fill="#7a4232" ${o}/><path d="M17 27 V12 Q20 9 23 12 V27 Z" fill="#6e4a36" ${o}/><rect x="25" y="4" width="3" height="23" fill="#ebe6dc" ${o}/><rect x="25" y="5" width="3" height="3" fill="#b3392b"/><rect x="25" y="11" width="3" height="3" fill="#b3392b"/><path d="M5 17 L9 13 L13 17" fill="#7d8388" ${o}/><circle cx="20" cy="18" r="1.6" fill="#f4a03a"/>`),
  coalpower: S(`<path d="M4 27 Q6 20 4 12 H13 Q11 20 13 27 Z" fill="#c9c2b6" ${o}/><rect x="15" y="17" width="12" height="10" fill="#8a7d70" ${o}/><rect x="18" y="5" width="3" height="12" fill="#7f4535" ${o}/><rect x="23" y="8" width="3" height="9" fill="#7f4535" ${o}/><circle cx="8.5" cy="9" r="3" fill="#eeeae4"/>`),
  suburb: S(`<path d="M3 15 L9 10 L15 15 Z" fill="#b5523a" ${o}/><rect x="4" y="15" width="10" height="7" fill="#c98a5a" ${o}/><path d="M16 19 L22 14 L28 19 Z" fill="#6b5a4a" ${o}/><rect x="17" y="19" width="10" height="7" fill="#d4a070" ${o}/><path d="M2 28 Q16 23 30 28" stroke="#5a5653" stroke-width="2.4" fill="none"/>`),
  carpark: S(`<rect x="11" y="2" width="10" height="28" fill="#5a5653" ${o}/><path d="M16 4 V8 M16 11 V15 M16 18 V22 M16 25 V29" stroke="#ece4c6" stroke-width="1.4"/><rect x="12.5" y="6" width="3" height="5" rx="1" fill="#c23b2e"/><rect x="16.8" y="18" width="3" height="5" rx="1" fill="#2f5f9a"/>`),
  gaspower: S(`<rect x="4" y="16" width="18" height="11" fill="#c8ccd0" ${o}/><path d="M4 16 Q13 11 22 16" fill="#aab2b8" ${o}/><rect x="24" y="7" width="3" height="20" fill="#e8e6e0" ${o}/><path d="M25.5 5 Q24 3 25.5 1.5" stroke="#bbb" fill="none"/><circle cx="12" cy="22" r="2.6" fill="#3d6fb0" ${o}/>`),
  rooftopsolar: S(`<path d="M3 17 L16 6 L29 17 Z" fill="#7a5a45" ${o}/><path d="M9 14 L16 8 L23 14 Z" fill="#23407a" ${o}/><path d="M12.5 11 L19.5 11 M16 8 V14" stroke="#7fb0e0" stroke-width=".8"/><rect x="6" y="17" width="20" height="10" fill="#efe6d4" ${o}/><circle cx="26" cy="5" r="3" fill="#f2c230"/>`),
  solarfarm: S(`<path d="M3 20 L12 16 L16 22 L7 26 Z" fill="#23407a" ${o}/><path d="M15 15 L24 11 L28 17 L19 21 Z" fill="#23407a" ${o}/><path d="M7 26 V29 M16 22 V25 M19 21 V24 M28 17 V20" ${o}/><circle cx="6" cy="7" r="3.4" fill="#f2c230"/><path d="M6 1.5 V2.5 M0.5 7 H1.5 M10.5 7 H11.5" stroke="#f2c230" stroke-width="1.4"/>`),
  windfarm: S(`<path d="M15 29 L16 13 L17 29 Z" fill="#f2f3f0" ${o}/><circle cx="16" cy="12" r="1.6" fill="#f2f3f0" ${o}/><path d="M16 12 L16 2 M16 12 L24.5 17 M16 12 L7.5 17" stroke="#f2f3f0" stroke-width="2.6"/><path d="M16 12 L16 2 M16 12 L24.5 17 M16 12 L7.5 17" stroke="${INK}" stroke-width=".8"/>`),
  offshorewind: S(`<path d="M2 25 Q8 22 16 25 T30 25 V29 H2 Z" fill="#2f8f9d"/><path d="M11 25 L12 11 L13 25 Z" fill="#f2f3f0" ${o}/><rect x="10.6" y="21" width="2.8" height="3" fill="#f2c230"/><path d="M12 10 L12 2 M12 10 L19 14 M12 10 L5 14" stroke="${INK}" stroke-width="1.6"/><path d="M23 25 L23.6 16 L24.2 25 Z" fill="#f2f3f0" ${o}/>`),
  hydro: S(`<path d="M3 10 Q16 6 29 10 V14 Q16 10 3 14 Z" fill="#5fb8c8" ${o}/><path d="M3 14 Q16 10 29 14 L26 27 H6 Z" fill="#c9c4b8" ${o}/><path d="M13 16 V26 M19 16 V26" stroke="#5fb8c8" stroke-width="2"/>`),
  pumpedhydro: S(`<ellipse cx="9" cy="8" rx="7" ry="3" fill="#5fb8c8" ${o}/><ellipse cx="23" cy="25" rx="7" ry="3" fill="#5fb8c8" ${o}/><path d="M11 10 Q15 18 21 23" stroke="#6d6a64" stroke-width="2.4" fill="none"/><path d="M17 12 L21 12 L19 9 Z M13 22 L17 22 L15 25 Z" fill="#f2c230" ${o}/>`),
  battery: S(`<rect x="5" y="9" width="20" height="16" rx="2" fill="#eef0ee" ${o}/><rect x="25" y="14" width="3" height="6" fill="#9aa0a6" ${o}/><rect x="8" y="12" width="4" height="10" fill="#5f9a4e"/><rect x="13.5" y="12" width="4" height="10" fill="#5f9a4e"/><rect x="19" y="12" width="3" height="10" fill="#d9e8d0"/>`),
  tidal: S(`<path d="M2 14 Q8 11 16 14 T30 14 V29 H2 Z" fill="#2f8f9d"/><circle cx="16" cy="21" r="2" fill="#f2f3f0" ${o}/><path d="M16 21 L16 15.5 M16 21 L20.5 23.5 M16 21 L11.5 23.5" stroke="#f2f3f0" stroke-width="1.8"/><path d="M16 8 V14" ${o}/><circle cx="16" cy="7" r="2" fill="#f2c230" ${o}/>`),
  phytoremediation: S(`<rect x="3" y="21" width="26" height="6" fill="#8f6c46" ${o}/><path d="M9 21 V12 M16 21 V9 M23 21 V13" stroke="#5f8a3e" stroke-width="1.8"/><circle cx="9" cy="11" r="3" fill="#f2c230" ${o}/><circle cx="16" cy="8" r="3.4" fill="#f2c230" ${o}/><circle cx="23" cy="12" r="2.8" fill="#f2c230" ${o}/><circle cx="16" cy="8" r="1.2" fill="#6b3a2a"/>`),
  excavation: S(`<path d="M3 27 L8 19 H20 L25 27 Z" fill="#6b4f3a" ${o}/><rect x="17" y="12" width="9" height="6" fill="#e8b33a" ${o}/><path d="M18 12 L11 6 L7 12" fill="none" stroke="#e8b33a" stroke-width="2.4"/><path d="M5 12 L9 12 L8 15 Z" fill="#8a8a8a" ${o}/><circle cx="19" cy="19" r="1.5" fill="${INK}"/><circle cx="24" cy="19" r="1.5" fill="${INK}"/>`),
  wetland: S(`<ellipse cx="16" cy="22" rx="13" ry="5" fill="#5fb8a8" ${o}/><path d="M8 22 V12 M11 22 V9 M22 22 V11 M25 22 V14" stroke="#6f8c4a" stroke-width="1.6"/><ellipse cx="11" cy="9" rx="1" ry="2.4" fill="#7a4a2a"/><ellipse cx="22" cy="11" rx="1" ry="2.4" fill="#7a4a2a"/>`),
  sewagetreatment: S(`<circle cx="11" cy="18" r="7" fill="#9fd0d8" ${o}/><circle cx="11" cy="18" r="3" fill="#cfe8ec" ${o}/><path d="M4 18 H18" ${o}/><rect x="20" y="13" width="9" height="12" fill="#e8e2d0" ${o}/><path d="M24.5 6 Q22 9 24.5 11 Q27 9 24.5 6" fill="#3cc0b0" ${o}/>`),
  nursery: S(`<path d="M4 27 V14 L16 6 L28 14 V27 Z" fill="#e8f2ea" ${o}/><path d="M16 6 V27 M4 14 H28 M10 10 V27 M22 10 V27" stroke="#9fb8a6" stroke-width="1"/><path d="M8 25 Q8 20 10 19 M8 25 Q8 21 6 20" stroke="#4f8a3e" stroke-width="1.6" fill="none"/><path d="M20 25 Q20 19 22 18 M20 25 Q20 20 18 19" stroke="#4f8a3e" stroke-width="1.6" fill="none"/>`),
};

const EXTRA: Record<string, string> = {
  wildlifecrossing: S(`<rect x="3" y="18" width="26" height="8" fill="#5a5653" ${o}/><path d="M6 18 Q16 4 26 18" fill="none" stroke="#8a5a3a" stroke-width="2.4"/><path d="M9 14 L23 14" stroke="#c9a85a" stroke-width="1.4"/><ellipse cx="16" cy="11" rx="3" ry="2.2" fill="#9a9a96" ${o}/>`),
  groundstation: S(`<path d="M6 22 Q6 8 20 8 Z" fill="#eef0ee" ${o}/><path d="M13 15 L22 6" ${o}/><rect x="10" y="22" width="14" height="6" fill="#c8ccd0" ${o}/><path d="M24 4 Q27 6 26 9 M26 2 Q30 5 29 10" stroke="#3d6fb0" stroke-width="1.6" fill="none"/>`),
  greensteel: S(`<rect x="4" y="15" width="16" height="12" fill="#d8dcd4" ${o}/><rect x="22" y="6" width="4" height="21" fill="#eef0ee" ${o}/><path d="M24 4 Q21 2 24 0" stroke="#bbb" fill="none"/><circle cx="12" cy="21" r="3" fill="#5f9a4e" ${o}/><text x="10.4" y="23" font-size="5" font-weight="900" fill="#fff">H</text>`),
  makerspace: S(`<rect x="4" y="12" width="24" height="15" fill="#a35a3e" ${o}/><path d="M4 12 L10 7 L16 12 L22 7 L28 12" fill="#7d8388" ${o}/><path d="M4 16 Q10 19 16 16 T28 16" stroke="#f2c230" stroke-width="1.4" fill="none"/><rect x="13" y="19" width="6" height="8" fill="#8fd4ff" ${o}/>`),
  windport: S(`<path d="M2 25 Q8 22 16 25 T30 25 V29 H2 Z" fill="#2f8f9d"/><rect x="3" y="18" width="18" height="5" fill="#9d978c" ${o}/><path d="M5 16 L20 13" stroke="#f2f3f0" stroke-width="2.4"/><path d="M24 24 V4 L30 4 M24 8 L18 8 L18 12" fill="none" ${o}/>`),
  solarlandfill: S(`<path d="M3 26 Q9 14 16 15 Q23 13 29 26 Z" fill="#7d9a52" ${o}/><path d="M8 20 L14 17 L16 20 L10 23 Z M17 18 L23 15 L25 18 L19 21 Z" fill="#23407a" ${o}/>`),
  batteryhub: S(`<rect x="3" y="10" width="12" height="17" fill="#8a7d70" ${o}/><rect x="17" y="15" width="12" height="12" rx="1.5" fill="#eef0ee" ${o}/><rect x="19" y="18" width="3" height="7" fill="#5f9a4e"/><rect x="23.5" y="18" width="3" height="7" fill="#5f9a4e"/>`),
  communityhub: S(`<rect x="4" y="13" width="24" height="14" fill="#c98a5a" ${o}/><path d="M3 13 L16 5 L29 13 Z" fill="#23407a" ${o}/><rect x="13" y="18" width="6" height="9" fill="#fbf3e4" ${o}/><circle cx="7" cy="25" r="2.4" fill="#6f9a52"/><circle cx="25" cy="25" r="2.4" fill="#6f9a52"/>`),
  recycler: S(`<path d="M16 5 L21 13 H11 Z" fill="#5f9a4e" ${o}/><path d="M26 25 L17 25 L22 17 Z" fill="#5f9a4e" ${o}/><path d="M6 25 L11 17 L15 25 Z" fill="#5f9a4e" ${o}/>`),
};

/** Building icon with a generic fallback for ids added later. */
export function bIcon(id: BuildingId | string): string {
  return (BUILDING_ICONS as Record<string, string>)[id] ?? EXTRA[id] ?? S(`<rect x="6" y="12" width="20" height="15" fill="#d8c8a8" ${o}/><path d="M4 13 L16 5 L28 13 Z" fill="#a3482f" ${o}/>`);
}

export const UI_ICONS = {
  zones: S(`<rect x="4" y="4" width="11" height="11" rx="2.5" fill="#cfe8bf" stroke="#6f9a52" stroke-width="1.6"/><rect x="17" y="4" width="11" height="11" rx="2.5" fill="#cfdcf2" stroke="#4f78b8" stroke-width="1.6"/><rect x="4" y="17" width="11" height="11" rx="2.5" fill="#f1dfb2" stroke="#b98a2e" stroke-width="1.6"/><rect x="17" y="17" width="11" height="11" rx="2.5" fill="#e6e0d3" stroke="#8a8478" stroke-width="1.6" stroke-dasharray="2.5 2"/>`),
  zonehomes: S(`<rect x="3" y="4" width="26" height="24" rx="5" fill="#cfe8bf" stroke="#6f9a52" stroke-width="1.8" stroke-dasharray="3.5 2.5"/><path d="M8 17 L16 9.5 L24 17 Z" fill="#c0583a" ${o}/><rect x="9.5" y="17" width="13" height="8" fill="#f1ead8" ${o}/><rect x="14" y="20" width="4" height="5" fill="#6b3a2a"/>`),
  zoneshops: S(`<rect x="3" y="4" width="26" height="24" rx="5" fill="#cfdcf2" stroke="#4f78b8" stroke-width="1.8" stroke-dasharray="3.5 2.5"/><rect x="8" y="14" width="16" height="11" fill="#f1ead8" ${o}/><path d="M7 14 L9 9 H23 L25 14 Z" fill="#d9a02a" ${o}/><path d="M12 9 V14 M16 9 V14 M20 9 V14" stroke="#fff" stroke-width="1.4"/><rect x="13.5" y="18" width="5" height="7" fill="#3f4a52"/>`),
  zoneind: S(`<rect x="3" y="4" width="26" height="24" rx="5" fill="#f1dfb2" stroke="#b98a2e" stroke-width="1.8" stroke-dasharray="3.5 2.5"/><path d="M7 24 V14 L12 10 V14 L17 10 V14 L22 10 V24 Z" fill="#b8b2a4" ${o}/><rect x="9" y="18" width="5" height="6" fill="#5a6a74"/><rect x="22" y="9" width="3" height="7" fill="#8f969b" ${o}/>`),
  dezone: S(`<rect x="3" y="4" width="26" height="24" rx="5" fill="#ece6d8" stroke="#8a8478" stroke-width="1.8" stroke-dasharray="3.5 2.5"/><path d="M10 10 L22 22 M22 10 L10 22" stroke="#c0583a" stroke-width="3"/>`),
  calendar: S(`<rect x="5" y="7" width="22" height="20" rx="3" fill="#fbf3e4" ${o}/><path d="M5 13 H27" ${o}/><path d="M11 4 V9 M21 4 V9" ${o}/><circle cx="11" cy="18" r="1.4" fill="${INK}"/><circle cx="16" cy="18" r="1.4" fill="${INK}"/><circle cx="21" cy="18" r="1.4" fill="${INK}"/>`),
  coin: S(`<ellipse cx="16" cy="21" rx="10" ry="4.5" fill="#e0a52a" ${o}/><ellipse cx="16" cy="16" rx="10" ry="4.5" fill="#f2c230" ${o}/><ellipse cx="16" cy="11" rx="10" ry="4.5" fill="#f7d65a" ${o}/>`),
  people: S(`<circle cx="11" cy="11" r="4" fill="#f0c8a0" ${o}/><path d="M4 26 Q4 17 11 17 Q18 17 18 26 Z" fill="#3d6fb0" ${o}/><circle cx="22" cy="12" r="3.4" fill="#d9a07a" ${o}/><path d="M17 26 Q17 18 22 18 Q28 18 28 26 Z" fill="#c0583a" ${o}/>`),
  leaf: S(`<path d="M6 26 Q6 8 26 6 Q26 24 8 26 Z" fill="#6f9a52" ${o}/><path d="M7 25 Q14 16 22 10" stroke="${INK}" stroke-width="1.2" fill="none"/>`),
  heart: S(`<path d="M16 27 Q4 19 4 12 Q4 6 10 6 Q14 6 16 10 Q18 6 22 6 Q28 6 28 12 Q28 19 16 27 Z" fill="#e0607a" ${o}/>`),
  gear: S(`<path d="M16 5 L18 8 L22 7 L22.5 11 L26 13 L24 16 L26 19 L22.5 21 L22 25 L18 24 L16 27 L14 24 L10 25 L9.5 21 L6 19 L8 16 L6 13 L9.5 11 L10 7 L14 8 Z" fill="#e0a52a" ${o}/><circle cx="16" cy="16" r="4" fill="#fbf3e4" ${o}/>`),
  chart: S(`<rect x="4" y="5" width="24" height="22" rx="3" fill="#fbf3e4" ${o}/><path d="M8 22 L13 16 L17 18 L24 9" stroke="#c0583a" stroke-width="2.2" fill="none"/><path d="M8 22 L24 22" stroke="${INK}" stroke-width="1"/>`),
  co2: S(`<path d="M7 22 Q3 22 3 18 Q3 14 7 14 Q8 9 13 9 Q17 9 19 12 Q20 11 22 11 Q27 11 27 16 Q29 17 29 19 Q29 22 25 22 Z" fill="#b8b0a6" ${o}/>`),
  thermo: S(`<rect x="13" y="4" width="6" height="17" rx="3" fill="#fbf3e4" ${o}/><circle cx="16" cy="23" r="5" fill="#d9483a" ${o}/><rect x="14.6" y="11" width="2.8" height="11" fill="#d9483a"/>`),
  pause: S(`<rect x="9" y="7" width="5" height="18" rx="1.4" fill="currentColor"/><rect x="18" y="7" width="5" height="18" rx="1.4" fill="currentColor"/>`),
  play: S(`<path d="M10 6 L25 16 L10 26 Z" fill="currentColor"/>`),
  fast: S(`<path d="M5 7 L16 16 L5 25 Z M16 7 L27 16 L16 25 Z" fill="currentColor"/>`),
  faster: S(`<path d="M3 8 L11 16 L3 24 Z M11 8 L19 16 L11 24 Z M19 8 L27 16 L19 24 Z" fill="currentColor"/><rect x="27" y="8" width="2.5" height="16" fill="currentColor"/>`),
  demolish: S(`<path d="M8 25 L20 13" stroke="#8a5a3a" stroke-width="3.2"/><path d="M16 9 L22 4 L28 10 L23 15 Z" fill="#9aa0a6" ${o}/><path d="M4 28 L12 28 L10 22 L6 22 Z" fill="#c0583a" ${o}/>`),
  axe: S(`<path d="M9 27 L22 8" stroke="#8a5a3a" stroke-width="3"/><path d="M18 6 Q24 3 27 9 L21 13 Z" fill="#9aa0a6" ${o}/><path d="M4 27 Q6 21 10 22" stroke="#6f9a52" stroke-width="2" fill="none"/>`),
  info: S(`<circle cx="16" cy="16" r="12" fill="#2f8f9d" ${o}/><rect x="14.5" y="14" width="3" height="9" rx="1" fill="#fff"/><circle cx="16" cy="9.5" r="1.9" fill="#fff"/>`),
  undo: S(`<path d="M10 9 L4 14 L10 19" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M5 14 H19 Q27 14 27 21 Q27 27 19 27 H13" fill="none" stroke="currentColor" stroke-width="2.6"/>`),
  sound: S(`<path d="M5 12 H10 L17 6 V26 L10 20 H5 Z" fill="currentColor"/><path d="M21 11 Q25 16 21 21 M24 8 Q30 16 24 24" stroke="currentColor" stroke-width="2.2" fill="none"/>`),
  mute: S(`<path d="M5 12 H10 L17 6 V26 L10 20 H5 Z" fill="currentColor"/><path d="M21 12 L28 20 M28 12 L21 20" stroke="currentColor" stroke-width="2.4"/>`),
  close: S(`<path d="M8 8 L24 24 M24 8 L8 24" stroke="currentColor" stroke-width="3"/>`),
  sun: S(`<circle cx="16" cy="16" r="6.5" fill="#f2c230" ${o}/><path d="M16 2.5 V6 M16 26 V29.5 M2.5 16 H6 M26 16 H29.5 M6.5 6.5 L9 9 M23 23 L25.5 25.5 M25.5 6.5 L23 9 M9 23 L6.5 25.5" stroke="#e0a52a" stroke-width="2.2"/>`),
  cloud: S(`<path d="M8 24 Q3 24 3 19.5 Q3 15 8 15 Q9 9 15 9 Q20 9 22 13 Q29 13 29 19 Q29 24 24 24 Z" fill="#eef0f4" ${o}/>`),
  partsun: S(`<circle cx="12" cy="12" r="5.5" fill="#f2c230" ${o}/><path d="M12 2 V4.5 M2 12 H4.5 M5 5 L6.8 6.8 M19 5 L17.2 6.8" stroke="#e0a52a" stroke-width="2"/><path d="M11 27 Q6 27 6 22.5 Q6 18.5 10.5 18.5 Q12 14 17 14 Q21 14 23 17 Q29 17 29 22 Q29 27 24 27 Z" fill="#eef0f4" ${o}/>`),
  rain: S(`<path d="M8 19 Q3 19 3 14.5 Q3 10 8 10 Q9 4 15 4 Q20 4 22 8 Q29 8 29 14 Q29 19 24 19 Z" fill="#c8cfd8" ${o}/><path d="M9 22 L7 28 M16 22 L14 28 M23 22 L21 28" stroke="#3d6fb0" stroke-width="2"/>`),
  storm: S(`<path d="M8 18 Q3 18 3 13.5 Q3 9 8 9 Q9 3 15 3 Q20 3 22 7 Q29 7 29 13 Q29 18 24 18 Z" fill="#8f96a3" ${o}/><path d="M16 17 L12 24 H17 L14 30 L22 21 H17 L20 17 Z" fill="#f2c230" ${o}/>`),
  hot: S(`<circle cx="13" cy="13" r="7" fill="#f28a2a" ${o}/><path d="M13 2 V4 M2 13 H4 M5 5 L6.5 6.5 M21 5 L19.5 6.5" stroke="#e0602a" stroke-width="2"/><path d="M22 18 Q26 22 22 26 Q18 22 22 18" fill="#d9483a" ${o}/>`),
  dry: S(`<path d="M3 24 H29 L26 29 H6 Z" fill="#c9a26a" ${o}/><path d="M9 25 L12 28 M16 24 L15 28 M22 25 L20 28" stroke="${INK}" stroke-width="1"/><circle cx="16" cy="11" r="6" fill="#f2c230" ${o}/>`),
  fire: S(`<path d="M16 3 Q22 10 22 15 Q25 12 24 9 Q29 15 28 21 Q27 29 16 29 Q5 29 4 21 Q4 14 10 9 Q10 14 13 15 Q11 8 16 3 Z" fill="#f28a2a" ${o}/><path d="M16 15 Q20 20 19 24 Q18 27 16 27 Q13 27 13 24 Q13 20 16 15 Z" fill="#f7d65a"/>`),
  wave: S(`<path d="M2 18 Q6 10 11 14 Q14 6 21 9 Q27 12 24 18 Q29 16 30 22 V28 H2 Z" fill="#2f8f9d" ${o}/><path d="M7 22 Q12 19 16 22 T26 22" stroke="#fff" stroke-width="1.6" fill="none"/>`),
  fish: S(`<path d="M4 16 Q12 7 22 12 L28 7 V25 L22 20 Q12 25 4 16 Z" fill="#b8c4cc" ${o}/><circle cx="10" cy="15" r="1.4" fill="${INK}"/>`),
  coral: S(`<path d="M16 28 V18 M16 20 L10 12 M16 18 L22 10 M10 12 V7 M10 12 L6 9 M22 10 L26 6 M22 10 V5" stroke="#e05a8a" stroke-width="3"/><path d="M4 28 H28" ${o}/>`),
  bolt: S(`<path d="M18 3 L7 18 H15 L13 29 L25 13 H17 Z" fill="#f2c230" ${o}/>`),
  moon: S(`<path d="M20 4 Q10 6 10 16 Q10 26 20 28 Q8 30 5 18 Q4 6 20 4 Z" fill="#c8c0e8" ${o}/>`),
  check: S(`<circle cx="16" cy="16" r="12" fill="#5f9a4e" ${o}/><path d="M10 16 L14.5 20.5 L22 12" stroke="#fff" stroke-width="2.8" fill="none"/>`),
  warn: S(`<path d="M16 4 L29 27 H3 Z" fill="#f2c230" ${o}/><rect x="14.6" y="12" width="2.8" height="8" rx="1" fill="${INK}"/><circle cx="16" cy="23.4" r="1.6" fill="${INK}"/>`),
  cross: S(`<circle cx="16" cy="16" r="12" fill="#c0583a" ${o}/><path d="M11 11 L21 21 M21 11 L11 21" stroke="#fff" stroke-width="2.8"/>`),
  clock: S(`<circle cx="16" cy="16" r="12" fill="#fbf3e4" ${o}/><path d="M16 9 V16 L21 19" stroke="${INK}" stroke-width="2" fill="none"/>`),
  star: S(`<path d="M16 3 L19.8 11.5 L29 12.4 L22 18.6 L24.2 27.8 L16 23 L7.8 27.8 L10 18.6 L3 12.4 L12.2 11.5 Z" fill="#f2c230" ${o}/>`),
  starOff: S(`<path d="M16 3 L19.8 11.5 L29 12.4 L22 18.6 L24.2 27.8 L16 23 L7.8 27.8 L10 18.6 L3 12.4 L12.2 11.5 Z" fill="#e4dccb" ${o}/>`),
  lock: S(`<rect x="7" y="14" width="18" height="14" rx="2.5" fill="#c8bfae" ${o}/><path d="M11 14 V10 Q11 5 16 5 Q21 5 21 10 V14" fill="none" ${o}/>`),
  home: S(`<path d="M4 15 L16 5 L28 15" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M8 13 V27 H24 V13" fill="none" stroke="currentColor" stroke-width="2.6"/>`),
  rotate: S(`<path d="M25 11 Q21 5 15 5 Q6 5 6 16 Q6 27 16 27 Q24 27 26 20" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M26 4 V12 H18" fill="none" stroke="currentColor" stroke-width="2.6"/>`),
  log: S(`<rect x="6" y="4" width="20" height="24" rx="3" fill="#fbf3e4" ${o}/><path d="M10 10 H22 M10 15 H22 M10 20 H18" ${o}/>`),
  target: S(`<circle cx="16" cy="16" r="12" fill="#fbf3e4" ${o}/><circle cx="16" cy="16" r="7" fill="#f2c230" ${o}/><circle cx="16" cy="16" r="2.6" fill="#c0583a"/>`),
  speech: S(`<path d="M4 6 H28 V21 H14 L8 27 V21 H4 Z" fill="#fbf3e4" ${o}/><path d="M9 11 H23 M9 16 H19" ${o}/>`),
  paw: S(`<ellipse cx="16" cy="21" rx="6" ry="5" fill="#8a6a4a" ${o}/><circle cx="8" cy="13" r="2.6" fill="#8a6a4a" ${o}/><circle cx="13" cy="8.5" r="2.6" fill="#8a6a4a" ${o}/><circle cx="19" cy="8.5" r="2.6" fill="#8a6a4a" ${o}/><circle cx="24" cy="13" r="2.6" fill="#8a6a4a" ${o}/>`),
  sprout: S(`<path d="M16 28 V16" stroke="#5f8a3e" stroke-width="2.4"/><path d="M16 17 Q8 17 6 9 Q14 8 16 17 Z" fill="#7fb35a" ${o}/><path d="M16 15 Q20 6 28 6 Q27 15 16 15 Z" fill="#9fcf6a" ${o}/><path d="M8 28 H24" stroke="#8f6c46" stroke-width="2.4"/>`),
} as const;
export type UiIcon = keyof typeof UI_ICONS;
