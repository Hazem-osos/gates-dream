'use client';

import { useState } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { PosAdminNav } from '@/components/pos/PosAdminNav';

type Settings = {
  varianceTolerance: number;
  varianceRequiresApproval: boolean;
  discountApprovalPercent: number | null;
  priceOverrideRequiresApproval: boolean;
  returnRequiresApproval: boolean;
  receiptFooter: string | null;
  offlineEnabled: boolean;
  blindClose?: boolean;
  pointsPerAmount?: number | null;
  exchangeClearingAccountId?: string | null;
  storeCreditAccountId?: string | null;
  giftCardAccountId?: string | null;
  depositAccountId?: string | null;
  pointsAccountId?: string | null;
};

export default function PosSettingsPage() {
  const settingsQuery = useApiQuery<Settings>(['pos-settings'], '/pos/admin/settings');
  const readiness = useApiQuery<{ shortageConfigured: boolean; surplusConfigured: boolean }>(
    ['pos-variance-readiness'],
    '/pos/shifts/readiness'
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const settings = settingsQuery.data?.data;

  async function save(patch: Partial<Settings>) {
    setError('');
    try {
      await apiClient.put('/pos/admin/settings', { ...settings, ...patch });
      await settingsQuery.refetch();
      setMessage('تم حفظ إعدادات نقطة البيع');
    } catch (err) {
      setMessage('');
      setError(err instanceof Error ? err.message : 'تعذر الحفظ');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4" dir="rtl">
      <h1 className="text-xl font-bold">إعدادات نقطة البيع</h1>
      <PosAdminNav />
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {readiness.data?.data && (!readiness.data.data.shortageConfigured || !readiness.data.data.surplusConfigured) ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
          حساب العجز أو الزيادة غير مربوط. الإقفال بفرق نقدي يتوقف حتى يُضبط من إعدادات الشركة.
        </p>
      ) : null}
      {settings ? (
        <section className="space-y-2 rounded-2xl border bg-white p-4">
          <label className="block text-sm">حد فرق الجرد
            <input defaultValue={settings.varianceTolerance} className="mt-1 h-10 w-full rounded border px-2" id="tolerance" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" defaultChecked={settings.varianceRequiresApproval} id="varianceApproval" />
            موافقة مشرف إذا تجاوز الفرق الحد
          </label>
          <label className="block text-sm">خصم يحتاج موافقة فوق %
            <input defaultValue={settings.discountApprovalPercent ?? ''} className="mt-1 h-10 w-full rounded border px-2" id="discountCap" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" defaultChecked={settings.priceOverrideRequiresApproval} id="priceApproval" />
            تعديل السعر يحتاج موافقة
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" defaultChecked={settings.returnRequiresApproval} id="returnApproval" />
            المرتجع لا يُرحّل إلا بموافقة مشرف
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" defaultChecked={settings.offlineEnabled} id="offlineEnabled" />
            السماح بصف المزامنة عند انقطاع الشبكة
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" defaultChecked={settings.blindClose} id="blindClose" />
            إقفال أعمى: الكاشير لا يرى المتوقع قبل الجرد
          </label>
          <label className="block text-sm">نقاط لكل جنيه (فارغ = بدون نقاط)
            <input defaultValue={settings.pointsPerAmount ?? ''} className="mt-1 h-10 w-full rounded border px-2" id="pointsPerAmount" />
          </label>
          <label className="block text-sm">حساب مقاصة الاستبدال
            <input defaultValue={settings.exchangeClearingAccountId ?? ''} className="mt-1 h-10 w-full rounded border px-2" id="exchangeAccount" />
          </label>
          <label className="block text-sm">حساب رصيد المتجر
            <input defaultValue={settings.storeCreditAccountId ?? ''} className="mt-1 h-10 w-full rounded border px-2" id="storeCreditAccount" />
          </label>
          <label className="block text-sm">حساب بطاقات الهدايا
            <input defaultValue={settings.giftCardAccountId ?? ''} className="mt-1 h-10 w-full rounded border px-2" id="giftAccount" />
          </label>
          <label className="block text-sm">حساب العربون
            <input defaultValue={settings.depositAccountId ?? ''} className="mt-1 h-10 w-full rounded border px-2" id="depositAccount" />
          </label>
          <label className="block text-sm">حساب النقاط
            <input defaultValue={settings.pointsAccountId ?? ''} className="mt-1 h-10 w-full rounded border px-2" id="pointsAccount" />
          </label>
          <label className="block text-sm">تذييل الإيصال
            <input defaultValue={settings.receiptFooter ?? ''} className="mt-1 h-10 w-full rounded border px-2" id="receiptFooter" />
          </label>
          <button
            type="button"
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm text-white"
            onClick={() => {
              const discount = (document.getElementById('discountCap') as HTMLInputElement).value;
              const footer = (document.getElementById('receiptFooter') as HTMLInputElement).value;
              const points = (document.getElementById('pointsPerAmount') as HTMLInputElement).value;
              const account = (id: string) => (document.getElementById(id) as HTMLInputElement).value.trim() || null;
              void save({
                varianceTolerance: Number((document.getElementById('tolerance') as HTMLInputElement).value),
                varianceRequiresApproval: (document.getElementById('varianceApproval') as HTMLInputElement).checked,
                discountApprovalPercent: discount === '' ? null : Number(discount),
                priceOverrideRequiresApproval: (document.getElementById('priceApproval') as HTMLInputElement).checked,
                returnRequiresApproval: (document.getElementById('returnApproval') as HTMLInputElement).checked,
                offlineEnabled: (document.getElementById('offlineEnabled') as HTMLInputElement).checked,
                blindClose: (document.getElementById('blindClose') as HTMLInputElement).checked,
                pointsPerAmount: points === '' ? null : Number(points),
                exchangeClearingAccountId: account('exchangeAccount'),
                storeCreditAccountId: account('storeCreditAccount'),
                giftCardAccountId: account('giftAccount'),
                depositAccountId: account('depositAccount'),
                pointsAccountId: account('pointsAccount'),
                receiptFooter: footer || null,
              });
            }}
          >
            حفظ السياسة
          </button>
        </section>
      ) : null}
    </div>
  );
}
