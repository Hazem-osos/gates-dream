import { Decimal } from '@prisma/client/runtime/library';

export type ProrationMethod =
  | 'CALENDAR_DAYS'
  | 'ACTUAL_PERIOD_DAYS'
  | 'SCHEDULED_WORK_DAYS'
  | 'FIXED_DIVISOR';

export type CompensationSegment = {
  componentCode: string;
  effectiveFrom: string;
  effectiveTo: string;
  fullAmount: number;
  prorationBasis: ProrationMethod;
  basisQuantity: number;
  segmentDays: number;
  proratedAmount: number;
};

function daysInclusive(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00.000Z`);
  const b = new Date(`${end}T12:00:00.000Z`);
  return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
}

export function buildCompensationSegments(input: {
  periodStart: string;
  periodEnd: string;
  method: ProrationMethod;
  scheduledWorkDays?: number;
  fixedDivisor?: number;
  employmentStart?: string | null;
  employmentEnd?: string | null;
  components: Array<{
    code: string;
    amount: number;
    effectiveFrom: string;
    effectiveTo?: string | null;
  }>;
}): CompensationSegment[] {
  const periodStart = input.periodStart;
  const periodEnd = input.periodEnd;
  const calendarDays = daysInclusive(periodStart, periodEnd);
  const empStart = input.employmentStart && input.employmentStart > periodStart
    ? input.employmentStart
    : periodStart;
  const empEnd =
    input.employmentEnd && input.employmentEnd < periodEnd ? input.employmentEnd : periodEnd;

  const segments: CompensationSegment[] = [];

  for (const comp of input.components) {
    const segStart =
      comp.effectiveFrom > empStart
        ? comp.effectiveFrom > periodStart
          ? comp.effectiveFrom
          : periodStart
        : empStart > periodStart
          ? empStart
          : periodStart;
    const compEnd = comp.effectiveTo ?? periodEnd;
    const segEnd =
      compEnd < empEnd ? (compEnd < periodEnd ? compEnd : periodEnd) : empEnd < periodEnd ? empEnd : periodEnd;
    if (segStart > segEnd) continue;

    const segmentDays = daysInclusive(segStart, segEnd);
    let basisQuantity = calendarDays;
    if (input.method === 'ACTUAL_PERIOD_DAYS') basisQuantity = calendarDays;
    if (input.method === 'CALENDAR_DAYS') basisQuantity = calendarDays;
    if (input.method === 'SCHEDULED_WORK_DAYS') {
      basisQuantity = input.scheduledWorkDays && input.scheduledWorkDays > 0
        ? input.scheduledWorkDays
        : calendarDays;
    }
    if (input.method === 'FIXED_DIVISOR') {
      basisQuantity = input.fixedDivisor && input.fixedDivisor > 0 ? input.fixedDivisor : 30;
    }

    const prorated = new Decimal(comp.amount)
      .times(segmentDays)
      .div(basisQuantity)
      .toDecimalPlaces(4)
      .toNumber();

    segments.push({
      componentCode: comp.code,
      effectiveFrom: segStart,
      effectiveTo: segEnd,
      fullAmount: comp.amount,
      prorationBasis: input.method,
      basisQuantity,
      segmentDays,
      proratedAmount: prorated,
    });
  }

  return segments;
}

export function sumSegmentsByCode(segments: CompensationSegment[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of segments) {
    out[s.componentCode] = new Decimal(out[s.componentCode] ?? 0)
      .plus(s.proratedAmount)
      .toDecimalPlaces(4)
      .toNumber();
  }
  return out;
}
