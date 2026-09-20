export type SaleInvoiceReturnPolicyInput = {
  invoiceKind?: string | null;
  allowReturn?: boolean | null;
  returnDays?: number | null;
  date: Date;
  invoiceNumber?: string | null;
};

export function saleInvoiceReturnBlockReason(
  invoice: SaleInvoiceReturnPolicyInput
): string | null {
  if ((invoice.invoiceKind ?? 'SALE') !== 'SALE') return null;

  const ref = invoice.invoiceNumber ? `فاتورة ${invoice.invoiceNumber}` : 'هذه الفاتورة';
  if (!invoice.allowReturn) {
    return `${ref} غير مسموح بإرجاعها أو عمل مردود عليها`;
  }

  const days = Number(invoice.returnDays);
  const windowDays = Number.isFinite(days) && days > 0 ? days : 365;
  const start = new Date(invoice.date);
  if (Number.isNaN(start.getTime())) return null;
  start.setHours(0, 0, 0, 0);
  const deadline = new Date(start);
  deadline.setDate(deadline.getDate() + windowDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today.getTime() > deadline.getTime()) {
    return `انتهت مدة الاسترجاع لـ${ref} (${windowDays} يوم من تاريخ الفاتورة)`;
  }
  return null;
}
