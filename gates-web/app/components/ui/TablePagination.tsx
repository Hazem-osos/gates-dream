'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, totalItems);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E6F0F7] bg-[#F6FBFD] px-4 py-2',
        className
      )}
      dir="rtl"
    >
      <p className="text-sm text-slate-600">
        {totalItems === 0
          ? 'لا توجد سجلات'
          : `عرض ${from}–${to} من ${totalItems}`}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange ? (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <span>عدد الصفوف</span>
            <select
              className="rounded-lg border border-[#D6EAF3] bg-white px-2 py-1 text-sm focus:border-[#0E78AA] focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/20"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            iconStart={<ChevronRight className="h-4 w-4" aria-hidden />}
          >
            السابق
          </Button>
          <span className="min-w-[4.5rem] text-center text-sm font-medium text-[#094C6B]">
            {safePage} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            iconEnd={<ChevronLeft className="h-4 w-4" aria-hidden />}
          >
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
}
