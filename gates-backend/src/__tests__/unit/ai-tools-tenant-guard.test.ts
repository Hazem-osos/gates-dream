import { GetCustomerStatementTool } from '../../modules/ai/tools/get-customer-statement.tool';
import { GetInventoryStatusTool } from '../../modules/ai/tools/get-inventory-status.tool';
import { GetSalesSummaryTool } from '../../modules/ai/tools/get-sales-summary.tool';
import type { SecurityContext } from '../../modules/ai/tools/types';

const COMPANY_A = '11111111-1111-4111-8111-111111111111';
const COMPANY_B = '22222222-2222-4222-8222-222222222222';
const CUSTOMER_ID = '33333333-3333-4333-8333-333333333333';

function context(overrides: Partial<SecurityContext> = {}): SecurityContext {
  return {
    userId: 'user-a',
    companyId: COMPANY_A,
    branchId: 'branch-a',
    permissions: ['report:view', 'customer:view'],
    ...overrides,
  };
}

describe('AI tools tenant guard', () => {
  it('getSalesSummary never forwards an LLM companyId; queries use JWT company only', async () => {
    const getSalesReport = jest.fn().mockResolvedValue({
      data: [{ taxAmount: 15 }],
      summary: { totalInvoices: 1, totalSales: 100, totalQuantity: 2 },
    });
    const tool = new GetSalesSummaryTool({ getSalesReport });

    const result = await tool.execute(
      {
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
        companyId: COMPANY_B,
        tenantId: COMPANY_B,
        company_id: COMPANY_B,
        userId: 'user-from-llm',
        user_id: 'user-from-llm',
      },
      context()
    );

    expect(result.ok).toBe(true);
    expect(getSalesReport).toHaveBeenCalledTimes(1);
    const filters = getSalesReport.mock.calls[0][0];
    expect(filters.companyId).toBe(COMPANY_A);
    expect(filters.companyId).not.toBe(COMPANY_B);
    expect(filters).not.toHaveProperty('tenantId');
    expect(filters).not.toHaveProperty('company_id');
    expect(JSON.stringify(filters)).not.toContain(COMPANY_B);
    expect(JSON.stringify(filters)).not.toContain('user-from-llm');
    expect(filters).not.toHaveProperty('userId');
  });

  it('getCustomerStatement blocks execution without permission and never queries another company', async () => {
    const getSummary = jest.fn().mockResolvedValue({
      partyId: CUSTOMER_ID,
      displayName: 'عميل أ',
      code: 'C-1',
      balance: 50,
      creditLimit: 100,
      openInvoicesCount: 1,
      riskBadge: 'regular',
    });
    const listInvoices = jest.fn().mockResolvedValue({ invoices: [] });
    const tool = new GetCustomerStatementTool({ getSummary }, { listInvoices });

    const denied = await tool.execute(
      { customerId: CUSTOMER_ID, companyId: COMPANY_B },
      context({ permissions: ['report:view'] })
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error).toBe('PERMISSION_DENIED');
    }
    expect(getSummary).not.toHaveBeenCalled();
    expect(listInvoices).not.toHaveBeenCalled();

    const allowed = await tool.execute(
      { customerId: CUSTOMER_ID, companyId: COMPANY_B, tenantId: COMPANY_B },
      context()
    );
    expect(allowed.ok).toBe(true);
    expect(getSummary).toHaveBeenCalledWith(COMPANY_A, CUSTOMER_ID, 'CUSTOMER');
    expect(listInvoices).toHaveBeenCalledWith(
      COMPANY_A,
      expect.objectContaining({ customerId: CUSTOMER_ID })
    );
    expect(getSummary.mock.calls[0][0]).not.toBe(COMPANY_B);
    expect(listInvoices.mock.calls[0][0]).not.toBe(COMPANY_B);
  });

  it('getInventoryStatus uses JWT companyId and treats orderLimit as reorder point', async () => {
    const getInventoryReport = jest.fn().mockResolvedValue({
      data: [
        {
          itemId: 'item-1',
          warehouseId: 'wh-1',
          quantity: 3,
          item: { id: 'item-1', arabicName: 'أسمنت', orderLimit: 10, lowerLimit: 2 },
          warehouse: { id: 'wh-1', arabicName: 'المخزن الرئيسي' },
        },
        {
          itemId: 'item-2',
          warehouseId: 'wh-1',
          quantity: 40,
          item: { id: 'item-2', arabicName: 'حديد', orderLimit: 10, lowerLimit: 5 },
          warehouse: { id: 'wh-1', arabicName: 'المخزن الرئيسي' },
        },
      ],
      summary: { totalItems: 2, totalQuantity: 43, totalValue: 100 },
    });
    const getItemsExceedingOrderLimitReport = jest.fn().mockResolvedValue({
      data: [
        {
          currentQuantity: 3,
          orderLimit: 10,
          item: { id: 'item-1', arabicName: 'أسمنت', orderLimit: 10 },
          warehouse: { id: 'wh-1', arabicName: 'المخزن الرئيسي' },
        },
      ],
      summary: { totalItems: 1 },
    });
    const tool = new GetInventoryStatusTool({ getInventoryReport, getItemsExceedingOrderLimitReport });

    const result = await tool.execute(
      { companyId: COMPANY_B, lowStockOnly: true },
      context({ permissions: ['item:view'] })
    );

    expect(result.ok).toBe(true);
    expect(getInventoryReport).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_A }),
      expect.any(Object)
    );
    expect(getItemsExceedingOrderLimitReport).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_A }),
      expect.any(Object)
    );
    expect(JSON.stringify(getInventoryReport.mock.calls[0][0])).not.toContain(COMPANY_B);
    if (result.ok) {
      const data = result.data as {
        lowStockCount: number;
        lowStock: Array<{ itemName: string; quantity: number; orderLimit: number; reason: string }>;
      };
      expect(data.lowStockCount).toBe(1);
      expect(data.lowStock[0]).toEqual(
        expect.objectContaining({
          itemName: 'أسمنت',
          quantity: 3,
          orderLimit: 10,
          reason: 'below_reorder',
        })
      );
    }
  });

  it('getInventoryStatus returns an error payload instead of throwing', async () => {
    const tool = new GetInventoryStatusTool({
      getInventoryReport: jest.fn().mockRejectedValue(new Error('Unknown field reorderPoint')),
    });

    const result = await tool.execute({}, context({ permissions: ['item:view'] }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { error?: string; lowStock: unknown[] };
      expect(data.error).toMatch(/reorderPoint|Inventory query failed/i);
      expect(data.lowStock).toEqual([]);
    }
  });
});
