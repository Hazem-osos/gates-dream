import type { InternalNoteEntry } from '@/lib/invoices/payment-split.types';

export const PAYMENT_TERMS_METHOD_NOTE_ID = 'invoice-payment-terms-method';

export function extractPaymentTermsMethod(notes: unknown): string {
  if (!Array.isArray(notes)) return '';
  const entry = notes.find(
    (n) => n && typeof n === 'object' && (n as { id?: string }).id === PAYMENT_TERMS_METHOD_NOTE_ID
  ) as { body?: string } | undefined;
  if (!entry?.body) return '';
  try {
    const parsed = JSON.parse(entry.body) as { paymentTermsMethod?: string };
    return String(parsed.paymentTermsMethod ?? '').trim();
  } catch {
    return entry.body.trim();
  }
}

export function stripPaymentTermsMethodNote(notes: InternalNoteEntry[]): InternalNoteEntry[] {
  return notes.filter((n) => n.id !== PAYMENT_TERMS_METHOD_NOTE_ID);
}

export function withPaymentTermsMethodNote(
  notes: InternalNoteEntry[],
  paymentTermsMethod?: string
): InternalNoteEntry[] {
  const cleaned = stripPaymentTermsMethodNote(notes);
  const text = String(paymentTermsMethod ?? '').trim();
  if (!text) return cleaned;
  return [
    {
      id: PAYMENT_TERMS_METHOD_NOTE_ID,
      body: JSON.stringify({ paymentTermsMethod: text }),
      tags: ['شروط الدفع'],
      createdAt: new Date().toISOString(),
    },
    ...cleaned,
  ];
}
