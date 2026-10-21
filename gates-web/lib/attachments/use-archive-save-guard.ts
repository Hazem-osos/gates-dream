'use client';

import { useCallback } from 'react';
import { listAttachments } from '@/lib/attachments/api';
import { archivePolicyFromSettings, archivePolicySatisfied } from '@/lib/attachments/archive-policy';
import { resolveArchiveTarget } from '@/lib/attachments/archive-entity';
import type { DocumentCategory } from '@/lib/attachments/types';
import { useTransactionDocumentSettings } from '@/lib/transaction-settings/use-transaction-document-settings';
import type { TransactionDocumentType } from '@/lib/transaction-settings/types';
import { toast } from '@/lib/feedback/toast';

export function useArchiveSaveGuard(input: {
  documentType?: TransactionDocumentType;
  documentId?: string | null;
}) {
  const { settings } = useTransactionDocumentSettings(input.documentType);
  const policy = archivePolicyFromSettings(settings);

  const assertArchiveBeforeSave = useCallback(async (): Promise<boolean> => {
    if (!policy.requireOnSave) return true;
    const target = resolveArchiveTarget({
      documentId: input.documentId,
      transactionSettingsDocumentType: input.documentType,
    });
    if (!target) {
      toast.error('احفظ المستند أولاً ثم أرفق المستندات في الأرشيف.');
      return false;
    }
    const rows = await listAttachments({
      entityType: target.entityType,
      entityId: target.entityId,
    });
    const categories = rows.map((r) => r.fileCategory as DocumentCategory);
    const check = archivePolicySatisfied({
      requireOnSave: true,
      mode: policy.mode,
      categories: policy.categories,
      attachmentCategories: categories,
    });
    if (!check.ok) {
      toast.error(check.message ?? 'الأرشيف مطلوب قبل الحفظ');
      return false;
    }
    return true;
  }, [input.documentId, input.documentType, policy]);

  return { assertArchiveBeforeSave, archivePolicy: policy };
}
