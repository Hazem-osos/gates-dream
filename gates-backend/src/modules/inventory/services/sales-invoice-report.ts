import { Prisma } from '@prisma/client';
import { applyCustomerGroupWhere, applySupplierGroupWhere } from '../../accounting/services/party-group-filter';
import { deriveInvoicePaymentStatus } from '../../invoices/utils/invoice-payment-status';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { expandTreeIds } from './item-movement-report';

export const SALES_REPORT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;

export type PresenceFilter = 'all' | 'yes' | 'no';

export type InvoiceDocumentKind =
  | 'SALE'
  | 'PURCHASE'
  | 'SALE_RETURN'
  | 'PURCHASE_RETURN'
  | 'SALES_WITH_RETURNS';

export type SalesInvoiceReportFilters = {
  companyId: string;
  fromDate: Date;
  toDate: Date;
  warehouseId?: string;
  customerId?: string;
  customerCategoryId?: string;
  supplierId?: string;
  supplierCategoryId?: string;
  delegateId?: string;
  branchId?: string;
  itemId?: string;
  itemGroupId?: string;
  costCenterId?: string;
  currencyId?: string;
  unpaidOnly?: boolean;
  showUnposted?: boolean;
  fromInvoice?: string;
  toInvoice?: string;
  sortBy?: string;
  profileId?: string;
  userId?: string;
  driverId?: string;
  distributorId?: string;
  additions?: PresenceFilter;
  otherDiscounts?: PresenceFilter;
  withholdingTax?: PresenceFilter;
  salesTax?: PresenceFilter;
  kind?: InvoiceDocumentKind;
};

type AdjustmentRow = { type?: string | null; amount?: unknown };
type QuoteRow = { id?: string; quoteNumber?: string | null; serial?: string | null } | null;

export type SalesInvoiceSourceRow = {
  id: string;
  invoiceNumber?: string | null;
  invoiceKind?: string | null;
  date?: Date | string | null;
  description?: string | null;
  currencyCode?: string | null;
  isPosted?: boolean | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  totalAmount?: unknown;
  discountAmount?: unknown;
  taxAmount?: unknown;
  withholdingTaxAmount?: unknown;
  netAmount?: unknown;
  paidAmount?: unknown;
  remainingAmount?: unknown;
  sourceType?: string | null;
  sourceId?: string | null;
  sourceNumber?: string | null;
  invoiceType?: string | null;
  originalInvoiceId?: string | null;
  originalInvoiceNumber?: string | null;
  customer?: { id?: string; code?: string | null; arabicName?: string | null } | null;
  supplier?: { id?: string; code?: string | null; arabicName?: string | null } | null;
  warehouse?: { id?: string; code?: string | null; arabicName?: string | null } | null;
  delegate?: { id?: string; code?: string | null; arabicName?: string | null } | null;
  driver?: { id?: string; code?: string | null; arabicName?: string | null } | null;
  distributor?: { id?: string; code?: string | null; arabicName?: string | null } | null;
  adjustments?: AdjustmentRow[] | null;
  priceQuote?: QuoteRow;
  purchaseOrder?: { id?: string; orderNumber?: string | null; serial?: string | null } | null;
  documentProfile?: { nameAr?: string | null } | null;
};

export function parsePresenceFilter(value: unknown): PresenceFilter {
  if (value === 'yes' || value === 'no') return value;
  return 'all';
}

export function invoiceDocumentFamilyWhere(kind: InvoiceDocumentKind = 'SALE'): Prisma.InvoiceWhereInput {
  if (kind === 'PURCHASE') {
    return { OR: [{ invoiceKind: 'PURCHASE' }, { invoiceType: 'purchase' }] };
  }
  if (kind === 'SALE_RETURN') {
    return {
      OR: [
        { invoiceKind: 'SALE_RETURN' },
        { invoiceType: 'salesReturn' },
        { invoiceType: 'return', NOT: { invoiceKind: { in: ['PURCHASE', 'PURCHASE_RETURN'] } } },
      ],
    };
  }
  if (kind === 'PURCHASE_RETURN') {
    return {
      OR: [
        { invoiceKind: 'PURCHASE_RETURN' },
        { invoiceType: 'purchaseReturn' },
        { invoiceType: 'return', NOT: { invoiceKind: { in: ['SALE', 'SALE_RETURN'] } } },
      ],
    };
  }
  if (kind === 'SALES_WITH_RETURNS') {
    return {
      OR: [
        { invoiceKind: { in: ['SALE', 'SALE_RETURN'] } },
        { invoiceType: { in: ['sales', 'salesReturn'] } },
        { invoiceType: 'return', NOT: { invoiceKind: { in: ['PURCHASE', 'PURCHASE_RETURN'] } } },
      ],
    };
  }
  return saleInvoiceFamilyWhere();
}

/** Drafts are excluded even when unposted documents are requested. */
export function saleInvoiceFamilyWhere(): Prisma.InvoiceWhereInput {
  return {
    OR: [{ invoiceKind: 'SALE' }, { invoiceType: 'sales' }],
  };
}

function positiveAmount(presence: PresenceFilter): Prisma.DecimalFilter | undefined {
  if (presence === 'yes') return { gt: 0 };
  if (presence === 'no') return { lte: 0 };
  return undefined;
}

function adjustmentPresence(
  type: 'ADDITION' | 'DEDUCTION',
  presence: PresenceFilter
): Prisma.InvoiceWhereInput | null {
  if (presence === 'all') return null;
  const match = { type, amount: { gt: 0 } };
  return presence === 'yes'
    ? { adjustments: { some: match } }
    : { adjustments: { none: match } };
}

export function buildSalesInvoiceReportWhere(
  filters: SalesInvoiceReportFilters,
  extras?: { currencyCode?: string; categoryIds?: string[] }
): Prisma.InvoiceWhereInput {
  const kind = filters.kind ?? 'SALE';
  const purchaseSide = kind === 'PURCHASE' || kind === 'PURCHASE_RETURN';
  const and: Prisma.InvoiceWhereInput[] = [
    invoiceDocumentFamilyWhere(kind),
    { workflowStatus: { not: 'DRAFT' } },
    { companyId: filters.companyId },
    { date: { gte: filters.fromDate, lte: filters.toDate } },
    { isCancelled: false },
  ];
  if (!filters.showUnposted) and.push({ isPosted: true });

  const scoped: Prisma.InvoiceWhereInput = {};
  if (filters.warehouseId) scoped.warehouseId = filters.warehouseId;
  if (filters.branchId) scoped.branchId = filters.branchId;
  if (filters.delegateId) scoped.representativeId = filters.delegateId;
  if (filters.driverId) scoped.driverId = filters.driverId;
  if (filters.distributorId) scoped.distributorId = filters.distributorId;
  if (filters.costCenterId) scoped.costCenterId = filters.costCenterId;
  if (filters.profileId) scoped.documentProfileId = filters.profileId;
  if (filters.userId) scoped.createdBy = filters.userId;
  if (extras?.currencyCode) scoped.currencyCode = extras.currencyCode;
  if (filters.unpaidOnly) scoped.remainingAmount = { gt: 0 };
  if (filters.fromInvoice || filters.toInvoice) {
    scoped.invoiceNumber = {
      ...(filters.fromInvoice ? { gte: String(filters.fromInvoice) } : {}),
      ...(filters.toInvoice ? { lte: String(filters.toInvoice) } : {}),
    };
  }
  if (purchaseSide) applySupplierGroupWhere(scoped as Record<string, unknown>, filters);
  else applyCustomerGroupWhere(scoped as Record<string, unknown>, filters);

  const line: Prisma.InvoiceLineWhereInput = {};
  if (filters.itemId) line.itemId = filters.itemId;
  if (extras?.categoryIds?.length) line.item = { categoryId: { in: extras.categoryIds } };
  if (Object.keys(line).length) scoped.lines = { some: line };

  const withholding = positiveAmount(filters.withholdingTax ?? 'all');
  if (withholding) scoped.withholdingTaxAmount = withholding;
  const salesTax = positiveAmount(filters.salesTax ?? 'all');
  if (salesTax) scoped.taxAmount = salesTax;

  if (Object.keys(scoped).length) and.push(scoped);

  const additions = adjustmentPresence('ADDITION', filters.additions ?? 'all');
  if (additions) and.push(additions);
  const otherDiscounts = adjustmentPresence('DEDUCTION', filters.otherDiscounts ?? 'all');
  if (otherDiscounts) and.push(otherDiscounts);

  return { AND: and };
}

export function salesReportOrderBy(
  sortBy?: string
): Prisma.InvoiceOrderByWithRelationInput[] {
  if (sortBy === 'invoice-number') {
    return [{ invoiceNumber: 'asc' }, { id: 'asc' }];
  }
  return [{ date: 'desc' }, { invoiceNumber: 'asc' }, { id: 'asc' }];
}

export function documentStatusCode(isPosted: boolean): 'POSTED' | 'UNPOSTED' {
  return isPosted ? 'POSTED' : 'UNPOSTED';
}

export function reportPaymentStatus(
  paidAmount: number,
  netAmount: number,
  stored?: string | null
): 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' {
  if (stored === 'PAID' || stored === 'PARTIALLY_PAID' || stored === 'UNPAID') return stored;
  return deriveInvoicePaymentStatus(paidAmount, netAmount);
}

/** Cash vs credit comes from the invoice payment method, not from the paid amount. */
export function reportPaymentType(method?: string | null): 'cash' | 'credit' | 'split' | '' {
  const value = String(method ?? '').trim().toLowerCase();
  if (value === 'cash' || value === 'نقدي' || value === 'نقدى') return 'cash';
  if (value === 'credit' || value === 'آجل') return 'credit';
  if (value === 'split') return 'split';
  return '';
}

export function sumStoredAdjustments(rows: AdjustmentRow[] | null | undefined, type: 'ADDITION' | 'DEDUCTION'): number {
  let sum = 0;
  for (const row of rows ?? []) {
    if (row.type !== type) continue;
    sum += Number(row.amount ?? 0);
  }
  return roundTo4(sum);
}

export function quotationNumber(row: {
  priceQuote?: QuoteRow;
  sourceType?: string | null;
  sourceNumber?: string | null;
}): string {
  const fromRelation = row.priceQuote?.quoteNumber?.trim() || row.priceQuote?.serial?.trim() || '';
  if (fromRelation) return fromRelation;
  if (row.sourceType === 'QUOTATION') return row.sourceNumber?.trim() || '';
  return '';
}

function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? roundTo4(n) : 0;
}

export function isInvoiceReturnRow(row: {
  invoiceKind?: string | null;
  invoiceType?: string | null;
}): boolean {
  if (row.invoiceKind === 'SALE_RETURN' || row.invoiceKind === 'PURCHASE_RETURN') return true;
  if (row.invoiceType === 'salesReturn' || row.invoiceType === 'purchaseReturn') return true;
  if (row.invoiceType === 'return') {
    return row.invoiceKind !== 'SALE' && row.invoiceKind !== 'PURCHASE';
  }
  return false;
}

export function mapSalesInvoiceReportRow(row: SalesInvoiceSourceRow) {
  const paidAmount = money(row.paidAmount);
  const netAmount = money(row.netAmount);
  const totalAmount = money(row.totalAmount);
  const isReturn = isInvoiceReturnRow(row);
  return {
    id: row.id,
    invoiceKind: row.invoiceKind || row.invoiceType || 'SALE',
    invoiceNumber: row.invoiceNumber ?? '',
    invoicePattern: row.documentProfile?.nameAr?.trim() || '',
    date: row.date,
    description: row.description ?? '',
    currencyCode: row.currencyCode ?? '',
    documentStatus: documentStatusCode(row.isPosted === true),
    paymentStatus: reportPaymentStatus(paidAmount, netAmount, row.paymentStatus),
    paymentMethod: reportPaymentType(row.paymentMethod),
    movementType: isReturn ? 'RETURN' : 'SALE',
    customer: row.customer ?? null,
    supplier: row.supplier ?? null,
    warehouse: row.warehouse ?? null,
    delegate: row.delegate ?? null,
    driver: row.driver ?? null,
    distributor: row.distributor ?? null,
    totalAmount,
    grossAmount: isReturn ? 0 : totalAmount,
    returnAmount: isReturn ? totalAmount : 0,
    additionsAmount: sumStoredAdjustments(row.adjustments, 'ADDITION'),
    otherDiscountsAmount: sumStoredAdjustments(row.adjustments, 'DEDUCTION'),
    discountAmount: money(row.discountAmount),
    withholdingTaxAmount: money(row.withholdingTaxAmount),
    taxAmount: money(row.taxAmount),
    netAmount,
    signedNet: isReturn ? roundTo4(-netAmount) : netAmount,
    paidAmount,
    remainingAmount: money(row.remainingAmount),
    quotationNumber: quotationNumber(row),
    quoteId: row.priceQuote?.id || (row.sourceType === 'QUOTATION' ? row.sourceId : undefined),
    purchaseOrderNumber: row.purchaseOrder?.orderNumber?.trim() || row.purchaseOrder?.serial?.trim() || '',
    purchaseOrderId: row.purchaseOrder?.id,
    originalInvoiceNumber: row.originalInvoiceNumber?.trim() || '',
    originalInvoiceId: row.originalInvoiceId || undefined,
  };
}

const PARTY_SELECT = { id: true, code: true, arabicName: true } as const;

export const SALES_INVOICE_REPORT_SELECT = {
  id: true,
  invoiceNumber: true,
  invoiceKind: true,
  date: true,
  description: true,
  currencyCode: true,
  isPosted: true,
  paymentStatus: true,
  paymentMethod: true,
  totalAmount: true,
  discountAmount: true,
  taxAmount: true,
  withholdingTaxAmount: true,
  netAmount: true,
  paidAmount: true,
  remainingAmount: true,
  sourceType: true,
  sourceId: true,
  sourceNumber: true,
  invoiceType: true,
  originalInvoiceId: true,
  originalInvoiceNumber: true,
  customer: { select: PARTY_SELECT },
  supplier: { select: PARTY_SELECT },
  warehouse: { select: PARTY_SELECT },
  delegate: { select: PARTY_SELECT },
  driver: { select: PARTY_SELECT },
  distributor: { select: PARTY_SELECT },
  adjustments: { select: { type: true, amount: true } },
  priceQuote: { select: { id: true, quoteNumber: true, serial: true } },
  purchaseOrder: { select: { id: true, orderNumber: true, serial: true } },
  documentProfile: { select: { nameAr: true } },
} satisfies Prisma.InvoiceSelect;

const SUM_FIELDS = {
  totalAmount: true,
  discountAmount: true,
  taxAmount: true,
  withholdingTaxAmount: true,
  netAmount: true,
  paidAmount: true,
  remainingAmount: true,
} as const;

export function columnTotalsFromAggregates(input: {
  invoiceSums: Partial<Record<keyof typeof SUM_FIELDS, unknown>>;
  additions: unknown;
  otherDiscounts: unknown;
}) {
  return {
    totalAmount: money(input.invoiceSums.totalAmount),
    additionsAmount: money(input.additions),
    otherDiscountsAmount: money(input.otherDiscounts),
    discountAmount: money(input.invoiceSums.discountAmount),
    withholdingTaxAmount: money(input.invoiceSums.withholdingTaxAmount),
    taxAmount: money(input.invoiceSums.taxAmount),
    netAmount: money(input.invoiceSums.netAmount),
    paidAmount: money(input.invoiceSums.paidAmount),
    remainingAmount: money(input.invoiceSums.remainingAmount),
  };
}

type SalesReportDb = {
  invoice: {
    findMany: (args: Prisma.InvoiceFindManyArgs) => Promise<SalesInvoiceSourceRow[]>;
    count: (args: Prisma.InvoiceCountArgs) => Promise<number>;
    aggregate: (args: Prisma.InvoiceAggregateArgs) => Promise<{ _sum: Record<string, unknown> | null }>;
  };
  invoiceAdjustment: {
    aggregate: (args: Prisma.InvoiceAdjustmentAggregateArgs) => Promise<{ _sum: { amount?: unknown } | null }>;
  };
  currency: {
    findFirst: (args: Prisma.CurrencyFindFirstArgs) => Promise<{ code: string } | null>;
  };
  itemCategory: {
    findMany: (args: Prisma.ItemCategoryFindManyArgs) => Promise<Array<{ id: string; parentCategoryId: string | null }>>;
  };
};

export async function querySalesInvoiceReport(
  db: SalesReportDb,
  filters: SalesInvoiceReportFilters,
  options: { page?: number; limit?: number } = {}
) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, options.limit ?? SALES_REPORT_PAGE_LIMIT));

  let currencyCode: string | undefined;
  if (filters.currencyId) {
    const currency = await db.currency.findFirst({
      where: { companyId: filters.companyId, OR: [{ id: filters.currencyId }, { code: filters.currencyId }] },
      select: { code: true },
    });
    currencyCode = currency?.code ?? filters.currencyId;
  }

  let categoryIds: string[] | undefined;
  if (filters.itemGroupId) {
    const categories = await db.itemCategory.findMany({
      where: { companyId: filters.companyId },
      select: { id: true, parentCategoryId: true },
    });
    categoryIds = expandTreeIds(
      filters.itemGroupId,
      categories.map((row) => ({ id: row.id, parentId: row.parentCategoryId }))
    );
  }

  const where = buildSalesInvoiceReportWhere(filters, { currencyCode, categoryIds });
  const orderBy = salesReportOrderBy(filters.sortBy);
  const adjustmentBase = { companyId: filters.companyId, invoice: where };
  const combined = (filters.kind ?? 'SALE') === 'SALES_WITH_RETURNS';
  const salesWhere: Prisma.InvoiceWhereInput = { AND: [where, invoiceDocumentFamilyWhere('SALE')] };
  const returnWhere: Prisma.InvoiceWhereInput = { AND: [where, invoiceDocumentFamilyWhere('SALE_RETURN')] };
  const noSums = Promise.resolve({ _sum: null as Record<string, unknown> | null });

  const [invoices, total, invoiceAgg, additionAgg, deductionAgg, salesAgg, returnAgg, salesCount, returnCount] =
    await Promise.all([
    db.invoice.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy,
      select: SALES_INVOICE_REPORT_SELECT,
    }),
    db.invoice.count({ where }),
    db.invoice.aggregate({ where, _sum: SUM_FIELDS }),
    db.invoiceAdjustment.aggregate({
      where: { ...adjustmentBase, type: 'ADDITION' },
      _sum: { amount: true },
    }),
    db.invoiceAdjustment.aggregate({
      where: { ...adjustmentBase, type: 'DEDUCTION' },
      _sum: { amount: true },
    }),
    combined ? db.invoice.aggregate({ where: salesWhere, _sum: SUM_FIELDS }) : noSums,
    combined ? db.invoice.aggregate({ where: returnWhere, _sum: SUM_FIELDS }) : noSums,
    combined ? db.invoice.count({ where: salesWhere }) : Promise.resolve(0),
    combined ? db.invoice.count({ where: returnWhere }) : Promise.resolve(0),
  ]);

  const columnTotals = columnTotalsFromAggregates({
    invoiceSums: invoiceAgg._sum ?? {},
    additions: additionAgg._sum?.amount,
    otherDiscounts: deductionAgg._sum?.amount,
  });
  const salesTotals = columnTotalsFromAggregates({ invoiceSums: salesAgg._sum ?? {}, additions: 0, otherDiscounts: 0 });
  const returnTotals = columnTotalsFromAggregates({ invoiceSums: returnAgg._sum ?? {}, additions: 0, otherDiscounts: 0 });
  if (combined) {
    columnTotals.totalAmount = salesTotals.totalAmount;
    Object.assign(columnTotals, {
      grossAmount: salesTotals.totalAmount,
      returnAmount: returnTotals.totalAmount,
      signedNet: roundTo4(salesTotals.netAmount - returnTotals.netAmount),
    });
  }

  return {
    data: invoices.map((row) => mapSalesInvoiceReportRow(row)),
    summary: combined
      ? {
          salesInvoiceCount: salesCount,
          returnInvoiceCount: returnCount,
          salesValue: salesTotals.totalAmount,
          returnValue: returnTotals.totalAmount,
          netValue: roundTo4(salesTotals.totalAmount - returnTotals.totalAmount),
          columnTotals,
        }
      : {
          totalInvoices: total,
          totalAmount: columnTotals.totalAmount,
          additionsAmount: columnTotals.additionsAmount,
          otherDiscountsAmount: columnTotals.otherDiscountsAmount,
          discountAmount: columnTotals.discountAmount,
          withholdingTaxAmount: columnTotals.withholdingTaxAmount,
          taxAmount: columnTotals.taxAmount,
          netAmount: columnTotals.netAmount,
          paidAmount: columnTotals.paidAmount,
          remainingAmount: columnTotals.remainingAmount,
          columnTotals,
        },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
