'use client';

import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui';
import { AutomationTemplates } from './AutomationTemplates';

export function AutomationEmptyState() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-slate-200/80 bg-white px-6 py-14 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900" dir="rtl">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0E78AA0D] text-[#0E78AA]">
        <Zap className="h-8 w-8" aria-hidden />
      </span>
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">أتمتة الأعمال المتكررة</h2>
        <p className="text-sm text-slate-600">
          أخبر GATES بما يجب أن يحدث تلقائيًا عند تغيّر أي شيء في نشاطك — بدون تدخل يدوي.
        </p>
      </div>
      <Button size="lg" onClick={() => router.push('/automation/new')}>
        إنشاء أول أتمتة
      </Button>

      <div className="mt-4 w-full border-t border-slate-100 pt-8 dark:border-slate-800">
        <p className="mb-4 text-sm font-semibold text-slate-500">أو ابدأ من فكرة جاهزة</p>
        <AutomationTemplates />
      </div>
    </div>
  );
}
