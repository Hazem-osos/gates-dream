'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';

type JournalLine = {
  lineOrder?: number;
  debit?: number | string;
  credit?: number | string;
  description?: string | null;
  descriptionAr?: string | null;
  exchangeRate?: number | string;
  account?: { code?: string; arabicName?: string };
  costCenter?: { code?: string; arabicName?: string } | null;
};

type JournalEntryPayload = {
  currencyCode?: string;
  lines?: JournalLine[];
};

function fmtAmount(v: number | string | undefined): string {
  const n = Number(v ?? 0);
  if (!n) return '—';
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

type Props = {
  journalEntryId: string | null | undefined;
  title?: string;
};

export function InvoiceJournalEntryLinesTable({ journalEntryId, title = 'القيد' }: Props) {
  const { data: response, isLoading } = useApiQuery<JournalEntryPayload>(
    ['journal-entry', journalEntryId],
    `/accounting/journal-entries/${journalEntryId}`,
    {},
    { enabled: !!journalEntryId }
  );

  const lines = response?.data?.lines ?? [];
  const currency = response?.data?.currencyCode ?? '—';

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#D6EAF3] bg-white">
      {title ? (
        <div className="text-[#0E78AA] font-bold text-sm px-4 py-3 border-b border-[#D6EAF3] bg-white">
          {title}
        </div>
      ) : null}
      <table className="min-w-full text-center border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="py-3 px-2 font-bold">م</th>
            <th className="py-3 px-2 font-bold">الحساب</th>
            <th className="py-3 px-2 font-bold">الشرح</th>
            <th className="py-3 px-2 font-bold">الخصم</th>
            <th className="py-3 px-2 font-bold">الإضافة</th>
            <th className="py-3 px-2 font-bold">مركز التكلفة</th>
            <th className="py-3 px-2 font-bold">العملة</th>
            <th className="py-3 px-2 font-bold">سعر الصرف</th>
          </tr>
        </thead>
        <tbody>
          {!journalEntryId ? (
            <tr>
              <td colSpan={8} className="py-6">
                <EmptyState title="لا يوجد قيد محاسبي — يظهر بعد ترحيل الفاتورة." />
              </td>
            </tr>
          ) : isLoading ? (
            <tr>
              <td colSpan={8} className="py-4">
                <TableSkeleton columns={8} rows={3} />
              </td>
            </tr>
          ) : lines.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-6">
                <EmptyState title="القيد لا يحتوي على بنود." />
              </td>
            </tr>
          ) : (
            lines.map((line, i) => {
              const accountLabel = line.account
                ? `${line.account.code ?? ''} ${line.account.arabicName ?? ''}`.trim()
                : '—';
              const cc = line.costCenter
                ? `${line.costCenter.code ?? ''} ${line.costCenter.arabicName ?? ''}`.trim()
                : '—';
              const desc = line.descriptionAr || line.description || '—';
              return (
                <tr key={line.lineOrder ?? i} className={i % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                  <td className="py-3 px-2 border-x border-[#D6EAF3]">{line.lineOrder ?? i + 1}</td>
                  <td className="py-3 px-2 border-x border-[#D6EAF3]">{accountLabel}</td>
                  <td className="py-3 px-2 border-x border-[#D6EAF3]">{desc}</td>
                  <td className="py-3 px-2 border-x border-[#D6EAF3]">{fmtAmount(line.debit)}</td>
                  <td className="py-3 px-2 border-x border-[#D6EAF3]">{fmtAmount(line.credit)}</td>
                  <td className="py-3 px-2 border-x border-[#D6EAF3]">{cc}</td>
                  <td className="py-3 px-2 border-x border-[#D6EAF3]">{currency}</td>
                  <td className="py-3 px-2 border-x border-[#D6EAF3]">
                    {fmtAmount(line.exchangeRate)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
