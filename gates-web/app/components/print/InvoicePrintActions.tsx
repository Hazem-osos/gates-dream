'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { PrintDocumentButton } from '@/app/components/print/PrintDocumentButton';

const A4InvoiceTemplate = dynamic(
  () =>
    import('@/app/components/print/A4InvoiceTemplate').then((m) => ({
      default: m.A4InvoiceTemplate,
    })),
  { ssr: false }
);

const ThermalReceiptTemplate = dynamic(
  () =>
    import('@/app/components/print/ThermalReceiptTemplate').then((m) => ({
      default: m.ThermalReceiptTemplate,
    })),
  { ssr: false }
);
import { buildInvoicePrintModelFromApi } from '@/lib/print/buildInvoicePrintModel';
import type { CompanyPrintProfile } from '@/lib/print/types';

export function InvoicePrintActions({
  invoice,
  company,
  disabled,
}: {
  invoice: Record<string, unknown> | null | undefined;
  company?: CompanyPrintProfile;
  disabled?: boolean;
}) {
  const model = useMemo(() => {
    if (!invoice) return null;
    return buildInvoicePrintModelFromApi(invoice, company);
  }, [invoice, company]);

  if (!model || model.lines.length === 0) {
    return (
      <PrintDocumentButton
        label="طباعة"
        disabled
        onPrintA4={() => <div />}
      />
    );
  }

  return (
    <PrintDocumentButton
      label="طباعة"
      disabled={disabled}
      onPrintA4={() => <A4InvoiceTemplate company={company} invoice={model} />}
      onPrintThermal={() => <ThermalReceiptTemplate company={company} invoice={model} />}
    />
  );
}
