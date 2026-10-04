import { readFileSync } from 'fs';
import path from 'path';
import { etaSigningText } from '../../modules/electronic-invoices/utils/eta-canonical.util';
import { serializeEtaJsonText } from '../../modules/electronic-invoices/utils/eta-serialization';

describe('ETA document serialization', () => {
  it('matches the official invoice serialization, including repeated array names and raw decimals', () => {
    const json = readFileSync(path.join(__dirname, '../fixtures/eta-one-doc.json'), 'utf8');
    const expected = readFileSync(path.join(__dirname, '../fixtures/eta-one-doc-serialized.txt'), 'utf8').replace(
      /\r?\n$/,
      ''
    );
    expect(serializeEtaJsonText(json)).toBe(expected);
  });

  it('serializes the compact document the signer receives, not sorted JSON', () => {
    const document = {
      documentType: 'I',
      internalID: 'A',
      invoiceLines: [{ description: 'صنف', quantity: 1 }],
    };
    const signed = etaSigningText(document);
    expect(signed.startsWith('"DOCUMENTTYPE""I"')).toBe(true);
    expect(signed).toContain('"INVOICELINES""INVOICELINES""DESCRIPTION""صنف"');
    expect(signed).not.toContain('{');
  });
});
