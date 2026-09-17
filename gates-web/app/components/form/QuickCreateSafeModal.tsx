'use client';

import { useMemo } from 'react';
import { AccountFormModal } from '@/components/accounting/chart-of-accounts/AccountFormModal';
import { useTreasuryParentAccountId } from '@/components/accounting/SafeCardForm';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';
import { useInvalidateQuery } from '@/lib/hooks/useApi';
import { useAccountsQuery, type SafeOption } from '@/lib/hooks/useMasterDataQueries';
import type { CoaHierarchyAccount } from '@/lib/accounting/mapCoaToTreeNodes';

export type QuickCreatedSafe = {
  id: string;
  arabicName: string;
  code?: string | null;
};

type Props = {
  open: boolean;
  initialName?: string;
  currencyCode?: string;
  onClose: () => void;
  onCreated: (safe: QuickCreatedSafe) => void;
};

export function QuickCreateSafeModal({
  open,
  initialName = '',
  onClose,
  onCreated,
}: Props) {
  const invalidate = useInvalidateQuery();
  const parentId = useTreasuryParentAccountId(open);
  const { data: headersRes } = useAccountsQuery('', 500, { headerOnly: true, enabled: open });

  const parentAccount = useMemo<CoaHierarchyAccount | null>(() => {
    const row = (headersRes?.data ?? []).find((account) => account.id === parentId);
    if (row) {
      return {
        id: row.id,
        code: row.code,
        arabicName: row.arabicName,
        accountKind: 'HEADER',
        accountType: row.accountType ?? 'asset',
        nature: 'DEBIT',
      };
    }
    if (!parentId) return null;
    return {
      id: parentId,
      code: '111',
      arabicName: 'النقدية وما في حكمها',
      accountKind: 'HEADER',
      accountType: 'asset',
      nature: 'DEBIT',
    };
  }, [headersRes?.data, parentId]);

  const attachCreatedSafe = async (account: { id: string; code: string; arabicName: string }) => {
    invalidate(['safes']);
    try {
      const res = await apiClient.get<SafeOption[]>('/accounting/safes', { isActive: true });
      const match = (res.data ?? []).find((safe) => safe.glAccount?.id === account.id);
      if (!match?.id) {
        toast.error('تم حفظ الحساب لكن تعذر ربطه بالخزنة. حدّث القائمة ثم اختر الخزنة.');
        return;
      }
      onCreated({
        id: match.id,
        arabicName: match.arabicName || account.arabicName,
        code: match.code ?? account.code,
      });
    } catch {
      toast.error('تم حفظ الحساب لكن تعذر تحديث قائمة الخزن.');
    }
  };

  return (
    <AccountFormModal
      open={open}
      mode="create"
      pickerMode
      lockParent
      parentAccount={parentAccount}
      initialArabicName={initialName}
      createKind="POSTING"
      onClose={onClose}
      onSaved={() => undefined}
      onCreatedAccount={(account) => {
        void attachCreatedSafe(account);
      }}
      onError={(msg) => toast.error('تعذّر حفظ الحساب', { description: msg })}
    />
  );
}
