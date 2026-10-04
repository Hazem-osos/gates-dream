import {
  assertItemPersisted,
  buildItemPersistBody,
  compactAssemblyRows,
  EMPTY_ITEM_FORM,
  mergeItemCardForm,
} from '../../app/inventory/creations/item-card/itemCard.model';

describe('assertItemPersisted', () => {
  it('accepts the card the server wrote', () => {
    const saved = assertItemPersisted(
      { arabicName: 'كابل', serial: '12' },
      { id: 'item-1', arabicName: 'كابل', serial: '12' }
    );
    expect(saved.id).toBe('item-1');
  });

  it('rejects a saved toast when the name did not stick', () => {
    expect(() =>
      assertItemPersisted(
        { arabicName: 'كابل جديد' },
        { id: 'item-1', arabicName: 'كابل قديم' }
      )
    ).toThrow('التعديل لم يُحفظ');
  });
});

describe('buildItemPersistBody', () => {
  const base = {
    form: mergeItemCardForm({ arabicName: 'قميص', englishName: undefined as unknown as string }),
    itemType: 'normal',
    itemAuto: true,
    companyPriceSource: 'price_list' as const,
    baseUnitId: 'not-a-uuid',
    assemblyRows: [
      {
        itemId: 'pending',
        itemName: 'قماش',
        unitId: '',
        unitName: '',
        conversionFactor: '',
        quantity: '2',
        cost: '10',
      },
    ],
    supplierRows: [],
    etaProfile: null,
    includeAssemblyKind: true,
  };

  it('keeps the Arabic name and drops invalid ids so create is not rejected', () => {
    const body = buildItemPersistBody(base);
    expect(body.arabicName).toBe('قميص');
    expect(body.serial).toBeUndefined();
    expect(body.baseUnitId).toBeUndefined();
    expect(body.mainAccountId).toBeNull();
    expect(body.isAssembly).toBe(false);
    expect(body.assemblyComponents).toEqual([
      {
        itemId: null,
        itemName: 'قماش',
        unitId: null,
        unitName: null,
        conversionFactor: null,
        quantity: '2',
        cost: '10',
      },
    ]);
  });

  it('omits assembly kind on update so a leftover toggle cannot 409', () => {
    const body = buildItemPersistBody({ ...base, includeAssemblyKind: false });
    expect(body.isAssembly).toBeUndefined();
  });

  it('sends a manual serial only when auto numbering is off', () => {
    const body = buildItemPersistBody({
      ...base,
      itemAuto: false,
      form: mergeItemCardForm({ arabicName: 'قميص', serial: 'A-9' }),
    });
    expect(body.serial).toBe('A-9');
  });
});

describe('compactAssemblyRows', () => {
  it('nulls leftover non-uuid item ids', () => {
    expect(
      compactAssemblyRows([
        {
          itemId: 'tmp-1',
          itemName: 'خامة',
          unitId: 'x',
          unitName: 'قطعة',
          conversionFactor: '1',
          quantity: '1',
          cost: '',
        },
      ])
    ).toEqual([
      {
        itemId: null,
        itemName: 'خامة',
        unitId: null,
        unitName: 'قطعة',
        conversionFactor: '1',
        quantity: '1',
        cost: null,
      },
    ]);
  });
});

describe('mergeItemCardForm', () => {
  it('fills missing draft fields so save does not throw on trim', () => {
    const merged = mergeItemCardForm({ arabicName: 'كابل' });
    expect(merged.englishName).toBe('');
    expect(merged.barcode).toBe(EMPTY_ITEM_FORM.barcode);
    expect(merged.arabicName).toBe('كابل');
  });
});
