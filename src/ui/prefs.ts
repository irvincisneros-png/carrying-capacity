// Tiny per-viewer UI preferences in localStorage (which drawer was open, whether the guide is a pill, ...).
// Every access is wrapped: private windows and blocked storage must never break the game.
const PREFIX = 'cc.ui.';

export function getPref(key: string): string | null {
  try { return localStorage.getItem(PREFIX + key); } catch { return null; }
}

export function setPref(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, value);
  } catch { /* storage unavailable */ }
}
