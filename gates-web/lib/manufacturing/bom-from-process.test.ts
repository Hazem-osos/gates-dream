import { describe, expect, it } from 'vitest';
import { createEmptyLoadedProcess } from '@/lib/manufacturing/process-from-bom';
import { buildBomCreatePayloadFromProcess } from '@/lib/manufacturing/bom-from-process';

describe('buildBomCreatePayloadFromProcess', () => {
  it('returns null until there is a finished item and a raw line', () => {
    expect(
      buildBomCreatePayloadFromProcess({
        name: 'x',
        plannedQuantity: 1,
        process: createEmptyLoadedProcess({}),
      })
    ).toBeNull();
  });

  it('builds a BOM from typed operation lines', () => {
    const process = createEmptyLoadedProcess({});
    process.outputs = [
      {
        itemId: 'fg-1',
        itemName: 'باب',
        quantity: 2,
        unit: 'قطعة',
        unitPrice: 10,
        lineTotal: 20,
        costPercent: 100,
        warehouseId: 'wh-f',
      },
    ];
    process.raws = [
      {
        itemId: 'rm-1',
        itemName: 'خشب',
        quantity: 5,
        unit: 'م',
        unitPrice: 3,
        lineTotal: 15,
        warehouseId: 'wh-r',
        manufacturedItemId: '',
      },
    ];
    const payload = buildBomCreatePayloadFromProcess({
      name: 'نموذج الباب',
      plannedQuantity: 2,
      process,
    });
    expect(payload?.finishedItemId).toBe('fg-1');
    expect(payload?.baseQuantity).toBe(2);
    expect(payload?.lines).toEqual([
      {
        rawItemId: 'rm-1',
        quantity: 5,
        scrapPercentage: 0,
        lineOrder: 1,
        warehouseId: 'wh-r',
        manufacturedItemId: undefined,
      },
    ]);
  });
});
