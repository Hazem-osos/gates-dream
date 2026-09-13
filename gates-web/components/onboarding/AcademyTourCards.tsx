'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { AcademyProgramId } from '@/lib/onboarding/academyTours';
import type { AcademyModuleCardData } from '@/lib/onboarding/toursData';
import { readAcademyProgress } from '@/lib/onboarding/academyProgress';

type Props = {
  modules: AcademyModuleCardData[];
  onStartProgram: (id: AcademyProgramId) => void;
};

export function AcademyTourCards({ modules, onStartProgram }: Props) {
  const [completed, setCompleted] = useState<AcademyProgramId[]>([]);

  useEffect(() => {
    const sync = () => setCompleted(readAcademyProgress().completedPrograms);
    sync();
    window.addEventListener('gates:academy-progress', sync);
    return () => window.removeEventListener('gates:academy-progress', sync);
  }, []);

  return (
    <ul className="space-y-4">
      {modules.map((mod) => {
        const done = completed.includes(mod.programId);
        return (
          <li
            key={mod.programId}
            className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md"
          >
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${mod.iconBgClass}`}
                  aria-hidden
                >
                  {mod.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                    {mod.title}
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      ⏱️ المدة: {mod.durationLabel}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      🎯 عدد المحطات: {mod.stationCount} خطوات
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      🏷️ مستوى: {mod.levelLabel}
                    </span>
                    {mod.sandboxRecommended && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        🧪 وضع تدريب
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{mod.overview}</p>

              <div>
                <p className="text-xs font-bold text-slate-800 mb-2">
                  ماذا ستتعلم في هذه الجولة؟
                </p>
                <ul className="space-y-1.5">
                  {mod.takeaways.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-xs text-slate-700">
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500 mt-0.5" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
              {done ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="inline-flex items-center justify-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800">
                    ✓ تم إكمالها
                  </span>
                  <button
                    type="button"
                    onClick={() => onStartProgram(mod.programId)}
                    className="text-xs font-semibold text-[#0E79AA] hover:underline text-center"
                  >
                    إعادة التشغيل
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onStartProgram(mod.programId)}
                  className="w-full rounded-xl bg-[#0E79AA] py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#095a80] transition-colors"
                >
                  🚀 ابدأ الجولة التفاعلية
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
