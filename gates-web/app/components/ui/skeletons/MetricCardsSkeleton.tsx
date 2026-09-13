import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

export function MetricCardsSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', count >= 5 && 'lg:grid-cols-5', className)}
      role="status"
      aria-busy="true"
      aria-label="جاري تحميل المؤشرات"
      dir="rtl"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex min-h-[5.5rem] flex-col justify-between rounded-xl border border-[#E6F0F7] bg-[#F6FBFD] p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="mt-3 flex items-end justify-between gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
