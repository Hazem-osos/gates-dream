'use client';

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
  const raw = typeof value === 'string' ? value : '';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function qty(value: number): string {
  if (!value) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function money(value: number): string {
  if (!value) return '—';
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type QtyTotals = { ordered: number; issued: number; remaining: number; disbursed: number };

const STATUS_CLASS: Record<string, string> = {
  مفتوح: 'bg-slate-100 text-slate-700',
  جزئي: 'bg-amber-100 text-amber-900',
  مكتمل: 'bg-emerald-100 text-emerald-800',
  ملغي: 'bg-rose-100 text-rose-800',
};

export function AnalyticalInvoiceSheet({ rows, summary }: { rows: Row[]; summary?: unknown }) {
  const fromSummary = summary && typeof summary === 'object' ? (summary as Record<string, unknown>) : null;
  const computed = rows.reduce<QtyTotals>(
    (sum, row) => {
      if (text(row, 'status') === 'ملغي') return sum;
      const issued = text(row, 'sourceType') === 'DELIVERY_NOTE';
      return {
        ordered: sum.ordered + (issued ? 0 : num(row.orderedQty)),
        issued: sum.issued + (issued ? 0 : num(row.issuedQty)),
        remaining: sum.remaining + (issued ? 0 : num(row.remainingQty)),
        disbursed: sum.disbursed + (issued ? num(row.issuedQty) : 0),
      };
    },
    { ordered: 0, issued: 0, remaining: 0, disbursed: 0 }
  );
  const totals = fromSummary
    ? {
        ordered: num(fromSummary.orderedQty),
        issued: num(fromSummary.issuedQty),
        remaining: num(fromSummary.remainingQty),
        disbursed: num(fromSummary.issueQty),
      }
    : computed;

  const hiddenCount = fromSummary ? Math.max(num(fromSummary.lineCount) - rows.length, 0) : 0;

  return (
    <div className="space-y-2">
      {hiddenCount > 0 ? (
        <p className="text-xs text-slate-500">يُعرض {rows.length.toLocaleString('ar-EG')} بندًا من {num(fromSummary?.lineCount).toLocaleString('ar-EG')}.</p>
      ) : null}
    <div dir="rtl" className="report-scroll-viewport erp-scroll-x overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full border-collapse text-xs text-slate-800">
        <thead className="bg-[#0E4C6E] text-white">
          <tr>
            {['القسم', 'المستند', 'التاريخ', 'الجهة', 'الصنف', 'الوحدة', 'الكمية', 'السعر', 'الإجمالي', 'المصروف', 'المتبقي', 'الفاتورة', 'الحالة'].map((label) => (
              <th key={label} className="border-b border-[#0E4C6E] px-2 py-2 text-right font-semibold whitespace-nowrap">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const status = text(row, 'status');
            const sourcePath = text(row, 'sourcePreviewPath');
            const invoicePath = text(row, 'invoicePreviewPath');
            const sourceNumber = text(row, 'sourceNumber');
            const invoiceNumber = text(row, 'invoiceNumber');
            return (
              <tr key={`${text(row, 'id')}-${index}`} className="odd:bg-white even:bg-slate-50/70">
                <td className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap">{text(row, 'sourceTypeLabel')}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap">
                  {sourcePath ? (
                    <a className="font-semibold text-[#0A6E8A] hover:underline" href={sourcePath}>
                      {sourceNumber || '—'}
                    </a>
                  ) : (
                    sourceNumber || '—'
                  )}
                </td>
                <td className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap">{dateLabel(row.sourceDate) || '—'}</td>
                <td className="border-b border-slate-100 px-2 py-1.5">{text(row, 'partyName') || '—'}</td>
                <td className="border-b border-slate-100 px-2 py-1.5">{text(row, 'itemName') || '—'}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap">{text(row, 'unitName') || '—'}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-left tabular-nums">{qty(num(row.orderedQty))}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-left tabular-nums">{money(num(row.unitPrice))}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-left tabular-nums">{money(num(row.orderedTotal))}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-left font-semibold tabular-nums text-[#0A3D5E]">{qty(num(row.issuedQty))}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 text-left tabular-nums">{qty(num(row.remainingQty))}</td>
                <td className="border-b border-slate-100 px-2 py-1.5 whitespace-nowrap">
                  {invoicePath && invoiceNumber && invoiceNumber !== '—' ? (
                    <a className="font-semibold text-[#0A6E8A] hover:underline" href={invoicePath}>
                      {invoiceNumber}
                    </a>
                  ) : (
                    invoiceNumber || '—'
                  )}
                </td>
                <td className="border-b border-slate-100 px-2 py-1.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[status] || 'bg-slate-100 text-slate-700'}`}>
                    {status || '—'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-semibold">
            <td className="px-2 py-2" colSpan={6}>
              المجموع
            </td>
            <td className="px-2 py-2 text-left tabular-nums">{qty(totals.ordered)}</td>
            <td />
            <td />
            <td className="px-2 py-2 text-left tabular-nums">{qty(totals.issued)}</td>
            <td className="px-2 py-2 text-left tabular-nums">{qty(totals.remaining)}</td>
            <td className="px-2 py-2 text-[11px] font-normal text-slate-500" colSpan={2}>
              {totals.disbursed ? `إذن صرف مخزني ${qty(totals.disbursed)}` : ''}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
    </div>
  );
}
