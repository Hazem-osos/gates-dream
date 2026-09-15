'use client';

import { Sparkles } from 'lucide-react';
import { triggerScreenHelp } from '@/lib/ai/ask-screen-help';

export function ScreenHelpButton({ screenTitle }: { screenTitle: string }) {
  return (
    <button
      type="button"
      onClick={() => triggerScreenHelp(screenTitle)}
      className="flex items-center gap-1.5 rounded-lg bg-[#0E79AA]/10 px-2.5 py-1 text-xs font-medium text-[#0E79AA] transition-all hover:bg-[#0E79AA]/20"
      data-screen-help
      title="شرح طريقة استخدام هذه الشاشة وحل مشاكلها"
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span>دليل هذه الشاشة</span>
    </button>
  );
}
