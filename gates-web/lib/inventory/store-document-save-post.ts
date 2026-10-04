import type { MutableRefObject } from 'react';

/** Primary action on warehouse store-document screens: persist then POST /:id/post. */
export const STORE_SAVE_AND_POST_LABEL = 'حفظ وترحيل';

export function armStoreDocumentPostAfterSave(postAfterSaveRef: MutableRefObject<boolean>) {
  postAfterSaveRef.current = true;
}
