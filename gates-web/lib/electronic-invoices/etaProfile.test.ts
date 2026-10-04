import { describe, expect, it } from 'vitest';
import { ETA_UNIT_CODES, composeCustomerEtaAddress, etaCountryName } from './etaProfile';

describe('customer eta address', () => {
  it('names the country and joins the address parts', () => {
    expect(etaCountryName('EG')).toBe('مصر');
    expect(
      composeCustomerEtaAddress({
        street: 'النصر',
        buildingNumber: '12',
        regionCity: 'مدينة نصر',
        governate: 'القاهرة',
        country: 'EG',
        postalCode: '11765',
      })
    ).toBe('12، النصر، مدينة نصر، القاهرة، مصر، 11765');
  });

  it('skips empty address parts', () => {
    expect(composeCustomerEtaAddress({ street: 'الهرم', country: 'EG' })).toBe('الهرم، مصر');
  });

  it('offers the ETA unit codes used on the item card', () => {
    const codes = ETA_UNIT_CODES.map((unit) => unit.code);
    expect(codes).toContain('EA');
    expect(codes).toContain('JOB');
    expect(new Set(codes).size).toBe(codes.length);
  });
});
