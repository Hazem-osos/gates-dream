import { instantFromLocal, localDateParts } from '../../modules/hr/services/time/time-zone.util';
import { diffMinutesUtc } from '../../modules/hr/services/time/time-minutes.util';

describe('timezone / DST', () => {
  it('Africa/Cairo local schedule is stable', () => {
    const start = instantFromLocal(2026, 6, 1, 9, 0, 'Africa/Cairo');
    const end = instantFromLocal(2026, 6, 1, 17, 0, 'Africa/Cairo');
    expect(diffMinutesUtc(start, end)).toBe(480);
  });

  it('America/New_York spring forward day still computes elapsed minutes', () => {
    const start = instantFromLocal(2026, 3, 8, 1, 30, 'America/New_York');
    const end = instantFromLocal(2026, 3, 8, 4, 30, 'America/New_York');
    const minutes = diffMinutesUtc(start, end);
    expect(minutes).toBeGreaterThan(0);
    expect(minutes).not.toBe(180);
    const p = localDateParts(start, 'America/New_York');
    expect(p.year).toBe(2026);
  });
});
