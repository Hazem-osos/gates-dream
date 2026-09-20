'use client';

import { useRouter } from 'next/navigation';
import { Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui';

export function AutomationHero() {
  const router = useRouter();

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-[#0E78AA]/15 bg-gradient-to-l from-[#0E78AA] to-[#0A5F8A] px-6 py-8 text-white shadow-sm sm:px-8"
      dir="rtl"
    >
      <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-12 right-10 h-48 w-48 rounded-full bg-white/5 blur-3xl" aria-hidden />
      <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold">
            <Zap className="h-3.5 w-3.5" aria-hidden />
            أتمتة Gates
          </span>
          <h1 className="text-2xl font-bold sm:text-3xl">ضع أعمالك على الطيار الآلي</h1>
          <p className="mt-2 text-sm text-white/85 sm:text-base">
            أنشئ قواعد تتفاعل تلقائيًا مع ما يحدث في GATES، وتنفّذ الخطوة التالية دون تدخل منك.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => router.push('/automation/new')}
          className="shrink-0 bg-white text-[#094C6B] hover:bg-white/90"
          iconStart={<Plus className="h-4 w-4" aria-hidden />}
        >
          إنشاء أتمتة
        </Button>
      </div>
    </section>
  );
}
