'use client';

import { apiClient } from '@/lib/api/client';
import { postSuccessMessage } from '@/lib/inventory/use-document-post-mutation';

export type PostStoreDocumentAfterSaveInput = {
  postPath: string;
  onPosted: () => void;
  onPostFailed: (message: string) => void;
};

/** POST /.../:id/post after a successful save; surfaces Arabic errors like receipt/issue pages. */
export async function postStoreDocumentAfterSave(input: PostStoreDocumentAfterSaveInput) {
  try {
    const res = await apiClient.post(input.postPath, {}, { skipSuccessNotify: true });
    input.onPosted();
    return postSuccessMessage(res);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'تم الحفظ وتعذر الترحيل';
    input.onPostFailed(message);
    return null;
  }
}
