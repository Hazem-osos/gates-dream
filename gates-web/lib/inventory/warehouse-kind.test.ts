import { warehouseEmptyStockAccountsMessage } from './warehouse-kind';

describe('warehouseEmptyStockAccountsMessage', () => {
  it('returns null when both accounts are set', () => {
    expect(
      warehouseEmptyStockAccountsMessage({
        inventoryAccountId: 'inv',
        costAccountId: 'cogs',
      })
    ).toBeNull();
  });

  it('names the empty inventory account', () => {
    expect(
      warehouseEmptyStockAccountsMessage({
        inventoryAccountId: '  ',
        costAccountId: 'cogs',
      })
    ).toContain('حساب المخزون فارغ');
  });

  it('names the empty COGS account', () => {
    expect(
      warehouseEmptyStockAccountsMessage({
        inventoryAccountId: 'inv',
        costAccountId: '',
      })
    ).toContain('حساب تكلفة البضاعة المباعة فارغ');
  });

  it('names both empty accounts', () => {
    expect(warehouseEmptyStockAccountsMessage({})).toContain(
      'حساب المخزون وحساب تكلفة البضاعة المباعة فارغان'
    );
  });
});
