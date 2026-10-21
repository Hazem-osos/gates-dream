/**
 * `sales-invoice`: الدفع/التحصيل أثناء التعديل (مع الحفظ) أو بعد الترحيل لسداد المتبقي.
 * `other`: الدفع فقط أثناء التعديل قبل الترحيل (لا يظهر بعد الترحيل).
 */
export type InvoicePaymentSurface = 'sales-invoice' | 'other';

export function invoicePaymentButtonDisabled(
  surface: InvoicePaymentSurface,
  opts: {
    lockLoadedSource?: boolean;
    isReadOnly?: boolean;
    isPosted?: boolean;
  }
): boolean {
  if (opts.lockLoadedSource) return true;
  if (surface === 'sales-invoice') {
    return !(opts.isPosted || !opts.isReadOnly);
  }
  if (opts.isPosted) return true;
  return Boolean(opts.isReadOnly);
}
