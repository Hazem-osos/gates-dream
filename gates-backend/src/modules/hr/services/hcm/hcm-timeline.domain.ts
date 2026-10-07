import {
  isDateInEffectiveRange,
  isSameDateOnly,
  previousDateOnly,
  toDateOnly,
} from '../../utils/hr-effective-date.util';

export type TimelineRow = {
  id?: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export type TimelineUpdate = { id: string; effectiveTo?: Date | null };
export type TimelineCreate<T> = Omit<T, 'id'> & { effectiveFrom: Date; effectiveTo: Date | null };

export type TimelineMutationPlan<T extends TimelineRow> = {
  updates: TimelineUpdate[];
  creates: TimelineCreate<T>[];
  /** In-place field updates when effectiveFrom equals an existing boundary. */
  inPlace?: Array<{ id: string; patch: Partial<T> }>;
};

function sortTimeline<T extends TimelineRow>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => toDateOnly(a.effectiveFrom).getTime() - toDateOnly(b.effectiveFrom).getTime()
  );
}

function findContainingRow<T extends TimelineRow>(rows: T[], day: Date): T | null {
  const d = toDateOnly(day);
  for (const row of rows) {
    if (isDateInEffectiveRange(d, row.effectiveFrom, row.effectiveTo)) return row;
  }
  return null;
}

function findNextRowAfter<T extends TimelineRow>(rows: T[], day: Date): T | null {
  const t = toDateOnly(day).getTime();
  for (const row of sortTimeline(rows)) {
    if (toDateOnly(row.effectiveFrom).getTime() > t) return row;
  }
  return null;
}

function segmentEndBeforeNext<T extends TimelineRow>(
  host: T,
  effectiveFrom: Date,
  allRows: T[]
): Date | null {
  const next = findNextRowAfter(allRows, effectiveFrom);
  if (!next) return host.effectiveTo;
  const cap = previousDateOnly(next.effectiveFrom);
  if (!host.effectiveTo) return cap;
  return toDateOnly(host.effectiveTo).getTime() <= cap.getTime() ? host.effectiveTo : cap;
}

/**
 * Insert a new authoritative segment at `effectiveFrom`, splitting the containing interval
 * and preserving any later transitions.
 */
export function planTimelineMutation<T extends TimelineRow>(
  rows: T[],
  effectiveFrom: Date,
  buildNewSegment: (source: T) => Omit<T, 'id' | 'effectiveFrom' | 'effectiveTo'>
): TimelineMutationPlan<T> {
  const E = toDateOnly(effectiveFrom);
  const sorted = sortTimeline(rows);

  if (sorted.some((r) => isSameDateOnly(toDateOnly(r.effectiveFrom), E))) {
    throw new Error('TIMELINE_DUPLICATE_BOUNDARY');
  }

  const host = findContainingRow(sorted, E);
  if (!host?.id) {
    throw new Error('TIMELINE_NO_COVERAGE');
  }

  const newEnd = segmentEndBeforeNext(host, E, sorted);
  const segmentBody = buildNewSegment(host);

  if (isSameDateOnly(toDateOnly(host.effectiveFrom), E)) {
    return {
      updates: [],
      creates: [],
      inPlace: [{ id: host.id, patch: { ...segmentBody, effectiveTo: newEnd } as Partial<T> }],
    };
  }

  return {
    updates: [{ id: host.id, effectiveTo: previousDateOnly(E) }],
    creates: [
      {
        ...(segmentBody as T),
        effectiveFrom: E,
        effectiveTo: newEnd,
      },
    ],
  };
}

/**
 * Close the interval covering `effectiveFrom` (or the latest open segment) and append a new open segment.
 */
export function planTimelineAppendOpen<T extends TimelineRow>(
  rows: T[],
  effectiveFrom: Date,
  buildNewSegment: (source: T | null) => Omit<T, 'id' | 'effectiveFrom' | 'effectiveTo'>
): TimelineMutationPlan<T> {
  const E = toDateOnly(effectiveFrom);
  const sorted = sortTimeline(rows);

  if (sorted.some((r) => isSameDateOnly(toDateOnly(r.effectiveFrom), E))) {
    throw new Error('TIMELINE_DUPLICATE_BOUNDARY');
  }

  const host = findContainingRow(sorted, E);
  const updates: TimelineUpdate[] = [];
  const source = host ?? sorted[sorted.length - 1] ?? null;

  if (host?.id) {
    if (!isSameDateOnly(toDateOnly(host.effectiveFrom), E)) {
      updates.push({ id: host.id, effectiveTo: previousDateOnly(E) });
    }
  } else if (source?.id && source.effectiveTo == null) {
    const closeAt = previousDateOnly(E);
    if (closeAt.getTime() >= toDateOnly(source.effectiveFrom).getTime()) {
      updates.push({ id: source.id, effectiveTo: closeAt });
    }
  }

  const body = buildNewSegment(source);
  return {
    updates,
    creates: [{ ...(body as T), effectiveFrom: E, effectiveTo: null }],
  };
}

/** Choose split vs append: backdated inside a bounded or open host → split; else append. */
export function planTimelineChange<T extends TimelineRow>(
  rows: T[],
  effectiveFrom: Date,
  buildNewSegment: (source: T) => Omit<T, 'id' | 'effectiveFrom' | 'effectiveTo'>
): TimelineMutationPlan<T> {
  const E = toDateOnly(effectiveFrom);
  const host = findContainingRow(sortTimeline(rows), E);
  if (host) {
    const next = findNextRowAfter(rows, E);
    if (next || (host.effectiveTo && toDateOnly(host.effectiveTo).getTime() > E.getTime())) {
      return planTimelineMutation(rows, effectiveFrom, buildNewSegment);
    }
  }
  return planTimelineAppendOpen(rows, effectiveFrom, (s) => buildNewSegment(s as T));
}
