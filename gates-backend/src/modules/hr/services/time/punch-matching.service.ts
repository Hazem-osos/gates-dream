import type { HcmTimePunch } from '@prisma/client';
import { diffMinutesUtc } from './time-minutes.util';

export type MatchedInterval = {
  inAt: Date | null;
  outAt: Date | null;
  workedMinutes: number;
};

export type PunchMatchResult = {
  intervals: MatchedInterval[];
  exceptions: Array<{ type: string; details?: Record<string, unknown> }>;
};

/** Deterministic pairing: explicit IN/OUT first, then alternate GENERIC punches by time. */
export function matchPunches(punches: HcmTimePunch[]): PunchMatchResult {
  const sorted = [...punches].sort((a, b) => a.punchedAt.getTime() - b.punchedAt.getTime());
  const exceptions: PunchMatchResult['exceptions'] = [];
  const intervals: MatchedInterval[] = [];

  const explicit = sorted.filter((p) => p.punchType === 'IN' || p.punchType === 'OUT');
  const generic = sorted.filter((p) => !p.punchType || p.punchType === 'GENERIC');

  let openIn: Date | null = null;
  for (const p of explicit) {
    if (p.punchType === 'IN') {
      if (openIn) exceptions.push({ type: 'DUPLICATE_PUNCH', details: { at: p.punchedAt } });
      openIn = p.punchedAt;
    } else if (p.punchType === 'OUT') {
      if (!openIn) {
        exceptions.push({ type: 'MISSING_IN', details: { at: p.punchedAt } });
        intervals.push({ inAt: null, outAt: p.punchedAt, workedMinutes: 0 });
      } else {
        intervals.push({
          inAt: openIn,
          outAt: p.punchedAt,
          workedMinutes: diffMinutesUtc(openIn, p.punchedAt),
        });
        openIn = null;
      }
    }
  }
  if (openIn) exceptions.push({ type: 'MISSING_OUT', details: { at: openIn } });

  let toggle: 'IN' | 'OUT' = 'IN';
  let gIn: Date | null = null;
  for (const p of generic) {
    if (toggle === 'IN') {
      if (gIn) exceptions.push({ type: 'DUPLICATE_PUNCH', details: { at: p.punchedAt } });
      gIn = p.punchedAt;
      toggle = 'OUT';
    } else {
      if (!gIn) {
        exceptions.push({ type: 'MISSING_IN', details: { at: p.punchedAt } });
      } else {
        intervals.push({
          inAt: gIn,
          outAt: p.punchedAt,
          workedMinutes: diffMinutesUtc(gIn, p.punchedAt),
        });
        gIn = null;
      }
      toggle = 'IN';
    }
  }
  if (gIn) exceptions.push({ type: 'MISSING_OUT', details: { at: gIn } });

  if (sorted.length === 0) {
    exceptions.push({ type: 'MISSING_IN' });
    exceptions.push({ type: 'MISSING_OUT' });
  }

  return { intervals, exceptions };
}
