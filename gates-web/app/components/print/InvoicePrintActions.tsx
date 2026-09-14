'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { PrintDocumentButton } from '@/app/components/print/PrintDocumentButton';
import { printInvoiceDocument } from '@/lib/print/printOperationalDocument';
import { buildInvoicePrintModelFromApi } from '@/lib/print/buildInvoicePrintModel';
import type { CompanyPrintProfile } from '@/lib/print/types';

const ThermalReceiptTemplate = dynamic(
  () =>
    import('@/app/components/print/ThermalReceiptTemplate').then((m) => ({
      default: m.ThermalReceiptTemplate,
    })),
  { ssr: false }
);

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
    return <PrintDocumentButton label="طباعة" disabled onPrintA4={() => <div />} />;
  }

  return (
    <PrintDocumentButton
      label="طباعة"
      disabled={disabled}
      onPrintLayout={() => printInvoiceDocument(model, company)}
      onPrintThermal={() => <ThermalReceiptTemplate company={company} invoice={model} />}
    />
  );
}
