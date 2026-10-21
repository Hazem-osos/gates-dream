'use client';

import { toast } from '@/lib/feedback/toast';
import { DOCUMENT_UNPOSTED_LABEL } from '@/lib/documents/document-status-labels';

export type FinishDocumentSaveInput = {
  /** Arabic document name, e.g. سند إضافة */
  label: string;
  number?: string | null;
  posted?: boolean;
  savedId?: string | null;
  clearDraft?: () => void;
  /** Clears the form for a new document when `cleared` is true or there is no saved id to reopen. */
  reset: () => void;
  /**
   * When true, clear the form for the next document.
   * Default: true after حفظ وترحيل (`posted: true`); false after a manual-post
   * save so the header stays on غير مرحّل instead of resetting to مسودة.
   */
  cleared?: boolean;
  /** Reopen the document that was just saved. */
  onOpen?: (id: string) => void;
  /** After staying on the saved record (invalidate detail queries, etc.). */
  onSavedOpen?: (id: string) => void;
};

/**
 * After حفظ: stay on the saved unposted document (غير مرحّل).
 * After حفظ وترحيل: toast, then clear the screen for the next document.
 */
export function finishDocumentSave(input: FinishDocumentSaveInput) {
  const num = String(input.number ?? '').trim() || '—';
  const verb = input.posted ? 'تم حفظ وترحيل' : 'تم حفظ';
  const id = input.savedId?.trim() || '';
  const cleared = input.cleared ?? input.posted === true;
  const stayOnSaved = Boolean(id && input.onOpen && !cleared);

  toast.success(`${verb} ${input.label}`, {
    description: stayOnSaved
      ? input.posted
        ? `${input.label} رقم ${num}.`
        : `${input.label} رقم ${num} — ${DOCUMENT_UNPOSTED_LABEL}.`
      : `${input.label} رقم ${num}. الصفحة جاهزة لمستند جديد.`,
    action:
      id && input.onOpen && !stayOnSaved
        ? {
            label: 'فتح',
            onClick: () => input.onOpen?.(id),
          }
        : undefined,
  });
  input.clearDraft?.();
  if (stayOnSaved && input.onOpen) {
    input.onOpen(id);
    input.onSavedOpen?.(id);
    return;
  }
  input.reset();
}
