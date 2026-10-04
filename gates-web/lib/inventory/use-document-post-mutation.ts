'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { ApiError, ApiResponse } from '@/lib/api/types';

/**
 * Post/unpost a saved store document using the current document id at click time
 * (avoids stale URLs when the id was just assigned after create).
 */
export function useDocumentPostMutation<T = unknown>(
  basePath: string,
  documentId: string | null,
  action: 'post' | 'unpost' = 'post'
) {
  return useMutation<ApiResponse<T>, ApiError, Record<string, unknown>>({
    mutationFn: async (body) => {
      const id = documentId?.trim();
      if (!id) {
        throw Object.assign(
          new Error('احفظ المستند أولاً ثم اضغط ترحيل'),
          { status: 'error' as const, code: '428' }
        ) as ApiError;
      }
      const suffix = action === 'post' ? 'post' : 'unpost';
      return apiClient.post<T>(`${basePath}/${id}/${suffix}`, body, { skipSuccessNotify: true });
    },
  });
}

export function postSuccessMessage(res?: ApiResponse<unknown>): string {
  const glSkipped = Boolean((res?.data as { glSkipped?: boolean } | undefined)?.glSkipped);
  if (glSkipped) {
    return 'تم ترحيل المخزون. لم يُنشأ قيد محاسبي — عرّف حسابات المخزون من إعدادات الشركة.';
  }
  return 'تم الترحيل بنجاح';
}
