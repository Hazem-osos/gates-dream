'use client';

import type { CompanyPrintProfile, VoucherPrintModel } from '@/lib/print/types';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import './print-styles.css';

export function VoucherPrintTemplate({
  company,
  voucher,
}: {
  company?: CompanyPrintProfile;
  voucher: VoucherPrintModel;
}) {
  const title = voucher.kind === 'RECEIPT' ? 'سند قبض نقدية' : 'سند صرف نقدية';

  return (
    <div className="print-page print-a4" dir="rtl">
      <header className="mb-4 border-b border-gray-300 pb-3 text-right">
        <h1 className="print-title">{company?.nameAr ?? '—'}</h1>
        <p className="text-lg font-bold text-[#0e78aa] mt-2">{title}</p>
        <p className="print-muted">
          {company?.taxRegistrationNumber ? `الرقم الضريبي: ${company.taxRegistrationNumber}` : null}
        </p>
      </header>

      <section className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <p>
          <strong>رقم السند:</strong> {voucher.voucherNumber || '—'}
        </p>
        <p>
          <strong>التاريخ:</strong> {voucher.date}
        </p>
        <p>
          <strong>الخزينة / الصندوق:</strong> {voucher.safeName ?? '—'}
        </p>
        <p>
          <strong>العملة:</strong> {voucher.currencyCode ?? 'EGP'}
        </p>
        {voucher.description ? (
          <p className="col-span-2">
            <strong>البيان:</strong> {voucher.description}
          </p>
        ) : null}
      </section>

      <table className="print-table mb-4">
        <thead>
          <tr>
            <th>الحساب</th>
            <th>البيان</th>
            <th>المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {voucher.lines.map((line, i) => (
            <tr key={i}>
              <td>{line.accountLabel}</td>
              <td>{line.description ?? '—'}</td>
              <td>{formatInvoiceMoney(line.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-base font-bold">
        الإجمالي: {formatInvoiceMoney(voucher.totalAmount)} {voucher.currencyCode ?? 'EGP'}
      </p>
      {voucher.amountInWords ? (
        <p className="mt-2 text-sm">{voucher.amountInWords}</p>
      ) : null}

      <div className="print-signatures">
        <div>
          <div className="print-signature-box">المستلم</div>
        </div>
        <div>
          <div className="print-signature-box">الصراف</div>
        </div>
        <div>
          <div className="print-signature-box">المحاسب</div>
        </div>
        <div>
          <div className="print-signature-box">المدير المالي</div>
        </div>
      </div>
    </div>
  );
}
