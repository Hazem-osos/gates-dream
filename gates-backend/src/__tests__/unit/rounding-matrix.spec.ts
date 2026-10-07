import { interpretClockInstant } from '../../modules/hr/services/time/clock-rounding.util';
import { roundMinutes } from '../../modules/hr/services/time/time-minutes.util';
import type { RoundingRule } from '../../modules/hr/services/time/time-minutes.util';

const increments = [5, 10, 15] as const;
const modes = ['FLOOR', 'CEIL', 'NEAREST'] as const;

describe('rounding matrix — worked/overtime minutes', () => {
  for (const incrementMinutes of increments) {
    for (const mode of modes) {
      const rule: RoundingRule = { mode, incrementMinutes };
      it(`${mode} ${incrementMinutes}m on representative boundaries`, () => {
        const cases = [0, 1, 4, 5, 6, 9, 10, 11, 14, 15, 16];
        for (const v of cases) {
          const r = roundMinutes(v, rule);
          expect(r % incrementMinutes).toBe(0);
          expect(r).toBeGreaterThanOrEqual(0);
        }
      });
    }
  }

  it('NONE leaves value unchanged', () => {
    expect(roundMinutes(7, { mode: 'NONE', incrementMinutes: 15 })).toBe(7);
  });
});

describe('rounding matrix — clock interpretation', () => {
  const base = '2026-06-01T09:00:00.000Z';

  for (const incrementMinutes of increments) {
    it(`clock IN NEAREST ${incrementMinutes}m at 09:07 UTC`, () => {
      const inAt = new Date('2026-06-01T09:07:00.000Z');
      const rounded = interpretClockInstant(inAt, 'UTC', { mode: 'NEAREST', incrementMinutes });
      const deltaMin = (rounded.getTime() - new Date(base).getTime()) / 60_000;
      expect(deltaMin % incrementMinutes).toBe(0);
    });
    it(`clock OUT FLOOR ${incrementMinutes}m at 17:08 UTC`, () => {
      const outAt = new Date('2026-06-01T17:08:00.000Z');
      const rounded = interpretClockInstant(outAt, 'UTC', { mode: 'FLOOR', incrementMinutes });
      const mins = rounded.getUTCHours() * 60 + rounded.getUTCMinutes();
      expect(mins % incrementMinutes).toBe(0);
    });
  }
});
