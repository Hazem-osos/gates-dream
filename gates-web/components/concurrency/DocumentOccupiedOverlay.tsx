'use client';

import { useRouter } from 'next/navigation';
import { useAppTabs } from '@/app/components/AppTabsContext';
import { moduleRootForPath, normalizeAppPath } from '@/lib/navigation/app-module-root';
import { useOwnTabPathname } from '@/lib/navigation/tab-route-lock';

type Props = {
  open: boolean;
  holderName?: string | null;
};

export function DocumentOccupiedOverlay({ open, holderName }: Props) {
  const router = useRouter();
  const tabs = useAppTabs();
  const path = normalizeAppPath(useOwnTabPathname());

  if (!open) return null;

  const leave = () => {
    const remaining = (tabs?.tabs ?? []).filter((tab) => tab.path !== path);
    tabs?.closeTab(path);
    if (remaining.length > 0) {
      const last = remaining[remaining.length - 1];
      router.push(last.href || last.path);
      return;
    }
    router.push(moduleRootForPath(path) || '/');
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/50 px-4" dir="rtl">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="document-occupied-title"
        className="w-full max-w-md rounded-2xl border border-[#D6EAF3] bg-white p-6 shadow-xl"
      >
        <h2 id="document-occupied-title" className="text-lg font-bold text-[#0A3D5E]">
          السند مفتوح عند شخص آخر
        </h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          {holderName ? `${holderName} فاتح نفس السند دلوقتي ويقدر يشتغل عليه.` : 'السند مفتوح عند موظف تاني في الشركة.'}
          {' '}
          ممنوع التعديل من هنا حتى يخرج هو. اضغط خروج من الصفحة.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={leave}
            className="rounded-lg bg-[#0E79AA] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A3D5E]"
          >
            خروج من الصفحة
          </button>
        </div>
      </div>
    </div>
  );
}
