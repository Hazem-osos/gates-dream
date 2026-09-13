'use client';

import React, { useEffect, useState } from 'react';
import { buildQrDataUrl } from '@/lib/documentLayout/qr';
import type { CompanyPrintProfile, InvoicePrintModel } from '@/lib/print/types';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import './print-styles.css';

function CompanyHeaderBlock({
  company,
  title,
}: {
  company?: CompanyPrintProfile;
  title: string;
}) {
  return (
    <header className="mb-4 flex gap-4 border-b border-gray-300 pb-3">
      {company?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={company.logoUrl} alt="" className="h-16 w-16 object-contain" />
      ) : null}
      <div className="flex-1 text-right">
        <h1 className="print-title">{company?.nameAr ?? '—'}</h1>
        {company?.nameEn ? <p className="print-muted">{company.nameEn}</p> : null}
        <p className="text-sm font-bold mt-1">{title}</p>
        <div className="print-muted mt-1 flex flex-wrap gap-x-4 gap-y-0">
          {company?.commercialRegister ? (
            <span>س.ت: {company.commercialRegister}</span>
          ) : null}
          {company?.taxRegistrationNumber ? (
            <span>الرقم الضريبي: {company.taxRegistrationNumber}</span>
          ) : null}
          {company?.branchName ? <span>الفرع: {company.branchName}</span> : null}
          {company?.phone ? <span>تل: {company.phone}</span> : null}
        </div>
        {company?.address ? <p className="print-muted">{company.address}</p> : null}
      </div>
    </header>
  );
}

function QrImage({ payloadBase64 }: { payloadBase64?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!payloadBase64) return;
    void buildQrDataUrl(payloadBase64, { width: 120, margin: 1 }).then(setSrc);
  }, [payloadBase64]);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="QR" className="h-[120px] w-[120px]" />;
}

export function A4InvoiceTemplate({
  company,
  invoice,
  hidePrices = false,
}: {
  company?: CompanyPrintProfile;
  invoice: InvoicePrintModel;
  hidePrices?: boolean;
}) {
  const partyLabel = invoice.kind === 'PURCHASE' ? 'المورد' : 'العميل';
  const partyName = invoice.kind === 'PURCHASE' ? invoice.supplierName : invoice.customerName;

  return (
    <div className="print-page print-a4" dir="rtl">
      <CompanyHeaderBlock
        company={company}
        title={
          hidePrices
            ? 'إيصال استلام بضاعة'
            : invoice.kind === 'PURCHASE'
              ? 'فاتورة مشتريات ضريبية'
              : 'فاتورة مبيعات ضريبية'
        }
      />

      <section className="mb-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p>
            <strong>رقم الفاتورة:</strong> {invoice.invoiceNumber}
          </p>
          <p>
            <strong>التاريخ:</strong> {invoice.date}
          </p>
          <p>
            <strong>طريقة الدفع:</strong> {invoice.paymentMethod ?? '—'}
          </p>
        </div>
        <div>
          <p>
            <strong>{partyLabel}:</strong> {partyName ?? '—'}
          </p>
          {invoice.customerTaxId ? (
            <p>
              <strong>الرقم الضريبي:</strong> {invoice.customerTaxId}
            </p>
          ) : null}
          {invoice.customerAddress ? (
            <p>
              <strong>العنوان:</strong> {invoice.customerAddress}
            </p>
          ) : null}
          {invoice.cashierOrUser ? (
            <p>
              <strong>المستخدم:</strong> {invoice.cashierOrUser}
            </p>
          ) : null}
        </div>
      </section>

      <table className="print-table mb-4">
        <thead>
          <tr>
            <th>كود</th>
            <th>البيان</th>
            <th>الكمية</th>
            <th>الوحدة</th>
            {!hidePrices ? (
              <>
                <th>السعر</th>
                <th>الخصم</th>
                <th>الصافي</th>
                <th title="ضريبة القيمة المضافة (ض.ق.م)">ض.ق.م %</th>
                <th title="ضريبة القيمة المضافة (ض.ق.م)">ض.ق.م</th>
                <th>الإجمالي</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line, i) => (
            <tr key={`${line.code}-${i}`}>
              <td>{line.code || '—'}</td>
              <td>{line.description}</td>
              <td>{line.quantity}</td>
              <td>{line.unit ?? '—'}</td>
              {!hidePrices ? (
                <>
                  <td>{formatInvoiceMoney(line.unitPrice)}</td>
                  <td>{formatInvoiceMoney(line.discount)}</td>
                  <td>{formatInvoiceMoney(line.net)}</td>
                  <td>{line.vatRate}%</td>
                  <td>{formatInvoiceMoney(line.vatAmount)}</td>
                  <td>{formatInvoiceMoney(line.lineTotal)}</td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      {!hidePrices ? (
      <div className="flex justify-between gap-4 items-start">
        <div className="text-sm flex-1">
          <p>
            <strong>الإجمالي قبل الضريبة:</strong> {formatInvoiceMoney(invoice.subtotal)}{' '}
            {invoice.currencyCode}
          </p>
          <p>
            <strong>ضريبة القيمة المضافة (ض.ق.م):</strong> {formatInvoiceMoney(invoice.totalVat)}
          </p>
          {(invoice.developmentFee ?? 0) > 0 ? (
            <p>
              <strong>رسم التنمية:</strong> {formatInvoiceMoney(invoice.developmentFee ?? 0)}
            </p>
          ) : null}
          {invoice.withholding > 0 ? (
            <p>
              <strong>خصم المنبع:</strong> {formatInvoiceMoney(invoice.withholding)}
            </p>
          ) : null}
          <p className="text-base font-bold mt-2">
            <strong>الإجمالي المستحق:</strong> {formatInvoiceMoney(invoice.totalPayable)}{' '}
            {invoice.currencyCode}
          </p>
          {invoice.amountInWords ? (
            <p className="mt-2 text-xs leading-relaxed">{invoice.amountInWords}</p>
          ) : null}
        </div>
        {invoice.qrPayloadBase64 ? (
          <div className="text-center">
            <QrImage payloadBase64={invoice.qrPayloadBase64} />
            <p className="print-muted mt-1">رمز ETA / ZATCA</p>
          </div>
        ) : null}
      </div>
      ) : (
        <p className="text-sm text-slate-600 mt-4">تم استلام البضاعة أعلاه — بدون عرض أسعار.</p>
      )}

      {!hidePrices && invoice.printTermsOnInvoice ? (
        <footer className="mt-6 border-t border-gray-300 pt-4 text-sm text-right space-y-2">
          {invoice.allowReturn && invoice.returnDays ? (
            <p>
              <strong>سياسة الاسترجاع:</strong> يُسمح بالإرجاع خلال {invoice.returnDays} يوماً من تاريخ
              الفاتورة.
            </p>
          ) : null}
          {invoice.termsAndConditions?.length ? (
            <div>
              <p className="font-bold mb-1">الشروط والأحكام</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs leading-relaxed">
                {invoice.termsAndConditions.map((t, i) => (
                  <li key={`${i}-${t.slice(0, 24)}`}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}
