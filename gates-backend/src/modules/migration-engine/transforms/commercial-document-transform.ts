import { money } from '../accounting/journal-money';
import { legacyBool, legacyDate, legacyTrim } from './legacy-values';

function dec(value: unknown, _places?: number) {
  return money(value);
}
import type {
  LegacyCashHeaderRow,
  LegacyInvoiceDetailRow,
  LegacyInvoiceHeaderRow,
} from '../services/legacy-commercial-data.service';
import { mapLegacyInvoiceSourceDocumentType } from '../commercial/legacy-invoice-source-type';
import { pickLegacyInvoiceHeaderMetadata } from '../commercial/migration-invoice-legacy-metadata';
import { buildInvoiceLineNotes, parseColorSize } from '../commercial/migration-invoice-line-legacy-metadata';

/** Legacy NewModule codes observed on InvoiceTrxHeader.Type (inventory + numbering families). */
const INVOICE_KIND_BY_TYPE: Record<string, { invoiceKind: string; invoiceType: string; moduleCode: string }> = {
  SI01: { invoiceKind: 'SALE', invoiceType: 'sales', moduleCode: 'SI01' },
  SI02: { invoiceKind: 'SALE', invoiceType: 'sales', moduleCode: 'SI02' },
  PI01: { invoiceKind: 'PURCHASE', invoiceType: 'purchase', moduleCode: 'PI01' },
  PI02: { invoiceKind: 'PURCHASE', invoiceType: 'purchase', moduleCode: 'PI02' },
  SR01: { invoiceKind: 'SALE_RETURN', invoiceType: 'sales', moduleCode: 'SR01' },
  SR99: { invoiceKind: 'SALE_RETURN', invoiceType: 'sales', moduleCode: 'SR99' },
  PR01: { invoiceKind: 'PURCHASE_RETURN', invoiceType: 'purchase', moduleCode: 'PR01' },
  PR02: { invoiceKind: 'PURCHASE_RETURN', invoiceType: 'purchase', moduleCode: 'PR02' },
  SV01: { invoiceKind: 'SALE', invoiceType: 'sales', moduleCode: 'SV01' },
  SV03: { invoiceKind: 'SALE', invoiceType: 'sales', moduleCode: 'SV03' },
};

export function mapLegacyInvoiceKind(type: string): { invoiceKind: string; invoiceType: string; moduleCode: string } | null {
  const key = legacyTrim(type).toUpperCase();
  if (INVOICE_KIND_BY_TYPE[key]) return INVOICE_KIND_BY_TYPE[key];
  const t = key;
  // Returns first: an unlisted PR0x / SR0x must not fall into the generic purchase / sale rule.
  // Only the known families (SR/PR/PI/SI/SV + number). Anything else (PO, SO, QT, …) returns null
  // and is BLOCKED as UNKNOWN_INVOICE_TYPE — never guessed as a sale or purchase.
  if (t.startsWith('SR')) {
    return { invoiceKind: 'SALE_RETURN', invoiceType: 'sales', moduleCode: key.slice(0, 4) };
  }
  if (t.startsWith('PR')) {
    return { invoiceKind: 'PURCHASE_RETURN', invoiceType: 'purchase', moduleCode: key.slice(0, 4) };
  }
  if (t.startsWith('PI')) return { invoiceKind: 'PURCHASE', invoiceType: 'purchase', moduleCode: key.slice(0, 4) };
  if (t.startsWith('SI') || t.startsWith('SV')) return { invoiceKind: 'SALE', invoiceType: 'sales', moduleCode: key.slice(0, 4) };
  return null;
}

export function transformHistoricalInvoiceHeader(
  row: LegacyInvoiceHeaderRow,
  ids: {
    companyId: string;
    branchId?: string | null;
    fiscalYearId?: string | null;
    customerId?: string | null;
    supplierId?: string | null;
    warehouseId?: string | null;
    costCenterId?: string | null;
    journalEntryId?: string | null;
    originalInvoiceId?: string | null;
    originalInvoiceNumber?: string | null;
    /** Non-posted historical shells — no journal link, no repost. */
    historicalShell?: 'DRAFT' | 'CANCELLED' | null;
    legacyStatus?: string | null;
  }
) {
  const kind = mapLegacyInvoiceKind(String(row.Type ?? ''));
  if (!kind) throw new Error(`Unknown invoice Type ${legacyTrim(row.Type)}`);

  const net = dec(row.NetValue ?? row.NetAmount ?? row.Net);
  const paidExplicit = row.PaidAmount != null && row.PaidAmount !== '' ? dec(row.PaidAmount) : null;
  const remainingExplicit =
    row.RemainingValue != null && row.RemainingValue !== '' ? dec(row.RemainingValue) : null;
  const paid = paidExplicit ?? (remainingExplicit != null ? net.sub(remainingExplicit) : dec(0));
  const remaining = remainingExplicit ?? net.sub(paid);
  let paymentStatus = 'UNPAID';
  if (remaining.lte(0.01)) paymentStatus = 'PAID';
  else if (paid.gt(0.01)) paymentStatus = 'PARTIALLY_PAID';

  return {
    companyId: ids.companyId,
    branchId: ids.branchId ?? null,
    fiscalYearId: ids.fiscalYearId ?? null,
    invoiceNumber: legacyTrim(row.InvoiceNum),
    invoiceKind: kind.invoiceKind,
    invoiceType: kind.invoiceType,
    moduleCode: kind.moduleCode,
    date: legacyDate(row.Date) ?? new Date(),
    hijriDate: legacyTrim(row.DateH) || null,
    description: legacyTrim(row.DescA) || null,
    currencyCode: legacyTrim(row.CurrencyCode) || 'EGP',
    exchangeRate: dec(row.Change ?? 1),
    sourceYearId: legacyTrim(row.YearID) || null,
    customerId: ids.customerId ?? null,
    supplierId: ids.supplierId ?? null,
    warehouseId: ids.warehouseId ?? null,
    costCenterId: ids.costCenterId ?? null,
    allowReturn: legacyBool(row.AllowReturn, false),
    returnDays: row.Days != null ? parseInt(String(row.Days), 10) || null : null,
    internalNotes: (() => {
      const meta = pickLegacyInvoiceHeaderMetadata(row as Record<string, unknown>);
      return Object.keys(meta).length ? { legacyMigration: meta } : undefined;
    })(),
    totalAmount: dec(row.TotalValue ?? row.TotalAmount ?? row.Total),
    discountAmount: dec(row.DiscountValue ?? row.Discount ?? row.OfferAmount),
    taxAmount: dec(row.DaribaValue ?? row.SalesDaribaAmount ?? row.TaxValue),
    netAmount: net,
    paidAmount: paid.gt(0) ? paid : dec(0),
    remainingAmount: remaining,
    paymentStatus,
    isPosted: !ids.historicalShell,
    postedAt: ids.historicalShell ? null : legacyDate(row.Date) ?? new Date(),
    postedBy: ids.historicalShell ? null : 'legacy-historical-import',
    isCancelled: ids.historicalShell === 'CANCELLED' || legacyBool(row.Deleted, false),
    workflowStatus:
      ids.historicalShell === 'CANCELLED'
        ? 'CANCELLED'
        : ids.historicalShell === 'DRAFT'
          ? legacyTrim(row.Status).toLowerCase() === 'unpost'
            ? 'UNPOSTED'
            : 'DRAFT'
          : 'POSTED',
    paymentMethod: legacyTrim(row.CashType) ? 'cash' : 'credit',
    journalEntryId: ids.historicalShell ? null : ids.journalEntryId ?? null,
    record: ids.historicalShell ? null : ids.journalEntryId ? legacyTrim(row.GLNum) : null,
    originalInvoiceId: ids.originalInvoiceId ?? null,
    originalInvoiceNumber: ids.originalInvoiceNumber ?? null,
    sourceType: mapLegacyInvoiceSourceDocumentType(
      row.SourceType ?? row.OrderType,
      row.SourceNum ?? row.OrderNum
    ),
    sourceNumber: legacyTrim(row.SourceNum) || legacyTrim(row.OrderNum) || null,
  };
}

export function transformHistoricalInvoiceLine(
  row: LegacyInvoiceDetailRow,
  ids: {
    invoiceId: string;
    itemId: string;
    unitId: string;
    baseUnitId?: string | null;
    warehouseId?: string | null;
    costCenterId?: string | null;
    conversionFactor?: ReturnType<typeof dec>;
  }
) {
  const qty = dec(row.Qty2 ?? row.Qty1 ?? row.Quantity ?? row.Qty);
  const baseQty = dec(row.Qty1 ?? row.Qty2 ?? row.Qty);
  const price = dec(row.Price ?? row.UnitPrice);
  const lineOrder = parseInt(String(row.LineNum ?? row.GridNum ?? row.Serial ?? '1'), 10) || 1;
  const discPct = row.DiscPercent != null ? dec(row.DiscPercent) : null;
  const taxPct = row.DaribaPercent != null ? dec(row.DaribaPercent) : null;
  const cost = row.CostPrice != null ? dec(row.CostPrice) : null;
  const { color, size } = parseColorSize(row.ItemColorSizeCode);
  const notes = buildInvoiceLineNotes(row as Record<string, unknown>);
  return {
    invoiceId: ids.invoiceId,
    itemId: ids.itemId,
    unitId: ids.unitId,
    baseUnitId: ids.baseUnitId ?? ids.unitId,
    warehouseId: ids.warehouseId ?? null,
    costCenterId: ids.costCenterId ?? null,
    quantity: qty,
    baseQuantity: baseQty,
    conversionFactor: ids.conversionFactor ?? dec(1),
    price,
    total: dec(row.TotalValue ?? row.NetValue ?? qty.mul(price)),
    discountPercent: discPct && discPct.gt(0) ? discPct : null,
    discountAmount: dec(row.DiscValue ?? row.DiscountValue ?? 0),
    taxPercent: taxPct && taxPct.gt(0) ? taxPct : null,
    taxAmount: dec(row.DaribaValue ?? 0),
    unitCostAtIssue: cost && cost.gt(0) ? cost : null,
    serialNumbers: legacyTrim(row.SerialNums) || null,
    expiryDate: legacyDate(row.ExpDate),
    color,
    size,
    lineNotes: notes,
    lineOrder,
  };
}

export function invoiceSourceKeyParts(row: LegacyInvoiceHeaderRow, companyCode: string) {
  return {
    companyCode,
    branchCode: legacyTrim(row.BranchCode),
    yearId: legacyTrim(row.YearID),
    type: legacyTrim(row.Type),
    invoiceNum: legacyTrim(row.InvoiceNum),
  };
}

export function cashSourceKeyParts(row: LegacyCashHeaderRow, companyCode: string) {
  return {
    companyCode,
    branchCode: legacyTrim(row.BranchCode),
    yearId: legacyTrim(row.YearID),
    type: legacyTrim(row.Type),
    cashNum: legacyTrim(row.CashNum ?? row.TrxNum),
  };
}

export function transformHistoricalCashHeader(
  row: LegacyCashHeaderRow,
  ids: {
    companyId: string;
    branchId?: string | null;
    fiscalYearId?: string | null;
    customerId?: string | null;
    supplierId?: string | null;
    offsetAccountId?: string | null;
    journalEntryId: string;
    invoiceId?: string | null;
    bankAccountId?: string | null;
  }
) {
  const kindRaw = legacyTrim(row.TrxType ?? row.Type ?? row.CashType).toUpperCase();
  const isPayment =
    kindRaw.startsWith('BP') ||
    kindRaw.startsWith('KP') ||
    kindRaw.includes('PAY') ||
    kindRaw.includes('PAYMENT');
  const isReceipt =
    kindRaw.startsWith('BR') ||
    kindRaw.startsWith('KR') ||
    kindRaw.includes('REC') ||
    kindRaw.includes('RECEIPT');
  const transactionKind = isPayment && !isReceipt ? 'PAYMENT' : isReceipt && !isPayment ? 'RECEIPT' : isPayment ? 'PAYMENT' : 'RECEIPT';
  const exchangeRate = dec(row.Change ?? 1);
  return {
    companyId: ids.companyId,
    branchId: ids.branchId ?? null,
    fiscalYearId: ids.fiscalYearId ?? null,
    transactionKind,
    voucherNumber: legacyTrim(row.CashNum ?? row.VoucherNum ?? row.TrxNum),
    date: legacyDate(row.Date) ?? new Date(),
    description: legacyTrim(row.DescA ?? row.Description) || null,
    amount: dec(row.Amount ?? row.Value),
    currencyCode: legacyTrim(row.CurrencyCode) || 'EGP',
    exchangeRate,
    customerId: ids.customerId ?? null,
    supplierId: ids.supplierId ?? null,
    offsetAccountId: ids.offsetAccountId ?? null,
    bankAccountId: ids.bankAccountId ?? null,
    invoiceId: ids.invoiceId ?? null,
    journalEntryId: ids.journalEntryId,
    isPosted: true,
    postedAt: legacyDate(row.Date) ?? new Date(),
    postedBy: 'legacy-historical-import',
    isCancelled: legacyBool(row.Deleted, false),
    workflowStatus: 'POSTED',
    executionStatus: 'COMPLETED' as const,
  };
}

export type LegacyCashDetailRow = {
  CompanyCode?: unknown;
  BranchCode?: unknown;
  YearID?: unknown;
  CashNum?: unknown;
  Type?: unknown;
  DetailNum?: unknown;
  AccountNo?: unknown;
  CCenterCode?: unknown;
  Amount?: unknown;
  CurrencyCode?: unknown;
  Change?: unknown;
  Accepted?: unknown;
  InvoiceType?: unknown;
  InvoiceYearId?: unknown;
  InvoiceNum?: unknown;
  DetailDescA?: unknown;
};

export function transformHistoricalCashLine(
  row: LegacyCashDetailRow,
  ids: {
    companyId: string;
    cashTransactionId: string;
    accountId: string;
    costCenterId?: string | null;
    invoiceId?: string | null;
    lineOrder: number;
    entrySide?: 'DEBIT' | 'CREDIT';
  }
) {
  const invNum = legacyTrim(row.InvoiceNum);
  return {
    companyId: ids.companyId,
    cashTransactionId: ids.cashTransactionId,
    accountId: ids.accountId,
    description: legacyTrim(row.DetailDescA) || null,
    amount: dec(row.Amount),
    currencyCode: legacyTrim(row.CurrencyCode) || 'EGP',
    exchangeRate: dec(row.Change ?? 1),
    costCenterId: ids.costCenterId ?? null,
    entrySide: ids.entrySide ?? ('DEBIT' as const),
    isTiedToInvoice: Boolean(invNum),
    invoiceId: ids.invoiceId ?? null,
    lineOrder: ids.lineOrder,
  };
}

export function cashDetailSourceKeyParts(row: LegacyCashDetailRow, companyCode: string) {
  return {
    companyCode,
    branchCode: legacyTrim(row.BranchCode),
    yearId: legacyTrim(row.YearID),
    cashType: legacyTrim(row.Type),
    cashNum: legacyTrim(row.CashNum),
    detailNum: legacyTrim(row.DetailNum),
  };
}
