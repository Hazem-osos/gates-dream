import { asMoney, average, daysBetween, median, priorityFromAmount } from '../../modules/growth/money';
import { enrichDiagnosticProbesWithGrowth } from '../../modules/growth/services/growth-rating';
import type { DiagnosticProbeResult } from '../../modules/ai/diagnostic/diagnostic.types';

function probe(key: DiagnosticProbeResult['key']): DiagnosticProbeResult {
  return {
    key,
    labelAr: key,
    licenseCode: null,
    score: 80,
    weight: 15,
    status: 'stable',
    metrics: [],
    findings: ['أساس'],
    actions: [],
  };
}

describe('Growth money helpers', () => {
  it('rounds money to two decimals', () => {
    expect(asMoney('12.345')).toBe(12.35);
    expect(asMoney(undefined)).toBe(0);
  });

  it('computes median and average', () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(average([10, 20])).toBe(15);
  });

  it('counts whole days', () => {
    expect(daysBetween(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-11T00:00:00Z'))).toBe(10);
  });

  it('maps amounts to priority bands', () => {
    expect(priorityFromAmount(250_000, 200_000, 50_000, 10_000)).toBe('CRITICAL');
    expect(priorityFromAmount(60_000, 200_000, 50_000, 10_000)).toBe('HIGH');
    expect(priorityFromAmount(12_000, 200_000, 50_000, 10_000)).toBe('MEDIUM');
    expect(priorityFromAmount(100, 200_000, 50_000, 10_000)).toBe('LOW');
  });
});

describe('Growth rating enrichment', () => {
  it('does not invent findings when no open opportunities exist', () => {
    const sales = probe('sales');
    const next = enrichDiagnosticProbesWithGrowth([sales], {
      potentialValue: 0,
      breakdown: { revenue: 0, cashRecovery: 0, inventory: 0, savings: 0 },
      counts: { open: 0 },
    });
    expect(next[0].findings).toEqual(['أساس']);
  });

  it('feeds cash recovery into the sales probe without changing the score', () => {
    const sales = probe('sales');
    const next = enrichDiagnosticProbesWithGrowth([sales], {
      potentialValue: 80_000,
      breakdown: { revenue: 10_000, cashRecovery: 70_000, inventory: 0, savings: 0 },
      counts: { open: 2 },
    });
    expect(next[0].score).toBe(80);
    expect(next[0].findings.some((f) => f.includes('محرك النمو') && f.includes('مستحقات'))).toBe(true);
    expect(next[0].actions.some((a) => a.href === '/growth')).toBe(true);
  });
});
