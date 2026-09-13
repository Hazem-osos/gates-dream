import {
  buildFallbackNarrative,
  synthesizeSentinelNarrative,
  toCompactPayload,
} from '../../modules/ai/sentinel/synthesize-sentinel';
import {
  calendarDayLag,
  companyCashGap,
  isBackdated,
  isBelowReplacement,
  isHighVoidRate,
  isNarrativeGrounded,
  projectLocalGap,
  shouldFlagProject,
  suggestedSalePrice,
  voidRate,
} from '../../modules/ai/sentinel/sentinel.math';
import { SentinelService } from '../../modules/ai/sentinel/sentinel.service';
import type { SentinelPorts } from '../../modules/ai/sentinel/sentinel.ports';
import type { AIProvider } from '../../modules/ai/interfaces/ai-provider';

const asOf = new Date('2026-09-07T08:00:00.000Z');

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

function mockPorts(overrides: Partial<SentinelPorts> = {}): SentinelPorts {
  return {
    listInvoices: jest.fn().mockResolvedValue([]),
    listUsers: jest.fn().mockResolvedValue([]),
    listShortageWriteoffs: jest.fn().mockResolvedValue([]),
    listRecentSaleLines: jest.fn().mockResolvedValue([]),
    listLatestPurchasePrices: jest.fn().mockResolvedValue([]),
    listPendingSubcontractorCertificates: jest.fn().mockResolvedValue([]),
    listApprovedOwnerCertificates: jest.fn().mockResolvedValue([]),
    liquidCash: jest.fn().mockResolvedValue({ treasuryTotal: 0, bankTotal: 0 }),
    ...overrides,
  };
}

function mockSnapshots() {
  return {
    get: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue(undefined),
  };
}

describe('Enterprise Sentinel math', () => {
  it('flags void rate above 5% and ignores 5% exactly', () => {
    expect(voidRate(6, 100)).toBe(0.06);
    expect(isHighVoidRate(0.06)).toBe(true);
    expect(isHighVoidRate(0.05)).toBe(false);
  });

  it('flags invoices backdated more than 3 calendar days', () => {
    const created = new Date('2026-09-07T10:00:00.000Z');
    expect(calendarDayLag(created, new Date('2026-09-03T00:00:00.000Z'))).toBe(4);
    expect(isBackdated(created, new Date('2026-09-03T00:00:00.000Z'))).toBe(true);
    expect(isBackdated(created, new Date('2026-09-04T00:00:00.000Z'))).toBe(false);
  });

  it('flags sale below replacement even when above historical average cost', () => {
    expect(isBelowReplacement(120, 150)).toBe(true);
    expect(120 >= 80).toBe(true);
    expect(isBelowReplacement(150, 150)).toBe(false);
    expect(suggestedSalePrice(150)).toBe(162);
  });

  it('flags contracting projects only when local and company gaps are both positive', () => {
    expect(projectLocalGap(800, 200)).toBe(600);
    expect(companyCashGap(800, 200, 100)).toBe(500);
    expect(shouldFlagProject(600, 500)).toBe(true);
    expect(shouldFlagProject(600, 0)).toBe(false);
    expect(shouldFlagProject(0, 500)).toBe(false);
  });
});

describe('SentinelService with mocked invoices and write-offs', () => {
  it('captures void patterns, backdates, shortages, replacement gaps, and cash deficit', async () => {
    const ports = mockPorts({
      listInvoices: jest.fn().mockResolvedValue([
        {
          id: 'inv-void-1',
          invoiceNumber: 'SI-100',
          createdBy: 'user-a',
          date: new Date('2026-09-01T00:00:00.000Z'),
          createdAt: new Date('2026-09-01T12:00:00.000Z'),
          isCancelled: true,
          netAmount: 800,
        },
        {
          id: 'inv-ok',
          invoiceNumber: 'SI-101',
          createdBy: 'user-a',
          date: new Date('2026-09-02T00:00:00.000Z'),
          createdAt: new Date('2026-09-02T12:00:00.000Z'),
          isCancelled: false,
          netAmount: 200,
        },
        {
          id: 'inv-back',
          invoiceNumber: 'SI-102',
          createdBy: 'user-b',
          date: new Date('2026-08-30T00:00:00.000Z'),
          createdAt: new Date('2026-09-06T12:00:00.000Z'),
          isCancelled: false,
          netAmount: 400,
        },
      ]),
      listUsers: jest.fn().mockResolvedValue([
        { id: 'user-a', firstName: 'سامي', lastName: 'علي', username: 'sami' },
        { id: 'user-b', firstName: 'منى', lastName: 'حسن', username: 'mona' },
      ]),
      listShortageWriteoffs: jest.fn().mockResolvedValue([
        { itemId: 'item-1', itemName: 'أسمنت', itemCode: 'CEM', shortageQty: 10 },
        { itemId: 'item-1', itemName: 'أسمنت', itemCode: 'CEM', shortageQty: 4 },
      ]),
      listRecentSaleLines: jest.fn().mockResolvedValue([
        {
          invoiceId: 'inv-sale',
          invoiceNumber: 'SI-200',
          itemId: 'item-2',
          itemName: 'حديد 12',
          salePrice: 120,
          averageCost: 80,
          lastPurchasePrice: 150,
        },
      ]),
      listLatestPurchasePrices: jest.fn().mockResolvedValue([
        { itemId: 'item-2', unitPrice: 150, date: new Date('2026-09-05T00:00:00.000Z') },
      ]),
      listPendingSubcontractorCertificates: jest.fn().mockResolvedValue([
        {
          id: 'sub-1',
          projectId: 'prj-1',
          projectName: 'برج النيل',
          projectCode: 'NILE',
          netPayable: 900,
          periodEndDate: new Date('2026-09-20T00:00:00.000Z'),
        },
      ]),
      listApprovedOwnerCertificates: jest.fn().mockResolvedValue([
        {
          id: 'own-1',
          projectId: 'prj-1',
          projectName: 'برج النيل',
          projectCode: 'NILE',
          netAmount: 200,
        },
      ]),
      liquidCash: jest.fn().mockResolvedValue({ treasuryTotal: 50, bankTotal: 50 }),
    });

    const service = new SentinelService(ports, mockProvider(null), mockSnapshots() as never);
    const report = await service.buildExecutiveReport('co-1', asOf, 'live');

    expect(report.fraud.voidPatterns).toHaveLength(1);
    expect(report.fraud.voidPatterns[0].userName).toBe('سامي علي');
    expect(report.fraud.voidPatterns[0].voidRate).toBe(0.8);
    expect(report.fraud.backdated[0].invoiceNumber).toBe('SI-102');
    expect(report.fraud.backdated[0].lagDays).toBe(7);
    expect(report.fraud.shortages[0].itemName).toBe('أسمنت');
    expect(report.fraud.shortages[0].eventCount).toBe(2);
    expect(report.replacement[0].salePrice).toBe(120);
    expect(report.replacement[0].replacementCost).toBe(150);
    expect(report.replacement[0].soldAboveAverageCost).toBe(true);
    expect(report.replacement[0].suggestedSalePrice).toBe(162);
    expect(report.cashflow.companyGap).toBe(600);
    expect(report.cashflow.projects[0].projectName).toBe('برج النيل');
    expect(report.narrative).toContain('سامي علي');
    expect(report.narrative).toContain('120');
    expect(report.narrative).toContain('150');
    expect(report.narrative).not.toContain('999999');
    expect(report.narrativeSource).toBe('fallback');
  });

  it('does not invent replacement flags when sale is at or above last purchase', async () => {
    const ports = mockPorts({
      listRecentSaleLines: jest.fn().mockResolvedValue([
        {
          invoiceId: 'inv-sale',
          invoiceNumber: 'SI-201',
          itemId: 'item-2',
          itemName: 'حديد 12',
          salePrice: 160,
          averageCost: 80,
          lastPurchasePrice: 150,
        },
      ]),
      listLatestPurchasePrices: jest.fn().mockResolvedValue([
        { itemId: 'item-2', unitPrice: 150, date: new Date('2026-09-05T00:00:00.000Z') },
      ]),
    });
    const service = new SentinelService(ports, mockProvider(null), mockSnapshots() as never);
    const gaps = await service.calculateReplacementCostGaps('co-1', asOf);
    expect(gaps).toEqual([]);
  });
});

describe('Sentinel narrative grounding', () => {
  const compact = toCompactPayload({
    asOf: '2026-09-07',
    fraud: {
      voidPatterns: [
        {
          userName: 'سامي علي',
          voidRate: 0.08,
          cancelledVolume: 80,
          totalVolume: 1000,
          cancelledCount: 2,
        },
      ],
      backdated: [],
      shortages: [],
    },
    replacement: [],
    cashflow: {
      liquidTotal: 10,
      totalSubcontractorDue21d: 0,
      totalOwnerInflow21d: 0,
      companyGap: 0,
      horizonDays: 21,
      projects: [],
    },
  });

  it('fallback uses only payload facts', () => {
    const narrative = buildFallbackNarrative(compact);
    expect(narrative).toContain('سامي علي');
    expect(narrative).toContain('8');
    expect(isNarrativeGrounded(narrative, compact)).toBe(true);
  });

  it('rejects hallucinated amounts from the model', async () => {
    const result = await synthesizeSentinelNarrative(
      mockProvider('العجز الحقيقي 999999 جنيه على مشروع سري'),
      compact
    );
    expect(result.source).toBe('fallback');
    expect(result.narrative).not.toContain('999999');
    expect(isNarrativeGrounded('العجز الحقيقي 999999 جنيه', compact)).toBe(false);
  });
});
