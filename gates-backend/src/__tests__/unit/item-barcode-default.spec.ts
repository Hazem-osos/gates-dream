import { resolveItemBarcode } from '../../modules/inventory/utils/item-barcode-default';

describe('resolveItemBarcode', () => {
  it('keeps an explicit barcode', () => {
    expect(resolveItemBarcode('ABC', '1001')).toBe('ABC');
  });

  it('falls back to serial when barcode is empty', () => {
    expect(resolveItemBarcode('', '1001')).toBe('1001');
    expect(resolveItemBarcode(null, '1001')).toBe('1001');
    expect(resolveItemBarcode('   ', '1001')).toBe('1001');
  });

  it('returns null when both are empty', () => {
    expect(resolveItemBarcode(null, null)).toBeNull();
    expect(resolveItemBarcode('', '')).toBeNull();
  });
});
