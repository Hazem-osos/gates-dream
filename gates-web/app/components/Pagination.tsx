'use client';

import React from 'react';
import {
  TbChevronLeft,
  TbChevronRight,
  TbChevronsLeft,
  TbChevronsRight,
} from 'react-icons/tb';

const iconClass = 'w-4 h-4 text-[#094C6B]';

const btnBase =
  'flex flex-col justify-center items-center w-8 h-8 bg-white rounded-lg border border-solid border-[color:var(--Blue-Light,#DEEFF6)] min-h-8 disabled:opacity-40 disabled:cursor-not-allowed';

export interface PaginationProps {
  /** Current 1-based page number. Omit (along with the other props) to render static demo chrome. */
  page?: number;
  /** Number of rows per page. */
  pageSize?: number;
  /** Total number of rows across all pages. */
  total?: number;
  /** Called with the next page number when the user navigates. */
  onPageChange?: (page: number) => void;
}

const isControlled = (props: PaginationProps): boolean =>
  props.page !== undefined && props.onPageChange !== undefined;

/** Ascending page numbers to render, with -1 markers standing in for an ellipsis. */
function buildPageWindow(current: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, current]);
  if (current - 1 >= 1) pages.add(current - 1);
  if (current + 1 <= totalPages) pages.add(current + 1);
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const withEllipsis: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) withEllipsis.push(-1);
    withEllipsis.push(sorted[i]);
  }
  return withEllipsis;
}

/**
 * Pagination control. Historically this was static demo chrome with hardcoded
 * page numbers (1/2/3/10) and no click handlers — every one of the ~90 pages
 * importing it was decorative. Passing `page`/`pageSize`/`total`/`onPageChange`
 * now makes it a real controlled pager; omitting all of them keeps the exact
 * legacy static appearance so unmigrated call sites are unaffected.
 */
const Pagination: React.FC<PaginationProps> = (props) => {
  const controlled = isControlled(props);

  if (!controlled) {
    return (
      <nav className="flex gap-1.5 items-start min-w-60" aria-label="Pagination">
        <button
          type="button"
          aria-label="آخر صفحة"
          className="flex flex-col justify-center items-center pr-2 pl-2 w-8 h-8 bg-white rounded-lg border border-solid border-[color:var(--Blue-Light,#DEEFF6)] min-h-8"
        >
          <TbChevronsRight className={iconClass} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="الصفحة التالية"
          className="flex flex-col justify-center items-center px-2 w-8 h-8 bg-white rounded-lg border border-solid border-[color:var(--Blue-Light,#DEEFF6)] min-h-8"
        >
          <TbChevronRight className={iconClass} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="التالي"
          className="flex flex-col justify-center items-center px-2.5 w-8 h-8 bg-white rounded-lg border border-solid border-[color:var(--Blue-Light,#DEEFF6)] min-h-8"
        >
          <TbChevronRight className="w-2 h-4 text-[#094C6B]" aria-hidden />
        </button>
        <button
          type="button"
          className="pr-2.5 pl-2 w-8 h-8 text-sm font-semibold whitespace-nowrap bg-white rounded-lg border border-solid border-[color:var(--Blue-Light,#DEEFF6)] min-h-8 text-zinc-800"
        >
          10
        </button>
        <span className="px-2.5 w-8 h-8 text-sm font-semibold whitespace-nowrap bg-white rounded-lg min-h-8 text-zinc-800">
          ...
        </span>
        <button
          type="button"
          className="px-2.5 w-8 h-8 text-sm font-semibold whitespace-nowrap bg-white rounded-lg border border-solid border-[color:var(--Blue-Light,#DEEFF6)] min-h-8 text-zinc-800"
        >
          3
        </button>
        <button
          type="button"
          className="px-2.5 w-8 h-8 text-sm font-semibold whitespace-nowrap bg-white rounded-lg border border-solid border-[color:var(--Blue-Light,#DEEFF6)] min-h-8 text-zinc-800"
        >
          2
        </button>
        <button
          type="button"
          aria-current="page"
          className="px-2.5 w-8 h-8 text-sm font-semibold text-white whitespace-nowrap bg-sky-700 rounded-lg min-h-8"
        >
          1
        </button>
        <button
          type="button"
          aria-label="السابق"
          className="flex flex-col justify-center items-center px-2.5 w-8 h-8 bg-white rounded-lg border border-solid border-[color:var(--Blue-Light,#DEEFF6)] min-h-8"
        >
          <TbChevronLeft className="w-2 h-4 text-[#094C6B]" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="الصفحة السابقة"
          className="flex flex-col justify-center items-center px-2 w-8 h-8 bg-white rounded-lg border border-solid border-[color:var(--Blue-Light,#DEEFF6)] min-h-8"
        >
          <TbChevronLeft className={iconClass} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="أول صفحة"
          className="flex flex-col justify-center items-center pr-2 pl-2 w-8 h-8 bg-white rounded-lg border border-solid border-[color:var(--Blue-Light,#DEEFF6)] min-h-8"
        >
          <TbChevronsLeft className={iconClass} aria-hidden />
        </button>
      </nav>
    );
  }

  const pageSize = props.pageSize && props.pageSize > 0 ? props.pageSize : 10;
  const total = props.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, props.page as number), totalPages);
  const onPageChange = props.onPageChange as (page: number) => void;
  const goTo = (p: number) => {
    const clamped = Math.min(Math.max(1, p), totalPages);
    if (clamped !== current) onPageChange(clamped);
  };
  const isFirst = current <= 1;
  const isLast = current >= totalPages;
  // Reversed so the highest page number renders first in the DOM — in this
  // RTL flex row that places it on the right, matching the legacy chrome's
  // left-to-right ascending numbers (1..N) on screen.
  const window = buildPageWindow(current, totalPages).slice().reverse();

  return (
    <nav className="flex gap-1.5 items-start min-w-60" aria-label="Pagination">
      <button
        type="button"
        aria-label="آخر صفحة"
        disabled={isLast}
        onClick={() => goTo(totalPages)}
        className={`${btnBase} pr-2 pl-2`}
      >
        <TbChevronsRight className={iconClass} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="الصفحة التالية"
        disabled={isLast}
        onClick={() => goTo(current + 1)}
        className={`${btnBase} px-2`}
      >
        <TbChevronRight className={iconClass} aria-hidden />
      </button>
      {window.map((p, i) =>
        p === -1 ? (
          <span
            key={`ellipsis-${i}`}
            className="px-2.5 w-8 h-8 text-sm font-semibold whitespace-nowrap bg-white rounded-lg min-h-8 text-zinc-800 flex items-center justify-center"
          >
            ...
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === current ? 'page' : undefined}
            onClick={() => goTo(p)}
            className={
              p === current
                ? 'px-2.5 w-8 h-8 text-sm font-semibold text-white whitespace-nowrap bg-sky-700 rounded-lg min-h-8'
                : 'px-2.5 w-8 h-8 text-sm font-semibold whitespace-nowrap bg-white rounded-lg border border-solid border-[color:var(--Blue-Light,#DEEFF6)] min-h-8 text-zinc-800'
            }
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        aria-label="السابق"
        disabled={isFirst}
        onClick={() => goTo(current - 1)}
        className={`${btnBase} px-2.5`}
      >
        <TbChevronLeft className={iconClass} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="الصفحة السابقة"
        disabled={isFirst}
        onClick={() => goTo(current - 1)}
        className={`${btnBase} px-2`}
      >
        <TbChevronLeft className={iconClass} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="أول صفحة"
        disabled={isFirst}
        onClick={() => goTo(1)}
        className={`${btnBase} pr-2 pl-2`}
      >
        <TbChevronsLeft className={iconClass} aria-hidden />
      </button>
    </nav>
  );
};

export default Pagination;
