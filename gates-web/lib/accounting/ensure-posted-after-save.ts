import { useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api/client';

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

export function isAlreadyPostedError(error: unknown): boolean {
  const message = errorMessage(error);
  return message.includes('مرحّل مسبقاً') || /already posted/i.test(message);
}

function isJournalAutoPostNoop(error: unknown): boolean {
  const message = errorMessage(error);
  return (
    isAlreadyPostedError(error) ||
    message.includes('حالته الحالية') ||
    /current workflow state/i.test(message)
  );
}

export async function postJournalAfterSave(journalEntryId: string): Promise<'posted' | 'kept'> {
  try {
    await apiClient.post(`/accounting/journal-entries/${journalEntryId}/post`, {});
    return 'posted';
  } catch (error) {
    if (isJournalAutoPostNoop(error)) return 'kept';
    throw error;
  }
}

export async function postInvoiceAfterSave(invoiceId: string): Promise<'posted' | 'kept'> {
  try {
    await apiClient.post(`/invoices/${invoiceId}/post`, {});
    return 'posted';
  } catch (error) {
    if (isAlreadyPostedError(error)) return 'kept';
    throw error;
  }
}

export async function postCashVoucherAfterSave(voucherId: string): Promise<'posted' | 'kept'> {
  try {
    await apiClient.post(`/treasury/cash-transactions/${voucherId}/post`, {});
    return 'posted';
  } catch (error) {
    if (isAlreadyPostedError(error)) return 'kept';
    throw error;
  }
}

export async function postNamedDocumentAfterSave(
  path: string
): Promise<'posted' | 'kept'> {
  try {
    await apiClient.post(path, {});
    return 'posted';
  } catch (error) {
    if (isAlreadyPostedError(error)) return 'kept';
    throw error;
  }
}

/** After فك الترحيل, the next successful save must re-post the journal. */
export function useRepostAfterUnpost() {
  const keepPostedRef = useRef(false);

  const markUnpostedForEdit = useCallback(() => {
    keepPostedRef.current = true;
  }, []);

  const consumeShouldRepost = useCallback(() => {
    const should = keepPostedRef.current;
    keepPostedRef.current = false;
    return should;
  }, []);

  const resetKeepPosted = useCallback(() => {
    keepPostedRef.current = false;
  }, []);

  return { markUnpostedForEdit, consumeShouldRepost, resetKeepPosted };
}
