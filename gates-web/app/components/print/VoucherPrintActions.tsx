'use client';

import { useMemo } from 'react';
import { PrintDocumentButton } from '@/app/components/print/PrintDocumentButton';
import { printOperationalDocument } from '@/lib/print/printOperationalDocument';
import type { CompanyPrintProfile, VoucherPrintKind, VoucherPrintLine } from '@/lib/print/types';

const VOUCHER_TITLE: Record<VoucherPrintKind, string> = {
  RECEIPT: 'سند قبض',
  PAYMENT: 'سند صرف',
};

export function VoucherPrintActions({
  kind,
  company,
  voucherNumber,
  date,
  description,
  safeName,
  currencyCode,
  lines,
  totalAmount,
}: {
  kind: VoucherPrintKind;
  company?: CompanyPrintProfile;
  voucherNumber: string;
  date: string;
  description?: string;
  safeName?: string;
  currencyCode?: string;
  lines: VoucherPrintLine[];
  totalAmount: number;
}) {
  const printLines = useMemo(
    () =>
      lines.map((line) => ({
        description: `${line.accountLabel}${line.description ? ` — ${line.description}` : ''}`,
        quantity: 1,
        unitPrice: Number(line.amount) || 0,
        total: Number(line.amount) || 0,
      })),
    [lines]
  );

  const canPrint =
    totalAmount > 0 ||
    lines.some((line) => Boolean(line.accountLabel) || Number(line.amount) > 0);

  return (
    <PrintDocumentButton
      label="طباعة"
      disabled={!canPrint}
      onPrintLayout={() =>
        printOperationalDocument({
          title: VOUCHER_TITLE[kind] || 'سند',
          documentNo: voucherNumber || 'مسودة',
          documentDate: date || new Date().toISOString().slice(0, 10),
          sellerName: company?.nameAr,
          buyerName: [description, safeName].filter(Boolean).join(' — ') || undefined,
          currency: currencyCode,
          lines: printLines,
        })
      }
    />
  );
}
