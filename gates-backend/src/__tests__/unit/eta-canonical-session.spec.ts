import {
  canonicalizeJson,
  etaSigningText,
  parseCanonicalUnsignedDocument,
  sha256HexCanonical,
  sha256HexUtf8,
  toJsonPlain,
} from '../../modules/electronic-invoices/utils/eta-canonical.util';
import { hashUnsignedEtaDocument, unsignedEtaDocument } from '../../modules/electronic-invoices/utils/eta-local-sign';

describe('ETA canonical session hash', () => {
  it('omits undefined fields so MySQL JSON does not change the session hash', () => {
    const withHoles = {
      documentType: 'I',
      internalID: 'INV-1',
      totalAmount: 114.1,
      buildingNumber: undefined,
    };
    const canonical = canonicalizeJson(withHoles);
    const persisted = toJsonPlain(withHoles);
    expect(canonical).not.toContain('undefined');
    expect(canonicalizeJson(persisted)).toBe(canonical);
    expect(sha256HexCanonical(persisted)).toBe(sha256HexUtf8(canonical));
  });

  it('rebuilds the signed document from the canonical string, not the JSON column', () => {
    const prepared = toJsonPlain(
      unsignedEtaDocument({
        documentType: 'I',
        internalID: 'INV-1',
        totalAmount: 114.1,
        buildingNumber: undefined,
      })
    );
    const canonical = canonicalizeJson(prepared);
    const hash = sha256HexUtf8(etaSigningText(prepared));
    const drifted = { documentType: 'I', internalID: 'INV-1', totalAmount: 200 };
    expect(hashUnsignedEtaDocument(drifted)).not.toBe(hash);
    expect(parseCanonicalUnsignedDocument(canonical, hash)).toEqual(prepared);
    expect(hashUnsignedEtaDocument(parseCanonicalUnsignedDocument(canonical, hash))).toBe(hash);
  });
});
