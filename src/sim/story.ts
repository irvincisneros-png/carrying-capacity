import { emit } from './events';
import { seasonIndexOf } from './season';
import type { StoryMeta } from './layerTypes';
import type { GameState, SimEvent } from './types';

/** Queues a 'story' event (shown in the Town Voices feed and, if it carries a choice, as a prompt). */
export function emitStory(s: GameState, text: string, meta: StoryMeta, severity = 0.5): SimEvent {
  const act2 = s.phase === 'act2' || s.phase === 'epilogue' || s.phase === 'failed';
  return emit(s, {
    type: 'story',
    year: s.year,
    season: act2 ? s.a2.season : 0,
    seasonIndex: act2 ? seasonIndexOf(s) : 0,
    severity,
    text,
    story: meta,
  });
}

/** The latest spoken / reported story events for the Town Voices feed, newest first. */
export function townVoices(s: GameState, limit = 20): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = s.eventLog.length - 1; i >= 0 && out.length < limit; i--) {
    const e = s.eventLog[i] as SimEvent;
    if (e.type === 'story' && e.story && e.story.channel !== 'research') out.push(e);
  }
  return out;
}
