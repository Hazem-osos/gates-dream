const COLLECTION_COMPARE_EPSILON = 0.01;

export function invoiceNetCoversCollections(netAmount: number, collectedAmount: number): boolean {
  return collectedAmount - netAmount <= COLLECTION_COMPARE_EPSILON;
}

/** Posted treasury / allocation rows already linked — do not re-validate cash tender on save. */
export function invoiceHasLinkedCollections(collectedAmount: number): boolean {
  return collectedAmount > COLLECTION_COMPARE_EPSILON;
}

function formatInvoiceMoney(value: number): string {
  return value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Same rule as backend `invoiceValueBelowCollectionsMessage` when save is refused. */
export function invoiceNetBelowCollectionsMessage(netAmount: number, collectedAmount: number): string {
  return `قيمة الفاتورة بعد التعديل (${formatInvoiceMoney(netAmount)}) أقل من التحصيلات المربوطة (${formatInvoiceMoney(collectedAmount)}). لا يمكن الحفظ إلا إذا كانت قيمة الفاتورة لا تقل عن التحصيلات.`;
}

export function invoiceNetBelowPaymentConfirmMessage(netAmount: number, paidAmount: number): string {
  return `قيمة الفاتورة بعد التعديل (${formatInvoiceMoney(netAmount)}) أقل من سند الصرف المرتبط (${formatInvoiceMoney(paidAmount)}). سند الصرف هيفضل كما هو والمتبقي هيصبح صفراً. تأكيد الحفظ؟`;
}

export function postedSettlementPaidTotal(
  rows: Array<{ amount?: number | string | null; isPosted?: boolean; isCancelled?: boolean }>
): number {
  return rows.reduce((sum, row) => {
    if (row.isCancelled || row.isPosted !== true) return sum;
    return sum + (Number(row.amount) || 0);
  }, 0);
}

export function linkedInvoicePaidAmount(savedPaidAmount: number, settlementPaidAmount: number): number {
  return Math.max(Number(savedPaidAmount) || 0, Number(settlementPaidAmount) || 0);
}
