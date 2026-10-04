import { describe, expect, it } from 'vitest';
import { forecastFinishDate, linearScheduleFraction, safeRatio } from '../../modules/contracting/execution/project-execution-progress.util';

describe('project execution progress util', () => {
  it('linearScheduleFraction clamps endpoints', () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const finish = new Date('2026-01-31T00:00:00.000Z');
    expect(linearScheduleFraction(new Date('2025-12-01'), start, finish)).toBe(0);
    expect(linearScheduleFraction(new Date('2026-02-01'), start, finish)).toBe(1);
    const mid = new Date('2026-01-16T00:00:00.000Z');
    const f = linearScheduleFraction(mid, start, finish);
    expect(f).toBeGreaterThan(0.45);
    expect(f).toBeLessThan(0.55);
  });

  it('safeRatio handles zero denominator', () => {
    expect(safeRatio(1, 0)).toBeNull();
    expect(safeRatio(480, 600)).toBeCloseTo(0.8, 6);
  });

  it('forecastFinishDate scales remaining duration', () => {
    const asOf = new Date('2026-02-01T00:00:00.000Z');
    const finish = new Date('2026-04-01T00:00:00.000Z');
    const { date, method } = forecastFinishDate(asOf, finish, 50, 25);
    expect(method).toContain('REMAINING_DURATION');
    expect(date!.getTime()).toBeGreaterThan(finish.getTime());
  });
});

describe('EVM decimal policy (P3 E2E reference)', () => {
  it('matches spec CPI/SPI/CV/SV', () => {
    const pv = 600_000;
    const ev = 480_000;
    const ac = 550_000;
    expect(safeRatio(ev, pv)).toBeCloseTo(0.8, 6);
    expect(safeRatio(ev, ac)).toBeCloseTo(0.872727, 4);
    expect(ev - pv).toBe(-120_000);
    expect(ev - ac).toBe(-70_000);
  });
});
