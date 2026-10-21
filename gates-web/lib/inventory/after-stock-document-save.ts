import { apiClient } from '@/lib/api/client';
import { postNamedDocumentAfterSave } from '@/lib/accounting/ensure-posted-after-save';
import { postSuccessMessage } from '@/lib/inventory/use-document-post-mutation';

/**
 * After فك الترحيل + تعديل الكميات، الحفظ يعيد الترحيل بالقيم الجديدة (مثل الإضافة/الصرف).
 */
export async function repostStockDocumentAfterEditSave(
  postPath: string,
  handlers: {
    onPosted: (postRes: unknown) => void;
    onPostFailed: (message: string) => void;
  }
): Promise<boolean> {
  try {
    const postRes = await apiClient.post(postPath, {}, { skipSuccessNotify: true });
    handlers.onPosted(postRes);
    postSuccessMessage(postRes);
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'تم الحفظ لكن تعذر إعادة الترحيل';
    handlers.onPostFailed(message);
    return false;
  }
}

export async function tryRepostAfterUnpostOnSave(
  shouldRepost: boolean,
  documentId: string | null | undefined,
  postPath: string,
  handlers: {
    onPosted: (postRes: unknown) => void;
    onPostFailed: (message: string) => void;
    onSkipped: () => void;
  }
): Promise<boolean> {
  if (!shouldRepost || !documentId) {
    handlers.onSkipped();
    return false;
  }
  return repostStockDocumentAfterEditSave(postPath, handlers);
}
