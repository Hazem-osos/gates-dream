'use client';

import { toast } from '@/lib/feedback/toast';

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
   * When true, always run `reset` after save (empty screen for the next document).
   * When false or omitted and `savedId` + `onOpen` are set, reopen the saved record instead of clearing.
   */
  cleared?: boolean;
  /** Reopen the document that was just saved. */
  onOpen?: (id: string) => void;
  /** After staying on the saved record (invalidate detail queries, etc.). */
  onSavedOpen?: (id: string) => void;
};

/**
 * After حفظ or حفظ وترحيل: toast, clear browser draft, then stay on the saved
 * document (default) or clear the screen when `cleared: true`.
 */
export function finishDocumentSave(input: FinishDocumentSaveInput) {
  const num = String(input.number ?? '').trim() || '—';
  const verb = input.posted ? 'تم حفظ وترحيل' : 'تم حفظ';
  const id = input.savedId?.trim() || '';
  const stayOnSaved = Boolean(id && input.onOpen && input.cleared !== true);

  toast.success(`${verb} ${input.label}`, {
    description: stayOnSaved
      ? `${input.label} رقم ${num}.`
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
