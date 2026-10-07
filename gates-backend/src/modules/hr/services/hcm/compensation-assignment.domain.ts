import type { HcmCompensationAssignment } from '@prisma/client';
import {
  isDateInEffectiveRange,
  rangesOverlap,
  previousDateOnly,
  toDateOnly,
} from '../../utils/hr-effective-date.util';

export function pickCompensationAtDate(
  rows: HcmCompensationAssignment[],
  at: Date
): HcmCompensationAssignment | null {
  const matches = rows.filter((r) =>
    isDateInEffectiveRange(at, r.effectiveFrom, r.effectiveTo)
  );
  if (matches.length === 0) return null;
  matches.sort(
    (a, b) => toDateOnly(b.effectiveFrom).getTime() - toDateOnly(a.effectiveFrom).getTime()
  );
  return matches[0];
}

export function pickCurrentCompensation(
  rows: HcmCompensationAssignment[]
): HcmCompensationAssignment | null {
  const open = rows.filter((r) => r.effectiveTo == null);
  if (open.length === 0) return null;
  open.sort(
    (a, b) => toDateOnly(b.effectiveFrom).getTime() - toDateOnly(a.effectiveFrom).getTime()
  );
  return open[0];
}

export function assertCompensationNoOverlap(
  existing: HcmCompensationAssignment[],
  effectiveFrom: Date,
  effectiveTo: Date | null | undefined,
  excludeId?: string
): void {
  for (const row of existing) {
    if (excludeId && row.id === excludeId) continue;
    if (rangesOverlap(row.effectiveFrom, row.effectiveTo, effectiveFrom, effectiveTo)) {
      throw new Error('Compensation assignment period overlaps an existing assignment');
    }
  }
}

export function closeCompensationEndDate(effectiveFrom: Date): Date {
  return previousDateOnly(effectiveFrom);
}
