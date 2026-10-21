'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { accountLedgerHref, costCenterLedgerHref } from '@/lib/reportEngine/reportRowHref';
import { useBalanceAnalysisOptional } from '@/components/report/BalanceAnalysisProvider';

function isEmptyLabel(children: ReactNode): boolean {
  if (children == null || children === false) return true;
  if (typeof children === 'string') {
    const value = children.trim();
    return !value || value === '—';
  }
  if (typeof children === 'number') return false;
  return false;
}

export function AccountLedgerLink({
  href,
  accountId,
  query,
  kind = 'account',
  showIcon = true,
  children,
  className,
}: {
  href?: string | null;
  accountId?: string | null;
  query?: Record<string, string>;
  kind?: 'account' | 'costCenter';
  showIcon?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const analysis = useBalanceAnalysisOptional();
  const resolved =
    href ??
    (kind === 'costCenter'
      ? costCenterLedgerHref({ accountId: accountId ?? '' }, query)
      : accountLedgerHref({ accountId: accountId ?? '' }, query));
  if (!resolved || isEmptyLabel(children)) return <>{children}</>;
  const openAnalysis = () => {
    if (!analysis || !accountId) return;
    analysis.open({
      accountId,
      label: typeof children === 'string' ? children : accountId,
      kind,
      query,
    });
  };
  return (
    <span className={`inline-flex max-w-full items-center gap-1 ${className ?? ''}`}>
      <Link
        href={resolved}
        title="تقرير تحليلي"
        className="cursor-pointer font-medium text-[#0E78AA] underline decoration-[#0E78AA]/40 underline-offset-2 hover:text-[#0a5f86]"
      >
        {children}
      </Link>
      {showIcon ? (
        analysis && accountId ? (
          <button
            type="button"
            title="تفسير تحليلي للرصيد"
            aria-label="تفسير تحليلي للرصيد"
            className="no-print inline-flex shrink-0 rounded p-0.5 text-[#0E78AA] hover:bg-[#0E78AA]/10"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openAnalysis();
            }}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        ) : (
          <Link
            href={resolved}
            title="تفسير تحليلي للرصيد"
            aria-label="تفسير تحليلي للرصيد"
            className="no-print inline-flex shrink-0 rounded p-0.5 text-[#0E78AA] hover:bg-[#0E78AA]/10"
          >
            <Eye className="h-3.5 w-3.5" />
          </Link>
        )
      ) : null}
    </span>
  );
}
