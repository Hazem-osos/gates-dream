'use client';

import Link from 'next/link';
import { hrefForCashTransaction } from '@/lib/accounting/journal-source';

export type InvoiceAnalyticalCard = {
  id: string;
  kind: 'SALE' | 'PURCHASE' | 'SALE_RETURN' | 'PURCHASE_RETURN';
  kindLabel: string;
  invoiceNumber: string;
  date: string | null;
  terms: string;
  partyName: string;
  warehouseName: string;
  costCenterName: string;
  currencyCode: string;
  description: string;
  lines: Array<{
    itemId?: string;
    itemCode: string;
    itemName: string;
    unitName: string;
    quantity: number;
    price: number;
    discountPercent: number;
    discountAmount: number;
    taxPercent: number;
    taxAmount: number;
    total: number;
  }>;
  gross: number;
  discount: number;
  additions: number;
  tax: number;
  withholding: number;
  developmentFee: number;
  net: number;
  advances: PaymentRow[];
  paidAtIssue: PaymentRow[];
  paidAfter: PaymentRow[];
  installments: Array<{
    dueDate: string | null;
    amount: number;
    paidAmount: number;
    remaining: number;
    status: string;
  }>;
  advanceTotal: number;
  paidAtIssueTotal: number;
  paidAfterTotal: number;
  remaining: number;
};

type PaymentRow = {
  date: string | null;
  number: string;
  amount: number;
  note: string;
  transactionId?: string;
  transactionKind?: string;
  documentRole?: string;
  bankAccountId?: string | null;
  safeId?: string | null;
};

function paymentHref(row: PaymentRow): string | null {
  if (!row.transactionId || !row.number) return null;
  return hrefForCashTransaction({
    id: row.transactionId,
    documentRole: row.documentRole,
    transactionKind: row.transactionKind,
    safeId: row.safeId,
    bankAccountId: row.bankAccountId,
  });
}

function money(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function qty(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function dateLabel(value: string | null): string {
  if (!value) return '—';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function hrefFor(card: InvoiceAnalyticalCard): string {
  const id = encodeURIComponent(card.id);
  if (card.kind === 'PURCHASE_RETURN') return `/inventory/operations/purchase-returns?invoiceId=${id}`;
  if (card.kind === 'SALE_RETURN') return `/inventory/operations/sales-returns?invoiceId=${id}`;
  if (card.kind === 'PURCHASE') return `/inventory/operations/final-purchase-invoice?invoiceId=${id}`;
  return `/inventory/operations/sales-invoice?invoiceId=${id}`;
}

function Meta({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </span>
  );
}

function PaymentTable({ title, rows }: { title: string; rows: PaymentRow[] }) {
  return (
    <section className="min-w-0">
      <h4 className="mb-1 text-xs font-bold text-[#0E4C6E]">{title}</h4>
      {rows.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-2 py-2 text-xs text-slate-400">لا يوجد</p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              {['التاريخ', 'الرقم', 'المبلغ', 'البيان'].map((label) => (
                <th key={label} className="px-2 py-1 text-right font-semibold">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const href = paymentHref(row);
              return (
              <tr key={`${row.number}-${index}`} className="border-t border-slate-100">
                <td className="px-2 py-1">{dateLabel(row.date)}</td>
                <td className="px-2 py-1">
                  {href ? (
                    <Link href={href} className="font-semibold text-[#0A6E8A] hover:underline">
                      {row.number}
                    </Link>
                  ) : (
                    row.number || '—'
                  )}
                </td>
                <td className="px-2 py-1 tabular-nums">{money(row.amount)}</td>
                <td className="px-2 py-1">{row.note || '—'}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function TotalLine({ label, value }: { label: string; value: number }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-100 px-3 py-1.5 text-xs">
      <span className="text-slate-600">{label}</span>
      <span className="tabular-nums font-medium text-slate-900">{money(value)}</span>
    </div>
  );
}

export function InvoiceAnalyticalSheet({ cards }: { cards: InvoiceAnalyticalCard[] }) {
  if (!cards.length) {
    return <p className="py-10 text-center text-sm text-slate-500">لا توجد فواتير في هذه الفترة.</p>;
  }

  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <article key={card.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-[#0E4C6E] px-4 py-3 text-sm text-white">
            <Link href={hrefFor(card)} className="font-bold underline decoration-white/40 underline-offset-2">
              {card.kindLabel} {card.invoiceNumber}
            </Link>
            <span>{dateLabel(card.date)}</span>
            <span>{card.terms}</span>
            <span className="font-semibold">{card.partyName}</span>
            {card.warehouseName ? <span>{card.warehouseName}</span> : null}
            {card.costCenterName ? <span>{card.costCenterName}</span> : null}
            {card.currencyCode ? <span>{card.currencyCode}</span> : null}
          </header>
          {card.description ? (
            <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-600">{card.description}</p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-xs text-slate-800">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {['كود الصنف', 'الصنف', 'الوحدة', 'الكمية', 'السعر', 'خصم %', 'قيمة الخصم', 'ضريبة %', 'قيمة الضريبة', 'الإجمالي'].map((label) => (
                    <th key={label} className="whitespace-nowrap px-2 py-2 text-right font-semibold">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {card.lines.map((line, index) => (
                  <tr key={`${line.itemCode}-${index}`} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">
                      {line.itemId ? (
                        <Link
                          href={`/inventory/creations/item-card?id=${encodeURIComponent(line.itemId)}`}
                          className="font-semibold text-[#0A6E8A] hover:underline"
                        >
                          {line.itemCode || '—'}
                        </Link>
                      ) : (
                        line.itemCode || '—'
                      )}
                    </td>
                    <td className="px-2 py-1.5 font-medium">{line.itemName}</td>
                    <td className="px-2 py-1.5">{line.unitName}</td>
                    <td className="px-2 py-1.5 tabular-nums">{qty(line.quantity)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{money(line.price)}</td>
                    <td className="px-2 py-1.5 tabular-nums">{line.discountPercent ? `${qty(line.discountPercent)}%` : '—'}</td>
                    <td className="px-2 py-1.5 tabular-nums">{line.discountAmount ? money(line.discountAmount) : '—'}</td>
                    <td className="px-2 py-1.5 tabular-nums">{line.taxPercent ? `${qty(line.taxPercent)}%` : '—'}</td>
                    <td className="px-2 py-1.5 tabular-nums">{line.taxAmount ? money(line.taxAmount) : '—'}</td>
                    <td className="px-2 py-1.5 tabular-nums font-medium">{money(line.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 border-t border-slate-100 p-3 lg:grid-cols-[16rem_1fr]">
            <div className="rounded-xl border border-slate-100">
              <TotalLine label="إجمالي الفاتورة" value={card.gross} />
              <TotalLine label="الخصم" value={card.discount} />
              <TotalLine label="الإضافات" value={card.additions} />
              <TotalLine label="ضريبة المبيعات" value={card.tax} />
              <TotalLine label="ضريبة خصم المنبع" value={card.withholding} />
              <TotalLine label="رسم التنمية" value={card.developmentFee} />
              <div className="flex items-center justify-between gap-4 bg-slate-50 px-3 py-2 text-xs font-bold text-[#0E4C6E]">
                <span>صافي الفاتورة</span>
                <span className="tabular-nums">{money(card.net)}</span>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <PaymentTable title="دفعات مقدمة" rows={card.advances} />
              <PaymentTable title="المسدد عند تحرير الفاتورة" rows={card.paidAtIssue} />
              <PaymentTable title="المسدد بعد التحرير" rows={card.paidAfter} />
            </div>
          </div>

          {card.installments.length ? (
            <div className="border-t border-slate-100 px-3 py-3">
              <h4 className="mb-1 text-xs font-bold text-[#0E4C6E]">دفعات لاحقة</h4>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
                    {['تاريخ الاستحقاق', 'المبلغ', 'المسدد', 'المتبقي', 'الحالة'].map((label) => (
                      <th key={label} className="px-2 py-1 text-right font-semibold">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {card.installments.map((row, index) => (
                    <tr key={index} className="border-t border-slate-100">
                      <td className="px-2 py-1">{dateLabel(row.dueDate)}</td>
                      <td className="px-2 py-1 tabular-nums">{money(row.amount)}</td>
                      <td className="px-2 py-1 tabular-nums">{money(row.paidAmount)}</td>
                      <td className="px-2 py-1 tabular-nums">{money(row.remaining)}</td>
                      <td className="px-2 py-1">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <footer className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs sm:grid-cols-5">
            <Meta label="صافي الفاتورة" value={money(card.net)} />
            <Meta label="مقدم" value={money(card.advanceTotal)} />
            <Meta label="عند التحرير" value={money(card.paidAtIssueTotal)} />
            <Meta label="بعد التحرير" value={money(card.paidAfterTotal)} />
            <Meta label="المتبقي" value={money(card.remaining)} />
          </footer>
        </article>
      ))}
    </div>
  );
}
