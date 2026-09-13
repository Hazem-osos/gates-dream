import { apiClient } from '@/lib/api/client';
import type { AiPendingAction } from './types';

export const INVOICE_OCR_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp,application/pdf';

export function isInvoiceOcrFile(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type.startsWith('image/') ||
    type === 'application/pdf' ||
    /\.(png|jpe?g|webp|pdf)$/.test(name)
  );
}

export async function ingestPurchaseInvoiceOcr(input: {
  file: File;
  conversationId?: string | null;
  caption?: string;
}) {
  const form = new FormData();
  form.append('file', input.file);
  if (input.conversationId) form.append('conversationId', input.conversationId);
  if (input.caption?.trim()) form.append('caption', input.caption.trim());
  return apiClient.upload<{
    conversationId: string;
    action: AiPendingAction;
  }>('/ai/ocr/purchase-invoice', form);
}

export async function createOcrMissingItem(actionId: string, lineIndex: number) {
  return apiClient.post<AiPendingAction>(`/ai/actions/${actionId}/ocr-create-item`, { lineIndex });
}
