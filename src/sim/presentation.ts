// Presentation-only helpers. When draft Aboriginal / Torres Strait Islander content is hidden (the public build), the
// Elder's story arc is not shown, so the report card must not depend on it either: hidden arcs count as neutral
// (neither help nor hinder the third star). Sim state and scoring in report.ts are untouched.
import { EPILOGUE } from '../content/report';
import { buildReportCard, type ReportCard } from './report';
import type { GameState } from './types';

export function presentReportCard(s: GameState, hideDraft: boolean): ReportCard {
  const rc = buildReportCard(s);
  if (!hideDraft) return rc;
  const residents = rc.residents.filter((r) => !r.needsConsultation);
  if (residents.length === rc.residents.length) return rc;
  const residentsGood = residents.length > 0 && residents.every((r) => r.quality === 'good');
  let stars = rc.goalMet ? 1 : 0;
  if (rc.bonusMet) stars = 2;
  if (rc.bonusMet && residentsGood) stars = 3;
  stars -= Math.min(rc.landfillPenalty, stars);
  const starNotes = rc.starNotes.filter((n) => !n.startsWith('Every resident') && !n.startsWith('Not every story'));
  if (rc.bonusMet && residentsGood) starNotes.push('Every resident\'s story ended well.');
  if (rc.bonusMet && !residentsGood) starNotes.push(`Not every story ended well: ${residents.filter((r) => r.quality !== 'good').map((r) => r.name).join(', ')}.`);
  const epilogue = rc.verdict !== 'complete' ? rc.epilogue
    : stars === 3 ? EPILOGUE.three(s.year) : stars === 2 ? EPILOGUE.two(s.year) : stars === 1 ? EPILOGUE.one(s.year) : EPILOGUE.none(s.year);
  return { ...rc, residents, residentsGood, stars: stars as 0 | 1 | 2 | 3, starNotes, epilogue };
}
