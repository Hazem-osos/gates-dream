import { barcodeFieldDisplay, barcodeInputFromStored, resolveItemBarcode } from './item-barcode-default';

describe('item barcode default', () => {
  it('resolveItemBarcode falls back to serial', () => {
    expect(resolveItemBarcode('', '1001')).toBe('1001');
    expect(resolveItemBarcode('  ', '1001')).toBe('1001');
    expect(resolveItemBarcode('EAN', '1001')).toBe('EAN');
  });

  it('barcodeInputFromStored hides implicit serial copy', () => {
    expect(barcodeInputFromStored('1001', '1001')).toBe('');
    expect(barcodeInputFromStored(null, '1001')).toBe('');
    expect(barcodeInputFromStored('EAN', '1001')).toBe('EAN');
  });

  it('barcodeFieldDisplay shows serial until a barcode is typed', () => {
    expect(barcodeFieldDisplay('', '1001')).toBe('1001');
    expect(barcodeFieldDisplay('  ', '1001')).toBe('1001');
    expect(barcodeFieldDisplay('EAN', '1001')).toBe('EAN');
    expect(barcodeFieldDisplay('', '')).toBe('');
  });
});
