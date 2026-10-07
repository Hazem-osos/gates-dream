import { toDateOnly } from '../../utils/hr-effective-date.util';

export type RotationPattern = {
  anchorDate: string;
  cycleDays: Array<string | null>;
};

export function daysBetweenUtc(a: Date, b: Date): number {
  const start = toDateOnly(a).getTime();
  const end = toDateOnly(b).getTime();
  return Math.round((end - start) / 86_400_000);
}

/** Cycle index 0..length-1 for logical work date. */
export function rotationCycleIndex(anchorDate: string, logicalWorkDate: Date, cycleLength: number): number {
  const anchor = toDateOnly(new Date(`${anchorDate}T00:00:00.000Z`));
  const day = toDateOnly(logicalWorkDate);
  const offset = daysBetweenUtc(anchor, day);
  const mod = offset % cycleLength;
  return mod < 0 ? mod + cycleLength : mod;
}

export function resolveRotationShiftId(
  pattern: { rotation?: RotationPattern },
  logicalWorkDate: Date
): string | null {
  const rot = pattern.rotation;
  if (!rot?.cycleDays?.length || !rot.anchorDate) return null;
  const idx = rotationCycleIndex(rot.anchorDate, logicalWorkDate, rot.cycleDays.length);
  return rot.cycleDays[idx] ?? null;
}
