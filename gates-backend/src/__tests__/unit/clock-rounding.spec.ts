import { interpretClockInstant } from '../../modules/hr/services/time/clock-rounding.util';

describe('clock rounding', () => {
  it('rounds nearest 15 minutes in local TZ', () => {
    const instant = new Date('2026-06-01T09:07:00.000Z');
    const rounded = interpretClockInstant(instant, 'UTC', {
      mode: 'NEAREST',
      incrementMinutes: 15,
    });
    expect(rounded.toISOString()).toBe('2026-06-01T09:00:00.000Z');
  });

  it('NONE keeps instant', () => {
    const instant = new Date('2026-06-01T09:07:00.000Z');
    expect(interpretClockInstant(instant, 'UTC', { mode: 'NONE', incrementMinutes: 15 }).getTime()).toBe(
      instant.getTime()
    );
  });
});
