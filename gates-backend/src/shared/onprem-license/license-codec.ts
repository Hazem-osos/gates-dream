/**
 * On-prem (exe) license format: sign and verify.
 *
 * A license is one line of text:   GATES1.<payload>.<signature>
 *   payload   = base64url(JSON of OnPremLicensePayload)
 *   signature = base64url(Ed25519 signature over the ASCII bytes "GATES1.<payload>")
 *
 * Only the holder of the private key (Gates, kept off this repository) can issue a license.
 * The shipped app carries only the public key, so it can check a license but never make one.
 * Changing any field (users, expiry, machine) breaks the signature.
 *
 * Pure: no file system, no env, no clock except what the caller passes in.
 */
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

export const LICENSE_PREFIX = 'GATES1';
export const LICENSE_PRODUCT = 'gates-erp-onprem';

export interface OnPremLicensePayload {
  /** Always LICENSE_PRODUCT — stops a signature for another product being reused. */
  product: string;
  /** Unique id for this license (for Gates' own records). */
  licenseId: string;
  /** Customer name, shown in the app. */
  customer: string;
  /** Machine code from the customer's server (see machine-id.ts). */
  machineId: string;
  /** Maximum number of ACTIVE users across the whole installation. */
  maxUsers: number;
  /** ISO date-time the license was issued. */
  issuedAt: string;
  /** ISO date-time the license stops working, or null for a permanent license. */
  expiresAt: string | null;
}

export type LicenseCheckFailure =
  | 'MISSING'
  | 'MALFORMED'
  | 'BAD_SIGNATURE'
  | 'WRONG_PRODUCT'
  | 'WRONG_MACHINE'
  | 'EXPIRED'
  | 'CLOCK_BEFORE_ISSUE';

export type LicenseCheckResult =
  | { ok: true; license: OnPremLicensePayload }
  | { ok: false; reason: LicenseCheckFailure; license?: OnPremLicensePayload };

/** Arabic, user-facing text for each failure. */
export const LICENSE_FAILURE_MESSAGES: Record<LicenseCheckFailure, string> = {
  MISSING: 'لا يوجد ملف ترخيص (gates.lic). أرسل كود هذا الجهاز إلى Gates للحصول على ترخيص.',
  MALFORMED: 'ملف الترخيص غير صالح أو تالف.',
  BAD_SIGNATURE: 'ملف الترخيص غير صادر من Gates أو تم التعديل عليه.',
  WRONG_PRODUCT: 'ملف الترخيص لا يخص هذا البرنامج.',
  WRONG_MACHINE: 'ملف الترخيص صادر لجهاز آخر. أرسل كود هذا الجهاز إلى Gates للحصول على ترخيص له.',
  EXPIRED: 'انتهت مدة الترخيص. تواصل مع Gates لتجديده.',
  CLOCK_BEFORE_ISSUE: 'تاريخ الجهاز أقدم من تاريخ إصدار الترخيص. صحح تاريخ ووقت الجهاز.',
};

/** Allowed clock skew before "the machine clock is earlier than the issue date" trips. */
const ISSUE_CLOCK_TOLERANCE_MS = 24 * 60 * 60 * 1000;

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64url');
}

function b64urlDecode(text: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error('not base64url');
  return Buffer.from(text, 'base64url');
}

export function normalizeMachineId(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^0-9A-F]/g, '');
}

function assertPayloadShape(value: unknown): asserts value is OnPremLicensePayload {
  const p = value as Record<string, unknown>;
  const ok =
    p !== null &&
    typeof p === 'object' &&
    typeof p.product === 'string' &&
    typeof p.licenseId === 'string' &&
    typeof p.customer === 'string' &&
    typeof p.machineId === 'string' &&
    typeof p.maxUsers === 'number' &&
    Number.isInteger(p.maxUsers) &&
    p.maxUsers >= 1 &&
    typeof p.issuedAt === 'string' &&
    !Number.isNaN(Date.parse(p.issuedAt)) &&
    (p.expiresAt === null || (typeof p.expiresAt === 'string' && !Number.isNaN(Date.parse(p.expiresAt))));
  if (!ok) throw new Error('license payload has the wrong shape');
}

/** Gates-side only: produce a signed license string. */
export function signLicense(payload: OnPremLicensePayload, privateKeyPem: string): string {
  assertPayloadShape(payload);
  const body = `${LICENSE_PREFIX}.${b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))}`;
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('private key must be Ed25519');
  const sig = sign(null, Buffer.from(body, 'ascii'), key);
  return `${body}.${b64urlEncode(sig)}`;
}

/**
 * Check a license string. Signature first: nothing inside an unsigned payload is trusted,
 * not even for the error message.
 */
export function verifyLicense(
  licenseText: string,
  publicKeyPem: string,
  opts: { machineId: string; now: Date }
): LicenseCheckResult {
  const text = licenseText.trim();
  const parts = text.split('.');
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX) return { ok: false, reason: 'MALFORMED' };

  let sig: Buffer;
  let payloadBytes: Buffer;
  try {
    payloadBytes = b64urlDecode(parts[1]);
    sig = b64urlDecode(parts[2]);
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }

  const key = createPublicKey(publicKeyPem);
  const signed = Buffer.from(`${parts[0]}.${parts[1]}`, 'ascii');
  if (!verify(null, signed, key, sig)) return { ok: false, reason: 'BAD_SIGNATURE' };

  let license: OnPremLicensePayload;
  try {
    const parsed: unknown = JSON.parse(payloadBytes.toString('utf8'));
    assertPayloadShape(parsed);
    license = parsed;
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }

  if (license.product !== LICENSE_PRODUCT) return { ok: false, reason: 'WRONG_PRODUCT', license };
  if (normalizeMachineId(license.machineId) !== normalizeMachineId(opts.machineId)) {
    return { ok: false, reason: 'WRONG_MACHINE', license };
  }
  const now = opts.now.getTime();
  if (now + ISSUE_CLOCK_TOLERANCE_MS < Date.parse(license.issuedAt)) {
    return { ok: false, reason: 'CLOCK_BEFORE_ISSUE', license };
  }
  if (license.expiresAt !== null && now > Date.parse(license.expiresAt)) {
    return { ok: false, reason: 'EXPIRED', license };
  }
  return { ok: true, license };
}
