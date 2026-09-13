import { validatePkcs11Environment } from './pkcs11-signing.service';

export function isEtaSigningEnabled(): boolean {
  return process.env.ETA_SIGNING_ENABLED?.trim().toLowerCase() === 'true';
}

export function etaSigningProvider(): 'mock' | 'pkcs11' {
  const p = process.env.ETA_SIGNING_PROVIDER?.trim().toLowerCase() ?? 'mock';
  return p === 'pkcs11' ? 'pkcs11' : 'mock';
}

/** When signing is disabled, submissions use a explicit dev tag instead of live ETA calls. */
export function mockSignedDevTag(): string {
  return `MOCK_SIGNED_DEV-${Date.now()}`;
}

export function assertEtaSigningReadyForProduction(): void {
  if (!isEtaSigningEnabled()) return;
  if (etaSigningProvider() === 'pkcs11') {
    validatePkcs11Environment();
  }
}
