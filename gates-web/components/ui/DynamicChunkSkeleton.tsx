'use client';

import { DrawerOrModalSkeleton, Skeleton } from '@/components/ui/skeletons';

/** Lightweight placeholder while a `next/dynamic` overlay chunk is fetched. */
export function DynamicChunkSkeleton({
  className,
  label = 'جاري التحميل…',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={className ?? 'rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] p-4'}
      role="status"
      aria-live="polite"
    >
      <Skeleton className="mb-3 h-4 w-32" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <p className="sr-only">{label}</p>
    </div>
  );
}

/** Placeholder for a large invoice/journal line grid while its chunk loads. */
export function LineGridSkeleton({ label = 'جاري تحميل بنود المستند…' }: { label?: string }) {
  return (
    <div
      className="mt-3 min-h-[min(380px,42vh)] rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] p-3"
      role="status"
      aria-live="polite"
    >
      <Skeleton className="mb-2 h-8 w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
      <p className="sr-only">{label}</p>
    </div>
  );
}

/** Centered overlay skeleton for form modals and drawers. */
export function DynamicModalSkeleton({ label = 'جاري تحميل النافذة…' }: { label?: string }) {
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/20"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        <DrawerOrModalSkeleton label={label} fields={4} />
      </div>
    </div>
  );
}
