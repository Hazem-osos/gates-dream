import { resolveCreateWarehouseKind } from '../../modules/inventory/utils/warehouse-kind';

describe('warehouse kind', () => {
  it('defaults a root warehouse to HEADER', () => {
    expect(resolveCreateWarehouseKind({ parentWarehouseId: null })).toBe('HEADER');
    expect(resolveCreateWarehouseKind({})).toBe('HEADER');
  });

  it('lets a root stay POSTING when asked (عمليات بدون أب)', () => {
    expect(resolveCreateWarehouseKind({ warehouseKind: 'POSTING' })).toBe('POSTING');
  });

  it('lets a child be HEADER or POSTING', () => {
    expect(resolveCreateWarehouseKind({ parentWarehouseId: 'p1', warehouseKind: 'HEADER' })).toBe(
      'HEADER'
    );
    expect(resolveCreateWarehouseKind({ parentWarehouseId: 'p1', warehouseKind: 'POSTING' })).toBe(
      'POSTING'
    );
    expect(resolveCreateWarehouseKind({ parentWarehouseId: 'p1' })).toBe('POSTING');
  });
});
