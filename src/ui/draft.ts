// Gate for draft Aboriginal / Torres Strait Islander content (everything flagged needsConsultation, plus the Elder
// characters). The public build hides it behind neutral generic text; `?draft` (also `?teacher&draft`) shows the full
// draft content with a visible tag, for the owner / community reviewers. Presentation only: sim state is unchanged.
import { CAST } from '../content/residents';
import { h } from './dom';

export const DRAFT_PARAM = 'draft';
const showDraftContent = (() => {
  try { return new URLSearchParams(location.search).has(DRAFT_PARAM); } catch { return false; }
})();

/** True when the full draft content is being shown (`?draft`). */
export const isDraft = (): boolean => showDraftContent;
/** True on the public build: flagged content is replaced by neutral text or left out. */
export const hideDraft = (): boolean => !showDraftContent;

export const DRAFT_TAG = 'Draft — pending community consultation';
export const NEUTRAL_COMMUNITY = 'Work with the local Aboriginal community (content being developed with community)';

const elderNames = (): string[] => {
  const out: string[] = [];
  for (const list of Object.values(CAST)) for (const r of list ?? []) if (r.elder === true || r.needsConsultation === true) out.push(r.name);
  return out;
};
let names: string[] | null = null;
/** Names of the Elder / community characters (never shown on the public build). */
export function hiddenCharacterNames(): string[] {
  names ??= elderNames();
  return names;
}
export const isHiddenCharacter = (name: string): boolean => hiddenCharacterNames().some((n) => name.includes(n));

/** Small inline tag for draft passages (shown only with ?draft). */
export function draftBadge(): HTMLElement {
  return h('span', { class: 'badge tutorial', title: DRAFT_TAG }, 'draft');
}

/** Page-wide banner so nobody mistakes a ?draft review build for the public game. */
export function installDraftBanner(): void {
  if (!showDraftContent || document.getElementById('draft-banner')) return;
  document.body.appendChild(h('div', { id: 'draft-banner', style: 'position:fixed;left:50%;bottom:6px;transform:translateX(-50%);z-index:9999;background:#8a5a3a;color:#fff;font:700 12px system-ui;padding:4px 12px;border-radius:999px;pointer-events:none;box-shadow:0 1px 4px #0004' }, DRAFT_TAG));
}

/** Replace Elder / community character names in a label with generic wording. */
export function scrubNames(text: string): string {
  let out = text;
  for (const n of hiddenCharacterNames()) out = out.split(n).join('the local Aboriginal community');
  return out.replace(/\b(?:Aunty|Uncle)\s+[A-Z]\w+/g, 'the local Aboriginal community');
}
