import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';
import { MetricCardsSkeleton } from './MetricCardsSkeleton';
import { TableSkeleton } from './TableSkeleton';

export type PageSkeletonVariant = 'workspace' | 'document' | 'settings';

export function PageSkeleton({
  variant = 'workspace',
  tiles = 4,
  className,
}: {
  variant?: PageSkeletonVariant;
  tiles?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'gates-content-enter min-h-screen bg-[#E3F6FC] p-4 sm:p-6',
        className
      )}
      role="status"
      aria-busy="true"
      aria-label="جاري تحميل الصفحة"
      dir="rtl"
    >
      <div className="w-full max-w-none space-y-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24 rounded-lg" />
              <Skeleton className="h-10 w-28 rounded-lg" />
            </div>
          </div>
        </div>

        {variant !== 'settings' ? <MetricCardsSkeleton count={tiles} /> : null}

        {variant === 'workspace' ? (
          <>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-32 rounded-lg" />
              <Skeleton className="h-9 w-20 rounded-lg" />
            </div>
            <TableSkeleton rowCount={7} columnCount={6} />
          </>
        ) : null}

        {variant === 'document' ? (
          <div className="rounded-2xl border border-[#D6EAF3] bg-white p-5 shadow-sm">
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
            <TableSkeleton rowCount={5} columnCount={5} className="border-0 shadow-none" />
          </div>
        ) : null}

        {variant === 'settings' ? (
          <div className="rounded-2xl border border-[#D6EAF3] bg-white p-5 shadow-sm">
            <Skeleton className="mb-4 h-5 w-40" />
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Skeleton className="h-10 w-24 rounded-lg" />
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
