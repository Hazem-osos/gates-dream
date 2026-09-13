'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { PrintDocumentButton } from '@/app/components/print/PrintDocumentButton';
import { tafqeetEgp } from '@/lib/print/tafqeet';
import type { CompanyPrintProfile, VoucherPrintKind, VoucherPrintLine } from '@/lib/print/types';

const VoucherPrintTemplate = dynamic(
  () =>
    import('@/app/components/print/VoucherPrintTemplate').then((m) => ({
      default: m.VoucherPrintTemplate,
    })),
  { ssr: false }
);

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
  const model = useMemo(
    () => ({
      kind,
      voucherNumber,
      date,
      description,
      safeName,
      currencyCode,
      lines,
      totalAmount,
      amountInWords: tafqeetEgp(totalAmount),
    }),
    [kind, voucherNumber, date, description, safeName, currencyCode, lines, totalAmount]
  );

  const canPrint =
    totalAmount > 0 ||
    lines.some((line) => Boolean(line.accountLabel) || Number(line.amount) > 0);

  return (
    <PrintDocumentButton
      label="طباعة"
      disabled={!canPrint}
      onPrintA4={() => <VoucherPrintTemplate company={company} voucher={model} />}
    />
  );
}
