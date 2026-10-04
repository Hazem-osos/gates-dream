import { createHash } from 'crypto';
import { serializeEtaJsonText } from './eta-serialization';

/**
 * ETA document canonical JSON: recursively sort object keys, stable array order,
 * no insignificant whitespace (compact JSON).
 */
export function canonicalizeJson(value: unknown): string {
  if (value === undefined) {
    return 'null';
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalizeJson(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((key) => obj[key] !== undefined)
    .sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`);
  return `{${parts.join(',')}}`;
}

/** Same shape MySQL JSON / Prisma Json will persist — strips undefined, Decimal, Date. */
export function toJsonPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function sha256HexUtf8(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function sha256HexCanonical(value: unknown): string {
  const canonical = canonicalizeJson(value);
  return sha256HexUtf8(canonical);
}

/** Bytes the CAdES message-digest must cover: ETA serialization of the compact document JSON. */
export function etaSigningText(value: unknown): string {
  return serializeEtaJsonText(canonicalizeJson(value));
}

export function parseCanonicalUnsignedDocument(
  canonicalPayload: string,
  contentHash: string
): Record<string, unknown> {
  const signingText = serializeEtaJsonText(canonicalPayload);
  if (sha256HexUtf8(signingText) !== contentHash.trim().toLowerCase()) {
    throw new Error('DOCUMENT_HASH_MISMATCH');
  }
  const parsed = JSON.parse(canonicalPayload) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('DOCUMENT_HASH_MISMATCH');
  }
  const next = { ...(parsed as Record<string, unknown>) };
  delete next.signatures;
  return next;
}

/** ETA rejects issue timestamps that include milliseconds. */
export function etaDateTimeIssued(value: Date): string {
  return value.toISOString().replace(/\.\d{3}Z$/, 'Z');
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
