/** Linear schedule fraction between plannedStart and plannedFinish (inclusive endpoints). */
export function linearScheduleFraction(asOf: Date, plannedStart: Date, plannedFinish: Date): number {
  if (asOf.getTime() <= plannedStart.getTime()) return 0;
  if (asOf.getTime() >= plannedFinish.getTime()) return 1;
  const span = plannedFinish.getTime() - plannedStart.getTime();
  if (span <= 0) return 1;
  return (asOf.getTime() - plannedStart.getTime()) / span;
}

export function safeRatio(numerator: number, denominator: number): number | null {
  if (Math.abs(denominator) < 1e-9) return null;
  return numerator / denominator;
}

export function forecastFinishDate(
  asOf: Date,
  currentPlannedFinish: Date,
  plannedProgressPercent: number,
  actualProgressPercent: number
): { date: Date | null; method: string } {
  if (actualProgressPercent >= 99.999) {
    return { date: asOf, method: 'ACTUAL_COMPLETE_AS_OF' };
  }
  if (actualProgressPercent <= 0.0001) {
    return { date: currentPlannedFinish, method: 'NO_PHYSICAL_PROGRESS_USE_PLANNED_FINISH' };
  }
  const scheduleRatio = safeRatio(plannedProgressPercent, actualProgressPercent);
  if (scheduleRatio == null) return { date: currentPlannedFinish, method: 'FALLBACK_PLANNED_FINISH' };
  const remainingCalendarMs = Math.max(0, currentPlannedFinish.getTime() - asOf.getTime());
  const projectedRemaining = remainingCalendarMs * scheduleRatio;
  return {
    date: new Date(asOf.getTime() + projectedRemaining),
    method:
      'REMAINING_DURATION_SCALED_BY_PLANNED_TO_ACTUAL_PROGRESS_RATIO (deterministic, not CPM)',
  };
}
