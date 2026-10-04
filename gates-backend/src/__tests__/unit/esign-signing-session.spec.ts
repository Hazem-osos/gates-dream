import { canonicalizeJson, sha256HexCanonical } from '../../modules/electronic-invoices/utils/eta-canonical.util';
import { unsignedEtaDocument } from '../../modules/electronic-invoices/utils/eta-local-sign';
import { withIssuerSignature } from '../../modules/electronic-invoices/services/eta-signing.service';

describe('immutable ETA signing document', () => {
  it('keeps the prepared unsigned document after attaching CAdES', () => {
    const prepared = unsignedEtaDocument({
      documentType: 'I',
      internalID: 'INV-1',
      totalAmount: 114,
      signatures: [{ signatureType: 'I', value: 'old' }],
    });
    const canonical = canonicalizeJson(prepared);
    const hash = sha256HexCanonical(prepared);
    const attached = withIssuerSignature(prepared, 'A'.repeat(80));
    expect(canonicalizeJson(unsignedEtaDocument(attached))).toBe(canonical);
    expect(sha256HexCanonical(unsignedEtaDocument(attached))).toBe(hash);
    expect(attached.signatures).toEqual([{ signatureType: 'I', value: 'A'.repeat(80) }]);
  });

  it('does not treat a rebuilt different document as the same session', () => {
    const prepared = unsignedEtaDocument({ documentType: 'I', internalID: 'INV-1', totalAmount: 114 });
    const rebuilt = unsignedEtaDocument({ documentType: 'I', internalID: 'INV-1', totalAmount: 200 });
    expect(sha256HexCanonical(prepared)).not.toBe(sha256HexCanonical(rebuilt));
  });
});
