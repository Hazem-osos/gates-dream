import type { Prisma } from '@prisma/client';

export type EtaReadinessFilters = {
  fromDate?: Date;
  toDate?: Date;
  invoiceKind?: 'SALE' | 'SALE_RETURN';
  mode?: 'new' | 'amended';
  customerId?: string;
  delegateId?: string;
  warehouseId?: string;
  branchId?: string;
  itemId?: string;
  categoryIds?: string[];
  costCenterId?: string;
  invoiceNumber?: string;
  profileId?: string;
  /** Several patterns at once. Empty means no pattern restriction from this field. */
  profileIds?: string[];
  enabledSalesProfileIds?: string[];
  /** fullCode for a selected NewModule id, e.g. SI02. */
  enabledModuleCodes?: Record<string, string>;
  /** Overrides the send-screen new/amended split. */
  submission?: 'sent' | 'unsent' | 'all';
  submittedFrom?: Date;
  submittedTo?: Date;
  /** Restrict to these invoice ids (for example, sent by one user). */
  invoiceIds?: string[];
};

/** Default sales-invoice screen, present even when no custom pattern row exists. */
export const BUILTIN_SALES_INVOICE_PATTERN_ID = 'builtin:SALES_INVOICE';

export function salesInvoicePatternWhere(input: {
  ids: string[];
  moduleCodesById?: Record<string, string>;
}): Prisma.InvoiceWhereInput {
  const ids = input.ids.map((id) => id.trim()).filter(Boolean);
  const rest = ids.filter((id) => id !== BUILTIN_SALES_INVOICE_PATTERN_ID);
  const or: Prisma.InvoiceWhereInput[] = [];
  if (rest.length) {
    or.push({ documentProfileId: { in: rest } });
    or.push({ newModuleId: { in: rest } });
    const codes = [
      ...new Set(
        rest
          .map((id) => input.moduleCodesById?.[id]?.trim())
          .filter((code): code is string => Boolean(code))
      ),
    ];
    if (codes.length) or.push({ moduleCode: { in: codes } });
  }
  if (ids.includes(BUILTIN_SALES_INVOICE_PATTERN_ID)) {
    or.push({
      documentProfileId: null,
      newModuleId: null,
      OR: [{ moduleCode: null }, { moduleCode: 'SI01' }],
    });
  }
  if (!or.length) return { id: { in: [] } };
  return { OR: or };
}

export function buildEtaReadinessWhere(
  companyId: string,
  filters: EtaReadinessFilters
): Prisma.InvoiceWhereInput {
  const amendedMode = filters.mode === 'amended';
  const and: Prisma.InvoiceWhereInput[] = [];
  const requestedPatterns = filters.profileIds?.length
    ? filters.profileIds
    : filters.profileId
      ? [filters.profileId]
      : undefined;

  if (filters.customerId) and.push({ customerId: filters.customerId });
  if (filters.delegateId) and.push({ representativeId: filters.delegateId });
  if (filters.branchId) and.push({ branchId: filters.branchId });
  const enabledProfiles =
    filters.invoiceKind === 'SALE' && filters.enabledSalesProfileIds?.length
      ? filters.enabledSalesProfileIds
      : undefined;
  if (enabledProfiles) {
    const allowed = requestedPatterns
      ? enabledProfiles.filter((id) => requestedPatterns.includes(id))
      : enabledProfiles;
    and.push(
      salesInvoicePatternWhere({
        ids: allowed,
        moduleCodesById: filters.enabledModuleCodes,
      })
    );
  } else if (requestedPatterns) {
    and.push(
      salesInvoicePatternWhere({
        ids: requestedPatterns,
        moduleCodesById: filters.enabledModuleCodes,
      })
    );
  }
  if (filters.invoiceNumber) {
    and.push({ invoiceNumber: { contains: filters.invoiceNumber } });
  }
  if (filters.warehouseId) {
    and.push({
      OR: [
        { warehouseId: filters.warehouseId },
        { lines: { some: { warehouseId: filters.warehouseId } } },
      ],
    });
  }
  if (filters.costCenterId) {
    and.push({
      OR: [
        { costCenterId: filters.costCenterId },
        { lines: { some: { costCenterId: filters.costCenterId } } },
      ],
    });
  }
  if (filters.itemId || filters.categoryIds?.length) {
    and.push({
      lines: {
        some: {
          ...(filters.itemId ? { itemId: filters.itemId } : {}),
          ...(filters.categoryIds?.length
            ? { item: { categoryId: { in: filters.categoryIds } } }
            : {}),
        },
      },
    });
  }
  if (filters.submittedFrom || filters.submittedTo) {
    and.push({
      eInvoiceDocuments: {
        some: {
          submittedAt: {
            ...(filters.submittedFrom ? { gte: filters.submittedFrom } : {}),
            ...(filters.submittedTo ? { lte: filters.submittedTo } : {}),
          },
        },
      },
    });
  }
  if (filters.invoiceIds) and.push({ id: { in: filters.invoiceIds } });

  const sentMatch: Prisma.InvoiceWhereInput = {
    OR: [
      { taxSubmitted: true },
      { eInvoiceDocuments: { some: { status: { in: ['VALID', 'SUBMITTED'] } } } },
    ],
  };
  const submissionFilter: Prisma.InvoiceWhereInput =
    filters.submission === 'all'
      ? {}
      : filters.submission === 'sent' || (filters.submission == null && amendedMode)
        ? sentMatch
        : { NOT: sentMatch };

  return {
    companyId,
    invoiceKind: filters.invoiceKind ?? { in: ['SALE', 'SALE_RETURN'] },
    isCancelled: false,
    isPosted: true,
    ...submissionFilter,
    ...(filters.fromDate || filters.toDate
      ? {
          date: {
            ...(filters.fromDate ? { gte: filters.fromDate } : {}),
            ...(filters.toDate ? { lte: filters.toDate } : {}),
          },
        }
      : {}),
    ...(and.length ? { AND: and } : {}),
  };
}
