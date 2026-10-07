import { clampMinutes } from './time-minutes.util';
import type { RoundingRule } from './time-minutes.util';

export type AttendancePolicyRules = {
  lateGraceMinutes?: number;
  lateGraceMode?: 'FULL' | 'EXCESS_ONLY';
  earlyLeaveGraceMinutes?: number;
  rounding?: {
    clockIn?: RoundingRule;
    clockOut?: RoundingRule;
    worked?: RoundingRule;
    overtime?: RoundingRule;
  };
  minimumOvertimeMinutes?: number;
  missingPunchAbsenceThresholdMinutes?: number;
};

export function computeLateMinutes(
  scheduledStartAt: Date,
  actualInAt: Date,
  rules: AttendancePolicyRules
): number {
  const raw = clampMinutes((actualInAt.getTime() - scheduledStartAt.getTime()) / 60_000);
  const grace = rules.lateGraceMinutes ?? 0;
  if (raw <= grace) return 0;
  if (rules.lateGraceMode === 'EXCESS_ONLY') return raw - grace;
  return raw;
}

export function computeEarlyLeaveMinutes(
  scheduledEndAt: Date,
  actualOutAt: Date,
  rules: AttendancePolicyRules
): number {
  const raw = clampMinutes((scheduledEndAt.getTime() - actualOutAt.getTime()) / 60_000);
  const grace = rules.earlyLeaveGraceMinutes ?? 0;
  if (raw <= grace) return 0;
  return raw;
}

export const DEFAULT_POLICY_RULES: AttendancePolicyRules = {
  lateGraceMinutes: 0,
  lateGraceMode: 'FULL',
  earlyLeaveGraceMinutes: 0,
  minimumOvertimeMinutes: 0,
};
