import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

export function DrawerOrModalSkeleton({
  fields = 5,
  className,
  label = 'جاري تحميل النموذج…',
}: {
  fields?: number;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn('space-y-4', className)}
      role="status"
      aria-busy="true"
      aria-label={label}
      dir="rtl"
    >
      <Skeleton className="h-6 w-40" />
      <div className="space-y-3">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Skeleton className="h-10 w-20 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
      <p className="sr-only">{label}</p>
    </div>
  );
}

export { DrawerOrModalSkeleton as DrawerSkeleton };
