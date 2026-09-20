import {
  indexExistingItems,
  matchImportedItem,
  rememberImportedItemKeys,
} from '../../modules/inventory/utils/item-import-match';

const emptySeen = () => ({
  barcodes: new Set<string>(),
  serials: new Set<string>(),
  names: new Set<string>(),
});

describe('item import match', () => {
  const catalog = indexExistingItems([
    { id: '1', arabicName: 'سكر ناعم', barcode: '123', serial: '00010' },
    { id: '2', arabicName: 'شاي العروسة', englishName: 'Arousa Tea' },
  ]);

  it('matches an existing barcode and serial', () => {
    expect(
      matchImportedItem({ arabicName: 'سكر', barcode: '123' }, catalog.existingByBarcode, catalog.existingBySerial, catalog.existingByName, emptySeen())
        ?.kind
    ).toBe('barcode');
    expect(
      matchImportedItem({ arabicName: 'سكر', serial: '00010' }, catalog.existingByBarcode, catalog.existingBySerial, catalog.existingByName, emptySeen())
        ?.kind
    ).toBe('serial');
  });

  it('matches a normalized Arabic name', () => {
    expect(
      matchImportedItem(
        { arabicName: 'السكر   الناعم' },
        catalog.existingByBarcode,
        catalog.existingBySerial,
        catalog.existingByName,
        emptySeen()
      )?.kind
    ).toBeUndefined();
    expect(
      matchImportedItem(
        { arabicName: 'سكر ناعم' },
        catalog.existingByBarcode,
        catalog.existingBySerial,
        catalog.existingByName,
        emptySeen()
      )?.kind
    ).toBe('name');
  });

  it('skips a second copy of the same row inside the sheet', () => {
    const seen = emptySeen();
    const first = matchImportedItem(
      { arabicName: 'زيت عباد', barcode: '999' },
      catalog.existingByBarcode,
      catalog.existingBySerial,
      catalog.existingByName,
      seen
    );
    expect(first).toBeNull();
    rememberImportedItemKeys({ arabicName: 'زيت عباد', barcode: '999' }, seen);
    expect(
      matchImportedItem(
        { arabicName: 'زيت عباد', barcode: '999' },
        catalog.existingByBarcode,
        catalog.existingBySerial,
        catalog.existingByName,
        seen
      )?.kind
    ).toBe('sheet-barcode');
  });
});
