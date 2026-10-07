/** Authoritative time math in integer minutes — no floating hours. */

export function clampMinutes(value: number): number {
  return Math.max(0, Math.round(value));
}

export function diffMinutesUtc(a: Date, b: Date): number {
  return clampMinutes((b.getTime() - a.getTime()) / 60_000);
}

export type RoundingRule = {
  mode: 'NONE' | 'FLOOR' | 'CEIL' | 'NEAREST';
  incrementMinutes: number;
};

export function roundMinutes(value: number, rule?: RoundingRule): number {
  if (!rule || rule.mode === 'NONE' || rule.incrementMinutes <= 0) return clampMinutes(value);
  const inc = rule.incrementMinutes;
  const v = value / inc;
  if (rule.mode === 'FLOOR') return clampMinutes(Math.floor(v) * inc);
  if (rule.mode === 'CEIL') return clampMinutes(Math.ceil(v) * inc);
  return clampMinutes(Math.round(v) * inc);
}

export function minutesFromClock(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}
