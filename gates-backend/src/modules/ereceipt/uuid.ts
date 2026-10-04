import { createHash } from 'crypto';
import { serializeEtaJsonText } from '../electronic-invoices/utils/eta-serialization';

/** UTC timestamp ETA receipt samples use: 2022-02-03T00:00:00Z. No milliseconds. */
export function etaDateTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function etaJson(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Receipt UUID. SHA-256 of the official document serialization of the receipt
 * JSON while header.uuid is an empty string. The serializer is the same pure
 * function eInvoice already uses for document serialization; this module does
 * not change that function. Receipt UUID input is the receipt document, not
 * an invoice.
 */
export function receiptUuid(document: unknown): { uuid: string; canonical: string } {
  const copy = structuredClone(document) as { header?: { uuid?: string } };
  if (!copy.header) throw new Error('ERECEIPT_UUID_NO_HEADER');
  copy.header.uuid = '';
  const canonical = serializeEtaJsonText(etaJson(copy));
  const uuid = createHash('sha256').update(Buffer.from(canonical, 'utf8')).digest('hex');
  return { uuid, canonical };
}

export function withReceiptUuid(document: Record<string, unknown>): {
  uuid: string;
  canonical: string;
  submitText: string;
  document: Record<string, unknown>;
} {
  const hashed = receiptUuid(document);
  const submit = structuredClone(document) as { header: { uuid: string } };
  submit.header.uuid = hashed.uuid;
  return {
    uuid: hashed.uuid,
    canonical: hashed.canonical,
    submitText: etaJson(submit),
    document: submit as unknown as Record<string, unknown>,
  };
}
