export type AnalyticalSourceType =
  | 'QUOTATION'
  | 'SALES_ORDER'
  | 'PURCHASE_ORDER'
  | 'PURCHASE_INVOICE'
  | 'DELIVERY_NOTE'
  | 'SALES_INVOICE'
  | 'SALES_RETURN'
  | 'PURCHASE_RETURN';

export type AnalyticalLineStatus = 'مفتوح' | 'جزئي' | 'مكتمل' | 'ملغي';

export type AnalyticalLineDraft = {
  id: string;
  sourceType: AnalyticalSourceType;
  sourceTypeLabel: string;
  sourceNumber: string;
  sourceDate: string | null;
  partyName: string;
  itemName: string;
  unitName: string;
  orderedQty: number;
  orderedBaseQty: number;
  unitPrice: number;
  orderedTotal: number;
  issuedBaseQty: number;
  headerConverted: boolean;
  invoiceNumber: string;
  invoiceId: string | null;
  cancelled: boolean;
  sourcePreviewPath: string | null;
  invoicePreviewPath: string | null;
};

export type AnalyticalMovementLine = {
  id: string;
  sourceType: AnalyticalSourceType;
  sourceTypeLabel: string;
  sourceNumber: string;
  sourceDate: string | null;
  partyName: string;
  itemName: string;
  unitName: string;
  orderedQty: number;
  unitPrice: number;
  orderedTotal: number;
  issuedQty: number;
  remainingQty: number;
  invoiceNumber: string;
  invoiceId: string | null;
  status: AnalyticalLineStatus;
  sourcePreviewPath: string | null;
  invoicePreviewPath: string | null;
};

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

/** Issued quantity in the line's own unit. Header conversion fills the line when no line source was stored. */
export function commercialIssuedQty(line: AnalyticalLineDraft): number {
  const ordered = line.orderedQty;
  const base = line.orderedBaseQty;
  let issued = line.issuedBaseQty;
  if (base > 0 && ordered > 0) issued = line.issuedBaseQty * (ordered / base);
  if (issued <= 0 && line.headerConverted) issued = ordered;
  return round4(Math.max(issued, 0));
}

export function analyticalLineStatus(
  ordered: number,
  issued: number,
  cancelled: boolean
): AnalyticalLineStatus {
  if (cancelled) return 'ملغي';
  if (issued <= 0.0001) return 'مفتوح';
  if (issued + 0.0001 < ordered) return 'جزئي';
  return 'مكتمل';
}

function matchesStatus(status: AnalyticalLineStatus, filter?: string): boolean {
  if (!filter) return true;
  if (filter === 'كامل' || filter === 'مكتمل') return status === 'مكتمل';
  return status === filter;
}

export function buildAnalyticalInvoiceMovement(
  drafts: AnalyticalLineDraft[],
  opts: { status?: string; search?: string; page: number; limit: number }
) {
  const search = opts.search?.trim().toLowerCase();
  const rows = drafts
    .map((line): AnalyticalMovementLine => {
      const orderedQty = round4(Math.max(line.orderedQty, 0));
      const issuedQty = commercialIssuedQty({ ...line, orderedQty });
      const remainingQty = round4(Math.max(orderedQty - issuedQty, 0));
      return {
        id: line.id,
        sourceType: line.sourceType,
        sourceTypeLabel: line.sourceTypeLabel,
        sourceNumber: line.sourceNumber,
        sourceDate: line.sourceDate,
        partyName: line.partyName || '—',
        itemName: line.itemName || '—',
        unitName: line.unitName || '—',
        orderedQty,
        unitPrice: round4(line.unitPrice),
        orderedTotal: round4(line.orderedTotal),
        issuedQty,
        remainingQty,
        invoiceNumber: line.invoiceNumber || '—',
        invoiceId: line.invoiceId,
        status: analyticalLineStatus(orderedQty, issuedQty, line.cancelled),
        sourcePreviewPath: line.sourcePreviewPath,
        invoicePreviewPath: line.invoicePreviewPath,
      };
    })
    .filter((row) => {
      if (!matchesStatus(row.status, opts.status)) return false;
      if (!search) return true;
      const hay = `${row.sourceNumber} ${row.invoiceNumber} ${row.partyName} ${row.itemName} ${row.sourceTypeLabel}`.toLowerCase();
      return hay.includes(search);
    });

  const active = rows.filter((row) => row.status !== 'ملغي' && row.sourceType !== 'DELIVERY_NOTE');
  const issueRows = rows.filter((row) => row.status !== 'ملغي' && row.sourceType === 'DELIVERY_NOTE');
  const orderedQty = round4(active.reduce((sum, row) => sum + row.orderedQty, 0));
  const issuedQty = round4(active.reduce((sum, row) => sum + row.issuedQty, 0));
  const remainingQty = round4(active.reduce((sum, row) => sum + row.remainingQty, 0));
  const issueQty = round4(issueRows.reduce((sum, row) => sum + row.issuedQty, 0));
  const convertedCount = active.filter((row) => row.issuedQty > 0).length;
  const openSourceCount = active.filter((row) => row.issuedQty <= 0).length;
  const invoicedTotal = round4(
    active.reduce((sum, row) => {
      if (row.orderedQty <= 0) return sum;
      return sum + (row.issuedQty / row.orderedQty) * row.orderedTotal;
    }, 0)
  );

  const start = Math.max(opts.page - 1, 0) * opts.limit;
  return {
    rows: rows.slice(start, start + opts.limit),
    summary: {
      lineCount: rows.length,
      orderedQty,
      issuedQty,
      remainingQty,
      issueQty,
      convertedCount,
      openSourceCount,
      invoicedTotal,
      conversionRate: orderedQty > 0 ? (issuedQty / orderedQty) * 100 : 0,
    },
    pagination: {
      page: opts.page,
      limit: opts.limit,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / opts.limit)),
    },
  };
}
