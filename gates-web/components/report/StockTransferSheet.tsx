'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { groupStockTransferRows, roundMoney } from '@/lib/reports/stockTransferGroups';

type Row = Record<string, unknown>;

function text(row: Row, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value);
}

function money(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  return safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function qty(value: unknown): string {
  const amount = typeof value === 'number' ? value : Number(value);
  const safe = Number.isFinite(amount) ? amount : 0;
  return safe.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function dateLabel(value: unknown): string {
  const raw = typeof value === 'string' ? value : value instanceof Date ? value.toISOString() : '';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

const HEADERS = ['التاريخ', 'المسلسل', 'من مخزن', 'إلى مخزن', 'كود الصنف', 'الصنف', 'الكمية', 'السعر', 'القيمة'];

export function StockTransferSheet({ rows }: { rows: Row[] }) {
  const groups = groupStockTransferRows(rows);
  const grand = roundMoney(groups.reduce((sum, group) => sum + group.total, 0));

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full border-collapse text-xs text-slate-800">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {HEADERS.map((label) => (
              <th key={label} className="border-b border-slate-200 px-2 py-2 text-right font-semibold whitespace-nowrap">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group, groupIndex) => (
            <Fragment key={group.transferId}>
              {group.lines.map((row, lineIndex) => {
                const serial = group.serial || 'بدون مسلسل';
                const href = `/inventory/operations/transfer?id=${encodeURIComponent(group.transferId)}`;
                return (
                  <tr key={`${group.transferId}-${lineIndex}`} className="odd:bg-white even:bg-slate-50/70">
                    <td className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap">{dateLabel(row.date)}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap">
                      <Link
                        href={href}
                        className="font-semibold text-[#0E78AA] underline decoration-[#0E78AA]/40 underline-offset-2 hover:text-[#0a5f86]"
                      >
                        {serial}
                      </Link>
                    </td>
                    <td className="border-b border-slate-100 px-2 py-1.5">{text(row, 'fromWarehouse')}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5">{text(row, 'toWarehouse')}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5">{text(row, 'itemSerial')}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5 font-medium">{text(row, 'itemName')}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5 text-center tabular-nums">{qty(row.quantity)}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5 text-center tabular-nums">{money(row.unitPrice)}</td>
                    <td className="border-b border-slate-100 px-2 py-1.5 text-center font-medium tabular-nums">{money(row.total)}</td>
                  </tr>
                );
              })}
              <tr className="bg-sky-50 font-semibold text-slate-900">
                <td className="border-b border-sky-100 px-2 py-2" colSpan={8}>
                  إجمالي قيمة النقل{group.serial ? ` ${group.serial}` : ''}
                </td>
                <td className="border-b border-sky-100 px-2 py-2 text-center tabular-nums">{money(group.total)}</td>
              </tr>
              {groupIndex < groups.length - 1 ? (
                <tr aria-hidden>
                  <td className="h-4 border-0 bg-white p-0" colSpan={9} />
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold text-slate-900">
            <td className="px-2 py-2" colSpan={8}>
              الإجمالي
            </td>
            <td className="px-2 py-2 text-center tabular-nums">{money(grand)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
