import { apiClient } from '@/lib/api/client';

export type WhatsAppShareResult = {
  token: string;
  downloadUrl: string;
  text: string;
  phone: string | null;
  waUrl: string;
};

export async function createInvoiceWhatsAppShare(invoiceId: string, phone?: string) {
  const res = await apiClient.post<WhatsAppShareResult>(`/share/invoice/${invoiceId}`, phone ? { phone } : {});
  if (!res.data) throw new Error(res.message || 'تعذر تجهيز رابط الواتساب');
  return res.data;
}

export async function createStatementWhatsAppShare(input: {
  customerId?: string;
  supplierId?: string;
  phone?: string;
}) {
  const res = await apiClient.post<WhatsAppShareResult>('/share/statement', input);
  if (!res.data) throw new Error(res.message || 'تعذر تجهيز كشف الحساب');
  return res.data;
}

export function openWhatsAppShare(result: WhatsAppShareResult) {
  window.open(result.waUrl, '_blank', 'noopener,noreferrer');
}
