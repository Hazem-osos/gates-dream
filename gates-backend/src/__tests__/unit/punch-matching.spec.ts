import { matchPunches } from '../../modules/hr/services/time/punch-matching.service';

describe('punch matching', () => {
  const base = (at: string, type: string) =>
    ({
      id: at,
      punchedAt: new Date(at),
      punchType: type,
    }) as import('@prisma/client').HcmTimePunch;

  it('pairs IN/OUT', () => {
    const r = matchPunches([
      base('2026-06-01T09:00:00.000Z', 'IN'),
      base('2026-06-01T17:00:00.000Z', 'OUT'),
    ]);
    expect(r.intervals).toHaveLength(1);
    expect(r.intervals[0].workedMinutes).toBe(480);
  });

  it('flags missing OUT', () => {
    const r = matchPunches([base('2026-06-01T09:00:00.000Z', 'IN')]);
    expect(r.exceptions.some((e) => e.type === 'MISSING_OUT')).toBe(true);
  });

  it('supports multiple intervals', () => {
    const r = matchPunches([
      base('2026-06-01T09:00:00.000Z', 'IN'),
      base('2026-06-01T13:00:00.000Z', 'OUT'),
      base('2026-06-01T14:00:00.000Z', 'IN'),
      base('2026-06-01T18:00:00.000Z', 'OUT'),
    ]);
    expect(r.intervals).toHaveLength(2);
    expect(r.intervals[0].workedMinutes + r.intervals[1].workedMinutes).toBe(480);
  });
});
