import { createHash } from 'crypto';

/**
 * ETA document canonical JSON: recursively sort object keys, stable array order,
 * no insignificant whitespace (compact JSON).
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalizeJson(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`);
  return `{${parts.join(',')}}`;
}

export function sha256HexCanonical(value: unknown): string {
  const canonical = canonicalizeJson(value);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** ETA sample used in integration tests (matches ETA SDK canonicalization examples). */
export const ETA_CANONICAL_SAMPLE_DOCUMENT = {
  documentType: 'I',
  documentTypeVersion: '1.0',
  dateTimeIssued: '2021-01-01T00:00:00Z',
  internalID: 'SAMPLE-001',
  issuer: { id: '123456789', name: 'Issuer Co', type: 'B' },
  receiver: { id: '987654321', name: 'Receiver Co', type: 'B' },
  totalAmount: 114,
} as const;
