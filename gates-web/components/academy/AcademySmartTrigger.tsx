'use client';

import { GraduationCap } from 'lucide-react';

export function AcademySmartTrigger({
  visible,
  estimatedSeconds,
  onStart,
  onDismiss,
}: {
  visible: boolean;
  estimatedSeconds?: number;
  onStart: () => void;
  onDismiss: () => void;
}) {
  if (!visible) return null;
  const seconds = estimatedSeconds ?? 60;

  return (
    <div className="fixed bottom-6 right-6 z-[68] flex max-w-[min(100vw-2rem,420px)] items-center gap-3 rounded-xl border border-[#0E79AA]/30 bg-white p-3 shadow-xl">
      <div className="rounded-lg bg-[#0E79AA]/10 p-2 text-[#0E79AA]">
        <GraduationCap className="h-5 w-5 animate-bounce" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-[#094C6B]">أكاديمية Gates الذكية</p>
        <p className="text-[11px] leading-4 text-slate-500">
          تحب نعمل جولة عملية سريعة في {seconds} ثانية نشرح فيها هذه الشاشة؟
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onStart}
          className="rounded-lg bg-[#0E79AA] px-2.5 py-1 text-xs font-medium text-white"
        >
          ابدأ الجولة
        </button>
        <button type="button" onClick={onDismiss} className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">
          لاحقاً
        </button>
      </div>
    </div>
  );
}
