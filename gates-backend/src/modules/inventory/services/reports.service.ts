// @ts-nocheck — report queries predate current Prisma schema shapes; tighten types incrementally.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { agedOpenItemsService } from '../../accounting/services/aged-open-items.service';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  applyCustomerGroupWhere,
  applyCustomerMasterWhere,
  applySupplierGroupWhere,
  applySupplierMasterWhere,
} from '../../accounting/services/party-group-filter';
import type { InvoiceKind } from '../../invoices/types/invoice-posting.types';
import {
  buildItemMovementSheet,
  expandTreeIds,
  isInvoiceStockMovement,
  type ItemMovementSourceLine,
} from './item-movement-report';
import { buildExpiryReport, parseBatchAllocations, type ExpirySourceLot } from './expiry-date-report';
import {
  applyMonthlySalesVisibility,
  buildMonthlyItemSales,
  type MonthlySaleMovement,
} from './monthly-item-sales';
import { itemProfitRatios } from './item-profit-ratios';
import { classifyReceivableInvoice } from './customer-receivables';
import {
  buildItemsAnalyticalMovement,
  type AnalyticalItemMovementLine,
} from './items-analytical-movement';
import { invoiceNumberRange } from './invoice-number-range';
import { loadPartyItemAccount } from './party-item-account';
import {
  buildOverduePaymentSheet,
  filterOverduePaymentRows,
  type OverdueInvoiceInput,
  type SettlementHint,
} from './overdue-payments-report';
import { buildDebtAgeSheet, parseAgeBound, type DebtAgeInvoice } from './debt-age-report';
import { buildStockValuationProfit, type StockProfitItem } from './stock-valuation-profit';
import {
  matchesOrderLimitStatus,
  orderLimitStatusLabel,
  resolveEffectiveOrderLimit,
} from './order-limit-status';
import {
  countFlag,
  countLayout,
  inventoryCountItemWhere,
  inventoryCountRow,
  inventoryCountSummaryTotalsFromRows,
  keepCountBalance,
  usesLiveWarehouseBalances,
  layoutInventoryCountRows,
  paintReportLayout,
  type CountItemFields,
} from './inventory-count-report';
import { resolveCompanyFxRate } from '../../accounting/utils/company-fx-rate';
import { querySalesInvoiceReport, sumStoredAdjustments } from './sales-invoice-report';
import { buildInvoiceProfitSheet } from './invoices-profit-sheet';
import { loadCustomerBalancesReport } from './customer-balances-report';
import { loadCollectionsAndOverduesReport } from './collections-overdues-report';
import { loadPartyCurrencyStatement } from './party-currency-statement';

/** Match M5 `invoiceKind` and legacy `invoiceType` without mixing sale/purchase returns. */
function invoiceFamilyWhere(kinds: InvoiceKind[]) {
  const typeMap: Record<InvoiceKind, string[]> = {
    SALE: ['sales'],
    PURCHASE: ['purchase'],
    SALE_RETURN: ['salesReturn'],
    PURCHASE_RETURN: ['purchaseReturn'],
    SALES_ORDER: ['salesOrder'],
  };
  const types = kinds.flatMap((kind) => typeMap[kind]);
  const or: Record<string, unknown>[] = [
    { invoiceKind: { in: kinds } },
    { invoiceType: { in: types } },
  ];
  const saleReturnOnly = kinds.includes('SALE_RETURN') && !kinds.includes('PURCHASE_RETURN');
  const purchaseReturnOnly = kinds.includes('PURCHASE_RETURN') && !kinds.includes('SALE_RETURN');
  if (saleReturnOnly) {
    or.push({
      invoiceType: 'return',
      NOT: { invoiceKind: { in: ['PURCHASE', 'PURCHASE_RETURN'] } },
    });
  } else if (purchaseReturnOnly) {
    or.push({
      invoiceType: 'return',
      NOT: { invoiceKind: { in: ['SALE', 'SALE_RETURN'] } },
    });
  } else if (kinds.includes('SALE_RETURN') && kinds.includes('PURCHASE_RETURN')) {
    or.push({ invoiceType: 'return' });
  }
  return { OR: or };
}

function isSaleSide(invoice: { invoiceKind?: string | null; invoiceType?: string | null }) {
  if (invoice.invoiceKind === 'SALE' || invoice.invoiceKind === 'SALE_RETURN') return true;
  if (invoice.invoiceKind === 'PURCHASE' || invoice.invoiceKind === 'PURCHASE_RETURN') return false;
  return invoice.invoiceType === 'sales' || invoice.invoiceType === 'salesReturn' || invoice.invoiceType === 'return';
}

function isSaleReturn(invoice: { invoiceKind?: string | null; invoiceType?: string | null }) {
  if (invoice.invoiceKind === 'SALE_RETURN') return true;
  if (invoice.invoiceKind && invoice.invoiceKind !== 'SALE_RETURN') return false;
  return invoice.invoiceType === 'salesReturn' || invoice.invoiceType === 'return';
}

function isPurchaseReturn(invoice: { invoiceKind?: string | null; invoiceType?: string | null }) {
  if (invoice.invoiceKind === 'PURCHASE_RETURN') return true;
  if (invoice.invoiceKind && invoice.invoiceKind !== 'PURCHASE_RETURN') return false;
  return invoice.invoiceType === 'purchaseReturn' || invoice.invoiceType === 'return';
}

const OPEN_PAPER_CASE = { notIn: ['COLLECTED', 'MULTI_COLLECTED', 'CANCELLED', 'BOUNCED', 'ENDORSED'] };

function partyKindLabel(invoice, party) {
  if (party === 'customer') return isSaleReturn(invoice) ? 'مردود مبيعات' : 'فاتورة مبيعات';
  return isPurchaseReturn(invoice) ? 'مردود مشتريات' : 'فاتورة مشتريات';
}

function partyMovementSides(invoice, party) {
  const net = Number(invoice.netAmount || invoice.totalAmount || 0);
  const paid = Number(invoice.paidAmount || 0);
  const isReturn = party === 'customer' ? isSaleReturn(invoice) : isPurchaseReturn(invoice);
  if (party === 'customer') {
    return isReturn ? { debit: paid, credit: net } : { debit: net, credit: paid };
  }
  return isReturn ? { debit: net, credit: paid } : { debit: paid, credit: net };
}

function partyDiscountsAndAdditions(invoice) {
  const discount = Number(invoice.discountAmount || 0);
  const developmentFee = Number(invoice.developmentFeeAmount || 0);
  const adjustmentNet = (invoice.adjustments ?? []).reduce((sum, row) => {
    const amount = Number(row.amount || 0);
    return sum + (row.type === 'ADDITION' ? amount : -amount);
  }, 0);
  return adjustmentNet + developmentFee - discount;
}

function partyAdditions(invoice) {
  const developmentFee = Number(invoice.developmentFeeAmount || 0);
  const additions = (invoice.adjustments ?? []).reduce((sum, row) => {
    if (row.type !== 'ADDITION') return sum;
    return sum + Number(row.amount || 0);
  }, 0);
  return additions + developmentFee;
}

function partyGrossExTax(invoice) {
  return Number(invoice.totalAmount || 0) - Number(invoice.discountAmount || 0);
}

async function openCommercialPaperAmount(companyId, party, partyId) {
  if (!partyId) return 0;
  if (party === 'customer') {
    const [receipts, cheques] = await Promise.all([
      prisma.securitiesReceipt.aggregate({
        where: { companyId, customerId: partyId, isCancelled: false, paperCase: OPEN_PAPER_CASE },
        _sum: { amount: true },
      }),
      prisma.cheque.aggregate({
        where: {
          companyId,
          customerId: partyId,
          direction: 'INWARD',
          status: { in: ['UNDER_HAND', 'SENT_TO_BANK'] },
        },
        _sum: { amount: true },
      }),
    ]);
    return Number(receipts._sum.amount || 0) + Number(cheques._sum.amount || 0);
  }
  const [payments, cheques] = await Promise.all([
    prisma.securitiesPayment.aggregate({
      where: { companyId, supplierId: partyId, isCancelled: false, paperCase: OPEN_PAPER_CASE },
      _sum: { amount: true },
    }),
    prisma.cheque.aggregate({
      where: {
        companyId,
        supplierId: partyId,
        direction: 'OUTWARD',
        status: { in: ['UNDER_HAND', 'SENT_TO_BANK'] },
      },
      _sum: { amount: true },
    }),
  ]);
  return Number(payments._sum.amount || 0) + Number(cheques._sum.amount || 0);
}

async function buildPartyAccountStatement(filters, options, party) {
  const { companyId, fromDate, toDate, branchId, currencyId } = filters;
  const page = options.page ?? 1;
  const limit = options.limit ?? 100;
  const partyId = party === 'customer' ? filters.customerId : filters.supplierId;
  const where = {
    companyId,
    ...postedUnlessRequested(filters),
    isCancelled: false,
    ...invoiceFamilyWhere(party === 'customer' ? ['SALE', 'SALE_RETURN'] : ['PURCHASE', 'PURCHASE_RETURN']),
  };
  if (party === 'customer') applyCustomerGroupWhere(where, filters);
  else applySupplierGroupWhere(where, filters);
  if (branchId) where.branchId = branchId;
  if (fromDate || toDate) {
    where.date = {};
    if (fromDate) where.date.gte = fromDate;
    if (toDate) where.date.lte = toDate;
  }
  if (currencyId) {
    const currency = await prisma.currency.findFirst({
      where: { companyId, OR: [{ id: currencyId }, { code: currencyId }] },
      select: { code: true },
    });
    if (currency?.code) where.currencyCode = currency.code;
  }
  applyReportUser(where, filters);

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: [{ date: 'asc' }, { invoiceNumber: 'asc' }],
    include: {
      customer: { select: { id: true, arabicName: true, creditLimit: true } },
      supplier: { select: { id: true, arabicName: true, creditLimit: true } },
      delegate: { select: { arabicName: true } },
      adjustments: { select: { type: true, amount: true } },
    },
  });

  const openingByParty = new Map();
  if (fromDate) {
    const prior = await prisma.invoice.findMany({
      where: { ...where, date: { lt: fromDate } },
      select: {
        customerId: true,
        supplierId: true,
        remainingAmount: true,
        invoiceKind: true,
        invoiceType: true,
      },
    });
    for (const row of prior) {
      const id = party === 'customer' ? row.customerId : row.supplierId;
      if (!id) continue;
      const sign =
        party === 'customer'
          ? row.invoiceKind === 'SALE_RETURN'
            ? -1
            : 1
          : row.invoiceKind === 'PURCHASE_RETURN'
            ? -1
            : 1;
      openingByParty.set(id, (openingByParty.get(id) || 0) + sign * Number(row.remainingAmount || 0));
    }
  }

  const grouped = new Map();
  for (const invoice of invoices) {
    const id = party === 'customer' ? invoice.customerId : invoice.supplierId;
    if (!id) continue;
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(invoice);
  }
  for (const id of openingByParty.keys()) {
    if (!grouped.has(id)) grouped.set(id, []);
  }

  const rows = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const [id, movements] of grouped) {
    const opening = openingByParty.get(id) || 0;
    let running = opening;
    const sample = movements[0];
    const partyName =
      party === 'customer'
        ? sample?.customer?.arabicName || ''
        : sample?.supplier?.arabicName || '';
    if (fromDate && (opening !== 0 || partyId)) {
      rows.push({
        rowKind: 'opening',
        date: fromDate,
        description: 'رصيد افتتاحي',
        sourceName: '',
        partyName,
        debit: Math.max(opening, 0),
        credit: Math.max(-opening, 0),
        runningBalance: opening,
        netAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        grossExTax: 0,
        taxAmount: 0,
        additionsAmount: 0,
        withholdingTaxAmount: 0,
      });
    }
    for (const invoice of movements) {
      const sides = partyMovementSides(invoice, party);
      running += sides.debit - sides.credit;
      totalDebit += sides.debit;
      totalCredit += sides.credit;
      const number = invoice.invoiceNumber || '';
      const kind = partyKindLabel(invoice, party);
      const source = invoice.sourceNumber && invoice.sourceNumber !== number ? ` · ${invoice.sourceNumber}` : '';
      rows.push({
        rowKind: 'movement',
        date: invoice.date,
        invoiceId: invoice.id,
        invoiceNumber: number,
        invoiceKind: invoice.invoiceKind,
        invoiceType: invoice.invoiceType,
        debit: sides.debit,
        credit: sides.credit,
        runningBalance: running,
        description: invoice.description || kind,
        sourceName: kind,
        sourceLabel: `${number} · ${kind}${source}`,
        netAmount: Number(invoice.netAmount || invoice.totalAmount || 0),
        paidAmount: Number(invoice.paidAmount || 0),
        remainingAmount: Number(invoice.remainingAmount || 0),
        grossExTax: partyGrossExTax(invoice),
        taxAmount: Number(invoice.taxAmount || 0),
        additionsAmount: partyAdditions(invoice),
        discountsAndAdditions: partyDiscountsAndAdditions(invoice),
        withholdingTaxAmount: Number(invoice.withholdingTaxAmount || 0),
        delegate: invoice.delegate?.arabicName || '',
        partyName:
          party === 'customer' ? invoice.customer?.arabicName || partyName : invoice.supplier?.arabicName || partyName,
      });
    }
  }

  const closingBalance = totalDebit - totalCredit + [...openingByParty.values()].reduce((sum, value) => sum + value, 0);
  const summary = {
    totalDebit,
    totalCredit,
    closingBalance,
  };
  if (partyId) {
    const uncollectedAmount = await openCommercialPaperAmount(companyId, party, partyId);
    const profileSelect = {
      arabicName: true,
      code: true,
      nationality: true,
      creditLimit: true,
      country: true,
      city: true,
      area: true,
      street: true,
      phone1: true,
      fax: true,
      mobile: true,
      website: true,
    };
    const partyRow =
      party === 'customer'
        ? await prisma.customer.findFirst({
            where: { companyId, id: partyId },
            select: profileSelect,
          })
        : await prisma.supplier.findFirst({
            where: { companyId, id: partyId },
            select: profileSelect,
          });
    const creditLimitAmount = Number(partyRow?.creditLimit || 0);
    summary.uncollectedAmount = uncollectedAmount;
    summary.creditLimitAmount = creditLimitAmount;
    summary.availableCreditAmount = creditLimitAmount - closingBalance;
    if (partyRow) {
      summary.party = {
        name: partyRow.arabicName || '',
        code: partyRow.code || '',
        nationality: partyRow.nationality || '',
        country: partyRow.country || '',
        city: partyRow.city || '',
        area: partyRow.area || '',
        street: partyRow.street || '',
        phone: partyRow.phone1 || '',
        fax: partyRow.fax || '',
        mobile: partyRow.mobile || '',
        website: partyRow.website || '',
        creditLimitAmount,
      };
    }
  }

  const skip = (page - 1) * limit;
  return {
    data: rows.slice(skip, skip + limit),
    summary,
    pagination: {
      page,
      limit,
      total: rows.length,
      totalPages: Math.ceil(rows.length / limit) || 1,
    },
  };
}

/** Not yet due, then 1–30, 31–60, 61–90, and older. */
function receivableAgeBucket(dueDate, asOf) {
  const due = dueDate ? new Date(dueDate) : asOf;
  const days = Math.floor((asOf.getTime() - due.getTime()) / 86400000);
  if (!Number.isFinite(days) || days <= 0) return 'current';
  if (days <= 30) return 'd30';
  if (days <= 60) return 'd60';
  if (days <= 90) return 'd90';
  return 'older';
}

const ITEM_SELECT = { id: true, serial: true, arabicName: true, englishName: true } as const;
const WAREHOUSE_SELECT = { id: true, code: true, arabicName: true } as const;

const MOVEMENT_TYPE_AR: Record<string, string> = {
  PURCHASE: 'شراء',
  SALE: 'بيع',
  RETURN_PURCHASE: 'مرتجع شراء',
  RETURN_SALE: 'مرتجع بيع',
  TRANSFER_IN: 'تحويل وارد',
  TRANSFER_OUT: 'تحويل صادر',
  ADJUSTMENT_POSITIVE: 'تسوية بالزيادة',
  ADJUSTMENT_NEGATIVE: 'تسوية بالنقص',
  ASSEMBLY_IN: 'تجميع وارد',
  ASSEMBLY_OUT: 'تجميع صادر',
  DISASSEMBLY: 'تفكيك',
  RECEIPT: 'إذن إضافة مخزني',
  ISSUE: 'إذن صرف مخزني',
  GI: 'إذن صرف مخزني',
  GR: 'إذن إضافة مخزني',
  OPENING: 'رصيد أول المدة',
};

function n(value: unknown): number {
  return Number(value ?? 0);
}

function labelMovementType(type: string | null | undefined): string {
  if (!type) return '';
  return MOVEMENT_TYPE_AR[type] ?? type.replace(/_/g, ' ');
}

function movementSourceLabel(movementType: string | null | undefined, sourceType: string | null | undefined): string {
  const base = (sourceType || '').replace(/-UNPOST$/, '').replace(/-EDIT$/, '').replace(/-CANCEL$/, '');
  if (base === 'OB' || base === 'OPEN') return 'بضاعة أول المدة';
  if (base === 'GI') return MOVEMENT_TYPE_AR.ISSUE;
  if (base === 'GR') return MOVEMENT_TYPE_AR.RECEIPT;
  return labelMovementType(movementType);
}

const MOVEMENT_ITEM_SELECT = {
  arabicName: true,
  serial: true,
  barcode: true,
  manufacturerId: true,
  colorId: true,
  countryOfOrigin: true,
  quality: true,
  size: true,
  property1: true,
  property2: true,
  property3: true,
  property4: true,
  property5: true,
  upperLimit: true,
  lowerLimit: true,
  orderLimit: true,
  category: { select: { arabicName: true } },
} as const;

function itemTraits(item: {
  serial?: string | null;
  barcode?: string | null;
  manufacturerId?: string | null;
  countryOfOrigin?: string | null;
  quality?: string | null;
  size?: string | null;
  property1?: string | null;
  property2?: string | null;
  property3?: string | null;
  property4?: string | null;
  property5?: string | null;
  upperLimit?: unknown;
  lowerLimit?: unknown;
  orderLimit?: unknown;
  category?: { arabicName?: string | null } | null;
} | null | undefined) {
  return {
    itemSerial: item?.serial ?? '',
    barcode: item?.barcode ?? '',
    manufacturer: item?.manufacturerId ?? '',
    itemGroupName: item?.category?.arabicName || '',
    origin: item?.countryOfOrigin || '',
    quality: item?.quality || '',
    size: item?.size || '',
    property1: item?.property1 ?? '',
    property2: item?.property2 ?? '',
    property3: item?.property3 ?? '',
    property4: item?.property4 ?? '',
    property5: item?.property5 ?? '',
    upperLimit: n(item?.upperLimit),
    lowerLimit: n(item?.lowerLimit),
    orderLimit: n(item?.orderLimit),
  };
}

async function averageCostBefore(companyId: string, itemIds: string[], before: Date): Promise<Map<string, number>> {
  const costs = new Map<string, number>();
  if (!itemIds.length) return costs;
  const history = await prisma.$queryRaw<Array<{ itemId: string; cost: unknown }>>(Prisma.sql`
    SELECT h.itemId AS itemId, h.cost AS cost
    FROM item_cost_history h
    INNER JOIN (
      SELECT itemId, MAX(effectiveAt) AS effectiveAt
      FROM item_cost_history
      WHERE companyId = ${companyId}
        AND documentDate < ${before}
        AND itemId IN (${Prisma.join(itemIds)})
      GROUP BY itemId
    ) latest ON latest.itemId = h.itemId AND latest.effectiveAt = h.effectiveAt
    WHERE h.companyId = ${companyId}
  `);
  for (const row of history) {
    const cost = n(row.cost);
    if (cost) costs.set(row.itemId, cost);
  }
  const missing = itemIds.filter((id) => !costs.has(id));
  if (!missing.length) return costs;
  const ledgers = await prisma.$queryRaw<Array<{ itemId: string; cost: unknown }>>(Prisma.sql`
    SELECT m.itemId AS itemId, m.resultingAverageCost AS cost
    FROM inventory_movements m
    INNER JOIN (
      SELECT itemId, MAX(effectiveAt) AS effectiveAt
      FROM inventory_movements
      WHERE companyId = ${companyId}
        AND documentDate < ${before}
        AND itemId IN (${Prisma.join(missing)})
        AND resultingAverageCost IS NOT NULL
      GROUP BY itemId
    ) latest ON latest.itemId = m.itemId AND latest.effectiveAt = m.effectiveAt
    WHERE m.companyId = ${companyId}
  `);
  for (const row of ledgers) {
    const cost = n(row.cost);
    if (cost && !costs.has(row.itemId)) costs.set(row.itemId, cost);
  }
  return costs;
}

function lineUnitCost(line: {
  unitCostAtIssue?: unknown;
  item?: {
    averageCost?: unknown;
    lastPurchasePrice?: unknown;
    beginningCostPrice?: unknown;
  } | null;
}): number {
  return (
    n(line.unitCostAtIssue) ||
    n(line.item?.averageCost) ||
    n(line.item?.lastPurchasePrice) ||
    n(line.item?.beginningCostPrice)
  );
}

function applyReportUser(where: { createdBy?: string }, filters: { userId?: string }) {
  if (filters.userId) where.createdBy = String(filters.userId);
}

function postedUnlessRequested(filters: { showUnposted?: boolean }) {
  return filters.showUnposted ? {} : { isPosted: true };
}


async function unpostedInvoiceQtyMap(
  companyId: string,
  opts: { toDate?: Date; warehouseIds?: string[] } = {}
): Promise<Map<string, number>> {
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      isPosted: false,
      isCancelled: false,
      ...(opts.toDate ? { date: { lte: opts.toDate } } : {}),
      ...invoiceFamilyWhere(['SALE', 'PURCHASE', 'SALE_RETURN', 'PURCHASE_RETURN']),
    },
    select: {
      warehouseId: true,
      invoiceKind: true,
      invoiceType: true,
      lines: {
        select: { itemId: true, warehouseId: true, quantity: true, baseQuantity: true },
      },
    },
  });
  const allowed = opts.warehouseIds?.length ? new Set(opts.warehouseIds) : null;
  const map = new Map<string, number>();
  for (const invoice of invoices) {
    const outbound = isPurchaseReturn(invoice) || (isSaleSide(invoice) && !isSaleReturn(invoice));
    const sign = outbound ? -1 : 1;
    for (const line of invoice.lines) {
      const warehouseId = line.warehouseId || invoice.warehouseId || '';
      if (!warehouseId || !line.itemId) continue;
      if (allowed && !allowed.has(warehouseId)) continue;
      const qty = Math.abs(n(line.baseQuantity)) || Math.abs(n(line.quantity));
      if (!qty) continue;
      const key = `${warehouseId}:${line.itemId}`;
      map.set(key, (map.get(key) ?? 0) + sign * qty);
    }
  }
  return map;
}

async function addUnpostedStockQty<T extends { itemId: string; warehouseId: string }>(
  companyId: string,
  rows: T[],
  filters: { showUnposted?: boolean; toDate?: Date },
  apply: (row: T, quantity: number) => void,
  read: (row: T) => number
) {
  if (!filters.showUnposted || !rows.length) return;
  const extra = await unpostedInvoiceQtyMap(companyId, { toDate: filters.toDate });
  if (!extra.size) return;
  for (const row of rows) {
    const delta = extra.get(`${row.warehouseId}:${row.itemId}`);
    if (!delta) continue;
    apply(row, read(row) + delta);
  }
}

export interface InventoryReportFilters {
  fromDate?: Date;
  toDate?: Date;
  companyId: string;
  branchId?: string;
  warehouseId?: string;
  itemId?: string;
  customerId?: string;
  supplierId?: string;
  customerCategoryId?: string;
  supplierCategoryId?: string;
  delegateId?: string;
  costCenterId?: string;
  currencyId?: string;
  sellerId?: string;
  unpaidOnly?: boolean;
  fromInvoice?: string;
  toInvoice?: string;
  [key: string]: any;
}

export interface InventoryReportOptions {
  includeDetails?: boolean;
  includeSummary?: boolean;
  page?: number;
  limit?: number;
  groupBy?: 'none' | 'warehouse' | 'groups' | 'costCenter';
}

export interface InventoryReportResult {
  data: any[];
  summary?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function resolveReportItemIds(
  companyId: string,
  filters: InventoryReportFilters
): Promise<string[] | undefined> {
  const catalog = inventoryCountItemWhere(filters);
  const itemGroupId = filters.itemGroupId || filters.categoryId;
  if (!filters.itemId && !itemGroupId && !Object.keys(catalog).length) return undefined;
  let categoryIds: string[] | undefined;
  if (itemGroupId) {
    const categories = await prisma.itemCategory.findMany({
      where: { companyId },
      select: { id: true, parentCategoryId: true },
    });
    categoryIds = expandTreeIds(
      String(itemGroupId),
      categories.map((row) => ({ id: row.id, parentId: row.parentCategoryId }))
    );
  }
  const items = await prisma.item.findMany({
    where: {
      companyId,
      ...(filters.itemId ? { id: String(filters.itemId) } : {}),
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      ...catalog,
    },
    select: { id: true },
  });
  return items.map((row) => row.id);
}

export class InventoryReportsService {
  /**
   * Get Sales Reports
   */
  async getSalesReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const {
        fromDate,
        toDate,
        companyId,
        warehouseId,
        customerId,
        delegateId,
        branchId,
        itemId,
        costCenterId,
        currencyId,
        sellerId,
        unpaidOnly,
        fromInvoice,
        toInvoice,
        sortBy,
        profileId,
      } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        ...invoiceFamilyWhere(['SALE']),
        date: {
          gte: fromDate,
          lte: toDate,
        },
        ...(filters.showUnposted ? {} : { isPosted: true }),
        isCancelled: false,
      };

      if (warehouseId) {
        where.warehouseId = warehouseId;
      }

      applyCustomerGroupWhere(where, filters);

      if (branchId) {
        where.branchId = branchId;
      }

      if (delegateId) {
        // Wave 5 fix: Invoice has no `delegateId` column — the FK is
        // `representativeId` (relation name `delegate`). Filtering by
        // delegate previously threw a Prisma "unknown argument" runtime
        // error on every call that set this filter.
        where.representativeId = delegateId;
      }

      if (sellerId) {
        where.sellerId = sellerId;
      }

      if (costCenterId) {
        where.costCenterId = costCenterId;
      }

      if (currencyId) {
        const currency = await prisma.currency.findFirst({
          where: { companyId, OR: [{ id: currencyId }, { code: currencyId }] },
          select: { code: true },
        });
        where.currencyCode = currency?.code ?? currencyId;
      }

      if (profileId) {
        where.documentProfileId = profileId;
      }

      if (itemId) {
        where.lines = { some: { itemId } };
      }

      if (unpaidOnly) {
        where.remainingAmount = { gt: 0 };
      }

      if (fromInvoice || toInvoice) {
        where.invoiceNumber = {
          ...(fromInvoice ? { gte: String(fromInvoice) } : {}),
          ...(toInvoice ? { lte: String(toInvoice) } : {}),
        };
      }

      const skip = (page - 1) * limit;
      // Wave 5 fix: the filter UI's only "sort by" option is invoice number;
      // honor it instead of always ordering by date regardless of selection.
      const orderBy =
        sortBy === 'invoice-number' ? [{ invoiceNumber: 'asc' as const }] : [{ date: 'desc' as const }];

      applyReportUser(where, filters);
      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            customer: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            warehouse: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            delegate: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            lines: {
              include: {
                item: {
                  select: {
                    id: true,
                    serial: true,
                    arabicName: true,
                  },
                },
                unit: {
                  select: {
                    id: true,
                    code: true,
                    arabicName: true,
                  },
                },
              },
            },
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
      const totalQuantity = invoices.reduce((sum, inv) => {
        return sum + inv.lines.reduce((lineSum, line) => lineSum + Number(line.quantity), 0);
      }, 0);

      return {
        data: invoices,
        summary: {
          totalInvoices: total,
          totalSales,
          totalQuantity,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating sales report');
      throw error;
    }
  }

  /**
   * Sales report screen: header rows, draft exclusion, and totals for the full filter.
   * Does not replace getSalesReport, which the AI summary tool and report worker still call.
   */
  async getSalesDocumentReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    return querySalesInvoiceReport(prisma, { ...filters, kind: 'SALE' }, options);
  }

  async getPurchaseDocumentReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    return querySalesInvoiceReport(prisma, { ...filters, kind: 'PURCHASE' }, options);
  }

  async getSalesReturnDocumentReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    return querySalesInvoiceReport(prisma, { ...filters, kind: 'SALE_RETURN' }, options);
  }

  async getPurchaseReturnDocumentReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    return querySalesInvoiceReport(prisma, { ...filters, kind: 'PURCHASE_RETURN' }, options);
  }

  async getSalesAndReturnsDocumentReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    return querySalesInvoiceReport(prisma, { ...filters, kind: 'SALES_WITH_RETURNS' }, options);
  }

  /**
   * Get Purchase Reports
   */
  async getPurchaseReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const {
        fromDate,
        toDate,
        companyId,
        warehouseId,
        branchId,
        itemId,
        currencyId,
        unpaidOnly,
        fromInvoice,
        toInvoice,
        profileId,
      } = filters;
      const { page = 1, limit = 2000 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        ...invoiceFamilyWhere(['PURCHASE']),
        date: {
          gte: fromDate,
          lte: toDate,
        },
        ...(filters.showUnposted ? {} : { isPosted: true }),
        isCancelled: false,
      };

      if (warehouseId) {
        where.warehouseId = warehouseId;
      }

      applySupplierGroupWhere(where, filters);

      if (branchId) {
        where.branchId = branchId;
      }

      if (profileId) {
        where.documentProfileId = profileId;
      }

      if (itemId) {
        where.lines = { some: { itemId } };
      }

      if (currencyId) {
        const currency = await prisma.currency.findFirst({
          where: { companyId, OR: [{ id: currencyId }, { code: currencyId }] },
          select: { code: true },
        });
        where.currencyCode = currency?.code ?? currencyId;
      }

      if (unpaidOnly) {
        where.remainingAmount = { gt: 0 };
      }

      const numberRange = invoiceNumberRange(fromInvoice, toInvoice);
      if (numberRange) {
        const matched = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM invoices
          WHERE companyId = ${companyId}
            AND invoiceNumber IS NOT NULL
            AND (invoiceKind = 'PURCHASE' OR invoiceType = 'purchase')
            AND CAST(REGEXP_SUBSTR(invoiceNumber, '[0-9]+$') AS UNSIGNED) BETWEEN ${numberRange.start} AND ${numberRange.end}
        `;
        where.id = { in: matched.length ? matched.map((row) => row.id) : ['00000000-0000-0000-0000-000000000000'] };
      } else if (fromInvoice?.trim() || toInvoice?.trim()) {
        where.invoiceNumber = { contains: (fromInvoice || toInvoice || '').trim() };
      }

      const skip = (page - 1) * limit;

      applyReportUser(where, filters);
      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'desc' }],
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            warehouse: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            lines: {
              include: {
                item: {
                  select: {
                    id: true,
                    serial: true,
                    arabicName: true,
                  },
                },
                unit: {
                  select: {
                    id: true,
                    code: true,
                    arabicName: true,
                  },
                },
              },
            },
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      const totalPurchases = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
      const totalQuantity = invoices.reduce((sum, inv) => {
        return sum + inv.lines.reduce((lineSum, line) => lineSum + Number(line.quantity), 0);
      }, 0);

      return {
        data: invoices,
        summary: {
          totalInvoices: total,
          totalPurchases,
          totalQuantity,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating purchase report');
      throw error;
    }
  }

  /**
   * Get Sales Returns Reports
   */
  async getSalesReturnsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const {
        fromDate,
        toDate,
        companyId,
        warehouseId,
        delegateId,
        branchId,
        itemId,
        costCenterId,
        currencyId,
        sellerId,
        unpaidOnly,
        fromInvoice,
        toInvoice,
        sortBy,
        profileId,
      } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        ...invoiceFamilyWhere(['SALE_RETURN']),
        date: {
          gte: fromDate,
          lte: toDate,
        },
        ...(filters.showUnposted ? {} : { isPosted: true }),
        isCancelled: false,
      };

      if (warehouseId) {
        where.warehouseId = warehouseId;
      }

      applyCustomerGroupWhere(where, filters);

      if (branchId) {
        where.branchId = branchId;
      }

      if (delegateId) {
        where.representativeId = delegateId;
      }

      if (sellerId) {
        where.sellerId = sellerId;
      }

      if (costCenterId) {
        where.costCenterId = costCenterId;
      }

      if (currencyId) {
        const currency = await prisma.currency.findFirst({
          where: { companyId, OR: [{ id: currencyId }, { code: currencyId }] },
          select: { code: true },
        });
        where.currencyCode = currency?.code ?? currencyId;
      }

      if (profileId) {
        where.documentProfileId = profileId;
      }

      if (itemId) {
        where.lines = { some: { itemId } };
      }

      if (unpaidOnly) {
        where.remainingAmount = { gt: 0 };
      }

      if (fromInvoice || toInvoice) {
        where.invoiceNumber = {
          ...(fromInvoice ? { gte: String(fromInvoice) } : {}),
          ...(toInvoice ? { lte: String(toInvoice) } : {}),
        };
      }

      const skip = (page - 1) * limit;
      const orderBy =
        sortBy === 'invoice-number' ? [{ invoiceNumber: 'asc' as const }] : [{ date: 'desc' as const }];

      applyReportUser(where, filters);
      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            customer: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            warehouse: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            delegate: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            lines: {
              include: {
                item: {
                  select: {
                    id: true,
                    serial: true,
                    arabicName: true,
                  },
                },
              },
            },
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      const totalReturns = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

      return {
        data: invoices,
        summary: {
          totalReturns,
          totalInvoices: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating sales returns report');
      throw error;
    }
  }

  /**
   * Get Purchase Returns Reports
   */
  async getPurchaseReturnsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, warehouseId, supplierId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        ...postedUnlessRequested(filters),
        isCancelled: false,
        ...invoiceFamilyWhere(['PURCHASE_RETURN']),
      };

      if (warehouseId) {
        where.warehouseId = warehouseId;
      }

      applySupplierGroupWhere(where, filters);

      const skip = (page - 1) * limit;

      applyReportUser(where, filters);
      const [purchaseReturns, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'desc' }],
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            warehouse: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            adjustments: {
              select: { type: true, amount: true },
            },
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      const totalReturns = purchaseReturns.reduce(
        (sum, pr) => sum + Number(pr.totalAmount || 0),
        0
      );
      const data = purchaseReturns.map((invoice) => {
        const tax = Number(invoice.taxAmount || 0);
        const net = Number(invoice.netAmount || 0);
        const discount = Number(invoice.discountAmount || 0);
        const developmentFee = Number(invoice.developmentFeeAmount || 0);
        const adjustmentNet = (invoice.adjustments ?? []).reduce((sum, row) => {
          const amount = Number(row.amount || 0);
          return sum + (row.type === 'ADDITION' ? amount : -amount);
        }, 0);
        return {
          ...invoice,
          amountBeforeTax: net ? net - tax : Number(invoice.totalAmount || 0) - discount,
          discountsAndAdditions: adjustmentNet + developmentFee - discount,
        };
      });

      return {
        data,
        summary: {
          totalReturns,
          totalInvoices: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating purchase returns report');
      throw error;
    }
  }

  private async listStockBalanceAsOf(
    filters: InventoryReportFilters,
    options: InventoryReportOptions,
    opts: { activeItemsOnly?: boolean } = {}
  ): Promise<InventoryReportResult> {
    const { companyId, warehouseId, itemId, toDate } = filters;
    const { page = 1, limit = 1000 } = options;
    const groups = await prisma.inventoryMovement.groupBy({
      by: ['itemId', 'warehouseId'],
      where: {
        companyId,
        documentDate: { lte: toDate },
        ...(warehouseId ? { warehouseId } : {}),
        ...(itemId ? { itemId } : {}),
      },
      _sum: { quantityDelta: true },
    });
    const itemIds = [...new Set(groups.map((row) => row.itemId))];
    const warehouseIds = [...new Set(groups.map((row) => row.warehouseId))];
    const [items, warehouses] = await Promise.all([
      prisma.item.findMany({
        where: { id: { in: itemIds }, ...(opts.activeItemsOnly ? { isActive: true } : {}) },
        select: { id: true, serial: true, arabicName: true, barcode: true, orderLimit: true, lowerLimit: true, averageCost: true },
      }),
      prisma.warehouse.findMany({
        where: { id: { in: warehouseIds } },
        select: { id: true, arabicName: true },
      }),
    ]);
    const itemById = new Map(items.map((row) => [row.id, row]));
    const warehouseById = new Map(warehouses.map((row) => [row.id, row]));
    const balanceRows = itemIds.length
      ? await prisma.itemWarehouseBalance.findMany({
          where: {
            companyId,
            itemId: { in: itemIds },
            warehouseId: { in: warehouseIds },
          },
          select: { itemId: true, warehouseId: true, reservedQuantity: true },
        })
      : [];
    const reservedByItemWarehouse = new Map(
      balanceRows.map((row) => [`${row.itemId}\0${row.warehouseId}`, n(row.reservedQuantity)])
    );
    const data = groups
      .filter((row) => itemById.has(row.itemId))
      .map((row) => {
        const item = itemById.get(row.itemId)!;
        const qty = n(row._sum.quantityDelta);
        const reserved = reservedByItemWarehouse.get(`${row.itemId}\0${row.warehouseId}`) ?? 0;
        const cost = n(item.averageCost);
        return {
          itemId: row.itemId,
          warehouseId: row.warehouseId,
          itemSerial: item.serial ?? '',
          itemName: item.arabicName ?? '',
          barcode: item.barcode ?? '',
          warehouseName: warehouseById.get(row.warehouseId)?.arabicName ?? '',
          quantityOnHand: qty,
          reservedQuantity: reserved,
          availableQty: qty - reserved,
          averageCost: cost,
          stockValue: qty * cost,
          orderLimit: n(item.orderLimit),
          lowerLimit: n(item.lowerLimit),
          asOfDate: toDate,
        };
      });
    if (filters.showUnposted) {
      await addUnpostedStockQty(
        companyId,
        data,
        { showUnposted: true, toDate },
        (row, quantity) => {
          row.quantityOnHand = quantity;
          row.availableQty = quantity;
          row.stockValue = quantity * row.averageCost;
        },
        (row) => row.quantityOnHand
      );
    }
    const pageRows = data.slice((page - 1) * limit, page * limit);
    return {
      data: pageRows,
      summary: {
        totalItems: data.length,
        totalQuantity: data.reduce((sum, row) => sum + row.quantityOnHand, 0),
        totalValue: data.reduce((sum, row) => sum + row.stockValue, 0),
        asOfDate: toDate,
      },
      pagination: { page, limit, total: data.length, totalPages: Math.ceil(data.length / limit) },
    };
  }

  /**
   * جرد الأصناف — live stock from ItemWarehouseBalance (ItemQuantity is location-only leftover).
   */
  private async listStockBalanceRows(
    filters: InventoryReportFilters,
    options: InventoryReportOptions,
    opts: { activeItemsOnly?: boolean } = {}
  ): Promise<InventoryReportResult> {
    const { companyId, warehouseId, itemId, toDate } = filters;
    const { page = 1, limit = 1000 } = options;
    const skip = (page - 1) * limit;
    if (toDate && !usesLiveWarehouseBalances(toDate)) {
      return this.listStockBalanceAsOf(filters, options, opts);
    }

    const balanceWhere: Record<string, unknown> = { companyId };
    if (warehouseId) balanceWhere.warehouseId = warehouseId;
    if (itemId) balanceWhere.itemId = itemId;
    if (opts.activeItemsOnly) balanceWhere.item = { isActive: true };

    const balanceCount = await prisma.itemWarehouseBalance.count({ where: balanceWhere });

    if (balanceCount === 0) {
      return this.listStockBalanceAsOf(filters, options, opts);
    }

    {
      const [rows, total] = await Promise.all([
        prisma.itemWarehouseBalance.findMany({
          where: balanceWhere,
          skip,
          take: limit,
          orderBy: [{ item: { arabicName: 'asc' } }, { warehouse: { arabicName: 'asc' } }],
          include: {
            item: {
              select: {
                ...ITEM_SELECT,
                orderLimit: true,
                lowerLimit: true,
                averageCost: true,
                barcode: true,
              },
            },
            warehouse: { select: WAREHOUSE_SELECT },
          },
        }),
        prisma.itemWarehouseBalance.count({ where: balanceWhere }),
      ]);

      const data = rows.map((row) => {
        const qty = n(row.quantityOnHand);
        const reserved = n(row.reservedQuantity);
        const cost = n(row.averageCost) || n(row.item?.averageCost);
        return {
          itemId: row.itemId,
          warehouseId: row.warehouseId,
          itemSerial: row.item?.serial ?? '',
          itemName: row.item?.arabicName ?? '',
          barcode: row.item?.barcode ?? '',
          warehouseName: row.warehouse?.arabicName ?? '',
          quantityOnHand: qty,
          reservedQuantity: reserved,
          availableQty: qty - reserved,
          averageCost: cost,
          stockValue: qty * cost,
          orderLimit: n(row.item?.orderLimit),
          lowerLimit: n(row.item?.lowerLimit),
        };
      });

      if (filters.showUnposted) {
        await addUnpostedStockQty(
          companyId,
          data,
          { showUnposted: true },
          (row, quantity) => {
            row.quantityOnHand = quantity;
            row.availableQty = quantity - row.reservedQuantity;
            row.stockValue = quantity * row.averageCost;
          },
          (row) => row.quantityOnHand
        );
      }

      return {
        data,
        summary: {
          totalItems: total,
          totalQuantity: data.reduce((sum, row) => sum + row.quantityOnHand, 0),
          totalValue: data.reduce((sum, row) => sum + row.stockValue, 0),
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  }

  /**
   * Get Inventory Reports (Stock Status)
   */
  async getInventoryReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      return await this.listStockBalanceRows(filters, options, { activeItemsOnly: true });
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating inventory report');
      throw error;
    }
  }

  /**
   * حركة الأصناف — invoice lines (price, party, unit) plus stock documents
   * that are not invoices, with a running balance per item and warehouse.
   * Invoice stock movements are omitted so a posted invoice is not counted twice.
   */
  async getItemMovementReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId } = filters;
      const page = Math.max(1, options.page ?? 1);
      const limit = Math.min(5000, Math.max(1, options.limit ?? 2000));

      if (!fromDate || !toDate) {
        throw new Error('يرجى اختيار تاريخ البداية والنهاية');
      }

      const emptySummary = {
        totalInQty: 0,
        totalInAmount: 0,
        totalOutQty: 0,
        totalOutAmount: 0,
        totalDiscount: 0,
        qtyDifference: 0,
      };
      const empty = {
        data: [],
        summary: emptySummary,
        pagination: { page, limit, total: 0, totalPages: 0 },
      };

      let warehouseIds: string[] | undefined;
      if (filters.warehouseId) {
        const warehouses = await prisma.warehouse.findMany({
          where: { companyId },
          select: { id: true, parentWarehouseId: true },
        });
        warehouseIds = expandTreeIds(
          filters.warehouseId,
          warehouses.map((row) => ({ id: row.id, parentId: row.parentWarehouseId }))
        );
      }

      const itemIds = await resolveReportItemIds(companyId, filters);
      if (itemIds && !itemIds.length) return empty;

      const groupBy = countFlag(filters.showGroups, false)
        ? 'groups'
        : countFlag(filters.showWarehouse, false)
          ? 'warehouse'
          : options.groupBy === 'costCenter'
            ? 'costCenter'
            : 'none';
      const commercialOnly = groupBy === 'costCenter' || Boolean(
        filters.customerId ||
          filters.supplierId ||
          filters.customerCategoryId ||
          filters.supplierCategoryId ||
          filters.delegateId ||
          filters.sellerId ||
          filters.userId ||
          filters.currencyId ||
          filters.fromInvoice ||
          filters.toInvoice ||
          filters.costCenterId
      );

      const where: Record<string, unknown> = {
        companyId,
        date: { gte: fromDate, lte: toDate },
        ...postedUnlessRequested(filters),
        isCancelled: false,
        AND: [invoiceFamilyWhere(['SALE', 'PURCHASE', 'SALE_RETURN', 'PURCHASE_RETURN'])],
      };
      if (filters.branchId) where.branchId = filters.branchId;
      if (filters.delegateId) where.representativeId = filters.delegateId;
      if (filters.sellerId) where.sellerId = filters.sellerId;
      if (filters.fromInvoice || filters.toInvoice) {
        where.invoiceNumber = {
          ...(filters.fromInvoice ? { gte: String(filters.fromInvoice) } : {}),
          ...(filters.toInvoice ? { lte: String(filters.toInvoice) } : {}),
        };
      }
      if (filters.currencyId) {
        const currency = await prisma.currency.findFirst({
          where: { companyId, OR: [{ id: filters.currencyId }, { code: filters.currencyId }] },
          select: { code: true },
        });
        where.currencyCode = currency?.code ?? filters.currencyId;
      }
      if (warehouseIds) {
        (where.AND as unknown[]).push({
          OR: [
            { warehouseId: { in: warehouseIds } },
            { lines: { some: { warehouseId: { in: warehouseIds } } } },
          ],
        });
      }
      applyCustomerGroupWhere(where, filters);
      applySupplierGroupWhere(where, filters);
      applyReportUser(where, filters);

      const invoices = await prisma.invoice.findMany({
          where,
        select: {
          id: true,
          date: true,
          invoiceNumber: true,
          invoiceKind: true,
          invoiceType: true,
          description: true,
          warehouseId: true,
          costCenterId: true,
          customer: { select: { arabicName: true } },
          supplier: { select: { arabicName: true } },
          warehouse: { select: { arabicName: true } },
          delegate: { select: { arabicName: true } },
          costCenter: { select: { arabicName: true } },
          lines: {
            ...(itemIds ? { where: { itemId: { in: itemIds } } } : {}),
            select: {
              itemId: true,
              quantity: true,
              baseQuantity: true,
              price: true,
              total: true,
              discountPercent: true,
              discountAmount: true,
              headerDiscountAllocated: true,
              taxPercent: true,
              taxAmount: true,
              lineNotes: true,
              warehouseId: true,
              costCenterId: true,
              expiryDate: true,
              color: true,
              size: true,
              unit: { select: { arabicName: true } },
              baseUnit: { select: { arabicName: true } },
              warehouse: { select: { arabicName: true } },
              costCenter: { select: { arabicName: true } },
              item: { select: MOVEMENT_ITEM_SELECT },
            },
          },
        },
      });

      const invoiceIds = new Set(invoices.map((invoice) => invoice.id));
      const sourceLines: ItemMovementSourceLine[] = [];

      for (const invoice of invoices) {
        const kind = invoice.invoiceKind === 'PURCHASE_RETURN' || invoice.invoiceType === 'purchaseReturn'
          ? { label: 'مردودات مشتريات', side: 'out' as const, priceKind: 'purchase' as const, sourceType: 'PR' }
          : isSaleReturn(invoice)
            ? { label: 'مردودات مبيعات', side: 'in' as const, priceKind: 'sale' as const, sourceType: 'SR' }
            : isSaleSide(invoice)
              ? { label: 'فاتورة مبيعات', side: 'out' as const, priceKind: 'sale' as const, sourceType: 'SI' }
              : { label: 'فاتورة مشتريات', side: 'in' as const, priceKind: 'purchase' as const, sourceType: 'PI' };
        const partyName = kind.priceKind === 'sale'
          ? invoice.customer?.arabicName || ''
          : invoice.supplier?.arabicName || '';

        for (const line of invoice.lines) {
          const lineWarehouseId = line.warehouseId || invoice.warehouseId || '';
          if (warehouseIds && !warehouseIds.includes(lineWarehouseId)) continue;
          const lineCostCenterId = line.costCenterId || invoice.costCenterId || '';
          if (filters.costCenterId && lineCostCenterId !== filters.costCenterId) continue;

          const commercialQty = Math.abs(n(line.quantity));
          const baseQty = Math.abs(n(line.baseQuantity));
          const qty = baseQty || commercialQty;
          if (!qty) continue;
          const total = Math.abs(n(line.total));
          const converted = baseQty > 0 && commercialQty > 0 && Math.abs(baseQty - commercialQty) > 0.0001;
          const traits = itemTraits(line.item);
          sourceLines.push({
            date: invoice.date,
            sourceLabel: kind.label,
            sourceNumber: invoice.invoiceNumber || '',
            sourceDocumentId: invoice.id,
            sourceType: kind.sourceType,
            itemId: line.itemId,
            itemName: line.item?.arabicName || line.item?.serial || '',
            warehouseId: lineWarehouseId,
            warehouseName: line.warehouse?.arabicName || invoice.warehouse?.arabicName || '',
            partyName,
            description: line.lineNotes || invoice.description || '',
            unitName: converted
              ? line.baseUnit?.arabicName || line.unit?.arabicName || ''
              : line.unit?.arabicName || '',
            side: kind.side,
            quantity: qty,
            price: total ? total / qty : Math.abs(n(line.price)),
            total,
            ...traits,
            color: line.color || line.item?.colorId || '',
            size: line.size || traits.size,
            costCenterId: lineCostCenterId,
            costCenterName: line.costCenter?.arabicName || invoice.costCenter?.arabicName || '',
            discountPercent: n(line.discountPercent),
            discountAmount: n(line.discountAmount) + n(line.headerDiscountAllocated),
            taxPercent: n(line.taxPercent),
            taxAmount: n(line.taxAmount),
            expiryDate: line.expiryDate ? new Date(line.expiryDate).toISOString() : null,
            delegateName: invoice.delegate?.arabicName || '',
            priceKind: kind.priceKind,
            averageCost: 0,
          });
        }
      }

      if (invoiceIds.size) {
        const costRows = await prisma.inventoryMovement.findMany({
          where: { companyId, sourceDocumentId: { in: [...invoiceIds] } },
          select: { sourceDocumentId: true, itemId: true, resultingAverageCost: true },
          orderBy: { effectiveAt: 'asc' },
        });
        const averageBySource = new Map<string, number>();
        for (const row of costRows) {
          const cost = n(row.resultingAverageCost);
          if (row.sourceDocumentId && cost) {
            averageBySource.set(`${row.sourceDocumentId}|${row.itemId}`, cost);
          }
        }
        for (const line of sourceLines) {
          if (line.averageCost || !line.sourceDocumentId) continue;
          const cost = averageBySource.get(`${line.sourceDocumentId}|${line.itemId}`);
          if (cost) line.averageCost = cost;
        }
      }

      if (!commercialOnly) {
        const movementWhere: Record<string, unknown> = {
          companyId,
          documentDate: { gte: fromDate, lte: toDate },
        };
        if (itemIds) movementWhere.itemId = { in: itemIds };
        if (warehouseIds) movementWhere.warehouseId = { in: warehouseIds };
        if (filters.branchId) movementWhere.branchId = filters.branchId;

        const movements = await prisma.inventoryMovement.findMany({
          where: movementWhere,
          select: {
            documentDate: true,
            quantityDelta: true,
            unitCost: true,
            resultingAverageCost: true,
            movementType: true,
            sourceType: true,
            sourceNumber: true,
            sourceDocumentId: true,
            itemId: true,
            warehouseId: true,
            item: {
              select: {
                ...MOVEMENT_ITEM_SELECT,
                units: { select: { isBaseUnit: true, unit: { select: { arabicName: true } } } },
              },
            },
            warehouse: { select: { arabicName: true } },
          },
          orderBy: [{ documentDate: 'asc' }, { effectiveAt: 'asc' }],
        });

        for (const row of movements) {
          if (isInvoiceStockMovement(row.sourceType)) continue;
          if (row.sourceDocumentId && invoiceIds.has(row.sourceDocumentId)) continue;
          const delta = n(row.quantityDelta);
          if (!delta) continue;
          const qty = Math.abs(delta);
          const price = Math.abs(n(row.unitCost));
          const baseUnit = row.item?.units?.find((unit) => unit.isBaseUnit)?.unit?.arabicName
            || row.item?.units?.[0]?.unit?.arabicName
            || '';
          const traits = itemTraits(row.item);
          sourceLines.push({
        date: row.documentDate,
            sourceLabel: movementSourceLabel(row.movementType, row.sourceType),
            sourceNumber: row.sourceNumber || '',
            sourceDocumentId: row.sourceDocumentId || '',
            sourceType: row.sourceType || '',
        itemId: row.itemId,
            itemName: row.item?.arabicName || row.item?.serial || '',
            warehouseId: row.warehouseId,
            warehouseName: row.warehouse?.arabicName || '',
            partyName: '',
            description: '',
            unitName: baseUnit,
            side: delta > 0 ? 'in' : 'out',
            quantity: qty,
            price,
            total: qty * price,
            ...traits,
            color: row.item?.colorId || '',
            costCenterName: '',
            discountPercent: 0,
            discountAmount: 0,
            taxPercent: 0,
            taxAmount: 0,
            expiryDate: null,
            delegateName: '',
            priceKind: 'none',
        averageCost: n(row.resultingAverageCost),
          });
        }

        const openingWhere: Record<string, unknown> = {
          companyId,
          documentDate: { lt: fromDate },
        };
        if (itemIds) openingWhere.itemId = { in: itemIds };
        if (warehouseIds) openingWhere.warehouseId = { in: warehouseIds };
        if (filters.branchId) openingWhere.branchId = filters.branchId;

        const opening = await prisma.inventoryMovement.groupBy({
          by: ['itemId', 'warehouseId'],
          where: openingWhere,
          _sum: { quantityDelta: true },
        });
        const openingRows = opening.filter((row) => n(row._sum.quantityDelta));
        if (openingRows.length) {
          const [openingItems, openingWarehouses] = await Promise.all([
            prisma.item.findMany({
              where: { companyId, id: { in: [...new Set(openingRows.map((row) => row.itemId))] } },
              select: { id: true, arabicName: true, colorId: true, ...MOVEMENT_ITEM_SELECT },
            }),
            prisma.warehouse.findMany({
              where: { companyId, id: { in: [...new Set(openingRows.map((row) => row.warehouseId))] } },
              select: { id: true, arabicName: true },
            }),
          ]);
          const itemById = new Map(openingItems.map((item) => [item.id, item]));
          const warehouseById = new Map(openingWarehouses.map((warehouse) => [warehouse.id, warehouse]));
          const openingCosts = await averageCostBefore(
            companyId,
            [...new Set(openingRows.map((row) => row.itemId))],
            fromDate
          );
          for (const row of openingRows) {
            const item = itemById.get(row.itemId);
            const quantity = n(row._sum.quantityDelta);
            const averageCost = openingCosts.get(row.itemId) ?? 0;
            const traits = itemTraits(item);
            sourceLines.push({
              date: fromDate,
              sourceLabel: 'بضاعة أول المدة',
              sourceNumber: '',
              sourceDocumentId: '',
              sourceType: '',
              itemId: row.itemId,
              itemName: item?.arabicName || item?.serial || '',
              warehouseId: row.warehouseId,
              warehouseName: warehouseById.get(row.warehouseId)?.arabicName || '',
              partyName: '',
              description: '',
              unitName: '',
              side: 'opening',
              quantity,
              price: averageCost,
              total: quantity * averageCost,
              ...traits,
              color: item?.colorId || '',
              costCenterName: '',
              discountPercent: 0,
              discountAmount: 0,
              taxPercent: 0,
              taxAmount: 0,
              expiryDate: null,
              delegateName: '',
              priceKind: 'none',
              averageCost,
            });
          }
        }
      }

      const built = buildItemMovementSheet(sourceLines, { groupBy });
      const total = built.rows.length;
      const skip = (page - 1) * limit;
      const pageRows = built.rows.slice(skip, skip + limit);
      return {
        data: pageRows,
        summary: {
          ...built.summary,
          ...(total > pageRows.length ? { omittedRows: total - pageRows.length } : {}),
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 0,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating item movement report');
      throw error;
    }
  }

  /**
   * Customer balances for the selected period.
   * Posted sales and posted receipt vouchers both count, including a
   * customer whose invoice was fully settled and therefore has no open remainder.
   */
  async getCustomerBalancesReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, customerId } = filters;
      const { page = 1, limit = 5000 } = options;
      const toDate = filters.asOfDate ?? filters.toDate ?? new Date();
      return await loadCustomerBalancesReport({
        companyId,
        customerId,
        customerCategoryId: filters.customerCategoryId,
        branchId: filters.branchId,
        costCenterId: filters.costCenterId,
        currencyId: filters.currencyId,
        fromDate: filters.fromDate,
        toDate,
        allAccounts: Boolean(filters.allAccounts),
          page,
          limit,
      });
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating customer balances report');
      throw error;
    }
  }

  /**
   * Get Suppliers Balances Report (from inventory perspective).
   *
   * M16 fix (N+1): same fix as `getCustomerBalancesReport` above, mirrored
   * for payables via `agedOpenItemsService.getAgedPayables`.
   */
  async getSuppliersBalancesReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, supplierId, asOfDate } = filters;
      const { page = 1, limit = 100 } = options;
      // Same as customer balances: aged open items only.

      const report = await agedOpenItemsService.getAgedPayables({
        companyId,
        supplierId,
        supplierCategoryId: filters.supplierCategoryId,
        asOfDate: asOfDate ?? new Date(),
      });

      const supplierBalances = report.parties.map((party) => ({
        supplier: {
          id: party.partyId,
          code: party.partyCode,
          arabicName: party.partyName,
        },
        totalPurchases: roundTo4(party.invoices.reduce((sum, i) => sum + i.netAmount, 0)),
        totalPayments: roundTo4(party.invoices.reduce((sum, i) => sum + i.paidAmount, 0)),
        balance: roundTo4(party.total),
      }));

      const total = supplierBalances.length;
      const skip = (page - 1) * limit;
      const pageData = supplierBalances.slice(skip, skip + limit);

      return {
        data: pageData,
        summary: {
          totalSuppliers: total,
          totalBalances: roundTo4(report.grandTotal),
          controlAccountTieOut: report.controlAccountTieOut,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating suppliers balances report');
      throw error;
    }
  }

  private isCurrentAsOf(asOfDate?: Date): boolean {
    if (!asOfDate) return true;
    const now = new Date();
    return (
      asOfDate.getUTCFullYear() === now.getUTCFullYear() &&
      asOfDate.getUTCMonth() === now.getUTCMonth() &&
      asOfDate.getUTCDate() === now.getUTCDate()
    );
  }

  /**
   * Current running totals from `partner_running_balances`. Historical
   * as-of dates and an empty summary table fall back to aged open items.
   */
  private async tryPartnerRunningBalances(input: {
    companyId: string;
    partnerType: 'CUSTOMER' | 'SUPPLIER';
    partnerId?: string;
    asOfDate?: Date;
    page: number;
    limit: number;
  }) {
    if (!this.isCurrentAsOf(input.asOfDate)) return null;

    const summaryCount = await prisma.partnerRunningBalance.count({
      where: {
        companyId: input.companyId,
        partnerType: input.partnerType,
        ...(input.partnerId ? { partnerId: input.partnerId } : {}),
      },
    });
    if (summaryCount === 0) return null;

    const balances = await prisma.partnerRunningBalance.findMany({
      where: {
        companyId: input.companyId,
        partnerType: input.partnerType,
        ...(input.partnerId ? { partnerId: input.partnerId } : {}),
      },
    });

    const partnerIds = balances.map((b) => b.partnerId);
    const parties =
      input.partnerType === 'CUSTOMER'
        ? await prisma.customer.findMany({
            where: { companyId: input.companyId, id: { in: partnerIds } },
            select: { id: true, code: true, arabicName: true },
          })
        : await prisma.supplier.findMany({
            where: { companyId: input.companyId, id: { in: partnerIds } },
            select: { id: true, code: true, arabicName: true },
          });
    const partyById = new Map(parties.map((p) => [p.id, p]));

    const rows = balances
      .map((b) => {
        const party = partyById.get(b.partnerId);
        if (!party) return null;
        return {
          party: { id: party.id, code: party.code, arabicName: party.arabicName },
          currencyCode: b.currencyCode,
          totalDebitOriginal: roundTo4(Number(b.debitOriginal)),
          totalCreditOriginal: roundTo4(Number(b.creditOriginal)),
          balanceOriginal: roundTo4(Number(b.netOriginal)),
          balanceBase: roundTo4(Number(b.netBase)),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const balancesByCurrency: Record<string, number> = {};
    for (const row of rows) {
      balancesByCurrency[row.currencyCode] = roundTo4(
        (balancesByCurrency[row.currencyCode] ?? 0) + row.balanceOriginal
      );
    }

    const total = rows.length;
    const skip = (input.page - 1) * input.limit;
    return {
      rows: rows.slice(skip, skip + input.limit),
      total,
      balancesByCurrency,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  /**
   * Invoice debt-age sheet: one open document per row, aged to asOfDate.
   * GL bucket aging stays on GET /accounting/reports/aged-receivables.
   */
  async getReceivablesAgingReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const page = options.page ?? 1;
      const limit = Math.min(Math.max(options.limit ?? 2000, 1), 5000);
      const asOf = filters.asOfDate || filters.toDate || new Date();
      const empty = {
        data: [],
        summary: { totalAmount: 0, totalSettled: 0, totalRemaining: 0, totalInvoices: 0 },
        pagination: { page, limit, total: 0, totalPages: 0 },
      };

      const customerSide = Boolean(filters.customerId || filters.customerCategoryId);
      const supplierSide = Boolean(filters.supplierId || filters.supplierCategoryId);
      const kinds: InvoiceKind[] =
        supplierSide && !customerSide
          ? ['PURCHASE', 'PURCHASE_RETURN']
          : customerSide && !supplierSide
            ? ['SALE', 'SALE_RETURN']
            : ['SALE', 'PURCHASE', 'SALE_RETURN', 'PURCHASE_RETURN'];

      const minValue = Number(filters.minValue);
      const where: any = {
        companyId: filters.companyId,
        ...postedUnlessRequested(filters),
        isCancelled: false,
        date: { lte: asOf },
        remainingAmount:
          Number.isFinite(minValue) && minValue > 0 ? { gte: minValue } : { gt: 0 },
        ...invoiceFamilyWhere(kinds),
      };
      if (filters.branchId) where.branchId = filters.branchId;
      if (filters.delegateId) where.representativeId = filters.delegateId;
      applyReportUser(where, filters);

      const and: Record<string, unknown>[] = [];
      if (customerSide && supplierSide) {
        const customerWhere: Record<string, unknown> = {};
        const supplierWhere: Record<string, unknown> = {};
        applyCustomerGroupWhere(customerWhere, filters);
        applySupplierGroupWhere(supplierWhere, filters);
        and.push({ OR: [customerWhere, supplierWhere] });
      } else if (customerSide) {
        applyCustomerGroupWhere(where, filters);
      } else if (supplierSide) {
        applySupplierGroupWhere(where, filters);
      }
      if (filters.currencyId) {
        const currency = await prisma.currency.findFirst({
          where: {
            companyId: filters.companyId,
            OR: [{ id: filters.currencyId }, { code: filters.currencyId }],
          },
          select: { id: true, code: true },
        });
        const code = currency?.code ?? String(filters.currencyId);
        and.push({
          OR: [
            { currencyCode: code },
            ...(currency?.id ? [{ currencyId: currency.id }] : []),
          ],
        });
      }
      if (filters.costCenterId) {
        const centers = await prisma.costCenter.findMany({
          where: { companyId: filters.companyId },
          select: { id: true, parentId: true },
        });
        const costCenterIds = expandTreeIds(
          String(filters.costCenterId),
          centers.map((row) => ({ id: row.id, parentId: row.parentId }))
        );
        and.push({
          OR: [
            { costCenterId: { in: costCenterIds } },
            { lines: { some: { costCenterId: { in: costCenterIds } } } },
          ],
        });
      }
      if (filters.warehouseId) {
        const warehouses = await prisma.warehouse.findMany({
          where: { companyId: filters.companyId },
          select: { id: true, parentWarehouseId: true },
        });
        const warehouseIds = expandTreeIds(
          filters.warehouseId,
          warehouses.map((row) => ({ id: row.id, parentId: row.parentWarehouseId }))
        );
        and.push({
          OR: [
            { warehouseId: { in: warehouseIds } },
            { lines: { some: { warehouseId: { in: warehouseIds } } } },
          ],
        });
      }
      if (filters.itemId || filters.itemGroupId) {
        let categoryIds: string[] | undefined;
        if (filters.itemGroupId) {
          const categories = await prisma.itemCategory.findMany({
            where: { companyId: filters.companyId },
            select: { id: true, parentCategoryId: true },
          });
          categoryIds = expandTreeIds(
            String(filters.itemGroupId),
            categories.map((row) => ({ id: row.id, parentId: row.parentCategoryId }))
          );
        }
        const items = await prisma.item.findMany({
          where: {
            companyId: filters.companyId,
            ...(filters.itemId ? { id: filters.itemId } : {}),
            ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
          },
          select: { id: true },
        });
        const itemIds = items.map((row) => row.id);
        if (!itemIds.length) return empty;
        and.push({ lines: { some: { itemId: { in: itemIds } } } });
      }
      if (and.length) where.AND = and;

      const invoices = await prisma.invoice.findMany({
        where,
        take: 5000,
        orderBy: [{ date: 'asc' }, { invoiceNumber: 'asc' }],
        select: {
          id: true,
          invoiceNumber: true,
          date: true,
          netAmount: true,
          paidAmount: true,
          remainingAmount: true,
          invoiceKind: true,
          invoiceType: true,
          documentProfile: { select: { nameAr: true } },
          customer: { select: { arabicName: true } },
          supplier: { select: { arabicName: true } },
          installments: { select: { paymentDate: true, paidAmount: true } },
        },
      });

      const invoiceIds = invoices.map((invoice) => invoice.id);
      const lastPayment = new Map<string, Date>();
      const consider = (invoiceId: string | null | undefined, date: Date | null | undefined) => {
        if (!invoiceId || !date || date.getTime() > asOf.getTime()) return;
        const previous = lastPayment.get(invoiceId);
        if (!previous || date.getTime() > previous.getTime()) lastPayment.set(invoiceId, date);
      };
      if (invoiceIds.length) {
        const [settlements, allocations] = await Promise.all([
          prisma.cashTransaction.findMany({
            where: {
              companyId: filters.companyId,
              invoiceId: { in: invoiceIds },
              isPosted: true,
              isCancelled: false,
              date: { lte: asOf },
            },
            select: { invoiceId: true, date: true },
          }),
          prisma.paymentAllocation.findMany({
            where: {
              companyId: filters.companyId,
              invoiceId: { in: invoiceIds },
              cashTransaction: { isPosted: true, isCancelled: false, date: { lte: asOf } },
            },
            select: { invoiceId: true, cashTransaction: { select: { date: true } } },
          }),
        ]);
        for (const settlement of settlements) consider(settlement.invoiceId, settlement.date);
        for (const allocation of allocations) {
          consider(allocation.invoiceId, allocation.cashTransaction?.date);
        }
      }

      const sources: DebtAgeInvoice[] = invoices.map((invoice) => {
        for (const installment of invoice.installments) {
          if (n(installment.paidAmount) > 0) consider(invoice.id, installment.paymentDate);
        }
        const paid = n(invoice.paidAmount);
      return {
          invoiceId: invoice.id,
          invoiceDate: invoice.date,
          invoiceNumber: invoice.invoiceNumber,
          profileName: invoice.documentProfile?.nameAr ?? null,
          invoiceKind: invoice.invoiceKind,
          invoiceType: invoice.invoiceType,
          partyName: invoice.customer?.arabicName || invoice.supplier?.arabicName || '',
          invoiceTotal: n(invoice.netAmount),
          paidAmount: paid,
          remainingAmount: n(invoice.remainingAmount),
          lastPaymentDate: paid > 0 ? lastPayment.get(invoice.id) ?? null : null,
        };
      });

      const built = buildDebtAgeSheet(sources, asOf, {
        ageFromInvoice: {
          from: parseAgeBound(filters.ageFromInvoiceFrom),
          to: parseAgeBound(filters.ageFromInvoiceTo),
        },
        ageFromLastPayment: {
          from: parseAgeBound(filters.ageFromLastPaymentFrom),
          to: parseAgeBound(filters.ageFromLastPaymentTo),
        },
      });
      const total = built.rows.length;
      const start = (page - 1) * limit;
      return {
        data: built.rows.slice(start, start + limit),
        summary: built.summary,
        pagination: {
          page,
          limit,
          total,
          totalPages: total ? Math.ceil(total / limit) : 0,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating receivables aging report');
      throw error;
    }
  }

  /**
   * Get Stock Profit Reports
   */
  async getStockProfitReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, itemId, warehouseId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      let currencyCode = '';
      if (filters.currencyId) {
        const currency = await prisma.currency.findFirst({
          where: { companyId, OR: [{ id: filters.currencyId }, { code: filters.currencyId }] },
          select: { code: true },
        });
        currencyCode = currency?.code || String(filters.currencyId);
      }

      let lineItemIds: string[] | undefined;
      if (itemId || filters.itemGroupId) {
        let categoryIds: string[] | undefined;
        if (filters.itemGroupId) {
          const categories = await prisma.itemCategory.findMany({
            where: { companyId },
            select: { id: true, parentCategoryId: true },
          });
          categoryIds = expandTreeIds(
            String(filters.itemGroupId),
            categories.map((row) => ({ id: row.id, parentId: row.parentCategoryId }))
          );
        }
        if (itemId && !categoryIds) {
          lineItemIds = [itemId];
        } else {
          const items = await prisma.item.findMany({
            where: {
              companyId,
              ...(itemId ? { id: itemId } : {}),
              ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
            },
            select: { id: true },
          });
          lineItemIds = items.map((row) => row.id);
        }
      }

      const salesWhere: any = {
        companyId,
        ...invoiceFamilyWhere(['SALE', 'SALE_RETURN']),
        date: {
          gte: fromDate,
          lte: toDate,
        },
        ...postedUnlessRequested(filters),
        isCancelled: false,
      };
      applyCustomerGroupWhere(salesWhere, filters);
      applyReportUser(salesWhere, filters);
      if (warehouseId) salesWhere.warehouseId = warehouseId;
      if (filters.branchId) salesWhere.branchId = filters.branchId;
      if (filters.delegateId) salesWhere.representativeId = filters.delegateId;
      if (filters.costCenterId) salesWhere.costCenterId = filters.costCenterId;
      if (currencyCode) salesWhere.currencyCode = currencyCode;
      const numberRange = invoiceNumberRange(filters.fromInvoice, filters.toInvoice);
      if (numberRange) {
        const matched = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM invoices
          WHERE companyId = ${companyId}
            AND invoiceNumber IS NOT NULL
            AND (
              invoiceKind IN ('SALE', 'SALE_RETURN')
              OR invoiceType IN ('sales', 'salesReturn', 'return')
            )
            AND CAST(REGEXP_SUBSTR(invoiceNumber, '[0-9]+$') AS UNSIGNED) BETWEEN ${numberRange.start} AND ${numberRange.end}
        `;
        salesWhere.id = {
          in: matched.length ? matched.map((row) => row.id) : ['00000000-0000-0000-0000-000000000000'],
        };
      } else if (filters.fromInvoice?.trim() || filters.toInvoice?.trim()) {
        salesWhere.invoiceNumber = { contains: (filters.fromInvoice || filters.toInvoice || '').trim() };
      }

      if (lineItemIds && lineItemIds.length === 0) {
        return {
          data: [],
          summary: { totalQuantity: 0, totalSales: 0, totalCost: 0, totalProfit: 0 },
          pagination: { page, limit, total: 0, totalPages: 1 },
        };
      }

      const salesInvoices = await prisma.invoice.findMany({
        where: salesWhere,
        include: {
          lines: {
            include: {
              unit: { select: { arabicName: true } },
              item: {
                select: {
                  id: true,
                  serial: true,
                  arabicName: true,
                  averageCost: true,
                  lastPurchasePrice: true,
                  beginningCostPrice: true,
                  units: {
                    where: { isBaseUnit: true },
                    take: 1,
                    select: { unit: { select: { arabicName: true } } },
                  },
                },
              },
            },
            ...(lineItemIds ? { where: { itemId: { in: lineItemIds } } } : {}),
          },
        },
      });

      // Calculate profit per item
      const itemProfits = new Map<string, any>();

      salesInvoices.forEach((invoice) => {
        const sign = invoice.invoiceKind === 'SALE_RETURN' ? -1 : 1;
        invoice.lines.forEach((line) => {
          const itemId = line.itemId;
          const quantity = sign * Number(line.quantity);
          const saleTotal = sign * Number(line.total);

          const costPrice = lineUnitCost(line);
          const costTotal = sign * Math.abs(quantity) * costPrice;
          const profit = saleTotal - costTotal;

          if (!itemProfits.has(itemId)) {
            const baseUnit = line.item.units?.find((unit) => unit.unit?.arabicName)?.unit?.arabicName;
            itemProfits.set(itemId, {
              item: {
                id: line.item.id,
                serial: line.item.serial,
                arabicName: line.item.arabicName,
              },
              unitName: baseUnit || line.unit?.arabicName || '',
              quantity: 0,
              totalSales: 0,
              totalCost: 0,
              totalProfit: 0,
            });
          }

          const itemProfit = itemProfits.get(itemId)!;
          itemProfit.quantity += quantity;
          itemProfit.totalSales += saleTotal;
          itemProfit.totalCost += costTotal;
          itemProfit.totalProfit += profit;
        });
      });

      const profitRows = Array.from(itemProfits.values());
      const overallProfit = profitRows.reduce((sum, row) => sum + row.totalProfit, 0);
      const profitData = profitRows.map((row) => ({
        itemId: row.item?.id ?? '',
        itemSerial: row.item?.serial ?? '',
        itemName: row.item?.arabicName ?? '',
        unitName: row.unitName || '',
        quantity: row.quantity,
        totalSales: row.totalSales,
        totalCost: row.totalCost,
        totalProfit: row.totalProfit,
        ...itemProfitRatios(row, overallProfit),
      }));

      const sortedData = profitData
        .sort((a, b) => b.totalProfit - a.totalProfit)
        .slice((page - 1) * limit, page * limit);

      return {
        data: sortedData,
        summary: {
          totalQuantity: roundTo4(profitData.reduce((sum, item) => sum + item.quantity, 0)),
          totalSales: profitData.reduce((sum, item) => sum + item.totalSales, 0),
          totalCost: profitData.reduce((sum, item) => sum + item.totalCost, 0),
          totalProfit: profitData.reduce((sum, item) => sum + item.totalProfit, 0),
        },
        pagination: {
          page,
          limit,
          total: profitData.length,
          totalPages: Math.ceil(profitData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating stock profit report');
      throw error;
    }
  }

  /**
   * أرباح المخزون — كمية المخزون حتى تاريخ × (سعر البيع المختار − التكلفة).
   */
  async getInventoryValuationProfitReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, itemId, warehouseId, toDate } = filters;
      const page = Math.max(1, options.page ?? 1);
      const limit = options.limit ?? 5000;
      if (!toDate) throw new Error('يرجى اختيار التاريخ');

      const flag = (value: unknown, fallback: boolean) => {
        if (value === true || value === 'true' || value === '1') return true;
        if (value === false || value === 'false' || value === '0') return false;
        return fallback;
      };

      let categoryIds: string[] | undefined;
      const itemGroupId = filters.itemGroupId || filters.categoryId;
      if (itemGroupId) {
        const categories = await prisma.itemCategory.findMany({
          where: { companyId },
          select: { id: true, parentCategoryId: true },
        });
        categoryIds = expandTreeIds(
          String(itemGroupId),
          categories.map((row) => ({ id: row.id, parentId: row.parentCategoryId }))
        );
      }

      const itemWhere: Record<string, unknown> = {
        companyId,
        isService: false,
        ...inventoryCountItemWhere(filters),
      };
      if (itemId) itemWhere.id = itemId;
      if (categoryIds) itemWhere.categoryId = { in: categoryIds };

      if (categoryIds && categoryIds.length === 0) {
        return {
          data: [],
          summary: { totalQuantity: 0, saleValue: 0, costValue: 0, totalProfit: 0 },
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
      }

      const items = await prisma.item.findMany({
        where: itemWhere,
        select: {
          id: true,
          serial: true,
          arabicName: true,
          priceWholesale: true,
          priceSemiWholesale: true,
          exportPrice: true,
          representativePrice: true,
          priceRetail: true,
          retailPrice: true,
          consumerPrice: true,
          averageCost: true,
          category: { select: { arabicName: true } },
          units: {
            select: {
              conversionFactor: true,
              isBaseUnit: true,
              unitId: true,
              unit: { select: { arabicName: true } },
            },
          },
        },
      });

      const salePriceSource = String(filters.salePriceSource || 'item_card');
      const listPrices = new Map<string, number>();
      let priceListFound = false;
      if (salePriceSource !== 'item_card' && items.length) {
        const list = await prisma.priceList.findFirst({
          where: { id: salePriceSource, companyId },
          select: { id: true },
        });
        if (list) {
          priceListFound = true;
          const prices = await prisma.itemPrice.findMany({
            where: {
              priceListId: list.id,
              itemId: { in: items.map((row) => row.id) },
              item: { companyId },
            },
            select: { itemId: true, unitId: true, price: true, retailPrice: true },
          });
          const baseUnitByItem = new Map(
            items.map((row) => [row.id, row.units.find((unit) => unit.isBaseUnit)?.unitId ?? row.units[0]?.unitId])
          );
          const grouped = new Map<string, typeof prices>();
          for (const price of prices) {
            const bucket = grouped.get(price.itemId) ?? [];
            bucket.push(price);
            grouped.set(price.itemId, bucket);
          }
          for (const [itemId, rows] of grouped) {
            const baseUnitId = baseUnitByItem.get(itemId);
            const match = rows.find((row) => row.unitId === baseUnitId) ?? rows[0];
            if (!match) continue;
            listPrices.set(itemId, n(match.price) || n(match.retailPrice));
          }
        }
      }

      const stockItems: StockProfitItem[] = items.map((row) => ({
        id: row.id,
        serial: row.serial ?? '',
        arabicName: row.arabicName ?? '',
        groupName: row.category?.arabicName ?? '',
        priceWholesale: n(row.priceWholesale),
        priceSemiWholesale: n(row.priceSemiWholesale),
        exportPrice: n(row.exportPrice),
        representativePrice: n(row.representativePrice),
        priceRetail: n(row.priceRetail),
        retailPrice: n(row.retailPrice),
        consumerPrice: n(row.consumerPrice),
        averageCost: n(row.averageCost),
        salePrice: priceListFound
          ? (listPrices.get(row.id) ?? 0)
          : n(row.priceRetail) || n(row.retailPrice),
        units: (row.units ?? []).map((unit) => ({
          conversionFactor: n(unit.conversionFactor) || 1,
          isBaseUnit: Boolean(unit.isBaseUnit),
          arabicName: unit.unit?.arabicName ?? '',
        })),
      }));

      const itemIds = stockItems.map((row) => row.id);
      let balances: Array<{
        itemId: string;
        warehouseId: string;
        warehouseName: string;
        quantity: number;
        averageCost: number;
      }> = [];

      if (itemIds.length) {
        const useLive = toDate.getTime() >= Date.now() || this.isCurrentAsOf(toDate);
        if (useLive) {
          const rows = await prisma.itemWarehouseBalance.findMany({
            where: {
              companyId,
              itemId: { in: itemIds },
              ...(warehouseId ? { warehouseId } : {}),
            },
            select: {
              itemId: true,
              warehouseId: true,
              quantityOnHand: true,
              averageCost: true,
              warehouse: { select: { arabicName: true } },
            },
          });
          balances = rows.map((row) => ({
            itemId: row.itemId,
            warehouseId: row.warehouseId,
            warehouseName: row.warehouse?.arabicName ?? '',
            quantity: n(row.quantityOnHand),
            averageCost: n(row.averageCost),
          }));
        } else {
          const groups = await prisma.inventoryMovement.groupBy({
            by: ['itemId', 'warehouseId'],
            where: {
              companyId,
              documentDate: { lte: toDate },
              itemId: { in: itemIds },
              ...(warehouseId ? { warehouseId } : {}),
            },
            _sum: { quantityDelta: true },
          });
          const warehouseIds = [...new Set(groups.map((row) => row.warehouseId))];
          const warehouses = warehouseIds.length
            ? await prisma.warehouse.findMany({
                where: { id: { in: warehouseIds } },
                select: { id: true, arabicName: true },
              })
            : [];
          const warehouseName = new Map(warehouses.map((row) => [row.id, row.arabicName]));
          balances = groups.map((row) => ({
            itemId: row.itemId,
            warehouseId: row.warehouseId,
            warehouseName: warehouseName.get(row.warehouseId) ?? '',
            quantity: n(row._sum.quantityDelta),
            averageCost: 0,
          }));
        }
        if (filters.showUnposted && balances.length) {
          await addUnpostedStockQty(
            companyId,
            balances,
            { showUnposted: true, toDate: useLive ? undefined : toDate },
            (row, quantity) => {
              row.quantity = quantity;
            },
            (row) => row.quantity
          );
        }
      }

      let exchangeRate = 1;
      if (filters.currencyId) {
        const currency = await prisma.currency.findFirst({
          where: { companyId, OR: [{ id: String(filters.currencyId) }, { code: String(filters.currencyId) }] },
          select: { code: true },
        });
        const fx = await resolveCompanyFxRate(companyId, currency?.code || String(filters.currencyId));
        exchangeRate = fx.exchangeRate || 1;
      }

      const otherUnitIndex = Number.parseInt(String(filters.otherUnit ?? '2'), 10);
      const built = buildStockValuationProfit(stockItems, balances, {
        priceTier: String(filters.priceTier || 'wholesale'),
        otherUnitIndex: Number.isFinite(otherUnitIndex) ? otherUnitIndex : 2,
        showEmpty: flag(filters.showEmpty, false),
        showWarehouse: flag(filters.showWarehouse, false),
        showGroups: flag(filters.showGroups, false),
        negativeOnly: flag(filters.negativeOnly, false),
        nonNegativeOnly: flag(filters.nonNegativeOnly, false),
        exchangeRate,
      });

      const painted = paintReportLayout(built.rows, filters);
      const total = painted.length;
      const start = (page - 1) * limit;
      return {
        data: painted.slice(start, start + limit),
        summary: built.summary,
        pagination: { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating inventory valuation profit report');
      throw error;
    }
  }

  /**
   * جرد الأصناف — warehouse subtree, item properties, units, and company-wide balance.
   */
  private async summarizeInventoryCountBalances(
    balanceWhere: Record<string, unknown>,
    exchangeRate: number
  ) {
    const rows = await prisma.itemWarehouseBalance.findMany({
      where: balanceWhere,
      select: {
        quantityOnHand: true,
        reservedQuantity: true,
        averageCost: true,
        item: { select: { averageCost: true } },
      },
    });
    const rate = exchangeRate > 0 ? exchangeRate : 1;
    let quantityOnHand = 0;
    let reservedQuantity = 0;
    let stockValue = 0;
    for (const row of rows) {
      const qty = n(row.quantityOnHand);
      const res = n(row.reservedQuantity);
      const cost = (n(row.averageCost) || n(row.item.averageCost)) / rate;
      quantityOnHand += qty;
      reservedQuantity += res;
      stockValue += qty * cost;
    }
    const columnTotals = {
      quantityOnHand: Math.round(quantityOnHand * 10_000) / 10_000,
      reservedQuantity: Math.round(reservedQuantity * 10_000) / 10_000,
      availableQty: Math.round((quantityOnHand - reservedQuantity) * 10_000) / 10_000,
      stockValue: Math.round(stockValue * 10_000) / 10_000,
    };
    return {
      totalQuantity: columnTotals.quantityOnHand,
      totalValue: columnTotals.stockValue,
      columnTotals,
    };
  }

  private async listInventoryCount(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    const companyId = filters.companyId;
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(1000, Math.max(1, options.limit ?? 1000));
    const skip = (page - 1) * limit;
    const historical = Boolean(filters.toDate) && !usesLiveWarehouseBalances(filters.toDate);
    const showEmpty = countFlag(filters.showEmpty, false);
    const hideEmpty = filters.showEmpty != null && String(filters.showEmpty) !== '' && !showEmpty;
    const showWarehouse = countFlag(filters.showWarehouse, false);
    const showGroups = countFlag(filters.showGroups, false);
    const qtyFlags = {
      hideEmpty,
      negativeOnly: countFlag(filters.negativeOnly, false),
      nonNegativeOnly: countFlag(filters.nonNegativeOnly, false),
    };
    const otherUnitIndex = Number.parseInt(String(filters.otherUnit ?? '2'), 10) || 2;
    const empty = {
      data: [],
      summary: { totalItems: 0, totalQuantity: 0, totalValue: 0 },
      pagination: { page, limit, total: 0, totalPages: 0 },
    };

    let warehouseIds: string[] | undefined;
    if (filters.warehouseId) {
      const warehouses = await prisma.warehouse.findMany({
        where: { companyId },
        select: { id: true, parentWarehouseId: true },
      });
      warehouseIds = expandTreeIds(
        String(filters.warehouseId),
        warehouses.map((row) => ({ id: row.id, parentId: row.parentWarehouseId }))
      );
      if (!warehouseIds.length) return empty;
    }

    let categoryIds: string[] | undefined;
    const itemGroupId = filters.itemGroupId || filters.categoryId;
    if (itemGroupId) {
      const categories = await prisma.itemCategory.findMany({
        where: { companyId },
        select: { id: true, parentCategoryId: true },
      });
      categoryIds = expandTreeIds(
        String(itemGroupId),
        categories.map((row) => ({ id: row.id, parentId: row.parentCategoryId }))
      );
      if (!categoryIds.length) return empty;
    }

    const itemWhere: Record<string, unknown> = {
      companyId,
      ...(filters.itemId ? { id: String(filters.itemId) } : {}),
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      ...inventoryCountItemWhere(filters),
    };

    let exchangeRate = 1;
    if (filters.currencyId) {
      const currency = await prisma.currency.findFirst({
        where: {
          companyId,
          OR: [{ id: String(filters.currencyId) }, { code: String(filters.currencyId) }],
        },
        select: { code: true },
      });
      const fx = await resolveCompanyFxRate(companyId, currency?.code || String(filters.currencyId));
      exchangeRate = fx.exchangeRate || 1;
    }

    const itemSelect = {
      id: true,
      serial: true,
      arabicName: true,
      barcode: true,
      orderLimit: true,
      lowerLimit: true,
      upperLimit: true,
      averageCost: true,
      defaultTaxPercent: true,
      isAssembly: true,
      isService: true,
      manufacturerId: true,
      colorId: true,
      countryOfOrigin: true,
      quality: true,
      size: true,
      property1: true,
      property2: true,
      property3: true,
      property4: true,
      property5: true,
      priceWholesale: true,
      category: { select: { arabicName: true } },
      units: {
        select: {
          conversionFactor: true,
          isBaseUnit: true,
          unit: { select: { arabicName: true } },
        },
      },
    };

    const asItem = (row: any): CountItemFields => ({
      serial: row?.serial ?? '',
      arabicName: row?.arabicName ?? '',
      barcode: row?.barcode ?? '',
      groupName: row?.category?.arabicName ?? '',
      orderLimit: n(row?.orderLimit),
      lowerLimit: n(row?.lowerLimit),
      upperLimit: n(row?.upperLimit),
      salesTaxPercent: n(row?.defaultTaxPercent),
      isAssembly: Boolean(row?.isAssembly),
      isService: Boolean(row?.isService),
      manufacturer: row?.manufacturerId ?? '',
      color: row?.colorId ?? '',
      origin: row?.countryOfOrigin ?? '',
      quality: row?.quality ?? '',
      size: row?.size ?? '',
      property1: row?.property1 ?? '',
      property2: row?.property2 ?? '',
      property3: row?.property3 ?? '',
      property4: row?.property4 ?? '',
      property5: row?.property5 ?? '',
      salePrice: n(row?.priceWholesale),
      units: (row?.units ?? []).map((unit: any) => ({
        arabicName: unit?.unit?.arabicName ?? '',
        conversionFactor: n(unit?.conversionFactor) || 1,
        isBaseUnit: Boolean(unit?.isBaseUnit),
      })),
    });

    const companyTotals = async (itemIds: string[]) => {
      const map = new Map<string, number>();
      if (!itemIds.length) return map;
      if (historical) {
        const groups = await prisma.inventoryMovement.groupBy({
          by: ['itemId'],
          where: { companyId, documentDate: { lte: filters.toDate }, itemId: { in: itemIds } },
          _sum: { quantityDelta: true },
        });
        for (const row of groups) map.set(row.itemId, n(row._sum.quantityDelta));
        return map;
      }
      const groups = await prisma.itemWarehouseBalance.groupBy({
        by: ['itemId'],
        where: { companyId, itemId: { in: itemIds } },
        _sum: { quantityOnHand: true },
      });
      for (const row of groups) map.set(row.itemId, n(row._sum.quantityOnHand));
      return map;
    };

    const paint = async (
      lines: Array<{
        item: any;
        warehouseId: string;
        warehouseName: string;
        quantityOnHand: number;
        reservedQuantity: number;
        warehouseAverageCost: number;
      }>
    ) => {
      const totals = await companyTotals([...new Set(lines.map((line) => line.item.id as string))]);
      const rows = lines.map((line) =>
        inventoryCountRow({
          itemId: line.item.id,
          warehouseId: line.warehouseId,
          warehouseName: showWarehouse ? line.warehouseName : '',
          quantityOnHand: line.quantityOnHand,
          reservedQuantity: line.reservedQuantity,
          warehouseAverageCost: line.warehouseAverageCost,
          itemAverageCost: n(line.item.averageCost),
          totalQuantity: totals.get(line.item.id) ?? line.quantityOnHand,
          otherUnitIndex,
          exchangeRate,
          item: asItem(line.item),
        })
      );
      return layoutInventoryCountRows(rows, countLayout(showGroups, showWarehouse));
    };

    const balanceWhere: Record<string, unknown> = {
      companyId,
      item: itemWhere,
    };
    if (warehouseIds) balanceWhere.warehouseId = { in: warehouseIds };
    if (qtyFlags.negativeOnly && !qtyFlags.nonNegativeOnly) balanceWhere.quantityOnHand = { lt: 0 };
    else if (qtyFlags.nonNegativeOnly && !qtyFlags.negativeOnly) balanceWhere.quantityOnHand = { gte: 0 };
    if (hideEmpty) {
      balanceWhere.AND = [{ OR: [{ quantityOnHand: { not: 0 } }, { reservedQuantity: { not: 0 } }] }];
    }

    if (!historical && showWarehouse) {
      const [rows, balanceTotal] = await Promise.all([
        prisma.itemWarehouseBalance.findMany({
          where: balanceWhere,
          skip,
          take: limit,
          orderBy: [{ item: { arabicName: 'asc' } }, { warehouse: { arabicName: 'asc' } }],
          include: { item: { select: itemSelect }, warehouse: { select: { id: true, arabicName: true } } },
        }),
        prisma.itemWarehouseBalance.count({ where: balanceWhere }),
      ]);
      let total = balanceTotal;
      const lines = rows.map((row) => ({
        item: row.item,
        warehouseId: row.warehouseId,
        warehouseName: row.warehouse?.arabicName ?? '',
        quantityOnHand: n(row.quantityOnHand),
        reservedQuantity: n(row.reservedQuantity),
        warehouseAverageCost: n(row.averageCost),
      }));
      if (showEmpty) {
        const emptyWhere = {
          ...itemWhere,
          warehouseBalances: {
            none: { companyId, ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}) },
          },
        };
        const emptyTotal = await prisma.item.count({ where: emptyWhere });
        total += emptyTotal;
        const room = limit - lines.length;
        if (room > 0) {
          const empties = await prisma.item.findMany({
            where: emptyWhere,
            skip: Math.max(0, skip - balanceTotal),
            take: room,
            orderBy: { arabicName: 'asc' },
            select: itemSelect,
          });
          for (const item of empties) {
            lines.push({
              item,
              warehouseId: '',
              warehouseName: '',
              quantityOnHand: 0,
              reservedQuantity: 0,
              warehouseAverageCost: 0,
            });
          }
        }
      }
      const data = await paint(lines);
      const grand = await this.summarizeInventoryCountBalances(balanceWhere, exchangeRate);
      return {
        data,
        summary: {
          totalItems: total,
          totalQuantity: grand.totalQuantity,
          totalValue: grand.totalValue,
          columnTotals: grand.columnTotals,
        },
        pagination: { page, limit, total, totalPages: total === 0 ? 0 : Math.ceil(total / limit) },
      };
    }

    if (!historical) {
      const groups = await prisma.itemWarehouseBalance.groupBy({
        by: ['itemId'],
        where: balanceWhere,
        _sum: { quantityOnHand: true, reservedQuantity: true },
      });
      const kept = groups.filter((row) =>
        keepCountBalance(n(row._sum.quantityOnHand), n(row._sum.reservedQuantity), qtyFlags)
      );
      const pageGroups = kept.slice(skip, skip + limit);
      const items = pageGroups.length
        ? await prisma.item.findMany({
            where: { companyId, id: { in: pageGroups.map((row) => row.itemId) } },
            select: itemSelect,
          })
        : [];
      const byId = new Map(items.map((row) => [row.id, row]));
      const lines = pageGroups
        .filter((row) => byId.has(row.itemId))
        .map((row) => ({
          item: byId.get(row.itemId),
          warehouseId: '',
          warehouseName: '',
          quantityOnHand: n(row._sum.quantityOnHand),
          reservedQuantity: n(row._sum.reservedQuantity),
          warehouseAverageCost: 0,
        }));
      let total = kept.length;
      if (showEmpty) {
        const emptyWhere = {
          ...itemWhere,
          warehouseBalances: {
            none: { companyId, ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}) },
          },
        };
        total += await prisma.item.count({ where: emptyWhere });
        const room = limit - lines.length;
        if (room > 0) {
          const empties = await prisma.item.findMany({
            where: emptyWhere,
            skip: Math.max(0, skip - kept.length),
            take: room,
            orderBy: { arabicName: 'asc' },
            select: itemSelect,
          });
          for (const item of empties) {
            lines.push({
              item,
              warehouseId: '',
              warehouseName: '',
              quantityOnHand: 0,
              reservedQuantity: 0,
              warehouseAverageCost: 0,
            });
          }
        }
      }
      const data = await paint(lines);
      const grand = await this.summarizeInventoryCountBalances(balanceWhere, exchangeRate);
      return {
        data,
        summary: {
          totalItems: total,
          totalQuantity: grand.totalQuantity,
          totalValue: grand.totalValue,
          columnTotals: grand.columnTotals,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        },
      };
    }

    const groups = await prisma.inventoryMovement.groupBy({
      by: ['itemId', 'warehouseId'],
      where: {
        companyId,
        documentDate: { lte: filters.toDate },
        ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
        ...(filters.itemId ? { itemId: String(filters.itemId) } : {}),
      },
      _sum: { quantityDelta: true },
    });
    const itemIds = [...new Set(groups.map((row) => row.itemId))];
    const items = itemIds.length
      ? await prisma.item.findMany({
          where: { ...itemWhere, id: { in: itemIds } },
          select: itemSelect,
        })
      : [];
    const byId = new Map(items.map((row) => [row.id, row]));
    const warehouseRows = groups.length
      ? await prisma.warehouse.findMany({
          where: { id: { in: [...new Set(groups.map((row) => row.warehouseId))] } },
          select: { id: true, arabicName: true },
        })
      : [];
    const warehouseName = new Map(warehouseRows.map((row) => [row.id, row.arabicName]));
    const collapsed = new Map<string, { item: any; warehouseId: string; warehouseName: string; quantityOnHand: number }>();
    for (const row of groups) {
      const item = byId.get(row.itemId);
      if (!item) continue;
      const key = showWarehouse ? `${row.itemId}\0${row.warehouseId}` : row.itemId;
      const current = collapsed.get(key) ?? {
        item,
        warehouseId: showWarehouse ? row.warehouseId : '',
        warehouseName: showWarehouse ? warehouseName.get(row.warehouseId) ?? '' : '',
        quantityOnHand: 0,
      };
      current.quantityOnHand += n(row._sum.quantityDelta);
      collapsed.set(key, current);
    }
    const collapsedLines = [...collapsed.values()].filter((line) =>
      keepCountBalance(line.quantityOnHand, 0, qtyFlags)
    );
    const reservedByKey = new Map<string, number>();
    if (collapsedLines.length > 0) {
      const itemIdsForReserved = [...new Set(collapsedLines.map((line) => line.item.id as string))];
      const balanceRows = await prisma.itemWarehouseBalance.findMany({
        where: {
          companyId,
          itemId: { in: itemIdsForReserved },
          ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
        },
        select: { itemId: true, warehouseId: true, reservedQuantity: true },
      });
      for (const row of balanceRows) {
        const key = showWarehouse ? `${row.itemId}\0${row.warehouseId}` : row.itemId;
        reservedByKey.set(key, (reservedByKey.get(key) ?? 0) + n(row.reservedQuantity));
      }
    }
    const allLines = collapsedLines.map((line) => {
      const key = showWarehouse ? `${line.item.id}\0${line.warehouseId}` : line.item.id;
      const reservedQuantity = reservedByKey.get(key) ?? 0;
      return {
        ...line,
        reservedQuantity,
        warehouseAverageCost: 0,
      };
    });
    const pageLines = allLines.slice(skip, skip + limit);
    const data = await paint(pageLines);
    const fullPainted = await paint(allLines);
    const grand = inventoryCountSummaryTotalsFromRows(fullPainted);
    return {
      data,
      summary: {
        totalItems: allLines.length,
        totalQuantity: grand.totalQuantity,
        totalValue: grand.totalValue,
        columnTotals: grand.columnTotals,
        asOfDate: filters.toDate,
      },
      pagination: {
        page,
        limit,
        total: allLines.length,
        totalPages: allLines.length === 0 ? 0 : Math.ceil(allLines.length / limit),
      },
    };
  }

  /**
   * Get Inventory Reports (Detailed)
   */
  async getInventoryReportsDetailed(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      return await this.listInventoryCount(filters, options);
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating inventory reports detailed');
      throw error;
    }
  }

  /**
   * Get Stock Transfer Report
   */
  async getStockTransferReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, warehouseId, branchId } = filters;
      const showUnposted = Boolean(filters.showUnposted);
      const page = Math.max(1, options.page ?? 1);
      const limit = Math.min(5000, Math.max(1, options.limit ?? 2000));

      if (!fromDate || !toDate) {
        throw new Error('يرجى اختيار تاريخ البداية والنهاية');
      }

      const empty = {
        data: [],
        summary: { totalTransfers: 0, totalQuantity: 0, totalAmount: 0 },
        pagination: { page, limit, total: 0, totalPages: 0 },
      };

      const fromWarehouseId = filters.fromWarehouseId ? String(filters.fromWarehouseId) : undefined;
      const toWarehouseId = filters.toWarehouseId ? String(filters.toWarehouseId) : undefined;
      let warehouseRows: Array<{ id: string; parentWarehouseId: string | null }> | null = null;
      const warehouseTree = async (rootId?: string) => {
        if (!rootId) return undefined;
        if (!warehouseRows) {
          warehouseRows = await prisma.warehouse.findMany({
            where: { companyId },
            select: { id: true, parentWarehouseId: true },
          });
        }
        return expandTreeIds(
          rootId,
          warehouseRows.map((row) => ({ id: row.id, parentId: row.parentWarehouseId }))
        );
      };
      const fromIds = await warehouseTree(fromWarehouseId);
      const toIds = await warehouseTree(toWarehouseId);
      const eitherIds =
        !fromWarehouseId && !toWarehouseId && warehouseId ? await warehouseTree(warehouseId) : undefined;

      const itemIds = await resolveReportItemIds(companyId, filters);
      if (itemIds && !itemIds.length) return empty;

      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isCancelled: false,
        ...(showUnposted ? {} : { isPosted: true }),
      };

      const and: any[] = [];
      if (fromIds) and.push({ fromWarehouseId: { in: fromIds } });
      if (toIds) and.push({ toWarehouseId: { in: toIds } });
      if (eitherIds) {
        and.push({
          OR: [{ fromWarehouseId: { in: eitherIds } }, { toWarehouseId: { in: eitherIds } }],
        });
      }
      if (itemIds) and.push({ lines: { some: { itemId: { in: itemIds } } } });
      if (branchId) {
        and.push({
          OR: [
            { branchId },
            { fromWarehouse: { branchId } },
            { toWarehouse: { branchId } },
          ],
        });
      }
      if (and.length) where.AND = and;

      const skip = (page - 1) * limit;

      const [transfers, total] = await Promise.all([
        prisma.transfer.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'asc' }, { serial: 'asc' }],
          include: {
            fromWarehouse: { select: WAREHOUSE_SELECT },
            toWarehouse: { select: WAREHOUSE_SELECT },
            lines: {
              where: itemIds ? { itemId: { in: itemIds } } : undefined,
              orderBy: { createdAt: 'asc' },
              include: {
                item: { select: ITEM_SELECT },
              },
            },
          },
        }),
        prisma.transfer.count({ where }),
      ]);

      const data = transfers.flatMap((transfer) =>
        transfer.lines.map((line) => {
          const quantity = n(line.quantity);
          const unitPrice = n(line.unitPrice);
          const totalAmount = line.total != null ? n(line.total) : quantity * unitPrice;
          return {
          transferId: transfer.id,
          date: transfer.date,
            serial: transfer.serial?.trim() || '',
          fromWarehouse: transfer.fromWarehouse?.arabicName ?? '',
          toWarehouse: transfer.toWarehouse?.arabicName ?? '',
            warehouseId: transfer.fromWarehouseId,
            itemId: line.itemId,
            itemSerial: line.item?.serial ?? '',
            itemName: line.item?.arabicName ?? '',
            quantity,
            unitPrice,
            total: totalAmount,
          isPosted: transfer.isPosted,
          };
        })
      );

      return {
        data,
        summary: {
          totalTransfers: total,
          totalQuantity: data.reduce((sum, row) => sum + row.quantity, 0),
          totalAmount: data.reduce((sum, row) => sum + row.total, 0),
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating stock transfer report');
      throw error;
    }
  }

  /**
   * Get Items Exceeding Order Limit Report
   */
  async getItemsExceedingOrderLimitReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, warehouseId, itemId, toDate, branchId } = filters;
      const { page = 1, limit = 100 } = options;
      const empty = {
        data: [],
        summary: { totalItems: 0 },
        pagination: { page, limit, total: 0, totalPages: 0 },
      };

      const scopedIds = await resolveReportItemIds(companyId, filters);
      if (scopedIds && !scopedIds.length) return empty;
      let itemScope: Record<string, unknown> = {};
      if (scopedIds) itemScope = { itemId: { in: scopedIds } };
      else if (itemId) itemScope = { itemId };

      let warehouseScope: Record<string, unknown> = {};
      if (warehouseId) {
        warehouseScope = { warehouseId };
      } else if (branchId) {
        const grouped = await prisma.warehouse.findMany({
          where: { companyId, branchId },
          select: { id: true },
        });
        if (!grouped.length) return empty;
        warehouseScope = { warehouseId: { in: grouped.map((row) => row.id) } };
      }

      const scoped = { ...itemScope, ...warehouseScope };
      const useAsOf = Boolean(toDate) && !usesLiveWarehouseBalances(toDate);
      const qtyRows: Array<{ itemId: string; warehouseId: string; quantity: number }> = useAsOf
        ? (
            await prisma.inventoryMovement.groupBy({
              by: ['itemId', 'warehouseId'],
          where: {
            companyId,
                documentDate: { lte: toDate },
                ...scoped,
              },
              _sum: { quantityDelta: true },
            })
          ).map((row) => ({
            itemId: row.itemId,
            warehouseId: row.warehouseId,
            quantity: n(row._sum.quantityDelta),
          }))
        : (
            await prisma.itemWarehouseBalance.findMany({
              where: { companyId, ...scoped },
              select: { itemId: true, warehouseId: true, quantityOnHand: true },
            })
          )          .map((row) => ({
            itemId: row.itemId,
            warehouseId: row.warehouseId,
            quantity: n(row.quantityOnHand),
          }));

      if (filters.showUnposted) {
        const scopedWarehouseIds = warehouseId
          ? [warehouseId]
          : Array.isArray((warehouseScope as { warehouseId?: { in?: string[] } }).warehouseId?.in)
            ? (warehouseScope as { warehouseId: { in: string[] } }).warehouseId.in
            : undefined;
        const extra = await unpostedInvoiceQtyMap(companyId, {
          toDate: useAsOf ? toDate : undefined,
          warehouseIds: scopedWarehouseIds,
        });
        const allowedItems = itemId
          ? new Set([itemId])
          : Array.isArray((itemScope as { itemId?: { in?: string[] } }).itemId?.in)
            ? new Set((itemScope as { itemId: { in: string[] } }).itemId.in)
            : null;
        const index = new Map(qtyRows.map((row) => [`${row.warehouseId}:${row.itemId}`, row]));
        for (const [key, delta] of extra) {
          const splitAt = key.indexOf(':');
          const wh = key.slice(0, splitAt);
          const id = key.slice(splitAt + 1);
          if (allowedItems && !allowedItems.has(id)) continue;
          const existing = index.get(key);
          if (existing) {
            existing.quantity += delta;
          } else {
            const created = { itemId: id, warehouseId: wh, quantity: delta };
            qtyRows.push(created);
            index.set(key, created);
          }
        }
      }

      let expandWarehouseIds = warehouseId
        ? [warehouseId]
        : Array.isArray((warehouseScope as { warehouseId?: { in?: string[] } }).warehouseId?.in)
          ? (warehouseScope as { warehouseId: { in: string[] } }).warehouseId.in
          : [];
      if (!expandWarehouseIds.length) {
        expandWarehouseIds = (
          await prisma.warehouse.findMany({
            where: { companyId, isActive: true },
            select: { id: true },
          })
        ).map((row) => row.id);
      }

      const itemWhereForLimits: Prisma.ItemWhereInput = {
        companyId,
        orderLimit: { gt: 0 },
        isActive: true,
        inactiveItem: false,
      };
      if (itemId) itemWhereForLimits.id = itemId;
      else if (scopedIds) itemWhereForLimits.id = { in: scopedIds };

      const catalogWithLimit = await prisma.item.findMany({
        where: itemWhereForLimits,
        select: { id: true },
      });
      const presentKeys = new Set(qtyRows.map((row) => `${row.warehouseId}:${row.itemId}`));
      for (const catalogItem of catalogWithLimit) {
        for (const whId of expandWarehouseIds) {
          const key = `${whId}:${catalogItem.id}`;
          if (presentKeys.has(key)) continue;
          qtyRows.push({ itemId: catalogItem.id, warehouseId: whId, quantity: 0 });
          presentKeys.add(key);
        }
      }

      const itemIds = [...new Set(qtyRows.map((row) => row.itemId))];
      const warehouseIds = [...new Set(qtyRows.map((row) => row.warehouseId))];
      const [items, warehouses, limitLines] = await Promise.all([
        itemIds.length
          ? prisma.item.findMany({
              where: { companyId, id: { in: itemIds } },
              select: {
                id: true,
                serial: true,
                arabicName: true,
                orderLimit: true,
                lowerLimit: true,
                upperLimit: true,
                category: { select: { arabicName: true } },
              },
            })
          : [],
        warehouseIds.length
          ? prisma.warehouse.findMany({
              where: { companyId, id: { in: warehouseIds } },
              select: { id: true, arabicName: true },
            })
          : [],
        itemIds.length
          ? prisma.itemOrderLimitLine.findMany({
          where: {
                itemId: { in: itemIds },
            list: {
              companyId,
              isActive: true,
                  ...(warehouseIds.length ? { warehouseId: { in: warehouseIds } } : {}),
            },
          },
          select: {
            itemId: true,
            orderLimit: true,
            list: { select: { warehouseId: true } },
          },
            })
          : [],
      ]);

      const itemById = new Map(items.map((row) => [row.id, row]));
      const warehouseById = new Map(warehouses.map((row) => [row.id, row]));
      const limitByKey = new Map<string, number>();
      for (const line of limitLines) {
        limitByKey.set(`${line.list.warehouseId}:${line.itemId}`, n(line.orderLimit));
      }

      const exceedingItems = qtyRows
        .map((row) => {
          const item = itemById.get(row.itemId);
          const currentQuantity = row.quantity;
          const listLimit = limitByKey.get(`${row.warehouseId}:${row.itemId}`);
          const orderLimit = resolveEffectiveOrderLimit(listLimit, n(item?.orderLimit));
          const upperLimit = n(item?.upperLimit);
          return {
            itemId: row.itemId,
            warehouseId: row.warehouseId,
            itemSerial: item?.serial ?? '',
            itemName: item?.arabicName ?? '',
            groupName: item?.category?.arabicName ?? '',
            warehouseName: warehouseById.get(row.warehouseId)?.arabicName ?? '',
            currentQuantity,
            orderLimit,
            upperLimit,
            lowerLimit: n(item?.lowerLimit),
            difference: orderLimit - currentQuantity,
            status: orderLimitStatusLabel(orderLimit, currentQuantity, upperLimit),
          };
        })
        .filter((row) => matchesOrderLimitStatus(row.orderLimit, row.currentQuantity, filters.limitStatus))
        .filter((row) =>
          keepCountBalance(row.currentQuantity, 0, {
            hideEmpty: false,
            negativeOnly: countFlag(filters.negativeOnly, false),
            nonNegativeOnly: countFlag(filters.nonNegativeOnly, false),
          })
        );

      const painted = paintReportLayout(exceedingItems, filters);
      const sortedData = painted.slice((page - 1) * limit, page * limit);

      return {
        data: sortedData,
        summary: {
          totalItems: exceedingItems.length,
        },
        pagination: {
          page,
          limit,
          total: exceedingItems.length,
          totalPages: Math.ceil(exceedingItems.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating items exceeding order limit report');
      throw error;
    }
  }

  /**
   * تواريخ الصلاحية من سطور الفواتير المرحلة ومن تشغيلات السطر.
   * الفترة تُطبَّق على تاريخ الصلاحية بعد التجميع، مش كشرط يستبعد التشغيلات.
   */
  async getExpiryDateReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, fromDate, toDate } = filters;
      const page = Math.max(1, options.page ?? 1);
      const limit = Math.min(5000, Math.max(1, options.limit ?? 2000));
      const emptySummary = {
        lotCount: 0,
        onHandLots: 0,
        expiredLots: 0,
        soonLots: 0,
        quarterLots: 0,
        consumedLots: 0,
      };

      let warehouseIds: string[] | undefined;
      if (filters.warehouseId) {
        const warehouses = await prisma.warehouse.findMany({
          where: { companyId },
          select: { id: true, parentWarehouseId: true },
        });
        warehouseIds = expandTreeIds(
          filters.warehouseId,
          warehouses.map((row) => ({ id: row.id, parentId: row.parentWarehouseId }))
        );
      }

      const itemIds = await resolveReportItemIds(companyId, filters);
      if (itemIds && !itemIds.length) {
        return {
          data: [],
          summary: emptySummary,
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
      }

      const invoiceWhere: Record<string, unknown> = {
        companyId,
        isCancelled: false,
        ...postedUnlessRequested(filters),
      };
      if (filters.branchId) invoiceWhere.branchId = filters.branchId;
      if (filters.delegateId) invoiceWhere.representativeId = filters.delegateId;
      if (filters.userId) invoiceWhere.createdBy = filters.userId;
      if (filters.fromInvoice || filters.toInvoice) {
        invoiceWhere.invoiceNumber = {
          ...(filters.fromInvoice ? { gte: String(filters.fromInvoice) } : {}),
          ...(filters.toInvoice ? { lte: String(filters.toInvoice) } : {}),
        };
      }
      applyCustomerGroupWhere(invoiceWhere, filters);
      applySupplierGroupWhere(invoiceWhere, filters);

      const lines = await prisma.invoiceLine.findMany({
          where: {
            invoice: invoiceWhere,
          ...(itemIds ? { itemId: { in: itemIds } } : {}),
          OR: [
            { expiryDate: { not: null } },
            { batchAllocations: { not: Prisma.DbNull } },
          ],
        },
        select: {
          quantity: true,
          batchNumber: true,
          expiryDate: true,
          batchAllocations: true,
          warehouseId: true,
          costCenterId: true,
          itemId: true,
          unit: { select: { arabicName: true } },
          warehouse: { select: { arabicName: true } },
          item: {
            select: {
              arabicName: true,
              serial: true,
              category: { select: { arabicName: true } },
            },
          },
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
                invoiceKind: true,
              invoiceType: true,
                warehouseId: true,
              costCenterId: true,
              customer: { select: { arabicName: true } },
              supplier: { select: { arabicName: true } },
              warehouse: { select: { arabicName: true } },
              },
            },
          },
      });

      const sourceLots: ExpirySourceLot[] = [];
      for (const line of lines) {
        const lineWarehouseId = line.warehouseId || line.invoice?.warehouseId || '';
        if (warehouseIds && !warehouseIds.includes(lineWarehouseId)) continue;
        const lineCostCenterId = line.costCenterId || line.invoice?.costCenterId || '';
        if (filters.costCenterId && lineCostCenterId !== filters.costCenterId) continue;

        const invoice = line.invoice;
        const kind = invoice?.invoiceKind === 'PURCHASE_RETURN' || invoice?.invoiceType === 'purchaseReturn'
          ? { label: 'مردودات مشتريات', side: 'out' as const, sale: false, sourceType: 'PR' }
          : isSaleReturn(invoice ?? {})
            ? { label: 'مردودات مبيعات', side: 'in' as const, sale: true, sourceType: 'SR' }
            : isSaleSide(invoice ?? {})
              ? { label: 'فاتورة مبيعات', side: 'out' as const, sale: true, sourceType: 'SI' }
              : { label: 'فاتورة مشتريات', side: 'in' as const, sale: false, sourceType: 'PI' };
        const partyName = kind.sale
          ? invoice?.customer?.arabicName || ''
          : invoice?.supplier?.arabicName || '';
        const shared = {
          itemId: line.itemId,
          itemName: line.item?.arabicName || line.item?.serial || '',
          warehouseId: lineWarehouseId,
          warehouseName: line.warehouse?.arabicName || invoice?.warehouse?.arabicName || '',
          sourceLabel: kind.label,
          sourceNumber: invoice?.invoiceNumber || '',
          sourceDocumentId: invoice?.id || '',
          sourceType: kind.sourceType,
          partyName,
          unitName: line.unit?.arabicName || '',
          itemGroupName: line.item?.category?.arabicName || '',
          side: kind.side,
        };

        const allocations = parseBatchAllocations(line.batchAllocations);
        if (allocations.length) {
          for (const allocation of allocations) {
            if (!allocation.quantity) continue;
            sourceLots.push({
              ...shared,
              batchNumber: allocation.batchNumber || line.batchNumber || '',
              expiryDate: allocation.expiryDate,
              quantity: allocation.quantity,
            });
          }
          continue;
        }
        if (!line.expiryDate) continue;
        const quantity = Math.abs(n(line.quantity));
        if (!quantity) continue;
        sourceLots.push({
          ...shared,
          batchNumber: line.batchNumber || '',
          expiryDate: line.expiryDate,
          quantity,
        });
      }

      const invoiceOnly =
        Boolean(filters.delegateId) ||
        Boolean(filters.userId) ||
        Boolean(filters.fromInvoice) ||
        Boolean(filters.toInvoice) ||
        Boolean(filters.customerId) ||
        Boolean(filters.supplierId) ||
        Boolean(filters.customerCategoryId) ||
        Boolean(filters.supplierCategoryId) ||
        Boolean(filters.costCenterId);

      if (!invoiceOnly) {
        const openingLines = await prisma.openingStockLine.findMany({
          where: {
            expiryDate: { not: null },
            ...(itemIds ? { itemId: { in: itemIds } } : {}),
            openingStock: {
              companyId,
              isCancelled: false,
              ...postedUnlessRequested(filters),
              ...(filters.branchId ? { branchId: filters.branchId } : {}),
            },
          },
          select: {
            quantity: true,
            batchNumber: true,
            expiryDate: true,
            warehouseId: true,
            itemId: true,
            warehouse: { select: { arabicName: true } },
            openingStock: { select: { id: true, serial: true } },
            item: {
              select: {
                arabicName: true,
                serial: true,
                category: { select: { arabicName: true } },
                units: {
                  where: { isBaseUnit: true },
                  take: 1,
                  select: { unit: { select: { arabicName: true } } },
                },
              },
            },
          },
        });

        for (const line of openingLines) {
          if (!line.expiryDate) continue;
          if (warehouseIds && !warehouseIds.includes(line.warehouseId)) continue;
          const quantity = Math.abs(n(line.quantity));
          if (!quantity) continue;
          sourceLots.push({
        itemId: line.itemId,
            itemName: line.item?.arabicName || line.item?.serial || '',
            warehouseId: line.warehouseId,
            warehouseName: line.warehouse?.arabicName || '',
            batchNumber: line.batchNumber || '',
        expiryDate: line.expiryDate,
            quantity,
            side: 'in',
            sourceLabel: 'بضاعة أول المدة',
            sourceNumber: line.openingStock?.serial || '',
            sourceDocumentId: line.openingStock?.id || '',
            sourceType: 'OB',
            partyName: '',
            unitName: line.item?.units?.[0]?.unit?.arabicName || '',
            itemGroupName: line.item?.category?.arabicName || '',
          });
        }
      }

      const built = buildExpiryReport(sourceLots, { fromDate, toDate });
      const painted = paintReportLayout(built.rows, filters);
      const total = painted.length;
      const skip = (page - 1) * limit;
      return {
        data: painted.slice(skip, skip + limit),
        summary: built.summary,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 0,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating expiry date report');
      throw error;
    }
  }

  /**
   * Get Sales and Returns Reports (Combined)
   */
  async getSalesAndReturnsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, warehouseId, customerId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        ...postedUnlessRequested(filters),
        isCancelled: false,
        ...invoiceFamilyWhere(['SALE', 'SALE_RETURN']),
      };

      if (warehouseId) where.warehouseId = warehouseId;
      applyCustomerGroupWhere(where, filters);

      const skip = (page - 1) * limit;

      applyReportUser(where, filters);
      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            customer: true,
            warehouse: true,
            lines: {
              include: {
                item: true,
              },
            },
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      const totalSales = invoices
        .filter((inv) => inv.invoiceKind === 'SALE' || inv.invoiceType === 'sales')
        .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
      const totalReturns = invoices
        .filter((inv) => isSaleReturn(inv))
        .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

      return {
        data: invoices,
        summary: {
          totalSales,
          totalReturns,
          netSales: totalSales - totalReturns,
          totalCount: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating sales and returns report');
      throw error;
    }
  }

  /**
   * Get Monthly Sales for Items Report
   */
  async getMonthlySalesForItemsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, warehouseId } = filters;
      const page = Math.max(1, options.page ?? 1);
      const limit = Math.min(5000, Math.max(1, options.limit ?? 2000));

      if (!fromDate || !toDate) {
        throw new Error('يرجى اختيار تاريخ البداية والنهاية');
      }

      const scopedItemIds = await resolveReportItemIds(companyId, filters);
      if (scopedItemIds && scopedItemIds.length === 0) {
        return {
          data: [],
          summary: {
            itemCount: 0,
            saleQty: 0,
            saleAmount: 0,
            returnQty: 0,
            returnAmount: 0,
            netQty: 0,
            netAmount: 0,
          },
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
      }

      let warehouseIds: string[] | undefined;
      if (warehouseId) {
        const warehouses = await prisma.warehouse.findMany({
          where: { companyId },
          select: { id: true, parentWarehouseId: true },
        });
        warehouseIds = expandTreeIds(
          warehouseId,
          warehouses.map((row) => ({ id: row.id, parentId: row.parentWarehouseId }))
        );
      }

      const where: Record<string, unknown> = {
        companyId,
        date: { gte: fromDate, lte: toDate },
        ...postedUnlessRequested(filters),
        isCancelled: false,
        AND: [invoiceFamilyWhere(['SALE', 'SALE_RETURN'])],
      };
      if (filters.branchId) where.branchId = filters.branchId;
      if (warehouseIds) {
        (where.AND as unknown[]).push({
          OR: [
            { warehouseId: { in: warehouseIds } },
            { lines: { some: { warehouseId: { in: warehouseIds } } } },
          ],
        });
      }
      if (filters.currencyId) {
        const currency = await prisma.currency.findFirst({
          where: { companyId, OR: [{ id: filters.currencyId }, { code: filters.currencyId }] },
          select: { code: true },
        });
        where.currencyCode = currency?.code ?? filters.currencyId;
      }
      applyReportUser(where, filters);

      const invoices = await prisma.invoice.findMany({
        where,
        select: {
          date: true,
          invoiceKind: true,
          invoiceType: true,
          warehouseId: true,
          lines: {
            ...(scopedItemIds ? { where: { itemId: { in: scopedItemIds } } } : {}),
            select: {
              itemId: true,
              quantity: true,
              total: true,
              warehouseId: true,
              item: { select: { serial: true, arabicName: true } },
            },
          },
        },
      });

      const movements: MonthlySaleMovement[] = [];
      for (const invoice of invoices) {
        const sign = isSaleReturn(invoice) ? -1 : 1;
        const month = invoice.date.getUTCMonth() + 1;
        for (const line of invoice.lines) {
          const lineWarehouseId = line.warehouseId || invoice.warehouseId || '';
          if (warehouseIds && !warehouseIds.includes(lineWarehouseId)) continue;
          movements.push({
            itemId: line.itemId,
            itemName: line.item?.arabicName || '',
            itemSerial: line.item?.serial || '',
            month,
            quantity: Math.abs(n(line.quantity)),
            amount: Math.abs(n(line.total)),
            kind: sign < 0 ? 'return' : 'sale',
          });
        }
      }

      const hideUnsold = Boolean(filters.hideUnsoldItems);
      let catalog: Array<{ itemId: string; itemName: string; itemSerial: string }> | undefined;
      if (!hideUnsold && filters.itemGroupId && scopedItemIds) {
        const items = await prisma.item.findMany({
          where: { companyId, id: { in: scopedItemIds } },
          select: { id: true, arabicName: true, serial: true },
        });
        catalog = items.map((item) => ({
          itemId: item.id,
          itemName: item.arabicName || '',
          itemSerial: item.serial || '',
        }));
      }

      const built = applyMonthlySalesVisibility(buildMonthlyItemSales(movements), {
        hideUnsold,
        catalog,
      });
      const total = built.rows.length;
      const skip = (page - 1) * limit;
      return {
        data: built.rows.slice(skip, skip + limit),
        summary: built.summary,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 0,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating monthly sales for items report');
      throw error;
    }
  }

  /**
   * Get Customer Accounts Reports (Detailed)
   */
  async getCustomerAccountsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    return buildPartyAccountStatement(filters, options, 'customer');
  }


  /**
   * Get Customer Accounts Currency Reports
   */
  async getCustomerAccountsCurrencyReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    return loadPartyCurrencyStatement(filters, options, 'customer');
  }

  /**
   * Get Customer Account Items Report
   */
  async getCustomerAccountItemsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      return await loadPartyItemAccount(filters, options, 'customer');
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating customer account items report');
      throw error;
    }
  }

  /**
   * Get Customer Receivables Report
   */
  async getCustomerReceivablesReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId } = filters;
      const page = options.page ?? 1;
      const limit = options.limit ?? 5000;
      const asOf = filters.toDate ? new Date(filters.toDate) : new Date();
      let currencyCode = '';
      if (filters.currencyId) {
        const currency = await prisma.currency.findFirst({
          where: { companyId, OR: [{ id: filters.currencyId }, { code: filters.currencyId }] },
          select: { code: true },
        });
        currencyCode = currency?.code || String(filters.currencyId);
      }

      const invoiceWhere: any = {
        companyId,
        ...postedUnlessRequested(filters),
        isCancelled: false,
        date: { lte: asOf },
        ...invoiceFamilyWhere(['SALE']),
      };
      applyCustomerGroupWhere(invoiceWhere, filters);
      applyReportUser(invoiceWhere, filters);
      if (filters.branchId) invoiceWhere.branchId = filters.branchId;
      if (filters.delegateId) invoiceWhere.representativeId = filters.delegateId;
      if (filters.warehouseId) invoiceWhere.warehouseId = filters.warehouseId;
      if (filters.costCenterId) invoiceWhere.costCenterId = filters.costCenterId;
      if (currencyCode) invoiceWhere.currencyCode = currencyCode;
      if (filters.itemId) invoiceWhere.lines = { some: { itemId: filters.itemId } };
      else if (filters.itemGroupId) {
        invoiceWhere.lines = { some: { item: { categoryId: filters.itemGroupId } } };
      }

      const narrowPapers = Boolean(
        filters.delegateId || filters.warehouseId || filters.costCenterId || filters.itemId || filters.itemGroupId
      );
      const customerScope = filters.customerCategoryId
        ? { customer: { customerCategoryId: filters.customerCategoryId } }
        : {};

      const [invoices, cheques, papers] = await Promise.all([
        prisma.invoice.findMany({
          where: { ...invoiceWhere, remainingAmount: { gt: 0 } },
          select: {
            customerId: true,
            dueDate: true,
            date: true,
            remainingAmount: true,
            exchangeRate: true,
            customer: { select: { arabicName: true } },
            installments: {
              select: { dueDate: true, amount: true, paidAmount: true, isPaid: true },
            },
          },
        }),
        prisma.cheque.findMany({
        where: {
            companyId,
            direction: 'INWARD',
            status: { in: ['UNDER_HAND', 'SENT_TO_BANK'] },
            customerId: filters.customerId || { not: null },
            ...(filters.branchId ? { branchId: filters.branchId } : {}),
            ...(currencyCode ? { currencyCode } : {}),
            ...customerScope,
            ...(narrowPapers ? { invoice: invoiceWhere } : {}),
          },
          select: {
            customerId: true,
            dueDate: true,
            amount: true,
            customer: { select: { arabicName: true } },
          },
        }),
        narrowPapers
          ? Promise.resolve([])
          : prisma.securitiesReceipt.findMany({
              where: {
                companyId,
                isCancelled: false,
                paperCase: OPEN_PAPER_CASE,
                customerId: filters.customerId || { not: null },
                ...(filters.branchId ? { branchId: filters.branchId } : {}),
                ...(currencyCode ? { currencyCode } : {}),
                ...customerScope,
              },
              select: {
                customerId: true,
                dueDate: true,
                date: true,
                amount: true,
                customer: { select: { arabicName: true } },
              },
            }),
      ]);

      const rows = new Map();
      const ensure = (id, name) => {
        if (!id) return null;
        if (!rows.has(id)) {
          rows.set(id, {
            customerName: name || '',
            invoices: 0,
            notYetDue: 0,
            pay30: 0,
            cheque30: 0,
            pay60: 0,
            cheque60: 0,
            pay90: 0,
            cheque90: 0,
            payOlder: 0,
            chequeOlder: 0,
            totalDue: 0,
          });
        }
        const row = rows.get(id);
        if (name && !row.customerName) row.customerName = name;
        return row;
      };
      const addInvoice = (row, dueDate, amount) => {
        const value = roundTo4(amount);
        if (!value) return;
        const slot = classifyReceivableInvoice(dueDate, asOf, filters.fromDate);
        if (slot === 'prior') row.invoices = roundTo4(row.invoices + value);
        else if (slot === 'current') row.notYetDue = roundTo4(row.notYetDue + value);
        else if (slot === 'd30') row.pay30 = roundTo4(row.pay30 + value);
        else if (slot === 'd60') row.pay60 = roundTo4(row.pay60 + value);
        else if (slot === 'd90') row.pay90 = roundTo4(row.pay90 + value);
        else row.payOlder = roundTo4(row.payOlder + value);
      };
      const addCheque = (row, bucket, amount) => {
        const value = roundTo4(amount);
        if (!value) return;
        if (bucket === 'current' || bucket === 'd30') row.cheque30 = roundTo4(row.cheque30 + value);
        else if (bucket === 'd60') row.cheque60 = roundTo4(row.cheque60 + value);
        else if (bucket === 'd90') row.cheque90 = roundTo4(row.cheque90 + value);
        else row.chequeOlder = roundTo4(row.chequeOlder + value);
      };

      for (const invoice of invoices) {
        const row = ensure(invoice.customerId, invoice.customer?.arabicName);
        if (!row) continue;
        const fx = currencyCode ? 1 : Number(invoice.exchangeRate || 1) || 1;
        const openInstallments = (invoice.installments || []).filter(
          (installment) =>
            !installment.isPaid && Number(installment.amount) - Number(installment.paidAmount) > 0
        );
        if (openInstallments.length) {
          for (const installment of openInstallments) {
            addInvoice(
              row,
              installment.dueDate,
              (Number(installment.amount) - Number(installment.paidAmount)) * fx
            );
          }
        } else {
          addInvoice(
            row,
            invoice.dueDate || invoice.date,
            Number(invoice.remainingAmount || 0) * fx
          );
        }
      }
      for (const cheque of cheques) {
        const row = ensure(cheque.customerId, cheque.customer?.arabicName);
        if (!row) continue;
        addCheque(row, receivableAgeBucket(cheque.dueDate, asOf), Number(cheque.amount || 0));
      }
      for (const paper of papers) {
        const row = ensure(paper.customerId, paper.customer?.arabicName);
        if (!row) continue;
        addCheque(row, receivableAgeBucket(paper.dueDate || paper.date, asOf), Number(paper.amount || 0));
      }

      const minValue = Number(filters.minValue || 0);
      const data = [...rows.values()]
        .map((row) => {
          row.totalDue = roundTo4(
            row.invoices +
              row.notYetDue +
              row.pay30 +
              row.cheque30 +
              row.pay60 +
              row.cheque60 +
              row.pay90 +
              row.cheque90 +
              row.payOlder +
              row.chequeOlder
          );
          return row;
        })
        .filter((row) => row.totalDue > 0 && (!minValue || row.totalDue >= minValue))
        .sort((a, b) => String(a.customerName).localeCompare(String(b.customerName), 'ar') || b.totalDue - a.totalDue);

      const totalReceivables = roundTo4(data.reduce((sum, row) => sum + row.totalDue, 0));
      const skip = (page - 1) * limit;
      return {
        data: data.slice(skip, skip + limit),
        summary: {
          totalReceivables,
          totalCustomers: data.length,
        },
        pagination: {
          page,
          limit,
          total: data.length,
          totalPages: Math.ceil(data.length / limit) || 1,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating customer receivables report');
      throw error;
    }
  }

  /**
   * Get Supplier Accounts Reports
   */
  async getSupplierAccountsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    return buildPartyAccountStatement(filters, options, 'supplier');
  }


  /**
   * Customer/supplier statement with debit, credit, and running balance per company currency.
   */
  async getSupplierAccountsCurrenciesReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    return loadPartyCurrencyStatement(filters, options, 'supplier');
  }


  /**
   * Get Supplier Account Items Report
   */
  async getSupplierAccountItemsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      return await loadPartyItemAccount(filters, options, 'supplier');
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating supplier account items report');
      throw error;
    }
  }

  /**
   * Installment sheet for the overdue-payments screen.
   * Collections still calls getOverduePaymentsReport without allPayments.
   */
  async getPaymentScheduleReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    const page = options.page ?? 1;
    const limit = Math.min(Math.max(options.limit ?? 2000, 1), 5000);
    const asOf = filters.toDate ?? new Date();
    const empty = {
      data: [],
      summary: {
        totalPayments: 0,
        totalSettled: 0,
        totalRemaining: 0,
        totalOverdue: 0,
        totalInvoices: 0,
      },
      pagination: { page, limit, total: 0, totalPages: 0 },
    };

    const customerSide = Boolean(filters.customerId || filters.customerCategoryId);
    const supplierSide = Boolean(filters.supplierId || filters.supplierCategoryId);
    const kinds: InvoiceKind[] =
      supplierSide && !customerSide
        ? ['PURCHASE', 'PURCHASE_RETURN']
        : customerSide && !supplierSide
          ? ['SALE', 'SALE_RETURN']
          : ['SALE', 'PURCHASE', 'SALE_RETURN', 'PURCHASE_RETURN'];

      const where: any = {
      companyId: filters.companyId,
      ...postedUnlessRequested(filters),
        isCancelled: false,
      ...invoiceFamilyWhere(kinds),
    };
    if (filters.fromDate || filters.toDate) {
      where.date = {
        ...(filters.fromDate ? { gte: filters.fromDate } : {}),
        ...(filters.toDate ? { lte: filters.toDate } : {}),
      };
    }
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.delegateId) where.representativeId = filters.delegateId;
    applyReportUser(where, filters);

    const and: Record<string, unknown>[] = [];
    if (customerSide && supplierSide) {
      const customerWhere: Record<string, unknown> = {};
      const supplierWhere: Record<string, unknown> = {};
      applyCustomerGroupWhere(customerWhere, filters);
      applySupplierGroupWhere(supplierWhere, filters);
      and.push({ OR: [customerWhere, supplierWhere] });
    } else if (customerSide) {
      applyCustomerGroupWhere(where, filters);
    } else if (supplierSide) {
      applySupplierGroupWhere(where, filters);
    }
    if (filters.costCenterId) {
      and.push({
        OR: [
          { costCenterId: filters.costCenterId },
          { lines: { some: { costCenterId: filters.costCenterId } } },
        ],
      });
    }
    if (filters.warehouseId) {
      const warehouses = await prisma.warehouse.findMany({
        where: { companyId: filters.companyId },
        select: { id: true, parentWarehouseId: true },
      });
      const warehouseIds = expandTreeIds(
        filters.warehouseId,
        warehouses.map((row) => ({ id: row.id, parentId: row.parentWarehouseId }))
      );
      and.push({
        OR: [
          { warehouseId: { in: warehouseIds } },
          { lines: { some: { warehouseId: { in: warehouseIds } } } },
        ],
      });
    }
    if (filters.itemId || filters.itemGroupId) {
      let categoryIds: string[] | undefined;
      if (filters.itemGroupId) {
        const categories = await prisma.itemCategory.findMany({
          where: { companyId: filters.companyId },
          select: { id: true, parentCategoryId: true },
        });
        categoryIds = expandTreeIds(
          String(filters.itemGroupId),
          categories.map((row) => ({ id: row.id, parentId: row.parentCategoryId }))
        );
      }
      const items = await prisma.item.findMany({
        where: {
          companyId: filters.companyId,
          ...(filters.itemId ? { id: filters.itemId } : {}),
          ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
        },
        select: { id: true },
      });
      const itemIds = items.map((row) => row.id);
      if (!itemIds.length) return empty;
      and.push({ lines: { some: { itemId: { in: itemIds } } } });
    }
    if (and.length) where.AND = and;

      const invoices = await prisma.invoice.findMany({
        where,
      take: 5000,
      orderBy: [{ date: 'asc' }, { invoiceNumber: 'asc' }],
      select: {
        id: true,
        invoiceNumber: true,
        date: true,
        dueDate: true,
        netAmount: true,
        paidAmount: true,
        invoiceKind: true,
        invoiceType: true,
        postedAt: true,
        documentProfile: { select: { nameAr: true } },
        customer: { select: { arabicName: true } },
        supplier: { select: { arabicName: true } },
        installments: {
          orderBy: { installmentNumber: 'asc' },
          select: {
            id: true,
            dueDate: true,
            amount: true,
            paidAmount: true,
            isPaid: true,
            status: true,
            paymentDate: true,
          },
          },
        },
      });

    const invoiceIds = invoices.map((invoice) => invoice.id);
    const [cashRows, chequeRows] = invoiceIds.length
      ? await Promise.all([
          prisma.cashTransaction.findMany({
            where: { companyId: filters.companyId, isCancelled: false, invoiceId: { in: invoiceIds } },
            select: { invoiceId: true, invoiceInstallmentId: true, safeId: true, bankAccountId: true },
          }),
          prisma.cheque.findMany({
            where: {
              companyId: filters.companyId,
              invoiceId: { in: invoiceIds },
              status: { not: 'CANCELLED' },
            },
            select: { invoiceId: true, status: true },
          }),
        ])
      : [[], []];
    const settlementsByInvoice = new Map<string, SettlementHint[]>();
    const settlementsByInstallment = new Map<string, SettlementHint[]>();
    const pushHint = (bucket: Map<string, SettlementHint[]>, key: string, hint: SettlementHint) => {
      const current = bucket.get(key) ?? [];
      current.push(hint);
      bucket.set(key, current);
    };
    for (const row of cashRows) {
      if (!row.invoiceId) continue;
      const hint: SettlementHint = { channel: row.bankAccountId ? 'bank' : 'cash' };
      if (row.invoiceInstallmentId) pushHint(settlementsByInstallment, row.invoiceInstallmentId, hint);
      else pushHint(settlementsByInvoice, row.invoiceId, hint);
    }
    for (const row of chequeRows) {
      if (!row.invoiceId) continue;
      pushHint(settlementsByInvoice, row.invoiceId, { channel: 'cheque', chequeStatus: row.status });
    }

    const sources: OverdueInvoiceInput[] = invoices.map((invoice) => ({
      invoiceId: invoice.id,
      invoiceDate: invoice.date,
      dueDate: invoice.dueDate,
      invoiceNumber: invoice.invoiceNumber,
      profileName: invoice.documentProfile?.nameAr ?? null,
      invoiceKind: invoice.invoiceKind,
      invoiceType: invoice.invoiceType,
      partyName: invoice.customer?.arabicName || invoice.supplier?.arabicName || '',
      invoiceTotal: n(invoice.netAmount),
      paidAmount: n(invoice.paidAmount),
      postedAt: invoice.postedAt,
      settlements: settlementsByInvoice.get(invoice.id) ?? [],
      installments: invoice.installments.map((installment) => ({
        id: installment.id,
        dueDate: installment.dueDate,
        amount: n(installment.amount),
        paidAmount: n(installment.paidAmount),
        isPaid: installment.isPaid,
        status: installment.status,
        paymentDate: installment.paymentDate,
        settlements: settlementsByInstallment.get(installment.id) ?? [],
      })),
    }));

    const built = filterOverduePaymentRows(buildOverduePaymentSheet(sources, asOf).rows, {
      debtOrder: typeof filters.debtOrder === 'string' ? filters.debtOrder : undefined,
      daysLateOp: typeof filters.daysLateOp === 'string' ? filters.daysLateOp : undefined,
      daysLateDays:
        filters.daysLateDays == null || filters.daysLateDays === ''
          ? null
          : Number(filters.daysLateDays),
      paymentChannel: typeof filters.paymentChannel === 'string' ? filters.paymentChannel : undefined,
      fromInvoice: typeof filters.fromInvoice === 'string' ? filters.fromInvoice : undefined,
      toInvoice: typeof filters.toInvoice === 'string' ? filters.toInvoice : undefined,
    });
    const total = built.rows.length;
    const start = (page - 1) * limit;
      return {
      data: built.rows.slice(start, start + limit),
      summary: built.summary,
        pagination: {
          page,
          limit,
        total,
        totalPages: total ? Math.ceil(total / limit) : 0,
        },
      };
  }

  /**
   * Get Overdue Payments Report
   */
  async getOverduePaymentsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    if (filters.allPayments) {
      try {
        return await this.getPaymentScheduleReport(filters, options);
      } catch (error) {
        logger.error({ error, filters, options }, 'Error generating overdue payments report');
        throw error;
      }
    }
    try {
      const { companyId, customerId, supplierId } = filters;
      const { page = 1, limit = 100 } = options;

      const now = new Date();
      const where: any = {
        companyId,
        ...postedUnlessRequested(filters),
        isCancelled: false,
        remainingAmount: { gt: 0 },
        dueDate: {
          lt: now,
        },
      };

      applyCustomerGroupWhere(where, filters);
      applySupplierGroupWhere(where, filters);
      if (filters.customerId || filters.customerCategoryId) {
        Object.assign(where, invoiceFamilyWhere(['SALE', 'SALE_RETURN']));
      }
      if (filters.supplierId || filters.supplierCategoryId) {
        Object.assign(where, invoiceFamilyWhere(['PURCHASE', 'PURCHASE_RETURN']));
      }

      const skip = (page - 1) * limit;

      applyReportUser(where, filters);
      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { dueDate: 'asc' },
          include: {
            customer: true,
            supplier: true,
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      const overdueInvoices = invoices.map((invoice) => {
        const daysOverdue = Math.floor(
          (now.getTime() - (invoice.dueDate?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24)
        );
        return {
          id: invoice.id,
          invoiceKind: invoice.invoiceKind,
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.date,
          customer: invoice.customer?.arabicName ?? '',
          supplier: invoice.supplier?.arabicName ?? '',
          remainingAmount: n(invoice.remainingAmount),
          dueDate: invoice.dueDate,
          daysOverdue,
        };
      });

      const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.remainingAmount, 0);

      return {
        data: overdueInvoices,
        summary: {
          totalOverdue,
          totalInvoices: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating overdue payments report');
      throw error;
    }
  }

  /**
   * Collections and late customer balances as of one date.
   * المستحق is not yet due, المتأخر is due and still open, التحصيلات is every collection.
   */
  async getCollectionsAndOverduesReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { page = 1, limit = 5000 } = options;
      return await loadCollectionsAndOverduesReport({
        companyId: filters.companyId,
        customerId: filters.customerId,
        customerCategoryId: filters.customerCategoryId,
        branchId: filters.branchId,
        asOf: filters.toDate ?? filters.asOfDate ?? new Date(),
        allAccounts: Boolean(filters.allAccounts),
        page,
        limit,
      });
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating collections and overdues report');
      throw error;
    }
  }

  /**
   * Get Invoices Profit Reports
   */
  async getInvoicesProfitReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, customerId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        ...invoiceFamilyWhere(['SALE', 'SALE_RETURN']),
        date: {
          gte: fromDate,
          lte: toDate,
        },
        ...postedUnlessRequested(filters),
        isCancelled: false,
      };

      applyCustomerGroupWhere(where, filters);

      applyReportUser(where, filters);
      const invoices = await prisma.invoice.findMany({
        where,
        include: {
          customer: { select: { arabicName: true } },
          documentProfile: { select: { nameAr: true } },
          adjustments: { select: { type: true, amount: true } },
          lines: {
            include: {
              item: true,
            },
          },
        },
      });

      const sheet = buildInvoiceProfitSheet(
        invoices.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.date,
          invoiceKind: invoice.invoiceKind,
          customerName: invoice.customer?.arabicName ?? '',
          invoicePattern: invoice.documentProfile?.nameAr?.trim() || '',
          totalAmount: Number(invoice.totalAmount || 0),
          lineCost: invoice.lines.reduce((sum, line) => sum + n(line.quantity) * lineUnitCost(line), 0),
          additionsAmount: sumStoredAdjustments(invoice.adjustments, 'ADDITION'),
          discountsAmount:
            sumStoredAdjustments(invoice.adjustments, 'DEDUCTION') + Number(invoice.discountAmount || 0),
        }))
      );

      return {
        data: sheet.rows.slice((page - 1) * limit, page * limit),
        summary: sheet.summary,
        pagination: {
          page,
          limit,
          total: sheet.rows.length,
          totalPages: Math.ceil(sheet.rows.length / limit) || 1,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating invoices profit report');
      throw error;
    }
  }

  /**
   * Get Items Profit Reports
   */
  async getItemsProfitReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    // Similar to stock profit but more detailed
    return this.getStockProfitReport(filters, options);
  }

  /**
   * Get Sales Commissions for Representatives Report
   */
  async getSalesCommissionsForRepresentativesReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, delegateId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('يرجى اختيار تاريخ البداية والنهاية');
      }

      const where: any = {
        companyId,
        ...invoiceFamilyWhere(['SALE', 'SALE_RETURN']),
        date: {
          gte: fromDate,
          lte: toDate,
        },
        ...postedUnlessRequested(filters),
        isCancelled: false,
      };

      if (delegateId) where.representativeId = delegateId;

      applyReportUser(where, filters);
      const [invoices, quantityRates, valuePolicies, policies] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: {
            delegate: true,
            lines: { include: { item: true } },
          },
        }),
        prisma.representativeCommissionQuantity.findMany({ where: { companyId } }),
        prisma.representativeCommissionValue.findMany({ where: { companyId }, include: { tiers: true } }),
        prisma.representativeCommissionPolicy.findMany({ where: { companyId }, include: { tiers: true } }),
      ]);
      const { resolveCommission } = await import('./commission-engine');


      // Group by delegate
      const delegateMap = new Map<string, any>();
      invoices.forEach((invoice) => {
        const delegateId = invoice.representativeId;
        if (delegateId) {
          if (!delegateMap.has(delegateId)) {
            delegateMap.set(delegateId, {
              delegate: invoice.delegate,
              totalSales: 0,
              invoiceCount: 0,
              commission: 0,
            });
          }
          const delegateData = delegateMap.get(delegateId)!;
          const sign = invoice.invoiceKind === 'SALE_RETURN' ? -1 : 1;
          const amount = Number(invoice.netAmount || invoice.totalAmount || 0);
          const delegate = invoice.delegate;
          const valueTiers = valuePolicies.find((row) => row.id === delegate?.salesCommissionsId)?.tiers ?? [];
          const policyTiers = policies.find((row) => row.id === delegate?.commissionPolicyId)?.tiers ?? [];
          const target = Number(valuePolicies.find((row) => row.id === delegate?.salesCommissionsId)?.target ?? 0);
          const collected = Number(invoice.remainingAmount ?? 0) <= 0.05;
          const collectionDays = collected
            ? 0
            : Math.max(0, Math.round((toDate.getTime() - new Date(invoice.date).getTime()) / 86400000));
          const resolved = resolveCommission({
            sign,
            netAmount: amount,
            collectionDays,
            paymentMethod: invoice.paymentMethod,
            commissionPercentage: delegate?.commissionPercentage != null ? Number(delegate.commissionPercentage) : null,
            lines: invoice.lines.map((line) => ({
              itemId: line.itemId,
              lineNet: Number(line.total ?? line.price ?? 0),
            })),
            quantityRates,
            valueTiers,
            policyTiers,
            achievementPct: target > 0 ? (amount / target) * 100 : null,
          });
          delegateData.totalSales += sign * amount;
          delegateData.invoiceCount += 1;
          delegateData.commission += resolved.amount;
          delegateData.rule = resolved.rule;
        }
      });

      const result = Array.from(delegateMap.values())
        .map((row) => ({
          delegate: row.delegate?.arabicName ?? '',
          totalSales: row.totalSales,
          invoiceCount: row.invoiceCount,
          commission: row.commission,
          rule: row.rule ?? '',
        }))
        .sort((a, b) => b.commission - a.commission)
        .slice((page - 1) * limit, page * limit);

      return {
        data: result,
        summary: {
          totalRepresentatives: delegateMap.size,
          totalCommissions: Array.from(delegateMap.values()).reduce(
            (sum, d) => sum + d.commission,
            0
          ),
        },
        pagination: {
          page,
          limit,
          total: delegateMap.size,
          totalPages: Math.ceil(delegateMap.size / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating sales commissions for representatives report');
      throw error;
    }
  }

  /**
   * Get Representatives Commissions Values Account Report
   */
  async getRepresentativesCommissionsValuesAccountReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    // Similar to sales commissions but with more detail
    return this.getSalesCommissionsForRepresentativesReport(filters, options);
  }

  /**
   * Get Representatives Commissions Quantities Account Report
   */
  async getRepresentativesCommissionsQuantitiesAccountReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, delegateId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        ...invoiceFamilyWhere(['SALE']),
        date: {
          gte: fromDate,
          lte: toDate,
        },
        ...postedUnlessRequested(filters),
        isCancelled: false,
      };

      if (delegateId) where.representativeId = delegateId;

      applyReportUser(where, filters);
      const invoices = await prisma.invoice.findMany({
        where,
        include: {
          delegate: true,
          lines: {
            include: {
              item: true,
            },
          },
        },
      });

      // Group by delegate and calculate quantities
      const delegateMap = new Map<string, any>();
      invoices.forEach((invoice) => {
        const delegateId = invoice.representativeId;
        if (delegateId) {
          if (!delegateMap.has(delegateId)) {
            delegateMap.set(delegateId, {
              delegate: invoice.delegate,
              totalQuantity: 0,
              invoiceCount: 0,
            });
          }
          const delegateData = delegateMap.get(delegateId)!;
          invoice.lines.forEach((line) => {
            delegateData.totalQuantity += Number(line.quantity);
          });
          delegateData.invoiceCount += 1;
        }
      });

      const result = Array.from(delegateMap.values())
        .map((row) => ({
          delegate: row.delegate?.arabicName ?? '',
          totalQuantity: row.totalQuantity,
          invoiceCount: row.invoiceCount,
        }))
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice((page - 1) * limit, page * limit);

      return {
        data: result,
        summary: {
          totalRepresentatives: delegateMap.size,
          totalQuantity: Array.from(delegateMap.values()).reduce(
            (sum, d) => sum + d.totalQuantity,
            0
          ),
        },
        pagination: {
          page,
          limit,
          total: delegateMap.size,
          totalPages: Math.ceil(delegateMap.size / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating representatives commissions quantities account report');
      throw error;
    }
  }

  /**
   * Get Items Analytical Movement on Representatives Report
   */
  async getItemsAnalyticalMovementOnRepresentativesReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, delegateId, itemId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        ...invoiceFamilyWhere(['SALE']),
        date: {
          gte: fromDate,
          lte: toDate,
        },
        ...postedUnlessRequested(filters),
        isCancelled: false,
      };

      if (delegateId) where.representativeId = delegateId;

      applyReportUser(where, filters);
      const [delegates, invoices] = await Promise.all([
        prisma.delegate.findMany({
          where: {
            companyId,
            role: 'DELEGATE',
            ...(delegateId ? { id: delegateId } : { isActive: true }),
          },
          select: { id: true, arabicName: true },
        }),
        prisma.invoice.findMany({
        where,
          select: {
            representativeId: true,
            delegate: { select: { arabicName: true } },
          lines: {
            ...(itemId ? { where: { itemId } } : {}),
              select: {
                itemId: true,
                quantity: true,
                total: true,
                item: { select: { serial: true, arabicName: true } },
              },
            },
          },
        }),
      ]);

      const lines: AnalyticalItemMovementLine[] = [];
      for (const invoice of invoices) {
        const representativeId = invoice.representativeId || 'none';
        for (const line of invoice.lines) {
          if (!line.itemId) continue;
          lines.push({
            itemId: line.itemId,
            itemSerial: line.item?.serial ?? '',
            itemName: line.item?.arabicName ?? '',
            delegateId: representativeId,
            delegateName: invoice.delegate?.arabicName || '',
            quantity: Number(line.quantity || 0),
            amount: Number(line.total || 0),
          });
        }
      }

      const built = buildItemsAnalyticalMovement(
        lines,
        delegates.map((delegate) => ({ id: delegate.id, name: delegate.arabicName }))
      );
      const total = built.rows.length;
      const skip = (page - 1) * limit;

      return {
        data: built.rows.slice(skip, skip + limit),
        summary: {
          ...built.summary,
          totalItems: built.summary.itemCount,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 0,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating items analytical movement on representatives report');
      throw error;
    }
  }

  /**
   * Get Detailed Invoice Movement Report
   * Shows detailed movement of items within invoices
   */
  async getDetailedInvoiceMovementReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, fromDate, toDate, invoiceId, itemId, warehouseId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const invoiceWhere: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        ...postedUnlessRequested(filters),
        isCancelled: false,
      };

      if (invoiceId) {
        invoiceWhere.id = invoiceId;
      }

      if (warehouseId) {
        invoiceWhere.warehouseId = warehouseId;
      }
      if (filters.customerId) invoiceWhere.customerId = filters.customerId;
      if (filters.supplierId) invoiceWhere.supplierId = filters.supplierId;
      if (filters.fromInvoice || filters.toInvoice) {
        invoiceWhere.invoiceNumber = {
          ...(filters.fromInvoice ? { gte: String(filters.fromInvoice) } : {}),
          ...(filters.toInvoice ? { lte: String(filters.toInvoice) } : {}),
        };
      }

      applyReportUser(invoiceWhere, filters);
      const invoices = await prisma.invoice.findMany({
        where: invoiceWhere,
        include: {
          lines: {
            where: itemId ? { itemId } : undefined,
            include: {
              item: {
                select: {
                  id: true,
                  serial: true,
                  arabicName: true,
                },
              },
            },
          },
          customer: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          supplier: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      // Flatten to show each line item movement
      const movementData = invoices.flatMap((invoice) => {
        return invoice.lines.map((line) => ({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.date,
          invoiceType: invoice.invoiceType,
          customerName: invoice.customer?.arabicName,
          supplierName: invoice.supplier?.arabicName,
          itemId: line.itemId,
          itemName: line.item?.arabicName,
          quantity: Number(line.quantity || 0),
          itemSerial: line.item?.serial ?? '',
          unitPrice: Number(line.price || 0),
          totalPrice: Number(line.total || 0),
          taxAmount: Number(line.taxAmount || 0),
          movementType: isSaleSide(invoice) ? 'out' : 'in',
        }));
      });

      const skip = (page - 1) * limit;
      const paginatedData = movementData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalMovements: movementData.length,
          totalIn: movementData.filter((m) => m.movementType === 'in').length,
          totalOut: movementData.filter((m) => m.movementType === 'out').length,
          totalValue: movementData.reduce((sum, m) => sum + m.totalPrice, 0),
        },
        pagination: {
          page,
          limit,
          total: movementData.length,
          totalPages: Math.ceil(movementData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating detailed invoice movement report');
      throw error;
    }
  }

  /**
   * Get Cost Center Item Movement Report
   * Shows item movements by cost center
   */
  async getCostCenterItemMovementReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    return this.getItemMovementReport(
      {
        ...filters,
        itemGroupId: filters.itemGroupId || filters.categoryId,
      },
      {
        ...options,
        groupBy: 'costCenter',
        limit: options.limit ?? 2000,
      }
    );
  }

  /**
   * Get Price List Report
   */
  async getPriceListReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, priceListId, itemId, warehouseId } = filters;
      const itemGroupId = filters.itemGroupId || filters.categoryId;
      const { page = 1, limit = 200 } = options;
      const skip = (page - 1) * limit;

      let categoryIds: string[] | undefined;
      if (itemGroupId) {
        const categories = await prisma.itemCategory.findMany({
          where: { companyId },
          select: { id: true, parentCategoryId: true },
        });
        categoryIds = expandTreeIds(
          String(itemGroupId),
          categories.map((row) => ({ id: row.id, parentId: row.parentCategoryId }))
        );
      }

      const itemScope: Record<string, unknown> = { companyId };
      if (itemId) itemScope.id = itemId;
      if (categoryIds) itemScope.categoryId = { in: categoryIds };
      if (warehouseId) {
        const warehouses = await prisma.warehouse.findMany({
          where: { companyId },
          select: { id: true, parentWarehouseId: true },
        });
        const warehouseIds = expandTreeIds(
          warehouseId,
          warehouses.map((row) => ({ id: row.id, parentId: row.parentWarehouseId }))
        );
        itemScope.warehouseBalances = { some: { warehouseId: { in: warehouseIds } } };
      }

      let selectedListName = '';
      if (priceListId) {
        const list = await prisma.priceList.findFirst({
          where: { id: priceListId, companyId },
          select: { arabicName: true, code: true },
        });
        selectedListName = list?.arabicName?.trim() || list?.code?.trim() || '';
      }

      let warehouseName = '';
      if (warehouseId) {
        const warehouse = await prisma.warehouse.findFirst({
          where: { id: warehouseId, companyId },
          select: { arabicName: true },
        });
        warehouseName = warehouse?.arabicName ?? '';
      }

      const cardWhere = { ...itemScope, ...inventoryCountItemWhere(filters) };
      const [items, total] = await Promise.all([
        prisma.item.findMany({
          where: cardWhere,
          skip,
          take: limit,
          orderBy: [{ category: { arabicName: 'asc' } }, { arabicName: 'asc' }],
          select: {
            id: true,
            serial: true,
            arabicName: true,
            priceRetail: true,
            retailPrice: true,
            lastPurchasePrice: true,
            category: { select: { arabicName: true } },
            prices: {
              where: {
                ...(priceListId ? { priceListId } : {}),
                priceList: { companyId, isActive: true },
              },
              include: {
                priceList: { select: { arabicName: true, code: true } },
                unit: { select: { arabicName: true, code: true } },
              },
            },
          },
        }),
        prisma.item.count({ where: cardWhere }),
      ]);

      const itemPurchase = (item: { lastPurchasePrice?: unknown }) => n(item.lastPurchasePrice);
      const itemSale = (item: { priceRetail?: unknown; retailPrice?: unknown }) =>
        n(item.priceRetail) || n(item.retailPrice);
      const data = items.flatMap((item) => {
        const base = {
        itemId: item.id,
        itemSerial: item.serial ?? '',
        itemName: item.arabicName,
          groupName: item.category?.arabicName ?? '',
          warehouseName,
          itemPurchasePrice: itemPurchase(item),
          itemSalePrice: itemSale(item),
        };
        if (!item.prices.length) {
          return [
            {
              ...base,
              priceListName: selectedListName || 'بطاقة الصنف',
        unitName: '',
              listPurchasePrice: 0,
              listSalePrice: 0,
            },
          ];
        }
        return item.prices.map((row) => ({
          ...base,
          priceListName:
            row.priceList?.arabicName?.trim() || row.priceList?.code?.trim() || selectedListName || 'بطاقة الصنف',
          unitName: row.unit?.arabicName ?? row.unit?.code ?? '',
          listPurchasePrice: n(row.purchasePrice),
          listSalePrice: n(row.retailPrice) || n(row.price),
        }));
      });

      return {
        data: paintReportLayout(data, filters),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating price list report');
      throw error;
    }
  }

  /**
   * Get Sales and Purchase Tax Report
   */
  async getSalesAndPurchaseTaxReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, branchId, currencyId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        ...(filters.showUnposted ? {} : { isPosted: true }),
        isCancelled: false,
        AND: [invoiceFamilyWhere(['SALE', 'SALE_RETURN', 'PURCHASE', 'PURCHASE_RETURN'])],
      };
      if (branchId) where.branchId = branchId;
      if (currencyId) {
        const currency = await prisma.currency.findFirst({
          where: { companyId, OR: [{ id: currencyId }, { code: currencyId }] },
          select: { code: true },
        });
        where.currencyCode = currency?.code ?? currencyId;
      }
      applyReportUser(where, filters);

      const invoices = await prisma.invoice.findMany({
        where,
        select: {
          date: true,
          invoiceKind: true,
          invoiceType: true,
          taxAmount: true,
          netAmount: true,
          totalAmount: true,
          discountAmount: true,
          lines: { select: { taxAmount: true } },
        },
      });

      const invoiceTax = (inv: { taxAmount?: unknown; lines?: { taxAmount?: unknown }[] }) => {
        const header = Number(inv.taxAmount || 0);
        if (header) return header;
        return (inv.lines ?? []).reduce((sum, line) => sum + Number(line.taxAmount || 0), 0);
      };
      const invoiceBase = (inv: {
        taxAmount?: unknown;
        netAmount?: unknown;
        totalAmount?: unknown;
        discountAmount?: unknown;
        lines?: { taxAmount?: unknown }[];
      }) => {
        const tax = invoiceTax(inv);
        const net = Number(inv.netAmount || 0);
        if (net) return net - tax;
        return Number(inv.totalAmount || 0) - Number(inv.discountAmount || 0);
      };

      type MonthBucket = {
        year: string;
        month: string;
        salesAmount: number;
        salesTax: number;
        salesReturnAmount: number;
        salesReturnTax: number;
        purchaseAmount: number;
        purchaseTax: number;
        purchaseReturnAmount: number;
        purchaseReturnTax: number;
      };
      const buckets = new Map<string, MonthBucket>();
      const start = fromDate.getUTCFullYear() * 12 + fromDate.getUTCMonth();
      const end = toDate.getUTCFullYear() * 12 + toDate.getUTCMonth();
      for (let index = start; index <= end; index += 1) {
        const year = Math.floor(index / 12);
        const month = (index % 12) + 1;
        const key = `${year}-${month}`;
        buckets.set(key, {
          year: String(year),
          month: String(month),
          salesAmount: 0,
          salesTax: 0,
          salesReturnAmount: 0,
          salesReturnTax: 0,
          purchaseAmount: 0,
          purchaseTax: 0,
          purchaseReturnAmount: 0,
          purchaseReturnTax: 0,
        });
      }

      for (const inv of invoices) {
        const when = new Date(inv.date);
        const key = `${when.getUTCFullYear()}-${when.getUTCMonth() + 1}`;
        const bucket = buckets.get(key);
        if (!bucket) continue;
        const base = invoiceBase(inv);
        const tax = invoiceTax(inv);
        if (isSaleReturn(inv)) {
          bucket.salesReturnAmount += base;
          bucket.salesReturnTax += tax;
        } else if (isPurchaseReturn(inv)) {
          bucket.purchaseReturnAmount += base;
          bucket.purchaseReturnTax += tax;
        } else if (inv.invoiceKind === 'PURCHASE' || inv.invoiceType === 'purchase') {
          bucket.purchaseAmount += base;
          bucket.purchaseTax += tax;
        } else {
          bucket.salesAmount += base;
          bucket.salesTax += tax;
        }
      }

      const rows = [...buckets.values()].map((bucket) => {
        const netSales = bucket.salesAmount - bucket.salesReturnAmount;
        const netSalesTax = bucket.salesTax - bucket.salesReturnTax;
        const netPurchases = bucket.purchaseAmount - bucket.purchaseReturnAmount;
        const netPurchaseTax = bucket.purchaseTax - bucket.purchaseReturnTax;
        return {
          ...bucket,
          netSales,
          netSalesTax,
          netPurchases,
          netPurchaseTax,
          finalTax: netSalesTax - netPurchaseTax,
        };
      });

      const totalSalesTax = rows.reduce((sum, row) => sum + row.netSalesTax, 0);
      const totalPurchaseTax = rows.reduce((sum, row) => sum + row.netPurchaseTax, 0);
      const skip = (page - 1) * limit;

      return {
        data: rows.slice(skip, skip + limit),
        summary: {
          totalSalesTax,
          totalPurchaseTax,
          netTax: totalSalesTax - totalPurchaseTax,
        },
        pagination: {
          page,
          limit,
          total: rows.length,
          totalPages: Math.ceil(rows.length / limit) || 1,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating sales and purchase tax report');
      throw error;
    }
  }

  /**
   * أصناف راكدة: رصيد موجود وآخر حركة أقدم من بداية الفترة (أو ٩٠ يوماً).
   */
  async getSlowMovingReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    const { companyId, warehouseId, itemId, fromDate, toDate } = filters;
    const { page = 1, limit = 100 } = options;
    const asOf = toDate ?? new Date();
    const cutoff = fromDate ?? new Date(asOf.getTime() - 90 * 24 * 60 * 60 * 1000);

    const balances = await prisma.itemWarehouseBalance.findMany({
      where: {
        companyId,
        quantityOnHand: { gt: 0 },
        ...(warehouseId ? { warehouseId } : {}),
        ...(itemId ? { itemId } : {}),
      },
      include: {
        item: { select: ITEM_SELECT },
        warehouse: { select: WAREHOUSE_SELECT },
      },
    });

    const lastMoves = await prisma.inventoryMovement.groupBy({
      by: ['itemId', 'warehouseId'],
      where: { companyId },
      _max: { documentDate: true },
    });
    const lastByKey = new Map(
      lastMoves.map((row) => [`${row.warehouseId}:${row.itemId}`, row._max.documentDate])
    );

    const rows = balances
      .map((row) => {
        const lastMovementAt = lastByKey.get(`${row.warehouseId}:${row.itemId}`) ?? null;
        return {
          itemId: row.itemId,
          warehouseId: row.warehouseId,
          itemSerial: row.item?.serial ?? '',
          itemName: row.item?.arabicName ?? '',
          warehouseName: row.warehouse?.arabicName ?? '',
          quantityOnHand: n(row.quantityOnHand),
          lastMovementAt,
        };
      });
    if (filters.showUnposted) {
      await addUnpostedStockQty(
        companyId,
        rows,
        { showUnposted: true, toDate: asOf },
        (row, quantity) => {
          row.quantityOnHand = quantity;
        },
        (row) => row.quantityOnHand
      );
    }
    const slowRows = rows.filter((row) => !row.lastMovementAt || row.lastMovementAt < cutoff);

    const skip = (page - 1) * limit;
    return {
      data: slowRows.slice(skip, skip + limit),
      summary: { totalItems: slowRows.length, cutoff: cutoff.toISOString() },
      pagination: {
        page,
        limit,
        total: slowRows.length,
        totalPages: Math.ceil(slowRows.length / limit),
      },
    };
  }
}

export const inventoryReportsService = new InventoryReportsService();
