import { InsightSeverity } from '@prisma/client';
import { evaluateCashFlowRisk } from '../../modules/ai/proactive/detectors/cash-flow-risk.detector';
import { isReceivableRisk } from '../../modules/ai/proactive/detectors/receivables-risk.detector';
import { daysOfCover } from '../../modules/ai/proactive/detectors/stock-runout.detector';
import { marginDropped, marginPercent } from '../../modules/ai/proactive/detectors/project-margin.detector';
import { GetMorningBriefingTool } from '../../modules/ai/tools/get-morning-briefing.tool';
import { GetCustomerStatementTool } from '../../modules/ai/tools/get-customer-statement.tool';
import type { SecurityContext } from '../../modules/ai/tools/types';

const COMPANY_A = '11111111-1111-4111-8111-111111111111';
const COMPANY_B = '22222222-2222-4222-8222-222222222222';

function context(overrides: Partial<SecurityContext> = {}): SecurityContext {
  return {
    userId: 'user-a',
    companyId: COMPANY_A,
    permissions: ['report:view'],
    ...overrides,
  };
}

describe('Gates AI proactive CFO', () => {
  it('flags cash-flow CRITICAL when obligations exceed 110% of liquid cash', () => {
    expect(evaluateCashFlowRisk({ currentLiquidCash: 100, upcomingObligations: 111 }).severity).toBe(
      InsightSeverity.CRITICAL
    );
    expect(evaluateCashFlowRisk({ currentLiquidCash: 100, upcomingObligations: 105 }).severity).toBe(
      InsightSeverity.WARNING
    );
    expect(evaluateCashFlowRisk({ currentLiquidCash: 100, upcomingObligations: 90 }).flagged).toBe(false);
  });

  it('flags receivables overdue > 45 days or over credit limit', () => {
    expect(
      isReceivableRisk({
        customerId: 'c1',
        customerName: 'عميل',
        overdue45: 500,
        openBalance: 500,
        creditLimit: 10_000,
      })
    ).toBe(true);
    expect(
      isReceivableRisk({
        customerId: 'c2',
        customerName: 'عميل',
        overdue45: 0,
        openBalance: 12_000,
        creditLimit: 10_000,
      })
    ).toBe(true);
    expect(
      isReceivableRisk({
        customerId: 'c3',
        customerName: 'عميل',
        overdue45: 0,
        openBalance: 200,
        creditLimit: 10_000,
      })
    ).toBe(false);
  });

  it('computes stock days of cover from 30-day velocity', () => {
    expect(daysOfCover(70, 300)).toBeCloseTo(7);
    expect(daysOfCover(70, 0)).toBeNull();
    expect(daysOfCover(20, 300)).toBeLessThanOrEqual(7);
  });

  it('flags project margin drop of more than 5 points', () => {
    const baseline = marginPercent(1000, 700);
    const current = marginPercent(1000, 800);
    expect(baseline).toBeCloseTo(30);
    expect(current).toBeCloseTo(20);
    expect(marginDropped(baseline, current)).toBe(true);
    expect(marginDropped(30, 26)).toBe(false);
  });

  it('getMorningBriefing uses JWT companyId only', async () => {
    const listActive = jest.fn().mockResolvedValue([]);
    const tool = new GetMorningBriefingTool({ listActive });
    const result = await tool.execute({ companyId: COMPANY_B }, context());
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { found: boolean };
      expect(data.found).toBe(false);
    }
    expect(listActive).toHaveBeenCalledWith(COMPANY_A);
    expect(listActive.mock.calls[0][0]).not.toBe(COMPANY_B);
  });

  it('customer statement refuses another customer when bound', async () => {
    const getSummary = jest.fn();
    const listInvoices = jest.fn();
    const tool = new GetCustomerStatementTool({ getSummary }, { listInvoices });
    const result = await tool.execute(
      { customerId: '44444444-4444-4444-8444-444444444444', startDate: '2026-09-01', endDate: '2026-09-07' },
      context({ boundCustomerId: '33333333-3333-4333-8333-333333333333' })
    );
    expect(result.ok).toBe(false);
    expect(getSummary).not.toHaveBeenCalled();
  });
});
