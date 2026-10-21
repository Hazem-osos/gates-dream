'use client';

import { useEffect, useMemo, useState } from 'react';

export type InvoiceJournalPreviewRef = {
  journalEntryId?: string | null;
  costJournalEntryId?: string | null;
  journalEntry?: { voucherNumber?: string | null; legacyGlNum?: string | null } | null;
  costJournalEntry?: { voucherNumber?: string | null; legacyGlNum?: string | null } | null;
};

export type InvoiceJournalPreviewOption = { id: string; label: string };

export function invoiceJournalPreviewFromApi(
  row: Record<string, unknown> | null | undefined
): InvoiceJournalPreviewRef {
  if (!row) return {};
  const journalEntry = row.journalEntry;
  const costJournalEntry = row.costJournalEntry;
  return {
    journalEntryId: typeof row.journalEntryId === 'string' ? row.journalEntryId : null,
    costJournalEntryId:
      typeof row.costJournalEntryId === 'string' ? row.costJournalEntryId : null,
    journalEntry:
      journalEntry && typeof journalEntry === 'object'
        ? (journalEntry as InvoiceJournalPreviewRef['journalEntry'])
        : null,
    costJournalEntry:
      costJournalEntry && typeof costJournalEntry === 'object'
        ? (costJournalEntry as InvoiceJournalPreviewRef['costJournalEntry'])
        : null,
  };
}

function journalVoucherLabel(
  je?: { voucherNumber?: string | null; legacyGlNum?: string | null } | null
): string {
  return (je?.voucherNumber || je?.legacyGlNum || '').trim();
}

export function buildInvoiceJournalPreviewOptions(
  ref: InvoiceJournalPreviewRef,
  variant: 'sales' | 'purchase' = 'sales'
): InvoiceJournalPreviewOption[] {
  const mainName = variant === 'sales' ? 'فاتورة مبيعات وعميل' : 'فاتورة مشتريات ومورد';
  const costName = 'تكلفة ومخزون';
  const opts: InvoiceJournalPreviewOption[] = [];

  if (ref.journalEntryId) {
    const n = journalVoucherLabel(ref.journalEntry);
    opts.push({
      id: ref.journalEntryId,
      label: n ? `${mainName} — ${n}` : mainName,
    });
  }
  if (ref.costJournalEntryId) {
    const n = journalVoucherLabel(ref.costJournalEntry);
    opts.push({
      id: ref.costJournalEntryId,
      label: n ? `${costName} — ${n}` : costName,
    });
  }
  return opts;
}

/** Pick which linked journal to preview when an invoice has revenue + COGS entries. */
export function useInvoiceJournalPreview(
  ref: InvoiceJournalPreviewRef,
  variant: 'sales' | 'purchase' = 'sales',
  resetKey?: string | null
) {
  const journalOptions = useMemo(
    () => buildInvoiceJournalPreviewOptions(ref, variant),
    [
      ref.journalEntryId,
      ref.costJournalEntryId,
      ref.journalEntry?.voucherNumber,
      ref.journalEntry?.legacyGlNum,
      ref.costJournalEntry?.voucherNumber,
      ref.costJournalEntry?.legacyGlNum,
      variant,
    ]
  );

  const [journalId, setJournalId] = useState<string | null>(null);

  useEffect(() => {
    setJournalId(null);
  }, [resetKey]);

  const activeJournalId =
    journalId && journalOptions.some((o) => o.id === journalId)
      ? journalId
      : journalOptions[0]?.id ?? null;

  const activeJournalLabel =
    journalOptions.find((o) => o.id === activeJournalId)?.label ?? null;

  return {
    journalOptions,
    activeJournalId,
    activeJournalLabel,
    setActiveJournalId: setJournalId,
  };
}
