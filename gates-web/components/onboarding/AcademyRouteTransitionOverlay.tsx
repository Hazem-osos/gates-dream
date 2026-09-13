'use client';

/**
 * Brief dim + spinner shown between `pushTourRoute(...)` and the
 * MutationObserver resolving the next step's target element. Purely
 * cosmetic — the tour engine keeps working even if this never mounts.
 */
export function AcademyRouteTransitionOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9997] flex items-center justify-center bg-slate-900/15 backdrop-blur-[2px] transition-opacity"
      role="status"
      aria-live="polite"
      aria-label="جاري التنقل إلى الخطوة التالية"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-white/95 px-5 py-3 shadow-xl ring-1 ring-slate-200">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
        <span className="text-sm font-semibold text-slate-700">جاري الانتقال إلى الخطوة التالية…</span>
      </div>
    </div>
  );
}
