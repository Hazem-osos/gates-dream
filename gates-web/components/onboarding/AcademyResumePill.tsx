'use client';

import { useAcademyStore } from '@/lib/onboarding/academyStore';
import { getAcademyProgram } from '@/lib/onboarding/academyTours';

/**
 * Small floating pill shown while the tour is `PAUSED` (driver destroyed but
 * `activeProgramId`/`activeStepIndex` kept in the store). Calls back into
 * `resumeTour()` (wired from `ProductTourProvider`) to recreate the driver
 * at the stored step.
 */
export function AcademyResumePill({ onResume }: { onResume: () => void }) {
  const status = useAcademyStore((s) => s.status);
  const activeProgramId = useAcademyStore((s) => s.activeProgramId);
  const activeStepIndex = useAcademyStore((s) => s.activeStepIndex);
  const totalSteps = useAcademyStore((s) => s.totalSteps);

  if (status !== 'PAUSED' || !activeProgramId) return null;

  const program = getAcademyProgram(activeProgramId);

  return (
    <button
      type="button"
      onClick={onResume}
      dir="rtl"
      className="fixed bottom-5 left-5 z-[9996] flex items-center gap-2 rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xl ring-1 ring-sky-700/50 transition-transform hover:scale-105 hover:bg-sky-700"
    >
      <span aria-hidden>{program.emoji}</span>
      <span>استكمال الجولة</span>
      {totalSteps > 0 && (
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
          {activeStepIndex + 1}/{totalSteps}
        </span>
      )}
    </button>
  );
}
