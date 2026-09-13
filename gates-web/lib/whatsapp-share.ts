export interface WhatsAppInvoicePayload {
  customerName: string;
  customerPhone?: string;
  companyName: string;
  invoiceNumber: string;
  invoiceDate: string;
  netAmount: number;
  paidAmount: number;
  remainingAmount: number;
  publicViewUrl?: string;
}

/** Normalize Egyptian phone number (e.g. 010xxxxxxxx -> 2010xxxxxxxx). */
export function normalizeWhatsAppPhone(raw?: string | null): string {
  let phone = (raw || '').replace(/[^0-9]/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (phone.startsWith('01')) phone = `2${phone}`;
  return phone;
}

export function buildInvoiceWhatsAppMessage(payload: WhatsAppInvoicePayload): string {
  const money = (value: number) =>
    Number(value || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 });
  const linkBlock = payload.publicViewUrl
    ? `🔗 *رابط عرض وتحميل الفاتورة PDF:*\n${payload.publicViewUrl}\n`
    : '';

  return `
السلام عليكم أستاذ ${payload.customerName}،
تحية طيبة من ${payload.companyName}.

مرفق تفاصيل فاتورة المبيعات الخاصة بكم:
📄 رقم الفاتورة: ${payload.invoiceNumber}
📅 التاريخ: ${payload.invoiceDate}
💰 إجمالي الفاتورة: ${money(payload.netAmount)} ج.م
💵 المدفوع: ${money(payload.paidAmount)} ج.م
📌 المتبقي المستحق: ${money(payload.remainingAmount)} ج.م

${linkBlock}شكراً لتعاملكم معنا!
`.trim();
}

export function buildInvoiceWhatsAppUrl(payload: WhatsAppInvoicePayload): string {
  const phone = normalizeWhatsAppPhone(payload.customerPhone);
  const message = buildInvoiceWhatsAppMessage(payload);
  return phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function firstPartyPhone(
  party?: {
    mobile?: string | null;
    phone1?: string | null;
    phone2?: string | null;
  } | null
): string | undefined {
  return party?.mobile || party?.phone1 || party?.phone2 || undefined;
}

export function openInvoiceWhatsApp(payload: WhatsAppInvoicePayload) {
  const url = buildInvoiceWhatsAppUrl(payload);
  window.open(url, '_blank', 'noopener,noreferrer');
  return url;
}
