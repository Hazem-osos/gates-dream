import {
  assertCadesBesBase64,
  hashUnsignedEtaDocument,
  LOCAL_SIGN_REQUIRED_AR,
  resolveWebSubmitSigning,
  unsignedEtaDocument,
} from '../../modules/electronic-invoices/utils/eta-local-sign';
import { withIssuerSignature } from '../../modules/electronic-invoices/services/eta-signing.service';

describe('ETA local-sign helpers', () => {
  it('never selects PKCS#11 or USB discovery for the web submit path', () => {
    expect(resolveWebSubmitSigning({ issuerSignature: 'x'.repeat(80), pfxConfigured: false })).toBe(
      'client-cades'
    );
    expect(resolveWebSubmitSigning({ issuerSignature: '', pfxConfigured: true })).toBe('server-pfx');
    expect(resolveWebSubmitSigning({ issuerSignature: '', pfxConfigured: false })).toBe(
      'local-sign-required'
    );
    expect(LOCAL_SIGN_REQUIRED_AR).not.toMatch(/USB|PKCS|السيرفر/);
  });

  it('keeps the unsigned document stable after attaching a signature', () => {
    const unsigned = unsignedEtaDocument({
      documentType: 'I',
      internalID: '1',
      signatures: [{ signatureType: 'I', value: 'old' }],
    });
    const hash = hashUnsignedEtaDocument(unsigned);
    const posted = withIssuerSignature(unsigned, 'c2lnbmF0dXJlLXZhbHVlLWZvci10ZXN0');
    expect(unsigned.signatures).toBeUndefined();
    expect(hashUnsignedEtaDocument(unsignedEtaDocument(posted))).toBe(hash);
    expect(posted.signatures).toEqual([{ signatureType: 'I', value: 'c2lnbmF0dXJlLXZhbHVlLWZvci10ZXN0' }]);
  });

  it('rejects a non-CAdES placeholder instead of faking success', () => {
    expect(() => assertCadesBesBase64('')).toThrow('توقيع الفاتورة مطلوب');
    expect(() => assertCadesBesBase64('MOCK_SIGNED_DEV')).toThrow('صيغة التوقيع غير صالحة');
  });
});
