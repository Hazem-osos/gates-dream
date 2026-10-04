'use client';

import { useRouter } from 'next/navigation';
import { formatReportMoney } from '@/lib/reportEngine/reportFormatters';
import { journalEntryHref } from '@/lib/reportEngine/reportRowHref';

type Row = Record<string, unknown>;

type Sheet = {
  safe: string;
  day: string;
  prior: number;
  receipts: Row[];
  payments: Row[];
};

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

function money(value: number): string {
  return formatReportMoney(value, '');
}

function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const named = value as { arabicName?: unknown; name?: unknown; code?: unknown };
    if (typeof named.arabicName === 'string' && named.arabicName.trim()) return named.arabicName;
    if (typeof named.name === 'string' && named.name.trim()) return named.name;
    if (typeof named.code === 'string' && named.code.trim()) return named.code;
  }
  return value == null ? '' : String(value);
}

function isOutflow(row: Row): boolean {
  if (row.side === 'out') return true;
  return text(row, 'type') === 'صرف';
}

function amount(row: Row): number {
  const value = row.amount;
  return typeof value === 'number' ? value : Number(value) || 0;
}

export function DailyTreasuryBook({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const sheets = new Map<string, Sheet>();

  const openingOnly = new Map<string, { prior: number; day: string }>();
  for (const row of rows) {
    const safe = text(row, 'safe') || 'الخزينة';
    if (row.rowKind === 'opening') {
      const prior = typeof row.amount === 'number' ? row.amount : Number(row.amount) || 0;
      openingOnly.set(safe, { prior, day: dayKey(row.date) });
      continue;
    }
    const day = dayKey(row.date);
    if (!day) continue;
    const key = `${safe}|${day}`;
    const sheet = sheets.get(key) ?? {
      safe,
      day,
      prior: typeof row.priorBalance === 'number' ? row.priorBalance : Number(row.priorBalance) || 0,
      receipts: [],
      payments: [],
    };
    if (isOutflow(row)) sheet.payments.push(row);
    else sheet.receipts.push(row);
    sheets.set(key, sheet);
  }

  for (const [safe, opening] of openingOnly) {
    const hasDay = [...sheets.values()].some((sheet) => sheet.safe === safe);
    if (hasDay || !opening.day) continue;
    sheets.set(`${safe}|${opening.day}`, {
      safe,
      day: opening.day,
      prior: opening.prior,
      receipts: [],
      payments: [],
    });
  }

  const bySafe = new Map<string, Sheet[]>();
  for (const sheet of sheets.values()) {
    const list = bySafe.get(sheet.safe) ?? [];
    list.push(sheet);
    bySafe.set(sheet.safe, list);
  }

  const blocks = [...bySafe.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ar'))
    .flatMap(([, list]) => {
      const ordered = list.sort((a, b) => a.day.localeCompare(b.day));
      let running = ordered[0]?.prior ?? 0;
      return ordered.map((sheet) => {
        const receiptTotal = sheet.receipts.reduce((sum, row) => sum + amount(row), 0);
        const paymentTotal = sheet.payments.reduce((sum, row) => sum + amount(row), 0);
        const previous = running;
        const gross = previous + receiptTotal;
        const closing = gross - paymentTotal;
        running = closing;
        return { ...sheet, previous, receiptTotal, paymentTotal, gross, closing };
      });
    });

  if (!blocks.length) {
    return <p className="py-6 text-center text-slate-600">لا توجد حركة خزينة في الفترة.</p>;
  }

  return (
    <div className="space-y-6">
      {blocks.map((sheet) => {
        const lines = Math.max(sheet.receipts.length, sheet.payments.length, 1);
        return (
          <section key={`${sheet.safe}-${sheet.day}`} className="overflow-x-auto rounded-xl border border-slate-300 bg-white">
            <div className="bg-[#1787B8] px-3 py-2 text-center text-sm font-semibold text-white">
              {sheet.safe} — {dayLabel(sheet.day)}
            </div>
            <table className="w-full border-collapse text-sm" dir="rtl">
              <thead>
                <tr className="bg-[#d7eef8] text-[#0b4f73]">
                  <th colSpan={3} className="border border-slate-300 px-2 py-1">المقبوضات</th>
                  <th colSpan={3} className="border border-slate-300 px-2 py-1">المدفوعات</th>
                </tr>
                <tr className="bg-[#eef7fb] text-xs text-slate-700">
                  <th className="border border-slate-300 px-2 py-1">المبلغ</th>
                  <th className="border border-slate-300 px-2 py-1">البيان</th>
                  <th className="border border-slate-300 px-2 py-1">رقم الإيصال</th>
                  <th className="border border-slate-300 px-2 py-1">المبلغ</th>
                  <th className="border border-slate-300 px-2 py-1">البيان</th>
                  <th className="border border-slate-300 px-2 py-1">رقم الإيصال</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: lines }, (_, index) => {
                  const receipt = sheet.receipts[index];
                  const payment = sheet.payments[index];
                  return (
                    <tr key={index}>
                      <MovementCells row={receipt} onOpen={(href) => router.push(href)} />
                      <MovementCells row={payment} onOpen={(href) => router.push(href)} />
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 font-semibold">
                  <td className="border border-slate-300 px-2 py-1 text-center">{money(sheet.receiptTotal)}</td>
                  <td className="border border-slate-300 px-2 py-1" colSpan={2}>إجمالي مقبوضات اليوم</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{money(sheet.paymentTotal)}</td>
                  <td className="border border-slate-300 px-2 py-1" colSpan={2}>إجمالي مدفوعات اليوم</td>
                </tr>
              </tbody>
            </table>
            <dl className="grid max-w-md gap-1 px-4 py-3 text-sm">
              <SummaryLine label="رصيد اليوم السابق" value={sheet.previous} />
              <SummaryLine label="(+) مقبوضات اليوم" value={sheet.receiptTotal} />
              <SummaryLine label="إجمالي" value={sheet.gross} />
              <SummaryLine label="(-) مدفوعات اليوم" value={sheet.paymentTotal} />
              <SummaryLine label="رصيد نهاية اليوم" value={sheet.closing} strong />
            </dl>
          </section>
        );
      })}
    </div>
  );
}

function MovementCells({ row, onOpen }: { row?: Row; onOpen: (href: string) => void }) {
  if (!row) {
    return (
      <>
        <td className="border border-slate-200 px-2 py-1" />
        <td className="border border-slate-200 px-2 py-1" />
        <td className="border border-slate-200 px-2 py-1" />
      </>
    );
  }
  const href = journalEntryHref(row);
  const number = text(row, 'voucherNumber') || '—';
  return (
    <>
      <td className="border border-slate-200 px-2 py-1 text-center">{money(amount(row))}</td>
      <td className="border border-slate-200 px-2 py-1">{text(row, 'description')}</td>
      <td className="border border-slate-200 px-2 py-1 text-center">
        {href && number !== '—' ? (
          <button type="button" className="font-medium text-[#0E78AA] underline" onClick={() => onOpen(href)}>
            {number}
          </button>
        ) : (
          number
        )}
      </td>
    </>
  );
}

function SummaryLine({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${strong ? 'border-t border-slate-300 pt-1 font-semibold' : ''}`}>
      <dt>{label}</dt>
      <dd>{money(value)}</dd>
    </div>
  );
}
