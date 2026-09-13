'use client';

import { useAcademyStore } from '@/lib/onboarding/academyStore';
import { GATES_TOUR_INTERRUPT_EVENT } from '@/lib/onboarding/tourCheckpoints';

/**
 * Slim top banner shown while a sandbox-flagged tour is active (tours whose
 * final step performs a real POST/mutation, e.g. first invoice, journal
 * entry). Purely informational — quick-exit destroys the active driver via
 * the existing tour-interrupt event, same path as the Escape key / skip.
 *
 * Known limitation: this does not spin up an ephemeral sandbox tenant; it
 * only labels the training session and (via the INPUT_CHANGE trigger
 * handler) prefixes free-text fields with "[تدريب]" so any real record
 * created during the tour stays discoverable/cleanable afterward.
 */
export function AcademySandboxBanner() {
  const sandboxActive = useAcademyStore((s) => s.sandboxActive);
  const status = useAcademyStore((s) => s.status);

  if (!sandboxActive || status === 'IDLE' || status === 'COMPLETED') return null;

  const onExit = () => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(GATES_TOUR_INTERRUPT_EVENT));
  };

  return (
    <div
      className="fixed inset-x-0 top-0 z-[9996] flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-semibold text-amber-950 shadow-md"
      role="status"
    >
      <span>🧪 أنت في وضع التدريب — سيتم تمييز أي بيانات تُنشأ بعبارة «[تدريب]»</span>
      <button
        type="button"
        onClick={onExit}
        className="rounded-md bg-amber-950/10 px-2.5 py-1 text-xs font-bold text-amber-950 transition-colors hover:bg-amber-950/20"
      >
        إنهاء الجولة
      </button>
    </div>
  );
}
