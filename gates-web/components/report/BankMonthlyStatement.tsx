'use client';

import Link from 'next/link';
import { journalDocumentHref } from '@/lib/accounting/journal-source';
import { useApiQuery } from '@/lib/hooks/useApi';

type MovementRow = {
  date: string;
  amount: number;
  description: string;
  origin: string;
  number: string;
  journalEntryId?: string;
  sourceId?: string | null;
  sourceType?: string | null;
  sourceKind?: string | null;
  entryType?: string | null;
};

type MonthSheet = {
  bankName: string;
  monthLabel: string;
  opening: number;
  receiptsTotal: number;
  paymentsTotal: number;
  gross: number;
  closing: number;
  overdraft: number;
  receipts: MovementRow[];
  payments: MovementRow[];
};

function money(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

function SideCells({ row }: { row?: MovementRow }) {
  const cell = 'border border-[#e6eef3] px-2 py-1';
  if (!row) {
    return (
      <>
        <td className={cell} />
        <td className={cell} />
        <td className={cell} />
        <td className={cell} />
        <td className={cell} />
      </>
    );
  }
  const href =
    journalDocumentHref({
      sourceType: row.sourceType,
      sourceKind: row.sourceKind,
      sourceId: row.sourceId,
      entryType: row.entryType,
    }) || (row.journalEntryId ? `/accounting/operations/journal-entry?id=${encodeURIComponent(row.journalEntryId)}` : null);
  return (
    <>
      <td className={`${cell} text-center whitespace-nowrap`}>{row.date ? formatDate(row.date) : ''}</td>
      <td className={`${cell} text-center tabular-nums`}>{row.amount ? money(row.amount) : money(0)}</td>
      <td className={`${cell} text-right`}>{row.description}</td>
      <td className={`${cell} text-right`}>{row.origin}</td>
      <td className={`${cell} text-center whitespace-nowrap`}>
        {row.number && href ? (
          <Link href={href} className="font-semibold text-[#0A6E8A] hover:underline">
            {row.number}
          </Link>
        ) : (
          row.number
        )}
      </td>
    </>
  );
}

function Sheet({ sheet }: { sheet: MonthSheet }) {
  const length = Math.max(sheet.receipts.length, sheet.payments.length, 1);
  const rows = Array.from({ length }, (_, index) => ({
    receipt: sheet.receipts[index],
    payment: sheet.payments[index],
  }));
  const receiptTotal: MovementRow = {
    date: '',
    amount: sheet.receiptsTotal,
    description: 'إجمالي مقبوضات الشهر',
    origin: '',
    number: '',
  };
  const paymentTotal: MovementRow = {
    date: '',
    amount: sheet.paymentsTotal,
    description: 'إجمالي مدفوعات الشهر',
    origin: '',
    number: '',
  };

  const summary = [
    ['رصيد الشهر السابق', sheet.opening],
    ['مقبوضات الشهر', sheet.receiptsTotal],
    ['إجمالي', sheet.gross],
    ['مدفوعات الشهر', sheet.paymentsTotal],
    ['رصيد الشهر', sheet.closing],
  ] as const;

  return (
    <div className="overflow-x-auto rounded-lg border border-[#9ec3d8] bg-white">
      <table className="w-full min-w-[920px] border-collapse text-xs text-slate-800" dir="rtl">
        <thead>
          <tr className="bg-[#7eb6d9] text-white">
            <th colSpan={5} className="border border-[#6aa4c8] px-2 py-2 text-center text-sm font-bold">
              المقبوضات
            </th>
            <th colSpan={5} className="border border-[#6aa4c8] px-2 py-2 text-center text-sm font-bold">
              المدفوعات
            </th>
          </tr>
          <tr className="bg-[#d7ebf6] text-[#0A3D5E]">
            {['التاريخ', 'المبلغ', 'البيان', 'الأصل', 'رقمه', 'التاريخ', 'المبلغ', 'البيان', 'الأصل', 'رقمه'].map(
              (label, index) => (
                <th key={`${label}-${index}`} className="border border-[#b7d4e4] px-2 py-1 font-semibold">
                  {label}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={10} className="border border-[#d5e6f0] bg-[#f4fafc] px-2 py-2 text-center text-sm font-bold text-[#0A3D5E]">
              {sheet.bankName} {sheet.monthLabel}
            </td>
          </tr>
          {rows.map((row, index) => (
            <tr key={index} className="odd:bg-white even:bg-[#f8fbfd]">
              <SideCells row={row.receipt} />
              <SideCells row={row.payment} />
            </tr>
          ))}
          <tr className="bg-[#f4fafc] font-semibold">
            <SideCells row={receiptTotal} />
            <SideCells row={paymentTotal} />
          </tr>
          {summary.map(([label, amount]) => (
            <tr key={label}>
              <td className="border border-[#e6eef3]" />
              <td className="border border-[#e6eef3] px-2 py-1 text-center font-semibold tabular-nums">{money(amount)}</td>
              <td className="border border-[#e6eef3] px-2 py-1 text-right">{label}</td>
              <td className="border border-[#e6eef3]" />
              <td className="border border-[#e6eef3]" />
              <td className="border border-[#e6eef3]" colSpan={5} />
            </tr>
          ))}
          <tr>
            <td className="border border-[#e6eef3]" colSpan={5} />
            <td className="border border-[#e6eef3]" />
            <td className="border border-[#e6eef3] px-2 py-1 text-center font-semibold text-red-600 tabular-nums">
              {sheet.overdraft ? money(sheet.overdraft) : ''}
            </td>
            <td className="border border-[#e6eef3] px-2 py-1 text-right font-semibold text-red-600">رصيد البنك مكشوف</td>
            <td className="border border-[#e6eef3]" colSpan={2} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function BankMonthlyStatement({ query }: { query: Record<string, string> }) {
  const { data, isLoading, isError, error } = useApiQuery<MonthSheet[]>(
    ['bank-monthly-statement', JSON.stringify(query)],
    '/accounting/reports/bank-monthly-statement',
    query
  );
  const sheets = Array.isArray(data?.data) ? data.data : [];

  if (isLoading) {
    return <p className="py-6 text-center text-sm text-slate-500">جاري تجهيز الكشف الشهري…</p>;
  }
  if (isError) {
    return <p className="py-6 text-center text-sm text-red-600">{error?.message || 'تعذر تحميل الكشف الشهري'}</p>;
  }
  if (!sheets.length) {
    return <p className="py-6 text-center text-sm text-slate-500">لا توجد حسابات بنكية مطابقة للفلاتر.</p>;
  }

  return (
    <div className="space-y-6">
      {sheets.map((sheet) => (
        <Sheet key={`${sheet.bankName}-${sheet.monthLabel}`} sheet={sheet} />
      ))}
    </div>
  );
}
