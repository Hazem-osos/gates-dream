import { computeInvoiceFinancialSummary } from './computeInvoiceFinancialSummary';
import { mapDiscountToM5Payload, type DiscountType } from './discount-type';
import { parsePricingCalculationBasis, syncLineUnitFields } from './unit-conversion';

type CurrencyLike = { id: string; code: string };
type ItemUnitLike = {
  unitId?: string;
  isBaseUnit?: boolean;
  isFactorFixed?: boolean | null;
  conversionFactor?: number | string | null;
  unit?: { id: string };
};
type ItemLike = { id: string; units?: ItemUnitLike[] };

export type SalesInvoiceLineForm = {
  itemId: string;
  unitId?: string;
  quantity: number;
  baseQuantity?: number;
  conversionFactor?: number;
  baseUnitId?: string;
  unitPrice: number;
  discount?: number;
  discountValue?: number;
  discountType?: DiscountType | string;
  taxRate?: number;
  /** H10 fix: the original sold/purchased line this return line reverses. */
  originalInvoiceLineId?: string;
  /** Sales Invoice Enterprise Redesign: purely descriptive lot/traceability +
   * note fields (InvoiceLine.batchNumber/expiryDate/productionDate/
   * serialNumbers/lineNotes/taxExemptionReason) — collected by the line grid
   * since before this redesign but previously dropped here before reaching
   * the API. */
  batchNumber?: string;
  expiryDate?: string;
  productionDate?: string;
  serialNumbers?: string;
  lineNotes?: string;
  taxExemptionReason?: string;
  warehouseId?: string;
  costCenterId?: string;
  withholdingTaxRate?: number;
  withholdingTaxAmount?: number;
  batchAllocations?: Array<{
    batchId?: string;
    batchNumber: string;
    qty: number;
    expiryDate?: string | null;
  }>;
  color?: string;
  size?: string;
  customRevenueAccountId?: string;
  lineAccountId?: string;
};

function optionalUuid(value?: string | null): string | undefined {
  const id = String(value ?? '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id
    : undefined;
}

export function resolveItemUnitId(
  itemId: string,
  items: ItemLike[],
  explicitUnitId?: string,
  fallbackUnitId?: string
): string | undefined {
  if (explicitUnitId?.trim()) return explicitUnitId.trim();
  const item = items.find((i) => i.id === itemId);
  const link = item?.units?.find((u) => u.isBaseUnit) ?? item?.units?.[0];
  return link?.unit?.id ?? link?.unitId ?? fallbackUnitId?.trim() ?? undefined;
}

type M5FormData = {
  invoiceNumber?: string;
  description?: string;
  date?: string;
  dueDate?: string;
  hijriDate?: string;
  customerId?: string;
  supplierId?: string;
  warehouseId: string;
  documentProfileId?: string;
  costCenterId?: string;
  delegateId?: string;
  driverId?: string;
  distributorId?: string;
  sellerId?: string;
  currencyId?: string;
  exchangeRate?: number;
  taxTreatmentType?: 'taxable' | 'exempt' | 'export';
  isDelivered?: boolean;
  handoverDate?: string;
  paymentMethod?: string;
  paymentSplits?: unknown;
  internalNotes?: unknown;
  allowReturn?: boolean;
  returnDays?: number | null;
  invoiceConditions?: string[];
  developmentFeeEnabled?: boolean;
  developmentFeeMode?: 'percent' | 'fixed';
  developmentFeeRate?: number;
  developmentFeeFixedAmount?: number;
  pricingCalculationBasis?: string;
  sourceType?: string;
  sourceId?: string;
  sourceNumber?: string;
  originalInvoiceId?: string;
  originalInvoiceNumber?: string;
  installments?: Array<{
    installmentNumber: number;
    dueDate: string;
    hijriDueDate?: string;
    amount: number;
    notes?: string;
  }>;
  adjustments?: unknown;
  lines: SalesInvoiceLineForm[];
};

export function mapSalesFormToM5CreateBody(
  data: M5FormData,
  opts: {
    invoiceKind: 'SALE' | 'PURCHASE' | 'SALE_RETURN' | 'PURCHASE_RETURN';
    currencies: CurrencyLike[];
    items: ItemLike[];
    applyTax?: boolean;
    fallbackUnitId?: string;
  }
): Record<string, unknown> {
  const applyTax = opts.applyTax !== false;
  const currency = opts.currencies.find((c) => c.id === data.currencyId);
  const currencyCode = currency?.code ?? 'EGP';
  const pricingCalculationBasis = parsePricingCalculationBasis(data.pricingCalculationBasis);
  const filledLines = data.lines.filter((line) => Boolean(line.itemId?.trim()));
  const feePreview = computeInvoiceFinancialSummary(filledLines, {
    applyTax,
    developmentFeeEnabled: data.developmentFeeEnabled,
    developmentFeeMode: data.developmentFeeMode,
    developmentFeeRate: data.developmentFeeRate,
    developmentFeeFixedAmount: data.developmentFeeFixedAmount,
    pricingCalculationBasis,
  });

  const lines = filledLines.map((line, index) => {
    const unitId = resolveItemUnitId(line.itemId, opts.items, line.unitId, opts.fallbackUnitId);
    const item = opts.items.find((i) => i.id === line.itemId);
    const synced = syncLineUnitFields(
      {
        quantity: line.quantity || 1,
        baseQuantity: line.baseQuantity,
        conversionFactor: line.conversionFactor,
        unitId,
        baseUnitId: line.baseUnitId,
      },
      item?.units,
      { quantity: line.quantity || 1, baseQuantity: line.baseQuantity }
    );
    const qty = Number(synced.quantity) || 1;
    return {
      itemId: line.itemId,
      ...(optionalUuid(unitId) ? { unitId: optionalUuid(unitId) } : {}),
      quantity: qty,
      baseQuantity: Number(synced.baseQuantity) || qty,
      conversionFactor: Number(synced.conversionFactor) || 1,
      baseUnitId: optionalUuid(synced.baseUnitId),
      price: Number(line.unitPrice) || 0,
      ...mapDiscountToM5Payload(line),
      taxPercent: applyTax ? (line.taxRate ?? 0) : 0,
      lineOrder: index + 1,
      originalInvoiceLineId: optionalUuid(line.originalInvoiceLineId),
      batchNumber: line.batchNumber || undefined,
      expiryDate: line.expiryDate ? new Date(line.expiryDate).toISOString() : undefined,
      productionDate: line.productionDate ? new Date(line.productionDate).toISOString() : undefined,
      serialNumbers: line.serialNumbers || undefined,
      lineNotes: line.lineNotes || undefined,
      taxExemptionReason: line.taxExemptionReason || undefined,
      warehouseId: optionalUuid(line.warehouseId) || optionalUuid(data.warehouseId),
      costCenterId: optionalUuid(line.costCenterId),
      withholdingTaxRate: line.withholdingTaxRate || undefined,
      withholdingTaxAmount: line.withholdingTaxAmount || undefined,
      batchAllocations: line.batchAllocations?.length ? line.batchAllocations : undefined,
      color: line.color || undefined,
      size: line.size || undefined,
      customRevenueAccountId: optionalUuid(line.customRevenueAccountId) || optionalUuid(line.lineAccountId),
    };
  });

  return {
    invoiceKind: opts.invoiceKind,
    invoiceNumber: data.invoiceNumber || undefined,
    description: data.description || undefined,
    date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(),
    dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
    hijriDate: data.hijriDate || undefined,
    currencyCode,
    exchangeRate: data.exchangeRate && data.exchangeRate > 0 ? data.exchangeRate : undefined,
    customerId: optionalUuid(data.customerId),
    supplierId: optionalUuid(data.supplierId),
    warehouseId: data.warehouseId,
    documentProfileId: optionalUuid(data.documentProfileId),
    sourceType: data.sourceType && data.sourceType !== 'NONE' ? data.sourceType : 'NONE',
    sourceId: optionalUuid(data.sourceId),
    sourceNumber: data.sourceNumber || undefined,
    originalInvoiceId: optionalUuid(data.originalInvoiceId),
    originalInvoiceNumber: data.originalInvoiceNumber || undefined,
    costCenterId: optionalUuid(data.costCenterId),
    representativeId: optionalUuid(data.delegateId),
    ...(optionalUuid(data.driverId) ? { driverId: optionalUuid(data.driverId) } : {}),
    ...(optionalUuid(data.distributorId) ? { distributorId: optionalUuid(data.distributorId) } : {}),
    sellerId: optionalUuid(data.sellerId),
    taxTreatmentType: data.taxTreatmentType || undefined,
    isDelivered: data.isDelivered ?? false,
    handoverDate: data.handoverDate ? new Date(data.handoverDate).toISOString() : undefined,
    paymentMethod: data.paymentMethod,
    paymentSplits: Array.isArray(data.paymentSplits) && data.paymentSplits.length ? data.paymentSplits : undefined,
    internalNotes: data.internalNotes,
    isSalesTaxInvoice: applyTax,
    allowReturn: data.allowReturn ?? false,
    returnDays: data.allowReturn ? (data.returnDays ?? 365) : null,
    invoiceConditions: data.invoiceConditions,
    developmentFeeRate: feePreview.developmentFeeRate,
    developmentFeeAmount: feePreview.developmentFeeAmount,
    withholdingTaxAmount: feePreview.withholdingTaxAmount,
    pricingCalculationBasis,
    installments: data.installments?.length
      ? data.installments.map((row) => ({
          installmentNumber: row.installmentNumber,
          dueDate: row.dueDate,
          hijriDueDate: row.hijriDueDate || undefined,
          amount: row.amount,
          notes: row.notes || undefined,
        }))
      : data.installments,
    adjustments: data.adjustments,
    lines,
  };
}

/** PUT /invoices/:id — same payload minus `invoiceKind`, which is immutable. */
export function mapSalesFormToM5UpdateBody(
  data: M5FormData,
  opts: {
    invoiceKind: 'SALE' | 'PURCHASE' | 'SALE_RETURN' | 'PURCHASE_RETURN';
    currencies: CurrencyLike[];
    items: ItemLike[];
    applyTax?: boolean;
    fallbackUnitId?: string;
    /**
     * Wave 5 fix: the backend's M14 optimistic-lock guard
     * (`InvoiceM5Service.update`) rejects the write with 409 when
     * `expectedVersion` doesn't match the row's current `version` — but it
     * only does that when the caller actually sends one. The frontend never
     * did, so two people editing the same draft invoice always resolved as
     * last-write-wins with no warning. Pass the `version` read from the
     * GET that populated the form so a stale edit is rejected instead of
     * silently overwriting a newer save.
     */
    expectedVersion?: number;
  }
): Record<string, unknown> {
  const body = mapSalesFormToM5CreateBody(data, opts);
  delete body.invoiceKind;
  if (typeof opts.expectedVersion === 'number') {
    body.expectedVersion = opts.expectedVersion;
  }
  return body;
}
