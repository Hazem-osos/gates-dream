import { readFileSync } from 'node:fs';
import path from 'node:path';
import forge from 'node-forge';
import { canonicalizeJson, sha256HexCanonical } from '../../modules/electronic-invoices/utils/eta-canonical.util';
import { verifyDetachedCades } from '../../modules/electronic-invoices/utils/cades-verify';

function detachedCades(content: string): string {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 1);
  const attrs = [{ name: 'commonName', value: 'Gates Test' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(content, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key: keys.privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
    ],
  });
  p7.sign({ detached: true });
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

describe('CAdES server verification', () => {
  const unsigned = { documentType: 'I', internalID: 'A', totalAmount: 10 };
  const canonical = canonicalizeJson(unsigned);

  it('accepts a detached CMS over the exact canonical payload', () => {
    const signature = detachedCades(canonical);
    const result = verifyDetachedCades({
      canonicalPayload: canonical,
      signatureBase64: signature,
      expectedHash: sha256HexCanonical(unsigned),
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a signature for a different document', () => {
    const signature = detachedCades(canonical);
    const other = canonicalizeJson({ documentType: 'I', internalID: 'B', totalAmount: 10 });
    const result = verifyDetachedCades({
      canonicalPayload: other,
      signatureBase64: signature,
      expectedHash: sha256HexCanonical({ documentType: 'I', internalID: 'B', totalAmount: 10 }),
    });
    expect(result.ok).toBe(false);
  });

  it('accepts a detached ETA CMS whose content type is 1.2.840.113549.1.7.5', () => {
    const canonical = '{"documentType":"I","internalID":"A","totalAmount":10}';
    const signature = readFileSync(
      path.join(__dirname, '../fixtures/eta-cades-content-type-1.7.5.b64'),
      'utf8'
    ).trim();
    const result = verifyDetachedCades({
      canonicalPayload: canonical,
      signatureBase64: signature,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a hash mismatch without treating it as success', () => {
    const signature = detachedCades(canonical);
    const result = verifyDetachedCades({
      canonicalPayload: canonical,
      signatureBase64: signature,
      expectedHash: '00'.repeat(32),
    });
    expect(result).toEqual({ ok: false, reason: 'DOCUMENT_HASH_MISMATCH' });
  });
});
