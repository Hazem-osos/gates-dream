'use client';

import React, { useEffect, useState } from 'react';
import { buildQrDataUrl } from '@/lib/documentLayout/qr';
import type { CompanyPrintProfile, InvoicePrintModel } from '@/lib/print/types';
import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import './print-styles.css';

function ThermalQr({ payload }: { payload?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!payload) return;
    void buildQrDataUrl(payload, { width: 96, margin: 0 }).then(setSrc);
  }, [payload]);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="mx-auto mt-2 h-24 w-24" />;
}

export function ThermalReceiptTemplate({
  company,
  invoice,
}: {
  company?: CompanyPrintProfile;
  invoice: InvoicePrintModel;
}) {
  return (
    <div className="print-page print-thermal" dir="rtl">
      <p className="text-center font-bold text-sm">{company?.nameAr ?? 'Gates ERP'}</p>
      {company?.taxRegistrationNumber ? (
        <p className="text-center print-muted">ض.ق.م: {company.taxRegistrationNumber}</p>
      ) : null}
      <div className="thermal-divider" />
      <p className="text-center font-semibold">
        {invoice.kind === 'PURCHASE' ? 'فاتورة مشتريات' : 'فاتورة مبيعات'}
      </p>
      <p className="text-center print-muted">
        #{invoice.invoiceNumber} · {invoice.date}
      </p>
      <p className="print-muted text-center">{invoice.customerName ?? invoice.supplierName ?? ''}</p>
      <div className="thermal-divider" />
      {invoice.lines.map((line, i) => (
        <div key={i} className="mb-1">
          <div>{line.description}</div>
          <div className="thermal-line print-muted">
            <span>
              {line.quantity} × {formatInvoiceMoney(line.unitPrice)}
            </span>
            <span>{formatInvoiceMoney(line.lineTotal)}</span>
          </div>
        </div>
      ))}
      <div className="thermal-divider" />
      <div className="thermal-line">
        <span>الصافي</span>
        <span>{formatInvoiceMoney(invoice.subtotal)}</span>
      </div>
      <div className="thermal-line">
        <span>ضريبة القيمة المضافة (ض.ق.م)</span>
        <span>{formatInvoiceMoney(invoice.totalVat)}</span>
      </div>
      {(invoice.developmentFee ?? 0) > 0 ? (
        <div className="thermal-line">
          <span>رسم التنمية</span>
          <span>{formatInvoiceMoney(invoice.developmentFee ?? 0)}</span>
        </div>
      ) : null}
      <div className="thermal-line font-bold">
        <span>الإجمالي</span>
        <span>{formatInvoiceMoney(invoice.totalPayable)}</span>
      </div>
      <ThermalQr payload={invoice.qrPayloadBase64} />
      <p className="text-center print-muted mt-2">شكراً لتعاملكم</p>
    </div>
  );
}
