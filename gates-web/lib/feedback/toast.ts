'use client';

import { toast as sonnerToast } from 'sonner';
import { localizeApiErrorMessage } from '@/lib/api/localize-api-error-message';
import { openVersionConflict } from '@/lib/concurrency/version-conflict';

export { toast } from 'sonner';

export function toastInvoiceSaveError(message: string) {
  sonnerToast.error('تعذر حفظ الفاتورة', {
    description:
      localizeApiErrorMessage(message) || 'يرجى التحقق من الحقول المطلوبة ورصيد المخزن.',
  });
}

/**
 * Wave 5 fix: a 409 from the `expectedVersion` optimistic-lock guard means
 * someone else saved this document after it was loaded here — any further
 * edit on top of the stale form would either fail again or (for fields the
 * guard doesn't cover) silently clobber their change. Surface a dedicated
 * "reload" action instead of the generic save-error toast so the user's
 * next move is obvious.
 */
export function toastVersionConflict(_message: string, onReload: () => void) {
  openVersionConflict({ onReload });
}
