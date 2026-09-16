import {
  parseInventorySystem,
  pickInventoryAccount,
} from '../../modules/inventory/utils/inventory-system';

describe('inventory system', () => {
  it('treats periodic aliases as periodic and everything else as perpetual', () => {
    expect(parseInventorySystem('PERIODIC')).toBe('PERIODIC');
    expect(parseInventorySystem('دوري')).toBe('PERIODIC');
    expect(parseInventorySystem('PERPETUAL')).toBe('PERPETUAL');
    expect(parseInventorySystem(undefined)).toBe('PERPETUAL');
  });

  it('uses the company account in periodic and the warehouse account in perpetual', () => {
    expect(pickInventoryAccount('PERIODIC', 'company', 'warehouse', 'item')).toBe('company');
    expect(pickInventoryAccount('PERPETUAL', 'company', 'warehouse', 'item')).toBe('warehouse');
    expect(pickInventoryAccount('PERPETUAL', 'company', null, 'item')).toBe('item');
    expect(pickInventoryAccount('PERPETUAL', 'company', null, null)).toBe('company');
  });
});
