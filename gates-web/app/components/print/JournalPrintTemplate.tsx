'use client';

import type { CompanyPrintProfile, JournalPrintModel } from '@/lib/print/types';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import './print-styles.css';

export function JournalPrintTemplate({
  company,
  journal,
}: {
  company?: CompanyPrintProfile;
  journal: JournalPrintModel;
}) {
  return (
    <div className="print-page print-a4" dir="rtl">
      <header className="mb-4 border-b border-gray-300 pb-3">
        <h1 className="print-title">{company?.nameAr ?? '—'}</h1>
        <p className="text-lg font-bold mt-2">قيد يومية</p>
      </header>
      <section className="mb-3 text-sm grid grid-cols-2 gap-2">
        <p>
          <strong>رقم السند:</strong> {journal.voucherNumber ?? '—'}
        </p>
        <p>
          <strong>التاريخ:</strong> {journal.date}
        </p>
        {journal.description ? (
          <p className="col-span-2">
            <strong>الشرح:</strong> {journal.description}
          </p>
        ) : null}
      </section>
      <table className="print-table">
        <thead>
          <tr>
            <th>الحساب</th>
            <th>البيان</th>
            <th>مدين</th>
            <th>دائن</th>
          </tr>
        </thead>
        <tbody>
          {journal.lines.map((l, i) => (
            <tr key={i}>
              <td>{l.accountLabel}</td>
              <td>{l.description ?? '—'}</td>
              <td>{l.debit ? formatInvoiceMoney(l.debit) : '—'}</td>
              <td>{l.credit ? formatInvoiceMoney(l.credit) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-sm font-bold">
        إجمالي مدين: {formatInvoiceMoney(journal.debitTotal)} — إجمالي دائن:{' '}
        {formatInvoiceMoney(journal.creditTotal)}
      </p>
      <div className="print-signatures mt-8">
        <div>
          <div className="print-signature-box">إعداد</div>
        </div>
        <div>
          <div className="print-signature-box">مراجعة</div>
        </div>
        <div>
          <div className="print-signature-box">اعتماد</div>
        </div>
        <div>
          <div className="print-signature-box">مدير مالي</div>
        </div>
      </div>
    </div>
  );
}
