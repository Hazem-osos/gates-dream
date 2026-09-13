'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export type DocumentConvertType =
  | 'PRICE_QUOTE_TO_SALE_INVOICE'
  | 'PRICE_QUOTE_TO_SALES_ORDER'
  | 'SALES_ORDER_TO_SALE_INVOICE'
  | 'PURCHASE_ORDER_TO_PURCHASE_INVOICE'
  | 'SALE_INVOICE_TO_ISSUE'
  | 'CLONE_INVOICE';

export function useDocumentConvertMutation() {
  return useMutation({
    mutationFn: (body: { type: DocumentConvertType; sourceId: string }) =>
      apiClient.post<{ targetType: string; target: { id: string } }>('/documents/convert', body),
  });
}
