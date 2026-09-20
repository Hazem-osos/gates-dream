import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { VAT_ACCOUNT_UNMAPPED_MESSAGE } from '../../accounting/constants/ledger-integrity';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import { autoGlPostingService } from '../../accounting/services/auto-gl-posting.service';
import type { JournalEntryLineData } from '../../accounting/types/journal-entry.types';
import { partyCreditService } from '../../accounting/services/party-credit.service';
import { companySettingService } from '../../platform/services/company-setting.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { advancedRightsService } from '../../platform/services/advanced-rights.service';
import { itemCostService } from '../../inventory/services/item-cost.service';
import { stockMovementService } from '../../inventory/services/stock-movement.service';
import { inventoryCostingService } from '../../inventory/services/inventory-costing.service';
import { COSTING_MOVEMENT } from '../../inventory/services/inventory-costing-math';
import { sortForStockLocking } from '../../inventory/utils/stock-lock-order.util';
import { invoiceAccountResolverService } from './invoice-account-resolver.service';
import {
  ACCOUNT_SLOT_ALIASES,
  pickAccountDef,
  type AccountDefs,
} from '../../accounting/settings/account-definition-map';
import { assertNotSellingBelowCost } from './invoice-below-cost';
import {
  defaultInvoiceModuleCode,
  loadInvoiceTransactionSettings,
  resolveInvoiceModuleSettings,
} from './invoice-document-type';
import {
  invoiceSettlementService,
  isImmediateCashInvoice,
} from './invoice-settlement.service';
import {
  invoiceSettlementSplitService,
  isSplitPaymentInvoice,
} from './invoice-settlement-split.service';
import { resolveInvoiceLineWarehouseId } from './invoice-m5-integrity.service';
import {
  getInventorySystem,
  loadWarehouseGlMap,
  pickInventoryAccount,
} from '../../inventory/utils/inventory-system';
import { computeAdjustmentInvoiceAmount } from './invoice-adjustment.math';
import { computePurchaseLineNetCost } from './purchase-line-net-cost';
import { taxPeriodService } from '../../taxes/services/tax-period.service';
import { approvalWorkflowService } from '../../accounting/services/approval-workflow.service';
import { documentAuditService } from '../../accounting/services/document-audit.service';
import type {
  InvoiceKind,
  InvoiceLineTotals,
  InvoicePostingContext,
} from '../types/invoice-posting.types';

type InvoiceWithLines = Prisma.InvoiceGetPayload<{
  include: {
    lines: { include: { item: true } };
    adjustments: true;
  };
}>;

function resolveKind(invoice: InvoiceWithLines): InvoiceKind {
  if (invoice.invoiceKind) {
    return invoice.invoiceKind as InvoiceKind;
  }
  if (invoice.invoiceType === 'purchase') return 'PURCHASE';
  if (invoice.invoiceType === 'sales') return 'SALE';
  if (invoice.customerId) return 'SALE_RETURN';
  if (invoice.supplierId) return 'PURCHASE_RETURN';
  return 'SALE';
}

/**
 * Legacy `AdvancedRights` keys per invoice kind. The naming is legacy's, not
 * ours: `PIPost` is the *sales* invoice flag (read by `untRInovice.pas`) and
 * `SVPost` is the *purchase* invoice flag (read by `untPInovice.pas`) — see
 * `legacy-advanced-rights-families.ts`.
 */
const ADVANCED_RIGHT_KEYS: Record<InvoiceKind, { post: string; unpost: string }> = {
  SALE: { post: 'piPost', unpost: 'piUnpost' },
  PURCHASE: { post: 'svPost', unpost: 'svUnpost' },
  SALE_RETURN: { post: 'srPost', unpost: 'srUnpost' },
  PURCHASE_RETURN: { post: 'prPost', unpost: 'prUnpost' },
};

function legacySourceType(kind: InvoiceKind): string {
  switch (kind) {
    case 'PURCHASE':
      return 'PI';
    case 'SALE':
      return 'SI';
    case 'PURCHASE_RETURN':
      return 'PR';
    case 'SALE_RETURN':
      return 'SR';
    default:
      return 'INV';
  }
}

function allocateCostCenters(
  lines: JournalEntryLineData[],
  pair: 'SALES' | 'COST_OF_GOODS_SOLD',
  settings: Awaited<ReturnType<typeof loadInvoiceTransactionSettings>>,
  costCenterId?: string
): JournalEntryLineData[] {
  if (!costCenterId || !settings) return lines;
  if (settings.costCenterAllocationTarget !== pair) {
    return lines.map((line) => ({ ...line, costCenterId: undefined }));
  }
  const wantDebit = settings.costCenterSide === 'DEBIT';
  return lines.map((line) => ({
    ...line,
    costCenterId: Number(line.debit) > 0 === wantDebit ? costCenterId : undefined,
  }));
}

function stockDelta(kind: InvoiceKind, baseQty: number): number {
  switch (kind) {
    case 'PURCHASE':
    case 'SALE_RETURN':
      return baseQty;
    case 'SALE':
    case 'PURCHASE_RETURN':
      return -baseQty;
    default:
      return 0;
  }
}

/**
 * P1 fix (generalized for the Sales Invoice Enterprise Redesign): resolves
 * each line's own account override — inventory (`item.mainAccountId`),
 * sales revenue (`item.salesAccountId`), or COGS (`item.cogsAccountId`) —
 * falling back to the company-wide default when the item has no override
 * (itself falling back further to its `ItemCategory` default snapshotted at
 * item-create time, see item.service.ts#createItem), instead of blindly
 * applying `invoice.lines[0]`'s account to every line. Distinct raw account
 * refs are resolved once each via `resolveAccountId` (code-or-id → the
 * actual `Account.id`) and cached by line id.
 */
async function resolveLineAccounts(
  companyId: string,
  lines: InvoiceWithLines['lines'],
  getRaw: (line: InvoiceWithLines['lines'][number]) => string | null | undefined,
  defaultAccountId: string
): Promise<Map<string, string>> {
  const rawRefs = [
    ...new Set(
      lines
        .map(getRaw)
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    ),
  ];
  const resolvedByRaw = new Map<string, string>();
  await Promise.all(
    rawRefs.map(async (ref) => {
      resolvedByRaw.set(ref, await invoiceAccountResolverService.resolveAccountId(companyId, ref));
    })
  );

  const byLineId = new Map<string, string>();
  for (const line of lines) {
    const raw = getRaw(line);
    byLineId.set(line.id, raw ? resolvedByRaw.get(raw)! : defaultAccountId);
  }
  return byLineId;
}

async function resolveLineInventoryAccounts(
  companyId: string,
  lines: InvoiceWithLines['lines'],
  defaultAccountId: string,
  headerWarehouseId?: string | null
): Promise<Map<string, string>> {
  const system = await getInventorySystem(companyId);
  const warehouseMap = await loadWarehouseGlMap(
    companyId,
    lines.map((line) => resolveInvoiceLineWarehouseId(line.warehouseId, headerWarehouseId))
  );
  return resolveLineAccounts(
    companyId,
    lines,
    (line) => {
      const warehouseId = resolveInvoiceLineWarehouseId(line.warehouseId, headerWarehouseId);
      const warehouseAccount = warehouseId
        ? warehouseMap.get(warehouseId)?.inventoryAccountId
        : null;
      return pickInventoryAccount(
        system,
        defaultAccountId,
        warehouseAccount,
        line.item?.mainAccountId
      );
    },
    defaultAccountId
  );
}

function resolveLineSalesAccounts(
  companyId: string,
  lines: InvoiceWithLines['lines'],
  defaultAccountId: string
): Promise<Map<string, string>> {
  return resolveLineAccounts(companyId, lines, (l) => l.item?.salesAccountId, defaultAccountId);
}

async function resolveLineCogsAccounts(
  companyId: string,
  lines: InvoiceWithLines['lines'],
  defaultAccountId: string,
  headerWarehouseId?: string | null
): Promise<Map<string, string>> {
  const system = await getInventorySystem(companyId);
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { accountDefinitions: true },
  });
  const defs = (settings?.accountDefinitions ?? {}) as AccountDefs;
  const giftRaw = pickAccountDef(defs, [...ACCOUNT_SLOT_ALIASES.giftsAccountId, 'giftAccount']);
  const companyGiftAccountId = giftRaw
    ? await invoiceAccountResolverService.resolveAccountId(companyId, giftRaw)
    : undefined;
  const warehouseMap = await loadWarehouseGlMap(
    companyId,
    lines.map((line) => resolveInvoiceLineWarehouseId(line.warehouseId, headerWarehouseId))
  );
  return resolveLineAccounts(
    companyId,
    lines,
    (line) => {
      const warehouseId = resolveInvoiceLineWarehouseId(line.warehouseId, headerWarehouseId);
      const warehouse = warehouseId ? warehouseMap.get(warehouseId) : undefined;
      const isGift = Number(line.price ?? 0) === 0 && Number(line.quantity ?? 0) > 0;
      if (isGift) {
        return pickInventoryAccount(system, companyGiftAccountId, warehouse?.giftAccountId);
      }
      return pickInventoryAccount(
        system,
        defaultAccountId,
        warehouse?.costAccountId,
        line.item?.cogsAccountId
      );
    },
    defaultAccountId
  );
}

/**
 * Companion to `resolveLineInventoryAccounts`: groups a set of per-line
 * values by each line's resolved account and emits one JE line per
 * distinct account, instead of one aggregate line for the whole invoice.
 * Individually-rounded per-line shares can drift from `expectedTotal` by a
 * sub-cent floating-point epsilon when summed, so — mirroring the same
 * remainder-forcing technique `invoice-m5.service.ts` already uses for
 * header-discount allocation — the last group absorbs whatever residual is
 * left, guaranteeing the JE this feeds into still balances exactly.
 */
function buildGroupedAccountLines(
  valueByAccount: Map<string, number>,
  expectedTotal: number,
  side: 'debit' | 'credit',
  mk: (accountId: string, debit: number, credit: number, description?: string) => JournalEntryLineData,
  description: string
): JournalEntryLineData[] {
  const entries = [...valueByAccount.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return [];
  let runningSum = 0;
  const lines: JournalEntryLineData[] = [];
  entries.forEach(([accountId, rawValue], i) => {
    const isLast = i === entries.length - 1;
    const value = isLast ? roundTo4(expectedTotal - runningSum) : roundTo4(rawValue);
    runningSum = roundTo4(runningSum + value);
    lines.push(
      side === 'debit' ? mk(accountId, value, 0, description) : mk(accountId, 0, value, description)
    );
  });
  return lines;
}

function computeLineTotals(invoice: InvoiceWithLines): InvoiceLineTotals {
  const discount = roundTo4(Number(invoice.discountAmount));
  const merchandise = roundTo4(Number(invoice.totalAmount) - discount);
  const tax = roundTo4(Number(invoice.taxAmount));
  const developmentFee = roundTo4(Number(invoice.developmentFeeAmount ?? 0));
  const net = roundTo4(Number(invoice.netAmount));

  return {
    merchandise,
    discount,
    tax,
    developmentFee,
    net,
    cogs: 0,
  };
}

/**
 * C2 fix — single source of truth for how much an invoice moves a
 * customer/supplier balance by. Previously `post()` computed
 * `net - wht` while `unpost()` computed plain `net` (forgetting to
 * subtract `wht`), so every post→unpost cycle on a WHT-bearing invoice
 * left a permanent residue of exactly the WHT amount on the party
 * balance — and it compounded on every re-post. `unpost()` must call
 * this with the *same* `kind`/`totals` used at post time and then negate
 * the result; that is the only way post and unpost are guaranteed to be
 * exact arithmetic inverses.
 *
 * `totals.net` is sourced from `invoice.netAmount`, which
 * `invoice-m5.service.ts` already persists net of `withholdingTaxAmount`
 * (`netAmount = merchandise + tax + developmentFee - wht`) — it is the amount
 * the party actually pays/receives. It must NOT be subtracted again here;
 * doing so used to double-count WHT and (before that) was the source of the
 * C2 post/unpost asymmetry.
 */
export function computePartyDelta(kind: InvoiceKind, totals: InvoiceLineTotals): number {
  switch (kind) {
    case 'SALE':
    case 'PURCHASE':
      return totals.net;
    case 'SALE_RETURN':
    case 'PURCHASE_RETURN':
      return -totals.net;
    default:
      return 0;
  }
}

export class InvoicePostingOrchestrator {
  private async loadInvoice(companyId: string, invoiceId: string): Promise<InvoiceWithLines> {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        lines: { include: { item: true }, orderBy: { lineOrder: 'asc' } },
        adjustments: true,
      },
    });
    if (!invoice) {
      throw new AppError(404, 'Invoice not found');
    }
    return invoice;
  }

  private async allocateGlNumInTx(
    tx: Prisma.TransactionClient,
    ctx: InvoicePostingContext
  ): Promise<string | undefined> {
    return documentSequenceService.nextGlNumberInTx(tx, {
      companyId: ctx.companyId,
      branchId: ctx.branchId ?? '',
      fiscalYearId: ctx.fiscalYearId,
    });
  }

  async post(ctx: InvoicePostingContext, invoiceId: string) {
    const invoice = await this.loadInvoice(ctx.companyId, invoiceId);

    if (invoice.isPosted) {
      throw new AppError(400, 'Invoice is already posted');
    }
    if (invoice.isCancelled) {
      throw new AppError(400, 'Cannot post a cancelled invoice');
    }
    await taxPeriodService.assertOpenForDocumentDate(ctx.companyId, invoice.date);
    const headerWarehouseId = invoice.warehouseId ?? '';
    const missingLineWarehouse = invoice.lines.some(
      (line) => !resolveInvoiceLineWarehouseId(line.warehouseId, headerWarehouseId)
    );
    if (missingLineWarehouse) {
      throw new AppError(422, 'اختر المخزن لكل صنف أو مخزن الفاتورة قبل الترحيل');
    }

    await approvalWorkflowService.assertCanPostInvoice(ctx.companyId, invoiceId);

    const kind = resolveKind(invoice);
    const moduleCode = invoice.moduleCode ?? defaultInvoiceModuleCode(kind);
    const moduleSettings = await resolveInvoiceModuleSettings(ctx.companyId, moduleCode);
    const txSettings = await loadInvoiceTransactionSettings(ctx.companyId, kind);
    const affectStore = txSettings?.affectStock ?? moduleSettings.postTostore;
    const createGl = txSettings ? txSettings.generateEntryOnSave : !moduleSettings.notCreateGL;
    const allocatedCostCenterId = invoice.costCenterId ?? txSettings?.defaultCostCenterId ?? undefined;

    await advancedRightsService.assertCanPostFamily(
      ctx.companyId,
      ctx.userId,
      ctx.branchId,
      ADVANCED_RIGHT_KEYS[kind].post,
      { isAdmin: ctx.isAdmin, actionLabel: `post ${kind} invoices` }
    );
    const sourceType = legacySourceType(kind);
    const sourceNum = invoice.invoiceNumber ?? invoice.id.slice(0, 8);
    const sourceYearId =
      invoice.sourceYearId ??
      (
        await prisma.fiscalYear.findFirst({
          where: { id: ctx.fiscalYearId, companyId: ctx.companyId },
          select: { legacyYearId: true },
        })
      )?.legacyYearId ??
      String(new Date(invoice.date).getFullYear());

    const rate = Number(invoice.exchangeRate ?? 1);

    if (kind === 'SALE' && invoice.customerId) {
      const creditCheck = await partyCreditService.checkCustomerCredit(
        ctx.companyId,
        invoice.customerId,
        Number(invoice.netAmount)
      );
      const warnOnly = await companySettingService.getFlag(
        ctx.companyId,
        'CreditWarningOnly',
        false
      );
      if (!creditCheck.allowed && !warnOnly) {
        const creditApprovalEnabled = await approvalWorkflowService.isCreditLimitApprovalEnabled(
          ctx.companyId
        );
        const wf = (invoice.workflowStatus ?? 'DRAFT').toUpperCase();
        if (!(creditApprovalEnabled && wf === 'APPROVED')) {
          partyCreditService.assertCustomerCreditAllowed(creditCheck);
        }
      }

      const ledgerCheck = await partyCreditService.checkLedgerRootBudget(
        ctx.companyId,
        ctx.branchId,
        'CUSTOMER',
        Number(invoice.netAmount)
      );
      if (!ledgerCheck.allowed && !warnOnly) {
        partyCreditService.assertLedgerRootBudgetAllowed(ledgerCheck);
      }
    }

    // L3 fix (Item 41): `Supplier.creditLimit`/`estimatedBudget` existed in
    // the schema but nothing ever checked them here — purchase invoices
    // posted uncapped regardless of the agreed ceiling with that supplier.
    // Mirrors the SALE/customer check above (same warn-only escape hatch
    // and approval-override path).
    if (kind === 'PURCHASE' && invoice.supplierId) {
      const creditCheck = await partyCreditService.checkSupplierCredit(
        ctx.companyId,
        invoice.supplierId,
        Number(invoice.netAmount)
      );
      const warnOnly = await companySettingService.getFlag(
        ctx.companyId,
        'CreditWarningOnly',
        false
      );
      if (!creditCheck.allowed && !warnOnly) {
        const creditApprovalEnabled = await approvalWorkflowService.isCreditLimitApprovalEnabled(
          ctx.companyId
        );
        const wf = (invoice.workflowStatus ?? 'DRAFT').toUpperCase();
        if (!(creditApprovalEnabled && wf === 'APPROVED')) {
          partyCreditService.assertSupplierCreditAllowed(creditCheck);
        }
      }

      const ledgerCheck = await partyCreditService.checkLedgerRootBudget(
        ctx.companyId,
        ctx.branchId,
        'SUPPLIER',
        Number(invoice.netAmount)
      );
      if (!ledgerCheck.allowed && !warnOnly) {
        partyCreditService.assertLedgerRootBudgetAllowed(ledgerCheck);
      }
    }

    const totals = computeLineTotals(invoice);
    const wht = roundTo4(Number(invoice.withholdingTaxAmount ?? 0));

    // P1 fix: this used to pass `invoice.lines[0]`'s item account as the
    // *whole invoice's* inventory account default (`defaultInventoryAccountId`),
    // so an invoice mixing items with different `mainAccountId` values (or
    // one item override plus other items with none) posted every line to
    // the first item's account. Always resolve the company's own default
    // here; per-line overrides are applied below via
    // `resolveLineInventoryAccounts` instead.
    await assertNotSellingBelowCost({
      companyId: ctx.companyId,
      userId: ctx.userId,
      invoiceKind: kind,
      asOf: invoice.date,
      lines: invoice.lines.map((line) => ({
        itemId: line.itemId,
        price: Number(line.price),
        arabicName: line.item?.arabicName,
      })),
    });

    const accounts = await invoiceAccountResolverService.assertCompanyPostingReady(
      ctx.companyId,
      kind,
      {
        customerId: invoice.customerId,
        supplierId: invoice.supplierId,
        defaultInventoryAccountId: null,
        branchId: ctx.branchId,
        hasTax: totals.tax > 0,
        hasWht: wht > 0,
        hasDiscount: totals.discount > 0,
      }
    );
    const lineInventoryAccountId = await resolveLineInventoryAccounts(
      ctx.companyId,
      invoice.lines,
      accounts.inventoryAccountId,
      headerWarehouseId
    );
    // Sales Invoice Enterprise Redesign: per-line sales-revenue and COGS
    // account overrides (item.salesAccountId/cogsAccountId, ultimately
    // sourced from the item's category default), mirroring
    // lineInventoryAccountId above. Only meaningful for SALE/SALE_RETURN
    // (revenue) and SALE/SALE_RETURN/PURCHASE_RETURN (COGS) — resolved
    // unconditionally since it's cheap and the item rows are already loaded.
    const lineSalesAccountId = await resolveLineSalesAccounts(
      ctx.companyId,
      invoice.lines,
      txSettings?.defaultSalesAccountId ?? accounts.revenueAccountId
    );
    const lineCogsAccountId = await resolveLineCogsAccounts(
      ctx.companyId,
      invoice.lines,
      accounts.cogsAccountId,
      headerWarehouseId
    );

    // H10 fix: for SALE_RETURN lines linked to an original sale line, use the
    // cost that was actually charged to COGS at issue time rather than today's
    // moving average. Prevents credit-note COGS from diverging from the original.
    const originalLineCostByLineId = new Map<string, number>();
    if (kind === 'SALE_RETURN') {
      const originalLineIds = invoice.lines
        .map((l) => l.originalInvoiceLineId)
        .filter((id): id is string => Boolean(id));
      if (originalLineIds.length > 0) {
        // InvoiceLine has no direct companyId — tenant scope is guaranteed because
        // originalInvoiceLineIds come from this company's own invoice.lines.
        const originalLines = await prisma.invoiceLine.findMany({
          where: { id: { in: originalLineIds } },
          select: { id: true, unitCostAtIssue: true },
        });
        for (const orig of originalLines) {
          if (orig.unitCostAtIssue != null) {
            originalLineCostByLineId.set(orig.id, Number(orig.unitCostAtIssue));
          }
        }
      }
    }

    return prisma.$transaction(async (tx) => {
      // P2 fix: atomic idempotency guard. `updateMany` is a single DB write that
      // only matches when isPosted is still false — concurrent post requests will
      // see count=0 and throw before any stock or GL work runs, preventing
      // duplicate movements and duplicate journal entries.
      const claimPost = await tx.invoice.updateMany({
        where: { id: invoiceId, companyId: ctx.companyId, isPosted: false, isCancelled: false },
        data: { isPosted: true, postedAt: new Date(), postedBy: ctx.userId ?? null },
      });
      if (claimPost.count === 0) {
        throw new AppError(400, 'Invoice is already posted or cancelled');
      }

      let runningCogs = 0;
      const cogsByAccount = new Map<string, number>();
      // Groups the COGS *debit* leg by each line's resolved COGS account —
      // companion to `cogsByAccount` above, which groups the inventory
      // *credit* (relief) leg by each line's resolved inventory account.
      const cogsDebitByAccount = new Map<string, number>();

      const needsCost =
        kind === 'SALE' || kind === 'PURCHASE_RETURN' || kind === 'SALE_RETURN';
      let unitCostByItemId = new Map<string, number>();
      if (needsCost) {
        const uniqueItemIds = [...new Set(invoice.lines.map((l) => l.itemId))];
        unitCostByItemId = await itemCostService.getCostsAsOf(
          ctx.companyId,
          uniqueItemIds,
          invoice.date,
          tx
        );
      }

      // Wave 4 fix: lock stock rows in one canonical order (warehouse + item)
      // instead of whatever order the lines were entered in — see
      // `stock-lock-order.util.ts`. Lines may now issue from different stores.
      const stockLockOrderedLines = sortForStockLocking(invoice.lines, (l) => ({
        warehouseId: resolveInvoiceLineWarehouseId(l.warehouseId, headerWarehouseId) ?? '',
        itemId: l.itemId,
      }));
      for (const line of stockLockOrderedLines) {
        const baseQty = Number(line.baseQuantity);
        const qtyDelta = affectStore ? stockDelta(kind, baseQty) : 0;
        const lineWarehouseId =
          resolveInvoiceLineWarehouseId(line.warehouseId, headerWarehouseId) ?? '';

        if (qtyDelta !== 0) {
          let unitCost: number | undefined;
          const costingBase = {
            companyId: ctx.companyId,
            branchId: ctx.branchId ?? undefined,
            warehouseId: lineWarehouseId,
            itemId: line.itemId,
            sourceType,
            sourceNumber: sourceNum,
            sourceYearId,
            sourceDocumentId: invoice.id,
            transactionDate: invoice.date,
            hijriDate: invoice.hijriDate ?? undefined,
          };

          if (kind === 'PURCHASE') {
            const { unifiedNetUnitCost } = computePurchaseLineNetCost(line, rate);
            const inbound = await inventoryCostingService.applyInboundMovement(tx, {
              ...costingBase,
              quantity: baseQty,
              unitCost: unifiedNetUnitCost,
              movementType: COSTING_MOVEMENT.PURCHASE,
            });
            unitCost = inbound.unitCost;
          } else if (kind === 'SALE_RETURN') {
            // Use the cost saved on the original sale line (unitCostAtIssue) when
            // available, so the credit-note reversal is always at the original COGS —
            // not at today's MAC which may have drifted since the original sale.
            const originalCost = line.originalInvoiceLineId
              ? originalLineCostByLineId.get(line.originalInvoiceLineId)
              : undefined;
            const inbound = await inventoryCostingService.applyInboundMovement(tx, {
              ...costingBase,
              quantity: baseQty,
              unitCost: originalCost ?? (unitCostByItemId.get(line.itemId) ?? 0),
              // Only inherit current MAC when no original cost is available (standalone return)
              inheritCurrentCost: originalCost == null,
              updateLastPurchasePrice: false,
              movementType: COSTING_MOVEMENT.RETURN_SALE,
            });
            unitCost = inbound.unitCost;
            const lineCogs = inbound.totalValuation;
            runningCogs += lineCogs;
            const lineAccountId = lineInventoryAccountId.get(line.id) ?? accounts.inventoryAccountId;
            cogsByAccount.set(
              lineAccountId,
              roundTo4((cogsByAccount.get(lineAccountId) ?? 0) + lineCogs)
            );
            const lineCogsAcct = lineCogsAccountId.get(line.id) ?? accounts.cogsAccountId;
            cogsDebitByAccount.set(
              lineCogsAcct,
              roundTo4((cogsDebitByAccount.get(lineCogsAcct) ?? 0) + lineCogs)
            );
          } else {
            const outbound = await inventoryCostingService.applyOutboundMovement(tx, {
              ...costingBase,
              quantity: baseQty,
              movementType:
                kind === 'SALE' ? COSTING_MOVEMENT.SALE : COSTING_MOVEMENT.RETURN_PURCHASE,
            });
            unitCost = outbound.unitCost;
            const lineCogs = outbound.totalValuation;
            runningCogs += lineCogs;
            const lineAccountId = lineInventoryAccountId.get(line.id) ?? accounts.inventoryAccountId;
            cogsByAccount.set(
              lineAccountId,
              roundTo4((cogsByAccount.get(lineAccountId) ?? 0) + lineCogs)
            );
            const lineCogsAcct = lineCogsAccountId.get(line.id) ?? accounts.cogsAccountId;
            cogsDebitByAccount.set(
              lineCogsAcct,
              roundTo4((cogsDebitByAccount.get(lineCogsAcct) ?? 0) + lineCogs)
            );
          }

          // C5: persist the cost actually charged to COGS on outbound lines
          // so a future return (once linked via H10) can reverse at the true
          // original cost instead of re-deriving whatever the average is by
          // the time the return happens.
          if (kind === 'SALE' || kind === 'PURCHASE_RETURN') {
            await tx.invoiceLine.update({
              where: { id: line.id },
              data: { unitCostAtIssue: new Decimal(unitCost ?? 0) },
            });
          }
        }
      }

      totals.cogs = roundTo4(runningCogs);

      const glNums: (string | undefined)[] = [];
      const needsCogsJe =
        createGl &&
        (kind === 'SALE' ||
          kind === 'SALE_RETURN' ||
          kind === 'PURCHASE_RETURN');
      if (createGl) {
        glNums.push(await this.allocateGlNumInTx(tx, ctx));
        if (needsCogsJe) {
          glNums.push(await this.allocateGlNumInTx(tx, ctx));
        }
      }

      let lineOrder = 1;
      const mkLine = (
        accountId: string,
        debit: number,
        credit: number,
        description?: string,
        costCenterId?: string | null
      ): JournalEntryLineData => ({
        accountId,
        debit: roundTo4(debit),
        credit: roundTo4(credit),
        lineOrder: lineOrder++,
        description,
        costCenterId: costCenterId ?? invoice.costCenterId ?? undefined,
      });

      const pushAdjustmentLines = (target: JournalEntryLineData[], isSaleSide: boolean, sign: number) => {
        const baseSubtotal = roundTo4(Number(invoice.totalAmount) - Number(invoice.discountAmount));
        const invoiceFx = Number(invoice.exchangeRate ?? 1) || 1;
        for (const row of invoice.adjustments ?? []) {
          const amount = computeAdjustmentInvoiceAmount(
            {
              type: row.type,
              calcType: row.calcType,
              rate: row.rate != null ? Number(row.rate) : null,
              amount: Number(row.amount),
              exchangeRate: row.exchangeRate != null ? Number(row.exchangeRate) : null,
              offsetAccountId: row.offsetAccountId,
            },
            baseSubtotal,
            invoiceFx
          );
          if (amount <= 0) continue;
          const isolated = Boolean(row.offsetAccountId);
          const desc = row.description || (row.type === 'ADDITION' ? 'إضافة على الفاتورة' : 'خصم على الفاتورة');
          const creditTheAccount =
            (isSaleSide && row.type === 'ADDITION') || (!isSaleSide && row.type === 'DEDUCTION');
          if (creditTheAccount) {
            target.push(mkLine(row.accountId, 0, sign * amount, desc, row.costCenterId));
            if (isolated && row.offsetAccountId) {
              target.push(mkLine(row.offsetAccountId, sign * amount, 0, desc, row.costCenterId));
            }
          } else {
            target.push(mkLine(row.accountId, sign * amount, 0, desc, row.costCenterId));
            if (isolated && row.offsetAccountId) {
              target.push(mkLine(row.offsetAccountId, 0, sign * amount, desc, row.costCenterId));
            }
          }
        }
      };

      let journalEntryId: string | undefined;
      let costJournalEntryId: string | undefined;

      if (createGl && (kind === 'PURCHASE' || kind === 'PURCHASE_RETURN')) {
        const sign = kind === 'PURCHASE' ? 1 : -1;
        const lines: JournalEntryLineData[] = [];
        // P1 fix: group the merchandise debit by each line's resolved
        // inventory account instead of one aggregate line on
        // `accounts.inventoryAccountId`.
        const merchandiseByAccount = new Map<string, number>();
        const purchaseReturnAccountId =
          kind === 'PURCHASE_RETURN'
            ? txSettings?.defaultPurchaseReturnAccountId ?? accounts.purchaseReturnAccountId
            : undefined;
        for (const line of invoice.lines) {
          const { lineNetDoc } = computePurchaseLineNetCost(line, rate);
          const share = lineNetDoc;
          const accountId =
            purchaseReturnAccountId ||
            lineInventoryAccountId.get(line.id) ||
            accounts.inventoryAccountId;
          merchandiseByAccount.set(
            accountId,
            roundTo4((merchandiseByAccount.get(accountId) ?? 0) + share)
          );
        }
        lines.push(
          ...buildGroupedAccountLines(
            merchandiseByAccount,
            sign * totals.merchandise,
            'debit',
            mkLine,
            purchaseReturnAccountId ? 'Purchase returns' : 'Inventory — purchase'
          )
        );
        if (totals.tax > 0) {
          if (!accounts.vatInputAccountId) {
            throw new AppError(422, VAT_ACCOUNT_UNMAPPED_MESSAGE);
          }
          lines.push(
            mkLine(accounts.vatInputAccountId, sign * totals.tax, 0, 'Input VAT')
          );
        }
        if (totals.developmentFee > 0) {
          const feeAccount = accounts.vatInputAccountId ?? accounts.inventoryAccountId;
          lines.push(
            mkLine(feeAccount, sign * totals.developmentFee, 0, 'رسم التنمية')
          );
        }
        lines.push({
          ...mkLine(accounts.partyAccountId, 0, sign * totals.net, 'Supplier AP'),
          partnerId: invoice.supplierId ?? undefined,
          partnerType: invoice.supplierId ? 'SUPPLIER' : undefined,
        });
        if (wht > 0) {
          if (!accounts.withholdingAccountId) {
            throw new AppError(
              422,
              'Purchase withholding tax requires withholdingTaxAccount in company account definitions'
            );
          }
          lines.push(
            mkLine(accounts.withholdingAccountId, 0, sign * wht, 'Withholding tax')
          );
        }
        pushAdjustmentLines(lines, false, sign);

        const je = await autoGlPostingService.commitInTx(tx, ctx, {
          date: invoice.date,
          hijriDate: invoice.hijriDate ?? undefined,
          description: invoice.description ?? `Purchase invoice ${sourceNum}`,
          currencyCode: invoice.currencyCode,
          exchangeRate: rate,
          fiscalYearId: ctx.fiscalYearId,
          legacyGlNum: glNums[0],
          sourceType,
          sourceId: invoice.id,
          sourceNumber: sourceNum,
          sourceYearId,
          entryType: kind,
          lines,
          costCenterId: invoice.costCenterId,
        });
        journalEntryId = je!.id;

        if (kind === 'PURCHASE_RETURN' && totals.cogs > 0) {
          lineOrder = 1;
          const cogsSign = -1;
          const cogsLines: JournalEntryLineData[] = [
            // Sales Invoice Enterprise Redesign: group the COGS debit by
            // each line's resolved COGS account instead of one aggregate
            // line on `accounts.cogsAccountId`.
            ...buildGroupedAccountLines(
              cogsDebitByAccount,
              cogsSign * totals.cogs,
              'debit',
              mkLine,
              'COGS — purchase return'
            ),
            // P1 fix: group the inventory-relief credit by each line's
            // resolved account instead of one aggregate line.
            ...buildGroupedAccountLines(
              cogsByAccount,
              cogsSign * totals.cogs,
              'credit',
              mkLine,
              'Inventory — purchase return cost'
            ),
          ];
          const costJe = await autoGlPostingService.commitInTx(tx, ctx, {
            date: invoice.date,
            description: `COGS — PR ${sourceNum}`,
            currencyCode: invoice.currencyCode,
            exchangeRate: rate,
            fiscalYearId: ctx.fiscalYearId,
            legacyGlNum: glNums[1],
            sourceType: `${sourceType}-COGS`,
            sourceId: `${invoice.id}:cogs`,
            sourceNumber: sourceNum,
            sourceYearId,
            entryType: `${kind}_COGS`,
            lines: cogsLines,
            costCenterId: invoice.costCenterId,
          });
          costJournalEntryId = costJe!.id;
        }
      }

      if (createGl && (kind === 'SALE' || kind === 'SALE_RETURN')) {
        const sign = kind === 'SALE' ? 1 : -1;
        // Same double-count fix as the purchase side above: `totals.net`
        // already excludes `wht`.
        const arDebit = totals.net;
        const revenueLines: JournalEntryLineData[] = [];
        lineOrder = 1;
        revenueLines.push({
          ...mkLine(accounts.partyAccountId, sign * arDebit, 0, 'Customer AR'),
          partnerId: invoice.customerId ?? undefined,
          partnerType: invoice.customerId ? 'CUSTOMER' : undefined,
        });
        if (wht > 0) {
          if (!accounts.whtReceivableAccountId) {
            throw new AppError(
              422,
              'Sales withholding tax requires whtReceivableAccount in company account definitions'
            );
          }
          revenueLines.push(
            mkLine(
              accounts.whtReceivableAccountId,
              sign * wht,
              0,
              'Sales WHT receivable'
            )
          );
        }
        // M7 fix: credit revenue at GROSS (pre-discount) and debit the
        // discount separately instead of netting it silently into the
        // revenue credit — the discount is now a visible contra-revenue
        // line in the ledger.
        // Sales Invoice Enterprise Redesign: group the gross revenue credit
        // by each line's resolved sales account (item.salesAccountId, else
        // the company default) instead of one aggregate line on
        // `accounts.revenueAccountId` — mirrors the inventory/COGS grouping
        // above so category/item-level GL overrides take effect at posting.
        const revenueByAccount = new Map<string, number>();
        for (const line of invoice.lines) {
          const accountId = lineSalesAccountId.get(line.id) ?? accounts.revenueAccountId;
          revenueByAccount.set(
            accountId,
            roundTo4((revenueByAccount.get(accountId) ?? 0) + Number(line.total))
          );
        }
        revenueLines.push(
          ...buildGroupedAccountLines(
            revenueByAccount,
            sign * Number(invoice.totalAmount),
            'credit',
            mkLine,
            'Sales revenue (gross)'
          )
        );
        if (totals.discount > 0) {
          if (!accounts.salesDiscountAccountId) {
            throw new AppError(
              422,
              'Sales discount requires salesDiscountAccount in company account definitions'
            );
          }
          revenueLines.push(
            mkLine(
              accounts.salesDiscountAccountId,
              sign * totals.discount,
              0,
              'Sales discount'
            )
          );
        }
        if (totals.tax > 0) {
          if (!accounts.vatOutputAccountId) {
            throw new AppError(422, VAT_ACCOUNT_UNMAPPED_MESSAGE);
          }
          revenueLines.push(
            mkLine(accounts.vatOutputAccountId, 0, sign * totals.tax, 'Output VAT')
          );
        }
        if (totals.developmentFee > 0) {
          const feeAccount = accounts.vatOutputAccountId ?? accounts.revenueAccountId;
          revenueLines.push(
            mkLine(feeAccount, 0, sign * totals.developmentFee, 'رسم التنمية')
          );
        }
        pushAdjustmentLines(revenueLines, true, sign);

        const revenueJe = await autoGlPostingService.commitInTx(tx, ctx, {
          date: invoice.date,
          hijriDate: invoice.hijriDate ?? undefined,
          description: invoice.description ?? `Sales invoice ${sourceNum}`,
          currencyCode: invoice.currencyCode,
          exchangeRate: rate,
          fiscalYearId: ctx.fiscalYearId,
          legacyGlNum: glNums[0],
          sourceType,
          sourceId: invoice.id,
          sourceNumber: sourceNum,
          sourceYearId,
          entryType: kind,
          lines: allocateCostCenters(revenueLines, 'SALES', txSettings, allocatedCostCenterId),
          costCenterId: allocatedCostCenterId,
        });
        journalEntryId = revenueJe!.id;

        if (totals.cogs > 0) {
          lineOrder = 1;
          const cogsLines: JournalEntryLineData[] = [
            // Sales Invoice Enterprise Redesign: group the COGS debit by
            // each line's resolved COGS account instead of one aggregate
            // line on `accounts.cogsAccountId`.
            ...buildGroupedAccountLines(
              cogsDebitByAccount,
              sign * totals.cogs,
              'debit',
              mkLine,
              'COGS'
            ),
            // P1 fix: group the inventory-relief credit by each line's
            // resolved account instead of one aggregate line.
            ...buildGroupedAccountLines(
              cogsByAccount,
              sign * totals.cogs,
              'credit',
              mkLine,
              'Inventory relief'
            ),
          ];
          const costJe = await autoGlPostingService.commitInTx(tx, ctx, {
            date: invoice.date,
            description: `COGS — ${sourceNum}`,
            currencyCode: invoice.currencyCode,
            exchangeRate: rate,
            fiscalYearId: ctx.fiscalYearId,
            legacyGlNum: glNums[1],
            sourceType: `${sourceType}-COGS`,
            sourceId: `${invoice.id}:cogs`,
            sourceNumber: sourceNum,
            sourceYearId,
            entryType: `${kind}_COGS`,
            lines: allocateCostCenters(
              cogsLines,
              'COST_OF_GOODS_SOLD',
              txSettings,
              allocatedCostCenterId
            ),
            costCenterId: allocatedCostCenterId,
          });
          costJournalEntryId = costJe!.id;
        }
      }

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          isPosted: true,
          workflowStatus: 'POSTED',
          postedAt: new Date(),
          postedBy: ctx.userId,
          branchId: ctx.branchId,
          fiscalYearId: ctx.fiscalYearId,
          sourceYearId,
          invoiceKind: kind,
          journalEntryId,
          costJournalEntryId,
          record: journalEntryId,
        },
        include: {
          lines: { orderBy: { lineOrder: 'asc' } },
          journalEntry: true,
          costJournalEntry: true,
        },
      });

      if (
        isSplitPaymentInvoice(invoice) &&
        (kind === 'SALE' || kind === 'PURCHASE')
      ) {
        await invoiceSettlementSplitService.autoSettleSplitInTx(tx, ctx, {
          id: updated.id,
          invoiceKind: updated.invoiceKind,
          invoiceNumber: updated.invoiceNumber,
          date: updated.date,
          currencyCode: updated.currencyCode,
          customerId: updated.customerId,
          supplierId: updated.supplierId,
          netAmount: updated.netAmount,
          paymentSplits: invoice.paymentSplits,
        });
      } else if (
        isImmediateCashInvoice(invoice) &&
        (kind === 'SALE' || kind === 'PURCHASE')
      ) {
        // `totals.net` (sourced from `invoice.netAmount`) is already stored
        // net-of-WHT by invoice-m5.service.ts — see the C2 note on
        // `computePartyDelta` above. Subtracting `wht` again here
        // under-settled the cash leg of every WHT-bearing cash invoice,
        // leaving a phantom unpaid remainder equal to the WHT amount.
        const cashDue = totals.net;
        if (cashDue > 0) {
          await invoiceSettlementService.autoSettleCashInTx(tx, ctx, updated, cashDue);
        }
      }

      // Wave 4 fix: this must run *after* the auto-settle branches above.
      // Auto-settle (cash/split) locks safe/bank rows via
      // `treasuryPostingService.postCashTransactionInTx`, which always locks
      // safe/bank before customer/supplier. A plain treasury receipt on the
      // same safe/customer pair follows that same order. If this invoice's
      // own AR/AP delta locked the customer/supplier row *first* — as it did
      // when this ran before the auto-settle call — a concurrent post could
      // acquire customer-then-safe here while a receipt acquired
      // safe-then-customer there, deadlocking. Locking safe/bank first
      // (inside auto-settle) and the party row second keeps every posting
      // path on the same global order.
      if (invoice.customerId && (kind === 'SALE' || kind === 'SALE_RETURN')) {
        const delta = computePartyDelta(kind, totals);
        await tx.customer.update({
          where: { id: invoice.customerId },
          data: { balance: { increment: new Decimal(delta) } },
        });
      }

      if (invoice.supplierId && (kind === 'PURCHASE' || kind === 'PURCHASE_RETURN')) {
        const delta = computePartyDelta(kind, totals);
        await tx.supplier.update({
          where: { id: invoice.supplierId },
          data: { balance: { increment: new Decimal(delta) } },
        });
      }

      await documentAuditService.record(
        {
          companyId: ctx.companyId,
          entityType: 'INVOICE',
          entityId: invoiceId,
          action: 'POSTED',
          userId: ctx.userId,
        },
        tx
      );

      return {
        invoice: updated,
        kind,
        totals: { ...totals, withholding: wht },
      };
    });
  }

  async unpost(ctx: InvoicePostingContext, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId: ctx.companyId },
      include: {
        lines: { include: { item: true }, orderBy: { lineOrder: 'asc' } },
        adjustments: true,
      },
    });
    if (!invoice) {
      throw new AppError(404, 'Invoice not found');
    }
    if (!invoice.isPosted) {
      throw new AppError(400, 'Invoice is not posted');
    }
    // Approval is optional and only applies when the company configured a
    // chain. Unpost always returns the invoice to draft, including clearing
    // isApproved so the owner is not stuck without an approval page setup.

    const kind = resolveKind(invoice);
    const moduleCode = invoice.moduleCode ?? defaultInvoiceModuleCode(kind);
    const moduleSettings = await resolveInvoiceModuleSettings(ctx.companyId, moduleCode);
    const txSettings = await loadInvoiceTransactionSettings(ctx.companyId, kind);
    const affectStore = txSettings?.affectStock ?? moduleSettings.postTostore;

    // Mirror the tax-period guard from post() so unpost cannot reopen a closed
    // VAT/Dariba period or modify entries in a locked fiscal year.
    await taxPeriodService.assertOpenForDocumentDate(ctx.companyId, invoice.date);

    await advancedRightsService.assertCanPostFamily(
      ctx.companyId,
      ctx.userId,
      ctx.branchId,
      ADVANCED_RIGHT_KEYS[kind].unpost,
      { isAdmin: ctx.isAdmin, actionLabel: `unpost ${kind} invoices` }
    );
    const sourceType = legacySourceType(kind);
    const sourceNum = invoice.invoiceNumber ?? invoice.id.slice(0, 8);
    const sourceYearId =
      invoice.sourceYearId ??
      (
        await prisma.fiscalYear.findFirst({
          where: { id: ctx.fiscalYearId, companyId: ctx.companyId },
          select: { legacyYearId: true },
        })
      )?.legacyYearId ??
      String(new Date(invoice.date).getFullYear());

    const unpostResult = await prisma.$transaction(async (tx) => {
      // Reverse tenders first. Invoice AR/AP below uses the full net total, so
      // undoing cash/cheque party deltas beforehand restores the pre-invoice
      // balance without double-counting.
      await invoiceSettlementService.teardownSettlementsInTx(tx, ctx, invoiceId);

      const unpostStockLockOrderedLines = sortForStockLocking(invoice.lines, (l) => ({
        warehouseId: resolveInvoiceLineWarehouseId(l.warehouseId, invoice.warehouseId) ?? '',
        itemId: l.itemId,
      }));
      for (const line of unpostStockLockOrderedLines) {
        const baseQty = Number(line.baseQuantity);
        const reverseDelta = affectStore ? -stockDelta(kind, baseQty) : 0;
        const lineWarehouseId = resolveInvoiceLineWarehouseId(line.warehouseId, invoice.warehouseId);
        if (reverseDelta !== 0 && lineWarehouseId) {
          await stockMovementService.postMovementInTx(tx, {
            companyId: ctx.companyId,
            branchId: ctx.branchId ?? undefined,
            warehouseId: lineWarehouseId,
            itemId: line.itemId,
            quantityDelta: reverseDelta,
            movementType: `${sourceType}-UNPOST`,
            sourceType: `${sourceType}-UNPOST`,
            sourceNumber: sourceNum,
            sourceYearId,
            documentDate: invoice.date,
          });
        }

        // Only PURCHASE writes a moving-average cost history row (C1 fix:
        // SALE_RETURN no longer does), so only PURCHASE needs it removed on
        // unpost/repost.
        if (kind === 'PURCHASE') {
          await itemCostService.removeCostHistoryBySourceInTx(tx, {
            companyId: ctx.companyId,
            itemId: line.itemId,
            sourceType,
            sourceNumber: sourceNum,
            sourceYearId,
          });
        }
      }

      const glUnPost = await companySettingService.getFlag(
        ctx.companyId,
        'GLUnPost',
        true
      );
      if (glUnPost) {
        await journalPostingService.cascadeSourceJournalInTx(
          tx,
          ctx.companyId,
          [invoice.journalEntryId, invoice.costJournalEntryId],
          'unpost',
          ctx.userId
        );
      }

      const totals = computeLineTotals(invoice);
      if (invoice.customerId && (kind === 'SALE' || kind === 'SALE_RETURN')) {
        const delta = -computePartyDelta(kind, totals);
        await tx.customer.update({
          where: { id: invoice.customerId },
          data: { balance: { increment: new Decimal(delta) } },
        });
      }
      if (invoice.supplierId && (kind === 'PURCHASE' || kind === 'PURCHASE_RETURN')) {
        const delta = -computePartyDelta(kind, totals);
        await tx.supplier.update({
          where: { id: invoice.supplierId },
          data: { balance: { increment: new Decimal(delta) } },
        });
      }

      const unposted = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          isPosted: false,
          workflowStatus: 'DRAFT',
          isApproved: false,
          postedAt: null,
          postedBy: null,
          paidAmount: new Decimal(0),
          remainingAmount: new Decimal(roundTo4(Number(invoice.netAmount))),
          paymentStatus: 'UNPAID',
          record: null,
        },
      });

      await documentAuditService.record(
        {
          companyId: ctx.companyId,
          entityType: 'INVOICE',
          entityId: invoiceId,
          action: 'UNPOSTED',
          userId: ctx.userId,
        },
        tx
      );

      return unposted;
    });

    // After the transaction commits: recalculate MAC for PURCHASE invoices so
    // that the weighted-average cost is correct after removing the blended receipt.
    // Must run outside the main tx because recalculateItemCostHistory opens its own.
    if (affectStore && kind === 'PURCHASE') {
      const affectedItemIds = [...new Set(invoice.lines.map((l) => l.itemId))];
      for (const itemId of affectedItemIds) {
        await inventoryCostingService.recalculateItemCostHistory({
          companyId: ctx.companyId,
          itemId,
          startDate: invoice.date,
        });
      }
    }

    return unpostResult;
  }

  async unapprove(companyId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: { id: true, isApproved: true, isPosted: true, workflowStatus: true },
    });
    if (!invoice) throw new AppError(404, 'الفاتورة غير موجودة');
    if (!invoice.isApproved) throw new AppError(400, 'المستند غير معتمد');
    return prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        isApproved: false,
        workflowStatus: invoice.isPosted ? invoice.workflowStatus : 'DRAFT',
      },
    });
  }
}

export const invoicePostingOrchestrator = new InvoicePostingOrchestrator();
