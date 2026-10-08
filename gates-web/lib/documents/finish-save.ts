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
   * When true (default), clear the form for the next document after save.
   * When false and `savedId` + `onOpen` are set, reopen the saved record instead.
   */
  cleared?: boolean;
  /** Reopen the document that was just saved. */
  onOpen?: (id: string) => void;
  /** After staying on the saved record (invalidate detail queries, etc.). */
  onSavedOpen?: (id: string) => void;
};

/**
 * After حفظ or حفظ وترحيل: toast, clear browser draft, then stay on the saved
 * document when `cleared: false`, or clear the screen for the next one (default).
 */
export function finishDocumentSave(input: FinishDocumentSaveInput) {
  const num = String(input.number ?? '').trim() || '—';
  const verb = input.posted ? 'تم حفظ وترحيل' : 'تم حفظ';
  const id = input.savedId?.trim() || '';
  const cleared = input.cleared ?? true;
  const stayOnSaved = Boolean(id && input.onOpen && !cleared);

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
