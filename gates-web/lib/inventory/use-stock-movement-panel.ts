'use client';

import { useCallback, useState } from 'react';
import { useInvalidateQuery } from '@/lib/hooks/useApi';
import type { ApiResponse } from '@/lib/api/types';
import {
  extractStockPostResult,
  type StockDocumentPostResult,
} from '@/lib/inventory/use-document-post-mutation';

const emptyMeta: StockDocumentPostResult = { glSkipped: false, journalEntryId: null };

export function useStockMovementPanel(
  documentId: string | null,
  isPosted: boolean,
  journalEntryIdFromDoc?: string | null
) {
  const invalidateQuery = useInvalidateQuery();
  const [postMeta, setPostMeta] = useState<StockDocumentPostResult>(emptyMeta);

  const onPosted = useCallback(
    (res?: ApiResponse<unknown>) => {
      setPostMeta(extractStockPostResult(res));
      if (!documentId) return;
      invalidateQuery(['inventory-movements-by-doc', documentId]);
      invalidateQuery(['document-audit', 'STOCK_MOVEMENT', documentId]);
    },
    [documentId, invalidateQuery]
  );

  const resetPanel = useCallback(() => {
    setPostMeta(emptyMeta);
  }, []);

  return {
    bottomSplitProps: {
      isPosted,
      documentId,
      glSkipped: Boolean(postMeta.glSkipped),
      journalEntryId: postMeta.journalEntryId ?? journalEntryIdFromDoc ?? null,
    },
    onPosted,
    resetPanel,
  };
}
