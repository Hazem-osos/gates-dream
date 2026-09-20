import { pickDefaultWarehousePlan } from '../../modules/inventory/services/ensure-default-warehouse';

describe('default warehouse tree', () => {
  it('creates a HEADER folder plus a POSTING child when the company is empty', () => {
    expect(pickDefaultWarehousePlan([])).toEqual({ type: 'create-both' });
  });

  it('reuses an existing رئيسي فرعي folder and its حركة child', () => {
    expect(
      pickDefaultWarehousePlan([
        { id: 'header', parentWarehouseId: null, warehouseKind: 'HEADER' },
        { id: 'posting', parentWarehouseId: 'header', warehouseKind: 'POSTING' },
      ])
    ).toEqual({ type: 'use-tree', headerId: 'header', postingId: 'posting' });
  });

  it('adds a حركة child under a folder that has no operations warehouse yet', () => {
    expect(
      pickDefaultWarehousePlan([{ id: 'header', parentWarehouseId: null, warehouseKind: 'HEADER' }])
    ).toEqual({ type: 'add-posting', headerId: 'header' });
  });

  it('wraps a legacy root حركة warehouse under a new رئيسي فرعي folder', () => {
    expect(
      pickDefaultWarehousePlan([{ id: 'legacy', parentWarehouseId: null, warehouseKind: 'POSTING' }])
    ).toEqual({ type: 'wrap-posting', postingId: 'legacy' });
  });
});
