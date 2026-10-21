'use client';

import { useEffect, useState } from 'react';
import { MasterEntitySideDrawer } from '@/components/masters/MasterEntitySideDrawer';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { Button } from '@/components/ui';
import {
  useAccountingSettingsMutation,
  useAccountingSettingsQuery,
} from '@/lib/hooks/useAccountingSettings';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function StocktakingGlAccountsDrawer({ open, onClose }: Props) {
  const { data: settingsRes } = useAccountingSettingsQuery();
  const saveMutation = useAccountingSettingsMutation();
  const facade = settingsRes?.data;
  const [surplusId, setSurplusId] = useState('');
  const [deficitId, setDeficitId] = useState('');

  useEffect(() => {
    if (!open || !facade) return;
    setSurplusId(facade.accounts.stocktakingSurplusAccountId ?? '');
    setDeficitId(facade.accounts.stocktakingDeficitAccountId ?? '');
  }, [open, facade]);

  const surplusRef = facade?.accountDetails?.[surplusId] ?? null;
  const deficitRef = facade?.accountDetails?.[deficitId] ?? null;

  const handleSave = () => {
    saveMutation.mutate(
      {
        accounts: {
          stocktakingSurplusAccountId: surplusId || null,
          stocktakingDeficitAccountId: deficitId || null,
        },
      },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <MasterEntitySideDrawer
      open={open}
      onClose={onClose}
      title="إعدادات تسوية الجرد"
      subtitle="حسابات القيد عند ترحيل التسوية — تُستخدم أولاً إن وُجدت في إعدادات الشركة"
    >
      <div className="space-y-4 p-1">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#0A3D5E]">حساب زيادة المخزون</label>
          <AccountSelect
            value={surplusId}
            onChange={setSurplusId}
            leafOnly
            selectedAccount={
              surplusRef
                ? { id: surplusRef.id, code: surplusRef.code, arabicName: surplusRef.arabicName }
                : null
            }
            placeholder="دائن زيادة الجرد"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#0A3D5E]">حساب عجز المخزون</label>
          <AccountSelect
            value={deficitId}
            onChange={setDeficitId}
            leafOnly
            selectedAccount={
              deficitRef
                ? { id: deficitRef.id, code: deficitRef.code, arabicName: deficitRef.arabicName }
                : null
            }
            placeholder="مدين عجز الجرد"
          />
        </div>
        <p className="text-xs leading-5 text-slate-600">
          إن تُرك الحساب فارغاً يُستخدم حساب تسوية المخزون العام من إعدادات المحاسبة.
        </p>
        <Button
          type="button"
          variant="primary"
          className="w-full"
          isLoading={saveMutation.isPending}
          onClick={handleSave}
        >
          حفظ الإعدادات
        </Button>
      </div>
    </MasterEntitySideDrawer>
  );
}
