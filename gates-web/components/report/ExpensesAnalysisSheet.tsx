'use client';

import { useRouter } from 'next/navigation';
import { journalDocumentHref, journalSourceLabelFromRow } from '@/lib/accounting/journal-source';
import { journalEntryHref } from '@/lib/reportEngine/reportRowHref';
import { isReportColumnVisible } from '@/lib/reportEngine/reportColumnVisible';

type Row = Record<string, unknown>;
type Mode = 'date' | 'totals';

function text(row: Row, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value);
}

function amount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
}

function money(value: number): string {
  if (!value) return '';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dayLabel(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function originLabel(row: Row): string {
  const label = journalSourceLabelFromRow(row);
  if (label === 'قيد يدوي') return 'سند قيد يومية';
  if (label === 'سند صرف') return 'سند صرف نقدية';
  if (label === 'سند قبض') return 'سند قبض نقدية';
  return label;
}

function groupTotals(rows: Row[]): Row[] {
  const groups = new Map<string, Row>();
  for (const row of rows) {
    const key = `${text(row, 'account')}|${text(row, 'supportStatus')}`;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        account: text(row, 'account'),
        supportStatus: text(row, 'supportStatus'),
        debit: amount(row.debit),
        credit: amount(row.credit),
      });
      continue;
    }
    current.debit = amount(current.debit) + amount(row.debit);
    current.credit = amount(current.credit) + amount(row.credit);
  }
  return [...groups.values()].sort((a, b) => text(a, 'account').localeCompare(text(b, 'account'), 'ar'));
}

const COLS: Array<{ id: string; label: string }> = [
  { id: 'entryDate', label: 'التاريخ' },
  { id: 'account', label: 'الحساب' },
  { id: 'debit', label: 'مدين' },
  { id: 'credit', label: 'دائن' },
  { id: 'balance', label: 'الرصيد' },
  { id: 'description', label: 'الشرح' },
  { id: 'documentNumber', label: 'الرقم' },
  { id: 'sourceType', label: 'الأصل' },
  { id: 'sourceNumber', label: 'رقمه' },
  { id: 'costCenterName', label: 'مركز التكلفة' },
  { id: 'supportStatus', label: 'مؤيد' },
];

export function ExpensesAnalysisSheet({
  rows,
  mode,
  visibleColumnIds,
}: {
  rows: Row[];
  mode: Mode;
  visibleColumnIds?: string[];
}) {
  const router = useRouter();
  const on = (id: string) => isReportColumnVisible(visibleColumnIds, id);
  const shown = COLS.filter((col) => on(col.id));
  const tailSpan = Math.max(1, shown.filter((col) => !['entryDate', 'account', 'debit', 'credit', 'balance'].includes(col.id)).length);
  const visible = mode === 'totals' ? groupTotals(rows) : rows;
  const supported = rows.filter((row) => text(row, 'supportStatus') === 'مؤيد');
  const unsupported = rows.filter((row) => text(row, 'supportStatus') !== 'مؤيد');
  const sum = (list: Row[], key: 'debit' | 'credit') => list.reduce((total, row) => total + amount(row[key]), 0);
  const supportedDebit = sum(supported, 'debit');
  const supportedCredit = sum(supported, 'credit');
  const unsupportedDebit = sum(unsupported, 'debit');
  const base = supportedDebit + unsupportedDebit;
  const percent = base ? (unsupportedDebit / base) * 100 : 0;
  const supportedNet = supportedDebit - supportedCredit;
  const supportedLevy = supportedNet * 0.07;

  return (
    <div dir="rtl" className="report-scroll-viewport erp-scroll-x overflow-x-auto rounded-xl border border-slate-300 bg-white">
      <table className="w-full border-collapse text-sm" dir="rtl">
        <thead>
          <tr className="bg-[#1787B8] text-white">
            {shown.map((col) => (
              <th key={col.id} className="whitespace-nowrap border border-white/30 px-2 py-2 font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => {
            const href = mode === 'date' ? journalEntryHref(row) : null;
            const number = text(row, 'documentNumber');
            const sourceNumber = text(row, 'sourceNumber');
            const sourceHref =
              mode === 'date'
                ? journalDocumentHref({
                    sourceType: text(row, 'sourceType') || null,
                    sourceKind: text(row, 'sourceKind') || null,
                    sourceId: text(row, 'sourceId') || null,
                    entryType: text(row, 'entryType') || null,
                    voucherFund: text(row, 'voucherFund') || null,
                  })
                : null;
            return (
              <tr key={index} className={index % 2 === 0 ? 'bg-sky-50/60' : 'bg-white'}>
                {on('entryDate') ? <td className="border border-slate-200 px-2 py-1 text-center">{mode === 'date' ? dayLabel(row.entryDate) : ''}</td> : null}
                {on('account') ? <td className="border border-slate-200 px-2 py-1">{text(row, 'account')}</td> : null}
                {on('debit') ? <td className="border border-slate-200 px-2 py-1 text-center">{money(amount(row.debit))}</td> : null}
                {on('credit') ? <td className="border border-slate-200 px-2 py-1 text-center">{money(amount(row.credit))}</td> : null}
                {on('balance') ? <td className="border border-slate-200 px-2 py-1 text-center">{money(amount(row.debit) - amount(row.credit))}</td> : null}
                {on('description') ? <td className="border border-slate-200 px-2 py-1">{mode === 'date' ? text(row, 'description') : ''}</td> : null}
                {on('documentNumber') ? (
                  <td className="border border-slate-200 px-2 py-1 text-center">
                    {href && number ? (
                      <button type="button" className="font-medium text-[#0E78AA] underline" onClick={() => router.push(href)}>
                        {number}
                      </button>
                    ) : (
                      number
                    )}
                  </td>
                ) : null}
                {on('sourceType') ? <td className="border border-slate-200 px-2 py-1 text-center">{mode === 'date' ? originLabel(row) : ''}</td> : null}
                {on('sourceNumber') ? (
                  <td className="border border-slate-200 px-2 py-1 text-center">
                    {sourceHref && sourceNumber ? (
                      <button type="button" className="font-medium text-[#0E78AA] underline" onClick={() => router.push(sourceHref)}>
                        {sourceNumber}
                      </button>
                    ) : (
                      sourceNumber
                    )}
                  </td>
                ) : null}
                {on('costCenterName') ? <td className="border border-slate-200 px-2 py-1">{mode === 'date' ? text(row, 'costCenterName') : ''}</td> : null}
                {on('supportStatus') ? <td className="border border-slate-200 px-2 py-1 text-center">{text(row, 'supportStatus')}</td> : null}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-semibold">
            <td className="border border-slate-300 px-2 py-1" colSpan={Math.max(1, shown.filter((col) => col.id === 'entryDate' || col.id === 'account').length)}>مجموع المؤيد</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{money(supportedDebit)}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{money(supportedCredit)}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{money(supportedNet)}</td>
            <td className="border border-slate-300" colSpan={tailSpan} />
          </tr>
          <tr className="bg-slate-50 font-semibold">
            <td className="border border-slate-300 px-2 py-1" colSpan={2}>مجموع غير المؤيد</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{money(unsupportedDebit)}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">{money(sum(unsupported, 'credit'))}</td>
            <td className="border border-slate-300 px-2 py-1 text-center">
              {money(unsupportedDebit - sum(unsupported, 'credit'))}
            </td>
            <td className="border border-slate-300" colSpan={tailSpan} />
          </tr>
          <tr className="bg-slate-50 font-semibold">
            <td className="border border-slate-300 px-2 py-1" colSpan={2}>نسبة غير المؤيد</td>
            <td className="border border-slate-300 px-2 py-1 text-center" colSpan={2}>
              {percent.toLocaleString('en-US', { maximumFractionDigits: 2 })}%
            </td>
            <td className="border border-slate-300" />
            <td className="border border-slate-300" colSpan={tailSpan} />
          </tr>
          <tr className="bg-slate-50 font-semibold">
            <td className="border border-slate-300 px-2 py-1" colSpan={2}>٧٪ من إجمالي المؤيد</td>
            <td className="border border-slate-300 px-2 py-1 text-center" colSpan={2}>
              {supportedLevy.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td className="border border-slate-300" />
            <td className="border border-slate-300" colSpan={tailSpan} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
