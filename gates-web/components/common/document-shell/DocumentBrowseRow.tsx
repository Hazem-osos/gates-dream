'use client';

import { StatusBadge } from '@/components/ui';
import {
  savedDocumentRowStatus,
  type DocumentLifecycleStatus,
} from '@/lib/documents/document-status-labels';

/** Status badge for a saved row in «السابق» lists. */
export function documentBrowseRowStatus(row: {
  isPosted?: boolean | null;
  isCancelled?: boolean | null;
}): DocumentLifecycleStatus {
  return savedDocumentRowStatus(row);
}

export function DocumentBrowseStatusBadge(row: {
  isPosted?: boolean | null;
  isCancelled?: boolean | null;
}) {
  const status = documentBrowseRowStatus(row);
  return <StatusBadge tone={status.tone} label={status.label} />;
}
