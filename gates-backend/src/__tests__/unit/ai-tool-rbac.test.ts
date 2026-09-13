import { AiToolRegistry } from '../../modules/ai/tools/ai-tool-registry';
import {
  AI_TOOL_PERMISSION_DENIED_AR,
  isAiToolAllowed,
} from '../../modules/ai/tools/ai-tool-access';
import { CostCenterProjectsTool } from '../../modules/ai/tools/cost-center-projects.tool';
import { FinancialOverviewTool } from '../../modules/ai/tools/financial-overview.tool';
import { GetProfitAndLossSummaryTool } from '../../modules/ai/tools/get-profit-and-loss-summary.tool';
import { HrPayrollTool } from '../../modules/ai/tools/hr-payroll.tool';
import { UniversalRecordLookupTool } from '../../modules/ai/tools/universal-record-lookup.tool';
import { CfoWhatIfTool } from '../../modules/ai/tools/simulator/cfo-what-if.tool';
import type { SecurityContext } from '../../modules/ai/tools/types';

function ctx(overrides: Partial<SecurityContext> = {}): SecurityContext {
  return {
    userId: 'user-1',
    companyId: '11111111-1111-4111-8111-111111111111',
    permissions: ['item:view', 'warehouse:view'],
    roles: ['inventory_manager'],
    ...overrides,
  };
}

describe('AI tool RBAC masking', () => {
  it('hides payroll and net-profit tools from cashier / warehouse roles', () => {
    const payroll = new HrPayrollTool();
    const pnl = new GetProfitAndLossSummaryTool({ getIncomeStatement: jest.fn() });
    const lookup = new UniversalRecordLookupTool();
    const warehouse = ctx();

    expect(isAiToolAllowed(payroll, warehouse)).toBe(false);
    expect(isAiToolAllowed(pnl, warehouse)).toBe(false);
    expect(isAiToolAllowed(lookup, warehouse)).toBe(true);

    const owner = ctx({ roles: ['OWNER'], permissions: ['*'] });
    expect(isAiToolAllowed(payroll, owner)).toBe(true);
    expect(isAiToolAllowed(pnl, owner)).toBe(true);
  });

  it('does not execute a denied tool query — returns the Arabic policy error', async () => {
    const getIncomeStatement = jest.fn();
    const registry = new AiToolRegistry().register(
      new GetProfitAndLossSummaryTool({ getIncomeStatement })
    );
    const cashier = ctx({ roles: ['cashier'], permissions: ['invoice:view'] });

    expect(registry.functionDefinitions(cashier).map((row) => row.function.name)).not.toContain(
      'getProfitAndLossSummary'
    );
    expect(registry.isAvailable('getProfitAndLossSummary', cashier)).toBe(false);

    const result = await registry.execute('getProfitAndLossSummary', {}, cashier);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('PERMISSION_DENIED');
      expect(result.message).toBe(AI_TOOL_PERMISSION_DENIED_AR);
    }
    expect(getIncomeStatement).not.toHaveBeenCalled();
  });

  it('lets OWNER / SUPER_ADMIN receive financial tools in the OpenAI schema', () => {
    const registry = new AiToolRegistry()
      .register(new GetProfitAndLossSummaryTool({ getIncomeStatement: jest.fn() }))
      .register(new HrPayrollTool());
    const owner = ctx({ roles: ['SUPER_ADMIN'], permissions: ['report:view', 'payroll:view'] });
    const names = registry.functionDefinitions(owner).map((row) => row.function.name);
    expect(names).toEqual(expect.arrayContaining(['getProfitAndLossSummary', 'hr_payroll_tool']));
  });

  it('lets OWNER call financial overview and cost-center tools; cashier cannot', () => {
    const overview = new FinancialOverviewTool(
      { getSafes: jest.fn() },
      { getBankAccounts: jest.fn() }
    );
    const costCenters = new CostCenterProjectsTool({ getCostCenterReport: jest.fn() });
    const owner = ctx({ roles: ['OWNER'], permissions: ['report:view'] });
    const cashier = ctx({ roles: ['cashier'], permissions: ['invoice:view'] });

    expect(isAiToolAllowed(overview, owner)).toBe(true);
    expect(isAiToolAllowed(costCenters, owner)).toBe(true);
    expect(isAiToolAllowed(overview, cashier)).toBe(false);
    expect(isAiToolAllowed(costCenters, cashier)).toBe(false);
  });

  it('restricts cfo_what_if_tool to OWNER / SUPER_ADMIN / FINANCIAL_DIRECTOR', () => {
    const tool = new CfoWhatIfTool();
    const owner = ctx({ roles: ['OWNER'], permissions: ['report:view'] });
    const director = ctx({ roles: ['FINANCIAL_DIRECTOR'], permissions: ['report:view'] });
    const accountant = ctx({ roles: ['accountant'], permissions: ['report:view'] });
    const cashier = ctx({ roles: ['cashier'], permissions: ['report:view'] });

    expect(isAiToolAllowed(tool, owner)).toBe(true);
    expect(isAiToolAllowed(tool, director)).toBe(true);
    expect(isAiToolAllowed(tool, accountant)).toBe(false);
    expect(isAiToolAllowed(tool, cashier)).toBe(false);
  });
});
