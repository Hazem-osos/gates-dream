'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { AUTOMATION_TEMPLATES } from '@/lib/automation/templates';

export function AutomationTemplates() {
  const router = useRouter();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" dir="rtl">
      {AUTOMATION_TEMPLATES.map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => router.push(`/automation/new?template=${template.id}`)}
          className="group flex flex-col items-start gap-2 rounded-xl border border-slate-200/80 bg-white p-4 text-right shadow-sm transition hover:border-[#0E78AA] hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0E78AA0D] text-[#0E78AA]">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <p className="text-sm font-bold text-slate-900 dark:text-white">{template.label}</p>
          <p className="text-xs text-slate-500">{template.description}</p>
          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#0E78AA] opacity-0 transition group-hover:opacity-100">
            استخدم هذا القالب
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
      ))}
    </div>
  );
}
