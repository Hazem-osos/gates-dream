import { createItemSchema, updateItemSchema } from '../../modules/inventory/schemas/item.schema';

describe('item persist schema', () => {
  it('accepts a typical card payload with empty ids and leftover assembly rows', () => {
    const parsed = createItemSchema.parse({
      arabicName: 'قميص',
      englishName: '',
      mainAccountId: '',
      categoryId: '',
      baseUnitId: '',
      defaultWarehouseId: '',
      weight: Number.NaN,
      priceMode: '',
      assemblyComponents: [
        {
          itemId: null,
          itemName: 'قماش',
          unitId: '',
          quantity: '2',
          cost: '10',
        },
      ],
    });
    expect(parsed.arabicName).toBe('قميص');
    expect(parsed.mainAccountId).toBeNull();
    expect(parsed.categoryId).toBeNull();
    expect(parsed.weight).toBeNull();
    expect(parsed.priceMode).toBeNull();
    expect(parsed.assemblyComponents?.[0]?.itemId).toBeNull();
  });

  it('lets an update omit assembly kind', () => {
    const parsed = updateItemSchema.parse({
      arabicName: 'قميص معدل',
    });
    expect(parsed.arabicName).toBe('قميص معدل');
    expect(parsed.isAssembly).toBeUndefined();
  });
});
