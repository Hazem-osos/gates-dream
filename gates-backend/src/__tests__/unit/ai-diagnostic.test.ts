import { DiagnosticService } from '../../modules/ai/diagnostic/diagnostic.service';
import {
  healthStatus,
  healthStatusLabel,
  isNarrativeGrounded,
  resolveActiveProbes,
  weightedHealthScore,
} from '../../modules/ai/diagnostic/diagnostic.math';
import { evaluateFinancial, evaluateSales } from '../../modules/ai/diagnostic/diagnostic.probes';
import {
  buildFallbackNarrative,
  synthesizeDiagnosticNarrative,
  toCompactDiagnostic,
} from '../../modules/ai/diagnostic/synthesize-diagnostic';
import type { DiagnosticPorts } from '../../modules/ai/diagnostic/diagnostic.ports';
import type { AIProvider } from '../../modules/ai/interfaces/ai-provider';
import type { DiagnosticReport } from '../../modules/ai/diagnostic/diagnostic.types';

function mockProvider(content: string | null): AIProvider {
  return {
    name: 'mock',
    complete: jest.fn().mockResolvedValue({
      role: 'assistant',
      content,
      finishReason: 'stop',
      model: 'gpt-5.6-luna',
    }),
    stream: async function* () {},
  };
}

function idlePorts(overrides: Partial<DiagnosticPorts> = {}): DiagnosticPorts {
  return {
    getCurrent: jest.fn().mockResolvedValue({ unrestricted: true, allowedModules: [] }),
    liquidCash: jest.fn().mockResolvedValue({ treasuryTotal: 100, bankTotal: 100 }),
    periodSales: jest.fn().mockResolvedValue(1000),
    periodPurchases: jest.fn().mockResolvedValue(400),
    openReceivables: jest.fn().mockResolvedValue({ total: 200, overdue: 20, overdue90: 0 }),
    openPayables: jest.fn().mockResolvedValue(50),
    inventoryValue: jest.fn().mockResolvedValue(300),
    customerRevenue: jest.fn().mockResolvedValue([
      { customerId: 'c1', customerName: 'عميل أ', revenue: 400 },
      { customerId: 'c2', customerName: 'عميل ب', revenue: 300 },
      { customerId: 'c3', customerName: 'عميل ج', revenue: 200 },
      { customerId: 'c4', customerName: 'عميل د', revenue: 100 },
    ]),
    stockItems: jest.fn().mockResolvedValue([]),
    cogs: jest.fn().mockResolvedValue(200),
    belowReplacementSales: jest.fn().mockResolvedValue([]),
    contractingProjects: jest.fn().mockResolvedValue([]),
    production: jest.fn().mockResolvedValue({
      plannedQuantity: 0,
      actualQuantity: 0,
      standardMaterialQty: 0,
      issuedMaterialQty: 0,
    }),
    realEstate: jest.fn().mockResolvedValue({
      totalUnits: 0,
      absorbedUnits: 0,
      dueInstallments: 0,
      overdueInstallments: 0,
    }),
    latestPayroll: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('Diagnostic scoring and license joker', () => {
  it('categorizes 85+ / 70-84 / <70', () => {
    expect(healthStatus(85)).toBe('excellent');
    expect(healthStatusLabel(90)).toBe('ممتاز');
    expect(healthStatus(70)).toBe('stable');
    expect(healthStatusLabel(72)).toBe('مستقر مع ملاحظات');
    expect(healthStatus(69)).toBe('critical');
    expect(healthStatusLabel(40)).toBe('يحتاج تدخل فوري');
  });

  it('weights only active probes', () => {
    expect(weightedHealthScore([{ score: 100, weight: 25 }, { score: 40, weight: 15 }])).toBe(78);
  });

  it('always runs financial and skips unlicensed verticals', () => {
    const restricted = resolveActiveProbes({
      unrestricted: false,
      allowedModules: ['ACCOUNTING', 'CONTRACTING'],
    });
    expect(restricted.active).toEqual(['financial', 'contracting']);
    expect(restricted.skipped).toEqual(['sales', 'inventory', 'manufacturing', 'real-estate', 'hr']);

    const open = resolveActiveProbes({ unrestricted: true, allowedModules: [] });
    expect(open.active).toHaveLength(7);
    expect(open.skipped).toEqual([]);
  });

  it('sales probe flags extreme concentration', () => {
    const result = evaluateSales({
      customers: [
        { customerId: 'c1', customerName: 'عميل أ', revenue: 900 },
        { customerId: 'c2', customerName: 'عميل ب', revenue: 50 },
        { customerId: 'c3', customerName: 'عميل ج', revenue: 50 },
      ],
      receivables: 800,
      overdue: 400,
      overdue90: 200,
      sales90: 1000,
    });
    expect(result.metrics.find((row) => row.id === 'concentration')?.value).toBe(100);
    expect(result.score).toBeLessThan(70);
    expect(result.actions[0].href).toBe('/sales');
  });

  it('financial probe rewards coverage and working capital', () => {
    const healthy = evaluateFinancial({
      liquid: 6000,
      sales30: 2000,
      purchases30: 800,
      receivables: 400,
      payables: 100,
      inventoryValue: 500,
    });
    expect(healthy.score).toBeGreaterThanOrEqual(70);
  });
});

describe('DiagnosticService module isolation', () => {
  it('does not call contracting/manufacturing ports when those modules are off', async () => {
    const ports = idlePorts({
      getCurrent: jest.fn().mockResolvedValue({
        unrestricted: false,
        allowedModules: ['ACCOUNTING', 'INVENTORY'],
      }),
    });
    const service = new DiagnosticService(ports, mockProvider(null));
    const report = await service.buildReport('co-1', new Date('2026-09-07T08:00:00.000Z'));

    expect(report.evaluatedModules.map((row) => row.key)).toEqual(['financial', 'sales', 'inventory']);
    expect(report.skippedModules.map((row) => row.key)).toEqual([
      'contracting',
      'manufacturing',
      'real-estate',
      'hr',
    ]);
    expect(ports.contractingProjects).not.toHaveBeenCalled();
    expect(ports.production).not.toHaveBeenCalled();
    expect(ports.realEstate).not.toHaveBeenCalled();
    expect(ports.latestPayroll).not.toHaveBeenCalled();
    expect(ports.customerRevenue).toHaveBeenCalled();
    expect(ports.stockItems).toHaveBeenCalled();
  });
});

describe('Diagnostic narrative grounding', () => {
  const compact = toCompactDiagnostic({
    asOf: '2026-09-07',
    companyHealthScore: 78,
    statusLabel: 'مستقر مع ملاحظات',
    evaluatedModules: [
      { key: 'financial', labelAr: 'المحاسبة' },
      { key: 'sales', labelAr: 'المبيعات' },
    ],
    probes: [
      {
        key: 'financial',
        labelAr: 'المحاسبة',
        licenseCode: null,
        score: 80,
        weight: 25,
        status: 'stable',
        metrics: [{ id: 'coverage', label: 'تغطية', value: 3, unit: 'months', score: 80 }],
        findings: ['تغطية الحرق 3 أشهر.'],
        actions: [{ label: 'فتح الخزينة', href: '/accounting' }],
      },
    ],
  } as DiagnosticReport);

  it('fallback stays inside payload numbers', () => {
    const { briefing, decisions } = buildFallbackNarrative(compact);
    expect(briefing).toContain('78');
    expect(briefing).toContain('المحاسبة');
    expect(isNarrativeGrounded(briefing, compact)).toBe(true);
    expect(decisions[0].href).toBe('/accounting');
  });

  it('rejects hallucinated amounts', async () => {
    const result = await synthesizeDiagnosticNarrative(
      mockProvider('{"briefing":"العجز 999999","decisions":[]}'),
      compact
    );
    expect(result.source).toBe('fallback');
    expect(result.briefing).not.toContain('999999');
  });
});
