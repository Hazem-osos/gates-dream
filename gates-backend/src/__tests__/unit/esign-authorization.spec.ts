import {
  computeSigningAuthorization,
  ESIGN_OPERATION,
  fixedTimeEqualHex,
  pairingProof,
  signingAuthorizationMaterial,
} from '../../modules/electronic-invoices/utils/esign-authorization';

describe('esign authorization', () => {
  it('binds session, company, document, hash, nonce, expiry, and ETA_SIGN', () => {
    const input = {
      sessionId: 'sess-1',
      companyId: 'co-1',
      documentId: 'doc-1',
      documentHash: 'abc',
      nonce: 'n1',
      expiresAtUnix: 1_700_000_000,
      operation: ESIGN_OPERATION,
    };
    const mac = computeSigningAuthorization('secret', input);
    expect(mac).toHaveLength(64);
    expect(computeSigningAuthorization('secret', input)).toBe(mac);
    expect(computeSigningAuthorization('other', input)).not.toBe(mac);
    expect(
      computeSigningAuthorization('secret', { ...input, companyId: 'other' })
    ).not.toBe(mac);
    expect(signingAuthorizationMaterial(input)).toContain(ESIGN_OPERATION);
  });

  it('pairing proof rejects another company or secret', () => {
    const proof = pairingProof({
      deviceCredential: 'cred',
      pairingSessionId: 'pair-1',
      companyId: 'co-1',
      deviceId: 'dev-1',
      challenge: 'chal',
    });
    expect(
      fixedTimeEqualHex(
        proof,
        pairingProof({
          deviceCredential: 'cred',
          pairingSessionId: 'pair-1',
          companyId: 'co-1',
          deviceId: 'dev-1',
          challenge: 'chal',
        })
      )
    ).toBe(true);
    expect(
      fixedTimeEqualHex(
        proof,
        pairingProof({
          deviceCredential: 'cred',
          pairingSessionId: 'pair-1',
          companyId: 'other',
          deviceId: 'dev-1',
          challenge: 'chal',
        })
      )
    ).toBe(false);
  });
});
