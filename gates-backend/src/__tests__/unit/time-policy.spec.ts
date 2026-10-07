import { computeLateMinutes } from '../../modules/hr/services/time/time-policy.domain';

describe('attendance policy', () => {
  const start = new Date('2026-06-01T09:00:00.000Z');

  it('late within grace is zero (FULL mode)', () => {
    const inAt = new Date('2026-06-01T09:07:00.000Z');
    expect(computeLateMinutes(start, inAt, { lateGraceMinutes: 10, lateGraceMode: 'FULL' })).toBe(0);
  });

  it('late outside grace (FULL mode)', () => {
    const inAt = new Date('2026-06-01T09:15:00.000Z');
    expect(computeLateMinutes(start, inAt, { lateGraceMinutes: 10, lateGraceMode: 'FULL' })).toBe(15);
  });

  it('late excess only mode', () => {
    const inAt = new Date('2026-06-01T09:15:00.000Z');
    expect(computeLateMinutes(start, inAt, { lateGraceMinutes: 10, lateGraceMode: 'EXCESS_ONLY' })).toBe(5);
  });
});
