import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

const BAR_WIDTHS = [72, 48, 85, 60, 40, 78, 55, 68, 52, 80];

export function TableSkeleton({
  rowCount,
  columnCount,
  rows,
  columns,
  className,
}: {
  rowCount?: number;
  columnCount?: number;
  /** @deprecated use rowCount */
  rows?: number;
  /** @deprecated use columnCount */
  columns?: number;
  className?: string;
}) {
  const lineCount = rowCount ?? rows ?? 6;
  const colCount = columnCount ?? columns ?? 6;

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-2xl border border-[#D6EAF3] bg-white shadow-sm',
        className
      )}
      role="status"
      aria-busy="true"
      aria-label="جاري تحميل الجدول"
      dir="rtl"
    >
      <div className="flex h-11 items-center gap-3 border-b border-[#D6EAF3] bg-[#F0F7FB] px-4">
        {Array.from({ length: colCount }).map((_, c) => (
          <Skeleton key={`h-${c}`} className="h-3 flex-1 bg-[#c5d8e4]" />
        ))}
      </div>
      <div className="divide-y divide-[#E6F0F7]">
        {Array.from({ length: lineCount }).map((_, r) => (
          <div key={r} className="flex h-[52px] items-center gap-3 px-4">
            {Array.from({ length: colCount }).map((__, c) => {
              const isBadge = c === colCount - 2;
              const isAction = c === colCount - 1;
              const width = BAR_WIDTHS[(r * colCount + c) % BAR_WIDTHS.length];
              if (isBadge) {
                return <Skeleton key={c} className="h-6 w-16 shrink-0 rounded-full" />;
              }
              if (isAction) {
                return (
                  <div key={c} className="flex w-16 shrink-0 justify-end gap-1.5">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                );
              }
              return (
                <Skeleton
                  key={c}
                  className="h-3.5 min-w-[2.5rem] flex-1"
                  style={{ maxWidth: `${width}%` }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="sr-only">جاري تحميل الصفوف…</p>
    </div>
  );
}
