import type { RoundingRule } from './time-minutes.util';
import { roundMinutes } from './time-minutes.util';
import { localDateParts } from './time-zone.util';

/** Round a clock instant to policy increment in local timezone (raw punch unchanged in DB). */
export function interpretClockInstant(
  instant: Date,
  timezone: string,
  rule?: RoundingRule
): Date {
  if (!rule || rule.mode === 'NONE' || rule.incrementMinutes <= 0) return instant;
  const p = localDateParts(instant, timezone);
  const minutesOfDay = p.hour * 60 + p.minute;
  const rounded = roundMinutes(minutesOfDay, rule);
  const deltaMinutes = rounded - minutesOfDay;
  return new Date(instant.getTime() + deltaMinutes * 60_000);
}
