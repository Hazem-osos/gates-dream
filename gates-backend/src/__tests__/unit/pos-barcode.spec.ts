import { decodeWeightedBarcode } from '../../modules/pos/services/pos-barcode';

describe('weighted barcode rules', () => {
  const rule = {
    prefix: '22',
    itemStart: 2,
    itemLength: 5,
    valueStart: 7,
    valueLength: 5,
    valueKind: 'WEIGHT',
    decimals: 3,
    isActive: true,
  };

  it('reads the item code and the weight from the configured slices', () => {
    expect(decodeWeightedBarcode('2212345012500', [rule])).toEqual({
      itemCode: '12345',
      quantity: 1.25,
    });
  });

  it('rejects a price barcode only at the catalog boundary, and ignores a short code', () => {
    expect(decodeWeightedBarcode('9912345', [rule])).toBeNull();
    expect(decodeWeightedBarcode('2212345012500', [{ ...rule, valueKind: 'PRICE' }])).toEqual({
      itemCode: '12345',
      embeddedPrice: 1.25,
    });
  });
});
