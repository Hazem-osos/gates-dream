'use client';

import Link from 'next/link';
import { ArrowUpLeft } from 'lucide-react';
import {
  journalSourceHref,
  resolveJournalSourceKind,
  type JournalSourceType,
} from '@/lib/accounting/journal-source';

const SOURCE_CONFIG: Record<
  JournalSourceType,
  { label: string; color: string }
> = {
  MANUAL: {
    label: 'قيد يدوي',
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  RECURRING_TEMPLATE: {
    label: 'قيد دوري',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
  SALES_INVOICE: {
    label: 'فاتورة مبيعات',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  SALES_RETURN: {
    label: 'مردود مبيعات',
    color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  },
  PURCHASE_INVOICE: {
    label: 'فاتورة مشتريات',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  PURCHASE_RETURN: {
    label: 'مردود مشتريات',
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
  PAYMENT_VOUCHER: {
    label: 'سند صرف',
    color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
  RECEIPT_VOUCHER: {
    label: 'سند قبض',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  STOCK_TRANSACTION: {
    label: 'حركة مخزنية',
    color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  },
  DEPRECIATION: {
    label: 'إهلاك أصول',
    color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  },
  CHEQUE_ENDORSEMENT: {
    label: 'تظهير شيك',
    color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  },
  CLOSING_ENTRY: {
    label: 'قيد إقفال',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
};

type Props = {
  sourceType?: string | null;
  sourceKind?: string | null;
  sourceId?: string | null;
  sourceNumber?: string | null;
};

export function JournalSourceBadge({ sourceType, sourceKind, sourceId, sourceNumber }: Props) {
  const kind = resolveJournalSourceKind(sourceType, sourceKind);
  const config = SOURCE_CONFIG[kind] || SOURCE_CONFIG.MANUAL;
  const href = journalSourceHref(kind, sourceId);

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${config.color}`}>
        {config.label}
      </span>
      {sourceNumber && href ? (
        <Link
          href={href}
          title="فتح المستند الأصلي"
          className="inline-flex items-center gap-0.5 font-mono text-xs text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <span>{sourceNumber}</span>
          <ArrowUpLeft className="h-3 w-3" aria-hidden />
        </Link>
      ) : sourceNumber ? (
        <span className="font-mono text-xs text-slate-500">{sourceNumber}</span>
      ) : null}
    </div>
  );
}
