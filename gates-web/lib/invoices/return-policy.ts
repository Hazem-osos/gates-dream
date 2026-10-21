export type InvoiceReturnPolicyInput = {
  allowReturn?: boolean | null;
  returnDays?: number | string | null;
  date?: string | Date | null;
  invoiceNumber?: string | null;
};

/** Opt-out only: checkbox off is stored as allowReturn=false and returnDays=0. */
export function salesInvoiceReturnsExplicitlyDenied(invoice: {
  allowReturn?: boolean | null;
  returnDays?: number | string | null;
}): boolean {
  if (invoice.allowReturn !== false) return false;
  if (invoice.returnDays == null || invoice.returnDays === '') return false;
  return Number(invoice.returnDays) === 0;
}

export function invoiceReturnBlockReason(invoice: InvoiceReturnPolicyInput): string | null {
  const ref = invoice.invoiceNumber ? `فاتورة ${invoice.invoiceNumber}` : 'هذه الفاتورة';
  if (salesInvoiceReturnsExplicitlyDenied(invoice)) {
    return `${ref} غير مسموح بإرجاعها أو عمل مردود عليها`;
  }

  const days = Number(invoice.returnDays);
  const windowDays = Number.isFinite(days) && days > 0 ? days : null;
  if (windowDays == null) return null;
  if (!invoice.date) return null;
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
