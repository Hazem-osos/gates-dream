'use client';

import { Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { journalDocumentHref, journalSourceLabelFromRow } from '@/lib/accounting/journal-source';
import { journalEntryHref } from '@/lib/reportEngine/reportRowHref';

type Row = Record<string, unknown>;

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

function dayKey(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dayLabel(key: string): string {
  const date = new Date(`${key}T12:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function accountName(row: Row): string {
  return text(row, 'ledgerAccount') || text(row, 'mainAccount') || text(row, 'account');
}

function origin(row: Row): string {
  const label = journalSourceLabelFromRow(row);
  if (label === 'قيد يدوي') return 'سند قيد يومية';
  if (label === 'سند صرف') return 'سند صرف نقدية';
  if (label === 'سند قبض') return 'سند قبض نقدية';
  return label;
}

function LineCells({ row, onOpen }: { row: Row; onOpen: (href: string) => void }) {
  const href = journalEntryHref(row);
  const number = text(row, 'voucherNumber') || text(row, 'documentNumber');
  const sourceNumber = text(row, 'sourceNumber');
  const sourceHref = journalDocumentHref({
    sourceType: text(row, 'sourceType') || null,
    sourceKind: text(row, 'sourceKind') || null,
    sourceId: text(row, 'sourceId') || null,
    entryType: text(row, 'entryType') || null,
    voucherFund: text(row, 'voucherFund') || null,
  });
  return (
    <>
      <td className="border border-slate-300 px-2 py-1">{accountName(row)}</td>
      <td className="border border-slate-300 px-2 py-1">{text(row, 'costCenter')}</td>
      <td className="border border-slate-300 px-2 py-1 text-center text-red-700">{money(amount(row.debit))}</td>
      <td className="border border-slate-300 px-2 py-1 text-center text-red-700">{money(amount(row.credit))}</td>
      <td className="border border-slate-300 px-2 py-1">{text(row, 'description')}</td>
      <td className="border border-slate-300 px-2 py-1 text-center">
        {href && number ? (
          <button type="button" className="font-medium text-[#0E78AA] underline" onClick={() => onOpen(href)}>
            {number}
          </button>
        ) : (
          number
        )}
      </td>
      <td className="border border-slate-300 px-2 py-1 text-center">{origin(row)}</td>
      <td className="border border-slate-300 px-2 py-1 text-center">
        {sourceHref && sourceNumber ? (
          <button type="button" className="font-medium text-[#0E78AA] underline" onClick={() => onOpen(sourceHref)}>
            {sourceNumber}
          </button>
        ) : (
          sourceNumber
        )}
      </td>
    </>
  );
}

export function DailyJournalSheet({ rows, mode }: { rows: Row[]; mode: 'day' | 'entry' }) {
  const router = useRouter();
  const groups = new Map<string, { label: string; lines: Row[] }>();
  for (const row of rows) {
    const key = mode === 'day' ? dayKey(row.date) : text(row, 'journalEntryId') || text(row, 'voucherNumber') || dayKey(row.date);
    const label = dayLabel(dayKey(row.date));
    const group = groups.get(key) ?? { label, lines: [] };
    group.lines.push(row);
    groups.set(key, group);
  }

  const blocks = [...groups.values()];
  const grandDebit = rows.reduce((sum, row) => sum + amount(row.debit), 0);
  const grandCredit = rows.reduce((sum, row) => sum + amount(row.credit), 0);

  return (
    <div dir="rtl" className="report-scroll-viewport erp-scroll-x overflow-x-auto rounded-xl border border-slate-300 bg-white">
      <table className="w-full border-collapse text-sm" dir="rtl">
        <thead>
          <tr className="bg-[#1787B8] text-white">
            {['التاريخ', 'الحساب', 'مركز التكلفة', 'مدين', 'دائن', 'الشرح', 'الرقم', 'الأصل', 'رقمه'].map((label) => (
              <th key={label} className="whitespace-nowrap border border-white/30 px-2 py-2 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {blocks.map((block, blockIndex) => {
            const debit = block.lines.reduce((sum, row) => sum + amount(row.debit), 0);
            const credit = block.lines.reduce((sum, row) => sum + amount(row.credit), 0);
            return (
              <Fragment key={blockIndex}>
                {block.lines.map((row, index) => (
                  <tr key={`${blockIndex}-${index}`} className={index % 2 === 0 ? 'bg-sky-50/50' : 'bg-white'}>
                    {index === 0 ? (
                      <td
                        rowSpan={block.lines.length}
                        className="min-w-[7.5rem] whitespace-nowrap border border-slate-300 bg-emerald-50 px-2 py-1 text-center align-middle font-semibold tabular-nums"
                      >
                        {block.label}
                      </td>
                    ) : null}
                    <LineCells row={row} onOpen={(href) => router.push(href)} />
                  </tr>
                ))}
                <tr className="bg-emerald-100 font-semibold">
                  <td className="border border-slate-300" />
                  <td className="border border-slate-300 px-2 py-1" colSpan={2}>
                    {mode === 'day' ? 'مجموع اليوم' : 'مجموع القيد'}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-center text-red-700">{money(debit)}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center text-red-700">{money(credit)}</td>
                  <td className="border border-slate-300" colSpan={4} />
                </tr>
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold">
            <td className="border border-slate-300 px-2 py-2">دفتر اليومية</td>
            <td className="border border-slate-300 px-2 py-2" colSpan={2}>
              الإجمالي
            </td>
            <td className="border border-slate-300 px-2 py-2 text-center text-red-700">{money(grandDebit)}</td>
            <td className="border border-slate-300 px-2 py-2 text-center text-red-700">{money(grandCredit)}</td>
            <td className="border border-slate-300" colSpan={4} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
