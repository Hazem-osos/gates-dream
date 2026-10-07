import type { MutableRefObject } from 'react';
import { getTenantContext } from '@/lib/tenant/tenant-context-storage';

/** Primary action on warehouse store-document screens: persist then POST /:id/post. */
export const STORE_SAVE_AND_POST_LABEL = 'حفظ وترحيل';

export function armStoreDocumentPostAfterSave(postAfterSaveRef: MutableRefObject<boolean>) {
  postAfterSaveRef.current = true;
}

/** Only send a branch id that is a real branch row, not companyId stored by mistake. */
export function getBranchIdForStoreDocumentSave(): string | undefined {
  const { companyId, branchId } = getTenantContext();
  if (!branchId || branchId === companyId) return undefined;
  return branchId;
}
