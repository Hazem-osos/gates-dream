'use client';

import { AccountFormModal } from '@/components/accounting/chart-of-accounts/AccountFormModal';
import { toast } from '@/lib/feedback/toast';

export type QuickCreatedAccount = {
  id: string;
  code: string;
  arabicName: string;
};

type Props = {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onCreated: (account: QuickCreatedAccount) => void;
};

export function QuickCreateAccountModal({ open, initialName, onClose, onCreated }: Props) {
  return (
    <AccountFormModal
      open={open}
      mode="create"
      pickerMode
      initialArabicName={initialName}
      createKind="POSTING"
      onClose={onClose}
      onSaved={() => undefined}
      onCreatedAccount={onCreated}
      onError={(msg) => toast.error('تعذّر حفظ الحساب', { description: msg })}
    />
  );
}
