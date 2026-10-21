import { apiClient } from '@/lib/api/client';
import {
  journalShouldAutoPostOnSave,
  postInvoiceAfterSave,
  postNamedDocumentAfterSave,
} from '@/lib/accounting/ensure-posted-after-save';

type RestoreOpts = {
  restorePath: string;
  postPath?: string;
  kind?: 'invoice' | 'named';
  autoPostOnSave?: boolean;
  companyAutoPostGl?: boolean;
};

/**
 * Restores a soft-cancelled document, then posts when document/company settings
 * require auto-post on save (same rule as after حفظ).
 */
export async function restoreCancelledDocument(opts: RestoreOpts): Promise<void> {
  await apiClient.post(opts.restorePath, {});
  const shouldPost = journalShouldAutoPostOnSave(
    opts.autoPostOnSave === undefined ? null : { autoPostOnSave: opts.autoPostOnSave },
    opts.companyAutoPostGl
  );
  if (!shouldPost || !opts.postPath) return;
  if (opts.kind === 'invoice') {
    const id = opts.postPath.split('/').filter(Boolean).pop();
    if (id) await postInvoiceAfterSave(id);
    return;
  }
  await postNamedDocumentAfterSave(opts.postPath);
}
