'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { movementDocumentHref } from '@/lib/accounting/journal-source';

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value);
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function dateLabel(value: unknown): string {
  const raw = typeof value === 'string' ? value : value instanceof Date ? value.toISOString() : '';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function qty(value: unknown): string {
  return num(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

const STATUS_CLASS: Record<string, string> = {
  منتهي: 'bg-rose-100 text-rose-800',
  'خلال 30 يوم': 'bg-amber-100 text-amber-900',
  'خلال 90 يوم': 'bg-sky-100 text-sky-800',
  ساري: 'bg-emerald-100 text-emerald-800',
  صُرف: 'bg-slate-100 text-slate-600',
};

export function ExpiryDateSheet({
  rows,
  summary,
}: {
  rows: Row[];
  summary?: unknown;
}) {
  const totals = summary && typeof summary === 'object' ? (summary as Record<string, unknown>) : {};
  const cards = [
    ['التشغيلات', num(totals.lotCount).toLocaleString('ar-EG')],
    ['ما زال لها رصيد', num(totals.onHandLots).toLocaleString('ar-EG')],
    ['منتهية', num(totals.expiredLots).toLocaleString('ar-EG')],
    ['خلال 30 يوم', num(totals.soonLots).toLocaleString('ar-EG')],
    ['خلال 90 يوم', num(totals.quarterLots).toLocaleString('ar-EG')],
    ['صُرفت', num(totals.consumedLots).toLocaleString('ar-EG')],
  ] as const;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right">
            <div className="text-[11px] text-slate-500">{label}</div>
            <div className="text-sm font-bold tabular-nums text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      <div dir="rtl" className="report-scroll-viewport erp-scroll-x overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full border-collapse text-xs text-slate-800">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {['الحالة', 'الصنف', 'المخزن', 'التشغيلة', 'الصلاحية', 'الأيام', 'الرصيد', 'الوحدة', 'المصدر', 'الرقم', 'الجهة', 'المجموعة'].map((label) => (
                <th key={label} className="border-b border-slate-200 px-2 py-2 text-right font-semibold whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const status = text(row, 'status');
              const days = num(row.daysLeft);
              const sourceNumber = text(row, 'sourceNumber');
              const sourceHref = movementDocumentHref(text(row, 'sourceType'), text(row, 'sourceDocumentId'));
              const path = text(row, 'accountPath');
              const previous = index > 0 ? text(rows[index - 1], 'accountPath') : '';
              const showGroup = Boolean(path) && path !== previous;
              return (
                <Fragment key={`${text(row, 'groupKey')}-${index}`}>
                {showGroup ? (
                  <tr className="bg-sky-100">
                    <td colSpan={12} className="border-b border-slate-200 px-3 py-2 text-right text-xs font-semibold text-sky-950">
                      {path}
                    </td>
                  </tr>
                ) : null}
                <tr className="odd:bg-white even:bg-slate-50/60">
                  <td className="border-b border-slate-100 px-2 py-1.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[status] || 'bg-slate-100 text-slate-700'}`}>
                      {status}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-2 py-1.5 font-medium">{text(row, 'itemName')}</td>
                  <td className="border-b border-slate-100 px-2 py-1.5">{text(row, 'warehouseName')}</td>
                  <td className="border-b border-slate-100 px-2 py-1.5">{text(row, 'batchNumber')}</td>
                  <td className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap">{dateLabel(row.expiryDate)}</td>
                  <td className="border-b border-slate-100 px-2 py-1.5 text-center tabular-nums">{days.toLocaleString('en-US')}</td>
                  <td className="border-b border-slate-100 px-2 py-1.5 text-center font-semibold tabular-nums">{qty(row.quantity)}</td>
                  <td className="border-b border-slate-100 px-2 py-1.5">{text(row, 'unitName')}</td>
                  <td className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap">{text(row, 'sourceLabel')}</td>
                  <td className="border-b border-slate-100 px-2 py-1.5">
                    {sourceHref && sourceNumber ? (
                      <Link href={sourceHref} className="font-semibold text-[#0A6E8A] hover:underline">
                        {sourceNumber}
                      </Link>
                    ) : (
                      sourceNumber
                    )}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-1.5">{text(row, 'partyName')}</td>
                  <td className="border-b border-slate-100 px-2 py-1.5">{text(row, 'itemGroupName')}</td>
                </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
