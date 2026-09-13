'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useOnboardingStatus, type LaunchChecklistState } from '@/lib/hooks/useOnboardingStatus';
import { useClientMounted } from '@/lib/hooks/useClientMounted';

function countDone(c: LaunchChecklistState): number {
  let n = 0;
  if (c.companySetupComplete) n++;
  if (c.createdFirstItem) n++;
  if (c.createdFirstInvoice) n++;
  if (c.recordedFirstReceipt) n++;
  return n;
}

export function LaunchChecklistWidget() {
  const mounted = useClientMounted();
  const invalidateQuery = useInvalidateQuery();
  const { data: res, isLoading } = useOnboardingStatus(true);
  const checklist = res?.data?.launchChecklist;
  const isOnboarded = res?.data?.isOnboarded;

  const dismissMut = useApiMutation<unknown, { dismissed: boolean }>(
    '/onboarding/launch-checklist',
    'PATCH',
    {
      onSuccess: () => invalidateQuery(['/onboarding/status']),
    }
  );

  const done = useMemo(() => (checklist ? countDone(checklist) : 0), [checklist]);
  const allDone = done >= 4;

  if (!mounted || isLoading || !isOnboarded || !checklist || checklist.dismissed) return null;

  if (allDone) {
    return (
      <div
        className="mb-6 rounded-2xl border border-emerald-200 bg-gradient-to-l from-emerald-50 to-white p-5 shadow-sm"
        dir="rtl"
      >
        <p className="text-lg font-bold text-emerald-800">🎉 مبروك — أنت جاهز للعمل بكامل قوة النظام!</p>
        <p className="mt-1 text-sm text-emerald-700">أكملت خطوات البدء الأساسية. نتمنى لك يوماً productive.</p>
        <button
          type="button"
          onClick={() => dismissMut.mutate({ dismissed: true })}
          className="mt-3 text-sm font-medium text-emerald-800 underline"
        >
          إخفاء هذه البطاقة
        </button>
      </div>
    );
  }

  return (
    <details
      open
      className="mb-6 rounded-2xl border border-[#D6EAF3] bg-white p-5 shadow-sm group"
      dir="rtl"
    >
      <summary className="cursor-pointer list-none font-bold text-[#0E79AA]">
        🚀 خطواتك لبدء العمل بنجاح ({done}/4 مكتملة)
      </summary>
      <ul className="mt-4 space-y-3 text-sm text-gray-700">
        <li className="flex flex-wrap items-center justify-between gap-2">
          <span>{checklist.companySetupComplete ? '✅' : '⬜'} إعداد بيانات الشركة وشجرة الحسابات.</span>
        </li>
        <li className="flex flex-wrap items-center justify-between gap-2">
          <span>{checklist.createdFirstItem ? '✅' : '⬜'} إضافة أول صنف أو سحب بيانات المخزن</span>
          {!checklist.createdFirstItem && (
            <Link
              href="/inventory/creations/item-card"
              className="rounded-lg bg-[#0E79AA] px-3 py-1.5 text-xs font-bold text-white"
            >
              + إضافة صنف
            </Link>
          )}
        </li>
        <li className="flex flex-wrap items-center justify-between gap-2">
          <span>{checklist.createdFirstInvoice ? '✅' : '⬜'} إصدار أول فاتورة مبيعات</span>
          {!checklist.createdFirstInvoice && (
            <Link
              href="/inventory/operations/sales-invoice"
              data-tour="new-invoice-action"
              className="rounded-lg bg-[#0E79AA] px-3 py-1.5 text-xs font-bold text-white"
            >
              + إنشاء فاتورة
            </Link>
          )}
        </li>
        <li className="flex flex-wrap items-center justify-between gap-2">
          <span>{checklist.recordedFirstReceipt ? '✅' : '⬜'} تسجيل أول سند قبض نقدية</span>
          {!checklist.recordedFirstReceipt && (
            <Link
              href="/accounting/operations/treasury/cash-receipt"
              className="rounded-lg bg-[#0E79AA] px-3 py-1.5 text-xs font-bold text-white"
            >
              + تسجيل سند
            </Link>
          )}
        </li>
      </ul>
      <button
        type="button"
        onClick={() => dismissMut.mutate({ dismissed: true })}
        className="mt-4 text-xs text-gray-500 hover:text-gray-700"
      >
        إخفاء مؤقتاً
      </button>
    </details>
  );
}
