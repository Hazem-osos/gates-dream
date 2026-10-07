import { rotationCycleIndex, resolveRotationShiftId } from '../../modules/hr/services/time/schedule-rotation.util';

describe('schedule rotation', () => {
  it('resolves cycle index inside cycle', () => {
    const idx = rotationCycleIndex('2026-01-01', new Date('2026-01-03T00:00:00.000Z'), 5);
    expect(idx).toBe(2);
  });

  it('wraps cycle', () => {
    const idx = rotationCycleIndex('2026-01-01', new Date('2026-01-06T00:00:00.000Z'), 5);
    expect(idx).toBe(0);
  });

  it('returns shift id from rotation pattern', () => {
    const id = resolveRotationShiftId(
      {
        rotation: {
          anchorDate: '2026-01-01',
          cycleDays: ['a', 'b', null, null, 'c'],
        },
      },
      new Date('2026-01-02T00:00:00.000Z')
    );
    expect(id).toBe('b');
  });
});
