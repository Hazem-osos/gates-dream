import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ESIGN_OPERATION = 'ETA_SIGN';
export const ESIGN_SESSION_TTL_SECONDS = 300;

export function randomHex(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function signingAuthorizationMaterial(input: {
  sessionId: string;
  companyId: string;
  documentId: string;
  documentHash: string;
  nonce: string;
  expiresAtUnix: number;
  operation?: string;
}): string {
  return [
    input.sessionId,
    input.companyId,
    input.documentId,
    input.documentHash,
    input.nonce,
    String(input.expiresAtUnix),
    input.operation || ESIGN_OPERATION,
  ].join('\n');
}

export function computeSigningAuthorization(
  deviceCredential: string,
  input: Parameters<typeof signingAuthorizationMaterial>[0]
): string {
  return createHmac('sha256', deviceCredential)
    .update(signingAuthorizationMaterial(input), 'utf8')
    .digest('hex');
}

export function pairingProof(input: {
  deviceCredential: string;
  pairingSessionId: string;
  companyId: string;
  deviceId: string;
  challenge: string;
}): string {
  const material = [input.pairingSessionId, input.companyId, input.deviceId, input.challenge].join(
    '\n'
  );
  return createHmac('sha256', input.deviceCredential).update(material, 'utf8').digest('hex');
}

export function fixedTimeEqualHex(left: string, right: string): boolean {
  const a = Buffer.from(left.trim().toLowerCase(), 'utf8');
  const b = Buffer.from(right.trim().toLowerCase(), 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
