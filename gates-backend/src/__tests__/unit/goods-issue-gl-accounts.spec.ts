import {
  pickGoodsIssueExpenseAccount,
  pickGoodsIssueInventoryAccount,
} from '../../modules/inventory/services/stock-movement-gl.service';

function mockAccounts(overrides: Partial<{
  system: 'PERPETUAL' | 'PERIODIC';
  warehouseInventoryAccountId: string | null;
  warehouseCostAccountId: string | null;
  companyInventoryAccountId: string;
  companyExpenseAccountId: string;
  inventoryAccountId: string;
  expenseAccountId: string;
}>) {
  return {
    system: 'PERPETUAL' as const,
    warehouseInventoryAccountId: 'wh-inv',
    warehouseCostAccountId: 'wh-cogs',
    companyInventoryAccountId: 'co-inv',
    companyExpenseAccountId: 'co-exp',
    inventoryAccountId: 'co-inv',
    expenseAccountId: 'co-exp',
    ...overrides,
  };
}

describe('goods issue GL account picks', () => {
  it('uses warehouse COGS and inventory in perpetual mode', () => {
    const accounts = mockAccounts({});
    expect(pickGoodsIssueExpenseAccount(accounts)).toBe('wh-cogs');
    expect(pickGoodsIssueInventoryAccount(accounts)).toBe('wh-inv');
  });

  it('falls back to company accounts when warehouse slots are empty', () => {
    const accounts = mockAccounts({
      warehouseInventoryAccountId: null,
      warehouseCostAccountId: null,
    });
    expect(pickGoodsIssueExpenseAccount(accounts)).toBe('co-exp');
    expect(pickGoodsIssueInventoryAccount(accounts)).toBe('co-inv');
  });
});
