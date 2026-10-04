'use client';

import { useMemo } from 'react';
import { AccountFormModal } from '@/components/accounting/chart-of-accounts/AccountFormModal';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';
import { useInvalidateQuery } from '@/lib/hooks/useApi';
import { useAccountsQuery, type BankAccountOption } from '@/lib/hooks/useMasterDataQueries';
import type { CoaHierarchyAccount } from '@/lib/accounting/mapCoaToTreeNodes';

export type QuickCreatedBankAccount = {
  id: string;
  arabicName: string;
  code?: string | null;
};

type Props = {
  open: boolean;
  initialName?: string;
  currencyCode?: string;
  onClose: () => void;
  onCreated: (bankAccount: QuickCreatedBankAccount) => void;
};

const BANKS_PARENT_CODE = '1112';

function isBanksParent(row: { code?: string | null; arabicName?: string | null }) {
  const code = String(row.code ?? '').trim();
  const name = String(row.arabicName ?? '').trim();
  return code === BANKS_PARENT_CODE || name === 'البنوك والحسابات الجارية' || name === 'البنوك';
}

export function QuickCreateBankAccountModal({
  open,
  initialName = '',
  onClose,
  onCreated,
}: Props) {
  const invalidate = useInvalidateQuery();
  const { data: byCode } = useAccountsQuery(BANKS_PARENT_CODE, 50, { enabled: open });
  const { data: byName } = useAccountsQuery('البنوك', 50, { enabled: open });

  const parentAccount = useMemo<CoaHierarchyAccount | null>(() => {
    const rows = [...(byCode?.data ?? []), ...(byName?.data ?? [])];
    const row = rows.find(isBanksParent);
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      arabicName: row.arabicName,
      accountKind: 'HEADER',
      accountType: row.accountType ?? 'asset',
      nature: 'DEBIT',
    };
  }, [byCode?.data, byName?.data]);

  const attachCreatedBank = async (account: { id: string; code: string; arabicName: string }) => {
    invalidate(['bank-accounts']);
    try {
      const res = await apiClient.get<BankAccountOption[]>('/accounting/bank-accounts', { isActive: true });
      const match = (res.data ?? []).find((bank) => bank.glAccount?.id === account.id);
      if (!match?.id) {
        toast.error('تم حفظ الحساب لكن تعذر ربطه بالبنك. حدّث القائمة ثم اختر الحساب البنكي.');
        return;
      }
      onCreated({
        id: match.id,
        arabicName: match.arabicName || account.arabicName,
        code: match.glAccount?.code || match.code || account.code,
      });
    } catch {
      toast.error('تم حفظ الحساب لكن تعذر تحديث قائمة البنوك.');
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
      lockParentHint="الحساب البنكي الجديد بينزل تحت البنوك."
      lockParentMissingMessage="حساب البنوك غير جاهز. حدّث الصفحة ثم أعد المحاولة."
      lockParentEmptyLabel="البنوك"
      onClose={onClose}
      onSaved={() => undefined}
      onCreatedAccount={(account) => {
        void attachCreatedBank(account);
      }}
      onError={(msg) => toast.error('تعذّر حفظ الحساب', { description: msg })}
    />
  );
}
