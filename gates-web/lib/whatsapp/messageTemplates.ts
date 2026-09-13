export function buildDailyExecutiveDigestMessage(params: {
  companyName: string;
  dateLabel: string;
  dailySalesNet: string;
  invoiceCount: number;
  collectionsTotal: string;
  overdueDebt: string;
  chequesCount: number;
  chequesTotal: string;
  topItemsList: string;
}): string {
  return [
    `📊 ملخص أعمال اليوم - ${params.companyName}`,
    `التاريخ: ${params.dateLabel}`,
    '━━━━━━━━━━━━━━━━━━━',
    `💰 إجمالي المبيعات: ${params.dailySalesNet} ج.م (${params.invoiceCount} فاتورة)`,
    `📥 المتحصلات النقدية والبنكية: ${params.collectionsTotal} ج.م`,
    `⚠️ مستحقات تحصيل اليوم: ${params.overdueDebt} ج.م`,
    `🏦 شيكات تستحق غداً: ${params.chequesCount} شيك بقيمة ${params.chequesTotal} ج.م`,
    '━━━━━━━━━━━━━━━━━━━',
    `🏆 الأكثر مبيعاً: ${params.topItemsList}`,
  ].join('\n');
}

export function buildSalesInvoiceWhatsAppMessage(params: {
  customerName: string;
  invoiceNumber: string;
  date: string;
  grandTotal: string;
  publicUrl?: string;
}): string {
  const link = params.publicUrl?.trim() || '—';
  return [
    `مرحباً ${params.customerName}،`,
    `مرفق تفاصيل فاتورة مبيعات رقم: #${params.invoiceNumber}`,
    `التاريخ: ${params.date}`,
    `إجمالي الفاتورة: ${params.grandTotal} ج.م`,
    `رابط الفاتورة: ${link}`,
    'شكراً لتعاملكم معنا.',
  ].join('\n');
}

export function buildReceiptWhatsAppMessage(params: {
  partyName: string;
  voucherNumber: string;
  date: string;
  amount: string;
}): string {
  return [
    `مرحباً ${params.partyName}،`,
    `إيصال قبض رقم ${params.voucherNumber}`,
    `التاريخ: ${params.date}`,
    `المبلغ: ${params.amount} ج.م`,
    'شكراً لتعاملكم معنا.',
  ].join('\n');
}

export function buildContractExtractWhatsAppMessage(params: {
  partyName: string;
  extractNumber: string;
  date: string;
  netPayable: string;
}): string {
  return [
    `مرحباً ${params.partyName}،`,
    `مستخلص رقم ${params.extractNumber}`,
    `التاريخ: ${params.date}`,
    `صافي المستحق: ${params.netPayable} ج.م`,
    'شكراً لتعاملكم معنا.',
  ].join('\n');
}
