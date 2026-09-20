import prisma from '../../../shared/database/prisma';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';
import { assertExpectedVersion, throwStaleWrite } from '../../../shared/concurrency/optimistic-lock';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { resolveHijriDate } from '../../../shared/utils/hijri-date';
import type {
  CreateM5InvoiceInput,
  UpdateM5InvoiceInput,
} from '../schemas/invoice-m5.schema';
import type { InvoiceKind } from '../types/invoice-posting.types';
import {
  assertDraftInvoiceIntegrity,
  assertNoOverReturn,
  resolveInvoiceLineWarehouseId,
} from './invoice-m5-integrity.service';
import { computeInvoiceAmounts, computeLineAmounts, resolveDevelopmentFee } from './invoice-line-math';
import { sumPartyAdjustments } from './invoice-adjustment.math';
import { replaceInvoiceAdjustmentsInTx } from './invoice-adjustment.persist';
import {
  normalizeInvoiceLineUnits,
  resolveCompanyPricingBasis,
  resolvePricedQuantity,
  type PricingCalculationBasis,
} from './invoice-unit-conversion';
import { replaceInvoiceInstallmentsInTx } from './invoice-installment.service';
import { documentAuditService } from '../../accounting/services/document-audit.service';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { emitDomainEvent } from '../../automation/events/automation-event-bus.service';
import { persistFxDecimal } from '../../accounting/utils/company-fx-rate';
import { documentProfileService } from '../../document-profiles/services/document-profile.service';
import {
  applyProfileLocks,
  assertProfileMatchesInvoiceKind,
  nextProfileInvoiceNumber,
} from '../../document-profiles/services/document-profile-invoice';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { branchScopeFilter } from '../../../shared/auth/branch-scope';
import {
  clampKeysetLimit,
  isKeysetListRequest,
  paginateWithKeyset,
  type CursorDirection,
} from '../../../utils/pagination/keysetPagination';
import { applyFullTextIds, findFullTextIds } from '../../../shared/database/fulltext-search';
import { linkSourceAfterSave } from './invoice-source.service';
import {
  INVOICE_DELETE_SETTLEMENT_LOCK_MESSAGE,
  INVOICE_DRAFT_SETTLEMENT_LOCK_MESSAGE,
  invoiceHasLinkedSettlementRecords,
  invoiceHasUnclearedSettlementHistory,
} from './invoice-settlement-policy';
import {
  assertModuleWarehouseAllowed,
  invoiceSequenceDocType,
  loadInvoiceTransactionSettings,
  resolveInvoiceModule,
  resolveInvoiceModuleSettings,
  shouldAutoPostOnSave,
  shouldCheckMinusQtyOnDraft,
} from './invoice-document-type';
import { invoicePostingOrchestrator } from './invoice-posting-orchestrator';
import { assertNotSellingBelowCost } from './invoice-below-cost';
import { assertAllowedLinePrices } from '../../transaction-settings/transaction-settings-invoice-guards';
import { assertPurchaseReturnPolicy, assertSalesReturnPolicy } from './sales-return.service';

function kindToLegacyType(kind: InvoiceKind): string {
  switch (kind) {
    case 'PURCHASE':
      return 'purchase';
    case 'PURCHASE_RETURN':
      return 'purchaseReturn';
    case 'SALE_RETURN':
      return 'salesReturn';
    case 'SALE':
    default:
      return 'sales';
  }
}

type LineInput = CreateM5InvoiceInput['lines'][number];

function toLineRow(
  invoiceId: string,
  line: LineInput,
  headerDiscountAllocated?: number,
  cascadingDiscounts = false,
  pricingBasis: PricingCalculationBasis = 'SELECTED_UNIT_QTY'
) {
  const pricedQty = resolvePricedQuantity(line.quantity, line.baseQuantity, pricingBasis);
  const { lineTotal, lineDiscount, lineTax } = computeLineAmounts(
    { ...line, quantity: pricedQty },
    {
      cascadingDiscounts,
      headerDiscountShare: headerDiscountAllocated,
    }
  );
  return {
    invoiceId,
    itemId: line.itemId,
    unitId: line.unitId,
    quantity: new Decimal(line.quantity),
    baseQuantity: new Decimal(line.baseQuantity),
    baseUnitId: line.baseUnitId ?? null,
    conversionFactor: line.conversionFactor != null ? new Decimal(line.conversionFactor) : null,
    price: new Decimal(line.price),
    total: new Decimal(lineTotal),
    discountPercent: line.discountPercent ? new Decimal(line.discountPercent) : null,
    discountAmount: lineDiscount ? new Decimal(lineDiscount) : null,
    taxPercent: line.taxPercent ? new Decimal(line.taxPercent) : null,
    taxAmount: lineTax ? new Decimal(lineTax) : null,
    lineOrder: line.lineOrder,
    originalInvoiceLineId: line.originalInvoiceLineId ?? null,
    headerDiscountAllocated:
      headerDiscountAllocated != null && headerDiscountAllocated !== 0
        ? new Decimal(headerDiscountAllocated)
        : null,
    batchNumber: line.batchNumber ?? null,
    expiryDate: line.expiryDate ?? null,
    productionDate: line.productionDate ?? null,
    serialNumbers: line.serialNumbers ?? null,
    lineNotes: line.lineNotes ?? null,
    taxExemptionReason: line.taxExemptionReason ?? null,
    warehouseId: line.warehouseId ?? null,
    costCenterId: line.costCenterId ?? null,
    withholdingTaxRate: line.withholdingTaxRate != null ? new Decimal(line.withholdingTaxRate) : new Decimal(0),
    withholdingTaxAmount: line.withholdingTaxAmount != null ? new Decimal(line.withholdingTaxAmount) : new Decimal(0),
    batchAllocations: line.batchAllocations ?? undefined,
    color: line.color ?? null,
    size: line.size ?? null,
    customRevenueAccountId: line.customRevenueAccountId ?? null,
  };
}

/**
 * H6 fix: resolve the invoice's due date. Priority: explicit input →
 * customer/supplier `paymentTermsDays` credit term → the invoice date
 * itself (due immediately, no credit term configured).
 */
async function resolveDueDate(
  tx: Prisma.TransactionClient,
  params: {
    date: Date;
    explicit?: Date | null;
    customerId?: string | null;
    supplierId?: string | null;
  }
): Promise<Date> {
  if (params.explicit) return params.explicit;

  let termDays: number | null = null;
  if (params.customerId) {
    const customer = await tx.customer.findUnique({
      where: { id: params.customerId },
      select: { paymentTermsDays: true },
    });
    termDays = customer?.paymentTermsDays ?? null;
  } else if (params.supplierId) {
    const supplier = await tx.supplier.findUnique({
      where: { id: params.supplierId },
      select: { paymentTermsDays: true },
    });
    termDays = supplier?.paymentTermsDays ?? null;
  }

  if (!termDays) return params.date;
  const due = new Date(params.date);
  due.setUTCDate(due.getUTCDate() + termDays);
  return due;
}

function invoiceAmounts(
  lines: CreateM5InvoiceInput['lines'],
  headerDiscountPercent?: number | null,
  headerDiscountAmount?: number | null,
  cascadingDiscounts = false,
  pricingBasis: PricingCalculationBasis = 'SELECTED_UNIT_QTY'
) {
  return computeInvoiceAmounts(
    lines.map((line) => ({
      ...line,
      quantity: resolvePricedQuantity(line.quantity, line.baseQuantity, pricingBasis),
    })),
    { headerDiscountPercent, headerDiscountAmount },
    { cascadingDiscounts }
  );
}

async function applyNormalizedLineUnits(
  companyId: string,
  lines: CreateM5InvoiceInput['lines']
): Promise<CreateM5InvoiceInput['lines']> {
  return Promise.all(
    lines.map(async (line) => {
      const normalized = await normalizeInvoiceLineUnits(companyId, line);
      return {
        ...line,
        unitId: normalized.unitId,
        quantity: normalized.quantity,
        baseQuantity: normalized.baseQuantity,
        conversionFactor: normalized.conversionFactor,
        baseUnitId: normalized.baseUnitId,
      };
    })
  );
}

async function replaceInvoiceConditions(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  conditions?: string[]
) {
  if (conditions === undefined) return;
  await tx.invoiceCondition.deleteMany({ where: { invoiceId } });
  const trimmed = conditions.map((c) => c.trim()).filter(Boolean);
  if (!trimmed.length) return;
  await tx.invoiceCondition.createMany({
    data: trimmed.map((condition) => ({ invoiceId, condition })),
  });
}

/**
 * Fire-and-forget: enriches the event with customerCategoryId (matches the
 * "Customer Category = VIP" example from the product brief) and emits.
 * Never awaited by callers, never throws into the invoice-creation path.
 */
async function emitSalesInvoiceCreatedEvent(
  companyId: string,
  created: { id: string; invoiceNumber: string | null; totalAmount: Decimal; netAmount: Decimal; customerId: string | null; warehouseId: string | null; currencyCode: string }
): Promise<void> {
  try {
    const customer = created.customerId
      ? await prisma.customer.findFirst({
          where: { id: created.customerId, companyId },
          select: { customerCategoryId: true },
        })
      : null;

    await emitDomainEvent({
      companyId,
      eventType: 'sales.invoice.created',
      data: {
        invoiceId: created.id,
        invoiceNumber: created.invoiceNumber ?? null,
        totalAmount: Number(created.totalAmount),
        netAmount: Number(created.netAmount),
        customerId: created.customerId ?? null,
        customerCategoryId: customer?.customerCategoryId ?? null,
        warehouseId: created.warehouseId ?? null,
        currencyCode: created.currencyCode,
      },
    });
  } catch {
    // emitDomainEvent already never throws; this guards the customer lookup too.
  }
}

export class InvoiceM5Service {
  async create(
    companyId: string,
    branchId: string | undefined,
    fiscalYearId: string | undefined,
    data: CreateM5InvoiceInput,
    userId?: string
  ) {
    // Legacy calls `GetPeriod` when a document is *saved*, not only when it is
    // posted, so a draft cannot be dated into a closed period/year or before
    // the posting-lock cutoff either.
    await fiscalYearService.assertOpenForDate(companyId, data.date);

    const module = await resolveInvoiceModule(companyId, data.invoiceKind, {
      newModuleId: data.newModuleId,
      moduleCode: data.moduleCode,
    });
    const moduleSettings = await resolveInvoiceModuleSettings(companyId, module.moduleCode);
    const txSettings = await loadInvoiceTransactionSettings(companyId, data.invoiceKind);
    const cascadingDiscounts = txSettings?.cascadingDiscounts ?? moduleSettings.cascadingDiscounts;
    const profile = data.documentProfileId
      ? await documentProfileService.getById(companyId, data.documentProfileId)
      : null;
    if (profile) {
      assertProfileMatchesInvoiceKind(profile, data.invoiceKind);
    }
    const locked = profile
      ? applyProfileLocks({
          profile,
          warehouseId: data.warehouseId,
          costCenterId: data.costCenterId,
          paymentSplits: data.paymentSplits,
        })
      : {
          warehouseId: data.warehouseId,
          costCenterId: data.costCenterId ?? undefined,
          paymentSplits: data.paymentSplits,
        };
    const warehouseId =
      locked.warehouseId || txSettings?.defaultWarehouseId || moduleSettings.defaultStore;
    if (!warehouseId) {
      throw new AppError(422, 'Warehouse is required');
    }
    data.paymentSplits = locked.paymentSplits;
    const createWarehouses = new Set<string>([warehouseId]);
    for (const line of data.lines) {
      const lineWh = resolveInvoiceLineWarehouseId(line.warehouseId, warehouseId);
      if (lineWh) createWarehouses.add(lineWh);
    }
    for (const warehouse of createWarehouses) {
      await assertModuleWarehouseAllowed(companyId, module.newModuleId, warehouse);
    }
    const costCenterId =
      locked.costCenterId ?? data.costCenterId ?? txSettings?.defaultCostCenterId ?? undefined;
    const isSalesTaxInvoice =
      data.isSalesTaxInvoice ??
      (txSettings?.autoApplyVat ?? (moduleSettings.salesDariba ? true : false));

    const lines = await applyNormalizedLineUnits(companyId, data.lines);
    const pricingBasis = await resolveCompanyPricingBasis(companyId, data.pricingCalculationBasis);

    const amounts = invoiceAmounts(
      lines,
      data.headerDiscountPercent,
      data.headerDiscountAmount,
      cascadingDiscounts,
      pricingBasis
    );
    const netSubtotal = roundTo4(amounts.totalAmount - amounts.discountAmount);
    const developmentFee = resolveDevelopmentFee(netSubtotal, {
      developmentFeeRate: data.developmentFeeRate,
      developmentFeeAmount: data.developmentFeeAmount,
    });
    const lineWhtSum = roundTo4(
      lines.reduce((sum, line) => sum + Number(line.withholdingTaxAmount ?? 0), 0)
    );
    const wht = roundTo4(data.withholdingTaxAmount ?? lineWhtSum);
    const invoiceExchangeRate = Number(data.exchangeRate ?? 1) || 1;
    const partyAdjustments = sumPartyAdjustments(
      data.adjustments ?? [],
      netSubtotal,
      invoiceExchangeRate
    );
    const netWithWht = roundTo4(amounts.netAmount + developmentFee.amount - wht + partyAdjustments);

    if (txSettings && data.invoiceKind !== 'SALE_RETURN' && data.invoiceKind !== 'PURCHASE_RETURN') {
      await assertAllowedLinePrices({
        companyId,
        settings: txSettings,
        lines: lines.map((line) => ({ itemId: line.itemId, price: Number(line.price) })),
      });
    }
    const salesReturnLink = await assertSalesReturnPolicy({
      companyId,
      invoiceKind: data.invoiceKind,
      originalInvoiceId: data.originalInvoiceId,
      lines,
    });
    const purchaseReturnLink = await assertPurchaseReturnPolicy({
      companyId,
      invoiceKind: data.invoiceKind,
      originalInvoiceId: data.originalInvoiceId,
      lines,
    });
    const returnLink = salesReturnLink ?? purchaseReturnLink;
    await assertNotSellingBelowCost({
      companyId,
      userId,
      invoiceKind: data.invoiceKind,
      asOf: data.date,
      lines: lines.map((line) => ({ itemId: line.itemId, price: Number(line.price) })),
      force: txSettings?.preventSellingBelowCost === true,
    });

    await assertDraftInvoiceIntegrity(
      companyId,
      data.invoiceKind,
      {
        customerId: data.customerId,
        warehouseId,
        netAmount: netWithWht,
      },
      lines,
      {
        checkMinusQty: await shouldCheckMinusQtyOnDraft(companyId, module.moduleCode),
        forceMinusQty: Boolean(txSettings?.preventNegativeStock && txSettings.affectStock),
        // Credit stays a post-time (and draft-update) gate so an over-limit
        // invoice can still be saved and then approved / posted later.
        checkCredit: false,
      }
    );

    const invoiceType = kindToLegacyType(data.invoiceKind);

    let created;
    try {
    created = await prisma.$transaction(async (tx) => {
      const manualInvoiceNumber = data.invoiceNumber?.trim();
      const profileNumber =
        !manualInvoiceNumber && profile?.prefix
          ? await nextProfileInvoiceNumber(tx, profile.id)
          : null;
      const invoiceNumber =
        manualInvoiceNumber ||
        profileNumber ||
        (await documentSequenceService.nextNumberForFamilyInTx(tx, {
          companyId,
          branchId: branchId ?? null,
          fiscalYearId: fiscalYearId ?? null,
          docType: invoiceSequenceDocType(data.invoiceKind),
          legacySuffix: module.moduleCode,
          policyOverride: txSettings
            ? {
                automatic: txSettings.numberingMode === 'AUTOMATIC',
                continuous: txSettings.sequenceMode === 'CONTINUOUS',
              }
            : undefined,
          seedFromExisting: documentSequenceService.maxExistingNumber(async () => {
            const rows = await tx.invoice.findMany({
              where: { companyId, invoiceType },
              select: { invoiceNumber: true },
            });
            return rows.map((r) => r.invoiceNumber);
          }),
          isAvailable: async (candidate) => {
            const hit = await tx.invoice.findFirst({
              where: {
                companyId,
                invoiceType,
                invoiceNumber: candidate,
                branchId: branchId ?? null,
                fiscalYearId: fiscalYearId ?? null,
              },
              select: { id: true },
            });
            return !hit;
          },
        }));
      if (!invoiceNumber) {
        // Legacy `if SerialAutomatic<>'A' then ... if InvoiceNum='' then ShowLangMessage(81)`
        // (untRInovice.pas): manual-numbering document types require the user to type a number.
        throw new AppError(422, 'رقم الفاتورة مطلوب — الترقيم يدوي لهذا النوع من المستندات');
      }

      if (manualInvoiceNumber) {
        const taken = await tx.invoice.findFirst({
          where: {
            companyId,
            invoiceType,
            invoiceNumber: manualInvoiceNumber,
            branchId: branchId ?? null,
            fiscalYearId: fiscalYearId ?? null,
          },
          select: { id: true },
        });
        if (taken) {
          throw new AppError(409, 'رقم الفاتورة مستخدم بالفعل — غيّر الرقم أو اتركه فارغاً للتوليد التلقائي');
        }
      }

      const dueDate = await resolveDueDate(tx, {
        date: data.date,
        explicit: data.dueDate,
        customerId: data.customerId,
        supplierId: data.supplierId,
      });

      await assertNoOverReturn(tx, companyId, data.invoiceKind, null, data.lines);

      const inv = await tx.invoice.create({
        data: {
          companyId,
          branchId,
          fiscalYearId,
          invoiceNumber,
          invoiceKind: data.invoiceKind,
          invoiceType,
          moduleCode: module.moduleCode,
          newModuleId: module.newModuleId,
          documentProfileId: profile?.id ?? null,
          date: data.date,
          dueDate,
          hijriDate: resolveHijriDate(data.date, data.hijriDate),
          description: data.description,
          currencyCode: data.currencyCode,
          exchangeRate: persistFxDecimal(data.currencyCode, data.exchangeRate),
          sourceYearId: data.sourceYearId,
          customerId: data.customerId,
          supplierId: data.supplierId,
          warehouseId,
          costCenterId,
          representativeId: data.representativeId,
          ...(data.driverId !== undefined ? { driverId: data.driverId } : {}),
          ...(data.distributorId !== undefined ? { distributorId: data.distributorId } : {}),
          sellerId: data.sellerId,
          paymentMethod: data.paymentMethod,
          paymentSplits: data.paymentSplits as Prisma.InputJsonValue | undefined,
          internalNotes: data.internalNotes as Prisma.InputJsonValue | undefined,
          isSalesTaxInvoice,
          taxTreatmentType: data.taxTreatmentType ?? null,
          allowReturn: data.allowReturn ?? false,
          returnDays: data.returnDays ?? null,
          isDelivered: data.isDelivered ?? false,
          handoverDate: data.handoverDate ?? null,
          totalAmount: new Decimal(amounts.totalAmount),
          discountAmount: new Decimal(amounts.discountAmount),
          headerDiscountPercent:
            data.headerDiscountPercent != null ? new Decimal(data.headerDiscountPercent) : null,
          taxAmount: new Decimal(amounts.taxAmount),
          developmentFeeRate:
            developmentFee.rate != null ? new Decimal(developmentFee.rate) : null,
          developmentFeeAmount: new Decimal(developmentFee.amount),
          withholdingTaxAmount: new Decimal(wht),
          netAmount: new Decimal(netWithWht),
          remainingAmount: new Decimal(netWithWht),
          pricingCalculationBasis: pricingBasis,
          sourceType: data.sourceType ?? 'NONE',
          sourceId: data.sourceId ?? null,
          sourceNumber: data.sourceNumber ?? null,
          originalInvoiceId: data.originalInvoiceId ?? null,
          originalInvoiceNumber:
            data.originalInvoiceNumber ?? returnLink?.originalInvoiceNumber ?? null,
          isPosted: false,
          workflowStatus: 'DRAFT',
          createdBy: userId,
        },
      });

      await tx.invoiceLine.createMany({
        data: lines.map((line, i) =>
          toLineRow(inv.id, line, amounts.allocations[i], cascadingDiscounts, pricingBasis)
        ),
      });

      await replaceInvoiceConditions(tx, inv.id, data.invoiceConditions);
      await replaceInvoiceInstallmentsInTx(tx, inv.id, data.installments);
      await replaceInvoiceAdjustmentsInTx(tx, {
        companyId,
        invoiceId: inv.id,
        adjustments: data.adjustments,
        baseSubtotal: netSubtotal,
        invoiceExchangeRate,
      });
      await linkSourceAfterSave(tx, companyId, inv.id, {
        sourceType: data.sourceType,
        sourceId: data.sourceId,
      });

      if (userId) {
        await documentAuditService.record(
          {
            companyId,
            entityType: 'INVOICE',
            entityId: inv.id,
            action: 'CREATED',
            userId,
          },
          tx
        );
      }

      return tx.invoice.findUnique({
        where: { id: inv.id },
        include: {
          lines: { orderBy: { lineOrder: 'asc' } },
          conditions: true,
          installments: { orderBy: { installmentNumber: 'asc' } },
          adjustments: { orderBy: { createdAt: 'asc' } },
        },
      });
    });
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError(
          409,
          'رقم الفاتورة مستخدم بالفعل — اترك الرقم فارغاً ليُولَّد تلقائياً أو اختر رقماً جديداً'
        );
      }
      throw err;
    }

    if (created && data.invoiceKind === 'SALE') {
      void emitSalesInvoiceCreatedEvent(companyId, created);
    }

    if (
      created &&
      branchId &&
      fiscalYearId &&
      (await shouldAutoPostOnSave(companyId, module.moduleCode))
    ) {
      await invoicePostingOrchestrator.post(
        { companyId, branchId, fiscalYearId, userId: userId ?? 'system' },
        created.id
      );
      return prisma.invoice.findUnique({
        where: { id: created.id },
        include: {
          lines: { orderBy: { lineOrder: 'asc' } },
          conditions: true,
        },
      });
    }

    return created;
  }

  /**
   * Editing is only safe while the invoice has not hit stock/GL. A posted invoice must be
   * unposted first, which reverses its cost and journal entries.
   */
  async update(companyId: string, id: string, data: UpdateM5InvoiceInput, userId?: string) {
    const existing = await prisma.invoice.findFirst({
      where: { id, companyId },
      include: { lines: { orderBy: { lineOrder: 'asc' } }, adjustments: true },
    });
    if (!existing) throw new AppError(404, 'Invoice not found');
    if (existing.isPosted) {
      // H4 fix: an approved+posted invoice can never be unposted (see the
      // orchestrator), so don't send the caller into a dead end — tell them
      // the actual correction path up front instead of a generic "unpost first".
      throw new AppError(
        422,
        existing.isApproved
          ? "This invoice is approved and posted — it cannot be edited or unposted. " +
              'Create a return/credit note (SALE_RETURN or PURCHASE_RETURN) referencing its lines instead.'
          : 'Unpost the invoice before editing it'
      );
    }
    if (existing.isCancelled) {
      throw new AppError(422, 'Cancelled invoices cannot be edited');
    }

    // Both the date it currently carries and any new date must sit in an open
    // period, so an edit can neither touch a locked-away document nor move one
    // into a locked period.
    await fiscalYearService.assertOpenForDate(companyId, existing.date);
    if (data.date) {
      await fiscalYearService.assertOpenForDate(companyId, data.date);
    }

    // M14 fix (Item 40): if the client tells us which version it edited,
    // reject the edit outright when the DB has already moved past that —
    // catches the "form left open, someone else edited it in the
    // meantime" case that the transactional guard below (which only
    // protects the narrow window of this request's own lifetime) cannot.
    assertExpectedVersion(existing.version, data.expectedVersion);

    if (data.lines) {
      const [activeAllocationCount, activeChequeCount] = await Promise.all([
        prisma.paymentAllocation.count({
          where: {
            companyId,
            invoiceId: id,
            cashTransaction: { isPosted: true, isCancelled: false },
          },
        }),
        prisma.cheque.count({
          where: {
            companyId,
            invoiceId: id,
            status: { notIn: ['CANCELLED', 'BOUNCED'] },
          },
        }),
      ]);
      if (
        invoiceHasUnclearedSettlementHistory({
          remainingAmount: Number(existing.remainingAmount),
          netAmount: Number(existing.netAmount),
          activeAllocationCount,
          activeChequeCount,
        })
      ) {
        throw new AppError(422, INVOICE_DRAFT_SETTLEMENT_LOCK_MESSAGE);
      }
    }

    const effectiveLines: CreateM5InvoiceInput['lines'] =
      data.lines ??
      existing.lines.map((l, index) => ({
        itemId: l.itemId,
        unitId: l.unitId ?? undefined,
        quantity: Number(l.quantity),
        baseQuantity: Number(l.baseQuantity),
        price: Number(l.price),
        originalInvoiceLineId: l.originalInvoiceLineId ?? undefined,
        discountPercent: l.discountPercent ? Number(l.discountPercent) : undefined,
        discountAmount: l.discountAmount ? Number(l.discountAmount) : undefined,
        taxPercent: l.taxPercent ? Number(l.taxPercent) : undefined,
        taxAmount: l.taxAmount ? Number(l.taxAmount) : undefined,
        lineOrder: l.lineOrder ?? index + 1,
        batchNumber: l.batchNumber ?? undefined,
        expiryDate: l.expiryDate ?? undefined,
        productionDate: l.productionDate ?? undefined,
        serialNumbers: l.serialNumbers ?? undefined,
        lineNotes: l.lineNotes ?? undefined,
        taxExemptionReason: l.taxExemptionReason ?? undefined,
        warehouseId: l.warehouseId ?? undefined,
        costCenterId: l.costCenterId ?? undefined,
        withholdingTaxRate: l.withholdingTaxRate != null ? Number(l.withholdingTaxRate) : undefined,
        withholdingTaxAmount: l.withholdingTaxAmount != null ? Number(l.withholdingTaxAmount) : undefined,
        batchAllocations: (l.batchAllocations as CreateM5InvoiceInput['lines'][number]['batchAllocations']) ?? undefined,
        color: l.color ?? undefined,
        size: l.size ?? undefined,
        customRevenueAccountId: l.customRevenueAccountId ?? undefined,
        conversionFactor: l.conversionFactor != null ? Number(l.conversionFactor) : undefined,
        baseUnitId: l.baseUnitId ?? undefined,
      })) as CreateM5InvoiceInput['lines'];

    const invoiceKind = (existing.invoiceKind ?? 'SALE') as InvoiceKind;
    const module = await resolveInvoiceModule(companyId, invoiceKind, {
      newModuleId: existing.newModuleId,
      moduleCode: existing.moduleCode,
    });
    const moduleSettings = await resolveInvoiceModuleSettings(companyId, module.moduleCode);
    const txSettings = await loadInvoiceTransactionSettings(companyId, invoiceKind);
    const cascadingDiscounts = txSettings?.cascadingDiscounts ?? moduleSettings.cascadingDiscounts;
    if (txSettings && invoiceKind !== 'SALE_RETURN' && invoiceKind !== 'PURCHASE_RETURN') {
      await assertAllowedLinePrices({
        companyId,
        settings: txSettings,
        lines: effectiveLines.map((line) => ({ itemId: line.itemId, price: Number(line.price) })),
      });
    }
    const salesReturnLink = await assertSalesReturnPolicy({
      companyId,
      invoiceKind,
      selfInvoiceId: id,
      originalInvoiceId:
        data.originalInvoiceId !== undefined ? data.originalInvoiceId : existing.originalInvoiceId,
      lines: effectiveLines,
    });
    const purchaseReturnLink = await assertPurchaseReturnPolicy({
      companyId,
      invoiceKind,
      selfInvoiceId: id,
      originalInvoiceId:
        data.originalInvoiceId !== undefined ? data.originalInvoiceId : existing.originalInvoiceId,
      lines: effectiveLines,
    });
    const returnLink = salesReturnLink ?? purchaseReturnLink;
    await assertNotSellingBelowCost({
      companyId,
      userId,
      invoiceKind,
      asOf: data.date ?? existing.date,
      lines: effectiveLines.map((line) => ({ itemId: line.itemId, price: Number(line.price) })),
      force: txSettings?.preventSellingBelowCost === true,
    });
    const warehouseId = data.warehouseId ?? existing.warehouseId;
    const updateWarehouses = new Set<string>();
    if (warehouseId) updateWarehouses.add(warehouseId);
    for (const line of effectiveLines) {
      const lineWh = resolveInvoiceLineWarehouseId(line.warehouseId, warehouseId);
      if (lineWh) updateWarehouses.add(lineWh);
    }
    for (const warehouse of updateWarehouses) {
      await assertModuleWarehouseAllowed(companyId, module.newModuleId, warehouse);
    }

    const effectiveHeaderDiscountPercent =
      data.headerDiscountPercent !== undefined
        ? data.headerDiscountPercent
        : existing.headerDiscountPercent != null
          ? Number(existing.headerDiscountPercent)
          : null;
    const normalizedLines = data.lines
      ? await applyNormalizedLineUnits(companyId, effectiveLines)
      : effectiveLines;
    const pricingBasis = await resolveCompanyPricingBasis(
      companyId,
      data.pricingCalculationBasis ?? existing.pricingCalculationBasis
    );
    const amounts = invoiceAmounts(
      normalizedLines,
      effectiveHeaderDiscountPercent,
      data.headerDiscountAmount,
      cascadingDiscounts,
      pricingBasis
    );
    const netSubtotal = roundTo4(amounts.totalAmount - amounts.discountAmount);
    const developmentFee = resolveDevelopmentFee(netSubtotal, {
      developmentFeeRate:
        data.developmentFeeRate !== undefined
          ? data.developmentFeeRate
          : existing.developmentFeeRate != null
            ? Number(existing.developmentFeeRate)
            : null,
      developmentFeeAmount:
        data.developmentFeeAmount !== undefined
          ? data.developmentFeeAmount
          : Number(existing.developmentFeeAmount),
    });
    const lineWhtSum = roundTo4(
      effectiveLines.reduce((sum, line) => sum + Number(line.withholdingTaxAmount ?? 0), 0)
    );
    const wht = roundTo4(
      data.withholdingTaxAmount ?? (lineWhtSum > 0 ? lineWhtSum : Number(existing.withholdingTaxAmount))
    );
    const invoiceExchangeRate =
      Number(data.exchangeRate ?? existing.exchangeRate ?? 1) || 1;
    const sourceAdjustments =
      data.adjustments ??
      existing.adjustments.map((row) => ({
        type: row.type,
        calcType: row.calcType,
        rate: row.rate != null ? Number(row.rate) : null,
        amount: Number(row.amount),
        exchangeRate: row.exchangeRate != null ? Number(row.exchangeRate) : null,
        offsetAccountId: row.offsetAccountId,
      }));
    const partyAdjustments = sumPartyAdjustments(
      sourceAdjustments,
      netSubtotal,
      invoiceExchangeRate
    );
    const netWithWht = roundTo4(amounts.netAmount + developmentFee.amount - wht + partyAdjustments);
    const paid = Number(existing.paidAmount);

    await assertDraftInvoiceIntegrity(
      companyId,
      invoiceKind,
      {
        customerId: data.customerId ?? existing.customerId,
        warehouseId,
        netAmount: netWithWht,
      },
      normalizedLines,
      {
        checkMinusQty: await shouldCheckMinusQtyOnDraft(companyId, module.moduleCode),
        forceMinusQty: Boolean(txSettings?.preventNegativeStock && txSettings.affectStock),
      }
    );

    return prisma.$transaction(async (tx) => {
      if (data.lines) {
        await assertNoOverReturn(tx, companyId, invoiceKind, id, normalizedLines);
        await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceLine.createMany({
          data: normalizedLines.map((line, i) =>
            toLineRow(id, line, amounts.allocations[i], cascadingDiscounts, pricingBasis)
          ),
        });
      } else if (data.headerDiscountPercent !== undefined || data.headerDiscountAmount != null) {
        // Header discount changed without touching lines — refresh each
        // existing line's proportional allocation (and cascaded tax) so
        // they stay in sync.
        await Promise.all(
          existing.lines.map((l, i) => {
            const lineInput = normalizedLines[i];
            const { lineTax } = computeLineAmounts(
              {
                ...lineInput,
                quantity: resolvePricedQuantity(
                  lineInput.quantity,
                  lineInput.baseQuantity,
                  pricingBasis
                ),
              },
              {
              cascadingDiscounts,
              headerDiscountShare: amounts.allocations[i],
            });
            return tx.invoiceLine.update({
              where: { id: l.id },
              data: {
                headerDiscountAllocated: amounts.allocations[i]
                  ? new Decimal(amounts.allocations[i])
                  : null,
                taxAmount: new Decimal(lineTax),
              },
            });
          })
        );
      }

      const dueDate = await resolveDueDate(tx, {
        date: data.date ?? existing.date,
        explicit: data.dueDate,
        customerId: data.customerId ?? existing.customerId,
        supplierId: data.supplierId ?? existing.supplierId,
      });

      // M14 fix (Item 40): guard the write itself with the version this
      // function read at the top — if another transaction updated (and
      // thus bumped) the row between our read and this write, `count`
      // comes back 0 and we surface a 409 instead of silently clobbering
      // the other writer's changes with stale data.
      const updateResult = await tx.invoice.updateMany({
        where: {
          id,
          companyId,
          version: data.expectedVersion ?? existing.version,
        },
        data: {
          version: { increment: 1 },
          invoiceNumber: data.invoiceNumber ?? existing.invoiceNumber,
          date: data.date ?? existing.date,
          dueDate,
          hijriDate: resolveHijriDate(
            data.date ?? existing.date,
            data.hijriDate !== undefined ? data.hijriDate : existing.hijriDate
          ),
          description: data.description ?? existing.description,
          currencyCode: data.currencyCode ?? existing.currencyCode,
          exchangeRate: persistFxDecimal(
            data.currencyCode ?? existing.currencyCode,
            data.exchangeRate ?? existing.exchangeRate
          ),
          sourceYearId: data.sourceYearId ?? existing.sourceYearId,
          customerId: data.customerId ?? existing.customerId,
          supplierId: data.supplierId ?? existing.supplierId,
          warehouseId: data.warehouseId ?? existing.warehouseId,
          documentProfileId: data.documentProfileId ?? existing.documentProfileId,
          sourceType: data.sourceType ?? existing.sourceType,
          sourceId: data.sourceId !== undefined ? data.sourceId : existing.sourceId,
          sourceNumber: data.sourceNumber !== undefined ? data.sourceNumber : existing.sourceNumber,
          originalInvoiceId:
            data.originalInvoiceId !== undefined ? data.originalInvoiceId : existing.originalInvoiceId,
          originalInvoiceNumber:
            data.originalInvoiceNumber !== undefined
              ? data.originalInvoiceNumber
              : returnLink?.originalInvoiceNumber ?? existing.originalInvoiceNumber,
          costCenterId: data.costCenterId ?? existing.costCenterId,
          representativeId: data.representativeId ?? existing.representativeId,
          driverId: data.driverId !== undefined ? data.driverId : existing.driverId,
          distributorId:
            data.distributorId !== undefined ? data.distributorId : existing.distributorId,
          sellerId: data.sellerId !== undefined ? data.sellerId : existing.sellerId,
          paymentMethod: data.paymentMethod ?? existing.paymentMethod,
          paymentSplits:
            data.paymentSplits !== undefined
              ? (data.paymentSplits as Prisma.InputJsonValue)
              : (existing.paymentSplits ?? undefined),
          internalNotes:
            data.internalNotes !== undefined
              ? (data.internalNotes as Prisma.InputJsonValue)
              : (existing.internalNotes ?? undefined),
          isSalesTaxInvoice:
            data.isSalesTaxInvoice !== undefined
              ? data.isSalesTaxInvoice
              : existing.isSalesTaxInvoice,
          taxTreatmentType:
            data.taxTreatmentType !== undefined
              ? data.taxTreatmentType
              : existing.taxTreatmentType,
          allowReturn:
            data.allowReturn !== undefined ? data.allowReturn : existing.allowReturn,
          returnDays:
            data.returnDays !== undefined ? data.returnDays : existing.returnDays,
          isDelivered:
            data.isDelivered !== undefined ? data.isDelivered : existing.isDelivered,
          handoverDate:
            data.handoverDate !== undefined ? data.handoverDate : existing.handoverDate,
          totalAmount: new Decimal(amounts.totalAmount),
          discountAmount: new Decimal(amounts.discountAmount),
          headerDiscountPercent:
            effectiveHeaderDiscountPercent != null
              ? new Decimal(effectiveHeaderDiscountPercent)
              : null,
          taxAmount: new Decimal(amounts.taxAmount),
          developmentFeeRate:
            developmentFee.rate != null ? new Decimal(developmentFee.rate) : null,
          developmentFeeAmount: new Decimal(developmentFee.amount),
          withholdingTaxAmount: new Decimal(wht),
          netAmount: new Decimal(netWithWht),
          remainingAmount: new Decimal(roundTo4(Math.max(netWithWht - paid, 0))),
          pricingCalculationBasis: pricingBasis,
        },
      });
      if (updateResult.count === 0) {
        throwStaleWrite();
      }

      await replaceInvoiceConditions(tx, id, data.invoiceConditions);
      await replaceInvoiceInstallmentsInTx(tx, id, data.installments);
      await replaceInvoiceAdjustmentsInTx(tx, {
        companyId,
        invoiceId: id,
        adjustments: data.adjustments,
        baseSubtotal: netSubtotal,
        invoiceExchangeRate,
      });
      await linkSourceAfterSave(tx, companyId, id, {
        sourceType: data.sourceType ?? existing.sourceType,
        sourceId: data.sourceId !== undefined ? data.sourceId : existing.sourceId,
      });

      if (userId) {
        await documentAuditService.record(
          {
            companyId,
            entityType: 'INVOICE',
            entityId: id,
            action: 'UPDATED',
            userId,
            metadata: { fields: Object.keys(data) },
          },
          tx
        );
      }

      return tx.invoice.findUnique({
        where: { id },
        include: {
          lines: { orderBy: { lineOrder: 'asc' } },
          conditions: true,
          installments: { orderBy: { installmentNumber: 'asc' } },
          adjustments: { orderBy: { createdAt: 'asc' } },
        },
      });
    });
  }

  /**
   * Wave 3 fix: reverts whatever upstream document this invoice was
   * converted FROM back to its pre-conversion state, so cancelling/deleting
   * a bad conversion doesn't leave the source stuck thinking it was already
   * consumed (quote `isConverted`, PO `invoiceId`, sales-order
   * `convertedInvoiceId` — see `document-converter.service.ts`).
   */
  private async revertUpstreamConversionInTx(tx: Prisma.TransactionClient, invoiceId: string) {
    const sourcePriceQuote = await tx.priceQuote.findFirst({ where: { invoiceId } });
    if (sourcePriceQuote) {
      await tx.priceQuote.update({
        where: { id: sourcePriceQuote.id },
        data: { isConverted: false, convertedAt: null, invoiceId: null },
      });
    }

    const sourcePo = await tx.purchaseOrder.findFirst({ where: { invoiceId } });
    if (sourcePo) {
      await tx.purchaseOrder.update({ where: { id: sourcePo.id }, data: { invoiceId: null } });
    }

    const sourceSalesOrder = await tx.invoice.findFirst({ where: { convertedInvoiceId: invoiceId } });
    if (sourceSalesOrder) {
      await tx.invoice.update({
        where: { id: sourceSalesOrder.id },
        data: { convertedInvoiceId: null },
      });
    }
  }

  /** Soft delete: keeps the document for audit and excludes it from batch posting. */
  async cancel(companyId: string, id: string, userId?: string) {
    const existing = await prisma.invoice.findFirst({ where: { id, companyId } });
    if (!existing) throw new AppError(404, 'Invoice not found');
    if (existing.isPosted) {
      throw new AppError(422, 'Unpost the invoice before cancelling it');
    }
    if (existing.isCancelled) return existing;

    const updated = await prisma.$transaction(async (tx) => {
      await journalPostingService.cascadeSourceJournalInTx(
        tx,
        companyId,
        [existing.journalEntryId, existing.costJournalEntryId],
        'cancel',
        userId,
        { sourceId: existing.id, sourceNumber: existing.invoiceNumber ?? undefined }
      );
      const row = await tx.invoice.update({
        where: { id },
        data: { isCancelled: true },
      });
      await this.revertUpstreamConversionInTx(tx, id);
      return row;
    });

    if (userId) {
      await documentAuditService.record({
        companyId,
        entityType: 'INVOICE',
        entityId: id,
        action: 'CANCELLED',
        userId,
      });
    }

    return updated;
  }

  /** Hard delete, allowed only for never-posted drafts with no settlements. */
  async remove(companyId: string, id: string) {
    const existing = await prisma.invoice.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        isPosted: true,
        journalEntryId: true,
        costJournalEntryId: true,
        _count: {
          select: {
            settlements: true,
            settlementCheques: true,
            paymentAllocations: true,
          },
        },
      },
    });
    if (!existing) throw new AppError(404, 'Invoice not found');
    if (existing.isPosted || existing.journalEntryId || existing.costJournalEntryId) {
      throw new AppError(422, 'Posted invoices cannot be deleted — unpost or cancel instead');
    }
    if (
      invoiceHasLinkedSettlementRecords({
        paymentAllocations: existing._count.paymentAllocations,
        cashTransactions: existing._count.settlements,
        cheques: existing._count.settlementCheques,
      })
    ) {
      throw new AppError(422, INVOICE_DELETE_SETTLEMENT_LOCK_MESSAGE);
    }

    await prisma.$transaction(async (tx) => {
      await this.revertUpstreamConversionInTx(tx, id);
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
    });

    return { id };
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.invoice.findFirst({
      where: { id, companyId },
      include: {
        lines: { orderBy: { lineOrder: 'asc' } },
        conditions: true,
        customer: {
          select: {
            id: true,
            arabicName: true,
            englishName: true,
            serial: true,
            code: true,
            mobile: true,
            phone1: true,
            phone2: true,
          },
        },
        supplier: {
          select: {
            id: true,
            arabicName: true,
            phone1: true,
            phone2: true,
          },
        },
        journalEntry: true,
        costJournalEntry: true,
        settlements: { orderBy: { date: 'asc' } },
        // Sales Invoice Enterprise Redesign: surfaces the existing
        // document-conversion link (e.g. a sales order converted into this
        // invoice via SALES_ORDER_TO_SALE_INVOICE) as a read-only reference
        // chip in the header — no new field, just exposing existing data.
        convertedFromInvoice: {
          select: { id: true, invoiceNumber: true, invoiceKind: true, date: true },
        },
        originalInvoice: {
          select: { id: true, invoiceNumber: true, invoiceKind: true, date: true, netAmount: true },
        },
        installments: { orderBy: { installmentNumber: 'asc' } },
        adjustments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) throw new AppError(404, 'Invoice not found');
    return row;
  }

  async list(
    companyId: string,
    opts: {
      page?: number;
      limit?: number;
      cursor?: string;
      direction?: CursorDirection;
      invoiceKind?: InvoiceKind;
      isPosted?: boolean;
      includeLines?: boolean;
      /** Wave 5 fix: free-text match on invoice number / description. */
      search?: string;
      /** Wave 5 fix: inclusive range filter on the invoice `date`. */
      startDate?: string;
      endDate?: string;
      /** Wave 5 fix: server-side party filter for the allocation grid. */
      customerId?: string;
      supplierId?: string;
      /** Wave 5 fix: restrict to invoices with a positive remaining balance. */
      openOnly?: boolean;
      profileId?: string;
      branchId?: string;
      /** Legacy `UserBranchesCond` — see `shared/auth/branch-scope.ts`. */
      permittedBranchIds?: string[] | null;
    }
  ) {
    const page = opts.page ?? 1;
    const limit = Math.min(opts.limit ?? 50, 200);
    const where: Record<string, unknown> = {
      companyId,
      ...branchScopeFilter(opts.permittedBranchIds ?? null, opts.branchId),
    };
    if (opts.invoiceKind) where.invoiceKind = opts.invoiceKind;
    if (opts.profileId) where.documentProfileId = opts.profileId;
    if (opts.isPosted !== undefined) where.isPosted = opts.isPosted;
    if (opts.customerId) where.customerId = opts.customerId;
    if (opts.supplierId) where.supplierId = opts.supplierId;
    if (opts.openOnly) {
      where.isCancelled = false;
      where.remainingAmount = { gt: 0 };
    }
    if (opts.search) {
      const ftIds = await findFullTextIds('invoices', companyId, opts.search);
      const scoped = applyFullTextIds(where, ftIds);
      if (scoped === 'empty') {
        const keysetLimit = clampKeysetLimit(opts.limit);
        return {
          invoices: [],
          items: [],
          nextCursor: null,
          prevCursor: null,
          hasMore: false,
          pagination: opts.cursor
            ? { limit: keysetLimit, nextCursor: null, prevCursor: null, hasMore: false }
            : { page, limit, total: 0, totalPages: 0 },
        };
      }
    }
    if (opts.startDate || opts.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (opts.startDate) {
        const d = new Date(opts.startDate);
        if (!Number.isNaN(d.getTime())) dateFilter.gte = d;
      }
      if (opts.endDate) {
        // Treat a bare `YYYY-MM-DD` end date as inclusive of the whole day.
        const d = new Date(opts.endDate);
        if (!Number.isNaN(d.getTime())) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(opts.endDate)) {
            d.setUTCHours(23, 59, 59, 999);
          }
          dateFilter.lte = d;
        }
      }
      if (Object.keys(dateFilter).length > 0) where.date = dateFilter;
    }

    const listSelect = {
      id: true,
      companyId: true,
      branchId: true,
      fiscalYearId: true,
      invoiceNumber: true,
      invoiceKind: true,
      invoiceType: true,
      moduleCode: true,
      newModuleId: true,
      documentProfileId: true,
      date: true,
      currencyCode: true,
      customerId: true,
      supplierId: true,
      // Wave 5 fix: the list UI has always rendered `row.customer?.arabicName`
      // / `row.supplier?.arabicName`, but this select only ever returned the
      // bare IDs — the party column showed an em-dash for every row.
      customer: { select: { id: true, code: true, arabicName: true } },
      supplier: { select: { id: true, code: true, arabicName: true } },
      warehouseId: true,
      totalAmount: true,
      netAmount: true,
      paidAmount: true,
      remainingAmount: true,
      isPosted: true,
      isCancelled: true,
      createdAt: true,
      updatedAt: true,
    } as const;

    const select = opts.includeLines
      ? {
          ...listSelect,
          lines: { orderBy: { lineOrder: 'asc' as const } },
        }
      : listSelect;

    if (isKeysetListRequest(opts)) {
      const keyed = await paginateWithKeyset(prisma.invoice, {
        cursor: opts.cursor,
        limit: opts.limit,
        direction: opts.direction,
        where,
        orderBy: [{ invoiceNumber: 'asc' }, { id: 'asc' }],
        select,
      });
      const keysetLimit = clampKeysetLimit(opts.limit);
      return {
        invoices: keyed.items,
        items: keyed.items,
        nextCursor: keyed.nextCursor,
        prevCursor: keyed.prevCursor,
        hasMore: keyed.hasMore,
        pagination: {
          limit: keysetLimit,
          nextCursor: keyed.nextCursor,
          prevCursor: keyed.prevCursor,
          hasMore: keyed.hasMore,
        },
      };
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ invoiceNumber: 'asc' }, { id: 'asc' }],
        select,
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      invoices,
      items: invoices,
      nextCursor: null,
      prevCursor: null,
      hasMore: page * limit < total,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

export const invoiceM5Service = new InvoiceM5Service();
