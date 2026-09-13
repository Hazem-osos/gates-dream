'use client';

import { AccountSelect } from '@/app/components/form/AccountSelect';
import { compactControlClass } from '@/components/ui';
import { accountDetailFor } from '@/lib/accounting-settings/mapAccountingSettingsFacade';
import type { AccountRef } from '@/lib/accounting-settings/accounting-settings.types';

export function AccountSlotField({
  label,
  value,
  onChange,
  accountDetails,
}: {
  label: string;
  value: string;
  onChange: (accountId: string) => void;
  accountDetails: Record<string, AccountRef | null>;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-[140px] text-sm font-medium text-[#094C6B]">{label}</span>
      <AccountSelect
        className={`${compactControlClass} flex-1`}
        value={value}
        onChange={onChange}
        leafOnly
        selectedAccount={accountDetailFor(accountDetails, value)}
        placeholder="اختر حساباً تفصيلياً"
        emptyLabel="—"
      />
    </div>
  );
}
