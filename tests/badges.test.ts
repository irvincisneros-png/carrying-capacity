import { describe, expect, it } from 'vitest';
import { anyBadge, computeRailBadges, goalsNeedAttention, urgentChipText, type BadgeInput } from '../src/ui/badges';

const base: BadgeInput = { phase: 'act1', year: 1960, endYear: 2020, needs: [], noRoad: 0, goals: [], unreadVoices: 0, unreadTerms: 0, unreadLog: 0 };

describe('rail badges', () => {
  it('shows nothing on a calm town', () => {
    expect(computeRailBadges({ ...base, needs: [{ urgent: false }], goals: ['on-track'] })).toEqual({});
  });
  it('does not flag Act 1 goals as at risk at the start, but does near the end', () => {
    expect(goalsNeedAttention({ ...base, goals: ['at-risk', 'at-risk'] })).toBe(0);
    expect(goalsNeedAttention({ ...base, year: 2010, goals: ['at-risk', 'met'] })).toBe(1);
    expect(goalsNeedAttention({ ...base, goals: ['missed'] })).toBe(1);
  });
  it('flags Act 2 goals at risk straight away', () => {
    expect(computeRailBadges({ ...base, phase: 'act2', goals: ['at-risk', 'missed', 'met'] }).goals).toEqual({ n: 2, urgent: false });
  });
  it('counts buildings with no road on the needs button, and pulses for an urgent need', () => {
    expect(computeRailBadges({ ...base, noRoad: 3 }).needs).toEqual({ n: 3, urgent: false });
    expect(computeRailBadges({ ...base, needs: [{ urgent: true }] }).needs).toEqual({ n: 0, urgent: true });
    expect(computeRailBadges({ ...base, needs: [{ urgent: true, inactive: true }] }).needs).toBeUndefined();
    expect(computeRailBadges({ ...base, noRoad: 2, needs: [{ urgent: true }] }).needs).toEqual({ n: 2, urgent: true });
  });
  it('marks an over-capacity town on the needs button', () => {
    expect(computeRailBadges({ ...base, capacity: 'over' }).needs).toEqual({ n: 1, urgent: false });
  });
  it('shows unread voices, terms and log entries, and the Act 2 power and drought nudges', () => {
    const b = computeRailBadges({ ...base, phase: 'act2', unreadVoices: 2, unreadTerms: 1, unreadLog: 4, powerShort: true, droughtOpen: true, satWarning: true });
    expect(b.voices).toEqual({ n: 2, urgent: false });
    expect(b.guide).toEqual({ n: 1, urgent: false });
    expect(b.log).toEqual({ n: 0, urgent: false });
    expect(b.power?.urgent).toBe(true);
    expect(b.policies?.urgent).toBe(true);
    expect(b.sats?.urgent).toBe(true);
    expect(anyBadge(b)).toEqual({ any: true, urgent: true });
  });
  it('builds the nudge chip only for urgent needs or unroaded buildings in Act 1', () => {
    expect(urgentChipText({ phase: 'act1', noRoad: 0, urgentLabels: [] })).toBe('');
    expect(urgentChipText({ phase: 'act1', noRoad: 0, urgentLabels: ['Homes', 'Power'] })).toBe('The town needs homes and power now');
    expect(urgentChipText({ phase: 'act1', noRoad: 1, urgentLabels: [] })).toBe('1 building has no road');
    expect(urgentChipText({ phase: 'act2', noRoad: 1, urgentLabels: ['Homes'] })).toBe('');
  });
});
